#!/usr/bin/env node
/**
 * generate-docs.mjs
 *
 * Scans packages/core/src/components/ and generates the docs site's
 * component METADATA. It does not write any page content.
 *
 *   - apps/docs/src/data/components/{name}.json  (per component, feeds <ApiTable />)
 *   - apps/docs/src/data/components.json         (aggregate: sidebar, search, landing)
 *   - apps/docs/src/data/stats.json              (counts for the landing page)
 *
 * Everything is parsed from the .tsx/.css sources, so the API tables on the
 * docs site cannot drift from the components they document.
 *
 * MDX PAGES ARE NOT GENERATED. Every page under
 * apps/docs/src/content/docs/components/ is hand-authored against a single
 * uniform template and is the source of truth on disk. The MDX rendering
 * layer that used to live here was removed deliberately — it built pages by
 * copying each component's readme.md above the `Auto Generated Below`
 * marker, and that content is now structured for LLM consumption
 * (`<!-- llm:meta -->` blocks, different H2 headings), which neither parses
 * as MDX nor matches the old demo-injection keys.
 *
 * Run:   node scripts/generate-docs.mjs
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENTS_DIR = join(ROOT, 'packages/core/src/components');
const STORIES_DIR = join(ROOT, 'apps/storybook/src/stories');
const PAGES_DIR = join(ROOT, 'apps/docs/src/content/docs/components');
const DATA_DIR = join(ROOT, 'apps/docs/src/data/components');
const DATA_ROOT = join(ROOT, 'apps/docs/src/data');

/* ------------------------------------------------------------------ */
/*  Category Taxonomy                                                  */
/* ------------------------------------------------------------------ */
/*  Category Taxonomy — DERIVED FROM STORYBOOK                         */
/* ------------------------------------------------------------------ */

/*
 * Storybook is the source of truth for BOTH the component roster and its
 * category organisation. Each story's `title: 'Category/Name'` supplies the
 * category, and having a story is what makes something a component rather
 * than an internal part.
 *
 * This replaced a hand-maintained CATEGORIES map that had drifted badly: it
 * listed every directory under packages/core/src/components, so the docs
 * claimed 79 components when Storybook documents 52. The other 27 are
 * sub-components (11 table parts, 3 menu children, 3 tab parts, …) that
 * Storybook demonstrates inside their parent's story, plus two genuine
 * components that have no story yet (see SUB_COMPONENT_PARENT below).
 *
 * Sub-components still get a page and API data — they are real custom
 * elements people search for — but they inherit their parent's category and
 * are flagged `subComponentOf` so they can be presented as parts rather than
 * counted as components.
 */

/** Explicit parent for every element that is a part of another component.
 *  Prefix matching alone is not enough (md-tab -> md-tabs, md-step ->
 *  md-stepper, md-select-option -> md-select). */
const SUB_COMPONENT_PARENT = {
  'md-accordion-item': 'md-accordion',
  'md-breadcrumb-item': 'md-breadcrumbs',
  'md-fab-menu-item': 'md-fab-menu',
  'md-list-item': 'md-list',
  'md-menu-item': 'md-menu',
  'md-menu-item-group': 'md-menu',
  'md-sub-menu-item': 'md-menu',
  'md-navigation-rail-tab': 'md-navigation-rail',
  'md-navigation-tab': 'md-navigation-bar',
  'md-segmented-button': 'md-segmented-button-set',
  'md-select-option': 'md-select',
  'md-step': 'md-stepper',
  'md-tab': 'md-tabs',
  'md-tab-panel': 'md-tabs',
  'md-tab-panels': 'md-tabs',
  'md-table-body': 'md-table',
  'md-table-cell': 'md-table',
  'md-table-container': 'md-table',
  'md-table-expand-toggle': 'md-table',
  'md-table-foot': 'md-table',
  'md-table-head': 'md-table',
  'md-table-pagination': 'md-table',
  'md-table-row': 'md-table',
  'md-table-sort-label': 'md-table',
  'md-table-toolbar': 'md-table',
};

/*
 * Components that have no Storybook story but ARE standalone components, so
 * they must not be dropped from the roster. Keep this list EMPTY by adding
 * the story instead — it exists only so a missing story degrades into a
 * documented exception rather than a silently vanishing component.
 */
const NO_STORY_COMPONENTS = {
  'md-ripple': 'Containment',
};

/** Read `title: 'Category/Name'` + `component: 'md-x'` out of every story
 *  file. Non-component stories (Foundations, Recipes) are ignored. */
