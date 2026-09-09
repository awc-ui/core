import {
  computeTheme,
  applyThemeRoles,
  clearThemeRoles,
} from "./vendor/awc-theme.mjs";

export const DEFAULT_PRIMARY = "#365CE6";
export const DEFAULT_APPEARANCE = Object.freeze({
  theme: "light",
  language: "en",
  density: "0",
  direction: "ltr",
  primary: null,
});
export const DENSITIES = [
  ["0", "Comfortable"],
  ["-1", "Cozy"],
  ["-2", "Compact"],
  ["-3", "Dense"],
  ["-4", "Extra dense"],
];
export function normalizeAppearance(value = {}) {
  return {
    language: value.language === "ar" ? "ar" : "en",
    theme: ["light", "dark"].includes(value.theme)
      ? value.theme
      : DEFAULT_APPEARANCE.theme,
    density: DENSITIES.some(([density]) => density === value.density)
      ? value.density
      : DEFAULT_APPEARANCE.density,
    direction: ["ltr", "rtl"].includes(value.direction)
      ? value.direction
      : value.language === "ar"
        ? "rtl"
        : "ltr",
    primary:
      typeof value.primary === "string" && /^#[0-9a-f]{6}$/i.test(value.primary)
        ? value.primary.toUpperCase()
        : null,
  };
}
export function readAppearance(storage) {
  try {
    storage ??= globalThis.localStorage;
    return normalizeAppearance(
      Object.fromEntries(
        Object.keys(DEFAULT_APPEARANCE).map((key) => [
          key,
          storage.getItem("habitat." + key),
        ]),
      ),
    );
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}
export function saveAppearance(value, storage) {
  try {
    storage ??= globalThis.localStorage;
    for (const [key, item] of Object.entries(normalizeAppearance(value))) {
      if (item === null) storage.removeItem("habitat." + key);
      else storage.setItem("habitat." + key, item);
    }
  } catch {}
}
let cachedSeed;
let cachedTheme;
export function applyAppearance(value, root = document.documentElement) {
  const prefs = normalizeAppearance(value);
  root.dataset.theme = prefs.theme;
  if (prefs.density === "0") root.removeAttribute("data-density");
  else root.dataset.density = prefs.density;
  root.dir = prefs.direction;
  root.lang = prefs.language;
  if (prefs.primary) {
    if (cachedSeed !== prefs.primary) {
      cachedTheme = computeTheme({ primaryHex: prefs.primary });
      cachedSeed = prefs.primary;
    }
    applyThemeRoles(root, cachedTheme.roles[prefs.theme]);
  } else clearThemeRoles(root);
  return prefs;
}
