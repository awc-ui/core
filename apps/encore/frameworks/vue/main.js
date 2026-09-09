import { createApp } from 'vue';
import EncoreShell from './EncoreShell.vue';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const app = createApp(EncoreShell);
app.mount('#app');
if (import.meta.hot) import.meta.hot.dispose(() => app.unmount());
