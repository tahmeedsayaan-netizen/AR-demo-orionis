import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, drawIcon } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, roundRect, drawCover, loadImage, spacedText } from '../util/canvas.js';
import { drawArt } from './art.js';

export const CARD_W = 0.15;
export const CARD_H = 0.1;

// resting positions around and behind the presenter (reference 0:08)
const SLOTS = [
  [-0.29, 0.30, -0.13],
  [-0.33, 0.14, 0.04],
  [0.3, 0.34, -0.17],
  [0.34, 0.17, -0.01],
  [-0.02, 0.45, -0.3],
];

/** Photo cards that fly up and hover around the ring. Tap one to open its case-study panel. */
export class FloatingCards {
  constructor(cases, renderer, onSelect) {
    this.group = new THREE.Group();
    this.group.name = 'cards';
    this.renderer = renderer;
    this.cards = cases.map((c, i) => {
      const [canvas] = makeCanvas(768, 512);
      const tex = canvasTexture(canvas, renderer);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, opacity: 1 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 1.1, CARD_H * 1.1), mat);
      mesh.renderOrder = 6;
      mesh.userData.onTap = () => onSelect(i);

      const holder = new THREE.Group(); // tweened position
      const face = new THREE.Group(); // billboarded rotation
      face.add(mesh);
      holder.add(face);
      this.group.add(holder);

      const [x, y, z] = SLOTS[i % SLOTS.length];
      return { data: c, i, holder, face, mesh, mat, canvas, tex, home: new THREE.Vector3(x, y, z), phase: i * 1.7, active: true };
    });
    this.reset();
  }

  async load(posterUrl) {
    this.poster = await loadImage(posterUrl).catch(() => null);
    this.cards.forEach((c) => this.draw(c));
  }

  draw(card) {
    const { canvas, data } = card;
    const g = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const p = 18;
    g.clearRect(0, 0, W, H);

    // glowing frame
    g.shadowColor = data.color;
    g.shadowBlur = 26;
    roundRect(g, p, p, W - p * 2, H - p * 2, 24);
    g.fillStyle = '#0d0a12';
    g.fill();
    g.shadowBlur = 0;

    const ix = p + 10, iy = p + 10, iw = W - p * 2 - 20, ih = H - p * 2 - 20;
    if (data.art === 'story' && this.poster) {
      g.save();
      roundRect(g, ix, iy, iw, ih, 18);
      g.clip();
      drawCover(g, this.poster, ix, iy - 60, iw, ih + 160);
      const shade = g.createLinearGradient(0, iy, 0, iy + ih);
      shade.addColorStop(0.35, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(40,0,70,0.92)');
      g.fillStyle = shade;
      g.fillRect(ix, iy, iw, ih);
      g.restore();
      // play button
      g.shadowColor = COLORS.purple;
      g.shadowBlur = 30;
      g.fillStyle = COLORS.purple;
      g.beginPath();
      g.arc(W / 2, H / 2 - 30, 58, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      drawIcon(g, 'play', W / 2 - 28, H / 2 - 64, 64, '#fff');
    } else {
      drawArt(g, data.art, ix, iy, iw, ih, data.color);
    }

    // caption band
    const bandH = 116;
    g.save();
    roundRect(g, ix, iy + ih - bandH, iw, bandH, [0, 0, 18, 18]);
    g.clip();
    g.fillStyle = 'rgba(8,6,12,0.82)';
    g.fillRect(ix, iy + ih - bandH, iw, bandH);
    g.restore();

    g.fillStyle = data.color;
    g.font = font(900, 82);
    g.textBaseline = 'middle';
    g.fillText(data.number, ix + 24, iy + ih - bandH / 2 + 4);
    g.fillStyle = COLORS.lilac;
    g.font = font(700, 22);
    spacedText(g, data.kicker, ix + 90, iy + ih - bandH / 2 - 22, 2.5);
    g.fillStyle = '#fff';
    g.font = font(800, 40);
    g.fillText(data.title, ix + 88, iy + ih - bandH / 2 + 20);

    if (data.sample) {
      g.font = font(700, 18);
      const label = 'SAMPLE PROJECT';
      const lw = g.measureText(label).width + 26;
      roundRect(g, W - p - 20 - lw, p + 22, lw, 34, 17);
      g.fillStyle = 'rgba(0,0,0,0.65)';
      g.fill();
      g.fillStyle = COLORS.lilac;
      g.fillText(label, W - p - 20 - lw + 13, p + 40);
    }

    // frame outline
    roundRect(g, p, p, W - p * 2, H - p * 2, 24);
    g.strokeStyle = data.color === COLORS.lilac ? COLORS.lilac : data.color;
    g.lineWidth = 5;
    g.stroke();
    card.tex.needsUpdate = true;
  }

  reset() {
    this.cards.forEach((c) => {
      gsap.killTweensOf([c.holder.position, c.holder.scale]);
      c.holder.position.set(c.home.x * 0.2, 0.02, c.home.z * 0.2);
      c.holder.scale.setScalar(0.001);
      c.holder.visible = false;
      c.active = true;
    });
  }

  introTl() {
    const tl = gsap.timeline();
    this.cards.forEach((c, k) => {
      const at = k * 0.11;
      tl.set(c.holder, { visible: true }, at)
        .to(c.holder.position, { x: c.home.x, y: c.home.y, z: c.home.z, duration: 0.9, ease: 'back.out(1.3)' }, at)
        .to(c.holder.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.7)' }, at);
    });
    return tl;
  }

  /** Hide all cards except `keep` (index or -1) while a panel is open. */
  hideOthers(keep = -1) {
    this.cards.forEach((c) => {
      if (c.i === keep) return;
      c.active = false;
      gsap.to(c.holder.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.35, ease: 'back.in(1.6)', onComplete: () => (c.holder.visible = false) });
    });
  }

  showAll() {
    this.cards.forEach((c, k) => {
      c.active = true;
      c.holder.visible = true;
      gsap.to(c.holder.position, { x: c.home.x, y: c.home.y, z: c.home.z, duration: 0.6, ease: 'power3.out', delay: k * 0.05 });
      gsap.to(c.holder.scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: 'back.out(1.7)', delay: k * 0.05 });
    });
  }

  update(dt, t, cameraLocal) {
    this.cards.forEach((c) => {
      c.mesh.position.y = Math.sin(t * 1.3 + c.phase) * 0.008;
      c.mesh.rotation.z = Math.sin(t * 0.9 + c.phase) * 0.04;
      if (cameraLocal) {
        const target = cameraLocal.clone().sub(c.holder.position);
        const yaw = Math.atan2(target.x, target.z);
        const pitch = Math.atan2(target.y, Math.hypot(target.x, target.z)) * 0.6;
        c.face.rotation.order = 'YXZ';
        c.face.rotation.y = THREE.MathUtils.damp(c.face.rotation.y, yaw, 5, dt);
        c.face.rotation.x = THREE.MathUtils.damp(c.face.rotation.x, -pitch, 5, dt);
      }
    });
  }
}
