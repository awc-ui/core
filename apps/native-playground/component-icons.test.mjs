import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readDocumentationNavigation } from './component-navigation.mjs';
import { COMPONENT_ICONS, componentIcon } from './component-icons.js';

test('every documented sidebar component has its own explicit icon', async () => {
  const navigation = await readDocumentationNavigation(fileURLToPath(new URL('../../', import.meta.url)));
  const tags = navigation.groups.flatMap(group => group.items.map(item => item.tag));
  assert.equal(tags.length, 56);
  assert.deepEqual(Object.keys(COMPONENT_ICONS).sort(), [...tags].sort());
  for (const tag of tags) {
    assert.notEqual(componentIcon(tag), 'widgets', `${tag} must not use the unknown-component fallback`);
    assert.match(componentIcon(tag), /^[a-z][a-z0-9_]*$/);
  }
  assert.equal(new Set(tags.map(componentIcon)).size, tags.length, 'Each component has a distinct symbol, independent of category');
});

test('unknown tags use a safe icon rather than inherited object properties', () => {
  for (const tag of ['md-new-component', '', undefined, null, '__proto__', 'constructor', 'toString']) {
    assert.equal(componentIcon(tag), 'widgets');
  }
  assert(Object.isFrozen(COMPONENT_ICONS));
});

// Use the installed native font shaper on macOS, without adding a font-parser
// dependency. Other platforms still run the complete roster/uniqueness checks.
test('all selected symbols are single glyphs in the bundled Studio font', { skip: process.platform !== 'darwin' }, async () => {
  const cache = fileURLToPath(new URL('../../.build/swift-icon-module-cache', import.meta.url));
  await mkdir(cache, { recursive: true });
  const font = fileURLToPath(new URL('../smart-home/public/fonts/material-symbols-outlined.woff2', import.meta.url));
  const names = [...Object.values(COMPONENT_ICONS), componentIcon('unknown')];
  const source = `
import Foundation
import CoreText
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor], let descriptor = descriptors.first else { fatalError("Bundled font unavailable") }
let font = CTFontCreateWithFontDescriptor(descriptor, 24, nil)
var result: [String: [UInt16]] = [:]
for name in CommandLine.arguments.dropFirst(2) {
    let text = NSAttributedString(string: name, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font, NSAttributedString.Key(kCTLigatureAttributeName as String): 2])
    let line = CTLineCreateWithAttributedString(text)
    var glyphs: [UInt16] = []
    for run in CTLineGetGlyphRuns(line) as! [CTRun] {
        var shaped = [CGGlyph](repeating: 0, count: CTRunGetGlyphCount(run))
        shaped.withUnsafeMutableBufferPointer { CTRunGetGlyphs(run, CFRangeMake(0, 0), $0.baseAddress!) }
        glyphs += shaped
    }
    result[name] = glyphs
}
print(String(data: try JSONSerialization.data(withJSONObject: result), encoding: .utf8)!)
`;
  const { stdout } = await promisify(execFile)('/usr/bin/swift', ['-module-cache-path', cache, '-e', source, font, ...names], { timeout: 90000 });
  const glyphs = JSON.parse(stdout);
  assert.deepEqual(Object.keys(glyphs).sort(), [...names].sort());
  for (const [name, shaped] of Object.entries(glyphs)) {
    assert.equal(shaped.length, 1, `${name} must form one symbol rather than literal text`);
    assert.notEqual(shaped[0], 0, `${name} must not use the missing-glyph box`);
  }
});
