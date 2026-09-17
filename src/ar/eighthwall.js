import * as THREE from 'three';

// 8th Wall Engine (by Niantic Spatial) — loaded from its official CDN distribution, unmodified.
// Licensed under the XR Engine License Agreement: https://github.com/8thwall/engine/blob/main/LICENSE
const ENGINE_URL = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0/dist/xr.js';
const TARGET_URL = 'image-targets/orionis-marker.json';

const REFINE_MS = 1500; // after (re)detection, glide onto the freshest image pose for this long
const DRIFT_POS = 0.05; // then only correct if off by > 5% of the marker width…
const DRIFT_ANGLE = 0.1; // …or ~6°

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
    this.foundAt = 0;
    this.target = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 1 };
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
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
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
            this.followTarget(dt);
            this.onFrame?.(dt);
          },
          onCameraStatusChange: ({ status }) => {
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
      if (!this._worldTracking) {
        this.found = false;
        this.onLost?.();
      }
      return;
    }
    const t = this.target;
    t.pos.set(detail.position.x, detail.position.y, detail.position.z);
    t.quat.set(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w);
    const long = Math.max(detail.scaledWidth ?? 1, detail.scaledHeight ?? 1);
    t.scale = detail.scale * long * this.pageOverCrop;
    this.seeing = true;

    if (type === 'found') {
      this.foundAt = performance.now();
      this.correcting = true;
      if (!this.placed) {
        this.anchor.position.copy(t.pos);
        this.anchor.quaternion.copy(t.quat);
        this.anchor.scale.setScalar(t.scale);
        this.placed = true;
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

    if (!this._worldTracking) {
      // image-only: follow closely with light smoothing
      const k = 1 - Math.exp(-dt * 25);
      a.position.lerp(t.pos, k);
      a.quaternion.slerp(t.quat, k);
      a.scale.setScalar(THREE.MathUtils.lerp(a.scale.x, t.scale, k));
      return;
    }

    const dist = a.position.distanceTo(t.pos);
    const angle = a.quaternion.angleTo(t.quat);
    const refining = performance.now() - this.foundAt < REFINE_MS;
    if (!this.correcting && (dist > DRIFT_POS * t.scale || angle > DRIFT_ANGLE)) this.correcting = true;
    if (!this.correcting && !refining) return; // locked: SLAM keeps it in place

    const k = 1 - Math.exp(-dt * 6);
    a.position.lerp(t.pos, k);
    a.quaternion.slerp(t.quat, k);
    a.scale.setScalar(THREE.MathUtils.lerp(a.scale.x, t.scale, k));
    if (!refining && dist < 0.004 * t.scale && angle < 0.01) this.correcting = false;
  }

  sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.container.clientWidth * dpr);
    this.canvas.height = Math.round(this.container.clientHeight * dpr);
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
