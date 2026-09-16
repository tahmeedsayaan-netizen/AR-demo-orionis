import { COLORS, drawIcon } from '../util/brand.js';
import { roundRect, font } from '../util/canvas.js';

/** Procedural thumbnail illustrations for the floating case-study cards. */
export function drawArt(g, kind, x, y, w, h, accent) {
  g.save();
  roundRect(g, x, y, w, h, 18);
  g.clip();
  const bg = g.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, '#1a0f26');
  bg.addColorStop(1, '#070509');
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);

  // glow blob
  const glow = g.createRadialGradient(x + w * 0.7, y + h * 0.35, 10, x + w * 0.7, y + h * 0.35, w * 0.6);
  glow.addColorStop(0, accent + 'aa');
  glow.addColorStop(1, accent + '00');
  g.fillStyle = glow;
  g.fillRect(x, y, w, h);

  // grid
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  g.lineWidth = 1;
  for (let gx = x; gx < x + w; gx += 28) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, y + h); g.stroke(); }
  for (let gy = y; gy < y + h; gy += 28) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + w, gy); g.stroke(); }

  const cx = x + w / 2;
  const cy = y + h / 2;
  ART[kind]?.(g, x, y, w, h, cx, cy, accent);
  g.restore();
}

const ART = {
  ai(g, x, y, w, h, cx, cy, accent) {
    // invoice docs flowing into an AI chip
    for (let i = 0; i < 3; i++) {
      const dx = x + 40 + i * 26, dy = y + 50 + i * 22;
      g.fillStyle = `rgba(255,255,255,${0.55 + i * 0.2})`;
      roundRect(g, dx, dy, 110, 140, 8);
      g.fill();
      g.fillStyle = 'rgba(16,16,16,0.5)';
      for (let l = 0; l < 6; l++) g.fillRect(dx + 14, dy + 22 + l * 17, l % 2 ? 60 : 82, 6);
    }
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(x + 210, cy + 10);
    g.lineTo(x + w - 190, cy + 10);
    g.stroke();
    g.setLineDash([]);
    g.shadowColor = accent;
    g.shadowBlur = 30;
    drawIcon(g, 'ai', x + w - 180, cy - 70, 150, '#fff', 1.6);
    g.shadowBlur = 0;
  },
  mobile(g, x, y, w, h, cx, cy, accent) {
    const pw = 120, ph = 220;
    for (const [ox, sc, alpha] of [[-120, 0.8, 0.5], [120, 0.8, 0.5], [0, 1, 1]]) {
      g.save();
      g.globalAlpha = alpha;
      g.translate(cx + ox, cy + 8);
      g.scale(sc, sc);
      g.fillStyle = '#0b0b0f';
      roundRect(g, -pw / 2, -ph / 2, pw, ph, 18);
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      g.stroke();
      const sg = g.createLinearGradient(0, -ph / 2, 0, ph / 2);
      sg.addColorStop(0, accent);
      sg.addColorStop(1, COLORS.purpleDeep);
      g.fillStyle = sg;
      roundRect(g, -pw / 2 + 8, -ph / 2 + 10, pw - 16, 70, 10);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) {
        roundRect(g, -pw / 2 + 8, -ph / 2 + 92 + i * 28, pw - 16, 20, 6);
        g.fill();
      }
      g.restore();
    }
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(cx + 38, cy - 64, 16, 0, Math.PI * 2);
    g.fill();
    drawIcon(g, 'play', cx + 28, cy - 74, 20, accent);
  },
  cloud(g, x, y, w, h, cx, cy, accent) {
    g.shadowColor = accent;
    g.shadowBlur = 30;
    drawIcon(g, 'cloud', cx - 80, y + 18, 160, '#fff', 1.5);
    g.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      const sx = x + 70 + i * ((w - 140) / 3) + 20, sy = y + h - 120;
      g.fillStyle = '#15101c';
      roundRect(g, sx, sy, 110, 90, 8);
      g.fill();
      g.strokeStyle = 'rgba(220,175,255,0.6)';
      g.lineWidth = 2;
      g.stroke();
      for (let r = 0; r < 3; r++) {
        g.fillStyle = 'rgba(255,255,255,0.15)';
        g.fillRect(sx + 10, sy + 12 + r * 26, 90, 16);
        g.fillStyle = r === i ? COLORS.orange : '#35ff9a';
        g.beginPath();
        g.arc(sx + 90, sy + 20 + r * 26, 4, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = accent;
      g.setLineDash([6, 6]);
      g.beginPath();
      g.moveTo(sx + 55, sy);
      g.lineTo(cx, y + 150);
      g.stroke();
      g.setLineDash([]);
    }
  },
  data(g, x, y, w, h, cx, cy, accent) {
    const base = y + h - 40;
    const vals = [0.35, 0.5, 0.42, 0.66, 0.58, 0.8, 0.92];
    const bw = (w - 120) / vals.length;
    vals.forEach((v, i) => {
      const bx = x + 60 + i * bw;
      const bh = v * (h - 110);
      const grad = g.createLinearGradient(0, base - bh, 0, base);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, COLORS.purpleDeep);
      g.fillStyle = grad;
      roundRect(g, bx + 8, base - bh, bw - 16, bh, [6, 6, 0, 0]);
      g.fill();
    });
    g.strokeStyle = COLORS.orange;
    g.lineWidth = 5;
    g.shadowColor = COLORS.orange;
    g.shadowBlur = 16;
    g.beginPath();
    vals.forEach((v, i) => {
      const px = x + 60 + i * bw + bw / 2;
      const py = base - v * (h - 110) - 30;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    });
    g.stroke();
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    g.font = font(800, 40);
    g.fillText('2.3x ROAS', x + 36, y + 62);
  },
};
