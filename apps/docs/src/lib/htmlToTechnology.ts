/**
 * Tiny HTML → per-technology snippet derivation, used by <ComponentDemo> to
 * generate "how would I build this in $technology?" code samples next to the
 * live preview, without forcing demo authors to hand-write five copies of
 * every snippet.
 *
 * What it does (intentionally limited):
 *   • HTML    – passes through verbatim. The same snippet we render live.
 *   • Vue     – HTML inside a <template>, plus a `<script setup>` that
 *               imports the loader's eager `define` entry so the
 *               <md-*> tags are upgraded.
 *   • Svelte  – HTML inside a Svelte component, same `define` import.
 *   • Angular – HTML inside a component template, plus the AppModule
 *               registration block (one-time, but kept for clarity).
 *   • React   – tags rewritten to PascalCase (md-button → MdButton) and
 *               selected kebab attributes camel-cased to match the
 *               @awc-ui/react wrapper props (selection-mode →
 *               selectionMode). Names React reserves are remapped
 *               (class → className) and `style` strings become JSX
 *               objects; aria-* / data-* stay kebab so they keep working.
 *               An `import { … } from '@awc-ui/react'` is emitted with
 *               only the tags that appear in the snippet, sorted, deduped.
 *
 * Popup wiring IS synthesised. Most interactive demos are a trigger plus a
 * popup, written live as
 *     onclick="document.getElementById('m').show()"
 * because `set:html` can't run a script. Passing that through verbatim would
 * hand React/Vue/Svelte/Angular readers a menu that never opens — an inline
 * `onclick` string is inert in JSX, and none of them want getElementById. So
 * the trigger's inline call is lifted into each framework's own idiom (a ref
 * plus a click handler) and the HTML tab gets a real module script.
 *
 * Scope explicitly skipped:
 *   • Any handler that isn't that one recognised shape — passed through
 *     untouched rather than guessed at.
 *   • Bidirectional binding / signals — authors hand-write those.
 *
 * Safe to call on arbitrary user-supplied HTML; failures fall back to the
 * original string so we never break a docs build over a malformed demo.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const AWC_TAG_PATTERN = /<\/?md-[a-z0-9-]+/g;

/** Pascal-case the rest of a `md-foo-bar` tag → `MdFooBar`. */
function tagToPascal(tag: string): string {
  return tag
    .split('-')
    .map((segment) =>
      segment.length === 0 ? '' : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join('');
}

/** Discover every unique `md-*` tag inside the snippet, in source order,
 *  so we can emit a stable import list. Returns the tags as PascalCase. */
function collectAwcComponents(html: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of html.matchAll(AWC_TAG_PATTERN)) {
    const raw = match[0].replace(/^<\/?/, ''); // strip leading "<" or "</"
    if (seen.has(raw)) continue;
    seen.add(raw);
    ordered.push(tagToPascal(raw));
  }
  // alphabetise for a deterministic import order — easier to scan, easier
  // to diff when the demo changes.
  return ordered.sort();
}

// Kebab attribute → camelCase. The @awc-ui/react wrapper exposes
// camelCase props for every reflected Stencil @Prop, so the mapping is
// "kebab anywhere in attribute body → camel". HTML built-ins (data-*,
// aria-*, role, slot, …) are left alone — see `KEEP_KEBAB`.
const KEEP_KEBAB = new Set([
  'aria',
  'data',
  'class',
  'id',
  'style',
  'role',
  'slot',
  'tabindex',
  'lang',
  'dir',
  'title',
  'is',
  'for',
  'name',
  'type',
  'value',
  'href',
  'src',
  'alt',
  'rel',
  'target',
  'placeholder',
  'min',
  'max',
  'step',
  'checked',
  'disabled',
  'required',
  'readonly',
  'multiple',
  'selected',
  'hidden',
  'autofocus',
]);

function kebabAttrToCamel(name: string): string {
  // `aria-*` and `data-*` are namespaces — React forwards the whole family as
  // DOM attributes, so those match on the prefix.
  const head = name.split('-')[0];
  if (head === 'aria' || head === 'data') return name;
  // Everything else must match EXACTLY. Matching on the first segment meant
  // `target-title` was read as the anchor's `target` attribute and left kebab,
  // which React then dropped — the prop simply never arrived. Same trap for
  // `value-text`, `min-*`, `type-*`…
  if (KEEP_KEBAB.has(name)) return name;
  // `selection-mode` → `selectionMode`, `connected-right` → `connectedRight`
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** HTML attribute names JSX spells differently on *plain* elements. Custom
 *  elements go through `kebabAttrToCamel` instead, so this list only needs the
 *  handful React reserves on host components. */
const REACT_DOM_ATTRS: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  minlength: 'minLength',
  readonly: 'readOnly',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  contenteditable: 'contentEditable',
  spellcheck: 'spellCheck',
  srcset: 'srcSet',
  usemap: 'useMap',
  novalidate: 'noValidate',
  enctype: 'encType',
  datetime: 'dateTime',
  crossorigin: 'crossOrigin',
};

