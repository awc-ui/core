#!/usr/bin/env node
/**
 * Changeset Check — Story 4.5
 *
 * Fails the PR if non-trivial source files changed but no `.changeset/*.md`
 * files were added. Exempt paths (docs, CI, spec files, planning artifacts)
 * never require a changeset.
 *
 * Run from CI on pull_request events. Skipped on push events and on the
 * Version Packages bot's own PRs.
 *
 * Env vars expected from GitHub Actions:
 *   BASE_SHA  — github.event.pull_request.base.sha
 *
 * Exit codes:
 *   0 — changeset present OR all changes are exempt OR script intentionally skipped
 *   1 — non-trivial source changes detected with no changeset
 *   2 — tool / IO error
 */

import { spawnSync } from 'node:child_process';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const EXEMPT_PATTERNS = [
  /^apps\/docs\//,
  /^apps\/storybook\//,
  /^apps\/test-/, // apps/test-react, apps/test-vue, apps/test-angular, apps/test-svelte
  /^docs\//,
  /^\.github\//,
  /^_/, // top-level _-prefixed dirs are scratch/planning trees, never published
  /^\.agents\//,
  /^\.cursor\//,
  /^\.changeset\//, // changes to changeset files don't themselves require a new changeset
  /^scripts\//, // build/CI scripts; rarely user-facing
  /(^|\/)README\.md$/i,
  /(^|\/)CHANGELOG\.md$/i,
  /(^|\/)\.gitignore$/,
  /(^|\/)\.gitattributes$/,
  /(^|\/)LICENSE(\.[A-Za-z]+)?$/,
  /^license-policy\.json$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
  /^\.stylelintrc/,
  /^\.editorconfig$/,
  /^turbo\.json$/,
  /^pnpm-workspace\.yaml$/,
  /^tsconfig\.json$/,
];

function isExempt(file) {
  return EXEMPT_PATTERNS.some(pat => pat.test(file));
}

function fail(code, msg) {
  console.error(`${RED}${BOLD}error${RESET} ${msg}`);
  process.exit(code);
}

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    fail(2, `git ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function main() {
  const baseSha = process.env.BASE_SHA;
  if (!baseSha) {
    console.log(
      `${DIM}changeset-check: BASE_SHA not set — skipping (only runs in PR context).${RESET}`,
    );
    process.exit(0);
  }

  // Resolve the merge base in case the PR branch isn't directly ahead of base
  let mergeBase;
  try {
    mergeBase = git(['merge-base', baseSha, 'HEAD']);
  } catch {
    mergeBase = baseSha;
  }

  const diff = git(['diff', '--name-only', `${mergeBase}..HEAD`]);
  const files = diff.split('\n').map(s => s.trim()).filter(Boolean);

  if (files.length === 0) {
    console.log(`${GREEN}${BOLD}✓${RESET} No file changes between base and HEAD.`);
    process.exit(0);
  }

  const newChangesets = files.filter(
    f => f.startsWith('.changeset/') && f.endsWith('.md') && !/README\.md$/i.test(f),
  );
  const nonExempt = files.filter(f => !isExempt(f));

  if (newChangesets.length > 0) {
    console.log(
      `${GREEN}${BOLD}✓${RESET} Found ${newChangesets.length} changeset file(s):`,
    );
    for (const cs of newChangesets) console.log(`    ${DIM}- ${cs}${RESET}`);
    process.exit(0);
  }

  if (nonExempt.length === 0) {
    console.log(
      `${GREEN}${BOLD}✓${RESET} All ${files.length} changed file(s) are exempt (docs / CI / spec) — no changeset required.`,
    );
    process.exit(0);
  }

  console.error(
    `${RED}${BOLD}✗${RESET} This PR modifies ${nonExempt.length} non-exempt file(s) but contains no changeset.\n`,
  );
  console.error(`${BOLD}Non-exempt changes:${RESET}`);
  for (const f of nonExempt.slice(0, 30)) console.error(`    ${YELLOW}${f}${RESET}`);
  if (nonExempt.length > 30) {
    console.error(`    ${DIM}… and ${nonExempt.length - 30} more${RESET}`);
  }
  console.error(`\n${BOLD}→${RESET} Run ${BOLD}pnpm changeset${RESET} to add one. If this PR really should NOT bump versions`);
  console.error(`  (e.g., a pure refactor with no behavior change), add an empty changeset:`);
  console.error(`    ${BOLD}pnpm changeset --empty${RESET}\n`);
  console.error(`  Exempt paths (no changeset needed): apps/docs/, apps/storybook/, apps/test-*/,`);
  console.error(`  docs/, .github/, scripts/, _*/ (planning trees), .agents/, .cursor/,`);
  console.error(`  .changeset/, README.md, CHANGELOG.md, license-policy.json, lint configs.\n`);
  process.exit(1);
}

try {
  main();
} catch (e) {
  fail(2, e.stack || String(e));
}
