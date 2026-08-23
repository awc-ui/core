#!/usr/bin/env node
/**
 * `nuxi typecheck`, with third-party PARSE errors reported but not fatal.
 *
 * THE PROBLEM, precisely. Nuxt's generated types reference the `nuxt` package,
 * which reaches `@nuxt/schema`, which reaches `@nuxt/vite-builder` and
 * `@vitejs/plugin-vue-jsx`. That last one's declaration file uses an
 * arbitrary-string export name:
 *
 *     export { … vueJsxPluginCjs as "module.exports" };
 *
 * TypeScript 5.4 cannot PARSE that. It is a syntax error (TS1003/TS1128), not a
 * type error, so `skipLibCheck` does not suppress it even though Nuxt's own
 * tsconfig sets it — and there is no way to keep Nuxt's auto-import and route
 * types while dropping that reference, because they arrive together through the
 * same `nuxt` package.
 *
 * Neither side can move from here: the repo pins TypeScript at ^5.4 for every
 * package, and the lockfile's Nuxt 3.21 brings the Vite 7 toolchain with it.
 * Bumping TypeScript workspace-wide fixes it in one line and is the real fix.
 *
 * WHAT THIS DOES. Runs the real check, then fails on any diagnostic in this
 * app's own files and only warns about ones inside `node_modules`. It prints
 * what it ignored every run, so the situation stays visible rather than
 * quietly filtered away — and if the third-party errors ever disappear, it says
 * so and asks to be deleted, so it cannot rot into a check that passes
 * everything.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const result = spawnSync('pnpm', ['exec', 'nuxi', 'typecheck'], {
  cwd: appRoot,
  encoding: 'utf8',
  shell: false,
});

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const diagnostics = output
  .split('\n')
  .filter((line) => /error TS\d+:/.test(line));

const external = diagnostics.filter((line) => line.includes('node_modules'));
const ours = diagnostics.filter((line) => !line.includes('node_modules'));

for (const line of ours) console.error(line);

if (external.length) {
  console.warn(
    `\n[typecheck] ignored ${external.length} PARSE error(s) inside node_modules.\n` +
      '            TypeScript 5.4 cannot parse the Vite 7 toolchain\'s declaration\n' +
      '            files, which Nuxt pulls in through @nuxt/schema. Bump the\n' +
      '            workspace TypeScript past 5.5 and delete scripts/typecheck.mjs,\n' +
      '            pointing "lint" back at `nuxi typecheck`. Example:\n' +
      `            ${external[0].trim().slice(-90)}`,
  );
} else if (ours.length === 0) {
  console.warn(
    '[typecheck] no third-party parse errors any more — delete scripts/typecheck.mjs\n' +
      '            and set "lint": "nuxi typecheck" in package.json.',
  );
}

if (ours.length) {
  console.error(`\n[typecheck] ${ours.length} error(s) in this app.`);
  process.exit(1);
}
console.log('[typecheck] no errors in this app.');
