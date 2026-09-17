import * as THREE from 'three';
import gsap from 'gsap';
import { LAYOUT } from '../util/brand.js';

const CASE_PANEL_AT = new THREE.Vector3(0, 0.235, 0.07);
const SERVICE_PANEL_AT = new THREE.Vector3(0, 0.36, -0.24);

/**
 * Show control. States:
 *  waiting → intro → talk → outro → idle ⇄ (panel | service | video)
 * The intro/outro timings mirror the reference video (ring + tabs + cards, hatch opens,
 * presenter rises and talks, sinks, hatch closes; then cards open info panels).
 */
export class Director {
  constructor({ stage, hud, voice, content }) {
    this.stage = stage;
    this.hud = hud;
    this.voice = voice;
    this.content = content;
    this.state = 'waiting';
    this.busy = false;
    this.started = false;
    this.hintedIdle = false;

    voice.onCue = (cue) => {
      this.hud.caption(cue?.text ?? null);
      if (cue) stage.presenter.gesture(cue.gesture);
    };
    voice.onEnd = () => this.outro();
    voice.onBlocked = () => this.awaitTap();
    stage.presenter.level = () => voice.level();
  }

  // ---------- tracking ----------
  found() {
    this.hud.scanning(false);
    if (!this.started) {
      this.started = true;
      this.playIntro();
    } else {
      gsap.globalTimeline.resume();
      this.voice.resume();
      this.stage.video.video.paused && this.state === 'video' && this.wasPlaying && this.stage.video.video.play().catch(() => {});
    }
  }

  lost() {
    this.hud.scanning(true);
    gsap.globalTimeline.pause();
    this.voice.pause();
    const v = this.stage.video.video;
    this.wasPlaying = !v.paused;
    v.pause();
  }

  // ---------- intro / talk / outro ----------
  resetScene() {
    const s = this.stage;
    this.introTl?.kill();
    this.outroTl?.kill();
    this.voice.stop();
    this.hud.caption(null);
    s.ring.reset();
    s.hatch.reset();
    s.tabs.reset();
    s.cards.reset();
    s.panel.open = false;
    s.panel.group.visible = false;
    s.video.video.pause();
    s.video.open = false;
    s.video.group.visible = false;
    Object.values(s.holos).forEach((h) => { h.group.visible = false; h.loops.forEach((l) => l.pause()); });
    s.beamMat.opacity = 0;
    s.process.group.visible = false;
    s.root.rotation.set(0, 0, 0);
    s.root.scale.setScalar(1);
    s.presenter.talking = false;
    s.presenter.showTapBubble(false);
    this.waveLoop?.kill();
    s.presenter.play('Idle', 0);
    this.current = null;
    this.busy = false;
  }

  playIntro() {
    this.resetScene();
    this.state = 'intro';
    const s = this.stage;
    const tl = gsap.timeline({ onComplete: () => this.startTalk() });
    tl.add(s.ring.introTl(), 0)
      .add(s.tabs.introTl(), 0.35)
      .add(s.cards.introTl(), 0.6)
      .add(s.hatch.openTl(), 1.35)
      .add(s.hatch.raiseTl(1.3), 1.9)
      .call(() => s.presenter.play('Jump', 0.2), null, 2.75)
      .to({}, { duration: 0.6 });
    this.introTl = tl;
    this.hud.phaseHint('Meet <b>Orion</b> — your guide to Orionis <button>Skip</button>', () => this.skip());
  }

  startTalk() {
    this.state = 'talk';
    this.stage.presenter.talking = true;
    this.voice.play();
  }

  /**
   * The phone refused sound because nobody has tapped yet (browsers require one tap).
   * Orion waits and waves with a pulsing speaker bubble; the first tap anywhere starts the talk with sound.
   */
  awaitTap() {
    if (this.state !== 'talk') return;
    const p = this.stage.presenter;
    this.voice.stop();
    this.hud.caption(null);
    this.state = 'awaitTap';
    p.talking = false;
    p.showTapBubble(true);
    p.play('Wave', 0.25);
    this.waveLoop?.kill();
    this.waveLoop = gsap.to({}, { duration: 3.5, repeat: -1, onRepeat: () => p.play('Wave', 0.25) });
  }

