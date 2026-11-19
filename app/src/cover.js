// The cover renderer: draws panels, grades, poster art and 3D lettering
// onto a canvas at any size. The editor preview and the PNG export share it.
import { layoutById, gradeById } from './state.js';
import { drawSun, drawSkyline, drawPalmBand, drawHalftone, grainTile } from './palms.js';

/** Panel rectangles and title zone for the state's layout at W x H. */
export function layoutPanels(state, W, H) {
  const layout = layoutById(state.layout);
  const rects = layout.rects(W, H).map((r, i) => ({ ...r, index: i, hidden: !!r.hidden }));
  return { rects, title: layout.title(W, H), count: layout.panels };
}

/** Draws the whole cover onto `canvas` at its own size. */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width; const H = canvas.height;
  const grade = gradeById(state.grade);
  const { rects, title } = layoutPanels(state, W, H);

  ctx.save();
  ctx.fillStyle = '#14092b';
  ctx.fillRect(0, 0, W, H);

  // Panels.
  const visible = rects.filter((r) => !r.hidden).slice(0, layoutById(state.layout).panels);
  for (const rect of visible) {
    drawPanel(ctx, rect, state, grade, W, H);
  }

  // Palm band along the bottom of the art area.
  if (state.palms && !title.overArt) {
    const bandY = title.y;
    ctx.save();
    ctx.globalAlpha = 0.85;
    drawPalmBand(ctx, 0, bandY + 2, W, H * 0.06, 'rgba(16, 6, 32, 0.95)');
    ctx.restore();
  }

  // Title.
  if (title.band) drawKeyArtTitle(ctx, title, state, grade, W, H);
  else if (title.overArt) drawOverArtTitle(ctx, title, state, grade, W, H);
  else drawTitleBand(ctx, title, state, grade, W, H);

  // Selected-panel outline (editor only).
  if (opts.selected != null && visible[opts.selected]) {
    const r = visible[opts.selected];
    ctx.save();
    if (r.rot) {
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(r.rot);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    }
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.setLineDash([W * 0.012, W * 0.008]);
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.restore();
  }

  // Grain and vignette.
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const tile = grainTile();
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(5,0,15,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/** Renders the state's cover onto a fresh canvas at w x h. */
export function renderToCanvas(state, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawCover(c, state);
  return c;
}

/** Builds the panel's path in the current transform: parallelogram for
 *  slash, rotated rectangle for tilt, plain rectangle otherwise. */
function panelPath(ctx, rect) {
  ctx.beginPath();
  if (rect.slant) {
    const s = rect.slant;
    ctx.moveTo(rect.x + s, rect.y);
    ctx.lineTo(rect.x + rect.w, rect.y);
    ctx.lineTo(rect.x + rect.w - s, rect.y + rect.h);
    ctx.lineTo(rect.x, rect.y + rect.h);
    ctx.closePath();
  } else {
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
  }
}

function drawPanel(ctx, rect, state, grade, W, H) {
  const slot = state.panels[rect.index] ?? { photo: 0, zoom: 1, ox: 0, oy: 0 };
  const photo = state.photos[slot.photo] ?? state.photos[0];
  // Local rect for rotated panels (drawn in a frame turned about the centre).
  const lr = rect.rot
    ? { x: -rect.w / 2, y: -rect.h / 2, w: rect.w, h: rect.h }
    : rect;
  const frame = (draw) => {
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
    }
    draw(lr);
    ctx.restore();
  };

  // Photo + grade, clipped to the panel shape.
  frame((r) => {
    panelPath(ctx, r);
    ctx.clip();
    if (photo && photo.img) drawPhotoCover(ctx, photo.img, r, slot.zoom, slot.ox, slot.oy);
    else {
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, '#3a1450');
      g.addColorStop(1, '#160a26');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    applyGrade(ctx, r, grade);
  });

  // Inked panel border (+ a white snapshot frame for tilted panels).
  frame((r) => {
    panelPath(ctx, r);
    ctx.strokeStyle = grade.ink;
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, W * 0.001);
    ctx.save();
    ctx.translate(4, 4);
    panelPath(ctx, { ...r, x: r.x, y: r.y, w: r.w - 8, h: r.h - 8 });
    ctx.stroke();
    ctx.restore();
    if (rect.rot) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = Math.max(4, W * 0.006);
      panelPath(ctx, r);
      ctx.stroke();
    }
  });
}

