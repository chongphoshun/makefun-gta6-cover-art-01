// The studio's state: sizes, layouts, grades, titles, and undo history.
// Layouts are functions of (W, H) returning panel rectangles in pixels plus a
// title zone; every panel rect is {x, y, w, h, rot} in canvas pixels.

export const SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

export const GRADES = [
  {
    id: 'sunset', name: 'Vice Sunset',
    swatch: 'linear-gradient(135deg,#ffb347,#ff2e88)',
    wash: 'rgba(255,120,60,0.22)', sky: ['rgba(255,154,61,0.55)', 'rgba(255,154,61,0)'],
    ground: ['rgba(255,46,136,0)', 'rgba(255,46,136,0.5)'],
    deep: 'rgba(74,16,64,0.20)', glow: 'rgba(255,210,122,0.16)', ink: '#2a0a2e',
  },
  {
    id: 'neon', name: 'Neon Nights',
    swatch: 'linear-gradient(135deg,#19e3c2,#ff2e88)',
    wash: 'rgba(255,46,136,0.20)', sky: ['rgba(25,227,194,0.5)', 'rgba(25,227,194,0)'],
    ground: ['rgba(255,46,136,0)', 'rgba(255,46,136,0.55)'],
    deep: 'rgba(10,16,48,0.22)', glow: 'rgba(255,122,217,0.14)', ink: '#0d0a2e',
  },
  {
    id: 'hotpink', name: 'Hot Pink',
    swatch: 'linear-gradient(135deg,#ff5da2,#b3006b)',
    wash: 'rgba(255,0,120,0.24)', sky: ['rgba(255,93,162,0.55)', 'rgba(255,93,162,0)'],
    ground: ['rgba(179,0,107,0)', 'rgba(179,0,107,0.55)'],
    deep: 'rgba(51,0,31,0.22)', glow: 'rgba(255,158,207,0.16)', ink: '#33001f',
  },
  {
    id: 'teal', name: 'Teal Haze',
    swatch: 'linear-gradient(135deg,#19e3c2,#0b6b5e)',
    wash: 'rgba(25,227,194,0.18)', sky: ['rgba(25,227,194,0.5)', 'rgba(25,227,194,0)'],
    ground: ['rgba(11,107,94,0)', 'rgba(11,107,94,0.55)'],
    deep: 'rgba(6,42,51,0.22)', glow: 'rgba(184,255,241,0.14)', ink: '#062a33',
  },
  {
    id: 'gold', name: 'Golden Hour',
    swatch: 'linear-gradient(135deg,#ffe9a8,#ff7a1a)',
    wash: 'rgba(255,180,60,0.22)', sky: ['rgba(255,196,107,0.55)', 'rgba(255,196,107,0)'],
    ground: ['rgba(255,122,26,0)', 'rgba(255,122,26,0.5)'],
    deep: 'rgba(74,36,8,0.20)', glow: 'rgba(255,233,168,0.18)', ink: '#3a1c05',
  },
];

const GAP = 0.012; // panel gap, fraction of the shorter side

function artArea(W, H) {
  // Panels live in the top ~76%; the title band owns the bottom ~24%,
  // except full-bleed / key-art layouts, which draw the title over the art.
  return { x: 0, y: 0, w: W, h: H * 0.76 };
}
function titleBand(W, H) {
  return { x: 0, y: H * 0.76, w: W, h: H * 0.24 };
}

