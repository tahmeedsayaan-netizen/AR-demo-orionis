import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, LAYOUT, drawIcon, tabPosition } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, roundRect } from '../util/canvas.js';

const [TW, TH] = LAYOUT.tabSize;
const PX = 2600; // px per stage unit for tab textures
const K = PX / 1400;

/** Flat glowing service tabs that slide out from the ring onto the page (reference 0:06). Tap to explore a service. */
export class ServiceTabs {
  constructor(services, renderer, onSelect) {
    this.group = new THREE.Group();
    this.group.name = 'tabs';
    this.tabs = services.map((svc, i) => {
      const [x, z] = tabPosition(i);
      const canvas = makeCanvas(Math.round(TW * PX * 1.4), Math.round(TH * PX * 1.3))[0];
      const tex = canvasTexture(canvas, renderer);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(TW * 1.4, TH * 1.3).rotateX(-Math.PI / 2), mat);
      mesh.renderOrder = 4;
      mesh.userData.onTap = () => onSelect(i);

      const holder = new THREE.Group();
      holder.add(mesh);
      this.group.add(holder);

      const tab = { svc, i, x, z, holder, mesh, mat, canvas, tex, selected: false };
      this.draw(tab);
      return tab;
    });
    this.reset();
  }

  draw(tab) {
    const { canvas, svc, selected } = tab;
    const g = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const pad = 16 * K;
    const accent = svc.color;
    g.clearRect(0, 0, W, H);

    g.shadowColor = selected ? accent : 'rgba(161,0,255,0.8)';
    g.shadowBlur = (selected ? 28 : 16) * K;
    roundRect(g, pad, pad, W - pad * 2, H - pad * 2, 16 * K);
    g.fillStyle = selected ? accent : 'rgba(255,255,255,0.94)';
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = 4 * K;
    g.strokeStyle = selected ? '#fff' : COLORS.purple;
    g.stroke();

    if (!selected) {
      g.fillStyle = accent === COLORS.lilac ? COLORS.purpleDeep : accent;
      roundRect(g, pad, pad, 14 * K, H - pad * 2, [16 * K, 0, 0, 16 * K]);
      g.fill();
    }

    const text = selected && accent !== COLORS.lilac ? '#fff' : COLORS.ink;
    const icon = 38 * K;
    drawIcon(g, svc.id, pad + 26 * K, H / 2 - icon / 2, icon, text, 2.2);
    g.fillStyle = text;
    g.textBaseline = 'middle';
    const lines = svc.label.split('\n');
    const textX = pad + 26 * K + icon + 14 * K;
    const maxW = W - pad - 34 * K - textX;
    let size = 19 * K;
    g.font = font(800, size);
    while (size > 10 && Math.max(...lines.map((l) => g.measureText(l).width)) > maxW) g.font = font(800, (size -= 1));
    lines.forEach((l, k) => g.fillText(l, textX, H / 2 + (k - (lines.length - 1) / 2) * size * 1.2));

    // "tap" chevron
    g.strokeStyle = selected ? text : COLORS.purple;
    g.lineWidth = 4 * K;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(W - pad - 26 * K, H / 2 - 8 * K);
    g.lineTo(W - pad - 18 * K, H / 2);
    g.lineTo(W - pad - 26 * K, H / 2 + 8 * K);
    g.stroke();
    tab.tex.needsUpdate = true;
  }

  reset() {
    this.tabs.forEach((t) => {
      gsap.killTweensOf([t.holder.position, t.holder.scale, t.mat]);
      t.holder.position.set(t.x * 0.45, 0.003, t.z * 0.45);
      t.holder.scale.setScalar(0.3);
      t.mat.opacity = 0;
      if (t.selected) this.select(-1);
    });
  }

  introTl() {
    const tl = gsap.timeline();
    this.tabs.forEach((t, k) => {
      const at = k * 0.07;
      tl.to(t.mat, { opacity: 1, duration: 0.3 }, at)
        .to(t.holder.position, { x: t.x, z: t.z, duration: 0.7, ease: 'back.out(1.4)' }, at)
        .to(t.holder.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.8)' }, at);
    });
    return tl;
  }

  select(index) {
    this.tabs.forEach((t) => {
      const on = t.i === index;
      if (on === t.selected) return;
      t.selected = on;
      this.draw(t);
      gsap.to(t.holder.position, { y: on ? 0.012 : 0.003, duration: 0.35, ease: 'power2.out' });
      gsap.to(t.holder.scale, { x: on ? 1.08 : 1, z: on ? 1.08 : 1, duration: 0.35, ease: 'back.out(2)' });
    });
  }

  update(dt, t) {
    this.tabs.forEach((tab, i) => {
      if (!tab.selected && tab.mat.opacity > 0.99) tab.mesh.position.y = Math.sin(t * 2 + i) * 0.0012;
    });
  }
}
