import * as THREE from 'three';
import { FONT } from './brand.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function canvasTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export function font(weight, size) {
  return `${weight} ${size}px ${FONT}`;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + rr[0], y);
  ctx.lineTo(x + w - rr[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr[1]);
  ctx.lineTo(x + w, y + h - rr[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr[2], y + h);
  ctx.lineTo(x + rr[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr[3]);
  ctx.lineTo(x, y + rr[0]);
  ctx.quadraticCurveTo(x, y, x + rr[0], y);
  ctx.closePath();
}

/** Word-wrap text; returns the y after the last line. */
export function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines === maxLines - 1) {
        ctx.fillText(line.replace(/[,.;:]?$/, '…'), x, y);
        return y + lineHeight;
      }
      ctx.fillText(line, x, y);
      line = words[i];
      y += lineHeight;
      lines++;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineHeight;
}

/** Draw text with letter spacing (canvas letterSpacing isn't available everywhere). */
export function spacedText(ctx, text, x, y, spacing, align = 'left') {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    const w = ctx.measureText(text).width;
    const sx = align === 'center' ? x - w / 2 + spacing / 2 : align === 'right' ? x - w : x;
    const prev = ctx.textAlign;
    ctx.textAlign = 'left';
    ctx.fillText(text, sx, y);
    ctx.textAlign = prev;
    ctx.letterSpacing = '0px';
    return;
  }
  const chars = [...text];
  const total = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = prev;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw an image cover-cropped into a rect. */
export function drawCover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r;
  const sh = h / r;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
