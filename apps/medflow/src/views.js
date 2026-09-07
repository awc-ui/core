import { t, locale, number } from "./i18n.js";
import {
  clinicians,
  departments,
  caseStatuses,
  priorities,
  getMetrics,
  clinicianLoad,
  filterCases,
  escapeHtml as esc,
} from "./model.js";
export const nav = [
  ["overview", "space_dashboard", "Overview"],
  ["cases", "folder_shared", "Patient cases"],
  ["assignments", "assignment_ind", "Assignments"],
  ["team", "groups", "Care team"],
  ["activity", "history", "Activity"],
];
export const icon = (name) =>
  `<span class="icon" aria-hidden="true">${name}</span>`;
export const brand = () =>
  `<div class="brand"><span class="brand-mark">${icon("add")}</span><span>Medflow<span class="brand-caption" data-i18n="CLINICAL WORKSPACE">${esc(t("CLINICAL WORKSPACE"))}</span></span></div>`;
export const button = (label, action, ico = "", variant = "text", attrs = "") =>
  `<md-button variant="${variant}" data-action="${action}" ${ico ? `icon="${ico}"` : ""} ${attrs}>${esc(t(label))}</md-button>`;
export const avatar = (initials, size = "2.25rem") =>
  `<md-avatar initials="${esc(initials)}" size="${size}"></md-avatar>`;
export const person = (id) => clinicians.find((c) => c.id === id);
export const statusColor = (status) =>
  ({
    Critical: "error",
    High: "warning",
    Routine: "info",
    New: "info",
    "In progress": "primary",
    "Awaiting review": "warning",
    "Ready for discharge": "success",
    Discharged: "neutral",
    Available: "success",
    "In surgery": "warning",
    "Off shift": "neutral",
  })[status] || "neutral";
export const chip = (text) => {
  const color = statusColor(text);
  return `<md-chip variant="assist" appearance="filled" ${color === "neutral" ? "" : `color="${color}"`} label="${esc(t(text))}"></md-chip>`;
};
export const date = (value) =>
  new Intl.DateTimeFormat(locale(), {
    calendar: "gregory",
    day: "numeric",
    month: "short",
  }).format(new Date(value));
