import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, drawIcon } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, roundRect, wrapText, spacedText } from '../util/canvas.js';

const CW = 1400;
const CH = 940;
export const PANEL_W = 0.4;
const PANEL_H = PANEL_W * (CH / CW);

const HIT = {
  back: [50, 14, 460, 104],
  play: [950, 128, 370, 78],
  contact: [950, 800, 370, 74],
};

/**
 * The tilted info panel a card or tab expands into (reference 0:55): back tab, title,
 * body copy, big coloured number (or service icon) and PLAY VIDEO.
 */
export class Panel {
  constructor(renderer, { onBack, onPlay, onContact }) {
    this.handlers = { onBack, onPlay, onContact };
    this.group = new THREE.Group();
    this.group.name = 'panel';
    this.group.visible = false;

    this.face = new THREE.Group(); // billboard
    this.flip = new THREE.Group(); // open/close flourish
    this.group.add(this.face);
    this.face.add(this.flip);

    [this.canvas] = makeCanvas(CW, CH);
    this.tex = canvasTexture(this.canvas, renderer);
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(PANEL_W, PANEL_H), this.mat);
    this.mesh.renderOrder = 20;
    this.mesh.userData.onTap = (hit) => this.tap(hit);
    this.flip.add(this.mesh);
    this.item = null;
    this.open = false;
  }

  tap(hit) {
    if (!hit.uv || !this.item) return;
    const px = hit.uv.x * CW;
    const py = (1 - hit.uv.y) * CH;
    const inside = ([x, y, w, h]) => px >= x && px <= x + w && py >= y && py <= y + h;
    if (inside(HIT.back)) this.handlers.onBack();
    else if (inside(HIT.play)) this.handlers.onPlay(this.item);
    else if (this.item.kind === 'service' && inside(HIT.contact)) this.handlers.onContact();
  }

  draw(item) {
    this.item = item;
    const g = this.canvas.getContext('2d');
    const accent = item.color;
    const accentInk = accent === COLORS.lilac ? COLORS.purpleDeep : accent;
    g.clearRect(0, 0, CW, CH);

    // back tab
    g.shadowColor = COLORS.purple;
    g.shadowBlur = 24;
    roundRect(g, 50, 14, 460, 110, [22, 22, 0, 0]);
    g.fillStyle = COLORS.ink;
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = COLORS.purple;
    g.beginPath();
    g.arc(106, 62, 34, 0, Math.PI * 2);
    g.fill();
    drawIcon(g, 'back', 84, 40, 44, '#fff', 3);
    g.fillStyle = COLORS.lilac;
    g.font = font(800, 26);
    g.textBaseline = 'middle';
    spacedText(g, item.kicker, 160, 62, 3);

    // main card
    g.shadowColor = 'rgba(161,0,255,0.6)';
    g.shadowBlur = 40;
    roundRect(g, 30, 100, CW - 60, CH - 130, 30);
    g.fillStyle = 'rgba(255,255,255,0.97)';
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 8;
    g.strokeStyle = accentInk;
    g.stroke();
    // accent corner stripe
    g.save();
    roundRect(g, 30, 100, CW - 60, CH - 130, 30);
    g.clip();
    g.fillStyle = accentInk;
    g.fillRect(30, CH - 50, CW, 30);
    g.restore();

    // title
    g.fillStyle = COLORS.ink;
    g.textBaseline = 'alphabetic';
    let size = 70;
    g.font = font(900, size);
    while (g.measureText(item.title).width > 850 && size > 40) g.font = font(900, (size -= 4));
    g.fillText(item.title, 80, 216);

    // PLAY VIDEO button
    const [bx, by, bw, bh] = HIT.play;
    roundRect(g, bx, by, bw, bh, bh / 2);
    g.fillStyle = COLORS.ink;
    g.fill();
    g.fillStyle = '#fff';
    g.font = font(800, 30);
    g.textBaseline = 'middle';
    spacedText(g, 'PLAY VIDEO', bx + 40, by + bh / 2 + 1, 3);
    g.fillStyle = COLORS.purple;
    g.beginPath();
    g.arc(bx + bw - 44, by + bh / 2, 27, 0, Math.PI * 2);
    g.fill();
    drawIcon(g, 'play', bx + bw - 60, by + bh / 2 - 16, 32, '#fff');

    // body
    g.fillStyle = '#2a2830';
    g.font = font(500, 36);
    g.textBaseline = 'alphabetic';
    const bodyW = item.kind === 'service' ? 830 : 860;
    let y = wrapText(g, item.body, 80, 290, bodyW, 50, item.kind === 'service' ? 4 : 11);

    if (item.kind === 'service') {
      // bullet chips
      y += 10;
      g.font = font(700, 30);
      item.bullets.forEach((b, k) => {
        const cx = 80 + (k % 2) * 420;
        const cy = y + Math.floor(k / 2) * 84;
        roundRect(g, cx, cy, 395, 64, 32);
        g.fillStyle = accentInk + '1f';
        g.fill();
        g.strokeStyle = accentInk;
        g.lineWidth = 3;
        g.stroke();
        g.fillStyle = COLORS.ink;
        g.textBaseline = 'middle';
        g.fillText(b, cx + 30, cy + 33);
      });
      // big icon
      g.shadowColor = accent;
      g.shadowBlur = 40;
      g.fillStyle = accentInk;
      g.beginPath();
      g.arc(1135, 450, 170, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      drawIcon(g, item.id, 1135 - 110, 450 - 110, 220, '#fff', 1.6);
      // contact button
      const [cx, cy, cw, ch] = HIT.contact;
      roundRect(g, cx, cy, cw, ch, ch / 2);
      g.fillStyle = COLORS.purple;
      g.fill();
      g.fillStyle = '#fff';
      g.font = font(800, 28);
      g.textBaseline = 'middle';
      spacedText(g, "LET'S TALK  ↗", cx + cw / 2, cy + ch / 2 + 1, 2, 'center');
    } else {
      // big number
      g.fillStyle = accentInk;
      g.font = font(900, 520);
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(item.number, 1135, 760);
      g.textAlign = 'left';
      if (item.sample) {
        g.font = font(700, 24);
        g.fillStyle = '#8a8790';
        g.textBaseline = 'middle';
        g.fillText('Sample project · illustrative figures', 80, CH - 80);
      }
    }
    this.tex.needsUpdate = true;
  }

  /**
   * Expand from a source object (card or tab). `target` is the resting position in stage space.
   */
  show(item, source, target, { fromFlat = false, scale = 1 } = {}) {
    this.draw(item);
    this.open = true;
    this.source = source;
    this.fromFlat = fromFlat;
    gsap.killTweensOf([this.group.position, this.group.scale, this.flip.rotation, this.mat]);

    const from = source.getWorldPosition(new THREE.Vector3());
    this.group.parent.worldToLocal(from);
    this.group.position.copy(from);
    this.group.scale.setScalar(0.25 * scale);
    this.flip.rotation.set(fromFlat ? -Math.PI / 2 : 0, fromFlat ? 0 : Math.PI * 0.9, 0);
    this.mat.opacity = 0.3;
    this.group.visible = true;
    this.face.rotation.y = 0;

    const tl = gsap.timeline();
    tl.to(this.group.position, { x: target.x, y: target.y, z: target.z, duration: 0.6, ease: 'power3.out' }, 0)
      .to(this.group.scale, { x: scale, y: scale, z: scale, duration: 0.6, ease: 'back.out(1.2)' }, 0)
      .to(this.flip.rotation, { x: -0.12, y: 0, duration: 0.7, ease: 'power3.out' }, 0)
      .to(this.mat, { opacity: 1, duration: 0.3 }, 0);
    return tl;
  }

  hide() {
    if (!this.open) return gsap.timeline();
    this.open = false;
    const to = this.source.getWorldPosition(new THREE.Vector3());
    this.group.parent.worldToLocal(to);
    const tl = gsap.timeline({ onComplete: () => (this.group.visible = false) });
    tl.to(this.group.position, { x: to.x, y: to.y, z: to.z, duration: 0.45, ease: 'power3.in' }, 0)
      .to(this.group.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.45, ease: 'power3.in' }, 0)
      .to(this.flip.rotation, { x: this.fromFlat ? -Math.PI / 2 : 0, y: this.fromFlat ? 0 : -Math.PI * 0.6, duration: 0.45, ease: 'power2.in' }, 0)
      .to(this.mat, { opacity: 0, duration: 0.2 }, 0.25);
    return tl;
  }

  update(dt, t, cameraLocal) {
    if (!this.group.visible || !cameraLocal) return;
    const d = cameraLocal.clone().sub(this.group.position);
    const yaw = Math.atan2(d.x, d.z);
    this.face.rotation.y = THREE.MathUtils.damp(this.face.rotation.y, yaw, 4, dt);
    this.mesh.position.y = Math.sin(t * 1.1) * 0.004;
  }
}
