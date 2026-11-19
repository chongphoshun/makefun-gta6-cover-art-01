// Wires the editor: controls, panel picking and dragging, history, export,
// and the ?shot= scenes screenshots use.
import {
  SIZES, GRADES, LAYOUTS, TITLES, SUBTITLES, CAPTION_MODES, FALLBACK_CAPTIONS,
  defaultState, layoutById, sizeById, History,
} from './state.js';
import { drawCover, layoutPanels, renderToCanvas } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
let state = defaultState();
const history = new History();
history.push(state);

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadLibrary() {
  for (const p of state.photos) {
    try { p.img = await loadImage(p.src); } catch { p.img = null; }
  }
}

function currentSize() { return sizeById(state.size); }

function redraw() {
  // In a cover shot the canvas keeps the viewport size shots.js gave it;
  // everywhere else it matches the selected export size.
  if (!document.body.classList.contains('shot-cover')) {
    const s = currentSize();
    if (canvas.width !== s.w || canvas.height !== s.h) {
      canvas.width = s.w;
      canvas.height = s.h;
    }
  }
  const coverMode = document.body.classList.contains('shot-cover');
  drawCover(canvas, state, coverMode ? {} : { selected: state.selected });
  syncPanelLabel();
}

function commit() {
  history.push(state);
  syncUndoRedo();
  redraw();
}

function syncUndoRedo() {
  document.getElementById('undoBtn').disabled = !history.canUndo;
  document.getElementById('redoBtn').disabled = !history.canRedo;
}

function syncPanelLabel() {
  const { count } = layoutPanels(state, canvas.width, canvas.height);
  const el = document.getElementById('panelLabel');
  el.textContent = `Panel ${Math.min(state.selected + 1, count)} of ${count} selected`;
  document.getElementById('zoomRange').value = String(panelSlot().zoom);
}

function panelSlot() {
  return state.panels[state.selected] ?? state.panels[0];
}

function buildChips(rowId, items, activeId, onPick, swatchOf) {
  const row = document.getElementById(rowId);
  row.replaceChildren();
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.id = it.id;
    b.setAttribute('aria-pressed', String(it.id === activeId));
    if (swatchOf) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = swatchOf(it);
      b.append(dot, document.createTextNode(it.name ?? it.label));
    } else {
      b.textContent = it.name ?? it.label;
    }
    b.addEventListener('click', () => {
      onPick(it.id);
      for (const x of row.children) x.setAttribute('aria-pressed', String(x.dataset.id === it.id));
    });
    row.append(b);
  }
}

function syncChips() {
  buildChips('layoutRow', LAYOUTS, state.layout, (id) => {
    state.layout = id;
    const { count } = layoutPanels(state, canvas.width, canvas.height);
    state.selected = Math.min(state.selected, count - 1);
    commit();
  });
  buildChips('gradeRow', GRADES, state.grade, (id) => { state.grade = id; commit(); }, (g) => g.swatch);
  buildChips('sizeRow', SIZES, state.size, (id) => { state.size = id; commit(); });
  buildChips('captionRow', CAPTION_MODES, state.captions, (id) => { state.captions = id; commit(); });
}

function buildLibrary() {
  const lib = document.getElementById('library');
  lib.replaceChildren();
  state.photos.forEach((p, i) => {
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    img.title = p.name;
    img.setAttribute('aria-pressed', String(panelSlot().photo === i));
    img.addEventListener('click', () => {
      panelSlot().photo = i;
      for (const x of lib.children) x.setAttribute('aria-pressed', 'false');
      img.setAttribute('aria-pressed', 'true');
      commit();
    });
    lib.append(img);
  });
}

