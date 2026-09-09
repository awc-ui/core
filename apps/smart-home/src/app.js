import { registerHomeTools } from "./webmcp.js";
import {
  createState,
  rooms,
  scenes,
  energy,
  setDevice,
  applyScene,
  watts,
  createRoutine,
  clamp,
} from "./model.js";
import { t, n } from "./i18n.js";
import {
  h,
  icon,
  button,
  nav,
  home,
  roomView,
  scenesView,
  energyView,
  routineView,
  deviceSheet,
  routineDialog,
  deviceStatus,
  isActive,
} from "./views.js";
import {
  readAppearance,
  saveAppearance,
  applyAppearance,
  DEFAULT_APPEARANCE,
  DEFAULT_PRIMARY,
  DENSITIES,
  normalizeAppearance,
} from "./preferences.js";
const $ = (s, root = document) => root.querySelector(s),
  $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = createState(),
  appearance = readAppearance();
let epoch = 0;
const pending = new Set();
function toast(message) {
  const el = $("#toast");
  el.message = t(message);
  el.show();
}
function addActivity(text, glyph = "check_circle") {
  state.activity.unshift({
    text,
    icon: glyph,
    time: new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
  });
  state.activity = state.activity.slice(0, 12);
  const list = $(".activity-list");
  if (list)
    list.innerHTML = state.activity
      .slice(0, 3)
      .map(
        (a) =>
          `<md-list-item headline="${h(a.text)}" supporting-text="${h(a.time)}" leading-icon="${a.icon}"></md-list-item>`,
      )
      .join("");
}
async function ready(root = document) {
  await Promise.all(
    [
      ...new Set(
        $$("*", root)
          .map((el) => el.localName)
          .filter((tag) => tag.startsWith("md-")),
      ),
    ].map((tag) => customElements.whenDefined(tag)),
  );
}
async function perform(key, control, label, work, scope = control) {
  if (pending.has(key)) return;
  pending.add(key);
  const ticket = epoch;
  control.loading = true;
  scope.setAttribute("aria-busy", "true");
  $("#action-status").textContent = t(label);
  try {
    await new Promise((r) => setTimeout(r, 320));
    if (!control.isConnected || ticket !== epoch || scope.open === false)
      return;
    await work();
  } catch {
    toast("Something went wrong. Please try again.");
  } finally {
    control.loading = false;
    scope.removeAttribute("aria-busy");
    pending.delete(key);
    if (!pending.size) $("#action-status").textContent = "";
  }
}
function route(next) {
  if (location.hash === "#/" + next) render();
  else location.hash = "/" + next;
}
function shell() {
  $(".skip-link").textContent = t("Skip to home controls");
  $("#app").innerHTML =
    `<div class="app-layout"><md-navigation-rail class="home-nav" id="nav" data-theme="dark" variant="expanded" expandable full-height label="${h("Home navigation")}" toggle-label="${h("Expand or collapse navigation")}"><span slot="logo" class="brand-symbol">${icon("home_app_logo")}</span><div slot="logo-expanded" class="brand"><span class="brand-symbol">${icon("home_app_logo")}</span><strong>habitat<span class="brand-period">.</span></strong></div>${nav.map(([id, label, glyph]) => `<md-navigation-rail-tab value="${id}" label="${h(label)}" icon="${glyph}"></md-navigation-rail-tab>`).join("")}<md-avatar slot="footer-leading" initials="AM" size="32" name="Alex Morgan"></md-avatar><div slot="footer-content" class="account-content"><div class="account-copy"><strong>Alex Morgan</strong><span>${h("Home owner")}</span></div><md-tooltip text="${h("Make it yours")}"><md-icon-button icon="tune" aria-label="${h("Make it yours")}" data-action="settings"></md-icon-button></md-tooltip></div></md-navigation-rail><div class="workspace"><md-app-bar class="home-appbar"><div slot="headline" class="home-location">${icon("nest_multi_room")}<span>${h("Maple House")}</span><span class="demo-label"><md-status-dot inline size="small" state="neutral"></md-status-dot>${h("Demo home")}</span></div><md-tooltip slot="trailing" text="${h("Make it yours")}"><md-icon-button icon="tune" aria-label="${h("Make it yours")}" data-action="settings"></md-icon-button></md-tooltip><md-avatar slot="trailing" initials="AM" name="Alex Morgan" size="36"></md-avatar></md-app-bar><main id="main" tabindex="-1"></main><footer class="app-footer"><span><md-status-dot inline size="small" state="neutral"></md-status-dot>${h("Demo devices. Changes stay in this tab.")}</span><span>Habitat · AWC UI</span></footer></div><md-navigation-bar id="mobile-nav" aria-label="${h("Home navigation")}">${nav.map(([id, label, glyph]) => `<md-navigation-tab value="${id}" label="${h(label)}" icon="${glyph}"></md-navigation-tab>`).join("")}</md-navigation-bar></div>`;
  $("#nav").addEventListener("mdTabChange", (e) => route(e.detail.value));
  $("#mobile-nav").addEventListener("mdChange", (e) => {
    if (e.target.id === "mobile-nav" && nav[e.detail.index])
      route(nav[e.detail.index][0]);
  });
  applyAppearance({ ...appearance, theme: "dark" }, $("#nav"));
  responsive();
}
function responsive() {
  const rail = $("#nav");
  if (rail)
    rail.variant = matchMedia("(max-width:1200px)").matches
      ? "standard"
      : "expanded";
}
async function chart() {
  const e = $("#energy-chart");
  if (e) {
    await customElements.whenDefined("md-bar-chart");
    if (!e.isConnected) return;
    const data = energy[state.period];
    e.xAxis = { data: data.labels.map(t) };
    e.yAxis = { min: 0, label: "kWh", axisLine: false };
    e.series = [{ label: t("Energy"), color: "primary", data: data.data }];
    e.valueFormatter = (v) => n(v, 1) + " kWh";
    e.locale = document.documentElement.lang === "ar" ? "ar-EG" : "en-GB";
  }
  const spark = $("#energy-spark");
  if (spark) {
    await customElements.whenDefined("md-sparkline");
    spark.data = [...energy.day.data];
    spark.color = "primary";
  }
}
async function render() {
  epoch++;
  state.route = nav.some(([id]) => id === location.hash.slice(2))
    ? location.hash.slice(2)
    : "home";
  if (!$("#main")) shell();
  const index = nav.findIndex(([id]) => id === state.route);
  $("#nav").activeIndex = index;
  $("#mobile-nav").activeIndex = index;
  $("#main").innerHTML = {
    home,
    rooms: roomView,
    scenes: scenesView,
    energy: energyView,
    routines: routineView,
  }[state.route](state);
  await chart();
}
function refreshDevices() {
  for (const d of state.devices) {
    $$(`[data-device-card="${d.id}"]`).forEach((card) =>
      card.classList.toggle("device-on", isActive(d)),
    );
    $$(`[data-device-status="${d.id}"]`).forEach(
      (el) =>
        (el.innerHTML = `<md-status-dot inline size="small" state="${!d.online ? "neutral" : isActive(d) ? "online" : "neutral"}"></md-status-dot>${deviceStatus(d)}`),
    );
    $$(`[data-power="${d.id}"]`).forEach((el) => (el.selected = d.on));
    $$(`[data-level="${d.id}"]`).forEach((el) => {
      el.value = d.level;
      el.valueText = n(d.level) + " " + t("percent");
      el.disabled = !d.online || (!d.on && d.type !== "blinds");
    });
    $$(`[data-level-output="${d.id}"]`).forEach(
      (el) => (el.textContent = n(d.level) + "%"),
    );
  }
  $$("[data-watts]").forEach((el) => (el.textContent = n(watts(state)) + " W"));
  $$("[data-living-on]").forEach(
    (el) =>
      (el.textContent = n(
        state.devices.filter((d) => d.room === "living" && d.on).length,
      )),
  );
  $$("[data-scene]").forEach((el) => {
    el.variant = state.activeScene === el.dataset.scene ? "filled" : "tonal";
    el.setAttribute(
      "aria-pressed",
      String(state.activeScene === el.dataset.scene),
    );
    if (el.closest(".scene-card"))
      el.textContent = t(
        state.activeScene === el.dataset.scene ? "Run again" : "Run scene",
      );
  });
  syncClimate();
}
function syncClimate() {
  const meter = $("#temperature-ring");
  if (meter) {
    meter.value = state.target;
    meter.valueText = n(state.target, 1) + "°";
  }
  const slider = $("#temperature-slider");
  if (slider) {
    slider.value = state.target;
    slider.valueText = n(state.target, 1) + " " + t("degrees Celsius");
    slider.disabled = !state.climateOn;
  }
  $$('[data-action^="temperature-"]').forEach(
    (el) => (el.disabled = !state.climateOn),
  );
  if ($("#climate-power")) $("#climate-power").selected = state.climateOn;
  $$("#climate-mode md-segmented-button").forEach((el) => {
    el.selected = el.value === state.climate;
    el.disabled = !state.climateOn;
  });
}
async function closeRoutineDialog() {
  const dialog = $("#routine-dialog");
  const picker = dialog?.querySelector("md-time-picker");
  if (picker?.open) await picker.hide();
  await dialog?.close();
}
async function openDevice(id) {
  const d = state.devices.find((d) => d.id === id);
  if (!d) return;
  $("#overlays").innerHTML = deviceSheet(d);
  await ready($("#overlays"));
  const sheet = $("#device-sheet");
  await sheet.show();
}
function settingsMarkup() {
  return `<md-side-sheet id="settings-sheet" headline="${h("Make it yours")}" variant="modal" top-divider bottom-divider closeable><div class="sheet-content settings-content"><section><h3 data-i18n="Primary color">${h("Primary color")}</h3><md-color-picker id="primary-picker" variant="inline" format="hex" value="${appearance.primary || DEFAULT_PRIMARY}" presets="#365CE6,#006874,#795548,#8B4ABD,#0B7A55,#B3261E" aria-label="${h("Primary color")}" show-inputs="false"></md-color-picker></section><md-divider></md-divider><md-select id="appearance-language" label="${h("Language")}" data-label="Language" value="${appearance.language}"><md-select-option value="en" label="English"></md-select-option><md-select-option value="ar" label="العربية"></md-select-option></md-select><md-select id="appearance-density" label="${h("Density")}" data-label="Density" value="${appearance.density}">${DENSITIES.map(([v, l]) => `<md-select-option value="${v}" label="${h(l)}" data-label="${l}"></md-select-option>`).join("")}</md-select><div class="row between"><span data-i18n="Dark theme">${h("Dark theme")}</span><md-switch id="appearance-dark" aria-label="${h("Dark theme")}" ${appearance.theme === "dark" ? "selected" : ""}></md-switch></div><div class="row between"><span data-i18n="Right-to-left layout">${h("Right-to-left layout")}</span><md-switch id="appearance-rtl" aria-label="${h("Right-to-left layout")}" ${appearance.direction === "rtl" ? "selected" : ""}></md-switch></div></div><md-button slot="actions" variant="text" data-action="reset-appearance" data-i18n="Reset defaults">${h("Reset defaults")}</md-button><md-button slot="actions" variant="filled" data-action="close-settings" data-i18n="Done">${h("Done")}</md-button></md-side-sheet>`;
}
function changeAppearance(patch, save = true) {
  Object.assign(appearance, normalizeAppearance({ ...appearance, ...patch }));
  applyAppearance(appearance);
  if ($("#nav")) applyAppearance({ ...appearance, theme: "dark" }, $("#nav"));
  if (save) saveAppearance(appearance);
  chart();
}
async function openSettings() {
  $("#overlays").innerHTML = settingsMarkup();
  await ready($("#overlays"));
  await $("#settings-sheet").show();
}
document.addEventListener("mdSelect", (e) => {
  const chip = e.target.closest("[data-room]");
  if (!chip) return;
  state.room = chip.dataset.room;
  render();
});
document.addEventListener("mdInput", (e) => {
  const el = e.target;
  if (el.matches("[data-level]")) {
    if (setDevice(state, el.dataset.level, { level: e.detail.value }))
      refreshDevices();
  } else if (el.id === "temperature-slider") {
    state.target = clamp(e.detail.value, 16, 30);
    state.activeScene = null;
    refreshDevices();
  } else if (el.id === "primary-picker") {
    changeAppearance({ primary: e.detail.value }, false);
  }
});
document.addEventListener("mdChange", (e) => {
  const el = e.target;
  if (el.matches("[data-power]")) {
    setDevice(state, el.dataset.power, { on: e.detail.selected });
    refreshDevices();
    const d = state.devices.find((d) => d.id === el.dataset.power);
    addActivity(
      `${t(d.name)} · ${t(d.type === "lock" ? (d.on ? "Locked" : "Unlocked") : d.on ? "On" : "Off")}`,
      d.icon,
    );
  } else if (el.matches("[data-routine]")) {
    const r = state.routines.find((r) => r.id === el.dataset.routine);
    if (r) {
      r.enabled = e.detail.selected;
      toast(t(r.name) + " · " + t(r.enabled ? "Enabled" : "Disabled"));
    }
  } else if (el.id === "climate-power") {
    state.climateOn = e.detail.selected;
    state.activeScene = null;
    refreshDevices();
  } else if (el.id === "climate-mode") {
    state.climate = e.detail[0] || "auto";
    state.activeScene = null;
    refreshDevices();
  } else if (el.id === "energy-period") {
    state.period = e.detail[0] === "day" ? "day" : "week";
    render();
  } else if (el.id === "primary-picker")
    changeAppearance({ primary: e.detail.value });
  else if (el.id === "appearance-density")
    changeAppearance({ density: e.detail });
  else if (el.id === "appearance-dark")
    changeAppearance({ theme: e.detail.selected ? "dark" : "light" });
  else if (el.id === "appearance-rtl")
    changeAppearance({ direction: e.detail.selected ? "rtl" : "ltr" });
  else if (el.id === "appearance-language") {
    changeAppearance({
      language: e.detail,
      direction: e.detail === "ar" ? "rtl" : "ltr",
    });
    const sheet = $("#settings-sheet");
    shell();
    render();
    sheet.headline = t("Make it yours");
    $$("[data-i18n]", sheet).forEach(
      (el) => (el.textContent = t(el.dataset.i18n)),
    );
    $$("[data-label]", sheet).forEach((el) => (el.label = t(el.dataset.label)));
    $("#appearance-rtl").selected = appearance.direction === "rtl";
    $("#appearance-rtl").setAttribute("aria-label", t("Right-to-left layout"));
    $("#appearance-dark").setAttribute("aria-label", t("Dark theme"));
    $("#primary-picker").setAttribute("aria-label", t("Primary color"));
  }
});
document.addEventListener("mdClick", async (e) => {
  const el = e.target.closest("[data-action],[data-scene],[data-run-routine]");
  if (!el) return;
  if (el.dataset.scene || el.dataset.runRoutine) {
    const sceneId =
      el.dataset.scene ||
      state.routines.find((r) => r.id === el.dataset.runRoutine)?.scene;
    await perform("scene", el, "Applying scene…", () => {
      if (applyScene(state, sceneId)) {
        addActivity(
          `${t(scenes.find((s) => s.id === sceneId).name)} · ${t("Scene applied")}`,
          "auto_awesome",
        );
        refreshDevices();
        toast(
          t("Scene applied") +
            " · " +
            t(scenes.find((s) => s.id === sceneId).name),
        );
      }
    });
    return;
  }
  const action = el.dataset.action;
  if (nav.some(([id]) => id === action)) {
    route(action);
    return;
  }
  if (action.startsWith("room:")) {
    state.room = action.slice(5);
    route("rooms");
  } else if (action.startsWith("device:")) openDevice(action.slice(7));
  else if (action === "close-device") await $("#device-sheet")?.close();
  else if (action === "settings") openSettings();
  else if (action === "close-settings") await $("#settings-sheet")?.close();
  else if (action === "temperature-up" || action === "temperature-down") {
    if (state.climateOn) {
      state.target = clamp(
        state.target + (action.endsWith("up") ? 0.5 : -0.5),
        16,
        30,
      );
      state.activeScene = null;
      refreshDevices();
    }
  } else if (action.startsWith("favorite:")) {
    const d = state.devices.find((d) => d.id === action.slice(9));
    d.favorite = !d.favorite;
    el.textContent = t(
      d.favorite ? "Remove from favorites" : "Add to favorites",
    );
    el.icon = d.favorite ? "star" : "star_border";
    render();
  } else if (action === "reset-appearance") {
    changeAppearance(DEFAULT_APPEARANCE);
    shell();
    render();
    await $("#settings-sheet").close();
    openSettings();
  } else if (action === "new-routine") {
    $("#overlays").innerHTML = routineDialog();
    await ready($("#overlays"));
    await $("#routine-dialog").show();
    $("#routine-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = $('md-button[type="submit"]', form);
      if (submit.loading) return;
      const data = Object.fromEntries(new FormData(form));
      if (
        !String(data.name || "").trim() ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)
      ) {
        $("#routine-error").textContent = t("Enter a name and a valid time.");
        return;
      }
      const dialog = $("#routine-dialog");
      await perform(
        "routine",
        submit,
        "Saving routine…",
        async () => {
          if (createRoutine(state, data)) {
            await closeRoutineDialog();
            render();
            toast("Routine saved");
          }
        },
        dialog,
      );
    });
  } else if (action === "close-dialog") await closeRoutineDialog();
});
addEventListener("hashchange", async () => {
  await $("#device-sheet")?.close();
  await closeRoutineDialog();
  await render();
  $("#main")?.focus();
});
matchMedia("(max-width:1200px)").addEventListener("change", responsive);
applyAppearance(appearance);
await Promise.all(
  [
    "md-navigation-rail",
    "md-navigation-bar",
    "md-switch",
    "md-slider",
    "md-meter",
    "md-button",
    "md-snackbar",
  ].map((tag) => customElements.whenDefined(tag)),
);
shell();
await render();

const unregisterTools = registerHomeTools(document.modelContext, state, render);
addEventListener("pagehide", unregisterTools, { once: true });
