import assert from 'node:assert/strict';
import test from 'node:test';

for (const showcase of ['banking', 'social', 'wealth']) {
  const { enhanceShell } = await import(`../../apps/showcase/${showcase}/html/src/client/shell.mjs`);
  test(`${showcase} FAB only navigates to HTTP(S) URLs on its own origin`, () => {
    const assigned = [];
    let href;
    let click;
    const attributes = new Set();
    const fab = {
      hasAttribute: (name) => attributes.has(name),
      setAttribute: (name) => attributes.add(name),
      getAttribute: () => href,
      addEventListener: (event, handler) => { assert.equal(event, 'mdClick'); click = handler; },
    };
    const root = { querySelector: (selector) => selector === 'md-fab[data-fab-href]' ? fab : null };
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: { href: 'https://example.test/showcase/en/', origin: 'https://example.test', assign: (url) => assigned.push(url) },
    };
    try {
      enhanceShell(root);
      for (const unsafe of ['javascript:alert(1)', 'jAvAsCrIpT:alert(1)', '\njava\tscript:alert(1)', 'data:text/html,test', '//evil.test/path', 'https://example.test.evil.test/', 'https://example.test@evil.test/', 'http://example.test/', 'https://[', '', null]) {
        href = unsafe;
        click();
      }
      assert.deepEqual(assigned, []);
      href = '/showcase/en/create/';
      click();
      href = '../fr/create/';
      click();
      assert.deepEqual(assigned, ['https://example.test/showcase/en/create/', 'https://example.test/showcase/fr/create/']);
      enhanceShell(root);
      assert.equal(attributes.size, 1);
    } finally {
      if (originalWindow === undefined) delete globalThis.window;
      else globalThis.window = originalWindow;
    }
  });
}

// Run the real route functions with lightweight view/DOM stubs so hash input
// exercises selection without starting the apps' browser bootstrapping.
async function loadRouteFunction(app, name, globals) {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL(`../../apps/${app}/src/app.js`, import.meta.url), 'utf8');
  const start = source.indexOf(`async function ${name}(`);
  assert.ok(start >= 0);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start);
  return runInNewContext(`(${source.slice(start, end + 2)})`, globals);
}

const maliciousRoutes = ['constructor', '__proto__', 'toString', 'missing'];

test('pharma hash routes select only the authored views', async () => {
  const main = {};
  const routes = ['overview', 'runs', 'compounds', 'samples', 'reviews', 'team'];
  const globals = {
    session: {}, navigationVersion: 0, route: '', state: {}, filters: {},
    destinations: routes.map((route) => [route]), requestedRoute: () => '',
    history: { replaceState() {} }, updateNavigation() {},
    document: { getElementById: () => main }, readyTree() {}, wireView() {},
    views: { hydrateView() {} },
  };
  for (const route of routes) {
    globals.views[`render${route[0].toUpperCase()}${route.slice(1)}`] = () => route;
  }
  const render = await loadRouteFunction('pharma', 'renderRoute', globals);
  for (const route of [...routes, ...maliciousRoutes]) {
    globals.requestedRoute = () => route;
    await render();
    assert.equal(main.innerHTML, routes.includes(route) ? route : 'overview');
  }
});

test('smart-home hash routes select only the authored views', async () => {
  const elements = { '#main': {}, '#nav': {}, '#mobile-nav': {} };
  const routes = ['home', 'rooms', 'scenes', 'energy', 'routines'];
  const globals = {
    epoch: 0, state: {}, location: { hash: '' }, nav: routes.map((route) => [route]),
    $: (selector) => elements[selector], chart() {},
    home: () => 'home', roomView: () => 'rooms', scenesView: () => 'scenes',
    energyView: () => 'energy', routineView: () => 'routines',
  };
  const render = await loadRouteFunction('smart-home', 'render', globals);
  for (const route of [...routes, ...maliciousRoutes]) {
    globals.location.hash = `#/${route}`;
    await render();
    assert.equal(elements['#main'].innerHTML, routes.includes(route) ? route : 'home');
  }
});

test('scada hash routes select only the authored views', async () => {
  const main = { setAttribute() {}, removeAttribute() {}, isConnected: true };
  const routes = ['overview', 'assets', 'alarms', 'trends', 'settings'];
  const globals = {
    renderEpoch: 0, state: {}, location: { hash: '' }, navItems: routes.map((route) => [route]),
    $: (selector) => selector === '#main' ? main : null, $$: () => [],
    shell() {}, skeletonView: () => '', localize() {}, demoWait() {}, appearance: { language: 'en' },
    overview: () => 'overview', heading: () => 'assets', btn: () => '', assetTable: () => '', footer: () => '',
    alarmsView: () => 'alarms', trendsView: () => 'trends', settingsView: () => 'settings',
    renderRows() {}, wireMain() {}, charts() {}, updateSampleTime() {},
  };
  const render = await loadRouteFunction('scada', 'render', globals);
  for (const route of [...routes, ...maliciousRoutes]) {
    globals.location.hash = `#/${route}`;
    await render();
    assert.equal(main.innerHTML, routes.includes(route) ? route : 'overview');
  }
});

test('booking date-field values cannot introduce markup or attributes into travel dialogs', async () => {
  const { escape } = await import('../../apps/booking/src/views.js');
  const { parseFragment } = await import('parse5');
  let body;
  const search = { checkIn: '', checkOut: '' };
  const globals = {
    dialogContext: null, searchFields: () => search, views: { escape },
    guestFields: () => '', closeAction: () => '',
    openDialog: (_title, markup) => { body = markup; },
  };
  const openTravel = await loadRouteFunction('booking', 'openTravel', globals);
  for (const value of ['2026-09-16', '2026-09-16"><img src=x onerror=alert(1)>', '" onfocus="alert(1)', '&quot;><script>alert(1)</script>']) {
    search.checkIn = value;
    search.checkOut = value;
    await openTravel(true);
    const nodes = [];
    const visit = (node) => {
      if (node.tagName) nodes.push(node);
      node.childNodes?.forEach(visit);
    };
    visit(parseFragment(body));
    assert.deepEqual(nodes.map((node) => node.tagName), ['p', 'div', 'md-date-picker', 'md-date-picker']);
    const pickers = nodes.filter((node) => node.tagName === 'md-date-picker');
    const attr = (node, name) => node.attrs.find((attribute) => attribute.name === name)?.value;
    assert.equal(attr(pickers[0], 'value'), value);
    assert.equal(attr(pickers[1], 'min'), value);
    assert.equal(attr(pickers[1], 'value'), value);
    assert.ok(nodes.every((node) => node.attrs.every((attribute) => !attribute.name.startsWith('on'))));
  }
});
