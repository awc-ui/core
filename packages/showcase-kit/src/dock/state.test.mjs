import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFrameworkUrl, buildLocaleUrl, DEFAULT_STATE, splitLocalePath } from '../../dist/dock/index.mjs';

test('framework switching trims trailing slashes while preserving state and inner path segments', () => {
  const url = new URL(buildFrameworkUrl('vue', {
    current: 'react',
    pathname: '/',
    basePath: '/showcase//design///',
    origin: 'https://example.com',
    state: { ...DEFAULT_STATE, locale: 'ro' },
  }));
  assert.equal(url.pathname, '/showcase//design/vue/');
  assert.equal(url.searchParams.get('lang'), 'ro');
});

test('locale routes normalize trailing slashes and preserve query, hash and the screen', () => {
  const options = { appBase: '/showcase/design/astro///' };
  assert.deepEqual(splitLocalePath('/showcase/design/astro/ro/project', options), {
    locale: 'ro', rest: '/project',
  });
  const href = 'https://example.com/showcase/design/astro/ro/project?theme=dark#layers';
  assert.equal(buildLocaleUrl('en', { ...options, href }),
    'https://example.com/showcase/design/astro/project?theme=dark#layers');
  assert.equal(buildLocaleUrl('ar', { ...options, href }),
    'https://example.com/showcase/design/astro/ar/project?theme=dark#layers');
});

test('routing handles root bases and long nontrailing slash runs', () => {
  assert.deepEqual(splitLocalePath('/ro/project', { appBase: '///' }), { locale: 'ro', rest: '/project' });
  const base = `/showcase/${'/'.repeat(100000)}design`;
  assert.deepEqual(splitLocalePath(`${base}/ro/project`, { appBase: `${base}///` }), {
    locale: 'ro', rest: '/project',
  });
  const url = new URL(buildFrameworkUrl('vue', {
    current: 'react', pathname: '/', basePath: base, origin: 'https://example.com', state: DEFAULT_STATE,
  }));
  assert.equal(url.pathname, `${base}/vue/`);
  assert.equal(buildLocaleUrl('ro', { appBase: base, href: `https://example.com${base}/project` }),
    `https://example.com${base}/ro/project`);
});
