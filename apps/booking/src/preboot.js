// Runs before paint; use the same validated defaults as preferences.js.
(() => {
  try {
    const stored = JSON.parse(localStorage.getItem("roam.preferences.v1") || "{}");
    const prefs = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    const root = document.documentElement;
    root.dataset.theme = prefs.theme === "dark" ? "dark" : "light";
    root.dataset.density = [0, -1, -2, -3, -4].includes(prefs.density) ? String(prefs.density) : "0";
    root.dir = prefs.rtl === true ? "rtl" : "ltr";
    root.style.colorScheme = root.dataset.theme;
    const css = localStorage.getItem("roam.theme.css");
    const style = document.getElementById("roam-primary-theme");
    if (style && css && /^#[a-f0-9]{6}$/i.test(prefs.primary)) style.textContent = css;
  } catch { /* HTML defaults are ready when storage is unavailable. */ }
})();
