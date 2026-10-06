import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

// Resolve through the Netlify tooling dependency chain, so this exercises the
// ipx sharp override rather than the separate sharp dependency used by Astro.
const require = createRequire(import.meta.url);
const fromCli = createRequire(require.resolve('netlify-cli/package.json'));
const imagesEntry = fromCli.resolve('@netlify/images');
const fromImages = createRequire(imagesEntry);
const ipxEntry = fromImages.resolve('ipx');
const fromIpx = createRequire(ipxEntry);
const { default: sharp } = await import(pathToFileURL(fromIpx.resolve('sharp')).href);
const { createIPX } = await import(pathToFileURL(ipxEntry).href);
const { ImageHandler } = await import(pathToFileURL(imagesEntry).href);

test('the installed SVG decoder includes the fixed librsvg release', async () => {
  const actual = sharp.versions.rsvg.split('.').map(Number);
  const minimum = [2, 63, 2];
  const firstDifference = minimum.findIndex((part, index) => actual[index] !== part);
  assert.ok(
    firstDifference === -1 || actual[firstDifference] > minimum[firstDifference],
    `librsvg ${sharp.versions.rsvg} predates the fix for GHSA-wq5f-xc86-pv6w`,
  );
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="red"/></svg>');
  const { info } = await sharp(svg).png().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 16);
  assert.equal(info.height, 12);
  assert.equal(info.format, 'png');
});

test('Netlify image transformations work with the patched sharp dependency', async (t) => {
  const pixels = Buffer.alloc(120 * 80 * 3);
  for (let y = 0; y < 80; y++) {
    for (let x = 0; x < 120; x++) {
      const offset = (y * 120 + x) * 3;
      pixels[offset] = x < 60 ? 220 : 20;
      pixels[offset + 1] = y < 40 ? 180 : 40;
      pixels[offset + 2] = 90;
    }
  }
  const source = await sharp(pixels, { raw: { width: 120, height: 80, channels: 3 } }).png().toBuffer();
  const ipx = createIPX({
    storage: {
      async getMeta(id) {
        return id === '/fixture.png' ? { mtime: new Date('2026-01-01') } : undefined;
      },
      async getData(id) {
        return id === '/fixture.png' ? source : undefined;
      },
    },
  });

  // These are the transformations exposed by @netlify/images. Generic ipx
  // modifiers that Netlify does not expose are deliberately outside this test.
  const cases = [
    ['width, WebP and quality', { width: '60', format: 'webp', quality: '75' }, 60, 40, 'webp'],
    ['height and JPEG', { height: '20', format: 'jpeg' }, 30, 20, 'jpeg'],
    ['cover crop, position and PNG', { resize: '40x40', fit: 'cover', position: 'right', format: 'png' }, 40, 40, 'png'],
    ['contain and AVIF', { resize: '40x40', fit: 'inside', format: 'avif' }, 40, 27, 'heif'],
    ['default PNG', {}, 120, 80, 'png'],
  ];

  for (const [name, modifiers, width, height, format] of cases) {
    await t.test(name, async () => {
      const output = await ipx('/fixture.png', modifiers).process();
      assert.ok(output.data.byteLength > 0);
      const metadata = await sharp(output.data).metadata();
      assert.equal(metadata.width, width);
      assert.equal(metadata.height, height);
      assert.equal(metadata.format, format);
    });
  }

  await t.test('missing source rejects', async () => {
    await assert.rejects(ipx('/missing.png').process(), /Resource not found/);
  });
});

test('Netlify maps its supported query parameters to the tested ipx modifiers', () => {
  const handler = new ImageHandler({ logger: { warn() {} } });
  const translated = handler.generateIPXRequestURL(
    new URL('https://example.test/fixture.png'),
    new URLSearchParams('w=40&h=40&q=75&fm=webp&fit=contain&position=right'),
  );
  assert.match(translated.pathname, /^\/resize_40x40,quality_75,format_webp,fit_inside,position_right\//);
});
