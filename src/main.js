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

// The link opens straight into the camera. `?preview` opens the no-camera preview, `?menu` shows the start screen.
if (params.has('menu')) hud.showStart({ onAR: () => start('ar'), onPreview: () => start('preview') });
else start(params.has('preview') ? 'preview' : 'ar');

async function start(mode) {
  if (started) return;
  started = true;

  // Everything that needs the tap gesture happens first: audio unlock and (iOS) motion sensors for world tracking.
  const voice = new Voice({ src: 'audio/voiceover.mp3', cuesUrl: 'audio/voiceover-cues.json' });
  voice.unlock();
  // Opening straight into the camera means there may be no tap yet: sound (and iOS motion sensors, via the
  // engine's Continue prompt) switch on with the first tap anywhere.
  let director = null;
  const onGesture = () => {
    director?.userTap(); // if Orion is waiting for a tap, start talking inside this tap
    voice.gesture();
  };
  ['touchend', 'click'].forEach((type) => document.addEventListener(type, onGesture, { capture: true, passive: true }));
  if (mode === 'ar') {
    brandEnginePrompt();
    await requestMotionPermission();
  }

  hud.hideStart();
  hud.loading(mode === 'ar' ? 'Starting AR engine…' : 'Loading experience…');

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
  // AR is pure camera: no buttons, captions, hints or toasts over the camera view
  if (mode === 'ar') hud.setPure(true);
  else hud.showHud(mode);
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

/** Restyle the engine's own motion-permission box (iPhone) to match Orionis. */
function brandEnginePrompt() {
  const observer = new MutationObserver(() => {
    const box = document.querySelector('.prompt-box-8w');
    if (!box || box.dataset.orionis) return;
    box.dataset.orionis = '1';
    const text = box.querySelector('p');
    if (text) text.textContent = 'Tap Continue to start the Orionis AR experience';
  });
  observer.observe(document.body, { childList: true });
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
    location.search = '?preview';
  };
  document.getElementById('start-screen').classList.remove('hidden');
}
