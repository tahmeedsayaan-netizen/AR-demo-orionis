import * as THREE from 'three';

// 8th Wall Engine (by Niantic Spatial) — loaded from its official CDN distribution, unmodified.
// Licensed under the XR Engine License Agreement: https://github.com/8thwall/engine/blob/main/LICENSE
const ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0/dist/xr.js';
const TARGET_URL = 'image-targets/orionis-marker.json';

// Stability tuning. Raw image-target poses jitter from frame to frame (more when close or at an angle),
// so they are averaged, the placement settles once and then stays locked to the room by SLAM.
const POSE_SMOOTHING = 0.12; // share of each new detection mixed into the averaged pose
const SETTLE_MS = 1200; // after the very first detection, glide onto the averaged pose for this long
const DRIFT_POS = 0.12; // afterwards only re-align if the page is really off: > 12% of its width…
const DRIFT_ANGLE = 0.17; // …or ~10°
const DRIFT_HOLD_MS = 700; // …and only if that stays true for a while (not a single noisy reading)

/**
 * Image target → world tracking. The page is detected once, the stage is placed on it and then
 * stays locked in the room by SLAM: walk around it, get close, look away and back.
 * Whenever the page is seen again the placement is quietly refined, so drift self-corrects.
 *
 * On devices without world tracking (desktop browsers) it falls back to plain image tracking.
 */
