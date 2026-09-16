import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS, LAYOUT } from '../util/brand.js';
import { makeCanvas, canvasTexture, font, spacedText } from '../util/canvas.js';
import { beamTexture, hexHoleShape, planarUV, radialTexture } from '../util/geometry.js';
import { sweepMaterial } from '../util/materials.js';

const R = LAYOUT.ringRadius;

/** The glowing hologram ring that draws itself around the logo (reference 0:06). */
export class Ring {
  constructor(renderer) {
    this.group = new THREE.Group();
    this.group.name = 'ring';
    this.spin = 0;

    // glass base disc, hex hole in the middle for the hatch
    const discSize = R * 2.2;
    const discGeo = planarUV(new THREE.ShapeGeometry(hexHoleShape(R * 1.06, LAYOUT.hatchRadius), 64).rotateX(-Math.PI / 2), discSize);
    this.discMat = new THREE.MeshBasicMaterial({ map: canvasTexture(discCanvas(), renderer), transparent: true, depthWrite: false, opacity: 0 });
    this.disc = new THREE.Mesh(discGeo, this.discMat);
    this.disc.position.y = 0.0012;
    this.disc.renderOrder = 1;
    this.group.add(this.disc);

    // soft purple halo under everything
    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(R * 3.4, R * 3.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(161,0,255,0.55)', 'rgba(161,0,255,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
    );
    this.halo.position.y = 0.0006;
    this.halo.renderOrder = 0;
    this.group.add(this.halo);

    // segmented colour ring (sweeps in, slowly rotates)
    this.segPivot = new THREE.Group();
    this.segMat = sweepMaterial(canvasTexture(segmentCanvas(), renderer));
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.3, R * 2.3).rotateX(-Math.PI / 2), this.segMat);
    seg.position.y = 0.0022;
    seg.renderOrder = 2;
    this.segPivot.add(seg);
    this.group.add(this.segPivot);

    // outer dashed ring rotating the other way
    this.dashPivot = new THREE.Group();
    this.dashMat = sweepMaterial(canvasTexture(dashCanvas(), renderer), { additive: false });
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.6, R * 2.6).rotateX(-Math.PI / 2), this.dashMat);
    dash.position.y = 0.0026;
    dash.renderOrder = 2;
    this.dashPivot.add(dash);
    this.group.add(this.dashPivot);

    // translucent light wall rising from the ring edge
    this.wallMat = new THREE.MeshBasicMaterial({
      map: beamTexture('#b84dff'), transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, opacity: 0,
    });
    this.wall = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.045, 72, 1, true), this.wallMat);
    this.wall.position.y = 0.0225;
    this.wall.renderOrder = 3;
    this.group.add(this.wall);

    this.reset();
  }

  reset() {
    this.segMat.uniforms.uProgress.value = 0;
    this.dashMat.uniforms.uProgress.value = 0;
    this.discMat.opacity = 0;
    this.halo.material.opacity = 0;
    this.wallMat.opacity = 0;
    this.wall.scale.y = 0.001;
    this.disc.scale.setScalar(0.85);
  }

  introTl() {
    const tl = gsap.timeline();
    tl.to(this.discMat, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0)
      .to(this.disc.scale, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.6)' }, 0)
      .to(this.halo.material, { opacity: 1, duration: 0.8 }, 0)
      .to(this.segMat.uniforms.uProgress, { value: 1.02, duration: 0.85, ease: 'power2.inOut' }, 0.05)
      .to(this.dashMat.uniforms.uProgress, { value: 1.02, duration: 0.9, ease: 'power2.inOut' }, 0.2)
      .to(this.wallMat, { opacity: 0.55, duration: 0.5 }, 0.45)
      .to(this.wall.scale, { y: 1, duration: 0.6, ease: 'power3.out' }, 0.45);
    return tl;
  }

  /** Swing the segment ring so a highlighted service tab gets a sweep of light. */
  focusAngle(deg) {
    gsap.to(this.segPivot.rotation, { y: -THREE.MathUtils.degToRad(deg) + Math.PI / 4, duration: 0.9, ease: 'power3.inOut' });
    gsap.fromTo(this.wallMat, { opacity: 1 }, { opacity: 0.55, duration: 1.2, ease: 'power2.out' });
  }

  update(dt, t) {
    this.segPivot.rotation.y += dt * 0.12;
    this.dashPivot.rotation.y -= dt * 0.2;
    this.wallMat.color.setScalar(0.85 + Math.sin(t * 2.2) * 0.15);
  }
}

