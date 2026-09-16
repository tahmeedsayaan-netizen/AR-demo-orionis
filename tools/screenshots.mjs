// Visual check of the desktop preview: captures the intro beats and every interaction.
// Usage: start `NO_SSL=1 npx vite --port 5174` then `node tools/screenshots.mjs [baseUrl] [outDir]`
import puppeteer from 'puppeteer';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const base = process.argv[2] || 'http://localhost:5174/';
const out = process.argv[3] || 'shots';
const only = process.argv[4]; // optional: "intro" | "interact"
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'],
  protocolTimeout: 600000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
const errors = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('shot', name);
};
// wait using the app's own clock so slow software rendering doesn't skew timings
const waitStage = async (seconds) => {
  const start = await page.evaluate(() => window.__orionis.stage.time);
  await page.waitForFunction((s, d) => window.__orionis.stage.time >= s + d, { timeout: 600000, polling: 200 }, start, seconds);
};
const act = (fn, ...args) => page.evaluate(fn, ...args);

await page.goto(base + '?preview&autostart', { waitUntil: 'load' });
await page.waitForFunction(() => window.__orionis?.director?.state && window.__orionis.director.state !== 'waiting', { timeout: 180000 });
console.log('started');

if (only !== 'interact') {
  for (const [name, t] of [['01-ring', 0.5], ['02-tabs-cards', 1.0], ['03-hatch-open', 0.7], ['04-rising', 0.7], ['05-presenter', 1.5], ['06-talking', 6]]) {
    await waitStage(t);
    await shot(name);
  }
  // jump near the end of the talk
  await act(() => { const v = window.__orionis.voice; v.audio.currentTime = v.duration - 3; });
  await waitStage(3.2);
  await shot('07-outro-wave');
  await page.waitForFunction(() => window.__orionis.director.state === 'idle', { timeout: 120000, polling: 250 });
  await waitStage(0.8);
  await shot('08-idle');
} else {
  await act(() => window.__orionis.director.skip());
  await page.waitForFunction(() => window.__orionis.director.state === 'idle', { timeout: 120000, polling: 250 });
  await waitStage(1);
}

// interactions
const idle = () => page.waitForFunction(() => window.__orionis.director.state === 'idle' && !window.__orionis.director.busy, { timeout: 120000, polling: 250 });

await act(() => window.__orionis.director.openCase(1));
await waitStage(1.2);
await shot('09-case-panel');
await act(() => window.__orionis.director.back());
await idle();

for (let i = 0; i < 6; i++) {
  await act((k) => window.__orionis.director.openService(k), i);
  await waitStage(1.8);
  await shot(`10-service-${i}`);
  // tap the hologram the way a finger would: call the first tappable object's handler
  await act(() => {
    const d = window.__orionis.director;
    const holo = d.stage.holos[d.content.services[d.current.i].id];
    let target = null;
    holo.group.traverse((o) => { if (!target && o.userData.onTap) target = o; });
    target.userData.onTap({ object: target });
  });
  await waitStage(1.2);
  await shot(`11-service-${i}-tapped`);
  await act(() => window.__orionis.director.back());
  await idle();
}

await act(() => window.__orionis.director.openCase(0));
await waitStage(1.2);
await act(() => window.__orionis.director.play());
await page.waitForFunction(() => window.__orionis.director.state === 'video' && !window.__orionis.director.busy, { timeout: 120000, polling: 250 });
await waitStage(1.5);
await shot('12-video');
await act(() => window.__orionis.director.closeVideo());
await idle();
await act(() => window.__orionis.director.summon());
await waitStage(2.2);
await shot('13-summon');

console.log('\n--- console errors/warnings ---\n' + (errors.join('\n') || 'none'));
await browser.close();