export const LAYOUTS = [
  {
    id: 'hero3', name: 'Hero + 3', panels: 4,
    rects(W, H) {
      const a = artArea(W, H); const g = Math.min(W, H) * GAP;
      const third = (a.w - 2 * g) / 3; const topH = a.h * 0.58; const botH = a.h - topH - g;
      return [
        { x: a.x, y: a.y, w: a.w, h: topH, rot: 0 },
        { x: a.x, y: a.y + topH + g, w: third, h: botH, rot: 0 },
        { x: a.x + third + g, y: a.y + topH + g, w: third, h: botH, rot: 0 },
        { x: a.x + 2 * (third + g), y: a.y + topH + g, w: third, h: botH, rot: 0 },
      ];
    },
    title: (W, H) => titleBand(W, H),
  },
  {
    id: 'grid4', name: 'Four Panel', panels: 4,
    rects(W, H) {
      const a = artArea(W, H); const g = Math.min(W, H) * GAP;
      const cw = (a.w - g) / 2; const ch = (a.h - g) / 2;
      return [
        { x: a.x, y: a.y, w: cw, h: ch, rot: 0 },
        { x: a.x + cw + g, y: a.y, w: cw, h: ch, rot: 0 },
        { x: a.x, y: a.y + ch + g, w: cw, h: ch, rot: 0 },
        { x: a.x + cw + g, y: a.y + ch + g, w: cw, h: ch, rot: 0 },
      ];
    },
    title: (W, H) => titleBand(W, H),
  },
  {
    id: 'grid9', name: 'Nine Panel', panels: 9,
    rects(W, H) {
      const a = artArea(W, H); const g = Math.min(W, H) * GAP;
      const cw = (a.w - 2 * g) / 3; const ch = (a.h - 2 * g) / 3;
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        out.push({ x: a.x + c * (cw + g), y: a.y + r * (ch + g), w: cw, h: ch, rot: 0 });
      }
      return out;
    },
    title: (W, H) => titleBand(W, H),
  },
  {
    id: 'tilt', name: 'Tilted Snapshots', panels: 3,
    rects(W, H) {
      const a = artArea(W, H); const g = Math.min(W, H) * GAP;
      const cw = (a.w - 2 * g) / 3; const ch = a.h * 0.92;
      return [
        { x: a.x, y: a.y + a.h * 0.04, w: cw, h: ch, rot: -0.07 },
        { x: a.x + cw + g, y: a.y, w: cw, h: ch, rot: 0.02 },
        { x: a.x + 2 * (cw + g), y: a.y + a.h * 0.04, w: cw, h: ch, rot: 0.06 },
      ];
    },
    title: (W, H) => titleBand(W, H),
  },
  {
    id: 'slash', name: 'Key Art Slash', panels: 3,
    rects(W, H) {
      const a = artArea(W, H); const g = Math.min(W, H) * GAP;
      const cw = (a.w - 2 * g) / 3;
      // Diagonal cuts: each panel is a parallelogram leaning right.
      const lean = a.h * 0.16;
      return [
        { x: a.x, y: a.y, w: cw + lean, h: a.h, rot: 0, slant: lean },
        { x: a.x + cw + g, y: a.y, w: cw + lean, h: a.h, rot: 0, slant: lean },
        { x: a.x + 2 * (cw + g), y: a.y, w: cw + lean, h: a.h, rot: 0, slant: lean },
      ];
    },
    title: (W, H) => titleBand(W, H),
  },
  {
    id: 'fullbleed', name: 'Full Bleed', panels: 1,
    rects(W, H) { return [{ x: 0, y: 0, w: W, h: H, rot: 0 }]; },
    title: (W, H) => ({ x: 0, y: H * 0.72, w: W, h: H * 0.28, overArt: true }),
  },
  {
    id: 'keyart', name: 'Key Art', panels: 1,
    rects(W, H) { return [{ x: 0, y: 0, w: W, h: H, rot: 0 }]; },
    title: (W, H) => ({ x: 0, y: H * 0.34, w: W, h: H * 0.32, overArt: true, band: true }),
  },
  {
    id: 'story', name: 'Story Stack', panels: 3,
    rects(W, H) {
      const a = artArea(W, H); const g = Math.min(W, H) * GAP;
      const half = (a.w - g) / 2; const topH = a.h * 0.5; const botH = a.h - topH - g;
      return [
        { x: a.x, y: a.y, w: a.w, h: topH, rot: 0 },
        { x: a.x, y: a.y + topH + g, w: half, h: botH, rot: 0 },
        { x: a.x + half + g, y: a.y + topH + g, w: half, h: botH, rot: 0 },
      ];
    },
    title: (W, H) => titleBand(W, H),
  },
];

export const TITLES = [
  'NEON SHORE', 'NIGHT SHIFT', 'PIER PRESSURE', 'BOULEVARD QUEEN', 'SUNSET HEIST',
  'VICE HEAT', 'GOLDEN HOUR', 'PALM SHADOWS', 'HEATWAVE NIGHTS', 'DOWNTOWN VICE',
  'LAST JOB', 'OCEAN DRIVE',
];
export const SUBTITLES = [
  'Neon Shore Nights', 'One last job under the palms', 'Golden hour getaway',
  'The city never sleeps', 'Chasing the sunset', 'Palms, neon and trouble',
  'Every sunset has a price', 'Heat rises after dark',
];

export const LIBRARY = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Rooftop', src: 'samples/rooftop.jpg' },
  { name: 'Neon Street', src: 'samples/neon.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
];

export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    size: 'square',
    title: 'VICE HEAT',
    subtitle: 'Neon Shore Nights',
    quote: 'One last job under the palms.',
    grain: true,
    vignette: true,
    palms: true,
    badge: true,
    stars: 4,
    selected: 0,
    photos: LIBRARY.map((p) => ({ name: p.name, src: p.src, img: null, objectUrl: null })),
    // Nine panel slots; each layout uses the first N. photo = index into photos.
    panels: Array.from({ length: 9 }, (_, i) => ({ photo: i % 4, zoom: 1, ox: 0, oy: 0 })),
  };
}

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}
export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}
export function sizeById(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

/** Small undo/redo history over JSON snapshots of the state. */
export class History {
  constructor(limit = 60) {
    this.limit = limit;
    this.stack = [];
    this.index = -1;
  }
  push(state) {
    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(JSON.stringify(state));
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }
  undo() {
    if (this.index <= 0) return null;
    this.index -= 1;
    return JSON.parse(this.stack[this.index]);
  }
  redo() {
    if (this.index >= this.stack.length - 1) return null;
    this.index += 1;
    return JSON.parse(this.stack[this.index]);
  }
  get canUndo() { return this.index > 0; }
  get canRedo() { return this.index < this.stack.length - 1; }
}
