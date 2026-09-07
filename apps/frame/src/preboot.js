try {
  const preferences = JSON.parse(localStorage.getItem('awc:frame:v1'))?.preferences || {};
  const theme = preferences.theme || 'dark';
  if (theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.setAttribute('data-theme', 'dark');
  if (preferences.compact) document.documentElement.setAttribute('data-density', '-1');
  if (preferences.motion === false) {
    document.documentElement.setAttribute('data-ripple', 'off');
    document.documentElement.setAttribute('data-shape-morph', 'off');
  }
  document.documentElement.dataset.accent = ['red', 'violet', 'blue'].includes(preferences.accent) ? preferences.accent : 'red';
} catch { document.documentElement.dataset.theme = 'dark'; }

document.documentElement.dataset.boot = 'loading';
// Start AWC before the framework bundle so its skeletons can hydrate first.
import(new URL('./awc/md3.esm.js', document.baseURI).href).catch(() => {});
const frameStartupTimer = setTimeout(() => {
  const placeholder = document.querySelector('#startup-loading');
  if (!placeholder) return;
  placeholder.setAttribute('aria-busy', 'false');
  placeholder.setAttribute('aria-label', 'Frame could not start');
  placeholder.innerHTML = '<div class="empty-state"><h1>Frame couldn’t finish loading.</h1><p>Check your connection and reload to try again.</p><a href="">Reload Frame</a></div>';
}, 15000);
document.addEventListener('frame-ready', () => {
  clearTimeout(frameStartupTimer);
  delete document.documentElement.dataset.boot;
}, { once: true });
