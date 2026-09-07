import {
  assets,
  initialAlarms,
  statusColor,
  statusDot,
  escapeHtml as esc,
  sampleValue,
  history,
  selectAssets,
  selectAlarms,
  acknowledgeAlarm,
  chartData,
  checkChallenge,
} from "./model.js";
import { authView, wireAuth, fillDemo, recoveryMarkup } from "./auth.js";
import { registerMonitoringTools } from "./webmcp.js";
import { t, localize } from "./i18n.js";
import { demoWait, createActionRunner, skeletonView } from "./loading.js";
import {
  DEFAULT_PRIMARY,
  DEFAULT_APPEARANCE,
  DENSITIES,
  readAppearance,
  saveAppearance,
  applyAppearance,
  normalizeAppearance,
} from "./preferences.js";

const app = document.querySelector("#app");
const appearance = readAppearance();
let appearancePreviewFrame;
let renderEpoch = 0;
let chartLoadEpoch = 0;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const icon = (name) =>
  '<span class="icon" aria-hidden="true"' +
  (/^arrow_(forward|back|outward)$/.test(name) ? " data-directional" : "") +
  ">" +
  name +
  "</span>";
const btn = (label, action, variant = "outlined", glyph = "") =>
  '<md-button variant="' +
  variant +
  '" data-action="' +
  action +
  '"' +
  (glyph ? ' icon="' + glyph + '"' : "") +
  (/^arrow_(forward|back|outward)$/.test(glyph) ? " mirror-icon" : "") +
  ">" +
  label +
  "</md-button>";
const status = (label, live = false) =>
  '<span class="status" data-status="' +
  esc(label) +
  '"><md-status-dot inline size="small"' +
  (live ? " live" : "") +
  ' state="' +
  statusDot(label) +
  '"></md-status-dot>' +
  esc(label) +
  "</span>";
const brand = () =>
  '<div class="brand"><span class="brand-icon">' +
  icon("monitor_heart") +
  '</span><div><div class="brand-name">SENTINEL</div><div class="brand-sub">SCADA SYSTEMS</div></div></div>';
const state = {
  route: "overview",
  navExpanded: !matchMedia("(max-width: 1150px)").matches,
  range: "1h",
  metric: "flow",
  area: "all",
  query: "",
  sortBy: "id",
  order: "asc",
  page: 0,
  rowsPerPage: 5,
  tick: 0,
  live: true,
  alarms: initialAlarms.map((a) => ({ ...a })),
  severity: "All",
  alarmState: "active",
  session: null,
  pending: null,
  ackId: null,
};
try {
  const s = JSON.parse(sessionStorage.getItem("sentinel.session"));
  if (s?.name && s?.email && s.demo === true) state.session = s;
} catch {}
const navItems = [
  ["overview", "space_dashboard", "Overview"],
  ["assets", "dns", "Assets"],
  ["alarms", "notifications_active", "Alarms"],
  ["trends", "monitoring", "Trends"],
  ["settings", "tune", "Settings"],
];
const number = (value) =>
  value === null
    ? "—"
    : new Intl.NumberFormat(appearance.language === "ar" ? "ar-EG" : "en-GB", {
        maximumFractionDigits: 1,
      }).format(value);
const selectEquipment = (options = {}) =>
  selectAssets({
    ...options,
    searchNames: Object.fromEntries(assets.map((a) => [a.id, t(a.name, "ar")])),
  });
