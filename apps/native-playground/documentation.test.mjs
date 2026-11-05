import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeComponentDocumentation, memberDocumentation, eventPayloadDocumentation } from './documentation.js';

test('merges raw CEM fields and attributes with generated contracts without losing source prose', () => {
  const manifest = { tagName: 'md-example', description: 'Source component', members: [
    { kind: 'field', name: 'softDisabled', description: 'Source member', type: { text: 'boolean' }, default: 'false' },
    { kind: 'field', name: 'secret', privacy: 'private' },
    { kind: 'method', name: 'focus', description: 'Focus source control', parameters: [] },
  ], attributes: [{ name: 'soft-disabled', fieldName: 'softDisabled' }] };
  const catalog = { tag: 'md-example', description: ' ', properties: [{ name: 'softDisabled', description: '', type: 'boolean', defaultValue: false }], methods: [{ name: 'focus', description: '', returnType: 'Promise<void>' }] };
  const before = JSON.stringify([manifest, catalog]);
  const result = mergeComponentDocumentation(manifest, catalog);
  assert.equal(result.description, 'Source component');
  assert.equal(result.properties.length, 1);
  assert.equal(result.properties[0].description, 'Source member');
  assert.equal(result.properties[0].attribute, 'soft-disabled');
  assert.equal(result.properties[0].default, 'false');
  assert.equal(result.properties[0].defaultValue, false);
  assert.equal(result.methods[0].returnType, 'Promise<void>');
  result.properties[0].description = 'Edited copy';
  assert.equal(JSON.stringify([manifest, catalog]), before);
});

test('optional docs JSON enriches named types and existing members without adding stale API entries', () => {
  const manifest = { tag: 'md-example', properties: [{ name: 'value' }], events: [{ name: 'mdChange' }], slots: [{ name: '' }], methods: [{ name: 'open', description: 'Current source' }] };
  const catalog = { events: [{ name: 'mdChange', detail: 'ChangeDetail<Record<string, boolean>>', cancelable: false }], methods: [{ name: 'open', returnType: 'Promise<void>' }] };
  const usage = { props: [{ name: 'value', description: 'Assigned value' }, { name: 'removedProp' }], slots: [{ name: '(default)', description: 'Content' }], methods: [{ name: 'open', description: 'Old prose', params: 'options?: Options' }],
    events: [{ name: 'mdChange', detail: 'ChangeDetail<Record<string, boolean' }], eventTypes: [{ name: 'ChangeDetail', body: 'value: T;' }], eventPayloads: [{ name: 'mdChange', detail: 'ChangeDetail<Record<string, boolean' }], cssCustomProps: [{ name: '--stale' }] };
  const merged = mergeComponentDocumentation(manifest, catalog, usage);
  assert.deepEqual(merged.properties.map(item => item.name), ['value']);
  assert.equal(merged.properties[0].description, 'Assigned value');
  assert.deepEqual(merged.cssProperties, []);
  assert.equal(merged.slots[0].name, '');
  assert.equal(merged.slots[0].description, 'Content');
  const method = memberDocumentation(merged, 'method', 'open');
  assert.equal(method.description, 'Current source');
  assert.equal(method.params, 'options?: Options');
  assert.equal(method.returnType, 'Promise<void>');
  const event = memberDocumentation(merged, 'event', 'mdChange');
  assert.equal(event.type, 'ChangeDetail<Record<string, boolean>>');
  assert.equal(event.payloadType.body, 'value: T;');
  assert.equal(event.cancelable, false);
});

test('missing defaults stay absent and false, null, zero and empty-string values survive', () => {
  const absent = memberDocumentation({}, 'property', { name: 'optional', type: 'string | undefined' });
  assert.equal(Object.hasOwn(absent, 'default'), false);
  assert.equal(Object.hasOwn(absent, 'defaultValue'), false);
  assert.equal(Object.hasOwn(absent, 'attribute'), false);
  for (const value of [false, null, 0, '']) {
    const result = memberDocumentation({}, 'property', { name: 'value', defaultValue: value });
    assert.equal(Object.hasOwn(result, 'defaultValue'), true);
    assert.equal(result.defaultValue, value);
  }
  const docs = memberDocumentation({}, 'property', { name: 'mode', type: "false | 'auto' | 2 | null" });
  assert.deepEqual(docs.options, [false, 'auto', 2, null]);
});

