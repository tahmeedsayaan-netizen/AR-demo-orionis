import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../../util/brand.js';
import { Hologram } from './Hologram.js';

const MAX_RACKS = 5;
const PARTICLES = 80;

/** Cloud & IT: server racks streaming data up to a cloud. Tap to auto-scale the cluster. */
export class CloudHolo extends Hologram {
  constructor(color, toast) {
    super(color, toast);

    // cloud of translucent spheres
    this.cloud = new THREE.Group();
    this.cloud.position.y = 0.29;
    [[0, 0, 0, 0.05], [-0.05, -0.012, 0, 0.036], [0.052, -0.014, 0, 0.034], [0.022, 0.03, -0.01, 0.034], [-0.025, 0.022, 0.01, 0.03]].forEach(([x, y, z, r]) => {
      const geo = new THREE.IcosahedronGeometry(r, 1);
      const m = new THREE.Mesh(geo, this.mat(color, 0.35));
      m.position.set(x, y, z);
      m.add(this.edges(geo, COLORS.lilac, 0.6));
      this.cloud.add(m);
    });
    this.content.add(this.cloud);
    this.tappable(this.cloud.children[0], 'cloud');

    // racks
    this.racks = [];
    this.rackGroup = new THREE.Group();
    this.content.add(this.rackGroup);
    const rackGeo = new THREE.BoxGeometry(0.042, 0.095, 0.04);
    for (let i = 0; i < MAX_RACKS; i++) {
      const rack = new THREE.Group();
      const body = new THREE.Mesh(rackGeo, new THREE.MeshStandardMaterial({ color: '#17121e', metalness: 0.6, roughness: 0.35, emissive: '#1a0033' }));
      body.position.y = 0.0475;
      rack.add(body);
      const outline = this.edges(rackGeo, COLORS.lilac, 0.7);
      outline.position.copy(body.position);
      rack.add(outline);
      rack.userData.leds = [];
      for (let r = 0; r < 4; r++) {
        const led = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.006), new THREE.MeshBasicMaterial({ color: '#35ff9a', transparent: true }));
        led.position.set(0, 0.018 + r * 0.021, 0.0205);
        rack.add(led);
        rack.userData.leds.push(led);
      }
      this.tappable(body, 'rack');
      rack.visible = i < 3;
      rack.scale.setScalar(i < 3 ? 1 : 0.001);
      this.rackGroup.add(rack);
      this.racks.push(rack);
    }
    this.active = 3;
    this.layoutRacks(false);

    // data particles
    this.particles = Array.from({ length: PARTICLES }, () => ({ rack: 0, t: Math.random(), up: Math.random() < 0.7, speed: 0.4 + Math.random() * 0.5 }));
    this.pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.003, 6, 4), this.mat(COLORS.purple, 1), PARTICLES);
    this.content.add(this.pMesh);
    this.tmp = new THREE.Object3D();
    this.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3());
  }

  layoutRacks(animate = true) {
    const n = this.active;
    this.racks.forEach((rack, i) => {
      const on = i < n;
      const x = (i - (n - 1) / 2) * 0.058;
      if (on) rack.visible = true;
      const props = { x, z: 0, duration: animate ? 0.6 : 0, ease: 'power3.out' };
      gsap.to(rack.position, props);
      gsap.to(rack.scale, {
        x: on ? 1 : 0.001, y: on ? 1 : 0.001, z: on ? 1 : 0.001, duration: animate ? 0.6 : 0, ease: on ? 'back.out(2)' : 'power2.in',
        onComplete: () => { if (!on) rack.visible = false; },
      });
    });
  }

  onTap() {
    this.active = this.active >= MAX_RACKS ? 3 : this.active + 1;
    this.layoutRacks();
    this.toast('CLOUD & IT SOLUTIONS', this.active === 3
      ? 'Traffic back to normal — scaled down to save cost.'
      : `Traffic spike! Auto-scaling to ${this.active} servers with zero downtime.`);
  }

  update(dt, t) {
    this.cloud.position.y = 0.29 + Math.sin(t * 1.4) * 0.006;
    this.cloud.rotation.y += dt * 0.3;
    this.racks.forEach((rack, i) => rack.userData.leds.forEach((led, k) => {
      led.material.opacity = (Math.sin(t * (6 + k) + i * 2 + k) > -0.2) ? 1 : 0.15;
    }));
    let n = 0;
    for (const p of this.particles) {
      p.t += dt * p.speed;
      if (p.t > 1) {
        p.t = 0;
        p.rack = Math.floor(Math.random() * this.active);
        p.up = Math.random() < 0.7;
      }
      const rack = this.racks[Math.min(p.rack, this.active - 1)];
      const a = new THREE.Vector3(rack.position.x, 0.1, 0);
      const b = new THREE.Vector3(this.cloud.position.x + (p.rack - 1) * 0.02, this.cloud.position.y - 0.03, 0);
      this.curve.v0.copy(p.up ? a : b);
      this.curve.v2.copy(p.up ? b : a);
      this.curve.v1.set((a.x + b.x) / 2 + (p.up ? 0.03 : -0.03), (a.y + b.y) / 2, 0.02);
      this.curve.getPoint(p.t, this.tmp.position);
      this.tmp.updateMatrix();
      this.pMesh.setMatrixAt(n++, this.tmp.matrix);
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
  }
}
