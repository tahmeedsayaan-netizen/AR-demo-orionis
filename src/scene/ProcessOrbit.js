import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, drawIcon } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, spacedText } from '../util/canvas.js';

const RADIUS = 0.235;
const ACCENTS = [COLORS.purple, COLORS.orange, COLORS.pink, COLORS.purpleDeep];

/** Plan → Build → Scale → Maintain badges orbiting the closed hatch in the idle state. Tap for details. */
export class ProcessOrbit {
  constructor(steps, renderer, onSelect) {
    this.group = new THREE.Group();
    this.group.name = 'process';
    this.group.visible = false;
    this.spinner = new THREE.Group();
    this.group.add(this.spinner);

    this.badges = steps.map((step, i) => {
      const [c, g] = makeCanvas(256, 300);
      const accent = ACCENTS[i];
      g.shadowColor = accent;
      g.shadowBlur = 26;
      g.fillStyle = COLORS.ink;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (Math.PI / 3) * k;
        g.lineTo(128 + Math.cos(a) * 96, 118 + Math.sin(a) * 96);
      }
      g.closePath();
      g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 7;
      g.strokeStyle = accent;
      g.stroke();
      drawIcon(g, step.id, 128 - 44, 118 - 44, 88, '#fff', 2);
      g.fillStyle = '#fff';
      g.font = font(900, 34);
      g.textBaseline = 'middle';
      g.shadowColor = '#000';
      g.shadowBlur = 8;
      spacedText(g, `${i + 1}. ${step.title.toUpperCase()}`, 128, 262, 1.5, 'center');

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(c, renderer), transparent: true, depthWrite: false }));
      sprite.scale.set(0.06, 0.07, 1);
      sprite.renderOrder = 8;
      sprite.userData.onTap = () => onSelect(i);
      const a = (i / steps.length) * Math.PI * 2;
      sprite.position.set(Math.cos(a) * RADIUS, 0.07, Math.sin(a) * RADIUS);
      sprite.userData.baseY = 0.07;
      this.spinner.add(sprite);
      return sprite;
    });

    // orbit path
    const pts = Array.from({ length: 97 }, (_, k) => {
      const a = (k / 96) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * RADIUS, 0.03, Math.sin(a) * RADIUS);
    });
    this.path = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: COLORS.lilac, dashSize: 0.01, gapSize: 0.008, transparent: true, opacity: 0.8 }),
    );
    this.path.computeLineDistances();
    this.group.add(this.path);
  }

  show() {
    if (this.group.visible) return;
    this.group.visible = true;
    gsap.fromTo(this.group.scale, { x: 0.3, y: 0.3, z: 0.3 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.6)' });
  }

  hide() {
    if (!this.group.visible) return;
    gsap.to(this.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.3, ease: 'power2.in', onComplete: () => (this.group.visible = false) });
  }

  pulse(i) {
    const s = this.badges[i];
    gsap.fromTo(s.scale, { x: 0.08, y: 0.093 }, { x: 0.06, y: 0.07, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
  }

  update(dt, t) {
    if (!this.group.visible) return;
    this.spinner.rotation.y += dt * 0.25;
    this.badges.forEach((b, i) => (b.position.y = b.userData.baseY + Math.sin(t * 2 + i * 1.5) * 0.006));
  }
}
