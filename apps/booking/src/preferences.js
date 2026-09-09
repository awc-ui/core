import { computeTheme, applyThemeStylesheet } from "./vendor/theme.js";

export const PREFERENCES_KEY = "roam.preferences.v1";
export const THEME_CSS_KEY = "roam.theme.css";
export const defaults = Object.freeze({ primary: "#006b5e", theme: "light", density: 0, rtl: false });

export function normalizePreferences(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
  return {
    primary: /^#[a-f0-9]{6}$/i.test(saved.primary) ? saved.primary.toLowerCase() : defaults.primary,
    theme: saved.theme === "dark" ? "dark" : "light",
    density: [0, -1, -2, -3, -4].includes(saved.density) ? saved.density : defaults.density,
    rtl: saved.rtl === true,
  };
}

export function readPreferences() {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}")); }
  catch { return { ...defaults }; }
}

let lastPrimary;
export function applyPreferences(value, persist = true) {
  const prefs = normalizePreferences(value);
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.density = String(prefs.density);
  root.dir = prefs.rtl ? "rtl" : "ltr";
  root.style.colorScheme = prefs.theme;
  if (lastPrimary !== prefs.primary) {
    applyThemeStylesheet(computeTheme({ primaryHex: prefs.primary }), "roam-primary-theme");
    lastPrimary = prefs.primary;
  }
  if (persist) {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
      localStorage.setItem(THEME_CSS_KEY, document.getElementById("roam-primary-theme").textContent);
    } catch { /* Preferences still work when browser storage is unavailable. */ }
  }
  return prefs;
}

export function initPreferences({ notify = () => {} } = {}) {
  let prefs = applyPreferences(readPreferences());
  let host = document.getElementById("preference-overlays");
  if (!host) {
    host = document.createElement("div");
    host.id = "preference-overlays";
    document.body.append(host);
  }
  host.innerHTML = `<md-side-sheet id="roam-preferences" class="roam-preferences" variant="modal" side="end" headline="Make it yours" top-divider bottom-divider>
    <div class="roam-preference-content">
      <p>A little more you. Your preferences are saved on this browser.</p>
      <section class="roam-preference-section" aria-labelledby="roam-color-title"><h3 id="roam-color-title">Your color</h3><p>Choose a primary color for buttons, controls, and accents.</p><md-color-picker id="roam-primary" variant="inline" format="hex" value="${prefs.primary}" presets="#006b5e,#4362a0,#82536b,#98652a,#6851a0" aria-label="Primary color"></md-color-picker></section>
      <section class="roam-preference-section" aria-labelledby="roam-display-title"><h3 id="roam-display-title">Display</h3>
        <label class="roam-preference-toggle"><span><strong>Dark mode</strong><span>A softer view after sunset.</span></span><md-switch id="roam-dark" icons aria-label="Dark mode" ${prefs.theme === "dark" ? "selected" : ""}></md-switch></label>
        <md-select id="roam-density" label="Interface density" full-width value="${prefs.density}" supporting-text="Choose the spacing that feels right." reserve-supporting-space></md-select>
      </section>
      <section class="roam-preference-section" aria-labelledby="roam-direction-title"><h3 id="roam-direction-title">Reading direction</h3><label class="roam-preference-toggle"><span><strong>Right to left</strong><span>Mirror the layout and controls.</span></span><md-switch id="roam-rtl" icons aria-label="Right to left" ${prefs.rtl ? "selected" : ""}></md-switch></label></section>
    </div>
    <md-button slot="actions" variant="text" data-preference="reset">Reset</md-button><md-button slot="actions" variant="filled" data-preference="done">Done</md-button>
  </md-side-sheet>`;
  const sheet = host.querySelector("md-side-sheet");
  const color = host.querySelector("md-color-picker");
  const density = host.querySelector("md-select");
  const dark = host.querySelector("#roam-dark");
  const rtl = host.querySelector("#roam-rtl");
  const initialized = (async () => {
    await Promise.all([sheet, color, density, dark, rtl, ...host.querySelectorAll("md-button")].map(async (element) => {
      await customElements.whenDefined(element.localName);
      await element.componentOnReady?.();
    }));
    density.options = [
      { value: "0", label: "Comfortable · default" },
      { value: "-1", label: "Cozy" },
      { value: "-2", label: "Compact" },
      { value: "-3", label: "Dense" },
      { value: "-4", label: "Extra dense" },
    ];
  })();
  const commit = (change) => { prefs = applyPreferences({ ...prefs, ...change }); };
  color.addEventListener("mdInput", (event) => {
    if (/^#[a-f0-9]{6}$/i.test(event.detail?.value)) applyPreferences({ ...prefs, primary: event.detail.value }, false);
  });
  color.addEventListener("mdChange", (event) => {
    if (/^#[a-f0-9]{6}$/i.test(event.detail?.value)) commit({ primary: event.detail.value });
  });
  density.addEventListener("mdChange", (event) => commit({ density: Number(event.detail) }));
  dark.addEventListener("mdChange", (event) => commit({ theme: event.detail.selected ? "dark" : "light" }));
  rtl.addEventListener("mdChange", (event) => commit({ rtl: event.detail.selected }));
  sheet.addEventListener("mdClose", (event) => {
    if (event.target === sheet) applyPreferences(prefs); // End any uncommitted picker preview.
  });
  host.querySelector('[data-preference="reset"]').addEventListener("mdClick", async () => {
    await initialized;
    prefs = applyPreferences(defaults);
    color.value = prefs.primary;
    density.value = String(prefs.density);
    dark.selected = false;
    rtl.selected = false;
    notify("Your preferences are back to the Roam defaults.");
  });
  host.querySelector('[data-preference="done"]').addEventListener("mdClick", () => sheet.close());
  return {
    async open() { await initialized; await sheet.show(); },
    get preferences() { return { ...prefs }; },
  };
}
