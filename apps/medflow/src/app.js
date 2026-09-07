import { t, getLanguage, setLanguage, locale, number } from "./i18n.js";
import { runAction, hydrateRegion, waitForComponents } from "./feedback.js";
import { computeTheme, applyThemeStylesheet } from "./vendor/theme.js";
import {
  createInitialState,
  clinicians,
  departments,
  caseStatuses,
  priorities,
  clinicianLoad,
  getMetrics,
  assignCases,
  updateCaseStatus,
  addCaseNote,
  createCase,
  filterCases,
  escapeHtml as esc,
} from "./model.js";
import { authView, wireAuth, handleAuthAction, clearAuth } from "./auth.js";
import {
  nav,
  icon,
  brand,
  button,
  select,
  avatar,
  person,
  shell,
  syncShellLanguage,
  overview,
  casesView,
  tableView,
  visibleCases,
  teamView,
  activityView,
  detailsView,
} from "./views.js";
const PRIMARY_THEME_ID = "medflow-primary-theme";
const DEFAULT_PRIMARY = "#006B5E";
let primaryColor = document.documentElement.dataset.primary || DEFAULT_PRIMARY;
function rememberPreference(key, value) {
  try {
    localStorage.setItem(`medflow-${key}`, value);
  } catch {
    // Preferences still work for this page when storage is unavailable.
  }
}
function applyPrimaryColor(value, persist = false) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return;
  const nextColor = value.toUpperCase();
  if (nextColor === DEFAULT_PRIMARY) {
    primaryColor = DEFAULT_PRIMARY;
    document.getElementById(PRIMARY_THEME_ID).textContent = "";
    delete document.documentElement.dataset.primary;
    if (persist) rememberPreference("primary", "");
    return;
  }
  if (
    nextColor === primaryColor &&
    document.documentElement.dataset.primary &&
    document.getElementById(PRIMARY_THEME_ID).textContent
  ) {
    if (persist)
      rememberPreference(
        "primary",
        JSON.stringify({
          hex: primaryColor,
          css: document.getElementById(PRIMARY_THEME_ID).textContent,
        }),
      );
    return;
  }
  primaryColor = nextColor;
  const theme = computeTheme({ primaryHex: primaryColor });
  applyThemeStylesheet(theme, PRIMARY_THEME_ID);
  // Keep the rail's dark surface, using the same generated palette.
  const dark = theme.roles.dark;
  const stylesheet = document.getElementById(PRIMARY_THEME_ID);
  stylesheet.textContent += `
:root[data-primary] {
    --mf-sidebar: ${dark.surfaceContainerLowest};
    --mf-sidebar-text: ${dark.onSurface};
    --mf-sidebar-muted: ${dark.onSurfaceVariant};
    --mf-sidebar-active: ${dark.primaryContainer};
    --mf-sidebar-on-active: ${dark.onPrimaryContainer};
  }`;
  document.documentElement.dataset.primary = primaryColor;
  if (persist) {
    rememberPreference(
      "primary",
      JSON.stringify({ hex: primaryColor, css: stylesheet.textContent }),
    );
  }
}
if (document.documentElement.dataset.primary) applyPrimaryColor(primaryColor);
const initialFilters = () => ({
  query: "",
  department: "all",
  status: "all",
  priority: "all",
  assignee: "all",
  sortBy: "priority",
  sortOrder: "asc",
});
const state = {
  data: createInitialState(),
  route: "overview",
  railExpanded: document.documentElement.dataset.railExpanded !== "false",
  auth: { pending: null, profile: null },
  queue: "all",
  filters: initialFilters(),
  page: 0,
  pageSize: 8,
  selected: new Set(),
  detailId: null,
};
const sessionStarted = Date.now();
const demoStart =
  Math.max(
    sessionStarted,
    ...state.data.activity.map((a) => new Date(a.at).getTime()),
  ) + 60000;
const demoNow = () => demoStart + Date.now() - sessionStarted;
const app = document.querySelector("#app"),
  overlays = document.querySelector("#overlays");
