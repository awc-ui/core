(() => {
  const root = document.documentElement;
  root.dataset.boot = 'loading';
  try {
    const prefs = JSON.parse(localStorage.getItem('encore.preferences.v1')) || {};
    root.dataset.theme = prefs.theme === 'dark' || (prefs.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    root.dataset.accent = ['violet', 'rose', 'teal'].includes(prefs.accent) ? prefs.accent : 'violet';
    root.dir = prefs.direction === 'rtl' ? 'rtl' : 'ltr';
    root.dataset.density = prefs.compact ? 'compact' : 'comfortable';
  } catch {}
  const timer = setTimeout(() => {
    const loading = document.getElementById('startup-loading');
    if (loading) loading.innerHTML = '<h1>Encore is taking a little longer</h1><p>Check your connection, then <a href="">reload the app</a>.</p>';
  }, 15000);
  addEventListener('encore-ready', () => { clearTimeout(timer); delete root.dataset.boot; document.getElementById('startup-loading')?.remove(); }, { once: true });
})();
