import * as THREE from 'three';

const TAP_MOVE = 10;
const TAP_TIME = 450;

/**
 * Touch/mouse input on the 3D scene: taps raycast to objects with `userData.onTap(hit)`;
 * optional one-finger drag rotates and two-finger pinch scales the stage.
 */
export class Interaction {
  constructor({ dom, getCamera, scene, target, manipulate }) {
    this.dom = dom;
    this.getCamera = getCamera;
    this.scene = scene;
    this.target = target;
    this.manipulate = manipulate;
    this.pointers = new Map();
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    dom.addEventListener('pointerdown', (e) => this.down(e));
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('pointercancel', (e) => this.pointers.delete(e.pointerId));
  }

  down(e) {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.pointers.size === 2 && this.manipulate) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: this.target.scale.x };
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!this.manipulate) return;

    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.target.scale.setScalar(THREE.MathUtils.clamp((this.pinch.scale * d) / this.pinch.dist, 0.4, 2.5));
    } else if (this.pointers.size === 1 && Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_MOVE) {
      this.target.rotation.y += dx * 0.008;
    }
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!p) return;
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
    if (moved < TAP_MOVE && performance.now() - p.t < TAP_TIME) this.tap(e.clientX, e.clientY);
  }

  tap(x, y) {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.getCamera());
    const hits = this.raycaster.intersectObject(this.scene, true);
    for (const hit of hits) {
      const handler = findHandler(hit.object);
      if (handler) {
        handler(hit);
        return true;
      }
    }
    return false;
  }
}

function findHandler(obj) {
  // every ancestor must be visible; the nearest onTap wins
  let handler = null;
  for (let o = obj; o; o = o.parent) {
    if (!o.visible) return null;
    if (!handler && o.userData.onTap) handler = o.userData.onTap;
  }
  return handler;
}
