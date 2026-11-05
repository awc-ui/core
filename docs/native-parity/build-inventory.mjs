import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../../packages/native-compiler/src/compiler.mjs';
import { readDocumentationNavigation } from '../../apps/native-playground/component-navigation.mjs';
import { recipeFor } from '../../apps/native-playground/recipes.js';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const families = ['Properties', 'Events', 'Methods', 'Slots'];
const names = values => values.map(value => value.name);
const unique = values => [...new Set(values)].sort();
const pending = () => ({
  sourceContract: 'pending', implementation: 'pending', laboratoryControls: 'pending',
  behaviorTests: 'pending', visualMeasurements: 'pending', accessibility: 'pending',
  iosRuntime: 'pending', macosRuntime: 'pending', androidRuntime: 'pending',
  independentFinalAudit: 'pending', exceptions: [],
});

/** Static edges locate dependencies for review; they do not prove runtime use. */
export function dependencyClosure(tag, edges) {
  const found = new Set();
  const visit = current => {
    for (const item of edges.get(current) || []) if (item !== tag && !found.has(item)) {
      found.add(item); visit(item);
    }
  };
  visit(tag);
  return [...found].sort();
}

export async function buildInventory({ root = repository, capturedAt = new Date().toISOString() } = {}) {
  const navigation = await readDocumentationNavigation(root);
  // Extract current TSX/CSS and support policies without writing compiler output.
  const { components } = await compile({ root, write: false });
  const catalogPath = 'packages/native-compiler/generated/catalog.json';
  const catalogText = await readFile(resolve(root, catalogPath), 'utf8');
  const saved = new Map(JSON.parse(catalogText).components.map(item => [item.tag, item]));
  const allTags = new Set(components.map(item => item.tag));
  const visible = new Map(navigation.groups.flatMap(group => group.items.map(item => [item.tag, { ...item, category: group.title }])));
  const inputs = new Map();
  const read = async path => {
    const value = await readFile(resolve(root, path), 'utf8');
    inputs.set(path, sha256(value)); return value;
  };
  for (const path of [...navigation.sources, 'packages/core/custom-elements.json',
    'packages/native-ios/NativeSupport.json', 'packages/native-android/support.json',
    'packages/native-compiler/src/analyze.mjs', 'packages/native-compiler/src/compiler.mjs',
    'apps/native-playground/component-navigation.mjs', 'apps/native-playground/recipes.js']) await read(path);
  inputs.set(catalogPath, sha256(catalogText));
  const records = [];
  for (const component of components) {
    const source = await read(component.sources.stencil);
    const css = await read(component.sources.css);
    const docsPath = `apps/docs/src/data/components/${component.tag.slice(3)}.json`;
    const docs = JSON.parse(await read(docsPath));
    const children = components.filter(item => item.parent === component.tag).map(item => item.tag);
    const sourceReferences = unique([...source.matchAll(/\bmd-[a-z0-9]+(?:-[a-z0-9]+)*\b/g)]
      .map(match => match[0]).filter(tag => allTags.has(tag) && tag !== component.tag));
    const recipeReferences = unique([...(recipeFor(component.tag)?.html || '').matchAll(/<\s*(md-[a-z0-9-]+)/g)]
      .map(match => match[1]).filter(tag => allTags.has(tag) && tag !== component.tag));
    const documentationDependencies = (docs.dependencies || []).filter(tag => allTags.has(tag) && tag !== component.tag);
    const cssReferences = unique(component.styles.flatMap(rule => rule.declarations.flatMap(declaration =>
      [...declaration.value.matchAll(/var\(\s*(--md-[a-z0-9-]+)/g)].map(match => match[1]))));
    const declaredCss = names(component.cssProperties);
    const ownCssReferences = cssReferences.filter(name => name.startsWith(`--${component.tag}-`));
    const evidence = component.tag === 'md-button' ? [{
      status: 'prior-task-reported', platforms: ['macOS SwiftUI host', 'Android emulator'],
      scope: 'Prior focused button behavior, geometry, appearance, slots and Laboratory checks were reported as passing in this task history.',
      limitation: 'Not a fresh audit result. iOS simulator/device execution was not verified. Exact prior run artifacts must be attached before audit acceptance.',
    }] : [];
    records.push({
      tag: component.tag, title: visible.get(component.tag)?.title || component.name,
      category: visible.get(component.tag)?.category || component.category,
      visibleInLaboratory: visible.has(component.tag), parent: component.parent,
      source: { tsx: component.sources.stencil, css: component.sources.css, docs: docsPath,
        sha256: component.source.sha256,
        savedCatalogSourceMatches: saved.get(component.tag)?.source.sha256 === component.source.sha256 },
      contract: {
        properties: component.properties, events: component.events, slots: component.slots, methods: component.methods,
        cssParts: component.cssParts, cssProperties: component.cssProperties,
        actualCssHooks: unique([...declaredCss, ...ownCssReferences]),
        additionalOwnCssReferences: ownCssReferences.filter(name => !declaredCss.includes(name)),
        externalCssReferences: cssReferences.filter(name => !name.startsWith(`--${component.tag}-`)),
        extractionBoundary: 'Properties/events/methods use the current TSX analyzer; declared slots, CSS parts and hook descriptions also use CEM metadata. CSS references are checked directly. Dynamic composition and semantic behavior require manual source review.',
      },
      dependencies: {
        declaredChildren: children, documentation: documentationDependencies, staticSourceReferences: sourceReferences,
        laboratoryRecipe: recipeReferences, direct: unique([...children, ...documentationDependencies, ...sourceReferences, ...recipeReferences]),
        transitive: [],
      },
      native: Object.fromEntries(['ios', 'android'].map(platform => [platform, {
        currentDeclaredSupport: component.support[platform],
        savedCatalogSupport: saved.get(component.tag)?.support?.[platform] ?? null,
        savedCatalogSupportMatches: JSON.stringify(saved.get(component.tag)?.support?.[platform]) === JSON.stringify(component.support[platform]),
        appearanceParity: 'pending',
        note: 'Adapter presence and supported-member declarations do not establish behavioral, visual or device parity.',
      }])),
      browserPortabilityFindings: component.diagnostics,
      audit: { baseline: 'pending', current: 'pending', gates: pending(), priorEvidence: evidence },
    });
  }
  const edges = new Map(records.map(item => [item.tag, item.dependencies.direct]));
  for (const item of records) item.dependencies.transitive = dependencyClosure(item.tag, edges);
  const required = new Set([...visible.keys()].flatMap(tag => dependencyClosure(tag, edges)));
  const counts = list => Object.fromEntries(['ios', 'android'].map(platform => [platform, {
    missingAdapters: list.filter(item => item.native[platform].currentDeclaredSupport.status === 'missing-adapter').length,
    componentsWithDeclaredGaps: list.filter(item => families.some(family => item.native[platform].currentDeclaredSupport[`unsupported${family}`].length)).length,
    unsupported: Object.fromEntries(families.map(family => [family.toLowerCase(),
      list.reduce((sum, item) => sum + item.native[platform].currentDeclaredSupport[`unsupported${family}`].length, 0)])),
  }]));
  const visibleRecords = records.filter(item => item.visibleInLaboratory);
  return {
    schemaVersion: 1, capturedAt,
    provenance: {
      repositoryHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      worktreeHadChanges: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
      inputSha256: Object.fromEntries([...inputs].sort(([a], [b]) => a.localeCompare(b))),
      meaning: 'Snapshot of source contracts and support claims, not test coverage or parity certification. Hashes identify the read inputs; files may change after capture.',
    },
    scope: {
      visibleCount: navigation.total, sourceTagCount: records.length,
      visibleTags: navigation.groups.flatMap(group => group.items.map(item => item.tag)),
      groups: navigation.groups,
      supportingTags: records.filter(item => !item.visibleInLaboratory).map(item => ({
        tag: item.tag, parent: item.parent, requiredByVisibleScope: required.has(item.tag),
        requiredBy: visibleRecords.filter(parent => parent.dependencies.transitive.includes(item.tag)).map(parent => parent.tag),
      })),
    },
    summary: {
      visibleContracts: Object.fromEntries(['properties', 'events', 'slots', 'methods', 'cssParts', 'cssProperties', 'actualCssHooks'].map(family =>
        [family, visibleRecords.reduce((sum, item) => sum + item.contract[family].length, 0)])),
      visibleDeclaredGaps: counts(visibleRecords), allTagsDeclaredGaps: counts(records),
      acceptedComponents: 0, pendingVisibleAudits: visibleRecords.length,
    },
    components: records,
  };
}

export function initialLedger(inventory) {
  const gap = (item, platform) => families.map(family => item.native[platform].currentDeclaredSupport[`unsupported${family}`].length).join('/');
  const ordered = inventory.scope.visibleTags.map(tag => inventory.components.find(item => item.tag === tag));
  return `# Native parity audit ledger

Baseline captured ${inventory.capturedAt} from a modified checkout at \`${inventory.provenance.repositoryHead}\`.

The scope is **${inventory.scope.visibleCount} visible Laboratory components**, with **${inventory.scope.supportingTags.length} supporting tags**, **${inventory.scope.sourceTagCount} source tags in total**. The actual Astro sidebar exclusion policy and docs manifest determine visibility. Source contracts and support claims are preserved in [baseline-inventory.json](baseline-inventory.json), with file hashes. No component is accepted by this new audit yet.

## Status and evidence

Every baseline and current audit starts **pending**. Adapter declarations, an empty unsupported list, compilation, a source test count, or a high coverage percentage do not establish parity. The button has prior task-reported macOS SwiftUI and Android verification; **iOS simulator/device runtime remains unverified**. Prior results must be linked to exact artifacts and reviewed, not silently promoted to current certification.

Work one visible component at a time, including its required child tags. Update its row only after attaching evidence. Record the tested commit plus dirty-file hashes, platform/OS/runtime versions, exact commands, result files and visual captures. Preserve failed runs. Keep source coverage linked to the same run that produced test results; never use another suite's percentage.

## Required gates for each component

1. Source contract: manually review every property/default/enum/optional value, event payload/order/cancellation, slot/fallback, method, CSS hook/part, internal parent contract and lifecycle path. Resolve CEM/source drift.
2. Implementation: match layout, tokens, density, themes, sizing constraints, RTL, state changes, motion/reduced motion, icons, focus and keyboard/pointer behavior. Use real native equivalents; no baked screenshots or fake measurements.
3. Laboratory: expose every supported property/style/slot and meaningful method interaction; keep preview, controls, events and copyable HTML/React/Angular/Vue/Svelte/SwiftUI/Android examples synchronized. Compile copied native examples.
4. Behavioral evidence: targeted unit and native component tests, host integration, interaction/cancellation/disabled/edge cases, cleanup/reconnect and dependency compositions. Run current Web reference tests as appropriate.
5. Visual evidence: compare measured Web/native boxes, spacing, colors, typography and states on the same fixtures, including light/dark, all size/density variants, RTL and constrained/overflow dimensions. Explain platform raster differences rather than falsifying equality.
6. Runtime and accessibility: separately record macOS SwiftUI, iOS simulator/device, and Android emulator/device execution. Verify names/roles/states, focus order, soft/hard disabled behavior, keyboard navigation and platform accessibility checks. A macOS pass is not an iOS pass.
7. Independent final audit: a separate reviewer reruns or inspects current evidence and checks all gates, dependencies, source/support metadata and documented exceptions. A component remains pending/blocked if required evidence is missing.

## Exception policy

An exception requires the exact source behavior, affected platform and API, technical reason, user impact, tested native equivalent, evidence link, reviewer and explicit acceptance. Scope it to the smallest behavior. Do not waive implementable gaps as “platform differences.” Browser-only facilities (DOM objects, browser navigation contexts, CSS selector syntax) may need named native equivalents, but their observable effects still require tests. Missing iOS execution is an unverified gate, not an accepted exception. No exceptions are accepted in this baseline.

## Component queue

Gap columns are **properties/events/methods/slots** from current declared native support at baseline capture. They exclude unmeasured appearance and semantic gaps. “Pending” applies to both baseline and current audit. Rows are in actual Laboratory navigation order.

CSS counts include declared hooks plus additional own CSS variable references captured in the baseline; they are not limited to comment metadata.

| Component | Category | Contract P/E/M/S/CSS | iOS declared gaps | Android declared gaps | Current audit |
| --- | --- | --- | --- | --- | --- |
${ordered.map(item => `| \`${item.tag}\` | ${item.category} | ${['properties', 'events', 'methods', 'slots', 'actualCssHooks'].map(key => item.contract[key].length).join('/')} | ${gap(item, 'ios')} | ${gap(item, 'android')} | Pending${item.tag === 'md-button' ? ' · prior macOS/Android evidence; iOS unverified' : ''} |`).join('\n')}

