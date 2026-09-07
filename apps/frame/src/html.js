import { mountFrame } from './app.js';
const dispose = mountFrame(document.querySelector('#app'), { framework: 'html', renderShell: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