/** Cover-fits the photo into the panel rect with zoom and pan offsets. */
function drawPhotoCover(ctx, img, rect, zoom, ox, oy) {
  const iw = img.naturalWidth; const ih = img.naturalHeight;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const s = base * zoom;
  const pw = iw * s; const ph = ih * s;
  // Clamp the pan so the photo always covers the panel.
  const maxOx = Math.max(0, (pw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (ph - rect.h) / 2 / rect.h);
  const cx = Math.max(-maxOx, Math.min(maxOx, ox));
  const cy = Math.max(-maxOy, Math.min(maxOy, oy));
  ctx.drawImage(img, rect.x + (rect.w - pw) / 2 + cx * rect.w, rect.y + (rect.h - ph) / 2 + cy * rect.h, pw, ph);
}

/** The grade: a soft-light wash, sky and ground gradients, deep shadows, glow. */
function applyGrade(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'overlay';
  let g = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  g.addColorStop(0, grade.sky[0]);
  g.addColorStop(1, grade.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h * 0.55);
  g = ctx.createLinearGradient(0, y + h * 0.45, 0, y + h);
  g.addColorStop(0, grade.ground[0]);
  g.addColorStop(1, grade.ground[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = grade.deep;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = grade.glow;
  ctx.fillRect(x, y, w, h * 0.3);
  ctx.restore();
}

/** 3D extruded title: dark layers offset down-right, gradient face on top. */
function drawTitle3D(ctx, text, cx, baseline, size, maxW) {
  let s = size;
  ctx.font = `${s}px Anton, sans-serif`;
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 2;
    ctx.font = `${s}px Anton, sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const step = s * 0.045;
  const shades = ['#16042c', '#3d0a4d', '#6d1160'];
  shades.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillText(text, cx + step * (3 - i), baseline + step * (3 - i));
  });
  const face = ctx.createLinearGradient(0, baseline - s, 0, baseline);
  face.addColorStop(0, '#ffffff');
  face.addColorStop(0.55, '#ffd27a');
  face.addColorStop(1, '#ff2e88');
  ctx.fillStyle = face;
  ctx.fillText(text, cx, baseline);
  ctx.lineWidth = Math.max(1.5, s * 0.02);
  ctx.strokeStyle = 'rgba(20,5,40,0.85)';
  ctx.strokeText(text, cx, baseline);
  return s;
}

function drawSubtitle(ctx, text, cx, y, size, maxW) {
  let s = size;
  ctx.font = `${s}px Pacifico, cursive`;
  while (ctx.measureText(text).width > maxW && s > 10) {
    s -= 1;
    ctx.font = `${s}px Pacifico, cursive`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = s * 0.55;
  ctx.fillStyle = '#8affef';
  ctx.fillText(text, cx, y);
  ctx.shadowBlur = 0;
  return s;
}

/** The bottom title band: halftone, skyline, sun, title, subtitle, quote, stars. */
function drawTitleBand(ctx, band, state, grade, W, H) {
  const { x, y, w, h } = band;
  ctx.save();
  ctx.fillStyle = '#150a26';
  ctx.fillRect(x, y, w, h);
  // Neon rule on top.
  const rule = ctx.createLinearGradient(x, 0, x + w, 0);
  rule.addColorStop(0, '#ffb347');
  rule.addColorStop(0.5, '#ff2e88');
  rule.addColorStop(1, '#19e3c2');
  ctx.fillStyle = rule;
  ctx.fillRect(x, y, w, Math.max(3, H * 0.004));
  // Sun + skyline behind the lettering (small, high, faint).
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.globalCompositeOperation = 'screen';
  drawSun(ctx, x + w * 0.85, y + h * 0.28, h * 0.34, '#ffb347', '#ff2e88');
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.9;
  drawSkyline(ctx, x, y + h * 0.62, w, h * 0.38, '#0d0518');
  ctx.restore();
  drawHalftone(ctx, x, y, w, h, '#ff2e88');

  const cx = x + w / 2;
  const titleSize = drawTitle3D(ctx, state.title.trim().toUpperCase() || 'VICE HEAT', cx, y + h * 0.52, h * 0.52, state.badge ? w * 0.66 : w * 0.86);
  if (state.subtitle.trim()) {
    drawSubtitle(ctx, state.subtitle.trim(), cx, y + h * 0.78, h * 0.17, w * 0.7);
  }
  if (state.quote.trim()) {
    let qs = Math.max(11, h * 0.075);
    ctx.font = `${qs}px system-ui, sans-serif`;
    while (qs > 8 && ctx.measureText(state.quote.trim().toUpperCase()).width > w * 0.55) {
      qs -= 1;
      ctx.font = `${qs}px system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cfc4e0';
    ctx.fillText(state.quote.trim().toUpperCase(), cx, y + h * 0.94);
  }
  if (state.stars > 0) drawStars(ctx, x + w * 0.06, y + h * 0.9, h * 0.085, state.stars);
  if (state.badge) drawBadge(ctx, x + w - w * 0.16, y + h * 0.08, w * 0.13, h * 0.3, 'PALM STATE');
  ctx.restore();
}

/** Title drawn over the art (full-bleed): scrim, then the same lettering. */
function drawOverArtTitle(ctx, band, state, grade, W, H) {
  const { x, y, w, h } = band;
  ctx.save();
  const scrim = ctx.createLinearGradient(0, y - h * 0.4, 0, y + h);
  scrim.addColorStop(0, 'rgba(10,4,24,0)');
  scrim.addColorStop(1, 'rgba(10,4,24,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y - h * 0.4, w, h * 1.4);
  const cx = x + w / 2;
  drawTitle3D(ctx, state.title.trim().toUpperCase() || 'VICE HEAT', cx, y + h * 0.46, h * 0.5, w * 0.88);
  if (state.subtitle.trim()) {
    drawSubtitle(ctx, state.subtitle.trim(), cx, y + h * 0.72, h * 0.16, w * 0.7);
  }
  if (state.quote.trim()) {
    let qs = Math.max(11, h * 0.07);
    ctx.font = `${qs}px system-ui, sans-serif`;
    while (qs > 8 && ctx.measureText(state.quote.trim().toUpperCase()).width > w * 0.55) {
      qs -= 1;
      ctx.font = `${qs}px system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ddf7';
    ctx.fillText(state.quote.trim().toUpperCase(), cx, y + h * 0.9);
  }
  if (state.stars > 0) drawStars(ctx, x + w * 0.06, y + h * 0.86, h * 0.09, state.stars);
  ctx.restore();
}

/** Key-art title: a translucent halftone band across the middle of the art. */
function drawKeyArtTitle(ctx, band, state, grade, W, H) {
  const { x, y, w, h } = band;
  ctx.save();
  ctx.fillStyle = 'rgba(10,4,24,0.82)';
  ctx.fillRect(x, y, w, h);
  const rule = ctx.createLinearGradient(x, 0, x + w, 0);
  rule.addColorStop(0, '#ffb347');
  rule.addColorStop(0.5, '#ff2e88');
  rule.addColorStop(1, '#19e3c2');
  ctx.fillStyle = rule;
  ctx.fillRect(x, y, w, Math.max(3, H * 0.004));
  ctx.fillRect(x, y + h - Math.max(3, H * 0.004), w, Math.max(3, H * 0.004));
  drawHalftone(ctx, x, y, w, h, '#ff2e88');
  const cx = x + w / 2;
  drawTitle3D(ctx, state.title.trim().toUpperCase() || 'VICE HEAT', cx, y + h * 0.52, h * 0.46, state.badge ? w * 0.66 : w * 0.88);
  if (state.subtitle.trim()) {
    drawSubtitle(ctx, state.subtitle.trim(), cx, y + h * 0.8, h * 0.15, w * 0.7);
  }
  if (state.stars > 0) drawStars(ctx, x + w * 0.06, y + h * 0.9, h * 0.085, state.stars);
  if (state.badge) drawBadge(ctx, x + w - w * 0.16, y + h * 0.08, w * 0.13, h * 0.28, 'PALM STATE');
  ctx.restore();
}

function drawStars(ctx, x, y, size, filled) {
  ctx.save();
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffc46b';
  ctx.fillText('★'.repeat(filled) + '☆'.repeat(Math.max(0, 5 - filled)), x, y);
  ctx.font = `${size * 0.55}px system-ui, sans-serif`;
  ctx.fillStyle = '#cfc4e0';
  ctx.fillText('HEAT', x, y + size * 0.95);
  ctx.restore();
}

function drawBadge(ctx, x, y, w, h, text) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.14);
  ctx.fillStyle = '#ff2e88';
  const bw = w; const bh = h * 0.52;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${bh * 0.42}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 1);
  ctx.restore();
}