export class EighthWallSession {
  constructor({ container, onFound, onLost, onTrackingLimited }) {
    this.container = container;
    this.onFound = onFound;
    this.onLost = onLost;
    this.onTrackingLimited = onTrackingLimited;
    this.onFrame = null;

    this.anchor = new THREE.Group(); // world pose of the page
    this.anchor.visible = false;
    this.roll = new THREE.Group(); // compensates for targets the CLI stored rotated to portrait
    this.mount = new THREE.Group(); // stage space: Y up from the page, 1 unit = page width
    this.mount.rotation.x = Math.PI / 2;
    this.anchor.add(this.roll);
    this.roll.add(this.mount);

    this.placed = false;
    this.seeing = false;
    this.correcting = false;
    this.placedAt = 0;
    this.driftSince = 0;
    this.hasTarget = false;
    this.target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 }; // averaged detection
    this.found = false;
  }

  get worldTracking() {
    return this._worldTracking;
  }

  async start() {
    window.THREE = THREE; // XR8.Threejs uses the global
    const [XR8, targetData] = await Promise.all([loadEngine(), fetch(TARGET_URL).then((r) => r.json())]);
    this.XR8 = XR8;
    this.configureTarget(targetData);

    const os = XR8.XrDevice?.deviceEstimate?.().os ?? '';
    this._worldTracking = /ios|android/i.test(os) || /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (this._worldTracking && XR8.loadChunk) await XR8.loadChunk('slam');

    const canvas = (this.canvas = document.createElement('canvas'));
    canvas.id = 'camerafeed';
    Object.assign(canvas.style, { position: 'absolute', display: 'block' });
    this.container.appendChild(canvas);
    this.sizeCanvas();
    this.onResize = () => this.sizeCanvas();
    window.addEventListener('resize', this.onResize);

    XR8.XrController.configure({
      imageTargetData: [targetData],
      disableWorldTracking: !this._worldTracking,
      scale: 'responsive',
    });

    await new Promise((resolve, reject) => {
      const clock = new THREE.Clock();
      XR8.addCameraPipelineModules([
        XR8.GlTextureRenderer.pipelineModule(), // camera feed
        XR8.Threejs.pipelineModule(), // three.js scene + render
        XR8.XrController.pipelineModule(), // SLAM + image targets
        {
          name: 'orionis',
          onStart: () => {
            const { scene, camera, renderer } = XR8.Threejs.xrScene();
            this.scene = scene;
            this.camera = camera;
            this.renderer = renderer;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            scene.add(this.anchor);
            camera.position.set(0, 1.4, 0);
            XR8.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
            resolve();
          },
          onUpdate: () => {
            const dt = Math.min(clock.getDelta(), 0.05);
            // the camera frame changes shape when the phone rotates
            const v = this.video;
            if (v && (v.videoWidth !== this.videoW || v.videoHeight !== this.videoH)) this.sizeCanvas();
            this.followTarget(dt);
            this.onFrame?.(dt);
          },
          onCameraStatusChange: ({ status, stream, video }) => {
            if (status === 'hasStream' && stream) setOneTimesZoom(stream);
            if (status === 'hasVideo' && video) {
              this.video = video;
              this.sizeCanvas();
            }
            if (status === 'failed') reject(Object.assign(new Error('Camera failed to start'), { name: 'CameraFailed' }));
          },
          onException: (err) => reject(err instanceof Error ? err : new Error(String(err))),
          listeners: [
            { event: 'reality.imagefound', process: ({ detail }) => this.image('found', detail) },
            { event: 'reality.imageupdated', process: ({ detail }) => this.image('updated', detail) },
            { event: 'reality.imagelost', process: ({ detail }) => this.image('lost', detail) },
            {
              event: 'reality.trackingstatus',
              process: ({ detail }) => {
                if (this.placed && detail.status === 'LIMITED' && detail.reason !== 'INITIALIZING') this.onTrackingLimited?.();
              },
            },
          ],
        },
      ]);
      requestVideoModeCamera();
      XR8.run({ canvas, allowedDevices: XR8.XrConfig.device().ANY });
    });
  }

  configureTarget(data) {
    const p = data.properties;
    // Stage unit = full printed page width; the target is a centred crop of the page.
    const cropLong = Math.max(p.width, p.height);
    const originalLong = Math.max(p.originalWidth, p.originalHeight);
    this.pageOverCrop = originalLong / cropLong;
    // The CLI stores a landscape page rotated into portrait, but the engine reports poses in the
    // page's own landscape orientation, so no extra roll is needed (checked with a camera test).
    this.roll.rotation.z = 0;
    this.targetName = data.name;
  }

  image(type, detail) {
    if (detail.name !== this.targetName) return;
    if (type === 'lost') {
      this.seeing = false;
      this.driftSince = 0;
      if (!this._worldTracking) {
        this.found = false;
        this.onLost?.();
      }
      return;
    }
    const t = this.target;
    const pos = new THREE.Vector3(detail.position.x, detail.position.y, detail.position.z);
    const quat = new THREE.Quaternion(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w);
    const long = Math.max(detail.scaledWidth ?? 1, detail.scaledHeight ?? 1);
    const scale = detail.scale * long * this.pageOverCrop;
    if (!this.hasTarget || type === 'found') {
      // fresh sighting: start the average from this reading
      t.pos.copy(pos);
      t.quat.copy(quat);
      t.scale = scale;
      this.hasTarget = true;
    } else {
      t.pos.lerp(pos, POSE_SMOOTHING);
      t.quat.slerp(quat, POSE_SMOOTHING);
      t.scale = THREE.MathUtils.lerp(t.scale, scale, POSE_SMOOTHING);
    }
    this.seeing = true;

    if (type === 'found') {
      if (!this.placed) {
        this.anchor.position.copy(t.pos);
        this.anchor.quaternion.copy(t.quat);
        this.anchor.scale.setScalar(t.scale);
        this.placed = true;
        this.placedAt = performance.now();
      }
      if (!this.found) {
        this.found = true;
        this.anchor.visible = true;
        this.onFound?.();
      }
    }
  }

  followTarget(dt) {
    if (!this.placed || !this.seeing) return;
    const a = this.anchor;
    const t = this.target;
    const glide = (rate) => {
      const k = 1 - Math.exp(-dt * rate);
      a.position.lerp(t.pos, k);
      a.quaternion.slerp(t.quat, k);
      a.scale.setScalar(THREE.MathUtils.lerp(a.scale.x, t.scale, k));
    };

    if (!this._worldTracking) {
      glide(10); // image-only (desktop): follow the averaged pose smoothly
      return;
    }

    const now = performance.now();
    if (now - this.placedAt < SETTLE_MS) {
      glide(4); // settle onto the averaged pose once
      return;
    }

    // Locked. SLAM holds the stage in the room; only real, persistent drift triggers a slow re-align.
    const dist = a.position.distanceTo(t.pos);
    const angle = a.quaternion.angleTo(t.quat);
    const drifted = dist > DRIFT_POS * a.scale.x || angle > DRIFT_ANGLE;
    if (!this.correcting) {
      if (!drifted) {
        this.driftSince = 0;
        return;
      }
      this.driftSince ||= now;
      if (now - this.driftSince < DRIFT_HOLD_MS) return;
      this.correcting = true;
    }
    glide(2.5);
    if (dist < 0.01 * a.scale.x && angle < 0.015) {
      this.correcting = false;
      this.driftSince = 0;
    }
  }

  /**
   * Fill the whole screen with the camera (no black bars). The engine centre-crops the feed to the
   * canvas shape; with the 16:9 "Video 1x" feed that trims only a little from the sides on a phone.
   */
  sizeCanvas() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = this.video;
    this.videoW = v?.videoWidth;
    this.videoH = v?.videoHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    Object.assign(this.canvas.style, { width: `${w}px`, height: `${h}px`, left: '0px', top: '0px' });
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  stop() {
    window.removeEventListener('resize', this.onResize);
    try {
      this.XR8?.stop();
      this.XR8?.clearCameraPipelineModules();
    } catch {
      /* already stopped */
    }
  }
}

