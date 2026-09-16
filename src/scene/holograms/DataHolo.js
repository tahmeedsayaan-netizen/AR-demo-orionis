import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../../util/brand.js';
import { makeCanvas, canvasTexture, font } from '../../util/canvas.js';
import { Hologram } from './Hologram.js';

const DATASETS = [
  { label: 'Marketing ROI  +230%', values: [0.3, 0.42, 0.38, 0.55, 0.7, 0.92] },
  { label: 'Revenue by channel', values: [0.8, 0.35, 0.6, 0.25, 0.5, 0.4] },
  { label: 'Conversion rate  +48%', values: [0.2, 0.26, 0.4, 0.46, 0.58, 0.66] },
];
const MAX_H = 0.2;

/** Digital Growth & Data: live 3D bar + line chart. Tap to switch dataset. */
export class DataHolo extends Hologram {
  constructor(color, toast, renderer) {
    super(color, toast);
    this.renderer = renderer;
    this.chart = new THREE.Group();
    this.chart.position.y = 0.035;
    this.content.add(this.chart);

    const colors = [COLORS.purpleDeep, COLORS.purple, COLORS.pink, COLORS.orange, COLORS.lilac, COLORS.purple];
    const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.bars = DATASETS[0].values.map((_, i) => {
      const m = new THREE.Mesh(geo, this.mat(colors[i], 0.8));
      m.scale.set(0.026, 0.001, 0.026);
      m.position.x = -0.1 + i * 0.04;
      m.add(this.edges(geo, COLORS.purpleDark, 0.6));
      this.tappable(m, 'bar');
      this.chart.add(m);
      return m;
    });

    // floor grid
    const grid = new THREE.GridHelper(0.28, 8, COLORS.lilac, COLORS.purpleDeep);
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    this.chart.add(grid);

    // trend line
    this.linePts = this.bars.map(() => new THREE.Vector3());
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.linePts), new THREE.LineBasicMaterial({ color: COLORS.orange }));
    this.chart.add(this.line);
    this.dots = this.bars.map(() => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), this.mat(COLORS.orange, 1));
      this.chart.add(d);
      return d;
    });

    // label sprite
    [this.labelCanvas] = makeCanvas(512, 96);
    this.labelTex = canvasTexture(this.labelCanvas, renderer);
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTex, transparent: true, depthWrite: false }));
    this.label.scale.set(0.2, 0.0375, 1);
    this.label.position.y = MAX_H + 0.08;
    this.content.add(this.label);

    this.index = -1;
  }

  setData(i) {
    this.index = i;
    const ds = DATASETS[i];
    ds.values.forEach((v, k) => {
      gsap.to(this.bars[k].scale, { y: v * MAX_H, duration: 0.9, delay: k * 0.06, ease: 'elastic.out(1, 0.6)' });
    });
    const g = this.labelCanvas.getContext('2d');
    g.clearRect(0, 0, 512, 96);
    g.fillStyle = 'rgba(16,16,16,0.85)';
    g.beginPath();
    g.roundRect ? g.roundRect(4, 4, 504, 88, 44) : g.rect(4, 4, 504, 88);
    g.fill();
    g.strokeStyle = COLORS.purple;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = font(800, 40);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ds.label, 256, 50);
    this.labelTex.needsUpdate = true;
    gsap.fromTo(this.label.scale, { x: 0.15, y: 0.028 }, { x: 0.2, y: 0.0375, duration: 0.5, ease: 'back.out(2)' });
  }

  onShow() {
    this.bars.forEach((b) => (b.scale.y = 0.001));
    this.setData(0);
  }

  onTap() {
    this.setData((this.index + 1) % DATASETS.length);
    this.toast('DIGITAL GROWTH & DATA', `Now showing: ${DATASETS[this.index].label}. Pipelines + dashboards that prove what works.`);
  }

  update(dt, t, cameraLocal) {
    this.bars.forEach((b, k) => {
      const top = b.scale.y + 0.012 + Math.sin(t * 2 + k) * 0.002;
      this.linePts[k].set(b.position.x, top, 0);
      this.dots[k].position.copy(this.linePts[k]);
    });
    this.line.geometry.setFromPoints(this.linePts);
    if (cameraLocal) this.chart.rotation.y = THREE.MathUtils.damp(this.chart.rotation.y, Math.atan2(cameraLocal.x, cameraLocal.z), 2, dt);
  }
}
