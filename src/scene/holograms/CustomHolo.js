import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../../util/brand.js';
import { Hologram } from './Hologram.js';

const S = 0.07; // piece size

/** Custom Solutions: four puzzle pieces that fly apart and snap together into one solution. Tap to rebuild. */
export class CustomHolo extends Hologram {
  constructor(color, toast) {
    super(color, toast);
    this.puzzle = new THREE.Group();
    this.puzzle.position.y = 0.19;
    this.content.add(this.puzzle);

    const colors = [COLORS.purple, COLORS.orange, COLORS.pink, COLORS.lilac];
    // [right edge, bottom edge]: +1 knob out, -1 knob in, 0 flat (outer border)
    const layout = [
      { col: 0, row: 0, right: 1, bottom: -1, left: 0, top: 0 },
      { col: 1, row: 0, right: 0, bottom: 1, left: -1, top: 0 },
      { col: 0, row: 1, right: -1, bottom: 0, left: 0, top: 1 },
      { col: 1, row: 1, right: 0, bottom: 0, left: 1, top: -1 },
    ];
    this.pieces = layout.map((p, i) => {
      const geo = new THREE.ExtrudeGeometry(pieceShape(p), { depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 });
      geo.translate(0, 0, -0.006);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.45, metalness: 0.3, roughness: 0.35, transparent: true, opacity: 0.92 }));
      m.add(this.edges(geo, '#ffffff', 0.5));
      m.userData.home = new THREE.Vector3((p.col - 0.5) * S, (0.5 - p.row) * S, 0);
      m.position.copy(m.userData.home);
      this.tappable(m, 'piece');
      this.puzzle.add(m);
      return m;
    });

    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(S * 2.6, S * 2.6), this.mat('#ffffff', 0));
    this.puzzle.add(this.flash);
  }

  assemble() {
    const tl = gsap.timeline();
    this.pieces.forEach((m, i) => {
      const dir = m.userData.home.clone().normalize();
      tl.to(m.position, { x: dir.x * 0.11, y: dir.y * 0.11, z: (i % 2 ? 1 : -1) * 0.05, duration: 0.45, ease: 'power2.out' }, 0);
      tl.to(m.rotation, { x: (i % 2 ? 1 : -1) * 0.9, y: (i % 2 ? -1 : 1) * 1.2, z: 0.6, duration: 0.45, ease: 'power2.out' }, 0);
      tl.to(m.position, { x: m.userData.home.x, y: m.userData.home.y, z: 0, duration: 0.7, ease: 'back.in(1.2)' }, 0.75 + i * 0.12);
      tl.to(m.rotation, { x: 0, y: 0, z: 0, duration: 0.7, ease: 'power3.inOut' }, 0.75 + i * 0.12);
    });
    tl.fromTo(this.flash.material, { opacity: 0.9 }, { opacity: 0, duration: 0.6 }, 1.85);
    tl.fromTo(this.puzzle.scale, { x: 1.12, y: 1.12, z: 1.12 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' }, 1.85);
    return tl;
  }

  onShow() {
    this.assemble();
  }

  onTap() {
    this.assemble();
    this.toast('CUSTOM SOLUTIONS', 'Every business is a different puzzle. We design the pieces that fit yours — then make them work as one.');
  }

  update(dt, t) {
    this.puzzle.rotation.y = Math.sin(t * 0.7) * 0.6;
  }
}

function pieceShape({ right, bottom, left, top }) {
  const h = S / 2;
  const k = S * 0.16; // knob radius
  const s = new THREE.Shape();
  s.moveTo(-h, h);
  edge(s, [-h, h], [h, h], top, [0, 1]);
  edge(s, [h, h], [h, -h], right, [1, 0]);
  edge(s, [h, -h], [-h, -h], bottom, [0, -1]);
  edge(s, [-h, -h], [-h, h], left, [-1, 0]);
  return s;

  function edge(shape, [x0, y0], [x1, y1], type, [nx, ny]) {
    if (!type) return shape.lineTo(x1, y1);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const tx = Math.sign(x1 - x0);
    const ty = Math.sign(y1 - y0);
    shape.lineTo(mx - tx * k, my - ty * k);
    const cx = mx + nx * k * type;
    const cy = my + ny * k * type;
    const start = Math.atan2(my - ty * k - cy, mx - tx * k - cx);
    const end = Math.atan2(my + ty * k - cy, mx + tx * k - cx);
    shape.absarc(cx, cy, k * 1.05, start, end, type > 0 ? (tx - ty > 0 ? false : true) : (tx - ty > 0 ? true : false));
    shape.lineTo(x1, y1);
  }
}
