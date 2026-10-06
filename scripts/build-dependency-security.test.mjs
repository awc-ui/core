import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const fromNuxtApp = createRequire(new URL('../apps/example-nuxt/package.json', import.meta.url));
const fromNuxt = createRequire(fromNuxtApp.resolve('nuxt/package.json'));
const devtoolsEntry = fromNuxt.resolve('@nuxt/devtools/dist/module.mjs');
const fromDevtools = createRequire(devtoolsEntry);
const { GitPluginError, simpleGit } = await import(pathToFileURL(fromDevtools.resolve('simple-git')).href);

test('Nuxt DevTools loads its Git integration after the named-export migration', async () => {
  const module = await import(pathToFileURL(join(dirname(devtoolsEntry), 'chunks/module-main.mjs')).href);
  assert.equal(typeof module.m.enableModule, 'function');
});

test('Nuxt DevTools Git metadata calls work and unsafe inline configuration is rejected', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'awc-git-security-'));
  try {
    execFileSync('git', ['init', '-b', 'main', directory], { stdio: 'pipe' });
    execFileSync(
      'git',
      [
        '-c', 'user.name=Dependency Test',
        '-c', 'user.email=dependency-test@example.test',
        '-c', 'commit.gpgsign=false',
        '-c', 'core.hooksPath=/dev/null',
        'commit', '--allow-empty', '-m', 'fixture',
      ],
      { cwd: directory, stdio: 'pipe' },
    );

    const git = simpleGit(directory);
    assert.equal((await git.branch()).current, 'main');
    assert.match(await git.revparse(['--short', 'HEAD']), /^[a-f0-9]{7,40}$/);
    assert.equal((await git.status()).isClean(), true);

    // The version command does not invoke a trailer or load included config.
    // These inert values test rejection without executing an injected command.
    for (const config of [
      'trailer.audit.cmd=awc-unused-test-command',
      'include.path=/awc-nonexistent-security-test-config',
      'includeIf.onbranch:main.path=/awc-nonexistent-security-test-config',
    ]) {
      await assert.rejects(
        simpleGit({ baseDir: directory, config: [config] }).raw(['--version']),
        GitPluginError,
        `Unsafe configuration must be rejected: ${config}`,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

// Follow the docs dependency chain to exercise postcss-nested 6 with its
// patched parser, instead of a different parser used by the CSS lint tools.
const fromDocs = createRequire(new URL('../apps/docs/package.json', import.meta.url));
let fromPackage = fromDocs;
for (const packageName of ['@astrojs/starlight', 'astro-expressive-code', 'rehype-expressive-code', 'expressive-code', '@expressive-code/core']) {
  // Some ESM packages intentionally do not export a require entry or manifest.
  // Locate their real manifest to follow pnpm's actual dependency links.
  let manifest;
  for (const searchPath of fromPackage.resolve.paths(packageName)) {
    try {
      manifest = realpathSync(join(searchPath, packageName, 'package.json'));
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  assert.ok(manifest, `Cannot locate ${packageName} in the docs dependency chain`);
  fromPackage = createRequire(manifest);
}
const postcss = fromPackage('postcss');
const nested = fromPackage('postcss-nested');

test('Expressive Code nested selectors preserve parent combinations with the patched parser', async () => {
  const result = await postcss([nested()]).process(
    '.frame, .panel { color: red; & > .line { color: blue; &:hover, &:focus { color: green; } } @media (min-width: 30rem) { &.active { display: block; } } }',
    { from: undefined },
  );
  const rules = [];
  result.root.walkRules((rule) => rules.push(rule.selector));
  assert.deepEqual(rules, [
    '.frame, .panel',
    '.frame > .line, .panel > .line',
    '.frame > .line:hover, .frame > .line:focus, .panel > .line:hover, .panel > .line:focus',
    '.frame.active, .panel.active',
  ]);
  assert.equal(result.root.nodes.at(-1).name, 'media');
  assert.equal(result.root.nodes.at(-1).params, '(min-width: 30rem)');
});