test('native member support is explicit, platform-specific and not inferred from an adapter status', () => {
  const component = { support: { ios: { status: 'adapter-implemented', properties: ['value'], unsupportedProperties: ['loading'], slots: [''] }, android: { status: 'missing-adapter' } } };
  assert.equal(memberDocumentation(component, 'property', 'value', 'web').support.status, 'source');
  assert.equal(memberDocumentation(component, 'property', 'value', 'ios').support.status, 'supported');
  assert.equal(memberDocumentation(component, 'property', 'loading', 'ios').support.status, 'unsupported');
  assert.equal(memberDocumentation(component, 'property', 'unknown', 'ios').support.status, 'unknown');
  assert.equal(memberDocumentation(component, 'property', 'value', 'android').support.status, 'unsupported');
  assert.equal(memberDocumentation(component, 'slot', '', 'ios').support.status, 'supported');
  assert.equal(memberDocumentation(component, 'cssProperty', '--color', 'ios').support.status, 'unknown');
  assert.match(memberDocumentation(component, 'cssProperty', '--color', 'ios').support.description, /web styling hook/);
});

test('source text stays plain and preferred over curated prose', () => {
  const result = memberDocumentation({ tag: 'md-button' }, 'property', { name: 'variant', description: '<b>Authored</b> & precise', type: 'string' });
  assert.equal(result.description, '<b>Authored</b> & precise');
  assert.equal(result.descriptionSource, 'source');
  assert.equal(memberDocumentation({ tag: 'md-custom' }, 'property', { name: 'mystery' }).descriptionSource, 'generic');
});

test('native usage avoids HTML assignment advice and type references remain documentation', () => {
  const component = { tag: 'md-button', properties: [{ name: 'variant' }], dataTypes: [{ name: 'Options', kind: 'interface', body: 'name: string;' }], callableProps: [{ name: 'formatter', body: '(value: number) => string' }], support: { ios: { properties: ['variant', 'formatter'], events: ['mdClick'], slots: [''], methods: ['open'] } } };
  assert.match(memberDocumentation(component, 'property', 'variant', 'ios').usage, /SwiftUI component properties/);
  assert.doesNotMatch(memberDocumentation(component, 'property', 'variant', 'ios').usage, /HTML|attribute/);
  assert.match(memberDocumentation(component, 'event', 'mdClick', 'ios').usage, /native event callback/);
  assert.match(memberDocumentation(component, 'slot', '', 'ios').usage, /native child content/);
  assert.match(memberDocumentation(component, 'method', 'open', 'ios').usage, /native action API/);
  const callback = memberDocumentation(component, 'callableProps', 'formatter', 'ios');
  assert.equal(callback.type, '(value: number) => string');
  assert.equal(callback.support.status, 'supported');
  const reference = memberDocumentation(component, 'dataType', 'Options', 'ios');
  assert.equal(reference.body, 'name: string;');
  assert.equal(reference.support.status, 'unknown');
});

test('all 24 source md-button properties have concrete curated explanations when source prose is absent', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url)));
  const button = catalog.components.find(component => component.tag === 'md-button');
  assert.equal(button.properties.length, 24);
  for (const property of button.properties) {
    const docs = memberDocumentation(button, 'property', { ...property, description: '', summary: '' }, 'android');
    assert.equal(docs.descriptionSource, 'curated', property.name);
    assert.ok(docs.description.length > 35, property.name);
  }
  assert.equal(memberDocumentation(button, 'property', 'groupTabindex').internal, true);
  assert.match(memberDocumentation(button, 'event', 'mdChange').description, /does not undo/);
});

