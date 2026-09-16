import * as THREE from 'three';
import gsap from 'gsap';
import { holoMaterial } from '../../util/materials.js';

/** Base class for the interactive service holograms that project above the hatch. */
export class Hologram {
  constructor(color, toast) {
    this.color = new THREE.Color(color);
    this.toast = toast;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.content = new THREE.Group();
    this.group.add(this.content);
    this.loops = [];
  }

  mat(color = this.color, opacity = 0.85, additive = false) {
    return holoMaterial(color, opacity, additive);
  }

  edges(geometry, color = '#ffffff', opacity = 0.9) {
    return new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  }

  /** Mark an object as tappable, forwarding to onTap(name, object). */
  tappable(obj, name) {
    obj.userData.onTap = () => this.onTap?.(name, obj);
    return obj;
  }

  show() {
    gsap.killTweensOf(this.group.scale);
    this.group.visible = true;
    gsap.fromTo(this.group.scale, { x: 0.01, y: 0.01, z: 0.01 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.5)' });
    this.onShow?.();
  }

  hide() {
    gsap.killTweensOf(this.group.scale);
    this.loops.forEach((l) => l.pause());
    return gsap.to(this.group.scale, {
      x: 0.01, y: 0.01, z: 0.01, duration: 0.35, ease: 'back.in(1.5)',
      onComplete: () => { this.group.visible = false; },
    });
  }

  loop(tl) {
    this.loops.push(tl);
    return tl;
  }

  update() {}
}
