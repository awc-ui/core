import { mount, unmount } from 'svelte';
import EncoreShell from './EncoreShell.svelte';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const app = mount(EncoreShell, { target: document.querySelector('#app') });
if (import.meta.hot) {
  const hot = import.meta.hot;
  hot.dispose(() => unmount(app));
}
