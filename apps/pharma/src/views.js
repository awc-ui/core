import {
  analysts,
  analystLoad,
  assayTypes,
  compounds,
  filterRuns,
  getAnalyst,
  getChartData,
  getCompound,
  getMetrics,
  runStatuses,
} from "./model.js";

const number = new Intl.NumberFormat("en-US");
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const statusColors = {
  Draft: "secondary",
  Queued: "info",
  Running: "primary",
  Review: "warning",
  Completed: "success",
};
const priorityColors = {
  Urgent: "error",
  High: "warning",
  Normal: "secondary",
};

export function escapeHTML(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
const e = escapeHTML;
const n = (value) => number.format(value);
const symbol = (icon) =>
  `<span class="symbol" aria-hidden="true">${e(icon)}</span>`;
const newRunButton = () =>
  '<md-button data-action="new-run" variant="filled" icon="add">New test run</md-button>';
const heading = (eyebrow, title, subtitle, action = "") =>
  `<header class="page-heading"><div><p class="eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p class="page-subtitle">${e(subtitle)}</p></div>${action ? `<div class="page-actions">${action}</div>` : ""}</header>`;
const metric = (label, value, note, icon, className = "") =>
  `<md-card variant="outlined" full-width class="metric-card ${className}"><div class="metric-heading"><span>${e(label)}</span>${symbol(icon)}</div><strong class="metric-value">${e(value)}</strong><p class="metric-note">${e(note)}</p></md-card>`;
const openRun = (run, label = "Open run") =>
  `<md-button size="xs" variant="text" data-action="open-run" data-id="${e(run.id)}" aria-label="${e(`${label} ${run.id}`)}">${e(label)}</md-button>`;
const statusChip = (run) =>
  `<md-chip variant="assist" appearance="filled" color="${statusColors[run.status] || "secondary"}" label="${e(run.status)}" data-action="open-run" data-id="${e(run.id)}" aria-label="${e(`Open ${run.id}, ${run.status}`)}"></md-chip>`;
const priorityChip = (run) =>
  `<md-chip variant="assist" appearance="outlined" color="${priorityColors[run.priority] || "secondary"}" label="${e(run.priority)}" data-action="open-run" data-id="${e(run.id)}" aria-label="${e(`Open ${run.id}, ${run.priority} priority`)}"></md-chip>`;
const analystCell = (run) => {
  const analyst = getAnalyst(run.analystId);
  return analyst
    ? `<div class="analyst-cell"><md-avatar initials="${e(analyst.initials)}" size="small"></md-avatar><span>${e(analyst.name.replace(/^Dr\. /, ""))}</span></div>`
    : `<md-button size="xs" variant="text" icon="person_add" data-action="open-run" data-id="${e(run.id)}" aria-label="${e(`Assign analyst to ${run.id}`)}">Assign analyst</md-button>`;
};
const dueCell = (run) =>
  `<div class="cell-title">${e(date.format(new Date(run.dueAt)))}</div><div class="cell-meta">${e(time.format(new Date(run.dueAt)))} UTC</div>`;
const options = (items, allLabel) =>
  `<md-select-option value="all">${e(allLabel)}</md-select-option>${items.map((item) => `<md-select-option value="${e(item)}">${e(item)}</md-select-option>`).join("")}`;

export function renderRunRows(runs) {
  return runs
    .map(
      (run) => `<md-table-row value="${e(run.id)}">
    <md-table-cell head scope="row"><div class="cell-title">${e(run.title)}</div><div class="cell-meta">${e(run.id)} · ${n(run.sampleCount)} samples</div></md-table-cell>
    <md-table-cell>${e(run.assayType)}</md-table-cell>
    <md-table-cell>${statusChip(run)}</md-table-cell>
    <md-table-cell>${priorityChip(run)}</md-table-cell>
    <md-table-cell>${analystCell(run)}</md-table-cell>
    <md-table-cell>${dueCell(run)}</md-table-cell>
    <md-table-cell align="end">${openRun(run, "View")}</md-table-cell>
  </md-table-row>`,
    )
    .join("");
}

function runTable(
  runs,
  {
    id = "runs-table",
    title = "Test runs",
    subtitle = "",
    top = "",
    footer = "",
  } = {},
) {
  return `<md-table-container variant="outlined" shape="large" class="runs-table">
    <div slot="top" class="table-heading"><div><h2>${e(title)}</h2>${subtitle ? `<p class="cell-meta">${e(subtitle)}</p>` : ""}</div>${top}</div>
    <md-table id="${e(id)}" label="${e(title)}" min-width="1020px" column-template="minmax(220px, 2fr) minmax(135px, 1.2fr) minmax(105px, .8fr) minmax(95px, .7fr) minmax(170px, 1.2fr) minmax(100px, .8fr) 80px" ${runs.length ? "" : "empty"}>
      <md-table-head><md-table-row rowgroup="head">${["Test run / sample", "Assay", "Status", "Priority", "Analyst", "Due", "Details"].map((label, index) => `<md-table-cell head scope="col"${index === 6 ? ' align="end"' : ""}>${label}</md-table-cell>`).join("")}</md-table-row></md-table-head>
      <md-table-body>${renderRunRows(runs)}</md-table-body>
      <div slot="empty" class="empty-state"><h3>No test runs match</h3><p>Try another search or clear the status and assay filters.</p></div>
    </md-table>
    ${footer ? `<div slot="bottom" class="table-footer">${footer}</div>` : ""}
  </md-table-container>`;
}

export function renderOverview(state) {
  const metrics = getMetrics(state);
  const { volume } = getChartData(state);
  const weeklySamples = volume.reduce((total, day) => total + day.samples, 0);
  const reviews = filterRuns(state.runs, {
    status: "Review",
    sortBy: "dueAt",
  }).slice(0, 3);
  const recent = filterRuns(state.runs, {
    status: "active",
    sortBy: "priority",
  }).slice(0, 5);
  return `${heading("Laboratory workspace", "A clearer view of discovery.", "Your compounds, test runs, and people. Connected in one workspace.", newRunButton())}
    <section class="metrics-grid" aria-label="Laboratory summary">
      ${metric("Active test runs", n(metrics.activeRuns), `${n(metrics.runningRuns)} running · ${n(metrics.queuedRuns)} queued`, "science", "metric-primary")}
      ${metric("Samples in scope", n(metrics.totalSamples), `Across ${n(metrics.totalRuns)} test runs`, "biotech")}
      ${metric("Ready for review", n(metrics.reviewRuns), `${n(metrics.flaggedSamples)} sample results flagged`, "fact_check")}
      ${metric("Analysts available", n(metrics.availableAnalysts), `${n(analysts.length)} people in your laboratory`, "groups")}
    </section>
    <section class="overview-grid" aria-label="Testing activity and review queue">
      <md-card variant="outlined" full-width class="chart-card">
        <div class="panel-heading"><div><p class="eyebrow">Testing activity</p><h2>Every sample moves us forward.</h2></div><span class="cell-meta">Last 7 days</span></div>
        <div class="chart-summary"><strong>${n(weeklySamples)}</strong><span>samples registered this week</span></div>
        <md-area-chart id="sample-volume-chart" height="280px" curve="monotone" stack="none" fill-opacity="0.28" show-marks legend="none" no-animation label="Daily registered samples" summary="Fictional sample intake per day over the last seven days. The chart includes a screen-reader data table." locale="en-US"></md-area-chart>
        <p class="chart-footnote">Sample volume from the current demonstration records.</p>
      </md-card>
      <md-card variant="outlined" full-width class="attention-card">
        <div class="panel-heading"><div><p class="eyebrow">Your next focus</p><h2>Ready for a closer look</h2></div>${symbol("fact_check")}</div>
        <p class="page-subtitle">${n(metrics.reviewRuns)} test runs are waiting for review.</p>
        <div class="attention-list">${reviews.map((run) => `<div class="attention-item"><div><strong>${e(getCompound(run.compoundId)?.name || run.compoundId)}</strong><p class="cell-meta">${e(run.assayType)} · ${e(run.id)}</p><p class="attention-note">${run.flaggedSamples ? `${n(run.flaggedSamples)} flagged samples to review` : "All sample results are ready"}</p></div>${openRun(run, "Review")}</div>`).join("") || '<p class="empty-state">The review queue is clear.</p>'}</div>
        <a class="text-link" href="#/reviews">Open review queue</a>
      </md-card>
    </section>
    ${runTable(recent, { id: "overview-runs-table", title: "On the laboratory bench", subtitle: "Active work, ordered by priority", top: '<a class="text-link" href="#/runs">View all test runs</a>', footer: `<span>Showing ${n(recent.length)} of ${n(metrics.activeRuns)} active runs</span><span>Fictional laboratory data</span>` })}`;
}

export function renderRuns(state, filters = {}) {
  const status = filters.status || "all";
  const assayType = filters.assayType || "all";
  const runs = filterRuns(state.runs, filters);
  const metrics = getMetrics(state);
  const analyst = getAnalyst(filters.analystId);
  const compound = getCompound(filters.compoundId);
  const scope = analyst
    ? `Assigned to ${analyst.name}`
    : compound
      ? `${compound.name} compound records`
      : "One worklist for every stage of analytical testing.";
  const filterChips = [
    ["all", "All runs", metrics.totalRuns],
    ["Running", "Running", metrics.runningRuns],
    ["Review", "Review", metrics.reviewRuns],
    ["Queued", "Queued", metrics.queuedRuns],
  ]
    .map(
      ([value, label, count]) =>
        `<md-chip variant="filter" label="${e(`${label} · ${n(count)}`)}"${status === value ? " selected" : ""} data-action="filter-status" data-id="${e(value)}"></md-chip>`,
    )
    .join("");
  return `${heading("Testing operations", "Test runs", scope, newRunButton())}
    <div class="worklist-tools"><div class="filter-chips" role="group" aria-label="Filter test runs by status">${filterChips}</div><div class="page-actions"><md-button variant="text" icon="restart_alt" data-action="reset-filters">Reset filters</md-button><md-button variant="text" icon="download" data-action="export">Export CSV</md-button></div></div>
    <div class="table-filters" role="search" aria-label="Find test runs">
      <md-text-field id="run-search" name="query" variant="outlined" type="search" label="Search test runs" placeholder="Compound, batch, run, or analyst" clearable="internal" value="${e(filters.query || "")}"></md-text-field>
      <md-select id="run-status" name="status" variant="outlined" label="Run status" value="${e(status)}">${options(["active", ...runStatuses], "All statuses").replace(">active<", ">Active runs<")}</md-select>
      <md-select id="run-assay" name="assayType" variant="outlined" label="Assay type" value="${e(assayType)}">${options(assayTypes, "All assays")}</md-select>
    </div>
    ${runTable(runs, { title: "Laboratory worklist", subtitle: `${n(runs.length)} matching test runs`, footer: `<span>${n(runs.length)} records · All times UTC</span><span>Open a run to assign, advance, or review.</span>` })}`;
}

/** Replace only the result rows so typing preserves the field, focus, and caret. */
export async function updateRunResults(root, state, filters = {}) {
  const table = root.querySelector("#runs-table");
  const body = table?.querySelector("md-table-body");
  if (!table || !body) return;
  const runs = filterRuns(state.runs, filters);
  body.innerHTML = renderRunRows(runs);
  table.empty = runs.length === 0;
  const container = table.closest("md-table-container");
  const count = container?.querySelector(".table-heading .cell-meta");
  if (count) count.textContent = `${n(runs.length)} matching test runs`;
  const footer = container?.querySelector(".table-footer span");
  if (footer) footer.textContent = `${n(runs.length)} records · All times UTC`;

  const metrics = getMetrics(state);
  const chipCounts = {
    all: ["All runs", metrics.totalRuns],
    Running: ["Running", metrics.runningRuns],
    Review: ["Review", metrics.reviewRuns],
    Queued: ["Queued", metrics.queuedRuns],
  };
  for (const chip of root.querySelectorAll(
    '.filter-chips md-chip[data-action="filter-status"]',
  )) {
    chip.selected = chip.dataset.id === (filters.status || "all");
    const [label, value] = chipCounts[chip.dataset.id] || [];
    if (label) chip.label = `${label} · ${n(value)}`;
  }
  // Mutations above are synchronous; a subsequent keystroke always wins even if
  // earlier lazy-component readiness promises finish later.
  await Promise.all(
    [...body.querySelectorAll("*")]
      .filter((element) => typeof element.componentOnReady === "function")
      .map((element) => element.componentOnReady()),
  );
  return runs.length;
}

export function renderCompounds(state) {
  return `${heading("Research portfolio", "Compounds", "A shared catalog for your next discovery.", newRunButton())}
    <div class="section-intro"><span>${n(compounds.length)} fictional research candidates</span><span>Characterization · Methods · Stability</span></div>
    <section class="catalog-grid" aria-label="Compound catalog">${compounds
      .map((compound) => {
        const runs = state.runs.filter((run) => run.compoundId === compound.id);
        const owner = getAnalyst(compound.ownerId);
        return `<md-card variant="outlined" full-width class="compound-card">
        <div class="compound-kicker">${symbol("hub")}<span>${e(compound.code)}</span></div>
        <div><p class="eyebrow">${e(compound.program)}</p><h2>${e(compound.name)}</h2><p class="page-subtitle">${e(compound.stage)}</p></div>
        <p class="compound-summary">${e(compound.summary)}</p>
        <dl class="detail-grid"><div><dt>Active runs</dt><dd>${n(runs.filter((run) => run.status !== "Completed").length)}</dd></div><div><dt>Samples</dt><dd>${n(runs.reduce((sum, run) => sum + run.sampleCount, 0))}</dd></div></dl>
        <div class="compound-owner"><md-avatar initials="${e(owner?.initials || "")}" size="small"></md-avatar><span>${e(owner?.name || "Unassigned")}</span></div>
        <md-button variant="text" data-action="open-compound" data-id="${e(compound.id)}">Explore compound</md-button>
      </md-card>`;
      })
      .join("")}</section>`;
}

export function renderSamples(state) {
  const metrics = getMetrics(state);
  const runs = filterRuns(state.runs, {
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  return `${heading("Sample operations", "Samples & batches", "Follow every batch from registration through its linked test run.")}
    <section class="metrics-grid" aria-label="Sample summary">
      ${metric("Registered samples", n(metrics.totalSamples), `${n(state.runs.length)} tracked batches`, "biotech")}
      ${metric("Assessed samples", n(metrics.passedSamples + metrics.flaggedSamples), `${n(metrics.completionRate)}% of the registered workload`, "task_alt")}
      ${metric("Flagged results", n(metrics.flaggedSamples), "For closer review within the demo", "flag")}
      ${metric("Awaiting results", n(metrics.pendingSamples), "Linked to draft, queued, or running tests", "hourglass_top")}
    </section>
    <md-table-container variant="outlined" shape="large" class="runs-table">
      <div slot="top" class="table-heading"><div><h2>Sample batch register</h2><p class="cell-meta">Every batch remains linked to its test record.</p></div></div>
      <md-table label="Sample batch register" min-width="940px" column-template="minmax(130px, 1fr) minmax(190px, 1.5fr) minmax(130px, 1fr) 90px 90px 90px minmax(120px, 1fr) 100px"${runs.length ? "" : " empty"}>
        <md-table-head><md-table-row rowgroup="head">${["Batch", "Compound / assay", "Location", "Samples", "Passed", "Flagged", "Status", "Test run"].map((label, index) => `<md-table-cell head scope="col"${[3, 4, 5].includes(index) ? " numeric" : ""}>${label}</md-table-cell>`).join("")}</md-table-row></md-table-head>
        <md-table-body>${runs.map((run) => `<md-table-row value="${e(run.id)}"><md-table-cell head scope="row"><div class="cell-title">${e(run.batchId)}</div><div class="cell-meta">${e(date.format(new Date(run.createdAt)))}</div></md-table-cell><md-table-cell><div class="cell-title">${e(getCompound(run.compoundId)?.name || run.compoundId)}</div><div class="cell-meta">${e(run.assayType)}</div></md-table-cell><md-table-cell>${e(run.location)}</md-table-cell><md-table-cell numeric>${n(run.sampleCount)}</md-table-cell><md-table-cell numeric>${n(run.passedSamples)}</md-table-cell><md-table-cell numeric>${n(run.flaggedSamples)}</md-table-cell><md-table-cell>${statusChip(run)}</md-table-cell><md-table-cell>${openRun(run, "View")}</md-table-cell></md-table-row>`).join("")}</md-table-body>
        <div slot="empty" class="empty-state"><h3>No sample batches yet</h3><p>Create a test run to register a sample batch.</p>${newRunButton()}</div>
      </md-table>
      <div slot="bottom" class="table-footer"><span>${n(runs.length)} batches · ${n(metrics.totalSamples)} samples</span><span>Demonstration results</span></div>
    </md-table-container>`;
}

export function renderReviews(state) {
  const runs = filterRuns(state.runs, { status: "Review", sortBy: "dueAt" });
  const flagged = runs.reduce((sum, run) => sum + run.flaggedSamples, 0);
  return `${heading("Results & review", "A thoughtful second look.", "Review the recorded results, leave your reasoning, and decide the next step.")}
    <div class="section-intro"><span>${n(runs.length)} runs awaiting review</span><span>${n(flagged)} flagged samples in this queue</span></div>
    <section class="review-grid" aria-label="Test runs awaiting review">${
      runs
        .map(
          (run) => `<md-card variant="outlined" full-width class="review-card">
      <div class="panel-heading"><p class="eyebrow">${e(run.id)}</p>${priorityChip(run)}</div>
      <div><h2>${e(run.title)}</h2><p class="page-subtitle">${e(run.batchId)} · ${e(run.compoundId)}</p></div>
      <dl class="detail-grid"><div><dt>Samples</dt><dd>${n(run.sampleCount)}</dd></div><div><dt>Passed</dt><dd>${n(run.passedSamples)}</dd></div><div><dt>Flagged</dt><dd>${n(run.flaggedSamples)}</dd></div></dl>
      <div class="review-note">${symbol(run.flaggedSamples ? "flag" : "task_alt")}<p>${run.flaggedSamples ? "Flagged results need a review note before a decision is recorded." : "All sample results are available for review."}</p></div>
      <div class="review-owner"><div><p class="cell-meta">Prepared by</p>${analystCell(run)}</div><div><p class="cell-meta">Review due</p>${dueCell(run)}</div></div>
      <md-button variant="tonal" data-action="open-run" data-id="${e(run.id)}">Review results</md-button>
    </md-card>`,
        )
        .join("") ||
      '<div class="empty-state"><h2>You are all caught up.</h2><p>Runs appear here once their sample results are ready for review.</p><a class="text-link" href="#/runs">Explore test runs</a></div>'
    }</section>`;
}

export function renderTeam(state) {
  const metrics = getMetrics(state);
  return `${heading("People & capacity", "The people behind the progress.", "Match laboratory work with the right people and the space in their day.", '<a class="text-link" href="#/overview">Back to overview</a>')}
    <div class="section-intro"><span>${n(analysts.length)} laboratory members</span><span>${n(metrics.availableAnalysts)} available for new assignments</span></div>
    <section class="team-grid" aria-label="Laboratory analysts">${analysts
      .map((analyst) => {
        const load = analystLoad(state, analyst.id);
        const available =
          analyst.status === "Available" && load < analyst.capacity;
        const assigned = state.runs.filter(
          (run) => run.analystId === analyst.id,
        );
        return `<md-card variant="outlined" full-width class="analyst-card">
        <div class="analyst-profile"><md-avatar initials="${e(analyst.initials)}" size="large"></md-avatar><div><h2>${e(analyst.name)}</h2><p class="page-subtitle">${e(analyst.role)}</p></div></div>
        <p class="analyst-specialty">${e(analyst.specialty)} · ${e(analyst.location)}</p>
        <md-meter label="${e(`${analyst.name} active assignments`)}" value="${load}" max="${analyst.capacity}" color="${available ? "primary" : "warning"}" show-label show-value value-text="${n(load)} of ${n(analyst.capacity)} runs"></md-meter>
        <p class="capacity-note">${analyst.status === "Off shift" ? "Off shift · Available for assignment when back on shift" : available ? `${n(analyst.capacity - load)} spaces for new assignments` : "Current assignment capacity reached"}</p>
        <dl class="detail-grid"><div><dt>Completed</dt><dd>${n(assigned.filter((run) => run.status === "Completed").length)}</dd></div><div><dt>In review</dt><dd>${n(assigned.filter((run) => run.status === "Review").length)}</dd></div></dl>
        <md-button variant="text" data-action="show-analyst-runs" data-id="${e(analyst.id)}">View assigned runs</md-button>
      </md-card>`;
      })
      .join("")}</section>`;
}

/** Set object props only after upgrade; keep the same chart host across preferences. */
export async function hydrateView(root, state) {
  const chart = root.querySelector("#sample-volume-chart");
  if (!chart) return;
  await customElements.whenDefined("md-area-chart");
  if (!chart.isConnected) return;
  await chart.componentOnReady?.();
  if (!chart.isConnected) return;
  const { volume } = getChartData(state);
  chart.xAxis = { data: volume.map((day) => day.label), scale: "category" };
  chart.yAxis = { label: "Samples", min: 0 };
  chart.tableLabels = { x: "Day", series: "Registered samples" };
  chart.valueFormatter = (value) => `${n(value ?? 0)} samples`;
  chart.series = [
    {
      id: "registered-samples",
      label: "Registered samples",
      color: "primary",
      data: volume.map((day) => day.samples),
    },
  ];
  await chart.resize();
}
