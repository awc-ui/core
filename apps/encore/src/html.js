import { mountEncore } from './app.js';
import { ensureAwc } from './runtime.js';
await ensureAwc();
const dispose = mountEncore(document.querySelector('#app'), { framework: 'html', renderShell: true });
if (import.meta.hot) {
  const hot = import.meta.hot;
  hot.dispose(dispose);
}
