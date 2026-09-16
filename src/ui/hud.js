import { COLORS, logoSVG } from '../util/brand.js';

const $ = (sel, root = document) => root.querySelector(sel);

/** DOM overlay: start/loading screens, HUD buttons, captions, toasts, info sheet, fullscreen video. */
export class Hud {
  constructor(content) {
    this.content = content;
    this.captionsOn = true;
    this.handlers = {};

    document.querySelectorAll('[data-logo]').forEach((el) => {
      el.innerHTML = logoSVG({ color: '#fff', star: COLORS.purple });
    });

    $('#btn-home').addEventListener('click', () => this.emit('home'));
    $('#btn-info').addEventListener('click', () => this.showInfo());
    $('#btn-exit').addEventListener('click', () => this.emit('exit'));
    $('#btn-cc').addEventListener('click', () => {
      this.captionsOn = !this.captionsOn;
      $('#btn-cc').classList.toggle('active', this.captionsOn);
      if (!this.captionsOn) this.caption(null);
    });

    this.buildInfo();
    document.querySelectorAll('.sheet').forEach((sheet) => {
      sheet.addEventListener('click', (e) => {
        if (e.target === sheet || e.target.closest('[data-close]')) this.closeSheet(sheet);
      });
    });
  }

  on(name, fn) {
    this.handlers[name] = fn;
    return this;
  }

  emit(name, ...args) {
    this.handlers[name]?.(...args);
  }

  // ---------- screens ----------
  showStart({ onAR, onPreview }) {
    $('#start-screen').classList.remove('hidden');
    $('#btn-start-ar').onclick = onAR;
    $('#btn-start-preview').onclick = onPreview;
  }

  hideStart() {
    $('#start-screen').classList.add('hidden');
  }

  loading(text) {
    const el = $('#loading');
    if (text === false) return el.classList.add('hidden');
    el.classList.remove('hidden');
    $('#loading-text').textContent = text;
  }

  showHud(mode) {
    $('#hud').classList.remove('hidden');
    document.body.dataset.mode = mode;
  }

  scanning(on) {
    $('#scan-hint').classList.toggle('hidden', !on);
  }

  // ---------- captions / hints ----------
  caption(text) {
    const el = $('#captions');
    if (!text || !this.captionsOn) {
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden', 'pop');
    void el.offsetWidth;
    el.classList.add('pop');
    el.firstElementChild.textContent = text;
  }

  phaseHint(html, action) {
    const el = $('#phase-hint');
    if (!html) return el.classList.add('hidden');
    el.innerHTML = html;
    el.classList.remove('hidden');
    const btn = el.querySelector('button');
    if (btn && action) btn.onclick = action;
  }

  toast(title, text, ms = 3200) {
    const el = $('#toast');
    el.innerHTML = `${title ? `<strong>${title}</strong>` : ''}${text}`;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ---------- info sheet ----------
  buildInfo() {
    const c = this.content.company;
    const sheet = $('#info-sheet');
    $('.sheet-sub', sheet).textContent = c.claim;
    $('.sheet-promise', sheet).textContent = c.promise;
    $('.edge-grid', sheet).innerHTML = c.edge.map((e) => `<div><b>${e.title}</b><span>${e.text}</span></div>`).join('');
    $('[data-whatsapp]', sheet).href = `https://wa.me/${c.whatsapp.replace(/\D/g, '')}`;
    $('[data-email]', sheet).href = `mailto:${c.email}`;
    $('[data-website]', sheet).href = c.website;
    $('.sheet-foot', sheet).textContent = `${c.office} · ${c.whatsappLabel} · ${c.email}`;
    $('[data-watch]', sheet).addEventListener('click', () => {
      this.closeSheet(sheet);
      this.emit('watch');
    });
  }

  showInfo() {
    $('#info-sheet').classList.remove('hidden');
    this.emit('sheet', true);
  }

  closeSheet(sheet) {
    sheet.classList.add('hidden');
    const video = $('video', sheet);
    if (video) video.pause();
    this.emit('sheet', false);
  }

  fullscreenVideo(src, poster, startAt = 0) {
    const sheet = $('#fs-video');
    const video = $('video', sheet);
    if (!video.src.endsWith(src)) video.src = src;
    video.poster = poster;
    sheet.classList.remove('hidden');
    video.currentTime = startAt;
    video.play().catch(() => {});
    this.emit('sheet', true);
  }
}
