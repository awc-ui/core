#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkEnvironment } from './check-environment.mjs';

export function verifyBuildGraph(graph) {
  const task = id => {
    const found = graph.tasks.find(item => item.taskId === id);
    assert.ok(found, `Missing build task ${id}`);
    return found;
  };
  const core = task('@awc-ui/core#build');
  assert.ok(core.outputs.includes('hydrate/**'), 'Core cache must include its hydrate SSR renderer');
  const storybook = task('@awc-ui/storybook#build');
  for (const dependency of ['@awc-ui/core#build', '@awc-ui/theme#build']) {
    assert.ok(storybook.dependencies.includes(dependency), `Storybook must wait for ${dependency}`);
  }
  assert.equal(storybook.command, 'storybook build', 'Storybook must not rebuild dependency outputs');
  assert.ok(storybook.outputs.includes('storybook-static/**'), 'Cache the actual Storybook output');
  const docs = task('@awc-ui/docs#build');
  for (const dependency of ['@awc-ui/core#build', '@awc-ui/theme#build', '@awc-ui/docs#generate-data']) {
    assert.ok(docs.dependencies.includes(dependency), `Docs must wait for ${dependency}`);
  }
}

function main() {
  checkEnvironment();
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const tests = spawnSync(process.execPath, ['--test', 'scripts/tests/contributor-tooling.test.mjs'], { cwd: root, stdio: 'inherit' });
  if (tests.error) throw tests.error;
  if (tests.status !== 0) throw new Error('Contributor tooling tests failed.');
  const dry = spawnSync('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=@awc-ui/storybook', '--filter=@awc-ui/docs', '--dry=json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  if (dry.error) throw dry.error;
  if (dry.status !== 0) throw new Error(dry.stderr || dry.stdout || 'Turbo dry run failed.');
  verifyBuildGraph(JSON.parse(dry.stdout));
  console.log('Contributor checks passed: supported Node, generator safety/syntax, watch routing, and actual Turbo build graph. No build ran.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
