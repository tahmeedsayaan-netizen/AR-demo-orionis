/**
 * Presenter voiceover: plays the narration, fires caption/gesture cues and exposes a loudness level
 * (Web Audio analyser) used to animate the avatar's head and mouth.
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
    this.data = null;
    this.audio.addEventListener('ended', () => this.finish());
  }

  async load() {
    const res = await fetch(this.cuesUrl);
    const json = await res.json();
    this.cues = json.cues;
    this.duration = json.duration;
  }

  /** Must be called from a user gesture (unlocks audio on iOS/Android). */
  unlock(ctx) {
    this.ctx = ctx;
    try {
      const source = ctx.createMediaElementSource(this.audio);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.data = new Uint8Array(this.analyser.fftSize);
      source.connect(this.analyser);
      this.analyser.connect(ctx.destination);
    } catch {
      this.analyser = null;
    }
    // Prime playback silently: nothing may be heard until the page has been scanned.
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
    this.ctx?.resume();
    this.startedAt = performance.now();
    this.audio.play().catch(() => {
      // audio blocked: run cues on a silent clock so the show still goes on
      this.silent = true;
    });
  }

  /**
   * Call on any user tap. Browsers only allow sound after a tap; if the narration already started
   * silently, the voice joins in at the right moment.
   */
  gesture() {
    this.ctx?.resume();
    const a = this.audio;
    if (this.active && this.silent && !this.pausedAt) {
      a.muted = false;
      a.currentTime = Math.max(0, this.time);
      a.play().then(() => { this.silent = false; }).catch(() => {});
    }
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
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.data);
      let sum = 0;
      for (let i = 0; i < this.data.length; i++) {
        const v = (this.data[i] - 128) / 128;
        sum += v * v;
      }
      return Math.min(1, Math.sqrt(sum / this.data.length) * 5);
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
