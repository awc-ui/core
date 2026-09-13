import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositorySkills = resolve(packageRoot, '../../skills');
const skillSource = existsSync(repositorySkills) ? repositorySkills : join(packageRoot, 'skills');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'awc-ai-setup-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'project');
  const installed = join(project, 'node_modules/@awc-ui/core');
  await mkdir(join(installed, 'bin'), { recursive: true });
  await cp(join(packageRoot, 'package.json'), join(installed, 'package.json'));
  for (const name of ['awc-ui.mjs', 'project-tools.mjs', 'skill-tools.mjs']) {
    await cp(join(packageRoot, 'bin', name), join(installed, 'bin', name));
  }
  await cp(skillSource, join(installed, 'skills'), { recursive: true });
  const run = (...args) => spawnSync(process.execPath, [join(installed, 'bin/awc-ui.mjs'), 'ai-setup', ...args], {
    cwd: project, encoding: 'utf8', timeout: 15000,
  });
  return { root, project, installed, run };
}

async function files(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await files(join(directory, entry.name), path));
    else result[path] = await readFile(join(directory, entry.name), 'utf8');
  }
  return result;
}

test('default ai-setup still writes only documentation pointers and preserves user instructions', async t => {
  const { project, run } = await fixture(t);
  await writeFile(join(project, 'AGENTS.md'), '# Our project\nKeep these instructions.\n');
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(project, '.agents')), false);
  const pointer = await readFile(join(project, 'AGENTS.md'), 'utf8');
  assert.match(pointer, /^# Our project\nKeep these instructions\.\n/);
  assert.match(pointer, /node_modules\/@awc-ui\/core\/main-llm\.md/);
  assert.equal(run('--check').status, 0);
});

test('--skills dry-run and check report missing portable skills without writing anything', async t => {
  const { project, run } = await fixture(t);
  const preview = run('--skills', '--dry-run');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /\.agents\/skills\/awc-ui-build/);
  assert.match(preview.stdout, /\.agents\/skills\/awc-ui-review/);
  assert.match(preview.stdout, /nothing written/);
  assert.deepEqual(await readdir(project), ['node_modules']);
  const check = run('--skills', '--check');
  assert.equal(check.status, 1);
  assert.match(check.stderr, /2 skill\(s\) missing/);
  assert.deepEqual(await readdir(project), ['node_modules']);
});

test('--skills installs the authored portable contents and stays idempotent', async t => {
  const { project, installed, run } = await fixture(t);
  const result = run('--skills');
  assert.equal(result.status, 0, result.stderr);
  const copied = await files(join(project, '.agents/skills'));
  assert.deepEqual(copied, await files(join(installed, 'skills')));
  for (const name of ['awc-ui-build', 'awc-ui-review']) {
    assert.match(copied[`${name}/SKILL.md`], new RegExp(`name: ${name}`));
    assert.match(copied[`${name}/SKILL.md`], /@awc-ui\/core/);
    assert.match(copied[`${name}/SKILL.md`], /main-llm\.md/);
    assert.match(copied[`${name}/agents/openai.yaml`], /display_name:/);
    assert.doesNotMatch(copied[`${name}/SKILL.md`], /\/Users\/|\/private\/tmp\/|[A-Z]:\\Users\\/);
  }
  const repeat = run('--skills');
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.match(repeat.stdout, /Already up to date/);
  assert.deepEqual(await files(join(project, '.agents/skills')), copied);
  const check = run('--skills', '--check');
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /pointers and skills are up to date/);
});

test('customized skills block installation before either skills or pointers are written', async t => {
  const { project, run } = await fixture(t);
  const custom = join(project, '.agents/skills/awc-ui-build');
  await mkdir(custom, { recursive: true });
  await writeFile(join(custom, 'SKILL.md'), '# My customized skill\n');
  await writeFile(join(custom, 'notes.md'), 'Keep this file.\n');
  for (const args of [[], ['--dry-run'], ['--check']]) {
    const result = run('--skills', ...args);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /customized skills are never overwritten/);
    assert.equal(existsSync(join(project, 'AGENTS.md')), false);
    assert.equal(existsSync(join(project, '.agents/skills/awc-ui-review')), false);
    assert.equal(await readFile(join(custom, 'SKILL.md'), 'utf8'), '# My customized skill\n');
    assert.equal(await readFile(join(custom, 'notes.md'), 'utf8'), 'Keep this file.\n');
  }
});

test('extra user files and changed packaged files are preserved as conflicts', async t => {
  const { project, installed, run } = await fixture(t);
  assert.equal(run('--skills').status, 0);
  const notes = join(project, '.agents/skills/awc-ui-build/notes.md');
  await writeFile(notes, 'Local conventions\n');
  assert.equal(run('--skills', '--check').status, 1);
  assert.equal(run('--skills').status, 1);
  assert.equal(await readFile(notes, 'utf8'), 'Local conventions\n');
  await rm(notes);
  const original = await readFile(join(project, '.agents/skills/awc-ui-build/SKILL.md'), 'utf8');
  await writeFile(join(installed, 'skills/awc-ui-build/SKILL.md'), original + '\nNew package guidance.\n');
  assert.equal(run('--skills').status, 1);
  assert.equal(await readFile(join(project, '.agents/skills/awc-ui-build/SKILL.md'), 'utf8'), original);
});

test('project skill symlinks cannot redirect installation outside the project', async t => {
  const { root, project, run } = await fixture(t);
  const outside = join(root, 'outside');
  await mkdir(outside);
  await symlink(outside, join(project, '.agents'), 'dir');
  let result = run('--skills');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not a file or symbolic link/);
  assert.deepEqual(await readdir(outside), []);
  assert.equal(existsSync(join(project, 'AGENTS.md')), false);
  await rm(join(project, '.agents'));
  await mkdir(join(project, '.agents/skills'), { recursive: true });
  await symlink(outside, join(project, '.agents/skills/awc-ui-build'), 'dir');
  result = run('--skills');
  assert.equal(result.status, 1);
  assert.deepEqual(await readdir(outside), []);
  assert.equal(existsSync(join(project, 'AGENTS.md')), false);
});

test('missing packaged skills fail with an actionable error before any project writes', async t => {
  const { project, installed, run } = await fixture(t);
  await rm(join(installed, 'skills'), { recursive: true });
  const result = run('--skills');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Packaged AI skills are missing/);
  assert.equal(existsSync(join(project, 'AGENTS.md')), false);
  assert.equal(existsSync(join(project, '.agents')), false);
  assert.equal(run().status, 0);
});