/** `style="display: flex; --md-x: 4px"` → `style={{ display: 'flex', '--md-x': '4px' }}`.
 *  React rejects a style *string* outright, so leaving these alone would make
 *  every snippet with a layout wrapper un-pasteable. */
function styleStringToJsxObject(css: string): string {
  const entries = css
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const colon = decl.indexOf(':');
      if (colon < 0) return null;
      const rawProp = decl.slice(0, colon).trim();
      const value = decl.slice(colon + 1).trim().replace(/'/g, "\\'");
      // Custom properties keep their literal name and must stay quoted; normal
      // properties become camelCase identifiers.
      const key = rawProp.startsWith('--')
        ? `'${rawProp}'`
        : rawProp.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
      return `${key}: '${value}'`;
    })
    .filter(Boolean);
  return entries.length ? `style={{ ${entries.join(', ')} }}` : '';
}

/** Walk every tag occurrence in the snippet and apply per-tag rewriting.
 *  We never reflow whitespace inside the snippet, only swap symbols. */
function rewriteForReact(html: string): string {
  // 1. Tag names.
  let out = html.replace(
    /<(\/?)(md-[a-z0-9-]+)([\s/>])/g,
    (_match, slash: string, tag: string, sep: string) =>
      `<${slash}${tagToPascal(tag)}${sep}`,
  );

  // 2. Attributes — only inside *opening* tags. We isolate the tag head
  // (everything between `<MdFoo` and the first `>` or `/>`) and rewrite
  // attribute names there. Custom elements additionally camel-case their
  // kebab props to match the @awc-ui/react wrapper.
  out = out.replace(/<(Md[A-Z][a-zA-Z0-9]*)([^>]*)>/g, (_, tag: string, attrs: string) => {
    const camelised = attrs.replace(
      /(\s)([a-z][a-z0-9-]*)(=|(?=[\s/>]))/g,
      (_full, ws: string, attrName: string, equals: string) =>
        `${ws}${kebabAttrToCamel(attrName)}${equals}`,
    );
    return `<${tag}${rewriteDomAttrs(camelised)}>`;
  });

  // 3. Plain DOM elements keep their tag name but not their attribute
  // spelling: a pasted `class="material-symbols-outlined"` silently drops the
  // icon font, and a `style` string throws outright.
  out = out.replace(/<([a-z][a-z0-9]*)([^>]*)>/g, (whole, tag: string, attrs: string) =>
    attrs ? `<${tag}${rewriteDomAttrs(attrs)}>` : whole,
  );

  return out;
}

/** Apply the reserved-name map and the style-string conversion to one tag head. */
function rewriteDomAttrs(attrs: string): string {
  return attrs.replace(
    /(\s)([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g,
    (full, ws: string, attrName: string, value: string) => {
      const lower = attrName.toLowerCase();
      if (lower === 'style') {
        const jsx = styleStringToJsxObject(value);
        return jsx ? `${ws}${jsx}` : '';
      }
      const mapped = REACT_DOM_ATTRS[lower];
      return mapped ? `${ws}${mapped}="${value}"` : full;
    },
  );
}

function indent(block: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return block
    .split('\n')
    .map((line) => (line.length === 0 ? '' : pad + line))
    .join('\n');
}

/** Tags that are self-closing in HTML5 (void elements). They must not
 *  change indent depth even when written without a `/>`. */
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Re-indent flat HTML based on tag nesting so child elements sit two
 *  spaces in from their parent. We need this because MDX collapses the
 *  leading whitespace inside template-literal JSX attribute values, so
 *  the HTML reaching us looks like one tag per line with no indentation
 *  even when the author wrote it formatted. */
function reIndentHtml(html: string, indentSize = 2): string {
  const lines = html.split('\n').map((l) => l.trim()).filter((l, i, arr) => {
    // collapse runs of empty lines into a single empty separator
    return !(l === '' && arr[i - 1] === '');
  });

  let depth = 0;
  const pad = (n: number) => ' '.repeat(Math.max(0, n) * indentSize);

  const out: string[] = [];
  for (const line of lines) {
    if (line === '') {
      out.push('');
      continue;
    }

    // Classify the *first* tag on the line (good enough for our demos
    // because every tag sits on its own line by the time we run).
    const openMatch = line.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
    const closeMatch = line.match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)>/);
    const selfClose = /\/>\s*$/.test(line);

    if (closeMatch) {
      // </foo> — outdent first, then emit
      depth = Math.max(0, depth - 1);
      out.push(pad(depth) + line);
    } else if (openMatch) {
      const tag = openMatch[1].toLowerCase();
      // Does this line both open and close (e.g. `<md-button>Cut</md-button>`)?
      const closesOnSameLine = new RegExp(`</${tag}>\\s*$`, 'i').test(line);
      out.push(pad(depth) + line);
      if (!closesOnSameLine && !selfClose && !VOID_TAGS.has(tag)) {
        depth += 1;
      }
    } else {
      out.push(pad(depth) + line);
    }
  }
  return out.join('\n');
}