async function readStorybookTaxonomy() {
  const byTag = new Map();
  const order = [];
  for (const file of (await readdir(STORIES_DIR)).filter((f) => f.endsWith('.stories.ts'))) {
    const src = await readFile(join(STORIES_DIR, file), 'utf-8');
    const title = src.match(/title:\s*['"]([^'"]+)['"]/);
    const tag = src.match(/component:\s*['"](md-[a-z-]+)['"]/);
    if (!title || !tag) continue;
    const category = title[1].split('/')[0].trim();
    byTag.set(tag[1], category);
    if (!order.includes(category)) order.push(category);
  }
  for (const [tag, category] of Object.entries(NO_STORY_COMPONENTS)) {
    if (!byTag.has(tag)) byTag.set(tag, category);
  }
  return { byTag, order: order.sort() };
}

/*
 * Sidebar / search visibility is DERIVED, not curated.
 *
 * A component is listed in components.json — which drives the left-nav, the
 * landing page and search — only once apps/docs/src/content/docs/components/
 * <slug>.mdx actually exists. There is no hand-maintained hide-list to fall
 * out of date, and it is structurally impossible to ship a nav entry that
 * links to a missing page.
 *
 * Per-component JSON is written either way, so the API data is already in
 * place the moment a page is added.
 */
let importedJsonSlugs = null;
/**
 * Slugs whose API JSON is imported by SOME page, even though they have no page
 * of their own. Merged sub-components live here: md-fab-menu-item folded into
 * the FAB Menu page and md-segmented-button-set into Segmented Button, but both
 * parents still render the child's ApiTable. Without this they'd be skipped and
 * their JSON would quietly rot at whatever it was on merge day.
 */
function jsonImportedByAPage(slug) {
  if (importedJsonSlugs === null) {
    importedJsonSlugs = new Set();
    for (const f of readdirSync(PAGES_DIR)) {
      if (!f.endsWith('.mdx')) continue;
      const src = readFileSync(join(PAGES_DIR, f), 'utf-8');
      for (const m of src.matchAll(/data\/components\/([a-z0-9-]+)\.json/g)) {
        importedJsonSlugs.add(m[1]);
      }
    }
  }
  return importedJsonSlugs.has(slug);
}

function hasPage(tag) {
  const slug = tagToSlug(tag);
  return existsSync(join(PAGES_DIR, `${slug}.mdx`)) || jsonImportedByAPage(slug);
}

/* ------------------------------------------------------------------ */
/*  TSX Parsing                                                        */
/* ------------------------------------------------------------------ */

/** Normalize @Prop blocks split across lines (decorator / union types). */
function collapseMultilineProps(source) {
  // Multiline union types only (e.g. variant — each line starts with |)
  let result = source.replace(
    /@Prop\(([^)]*)\)\s*\r?\n\s*(\w+)\s*:\s*((?:\r?\n\s*\|[^\r\n]+)+)\s*(?:=\s*([^;]+))?\s*;/g,
    (_, decArgs, name, rawType, rawDefault) => {
      const type = rawType.replace(/\r?\n\s*\|/g, ' |').replace(/\s+/g, ' ').trim();
      const def = rawDefault?.replace(/\s+/g, ' ').trim();
      return def
        ? `@Prop(${decArgs}) ${name}: ${type} = ${def};`
        : `@Prop(${decArgs}) ${name}: ${type};`;
    },
  );
  // @Prop on one line, property signature on the next
  result = result.replace(
    /@Prop\(([^)]*)\)\s*\r?\n\s*(\w+)\s*:\s*([^\n=;]+?)\s*(?:=\s*([^;]+))?\s*;/g,
    (_, decArgs, name, rawType, rawDefault) => {
      const type = rawType.replace(/\s+/g, ' ').trim();
      const def = rawDefault?.replace(/\s+/g, ' ').trim();
      return def
        ? `@Prop(${decArgs}) ${name}: ${type} = ${def};`
        : `@Prop(${decArgs}) ${name}: ${type};`;
    },
  );
  return result;
}



/**
 * One-level index of the library's exported type aliases, so a prop typed
 * `MdAvatarShape` can be tested as the union it actually is. Built once from
 * every .ts/.tsx under the components dir plus the shared types barrel; only
 * single-line `type X = …;` declarations are indexed, which is the shape every
 * enum-ish prop alias in this library uses.
 */
/** `export interface X { … }` bodies, kept verbatim for the docs' type blocks. */
const INTERFACES = new Map();

const TYPE_ALIASES = (() => {
  const index = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name)) {
        const src = readFileSync(p, 'utf8');
        for (const m of src.matchAll(/^\s*export\s+type\s+(\w+)\s*=\s*([\s\S]*?);/gm)) {
          if (!index.has(m[1])) index.set(m[1], m[2].replace(/\s+/g, ' ').trim());
        }
        // Interfaces keep their body verbatim — the field comments are the
        // documentation, so reformatting them would throw away the useful half.
        for (const m of src.matchAll(
          /^[ \t]*export\s+interface\s+(\w+)(\s+extends\s+[\w, ]+)?\s*\{([\s\S]*?)\n\}/gm,
        )) {
          const name = m[1];
          if (INTERFACES.has(name)) continue;
          INTERFACES.set(name, {
            name,
            extends: (m[2] ?? '').replace(/\s*extends\s*/, '').trim(),
            body: m[3].replace(/^\n+|\s+$/g, ''),
          });
        }
      }
    }
  };
  try {
    // The whole of src, not just the components dir: the chart aliases
    // (MdChartStackMode, MdChartCurve, …) live under src/utils/charts/types.ts
    // and are string unions that DO carry an attribute.
    walk(join(ROOT, 'packages/core/src'));
  } catch {
    /* an unreadable tree just means fewer aliases resolve — see the fallback */
  }
  return index;
})();

const resolveTypeAlias = (name) => TYPE_ALIASES.get(name) ?? null;

/**
 * Does Stencil actually create an HTML attribute for a prop of this type?
 *
 * Only primitives serialise to an attribute: string, number, boolean, and
 * unions of their literals. A function, array, object or class-typed prop is
 * JS-only — you assign it as a property and there is no attribute at all.
 *
 * This used to be assumed rather than checked: any @Prop without an explicit
 * `attribute:` option got `camelToKebab(name)`, so the API tables advertised
 * `get-label`, `ring-widths`, `format-options`, `options`… for props that have
 * no such attribute. A reader who tried one saw nothing happen and no reason
 * why.
 *
 * Named aliases are resolved one level (`MdAvatarShape` → `'circle' | …`)
 * against the library's type declarations, because most enum-ish props are
 * declared that way and DO get an attribute. Anything that cannot be resolved
 * is assumed to have one — the conservative direction, matching the old
 * behaviour rather than silently hiding a real attribute.
 */
