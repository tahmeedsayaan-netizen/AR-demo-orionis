// Shared brand assets: colours, logo and icons as SVG path data.
// Used by both the in-AR canvas textures (via Path2D) and the printable marker (via SVG).

export const COLORS = {
  black: '#0d0d0d',
  ink: '#101010',
  purple: '#a100ff',
  purpleDeep: '#7500c0',
  purpleDark: '#460073',
  lilac: '#dcafff',
  orange: '#ff7800',
  pink: '#ff50a0',
  red: '#ff5757',
  paper: '#f1f1ef',
  white: '#ffffff',
};

export const FONT = "'Inter', 'Segoe UI', Roboto, Arial, sans-serif";

// Logo mark (ring with two cuts + sparkle), 100x100 box.
const LOGO = { cx: 48, cy: 52, r: 30.5, width: 10.5, arcs: [[-58, 116], [132, 282]] };
const STAR = { x: 72.5, y: 21.5, s: 10 };

const rad = (d) => (d * Math.PI) / 180;
const pt = (a, r = LOGO.r) => [LOGO.cx + r * Math.cos(rad(a)), LOGO.cy + r * Math.sin(rad(a))];

function starPath({ x, y, s }) {
  const k = s * 0.22;
  return `M${x} ${y - s} Q${x + k} ${y - k} ${x + s} ${y} Q${x + k} ${y + k} ${x} ${y + s} Q${x - k} ${y + k} ${x - s} ${y} Q${x - k} ${y - k} ${x} ${y - s}Z`;
}

export function logoSVG({ color = COLORS.ink, star = color } = {}) {
  const arcs = LOGO.arcs
    .map(([a0, a1]) => {
      const [x0, y0] = pt(a0);
      const [x1, y1] = pt(a1);
      const large = a1 - a0 > 180 ? 1 : 0;
      return `<path d="M${x0.toFixed(2)} ${y0.toFixed(2)} A${LOGO.r} ${LOGO.r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}" fill="none" stroke="${color}" stroke-width="${LOGO.width}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${arcs}<path d="${starPath(STAR)}" fill="${star}"/></svg>`;
}

/** Draw the logo into a 2D canvas context, centred at (x, y) with the given box size. */
export function drawLogo(ctx, x, y, size, color = COLORS.ink, star = color) {
  const s = size / 100;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = LOGO.width;
  ctx.lineCap = 'butt';
  for (const [a0, a1] of LOGO.arcs) {
    ctx.beginPath();
    ctx.arc(LOGO.cx, LOGO.cy, LOGO.r, rad(a0), rad(a1));
    ctx.stroke();
  }
  ctx.fillStyle = star;
  ctx.fill(new Path2D(starPath(STAR)));
  ctx.restore();
}

// 24x24 stroke icons.
export const ICONS = {
  software: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  webmobile: 'M2 5h14v10H2zM0.5 18.5h17M18 8h5v13h-5zM20 18.5h1',
  ai: 'M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4M10 10h4v4h-4z',
  cloud: 'M7 19h10.5a4.5 4.5 0 0 0 .6-8.96A6.5 6.5 0 0 0 5.6 9.4 4.8 4.8 0 0 0 7 19zM12 12v5M9.5 14.5L12 12l2.5 2.5',
  data: 'M3 21h18M6 18v-4M11 18v-7M16 18v-5M4 10l5-4 4 3 7-6M16 3h4v4',
  custom: 'M9 3h6v3.2a2 2 0 1 0 3.2 1.6V3H21v7h-3.2a2 2 0 1 0 0 4H21v7H3v-7h3.2a2 2 0 1 0 0-4H3V3z',
  plan: 'M9 4H5v17h14V4h-4M9 2h6v4H9zM8 11h8M8 15h5',
  build: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.8-.4-.4-2.8z',
  scale: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  maintain: 'M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5zM8.5 12l2.5 2.5 4.5-5',
  play: 'M8 5v14l11-7z',
  back: 'M20 12H5M11 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
};

/** Stroke a 24x24 icon into ctx at (x,y) top-left with pixel size. */
export function drawIcon(ctx, name, x, y, size, color, lineWidth = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const p = new Path2D(ICONS[name]);
  if (name === 'play') {
    ctx.fillStyle = color;
    ctx.fill(p);
  } else ctx.stroke(p);
  ctx.restore();
}

// Layout shared between the printed marker and the AR stage.
// Stage units: 1 = marker width. Stage X right, Z toward the bottom edge of the page.
export const LAYOUT = {
  markerAspect: 210 / 297, // A4 landscape height / width
  ringRadius: 0.2,
  hatchRadius: 0.1,
  tabRadius: 0.305,
  tabSize: [0.15, 0.062],
  // angles in degrees, 0 = +X (right), 90 = +Z (toward viewer)
  tabAngles: [-120, -60, 0, 60, 120, 180],
};

export function tabPosition(i) {
  const a = rad(LAYOUT.tabAngles[i]);
  // squash vertically so tabs fit on A4 landscape
  return [Math.cos(a) * LAYOUT.tabRadius, Math.sin(a) * LAYOUT.tabRadius * 0.86];
}