function discCanvas() {
  const S = 1024;
  const [c, g] = makeCanvas(S, S);
  const cx = S / 2;
  const scale = S / (R * 2.2); // px per stage unit
  const r = R * 1.06 * scale;

  const grad = g.createRadialGradient(cx, cx, r * 0.2, cx, cx, r);
  grad.addColorStop(0, 'rgba(255,255,255,0.97)');
  grad.addColorStop(0.75, 'rgba(250,246,255,0.93)');
  grad.addColorStop(1, 'rgba(230,210,255,0.85)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.fill();

  // fine hex grid texture
  g.save();
  g.beginPath();
  g.arc(cx, cx, r * 0.97, 0, Math.PI * 2);
  g.clip();
  g.strokeStyle = 'rgba(117,0,192,0.07)';
  g.lineWidth = 1.5;
  const hs = 22;
  for (let row = -30; row < 30; row++) {
    for (let col = -30; col < 30; col++) {
      const x = cx + col * hs * 1.5;
      const y = cx + row * hs * Math.sqrt(3) + (col % 2 ? (hs * Math.sqrt(3)) / 2 : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        g.lineTo(x + Math.cos(a) * hs * 0.95, y + Math.sin(a) * hs * 0.95);
      }
      g.closePath();
      g.stroke();
    }
  }
  g.restore();

  // inner dashed circle + hatch rim
  g.setLineDash([10, 12]);
  g.strokeStyle = 'rgba(16,16,16,0.35)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cx, r * 0.86, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  const hr = LAYOUT.hatchRadius * scale * 1.1;
  g.strokeStyle = COLORS.purple;
  g.lineWidth = 7;
  g.shadowColor = COLORS.purple;
  g.shadowBlur = 24;
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 6 + (Math.PI / 3) * k;
    g.lineTo(cx + Math.cos(a) * hr, cx + Math.sin(a) * hr);
  }
  g.closePath();
  g.stroke();
  g.shadowBlur = 0;

  // circular brand text between hatch and ring
  g.fillStyle = COLORS.ink;
  g.font = font(800, 30);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = 'ORIONIS TECH  ✦  AI-FIRST TECHNOLOGY  ✦  CONNECT · AUTOMATE · SCALE  ✦  ';
  const tr = r * 0.73;
  const chars = [...text];
  const step = (Math.PI * 2) / chars.length;
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 + i * step;
    g.save();
    g.translate(cx + Math.cos(a) * tr, cx + Math.sin(a) * tr);
    g.rotate(a + Math.PI / 2);
    g.fillStyle = ch === '✦' ? COLORS.purple : COLORS.ink;
    g.fillText(ch, 0, 0);
    g.restore();
  });
  return c;
}

function segmentCanvas() {
  const S = 1024;
  const [c, g] = makeCanvas(S, S);
  const cx = S / 2;
  const scale = S / (R * 2.3);
  const r = R * scale;
  const colors = [COLORS.purple, COLORS.orange, COLORS.pink, COLORS.lilac, COLORS.purpleDeep, COLORS.red];
  g.lineCap = 'butt';
  // dark track
  g.strokeStyle = 'rgba(16,16,16,0.85)';
  g.lineWidth = 16;
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.stroke();
  // coloured segments with glow
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + 0.12;
    const a1 = a0 + 0.55;
    g.strokeStyle = colors[i];
    g.shadowColor = colors[i];
    g.shadowBlur = 18;
    g.lineWidth = 22;
    g.beginPath();
    g.arc(cx, cx, r, a0, a1);
    g.stroke();
  }
  g.shadowBlur = 0;
  // tick gaps
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 5;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (r - 12), cx + Math.sin(a) * (r - 12));
    g.lineTo(cx + Math.cos(a) * (r + 12), cx + Math.sin(a) * (r + 12));
    g.stroke();
  }
  return c;
}

function dashCanvas() {
  const S = 1024;
  const [c, g] = makeCanvas(S, S);
  const cx = S / 2;
  const scale = S / (R * 2.6);
  const r = R * 1.13 * scale;
  g.strokeStyle = 'rgba(117,0,192,0.9)';
  g.lineWidth = 6;
  g.setLineDash([46, 22, 8, 22]);
  g.beginPath();
  g.arc(cx, cx, r, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(220,175,255,0.9)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(cx, cx, r + 16, 0.4, 2.2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cx, r + 16, 3.4, 5.4);
  g.stroke();
  g.font = font(700, 22);
  g.fillStyle = 'rgba(16,16,16,0.75)';
  spacedText(g, 'ORIONIS AR', cx, cx - r - 30, 8, 'center');
  return c;
}