const PRIMITIVE_ARM =
  /^(?:string|number|boolean|any|'[^']*'|-?\d+(?:\.\d+)?|true|false)$/;

/** `(string & {})` — the "any string, but keep autocomplete" idiom. It is a
 *  string as far as the DOM is concerned, so it does carry an attribute. */
const WIDENED_PRIMITIVE = /^\(\s*(string|number)\s*&\s*\{\s*\}\s*\)$/;

function armIsAttributeSerialisable(arm, resolveAlias, depth) {
  const a = arm.trim();
  if (!a || a === 'undefined' || a === 'null') return false;
  if (PRIMITIVE_ARM.test(a) || WIDENED_PRIMITIVE.test(a)) return true;
  // Structurally complex: function, array/tuple, object literal, index map.
  if (/=>|\[\]|\{|\bRecord</.test(a)) return false;
  if (depth > 2) return false;
  const alias = resolveAlias?.(a);
  // An unresolved bare identifier is an out-of-library type (Intl.*, Date,
  // a DOM interface) — those are objects, not attribute values. Every
  // enum-ish alias this library declares IS in the index.
  if (!alias) return false;
  return attributeSerialisable(alias, resolveAlias, depth + 1);
}

/**
 * A prop gets an attribute when ANY arm of its type can come from one — a
 * `string | string[]` prop is still settable as `foo="x"`. Only a type with no
 * primitive arm at all (a function, an array, an options object) is JS-only.
 */
function attributeSerialisable(type, resolveAlias, depth = 0) {
  const t = String(type ?? '').trim().replace(/^\|/, '');
  if (!t) return true;
  return splitUnion(t).some((arm) => armIsAttributeSerialisable(arm, resolveAlias, depth));
}

/** Split on top-level `|` only — never inside (), <> or {}. */
function splitUnion(type) {
  const out = [];
  let depth = 0;
  let buf = '';
  for (const ch of type) {
    if ('(<{['.includes(ch)) depth++;
    else if (')>}]'.includes(ch)) depth--;
    if (ch === '|' && depth === 0) {
      out.push(buf);
      buf = '';
    } else buf += ch;
  }
  out.push(buf);
  return out.filter((a) => a.trim());
}

/** Named types mentioned anywhere in a type expression, in source order. */
function namedTypesIn(type) {
  return [...String(type ?? '').matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)]
    .map((m) => m[1])
    .filter((n) => !['Array', 'Record', 'Partial', 'Promise', 'Date', 'Intl', 'CustomEvent', 'HTMLElement', 'Element', 'Map', 'Set'].includes(n));
}

/**
 * The shapes a consumer has to construct or read: every named interface behind
 * a complex prop (the data model) and behind an event detail (the output
 * model). Resolved one level — a referenced interface's own references are
 * pulled in too, which is how MdAutocompleteOption drags in SelectOptionInit.
 */
