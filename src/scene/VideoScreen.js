import * as THREE from 'three';
import gsap from 'gsap';

// Theatre-size screen: about half the page wide, its 9:16 height almost a page width tall.
const SW = 0.54;
const SH = SW * (16 / 9);
const BASE_Y = 0.02; // bottom edge just above the page
const BASE_Z = -0.1; // stands a little behind the centre so the page stays visible in front

/**
 * Borderless portrait video that pops up out of the page, big like a theatre screen, and plays the Orionis story.
 * Pure video, no frame or controls: tap it to close (or to turn sound on if the browser started it muted).
 */
export class VideoScreen {
  constructor(renderer, { onClose }) {
    this.handlers = { onClose };
    this.group = new THREE.Group();
    this.group.name = 'video-screen';
    this.group.visible = false;
    this.group.position.set(0, BASE_Y, BASE_Z);
    this.face = new THREE.Group(); // billboard; pivots at the bottom edge so it grows upward
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
    this.videoTex.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 4;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), softVideoMaterial(this.videoTex));
    this.screen.position.y = SH / 2;
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
      .fromTo(this.group.scale, { x: 0.04, y: 0.04, z: 0.04 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(1.5)' }, 0)
      .fromTo(this.face.rotation, { x: -1.2 }, { x: 0, duration: 0.9, ease: 'power3.out' }, 0);
    return tl;
  }

  lowerTl() {
    this.open = false;
    this.video.pause();
    const tl = gsap.timeline({ onComplete: () => (this.group.visible = false) });
    tl.to(this.group.scale, { x: 0.04, y: 0.04, z: 0.04, duration: 0.6, ease: 'back.in(1.4)' }, 0);
    return tl;
  }

  update(dt, t, cameraLocal) {
    if (!this.group.visible || !cameraLocal) return;
    // face the viewer, and lean back a little when they look down on it from above
    const centre = new THREE.Vector3(0, BASE_Y + SH / 2, BASE_Z);
    const d = cameraLocal.clone().sub(centre);
    this.face.rotation.order = 'YXZ';
    const horizontal = Math.hypot(d.x, d.z);
    // from almost straight above the direction is unstable, so just keep facing the front edge of the page
    const yaw = horizontal > Math.abs(d.y) * 0.25 ? Math.atan2(d.x, d.z) : 0;
    this.face.rotation.y = THREE.MathUtils.damp(this.face.rotation.y, yaw, 4, dt);
    if (this.group.scale.x > 0.99) {
      const elevation = Math.atan2(d.y, horizontal);
      const lean = -THREE.MathUtils.clamp(elevation * 0.6, 0, 0.8);
      this.face.rotation.x = THREE.MathUtils.damp(this.face.rotation.x, lean, 4, dt);
    }
  }
}

/**
 * Video with rounded corners whose edges fade smoothly into the camera view instead of ending in a hard line.
 * Built on MeshBasicMaterial so three.js handles the video's colour space exactly as a normal video texture
 * (a raw shader here washed the colours out); a rounded-rectangle distance field only adds the soft alpha edge.
 */
function softVideoMaterial(map) {
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSize = { value: new THREE.Vector2(SW, SH) };
    shader.uniforms.uRadius = { value: SW * 0.12 };
    shader.uniforms.uFeather = { value: SW * 0.09 };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform vec2 uSize;
        uniform float uRadius;
        uniform float uFeather;
        void main() {`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec2 p = (vMapUv - 0.5) * uSize;
          vec2 q = abs(p) - (uSize * 0.5 - vec2(uRadius));
          float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius; // 0 at the rounded edge, < 0 inside
          float edge = smoothstep(0.0, uFeather, -dist);
          diffuseColor.a *= edge * edge * (3.0 - 2.0 * edge); // extra-soft falloff
        }`,
      );
  };
  return material;
}
