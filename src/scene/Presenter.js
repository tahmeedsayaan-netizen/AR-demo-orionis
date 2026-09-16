import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { COLORS } from '../util/brand.js';
import { radialTexture } from '../util/geometry.js';

const HEIGHT = 0.26;
const ONE_SHOT = new Set(['Wave', 'ThumbsUp', 'Yes', 'No', 'Jump']);

/**
 * "Orion", the animated presenter. Plays the body gestures cued by the voiceover, adds
 * procedural head motion from the voice level, and turns to face the viewer.
 */
export class Presenter {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'presenter';
    this.root = new THREE.Group();
    this.group.add(this.root);
    this.level = () => 0;
    this.talking = false;
    this.facing = 0;
    this.lookTarget = null;

    // contact shadow on the platform
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.11).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
    );
    shadow.position.y = 0.0008;
    this.group.add(shadow);
  }

  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = HEIGHT / size.y;
    model.scale.setScalar(s);
    model.position.y = -box.min.y * s;

    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // brand the robot: purple body, dark joints, glowing accents
        if (m.name === 'Main') {
          m.color.set(COLORS.purple);
          m.emissive = new THREE.Color(COLORS.purpleDark);
          m.emissiveIntensity = 0.35;
          m.metalness = 0.35;
          m.roughness = 0.35;
        } else if (m.name === 'Grey') {
          m.color.set('#e9e6ef');
          m.metalness = 0.2;
          m.roughness = 0.4;
        } else if (m.name === 'Black') {
          m.color.set('#141018');
        }
      }
      if (o.morphTargetDictionary && 'Surprised' in o.morphTargetDictionary) this.face = o;
    });
    this.root.add(model);
    this.model = model;
    model.traverse((o) => {
      if (o.isBone && /^Head$/i.test(o.name)) this.head = o;
    });

    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      if (ONE_SHOT.has(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      this.actions[clip.name] = action;
    }
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.current && ONE_SHOT.has(e.action.getClip().name)) this.play('Idle', 0.35);
    });
    this.play('Idle', 0);
  }

  play(name, fade = 0.3) {
    const next = this.actions[name];
    if (!next) return;
    if (next === this.current && !ONE_SHOT.has(name)) return;
    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.fadeIn(fade).play();
    if (this.current && this.current !== next) this.current.fadeOut(fade);
    this.current = next;
  }

  gesture(name) {
    if (name === 'Talk' || !name) {
      if (this.current !== this.actions.Idle) this.play('Idle', 0.4);
      return;
    }
    this.play(name, 0.25);
  }

  update(dt, t, cameraLocal) {
    this.mixer?.update(dt);

    // turn to face the viewer (yaw only, smoothed)
    const target = this.lookTarget ?? cameraLocal;
    if (target) {
      // presenter stands at the stage origin, so the target is already relative to it
      const yaw = Math.atan2(target.x, target.z);
      this.facing = THREE.MathUtils.damp(this.facing, THREE.MathUtils.clamp(yaw, -1.2, 1.2), 4, dt);
      this.root.rotation.y = this.facing;
    }

    // talking: head nods + mouth-ish morph from voice loudness
    const lvl = this.talking ? this.level() : 0;
    if (this.head) {
      this.head.rotation.x += Math.sin(t * 9) * lvl * 0.12 + lvl * 0.08;
      this.head.rotation.z += Math.sin(t * 3.1) * lvl * 0.08;
    }
    if (this.face) {
      const idx = this.face.morphTargetDictionary.Surprised;
      const cur = this.face.morphTargetInfluences[idx];
      this.face.morphTargetInfluences[idx] = THREE.MathUtils.damp(cur, Math.min(1, lvl * 1.6), 18, dt);
    }
  }
}