function collectTypeModels(component) {
  const seen = new Set();
  const out = [];

  const pull = (typeExpr, depth = 0) => {
    if (depth > 2) return;
    for (const name of namedTypesIn(typeExpr)) {
      if (seen.has(name)) continue;
      const decl = INTERFACES.get(name);
      const alias = TYPE_ALIASES.get(name);
      if (!decl && !alias) continue;
      seen.add(name);
      out.push(
        decl
          ? { name, kind: 'interface', extends: decl.extends, body: decl.body }
          : { name, kind: 'type', body: alias },
      );
      if (decl) pull(decl.body + ' ' + (decl.extends ?? ''), depth + 1);
    }
  };

  /* Data model: props whose value has a SHAPE — an interface, an object/array
     literal, or a function signature.
     Not simply "props without an attribute": several of these now accept a JSON
     string on the attribute as well as the array on the property, which gave
     them an attribute and would have silently dropped them from the model. The
     shape is what needs documenting either way. Enum-ish aliases
     (`MdAvatarShape`) are excluded — the props table's type column says it all. */
  const dataProps = component.props.filter(
    (p) =>
      /=>|\[\]|\{/.test(p.type) ||
      namedTypesIn(p.type).some((n) => INTERFACES.has(n)),
  );
  for (const p of dataProps) pull(p.type);
  const dataTypes = out.slice();

  /* A function prop has no named declaration to resolve — its SIGNATURE is the
     contract, and it is the half a reader cannot guess (what am I handed, what
     must I return?). Emit it as a callable type so it renders beside the
     interfaces instead of being the one JS-only prop with nothing to show. */
  const callables = dataProps
    .filter((p) => p.type.includes('=>'))
    .map((p) => ({
      name: p.name,
      kind: 'callable',
      body: p.type.replace(/\s+/g, ' ').trim(),
    }));

  // Output model: event payloads. Inline object literals are shown as-is —
  // they have no name to resolve, but they are still the contract.
  const before = out.length;
  for (const e of component.events) pull(e.detail);
  const eventNamed = out.slice(before);

  return {
    dataTypes,
    callableProps: callables,
    eventTypes: eventNamed,
    eventPayloads: component.events.map((e) => ({ name: e.name, detail: e.detail })),
  };
}

function parseTsx(source) {
  const component = { props: [], events: [], methods: [], slots: [], cssParts: [], dependencies: [] };
  let normalized = collapseMultilineProps(source);

  // Brace-balanced scan, NOT /@Component\(\{([^}]+)\}\)/. That pattern stops at
  // the first `}`, so any decorator containing a nested object — e.g.
  // `shadow: { delegatesFocus: true }` on md-text-field — failed to match and
  // the component was reported as having no @Component decorator at all. That
  // aborted the whole generator, which is why the docs data had been stale
  // since June while the source moved on.
  const compStart = normalized.indexOf('@Component({');
  let inner = '';
  if (compStart !== -1) {
    let depth = 0;
    let i = normalized.indexOf('{', compStart);
    const from = i + 1;
    for (; i < normalized.length; i++) {
      if (normalized[i] === '{') depth++;
      else if (normalized[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    inner = normalized.slice(from, i);
  }
  const compMatch = inner ? [null, inner] : null;
  if (compMatch) {
    component.tag = inner.match(/tag:\s*'([^']+)'/)?.[1] ?? '';
    component.shadow = !/shadow:\s*false/.test(inner);
  }

  // The scan below is line-by-line, so a @Prop whose type or default wraps onto
  // the following lines never matches -- the regex needs its `;` on the same
  // line. That silently dropped md-chip's `color` (a union split one arm per
  // line) and md-checkbox's `valueMissingLabel` (default on the next line).
  // The normalizer above only rejoins the decorator-on-its-own-line shape, so
  // collapse every @Prop statement onto a single line first.
  normalized = normalized.replace(/@Prop\([^)]*\)[^;]*;/g, (stmt) =>
    stmt.replace(/\s*\r?\n\s*/g, ' '),
  );

  const normalizedLines = normalized.split('\n');
  for (const [lineIndex, line] of normalizedLines.entries()) {
    // The type stops at an ASSIGNMENT `=`, never at the `=>` of a function
    // signature. Splitting on a bare `=` truncated every function prop:
    // `getLabel: (value: number) => string` was recorded as type
    // `(value: number)` with a default of `> string`, which then showed up in
    // the API table exactly that way.
    const propMatch = line.match(
      /@Prop\(([^)]*)\)\s+(?:private\s+)?(\w+)\??\s*:\s*((?:[^=;]|=>)+?)(?:\s*=(?!>)\s*([^;]+))?\s*;/,
    );
    if (propMatch) {
      const [, decArgs, name, rawType, rawDefault] = propMatch;
      const explicitAttr = decArgs.match(/attribute:\s*'([^']+)'/)?.[1];
      const type = rawType.trim();
      component.props.push({
        name,
        // An explicit `attribute:` always wins; otherwise only derive one when
        // the type can actually round-trip through an attribute.
        attribute: explicitAttr ?? (attributeSerialisable(type, resolveTypeAlias) ? camelToKebab(name) : ''),
        type,
        default: rawDefault?.trim() ?? '',
        reflect: /reflect:\s*true/.test(decArgs),
        mutable: /mutable:\s*true/.test(decArgs),
      });
    }


    // `@Method()` may sit on its own line above the signature OR share the line
    // with it (`@Method() async show() {`). Only the first shape used to match,
    // and the match was made by searching the file for the line's TEXT — so an
    // identical signature elsewhere resolved to the wrong index. md-search
    // writes all six of its methods same-line and published `methods: []`,
    // which is why its docs page had to hand-maintain a Methods table.
    const methodSig = line.match(/async\s+(\w+)\s*\(([^)]*)\)/);
    if (methodSig) {
      const decorated =
        line.includes('@Method()') ||
        (lineIndex > 0 && normalizedLines[lineIndex - 1].includes('@Method()'));
      if (decorated) {
        component.methods.push({ name: methodSig[1], params: methodSig[2].trim() });
      }
    }
  }

  /*
   * Scan for slots with COMMENTS STRIPPED.
   *
   * md-breadcrumbs.tsx carries a comment explaining why it deliberately does
   * NOT expose `<slot name="separator">` — and the raw-source scan matched the
   * tag inside that very comment, inventing a slot the component does not
   * have. A phantom slot is worse than a missing one: it gets documented, and
   * consumers write markup that silently projects nowhere.
   *
   * `//` is only treated as a line comment when it is not preceded by `:` so
   * that URLs inside string literals survive.
   */
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  let hasDefaultSlot = false;
  for (const m of codeOnly.matchAll(/<slot(\s[^>]*)?\s*\/?>/g)) {
    const attrs = m[1] || '';
    const nameMatch = attrs.match(/name="([^"]+)"/);
    if (nameMatch) {
      if (!component.slots.find((s) => s.name === nameMatch[1])) {
        component.slots.push({ name: nameMatch[1], description: '' });
      }
    } else {
      hasDefaultSlot = true;
    }
  }
  if (hasDefaultSlot) component.slots.unshift({ name: '(default)', description: '' });

  for (const m of source.matchAll(/part="([^"]+)"/g)) {
    const name = m[1];
    /* `part="…"` also appears inside SELECTOR strings — md-date-picker does
       `querySelector(`[part="${part}"]`)` — and a template placeholder is never
       a real part name. Without this guard the API table advertised a part
       literally called `${part}`. */
    if (name.includes('${') || name.includes('`')) continue;
    if (!component.cssParts.find((p) => p.name === name)) {
      component.cssParts.push({ name, description: '' });
    }
  }

  /*
   * Parts forwarded from a child component with `exportparts`. These are every
   * bit as public as the ones a component declares itself — md-area-chart
   * re-exports md-slider's track and thumbs as `zoom-track` / `zoom-window` /
   * `zoom-handle` — but they carry no `part="…"` here, so the scan above misses
   * them and they never reached the docs at all.
   *
   * Syntax is `inner: exported, inner2: exported2`; the EXPORTED name (after the
   * colon) is what a consumer writes in `::part()`. A bare entry with no colon
   * exports under its own name.
   */
  for (const m of source.matchAll(/exportparts="([^"]+)"/g)) {
    for (const entry of m[1].split(',')) {
      const name = (entry.includes(':') ? entry.slice(entry.indexOf(':') + 1) : entry).trim();
      if (name && !component.cssParts.find((p) => p.name === name)) {
        component.cssParts.push({ name, description: '' });
      }
    }
  }

  for (const m of source.matchAll(/<(md-[\w-]+)/g)) {
    if (m[1] !== component.tag && !component.dependencies.includes(m[1])) {
      component.dependencies.push(m[1]);
    }
  }

  /*
   * Events — parsed against the WHOLE source, not line-by-line.
   *
   * A real declaration spans two lines and carries the definite-assignment
   * modifier, which a single-line regex cannot see:
   *
   *     @Event({ cancelable: true, bubbles: true, composed: true })
   *     mdClick!: EventEmitter<MdButtonClickDetail>;
   *
   * The previous per-line pattern required `@Event(...) name: EventEmitter<T>`
   * on one line with no `!`, so it silently missed the events of 22 of the 51
   * documented components (md-button reported none at all). Empty output is
   * indistinguishable from "this component has no events", which is why it
   * went unnoticed.
   *
   * The lazy `>\s*;` terminator is deliberate: detail types routinely contain
   * semicolons inside object literals (`EventEmitter<{ moved: string[]; target:
   * string[] }>`), so we stop at the first `>` that is actually followed by the
   * statement terminator rather than at the first `;`.
   */
  const EVENT_RE =
    /@Event\(([^)]*)\)\s*([A-Za-z_$][\w$]*)[!?]?\s*:\s*EventEmitter<([\s\S]*?)>\s*;/g;
  for (const m of source.matchAll(EVENT_RE)) {
    component.events.push({
      name: m[2],
      detail: m[3].replace(/\s+/g, ' ').trim(),
    });
  }

  return component;
}

