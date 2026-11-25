import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const types = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
};

function collectFontText() {
  const names = new Set();
  const add = (text, family) => {
    if (text && family.includes('Material Symbols Outlined')) names.add(text);
  };
  const visit = root => {
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visit(element.shadowRoot);
      const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent).join('').trim();
      if (text) add(text, getComputedStyle(element).fontFamily);
      for (const selector of ['::before', '::after']) {
        const { content, fontFamily } = getComputedStyle(element, selector);
        if (content.startsWith('"') && content.endsWith('"')) add(content.slice(1, -1), fontFamily);
      }
    }
  };
  visit(document);
  return [...names].sort();
}

async function waitForIcon(page, host, selector, icon) {
  await page.waitForFunction((host, selector, icon) =>
    document.querySelector(host)?.shadowRoot?.querySelector(selector)?.textContent.trim() === icon,
  { timeout: 5_000 }, host, selector, icon);
}

async function exerciseCatalogIcons(page, check) {
  const field = 'md-text-field';
  const switchGlyph = '.md-switch__icon';
  const passwordGlyph = '.md-text-field__password-toggle .material-symbols-outlined';
  const picker = 'md-date-picker';

  await page.evaluate(() => {
    const field = document.querySelector('md-text-field');
    Object.assign(field, { type: 'password', passwordToggle: 'internal', clearable: 'internal', value: 'demo' });
    Object.assign(document.querySelector('md-switch'), { icons: true, selected: false });
    document.querySelector('md-navigation-rail').expandable = true;
  });
  await waitForIcon(page, field, passwordGlyph, 'visibility');
  await waitForIcon(page, 'md-switch', switchGlyph, 'close');
  await page.waitForFunction(() => document.querySelector('md-navigation-rail').shadowRoot
    .querySelector('[part="toggle"] md-icon-button')?.shadowRoot
    ?.querySelector('.material-symbols-outlined')?.textContent.trim() === 'menu');
  await check(['cancel', 'visibility', 'close', 'menu']);

  await page.evaluate(async () => {
    document.querySelector('md-text-field').shadowRoot.querySelector('.md-text-field__password-toggle').click();
    document.querySelector('md-switch').selected = true;
    await document.querySelector('md-navigation-rail').expand();
    const picker = document.querySelector('md-date-picker');
    picker.variant = 'modal';
    await picker.show();
  });
  await waitForIcon(page, field, passwordGlyph, 'visibility_off');
  await waitForIcon(page, 'md-switch', switchGlyph, 'check');
  await page.waitForFunction(() => document.querySelector('md-navigation-rail').shadowRoot
    .querySelector('[part="toggle"] md-icon-button')?.shadowRoot
    ?.querySelector('.material-symbols-outlined')?.textContent.trim() === 'menu_open');
  const modeGlyph = '[part="mode-toggle"]';
  await page.waitForFunction((picker, part) => document.querySelector(picker).shadowRoot.querySelector(part)
    ?.shadowRoot?.querySelector('.material-symbols-outlined')?.textContent.trim() === 'edit', {}, picker, modeGlyph);
  await check(['visibility_off', 'check', 'menu_open', 'edit', 'chevron_left', 'chevron_right']);

  await page.evaluate((picker, part) => document.querySelector(picker).shadowRoot.querySelector(part).click(),
    picker, modeGlyph);
  await page.waitForFunction((picker, part) => document.querySelector(picker).shadowRoot.querySelector(part)
    ?.shadowRoot?.querySelector('.material-symbols-outlined')?.textContent.trim() === 'calendar_today', {}, picker, modeGlyph);
  await check(['calendar_today']);
}

export async function verifyCatalogIconCoverage(browser, root, coverage) {
  const known = new Set([...Object.keys(coverage.icons), ...coverage.codepoints.map(code =>
    String.fromCodePoint(Number.parseInt(code.slice(2), 16)))]);
  for (const framework of ['html', 'react', 'vue', 'svelte', 'angular']) {
    const directory = resolve(root, `apps/test-${framework}/dist`, framework === 'angular' ? 'test-angular' : '');
    await readFile(resolve(directory, 'index.html'));
    const server = createServer(async (request, response) => {
      try {
        const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (path === '/favicon.ico') return response.writeHead(204).end();
        const file = resolve(directory, path === '/' ? 'index.html' : `.${path}`);
        if (!file.startsWith(`${directory}${sep}`)) return response.writeHead(404).end();
        const body = await readFile(file);
        response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    const page = await browser.newPage();
    try {
      const origin = `http://127.0.0.1:${server.address().port}`;
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (new URL(request.url()).origin === origin) return request.continue();
        return request.respond({ status: 200, contentType: 'text/css', body: '' });
      });
      const fontResponse = page.waitForResponse(response => response.ok() &&
        /material-symbols-outlined-subset[^/]*\.woff2$/.test(response.url()));
      const [font] = await Promise.all([fontResponse, page.goto(origin, { waitUntil: 'domcontentloaded' })]);
      const hash = createHash('sha256').update(await font.buffer()).digest('hex');
      assert.equal(hash, coverage.subsetSha256, `${framework}: rebuild with the generated icon font`);
      await page.waitForFunction(() => {
        const visit = root => [...root.querySelectorAll('*')].every(element =>
          (!element.localName.startsWith('md-') || element.classList.contains('hydrated')) &&
          (!element.shadowRoot || visit(element.shadowRoot)));
        return document.querySelector('md-date-picker') && visit(document);
      });
      const observed = new Set();
      const check = async required => {
        await page.evaluate(async () => { await document.fonts.ready; });
        const text = await page.evaluate(collectFontText);
        assert.deepEqual(text.filter(name => !known.has(name)), [], `${framework}: missing outlined ligatures`);
        assert.deepEqual(required.filter(name => !text.includes(name)), [], `${framework}: expected rendered outlined ligatures`);
        for (const name of text) observed.add(name);
      };
      const initial = ['add', 'favorite', 'calendar_today'];
      if (framework === 'angular') initial.push('star');
      await check(initial);
      await exerciseCatalogIcons(page, check);
      console.log(`PASS ${framework}: ${observed.size} rendered icon names covered through catalog interactions`);
    } finally {
      await page.close();
      server.closeAllConnections();
      await new Promise(done => server.close(done));
    }
  }
}