test('all checked-in components merge with docs JSON without changing their declared API counts', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../packages/core/custom-elements.json', import.meta.url)));
  const catalog = JSON.parse(readFileSync(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url)));
  const declarations = manifest.modules.flatMap(module => module.declarations || []);
  for (const component of catalog.components) {
    const source = declarations.find(item => item.tagName === component.tag);
    const usage = JSON.parse(readFileSync(new URL(`../docs/src/data/components/${component.tag.slice(3)}.json`, import.meta.url)));
    const baseline = mergeComponentDocumentation(source, component);
    const merged = mergeComponentDocumentation(source, component, usage);
    for (const key of ['properties', 'events', 'methods', 'slots', 'cssProperties', 'cssParts']) {
      assert.deepEqual(merged[key].map(item => item.name), baseline[key].map(item => item.name), `${component.tag} ${key}`);
      for (const member of merged[key]) assert.ok(memberDocumentation(merged, key, member).description.length > 0);
    }
  }
});

test('all missing catalog property descriptions have component-specific curated coverage', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url)));
  let count = 0;
  for (const component of catalog.components) for (const property of component.properties) {
    if (property.description?.trim()) continue;
    const docs = memberDocumentation(component, 'property', property);
    assert.equal(docs.descriptionSource, 'curated', `${component.tag}.${property.name}`);
    count++;
  }
  assert.ok(count > 50);
});

test('method explanations distinguish validation, text selection and state-changing selection', () => {
  const catalog = JSON.parse(readFileSync(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url)));
  const component = tag => catalog.components.find(item => item.tag === tag);
  const method = (tag, name) => memberDocumentation(component(tag), 'method', name);
  assert.match(method('md-text-field', 'setFocus').description, /inner input/);
  assert.match(method('md-text-field', 'select').description, /Selects all text/);
  assert.match(method('md-radio', 'select').description, /Checks.*radio/);
  assert.match(method('md-text-field', 'getInputElement').description, /null before the first render/);
  assert.match(method('md-text-field', 'checkValidity').description, /does not reveal.*or move focus/);
  assert.match(method('md-text-field', 'reportValidity').description, /validation-error presentation/);
  const custom = method('md-text-field', 'setCustomValidity');
  assert.match(custom.description, /empty string/);
  assert.match(custom.parameters.find(item => item.name === 'message').description, /clear the custom error/);
  assert.match(method('md-otp-field', 'clear').description, /does not emit/);
  assert.match(method('md-multi-select', 'reset').description, /emits mdChange/);
  assert.match(method('md-area-chart', 'setZoom').parameters[0].description, /Absolute data index/);
  const authored = memberDocumentation(component('md-text-field'), 'method', { name: 'setFocus', description: 'New source description' });
  assert.equal(authored.description, 'New source description');
  assert.equal(authored.descriptionSource, 'source');
});

