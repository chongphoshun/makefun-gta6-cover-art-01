// Procedural poster art: a retro slatted sun, a city skyline and palm
// silhouettes, all drawn in canvas so the cover needs no borrowed artwork.

/** Retro sun: a gradient disc with horizontal slats cut out of its lower half. */
export function drawSun(ctx, cx, cy, r, top, bottom) {
  ctx.save();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Cut the slats.
  ctx.globalCompositeOperation = 'destination-out';
  let y = cy + r * 0.05;
  let gap = r * 0.05;
  while (y < cy + r) {
    ctx.fillRect(cx - r - 2, y, r * 2 + 4, gap);
    y += gap + r * 0.14;
    gap *= 1.5;
  }
  ctx.restore();
}

/** A dark skyline silhouette along a baseline, with a few lit windows. */
export function drawSkyline(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = color;
  let bx = x;
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (bx < x + w) {
    const bw = w * (0.05 + rnd() * 0.09);
    const bh = h * (0.3 + rnd() * 0.7);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    // Aerial on some towers.
    if (rnd() > 0.6) ctx.fillRect(bx + bw / 2 - 1, y + h - bh - h * 0.14, 2, h * 0.14);
    // Lit windows.
    ctx.fillStyle = 'rgba(255, 210, 122, 0.85)';
    for (let wy = y + h - bh + 6; wy < y + h - 6; wy += 12) {
      for (let wx = bx + 5; wx < bx + bw - 5; wx += 11) {
        if (rnd() > 0.72) ctx.fillRect(wx, wy, 3, 4);
      }
    }
    ctx.fillStyle = color;
    bx += bw + 2;
  }
  ctx.restore();
}

/** One palm tree silhouette: a leaning trunk and seven drooping fronds. */
export function drawPalm(ctx, x, y, s, color, lean = 0.12) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  // Trunk, leaning with the wind.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(lean * 40, -55, lean * 70, -100);
  ctx.stroke();
  // Fronds from the crown.
  const cx = lean * 70; const cy = -100;
  ctx.lineWidth = 5;
  for (let i = 0; i < 7; i++) {
    const a = (-0.15 - i * 0.22) * Math.PI;
    const tx = cx + Math.cos(a) * 62;
    const ty = cy + Math.sin(a) * 34 + 26;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 8 - 12, tx, ty);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(cx - 6, cy + 6, 4, 0, Math.PI * 2);
  ctx.arc(cx + 5, cy + 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A row of palms along a baseline, tallest at the edges, shorter mid-row. */
export function drawPalmBand(ctx, x, y, w, baseH, color) {
  const n = Math.max(3, Math.round(w / (baseH * 1.6)));
  for (let i = 0; i < n; i++) {
    const px = x + (w * (i + 0.5)) / n + (i % 2 === 0 ? -w * 0.01 : w * 0.01);
    const s = baseH * (0.75 + ((i * 37) % 10) / 28) / 110;
    drawPalm(ctx, px, y, s, color, i % 2 === 0 ? 0.12 : -0.1);
  }
}

/** Halftone dots filling a rectangle, denser toward the top. */
export function drawHalftone(ctx, x, y, w, h, color) {
  ctx.save();
  const gap = Math.max(10, w / 72);
  for (let row = 0; row * gap < h; row++) {
    for (let col = 0; col * gap < w; col++) {
      const fade = 1 - (row * gap) / h;
      const r = gap * 0.16 + fade * gap * 0.2;
      ctx.globalAlpha = 0.10 + fade * 0.28;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + col * gap + gap / 2, y + row * gap + gap / 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Film grain: a small noise tile, drawn tiled at low alpha. */
let noiseTile = null;
export function grainTile() {
  if (noiseTile) return noiseTile;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  noiseTile = c;
  return noiseTile;
}
