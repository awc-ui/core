import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAIInstructions } from './ai-instructions.mjs';
import { handleAIInstructionsRequest, resolveAsset } from './server.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nativeSection = markdown => markdown.slice(markdown.indexOf('## SwiftUI / iOS AI instructions'));

test('all 81 source components retain the original README and gain a verified typed SwiftUI guide', async () => {
  const catalog = JSON.parse(await readFile(path.join(repository, 'packages/native-compiler/generated/catalog.json'), 'utf8'));
  const source = await readFile(path.join(repository, 'packages/native-ios/Sources/AWCUI/Generated/Components.swift'), 'utf8');
  assert.equal(catalog.components.length, 81);
  for (const component of catalog.components) {
    const result = await getAIInstructions(repository, component.tag);
    const original = await readFile(path.join(repository, `packages/core/src/components/${component.tag}/readme.md`), 'utf8');
    assert.equal(result.filename, `${component.tag}.md`);
    assert.ok(result.markdown.startsWith(original + '\n\n---\n\n'), component.tag);
    const guide = nativeSection(result.markdown);
    const name = /Use the verified `(\w+)` view and `(\w+)` property struct/.exec(guide);
    assert.ok(name, component.tag);
    const block = source.slice(source.indexOf(`public struct ${name[1]}: View {`)).split(/\npublic (?:enum|struct)/)[0];
    assert.ok(block.includes(`AWCNativeView(tag: "${component.tag}"`), component.tag);
    assert.ok(block.includes(`public var properties: ${name[2]}`), component.tag);
    assert.ok(guide.includes(`@State private var properties = ${name[2]}()`), component.tag);
    assert.ok(guide.includes(`${name[1]}(\n`), component.tag);
    assert.match(guide, /import SwiftUI\nimport AWCUI/);
    assert.match(guide, /iOS 17\+ and macOS 14\+/);
    assert.match(guide, /not an iOS Simulator/);
    assert.match(guide, /Generated API coverage does not imply full behavioral parity/);
    assert.match(guide, /Native events/);
    assert.match(guide, /Children, named slots and methods/);
    assert.match(guide, /Native appearance and limitations/);
    assert.ok(result.sources.every(file => !path.isAbsolute(file) && !file.split('/').includes('..')));
    assert.ok(result.sources.includes('packages/native-ios/NativeSupport.json'));
    assert.ok(result.sources.includes('packages/native-ios/Sources/AWCUI/Generated/Components.swift'));
  }
});

test('native support is per property/event/slot and does not promote generated APIs into implemented behavior', async () => {
  const button = nativeSection((await getAIInstructions(repository, 'md-button')).markdown);
  assert.match(button, /\| `variant` \| `AWCButtonVariant` \| `'filled'` \| Supported by native adapter \|/);
  assert.match(button, /\| `mdChange` \| Supported \|/);
  assert.match(button, /Native mdChange is noncancelable/);
  assert.match(button, /properties: \.init\(toggle: true, selected: selected\)/);
  assert.match(button, /event.detail\["selected"\].bool/);
  assert.match(button, /AWCFormState \/ AWCFormScope/);
  const field = nativeSection((await getAIInstructions(repository, 'md-text-field')).markdown);
  assert.match(field, /\| `variant` \| `AWCTextFieldVariant` \| `'filled'` \| Unsupported \/ not listed in native policy \|/);
  assert.match(field, /\| `mdSpeechResult` \| Unsupported \/ not listed in native policy \|/);
  assert.match(field, /Unsupported source slots: .*`speech-icon`/);
  assert.match(field, /Unsupported source methods: .*`setFocus`/);
  const chart = nativeSection((await getAIInstructions(repository, 'md-bar-chart')).markdown);
  assert.match(chart, /\| `zoom` .* Unsupported \/ not listed in native policy \|/);
  assert.match(chart, /Stacking, polar, inverted\/horizontal layout, custom axes and zoom not implemented/);
  const row = nativeSection((await getAIInstructions(repository, 'md-table-row')).markdown);
  assert.match(row, /Composition context:.*`md-table`/);
});

