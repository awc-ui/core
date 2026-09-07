import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { appRoot } from './paths.mjs';
import { buildFrame } from './build.mjs';
import { generateFrameworkShells } from './generate-framework-shells.mjs';

const require = createRequire(import.meta.url);
const assets = resolve(appRoot, '.framework-assets');
const staging = resolve(appRoot, '.framework-build');
const run = (args, cwd) => new Promise((accept, reject) => {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, NG_CLI_ANALYTICS: 'false', NG_BUILD_MAX_WORKERS: '2' } });
  child.on('error', reject);
  child.on('exit', code => code === 0 ? accept() : reject(new Error(`Angular build exited ${code}`)));
});

export async function buildFrameworks(destination = resolve(appRoot, 'dist')) {
  await generateFrameworkShells();
  await rm(staging, { recursive: true, force: true });
  await rm(assets, { recursive: true, force: true });
  try {
    await buildFrame(resolve(staging, 'html'));
    await mkdir(assets, { recursive: true });
    for (const file of ['awc', 'fonts', 'licenses', 'favicon.svg', 'preboot.js', 'theme.css', 'styles.css']) {
      await cp(resolve(staging, 'html', file), resolve(assets, file), { recursive: true });
    }
    for (const name of ['react', 'vue', 'svelte']) {
      const plugins = name === 'react' ? [react()] : name === 'vue'
        ? [vue({ template: { compilerOptions: { isCustomElement: tag => tag.startsWith('md-') } } })]
        : [svelte()];
      await build({
        configFile: false,
        root: resolve(appRoot, 'frameworks', name),
        base: './', publicDir: assets, plugins,
        build: { outDir: resolve(staging, name), emptyOutDir: true, assetsInlineLimit: 0, target: 'esnext' },
      });
    }
    await run([require.resolve('@angular/cli/bin/ng.js'), 'build', 'frame-angular', '--output-path', resolve(staging, 'angular-output')], resolve(appRoot, 'frameworks/angular'));
    await cp(resolve(staging, 'angular-output/browser'), resolve(staging, 'angular'), { recursive: true });
    // Publish only after every compiler succeeds, and preserve other showcases.
    await mkdir(destination, { recursive: true });
    for (const name of ['html', 'react', 'vue', 'angular', 'svelte']) {
      await rm(resolve(destination, name), { recursive: true, force: true });
      await cp(resolve(staging, name), resolve(destination, name), { recursive: true });
    }
    // Only the standalone server needs a root entry. Astro owns the docs overview.
    if (resolve(destination) === resolve(appRoot, 'dist')) {
      await writeFile(resolve(destination, 'index.html'), '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Frame</title><script src="./redirect.js"></script></head><body><a href="./html/">Open Frame</a></body></html>');
      await writeFile(resolve(destination, 'redirect.js'), "const url = new URL('./html/', location.href); url.search = location.search; url.hash = location.hash; location.replace(url.href);\n");
    }
    console.log('Frame: HTML, React, Vue, Angular, and Svelte builds ready.');
  } finally {
    await rm(assets, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildFrameworks();
