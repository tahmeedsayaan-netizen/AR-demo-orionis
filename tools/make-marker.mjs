// Render the printable A4-landscape AR marker (PNG for print + tracking, PDF for print).
// Layout coordinates match the AR stage (see LAYOUT in src/util/brand.js), so the
// 3D ring and service tabs land exactly on top of their printed counterparts.
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, ICONS, LAYOUT, logoSVG, tabPosition } from '../src/util/brand.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const content = JSON.parse(readFileSync(join(root, 'src/content/content.json'), 'utf8'));
const W = 1000;
const H = Math.round(W * LAYOUT.markerAspect);
const cx = W / 2;
const cy = H / 2;
const S = (v) => v * W; // stage units -> svg units

// Seeded RNG so the marker (and its compiled .mind features) is reproducible.
let seed = 20260917;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const inRing = (x, y, pad = 0) => Math.hypot(x - cx, y - cy) < S(LAYOUT.ringRadius) + pad;
const tabRects = content.services.map((_, i) => {
  const [tx, tz] = tabPosition(i);
  const [w, h] = LAYOUT.tabSize;
  return { x: cx + S(tx) - S(w) / 2, y: cy + S(tz) - S(h) / 2, w: S(w), h: S(h) };
});
const inRect = (x, y, r, pad) => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad;
const blocked = (x, y, pad = 14) =>
  inRing(x, y, pad + 10) || tabRects.some((r) => inRect(x, y, r, pad)) ||
  (x < 330 && y < 95) || (x > 700 && y < 95) || (y > H - 70);

// --- constellation / circuit background: dense, asymmetric, high-contrast features for tracking
let bg = '';
const stars = [];
while (stars.length < 150) {
  const x = 30 + rnd() * (W - 60);
  const y = 30 + rnd() * (H - 60);
  if (blocked(x, y)) continue;
  stars.push([x, y]);
}
for (let i = 0; i < stars.length; i++) {
  const [x, y] = stars[i];
  // connect to a near neighbour sometimes (constellation lines)
  let best = -1, bd = 1e9;
  for (let j = 0; j < stars.length; j++) {
    if (i === j) continue;
    const d = Math.hypot(stars[j][0] - x, stars[j][1] - y);
    if (d < bd) { bd = d; best = j; }
  }
  if (bd < 70 && rnd() < 0.75) {
    const [x2, y2] = stars[best];
    const mx = (x + x2) / 2, my = (y + y2) / 2;
    if (!blocked(mx, my, 4)) {
      // circuit-style elbow line
      bg += rnd() < 0.5
        ? `<path d="M${x} ${y}H${x2}V${y2}" stroke="${COLORS.purpleDeep}" stroke-opacity=".55" stroke-width="1.4" fill="none"/>`
        : `<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${COLORS.ink}" stroke-opacity=".35" stroke-width="1"/>`;
    }
  }
  const r = 1.6 + rnd() * 3.2;
  const kind = rnd();
  if (kind < 0.18) {
    const s = r * 2.2, k = s * 0.22;
    bg += `<path d="M${x} ${y - s}Q${x + k} ${y - k} ${x + s} ${y}Q${x + k} ${y + k} ${x} ${y + s}Q${x - k} ${y + k} ${x - s} ${y}Q${x - k} ${y - k} ${x} ${y - s}Z" fill="${COLORS.purple}"/>`;
  } else if (kind < 0.3) {
    bg += `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="none" stroke="${COLORS.ink}" stroke-width="1.3" transform="rotate(${Math.round(rnd() * 90)} ${x} ${y})"/>`;
  } else {
    bg += `<circle cx="${x}" cy="${y}" r="${r}" fill="${rnd() < 0.7 ? COLORS.ink : COLORS.orange}"/>`;
  }
}

// --- centre ring (matches AR ring radius)
const R = S(LAYOUT.ringRadius);
const segColors = [COLORS.purple, COLORS.orange, COLORS.pink, COLORS.purpleDeep, COLORS.lilac, COLORS.ink];
let ring = `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="#fff" stroke="${COLORS.ink}" stroke-width="3"/>`;
ring += `<circle cx="${cx}" cy="${cy}" r="${R - 12}" fill="none" stroke="${COLORS.ink}" stroke-width="1.2" stroke-dasharray="3 5"/>`;
for (let i = 0; i < 24; i++) {
  const a0 = (i / 24) * Math.PI * 2 + 0.03, a1 = ((i + 1) / 24) * Math.PI * 2 - 0.03;
  const rr = R - 2;
  const x0 = cx + rr * Math.cos(a0), y0 = cy + rr * Math.sin(a0);
  const x1 = cx + rr * Math.cos(a1), y1 = cy + rr * Math.sin(a1);
  const col = i % 4 === 0 ? segColors[(i / 4) % segColors.length] : COLORS.ink;
  ring += `<path d="M${x0} ${y0}A${rr} ${rr} 0 0 1 ${x1} ${y1}" stroke="${col}" stroke-width="${i % 4 === 0 ? 9 : 5}" fill="none"/>`;
}
// hexagon hatch outline
const hr = S(LAYOUT.hatchRadius);
const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i + Math.PI / 6;
  return `${cx + hr * Math.cos(a)},${cy + hr * Math.sin(a)}`;
}).join(' ');
ring += `<polygon points="${hex}" fill="none" stroke="${COLORS.lilac}" stroke-width="2.5"/>`;
const logoSize = 128;
ring += `<g transform="translate(${cx - logoSize / 2} ${cy - logoSize / 2 - 14}) scale(${logoSize / 100})">${logoSVG({ color: COLORS.ink, star: COLORS.purple }).replace(/<\/?svg[^>]*>/g, '')}</g>`;
ring += `<text x="${cx}" y="${cy + 70}" text-anchor="middle" font-size="19" font-weight="800" letter-spacing="6" fill="${COLORS.ink}">ORIONIS</text>`;
ring += `<text x="${cx}" y="${cy + 88}" text-anchor="middle" font-size="8.5" font-weight="600" letter-spacing="3.2" fill="${COLORS.purpleDeep}">TECHNOLOGY THAT SCALES</text>`;

