import * as THREE from 'three';
import gsap from 'gsap';
import { COLORS } from '../util/brand.js';
import { beamTexture } from '../util/geometry.js';
import { Ring } from './Ring.js';
import { Hatch } from './Hatch.js';
import { Presenter } from './Presenter.js';
import { ServiceTabs } from './ServiceTabs.js';
import { FloatingCards } from './FloatingCards.js';
import { Panel } from './Panel.js';
import { VideoScreen } from './VideoScreen.js';
import { ProcessOrbit } from './ProcessOrbit.js';
import { SoftwareHolo } from './holograms/SoftwareHolo.js';
import { WebMobileHolo } from './holograms/WebMobileHolo.js';
import { AIHolo } from './holograms/AIHolo.js';
import { CloudHolo } from './holograms/CloudHolo.js';
import { DataHolo } from './holograms/DataHolo.js';
import { CustomHolo } from './holograms/CustomHolo.js';

/**
 * Everything that appears on the marker. Y-up, 1 unit = marker width, +Z toward the viewer's edge of the page.
 * The Director drives it; `actions` receives user intents from taps.
 */
export class Stage {
  constructor(renderer, content, hud, actions, { occluder = true } = {}) {
    this.content = content;
    this.group = new THREE.Group();
    this.group.name = 'stage';
    this.root = new THREE.Group(); // user rotate/scale target
    this.group.add(this.root);

    const hemi = new THREE.HemisphereLight('#ffffff', '#5a3a7a', 1.6);
    const key = new THREE.DirectionalLight('#ffffff', 1.8);
    key.position.set(0.6, 1.4, 1.2);
    const rim = new THREE.DirectionalLight(COLORS.lilac, 1.2);
    rim.position.set(-0.8, 0.6, -1);
    this.root.add(hemi, key, rim);

    this.ring = new Ring(renderer);
    this.hatch = new Hatch(renderer);
    // in AR a depth-only sheet hides the shaft outside the hole; the preview desk already does that
    this.hatch.occluder.visible = occluder;
    this.presenter = new Presenter();
    this.hatch.mount.add(this.presenter.group);
    this.tabs = new ServiceTabs(content.services, renderer, (i) => actions.service(i));
    this.cards = new FloatingCards(content.cases, renderer, (i) => actions.card(i));
    this.panel = new Panel(renderer, {
      onBack: () => actions.back(),
      onPlay: (item) => actions.play(item),
      onContact: () => actions.contact(),
    });
    this.video = new VideoScreen(renderer, { onClose: () => actions.closeVideo(), onFullscreen: (t) => actions.fullscreen(t) });
    this.process = new ProcessOrbit(content.process, renderer, (i) => actions.process(i));

    const toast = (title, text) => hud.toast(title, text);
    const byId = Object.fromEntries(content.services.map((s) => [s.id, s.color]));
    this.holos = {
      software: new SoftwareHolo(byId.software, toast),
      webmobile: new WebMobileHolo(byId.webmobile, toast, renderer),
      ai: new AIHolo(byId.ai, toast),
      cloud: new CloudHolo(byId.cloud, toast),
      data: new DataHolo(byId.data, toast, renderer),
      custom: new CustomHolo(byId.custom, toast),
    };
    this.holoRoot = new THREE.Group();
    Object.values(this.holos).forEach((h) => this.holoRoot.add(h.group));

    // projector beam under holograms
    this.beamMat = new THREE.MeshBasicMaterial({ map: beamTexture('#c070ff'), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.07, 0.34, 32, 1, true), this.beamMat);
    this.beam.position.y = 0.17;
    this.beam.renderOrder = 7;
    this.holoRoot.add(this.beam);

    // taps on the closed hatch lid summon Orion
    this.hatch.petals.forEach((p) => (p.userData.onTap = () => actions.summon()));
    this.presenter.group.userData.onTap = () => actions.presenter();

    this.root.add(
      this.ring.group, this.hatch.group, this.tabs.group, this.cards.group, this.process.group,
      this.holoRoot, this.panel.group, this.video.group,
    );

    this.cameraLocal = new THREE.Vector3();
    this.time = 0;
  }

  async load() {
    const { story } = this.content.video;
    await Promise.all([this.presenter.load('models/presenter.glb'), this.cards.load(story.poster)]);
  }

  setBeam(on) {
    gsap.to(this.beamMat, { opacity: on ? 0.45 : 0, duration: on ? 0.6 : 0.3 });
  }

  update(dt, camera) {
    this.time += dt;
    const t = this.time;
    camera.getWorldPosition(this.cameraLocal);
    this.root.worldToLocal(this.cameraLocal);
    const cam = this.cameraLocal;

    this.ring.update(dt, t);
    this.hatch.update(dt, t);
    if (this.hatch.lift.visible) this.presenter.update(dt, t, cam);
    this.tabs.update(dt, t);
    this.cards.update(dt, t, cam);
    this.panel.update(dt, t, cam);
    this.video.update(dt, t, cam);
    this.process.update(dt, t);
    for (const h of Object.values(this.holos)) if (h.group.visible) h.update(dt, t, cam);
    if (this.beamMat.opacity > 0) this.beam.rotation.y += dt * 0.5;
  }
}
