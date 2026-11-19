// Fixed scenes for screenshots: ?shot=editor shows the page with a photo
// loaded; ?shot=cover shows the cover alone, edge to edge.
// Query params: layout, grade, photo (library index), title, subtitle,
// quote, source, tagline, captions, furniture, halftone, strength,
// contrast, saturation, grain, vignette, stars, palms, grain, badge (0/1).
// window.__shotReady is set once painted.
export async function runShot(shot, query, api) {
  const state = api.state;
  const pick = (key, fallback) => query.get(key) ?? fallback;

  state.layout = pick('layout', state.layout);
  state.grade = pick('grade', state.grade);
  state.title = pick('title', state.title);
  state.subtitle = pick('subtitle', state.subtitle);
  state.quote = pick('quote', state.quote);
  state.pressSource = pick('source', state.pressSource);
  state.tagline = pick('tagline', state.tagline);
  state.captions = pick('captions', state.captions);
  if (query.get('stars') !== null) state.stars = Number(query.get('stars'));
  for (const key of ['palms', 'grain', 'vignette', 'badge', 'furniture', 'halftone']) {
    if (query.get(key) !== null) state[key] = query.get(key) !== '0';
  }
  for (const key of ['strength', 'contrast', 'saturation', 'grainAmt', 'vignetteAmt']) {
    if (query.get(key) !== null) state[key] = Number(query.get(key));
  }
  // Photo: one library photo fills every panel, or panels cycle from it.
  if (query.get('photo') !== null) {
    const start = Number(query.get('photo')) || 0;
    const n = state.photos.length;
    state.panels.forEach((p, i) => { p.photo = (start + i) % n; p.zoom = 1; p.ox = 0; p.oy = 0; });
  }
  // A single-photo cover: every panel shows the same photo.
  if (query.get('single') !== null) {
    const idx = Number(query.get('single')) || 0;
    state.panels.forEach((p) => { p.photo = idx; p.zoom = 1; p.ox = 0; p.oy = 0; });
  }

  api.syncInputs();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('preview');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    api.redraw();
  } else {
    document.body.classList.add('shot-editor');
    api.redraw();
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
