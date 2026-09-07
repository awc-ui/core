import React from 'react';
import { createRoot } from 'react-dom/client';
import { FrameShell } from './FrameShell.jsx';
import { ensureAwc } from '../../src/runtime.js';
await ensureAwc();
const root = createRoot(document.querySelector('#app'));
root.render(<React.StrictMode><FrameShell /></React.StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
