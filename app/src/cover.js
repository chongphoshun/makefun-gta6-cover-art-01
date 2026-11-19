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
    drawPanel(ctx, rect, state, grade, W, H, title.y);
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

  // Poster furniture on top of everything: starburst seal and VOL pill.
  // On key-art layouts the seal stamps the title zone's right edge, clear
  // of every face; on band layouts it sits on the art's bottom-right
  // corner, just above the title band (a supporting panel, never a face).
  // Kept small so the art stays the hero.
  if (state.furniture) {
    if (state.badge) {
      const r = Math.min(W, H) * 0.058;
      if (title.overArt) drawSeal(ctx, W * 0.94, title.y + title.h * 0.42, r, 'EST.', '2026');
      else drawSeal(ctx, W * 0.94, title.y - r * 0.9, r, 'EST.', '2026');
    }
    drawVolPill(ctx, W * 0.022, H * 0.018, 'VOL. 06', Math.max(12, W * 0.015));
  }

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

  // Halftone print dots over the whole cover.
  if (state.halftone) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawHalftone(ctx, 0, 0, W, H, '#ff2e88');
    ctx.restore();
  }

  // Grain and vignette.
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.04 + 0.10 * (state.grainAmt ?? 0.3);
    ctx.globalCompositeOperation = 'overlay';
    const tile = grainTile();
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(5,0,15,${0.42 * (state.vignetteAmt ?? 1)})`);
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

function drawPanel(ctx, rect, state, grade, W, H, artBottom) {
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
    if (photo && photo.img) {
      const filt = [];
      if (grade.filter) filt.push(grade.filter);
      const c = state.contrast ?? 1; const s = state.saturation ?? 1;
      if (c !== 1) filt.push(`contrast(${c})`);
      if (s !== 1) filt.push(`saturate(${s})`);
      if (filt.length) ctx.filter = filt.join(' ');
      drawPhotoCover(ctx, photo.img, r, slot.zoom, slot.ox, slot.oy);
      ctx.filter = 'none';
    } else {
      const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      g.addColorStop(0, '#3a1450');
      g.addColorStop(1, '#160a26');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    applyGrade(ctx, r, grade, state);
  });

  // Scene caption / character label, clipped to the panel shape.
  // `lift` keeps the chip readable: above the palm band on bottom-row
  // panels, and above the title scrim when the panel runs under it
  // (key-art layouts, where the title prints over the art).
  if (state.captions && state.captions !== 'off') {
    frame((r) => {
      panelPath(ctx, r);
      ctx.clip();
      const atBottom = Math.abs((r.y + r.h) - artBottom) < 2;
      const underTitle = (r.y + r.h) > artBottom + 1;
      const lift = underTitle
        ? (r.y + r.h - artBottom) + 10
        : (atBottom && state.palms ? r.h * 0.22 + 8 : 0);
      drawCaptionChip(ctx, r, photo, state.captions, lift);
    });
  }

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

/** The grade: a soft-light wash, sky and ground gradients, deep shadows, glow.
 *  `strength` re-runs the overlay passes: above 1 it paints a second pass at
 *  the remainder, so a strong grade really punches. */
function applyGrade(ctx, rect, grade, state = {}) {
  const { x, y, w, h } = rect;
  const strength = state.strength ?? 1;
  const passes = strength > 1 ? [1, strength - 1] : [strength];
  ctx.save();
  for (const a of passes) {
    ctx.globalAlpha = a;
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
  }
  // Comic Ink: harden the panel edge so the art reads as printed ink.
  if (grade.inkBoost) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(16,4,32,0.55)';
    ctx.lineWidth = Math.max(2, w * 0.012);
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  ctx.restore();
}

/** 3D extruded title: dark layers offset down-right, gradient face on top.
 *  Letters are drawn one by one with a fixed tracking (0.03em), the way a
 *  typeset poster spaces its display face; the face gradient runs
 *  cream -> gold -> orange -> hot pink, like the top entries' key art. */
function drawTitle3D(ctx, text, cx, baseline, size, maxW) {
  const tracking = 0.03; // em
  let s = size;
  const measure = (fontSize) => {
    ctx.font = `${fontSize}px Anton, sans-serif`;
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + fontSize * tracking;
    return w - fontSize * tracking;
  };
  while (measure(s) > maxW && s > 12) s -= 2;
  const total = measure(s);
  const xs = [];
  let x = cx - total / 2;
  for (const ch of text) {
    xs.push(x);
    x += ctx.measureText(ch).width + s * tracking;
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const step = s * 0.05;
  const shades = ['#1a0530', '#4d0a52', '#8a1568'];
  shades.forEach((c, i) => {
    ctx.fillStyle = c;
    for (let j = 0; j < text.length; j++) {
      ctx.fillText(text[j], xs[j] + step * (3 - i), baseline + step * (3 - i));
    }
  });
  const face = ctx.createLinearGradient(0, baseline - s, 0, baseline);
  face.addColorStop(0, '#fffbe8');
  face.addColorStop(0.45, '#ffd27a');
  face.addColorStop(0.8, '#ff7a1a');
  face.addColorStop(1, '#ff2e88');
  ctx.fillStyle = face;
  for (let j = 0; j < text.length; j++) ctx.fillText(text[j], xs[j], baseline);
  ctx.lineWidth = Math.max(1.5, s * 0.025);
  ctx.strokeStyle = 'rgba(20,5,40,0.9)';
  for (let j = 0; j < text.length; j++) ctx.strokeText(text[j], xs[j], baseline);
  return s;
}

/** Small tracked caps line (logline): centered, letter-spaced, one line. */
function drawTrackedLine(ctx, text, cx, y, size, trackingEm, color) {
  const tracking = size * trackingEm;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  w -= tracking;
  let x = cx - w / 2;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + tracking;
  }
  return w;
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

/** The bottom title band: press-quote strip, halftone, skyline, sun, title,
 *  subtitle, then a footer strip with palms, tagline, barcode and credits. */
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
  drawSun(ctx, x + w * 0.85, y + h * 0.34, h * 0.34, '#ffb347', '#ff2e88');
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.9;
  drawSkyline(ctx, x, y + h * 0.58, w, h * 0.22, '#0d0518');
  ctx.restore();
  drawHalftone(ctx, x, y, w, h, '#ff2e88');

  const cx = x + w / 2;
  // Press-quote strip: stars + quote + source, a hero element, not a footnote.
  if (state.quote && state.quote.trim()) {
    drawPressStrip(ctx, cx, y + h * 0.10, h * 0.085, state.quote.trim(), state.pressSource || '', w * 0.92, state.stars);
  }
  drawTitle3D(ctx, state.title.trim().toUpperCase() || 'VICE HEAT', cx, y + h * 0.54, h * 0.44, w * 0.86);
  if (state.subtitle.trim()) {
    drawSubtitle(ctx, state.subtitle.trim(), cx, y + h * 0.76, h * 0.15, w * 0.7);
  }
  drawFooterStrip(ctx, x, y + h * 0.83, w, h * 0.17, state, W, H);
  ctx.restore();
}

/** Stars + quoted line + source, centered on one line when it fits. */
function drawPressStrip(ctx, cx, y, size, quote, source, maxW, stars) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const starTxt = '★'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, 5 - stars));
  const line = `"${quote.toUpperCase()}"${source ? ` — ${source.toUpperCase()}` : ''}`;
  let s = size;
  ctx.font = `700 ${s}px system-ui, sans-serif`;
  while (s > 9 && ctx.measureText(starTxt + '  ' + line).width > maxW) {
    s -= 1;
    ctx.font = `700 ${s}px system-ui, sans-serif`;
  }
  const total = ctx.measureText(starTxt + '  ' + line).width;
  let lx = cx - total / 2;
  ctx.fillStyle = '#ffc46b';
  ctx.textAlign = 'left';
  ctx.fillText(starTxt, lx, y);
  lx += ctx.measureText(starTxt + '  ').width;
  ctx.fillStyle = '#f4eefc';
  ctx.fillText(line, lx, y);
  ctx.restore();
}

/** Footer strip: palm silhouettes, tagline, barcode and credit fine print. */
function drawFooterStrip(ctx, x, y, w, h, state, W, H) {
  ctx.save();
  // Palm silhouettes along the bottom edge.
  ctx.globalAlpha = 0.9;
  drawPalmBand(ctx, x, y + h, w, h * 0.5, 'rgba(10, 4, 24, 0.95)');
  ctx.globalAlpha = 1;
  // Tagline, centered.
  if (state.tagline && state.tagline.trim()) {
    let ts = Math.max(10, h * 0.34);
    ctx.font = `700 ${ts}px system-ui, sans-serif`;
    while (ts > 8 && ctx.measureText(state.tagline.trim().toUpperCase()).width > w * 0.62) {
      ts -= 1;
      ctx.font = `700 ${ts}px system-ui, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(state.tagline.trim().toUpperCase(), x + w / 2, y + h * 0.44);
  }
  // Credit fine print, bottom edge.
  ctx.font = `${Math.max(7, h * 0.13)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(207, 196, 224, 0.75)';
  ctx.fillText(
    'VICE HEAT · A VICE HEAT COVER STUDIO PICTURE · STARRING YOU · SHOT ON YOUR OWN CAMERA · CAT. VH-2026',
    x + w / 2, y + h * 0.90,
  );
  // Barcode, bottom-right.
  if (state.furniture) drawBarcode(ctx, x + w - w * 0.085, y + h * 0.06, w * 0.062, h * 0.52);
  ctx.restore();
}

/** A fake-but-plausible barcode: deterministic bars from a fixed seed. */
function drawBarcode(ctx, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = '#f4eefc';
  ctx.fillRect(x - 3, y - 3, w + 6, h + 12);
  ctx.fillStyle = '#14092b';
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let bx = x;
  while (bx < x + w - 2) {
    const bw = 1 + Math.floor(rnd() * 3) * (w / 90);
    if (rnd() > 0.45) ctx.fillRect(bx, y, bw, h);
    bx += bw + (w / 90);
  }
  ctx.font = `${Math.max(7, h * 0.14)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('0 2026 0626', x + w / 2, y + h + 9);
  ctx.restore();
}

