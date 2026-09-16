import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, drawIcon } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, roundRect } from '../util/canvas.js';

const SW = 0.15;
const SH = SW * (16 / 9);
const BOTTOM = 0.035;
const DOWN_Y = -0.5;

/**
 * Portrait "phone" screen that rises out of the hatch and plays the Orionis story video,
 * with tap-to-pause, a progress bar, close and fullscreen controls.
 */
export class VideoScreen {
  constructor(renderer, { onClose, onFullscreen }) {
    this.handlers = { onClose, onFullscreen };
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

    // glowing frame
    const [fc, fg] = makeCanvas(420, 720);
    fg.shadowColor = COLORS.purple;
    fg.shadowBlur = 40;
    roundRect(fg, 30, 30, 360, 660, 38);
    fg.fillStyle = '#0b0810';
    fg.fill();
    fg.shadowBlur = 0;
    fg.lineWidth = 8;
    fg.strokeStyle = COLORS.lilac;
    fg.stroke();
    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(SW * (420 / 330), SH * (720 / 600)),
      new THREE.MeshBasicMaterial({ map: canvasTexture(fc, renderer), transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    frame.position.z = -0.002;
    frame.renderOrder = 21;
    this.face.add(frame);

    this.videoTex = new THREE.VideoTexture(video);
    this.videoTex.colorSpace = THREE.SRGBColorSpace;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: this.videoTex, color: 0xffffff }));
    this.screen.renderOrder = 22;
    this.face.add(this.screen);

    [this.ui] = makeCanvas(360, 640);
    this.uiTex = canvasTexture(this.ui, renderer);
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: this.uiTex, transparent: true, depthWrite: false }));
    this.overlay.position.z = 0.001;
    this.overlay.renderOrder = 23;
    this.overlay.userData.onTap = (hit) => this.tap(hit);
    this.face.add(this.overlay);

    this.lastDraw = 0;
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

  tap(hit) {
    if (!hit.uv) return;
    const x = hit.uv.x * 360;
    const y = (1 - hit.uv.y) * 640;
    if (x > 290 && y < 70) return this.handlers.onClose();
    if (x > 290 && y > 570) return this.handlers.onFullscreen(this.video.currentTime);
    if (this.video.paused) this.video.play().catch(() => {});
    else this.video.pause();
    this.drawUI(true);
  }

  drawUI(force = false) {
    const now = performance.now();
    if (!force && now - this.lastDraw < 120) return;
    this.lastDraw = now;
    const g = this.ui.getContext('2d');
    g.clearRect(0, 0, 360, 640);
    const v = this.video;

    // top shade + close
    const top = g.createLinearGradient(0, 0, 0, 90);
    top.addColorStop(0, 'rgba(0,0,0,0.55)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, 360, 90);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.beginPath();
    g.arc(322, 36, 24, 0, Math.PI * 2);
    g.fill();
    drawIcon(g, 'close', 310, 24, 24, '#fff', 3);
    g.fillStyle = '#fff';
    g.font = font(800, 18);
    g.textBaseline = 'middle';
    g.fillText('ORIONIS STORY', 18, 36);

    // bottom shade, progress, fullscreen
    const bot = g.createLinearGradient(0, 540, 0, 640);
    bot.addColorStop(0, 'rgba(0,0,0,0)');
    bot.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = bot;
    g.fillRect(0, 540, 360, 100);
    const p = v.duration ? v.currentTime / v.duration : 0;
    roundRect(g, 18, 600, 260, 8, 4);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fill();
    roundRect(g, 18, 600, Math.max(8, 260 * p), 8, 4);
    g.fillStyle = COLORS.purple;
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 3.5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(306, 596); g.lineTo(306, 586); g.lineTo(316, 586);
    g.moveTo(338, 586); g.lineTo(348, 586); g.lineTo(348, 596);
    g.moveTo(348, 610); g.lineTo(348, 620); g.lineTo(338, 620);
    g.moveTo(316, 620); g.lineTo(306, 620); g.lineTo(306, 610);
    g.stroke();

    if (v.paused) {
      g.fillStyle = 'rgba(161,0,255,0.9)';
      g.beginPath();
      g.arc(180, 320, 48, 0, Math.PI * 2);
      g.fill();
      drawIcon(g, 'play', 154, 294, 56, '#fff');
    }
    this.uiTex.needsUpdate = true;
  }

  raiseTl() {
    this.open = true;
    const tl = gsap.timeline();
    tl.set(this.group, { visible: true }, 0)
      .fromTo(this.group.position, { y: DOWN_Y }, { y: BOTTOM + SH / 2 - 0.0, duration: 1.1, ease: 'power2.out' }, 0);
    this.drawUI(true);
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
    if (!this.group.visible) return;
    if (cameraLocal) {
      const d = cameraLocal.clone().sub(this.group.position);
      this.face.rotation.y = THREE.MathUtils.damp(this.face.rotation.y, Math.atan2(d.x, d.z), 4, dt);
    }
    this.drawUI();
  }
}
