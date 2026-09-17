import '@fontsource-variable/inter/wght.css';
import './ui/hud.css';
import gsap from 'gsap';
import content from './content/content.json';
import { Hud } from './ui/hud.js';
import { Stage } from './scene/Stage.js';
import { Director } from './timeline/Director.js';
import { Voice } from './timeline/Voice.js';
import { Interaction } from './util/interaction.js';

const container = document.getElementById('stage-container');
const params = new URLSearchParams(location.search);
const hud = new Hud(content);
let started = false;

hud.showStart({ onAR: () => start('ar'), onPreview: () => start('preview') });
if (params.has('autostart')) start(params.has('preview') ? 'preview' : 'ar');

async function start(mode) {
  if (started) return;
  started = true;

  // Everything that needs the tap gesture happens first: audio unlock and (iOS) motion sensors for world tracking.
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const voice = new Voice({ src: 'audio/voiceover.mp3', cuesUrl: 'audio/voiceover-cues.json' });
  voice.unlock(audioCtx);
  if (mode === 'ar') await requestMotionPermission();

  hud.hideStart();
  hud.loading(mode === 'ar' ? 'Starting AR engine…' : 'Loading experience…');

  let director = null;
  let pendingFound = false;
  let session;
  const onFound = () => {
    hud.scanning(false);
    if (director) director.found();
    else pendingFound = true;
  };
  const onLost = () => director?.lost();
  const onTrackingLimited = throttle(() => hud.toast(null, 'Move your phone slowly — point at the page again if things drift.', 3000), 8000);

  try {
    if (mode === 'ar') {
      const { EighthWallSession } = await import('./ar/eighthwall.js');
      session = new EighthWallSession({ container, onFound, onLost, onTrackingLimited });
    } else {
      const { PreviewSession } = await import('./ar/preview.js');
      session = new PreviewSession({ container, onFound });
    }
    await Promise.all([
      session.start(),
      document.fonts.load('800 20px "Inter Variable"').catch(() => {}),
      document.fonts.load('500 20px "Inter Variable"').catch(() => {}),
    ]);
  } catch (err) {
    console.error(err);
    return fail(
      err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access and reload — or try the preview.'
        : 'AR could not start on this device. You can still explore the preview.',
    );
  }

  hud.loading('Loading experience…');
  const actions = {
    card: (i) => director.openCase(i),
    service: (i) => director.openService(i),
    back: () => director.back(),
    play: () => director.play(),
    closeVideo: () => director.closeVideo(),
    fullscreen: (t) => director.fullscreen(t),
    contact: () => director.contact(),
    process: (i) => director.processTap(i),
    summon: () => director.summon(),
    presenter: () => director.presenterTap(),
  };
  const stage = new Stage(session.renderer, content, hud, actions, { occluder: mode === 'ar' });
  try {
    await Promise.all([stage.load(), voice.load()]);
  } catch (err) {
    console.error(err);
    return fail('Could not load the experience. Please check your connection and try again.');
  }
  session.mount.add(stage.group);
  director = new Director({ stage, hud, voice, content });

  session.onFrame = (dt) => {
    voice.update();
    if (!gsap.globalTimeline.paused()) stage.update(dt, session.camera);
  };

  hud.loading(false);
  hud.showHud(mode);
  if (mode === 'ar' && !session.found) hud.scanning(true);
  if (pendingFound) director.found();

  hud
    .on('home', () => director.home())
    .on('exit', () => {
      session.stop?.();
      location.href = location.pathname;
    })
    .on('watch', () => director.watch())
    .on('sheet', (open) => {
      if (open) voice.pause();
      else voice.resume();
    });

  new Interaction({
    dom: session.renderer.domElement,
    getCamera: () => session.camera,
    scene: session.scene,
    target: stage.root,
    manipulate: mode === 'ar',
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      voice.pause();
      gsap.globalTimeline.pause();
    } else if (mode === 'preview' || session.found) {
      voice.resume();
      gsap.globalTimeline.resume();
    }
  });

  window.__orionis = { director, stage, session, voice, gsap };
}

/** iOS 13+ only grants motion sensors (needed for world tracking) from a user gesture. */
async function requestMotionPermission() {
  const ask = (E) => (typeof E?.requestPermission === 'function' ? E.requestPermission().catch(() => 'denied') : 'granted');
  try {
    await Promise.all([ask(window.DeviceMotionEvent), ask(window.DeviceOrientationEvent)]);
  } catch {
    /* the engine reports tracking problems itself */
  }
}

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last > ms) {
      last = now;
      fn(...args);
    }
  };
}

function fail(message) {
  hud.loading(false);
  document.querySelector('#start-screen .lead').textContent = message;
  document.getElementById('btn-start-ar').onclick = () => location.reload();
  document.getElementById('btn-start-preview').onclick = () => {
    location.search = '?preview&autostart';
  };
  document.getElementById('start-screen').classList.remove('hidden');
}
