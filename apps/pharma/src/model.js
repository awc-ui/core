/** Fictional laboratory testing records and immutable workflow transitions. No laboratory protocols. */
export const DEMO_NOW = "2026-09-07T10:00:00.000Z";
export const runStatuses = Object.freeze([
  "Draft",
  "Queued",
  "Running",
  "Review",
  "Completed",
]);
export const priorities = Object.freeze(["Urgent", "High", "Normal"]);
export const assayTypes = Object.freeze([
  "Identity",
  "Purity",
  "Stability",
  "Dissolution",
  "Content uniformity",
  "Impurity profile",
]);
export const analysts = Object.freeze(
  [
    {
      id: "analyst-01",
      name: "Dr. Elena Vasquez",
      initials: "EV",
      role: "Laboratory lead",
      specialty: "Analytical development",
      status: "Available",
      capacity: 6,
      location: "Lab A",
    },
    {
      id: "analyst-02",
      name: "Dr. James Okafor",
      initials: "JO",
      role: "Senior scientist",
      specialty: "Stability testing",
      status: "Available",
      capacity: 5,
      location: "Lab B",
    },
    {
      id: "analyst-03",
      name: "Maya Chen",
      initials: "MC",
      role: "Research analyst",
      specialty: "Compound characterization",
      status: "Available",
      capacity: 6,
      location: "Lab A",
    },
    {
      id: "analyst-04",
      name: "Dr. Adam Khalil",
      initials: "AK",
      role: "Senior scientist",
      specialty: "Method development",
      status: "Available",
      capacity: 5,
      location: "Lab C",
    },
    {
      id: "analyst-05",
      name: "Sofia Laurent",
      initials: "SL",
      role: "Research analyst",
      specialty: "Sample operations",
      status: "Available",
      capacity: 5,
      location: "Lab B",
    },
    {
      id: "analyst-06",
      name: "Dr. Noah Bennett",
      initials: "NB",
      role: "Results reviewer",
      specialty: "Analytical review",
      status: "Off shift",
      capacity: 4,
      location: "Lab C",
    },
  ].map(Object.freeze),
);
export const compounds = Object.freeze(
  [
    {
      id: "VLA-001",
      code: "VLA-001",
      name: "Aster",
      program: "Inflammation research",
      stage: "Characterization",
      form: "Research sample",
      ownerId: "analyst-01",
      summary:
        "Fictional candidate in the analytical characterization program.",
    },
    {
      id: "VLA-002",
      code: "VLA-002",
      name: "Lyra",
      program: "Neuroscience research",
      stage: "Stability assessment",
      form: "Research sample",
      ownerId: "analyst-02",
      summary:
        "Fictional candidate undergoing comparative stability assessment.",
    },
    {
      id: "VLA-003",
      code: "VLA-003",
      name: "Orion",
      program: "Metabolic research",
      stage: "Method development",
      form: "Research sample",
      ownerId: "analyst-03",
      summary: "Fictional candidate supporting analytical method evaluation.",
    },
    {
      id: "VLA-004",
      code: "VLA-004",
      name: "Nova",
      program: "Cardiovascular research",
      stage: "Characterization",
      form: "Research sample",
      ownerId: "analyst-04",
      summary:
        "Fictional candidate with identity and purity records for review.",
    },
    {
      id: "VLA-005",
      code: "VLA-005",
      name: "Solara",
      program: "Immunology research",
      stage: "Stability assessment",
      form: "Research sample",
      ownerId: "analyst-02",
      summary:
        "Fictional candidate with sample batches across the testing queue.",
    },
    {
      id: "VLA-006",
      code: "VLA-006",
      name: "Atlas",
      program: "Respiratory research",
      stage: "Method development",
      form: "Research sample",
      ownerId: "analyst-04",
      summary:
        "Fictional candidate used to demonstrate method comparison workflows.",
    },
    {
      id: "VLA-007",
      code: "VLA-007",
      name: "Elara",
      program: "Dermatology research",
      stage: "Characterization",
      form: "Research sample",
      ownerId: "analyst-05",
      summary:
        "Fictional candidate with characterization results awaiting review.",
    },
    {
      id: "VLA-008",
      code: "VLA-008",
      name: "Vega",
      program: "Rare disease research",
      stage: "Sample intake",
      form: "Research sample",
      ownerId: "analyst-03",
      summary:
        "Fictional candidate recently registered for initial analytical testing.",
    },
  ].map(Object.freeze),
);
// Number, compound, assay, status, priority, analyst, samples, assessed, flagged, created, due.
const seedRuns = [
  [
    2048,
    1,
    "Purity",
    "Running",
    "High",
    1,
    24,
    18,
    0,
    "09-07T06:10",
    "09-07T15:00",
  ],
  [
    2047,
    2,
    "Stability",
    "Review",
    "Urgent",
    2,
    18,
    18,
    2,
    "09-05T09:30",
    "09-07T11:00",
  ],
  [
    2046,
    3,
    "Identity",
    "Queued",
    "High",
    3,
    32,
    0,
    0,
    "09-07T07:20",
    "09-07T16:00",
  ],
  [
    2045,
    4,
    "Dissolution",
    "Running",
    "Normal",
    4,
    20,
    12,
    0,
    "09-06T12:40",
    "09-07T17:00",
  ],
  [
    2044,
    5,
    "Stability",
    "Running",
    "High",
    2,
    24,
    14,
    1,
    "09-05T11:00",
    "09-08T12:00",
  ],
  [
    2043,
    7,
    "Content uniformity",
    "Review",
    "High",
    5,
    16,
    16,
    0,
    "09-06T08:30",
    "09-07T12:00",
  ],
  [
    2042,
    6,
    "Impurity profile",
    "Queued",
    "Urgent",
    null,
    24,
    0,
    0,
    "09-07T08:15",
    "09-07T14:00",
  ],
  [
    2041,
    8,
    "Identity",
    "Draft",
    "Normal",
    null,
    12,
    0,
    0,
    "09-07T08:40",
    "09-09T16:00",
  ],
  [
    2040,
    1,
    "Identity",
    "Review",
    "Normal",
    3,
    24,
    24,
    0,
    "09-06T07:10",
    "09-07T14:00",
  ],
  [
    2039,
    3,
    "Dissolution",
    "Running",
    "High",
    4,
    28,
    21,
    0,
    "09-06T09:20",
    "09-08T10:00",
  ],
  [
    2038,
    4,
    "Purity",
    "Queued",
    "Normal",
    null,
    18,
    0,
    0,
    "09-07T08:00",
    "09-08T15:00",
  ],
  [
    2037,
    5,
    "Content uniformity",
    "Review",
    "High",
    1,
    20,
    20,
    1,
    "09-05T13:00",
    "09-07T13:00",
  ],
  [
    2036,
    2,
    "Impurity profile",
    "Running",
    "Normal",
    5,
    16,
    6,
    0,
    "09-07T06:45",
    "09-08T16:00",
  ],
  [
    2035,
    6,
    "Identity",
    "Queued",
    "High",
    3,
    24,
    0,
    0,
    "09-07T07:30",
    "09-08T11:00",
  ],
  [
    2034,
    7,
    "Purity",
    "Review",
    "Normal",
    1,
    16,
    16,
    0,
    "09-06T10:20",
    "09-07T15:00",
  ],
  [
    2033,
    8,
    "Stability",
    "Draft",
    "Normal",
    null,
    12,
    0,
    0,
    "09-07T09:10",
    "09-10T16:00",
  ],
  [
    2032,
    1,
    "Dissolution",
    "Running",
    "Normal",
    4,
    20,
    8,
    0,
    "09-07T07:00",
    "09-08T13:00",
  ],
  [
    2031,
    3,
    "Purity",
    "Queued",
    "Normal",
    null,
    18,
    0,
    0,
    "09-07T09:25",
    "09-09T12:00",
  ],
  [
    2030,
    4,
    "Identity",
    "Completed",
    "Normal",
    6,
    24,
    24,
    0,
    "08-31T08:00",
    "09-01T16:00",
  ],
  [
    2029,
    2,
    "Content uniformity",
    "Completed",
    "High",
    2,
    18,
    18,
    0,
    "09-02T07:00",
    "09-03T15:00",
  ],
  [
    2028,
    6,
    "Purity",
    "Completed",
    "Normal",
    4,
    20,
    20,
    0,
    "09-04T09:00",
    "09-05T14:00",
  ],
  [
    2027,
    7,
    "Identity",
    "Completed",
    "Normal",
    5,
    16,
    16,
    0,
    "09-05T08:30",
    "09-06T13:00",
  ],
];
function seedDate(value) {
  return `2026-${value}:00.000Z`;
}
export function getCompound(id) {
  return compounds.find((item) => item.id === id);
}
export function getAnalyst(id) {
  return analysts.find((item) => item.id === id);
}
export function getRun(state, id) {
  return state.runs.find((item) => item.id === id);
}
export function createInitialState() {
  const runs = seedRuns.map(
    ([
      number,
      candidate,
      assayType,
      status,
      priority,
      person,
      sampleCount,
      assessed,
      flaggedSamples,
      created,
      due,
    ]) => {
      const compoundId = `VLA-${String(candidate).padStart(3, "0")}`;
      const id = `RUN-${number}`;
      const createdAt = seedDate(created);
      const dueAt = seedDate(due);
      const analystId = person
        ? `analyst-${String(person).padStart(2, "0")}`
        : null;
      const timeline = [
        {
          id: `event-${id}-1`,
          title: "Test run created",
          detail: `${getCompound(compoundId).name} · ${assayType}`,
          at: createdAt,
        },
      ];
      if (analystId)
        timeline.push({
          id: `event-${id}-2`,
          title: "Analyst assigned",
          detail: getAnalyst(analystId).name,
          at: createdAt,
        });
      if (status !== "Draft")
        timeline.push({
          id: `event-${id}-3`,
          title: `Status: ${status}`,
          detail: "Simulated laboratory workflow record.",
          at: status === "Completed" ? dueAt : createdAt,
        });
      return {
        id,
        title: `${getCompound(compoundId).name} · ${assayType.toLowerCase()}`,
        compoundId,
        assayType,
        batchId: `BCH-${number}`,
        sampleCount,
        status,
        priority,
        analystId,
        progress: Math.round((assessed / sampleCount) * 100),
        passedSamples: assessed - flaggedSamples,
        flaggedSamples,
        pendingSamples: sampleCount - assessed,
        createdAt,
        dueAt,
        completedAt: status === "Completed" ? dueAt : null,
        location: person ? getAnalyst(analystId).location : "Sample intake",
        description:
          "Simulated analytical testing record for this research sample batch.",
        simulated: true,
        review:
          status === "Completed"
            ? {
                decision: "approve",
                note: "Simulated results reviewed and recorded.",
                reviewer: "Dr. Elena Vasquez",
                at: dueAt,
              }
            : null,
        notes: [
          {
            id: `note-${id}-1`,
            author: "Sample operations",
            text: "Sample batch registered. Counts and results shown here are demonstration data.",
            at: createdAt,
          },
        ],
        timeline,
      };
    },
  );
  return {
    runs,
    activity: [
      {
        id: "activity-initial-1",
        title: "Test run queued",
        detail: "Orion · Purity · RUN-2031",
        runId: "RUN-2031",
        at: "2026-09-07T09:25:00.000Z",
      },
      {
        id: "activity-initial-2",
        title: "Draft created",
        detail: "Vega · Stability · RUN-2033",
        runId: "RUN-2033",
        at: "2026-09-07T09:10:00.000Z",
      },
      {
        id: "activity-initial-3",
        title: "Results ready for review",
        detail: "Lyra · Stability · 2 samples flagged",
        runId: "RUN-2047",
        at: "2026-09-07T08:50:00.000Z",
      },
      {
        id: "activity-initial-4",
        title: "Assignment needed",
        detail: "Atlas · Impurity profile · RUN-2042",
        runId: "RUN-2042",
        at: "2026-09-07T08:15:00.000Z",
      },
      {
        id: "activity-initial-5",
        title: "Test run started",
        detail: "Aster · Purity · RUN-2048",
        runId: "RUN-2048",
        at: "2026-09-07T07:45:00.000Z",
      },
    ],
  };
}
export function analystLoad(state, id) {
  return state.runs.filter(
    (run) => run.analystId === id && run.status !== "Completed",
  ).length;
}
export function getMetrics(state) {
  const { runs } = state;
  const count = (status) => runs.filter((run) => run.status === status).length;
  const active = runs.filter((run) => run.status !== "Completed");
  const totalSamples = runs.reduce((sum, run) => sum + run.sampleCount, 0);
  const passedSamples = runs.reduce((sum, run) => sum + run.passedSamples, 0);
  const flaggedSamples = runs.reduce((sum, run) => sum + run.flaggedSamples, 0);
  const pendingSamples = runs.reduce((sum, run) => sum + run.pendingSamples, 0);
  const assessed = passedSamples + flaggedSamples;
  return {
    totalRuns: runs.length,
    activeRuns: active.length,
    draftRuns: count("Draft"),
    queuedRuns: count("Queued"),
    runningRuns: count("Running"),
    reviewRuns: count("Review"),
    completedRuns: count("Completed"),
    unassignedRuns: active.filter((run) => !run.analystId).length,
    urgentRuns: active.filter((run) => run.priority === "Urgent").length,
    totalCompounds: new Set(runs.map((run) => run.compoundId)).size,
    totalSamples,
    passedSamples,
    flaggedSamples,
    pendingSamples,
    passRate: assessed ? Math.round((passedSamples / assessed) * 1000) / 10 : 0,
    completionRate: totalSamples
      ? Math.round((assessed / totalSamples) * 100)
      : 0,
    availableAnalysts: analysts.filter(
      (analyst) =>
        analyst.status === "Available" &&
        analystLoad(state, analyst.id) < analyst.capacity,
    ).length,
    byStatus: Object.fromEntries(
      runStatuses.map((status) => [status, count(status)]),
    ),
    byAssay: Object.fromEntries(
      assayTypes.map((assay) => [
        assay,
        active.filter((run) => run.assayType === assay).length,
      ]),
    ),
  };
}
export function filterRuns(
  runs,
  {
    query = "",
    status = "all",
    assayType = "all",
    compoundId = "all",
    analystId = "all",
    priority = "all",
    sortBy = "priority",
    sortOrder = "asc",
  } = {},
) {
  const needle = String(query).trim().toLocaleLowerCase();
  const filtered = runs.filter((run) => {
    const compound = getCompound(run.compoundId);
    const text = [
      run.id,
      run.title,
      run.batchId,
      run.compoundId,
      compound?.name,
      compound?.program,
      run.assayType,
      getAnalyst(run.analystId)?.name || "Unassigned",
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (!needle || text.includes(needle)) &&
      (status === "all" ||
        (status === "active"
          ? run.status !== "Completed"
          : run.status === status)) &&
      (assayType === "all" || run.assayType === assayType) &&
      (compoundId === "all" || run.compoundId === compoundId) &&
      (analystId === "all" ||
        (analystId === "unassigned"
          ? !run.analystId
          : run.analystId === analystId)) &&
      (priority === "all" || run.priority === priority)
    );
  });
  const rank = (run) => {
    if (sortBy === "priority") return priorities.indexOf(run.priority);
    if (sortBy === "status") return runStatuses.indexOf(run.status);
    if (
      [
        "progress",
        "sampleCount",
        "passedSamples",
        "flaggedSamples",
        "pendingSamples",
      ].includes(sortBy)
    )
      return run[sortBy];
    if (["dueAt", "createdAt"].includes(sortBy)) return Date.parse(run[sortBy]);
    if (sortBy === "compound") return getCompound(run.compoundId)?.name || "";
    if (sortBy === "analyst") return getAnalyst(run.analystId)?.name || "";
    return String(run[sortBy] ?? run.id).toLocaleLowerCase();
  };
  const direction = sortOrder === "desc" ? -1 : 1;
  return filtered.sort((a, b) => {
    const first = rank(a),
      second = rank(b);
    return (
      (typeof first === "number"
        ? first - second
        : first.localeCompare(second)) * direction
    );
  });
}
/** Derived chart values include newly created and completed runs. */
export function getChartData(state, end = DEMO_NOW, days = 7) {
  if (!Number.isInteger(days) || days < 1 || days > 366)
    throw new Error("Choose between 1 and 366 chart days.");
  const last = new Date(timestamp(end));
  last.setUTCHours(0, 0, 0, 0);
  const volume = Array.from({ length: days }, (_, index) => {
    const start = last.getTime() - (days - index - 1) * 86400000;
    const dayRuns = state.runs.filter(
      (run) =>
        Date.parse(run.createdAt) >= start &&
        Date.parse(run.createdAt) < start + 86400000,
    );
    const completed = state.runs.filter(
      (run) =>
        run.completedAt &&
        Date.parse(run.completedAt) >= start &&
        Date.parse(run.completedAt) < start + 86400000,
    );
    const hours = completed.map(
      (run) =>
        (Date.parse(run.completedAt) - Date.parse(run.createdAt)) / 3600000,
    );
    return {
      date: new Date(start).toISOString().slice(0, 10),
      label: new Date(start).toLocaleDateString("en", {
        weekday: "short",
        timeZone: "UTC",
      }),
      created: dayRuns.length,
      completed: completed.length,
      samples: dayRuns.reduce((sum, run) => sum + run.sampleCount, 0),
      turnaroundHours: hours.length
        ? Math.round(
            (hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10,
          ) / 10
        : null,
    };
  });
  return {
    volume,
    byAssay: assayTypes.map((label) => ({
      label,
      value: state.runs.filter(
        (run) => run.assayType === label && run.status !== "Completed",
      ).length,
    })),
    byStatus: runStatuses.map((label) => ({
      label,
      value: state.runs.filter((run) => run.status === label).length,
    })),
    sampleOutcomes: [
      {
        label: "Passed",
        value: state.runs.reduce((sum, run) => sum + run.passedSamples, 0),
      },
      {
        label: "Flagged",
        value: state.runs.reduce((sum, run) => sum + run.flaggedSamples, 0),
      },
      {
        label: "Pending",
        value: state.runs.reduce((sum, run) => sum + run.pendingSamples, 0),
      },
    ],
  };
}
function timestamp(now) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime()))
    throw new Error("A valid event date is required.");
  return date.toISOString();
}
function requireRun(state, id) {
  const run = getRun(state, id);
  if (!run)
    throw new Error(
      "This test run could not be found. Refresh the list and try again.",
    );
  return run;
}
function requireOpen(run) {
  if (run.status === "Completed")
    throw new Error("Completed test runs cannot be changed.");
}
function nextId(prefix, records) {
  let index = records.length + 1;
  while (records.some((item) => item.id === `${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}
function recordChange(state, run, changes, title, detail, at) {
  const updated = {
    ...run,
    ...changes,
    timeline: [
      ...run.timeline,
      { id: nextId(`event-${run.id}`, run.timeline), title, detail, at },
    ],
  };
  return {
    ...state,
    runs: state.runs.map((item) => (item.id === run.id ? updated : item)),
    activity: [
      {
        id: nextId("activity", state.activity),
        title,
        detail: `${run.id} · ${detail}`,
        runId: run.id,
        at,
      },
      ...state.activity,
    ],
  };
}
function textField(value, label, max, required = true) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result && required) throw new Error(`Enter ${label}.`);
  if (result.length > max)
    throw new Error(`Keep ${label} within ${max} characters.`);
  return result;
}
export function createTestRun(state, fields, now = Date.now()) {
  if (!fields || typeof fields !== "object")
    throw new Error("Enter the test run details.");
  const compound = getCompound(fields.compoundId);
  if (!compound) throw new Error("Choose a valid compound candidate.");
  if (!assayTypes.includes(fields.assayType))
    throw new Error("Choose a valid assay type.");
  const priority = fields.priority ?? "Normal";
  if (!priorities.includes(priority))
    throw new Error("Choose a valid priority.");
  const sampleCount =
    typeof fields.sampleCount === "number" ||
    (typeof fields.sampleCount === "string" && fields.sampleCount.trim())
      ? Number(fields.sampleCount)
      : NaN;
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 1000)
    throw new Error("Enter a whole-number sample count from 1 to 1,000.");
  const at = timestamp(now);
  const dueAt = fields.dueAt
    ? timestamp(fields.dueAt)
    : new Date(Date.parse(at) + 2 * 86400000).toISOString();
  if (Date.parse(dueAt) < Date.parse(at))
    throw new Error("Choose a due date on or after the creation date.");
  const number =
    Math.max(
      2000,
      ...state.runs
        .map((run) => Number(run.id.replace(/^RUN-/, "")))
        .filter(Number.isFinite),
    ) + 1;
  const id = `RUN-${number}`;
  const batchId =
    textField(fields.batchId, "a batch reference", 60, false) ||
    `BCH-${number}`;
  const title =
    textField(fields.title, "a test run title", 120, false) ||
    `${compound.name} · ${fields.assayType.toLowerCase()}`;
  const description = textField(
    fields.description,
    "the description",
    1000,
    false,
  );
  const run = {
    id,
    title,
    compoundId: compound.id,
    assayType: fields.assayType,
    batchId,
    sampleCount,
    status: "Draft",
    priority,
    analystId: null,
    progress: 0,
    passedSamples: 0,
    flaggedSamples: 0,
    pendingSamples: sampleCount,
    createdAt: at,
    dueAt,
    completedAt: null,
    location: "Sample intake",
    description,
    simulated: true,
    review: null,
    notes: [],
    timeline: [
      {
        id: `event-${id}-1`,
        title: "Test run created",
        detail: `${compound.name} · ${fields.assayType}`,
        at,
      },
    ],
  };
  let next = {
    ...state,
    runs: [run, ...state.runs],
    activity: [
      {
        id: nextId("activity", state.activity),
        title: "Test run created",
        detail: `${id} · ${compound.name} · ${fields.assayType}`,
        runId: id,
        at,
      },
      ...state.activity,
    ],
  };
  if (fields.analystId) next = assignAnalyst(next, id, fields.analystId, at);
  return next;
}
export function assignAnalyst(state, runId, analystId, now = Date.now()) {
  const run = requireRun(state, runId);
  requireOpen(run);
  if (!["Draft", "Queued"].includes(run.status))
    throw new Error(
      "Analyst assignments can be changed while a test run is Draft or Queued.",
    );
  const analyst = analystId === null ? null : getAnalyst(analystId);
  if (analystId !== null && !analyst)
    throw new Error("Choose a valid analyst.");
  if (run.analystId === analystId) return state;
  if (analyst && analyst.status !== "Available")
    throw new Error("Choose an available analyst.");
  if (analyst && analystLoad(state, analystId) >= analyst.capacity)
    throw new Error(
      `${analyst.name} has no remaining capacity. Choose another analyst.`,
    );
  return recordChange(
    state,
    run,
    { analystId, location: analyst?.location || "Sample intake" },
    analyst ? "Analyst assigned" : "Assignment removed",
    analyst?.name || "Returned to the assignment queue.",
    timestamp(now),
  );
}
/** Advance one stage. Review approval is a separate action. Results remain simulated. */
export function advanceRun(state, runId, now = Date.now()) {
  const run = requireRun(state, runId);
  requireOpen(run);
  if (run.status === "Review")
    throw new Error("Review the results before completing this test run.");
  const status = { Draft: "Queued", Queued: "Running", Running: "Review" }[
    run.status
  ];
  if (!status) throw new Error("This test run has an invalid workflow status.");
  if (status === "Running") {
    const analyst = getAnalyst(run.analystId);
    if (!analyst)
      throw new Error("Assign an analyst before starting this test run.");
    if (analyst.status !== "Available")
      throw new Error(
        "The assigned analyst is unavailable. Assign an available analyst before starting.",
      );
  }
  const changes = { status };
  if (status === "Running") changes.progress = 0;
  if (status === "Review")
    Object.assign(changes, {
      flaggedSamples: run.flaggedSamples,
      passedSamples: run.sampleCount - run.flaggedSamples,
      pendingSamples: 0,
      progress: 100,
    });
  return recordChange(
    state,
    run,
    changes,
    status === "Review"
      ? "Results ready for review"
      : status === "Running"
        ? "Test run started"
        : "Test run queued",
    `${run.status} → ${status}`,
    timestamp(now),
  );
}
export function reviewResult(state, runId, fields, now = Date.now()) {
  const run = requireRun(state, runId);
  if (run.status !== "Review")
    throw new Error("Only test runs awaiting Review can be reviewed.");
  if (!fields || !["approve", "retest"].includes(fields.decision))
    throw new Error("Choose to approve the results or request a retest.");
  const note = textField(
    fields.note,
    "a review note",
    2000,
    fields.decision === "retest" || run.flaggedSamples > 0,
  );
  const reviewer = textField(
    fields.reviewer || "Laboratory reviewer",
    "a reviewer name",
    120,
  );
  const at = timestamp(now);
  if (Date.parse(at) < Date.parse(run.createdAt))
    throw new Error(
      "The review date cannot precede the test run creation date.",
    );
  const review = { decision: fields.decision, note, reviewer, at };
  const changes =
    fields.decision === "approve"
      ? { status: "Completed", completedAt: at, review }
      : {
          status: "Queued",
          completedAt: null,
          review,
          progress: 0,
          passedSamples: 0,
          flaggedSamples: 0,
          pendingSamples: run.sampleCount,
        };
  return recordChange(
    state,
    run,
    changes,
    fields.decision === "approve" ? "Results approved" : "Retest requested",
    `${reviewer}${note ? ` · ${note}` : ""}`,
    at,
  );
}
export function addRunNote(
  state,
  runId,
  content,
  author = "Laboratory coordinator",
  now = Date.now(),
) {
  const run = requireRun(state, runId);
  requireOpen(run);
  const text = textField(content, "a note", 2000);
  const by = textField(author, "an author name", 120);
  const at = timestamp(now);
  return recordChange(
    state,
    run,
    {
      notes: [
        ...run.notes,
        { id: nextId(`note-${run.id}`, run.notes), text, author: by, at },
      ],
    },
    "Test run note added",
    `Added by ${by}`,
    at,
  );
}
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}
/** Quoted CSV; formula-like user fields are prefixed for spreadsheet safety. */
export function toCsv(runs) {
  const cell = (value) => {
    const text = String(value ?? "");
    return `"${(/^[\s]*[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const rows = [
    [
      "Run",
      "Title",
      "Compound",
      "Assay",
      "Batch",
      "Status",
      "Priority",
      "Analyst",
      "Samples",
      "Passed",
      "Flagged",
      "Pending",
      "Due date",
    ],
    ...runs.map((run) => [
      run.id,
      run.title,
      run.compoundId,
      run.assayType,
      run.batchId,
      run.status,
      run.priority,
      getAnalyst(run.analystId)?.name || "Unassigned",
      run.sampleCount,
      run.passedSamples,
      run.flaggedSamples,
      run.pendingSamples,
      run.dueAt,
    ]),
  ];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

/**
 * Restore only a structurally valid, bounded showcase snapshot. Unknown fields are
 * discarded. This guards rendering against stale or edited browser storage; it is
 * not a server authorization or data-integrity boundary.
 */
export function parseStoredState(serialized) {
  if (typeof serialized !== "string" || serialized.length > 2000000)
    return null;
  const plain = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const text = (value, max, empty = false) =>
    typeof value === "string" &&
    (empty || value.trim().length > 0) &&
    value.length <= max;
  const date = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() ===
      (value.includes(".") ? value : value.replace("Z", ".000Z"));
  const integer = (value, max) =>
    Number.isInteger(value) && value >= 0 && value <= max;
  const unique = (values) =>
    new Set(values.map((value) => value.id)).size === values.length;
  const event = (value) =>
    plain(value) &&
    text(value.id, 100) &&
    text(value.title, 160) &&
    text(value.detail, 2500, true) &&
    date(value.at);
  const note = (value) =>
    plain(value) &&
    text(value.id, 100) &&
    text(value.text, 2000) &&
    text(value.author, 120) &&
    date(value.at);
  const review = (value) =>
    plain(value) &&
    ["approve", "retest"].includes(value.decision) &&
    text(value.note, 2000, true) &&
    text(value.reviewer, 120) &&
    date(value.at);
  try {
    const state = JSON.parse(serialized);
    if (
      !plain(state) ||
      !Array.isArray(state.runs) ||
      state.runs.length > 500 ||
      !Array.isArray(state.activity) ||
      state.activity.length > 2000
    )
      return null;
    for (const run of state.runs) {
      if (
        !plain(run) ||
        !/^RUN-\d{4,12}$/.test(run.id) ||
        !text(run.title, 120) ||
        !getCompound(run.compoundId) ||
        !assayTypes.includes(run.assayType) ||
        !text(run.batchId, 60) ||
        !runStatuses.includes(run.status) ||
        !priorities.includes(run.priority)
      )
        return null;
      if (
        !integer(run.sampleCount, 1000) ||
        run.sampleCount === 0 ||
        !integer(run.passedSamples, 1000) ||
        !integer(run.flaggedSamples, 1000) ||
        !integer(run.pendingSamples, 1000) ||
        run.passedSamples + run.flaggedSamples + run.pendingSamples !==
          run.sampleCount
      )
        return null;
      if (
        !integer(run.progress, 100) ||
        run.progress !==
          Math.round(
            ((run.passedSamples + run.flaggedSamples) / run.sampleCount) * 100,
          )
      )
        return null;
      if (run.analystId !== null && !getAnalyst(run.analystId)) return null;
      if (
        ["Running", "Review", "Completed"].includes(run.status) &&
        !run.analystId
      )
        return null;
      if (
        ["Draft", "Queued"].includes(run.status) &&
        run.pendingSamples !== run.sampleCount
      )
        return null;
      if (
        ["Review", "Completed"].includes(run.status) &&
        run.pendingSamples !== 0
      )
        return null;
      if (
        !date(run.createdAt) ||
        !date(run.dueAt) ||
        Date.parse(run.dueAt) < Date.parse(run.createdAt) ||
        !text(run.location, 80) ||
        !text(run.description, 1000, true) ||
        run.simulated !== true
      )
        return null;
      if (run.review !== null && !review(run.review)) return null;
      if (run.status === "Completed") {
        if (
          !date(run.completedAt) ||
          Date.parse(run.completedAt) < Date.parse(run.createdAt) ||
          run.review?.decision !== "approve"
        )
          return null;
      } else if (run.completedAt !== null) return null;
      if (
        !Array.isArray(run.notes) ||
        run.notes.length > 200 ||
        !run.notes.every(note) ||
        !unique(run.notes)
      )
        return null;
      if (
        !Array.isArray(run.timeline) ||
        run.timeline.length === 0 ||
        run.timeline.length > 500 ||
        !run.timeline.every(event) ||
        !unique(run.timeline)
      )
        return null;
    }
    if (!unique(state.runs)) return null;
    const runIds = new Set(state.runs.map((run) => run.id));
    if (
      !state.activity.every((item) => event(item) && runIds.has(item.runId)) ||
      !unique(state.activity)
    )
      return null;
    const cleanEvent = ({ id, title, detail, at }) => ({
      id,
      title,
      detail,
      at,
    });
    return {
      runs: state.runs.map((run) => {
        const {
          id,
          title,
          compoundId,
          assayType,
          batchId,
          sampleCount,
          status,
          priority,
          analystId,
          progress,
          passedSamples,
          flaggedSamples,
          pendingSamples,
          createdAt,
          dueAt,
          completedAt,
          location,
          description,
          simulated,
        } = run;
        return {
          id,
          title,
          compoundId,
          assayType,
          batchId,
          sampleCount,
          status,
          priority,
          analystId,
          progress,
          passedSamples,
          flaggedSamples,
          pendingSamples,
          createdAt,
          dueAt,
          completedAt,
          location,
          description,
          simulated,
          review: run.review
            ? {
                decision: run.review.decision,
                note: run.review.note,
                reviewer: run.review.reviewer,
                at: run.review.at,
              }
            : null,
          notes: run.notes.map(({ id: noteId, text: content, author, at }) => ({
            id: noteId,
            text: content,
            author,
            at,
          })),
          timeline: run.timeline.map(cleanEvent),
        };
      }),
      activity: state.activity.map((item) => ({
        ...cleanEvent(item),
        runId: item.runId,
      })),
    };
  } catch {
    return null;
  }
}