/** The stylesheet the components' icons come from. Same URL the docs site
 *  itself loads, so what a reader copies matches what they just saw. */
const ICON_FONT_LINK =
  '<!-- index.html <head> — the icon font the components draw from -->\n' +
  '<link rel="stylesheet"\n' +
  '  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap">\n';

/** A one-line pointer for the framework tabs, whose `index.html` is out of
 *  frame but still needs the font. */
const ICON_FONT_NOTE =
  '// Icons need the Material Symbols stylesheet in index.html — see Installation.';

/** Does this demo draw icons at all? Icons arrive either as a slotted
 *  `material-symbols-outlined` span or as an `icon` / `*-icon` prop. */
function usesIcons(html: string): boolean {
  return /material-symbols-outlined|\b(?:[a-z-]+-)?icon="/.test(html);
}

/** One trigger → popup pairing lifted out of an inline `onclick`. */
interface PopupWiring {
  /** The popup element's id, verbatim (kept in the markup — `anchor` uses it). */
  popupId: string;
  /** The trigger's own id, when it has one. */
  triggerId: string | null;
  /** Method the trigger calls: show / hide / open / close / toggle. */
  method: string;
  /** Safe JS identifier derived from the popup id (`menu-demo-m` → `menuDemoM`). */
  ref: string;
}

const INLINE_POPUP_CALL =
  /\s+onclick="document\.getElementById\('([^']+)'\)\.([a-zA-Z]+)\(\)"/g;

/** Marker left where the inline handler was, so each technology can re-attach
 *  its own binding at exactly the right element. `data-*` survives the React
 *  attribute rewrite untouched, which is why it is shaped like one. */
const WIRE_MARKER = (i: number) => `data-awc-wire="${i}"`;

function idToIdentifier(id: string): string {
  const camel = id.replace(/[-_]+([a-zA-Z0-9])/g, (_m, c: string) => c.toUpperCase());
  const safe = camel.replace(/[^a-zA-Z0-9_$]/g, '');
  return /^[0-9]/.test(safe) ? `el${safe}` : safe;
}

function extractPopupWiring(html: string): { markup: string; wiring: PopupWiring[] } {
  const wiring: PopupWiring[] = [];
  const markup = html.replace(
    INLINE_POPUP_CALL,
    (_full: string, popupId: string, method: string, offset: number, whole: string) => {
      // Walk back to the start of the tag this handler sits on to read its id.
      const tagStart = whole.lastIndexOf('<', offset);
      const tagText = tagStart >= 0 ? whole.slice(tagStart, offset) : '';
      const idMatch = tagText.match(/\bid="([^"]+)"/);
      const i = wiring.length;
      wiring.push({
        popupId,
        triggerId: idMatch ? idMatch[1] : null,
        method,
        ref: idToIdentifier(popupId),
      });
      return ` ${WIRE_MARKER(i)}`;
    },
  );
  return { markup, wiring };
}

/** Give the popup element a framework binding next to its id. */
function bindPopup(html: string, popupId: string, attr: string): string {
  const escaped = popupId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`(\\bid="${escaped}")`), `$1 ${attr}`);
}

/** Swap every marker for a technology-specific binding, and bind the popups. */
function applyWiring(
  html: string,
  wiring: PopupWiring[],
  trigger: (w: PopupWiring) => string,
  popup: (w: PopupWiring) => string,
): string {
  let out = html;
  wiring.forEach((w, i) => {
    out = out.replace(WIRE_MARKER(i), trigger(w));
    const binding = popup(w);
    if (binding) out = bindPopup(out, w.popupId, binding);
  });
  return out;
}

