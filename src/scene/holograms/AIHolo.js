import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../../util/brand.js';
import { Hologram } from './Hologram.js';

const LAYERS = [3, 5, 5, 2];
const MAX_PULSES = 60;

/** AI Automations: a glowing neural network with data pulses flowing through. Tap a node to fire it. */
export class AIHolo extends Hologram {
  constructor(color, toast) {
    super(color, toast);
    this.net = new THREE.Group();
    this.net.position.y = 0.05;
    this.content.add(this.net);

    const nodeGeo = new THREE.SphereGeometry(0.0095, 16, 12);
    this.layers = LAYERS.map((n, li) => {
      const x = -0.12 + (li / (LAYERS.length - 1)) * 0.24;
      return Array.from({ length: n }, (_, k) => {
        const y = 0.13 + (k - (n - 1) / 2) * 0.05;
        const m = new THREE.Mesh(nodeGeo, this.mat(li === 0 ? COLORS.lilac : li === LAYERS.length - 1 ? COLORS.orange : color, 1));
        m.position.set(x, y, Math.sin(k * 1.7 + li) * 0.025);
        // larger invisible hit target for fingers
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
        m.add(hit);
        this.tappable(hit, `node-${li}-${k}`);
        hit.userData.node = m;
        m.userData.layer = li;
        this.net.add(m);
        return m;
      });
    });

    // edges
    this.edgesList = [];
    const positions = [];
    for (let li = 0; li < this.layers.length - 1; li++) {
      for (const a of this.layers[li]) {
        for (const b of this.layers[li + 1]) {
          positions.push(a.position.x, a.position.y, a.position.z, b.position.x, b.position.y, b.position.z);
          this.edgesList.push([a, b]);
        }
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.net.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: COLORS.purpleDeep, transparent: true, opacity: 0.55, depthWrite: false })));

    // pulses (instanced)
    this.pulses = [];
    this.pulseMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0045, 8, 6), this.mat(COLORS.orange, 1), MAX_PULSES);
    this.pulseMesh.count = 0;
    this.net.add(this.pulseMesh);
    this.tmp = new THREE.Object3D();
    this.spawnTimer = 0;
  }

  spawn(from, strong = false) {
    const li = from.userData.layer;
    if (li >= this.layers.length - 1 || this.pulses.length >= MAX_PULSES) return;
    const nexts = this.layers[li + 1];
    const to = nexts[Math.floor(Math.random() * nexts.length)];
    this.pulses.push({ a: from, b: to, t: 0, speed: strong ? 2.6 : 1.4 + Math.random() * 0.6, strong });
  }

  onTap(name, hit) {
    const node = hit.userData.node;
    gsap.fromTo(node.scale, { x: 2.2, y: 2.2, z: 2.2 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'elastic.out(1, 0.35)' });
    for (let i = 0; i < 6; i++) this.spawn(node, true);
    this.toast('AI AUTOMATIONS', 'Agent triggered → documents read, validated and posted automatically. That\'s intelligence built in from the ground up.');
  }

  update(dt, t) {
    this.net.rotation.y = Math.sin(t * 0.4) * 0.35;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.12;
      const inputs = this.layers[0];
      this.spawn(inputs[Math.floor(Math.random() * inputs.length)]);
    }
    let n = 0;
    const done = [];
    for (const p of this.pulses) {
      p.t += dt * p.speed;
      if (p.t >= 1) {
        done.push(p);
        gsap.fromTo(p.b.scale, { x: 1.5, y: 1.5, z: 1.5 }, { x: 1, y: 1, z: 1, duration: 0.3, overwrite: true });
        if (p.strong || Math.random() < 0.7) this.spawn(p.b, p.strong);
        continue;
      }
      this.tmp.position.lerpVectors(p.a.position, p.b.position, p.t);
      this.tmp.scale.setScalar(p.strong ? 1.6 : 1);
      this.tmp.updateMatrix();
      this.pulseMesh.setMatrixAt(n++, this.tmp.matrix);
    }
    this.pulses = this.pulses.filter((p) => !done.includes(p));
    this.pulseMesh.count = n;
    this.pulseMesh.instanceMatrix.needsUpdate = true;
  }
}
