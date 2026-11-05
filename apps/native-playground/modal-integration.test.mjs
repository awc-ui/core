import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as modal from './modal-appearance.js';
import { componentAppearance, componentAppearanceOptions } from './component-appearance.js';
import { createButtonAppearanceUI } from './button-appearance-ui.js';
import { nativeRenderRequest } from './contracts.js';
import { validateRenderRequest } from './native-render.mjs';
import { validateLiveInput } from './native-live.mjs';
import { DIALOG_UPDATE_PROPERTIES, BOTTOM_SHEET_UPDATE_PROPERTIES, SIDE_SHEET_UPDATE_PROPERTIES, nativePropertyUpdate, supportsRetainedPropertyUpdates } from './native-property-updates.js';
import { nativeMethodCommand, nativeMethodSupported, nativeMethodResultsCommand, nativeLifecycleMethod } from './native-methods.js';
import { recipeFor } from './recipes.js';
import { usageSnippet } from './usage-snippets.js';
import { nativeApiExample, nativeUsageExample, nativeThemeExample } from './native-api-examples.js';

// md-dialog, md-bottom-sheet and md-side-sheet in the Laboratory: typed hooks and parts against the source CSS, the IR and
// both released policies; Styles panels; retained updates; lifecycle methods; pointer input; copyable examples.
const packages = await readdir(new URL('../../node_modules/.pnpm/', import.meta.url));
const { JSDOM } = createRequire(import.meta.url)(new URL(`../../node_modules/.pnpm/${packages.find(name => name.startsWith('jsdom@'))}/node_modules/jsdom/lib/api.js`, import.meta.url).pathname);
const ir = async tag => JSON.parse(await readFile(new URL(`../../packages/native-compiler/generated/ir/${tag}.json`, import.meta.url), 'utf8'));
const css = async tag => readFile(new URL(`../../packages/core/src/components/${tag}/${tag}.css`, import.meta.url), 'utf8');
const sample = field => ({ color: '#12345680', corners: '12px 4px / 6px 2px', length: '12px', integer: '1200', affine: 'calc(50% - 12px)', sheetShape: '28px 20px / 12px' })[field.kind];
const specs = [
  { tag: 'md-dialog', key: 'dialogAppearance', type: 'Dialog', fields: modal.DIALOG_APPEARANCE_FIELDS, parts: modal.DIALOG_PARTS, parse: modal.parseDialogAppearanceInput,
    format: modal.formatDialogAppearanceInput, normalize: modal.normalizeDialogAppearance, toCSS: modal.dialogAppearanceCSS, native: modal.dialogAppearanceNativeValue,
    code: 'INVALID_DIALOG_APPEARANCE', updates: DIALOG_UPDATE_PROPERTIES, methods: ['show', 'close', 'whenClosed'], events: ['mdOpen', 'mdClose', 'mdCancel'], invalidInput: ['zIndex', '1.5'],
    props: { open: true, headline: 'Discard draft?', dialogAriaLabel: 'Discard', icon: 'delete', fullscreen: false, scrimDismissible: false, locale: 'de-DE', closeLabel: 'Schließen',
      cancelLabel: 'Abbrechen', okLabel: 'Verwerfen', divider: true, headerDivider: true, density: -2 },
    badPatches: [{ fullscreen: 'yes' }, { density: -5 }, { locale: 1 }, { variant: 'modal' }, { headline: 'x'.repeat(4097) }] },
  { tag: 'md-bottom-sheet', key: 'bottomSheetAppearance', type: 'BottomSheet', fields: modal.BOTTOM_SHEET_APPEARANCE_FIELDS, parts: modal.BOTTOM_SHEET_PARTS, parse: modal.parseBottomSheetAppearanceInput,
    format: modal.formatBottomSheetAppearanceInput, normalize: modal.normalizeBottomSheetAppearance, toCSS: modal.bottomSheetAppearanceCSS, native: modal.bottomSheetAppearanceNativeValue,
    code: 'INVALID_BOTTOM_SHEET_APPEARANCE', updates: BOTTOM_SHEET_UPDATE_PROPERTIES, methods: ['show', 'close'], events: ['mdOpen', 'mdClose', 'mdCancel'], invalidInput: ['containerShape', '1px / 2px / 3px'],
    props: { open: true, variant: 'detached', headline: 'Share', showDragHandle: false, closeable: true, scrimDismissible: false, topDivider: true, bottomDivider: true, sheetAriaLabel: 'Share sheet',
      scrollShadow: false, headlineAlign: 'center', contentAlign: 'end', density: -1 },
    badPatches: [{ variant: 'modal' }, { headlineAlign: 'left' }, { scrollShadow: 1 }, { side: 'start' }, { density: 1 }] },
  { tag: 'md-side-sheet', key: 'sideSheetAppearance', type: 'SideSheet', fields: modal.SIDE_SHEET_APPEARANCE_FIELDS, parts: modal.SIDE_SHEET_PARTS, parse: modal.parseSideSheetAppearanceInput,
    format: modal.formatSideSheetAppearanceInput, normalize: modal.normalizeSideSheetAppearance, toCSS: modal.sideSheetAppearanceCSS, native: modal.sideSheetAppearanceNativeValue,
    code: 'INVALID_SIDE_SHEET_APPEARANCE', updates: SIDE_SHEET_UPDATE_PROPERTIES, methods: ['show', 'close', 'whenClosed'], events: ['mdOpen', 'mdClose', 'mdCancel', 'mdBack'], invalidInput: ['width', 'wide'],
    props: { open: true, variant: 'modal', side: 'start', headline: 'Filters', closeable: false, showBack: true, scrimDismissible: false, topDivider: true, bottomDivider: true, detached: true,
      sheetAriaLabel: 'Filters', density: -3 },
    badPatches: [{ variant: 'detached' }, { side: 'left' }, { showBack: 'true' }, { headlineAlign: 'center' }, { density: -0.5 }] },
];
for (const spec of specs) {
  spec.component = await ir(spec.tag);
  spec.styles = Object.fromEntries(spec.fields.map(f => [f.name, spec.parse(f.name, sample(f))]));
}