/* ── Inline <script> in a demo ──────────────────────────────────────────────
 *
 * A demo whose setup cannot be expressed in markup alone carries a real
 * `<script type="module">`: assigning array/function props, wiring listeners,
 * loading data. That is exactly right for the HTML tab and nonsense in every
 * other one — pasted into JSX it becomes a literal <script> element inside the
 * returned tree, and Vue / Svelte / Angular templates want it no more than
 * React does.
 *
 * So the block is lifted out and re-emitted in each framework's own setup
 * idiom: a mounted hook, with `document.getElementById('x')` rewritten to that
 * framework's ref. Lookups in any other shape are left untouched inside the
 * hook — still valid code, just not ref-based.
 */
const SCRIPT_BLOCK = /[ \t]*<script\b[^>]*>([\s\S]*?)<\/script>[ \t]*\n?/gi;

interface ScriptEl {
  id: string;
  varName: string;
}

function dedent(block: string): string {
  const lines = block.replace(/^\n+/, '').replace(/\s+$/, '').split('\n');
  const widths = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => (line.match(/^ */) as RegExpMatchArray)[0].length);
  const min = widths.length ? Math.min(...widths) : 0;
  return lines.map((line) => line.slice(min)).join('\n');
}

/**
 * ComponentDemo scopes a demo's wiring to its own preview element (`root`), so
 * two demos on a page can share ids. The code tabs are standalone pages where
 * that scoping is meaningless — and `root.querySelector` is not a shape the ref
 * rewriting recognises — so normalise it to a plain document lookup.
 */