  /** Called for every tap on the page (inside the tap, so audio may start). */
  userTap() {
    if (this.state !== 'awaitTap') return;
    this.waveLoop?.kill();
    this.stage.presenter.showTapBubble(false);
    this.startTalk();
  }

  outro(fast = false, then) {
    if (this.state === 'outro') {
      if (then) this.pending = then;
      return;
    }
    this.state = 'outro';
    this.busy = true;
    this.pending = then;
    this.introTl?.kill();
    this.waveLoop?.kill();
    this.stage.presenter.showTapBubble(false);
    this.voice.stop();
    const s = this.stage;
    s.presenter.talking = false;
    this.hud.caption(null);
    this.hud.phaseHint(null);

    const tl = gsap.timeline({
      onComplete: () => {
        this.enterIdle();
        const cb = this.pending;
        this.pending = null;
        cb?.();
      },
    });
    if (s.hatch.lift.position.y > -0.3 && s.hatch.lift.visible) {
      if (!fast) {
        tl.call(() => s.presenter.play('Wave', 0.25), null, 0);
        tl.add(s.hatch.lowerTl(1.0), 1.3);
        tl.add(s.hatch.closeTl(), 2.35);
      } else {
        tl.add(s.hatch.lowerTl(0.55), 0);
        tl.add(s.hatch.closeTl(), 0.55);
      }
    } else if (s.hatch.isOpen) {
      tl.add(s.hatch.closeTl(), 0);
    }
    // make sure the intro elements are fully in even if it was skipped early
    tl.add(() => this.completeIntroElements(), 0);
    this.outroTl = tl;
  }

  completeIntroElements() {
    const s = this.stage;
    if (s.ring.segMat.uniforms.uProgress.value < 1) s.ring.introTl().progress(1);
    if (s.tabs.tabs[0].mat.opacity < 1) s.tabs.introTl().progress(1);
    s.cards.showAll();
  }

  enterIdle() {
    this.state = 'idle';
    this.busy = false;
    this.stage.process.show();
    if (!this.hintedIdle) {
      this.hintedIdle = true;
      this.hud.toast('EXPLORE', 'Tap a floating card for our work, or a service on the ring to see it come to life.', 4500);
    }
  }

  skip() {
    if (this.state === 'intro' || this.state === 'talk' || this.state === 'awaitTap') this.outro(true);
  }

  /** Get to idle (closing whatever is open), then run cb. */
  ensureIdle(cb) {
    if (this.busy && this.state !== 'outro') return;
    switch (this.state) {
      case 'idle':
        return cb();
      case 'intro':
      case 'talk':
      case 'awaitTap':
        return this.outro(true, cb);
      case 'outro':
        this.pending = cb;
        return;
      case 'panel':
        return this.closePanel(cb);
      case 'service':
        return this.closeService(cb);
      case 'video':
        return this.closeVideo(cb);
      default:
    }
  }

  // ---------- user actions ----------
  home() {
    this.hud.toast(null, 'Replaying intro…', 1500);
    this.playIntro();
  }

