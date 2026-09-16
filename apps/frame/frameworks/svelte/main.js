import { mount, unmount } from 'svelte';
import FrameShell from './FrameShell.svelte';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const app = mount(FrameShell, { target: document.querySelector('#app') });
if (import.meta.hot) import.meta.hot.dispose(() => unmount(app));