// --- service tabs (printed under the AR tabs)
let tabs = '';
content.services.forEach((svc, i) => {
  const r = tabRects[i];
  const lines = svc.label.split('\n');
  tabs += `<g>
    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="7" fill="#fff" stroke="${COLORS.ink}" stroke-width="2.2"/>
    <rect x="${r.x}" y="${r.y}" width="10" height="${r.h}" rx="3" fill="${svc.color === COLORS.lilac ? COLORS.purpleDeep : svc.color}"/>
    <g transform="translate(${r.x + 17} ${r.y + r.h / 2 - 12}) scale(1)"><path d="${ICONS[svc.id]}" stroke="${COLORS.ink}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
    ${lines.map((l, k) => `<text x="${r.x + 48}" y="${r.y + r.h / 2 + (k - (lines.length - 1) / 2) * 13 + 4.5}" font-size="11" font-weight="800" fill="${COLORS.ink}">${l.replace('&', '&amp;')}</text>`).join('')}
  </g>`;
});

// --- header / footer
const header = `
  <g transform="translate(34 26) scale(0.5)">${logoSVG({ color: COLORS.ink, star: COLORS.purple }).replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="90" y="55" font-size="26" font-weight="800" letter-spacing="5" fill="${COLORS.ink}">ORIONIS</text>
  <text x="91" y="74" font-size="10.5" font-weight="600" letter-spacing="1.2" fill="${COLORS.purpleDeep}">${content.company.tagline.replace('&', '&amp;').toUpperCase()}</text>
  <rect x="${W - 262}" y="30" width="228" height="50" rx="10" fill="${COLORS.ink}"/>
  <text x="${W - 148}" y="52" text-anchor="middle" font-size="15" font-weight="800" letter-spacing="3" fill="#fff">AR EXPERIENCE</text>
  <text x="${W - 148}" y="69" text-anchor="middle" font-size="9.5" font-weight="600" letter-spacing="1" fill="${COLORS.lilac}">POINT YOUR CAMERA AT THIS PAGE</text>
  <text x="34" y="${H - 30}" xml:space="preserve" font-size="12" font-weight="700" fill="${COLORS.ink}">①  Open the Orionis AR link   ·   ②  Tap Start AR   ·   ③  Aim your camera at this page</text>
  <text x="${W - 34}" y="${H - 30}" text-anchor="end" font-size="12" font-weight="700" fill="${COLORS.purpleDeep}">orionistech.org  ·  ${content.company.email}</text>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="14" fill="none" stroke="${COLORS.ink}" stroke-width="3"/>
  ${[[22, 22, 1, 1], [W - 22, 22, -1, 1], [22, H - 22, 1, -1], [W - 22, H - 22, -1, -1]]
    .map(([x, y, sx, sy]) => `<path d="M${x} ${y + 40 * sy}V${y}H${x + 40 * sx}" stroke="${COLORS.purple}" stroke-width="6" fill="none"/>`).join('')}
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, Arial, sans-serif">
  <rect width="${W}" height="${H}" fill="#fff"/>
  ${bg}${ring}${tabs}${header}
</svg>`;

const interB64 = readFileSync(join(root, 'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64');
const html = (w, h) => `<!doctype html><html><head>
<style>@font-face{font-family:Inter;font-weight:100 900;src:url(data:font/woff2;base64,${interB64}) format('woff2')}@page{size:297mm 210mm;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${w};height:${h}}</style>
</head><body>${svg}</body></html>`;

mkdirSync(join(root, 'marker'), { recursive: true });
mkdirSync(join(root, 'public/targets'), { recursive: true });
writeFileSync(join(root, 'marker/orionis-marker.svg'), svg);

const browser = await puppeteer.launch();
const page = await browser.newPage();

await page.setViewport({ width: W, height: H, deviceScaleFactor: 3.508 }); // ~3508px wide = A4 @300dpi
await page.setContent(html(`${W}px`, `${H}px`), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'marker/orionis-marker.png'), clip: { x: 0, y: 0, width: W, height: H } });

await page.setViewport({ width: W, height: H, deviceScaleFactor: 1.2 });
await page.screenshot({ path: join(root, 'public/targets/orionis-marker.png'), clip: { x: 0, y: 0, width: W, height: H } });

await page.setContent(html('297mm', '210mm'), { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: join(root, 'marker/orionis-marker.pdf'), width: '297mm', height: '210mm', printBackground: true, pageRanges: '1' });

await browser.close();
console.log('marker written: marker/orionis-marker.{png,pdf,svg}, public/targets/orionis-marker.png');