const activeAlarms = () => state.alarms.filter((a) => !a.acknowledged);
const performAction = createActionRunner({
  onError: () => toast("The action could not be completed. Please try again."),
  onStatus: (label) => {
    if ($("#action-status")) $("#action-status").textContent = label;
  },
});
function runAction(key, button, label, work, options = {}) {
  const epoch = renderEpoch;
  return performAction(key, button, label, work, {
    ...options,
    isCurrent: () => epoch === renderEpoch && (options.isCurrent?.() ?? true),
  });
}
function toast(message) {
  const el = $("#toast");
  el.message = t(message, appearance.language);
  el.show();
}
function navigate(route) {
  if (location.hash === "#/" + route) render();
  else location.hash = "/" + route;
}
async function ready(root = document) {
  localize(root, appearance.language);
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
function shell() {
  const current = navItems.find((x) => x[0] === state.route) || navItems[0];
  const activeIndex = navItems.findIndex((x) => x[0] === state.route);
  const accountName = state.session?.name || "Demo operator";
  const accountState = state.session ? "MFA demo verified" : "Demo workspace";
  const initials = state.session
    ? state.session.name.slice(0, 2).toUpperCase()
    : "DO";
  app.innerHTML = `
    <div class="app-shell">
      <md-navigation-rail id="nav" variant="${state.navExpanded ? "expanded" : "standard"}"
        expandable toggle-label="Expand or collapse navigation" full-height
        label="Main navigation" active-index="${activeIndex}">
        <span slot="logo" class="nav-logo-mark" aria-label="Sentinel">${icon("monitor_heart")}</span>
        <div slot="logo-expanded" class="rail-brand"><span class="nav-logo-mark">${icon("monitor_heart")}</span><span>Sentinel</span></div>
        ${navItems.map(([value, glyph, label]) => `<md-navigation-rail-tab value="${value}" icon="${glyph}" label="${label}"${value === "alarms" && activeAlarms().length ? ` badge-value="${activeAlarms().length}"` : ""}></md-navigation-rail-tab>`).join("")}
        <md-avatar slot="footer-leading" initials="${esc(initials)}" name="${esc(accountName)}" size="32"></md-avatar>
        <div slot="footer-content" class="rail-account"><div class="rail-account-copy"><div class="user-name" ${state.session ? 'translate="no"' : ""}>${esc(accountName)}</div><div class="user-role">${accountState}</div></div><md-tooltip text="Make it yours"><md-icon-button icon="tune" aria-label="Make it yours" data-action="appearance"></md-icon-button></md-tooltip></div>
      </md-navigation-rail>
      <div class="workspace">
        <md-app-bar class="topbar">
          <md-breadcrumbs id="breadcrumbs" slot="headline" label="Plant location" separator="/"
            items-before-collapse="0" items-after-collapse="1" expand-label="Show plant breadcrumb">
            <md-breadcrumb-item href="#/overview" icon="domain">North water treatment</md-breadcrumb-item>
            <md-breadcrumb-item>${current[2]}</md-breadcrumb-item>
          </md-breadcrumbs>
          <span slot="trailing" class="toolbar-live">${status(state.live ? "Running" : "Paused", state.live)} <span class="muted">Simulation</span></span>
          <md-tooltip slot="trailing" class="toolbar-personalize" text="Make it yours"><md-icon-button icon="tune" aria-label="Make it yours" data-action="appearance"></md-icon-button></md-tooltip>
          <md-button slot="trailing" variant="outlined" icon="verified_user" data-action="${state.session ? "security" : "login"}">${state.session ? "Account" : "Sign in"}</md-button>
        </md-app-bar>
        <main id="main" tabindex="-1"></main>
      </div>
      <md-navigation-bar id="mobile-nav" aria-label="Main navigation" active-index="${activeIndex}" manual-activation>
        ${navItems.map(([value, glyph, label]) => `<md-navigation-tab icon="${glyph}" active-icon="${glyph}" label="${label}"${value === "alarms" && activeAlarms().length ? ` badge-value="${activeAlarms().length}"` : ""}></md-navigation-tab>`).join("")}
      </md-navigation-bar>
    </div>`;
  localize(app, appearance.language);
  $("#nav").addEventListener("mdTabChange", (e) => {
    if (navItems.some((x) => x[0] === e.detail.value)) navigate(e.detail.value);
  });
  $("#nav").addEventListener("mdExpand", () => {
    state.navExpanded = true;
  });
  $("#nav").addEventListener("mdCollapse", () => {
    state.navExpanded = false;
  });
  $("#mobile-nav").addEventListener("mdChange", (e) => {
    const destination = navItems[e.detail.index];
    if (destination) navigate(destination[0]);
  });
  $("#breadcrumbs").addEventListener("mdSelect", (e) => {
    const { href, originalEvent } = e.detail;
    if (
      originalEvent.metaKey ||
      originalEvent.ctrlKey ||
      originalEvent.shiftKey ||
      originalEvent.altKey
    )
      return;
    if (href === "#/overview") {
      e.preventDefault();
      navigate("overview");
    }
  });
  applyResponsiveNav();
}
function heading(title, text, actions = "") {
  return (
    '<div class="page-heading"><div><h1>' +
    title +
    "</h1><p>" +
    text +
    '</p></div><div class="row wrap">' +
    actions +
    "</div></div>"
  );
}
function footer() {
  return '<footer class="page-footer"><span>Simulated telemetry · North water treatment · UTC <span id="sample-time">14:36:00</span></span><md-button variant="text" size="xs" data-action="components" icon="widgets">Built with AWC UI</md-button></footer>';
}
function metric(label, value, unit, copy, glyph, spark) {
  return (
    '<md-card class="metric" variant="outlined"><div class="metric-label">' +
    label +
    icon(glyph) +
    '</div><div class="metric-value">' +
    value +
    '<span class="metric-unit">' +
    unit +
    '</span></div><div class="metric-bottom"><span class="change' +
    (glyph === "notifications_active" ? " warn" : "") +
    '">' +
    copy +
    "</span>" +
    (spark
      ? '<md-sparkline data-spark="' +
        spark +
        '" height="30px" show-marks="none" show-tooltip="false" aria-hidden="true"></md-sparkline>'
      : "") +
    "</div></md-card>"
  );
}
function rangeControl(id = "range") {
  return (
    '<md-segmented-button-set id="' +
    id +
    '" aria-label="Trend time range">' +
    ["1h", "6h", "24h"]
      .map(
        (r) =>
          '<md-segmented-button value="' +
          r +
          '" label="' +
          r +
          '" ' +
          (state.range === r ? "selected" : "") +
          " no-checkmark></md-segmented-button>",
      )
      .join("") +
    "</md-segmented-button-set>"
  );
}
function trendPanel(large = false) {
  return (
    '<md-card variant="outlined" class="panel"><div class="panel-heading"><div><h2>' +
    (large ? "Process historian" : "Flow performance") +
    "</h2><p>" +
    (large
      ? "Select a signal and inspect its simulated history."
      : "Intake flow · sampled process values") +
    "</p></div>" +
    rangeControl() +
    '</div><div class="chart-meta"><div><strong id="chart-latest">1,248</strong> <span id="chart-unit">m³/h</span></div><span class="row small">' +
    status(state.live ? "Running" : "Paused") +
    '<span>Simulated samples</span></span></div><md-line-chart id="trend-chart" height="' +
    (large ? "390px" : "235px") +
    '" summary="Simulated process history" ' +
    (large ? 'zoom="both"' : "") +
    '></md-line-chart><span id="chart-loading-status" class="visually-hidden" role="status"></span></md-card>'
  );
}
function alarmPreview() {
  const alarms = activeAlarms();
  return `
    <md-card class="panel" variant="outlined">
      <div class="panel-heading">
        <div class="row"><h2>Needs attention</h2><span class="badge-anchor"><md-badge value="${alarms.length}" max="99"></md-badge></span></div>
        <md-button variant="text" size="xs" data-action="alarms" trailing-icon="arrow_forward" mirror-icon>View all</md-button>
      </div>
      ${
        alarms.length
          ? `<md-list class="alarm-preview-list" label="Alarms needing attention" interaction-mode="multi-action">
        ${alarms
          .slice(0, 3)
          .map(
            (a) => `
          <md-list-item headline="${esc(a.title)}" overline="${a.asset} · ${a.time} UTC"
            supporting-text="${a.severity}" leading-icon="${a.severity === "Critical" ? "priority_high" : a.severity === "Info" ? "info" : "warning"}">
            <md-tooltip slot="trailing" text="Acknowledge ${a.asset} alarm"><md-icon-button icon="done_all" aria-label="Acknowledge ${esc(a.title)} on ${a.asset}" data-action="ack:${a.id}"></md-icon-button></md-tooltip>
          </md-list-item>`,
          )
          .join("")}
      </md-list>`
          : `<div class="table-empty">${icon("check_circle")}<h3>All caught up</h3><p class="muted small">All demo alarms are acknowledged.</p></div>`
      }
    </md-card>`;
}
function process() {
  return `
    <section class="process" aria-labelledby="process-heading">
      <div class="panel-heading"><div><h2 id="process-heading">Treatment process</h2><p>Train 01 · Select a stage to inspect its equipment</p></div></div>
      <ol class="process-flow" role="list">
      ${[assets[0], assets[2], assets[3], assets[4]]
        .map(
          (a, i) => `
        <li>
          <md-card class="process-equipment" variant="filled" interactive full-height
            data-action="asset:${a.id}" aria-label="Inspect ${esc(a.name)} (${a.id}), ${a.area}, ${a.status}">
            <div class="process-card-heading">
              <div><p class="process-caption">Stage ${i + 1}</p><h3>${a.area}</h3></div>
              ${icon(a.icon)}
            </div>
            <p class="process-equipment-name">${a.id} · ${a.name}</p>
            <div class="process-reading">
              <p class="process-caption">${a.signal}</p>
              <p class="process-value"><span data-value="${a.id}">${number(sampleValue(a, state.tick))}</span> <span class="process-unit">${a.unit}</span></p>
            </div>
            <md-divider></md-divider>
            <div class="process-card-footer">${status(a.status)}<span class="process-inspect">Inspect ${icon("arrow_forward")}</span></div>
          </md-card>
        </li>`,
        )
        .join("")}
      </ol>
    </section>`;
}
function overview() {
  return (
    heading(
      "Plant overview",
      "North water treatment · Operations workspace",
      '<span class="date-label">07 Sep 2026</span>' +
        btn(
          state.live ? "Pause simulation" : "Resume simulation",
          "pause",
          "outlined",
          state.live ? "pause" : "play_arrow",
        ) +
        btn("Export snapshot", "export", "filled", "download"),
    ) +
    '<section class="metrics" aria-label="Plant key metrics">' +
    metric(
      "Intake flow",
      '<span data-value="P-101">' +
        number(sampleValue(assets[0], state.tick)) +
        "</span>",
      "m³/h",
      "Within operating range",
      "water_drop",
      "P-101",
    ) +
    metric(
      "Tank level",
      '<span data-value="TK-301">' +
        number(sampleValue(assets[3], state.tick)) +
        "</span>",
      "%",
      "Operating band 30–90%",
      "water_full",
      "TK-301",
    ) +
    metric(
      "Connected assets",
      '5 <span class="metric-unit">/ 6</span>',
      "",
      "1 device offline",
      "router",
      "",
    ) +
    metric(
      "Active alarms",
      '<span id="alarm-count">' + activeAlarms().length + "</span>",
      "",
      "" +
        activeAlarms().filter((a) => a.severity === "Critical").length +
        " critical · review required",
      "notifications_active",
      "",
    ) +
    '</section><section class="dashboard-grid">' +
    trendPanel() +
    alarmPreview() +
    "</section>" +
    process() +
    assetTable(false) +
    footer()
  );
}
function assetTable(full) {
  return (
    '<md-table-container variant="outlined" shape="medium"><md-table-toolbar slot="top" class="asset-toolbar" headline="' +
    (full ? "Equipment registry" : "Asset health") +
    '" supporting-text="' +
    (full
      ? "Filter equipment and inspect live signal details."
      : "Current state across the treatment train") +
    '">' +
    (full
      ? '<div slot="actions" class="asset-filters"><md-text-field id="asset-search" name="asset-query" label="Filter assets" value="' +
        esc(state.query) +
        '" variant="outlined"></md-text-field><md-select id="area-select" label="Process area" value="' +
        state.area +
        '" name="area"><md-select-option value="all" label="All areas"></md-select-option>' +
        ["Intake", "Filtration", "Storage", "Distribution"]
          .map(
            (a) =>
              '<md-select-option value="' +
              a +
              '" label="' +
              a +
              '"></md-select-option>',
          )
          .join("") +
        "</md-select></div>"
      : '<md-button slot="actions" variant="text" icon="arrow_forward" mirror-icon data-action="assets">All assets</md-button>') +
    '</md-table-toolbar><md-table id="asset-table" label="Equipment health" min-width="760px" column-template="minmax(195px,1.6fr) minmax(115px,1fr) minmax(115px,1fr) minmax(110px,1fr) minmax(120px,1fr) 85px" sort-by="' +
    state.sortBy +
    '" sort-order="' +
    state.order +
    '"><md-table-head><md-table-row rowgroup="head">' +
    [
      ["name", "Equipment"],
      ["area", "Area"],
      ["status", "Status"],
    ]
      .map(
        ([key, label]) =>
          '<md-table-cell head scope="col"><md-table-sort-label column="' +
          key +
          '">' +
          label +
          "</md-table-sort-label></md-table-cell>",
      )
      .join("") +
    '<md-table-cell head scope="col">Reading</md-table-cell><md-table-cell head scope="col"><md-table-sort-label column="health">Health</md-table-sort-label></md-table-cell><md-table-cell head scope="col">Details</md-table-cell></md-table-row></md-table-head><md-table-body id="asset-rows"></md-table-body><div slot="empty" class="table-empty">' +
    icon("search_off") +
    '<h3>No matching assets</h3><p class="small muted">Try another name, tag, or process area.</p></div></md-table>' +
    (full
      ? '<md-table-pagination id="asset-pagination" slot="bottom" count="6" page="' +
        state.page +
        '" rows-per-page="' +
        state.rowsPerPage +
        '" rows-per-page-options="5,10,25"></md-table-pagination>'
      : "") +
    "</md-table-container>"
  );
}
function renderRows() {
  const table = $("#asset-table");
  if (!table) return;
  const full = state.route === "assets";
  const rows = selectEquipment(
    full ? state : { sortBy: state.sortBy, order: state.order },
  );
  const pageRows = full
    ? rows.slice(
        state.page * state.rowsPerPage,
        (state.page + 1) * state.rowsPerPage,
      )
    : rows;
  $("#asset-rows").innerHTML = pageRows
    .map(
      (a) =>
        '<md-table-row value="' +
        a.id +
        '"><md-table-cell><div class="asset-name">' +
        icon(a.icon) +
        "<div><strong>" +
        a.name +
        "</strong><small>" +
        a.id +
        "</small></div></div></md-table-cell><md-table-cell>" +
        a.area +
        "</md-table-cell><md-table-cell>" +
        status(a.status) +
        '</md-table-cell><md-table-cell><span class="table-reading"><span data-value="' +
        a.id +
        '">' +
        number(sampleValue(a, state.tick)) +
        "</span> <small>" +
        a.unit +
        '</small></span></md-table-cell><md-table-cell><md-meter label="' +
        a.name +
        ' health" value="' +
        a.health +
        '" color="' +
        statusColor(a.status) +
        '" show-value value-text="' +
        (a.status === "Offline" ? "No data" : a.health + "%") +
        '"></md-meter></md-table-cell><md-table-cell><md-tooltip text="Inspect ' +
        a.id +
        '"><md-icon-button icon="arrow_outward" class="directional-icon-button" aria-label="Inspect ' +
        a.name +
        '" data-action="asset:' +
        a.id +
        '"></md-icon-button></md-tooltip></md-table-cell></md-table-row>',
    )
    .join("");
  localize($("#asset-rows"), appearance.language);
  table.empty = rows.length === 0;
  table.rowCount = rows.length;
  table.rowOffset = full ? state.page * state.rowsPerPage : 0;
  if ($("#asset-pagination")) $("#asset-pagination").count = rows.length;
}
async function charts() {
  await ready();
  $$("[data-spark]").forEach((el) => {
    const a = assets.find((x) => x.id === el.dataset.spark);
    if (a) {
      el.data = history(a, state.tick);
      el.min = a.min;
      el.max = a.max;
    }
  });
  const c = $("#trend-chart");
  if (!c) return;
  const metric = state.route === "overview" ? "flow" : state.metric;
  const data = chartData(metric, state.range, state.tick);
  c.series = [
    {
      id: metric,
      label: t(data.name, appearance.language),
      data: data.data,
      color: "primary",
      showMarks: false,
      curve: "smooth",
    },
  ];
  c.xAxis = {
    scale: "time",
    valueFormatter: (v) =>
      new Intl.DateTimeFormat(
        appearance.language === "ar" ? "ar-EG" : "en-GB",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        },
      ).format(new Date(v)),
  };
  c.yAxis = {
    scale: "value",
    label: t(data.name, appearance.language) + " (" + data.unit + ")",
    min: data.min,
    max: data.max,
  };
  c.summary =
    appearance.language === "ar"
      ? `${t(data.name, "ar")} خلال ${t(state.range, "ar")}. عينات محاكاة. نزّل CSV لعرض جميع القيم.`
      : data.name +
        " over " +
        state.range +
        ", simulated samples. Download the CSV for all values.";
  c.legend = metric === "pressure" ? "top-end" : "none";
  if (metric === "pressure")
    c.series = [
      ...c.series,
      {
        id: "threshold",
        label: t("Advisory limit", appearance.language),
        color: "warning",
        dash: "dashed",
        showMarks: false,
        data: data.data.map((p) => ({ x: p.x, y: 2.5 })),
      },
    ];
  c.valueFormatter = (v) =>
    v == null ? t("No data", appearance.language) : number(v) + " " + data.unit;
  if ($("#chart-latest"))
    $("#chart-latest").textContent = number(data.data.at(-1).y);
  if ($("#chart-unit")) $("#chart-unit").textContent = data.unit;
}
function applyResponsiveNav() {
  const breadcrumbs = $("#breadcrumbs");
  if (breadcrumbs)
    breadcrumbs.maxItems = matchMedia("(max-width: 850px)").matches ? 1 : 0;
}
async function reloadChart() {
  const chart = $("#trend-chart");
  if (!chart) return;
  const epoch = ++chartLoadEpoch;
  const status = $("#chart-loading-status");
  chart.loading = true;
  chart.inert = true;
  chart.loadingLabel = t("Loading chart…", appearance.language);
  if (status) status.textContent = chart.loadingLabel;
  try {
    await demoWait();
    if (epoch !== chartLoadEpoch || !chart.isConnected) return;
    await charts();
  } catch {
    toast("The chart could not be loaded. Please try again.");
  } finally {
    if (epoch === chartLoadEpoch) {
      chart.loading = false;
      chart.inert = false;
      if (status) status.textContent = "";
    }
  }
}
function wireMain() {
  $("#range")?.addEventListener("mdChange", (e) => {
    state.range = e.detail[0] || "1h";
    reloadChart();
  });
  $("#asset-table")?.addEventListener("mdSortChange", (e) => {
    state.sortBy = e.detail.column;
    state.order = e.detail.order;
    renderRows();
  });
  $("#asset-search")?.addEventListener("mdInput", (e) => {
    state.query = e.detail;
    state.page = 0;
    renderRows();
    if ($("#asset-pagination")) $("#asset-pagination").page = 0;
  });
  $("#area-select")?.addEventListener("mdChange", (e) => {
    state.area = e.detail;
    state.page = 0;
    renderRows();
    if ($("#asset-pagination")) $("#asset-pagination").page = 0;
  });
  $("#asset-pagination")?.addEventListener("mdPageChange", (e) => {
    state.page = e.detail.page;
    renderRows();
  });
  $("#asset-pagination")?.addEventListener("mdRowsPerPageChange", (e) => {
    state.rowsPerPage = e.detail.rowsPerPage;
    state.page = 0;
    renderRows();
  });
}
function alarmsView() {
  const visible = selectAlarms(state.alarms, state.severity, state.alarmState);
  return (
    heading(
      "Alarm center",
      "Review, investigate, and acknowledge events in this demo workspace.",
      btn("Export alarms", "export-alarms", "outlined", "download"),
    ) +
    '<div class="alarm-stats">' +
    ["Critical", "Warning", "Info"]
      .map(
        (s) =>
          '<md-card class="panel" variant="outlined"><div class="row between"><span class="small muted">' +
          s +
          "</span>" +
          status(s) +
          '</div><div class="metric-value">' +
          activeAlarms().filter((a) => a.severity === s).length +
          '</div><span class="subtle">Unacknowledged</span></md-card>',
      )
      .join("") +
    "</div>" +
    '<div class="filterbar" aria-label="Alarm filters">' +
    ["All", "Critical", "Warning", "Info"]
      .map(
        (s) =>
          '<md-chip variant="filter" label="' +
          s +
          '" data-severity="' +
          s +
          '" color="' +
          statusColor(s) +
          '" ' +
          (state.severity === s ? "selected" : "") +
          "></md-chip>",
      )
      .join("") +
    '<md-select name="alarm-state" id="alarm-state" label="Acknowledgment" value="' +
    state.alarmState +
    '"><md-select-option value="active" label="Unacknowledged"></md-select-option><md-select-option value="acknowledged" label="Acknowledged"></md-select-option><md-select-option value="all" label="All events"></md-select-option></md-select></div>' +
    '<div class="alarm-list">' +
    visible
      .map(
        (a) =>
          '<md-card variant="outlined" class="alarm-card"><span class="alarm-symbol ' +
          (a.severity === "Warning" ? "warning" : "") +
          '">' +
          icon(
            a.severity === "Info"
              ? "info"
              : a.severity === "Critical"
                ? "priority_high"
                : "warning",
          ) +
          '</span><div class="alarm-detail"><div class="row wrap"><span class="mono">' +
          a.id +
          "</span>" +
          status(a.severity) +
          '<span class="subtle">' +
          a.time +
          " UTC</span></div><h2>" +
          a.title +
          '</h2><p><strong class="mono">' +
          a.asset +
          "</strong> · " +
          a.detail +
          "</p>" +
          (a.acknowledged
            ? '<p class="ack-note"><span>Acknowledged in this session</span>' +
              (a.note
                ? ' · <span translate="no">' + esc(a.note) + "</span>"
                : "") +
              "</p>"
            : "") +
          '</div><div class="row wrap">' +
          btn("Inspect", "asset:" + a.asset, "text", "arrow_outward") +
          (a.acknowledged
            ? status("Acknowledged")
            : btn("Acknowledge", "ack:" + a.id, "outlined")) +
          "</div></md-card>",
      )
      .join("") +
    (visible.length
      ? ""
      : '<md-card variant="outlined" class="table-empty">' +
        icon("task_alt") +
        "<h2>No " +
        (state.alarmState === "acknowledged" ? "acknowledged" : "matching") +
        ' alarms</h2><p class="small muted">Choose another severity or acknowledgment filter.</p></md-card>') +
    "</div>" +
    footer()
  );
}
function trendsView() {
  return (
    heading(
      "Process trends",
      "Compare process signals over the selected time window.",
      '<md-select id="metric-select" name="metric" label="Process signal" value="' +
        state.metric +
        '"><md-select-option value="flow" label="Intake flow"></md-select-option><md-select-option value="pressure" label="Filter pressure"></md-select-option><md-select-option value="power" label="Power demand"></md-select-option></md-select>' +
        btn("Download CSV", "export-trend", "filled", "download"),
    ) +
    trendPanel(true) +
    '<md-card variant="filled" class="notice" style="margin-block-start:1.25rem">All observations are simulated. Drag on the plot or use its range slider to zoom; double-click the plot to reset. Download CSV to inspect every observation as text.</md-card>' +
    footer()
  );
}
function settingsView() {
  const accountName = state.session?.name || "Guest demo session";
  return (
    heading(
      "Workspace settings",
      "Tune your monitoring experience and explore account security.",
    ) +
    `
    <div class="settings-grid">
      <md-card variant="outlined" class="panel">
        <h2>Appearance & monitoring</h2>
        <md-list class="settings-list" label="Appearance and monitoring preferences" interaction-mode="multi-action">
          <md-list-item headline="Dark theme" supporting-text="Apply the theme across every component." leading-icon="contrast">
            <md-switch slot="trailing" id="theme-switch" name="dark" aria-label="Dark theme" ${document.documentElement.dataset.theme === "dark" ? "selected" : ""} icons></md-switch>
          </md-list-item>

          <md-list-item headline="Simulated live updates" supporting-text="Refresh sample values every four seconds." leading-icon="sensors">
            <md-switch slot="trailing" id="live-switch" name="live" aria-label="Simulated live updates" ${state.live ? "selected" : ""}></md-switch>
          </md-list-item>
        </md-list>
        ${btn("Make it yours", "appearance", "tonal", "tune")}
      </md-card>
      <md-card variant="outlined" class="panel">
        <h2>Account & security</h2>
        <md-list class="settings-list" label="Account and security">
          <md-list-item ${state.session ? 'translate="no"' : ""} headline="${esc(accountName)}" supporting-text="${esc(state.session?.email || "Sign in to explore the verification flow.")}">
            <md-avatar slot="leading" initials="${esc(state.session ? state.session.name.slice(0, 2).toUpperCase() : "DO")}" size="40"></md-avatar>
          </md-list-item>
          <md-list-item headline="Multi-factor authentication" supporting-text="${state.session ? "Demo verification completed." : "Six-digit code with a recovery-code alternative."}" leading-icon="verified_user" trailing-icon="${state.session ? "check_circle" : "lock"}"></md-list-item>
        </md-list>
        <md-divider></md-divider>
        <div class="row wrap settings-actions">${state.session ? btn("Sign out", "logout", "outlined", "logout") : btn("Sign in", "login", "filled", "login") + btn("Create an account", "signup", "outlined")}</div>
      </md-card>
      <md-card variant="outlined" class="panel">
        <h2>Demo environment</h2><p class="muted small settings-copy">North water treatment is a fictional plant. Values and alarms are simulated; acknowledgments affect this page only. Reloading restores the original alarm set.</p>
        ${btn("Reset demo alarms", "reset-alarms", "outlined", "restart_alt")}
      </md-card>
      <md-card variant="outlined" class="panel">
        <h2>Powered by AWC UI</h2><p class="muted small settings-copy">Explore the components behind the workspace, from data visualization to form validation and modal interactions.</p>
        ${btn("Explore components", "components", "tonal", "widgets")}
      </md-card>
    </div>
    <md-card variant="filled" class="notice settings-disclosure">Authentication is a UI demonstration. It does not create a real account or protect plant data. Passwords and verification codes are never saved; demo profile details remain in this tab until you sign out or close it.</md-card>
    ${footer()}`
  );
}
async function showAsset(id) {
  const a = assets.find((x) => x.id === id);
  if (!a) return;
  $("#overlays").innerHTML =
    '<md-side-sheet id="asset-sheet" variant="modal" headline="' +
    a.name +
    '" closeable><div class="sheet-content"><div class="row between"><span class="mono">' +
    a.id +
    "</span>" +
    status(a.status) +
    '</div><div><p class="subtle">' +
    a.signal +
    '</p><div class="sheet-value"><span data-value="' +
    a.id +
    '">' +
    number(sampleValue(a, state.tick)) +
    '</span> <span class="metric-unit">' +
    a.unit +
    "</span></div></div>" +
    (a.value === null
      ? '<md-card variant="filled" class="notice">' +
        icon("wifi_off") +
        "No current telemetry. This signal is offline.</md-card>"
      : '<md-sparkline data-spark="' +
        a.id +
        '" height="110px" color="' +
        statusColor(a.status) +
        '" min="' +
        a.min +
        '" max="' +
        a.max +
        '" show-marks="extremes"></md-sparkline>') +
    '<md-card variant="filled" class="notice">' +
    esc(a.note) +
    '</md-card><div><h3>Equipment details</h3><dl class="details"><dt>Process area</dt><dd>' +
    a.area +
    '</dd><dt>Signal tag</dt><dd class="mono">' +
    a.tag +
    "</dd><dt>Protocol</dt><dd>" +
    a.protocol +
    '</dd><dt>Demo address</dt><dd class="mono">' +
    a.address +
    "</dd><dt>Data quality</dt><dd>" +
    (a.value === null ? "Bad · offline" : "Good · simulated") +
    '</dd></dl></div><div><h3>Equipment health</h3><md-meter label="Equipment health" value="' +
    a.health +
    '" show-value color="' +
    statusColor(a.status) +
    '" value-text="' +
    (a.value === null ? "No data" : a.health + "%") +
    '"></md-meter></div><p class="subtle">Read-only monitoring · simulated equipment</p></div><md-button slot="actions" variant="outlined" data-action="sheet-alarms">Open alarm queue</md-button></md-side-sheet>';
  const sheet = $("#asset-sheet");
  const body = $(".sheet-content", sheet);
  const content = body.innerHTML;
  body.innerHTML = skeletonView("equipment");
  sheet.setAttribute("aria-busy", "true");
  const action = $("[slot='actions']", sheet);
  action.disabled = true;
  try {
    await ready(sheet);
    if (!sheet.isConnected) return;
    await sheet.show();
    await demoWait();
    if (!sheet.isConnected || !sheet.open) return;
    body.innerHTML = content;
    localize(body, appearance.language);
    await charts();
  } catch {
    if (sheet.isConnected && sheet.open) {
      body.innerHTML =
        '<p role="alert">Equipment details could not be loaded. Please try again.</p>';
      localize(body, appearance.language);
    }
  } finally {
    sheet.removeAttribute("aria-busy");
    action.disabled = false;
  }
}
async function showAcknowledge(id) {
  const a = state.alarms.find((x) => x.id === id);
  if (!a || a.acknowledged) return;
  state.ackId = id;
  $("#overlays").innerHTML =
    '<md-dialog id="ack-dialog" headline="Acknowledge ' +
    a.asset +
    ' alarm?" icon="notifications_active"><div class="stack"><p><strong>' +
    a.title +
    '</strong></p><p class="muted small">' +
    a.detail +
    '. Acknowledgment records your review in this demo. The equipment condition remains unchanged.</p><md-text-field id="ack-note" name="note" label="Operator note (optional)" variant="outlined" multiline="fixed" rows="3" max-length="500"></md-text-field></div><md-button slot="actions" variant="text" data-action="close-ack">Cancel</md-button><md-button slot="actions" variant="filled" data-action="confirm-ack">Acknowledge alarm</md-button></md-dialog>';
  await ready($("#overlays"));
  await $("#ack-dialog").show();
}
async function showComponents() {
  const groups = [
    [
      "Navigation",
      "md-navigation-rail · md-navigation-rail-tab · md-navigation-bar · md-navigation-tab · md-app-bar · md-breadcrumbs · md-breadcrumb-item",
      "Responsive destinations, active states, and workspace context.",
    ],
    [
      "Operational data",
      "md-table-container · md-table · md-table-head · md-table-body · md-table-row · md-table-cell · md-table-sort-label · md-table-pagination · md-table-toolbar",
      "Composable tables with sorting, filtering, and pagination.",
    ],
    [
      "Charts & health",
      "md-line-chart · md-sparkline · md-meter · md-status-dot · md-badge · md-skeleton",
      "Time series with zoom, compact trends, and semantic health indicators.",
    ],
    [
      "Forms & identity",
      "md-text-field · md-otp-field · md-checkbox · md-select · md-select-option · md-stepper · md-step",
      "Form validation, password visibility, code entry, and selection.",
    ],
    [
      "Controls & feedback",
      "md-button · md-icon-button · md-color-picker · md-chip · md-switch · md-segmented-button-set · md-segmented-button",
      "Actions, severity filters, theme and density controls, and time ranges.",
    ],
    [
      "Surfaces",
      "md-card · md-dialog · md-side-sheet · md-snackbar · md-tooltip · md-avatar · md-list · md-list-item · md-divider",
      "Structured content, focused tasks, inspection, feedback, and identity.",
    ],
  ];
  $("#overlays").innerHTML =
    '<md-side-sheet id="component-sheet" variant="modal" headline="The AWC UI toolkit" closeable><div class="sheet-content"><p class="muted">Real AWC web components power the interactions throughout this workspace. Open Make it yours to change the primary color, density, or layout direction across the workspace.</p>' +
    groups
      .map(
        ([title, tags, desc]) =>
          "<div><h3>" +
          title +
          '</h3><div class="component-row"><code>' +
          tags +
          "</code><span>" +
          desc +
          "</span></div></div>",
      )
      .join("<md-divider></md-divider>") +
    "</div></md-side-sheet>";
  await ready($("#overlays"));
  await $("#component-sheet").show();
}
function downloadCsv(filename, rows) {
  const cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("CSV is ready. Download started.");
}
async function exportCsv(button, filename, rows) {
  await runAction(
    "export:" + filename,
    button,
    t("Preparing CSV…", appearance.language),
    () => downloadCsv(filename, rows),
  );
}
function completeAuth(profile) {
  state.session = profile;
  state.pending = null;
  try {
    sessionStorage.setItem("sentinel.session", JSON.stringify(profile));
  } catch {}
  navigate("overview");
  toast("Demo verification complete. Welcome, " + profile.name + ".");
}
function updateAppearance(patch, persist = true) {
  const previousLanguage = appearance.language;
  cancelAnimationFrame(appearancePreviewFrame);
  Object.assign(appearance, normalizeAppearance({ ...appearance, ...patch }));
  applyAppearance(appearance);
  document.title =
    appearance.language === "ar"
      ? "Sentinel — مراقبة أنظمة سكادا"
      : "Sentinel — SCADA monitoring";
  if (previousLanguage !== appearance.language) {
    localize(document.body, appearance.language);
    $$("[data-value]").forEach((el) => {
      const asset = assets.find((a) => a.id === el.dataset.value);
      if (asset) el.textContent = number(sampleValue(asset, state.tick));
    });
    charts();
  }
  if (persist) saveAppearance(appearance);
  if ($("#theme-switch"))
    $("#theme-switch").selected = appearance.theme === "dark";
  if ($("#appearance-dark"))
    $("#appearance-dark").selected = appearance.theme === "dark";
}
function setTheme(dark) {
  updateAppearance({ theme: dark ? "dark" : "light" });
}
function appearanceMarkup() {
  return `<md-side-sheet id="appearance-sheet" variant="modal" headline="Make it yours" aria-label="Make it yours" top-divider bottom-divider>
    <div class="appearance-content">
      <p class="muted">Choose your colors and the layout that works for you. Changes apply across the app and are saved on this device.</p>
      <section class="appearance-section" aria-labelledby="primary-heading">
        <h3 id="primary-heading">Primary color</h3>
        <p class="muted small">Pick a color. Matching light and dark tones keep your workspace readable.</p>
        <md-color-picker id="primary-picker" variant="inline" format="hex" value="${appearance.primary || DEFAULT_PRIMARY}" presets="#006B56,#6750A4,#166BD9,#B3261E,#A85512,#006874" aria-label="Primary color" show-inputs="false"></md-color-picker>
      </section>
      <md-divider></md-divider>
      <md-select id="appearance-language" label="Language" value="${appearance.language}" supporting-text="Choose the app language. Arabic starts in right-to-left layout.">
        <md-select-option value="en" label="English" lang="en"></md-select-option>
        <md-select-option value="ar" label="العربية" lang="ar"></md-select-option>
      </md-select>
      <md-select id="appearance-density" label="Density" value="${appearance.density}" supporting-text="Adjust the spacing of library components.">
        ${DENSITIES.map(([value, label]) => `<md-select-option value="${value}" label="${label}"></md-select-option>`).join("")}
      </md-select>
      <md-list class="settings-list" label="Theme and direction" interaction-mode="multi-action">
        <md-list-item headline="Dark theme" leading-icon="contrast"><md-switch slot="trailing" id="appearance-dark" aria-label="Dark theme" ${appearance.theme === "dark" ? "selected" : ""} icons></md-switch></md-list-item>
        <md-list-item headline="Right-to-left layout" supporting-text="Mirror the workspace direction." leading-icon="format_textdirection_r_to_l"><md-switch slot="trailing" id="appearance-rtl" aria-label="Right-to-left layout" ${appearance.direction === "rtl" ? "selected" : ""}></md-switch></md-list-item>
      </md-list>
    </div>
    <md-button slot="actions" variant="text" icon="restart_alt" data-action="reset-appearance">Reset defaults</md-button>
    <md-button slot="actions" variant="filled" data-action="close-appearance">Done</md-button>
  </md-side-sheet>`;
}
async function showAppearance() {
  $("#overlays").innerHTML = appearanceMarkup();
  await ready($("#overlays"));
  const picker = $("#primary-picker");
  picker.addEventListener("mdInput", (e) => {
    cancelAnimationFrame(appearancePreviewFrame);
    appearancePreviewFrame = requestAnimationFrame(() =>
      updateAppearance({ primary: e.detail.value }, false),
    );
  });
  picker.addEventListener("mdChange", (e) => {
    cancelAnimationFrame(appearancePreviewFrame);
    updateAppearance({ primary: e.detail.value });
  });
  $("#appearance-language").addEventListener("mdChange", (e) => {
    const language = e.detail === "ar" ? "ar" : "en";
    updateAppearance({
      language,
      direction: language === "ar" ? "rtl" : "ltr",
    });
    $("#appearance-rtl").selected = appearance.direction === "rtl";
  });
  $("#appearance-density").addEventListener("mdChange", (e) =>
    updateAppearance({ density: e.detail }),
  );
  $("#appearance-dark").addEventListener("mdChange", (e) =>
    setTheme(e.detail.selected),
  );
  $("#appearance-rtl").addEventListener("mdChange", (e) =>
    updateAppearance({ direction: e.detail.selected ? "rtl" : "ltr" }),
  );
  $("#appearance-sheet").addEventListener("mdClose", () => {
    cancelAnimationFrame(appearancePreviewFrame);
    saveAppearance(appearance);
  });
  await $("#appearance-sheet").show();
}

