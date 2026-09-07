import { applyThemeStylesheet, computeTheme } from "@awc-ui/theme";

export const APPEARANCE_KEY = "metro-appearance";
export const DEFAULT_APPEARANCE = Object.freeze({
  primary: "#3658cf",
  density: -1,
  direction: "ltr",
});

export function normalizeAppearance(value) {
  const candidate = value && typeof value === "object" ? value : {};
  return {
    primary:
      typeof candidate.primary === "string" &&
      /^#[\da-f]{6}$/i.test(candidate.primary)
        ? candidate.primary.toLowerCase()
        : DEFAULT_APPEARANCE.primary,
    density: [0, -1, -2, -3, -4].includes(candidate.density)
      ? candidate.density
      : DEFAULT_APPEARANCE.density,
    direction: candidate.direction === "rtl" ? "rtl" : "ltr",
  };
}

export function readAppearance() {
  try {
    return normalizeAppearance(
      JSON.parse(localStorage.getItem(APPEARANCE_KEY)),
    );
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(value) {
  try {
    localStorage.setItem(
      APPEARANCE_KEY,
      JSON.stringify(normalizeAppearance(value)),
    );
    return true;
  } catch {
    return false;
  }
}

let appliedPrimary;
export function applyAppearance(value) {
  const appearance = normalizeAppearance(value);
  const root = document.documentElement;
  root.dataset.density = String(appearance.density);
  root.dir = appearance.direction;
  if (appearance.primary !== appliedPrimary) {
    if (appearance.primary === DEFAULT_APPEARANCE.primary) {
      document.getElementById("metro-custom-theme")?.remove();
    } else {
      applyThemeStylesheet(
        computeTheme({ primaryHex: appearance.primary }),
        "metro-custom-theme",
      );
    }
    appliedPrimary = appearance.primary;
  }
  return appearance;
}