## Supporting tags

These are in scope through their parent/composition dependencies. A parent cannot be accepted with an unreviewed required child. Static-reference edges are conservative review leads, not proof that every runtime path uses every dependency.

| Supporting tag | Declared parent | Needed by visible scope |
| --- | --- | --- |
${inventory.scope.supportingTags.map(item => `| \`${item.tag}\` | ${item.parent ? `\`${item.parent}\`` : 'None declared'} | ${item.requiredByVisibleScope ? 'Yes' : 'Needs manual ownership assignment'} |`).join('\n')}

## Updating evidence

Keep baseline-inventory.json immutable. Generate a fresh source/support snapshot with:

\`\`\`sh
node docs/native-parity/build-inventory.mjs --output docs/native-parity/current-inventory.json
\`\`\`

The generator deliberately initializes audit gates as pending; it cannot certify a run or replace this manually maintained ledger. Compare hashes and contract differences, attach run evidence, then update this ledger. Baseline creation uses an exclusive write and refuses to overwrite the baseline.
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), baseline = args.length === 1 && args[0] === '--baseline';
  if (!baseline && !(args.length === 2 && args[0] === '--output')) throw new Error('Use --baseline once, or --output <snapshot.json>.');
  const destination = resolve(repository, baseline ? 'docs/native-parity/baseline-inventory.json' : args[1]);
  if (!baseline && destination === resolve(repository, 'docs/native-parity/baseline-inventory.json')) throw new Error('The baseline is immutable; choose a current snapshot path.');
  const inventory = await buildInventory();
  await writeFile(destination, JSON.stringify(inventory, null, 2) + '\n', { flag: baseline ? 'wx' : 'w' });
  if (baseline) await writeFile(resolve(repository, 'docs/native-parity/AUDIT.md'), initialLedger(inventory), { flag: 'wx' });
  console.log(`${relative(repository, destination)}: ${inventory.scope.visibleCount} visible, ${inventory.scope.sourceTagCount} total; all current audit gates pending.`);
}