async function fixture(t, { wrapper = true } = {}) {
  const base = await mkdtemp(path.join(tmpdir(), 'awc-ai-instructions-'));
  const root = path.join(base, 'repo');
  t.after(() => rm(base, { recursive: true, force: true }));
  const content = {
    'packages/core/src/components/md-button/readme.md': '# md-button\n\nOriginal web instructions.\n',
    'packages/native-compiler/generated/catalog.json': JSON.stringify({ components: [{ tag: 'md-button', properties: [], events: [], methods: [], slots: [] }] }),
    'packages/native-ios/NativeSupport.json': JSON.stringify({ components: { 'md-button': { properties: [], events: [], slots: [], methods: [] } } }),
    'packages/native-ios/Sources/AWCUI/Generated/Components.swift': wrapper ? `public struct AWCButtonProperties {\n    public init() {}\n}\npublic struct AWCButton: View {
    public var properties: AWCButtonProperties
    public init(properties: AWCButtonProperties = .init(), children: [AWCNode] = [], onEvent: @escaping (AWCEvent) -> Void = { _ in }) {}
    public var body: some View { AWCNativeView(tag: "md-button") }
}` : '// No generated wrapper.',
    'packages/native-ios/Package.swift': 'platforms: [.iOS(.v17), .macOS(.v14)]',
    'packages/native-ios/Sources/AWCUI/Models.swift': '// Native models',
    'packages/native-ios/Sources/AWCUI/AWCNativeView.swift': '// Native renderer',
    'packages/native-ios/Sources/AWCUI/Examples.swift': '// Native examples',
    'packages/native-ios/README.md': '# Native library',
    'packages/native-ios/NativeBehavior.md': '# Native behavior',
    'packages/native-ios/NativeFocus.md': '# Native focus',
  };
  for (const [relative, text] of Object.entries(content)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), text);
  }
  return { root, base };
}

test('missing typed wrappers use the existing dynamic snippet generator without inventing Swift symbols', async t => {
  const { root } = await fixture(t, { wrapper: false });
  const guide = nativeSection((await getAIInstructions(root, 'md-button')).markdown);
  assert.match(guide, /No matching generated typed wrapper/);
  assert.match(guide, /AWCNativeView\(\n\s+tag: "md-button"/);
  assert.doesNotMatch(guide, /AWCButton\(/);
});

test('invalid tags and unknown catalog entries never read arbitrary source paths', async t => {
  const { root } = await fixture(t);
  for (const tag of ['../md-button', 'md-button/../secret', 'md-button%2Fsecret', 'md-button\\secret', 'md-button\0', '__proto__', '', null, 'md-unknown']) {
    await assert.rejects(getAIInstructions(root, tag), error => error.status === 404 && error.code === 'UNKNOWN_COMPONENT', String(tag));
  }
});

test('README and metadata symlink escapes fail without returning external content', async t => {
  const { root, base } = await fixture(t);
  const outside = path.join(base, 'private.md');
  await writeFile(outside, 'PRIVATE_CONTENT_MUST_NOT_ESCAPE');
  const readme = path.join(root, 'packages/core/src/components/md-button/readme.md');
  await rm(readme); await symlink(outside, readme);
  await assert.rejects(getAIInstructions(root, 'md-button'), error => error.status === 503 && !error.message.includes('PRIVATE_CONTENT'));
  await rm(readme); await writeFile(readme, '# Restored README');
  const support = path.join(root, 'packages/native-ios/NativeSupport.json');
  await rm(support); await symlink(outside, support);
  await assert.rejects(getAIInstructions(root, 'md-button'), error => error.status === 503 && !error.message.includes(base));
});

test('API returns Markdown JSON, denies mutation/traversal and keeps internal modules private', async t => {
  const { root } = await fixture(t);
  const request = async (url, method = 'GET') => {
    const res = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end() { this.ended = true; } };
    const handled = await handleAIInstructionsRequest({ url, method }, res, { repoRoot: root, tags: async () => new Set(['md-button', 'md-missing']),
      json(output, status, value) { output.status = status; output.value = value; } });
    return { ...res, handled };
  };
  const result = await request('/api/ai-instructions/md-button?cache=1');
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.value).sort(), ['filename', 'markdown', 'sources']);
  assert.equal(result.value.filename, 'md-button.md');
  for (const url of ['/api/ai-instructions', '/api/ai-instructions/md-missing', '/api/ai-instructions/md-button/extra', '/api/ai-instructions/%2e%2e', '/api/ai-instructions/../md-button', '/api/ai-instructions/%zz', '/api/ai-instructions/md-button.md']) {
    assert.equal((await request(url)).status, 404, url);
  }
  const post = await request('/api/ai-instructions/md-button', 'POST');
  assert.equal(post.status, 405); assert.equal(post.headers.Allow, 'GET');
  assert.equal((await request('/another-route')).handled, false);
  await rm(path.join(root, 'packages/core/src/components/md-button/readme.md'));
  const missing = await request('/api/ai-instructions/md-button');
  assert.equal(missing.status, 503); assert.equal(missing.value.error, 'AI_INSTRUCTIONS_UNAVAILABLE');
  const appRoot = path.join(root, 'apps/native-playground'); await mkdir(appRoot, { recursive: true });
  for (const file of ['ai-instructions-ui.js', 'ai-instructions.mjs', 'ai-instructions.test.mjs']) await writeFile(path.join(appRoot, file), '');
  assert.equal(await resolveAsset('/ai-instructions-ui.js', { appRoot }), await realpath(path.join(appRoot, 'ai-instructions-ui.js')));
  assert.equal(await resolveAsset('/ai-instructions.mjs', { appRoot }), null);
  assert.equal(await resolveAsset('/ai-instructions.test.mjs', { appRoot }), null);
});