test('modal appearance exactly covers the source hooks and parts, the IR and both released policies', async () => {
  for (const { tag, fields, parts, component, toCSS, styles } of specs) {
    const prefix = `--${tag}-`;
    assert.deepEqual([...new Set((await css(tag)).match(new RegExp(`${prefix}[a-z-]+`, 'g')))].sort(), fields.map(f => f.cssProperty).sort(), `${tag} stylesheet hooks`);
    assert.deepEqual([...new Set(component.cssProperties.map(p => p.name))].sort(), fields.map(f => f.cssProperty).sort(), `${tag} IR hooks`);
    assert.deepEqual([...parts].sort(), component.cssParts.map(p => p.name).sort(), `${tag} parts`);
    for (const platform of ['ios', 'android']) {
      assert.deepEqual([...component.support[platform].appearance.fields], fields.map(f => f.name), `${platform} ${tag} appearance declaration`);
      assert.deepEqual([...component.support[platform].visualParts].sort(), [...parts].sort(), `${platform} ${tag} parts`);
    }
    assert.equal(Object.keys(toCSS(styles)).length, fields.length, `${tag} CSS for every hook`);
  }
  assert.deepEqual([modal.DIALOG_APPEARANCE_FIELDS.length, modal.BOTTOM_SHEET_APPEARANCE_FIELDS.length, modal.SIDE_SHEET_APPEARANCE_FIELDS.length], [10, 16, 9]);
});