/**
 * Match the phone camera app's "Video 1x" view: ask for a 16:9 (1280×720) back-camera feed instead of
 * the engine's default 4:3, keeping its lens choice. Falls back to the engine's own request if refused.
 */
function requestVideoModeCamera() {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia || media.getUserMedia.__orionis) return;
  const original = media.getUserMedia.bind(media);
  const patched = async (constraints) => {
    const video = constraints?.video;
    const front = video && JSON.stringify(video.facingMode ?? '').includes('user');
    if (!video || typeof video !== 'object' || front) return original(constraints);
    const { width, height, aspectRatio, ...rest } = video;
    let videoMode = { ...rest, width: { ideal: 1280 }, height: { ideal: 720 } };
    videoMode = await preferMainBackCamera(media, original, videoMode);
    return original({ ...constraints, video: videoMode }).catch(() => original(constraints));
  };
  patched.__orionis = true;
  media.getUserMedia = patched;
}

/**
 * iPhones expose several rear lenses. On a first visit (before camera permission) the browser hides their
 * names, so the engine can end up on a zoomed lens; on later visits it finds "Back Camera" (the 1x lens).
 * Make every visit behave like the later ones: unlock the names once, then pick "Back Camera" explicitly.
 */
async function preferMainBackCamera(media, original, video) {
  if (video.deviceId || !/iPhone|iPad|iPod/.test(navigator.userAgent)) return video;
  const cameras = async () => (await media.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'videoinput');
  let list = await cameras();
  if (list.length && !list.some((d) => d.label)) {
    try {
      const probe = await original({ video: { facingMode: 'environment' } });
      probe.getTracks().forEach((t) => t.stop());
      list = await cameras();
    } catch {
      return video;
    }
  }
  const main = list.find((d) => d.label === 'Back Camera');
  if (!main) return video;
  const { facingMode, ...rest } = video;
  return { ...rest, deviceId: { exact: main.deviceId } };
}

/** Multi-lens phones can open on the ultra-wide or a zoomed lens; ask for plain 1x where supported. */
function setOneTimesZoom(stream) {
  try {
    const track = stream.getVideoTracks()[0];
    const zoom = track?.getCapabilities?.().zoom;
    if (!zoom || zoom.min > 1 || zoom.max < 1) return;
    if (track.getSettings?.().zoom === 1) return;
    track.applyConstraints({ advanced: [{ zoom: 1 }] }).catch(() => {});
  } catch {
    /* zoom control not available in this browser */
  }
}

function loadEngine() {
  if (window.XR8) return Promise.resolve(window.XR8);
  return new Promise((resolve, reject) => {
    window.addEventListener('xrloaded', () => resolve(window.XR8), { once: true });
    const s = document.createElement('script');
    s.src = ENGINE_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.dataset.preloadChunks = 'slam';
    s.onerror = () => reject(new Error('Could not load the AR engine. Check your connection.'));
    document.head.appendChild(s);
  });
}
