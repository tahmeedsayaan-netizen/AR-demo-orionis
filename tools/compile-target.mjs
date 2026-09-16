// Compile public/targets/orionis-marker.png into a MindAR .mind tracking file,
// using MindAR's browser compiler inside headless Chrome.
import puppeteer from 'puppeteer';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = { '.js': 'text/javascript', '.png': 'image/png', '.html': 'text/html' };
const page = `<!doctype html><script type="module">
  import { Compiler } from '/node_modules/mind-ar/dist/mindar-image.prod.js';
  window.compile = async () => {
    const img = new Image();
    img.src = '/public/targets/orionis-marker.png';
    await img.decode();
    const compiler = new Compiler();
    await compiler.compileImageTargets([img], (p) => console.log('progress ' + p.toFixed(0) + '%'));
    const buf = await compiler.exportData();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  window.ready = true;
</script>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') return res.end(page);
  const file = join(root, url);
  if (!existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const tab = await browser.newPage();
let last = '';
tab.on('console', (m) => { const t = m.text(); if (t !== last) { last = t; if (/progress (\d*[05])%/.test(t) || !t.startsWith('progress')) console.log(t); } });
await tab.goto(`http://localhost:${port}/`);
await tab.waitForFunction('window.ready === true', { timeout: 60000 });
const b64 = await tab.evaluate(() => window.compile(), { timeout: 0 });
writeFileSync(join(root, 'public/targets/orionis.mind'), Buffer.from(b64, 'base64'));
console.log('wrote public/targets/orionis.mind', Buffer.from(b64, 'base64').length, 'bytes');
await browser.close();
server.close();
