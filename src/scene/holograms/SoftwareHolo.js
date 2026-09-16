import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../../util/brand.js';
import { Hologram } from './Hologram.js';

/** Software Development: code blocks drop in and stack into a running app window. Tap to "compile". */
export class SoftwareHolo extends Hologram {
  constructor(color, toast) {
    super(color, toast);
    const W = 0.26, H = 0.18, Y = 0.2;

    const win = new THREE.Group();
    win.position.y = Y;
    this.content.add(win);
    this.win = win;

    const panel = new THREE.Mesh(new THREE.PlaneGeometry(W, H), this.mat(COLORS.purpleDark, 0.55, false));
    win.add(panel);
    const frameGeo = new THREE.PlaneGeometry(W, H);
    win.add(this.edges(frameGeo, COLORS.lilac));
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.022), this.mat(color, 0.9));
    bar.position.set(0, H / 2 - 0.011, 0.001);
    win.add(bar);
    [COLORS.red, COLORS.orange, '#35ff9a'].forEach((c, i) => {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), new THREE.MeshBasicMaterial({ color: c }));
      dot.position.set(-W / 2 + 0.012 + i * 0.012, H / 2 - 0.011, 0.002);
      win.add(dot);
    });
    this.tappable(panel, 'window');

    // code blocks
    const palette = [COLORS.purple, COLORS.pink, COLORS.orange, COLORS.lilac, '#35ff9a'];
    this.blocks = [];
    const box = new THREE.BoxGeometry(1, 1, 1);
    for (let row = 0; row < 7; row++) {
      let x = -W / 2 + 0.018 + (row % 3) * 0.014;
      const n = 2 + ((row * 7) % 3);
      for (let k = 0; k < n; k++) {
        const w = 0.02 + ((row + k * 3) % 4) * 0.012;
        const m = new THREE.Mesh(box, this.mat(palette[(row + k) % palette.length], 0.95));
        m.scale.set(w, 0.011, 0.008);
        m.userData.home = new THREE.Vector3(x + w / 2, H / 2 - 0.042 - row * 0.019, 0.006);
        m.position.copy(m.userData.home);
        win.add(m);
        this.blocks.push(m);
        x += w + 0.008;
      }
    }

    // floating </> glyph
    const glyph = new THREE.Group();
    const mk = (pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(([a, b]) => new THREE.Vector3(a, b, 0))), new THREE.LineBasicMaterial({ color: COLORS.lilac }));
    glyph.add(mk([[-0.012, 0.012], [-0.028, 0], [-0.012, -0.012]]));
    glyph.add(mk([[0.012, 0.012], [0.028, 0], [0.012, -0.012]]));
    glyph.add(mk([[0.006, 0.016], [-0.006, -0.016]]));
    glyph.position.set(0, Y + H / 2 + 0.045, 0);
    glyph.scale.setScalar(1.4);
    this.content.add(glyph);
    this.glyph = glyph;

    this.build = this.loop(gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true }));
    this.blocks.forEach((b, i) => {
      this.build.fromTo(b.position, { y: b.userData.home.y + 0.14, z: 0.06 }, { y: b.userData.home.y, z: 0.006, duration: 0.35, ease: 'bounce.out' }, i * 0.07);
      this.build.fromTo(b.material, { opacity: 0 }, { opacity: 0.95, duration: 0.2 }, i * 0.07);
    });
    this.build.to(this.blocks.map((b) => b.material), { opacity: 0.2, duration: 0.4, stagger: 0.01 }, '+=1.4');
  }

  onShow() {
    this.build.restart();
  }

  onTap() {
    this.toast('SOFTWARE DEVELOPMENT', 'Compiling… ✓ Build passed. Custom platforms, engineered for performance and security.');
    gsap.fromTo(this.win.scale, { x: 1.08, y: 1.08 }, { x: 1, y: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    this.build.timeScale(2.5).restart();
    gsap.delayedCall(2, () => this.build.timeScale(1));
  }

  update(dt, t, cameraLocal) {
    this.glyph.rotation.y += dt * 1.5;
    if (cameraLocal) this.content.rotation.y = THREE.MathUtils.damp(this.content.rotation.y, Math.atan2(cameraLocal.x, cameraLocal.z), 3, dt);
  }
}
