import * as THREE from 'three';

/** Hexagon corner in the XZ plane (stage space). Corners sit at 30° + 60°·i, matching CylinderGeometry(…, 6). */
export function hexCorner(i, r) {
  const a = Math.PI / 6 + (Math.PI / 3) * i;
  return new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
}

/**
 * Flat shape (to be rotated into XZ with rotateX(-PI/2)) with a hexagonal hole in the middle.
 * outerRadius: circle radius, or null for a width × height rectangle.
 */
export function hexHoleShape(outerRadius, hexRadius, width = 1, height = 1) {
  const shape = new THREE.Shape();
  if (outerRadius) {
    shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  } else {
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.closePath();
  }
  const hole = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const c = hexCorner(i, hexRadius);
    // shape Y maps to -Z after rotateX(-PI/2)
    if (i === 0) hole.moveTo(c.x, -c.y);
    else hole.lineTo(c.x, -c.y);
  }
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

/** Hexagon shape in shape-space (Y = -Z after rotation). */
export function hexShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const c = hexCorner(i, r);
    if (i === 0) s.moveTo(c.x, -c.y);
    else s.lineTo(c.x, -c.y);
  }
  s.closePath();
  return s;
}

/** Planar UVs for geometry lying in XZ, mapping [-size/2, size/2] to [0, 1] (v up = -Z). */
export function planarUV(geo, size) {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / size + 0.5, -pos.getZ(i) / size + 0.5);
  uv.needsUpdate = true;
  return geo;
}

/** Soft radial gradient texture (for glows and contact shadows). */
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Vertical gradient (opaque at bottom, transparent at top) for light walls and beams. */
export function beamTexture(color = '#a100ff') {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + '88');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
