import '@fontsource-variable/inter/wght.css';
import './ui/hud.css';
import * as THREE from 'three';
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

  // Unlock audio inside the tap gesture.
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const voice = new Voice({ src: 'audio/voiceover.mp3', cuesUrl: 'audio/voiceover-cues.json' });
  voice.unlock(audioCtx);

  hud.hideStart();
  hud.loading('Loading experience…');

  try {
    await Promise.all([document.fonts.load('800 20px "Inter Variable"'), document.fonts.load('500 20px "Inter Variable"')]);
  } catch {
    /* fall back to system font */
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: mode === 'ar', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  let director;
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
  const stage = new Stage(renderer, content, hud, actions, { occluder: mode === 'ar' });
  director = new Director({ stage, hud, voice, content });

  let session;
  let lostTimer;
  const onFound = () => {
    clearTimeout(lostTimer);
    if (session.anchor) session.anchor.visible = true;
    director.found();
  };
  const onLost = () => {
    director.lost();
    // like the reference: content disappears when the page leaves the view
    lostTimer = setTimeout(() => session.anchor && (session.anchor.visible = false), 250);
  };

  if (mode === 'ar') {
    const { ARSession } = await import('./ar/tracker.js');
    session = new ARSession({ container, renderer, targetSrc: 'targets/orionis.mind', onFound, onLost });
  } else {
    const { PreviewSession } = await import('./ar/preview.js');
    session = new PreviewSession({ container, renderer, onFound });
  }

  try {
    await Promise.all([stage.load(), voice.load()]);
  } catch (err) {
    console.error(err);
    return fail('Could not load the experience. Please check your connection and try again.');
  }
  session.mount.add(stage.group);

  if (mode === 'ar') hud.loading('Starting camera…');
  try {
    await session.start();
  } catch (err) {
    console.error(err);
    return fail(
      err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access and reload — or try the preview.'
        : 'The camera could not start on this device. You can still explore the preview.',
    );
  }

  hud.loading(false);
  hud.showHud(mode);
  if (mode === 'ar') hud.scanning(true);

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
    dom: renderer.domElement,
    getCamera: () => session.camera,
    scene: session.scene,
    target: stage.root,
    manipulate: mode === 'ar',
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    session.update?.();
    voice.update();
    if (!gsap.globalTimeline.paused()) stage.update(dt, session.camera);
    renderer.render(session.scene, session.camera);
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

function fail(message) {
  hud.loading(false);
  document.querySelector('#start-screen .lead').textContent = message;
  document.getElementById('btn-start-ar').onclick = () => location.reload();
  document.getElementById('btn-start-preview').onclick = () => {
    location.search = '?preview&autostart';
  };
  document.getElementById('start-screen').classList.remove('hidden');
}
