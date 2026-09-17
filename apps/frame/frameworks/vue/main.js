import { createApp } from 'vue';
import FrameShell from './FrameShell.vue';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const app = createApp(FrameShell);
app.mount('#app');
if (import.meta.hot) {
  const hot = import.meta.hot;
  hot.dispose(() => app.unmount());
}