const authRoutes = ["login", "signup", "mfa", "recovery"];
let renderVersion = 0;
let navigationVersion = 0;
let hasRendered = false;
const callbacks = {
  navigate,
  toast,
  async complete(profile) {
    state.auth.profile = profile;
    state.auth.pending = null;
    await navigate("overview");
    toast("Demo verification complete. Welcome to Medflow.");
  },
};
async function ready(el) {
  if (el?.componentOnReady) await el.componentOnReady();
  return el;
}
async function toast(message) {
  const el = await ready(document.querySelector("#toast"));
  el.message = t(message);
  el.dismissLabel = t("Close");
  await el.show();
}
async function navigate(route) {
  const version = ++navigationVersion;
  if (![...nav.map((n) => n[0]), ...authRoutes].includes(route))
    route = "overview";
  if (["mfa", "recovery"].includes(route) && !state.auth.pending)
    route = "login";
  if (["login", "signup"].includes(route)) clearAuth(state);
  await closeOverlay();
  if (version !== navigationVersion) return;
  state.route = route;
  state.selected.clear();
  if (route === "assignments") {
    state.queue = "unassigned";
    state.filters = initialFilters();
    state.page = 0;
  }
  // Programmatic navigation renders exactly once and returns its readiness.
  // Back/forward hash changes still pass through the handler below.
  if (location.hash !== `#/${route}`) history.pushState(null, "", `#/${route}`);
  await render();
  if (version === navigationVersion) {
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector("#main")?.focus({ preventScroll: true });
  }
}
async function render() {
  const version = ++renderVersion;
  const initial = !hasRendered;
  hasRendered = true;
  document.title = `${t(nav.find((n) => n[0] === state.route)?.[2] || { login: "Sign in", signup: "Create account", mfa: "Verify identity", recovery: "Recovery code" }[state.route])} · Medflow`;
  document.querySelector(".skip-link").textContent = t("Skip to workspace");
  if (authRoutes.includes(state.route)) {
    app.innerHTML = authView(state.route, state);
    wireAuth(state, callbacks);
    await finishRender(
      app.querySelector("#main"),
      state.route,
      initial,
      version,
    );
    return;
  }
  const view =
    state.route === "overview"
      ? overview(state)
      : state.route === "team"
        ? teamView(state)
        : state.route === "activity"
          ? activityView(state)
          : casesView(state, state.route === "assignments");
  // Keep the library shell mounted so page changes do not restart rail
  // hydration, focus state, scroll position, or native animations.
  if (app.querySelector(".workspace")) {
    app.querySelector("#main").innerHTML = view;
    syncShell();
  } else {
    app.innerHTML = shell(state, view);
    wireShell();
  }
  wirePage();
  if (document.querySelector("#table-region")) renderTable();
  wireCharts();
  syncDirectionalIcons();
  syncShellLanguage(state);
  await finishRender(app.querySelector("#main"), state.route, initial, version);
}
async function finishRender(region, route, initial, version) {
  try {
    await hydrateRegion(region, route, {
      immediate: initial,
      readyRoot: initial ? app : region,
    });
  } catch (error) {
    if (version !== renderVersion || !region.isConnected) return;
    region.removeAttribute("aria-busy");
    region.innerHTML = `<section class="page-load-error"><h2>${esc(t("The workspace could not finish loading. Please try again."))}</h2><md-button variant="filled" icon="refresh" data-action="retry-page">${esc(t("Retry loading"))}</md-button></section>`;
  }
}
function wireShell() {
  const rail = document.querySelector("#navigation");
  const rememberRail = (expanded) => {
    state.railExpanded = expanded;
    document.documentElement.dataset.railExpanded = String(expanded);
    rail.toggleLabel = t(
      expanded ? "Collapse navigation" : "Expand navigation",
    );
    try {
      localStorage.setItem("medflow-rail-expanded", String(expanded));
    } catch {
      // The navigation remains usable when browser storage is unavailable.
    }
  };
  rail?.addEventListener("mdExpand", () => rememberRail(true));
  rail?.addEventListener("mdCollapse", () => rememberRail(false));
  document
    .querySelector("#navigation")
    ?.addEventListener("mdTabChange", (e) => navigate(e.detail.value));
  document
    .querySelector("#mobile-navigation")
    ?.addEventListener("mdChange", (e) => {
      if (e.target.id === "mobile-navigation") navigate(nav[e.detail.index][0]);
    });
}
function syncShell() {
  const index = nav.findIndex(([route]) => route === state.route);
  const metrics = getMetrics(state.data);
  document.querySelector("#navigation").activeIndex = index;
  document.querySelector("#mobile-navigation").activeIndex = index;
  document
    .querySelector('#navigation md-navigation-rail-tab[value="assignments"]')
    .setAttribute("badge-value", String(metrics.unassignedCases));
  document.querySelector("#rail-availability").textContent = t(
    "{count} clinicians available",
    { count: metrics.availableClinicians },
  );
}
function wirePage() {
  document.querySelector("#case-search")?.addEventListener("mdInput", (e) => {
    if (e.target.id !== "case-search") return;
    state.filters.query = e.detail;
    const clear = e.target.querySelector("[data-action=clear-search]");
    if (clear) clear.hidden = !e.detail;
    state.page = 0;
    state.selected.clear();
    renderTable();
  });
  document.querySelectorAll("[data-filter]").forEach((el) =>
    el.addEventListener("mdChange", (e) => {
      if (e.target !== el) return;
      state.filters[el.dataset.filter] = e.detail;
      state.page = 0;
      state.selected.clear();
      renderTable();
    }),
  );
  document.querySelectorAll("[data-queue]").forEach((el) =>
    el.addEventListener("mdSelect", () => {
      state.queue = el.dataset.queue;
      state.page = 0;
      state.selected.clear();
      document
        .querySelectorAll("[data-queue]")
        .forEach((c) => (c.selected = c.dataset.queue === state.queue));
      renderTable();
    }),
  );
}
function renderTable() {
  const region = document.querySelector("#table-region");
  if (!region) return;
  region.innerHTML = tableView(state);
  const table = document.querySelector("#case-table");
  table.addEventListener("mdRowClick", (e) => openDetails(e.detail.value));
  table.addEventListener("mdSelectionChange", (e) => {
    state.selected = new Set(e.detail.values);
    table.querySelectorAll("md-table-row[value]").forEach((row) => {
      if (
        state.data.cases.find((c) => c.id === row.value)?.status ===
        "Discharged"
      )
        row.selected = false;
    });
    syncBulk();
  });
  table.addEventListener("mdSortChange", (e) => {
    state.filters.sortBy = e.detail.column || "priority";
    state.filters.sortOrder = e.detail.order === "desc" ? "desc" : "asc";
    state.selected.clear();
    renderTable();
  });
  region
    .querySelector("md-table-pagination")
    .addEventListener("mdPageChange", (e) => {
      state.page = e.detail.page;
      state.selected.clear();
      renderTable();
    });
  region
    .querySelector("md-table-pagination")
    .addEventListener("mdRowsPerPageChange", (e) => {
      state.pageSize = e.detail.rowsPerPage;
      state.page = 0;
      state.selected.clear();
      renderTable();
    });
  syncBulk();
}
function syncBulk() {
  const bar = document.querySelector("#bulk-bar");
  if (bar) {
    bar.hidden = !state.selected.size;
    bar.numSelected = state.selected.size;
  }
}
function wireCharts() {
  document.querySelectorAll("[data-metric]").forEach((el) => {
    const i = Number(el.dataset.metric);
    el.data = [
      [12, 14, 16, 15, 18, 17, 19],
      [8, 7, 9, 6, 7, 6, 5],
      [2, 3, 2, 4, 3, 4, 4],
      [1, 2, 1, 2, 2, 3, 3],
    ][i];
    el.labels = ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon"].map((label) =>
      t(label),
    );
  });
  const flow = document.querySelector("#patient-flow");
  if (flow) {
    flow.xAxis = {
      scale: "category",
      data: ["Tue 1", "Wed 2", "Thu 3", "Fri 4", "Sat 5", "Sun 6", "Mon 7"].map(
        (label) => t(label),
      ),
    };
    flow.tableLabels = {
      x: t("Date"),
      index: t("Index"),
      series: t("Series"),
      truncated: t("Showing %shown% of %total% points"),
    };
    flow.yAxis = { min: 0, label: t("Patients") };
    flow.series = [
      { label: t("Admissions"), data: [14, 19, 15, 22, 18, 13, 17] },
      { label: t("Discharges"), data: [12, 13, 16, 15, 14, 11, 16] },
    ];
  }
  const department = document.querySelector("#department-chart");
  if (department) {
    department.xAxis = { data: departments.map((name) => t(name)) };
    department.yAxis = { min: 0, label: t("Cases") };
    department.series = [
      {
        label: t("Active cases"),
        data: departments.map(
          (d) =>
            state.data.cases.filter(
              (c) => c.department === d && c.status !== "Discharged",
            ).length,
        ),
      },
    ];
  }
}
async function closeOverlay() {
  const current = overlays.querySelector("md-side-sheet,md-dialog");
  if (current) {
    await ready(current);
    await current.close();
    if (overlays.firstElementChild === current) overlays.replaceChildren();
  }
  if (!overlays.firstElementChild) state.detailId = null;
}
async function showOverlay(html) {
  await closeOverlay();
  overlays.innerHTML = html;
  const el = await ready(overlays.firstElementChild);
  await waitForComponents(el);
  await el.show();
  return el;
}
async function openDetails(id) {
  const sheet = await showOverlay(detailsView(state, id));
  state.detailId = id;
  sheet.querySelector("#status-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await runAction(form, "Updating case view…", async () => {
        state.data = updateCaseStatus(
          state.data,
          id,
          new FormData(form).get("status"),
          demoNow(),
        );
        await refreshDetails(id);
        toast("Case status updated.");
      });
    } catch (error) {
      if (sheet.isConnected)
        sheet.querySelector("#detail-error").textContent = t(error.message);
      else toast(error.message);
    }
  });
  sheet.querySelector("#note-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await runAction(form, "Updating case view…", async () => {
        state.data = addCaseNote(
          state.data,
          id,
          new FormData(form).get("note"),
          state.auth.profile?.name || "Alex Chen",
          demoNow(),
        );
        await refreshDetails(id);
        toast("Coordination note added.");
      });
    } catch (error) {
      if (sheet.isConnected)
        sheet.querySelector("#detail-error").textContent = t(error.message);
      else toast(error.message);
    }
  });
}
async function refreshDetails(id) {
  await closeOverlay();
  await render();
  await openDetails(id);
}
async function openAssign(ids) {
  ids = ids.filter((id) => state.data.cases.some((c) => c.id === id));
  if (!ids.length) {
    toast("Select at least one patient case.");
    return;
  }
  const chosen = state.data.cases.filter((c) => ids.includes(c.id));
  const options = clinicians.map((c) => ({
    value: c.id,
    label: c.name,
    supportingText: t("{department} · {load}/{capacity} cases · {status}", {
      department: t(c.department),
      load: clinicianLoad(state.data, c.id),
      capacity: c.capacity,
      status: t(c.status),
    }),
    disabled:
      c.status !== "Available" ||
      clinicianLoad(state.data, c.id) +
        chosen.filter((p) => p.assigneeId !== c.id).length >
        c.capacity,
  }));
  const dialog = await showOverlay(
    `<md-dialog locale="${locale()}" id="assign-dialog" headline="${esc(ids.length === 1 ? t("Assign a care owner") : t("Assign {count} patient cases", { count: ids.length }))}" icon="assignment_ind"><div class="assignment-patients">${chosen.map((c) => `<div class="row">${avatar(c.initials)}<div><strong>${esc(c.patient)}</strong><p class="small muted">${esc(t(c.department))} · ${esc(t("{priority} priority", { priority: t(c.priority) }))}</p></div></div>`).join("")}</div><form id="assignment-form">${select("clinician", "Care owner", options, chosen.length === 1 && chosen[0].assigneeId ? chosen[0].assigneeId : "", "required filterable")}<p class="form-help">${t("Availability and total caseload are checked before assignment. Choose a clinician suited to the case.")}</p><p class="form-error" id="assignment-error" role="alert"></p><md-button variant="filled" type="submit" full-width icon="check">${t("Confirm assignment")}</md-button></form><md-button slot="actions" variant="text" data-action="close-overlay">${t("Cancel")}</md-button></md-dialog>`,
  );
  dialog.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await runAction(form, "Saving assignment…", async () => {
        const clinicianId = new FormData(form).get("clinician");
        state.data = assignCases(state.data, ids, clinicianId, demoNow());
        state.selected.clear();
        await closeOverlay();
        await render();
        toast(
          t(
            ids.length === 1
              ? "{count} case assigned to {name}."
              : "{count} cases assigned to {name}.",
            { count: ids.length, name: person(clinicianId).name },
          ),
        );
      });
    } catch (error) {
      if (dialog.isConnected)
        dialog.querySelector("#assignment-error").textContent = t(
          error.message,
        );
      else toast(error.message);
    }
  });
}
async function newCase() {
  const dialog = await showOverlay(
    `<md-dialog locale="${locale()}" id="new-case-dialog" headline="${esc(t("New patient case"))}" icon="folder_shared"><p class="form-help">${t("Create a fictional case for this demo session.")}</p><form id="new-case-form"><div class="form-grid"><md-text-field variant="outlined" label="${esc(t("Patient full name"))}" name="patient" required max-length="100" autocomplete="off"></md-text-field><md-number-field locale="${locale()}" increment-label="${esc(t("Increase"))}" decrement-label="${esc(t("Decrease"))}" value-missing-label="${esc(t("Enter a number."))}" variant="outlined" label="${esc(t("Age in years"))}" name="age" min="0" max="120" step="1" required></md-number-field>${select("sex", "Sex", ["Female", "Male", "Other", "Not specified"], "Not specified")}${select("department", "Department", departments, "", "required")}${select("priority", "Case priority", priorities, "Routine", "required")}<md-text-field variant="outlined" label="${esc(t("Room / bed"))}" name="room" max-length="30" placeholder="${esc(t("e.g. C-204"))}"></md-text-field></div><md-text-field variant="outlined" label="${esc(t("Case summary"))}" name="summary" multiline="auto-grow" rows="3" required max-length="500" supporting-text="${esc(t("Fictional information only. Do not enter real patient data."))}"></md-text-field><p id="new-case-error" class="form-error" role="alert"></p><md-button type="submit" variant="filled" full-width icon="add">${t("Create patient case")}</md-button></form><md-button slot="actions" variant="text" data-action="close-overlay">${t("Cancel")}</md-button></md-dialog>`,
  );
  dialog.querySelector("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await runAction(form, "Creating patient case…", async () => {
        const data = Object.fromEntries(new FormData(form));
        state.data = createCase(
          state.data,
          { ...data, age: Number(data.age) },
          demoNow(),
        );
        await closeOverlay();
        state.filters = initialFilters();
        state.queue = "all";
        state.page = 0;
        await navigate("cases");
        toast("Patient case created. Assign a care owner to continue.");
      });
    } catch (error) {
      if (dialog.isConnected)
        dialog.querySelector("#new-case-error").textContent = t(error.message);
      else toast(error.message);
    }
  });
}
function toggleTheme() {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("medflow-theme", root.dataset.theme);
  } catch {}
  document
    .querySelector("#theme-toggle")
    ?.setAttribute(
      "icon",
      root.dataset.theme === "dark" ? "light_mode" : "dark_mode",
    );
  wireCharts();
}
async function preferences() {
  const root = document.documentElement;
  const sheet = await showOverlay(
    `<md-side-sheet id="appearance" class="appearance-sheet" variant="modal" headline="${esc(t("Make it yours"))}" data-i18n-headline="Make it yours" top-divider bottom-divider>
      <md-icon-button slot="close" icon="close" aria-label="${esc(t("Close"))}" data-i18n-aria-label="Close" data-action="close-overlay"></md-icon-button>
      <p class="settings-intro" data-i18n="Your workspace, your way. Changes apply instantly and are saved on this device.">${t("Your workspace, your way. Changes apply instantly and are saved on this device.")}</p>
      <section class="setting-section">${select(
        "language",
        "Language",
        [
          { value: "en", label: "English" },
          { value: "ar", label: "العربية" },
        ],
        getLanguage(),
        'id="language-setting"',
      )}</section>
      <section class="setting-section"><h3 data-i18n="Primary color">${t("Primary color")}</h3><p class="muted small" data-i18n="Choose a color for your workspace.">${t("Choose a color for your workspace.")}</p>
        <md-color-picker locale="${locale()}" id="primary-setting" variant="inline" format="hex" value="${primaryColor}" show-inputs="false" presets="#006B5E,#6750A4,#1565C0,#9C4146,#825500,#52634A" aria-label="${esc(t("Primary color"))}" data-i18n-aria-label="Primary color"></md-color-picker>
      </section>
      <section class="setting-section">${select(
        "density",
        "Information density",
        [
          { value: "0", label: "Comfortable · default" },
          { value: "-1", label: "Cozy · −1" },
          { value: "-2", label: "Compact · −2" },
          { value: "-3", label: "Dense · −3" },
          { value: "-4", label: "Ultra compact · −4" },
        ],
        root.dataset.density || "0",
        'id="density-setting"',
      )}</section>
      <div class="preference-row"><div><h3 data-i18n="Dark appearance">${t("Dark appearance")}</h3><p class="muted small" data-i18n="Use darker surfaces.">${t("Use darker surfaces.")}</p></div><md-switch id="dark-setting" name="dark" aria-label="${esc(t("Use dark appearance"))}" data-i18n-aria-label="Use dark appearance" ${root.dataset.theme === "dark" ? "selected" : ""}></md-switch></div>
      <div class="preference-row"><div><h3 data-i18n="Right-to-left layout">${t("Right-to-left layout")}</h3><p class="muted small" data-i18n="Mirror navigation and page layout.">${t("Mirror navigation and page layout.")}</p></div><md-switch id="rtl-setting" name="rtl" aria-label="${esc(t("Right-to-left layout"))}" data-i18n-aria-label="Right-to-left layout" ${root.dir === "rtl" ? "selected" : ""}></md-switch></div>
      <md-button slot="actions" variant="text" id="reset-appearance" icon="restart_alt" data-i18n="Reset defaults">${t("Reset defaults")}</md-button>
      <md-button slot="actions" variant="filled" data-action="close-overlay" data-i18n="Done">${t("Done")}</md-button>
    </md-side-sheet>`,
  );
  const trigger = document.querySelector("#appearance-trigger");
  trigger?.setAttribute("aria-expanded", "true");
  sheet.addEventListener("mdClose", (e) => {
    if (e.target === sheet) trigger?.setAttribute("aria-expanded", "false");
  });
  const color = sheet.querySelector("#primary-setting");
  let colorFrame;
  color.addEventListener("mdInput", (e) => {
    if (e.target !== color) return;
    cancelAnimationFrame(colorFrame);
    colorFrame = requestAnimationFrame(() => applyPrimaryColor(e.detail.value));
  });
  color.addEventListener("mdChange", (e) => {
    if (e.target !== color) return;
    cancelAnimationFrame(colorFrame);
    applyPrimaryColor(e.detail.value, true);
  });
  sheet.addEventListener("mdClose", (e) => {
    if (e.target === sheet) {
      cancelAnimationFrame(colorFrame);
      applyPrimaryColor(primaryColor, true);
    }
  });
  sheet
    .querySelector("#dark-setting")
    .addEventListener("mdChange", toggleTheme);
  sheet.querySelector("#density-setting").addEventListener("mdChange", (e) => {
    if (
      e.target.id !== "density-setting" ||
      !["0", "-1", "-2", "-3", "-4"].includes(e.detail)
    )
      return;
    if (e.detail === "0") delete root.dataset.density;
    else root.dataset.density = e.detail;
    rememberPreference("density", e.detail);
  });
  sheet.querySelector("#rtl-setting").addEventListener("mdChange", (e) => {
    root.dir = e.detail.selected ? "rtl" : "ltr";
    rememberPreference("direction", root.dir);
    syncDirectionalIcons();
  });
  sheet.querySelector("#reset-appearance").addEventListener("mdClick", () => {
    cancelAnimationFrame(colorFrame);
    applyPrimaryColor(DEFAULT_PRIMARY, true);
    color.value = primaryColor;
    root.dataset.density = "-1";
    root.dir = getLanguage() === "ar" ? "rtl" : "ltr";
    if (root.dataset.theme === "dark") toggleTheme();
    sheet.querySelector("#dark-setting").selected = false;
    sheet.querySelector("#rtl-setting").selected = root.dir === "rtl";
    sheet.querySelector("#density-setting").value = "-1";
    rememberPreference("primary", "");
    rememberPreference("density", "-1");
    rememberPreference("direction", root.dir);
    rememberPreference("theme", "light");
    syncDirectionalIcons();
  });
}
function syncDirectionalIcons() {
  document
    .querySelectorAll("md-icon-button[data-directional]")
    .forEach((el) => {
      el.icon =
        document.documentElement.dir === "rtl" ? "arrow_back" : "arrow_forward";
    });
}
async function exportCases(trigger) {
  try {
    await runAction(trigger, "Preparing export…", async () => {
      // Yield to the browser before serializing; no minimum spinner duration.
      await new Promise(requestAnimationFrame);
      const rows = visibleCases(state);
      const cell = (value) =>
        '"' +
        String(value ?? "")
          .replace(/^[=+@\-\t\r]/, "'$&")
          .replaceAll('"', '""') +
        '"';
      const csv = [
        [
          "Case",
          "Patient",
          "MRN",
          "Department",
          "Priority",
          "Status",
          "Care owner",
          "Room",
        ].map((label) => t(label)),
        ...rows.map((c) => [
          c.id,
          c.patient,
          c.mrn,
          t(c.department),
          t(c.priority),
          t(c.status),
          person(c.assigneeId)?.name || t("Unassigned"),
          c.room,
        ]),
      ]
        .map((r) => r.map(cell).join(","))
        .join("\r\n");
      const url = URL.createObjectURL(
        new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "medflow-demo-cases.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(t("{count} fictional cases exported.", { count: rows.length }));
    });
  } catch {
    toast("The export could not be prepared. Please try again.");
  }
}
function syncPreferencesLanguage() {
  const sheet = document.querySelector("#appearance");
  if (!sheet) return;
  [sheet, ...sheet.querySelectorAll("*")].forEach((el) => {
    if (el.dataset.i18n) el.textContent = t(el.dataset.i18n);
    for (const attribute of [...el.attributes]) {
      if (attribute.name.startsWith("data-i18n-")) {
        el.setAttribute(attribute.name.slice(10), t(attribute.value));
      }
    }
  });
  sheet.querySelector("#primary-setting").locale = locale();
  const language = sheet.querySelector("#language-setting");
  language.label = t("Language");
  language.value = getLanguage();
  const density = sheet.querySelector("#density-setting");
  density.label = t("Information density");
  const labels = [
    "Comfortable · default",
    "Cozy · −1",
    "Compact · −2",
    "Dense · −3",
    "Ultra compact · −4",
  ];
  density
    .querySelectorAll("md-select-option")
    .forEach((option, index) => (option.label = t(labels[index])));
  sheet.querySelector("#rtl-setting").selected =
    document.documentElement.dir === "rtl";
}
function changeLanguage(value) {
  if (!["en", "ar"].includes(value) || value === getLanguage()) return;
  const authFields = authRoutes.includes(state.route)
    ? [...app.querySelectorAll("[name]")].map((el) => ({
        name: el.name,
        value: el.value,
        selected: el.selected,
        checked: el.checked,
      }))
    : [];
  setLanguage(value);
  document.documentElement.lang = value;
  document.documentElement.dir = value === "ar" ? "rtl" : "ltr";
  rememberPreference("language", value);
  rememberPreference("direction", document.documentElement.dir);
  render();
  for (const field of authFields) {
    const el = [...app.querySelectorAll("[name]")].find(
      (candidate) => candidate.name === field.name,
    );
    if (!el || el.id === "auth-language") continue;
    if (field.value !== undefined) el.value = field.value;
    if (field.selected !== undefined) el.selected = field.selected;
    if (field.checked !== undefined) el.checked = field.checked;
  }
  syncPreferencesLanguage();
}
document.addEventListener("mdChange", (event) => {
  if (["language-setting", "auth-language"].includes(event.target.id))
    changeLanguage(event.detail);
});
document.addEventListener("mdClick", async (event) => {
  const target = event.composedPath().find((el) => el?.dataset?.action);
  if (!target) return;
  const action = target.dataset.action;
  if (action.startsWith("auth-")) {
    await handleAuthAction(action, state, callbacks);
    return;
  }
  if (action.startsWith("go-")) {
    navigate(action.slice(3));
    return;
  }
  try {
    switch (action) {
      case "login":
        navigate("login");
        break;
      case "signout":
        clearAuth(state);
        state.auth.profile = null;
        navigate("login");
        toast("Signed out of the demo session.");
        break;
      case "theme":
        toggleTheme();
        break;
      case "preferences":
        await runAction(target, "Opening preferences…", preferences);
        break;
      case "case-detail":
        await runAction(target, "Opening patient case…", () =>
          openDetails(target.dataset.id),
        );
        break;
      case "assign-one":
        await runAction(target, "Opening assignment…", () =>
          openAssign([target.dataset.id]),
        );
        break;
      case "assign-selected":
        await runAction(target, "Opening assignment…", () =>
          openAssign([...state.selected]),
        );
        break;
      case "close-overlay":
        await closeOverlay();
        break;
      case "new-case":
        await runAction(target, "Opening case form…", newCase);
        break;
      case "export":
        await exportCases(target);
        break;
      case "retry-page":
        await render();
        break;
      case "clear-selection":
        state.selected.clear();
        await document.querySelector("#case-table")?.deselectAll();
        syncBulk();
        break;
      case "clear-search": {
        state.filters.query = "";
        state.page = 0;
        state.selected.clear();
        const search = document.querySelector("#case-search");
        search.value = "";
        search.querySelector("[data-action=clear-search]").hidden = true;
        renderTable();
        await search.setFocus();
        break;
      }
      case "reset-filters":
        state.filters = initialFilters();
        state.queue = "all";
        state.page = 0;
        state.selected.clear();
        render();
        break;
      case "unassigned":
        state.queue = "unassigned";
        state.page = 0;
        render();
        break;
      case "clinician-cases":
        state.filters = { ...initialFilters(), assignee: target.dataset.id };
        state.queue = "all";
        state.page = 0;
        navigate("cases");
        break;
    }
  } catch (error) {
    await toast(
      error.message || "Unable to open this screen. Please try again.",
    );
  }
});
window.addEventListener("hashchange", async () => {
  const version = ++navigationVersion;
  await closeOverlay();
  if (version !== navigationVersion) return;
  const route = location.hash.replace(/^#\/?/, "");
  if (["login", "signup"].includes(route)) clearAuth(state);
  if (["mfa", "recovery"].includes(route) && !state.auth.pending) {
    navigate("login");
    return;
  }
  if (![...nav.map((n) => n[0]), ...authRoutes].includes(route)) {
    navigate("overview");
    return;
  }
  state.route = route;
  await render();
  if (version !== navigationVersion) return;
  window.scrollTo({ top: 0, behavior: "instant" });
  document.querySelector("#main")?.focus({ preventScroll: true });
});
document.querySelector(".skip-link").addEventListener("click", (event) => {
  event.preventDefault();
  document.querySelector("#main")?.focus();
});
let registrationTimeout;
try {
  await Promise.race([
    customElements.whenDefined("md-button"),
    new Promise((_, reject) => {
      registrationTimeout = setTimeout(
        () =>
          reject(
            new Error(
              "The workspace could not finish loading. Please try again.",
            ),
          ),
        15000,
      );
    }),
  ]);
} finally {
  clearTimeout(registrationTimeout);
}
const route = location.hash.replace(/^#\/?/, "");
if (route) await navigate(route);
else await render();