function normaliseDemoScript(script: string): string {
  if (!script) return '';
  return dedent(script)
    .replace(
      /\broot\.querySelector\(\s*['"]#([\w:-]+)['"]\s*\)/g,
      (_m, id: string) => `document.getElementById('${id}')`,
    )
    .replace(/\broot\.querySelector(All)?\(/g, 'document.querySelector$1(')
    .trim();
}

function extractScript(html: string): { markup: string; script: string } {
  const bodies: string[] = [];
  const markup = html.replace(SCRIPT_BLOCK, (_full: string, body: string) => {
    const text = dedent(String(body));
    if (text.trim()) bodies.push(text);
    return '';
  });
  return {
    markup: markup.replace(/\n{3,}/g, '\n\n').trim(),
    script: bodies.join('\n\n'),
  };
}

/** Loader bootstrapping is an HTML-tab concern: the framework tabs already
 *  import the React wrappers or `@awc-ui/core/define`, and an `import` cannot
 *  live inside a lifecycle hook at all. */
function stripBootstrapImports(script: string): string {
  return script
    .replace(/^[ \t]*import\s[^\n]*\n?/gm, '')
    .replace(/^[ \t]*defineCustomElements\([^)]*\);?[ \t]*\n?/gm, '')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/** `const el = document.getElementById('teams')` — the one shape worth
 *  rewriting, because every framework has a ref for precisely it. */
const EL_LOOKUP =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*document\.(?:getElementById\(\s*['"]([\w:-]+)['"]\s*\)|querySelector\(\s*['"]#([\w:-]+)['"]\s*\))\s*;?/g;

function scriptElements(script: string): ScriptEl[] {
  const els: ScriptEl[] = [];
  const seen = new Set<string>();
  for (const m of script.matchAll(EL_LOOKUP)) {
    const varName = m[1];
    if (seen.has(varName)) continue;
    seen.add(varName);
    els.push({ varName, id: (m[2] ?? m[3]) as string });
  }
  return els;
}

/** The same body, with each recognised lookup swapped for a ref read. */
function scriptBodyFor(script: string, read: (el: ScriptEl) => string): string {
  return script.replace(
    EL_LOOKUP,
    (_full: string, varName: string, byId?: string, bySelector?: string) =>
      read({ varName, id: (byId ?? bySelector) as string }),
  );
}

/** Attach a framework ref binding to whichever element carries the id the
 *  script looked up. Reuses the popup binder — both are "add an attribute next
 *  to this id". */
function bindScriptRefs(
  html: string,
  els: ScriptEl[],
  binding: (el: ScriptEl) => string,
): string {
  return els.reduce((acc, el) => bindPopup(acc, el.id, binding(el)), html);
}


/**
 * A wiring script that does nothing but assign properties —
 * `el.items = [...]; el.value = [...];` — is not really imperative setup: it is
 * a prop list written the only way plain HTML allows. Every framework binds
 * those declaratively, so lift them out and let the markup carry them instead
 * of shipping a ref + mounted-hook dance the reader would have to unpick.
 *
 * Returns null the moment the script does anything else (listeners, loops,
 * conditionals, method calls) — that genuinely needs the hook, and a partial
 * lift would silently drop behaviour.
 */
interface DeclarativeProps {
  /** Declarations to emit, in order, deduplicated across elements. */
  decls: Array<{ name: string; expr: string; comment?: string }>;
  /** element variable → [{ prop, name }] bindings for its tag. */
  bindings: Map<string, Array<{ prop: string; name: string }>>;
}

function asDeclarativeProps(script: string, els: ScriptEl[]): DeclarativeProps | null {
  if (!script.trim() || !els.length) return null;

  const names = new Set(els.map((e) => e.varName));
  const rest0 = script.replace(EL_LOOKUP, '');

  /**
   * Read one `el.prop = <expr>;` statement, honouring nesting and strings so a
   * function body's own `;` cannot end it early. Returns null when the text
   * does not start with such an assignment.
   */
  const readAssignment = (
    text: string,
  ): { full: string; varName: string; prop: string; expr: string } | null => {
    const head = text.match(/^\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*=\s*/);
    if (!head) return null;

    let depth = 0;
    let quote = '';
    for (let i = head[0].length; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') i++;
        else if (ch === quote) quote = '';
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      else if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (ch === ';' && depth === 0) {
        return {
          full: text.slice(0, i + 1),
          varName: head[1],
          prop: head[2],
          expr: text.slice(head[0].length, i).trim(),
        };
      }
    }
    return null;
  };

  const decls: Array<{ name: string; expr: string; comment?: string }> = [];
  const bindings = new Map<string, Array<{ prop: string; name: string }>>();
  const taken = new Set<string>();
  /** (elementVar, prop) → the const that holds it, for cross-element reads. */
  const declaredFor = new Map<string, string>();
  /** expr text → const name, so identical values are declared once. */
  const byExpr = new Map<string, string>();

  let rest = rest0;
  while (rest.trim()) {
    // Comments sit between statements and explain the value — keep them with
    // the declaration rather than treating them as unparseable and giving up.
    const lead = rest.match(/^(\s*(?:\/\/[^\n]*\n\s*)+)/);
    let comment = '';
    if (lead) {
      comment = lead[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('//'))
        .join('\n');
      rest = rest.slice(lead[0].length);
      if (!rest.trim()) break;
    }

    const m = readAssignment(rest);
    if (!m) return null;
    const { full, varName, prop } = m;
    if (!names.has(varName)) return null;

    let expr = m.expr;
    // A function value is a prop like any other — `filterer`, `valueFormatter`,
    // `getLabel` are all bound declaratively in every framework. Only an
    // addEventListener call is genuinely imperative, and that is not an
    // assignment so it never reaches here.
    if (!expr) return null;

    // `d2.items = d0.items` — resolve the read to the const already declared
    // for that element, or bail rather than emit a dangling reference.
    const crossRead = expr.match(/^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)$/);
    if (crossRead) {
      if (!names.has(crossRead[1])) return null;
      const source = declaredFor.get(`${crossRead[1]}.${crossRead[2]}`);
      if (!source) return null;
      // Bind the const that already holds this value — an alias declaration
      // (`const d2Items = items;`) would be noise.
      declaredFor.set(`${varName}.${prop}`, source);
      if (!bindings.has(varName)) bindings.set(varName, []);
      bindings.get(varName)!.push({ prop, name: source });
      rest = rest.slice(full.length);
      continue;
    }

    // One declaration per distinct value; namespace the name when a prop of the
    // same name already holds something else (three sliders, three densities).
    let name = byExpr.get(expr) ?? '';
    if (!name) {
      name = taken.has(prop) ? `${varName}${prop[0].toUpperCase()}${prop.slice(1)}` : prop;
      if (taken.has(name)) return null;
      taken.add(name);
      byExpr.set(expr, name);
      decls.push({ name, expr, comment });
    }

    declaredFor.set(`${varName}.${prop}`, name);
    if (!bindings.has(varName)) bindings.set(varName, []);
    bindings.get(varName)!.push({ prop, name });
    rest = rest.slice(full.length);
  }

  return bindings.size ? { decls, bindings } : null;
}

/** Insert attributes into the opening tag that carries `marker`. */
function addAttrsToTag(html: string, marker: string, attrs: string[]): string {
  if (!attrs.length) return html;
  const idx = html.indexOf(marker);
  if (idx < 0) return html;
  const tagStart = html.lastIndexOf('<', idx);
  // Indent from the tag's LINE, not its column: a tag that shares a line with a
  // wrapper (`<div><MdFoo …`) would otherwise push the lifted props halfway
  // across the snippet.
  const lineStart = html.lastIndexOf('\n', tagStart) + 1;
  const lineIndent = (html.slice(lineStart, tagStart).match(/^\s*/) as RegExpMatchArray)[0].length;
  const pad = ' '.repeat(lineIndent + 2);
  const insertAt = idx + marker.length;
  return html.slice(0, insertAt) + attrs.map((a) => `\n${pad}${a}`).join('') + html.slice(insertAt);
}

/** `countTemplate` → `count-template`, for Vue/Angular attribute bindings. */
function propToKebabAttr(prop: string): string {
  return prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}


export interface TechnologySnippets {
  html: string;
  react: string;
  vue: string;
  svelte: string;
  angular: string;
}

export function deriveTechnologySnippets(html: string, wiringScript = ''): TechnologySnippets {
  const trimmed = html.trim();
  try {
    // Lift the demo's inline popup handlers out first: every technology needs
    // them expressed differently, and the raw `onclick` string is useful to
    // exactly none of them.
    const { markup: markupWithoutScript, script: inlineScript } = extractScript(trimmed);

    // A demo can carry its wiring in ComponentDemo's `script` prop instead of an
    // inline <script> — that is the only way to inject array/object props,
    // which no attribute can express. Fold it in so the framework tabs bind it
    // too, rewriting the demo-scoped `root.querySelector('#x')` lookups into the
    // `document.getElementById('x')` shape the ref machinery below recognises.
    // An inline <script> in the documented markup is the AUTHORED snippet; the
    // `script` prop is the preview's own wiring. A demo can carry both, and
    // concatenating them produced two element lookups and a duplicate `const
    // el` in every framework tab. The authored one wins; the preview wiring is
    // only used when there is nothing authored.
    const script = inlineScript.trim() || normaliseDemoScript(wiringScript);
    const { markup, wiring } = extractPopupWiring(markupWithoutScript);
    // The framework tabs run the body in a lifecycle hook, so loader
    // bootstrapping (an HTML-only concern) comes out first.
    const setup = stripBootstrapImports(script);
    // An element can be BOTH a popup target and a script lookup. Popup wiring
    // already declares and binds a ref for it, so the script reads that one
    // rather than binding a second ref to the same element.
    const scriptEls = scriptElements(setup).map((el) => ({
      ...el,
      shared: wiring.find((w) => w.popupId === el.id)?.ref ?? null,
    }));
    const ownEls = scriptEls.filter((el) => !el.shared);

    // When the wiring is nothing but property assignments, every framework can
    // bind them declaratively — a ref plus a mounted hook is noise the reader
    // has to unpick. `declarative` is null the moment the script does anything
    // that genuinely needs the hook.
    const declarative = asDeclarativeProps(setup, scriptEls);
    const declaredConsts = declarative ? declarative.decls : [];
    /** Bind the lifted props onto the tag carrying each element's id. */
    const withDeclared = (
      html: string,
      format: (prop: string, name: string) => string,
    ): string => {
      if (!declarative) return html;
      let out = html;
      for (const [varName, props] of declarative.bindings) {
        const el = scriptEls.find((e) => e.varName === varName);
        if (!el) continue;
        out = addAttrsToTag(out, `id="${el.id}"`, props.map((p) => format(p.prop, p.name)));
      }
      return out;
    };

    // MDX collapses internal whitespace in JSX attribute template
    // literals, so the HTML we get is one-tag-per-line at column 0.
    // Re-indent before generating anything so every snippet renders
    // with proper nesting (and so React's PascalCase rewrite can be
    // re-indented for the JSX-fragment wrapper).
    // The HTML tab keeps plain markup and moves the handler into a real module
    // script, so the marker (and the space before it) comes out entirely.
    const htmlMarkup = wiring.reduce(
      (acc, _w, i) => acc.replace(new RegExp(`\\s*${WIRE_MARKER(i)}`), ''),
      markup,
    );
    const prettyHtml = reIndentHtml(htmlMarkup);

    const reactMarkup = bindScriptRefs(
      applyWiring(
        rewriteForReact(markup),
        wiring,
        (w) => `onClick={() => ${w.ref}Ref.current?.${w.method}()}`,
        (w) => `ref={${w.ref}Ref}`,
      ),
      declarative ? [] : ownEls,
      (el) => `ref={${el.varName}Ref}`,
    );
    const reactBody = withDeclared(reIndentHtml(reactMarkup), (prop, name) => `${prop}={${name}}`);
    const declaredBlock = declaredConsts.length
      ? declaredConsts
          .map((c) => `${c.comment ? `${c.comment}\n` : ''}const ${c.name} = ${c.expr};`)
          .join('\n\n') + '\n\n'
      : '';
    const tags = collectAwcComponents(markupWithoutScript);
    const importList = tags.length ? tags.join(', ') : 'MdButton';

    const refDecls = [
      ...wiring.map((w) => `  const ${w.ref}Ref = useRef(null);`),
      ...(declarative ? [] : ownEls.map((el) => `  const ${el.varName}Ref = useRef(null);`)),
    ];
    const reactRefs = refDecls.length ? `\n${refDecls.join('\n')}\n` : '';
    const reactEffect = setup && !declarative
      ? `\n  useEffect(() => {\n${indent(
          scriptBodyFor(setup, (el) => {
            const shared = scriptEls.find((s) => s.varName === el.varName)?.shared;
            return `const ${el.varName} = ${shared ?? el.varName}Ref.current;`;
          }),
          4,
        )}\n  }, []);\n`
      : '';
    const reactHooks = [setup && !declarative ? 'useEffect' : '', refDecls.length ? 'useRef' : '']
      .filter(Boolean)
      .join(', ');
    const iconNote = usesIcons(trimmed) ? `${ICON_FONT_NOTE}\n` : '';
    const react = `${iconNote}${reactHooks ? `import { ${reactHooks} } from 'react';\n` : ''}import { ${importList} } from '@awc-ui/react';

${declaredBlock}export function Demo() {${reactRefs}${reactEffect}
  return (
    <>
${indent(reactBody, 6)}
    </>
  );
}`;

    const vueMarkup = withDeclared(
      reIndentHtml(
        bindScriptRefs(
          applyWiring(
            markup,
            wiring,
            (w) => `@click="${w.ref}?.${w.method}()"`,
            (w) => `ref="${w.ref}"`,
          ),
          declarative ? [] : ownEls,
          (el) => `ref="${el.varName}Ref"`,
        ),
      ),
      (prop, name) => `:${propToKebabAttr(prop)}="${name}"`,
    );
    const vueRefDecls = [
      ...wiring.map((w) => `const ${w.ref} = ref(null);`),
      ...(declarative ? [] : ownEls.map((el) => `const ${el.varName}Ref = ref(null);`)),
    ];
    const vueRefs = vueRefDecls.length ? `${vueRefDecls.join('\n')}\n` : '';
    const vueMounted = setup && !declarative
      ? `\nonMounted(() => {\n${indent(
          scriptBodyFor(setup, (el) => {
            const shared = scriptEls.find((s) => s.varName === el.varName)?.shared;
            return shared
              ? `const ${el.varName} = ${shared}.value;`
              : `const ${el.varName} = ${el.varName}Ref.value;`;
          }),
          2,
        )}\n});\n`
      : '';
    const vueImports = [setup && !declarative ? 'onMounted' : '', vueRefDecls.length ? 'ref' : '']
      .filter(Boolean)
      .join(', ');
    const vue = `<script setup>
${iconNote}${vueImports ? `import { ${vueImports} } from 'vue';\n` : ''}import '@awc-ui/core/define';
${vueRefs ? '\n' + vueRefs : ''}${
      declaredConsts.length
        ? '\n' + declaredConsts.map((c) => `const ${c.name} = ${c.expr};`).join('\n\n') + '\n'
        : ''
    }${vueMounted}</script>

<template>
${indent(vueMarkup, 2)}
</template>`;

    const svelteMarkup = withDeclared(
      reIndentHtml(
        bindScriptRefs(
          applyWiring(
            markup,
            wiring,
            (w) => `on:click={() => ${w.ref}?.${w.method}()}`,
            (w) => `bind:this={${w.ref}}`,
          ),
          declarative ? [] : ownEls,
          (el) => `bind:this={${el.varName}Ref}`,
        ),
      ),
      (prop, name) => (prop === name ? `{${name}}` : `${prop}={${name}}`),
    );
    const svelteRefDecls = [
      ...wiring.map((w) => `  let ${w.ref};`),
      ...(declarative ? [] : ownEls.map((el) => `  let ${el.varName}Ref;`)),
    ];
    const svelteRefs = svelteRefDecls.length ? `\n${svelteRefDecls.join('\n')}\n` : '';
    const svelteMount = setup && !declarative
      ? `\n  onMount(() => {\n${indent(
          scriptBodyFor(setup, (el) => {
            const shared = scriptEls.find((s) => s.varName === el.varName)?.shared;
            return `const ${el.varName} = ${shared ?? `${el.varName}Ref`};`;
          }),
          4,
        )}\n  });\n`
      : '';
    const svelte = `<script>
${iconNote ? '  ' + iconNote + '\n' : ''}${setup && !declarative ? "  import { onMount } from 'svelte';\n" : ''}  import '@awc-ui/core/define';
${svelteRefs}${
      declaredConsts.length
        ? '\n' + declaredConsts.map((c) => `  const ${c.name} = ${indent(c.expr, 2).trim()};`).join('\n\n') + '\n'
        : ''
    }${svelteMount}</script>

${svelteMarkup}`;

    // Angular reads the element straight off a template reference variable, so
    // no component-class member is needed for a plain open/close.
    const angularMarkup = withDeclared(
      reIndentHtml(
        bindScriptRefs(
          applyWiring(
            markup,
            wiring,
            (w) => `(click)="${w.ref}.${w.method}()"`,
            (w) => `#${w.ref}`,
          ),
          declarative ? [] : ownEls,
          (el) => `#${el.varName}`,
        ),
      ),
      (prop, name) => `[${propToKebabAttr(prop)}]="${name}"`,
    );
    // Setup code becomes a component class: template reference variables read
    // through @ViewChild, applied once the view exists.
    const angularComponent = declarative
      ? `
// app.component.ts — the bound values live on the class
import { Component } from '@angular/core';

@Component({
  selector: 'app-demo',
  templateUrl: './app.component.html',
})
export class DemoComponent {
${declaredConsts.map((c) => `  ${c.name} = ${indent(c.expr, 2).trim()};`).join('\n\n')}
}
`
      : setup
      ? `
// app.component.ts
import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';

@Component({
  selector: 'app-demo',
  templateUrl: './app.component.html',
})
export class DemoComponent implements AfterViewInit {
${scriptEls
  .map((el) => `  @ViewChild('${el.shared ?? el.varName}') ${el.varName}Ref!: ElementRef;`)
  .join('\n')}${scriptEls.length ? '\n' : ''}
  ngAfterViewInit() {
${indent(
  scriptBodyFor(setup, (el) => `const ${el.varName} = this.${el.varName}Ref.nativeElement;`),
  4,
)}
  }
}
`
      : '';
    const angular = `${iconNote}// app.module.ts — register the AWC UI elements once
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { AwcUiModule } from '@awc-ui/angular';

@NgModule({
  imports: [AwcUiModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
${angularComponent}
<!-- app.component.html -->
${angularMarkup}`;

    // The head every demo needs to actually run: the icon font (when the demo
    // draws icons) and the element registration. Without these a pasted
    // snippet renders ligature text in unupgraded custom elements.
    const head = [
      usesIcons(trimmed) ? `${ICON_FONT_LINK}\n` : '',
      `<!-- index.html — register the AWC UI elements once -->
<script type="module">
  import '@awc-ui/core/define';
</script>`,
    ].join('');

    const demoScript = script
      ? `

<script type="module">
${indent(script, 2)}
</script>`
      : '';
    const htmlTab = `${head}

${prettyHtml}${demoScript}${
      wiring.length
        ? `

<script type="module">
${wiring
  .map((w) =>
    w.triggerId
      ? `  document.getElementById('${w.triggerId}').addEventListener('click', () => {
    document.getElementById('${w.popupId}').${w.method}();
  });`
      : `  // Give the trigger an id, then:
  // trigger.addEventListener('click', () => document.getElementById('${w.popupId}').${w.method}());`,
  )
  .join('\n')}
</script>`
        : ''
    }`;

    return { html: htmlTab, react, vue, svelte, angular };
  } catch (err) {
    if (typeof process !== 'undefined' && process.env?.AWC_DEBUG_SNIPPETS) console.error('[deriveTechnologySnippets]', err);
    // Never break the build on a malformed demo — fall back to the same
    // HTML in every tab so the user can still see *something*.
    return {
      html: trimmed,
      react: trimmed,
      vue: trimmed,
      svelte: trimmed,
      angular: trimmed,
    };
  }
}
