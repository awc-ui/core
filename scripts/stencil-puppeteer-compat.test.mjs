import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const requireCore = createRequire(new URL('../packages/core/package.json', import.meta.url));
const testingSource = readFileSync(requireCore.resolve('@stencil/core/testing'), 'utf8');
const start = testingSource.indexOf('async function startPuppeteerBrowser(config) {');
const end = testingSource.indexOf('\nasync function connectBrowser()', start);
assert.ok(start >= 0 && end > start, 'Locate the installed Stencil browser startup function');

// Exercise the actual installed dependency's startup code with a fake browser.
// Isolating this internal function avoids launching Chromium or changing process.env.
async function startBrowser(puppeteer, env = {}) {
  const startPuppeteerBrowser = vm.runInNewContext(
    `(${testingSource.slice(start, end)})`,
    { process: { env }, import_major: { default: version => Number(version.split('.')[0]) } },
  );
  const config = {
    rootDir: '/test',
    flags: { e2e: true },
    testing: { browserHeadless: 'shell', browserChannel: 'chrome' },
    logger: { debug() {} },
    sys: {
      platformPath: path,
      readFileSync: () => JSON.stringify({ version: '25.11.0' }),
      lazyRequire: { getModulePath: () => '/test/puppeteer', require: () => puppeteer },
    },
  };
  return startPuppeteerBrowser(config);
}

const fakeBrowser = { wsEndpoint: () => 'ws://test-browser' };

test('Stencil awaits Puppeteer 25 executablePath before launching', async () => {
  let launches = 0;
  const browser = await startBrowser({
    executablePath: async () => '/test/chrome',
    launch: async options => {
      assert.equal(options.executablePath, '/test/chrome');
      assert.equal(options.headless, 'shell');
      launches++;
      return fakeBrowser;
    },
  });
  assert.equal(browser, fakeBrowser);
  assert.equal(launches, 1);
});

for (const [name, env, expected] of [
  ['PUPPETEER_EXECUTABLE_PATH takes precedence', {
    PUPPETEER_EXECUTABLE_PATH: '/test/explicit-chrome', CHROME_PATH: '/test/fallback-chrome',
  }, '/test/explicit-chrome'],
  ['CHROME_PATH is respected', { CHROME_PATH: '/test/fallback-chrome' }, '/test/fallback-chrome'],
]) {
  test(name, async () => {
    await startBrowser({
      executablePath: () => assert.fail('An explicit browser path must skip automatic resolution'),
      launch: async options => {
        assert.equal(options.executablePath, expected);
        return fakeBrowser;
      },
    }, env);
  });
}

test('Stencil awaits the channel fallback after executablePath rejects', async () => {
  const calls = [];
  await startBrowser({
    executablePath: async options => {
      calls.push(options);
      if (typeof options !== 'string') throw new Error('Use channel-based resolution');
      return '/test/channel-chrome';
    },
    launch: async options => {
      assert.equal(options.executablePath, '/test/channel-chrome');
      return fakeBrowser;
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], 'chrome');
});
