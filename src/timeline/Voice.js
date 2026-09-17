/**
 * Presenter voiceover: plays the narration, fires caption/gesture cues and exposes a loudness level
 * used to animate the avatar's head and mouth.
 *
 * The voice plays as a plain <audio> element (like the story video). Routing it through Web Audio made it
 * silent on iPhones (muted by the silent switch, and suspended until a tap), so the loudness comes from an
 * envelope precomputed into the cue file instead (tools/voice-envelope.mjs).
 */
export class Voice {
  constructor({ src, cuesUrl }) {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.src = src;
    this.cuesUrl = cuesUrl;
    this.cues = [];
    this.index = -1;
    this.onCue = null;
    this.onEnd = null;
    this.envelope = null;
    this.onBlocked = null;
    this.audio.setAttribute('playsinline', '');
    // iPhone: treat the voice as media playback so the silent switch doesn't mute it
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    this.audio.addEventListener('ended', () => this.finish());
  }

  async load() {
    const res = await fetch(this.cuesUrl);
    const json = await res.json();
    this.cues = json.cues;
    this.duration = json.duration;
    this.envelope = json.envelope ?? null;
  }

  /** Prepare playback (buffer the file) without making any sound before the page is scanned. */
  unlock() {
    const a = this.audio;
    a.muted = true;
    const settle = () => {
      if (this.active) return; // narration already started for real
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    };
    const p = a.play();
    if (p) p.then(settle, settle);
    else settle();
  }

  play() {
    this.index = -1;
    this.clearedIndex = -1;
    this.active = true;
    this.audio.muted = false;
    this.audio.currentTime = 0;
    this.startedAt = performance.now();
    this.audio.play().catch(() => {
      // sound blocked (no tap yet): run cues on a silent clock, and let the director ask for a tap
      this.silent = true;
      this.onBlocked?.();
    });
  }

  /**
   * Call on any user tap. Browsers only allow sound after a tap; if the narration already started
   * silently, the voice joins in at the right moment.
   */
  gesture() {
    const a = this.audio;
    if (this.active) {
      if (this.pausedAt) return;
      if (this.silent) {
        a.muted = false;
        a.currentTime = Math.max(0, this.time);
        a.play().then(() => { this.silent = false; }).catch(() => {});
      } else if (a.paused) {
        a.play().catch(() => {});
      }
      return;
    }
    if (this.gestureUnlocked) return;
    this.gestureUnlocked = true;
    // Not talking yet: play for an instant inside the tap so iPhones allow the narration later.
    // The file starts with 0.3 s of silence, so nothing is heard.
    a.muted = false;
    a.currentTime = 0;
    a.play()
      .then(() => {
        if (!this.active) {
          a.pause();
          a.currentTime = 0;
        }
      })
      .catch(() => { this.gestureUnlocked = false; });
  }

  pause() {
    if (!this.active) return;
    this.audio.pause();
    this.pausedAt = performance.now();
  }

  resume() {
    if (!this.active) return;
    if (this.silent && this.pausedAt) this.startedAt += performance.now() - this.pausedAt;
    this.pausedAt = null;
    if (!this.silent) this.audio.play().catch(() => {});
  }

  stop() {
    this.active = false;
    this.silent = false;
    this.audio.pause();
    this.index = -1;
  }

  finish() {
    if (!this.active) return;
    this.active = false;
    this.silent = false;
    this.onEnd?.();
  }

  get time() {
    if (this.silent) return this.pausedAt ? (this.pausedAt - this.startedAt) / 1000 : (performance.now() - this.startedAt) / 1000;
    return this.audio.currentTime;
  }

  level() {
    if (!this.active) return 0;
    const env = this.envelope;
    if (env?.values?.length) {
      const i = Math.floor(this.time / env.step);
      return env.values[Math.min(env.values.length - 1, Math.max(0, i))] ?? 0;
    }
    // fallback: fake speech rhythm while inside a cue
    const cue = this.cues[this.index];
    if (cue && this.time < cue.end) return 0.35 + Math.abs(Math.sin(this.time * 13)) * 0.45;
    return 0;
  }

  update() {
    if (!this.active) return;
    const t = this.time;
    const next = this.cues[this.index + 1];
    if (next && t >= next.start) {
      this.index++;
      this.onCue?.(next, this.index);
    }
    const cur = this.cues[this.index];
    if (cur && this.clearedIndex !== this.index && t > cur.end + 0.35) {
      this.clearedIndex = this.index;
      this.onCue?.(null, this.index);
    }
    if (this.silent && t > this.duration) this.finish();
  }
}