  openCase(i) {
    if (this.state === 'panel' && this.current?.i === i) return;
    this.ensureIdle(() => {
      const s = this.stage;
      const card = s.cards.cards[i];
      this.state = 'panel';
      this.busy = true;
      this.current = { type: 'case', i, source: card.mesh };
      s.process.hide();
      s.cards.hideOthers(i);
      gsap.to(card.holder.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.25, delay: 0.1 });
      s.panel.show({ ...this.content.cases[i], kind: 'case' }, card.mesh, CASE_PANEL_AT).eventCallback('onComplete', () => (this.busy = false));
    });
  }

  closePanel(cb, { restore = true } = {}) {
    if (this.busy) return;
    this.busy = true;
    const s = this.stage;
    s.panel.hide().eventCallback('onComplete', () => {
      if (restore) {
        s.cards.showAll();
        s.process.show();
      }
      this.state = 'idle';
      this.busy = false;
      this.current = null;
      cb?.();
    });
    if (!restore) s.cards.hideOthers(-1);
  }

  openService(i) {
    if (this.state === 'service' && this.current?.i === i) return;
    this.ensureIdle(() => {
      const s = this.stage;
      const svc = this.content.services[i];
      this.state = 'service';
      this.busy = true;
      this.current = { type: 'service', i };
      s.tabs.select(i);
      s.ring.focusAngle(LAYOUT.tabAngles[i]);
      s.cards.hideOthers(-1);
      s.process.hide();
      s.setBeam(true);
      s.holos[svc.id].show();
      s.panel
        .show({ ...svc, kind: 'service', kicker: 'OUR SERVICES' }, s.tabs.tabs[i].mesh, SERVICE_PANEL_AT, { fromFlat: true, scale: 0.72 })
        .eventCallback('onComplete', () => (this.busy = false));
      this.hud.toast(svc.title, 'Tap the hologram to interact with it.', 2800);
    });
  }

  closeService(cb, { restore = true } = {}) {
    if (this.busy) return;
    this.busy = true;
    const s = this.stage;
    const svc = this.content.services[this.current.i];
    s.tabs.select(-1);
    s.setBeam(false);
    s.holos[svc.id].hide();
    s.panel.hide().eventCallback('onComplete', () => {
      if (restore) {
        s.cards.showAll();
        s.process.show();
      }
      this.state = 'idle';
      this.busy = false;
      this.current = null;
      cb?.();
    });
  }

  back() {
    if (this.state === 'panel') this.closePanel();
    else if (this.state === 'service') this.closeService();
  }

  play() {
    if (this.busy) return;
    const s = this.stage;
    const { src, poster } = this.content.video.story;
    s.video.setSource(src, poster);
    s.video.prime(); // inside the tap gesture: unlocks sound on mobile
    s.video.video.pause();

    const rise = () => {
      this.state = 'video';
      this.busy = true;
      s.cards.hideOthers(-1);
      s.process.hide();
      s.video.video.currentTime = 0;
      const tl = gsap.timeline({ onComplete: () => (this.busy = false) });
      tl.add(s.video.raiseTl(), 0);
      tl.call(() => this.startVideo(), null, 0.35);
    };

    if (this.state === 'panel') this.closePanel(rise, { restore: false });
    else if (this.state === 'service') this.closeService(rise, { restore: false });
    else this.ensureIdle(rise);
  }

  startVideo() {
    const v = this.stage.video.video;
    v.muted = false;
    v.play().catch(() => {
      // sound blocked by the browser: play muted, a tap on the video turns sound on
      v.muted = true;
      v.play().catch(() => {});
    });
  }

  closeVideo(cb) {
    if (this.state !== 'video') return cb?.();
    if (this.busy && !cb) return;
    this.busy = true;
    const s = this.stage;
    const tl = gsap.timeline({
      onComplete: () => {
        s.cards.showAll();
        s.process.show();
        this.state = 'idle';
        this.busy = false;
        cb?.();
      },
    });
    tl.add(s.video.lowerTl(), 0);
  }

  watch() {
    this.play();
  }

  summon() {
    if (this.state !== 'idle' || this.busy) return;
    const s = this.stage;
    this.state = 'summon';
    this.busy = true;
    s.process.hide();
    const moves = ['Dance', 'ThumbsUp', 'Wave', 'Jump'];
    const move = moves[Math.floor(Math.random() * moves.length)];
    const tl = gsap.timeline({ onComplete: () => this.enterIdle() });
    tl.add(s.hatch.openTl(), 0)
      .add(s.hatch.raiseTl(1.0), 0.5)
      .call(() => s.presenter.play(move, 0.2), null, 1.4)
      .call(() => this.hud.toast('ORION', 'Hi again! Tap a card or a service to explore Orionis.', 2600), null, 1.4)
      .add(s.hatch.lowerTl(0.8), 4.2)
      .add(s.hatch.closeTl(), 5.05);
  }

  presenterTap() {
    if (this.state === 'talk') this.stage.presenter.play('Yes', 0.2);
  }

  processTap(i) {
    const step = this.content.process[i];
    this.stage.process.pulse(i);
    this.hud.toast(`STEP ${i + 1} · ${step.title.toUpperCase()}`, step.text, 3000);
  }

  contact() {
    const c = this.content.company;
    window.open(`https://wa.me/${c.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent("Hi Orionis! I saw your AR experience and I'd like to talk.")}`, '_blank');
  }
}
