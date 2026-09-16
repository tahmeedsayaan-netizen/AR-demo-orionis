import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYOUT } from '../util/brand.js';
import { hexHoleShape } from '../util/geometry.js';

/**
 * Desktop / no-camera mode: the printed marker lies on a desk and the camera orbits it,
 * framed like someone holding a tablet over the page (as in the reference video).
 */
export class PreviewSession {
  constructor({ container, renderer, onFound }) {
    this.container = container;
    this.renderer = renderer;
    this.onFound = onFound;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#141016');
    scene.fog = new THREE.Fog('#141016', 3, 7);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50);
    this.camera.position.set(0, 0.78, 0.92);

    this.mount = new THREE.Group();
    scene.add(this.mount);

    this.buildDesk();

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.target.set(0, 0.13, 0);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.45;
    this.controls.maxDistance = 2.6;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.enablePan = false;
    this.controls.update();

    this.onResize = () => this.resize();
  }

  buildDesk() {
    // desk with a hexagonal hole under the hatch, so the shaft below is visible when it opens
    const deskTex = new THREE.CanvasTexture(woodCanvas());
    deskTex.colorSpace = THREE.SRGBColorSpace;
    deskTex.wrapS = deskTex.wrapT = THREE.RepeatWrapping;
    const deskGeo = new THREE.ShapeGeometry(hexHoleShape(null, LAYOUT.hatchRadius, 6, 6), 1);
    deskGeo.rotateX(-Math.PI / 2);
    remapUV(deskGeo, 6, 6, 4);
    const desk = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.7 }));
    desk.position.y = -0.0015;
    this.scene.add(desk);

    const paperTex = new THREE.TextureLoader().load('targets/orionis-marker.png');
    paperTex.colorSpace = THREE.SRGBColorSpace;
    paperTex.anisotropy = 8;
    const paperGeo = new THREE.ShapeGeometry(hexHoleShape(null, LAYOUT.hatchRadius, 1, LAYOUT.markerAspect), 1);
    paperGeo.rotateX(-Math.PI / 2);
    remapUV(paperGeo, 1, LAYOUT.markerAspect, 1);
    const paper = new THREE.Mesh(paperGeo, new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9 }));
    paper.position.y = -0.0005;
    this.scene.add(paper);

    // soft paper shadow
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.06, LAYOUT.markerAspect + 0.06),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0.01, -0.001, 0.012);
    this.scene.add(shadow);

    const hemi = new THREE.HemisphereLight('#fff7ee', '#3a2a1f', 1.1);
    const sun = new THREE.DirectionalLight('#ffffff', 1.2);
    sun.position.set(-1, 2, 1.5);
    this.scene.add(hemi, sun);
  }

  async start() {
    this.resize();
    window.addEventListener('resize', this.onResize);
    setTimeout(() => this.onFound?.(), 500);
  }

  update() {
    this.controls.update();
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    // pull back on narrow (portrait) screens so the whole page stays in frame
    const dist = 1.22 * Math.max(1, 1.45 / aspect);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, Math.min(dist, this.controls.maxDistance));
    this.controls.update();
    this.renderer.setSize(w, h);
  }

  stop() {
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
  }
}

/** Planar UVs for a flat geometry lying in XZ: u across width, v up the page (-Z). */
function remapUV(geo, width, height, repeat) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) / width + 0.5) * repeat, (-pos.getZ(i) / height + 0.5) * repeat);
  }
  uv.needsUpdate = true;
}

function woodCanvas() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#8f5d33';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 240; i++) {
    const y = Math.random() * 1024;
    g.strokeStyle = `rgba(${90 + Math.random() * 40}, ${50 + Math.random() * 20}, 20, ${0.05 + Math.random() * 0.12})`;
    g.lineWidth = 1 + Math.random() * 4;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 64) g.lineTo(x, y + Math.sin((x / 1024) * Math.PI * 2 * (1 + (i % 3)) + i) * 6);
    g.stroke();
  }
  return c;
}