test('event payload docs consume AST fields and retain exact source descriptions without parsing TypeScript', () => {
  const component = {
    tag: 'md-button', events: [{ name: 'mdClick', detail: 'MdButtonClickDetail', cancelable: true }],
    eventTypes: [{ name: 'MdButtonClickDetail', kind: 'interface', body: '/** Proposed state. */\nselected: boolean;', fields: [{ name: 'selected', type: 'boolean', description: 'The proposed selected state.', optional: false }] }],
    eventPayloads: [{ name: 'mdClick', detail: 'MdButtonClickDetail', fields: [
      { name: 'selected', type: 'boolean', description: 'Selected state the button WILL transition to if the click is not cancelled.', optional: false },
      { name: 'originalEvent', type: 'MouseEvent | KeyboardEvent', description: 'The original DOM event that triggered the activation.', optional: false },
    ] }],
  };
  const original = JSON.stringify(component);
  const doc = memberDocumentation(component, 'event', 'mdClick');
  const payload = eventPayloadDocumentation(component, doc);
  assert.equal(payload.fields.length, 2);
  assert.equal(payload.fields[0].description, component.eventPayloads[0].fields[0].description);
  assert.match(payload.definition, /^interface MdButtonClickDetail \{/);
  assert.match(payload.example, /event\.detail\["selected"\]/);
  assert.doesNotMatch(payload.example, /event\.detail\["originalEvent"\]/);
  assert.match(payload.example, /event\.preventDefault/);
  assert.match(doc.description, /before activation effects/);
  assert.equal(doc.cancelable, true);
  doc.payloadFields[0].description = 'Changed copy';
  assert.equal(JSON.stringify(component), original);
  const noMetadata = eventPayloadDocumentation(component, { type: '{ count: number; }', payloadType: { body: 'count: number;' } });
  assert.deepEqual(noMetadata.fields, [], 'Raw source text is not parsed heuristically in the browser');
});

test('simple, empty, optional and inline event payloads have readable truthful fallbacks', () => {
  const component = { tag: 'md-select' };
  const string = eventPayloadDocumentation(component, { name: 'mdChange', detail: 'string' });
  assert.equal(string.description, 'The detail is a text value.');
  assert.match(string.example, /console\.log\(event\.detail\)/);
  const empty = eventPayloadDocumentation(component, { name: 'mdOpen', detail: 'void' });
  assert.equal(empty.empty, true);
  assert.match(empty.description, /does not carry payload data/);
  assert.doesNotMatch(empty.example, /event\.detail/);
  const inline = eventPayloadDocumentation(component, { name: 'mdValidityChange', detail: '{ valid: boolean; message?: string }', payloadFields: [{ name: 'message', type: { text: 'string' }, optional: true }] });
  assert.deepEqual(inline.fields[0], { name: 'message', type: 'string', optional: true, description: 'No additional field description is declared in the source.' });
  assert.equal(inline.definition, '{ valid: boolean; message?: string }');
  assert.doesNotMatch(eventPayloadDocumentation({ tag: 'md-button' }, { name: 'mdChange', detail: 'MdButtonChangeDetail' }).example, /preventDefault/);
});

test('actual server AST enrichment reaches button and inline validity payload documentation', async () => {
  const { enrichEventDocumentation } = await import('./event-documentation.mjs');
  const { fileURLToPath } = await import('node:url');
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  const catalog = JSON.parse(readFileSync(new URL('../../packages/native-compiler/generated/catalog.json', import.meta.url)));
  const merged = async tag => {
    const docs = JSON.parse(readFileSync(new URL(`../docs/src/data/components/${tag.slice(3)}.json`, import.meta.url)));
    return mergeComponentDocumentation({}, catalog.components.find(component => component.tag === tag), await enrichEventDocumentation(repository, tag, docs));
  };
  const button = await merged('md-button');
  const click = eventPayloadDocumentation(button, memberDocumentation(button, 'event', 'mdClick'));
  assert.deepEqual(click.fields.map(field => field.name), ['value', 'toggle', 'selected', 'href', 'target', 'originalEvent']);
  assert.ok(click.fields.every(field => field.description.length > 10));
  assert.match(click.fields.find(field => field.name === 'selected').description, /not.*cancelled/s);
  assert.match(click.example, /event\.detail\["value"\], event\.detail\["selected"\]/);
  const select = await merged('md-select');
  const validity = eventPayloadDocumentation(select, memberDocumentation(select, 'event', 'mdValidityChange'));
  assert.deepEqual(validity.fields.map(field => field.name), ['valid', 'validationMessage', 'flags']);
  assert.equal(validity.fields.find(field => field.name === 'flags').type, 'Record<string, boolean>');
  assert.match(validity.definition, /Record<string, boolean>/);
});


test('button group private fallback sentinel never becomes a public CSS override after documentation merges', () => {
  const publicNames = ['gap', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height'].map(name => `--md-button-group-${name}`);
  const source = { tagName: 'md-button-group', cssProperties: publicNames.map(name => ({ name })) };
  const catalog = { cssProperties: [{ name: '--md-button-group-_unset' }, { name: '--md-button-group-gap', description: 'Public gap' }] };
  const usage = { cssCustomProps: [{ name: '--md-button-group-_unset', description: 'Compiler-only fallback' }] };
  const before = JSON.stringify([source, catalog, usage]);
  const merged = mergeComponentDocumentation(source, catalog, usage);
  assert.deepEqual(merged.cssProperties.map(item => item.name), publicNames);
  assert.equal(merged.cssProperties[0].description, 'Public gap');
  assert.deepEqual(mergeComponentDocumentation(merged, catalog, usage).cssProperties.map(item => item.name), publicNames);
  assert.equal(JSON.stringify([source, catalog, usage]), before, 'raw audit inputs remain unchanged');
});
