import * as THREE from 'three';
import gsap from 'gsap';

const SW = 0.15;
const SH = SW * (16 / 9);
const BOTTOM = 0.035;
const DOWN_Y = -0.5;

/**
 * Borderless portrait video that rises out of the hatch and plays the Orionis story.
 * Pure video, no frame or controls: tap it to close (or to turn sound on if the browser started it muted).
 */
export class VideoScreen {
  constructor(renderer, { onClose }) {
    this.handlers = { onClose };
    this.group = new THREE.Group();
    this.group.name = 'video-screen';
    this.group.visible = false;
    this.face = new THREE.Group();
    this.group.add(this.face);

    const video = (this.video = document.createElement('video'));
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.addEventListener('ended', () => this.handlers.onClose());

    this.videoTex = new THREE.VideoTexture(video);
    this.videoTex.colorSpace = THREE.SRGBColorSpace;
    this.screen = new THREE.Mesh(
      new THREE.PlaneGeometry(SW, SH),
      new THREE.MeshBasicMaterial({ map: this.videoTex, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.screen.renderOrder = 22;
    this.screen.userData.onTap = () => this.tap();
    this.face.add(this.screen);

    this.open = false;
  }

  setSource(src, poster) {
    if (!this.video.src.endsWith(src)) {
      this.video.src = src;
      this.video.poster = poster;
    }
  }

  /** Call synchronously inside the tap handler so mobile browsers allow sound. */
  prime() {
    const p = this.video.play();
    p?.catch(() => {});
  }

  tap() {
    const v = this.video;
    if (v.muted) {
      v.muted = false;
      v.play().catch(() => {});
      return;
    }
    this.handlers.onClose();
  }

  raiseTl() {
    this.open = true;
    const tl = gsap.timeline();
    tl.set(this.group, { visible: true }, 0)
      .fromTo(this.group.position, { y: DOWN_Y }, { y: BOTTOM + SH / 2, duration: 1.1, ease: 'power2.out' }, 0);
    return tl;
  }

  lowerTl() {
    this.open = false;
    this.video.pause();
    const tl = gsap.timeline({ onComplete: () => (this.group.visible = false) });
    tl.to(this.group.position, { y: DOWN_Y, duration: 0.8, ease: 'power2.in' }, 0);
    return tl;
  }

  update(dt, t, cameraLocal) {
    if (!this.group.visible || !cameraLocal) return;
    const d = cameraLocal.clone().sub(this.group.position);
    this.face.rotation.y = THREE.MathUtils.damp(this.face.rotation.y, Math.atan2(d.x, d.z), 4, dt);
  }
}
