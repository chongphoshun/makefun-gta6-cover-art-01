// Minimal CDP driver: screenshot the 4 shots.json scenes + verify PNG export.
// Usage: node shots-v3.mjs  (server must be running on :8080)
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const CHROME = process.env.HOME + '/workspace/x-session/chrome-extracted/opt/google/chrome/chrome';
const PORT = 9333;
const SHOTS = JSON.parse(readFileSync('/home/hatch/workspace/makefun/entry-gta6-cover-art-01/shots.json', 'utf8'));
const OUT = '/home/hatch/workspace/makefun/entry-gta6-cover-art-01/screenshots';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return res.json();
}
async function send(ws, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === id) { ws.removeEventListener('message', onMsg); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  `--remote-debugging-port=${PORT}`, '--user-data-dir=/tmp/chrome-cdp-v3', '--window-size=1280,720', 'about:blank'],
  { stdio: 'ignore' });
try {
  let target = null;
  for (let i = 0; i < 30 && !target; i++) {
    await sleep(500);
    try {
      const list = await getJson('/json/list');
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
  }
  if (!target) throw new Error('chrome did not come up');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, rej) => { ws.addEventListener('open', r); ws.addEventListener('error', rej); });
  let id = 0;
  await send(ws, ++id, 'Page.enable');
  await send(ws, ++id, 'Runtime.enable');
  await send(ws, ++id, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });

  for (const shot of SHOTS) {
    await send(ws, ++id, 'Emulation.setDeviceMetricsOverride', { width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false });
    await send(ws, ++id, 'Page.navigate', { url: `http://localhost:8080/${shot.query}` });
    // Wait for the shot to paint: poll window.__shotReady.
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      await sleep(250);
      const r = await send(ws, ++id, 'Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      ready = r.result?.value === true;
    }
    if (!ready) console.log(`WARN ${shot.name}: __shotReady never fired`);
    const shot2 = await send(ws, ++id, 'Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    writeFileSync(`${OUT}/${shot.name}`, Buffer.from(shot2.data, 'base64'));
    console.log(`wrote ${shot.name} (${shot.w}x${shot.h})`);
  }

  // PNG export check: open the editor, click Export PNG, confirm a file lands.
  await send(ws, ++id, 'Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await send(ws, ++id, 'Page.navigate', { url: 'http://localhost:8080/' });
  await sleep(3000);
  const dl = '/home/hatch/Downloads';
  mkdirSync(dl, { recursive: true });
  const before = new Set(readdirSync(dl));
  await send(ws, ++id, 'Page.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  const ev = await send(ws, ++id, 'Runtime.evaluate', { expression: `document.getElementById('exportBtn').click(); 'clicked'`, returnByValue: true });
  console.log('export click:', ev.result?.value);
  let got = null;
  for (let i = 0; i < 20 && !got; i++) {
    await sleep(500);
    got = readdirSync(dl).find((f) => !before.has(f) && f.startsWith('vice-heat-') && f.endsWith('.png'));
  }
  console.log(got ? `PNG EXPORT OK: ${got}` : 'PNG EXPORT: no file appeared');
  ws.close();
} finally {
  chrome.kill();
}
