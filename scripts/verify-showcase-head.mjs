#!/usr/bin/env node
/**
 * Every build of a vertical must put THAT vertical in its document head.
 *
 * WHAT THIS CAUGHT. Each new showcase starts as a copy of the last one, and the
 * document head is the one place the copy is not exercised by anything else:
 * the parity check compares `.shell`, the a11y and CSP checks look at rendered
 * screens, and the browser suites drive the app. Nothing reads <title> or the
 * meta description, so a stale value survives every gate and ships.
 *
 * It shipped four times. Lyra, Corvus and Cygnus all went out with Vela's
 * `<title>Vela — Money & Investing</title>` on their Angular build, and
 * Cygnus's React build advertised itself as `Corvus — Friends & Groups` with
 * Corvus's description under it. Two of Cygnus's three Vite builds pointed at
 * `music.screen.feed.subtitle` — a key that does not exist, because Cygnus has
 * no feed — so their description rendered the string "undefined".
 *
 * THE TWO RULES, and why they are the two:
 *
 *   1. Every dictionary key a head interpolates must EXIST. A missing key is
 *      not a type error in a template literal or an HTML attribute; it is
 *      `undefined`, and `undefined` renders.
 *
 *   2. Every build in a vertical must agree with that vertical's REFERENCE
 *      build. Angular hand-writes its head because its builder has no index
 *      transform, so it cannot share the interpolation — which makes agreement
 *      with a sibling the only thing that can hold it to the dictionary.
 *
 * Static: reads sources, needs no build and no browser. Runs in milliseconds.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERTICALS } from './lib/showcase-verticals.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const failures = [];
const lines = [];

const fail = (m) => failures.push(m);
const read = async (p) => {
  try {
    return await readFile(join(root, p), 'utf8');
  } catch {
    return null;
  }
};

/* The English dictionary is the source of every head string. Parsed rather than
   imported: it is TypeScript, and this script must run without a build step. */
const dict = new Map();
{
  const src = await readFile(join(root, 'packages/showcase-kit/src/i18n/en.ts'), 'utf8');
  for (const m of src.matchAll(/^ {2}'([^']+)':\s*(?:'((?:[^'\\]|\\.)*)'|`([^`]*)`),$/gm)) {
    dict.set(m[1], (m[2] ?? m[3]).replace(/\\'/g, "'").replace(/\\\\/g, '\\'));
  }
}

/** Resolve a Vite `define` expression — a template literal or a bare lookup. */
function resolve(expr, where) {
  const keys = [...expr.matchAll(/en\['([^']+)'\]/g)].map((m) => m[1]);
  if (keys.length === 0) return null;
  let out = expr;
  for (const key of keys) {
    if (!dict.has(key)) {
      /* Rule 1. */
      fail(`${where}: head interpolates en['${key}'], which is not in the dictionary — it renders "undefined"`);
      return null;
    }
    out = out.replace(`en['${key}']`, dict.get(key));
  }
  /* Strip the template-literal scaffolding now that the lookups are values. */
  return out.replace(/^`|`$/g, '').replace(/\$\{([^}]*)\}/g, '$1').trim();
}

for (const vertical of VERTICALS) {
  const frameworks = vertical.builds.map((b) => b.framework);
  /* What the vertical's own key prefix is — credit-risk was the first and owns
     the unprefixed `app.*` keys; every vertical since namespaces its own. */
  const prefix = vertical.id === 'credit-risk' ? '' : `${vertical.id}.`;
  const heads = new Map();

  for (const framework of frameworks) {
    const dir = `apps/showcase/${vertical.id}/${framework}`;

    const vite = await read(`${dir}/vite.config.ts`);
    if (vite) {
      const title = vite.match(/__AWC_TITLE__:\s*(.+?),\n/s)?.[1];
      const desc = vite.match(/__AWC_DESCRIPTION__:\s*(.+?),\n/s)?.[1];
      const where = `${vertical.id}/${framework} vite.config.ts`;
      for (const [what, expr] of [['title', title], ['description', desc]]) {
        if (!expr) {
          fail(`${where}: no __AWC_${what.toUpperCase()}__ in the Vite define block`);
          continue;
        }
        /* Rule 2, the cheap half: a key from another vertical is wrong even
           when it exists, and existing is exactly why it survives. */
        for (const m of expr.matchAll(/en\['([^']+)'\]/g)) {
          const key = m[1];
          const owned = prefix ? key.startsWith(prefix) : !/^[a-z-]+\./.test(key) || key.startsWith('app.');
          if (!owned) fail(`${where}: ${what} reads en['${key}'] — that belongs to another vertical, not ${vertical.id}`);
        }
      }
      const resolved = { title: title && resolve(title, where), description: desc && resolve(desc, where) };
      if (resolved.title || resolved.description) heads.set(framework, resolved);
      continue;
    }

    /* Angular hand-writes the head: its builder has no index transform. */
    const html = await read(`${dir}/src/index.html`);
    if (html) {
      heads.set(framework, {
        title: html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim() ?? null,
        description: html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]?.trim() ?? null,
      });
    }
  }

  /* Rule 2. The reference build is the one parity already trusts. */
  const ref = heads.get(vertical.reference);
  if (!ref) {
    fail(`${vertical.id}: reference build "${vertical.reference}" exposes no document head to compare against`);
    continue;
  }
  lines.push(`  ${vertical.id.padEnd(12)} ${ref.title}`);
  for (const [framework, head] of heads) {
    if (framework === vertical.reference) continue;
    for (const what of ['title', 'description']) {
      if (head[what] == null) continue;
      if (head[what] !== ref[what]) {
        fail(
          `${vertical.id}/${framework}: ${what} is ${JSON.stringify(head[what])}, ` +
            `but ${vertical.reference} says ${JSON.stringify(ref[what])}`,
        );
      }
    }
  }
}

console.log('\nDocument head, per vertical (from the reference build):\n');
console.log(lines.join('\n'));
console.log('');
if (failures.length) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  console.error(`\nFAIL — ${failures.length} head problem(s)\n`);
  process.exit(1);
}
console.log(`PASS — every build's document head names its own vertical\n`);
