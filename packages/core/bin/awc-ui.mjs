#!/usr/bin/env node
/**
 * awc-ui — wire this package's documentation into the AI assistants working in
 * a consumer's project.
 *
 * The manuals ship inside the package (main-llm.md and
 * src/components/<tag>/readme.md), but no assistant scans node_modules on its own. Each one reads a
 * specific file in the PROJECT root instead: Claude Code reads CLAUDE.md, Cursor
 * reads .cursor/rules/*.mdc, Copilot reads .github/copilot-instructions.md, and
 * Codex and friends read AGENTS.md. So the docs are only discoverable once
 * something plants a pointer in those files. This is the default behavior;
 * --skills also installs the bundled skills inside the current project.
 *
 *   npx awc-ui ai-setup             write the pointers
 *   npx awc-ui ai-setup --dry-run   show what would be written, touch nothing
 *   npx awc-ui ai-setup --check     exit 1 if any pointer is missing or stale
 *   npx awc-ui ai-setup --skills    also install project-local AI skills
 *
 * Every block is delimited by markers, so re-running updates the block in place
 * instead of appending a second copy, and everything outside the markers — the
 * consumer's own instructions — is preserved byte for byte.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { doctor, initProject, projectInfo, setupInstruction } from './project-tools.mjs';
import { planSkills, writeSkills } from './skill-tools.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, '..');
const pkg = JSON.parse(await readFile(join(PKG_ROOT, 'package.json'), 'utf8'));

const BEGIN = '<!-- BEGIN awc-ui -->';
const END = '<!-- END awc-ui -->';

const args = process.argv.slice(2);
const cmd = args.find((a) => !a.startsWith('-')) ?? 'help';
const dryRun = args.includes('--dry-run');
const check = args.includes('--check');
const frameworkIndex = args.indexOf('--framework');
const explicitFramework = frameworkIndex === -1 ? undefined : args[frameworkIndex + 1];
if (frameworkIndex !== -1 && (!explicitFramework || explicitFramework.startsWith('-'))) throw new Error('--framework requires a name');
const { framework } = await projectInfo(process.cwd(), explicitFramework);

/** Where the docs live from the project root, however the package got hoisted. */
function docsBase(projectRoot) {
  const rel = relative(projectRoot, PKG_ROOT).split('\\').join('/');
  return rel.startsWith('..') ? `node_modules/${pkg.name}` : rel;
}

/**
 * The pointer text. Deliberately short: the rules that stop an assistant doing
 * real damage are inline, and everything else is a path it can open on demand.
 * A long block competes with the consumer's own instructions for attention.
 */
function block(base) {
  return `## ${pkg.name}

This project uses **${pkg.name}**, a Material Design 3 web component library.
Its full documentation is installed locally — read it, do not guess at APIs.

| Read this | For |
|---|---|
| \`${base}/main-llm.md\` | **Start here.** Match the task scope, choose components, and find relevant setup and recipes |
| \`${base}/src/components/<tag>/readme.md\` | One component: full API, accessibility contract, anti-patterns |

**Before writing markup for a component, open its manual** and read its
*When NOT to use* and *Anti-patterns* sections. They describe the mistakes
assistants actually make with this library.

Follow the user's task: reuse existing project decisions, ask only about
consequential missing choices for a new app, and keep reviews read-only unless
a fix is requested. A focused edit does not require a new interview or scaffold.

Rules that apply everywhere:

- Integration for **${framework}**: ${setupInstruction(framework)}
- **Arrays, objects and functions are properties, not attributes.** Assign them
  in JavaScript (\`el.data = [...]\`); as an attribute they stringify to nothing
  useful.
- **Never invent an API.** If a prop, event, slot or CSS part is not in that
  component's manual, it does not exist — do not infer one from a sibling.
- Every icon-only control needs an \`aria-label\`.
- Density rungs are \`-1\` through \`-4\`. \`density="0"\` is the default and is
  inert — it does NOT opt out of an inherited \`data-density\`; set
  \`--md-sys-density-scale: 0\` for that.
- Theme through \`--md-sys-*\` tokens and the documented \`::part()\` names. Do not
  reach into shadow DOM.`;
}

/** Splice the block into existing content, preserving everything around it. */
function splice(existing, body) {
  const marked = `${BEGIN}\n${body}\n${END}`;
  if (existing.includes(BEGIN) && existing.includes(END)) {
    return existing.replace(
      new RegExp(`${BEGIN}[\\s\\S]*?${END}`),
      () => marked,
    );
  }
  return existing.trim() ? `${existing.trimEnd()}\n\n${marked}\n` : `${marked}\n`;
}

/** Cursor wants frontmatter; alwaysApply keeps it in context for every request. */
function cursorRule(base) {
  return `---
description: ${pkg.name} — Material Design 3 web components. Local docs and the rules for using them.
alwaysApply: true
---

${block(base)}
`;
}

