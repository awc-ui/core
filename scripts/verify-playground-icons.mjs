#!/usr/bin/env node
// Pixel equivalence of the actual WOFF2 artifacts; no app/Core build needed.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv.find(arg => arg.startsWith('--artifacts='))?.slice('--artifacts='.length);
const coverage = JSON.parse(await readFile(resolve(root, 'apps/shared/fonts/coverage.json'), 'utf8'));
const icons = Object.keys(coverage.icons);
const fonts = {
  '/original.woff2': await readFile(resolve(root, 'apps/test-html/node_modules/material-symbols/material-symbols-outlined.woff2')),
  '/subset.woff2': await readFile(resolve(root, 'apps/shared/fonts/material-symbols-outlined-subset.woff2')),
};
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Original;src:url('/original.woff2') format('woff2');font-weight:100 700}
@font-face{font-family:Subset;src:url('/subset.woff2') format('woff2');font-weight:100 700}
body{margin:0;background:white;color:black}
#grid{display:grid;grid-template-columns:repeat(22,52px);padding:8px;width:1144px}
.icon{display:flex;align-items:center;justify-content:center;height:52px;font-family:Original;font-size:40px;line-height:1;font-weight:400;font-feature-settings:'liga';white-space:nowrap}
</style><div id="grid">${icons.map(name => `<span class="icon" title="${name}">${name}</span>`).join('')}</div>`;
const server = createServer((request, response) => {
  if (fonts[request.url]) return response.writeHead(200, {'Content-Type': 'font/woff2'}).end(fonts[request.url]);
  if (request.url === '/') return response.writeHead(200, {'Content-Type': 'text/html'}).end(html);
  response.writeHead(404).end();
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await puppeteer.launch({headless: 'shell', args: ['--no-sandbox']});
  const page = await browser.newPage();
  await page.setViewport({width: 1160, height: 1020, deviceScaleFactor: 1});
  await page.goto(`http://127.0.0.1:${server.address().port}`, {waitUntil: 'networkidle0'});
  await page.evaluate(async () => {
    await Promise.all(['Original', 'Subset'].map(family => document.fonts.load(`40px ${family}`, 'menu_open')));
    await document.fonts.ready;
  });
  const locations = [
    {FILL: 0, GRAD: 0, opsz: 24, wght: 400},
    {FILL: 1, GRAD: 0, opsz: 24, wght: 400},
    {FILL: 0, GRAD: -50, opsz: 20, wght: 100},
    {FILL: 1, GRAD: -50, opsz: 20, wght: 100},
    {FILL: 0, GRAD: 200, opsz: 48, wght: 700},
    {FILL: 1, GRAD: 200, opsz: 48, wght: 700},
  ];
  for (const [index, location] of locations.entries()) {
    const snapshots = [];
    for (const family of ['Original', 'Subset']) {
      await page.evaluate(async ({family, location}) => {
        for (const element of document.querySelectorAll('.icon')) {
          element.style.fontFamily = family;
          element.style.fontVariationSettings = Object.entries(location).map(([axis, value]) => `"${axis}" ${value}`).join(',');
        }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!document.fonts.check(`40px ${family}`, 'menu_open')) throw new Error(`Font did not load: ${family}`);
      }, {family, location});
      const pixels = Buffer.from(await (await page.$('#grid')).screenshot());
      snapshots.push(pixels);
      if (output && index < 2) {
        await mkdir(resolve(output), {recursive: true});
        await writeFile(resolve(output, `${family.toLowerCase()}-fill-${location.FILL}.png`), pixels);
      }
    }
    assert(snapshots[0].equals(snapshots[1]), `Icon pixels differ at ${JSON.stringify(location)}`);
  }
  console.log(`PASS: ${icons.length} icons × ${locations.length} axis configurations have identical original/subset Chromium pixels`);
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