/** Starburst seal with two lines of text, e.g. EST. / 2026. */
function drawSeal(ctx, cx, cy, r, line1, line2) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.1);
  // Spiky starburst.
  ctx.beginPath();
  const spikes = 14;
  for (let i = 0; i <= spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.82;
    const px = Math.cos(a) * rr; const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffc46b';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.strokeStyle = '#14092b';
  ctx.stroke();
  // Inner disc.
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2e88';
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${r * 0.24}px system-ui, sans-serif`;
  ctx.fillText(line1, 0, -r * 0.14);
  ctx.font = `700 ${r * 0.3}px system-ui, sans-serif`;
  ctx.fillText(line2, 0, r * 0.2);
  ctx.restore();
}

/** Small VOL. pill for the art's top-left corner. */
function drawVolPill(ctx, x, y, text, size) {
  ctx.save();
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = size * 0.9; const h = size * 1.9;
  ctx.fillStyle = '#ffc46b';
  ctx.beginPath();
  ctx.roundRect(x, y, tw + padX * 2, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#14092b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + (tw + padX * 2) / 2, y + h / 2 + 1);
  ctx.restore();
}

/** One panel's caption chip: scene (place + time · flavor) or character label.
 *  Slim and tight on purpose — a printed poster caption, not a UI label:
 *  small bold place, smaller amber beat line, minimal padding, no slab.
 *  `lift` raises the chip above the palm band on bottom-row panels. */
function drawCaptionChip(ctx, rect, photo, mode, lift = 0) {
  if (!photo) return;
  const pad = Math.max(7, rect.w * 0.016);
  const x = rect.x + pad;
  const y = rect.y + rect.h - pad - lift;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if (mode === 'character' && photo.character) {
    const label = photo.character;
    let s = Math.max(10, rect.w * 0.045);
    ctx.font = `700 ${s}px system-ui, sans-serif`;
    while (s > 9 && ctx.measureText(label).width > rect.w * 0.6) {
      s -= 1;
      ctx.font = `700 ${s}px system-ui, sans-serif`;
    }
    const tw = ctx.measureText(label).width;
    const bh = s * 1.7;
    ctx.fillStyle = 'rgba(10, 4, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y - bh, tw + pad * 1.4, bh, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + pad * 0.7, y - bh * 0.32);
  } else if (photo.place) {
    const place = photo.place;
    const sub = [photo.time, photo.flavor].filter(Boolean).join(' · ');
    let s = Math.max(10, rect.w * 0.042);
    ctx.font = `700 ${s}px system-ui, sans-serif`;
    while (s > 9 && ctx.measureText(place).width > rect.w * 0.78) {
      s -= 1;
      ctx.font = `700 ${s}px system-ui, sans-serif`;
    }
    const s2 = Math.max(7, s * 0.58);
    ctx.font = `${s2}px system-ui, sans-serif`;
    const subW = ctx.measureText(sub).width;
    ctx.font = `700 ${s}px system-ui, sans-serif`;
    const tw = Math.max(ctx.measureText(place).width, subW);
    const bh = s * 1.05 + s2 * 1.35 + pad * 0.7;
    ctx.fillStyle = 'rgba(10, 4, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y - bh, tw + pad * 1.4, bh, 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(place, x + pad * 0.7, y - bh + s * 1.0);
    ctx.fillStyle = '#ffc46b';
    ctx.font = `${s2}px system-ui, sans-serif`;
    ctx.fillText(sub, x + pad * 0.7, y - bh * 0.16);
  }
  ctx.restore();
}

/** Title drawn over the art (full-bleed / key-art cast): scrim, then the
 *  same lettering — press strip, tracked title, script subtitle, logline,
 *  then the footer strip. */
function drawOverArtTitle(ctx, band, state, grade, W, H) {
  const { x, y, w, h } = band;
  ctx.save();
  const scrim = ctx.createLinearGradient(0, y - h * 0.4, 0, y + h);
  scrim.addColorStop(0, 'rgba(10,4,24,0)');
  scrim.addColorStop(1, 'rgba(10,4,24,0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(x, y - h * 0.4, w, h * 1.4);
  const cx = x + w / 2;
  if (state.quote && state.quote.trim()) {
    drawPressStrip(ctx, cx, y + h * 0.04, h * 0.06, state.quote.trim(), state.pressSource || '', w * 0.92, state.stars);
  }
  drawTitle3D(ctx, state.title.trim().toUpperCase() || 'VICE HEAT', cx, y + h * 0.48, h * 0.38, w * 0.88);
  if (state.subtitle.trim()) {
    drawSubtitle(ctx, state.subtitle.trim(), cx, y + h * 0.64, h * 0.12, w * 0.7);
  }
  if (state.logline && state.logline.trim()) {
    drawTrackedLine(ctx, state.logline.trim().toUpperCase(), cx, y + h * 0.76, h * 0.055, 0.28, '#ffe9a8');
  }
  drawFooterStrip(ctx, x, y + h * 0.82, w, h * 0.18, state, W, H);
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
  if (state.quote && state.quote.trim()) {
    drawPressStrip(ctx, cx, y + h * 0.04, h * 0.06, state.quote.trim(), state.pressSource || '', w * 0.92, state.stars);
  }
  drawTitle3D(ctx, state.title.trim().toUpperCase() || 'VICE HEAT', cx, y + h * 0.48, h * 0.38, w * 0.88);
  if (state.subtitle.trim()) {
    drawSubtitle(ctx, state.subtitle.trim(), cx, y + h * 0.64, h * 0.12, w * 0.7);
  }
  if (state.logline && state.logline.trim()) {
    drawTrackedLine(ctx, state.logline.trim().toUpperCase(), cx, y + h * 0.78, h * 0.055, 0.28, '#ffe9a8');
  }
  ctx.restore();
}