export const time = (value) =>
  new Intl.DateTimeFormat(locale(), {
    calendar: "gregory",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
export function select(name, label, values, value = "all", attrs = "") {
  return `<md-select variant="outlined" name="${name}" label="${esc(t(label))}" value="${esc(value)}" search-placeholder="${esc(t("Search…"))}" filter-label="${esc(t("Filter {label}", { label: t(label) }))}" no-results-text="${esc(t("No results"))}" no-options-text="${esc(t("No options"))}" clear-label="${esc(t("Clear selection"))}" searching-label="${esc(t("Searching"))}" loading-text="${esc(t("Loading…"))}" value-missing-label="${esc(t("Please select an item in the list."))}" ${attrs}>${values
    .map((v) => {
      const o = typeof v === "string" ? { value: v, label: v } : v;
      return `<md-select-option value="${esc(o.value)}" label="${esc(t(o.label))}" ${o.disabled ? "disabled" : ""} ${o.supportingText ? `supporting-text="${esc(t(o.supportingText))}"` : ""}></md-select-option>`;
    })
    .join("")}</md-select>`;
}
export function shell(state, content) {
  const index = nav.findIndex((n) => n[0] === state.route),
    m = getMetrics(state.data),
    signed = state.auth.profile;
  return `<div class="workspace"><aside class="sidebar"><md-navigation-rail id="navigation" expandable variant="${state.railExpanded === false ? "standard" : "expanded"}" toggle-label="${esc(t(state.railExpanded === false ? "Expand navigation" : "Collapse navigation"))}" label-visibility="all" active-index="${index}" full-height label="${esc(t("Clinical workspace navigation"))}">
 <div slot="logo" class="rail-brand">${brand()}</div>
 <div slot="header" class="hospital"><span class="hospital-icon">${icon("local_hospital")}</span><div><strong>St. Catherine</strong><small>${esc(t("Medical center"))}</small></div><md-status-dot class="campus-dot" inline size="small" state="online"></md-status-dot></div>
 ${nav.map(([value, ico, label]) => `<md-navigation-rail-tab icon="${ico}" label="${esc(t(label))}" aria-label="${esc(t(label))}" title="${esc(t(label))}" value="${value}" ${value === "assignments" ? `badge-value="${m.unassignedCases}"` : ""}></md-navigation-rail-tab>`).join("")}
 <div slot="footer" class="rail-footer"><md-card variant="outlined" class="shift-card"><div class="row">${icon("light_mode")}<strong>${esc(t("Day shift"))}</strong></div><p>${esc(t("07:00–19:00"))} · ${new Intl.DateTimeFormat(locale(), { calendar: "gregory", weekday: "short", day: "numeric", month: "short" }).format(new Date(2026, 8, 7))}</p><div class="row"><md-status-dot class="live-dot" inline size="small" state="online"></md-status-dot><span id="rail-availability">${esc(t("{count} clinicians available", { count: number(m.availableClinicians) }))}</span></div></md-card><md-button variant="text" full-width icon="tune" data-action="preferences">${esc(t("Workspace preferences"))}</md-button><div class="powered">${esc(t("Built with"))} <strong>awc-ui</strong><span>${esc(t("Component showcase"))}</span></div></div><md-icon-button slot="footer" class="rail-preferences" icon="tune" aria-label="${esc(t("Workspace preferences"))}" title="${esc(t("Workspace preferences"))}" data-action="preferences"></md-icon-button></md-navigation-rail></aside>
 <div class="workspace-body"><md-app-bar class="topbar" headline="${esc(t("Clinical operations"))}"><span slot="leading" class="campus-label">${icon("apartment")} <bdi>St. Catherine</bdi> / <span data-i18n="Main campus">${esc(t("Main campus"))}</span></span><div slot="trailing" class="header-actions"><md-chip class="demo-tag" variant="assist" appearance="filled" label="${esc(t("Demo workspace"))}"></md-chip><md-icon-button id="theme-toggle" icon="${document.documentElement.dataset.theme === "dark" ? "light_mode" : "dark_mode"}" aria-label="${esc(t("Toggle light and dark theme"))}" data-action="theme" title="${esc(t("Toggle theme"))}"></md-icon-button>${button(signed ? "Sign out" : "Sign in", signed ? "signout" : "login", signed ? "logout" : "login", "outlined")}<md-tooltip text="${esc(t("Make it yours"))}" position="bottom"><md-icon-button id="appearance-trigger" icon="tune" aria-label="${esc(t("Make it yours"))}" aria-haspopup="dialog" aria-expanded="false" data-action="preferences"></md-icon-button></md-tooltip><div class="profile">${avatar(
   signed?.name
     ?.split(" ")
     .map((s) => s[0])
     .slice(0, 2)
     .join("") || "AC",
 )}<span><strong><bdi>${esc(signed?.name || "Alex Chen")}</bdi></strong><small>${esc(t(signed ? "Verified demo profile" : "Care coordinator · demo"))}</small></span></div></div></md-app-bar>
 <main id="main" tabindex="-1">${content}</main><footer class="workspace-footer"><span>${esc(t("Fictional records · Changes last for this session"))}</span><span>Medflow / AWC UI</span></footer></div>
 <md-navigation-bar id="mobile-navigation" class="mobile-navigation" active-index="${index}" aria-label="${esc(t("Clinical workspace navigation"))}">${nav.map(([, ico, label]) => `<md-navigation-tab label="${esc(t(label === "Patient cases" ? "Cases" : label === "Care team" ? "Team" : label))}" icon="${ico}"></md-navigation-tab>`).join("")}</md-navigation-bar></div>`;
}
export function heading(eyebrow, title, subtitle, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(t(eyebrow))}</div><h1>${esc(t(title))}</h1><p>${esc(t(subtitle))}</p></div><div class="page-actions">${actions}</div></div>`;
}
export function overview(state) {
  const m = getMetrics(state.data),
    urgent = filterCases(state.data.cases, { sortBy: "priority" })
      .filter((c) => c.status !== "Discharged")
      .slice(0, 5);
  const metrics = [
    [
      "Active cases",
      m.activeCases,
      "Across 5 departments",
      "folder_shared",
      "primary",
    ],
    [
      "Awaiting assignment",
      m.unassignedCases,
      "Ready for a care owner",
      "person_add",
      "warning",
    ],
    [
      "Critical priority",
      m.criticalCases,
      "Prioritized for review",
      "emergency",
      "error",
    ],
    [
      "Ready for discharge",
      m.readyForDischargeCases,
      "Complete the next handoff",
      "task_alt",
      "success",
    ],
  ];
  return (
    heading(
      new Intl.DateTimeFormat(locale(), {
        calendar: "gregory",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
        .format(new Date(2026, 8, 7))
        .toLocaleUpperCase(locale()),
      "A clear view of patient care.",
      "Your cases, care teams, and next priorities — in one place.",
      button("New patient case", "new-case", "add", "filled"),
    ) +
    `<section class="metric-grid" aria-label="${esc(t("Case summary"))}">${metrics.map(([label, value, copy, ico, col], i) => `<md-card variant="outlined" class="metric-card ${col}"><div class="row between"><span>${esc(t(label))}</span><span class="metric-icon">${icon(ico)}</span></div><div class="metric-number">${new Intl.NumberFormat(locale(), { minimumIntegerDigits: 2, useGrouping: false }).format(value)}<md-sparkline data-metric="${i}" height="36px" color="${col}" show-marks="none" show-tooltip="false" aria-hidden="true"></md-sparkline></div><span class="muted small">${esc(t(copy))}</span></md-card>`).join("")}</section>
 <section class="overview-grid"><md-card variant="outlined" class="flow-card"><div class="section-title"><div><span class="eyebrow">${esc(t("CARE DELIVERY"))}</span><h2>${esc(t("Patient flow"))}</h2></div><span class="sample-label">${esc(t("Sample trend · Last 7 days"))}</span></div><div class="chart-lead"><strong>${number(118)}</strong><span>${esc(t("admissions this week"))}</span><span class="trend">${icon("trending_up")} ${esc(t("{percent} vs prior week", { percent: new Intl.NumberFormat(locale(), { style: "percent" }).format(0.12) }))}</span></div><md-line-chart id="patient-flow" height="245px" legend="top-end" curve="monotone" area label="${esc(t("Admissions and discharges"))}" summary="${esc(t("Fictional patient flow over seven days. 118 admissions and 97 discharges."))}" label-empty="${esc(t("No data to display"))}" grid="horizontal" locale="${locale()}" loading-label="${esc(t("Loading chart…"))}" label-plot="${esc(t("Chart data. Use the arrow keys to move between points, Home and End for the first and last, Escape to leave."))}" label-point="%x%: %values%"></md-line-chart></md-card>
 <md-card variant="filled" class="attention-card"><div class="section-title"><span class="eyebrow">${esc(t("NEXT IN YOUR QUEUE"))}</span>${icon("assignment_ind")}</div><h2>${esc(t("Every case needs"))}<br>${esc(t("a care owner."))}</h2><p>${esc(t("{count} patient cases are waiting to be assigned. Match each case with an available clinician.", { count: number(m.unassignedCases) }))}</p><div class="attention-avatars">${clinicians
   .filter((c) => c.status === "Available")
   .slice(0, 4)
   .map((c) => avatar(c.initials, "2.75rem"))
   .join(
     "",
   )}<span>${esc(t("Care team"))}<br><strong>${esc(t("On this shift"))}</strong></span></div>${button("Review assignments", "go-assignments", "arrow_forward", "filled", "mirror-icon")}<span class="small">${icon("info")} ${esc(t("Availability and capacity shown before assigning"))}</span></md-card></section>
 <section class="overview-bottom"><md-card variant="outlined" class="priority-card"><div class="section-title"><div><h2>${esc(t("Priority worklist"))}</h2><p class="muted small">${esc(t("Active cases, ordered by priority"))}</p></div>${button("View all cases", "go-cases", "arrow_forward", "text", "mirror-icon")}</div><md-list class="priority-list" label="${esc(t("Priority worklist"))}" interaction-mode="multi-action">${urgent.map((c) => `<md-list-item class="priority-row" type="text" leading-avatar-label="${esc(c.initials)}" headline="${esc(c.patient)}" supporting-text="${esc(t(c.department))} · ${esc(c.room === "Pending" ? t("Pending") : c.room)}"><div slot="trailing" class="priority-trailing">${chip(c.priority)}<span class="priority-owner">${person(c.assigneeId) ? `<bdi>${esc(person(c.assigneeId).name)}</bdi>` : esc(t("Unassigned"))}</span><md-icon-button data-directional icon="arrow_forward" aria-label="${esc(t("Open case for {name}", { name: c.patient }))}" data-action="case-detail" data-id="${esc(c.id)}"></md-icon-button></div></md-list-item>`).join("")}</md-list></md-card>
 <md-card variant="outlined" class="activity-preview"><div class="section-title"><h2>${esc(t("Latest activity"))}</h2>${button("View all", "go-activity")}</div>${activityItems(state.data.activity.slice(0, 4))}</md-card></section>`
  );
}
export function tableRows(cases, selected) {
  return cases
    .map((c) => {
      const p = person(c.assigneeId);
      return `<md-table-row value="${esc(c.id)}" clickable ${selected.has(c.id) ? "selected" : ""} ${c.status === "Discharged" ? 'selectable="false"' : ""}><md-table-cell padding="checkbox" align="center">${c.status === "Discharged" ? `<span class="muted" aria-label="${esc(t("Discharged case cannot be selected"))}">—</span>` : `<md-checkbox aria-label="${esc(t("Select {name}", { name: c.patient }))}"></md-checkbox>`}</md-table-cell><md-table-cell><div class="table-person">${avatar(c.initials)}<div><strong><bdi>${esc(c.patient)}</bdi></strong><span>${esc(t("{age}y", { age: number(c.age) }))} · ${esc(t(c.sex))} · <bdi>${esc(c.mrn)}</bdi></span></div></div></md-table-cell><md-table-cell><div class="cell-stack"><strong>${esc(t(c.department))}</strong><span>${esc(c.summaryIsSample ? t(c.summary) : c.summary)}</span></div></md-table-cell><md-table-cell>${chip(c.priority)}</md-table-cell><md-table-cell>${chip(c.status)}</md-table-cell><md-table-cell>${p ? `<div class="assignee">${avatar(p.initials, "1.6rem")}<span><bdi>${esc(p.name)}</bdi></span></div>` : button("Assign clinician", "assign-one", "person_add", "text", `data-id="${esc(c.id)}"`)}</md-table-cell><md-table-cell><span class="mono"><bdi>${esc(c.room === "Pending" ? t("Pending") : c.room)}</bdi></span></md-table-cell><md-table-cell padding="none" align="center"><md-icon-button icon="arrow_outward" aria-label="${esc(t("Open {name} case details", { name: c.patient }))}" data-action="case-detail" data-id="${esc(c.id)}"></md-icon-button></md-table-cell></md-table-row>`;
    })
    .join("");
}
export function casesView(state, assignment = false) {
  const m = getMetrics(state.data);
  return (
    heading(
      assignment ? "CARE COORDINATION" : "PATIENT MANAGEMENT",
      assignment ? "The right care, assigned." : "Patient cases",
      assignment
        ? "Match patients with available clinicians and balance the team’s workload."
        : "Manage the patient journey, from admission to discharge.",
      button("New patient case", "new-case", "add", "filled"),
    ) +
    (assignment
      ? `<md-card variant="filled" class="assignment-banner"><div class="row">${icon("assignment_ind")}<strong>${esc(t("{count} cases need a care owner", { count: number(m.unassignedCases) }))}</strong><span class="muted">${esc(t("{count} clinicians available on this shift", { count: number(m.availableClinicians) }))}</span></div>${button("Show unassigned", "unassigned", "filter_alt", "outlined")}</md-card>`
      : "") +
    `<md-card variant="outlined" class="cases-card"><div class="case-toolbar"><div class="filter-chips" role="group" aria-label="${esc(t("Case queue"))}"><md-chip variant="filter" data-queue="all" label="${esc(t("All cases"))}" ${state.queue === "all" ? "selected" : ""}></md-chip><md-chip variant="filter" data-queue="unassigned" label="${esc(t("Unassigned · {count}", { count: number(m.unassignedCases) }))}" ${state.queue === "unassigned" ? "selected" : ""}></md-chip><md-chip variant="filter" data-queue="critical" label="${esc(t("Critical · {count}", { count: number(m.criticalCases) }))}" ${state.queue === "critical" ? "selected" : ""}></md-chip><md-chip variant="filter" data-queue="review" label="${esc(t("Awaiting review"))}" ${state.queue === "review" ? "selected" : ""}></md-chip></div>${button("Export CSV", "export", "download", "outlined")}</div>
 <div class="filters"><md-text-field id="case-search" name="query" variant="outlined" label="${esc(t("Search patients, MRN, or case"))}" type="search" debounce="160" value="${esc(state.filters.query)}"><span slot="leading-icon" class="icon" aria-hidden="true">search</span><md-icon-button slot="trailing-icon" icon="close" aria-label="${esc(t("Clear search"))}" data-action="clear-search" ${state.filters.query ? "" : "hidden"}></md-icon-button></md-text-field>${select("department", "Department", [{ value: "all", label: "All departments" }, ...departments], state.filters.department, 'data-filter="department"')}${select("status", "Case status", [{ value: "all", label: "All statuses" }, ...caseStatuses], state.filters.status, 'data-filter="status"')}${button("Reset", "reset-filters", "restart_alt")}</div>
 <div id="table-region"></div></md-card>`
  );
}
export function visibleCases(state) {
  const filters = { ...state.filters };
  if (state.queue === "unassigned") filters.assignee = "unassigned";
  if (state.queue === "critical") filters.priority = "Critical";
  if (state.queue === "review") filters.status = "Awaiting review";
  return filterCases(state.data.cases, filters).filter(
    (c) => state.queue !== "critical" || c.status !== "Discharged",
  );
}
export function tableView(state) {
  const filters = state.filters;
  const all = visibleCases(state);
  state.page = Math.min(
    state.page,
    Math.max(0, Math.ceil(all.length / state.pageSize) - 1),
  );
  const rows = all.slice(
    state.page * state.pageSize,
    (state.page + 1) * state.pageSize,
  );
  return `<md-table-container variant="flat" shape="none" max-height="65vh"><md-table-toolbar id="bulk-bar" slot="top" compact num-selected="${state.selected.size}" label-selected="${esc(t("%count% selected"))}" ${state.selected.size ? "" : "hidden"}>${button("Assign selected", "assign-selected", "person_add", "filled", 'slot="selection-actions"')}${button("Clear", "clear-selection", "", "text", 'slot="selection-actions"')}</md-table-toolbar><md-table id="case-table" label="${esc(t("Patient cases"))}" summary="${esc(t("Select cases to assign a clinician. Open a patient for case details."))}" column-template="3.5rem minmax(13rem,1.4fr) minmax(13rem,1.5fr) 7rem minmax(12rem,max-content) minmax(11rem,1fr) 5rem 3.5rem" min-width="1080px" density="comfortable" selection="multiple" sort-by="${esc(filters.sortBy)}" sort-order="${esc(filters.sortOrder)}" row-count="${all.length}" row-offset="${state.page * state.pageSize}" keep-height="false" sticky-header ${!all.length ? "empty" : ""}><md-table-head><md-table-row><md-table-cell head padding="checkbox" align="center"><md-checkbox aria-label="${esc(t("Select all cases on this page"))}"></md-checkbox></md-table-cell>${[
    ["Patient", "patient"],
    ["Department / case", "department"],
    ["Priority", "priority"],
    ["Status", "status"],
    ["Care owner", ""],
    ["Room", ""],
    ["", ""],
  ]
    .map(
      ([label, key]) =>
        `<md-table-cell head scope="col">${key ? `<md-table-sort-label column="${key}">${esc(t(label))}</md-table-sort-label>` : esc(t(label))}</md-table-cell>`,
    )
    .join(
      "",
    )}</md-table-row></md-table-head><md-table-body>${tableRows(rows, state.selected)}</md-table-body><div slot="empty" class="empty-state">${icon("person_search")}<h3>${esc(t("No matching patient cases"))}</h3><p>${esc(t("Try a different patient name or reset the filters."))}</p>${button("Reset filters", "reset-filters", "restart_alt", "outlined")}</div></md-table><md-table-pagination slot="bottom" count="${all.length}" page="${state.page}" rows-per-page="${state.pageSize}" rows-per-page-options="8,16,24" label-rows-per-page="${esc(t("Cases per page:"))}" label-displayed-rows="${esc(t("%from%–%to% of %count%"))}" label-first-page="${esc(t("First page"))}" label-previous-page="${esc(t("Previous page"))}" label-next-page="${esc(t("Next page"))}" label-last-page="${esc(t("Last page"))}" label-all="${esc(t("All"))}" show-first-last></md-table-pagination></md-table-container>`;
}
export function teamView(state) {
  return (
    heading(
      "PEOPLE & CAPACITY",
      "Your care team",
      "A shared view of clinician availability and active case assignments.",
      button("Assign cases", "go-assignments", "assignment_ind", "filled"),
    ) +
    `<section class="team-grid">${clinicians
      .map((c) => {
        const load = clinicianLoad(state.data, c.id);
        return `<md-card variant="outlined" class="clinician-card"><div class="row between">${avatar(c.initials, "3.5rem")}${chip(c.status)}</div><h2><bdi>${esc(c.name)}</bdi></h2><p>${esc(t(c.role))} · ${esc(t(c.department))}</p><div class="clinician-meta"><span>${icon("schedule")} <bdi>${esc(t(c.shift))}</bdi></span></div><div class="row between small"><strong>${esc(t("Active caseload"))}</strong><span>${esc(t("{load} / {capacity} cases", { load: number(load), capacity: number(c.capacity) }))}</span></div><md-meter value="${load}" max="${c.capacity}" color="${load >= c.capacity ? "warning" : "primary"}" thickness="6" label="${esc(t("{name} caseload", { name: c.name }))}" value-text="${esc(t("{load} of {capacity} case capacity", { load: number(load), capacity: number(c.capacity) }))}"></md-meter><div class="row between"><span class="small muted">${esc(t("{count} spaces available", { count: number(Math.max(0, c.capacity - load)) }))}</span>${button("View cases", "clinician-cases", "arrow_forward", "text", `data-id="${esc(c.id)}" mirror-icon`)}</div></md-card>`;
      })
      .join(
        "",
      )}</section><md-card variant="outlined" class="capacity-chart" full-width><div class="section-title"><h2>${esc(t("Active cases by department"))}</h2><span class="sample-label">${esc(t("Current session"))}</span></div><md-bar-chart id="department-chart" height="260px" legend="none" label="${esc(t("Cases by department"))}" locale="${locale()}" loading-label="${esc(t("Loading chart…"))}" label-plot="${esc(t("Chart data. Use the arrow keys to move between points, Home and End for the first and last, Escape to leave."))}" label-point="%x%: %values%" show-labels></md-bar-chart></md-card>`
  );
}
export function activityItems(items) {
  return `<md-list class="activity-list" label="${esc(t("Care coordination events"))}">${items.map((a, i) => `<md-list-item type="text" leading-icon="${i === 0 ? "check_circle" : "history"}" headline="${esc(t(a.title))}" supporting-text="${esc(t(a.detail))}"><time slot="overline" datetime="${new Date(a.at).toISOString()}">${date(a.at)} · ${time(a.at)}</time></md-list-item>`).join("")}</md-list>`;
}
export function activityView(state) {
  return (
    heading(
      "WORKSPACE HISTORY",
      "Activity log",
      "Follow case updates and assignments made in this demo session.",
    ) +
    `<md-card variant="outlined" class="full-activity" full-width><div class="section-title"><h2>${esc(t("Care coordination events"))}</h2><span class="sample-label">${esc(t("{count} events", { count: number(state.data.activity.length) }))}</span></div>${activityItems(state.data.activity)}</md-card>`
  );
}
export function detailsView(state, id) {
  const c = state.data.cases.find((c) => c.id === id);
  if (!c) return "";
  const p = person(c.assigneeId);
  return `<md-side-sheet id="case-sheet" variant="modal" side="end" headline="${esc(t("Patient case · {id}", { id: c.id }))}" aria-label="${esc(t("{name} case details", { name: c.patient }))}" top-divider bottom-divider><md-icon-button slot="close" icon="close" aria-label="${esc(t("Close"))}" data-action="close-overlay"></md-icon-button><div class="detail-hero">${avatar(c.initials, "4rem")}<div><h2><bdi>${esc(c.patient)}</bdi></h2><p>${esc(t("{age} years", { age: number(c.age) }))} · ${esc(t(c.sex))} · <span class="mono"><bdi>${esc(c.mrn)}</bdi></span></p></div></div><div class="row wrap" role="group" aria-label="${esc(t("Case priority and status"))}">${chip(c.priority)}${chip(c.status)}</div><dl class="case-facts"><div><dt>${esc(t("Department"))}</dt><dd>${esc(t(c.department))}</dd></div><div><dt>${esc(t("Room / bed"))}</dt><dd><bdi>${esc(c.room === "Pending" ? t("Pending") : c.room)}</bdi></dd></div><div><dt>${esc(t("Admitted"))}</dt><dd>${date(c.admittedAt)} · ${time(c.admittedAt)}</dd></div><div><dt>${esc(t("Care owner"))}</dt><dd>${p ? `<bdi>${esc(p.name)}</bdi>` : esc(t("Unassigned"))}</dd></div></dl><md-card variant="filled" class="case-summary"><h3>${esc(t("Case summary"))}</h3><p>${esc(c.summaryIsSample ? t(c.summary) : c.summary)}</p></md-card>${c.status === "Discharged" ? `<md-card variant="filled" class="archived-notice">${esc(t("This discharged case is read-only."))}</md-card>` : ""}<form id="status-form" data-id="${esc(c.id)}" class="inline-form" ${c.status === "Discharged" ? "hidden" : ""}>${select("status", "Update case status", caseStatuses, c.status, "required")}<md-button variant="outlined" type="submit">${esc(t("Update"))}</md-button></form><section class="case-notes"><h3>${esc(t("Care coordination notes"))}</h3>${c.notes.map((n) => `<md-card variant="outlined" class="note"><div class="row between"><strong>${n.author === "Intake desk" ? esc(t(n.author)) : `<bdi>${esc(n.author)}</bdi>`}</strong><time>${time(n.at)}</time></div><p>${esc(/^note-\d+-1$/.test(n.id) ? t(n.text) : n.text)}</p></md-card>`).join("")}<form id="note-form" data-id="${esc(c.id)}" ${c.status === "Discharged" ? "hidden" : ""}><md-text-field variant="outlined" label="${esc(t("Add a coordination note"))}" name="note" multiline="auto-grow" rows="2" max-length="1000" required supporting-text="${esc(t("Use fictional information only."))}"></md-text-field><md-button variant="tonal" type="submit" icon="add_comment">${esc(t("Add note"))}</md-button></form></section><section><h3>${esc(t("Case timeline"))}</h3>${activityItems(c.timeline)}</section><p class="form-error" id="detail-error" role="alert"></p><md-button slot="actions" variant="text" data-action="close-overlay">${esc(t("Close"))}</md-button><md-button slot="actions" variant="filled" icon="assignment_ind" data-action="assign-one" data-id="${esc(c.id)}" ${c.status === "Discharged" ? "disabled" : ""}>${esc(t(p ? "Reassign clinician" : "Assign clinician"))}</md-button></md-side-sheet>`;
}

// Update only text and public component labels; keep the mounted navigation
// elements, selected destination, expansion state, and focus behavior intact.
export function syncShellLanguage(state) {
  const workspace = document.querySelector(".workspace");
  if (!workspace) return;
  const setText = (selector, source, params) => {
    const element = workspace.querySelector(selector);
    if (element) element.textContent = t(source, params);
  };
  const setLabel = (selector, attribute, source) => {
    workspace.querySelector(selector)?.setAttribute(attribute, t(source));
  };
  workspace.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  const rail = workspace.querySelector("#navigation");
  if (rail) {
    rail.setAttribute("label", t("Clinical workspace navigation"));
    rail.setAttribute(
      "toggle-label",
      t(
        rail.getAttribute("variant") === "standard"
          ? "Expand navigation"
          : "Collapse navigation",
      ),
    );
    rail.querySelectorAll("md-navigation-rail-tab").forEach((tab) => {
      const destination = nav.find(
        ([value]) => value === tab.getAttribute("value"),
      );
      if (!destination) return;
      for (const attribute of ["label", "aria-label", "title"])
        tab.setAttribute(attribute, t(destination[2]));
    });
  }
  setText(".hospital small", "Medical center");
  setText(".shift-card .row strong", "Day shift");
  const shiftTime = workspace.querySelector(".shift-card > p");
  if (shiftTime)
    shiftTime.textContent = `${t("07:00–19:00")} · ${new Intl.DateTimeFormat(locale(), { calendar: "gregory", weekday: "short", day: "numeric", month: "short" }).format(new Date(2026, 8, 7))}`;
  setText("#rail-availability", "{count} clinicians available", {
    count: number(getMetrics(state.data).availableClinicians),
  });
  setText(
    '.rail-footer md-button[data-action="preferences"]',
    "Workspace preferences",
  );
  for (const attribute of ["aria-label", "title"])
    setLabel(".rail-preferences", attribute, "Workspace preferences");
  const powered = workspace.querySelector(".powered");
  if (powered?.firstChild?.nodeType === 3)
    powered.firstChild.nodeValue = `${t("Built with")} `;
  setText(".powered > span", "Component showcase");
  setLabel(".topbar", "headline", "Clinical operations");
  setLabel(".demo-tag", "label", "Demo workspace");
  setLabel("#theme-toggle", "aria-label", "Toggle light and dark theme");
  setLabel("#theme-toggle", "title", "Toggle theme");
  setText(
    '.header-actions md-button[data-action="login"], .header-actions md-button[data-action="signout"]',
    state.auth.profile ? "Sign out" : "Sign in",
  );
  setLabel("#appearance-trigger", "aria-label", "Make it yours");
  workspace
    .querySelector("#appearance-trigger")
    ?.closest("md-tooltip")
    ?.setAttribute("text", t("Make it yours"));
  setText(
    ".profile small",
    state.auth.profile ? "Verified demo profile" : "Care coordinator · demo",
  );
  setText(
    ".workspace-footer > span:first-child",
    "Fictional records · Changes last for this session",
  );
  setLabel("#mobile-navigation", "aria-label", "Clinical workspace navigation");
  workspace
    .querySelectorAll("#mobile-navigation md-navigation-tab")
    .forEach((tab, index) => {
      const destination = nav[index];
      if (!destination) return;
      const label = destination[2];
      tab.setAttribute(
        "label",
        t(
          label === "Patient cases"
            ? "Cases"
            : label === "Care team"
              ? "Team"
              : label,
        ),
      );
    });
}
