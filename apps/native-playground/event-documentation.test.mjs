import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { enrichEventDocumentation } from './event-documentation.mjs';
import { readAssetContent, resolveAsset } from './server.mjs';

async function fixture(t, files) {
  const root = await mkdtemp(path.join(tmpdir(), 'awc-event-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  }
  return root;
}
const sourcePath = 'packages/core/src/components/md-button/md-button.tsx';

test('local payload interfaces retain source descriptions, optional flags and raw definitions without execution', async t => {
  const root = await fixture(t, { [sourcePath]: `throw new Error('source must never execute');
    interface Base {
      /** Stable group value. */
      value: string;
    }
    export interface Detail extends Base {
      /** New selection.\n       * Only changes after accepted activation. */ selected?: boolean;
      /** Original input. */ originalEvent: MouseEvent | KeyboardEvent;
    }
    class Button { @Event() mdClick: EventEmitter<Detail>; }` });
  const raw = { name: 'Detail', kind: 'interface', body: 'original raw declaration' };
  const result = await enrichEventDocumentation(root, 'md-button', { events: [{ name: 'mdClick' }], eventTypes: [raw] });
  assert.equal(result.eventTypes[0].body, raw.body);
  const fields = result.eventPayloads[0].fields;
  assert.deepEqual(fields.map(field => [field.name, field.type, field.optional]), [['value', 'string', false], ['selected', 'boolean', true], ['originalEvent', 'MouseEvent | KeyboardEvent', false]]);
  assert.equal(fields[0].description, 'Stable group value.');
  assert.match(fields[1].description, /New selection\.\s+Only changes after accepted activation\./);
  assert.doesNotMatch(fields[1].description, /\/\*|\*\//);
  assert.deepEqual(result.eventTypes[0].fields, fields);
  fields[0].description = 'mutated';
  assert.equal((await enrichEventDocumentation(root, 'md-button', {})).eventPayloads[0].fields[0].description, 'Stable group value.');
});

test('inline nested generics repair truncated payload metadata and preserve scalar and void types', async t => {
  const root = await fixture(t, { [sourcePath]: `class Button {
    @Event() mdValidityChange: EventEmitter<{ valid: boolean; flags?: Record<string, boolean>; nested: { value: number; tags: string[] } }>;
    @Event() mdInput: EventEmitter<string>;
    @Event() mdOpen: EventEmitter<void>;
  }` });
  const result = await enrichEventDocumentation(root, 'md-button', { eventPayloads: [{ name: 'mdValidityChange', detail: '{ valid: boolean; flags?: Record<string, boolean' }] });
  const [payload, scalar, empty] = result.eventPayloads;
  assert.match(payload.detail, /Record<string, boolean>;/);
  assert.deepEqual(payload.fields.map(field => [field.name, field.type, field.optional]), [['valid', 'boolean', false], ['flags', 'Record<string, boolean>', true], ['nested', '{ value: number; tags: string[] }', false]]);
  assert.ok(payload.fields.every(field => field.description === ''), 'Undocumented fields do not receive invented semantics.');
  assert.equal(scalar.detail, 'string'); assert.equal(scalar.fields, undefined);
  assert.equal(empty.detail, 'void'); assert.equal(empty.fields, undefined);
});

test('relative type imports resolve inside core source while cycles, unions and uninstantiated generics stay explicit', async t => {
  const root = await fixture(t, {
    [sourcePath]: `import type { Shared as Imported } from '../../types/payload';
      type CycleA = CycleB; type CycleB = CycleA;
      type Generic<T> = { value: T }; type Choice = { a: string } | { b: number };
      type Impossible = { value: string } & { value: number };
      class Button {
        @Event() mdClick: EventEmitter<Imported>;
        @Event() mdCycle: EventEmitter<CycleA>;
        @Event() mdGeneric: EventEmitter<Generic<string>>;
        @Event() mdChoice: EventEmitter<Choice>;
        @Event() mdImpossible: EventEmitter<Impossible>;
      }`,
    'packages/core/src/types/payload.ts': `export interface Shared {
      /** Stable identifier. */
      id: string;
    }`,
  });
  const result = await enrichEventDocumentation(root, 'md-button', {});
  assert.deepEqual(result.eventPayloads[0].fields, [{ name: 'id', type: 'string', description: 'Stable identifier.', optional: false }]);
  assert.ok(result.eventPayloads.slice(1).every(payload => payload.fields === undefined));
});

test('invalid tags and type-import symlink escapes cannot expose external source', async t => {
  const root = await fixture(t, { [sourcePath]: `import type { Secret } from './secret'; class Button { @Event() mdClick: EventEmitter<Secret>; }` });
  const outside = await mkdtemp(path.join(tmpdir(), 'awc-private-payload-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, 'secret.ts'), 'export interface Secret { hiddenCredential: string; }');
  await symlink(path.join(outside, 'secret.ts'), path.join(root, 'packages/core/src/components/md-button/secret.ts'));
  const result = await enrichEventDocumentation(root, 'md-button', {});
  assert.equal(result.eventPayloads[0].fields, undefined);
  assert.doesNotMatch(JSON.stringify(result), /hiddenCredential/);
  await assert.rejects(enrichEventDocumentation(root, '../private', {}), /Invalid component tag/);
});

test('existing documentation asset receives fields without widening the source route allowlist', async t => {
  const relative = 'apps/docs/src/data/components/button.json';
  const root = await fixture(t, {
    [sourcePath]: 'class Button { @Event() mdChange: EventEmitter<{ selected: boolean }>; }',
    [relative]: JSON.stringify({ tag: 'md-button', props: [{ name: 'selected', type: 'boolean' }] }),
  });
  const file = await resolveAsset(`/repo/${relative}`, { repoRoot: root });
  const result = JSON.parse(await readAssetContent(file, root));
  assert.deepEqual(result.props, [{ name: 'selected', type: 'boolean' }]);
  assert.deepEqual(result.eventPayloads[0].fields, [{ name: 'selected', type: 'boolean', description: '', optional: false }]);
  assert.equal(await resolveAsset(`/repo/${sourcePath}`, { repoRoot: root }), null);
  assert.equal(await resolveAsset('/event-documentation.mjs', { appRoot: path.join(root, 'apps/native-playground') }), null);
});

test('actual button and select docs expose authored fields and complete generic payloads', async () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const button = JSON.parse(await readAssetContent(path.join(root, 'apps/docs/src/data/components/button.json'), root));
  const click = button.eventPayloads.find(event => event.name === 'mdClick');
  assert.equal(click.fields.length, 6);
  assert.match(click.fields.find(field => field.name === 'selected').description, /WILL transition/);
  const select = JSON.parse(await readAssetContent(path.join(root, 'apps/docs/src/data/components/select.json'), root));
  const validity = select.eventPayloads.find(event => event.name === 'mdValidityChange');
  assert.equal(validity.fields.find(field => field.name === 'flags').type, 'Record<string, boolean>');
  assert.equal(validity.fields.length, 3);
});