test('integer, sheet shape, affine, corner, length and color hooks roundtrip CSS, native data and native literals', () => {
  const [dialog, bottom, side] = specs;
  assert.equal(dialog.toCSS(dialog.styles)['--md-dialog-z-index'], '1200');
  assert.equal(dialog.toCSS(dialog.styles)['--md-dialog-container-shape'], '12px 4px / 6px 2px');
  assert.equal(dialog.toCSS(dialog.styles)['--md-dialog-icon-size'], '12px');
  assert.equal(bottom.toCSS(bottom.styles)['--md-bottom-sheet-container-shape'], '28px 20px / 12px');
  assert.equal(bottom.toCSS(bottom.styles)['--md-bottom-sheet-width'], 'calc(-12px + 50%)');
  assert.equal(side.toCSS(side.styles)['--md-side-sheet-max-width'], 'calc(-12px + 50%)');
  for (const { fields, parse, format, styles } of specs) for (const field of fields) assert.deepEqual(parse(field.name, format(field.name, styles[field.name])), styles[field.name], field.name);
  assert.deepEqual(bottom.parse('containerShape', '28px 28px 0 0'), { radii: [28, 28, 0, 0] });
  assert.equal(bottom.native('containerShape', bottom.styles.containerShape, 'swift'), 'AWCBottomSheetShape([28.0, 20.0], vertical: [12.0])');
  assert.equal(bottom.native('containerShape', { radii: [28] }, 'android'), 'AWCBottomSheetShape(listOf(28.0))');
  assert.equal(side.native('containerShape', side.styles.containerShape, 'android'), 'AWCSideSheetShape(listOf(28.0, 20.0), vertical = listOf(12.0))');
  assert.match(bottom.native('width', bottom.styles.width, 'swift'), /^AWCSkeletonLength\(/);
  assert.match(dialog.native('containerShape', dialog.styles.containerShape, 'android'), /^AWCCornerShape\(/);
  assert.equal(dialog.native('zIndex', 1200, 'swift'), undefined, 'integers use the shared number literal path');
  assert.equal(dialog.parse('zIndex', '-0'), 0);
  for (const raw of ['1.5', '1e3', 'auto', '']) assert.throws(() => dialog.parse('zIndex', raw), { code: 'INVALID_DIALOG_APPEARANCE' }, raw);
  for (const raw of ['1px / 2px / 3px', '1px 2px 3px 4px 5px', '1em', '-1px', '/ 2px']) assert.throws(() => bottom.parse('containerShape', raw), { code: 'INVALID_BOTTOM_SHEET_APPEARANCE' }, raw);
  for (const value of [{ zIndex: 1.5 }, { zIndex: '1' }, { containerColor: '#FFF' }, { iconSize: -1 }, { containerShape: { topLeft: 'x' } }, { gap: 1 }]) assert.throws(() => dialog.normalize(value), { code: 'INVALID_DIALOG_APPEARANCE' }, JSON.stringify(value));
  for (const value of [{ containerShape: { radii: [] } }, { containerShape: { radii: [1, 2, 3, 4, 5] } }, { containerShape: { radii: [-1] } }, { containerShape: { radii: [1], extra: 1 } }, { containerShape: { vertical: [1] } },
    { width: { points: 'x' } }, { detachedMargin: -1 }, { dragHandleColor: 'red' }]) assert.throws(() => bottom.normalize(value), { code: 'INVALID_BOTTOM_SHEET_APPEARANCE' }, JSON.stringify(value));
  for (const value of [{ containerShape: { radii: [1], vertical: [] } }, { minWidth: { points: 1 } }, null, []]) assert.throws(() => side.normalize(value), { code: 'INVALID_SIDE_SHEET_APPEARANCE' }, JSON.stringify(value));
});

test('panel transport retains every authored property and style for the three tags', () => {
  for (const { tag, key, component, props, styles, code } of specs) {
    const request = nativeRenderRequest(tag, props, true, { ...componentAppearanceOptions({ selected: component, [key]: styles }), direction: 'rtl' });
    const valid = validateRenderRequest(request, new Set([tag]));
    assert.deepEqual(valid.properties, props); assert.deepEqual(valid[key], styles); assert.equal(valid.direction, 'rtl');
    const other = specs.find(spec => spec.tag !== tag).tag;
    assert.throws(() => validateRenderRequest({ ...request, tag: other }, new Set([other])), { code });
    assert.throws(() => validateRenderRequest({ tag, [key]: { containerColor: 'red' } }, new Set([tag])), { code });
  }
});

test('retained updates cover every source property with the source types, gated by released support', () => {
  for (const { tag, component, updates, props, badPatches } of specs) {
    assert.deepEqual([...updates].sort(), component.properties.map(p => p.name).sort(), tag);
    assert.deepEqual(nativePropertyUpdate(tag, props), { command: 'update', properties: props });
    for (const patch of badPatches) assert.throws(() => nativePropertyUpdate(tag, patch), { code: 'INVALID_PROPERTY_UPDATE' }, `${tag} ${JSON.stringify(patch)}`);
    for (const platform of ['ios', 'android']) {
      assert.equal(supportsRetainedPropertyUpdates(component, platform), true, `${tag} ${platform}`);
      const policy = component.support[platform];
      assert.equal(supportsRetainedPropertyUpdates({ ...component, support: { [platform]: { ...policy, properties: policy.properties.slice(1) } } }, platform), false);
    }
  }
});

test('lifecycle methods, events, slots and pointer input use the released contract', () => {
  for (const { tag, component, methods, events } of specs) {
    for (const platform of ['ios', 'android']) {
      for (const key of ['properties', 'events', 'methods', 'slots']) assert.deepEqual([...component.support[platform][key]].sort(), component[key].map(member => member.name).sort(), `${platform} ${tag} ${key}`);
      assert.deepEqual([...component.support[platform].events].sort(), [...events].sort());
      for (const key of ['unsupportedProperties', 'unsupportedEvents', 'unsupportedMethods', 'unsupportedSlots']) assert.deepEqual(component.support[platform][key] ?? [], [], `${platform} ${tag} ${key}`);
      for (const method of methods) {
        assert.equal(nativeMethodSupported(tag, method, component.support[platform]), true, `${tag}.${method}`);
        assert.equal(nativeMethodSupported(tag, method, { ...component.support[platform], methods: [] }), false);
      }
    }
    for (const method of methods) {
      assert.equal(nativeLifecycleMethod(tag, method), true);
      assert.deepEqual(nativeMethodCommand(tag, method, [], { callId: `c-${method}`, target: 'component' }), { command: 'method', target: 'component', callId: `c-${method}`, method, arguments: [] });
      assert.throws(() => nativeMethodCommand(tag, method, ['now'], { callId: 'c1', target: 'component' }), { code: 'INVALID_METHOD' });
      assert.throws(() => nativeMethodCommand(tag, method, []), { code: 'INVALID_METHOD' }, 'a lifecycle call needs a call ID');
    }
    assert.deepEqual(nativeMethodResultsCommand(tag, ['c-show'], ['c-close']), { command: 'method-results', callIds: ['c-show'], acknowledged: ['c-close'] });
    const context = { tag, logicalWidth: 640, logicalHeight: 480 };
    for (const phase of ['down', 'move', 'up']) assert.deepEqual(validateLiveInput({ command: 'pointer', phase, x: 120, y: 40 }, context), { command: 'pointer', phase, x: 120, y: 40 });
    assert.deepEqual(validateLiveInput({ command: 'update', properties: { open: false } }, context), { command: 'update', properties: { open: false } });
  }
  assert.equal(nativeLifecycleMethod('md-bottom-sheet', 'whenClosed'), false, 'the source bottom sheet has no whenClosed()');
  assert.throws(() => nativeMethodCommand('md-bottom-sheet', 'whenClosed', [], { callId: 'c1', target: 'component' }), { code: 'INVALID_METHOD' });
});

test('the three Styles panels expose every hook and invalid input preserves the last valid appearance', t => {
  const dom = new JSDOM('<div id="button-appearance-controls"></div>'), previous = globalThis.document; globalThis.document = dom.window.document;
  t.after(() => { globalThis.document = previous; dom.window.close(); });
  for (const { tag, component, fields, key, invalidInput } of specs) {
    const state = { selected: component, platform: 'web', props: {} }; const ui = createButtonAppearanceUI({ getState: () => state, onChange() {} });
    for (const platform of ['web', 'ios', 'android']) {
      state.platform = platform; ui.render();
      assert.equal(document.querySelectorAll('[data-appearance-field]').length, fields.length, `${tag} ${platform}`);
      for (const field of fields) {
        const input = document.querySelector(`#appearance-${field.name}`);
        input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: sample(field) }));
        assert.equal(input.error, false, `${tag} ${field.name} accepts ${sample(field)}`);
      }
      assert.equal(Object.keys(state[key]).length, fields.length);
      const before = structuredClone(state[key][invalidInput[0]]);
      const input = document.querySelector(`#appearance-${invalidInput[0]}`);
      input.dispatchEvent(new dom.window.CustomEvent('mdInput', { detail: invalidInput[1] }));
      assert.equal(input.error, true); assert.deepEqual(state[key][invalidInput[0]], before);
    }
    const target = document.createElement(tag); ui.apply(target);
    for (const field of fields) assert.ok(target.style.getPropertyValue(field.cssProperty), `${field.cssProperty} applied`);
  }
});

