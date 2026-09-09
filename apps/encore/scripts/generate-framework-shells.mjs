import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseFragment } from 'parse5';
import { appRoot } from './paths.mjs';
import { shellMarkup } from '../src/shell.js';
import { startupMarkup } from '../src/loading.js';
import { loadState } from '../src/model.js';

// Compile one static AWC shell to real JSX, Vue, Svelte, and Angular templates.
// Frameworks own these elements and their mount/unmount lifecycle. Empty
// outlets inside the shell are explicitly owned by the shared app controller.
const nativeNames = { class: 'className', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', 'for': 'htmlFor' };
const nativeBooleans = new Set(['hidden', 'required', 'readonly', 'multiple', 'disabled']);
function jsx(node) {
  if (node.nodeName === '#text') return `{${JSON.stringify(node.value)}}`;
  if (!node.tagName) return (node.childNodes || []).map(jsx).join('\n');
  const custom = node.tagName.includes('-');
  const attributes = node.attrs.map(({ name, value }) => ` ${custom ? name : nativeNames[name] || name}={${!custom && nativeBooleans.has(name) ? 'true' : JSON.stringify(value)}}`).join('');
  const children = (node.childNodes || []).map(jsx).join('\n');
  return children ? `<${node.tagName}${attributes}>\n${children}\n</${node.tagName}>` : `<${node.tagName}${attributes} />`;
}
const preface = 'Generated from src/shell.js by scripts/generate-framework-shells.mjs. Edit the shell source.';
export async function generateFrameworkShells() {
  const state = loadState({ getItem: () => null });
  const index = (await readFile(resolve(appRoot, 'src/index.html'), 'utf8'))
    .replace('<!-- encore:loading -->', startupMarkup())
    .replace('    <script type="module" src="./awc/md3.esm.js"></script>\n', '')
    .replace('    <script type="module" src="./html.js"></script>\n', '');
  const write = async (name, file, text) => {
    const path = resolve(appRoot, 'frameworks', name, file);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, text);
  };
  for (const name of ['react', 'vue', 'svelte', 'angular']) {
    const html = shellMarkup(state).replace('value="html" variant="outlined"', `value="${name}" variant="outlined"`);
    const host = `<div class="encore-framework-host">${html}</div>`;
    if (name === 'react') {
      await write(name, 'EncoreShell.jsx', `// ${preface}\nimport { useLayoutEffect, useRef } from 'react';\nimport { mountEncore } from '../../src/app.js';\nexport function EncoreShell() {\n  const root = useRef(null);\n  useLayoutEffect(() => mountEncore(root.current, { framework: 'react' }), []);\n  return <div ref={root} className="encore-framework-host">${jsx(parseFragment(html))}</div>;\n}\n`);
    } else if (name === 'vue') {
      await write(name, 'EncoreShell.vue', `<!-- ${preface} -->\n<script setup>\nimport { ref, onMounted, onBeforeUnmount } from 'vue';\nimport { mountEncore } from '../../src/app.js';\nconst root = ref(null);\nlet dispose;\nonMounted(() => { dispose = mountEncore(root.value, { framework: 'vue' }); });\nonBeforeUnmount(() => dispose?.());\n</script>\n<template>${host.replace('class="encore-framework-host"', 'ref="root" class="encore-framework-host"')}</template>\n`);
    } else if (name === 'svelte') {
      await write(name, 'EncoreShell.svelte', `<!-- ${preface} -->\n<script>\nimport { onMount } from 'svelte';\nimport { mountEncore } from '../../src/app.js';\nlet root;\nonMount(() => mountEncore(root, { framework: 'svelte' }));\n</script>\n${host.replace('class="encore-framework-host"', 'bind:this={root} class="encore-framework-host"')}\n`);
    } else {
      await write(name, 'src/shell.html', `<!-- ${preface} -->\n${html}\n`);
    }
    await write(name, name === 'angular' ? 'src/index.html' : 'index.html', name === 'angular'
      ? index.replace('<div id="app"></div>', '<div id="app"><encore-shell></encore-shell></div>')
      : index.replace('</body>', `  <script type="module" src="./main.${name === 'react' ? 'jsx' : 'js'}"></script>\n  </body>`));
  }
}