function syncInputs() {
  document.getElementById('titleInput').value = state.title;
  document.getElementById('subtitleInput').value = state.subtitle;
  document.getElementById('quoteInput').value = state.quote;
  document.getElementById('sourceInput').value = state.pressSource;
  document.getElementById('taglineInput').value = state.tagline;
  document.getElementById('toggleGrain').checked = state.grain;
  document.getElementById('toggleVignette').checked = state.vignette;
  document.getElementById('togglePalms').checked = state.palms;
  document.getElementById('toggleBadge').checked = state.badge;
  document.getElementById('toggleFurniture').checked = state.furniture;
  document.getElementById('toggleHalftone').checked = state.halftone;
  document.getElementById('starsRange').value = String(state.stars);
  document.getElementById('zoomRange').value = String(panelSlot().zoom);
  document.getElementById('strengthRange').value = String(state.strength);
  document.getElementById('contrastRange').value = String(state.contrast);
  document.getElementById('saturationRange').value = String(state.saturation);
  document.getElementById('grainRange').value = String(state.grainAmt);
  document.getElementById('vignetteRange').value = String(state.vignetteAmt);
  syncChips();
  buildLibrary();
  syncUndoRedo();
}

function download(canvasEl, name) {
  canvasEl.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

async function exportSize(sizeId) {
  const s = sizeById(sizeId);
  const off = renderToCanvas(state, s.w, s.h);
  download(off, `vice-heat-${s.w}x${s.h}.png`);
  statusEl.textContent = `Saved vice-heat-${s.w}x${s.h}.png`;
}

// --- Controls -------------------------------------------------------------

document.getElementById('titleInput').addEventListener('input', (e) => {
  state.title = e.target.value;
  redraw();
});
document.getElementById('titleInput').addEventListener('change', commit);
document.getElementById('subtitleInput').addEventListener('input', (e) => {
  state.subtitle = e.target.value;
  redraw();
});
document.getElementById('subtitleInput').addEventListener('change', commit);
document.getElementById('quoteInput').addEventListener('input', (e) => {
  state.quote = e.target.value;
  redraw();
});
document.getElementById('quoteInput').addEventListener('change', commit);
document.getElementById('sourceInput').addEventListener('input', (e) => {
  state.pressSource = e.target.value;
  redraw();
});
document.getElementById('sourceInput').addEventListener('change', commit);
document.getElementById('taglineInput').addEventListener('input', (e) => {
  state.tagline = e.target.value;
  redraw();
});
document.getElementById('taglineInput').addEventListener('change', commit);

for (const [id, key] of [['toggleGrain', 'grain'], ['toggleVignette', 'vignette'], ['togglePalms', 'palms'], ['toggleBadge', 'badge'], ['toggleFurniture', 'furniture'], ['toggleHalftone', 'halftone']]) {
  document.getElementById(id).addEventListener('change', (e) => {
    state[key] = e.target.checked;
    commit();
  });
}
// Grade sliders: live redraw while dragging, one history entry on release.
for (const [id, key] of [['strengthRange', 'strength'], ['contrastRange', 'contrast'], ['saturationRange', 'saturation'], ['grainRange', 'grainAmt'], ['vignetteRange', 'vignetteAmt']]) {
  document.getElementById(id).addEventListener('input', (e) => {
    state[key] = Number(e.target.value);
    redraw();
  });
  document.getElementById(id).addEventListener('change', commit);
}
document.getElementById('starsRange').addEventListener('input', (e) => {
  state.stars = Number(e.target.value);
  redraw();
});
document.getElementById('starsRange').addEventListener('change', commit);
document.getElementById('zoomRange').addEventListener('input', (e) => {
  panelSlot().zoom = Number(e.target.value);
  redraw();
});
document.getElementById('zoomRange').addEventListener('change', commit);
document.getElementById('fitBtn').addEventListener('click', () => {
  const s = panelSlot();
  s.zoom = 1; s.ox = 0; s.oy = 0;
  commit();
});
document.getElementById('fillAllBtn').addEventListener('click', () => {
  const photo = panelSlot().photo;
  for (const p of state.panels) p.photo = photo;
  commit();
});
document.getElementById('spreadBtn').addEventListener('click', () => {
  const n = state.photos.length;
  state.panels.forEach((p, i) => { p.photo = (state.selected + i) % n; });
  commit();
});

document.getElementById('uploadInput').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  for (const f of files) {
    const url = URL.createObjectURL(f);
    try {
      const img = await loadImage(url);
      const cap = FALLBACK_CAPTIONS[(state.photos.length - 4 + FALLBACK_CAPTIONS.length) % FALLBACK_CAPTIONS.length];
      state.photos.push({ name: f.name, src: url, img, objectUrl: url, ...cap });
    } catch { /* unreadable file: skip it */ }
  }
  if (files.length) {
    panelSlot().photo = state.photos.length - files.length;
    buildLibrary();
    commit();
  }
  e.target.value = '';
});

