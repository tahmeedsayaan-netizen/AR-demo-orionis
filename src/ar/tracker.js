import { Group, Matrix4, Quaternion, Scene, PerspectiveCamera, Vector3 } from 'three';

/**
 * Camera + MindAR image tracking, rendered through our own three.js renderer.
 * (MindAR's bundled three wrapper targets an older three.js API, so this is a slim port of it.)
 *
 * `mount` is Y-up with 1 unit = marker width and +Z pointing at the bottom edge of the page;
 * the Stage is added there so it is identical to the desktop preview.
 */
export class ARSession {
  constructor({ container, renderer, targetSrc, onFound, onLost }) {
    this.container = container;
    this.renderer = renderer;
    this.targetSrc = targetSrc;
    this.onFound = onFound;
    this.onLost = onLost;

    this.scene = new Scene();
    this.camera = new PerspectiveCamera();
    this.anchor = new Group();
    this.anchor.matrixAutoUpdate = false;
    this.anchor.visible = false;
    this.scene.add(this.anchor);

    this.mount = new Group();
    this.mount.rotation.x = Math.PI / 2; // stage Y-up -> anchor Z (out of the page)
    this.anchor.add(this.mount);

    this.found = false;
    this.lostTimer = null;
    this.onResize = () => this.resize();
  }

  async start() {
    await this.startVideo();
    const { Controller } = await import('mind-ar/dist/mindar-image.prod.js');
    const video = this.video;

    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 1,
      filterMinCF: 0.0001, // lower = steadier, a little more lag
      filterBeta: 0.01,
      warmupTolerance: 3,
      missTolerance: 6,
      onUpdate: (data) => {
        if (data.type !== 'updateMatrix') return;
        this.handleMatrix(data.worldMatrix);
      },
    });

    this.resize();
    const { dimensions } = await this.controller.addImageTargets(this.targetSrc);
    const [w, h] = dimensions[0];
    // MindAR world units are target pixels with origin at the bottom-left; recentre and scale to width = 1.
    this.postMatrix = new Matrix4().compose(new Vector3(w / 2, w / 2 + (h - w) / 2, 0), new Quaternion(), new Vector3(w, w, w));

    await this.controller.dummyRun(video);
    this.controller.processVideo(video);
    window.addEventListener('resize', this.onResize);
  }

  handleMatrix(worldMatrix) {
    if (worldMatrix !== null) {
      const m = new Matrix4();
      m.elements = [...worldMatrix];
      m.multiply(this.postMatrix);
      this.anchor.matrix.copy(m);
      clearTimeout(this.lostTimer);
      if (!this.found) {
        this.found = true;
        this.anchor.visible = true;
        this.onFound?.();
      }
    } else if (this.found) {
      // keep the last pose so content can animate out in place
      this.found = false;
      this.onLost?.();
    }
  }

  startVideo() {
    return new Promise((resolve, reject) => {
      const video = (this.video = document.createElement('video'));
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.muted = true;
      Object.assign(video.style, { position: 'absolute', top: '0px', left: '0px', zIndex: '-2', objectFit: 'cover' });
      this.container.appendChild(video);

      if (!navigator.mediaDevices?.getUserMedia) {
        reject(new Error('Camera access is not supported in this browser.'));
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: false, video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
        .then((stream) => {
          video.addEventListener('loadedmetadata', () => {
            video.setAttribute('width', video.videoWidth);
            video.setAttribute('height', video.videoHeight);
            video.play().catch(() => {});
            resolve();
          });
          video.srcObject = stream;
        })
        .catch((err) => reject(err));
    });
  }

  resize() {
    const { renderer, camera, container, video, controller } = this;
    if (!video || !controller) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = cw / ch;

    let vw, vh;
    if (videoRatio > containerRatio) {
      vh = ch;
      vw = vh * videoRatio;
    } else {
      vw = cw;
      vh = vw / videoRatio;
    }

    const proj = controller.getProjectionMatrix();
    const inputRatio = controller.inputWidth / controller.inputHeight;
    const ratio = inputRatio > containerRatio ? video.width / controller.inputWidth : video.height / controller.inputHeight;
    let fovHeight;
    if (inputRatio > containerRatio) fovHeight = ch * ratio;
    else fovHeight = (cw / controller.inputWidth) * controller.inputHeight * ratio;
    const adjust = ch / fovHeight;

    camera.fov = (2 * Math.atan((1 / proj[5]) * adjust) * 180) / Math.PI;
    camera.near = proj[14] / (proj[10] - 1.0);
    camera.far = proj[14] / (proj[10] + 1.0);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();

    Object.assign(video.style, {
      top: `${-(vh - ch) / 2}px`,
      left: `${-(vw - cw) / 2}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    });
    renderer.setSize(cw, ch);
  }

  stop() {
    window.removeEventListener('resize', this.onResize);
    this.controller?.stopProcessVideo();
    this.video?.srcObject?.getTracks().forEach((t) => t.stop());
    this.video?.remove();
  }
}