async function render() {
  const epoch = ++renderEpoch;
  const raw = location.hash.replace(/^#\/?/, "");
  if (["login", "signup", "mfa"].includes(raw)) {
    if (raw === "mfa" && !state.pending) {
      navigate("login");
      return;
    }
    state.route = raw;
    app.innerHTML = authView(raw, state, brand);
    localize(app, appearance.language);
    wireAuth(state, { navigate, toast, complete: completeAuth, runAction });
    await charts();
    return epoch === renderEpoch;
  }
  const route = navItems.some((x) => x[0] === raw) ? raw : "overview";
  const showLoading = state.route !== route || !$("#main");
  state.route = route;
  shell();
  const main = $("#main");
  if (showLoading) {
    main.setAttribute("aria-busy", "true");
    main.innerHTML = skeletonView(route);
    localize(main, appearance.language);
    await demoWait();
    if (epoch !== renderEpoch || !main.isConnected) return false;
  }
  main.removeAttribute("aria-busy");
  const views = {
    overview,
    assets: () =>
      heading(
        "Assets",
        "Equipment status, signals, and process health.",
        btn("Export snapshot", "export", "filled", "download"),
      ) +
      assetTable(true) +
      footer(),
    alarms: alarmsView,
    trends: trendsView,
    settings: settingsView,
  };
  $("#main").innerHTML = views[state.route]();
  localize($("#main"), appearance.language);
  renderRows();
  wireMain();
  $$("[data-severity]").forEach((chip) =>
    chip.addEventListener("mdSelect", () => {
      state.severity = chip.dataset.severity;
      render();
    }),
  );
  $("#alarm-state")?.addEventListener("mdChange", (e) => {
    state.alarmState = e.detail;
    render();
  });
  $("#metric-select")?.addEventListener("mdChange", (e) => {
    state.metric = e.detail;
    reloadChart();
  });
  $("#theme-switch")?.addEventListener("mdChange", (e) =>
    setTheme(e.detail.selected),
  );
  $("#live-switch")?.addEventListener("mdChange", (e) => {
    state.live = e.detail.selected;
    $(".toolbar-live").innerHTML =
      status(state.live ? "Running" : "Paused", state.live) +
      ' <span class="muted">Simulation</span>';
    localize($(".toolbar-live"), appearance.language);
    toast(state.live ? "Simulation resumed." : "Simulation paused.");
  });
  await charts();
  updateSampleTime();
  return epoch === renderEpoch;
}
$(".skip-link").addEventListener("click", (e) => {
  e.preventDefault();
  $("#main")?.focus();
});
document.addEventListener("mdClick", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (navItems.some((x) => x[0] === action)) {
    navigate(action);
    return;
  }
  if (["login", "signup"].includes(action)) {
    state.pending = null;
    navigate(action);
    return;
  }
  if (action === "security") {
    navigate("settings");
    return;
  }
  if (action === "pause") {
    state.live = !state.live;
    render();
  }
  if (action === "fill-demo") fillDemo();
  if (action === "components") showComponents();
  if (action === "appearance") showAppearance();
  if (action === "close-appearance") await $("#appearance-sheet")?.close();
  if (action === "reset-appearance") {
    updateAppearance(DEFAULT_APPEARANCE);
    $("#primary-picker").value = DEFAULT_PRIMARY;
    $("#appearance-density").value = appearance.density;
    $("#appearance-language").value = appearance.language;
    $("#appearance-rtl").selected = false;
    toast("Appearance restored to defaults.");
  }
  if (action.startsWith("asset:")) showAsset(action.slice(6));
  if (action.startsWith("ack:")) showAcknowledge(action.slice(4));
  if (action === "close-ack") await $("#ack-dialog")?.close();
  if (action === "confirm-ack") {
    const id = state.ackId,
      note = $("#ack-note").value;
    const dialog = $("#ack-dialog");
    await runAction(
      "acknowledge",
      el,
      t("Acknowledging alarm…", appearance.language),
      async () => {
        state.alarms = acknowledgeAlarm(state.alarms, id, note);
        state.ackId = null;
        await dialog.close();
        await render();
        toast("Alarm acknowledged in this demo session.");
      },
      { scope: dialog, isCurrent: () => dialog.open && state.ackId === id },
    );
  }
  if (action === "sheet-alarms") {
    await $("#asset-sheet").close();
    state.alarmState = "all";
    navigate("alarms");
  }
  if (action === "logout") {
    await runAction(
      "logout",
      el,
      t("Signing out…", appearance.language),
      async () => {
        state.session = null;
        state.pending = null;
        try {
          sessionStorage.removeItem("sentinel.session");
        } catch {}
        await render();
        toast("Signed out of the demo session.");
      },
    );
  }
  if (action === "reset-alarms") {
    $("#overlays").innerHTML =
      '<md-dialog id="reset-dialog" headline="Reset demo alarms?" icon="restart_alt"><p>This restores the four sample alarms and removes acknowledgment notes from this page.</p><md-button slot="actions" variant="text" data-action="cancel-reset">Cancel</md-button><md-button slot="actions" variant="filled" data-action="confirm-reset">Reset demo alarms</md-button></md-dialog>';
    await ready($("#overlays"));
    await $("#reset-dialog").show();
  }
  if (action === "cancel-reset") await $("#reset-dialog").close();
  if (action === "confirm-reset") {
    const dialog = $("#reset-dialog");
    await runAction(
      "reset-alarms",
      el,
      t("Restoring demo alarms…", appearance.language),
      async () => {
        state.alarms = initialAlarms.map((a) => ({ ...a }));
        await dialog.close();
        await render();
        toast("Demo alarms restored.");
      },
      { scope: dialog, isCurrent: () => dialog.open },
    );
  }
  if (action === "recovery") {
    $("#overlays").innerHTML = recoveryMarkup();
    await ready($("#overlays"));
    await $("#recovery-dialog").show();
    const recoveryField = $("#recovery-form md-otp-field");
    recoveryField.addEventListener("mdInput", () => {
      recoveryField.error = false;
      recoveryField.errorText = "";
    });
    $("#recovery-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (form.querySelector('md-button[type="submit"]')?.loading) return;
      const code = new FormData(form).get("recovery");
      const pending = state.pending;
      const dialog = $("#recovery-dialog");
      await runAction(
        "verification",
        $('md-button[type="submit"]', form),
        t("Verifying recovery code…", appearance.language),
        async () => {
          const result = checkChallenge(pending, code, true);
          if (!result.ok) {
            recoveryField.error = true;
            recoveryField.errorText = t(result.message, appearance.language);
            if (pending) pending.attempts++;
            return;
          }
          const profile = {
            name: pending.name,
            email: pending.email,
            demo: true,
            mfaVerified: true,
          };
          // Complete before the close animation can race another verification.
          completeAuth(profile);
          await dialog.close();
        },
        {
          scope: dialog,
          isCurrent: () => dialog.open && state.pending === pending,
        },
      );
    });
  }
  if (action === "close-recovery") await $("#recovery-dialog").close();
  if (action === "export")
    await exportCsv(el, "sentinel-equipment-simulated.csv", [
      [
        "Asset",
        "Equipment",
        "Area",
        "Status",
        "Reading",
        "Unit",
        "Health %",
        "Signal tag",
        "Source",
      ],
      ...selectEquipment(state.route === "assets" ? state : {}).map((a) => [
        a.id,
        a.name,
        a.area,
        a.status,
        sampleValue(a, state.tick),
        a.unit,
        a.health,
        a.tag,
        "Simulated",
      ]),
    ]);
  if (action === "export-alarms")
    await exportCsv(el, "sentinel-alarms-simulated.csv", [
      [
        "Alarm",
        "Asset",
        "Severity",
        "Event",
        "Time UTC",
        "Acknowledged",
        "Note",
        "Source",
      ],
      ...selectAlarms(state.alarms, state.severity, state.alarmState).map(
        (a) => [
          a.id,
          a.asset,
          a.severity,
          a.title,
          a.time,
          a.acknowledged,
          a.note || "",
          "Simulated",
        ],
      ),
    ]);
  if (action === "export-trend") {
    const data = chartData(state.metric, state.range, state.tick);
    await exportCsv(el, "sentinel-" + state.metric + "-simulated.csv", [
      ["Time UTC", data.name, data.unit, "Source"],
      ...data.data.map((p) => [
        new Date(p.x).toISOString(),
        p.y,
        data.unit,
        "Simulated",
      ]),
    ]);
  }
});
addEventListener("hashchange", async () => {
  if (await render()) $("#main")?.focus();
});
addEventListener("resize", applyResponsiveNav);
matchMedia("(max-width: 1150px)").addEventListener("change", (e) => {
  state.navExpanded = !e.matches;
  const rail = $("#nav");
  if (rail) rail.variant = state.navExpanded ? "expanded" : "standard";
});
function updateSampleTime() {
  if ($("#sample-time"))
    $("#sample-time").textContent = new Date(
      Date.UTC(2026, 8, 7, 14, 36) + state.tick * 4000,
    )
      .toISOString()
      .slice(11, 19);
}
applyAppearance(appearance);
localize(document.body, appearance.language);
document.title =
  appearance.language === "ar"
    ? "Sentinel — مراقبة أنظمة سكادا"
    : "Sentinel — SCADA monitoring";
setInterval(() => {
  if (!state.live || document.hidden) return;
  state.tick++;
  $$("[data-value]").forEach((el) => {
    const a = assets.find((x) => x.id === el.dataset.value);
    if (a) el.textContent = number(sampleValue(a, state.tick));
  });
  updateSampleTime();
  charts();
}, 4000);
await Promise.all(
  [
    "md-navigation-rail",
    "md-navigation-bar",
    "md-breadcrumbs",
    "md-line-chart",
    "md-text-field",
    "md-otp-field",
    "md-button",
    "md-snackbar",
    "md-skeleton",
  ].map((tag) => customElements.whenDefined(tag)),
);
await render();
const unregisterTools = registerMonitoringTools(document.modelContext, {
  snapshot: () => ({
    source: "simulation",
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      value: sampleValue(a, state.tick),
      unit: a.unit,
    })),
    alarms: state.alarms.map((a) => ({
      id: a.id,
      asset: a.asset,
      severity: a.severity,
      acknowledged: a.acknowledged,
    })),
  }),
  assetExists: (id) => assets.some((a) => a.id === id),
  inspect: showAsset,
});
addEventListener("pagehide", unregisterTools, { once: true });