/* ------------------------------------------------------------------ */
/*  CSS Parsing                                                        */
/* ------------------------------------------------------------------ */

function parseCss(source, tagName) {
  const slug = tagName.replace(/^md-/, '');
  const prefix = `--md-${slug}-`;
  const cssCustomProps = [];
  const slotDescriptions = {};
  const partDescriptions = {};

  const headerMatch = source.match(/\/\*[\s\S]*?\*\//);
  if (headerMatch) {
    let section = '';
    for (const line of headerMatch[0].split('\n')) {
      // `continue` on a section header, so the header line is never also read
      // as an entry: `CSS PARTS:` otherwise matches the `name  description`
      // shape below and yields a part literally named "CSS".
      if (/CSS CUSTOM PROPERTIES/i.test(line)) {
        section = 'props';
        continue;
      } else if (/CSS PARTS/i.test(line)) {
        section = 'parts';
        continue;
      } else if (/SLOTS/i.test(line)) {
        section = 'slots';
        continue;
      } else if (/={3,}/.test(line)) {
        section = '';
        continue;
      }

      if (section === 'props') {
        const m = line.match(new RegExp(`(${escapeRegex(prefix)}[\\w-]+)\\s{2,}(.+)`));
        if (m) cssCustomProps.push({ name: m[1].trim(), description: m[2].trim() });
      }
      if (section === 'parts') {
        const m = line.match(/^\s+([\w-]+)\s+(.+)/);
        if (m && !m[1].startsWith('=')) partDescriptions[m[1].trim()] = m[2].trim();
      }
      if (section === 'slots') {
        const m = line.match(/^\s+([\w-]+)\s+(.+)/);
        if (m && !m[1].startsWith('=')) slotDescriptions[m[1].trim()] = m[2].trim();
      }
    }
  }

  for (const m of source.matchAll(new RegExp(`var\\((${escapeRegex(prefix)}[\\w-]+)`, 'g'))) {
    if (!cssCustomProps.find((p) => p.name === m[1])) {
      cssCustomProps.push({ name: m[1], description: '' });
    }
  }

  return { cssCustomProps, slotDescriptions, partDescriptions };
}

function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tagToReactName(tag) {
  return tag
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function tagToSlug(tag) {
  return tag.replace(/^md-/, '');
}

/**
 * Words that are acronyms, not words. Title-casing them produced "Otp Field"
 * and "Fab" in the sidebar while the pages themselves said "OTP Field" and
 * "FAB" — the same component named two ways depending on where you looked.
 */
const TITLE_ACRONYMS = new Map([
  ['otp', 'OTP'],
  ['fab', 'FAB'],
  ['rtl', 'RTL'],
  ['url', 'URL'],
  ['api', 'API'],
  ['css', 'CSS'],
  ['html', 'HTML'],
  ['svg', 'SVG'],
  ['ui', 'UI'],
]);

function tagToTitle(tag) {
  return tag
    .replace(/^md-/, '')
    .split('-')
    .map((w) => TITLE_ACRONYMS.get(w) ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function tagToStoryId(tag) {
  const title = tagToTitle(tag).replace(/ /g, '');
  return `components-${title.toLowerCase()}--playground`;
}

/** Build a Storybook story ID from story filenames */
async function findStoryId(tag) {
  const pascalName = tagToReactName(tag);
  const storyFile = `${pascalName}.stories.ts`;
  const fullPath = join(STORIES_DIR, storyFile);

  if (!existsSync(fullPath)) return null;

  const content = await readFile(fullPath, 'utf-8');
  /*
   * Accept single OR double quotes. Story files are not linted for quote style
   * and 4 of the 55 use double quotes — md-date-picker, md-time-picker and
   * md-progress-indicator among them. A single-quote-only pattern returned
   * null for those, which reads exactly like "this component has no story",
   * so their docs pages silently lost the Open in Storybook link.
   */
  const titleMatch = content.match(/title:\s*['"]([^'"]+)['"]/);
  if (!titleMatch) return null;

  /*
   * Match @storybook/csf's `sanitize()`: lowercase, then every run of
   * non-alphanumerics (spaces AND slashes) collapses to a single hyphen.
   *
   * The previous version stripped spaces instead of hyphenating them, so
   * "Data Display/Table" produced `datadisplay-table` where Storybook's real
   * id is `data-display-table`. That broke the Open in Storybook link on 29 of
   * 53 pages — every component whose name or category is more than one word.
   */
  const sanitize = (v) =>
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const storyTitle = sanitize(titleMatch[1]);

  const exports = [...content.matchAll(/export\s+const\s+(\w+)\s*[:=]/g)].map(m => m[1]);
  const primaryExport = exports.find(e => e !== 'default' && e !== 'meta');
  const storyName = primaryExport
    ? sanitize(primaryExport.replace(/([A-Z])/g, ' $1'))
    : 'primary';

  return `${storyTitle}--${storyName}`;
}

/* ------------------------------------------------------------------ */
/*  MDX Generation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build rich, technology-idiomatic usage snippets for the `## Usage` block.
 *
 * Each tab shows three things in one paste-able block:
 *   1. The minimal SETUP that technology needs (loader import, NgModule, …)
 *   2. A realistic USAGE example with a representative attribute/prop
 *   3. EVENT HANDLING (only if the component actually emits events)
 *
 * The shape of each snippet is deliberately uniform so users can compare
 * technologies side-by-side without re-orienting between examples.
 */
async function main() {
  const entries = await readdir(COMPONENTS_DIR, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

  await mkdir(DATA_DIR, { recursive: true });

  const allComponents = [];
  const { byTag: STORY_CATEGORY, order: CATEGORY_ORDER } = await readStorybookTaxonomy();
  const errors = [];
  const skipped = [];

  for (const dir of dirs) {
    const base = join(COMPONENTS_DIR, dir);
    const tsxPath = join(base, `${dir}.tsx`);
    // Empty placeholder dirs (planned but unimplemented components) are skipped
    // with a notice — they aren't real defects, just future work.
    if (!existsSync(tsxPath)) {
      skipped.push(dir);
      continue;
    }
    // Components explicitly hidden from the docs site (e.g. deprecated
    // wrappers that still ship in @awc-ui/core but no longer warrant a
    // dedicated page). Bail before parse so we don't even build their
    // MDX / JSON artefacts or include them in components.json.
    if (!hasPage(dir)) {
      skipped.push(`${dir} (no page yet)`);
      continue;
    }

    const tsx = await readFile(tsxPath, 'utf-8');
    const component = parseTsx(tsx);
    // From here on, a TSX file exists — any parsing failure IS a real defect.
    if (!component.tag) {
      errors.push(`Component dir ${dir} has TSX but no @Component({ tag: '...' }) decorator`);
      continue;
    }
    if (!component.tag.startsWith('md-')) {
      errors.push(`Component ${dir} has tag "${component.tag}" — expected md-* prefix`);
      continue;
    }

    // CSS
    const cssPath = join(base, `${dir}.css`);
    if (existsSync(cssPath)) {
      const css = await readFile(cssPath, 'utf-8');
      const cssInfo = parseCss(css, component.tag);
      component.cssCustomProps = cssInfo.cssCustomProps;

      for (const s of component.slots) {
        if (cssInfo.slotDescriptions[s.name]) s.description = cssInfo.slotDescriptions[s.name];
      }
      for (const p of component.cssParts) {
        if (cssInfo.partDescriptions[p.name]) p.description = cssInfo.partDescriptions[p.name];
      }

      /*
       * NOTE: deliberately NOT adding parts that appear only in the CSS header.
       * The section marker stays active until the next header, so ordinary
       * prose after the list parses as `name  description` too — trusting it
       * invented parts named "the", "whole" and "Inherits" across 23
       * components. Parts come from the source (`part=` / `exportparts=`); the
       * header only supplies their descriptions.
       */
    } else {
      component.cssCustomProps = [];
    }


    // Category lookup — every component must be mapped or we fail
    const parentTag = SUB_COMPONENT_PARENT[component.tag] ?? null;
    const category = STORY_CATEGORY.get(component.tag)
      ?? (parentTag ? STORY_CATEGORY.get(parentTag) : undefined);
    if (!category) {
      errors.push(
        `Component ${component.tag} has no category: it has no Storybook story, is not in SUB_COMPONENT_PARENT, and is not listed in NO_STORY_COMPONENTS. Add a story (preferred) or map it in scripts/generate-docs.mjs.`,
      );
      continue;
    }

    // Find Storybook story ID
    const storyId = await findStoryId(component.tag);


    // Per-component JSON
    const slug = tagToSlug(component.tag);
    const data = {
      tag: component.tag,
      title: tagToTitle(component.tag),
      slug,
      category,
      /* null for a component, the parent's tag for a part of one. Consumers
         use this to count components (52) separately from their parts (25). */
      subComponentOf: parentTag,
      storyId,
      props: component.props,
      events: component.events,
      methods: component.methods,
      slots: component.slots,
      cssParts: component.cssParts,
      cssCustomProps: component.cssCustomProps,
      dependencies: component.dependencies,
      /* The shapes a consumer constructs (data model) and reads back (output
         model), resolved from the library's own declarations so they cannot
         drift from the source the way a hand-written block does. */
      ...collectTypeModels(component),
    };
    await writeFile(join(DATA_DIR, `${slug}.json`), JSON.stringify(data, null, 2), 'utf-8');

    allComponents.push(data);
  }

  // Strict error handling: fail the whole pipeline if any component
  // could not be processed. The docs site must not silently ship missing pages.
  if (errors.length > 0) {
    for (const msg of errors) console.error(`::error::${msg}`);
    console.error(`\n${errors.length} component(s) failed to process. Aborting.`);
    process.exit(1);
  }

  // Components whose JSON exists only because another page imports it (a merged
  // sub-component such as md-fab-menu-item, folded into the FAB Menu page) must
  // NOT reach the aggregate: it drives the left-nav, and an entry there links to
  // a page that was deliberately deleted. The per-component JSON is still
  // written for them above — that is what the parent's ApiTable reads.
  const pagedComponents = allComponents.filter((c) =>
    existsSync(join(PAGES_DIR, `${tagToSlug(c.tag)}.mdx`)),
  );
  const droppedFromNav = allComponents
    .filter((c) => !pagedComponents.includes(c))
    .map((c) => c.tag);
  if (droppedFromNav.length > 0) {
    console.log(`  Data-only (no page, kept out of the nav): ${droppedFromNav.join(', ')}`);
  }

  // Aggregate components.json — single import for the landing page and
  // any consumer that needs to enumerate the full set (sidebar, search, etc.).
  const aggregate = {
    generatedAt: new Date().toISOString(),
    /* Components, excluding parts — matches Storybook's roster. */
    componentCount: pagedComponents.filter((c) => !c.subComponentOf).length,
    /* Every documented element, components + parts. */
    documentedCount: pagedComponents.length,
    subComponentCount: pagedComponents.filter((c) => c.subComponentOf).length,
    categories: CATEGORY_ORDER,
    components: pagedComponents,
  };
  await writeFile(
    join(DATA_ROOT, 'components.json'),
    JSON.stringify(aggregate, null, 2),
    'utf-8',
  );

  // Test coverage signals — walked from disk (no jest run required).
  // `coverage` here means "fraction of components with a unit test file",
  // not code-coverage %. Reported as such in stats.json + landing page.
  //
  // `componentsWithTsx` is the denominator for testCoveragePercent: it
  // counts EVERY implemented component (any dir with a .tsx), matching
  // the scope of `componentsWithUnitTests`. Using allComponents.length
  // (documented-only, post page-existence filtering) here would mix
  // scopes and yield an impossible >100% — the original 148% bug.
  let componentsWithTsx = 0;
  let componentsWithUnitTests = 0;
  let componentsWithE2eTests = 0;
  let unitTestCaseCount = 0;
  const componentsWithoutUnitTests = [];

  for (const dir of dirs) {
    const tsxPath = join(COMPONENTS_DIR, dir, `${dir}.tsx`);
    if (!existsSync(tsxPath)) continue;
    componentsWithTsx++;

    const specPath = join(COMPONENTS_DIR, dir, `${dir}.spec.ts`);
    const e2ePath = join(COMPONENTS_DIR, dir, `${dir}.e2e.ts`);

    if (existsSync(specPath)) {
      componentsWithUnitTests++;
      const spec = await readFile(specPath, 'utf-8');
      // Count actual test cases — `it(` and `test(` calls at line start.
      const matches = spec.match(/^\s*(it|test)\s*\(/gm);
      if (matches) unitTestCaseCount += matches.length;
    } else {
      componentsWithoutUnitTests.push(dir);
    }
    if (existsSync(e2ePath)) componentsWithE2eTests++;
  }

  // Per-component bundle size — derived from the size-limit budgets,
  // not the actual built dist. Why: the budget is the public commitment
  // (enforced in CI). The displayed value is "≤ X kB / component" — an
  // upper bound for a typical component.
  //
  // We report the MEDIAN of the individual per-component budgets, which
  // is robust to a handful of heavier components that would otherwise
  // skew a plain mean. The previous
  // implementation divided the "Full library" budget ("1.6 MB") by the
  // component count, but `parseFloat("1.6 MB")` silently dropped the
  // unit (read as 1.6 kB), so 1.6 / 48 rounded to 0 kB.
  let medianComponentBundleKb = null;
  try {
    const sizeLimitConfig = JSON.parse(
      await readFile(join(ROOT, 'packages/core/.size-limit.json'), 'utf-8'),
    );
    // Parse a size-limit value like "10 KB" or "1.6 MB" into kilobytes.
    const toKb = (limit) => {
      const m = String(limit).trim().match(/([\d.]+)\s*(KB|MB)?/i);
      if (!m) return NaN;
      const value = parseFloat(m[1]);
      return /mb/i.test(m[2] || '') ? value * 1024 : value;
    };
    // Per-component entries only: a single `dist/components/md-foo.js`
    // path. Excludes the shared Stencil runtime (`index.js`) and the
    // `md-*.js` glob that measures the whole library's marginal sum.
    const perComponentKb = sizeLimitConfig
      .filter((e) => /dist\/components\/md-[\w-]+\.js$/.test(e.path || ''))
      .map((e) => toKb(e.limit))
      .filter((kb) => !Number.isNaN(kb))
      .sort((a, b) => a - b);
    if (perComponentKb.length > 0) {
      const mid = Math.floor(perComponentKb.length / 2);
      medianComponentBundleKb =
        perComponentKb.length % 2 === 0
          ? parseFloat(
              ((perComponentKb[mid - 1] + perComponentKb[mid]) / 2).toFixed(1),
            )
          : perComponentKb[mid];
    }
  } catch {
    // Swallowing this silently is how the landing page ended up advertising
    // "<=4 kB / component" (a hardcoded fallback) and the stats bar rendering
    // an em-dash: .size-limit.json had gone missing from the working tree and
    // nothing said so. Warn loudly; the docs still build.
    console.warn(
      '[generate-docs] packages/core/.size-limit.json not found or unreadable —\n' +
        '                medianComponentBundleKb will be null, so the landing page\n' +
        '                falls back to a placeholder. .size-limit.json is\n' +
        '                committed — restore it from git if it went missing.',
    );
  }

  // The MEASURED typical component size, gzipped, from .size-baseline.json —
  // as opposed to medianComponentBundleKb above, which is the median CI BUDGET.
  // The distinction matters on the landing page: a budget is an upper bound we
  // promise not to cross, and quoting its median as "<= X kB / component" was
  // false for 28 of 81 components. The median of what the build actually emits
  // is the honest "typical" number.
  let medianComponentGzipKb = null;
  try {
    const baseline = JSON.parse(
      await readFile(join(ROOT, 'packages/core/.size-baseline.json'), 'utf-8'),
    );
    const measured = Object.entries(baseline)
      .filter(([name]) => /^md-[\w-]+$/.test(name))
      .map(([, kb]) => kb)
      .filter((kb) => typeof kb === 'number')
      .sort((a, b) => a - b);
    if (measured.length > 0) {
      const mid = Math.floor(measured.length / 2);
      medianComponentGzipKb =
        measured.length % 2 === 0
          ? parseFloat(((measured[mid - 1] + measured[mid]) / 2).toFixed(1))
          : measured[mid];
    }
  } catch {
    console.warn(
      '[generate-docs] packages/core/.size-baseline.json not found —\n' +
        '                medianComponentGzipKb will be null. Run\n' +
        '                `pnpm --filter @awc-ui/core size:baseline` to measure it.',
    );
  }

  // Real unit-test code coverage (line %), measured by the jest run:
  //   pnpm --filter @awc-ui/core exec stencil test --spec --ci --coverage
  // Parsed from coverage/lcov.info (sum of LH/LF across records). The docs
  // site often builds in a workspace where no coverage run has happened, so
  // the last measured value is cached in packages/core/coverage-snapshot.json
  // (committed) and refreshed automatically whenever a fresh lcov exists.
  let unitTestCoveragePercent = null;
  const lcovPath = join(ROOT, 'packages/core/coverage/lcov.info');
  const coverageSnapshotPath = join(ROOT, 'packages/core/coverage-snapshot.json');
  try {
    if (existsSync(lcovPath)) {
      const lcov = await readFile(lcovPath, 'utf-8');
      let found = 0;
      let hit = 0;
      for (const m of lcov.matchAll(/^LF:(\d+)$/gm)) found += Number(m[1]);
      for (const m of lcov.matchAll(/^LH:(\d+)$/gm)) hit += Number(m[1]);
      if (found > 0) {
        unitTestCoveragePercent = Math.round((hit / found) * 100);
        await writeFile(
          coverageSnapshotPath,
          JSON.stringify(
            {
              generatedAt: new Date().toISOString(),
              unitTestCoveragePercent,
              linesFound: found,
              linesHit: hit,
            },
            null,
            2,
          ) + '\n',
          'utf-8',
        );
      }
    } else if (existsSync(coverageSnapshotPath)) {
      unitTestCoveragePercent = JSON.parse(
        await readFile(coverageSnapshotPath, 'utf-8'),
      ).unitTestCoveragePercent;
    }
  } catch {
    // Coverage data unreadable — the stat degrades to null, never to a lie.
  }

  // Pre-computed stats — consumed by Epic 1's StatsBar.astro so the
  // credibility numbers always match build output (zero hardcoding drift).
  const stats = {
    generatedAt: new Date().toISOString(),
    componentCount: allComponents.filter((c) => !c.subComponentOf).length,
    propsCount: allComponents.reduce((sum, c) => sum + c.props.length, 0),
    eventsCount: allComponents.reduce((sum, c) => sum + c.events.length, 0),
    methodsCount: allComponents.reduce((sum, c) => sum + c.methods.length, 0),
    slotsCount: allComponents.reduce((sum, c) => sum + c.slots.length, 0),
    cssPartsCount: allComponents.reduce((sum, c) => sum + c.cssParts.length, 0),
    cssCustomPropsCount: allComponents.reduce(
      (sum, c) => sum + (c.cssCustomProps?.length ?? 0),
      0,
    ),
    componentsWithTsx,
    componentsWithUnitTests,
    componentsWithE2eTests,
    componentsWithoutUnitTests,
    unitTestCaseCount,
    unitTestCoveragePercent,
    testCoveragePercent:
      componentsWithTsx > 0
        ? Math.round((componentsWithUnitTests / componentsWithTsx) * 100)
        : 0,
    medianComponentBundleKb,
    medianComponentGzipKb,
  };
  await writeFile(
    join(DATA_ROOT, 'stats.json'),
    JSON.stringify(stats, null, 2),
    'utf-8',
  );

  console.log(`✓ Generated metadata for ${allComponents.length} components`);
  console.log(`  JSON data: ${DATA_DIR}`);
  console.log(`  Aggregate: ${join(DATA_ROOT, 'components.json')}`);
  console.log(`  Stats:     ${join(DATA_ROOT, 'stats.json')}`);
  if (skipped.length > 0) {
    console.log(`  Skipped (no TSX yet): ${skipped.join(', ')}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
