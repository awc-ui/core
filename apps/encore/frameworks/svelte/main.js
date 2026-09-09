import EncoreShell from './EncoreShell.svelte';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const app = new EncoreShell({ target: document.querySelector('#app') });
if (import.meta.hot) import.meta.hot.dispose(() => app.$destroy());
