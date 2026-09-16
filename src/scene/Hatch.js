import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, LAYOUT, drawLogo } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, spacedText } from '../util/canvas.js';
import { beamTexture, hexCorner, hexHoleShape, hexShape, planarUV } from '../util/geometry.js';

const HR = LAYOUT.hatchRadius;
const SHAFT_DEPTH = 0.55;
export const LIFT_DOWN = -0.48;
export const LIFT_UP = 0.0015;

/**
 * The hexagonal hatch in the centre of the ring: an iris lid of six petals that slide
 * away under the page, a dark shaft below, and a lift platform that rises out of it (reference 0:07).
 */
export class Hatch {
  constructor(renderer) {
    this.group = new THREE.Group();
    this.group.name = 'hatch';
    this.isOpen = false;

    // Depth-only occluder: a sheet at page level with a hex hole, so the shaft is only visible through the hole.
    const occ = new THREE.Mesh(
      new THREE.ShapeGeometry(hexHoleShape(3, HR * 0.999), 64).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }),
    );
    occ.renderOrder = -10;
    this.occluder = occ;
    this.group.add(occ);

    // shaft walls
    const wallTex = canvasTexture(shaftCanvas(), renderer);
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.repeat.x = 6;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(HR, HR, SHAFT_DEPTH, 6, 1, true),
      new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide }),
    );
    shaft.position.y = -SHAFT_DEPTH / 2;
    this.group.add(shaft);
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(hexShape(HR)).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#07050a' }));
    floor.position.y = -SHAFT_DEPTH;
    this.group.add(floor);

    // rim glow
    const rimPts = Array.from({ length: 7 }, (_, i) => {
      const c = hexCorner(i % 6, HR * 1.005);
      return new THREE.Vector3(c.x, 0.0018, c.y);
    });
    this.rim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(rimPts),
      new THREE.LineBasicMaterial({ color: COLORS.lilac, transparent: true, opacity: 0.9 }),
    );
    this.group.add(this.rim);

    // iris petals
    const lidTex = canvasTexture(lidCanvas(), renderer);
    lidTex.repeat.set(1 / (HR * 2), 1 / (HR * 2));
    lidTex.offset.set(0.5, 0.5);
    const capMat = new THREE.MeshStandardMaterial({ map: lidTex, roughness: 0.35, metalness: 0.1 });
    const sideMat = new THREE.MeshStandardMaterial({ color: '#2a2233', roughness: 0.4, metalness: 0.6 });
    this.petals = [];
    for (let i = 0; i < 6; i++) {
      const a = hexCorner(i, HR);
      const b = hexCorner(i + 1, HR);
      const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(a.x, -a.y), new THREE.Vector2(b.x, -b.y)]);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -0.006 + 0.0016, 0);
      const petal = new THREE.Mesh(geo, [capMat, sideMat]);
      const mid = (Math.PI / 3) * (i + 1); // bisector direction
      petal.userData.dir = new THREE.Vector2(Math.cos(mid), Math.sin(mid));
      this.petals.push(petal);
      this.group.add(petal);
    }

    // lift platform
    this.lift = new THREE.Group();
    const platTex = canvasTexture(platformCanvas(), renderer);
    platTex.repeat.set(1 / (HR * 2), 1 / (HR * 2));
    platTex.offset.set(0.5, 0.5);
    const platTop = new THREE.Mesh(
      new THREE.ExtrudeGeometry(hexShape(HR * 0.94), { depth: 0.014, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.014, 0),
      [new THREE.MeshStandardMaterial({ map: platTex, roughness: 0.3, metalness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#1d1726', roughness: 0.3, metalness: 0.8, emissive: '#3a0066', emissiveIntensity: 0.6 })],
    );
    this.lift.add(platTop);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(HR * 0.55, HR * 0.55, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#15111b', metalness: 0.7, roughness: 0.5 }));
    pillar.position.y = -0.314;
    this.lift.add(pillar);
    this.mount = new THREE.Group(); // presenter stands here
    this.lift.add(this.mount);
    this.group.add(this.lift);

    // light beam inside the shaft while things rise
    this.beamMat = new THREE.MeshBasicMaterial({ map: beamTexture('#b84dff'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(HR * 0.98, HR * 0.6, 0.35, 6, 1, true), this.beamMat);
    this.beam.position.y = 0.1;
    this.beam.renderOrder = 5;
    this.group.add(this.beam);

    this.reset();
  }

  reset() {
    gsap.killTweensOf([this.lift.position, this.beamMat, ...this.petals.map((p) => p.position), ...this.petals.map((p) => p.rotation)]);
    this.petals.forEach((p) => {
      p.position.set(0, 0, 0);
      p.rotation.set(0, 0, 0);
      p.visible = true;
    });
    this.lift.position.y = LIFT_DOWN;
    this.lift.visible = false;
    this.beamMat.opacity = 0;
    this.isOpen = false;
  }

  openTl() {
    const tl = gsap.timeline({ onStart: () => { this.isOpen = true; this.lift.visible = true; } });
    this.petals.forEach((p) => {
      const d = p.userData.dir;
      tl.to(p.position, { y: -0.012, duration: 0.16, ease: 'power2.in' }, 0);
      tl.to(p.position, { x: d.x * HR * 1.25, z: d.y * HR * 1.25, duration: 0.5, ease: 'power3.inOut' }, 0.14);
      tl.to(p.rotation, { y: 0.5, duration: 0.5, ease: 'power3.inOut' }, 0.14);
    });
    tl.call(() => this.petals.forEach((p) => (p.visible = false)), null, 0.66);
    return tl;
  }

  closeTl() {
    const tl = gsap.timeline({ onComplete: () => { this.isOpen = false; this.lift.visible = false; } });
    tl.call(() => this.petals.forEach((p) => (p.visible = true)), null, 0);
    this.petals.forEach((p) => {
      tl.to(p.position, { x: 0, z: 0, duration: 0.45, ease: 'power3.inOut' }, 0);
      tl.to(p.rotation, { y: 0, duration: 0.45, ease: 'power3.inOut' }, 0);
      tl.to(p.position, { y: 0, duration: 0.14, ease: 'power2.out' }, 0.45);
    });
    return tl;
  }

  raiseTl(duration = 1.25) {
    const tl = gsap.timeline();
    tl.set(this.lift, { visible: true }, 0)
      .to(this.beamMat, { opacity: 0.9, duration: 0.3 }, 0)
      .fromTo(this.lift.position, { y: LIFT_DOWN }, { y: LIFT_UP, duration, ease: 'power2.out' }, 0.05)
      .to(this.beamMat, { opacity: 0, duration: 0.6 }, duration - 0.2);
    return tl;
  }

  lowerTl(duration = 1.0) {
    const tl = gsap.timeline();
    tl.to(this.beamMat, { opacity: 0.8, duration: 0.25 }, 0)
      .to(this.lift.position, { y: LIFT_DOWN, duration, ease: 'power2.in' }, 0.1)
      .to(this.beamMat, { opacity: 0, duration: 0.3 }, duration - 0.1);
    return tl;
  }

  update(dt, t) {
    this.rim.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
  }
}

function lidCanvas() {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  const grad = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#e9e2f2');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  drawLogo(g, S / 2, S / 2 - 30, 230, COLORS.ink, COLORS.purple);
  g.fillStyle = COLORS.ink;
  g.font = font(800, 38);
  g.textBaseline = 'middle';
  spacedText(g, 'ORIONIS', S / 2, S / 2 + 118, 10, 'center');
  // petal seams
  g.strokeStyle = 'rgba(16,16,16,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (Math.PI / 3) * i;
    g.beginPath();
    g.moveTo(S / 2, S / 2);
    g.lineTo(S / 2 + Math.cos(a) * S, S / 2 + Math.sin(a) * S);
    g.stroke();
  }
  return c;
}

function shaftCanvas() {
  const [c, g] = makeCanvas(128, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#2b2433');
  grad.addColorStop(0.5, '#141019');
  grad.addColorStop(1, '#050407');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 512);
  g.fillStyle = 'rgba(161,0,255,0.85)';
  g.fillRect(60, 0, 8, 512);
  for (let y = 18; y < 512; y += 46) {
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, y, 128, 3);
  }
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 6;
  g.strokeRect(0, 0, 128, 512);
  return c;
}

function platformCanvas() {
  const S = 512;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#1a1422';
  g.fillRect(0, 0, S, S);
  const cx = S / 2;
  for (let r = 60; r < 260; r += 42) {
    g.strokeStyle = `rgba(161,0,255,${0.15 + (r / 260) * 0.5})`;
    g.lineWidth = 4;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (Math.PI / 3) * k;
      g.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
    }
    g.closePath();
    g.stroke();
  }
  g.shadowColor = COLORS.purple;
  g.shadowBlur = 30;
  drawLogo(g, cx, cx, 120, 'rgba(220,175,255,0.9)', COLORS.orange);
  return c;
}