document.getElementById('undoBtn').addEventListener('click', () => {
  const s = history.undo();
  if (s) { state = s; syncInputs(); redraw(); }
});
document.getElementById('redoBtn').addEventListener('click', () => {
  const s = history.redo();
  if (s) { state = s; syncInputs(); redraw(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('undoBtn').click();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    document.getElementById('redoBtn').click();
  }
});

document.getElementById('surpriseBtn').addEventListener('click', () => {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  state.layout = pick(LAYOUTS).id;
  state.grade = pick(GRADES).id;
  state.title = pick(TITLES);
  state.subtitle = pick(SUBTITLES);
  state.captions = pick(CAPTION_MODES).id;
  state.stars = 3 + Math.floor(Math.random() * 3);
  const order = state.photos.map((_, i) => i).sort(() => Math.random() - 0.5);
  state.panels.forEach((p, i) => {
    p.photo = order[i % order.length];
    p.zoom = 1 + Math.random() * 0.6;
    p.ox = (Math.random() - 0.5) * 0.2;
    p.oy = (Math.random() - 0.5) * 0.2;
  });
  syncInputs();
  commit();
  statusEl.textContent = 'Surprise! A new cover, ready to export.';
});

document.getElementById('exportBtn').addEventListener('click', () => exportSize(state.size));
document.getElementById('exportAllBtn').addEventListener('click', async () => {
  for (const s of SIZES) {
    await exportSize(s.id);
    await new Promise((r) => setTimeout(r, 350));
  }
  statusEl.textContent = 'Saved all 3 sizes.';
});

// --- Panel picking and dragging ------------------------------------------

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}
function panelAt(px, py) {
  const { rects, count } = layoutPanels(state, canvas.width, canvas.height);
  for (let i = count - 1; i >= 0; i--) {
    const r = rects[i];
    if (r.hidden) continue;
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y);
  if (hit < 0) return;
  state.selected = hit;
  buildLibrary();
  syncPanelLabel();
  redraw();
  drag = { x: p.x, y: p.y, moved: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = (p.x - drag.x) / canvas.width;
  const dy = (p.y - drag.y) / canvas.height;
  if (Math.abs(dx) + Math.abs(dy) > 0.002) drag.moved = true;
  const slot = panelSlot();
  slot.ox += dx;
  slot.oy += dy;
  drag.x = p.x;
  drag.y = p.y;
  redraw();
});
canvas.addEventListener('pointerup', () => {
  if (drag?.moved) commit();
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = panelSlot();
  slot.zoom = Math.max(1, Math.min(2.5, slot.zoom - Math.sign(e.deltaY) * 0.08));
  document.getElementById('zoomRange').value = String(slot.zoom);
  redraw();
}, { passive: false });

// --- Boot -----------------------------------------------------------------

const query = new URLSearchParams(location.search);
const shot = query.get('shot');
async function boot() {
  try {
    await Promise.all([
      document.fonts.load('40px Anton'),
      document.fonts.load('40px Pacifico'),
      document.fonts.ready,
    ]);
  } catch { /* fall back to system fonts */ }
  await loadLibrary();
  if (shot) {
    await runShot(shot, query, {
      get state() { return state; },
      setState(next) { state = next; },
      commit, syncInputs, redraw, loadImage,
    });
  } else {
    syncInputs();
    redraw();
  }
}
boot();