test('framework snippets carry every hook with the correct native types inside an AWCModalScope', () => {
  for (const { tag, component, key, styles, type } of specs) {
    const profile = componentAppearance(tag);
    for (const platform of ['html', 'react', 'angular', 'vue', 'svelte', 'swift', 'android']) {
      const code = usageSnippet(component, { headline: 'Details' }, platform, { html: recipeFor(tag).html, [key]: styles });
      assert.doesNotMatch(code, /\[object Object\]/);
      for (const field of profile.fields) assert.match(code, new RegExp(['swift', 'android'].includes(platform) ? `\\b${field.name}${platform === 'swift' ? ':' : ' ='}` : field.cssProperty), `${tag} ${platform} ${field.name}`);
      if (platform === 'swift') { assert.match(code, new RegExp(`\\.${profile.swiftModifier}\\(\\.init\\(`)); assert.match(code, /AWCModalScope \{/); }
      if (platform === 'android') {
        assert.match(code, new RegExp(`${profile.nativeType}Scope\\(appearance = ${profile.nativeType}\\(`));
        assert.match(code, /AWCModalScope\(Modifier\.fillMaxSize\(\)\) \{/);
        assert.match(code, /import androidx\.compose\.ui\.Modifier\n/); assert.match(code, /import androidx\.compose\.foundation\.layout\.fillMaxSize\n/);
      }
      if (['swift', 'android'].includes(platform)) assert.match(code, tag === 'md-dialog' ? /AWCCornerShape\(/ : new RegExp(`AWC${type}Shape\\(`));
      if (['swift', 'android'].includes(platform) && tag !== 'md-dialog') assert.match(code, /AWCSkeletonLength\(/);
    }
  }
});

test('native API examples present in AWCModalScope and use the verified controllers, typed parts, events and slots', () => {
  for (const platform of ['swift', 'android']) {
    const policyKey = platform === 'swift' ? 'ios' : 'android';
    for (const { tag, component, type, methods, events, parts } of specs) {
      const scope = platform === 'swift' ? /AWCModalScope \{/ : /AWCModalScope\(Modifier\.fillMaxSize\(\)\) \{/;
      for (const example of [nativeUsageExample(component, platform), nativeThemeExample(component, platform)]) { assert.ok(example.code, tag); assert.match(example.code, scope, `${tag} usage/theme`); }
      for (const name of events) {
        const example = nativeApiExample(component, 'event', name, platform);
        assert.match(example.code, new RegExp(`"${name}"`)); assert.match(example.code, /lastPayload/); assert.match(example.code, scope);
        if (platform === 'android') assert.match(example.code, /import androidx\.compose\.ui\.Modifier\n/);
      }
      for (const method of methods) {
        const example = nativeApiExample(component, 'method', method, platform);
        assert.equal(example.status, 'supported', `${tag}.${method}`);
        assert.match(example.code, method === 'whenClosed' ? (platform === 'swift' ? /await controller\.whenClosed\(\)/ : /scope\.launch \{\n\s+controller\.whenClosed\(\)/) : new RegExp(`controller\\.${method}\\(\\)`));
        assert.match(example.code, platform === 'swift' ? new RegExp(`\\.awc${type}Controller\\(controller, for: "${tag}"\\)`) : new RegExp(`AWC${type}ControllerScope\\(controller\\) \\{`));
        assert.match(example.code, scope);
      }
      for (const part of parts) {
        assert.ok(component.support[policyKey].visualParts.includes(part));
        const example = nativeApiExample(component, 'cssPart', part, platform);
        assert.equal(example.status, 'native-equivalent', `${tag} ${part}`);
        assert.match(example.code, platform === 'swift' ? new RegExp(`\\.awc${type}PartAppearance\\(AWCModalPartAppearance\\(.+\\), part: \\.[a-z][A-Za-z]*\\)`) : new RegExp(`AWC${type}PartAppearanceScope\\(AWC${type}Part\\.[A-Z][A-Za-z]*, AWCModalPartAppearance\\(`), `${tag} ${part}`);
      }
      for (const slot of component.support[policyKey].slots) assert.ok(nativeApiExample(component, 'slot', slot, platform).code, `${tag} slot ${slot || '(default)'}`);
    }
  }
});
