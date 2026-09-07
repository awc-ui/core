import FrameShell from './FrameShell.svelte';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const app = new FrameShell({ target: document.querySelector('#app') });
if (import.meta.hot) import.meta.hot.dispose(() => app.$destroy());
