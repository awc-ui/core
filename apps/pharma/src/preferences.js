import { computeTheme, applyThemeStylesheet } from "./vendor/theme.js";
export const defaults = Object.freeze({
  primary: "#7c3b66",
  theme: "light",
  density: -1,
  rtl: false,
  expanded: true,
});
export function readPreferences() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem("vela.preferences.v1") || "{}");
  } catch {}
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  return {
    primary: /^#[a-f0-9]{6}$/i.test(saved.primary)
      ? saved.primary
      : defaults.primary,
    theme: saved.theme === "dark" ? "dark" : "light",
    density: [0, -1, -2].includes(saved.density) ? saved.density : -1,
    rtl: saved.rtl === true,
    expanded: saved.expanded !== false,
  };
}
export function savePreferences(prefs) {
  try {
    localStorage.setItem("vela.preferences.v1", JSON.stringify(prefs));
  } catch {}
}
let lastPrimary;
export function applyPreferences(prefs) {
  const root = document.documentElement;
  const density = String(prefs.density);
  const direction = prefs.rtl ? "rtl" : "ltr";
  if (root.dataset.theme !== prefs.theme) root.dataset.theme = prefs.theme;
  if (root.dataset.density !== density) root.dataset.density = density;
  if (root.dir !== direction) root.dir = direction;
  if (lastPrimary !== prefs.primary) {
    applyThemeStylesheet(
      computeTheme({ primaryHex: prefs.primary }),
      "vela-primary-theme",
    );
    lastPrimary = prefs.primary;
    try {
      localStorage.setItem(
        "vela.theme.css",
        document.getElementById("vela-primary-theme").textContent,
      );
    } catch {}
  }
  savePreferences(prefs);
}