async function aiSetup(projectRoot) {
  const base = docsBase(projectRoot);
  const body = block(base);
  let skills = [];
  if (args.includes('--skills')) {
    try { skills = await planSkills(PKG_ROOT, projectRoot); }
    catch (error) {
      console.error(`\n${error.message}`);
      process.exitCode = 1;
      return;
    }
    for (const skill of skills) console.log(`  ${skill.state.padEnd(10)} ${skill.path}  — project-local AI skill`);
    if (skills.some(skill => skill.state === 'conflict')) {
      console.error('\nExisting AI skills differ from this package. Nothing written. Review and move the conflicting directories before re-running; customized skills are never overwritten.');
      process.exitCode = 1;
      return;
    }
  }

  const targets = [
    { file: 'AGENTS.md', build: (prev) => splice(prev, body), tool: 'Codex, Amp, and the AGENTS.md convention' },
    { file: 'CLAUDE.md', build: (prev) => splice(prev, body), tool: 'Claude Code' },
    { file: '.github/copilot-instructions.md', build: (prev) => splice(prev, body), tool: 'GitHub Copilot' },
    { file: '.cursor/rules/awc-ui.mdc', build: () => cursorRule(base), tool: 'Cursor' },
  ];

  let changed = 0;
  for (const t of targets) {
    const path = join(projectRoot, t.file);
    const prev = existsSync(path) ? await readFile(path, 'utf8') : '';
    const next = t.build(prev);
    const state = prev === next ? 'up to date' : prev ? 'updated' : 'created';
    if (prev !== next) changed++;
    if (prev !== next && !dryRun && !check) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, next);
    }
    console.log(`  ${state.padEnd(10)} ${t.file}  — ${t.tool}`);
  }

  if (check) {
    const missingSkills = skills.filter(skill => skill.state === 'created').length;
    if (changed || missingSkills) {
      console.error(`\n${changed} pointer(s) missing or stale.${args.includes('--skills') ? ` ${missingSkills} skill(s) missing.` : ''} Run: npx awc-ui ai-setup${args.includes('--skills') ? ' --skills' : ''}`);
      process.exit(1);
    }
    console.log(`\nAll AI assistant pointers${args.includes('--skills') ? ' and skills' : ''} are up to date.`);
    return;
  }
  const skillFiles = skills.filter(skill => skill.state === 'created').reduce((total, skill) => total + skill.files.length, 0);
  changed += skillFiles;
  if (dryRun) {
    console.log(`\n--dry-run: nothing written. ${changed} file(s) would change.`);
    return;
  }
  await writeSkills(skills);
  console.log(
    changed
      ? `\nDone. ${changed} file(s) written. Your AI assistant will pick up ${pkg.name}'s docs from ${base}/.`
      : '\nAlready up to date — nothing to do.',
  );
}

switch (cmd) {
  case 'init': {
    const directory = args[1] && !args[1].startsWith('-') ? args[1] : 'awc-app';
    const result = await initProject({ packageRoot: PKG_ROOT, cwd: process.cwd(), directory, framework: explicitFramework ?? 'html', dryRun });
    console.log(`${dryRun ? 'Would create' : 'Created'} ${result.framework} app in ${result.directory}`);
    for (const file of result.files) console.log(`  ${file}`);
    const quotedDirectory = "'" + result.directory.replaceAll("'", "'\\''") + "'";
    console.log(`Next: cd ${quotedDirectory} && npm install && npm run dev`);
    break;
  }
  case 'doctor': {
    const result = await doctor(process.cwd(), explicitFramework);
    if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`AWC UI integration: ${result.framework}`);
      for (const check of result.checks) console.log(`${check.status.toUpperCase()}: ${check.message}`);
      console.log(result.guidance);
    }
    if (!result.ok) process.exitCode = 1;
    break;
  }
  case 'ai-setup':
    await aiSetup(process.cwd());
    break;
  default:
    console.log(`${pkg.name} v${pkg.version}

  npx awc-ui init my-app --framework html|next|nuxt|sveltekit|astro
                                   Create a standalone project in an empty directory.
  npx awc-ui doctor [--json]        Check installed packages and integration setup.
  --framework NAME                 Override framework detection for doctor/ai-setup.

  npx awc-ui ai-setup              Point this project's AI assistants at the
                                   documentation installed with this package.
                                   Writes AGENTS.md, CLAUDE.md,
                                   .github/copilot-instructions.md and
                                   .cursor/rules/awc-ui.mdc, updating an existing
                                   awc-ui block in place and leaving the rest of
                                   each file untouched.

    --dry-run                      Show what would change, write nothing.
    --check                        Exit non-zero if a pointer is missing or
                                   stale, or requested skills differ. Useful in CI.
    --skills                       Also install bundled skills into this project's
                                   .agents/skills/. Works with --dry-run and --check.
                                   Existing identical skills are kept; customized
                                   skills cause a conflict and are never overwritten.
`);
    if (cmd !== 'help') process.exit(1);
}
