import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_NOW,
  compounds,
  analysts,
  assayTypes,
  runStatuses,
  priorities,
  createInitialState,
  getMetrics,
  getChartData,
  getRun,
  getCompound,
  getAnalyst,
  analystLoad,
  filterRuns,
  createTestRun,
  assignAnalyst,
  advanceRun,
  reviewResult,
  addRunNote,
  escapeHtml,
  toCsv,
  parseStoredState,
} from "./model.js";
const valid = {
  compoundId: "VLA-001",
  assayType: "Purity",
  sampleCount: "24",
  priority: "High",
};
function freeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach((child) => {
      if (child && typeof child === "object" && !Object.isFrozen(child))
        freeze(child);
    });
  }
  return value;
}
function consistent(state) {
  for (const run of state.runs) {
    assert.equal(
      run.passedSamples + run.flaggedSamples + run.pendingSamples,
      run.sampleCount,
      run.id,
    );
    assert.ok(
      [run.passedSamples, run.flaggedSamples, run.pendingSamples].every(
        (value) => Number.isInteger(value) && value >= 0,
      ),
    );
    assert.equal(
      run.progress,
      Math.round(
        ((run.passedSamples + run.flaggedSamples) / run.sampleCount) * 100,
      ),
    );
    assert.equal(run.status === "Completed", Boolean(run.completedAt));
  }
}

test("fictional initial state is deterministic, complete and independently editable", () => {
  const first = createInitialState(),
    second = createInitialState();
  assert.deepEqual(first, second);
  assert.equal(first.runs.length, 22);
  assert.equal(compounds.length, 8);
  assert.equal(analysts.length, 6);
  assert.equal(
    new Set(first.runs.map((run) => run.id)).size,
    first.runs.length,
  );
  for (const run of first.runs) {
    assert.ok(getCompound(run.compoundId));
    assert.ok(!run.analystId || getAnalyst(run.analystId));
    assert.ok(
      assayTypes.includes(run.assayType) &&
        runStatuses.includes(run.status) &&
        priorities.includes(run.priority),
    );
    assert.ok(
      Number.isFinite(Date.parse(run.createdAt)) &&
        Date.parse(run.dueAt) >= Date.parse(run.createdAt),
    );
    assert.equal(run.simulated, true);
  }
  consistent(first);
  first.runs[0].notes[0].text = "Local edit";
  first.runs[0].timeline[0].title = "Changed";
  assert.notDeepEqual(first, second);
  assert.notEqual(second.runs[0].notes[0].text, "Local edit");
});

test("metrics reconcile run and sample counts and exclude completed assignments", () => {
  const state = freeze(createInitialState()),
    metrics = getMetrics(state);
  assert.deepEqual(metrics.byStatus, {
    Draft: 2,
    Queued: 5,
    Running: 6,
    Review: 5,
    Completed: 4,
  });
  assert.equal(metrics.activeRuns, 18);
  assert.equal(metrics.unassignedRuns, 5);
  assert.equal(metrics.totalSamples, 444);
  assert.equal(
    metrics.passedSamples + metrics.flaggedSamples + metrics.pendingSamples,
    metrics.totalSamples,
  );
  assert.equal(metrics.passRate, 98.4);
  assert.equal(analystLoad(state, "analyst-06"), 0);
  assert.equal(metrics.availableAnalysts, 5);
  const empty = getMetrics({ runs: [] });
  assert.equal(empty.passRate, 0);
  assert.equal(empty.completionRate, 0);
});

test("search matches batch, compound, scientist and program without mutating source", () => {
  const state = freeze(createInitialState());
  assert.equal(
    filterRuns(state.runs, { query: "  bCh-2048 " })[0].id,
    "RUN-2048",
  );
  assert.equal(filterRuns(state.runs, { query: "ELENA" }).length, 3);
  assert.equal(filterRuns(state.runs, { query: "neuroscience" }).length, 3);
  assert.equal(filterRuns(state.runs, { status: "active" }).length, 18);
  assert.equal(filterRuns(state.runs, { analystId: "unassigned" }).length, 5);
  assert.deepEqual(
    filterRuns(state.runs, {
      assayType: "Impurity profile",
      priority: "Urgent",
      analystId: "unassigned",
      status: "Queued",
      compoundId: "VLA-006",
    }).map((run) => run.id),
    ["RUN-2042"],
  );
  assert.equal(filterRuns(state.runs, { query: "absent sample" }).length, 0);
});

test("sorting supports workflow, priority, numeric counts and dates", () => {
  const state = freeze(createInitialState());
  assert.equal(filterRuns(state.runs)[0].priority, "Urgent");
  assert.equal(
    filterRuns(state.runs, { sortOrder: "desc" })[0].priority,
    "Normal",
  );
  assert.equal(
    filterRuns(state.runs, { sortBy: "sampleCount", sortOrder: "desc" })[0]
      .sampleCount,
    32,
  );
  assert.equal(filterRuns(state.runs, { sortBy: "status" })[0].status, "Draft");
  assert.equal(
    filterRuns(state.runs, { sortBy: "createdAt", sortOrder: "desc" })[0].id,
    "RUN-2031",
  );
  assert.equal(
    filterRuns(state.runs, { sortBy: "compound" })[0].compoundId,
    "VLA-001",
  );
});

test("creating a test run validates inputs, generates unique IDs and records activity", () => {
  const state = freeze(createInitialState());
  const next = createTestRun(
    state,
    {
      ...valid,
      title: "  Aster screening  ",
      description: " Example note ",
      batchId: "  BATCH-NEW  ",
    },
    DEMO_NOW,
  );
  const run = next.runs[0];
  assert.equal(run.id, "RUN-2049");
  assert.equal(run.title, "Aster screening");
  assert.equal(run.batchId, "BATCH-NEW");
  assert.equal(run.status, "Draft");
  assert.equal(run.pendingSamples, 24);
  assert.equal(run.analystId, null);
  assert.equal(run.createdAt, DEMO_NOW);
  assert.equal(next.activity[0].runId, run.id);
  assert.equal(next.activity.length, state.activity.length + 1);
  assert.equal(next.runs[1], state.runs[0]);
  const again = createTestRun(next, valid, DEMO_NOW);
  assert.equal(again.runs[0].id, "RUN-2050");
  consistent(next);
});

test("creation rejects missing and invalid details atomically", () => {
  const state = freeze(createInitialState());
  for (const sampleCount of [
    "",
    " ",
    null,
    undefined,
    false,
    0,
    -1,
    1.5,
    1001,
    "many",
    Infinity,
  ]) {
    assert.throws(
      () => createTestRun(state, { ...valid, sampleCount }, DEMO_NOW),
      /sample count/,
    );
  }
  assert.throws(() => createTestRun(state, null, DEMO_NOW), /details/);
  assert.throws(
    () => createTestRun(state, { ...valid, compoundId: "missing" }, DEMO_NOW),
    /compound/,
  );
  assert.throws(
    () => createTestRun(state, { ...valid, assayType: "missing" }, DEMO_NOW),
    /assay/,
  );
  assert.throws(
    () => createTestRun(state, { ...valid, priority: "missing" }, DEMO_NOW),
    /priority/,
  );
  assert.throws(
    () => createTestRun(state, { ...valid, title: "x".repeat(121) }, DEMO_NOW),
    /120 characters/,
  );
  assert.throws(
    () => createTestRun(state, { ...valid, batchId: "x".repeat(61) }, DEMO_NOW),
    /60 characters/,
  );
  assert.throws(
    () =>
      createTestRun(
        state,
        { ...valid, description: "x".repeat(1001) },
        DEMO_NOW,
      ),
    /1000 characters/,
  );
  assert.throws(
    () => createTestRun(state, { ...valid, dueAt: "2026-01-01" }, DEMO_NOW),
    /due date/,
  );
  assert.throws(() => createTestRun(state, valid, "invalid"), /date/);
  assert.throws(
    () => createTestRun(state, { ...valid, analystId: "missing" }, DEMO_NOW),
    /analyst/,
  );
  assert.equal(state.runs.length, 22);
});

test("creation can assign an available analyst while keeping the Draft stage", () => {
  const state = freeze(createInitialState());
  const next = createTestRun(
    state,
    { ...valid, analystId: "analyst-01" },
    DEMO_NOW,
  );
  assert.equal(next.runs[0].analystId, "analyst-01");
  assert.equal(next.runs[0].status, "Draft");
  assert.equal(next.runs[0].location, "Lab A");
  assert.equal(next.activity.length, state.activity.length + 2);
});

test("assignment is immutable, reversible and recorded with unique event IDs", () => {
  const state = freeze(createInitialState());
  const next = assignAnalyst(state, "RUN-2042", "analyst-01", DEMO_NOW);
  assert.equal(getRun(next, "RUN-2042").analystId, "analyst-01");
  assert.equal(getRun(state, "RUN-2042").analystId, null);
  assert.equal(
    analystLoad(next, "analyst-01"),
    analystLoad(state, "analyst-01") + 1,
  );
  assert.equal(assignAnalyst(next, "RUN-2042", "analyst-01", DEMO_NOW), next);
  const removed = assignAnalyst(next, "RUN-2042", null, DEMO_NOW);
  assert.equal(getRun(removed, "RUN-2042").analystId, null);
  assert.equal(getRun(removed, "RUN-2042").location, "Sample intake");
  const timeline = getRun(removed, "RUN-2042").timeline;
  assert.equal(
    new Set(timeline.map((event) => event.id)).size,
    timeline.length,
  );
});

test("assignment enforces lifecycle, availability, valid IDs and capacity", () => {
  let state = freeze(createInitialState());
  assert.throws(
    () => assignAnalyst(state, "missing", "analyst-01", DEMO_NOW),
    /could not be found/,
  );
  assert.throws(
    () => assignAnalyst(state, "RUN-2042", "missing", DEMO_NOW),
    /valid analyst/,
  );
  assert.throws(
    () => assignAnalyst(state, "RUN-2042", "analyst-06", DEMO_NOW),
    /available analyst/,
  );
  assert.throws(
    () => assignAnalyst(state, "RUN-2048", "analyst-02", DEMO_NOW),
    /Draft or Queued/,
  );
  assert.throws(
    () => assignAnalyst(state, "RUN-2043", "analyst-02", DEMO_NOW),
    /Draft or Queued/,
  );
  assert.throws(
    () => assignAnalyst(state, "RUN-2030", "analyst-02", DEMO_NOW),
    /Completed/,
  );
  for (const id of ["RUN-2042", "RUN-2038", "RUN-2031"])
    state = assignAnalyst(state, id, "analyst-01", DEMO_NOW);
  assert.equal(analystLoad(state, "analyst-01"), 6);
  assert.throws(
    () => assignAnalyst(state, "RUN-2041", "analyst-01", DEMO_NOW),
    /capacity/,
  );
});

test("a run moves through each stage, preserving sample totals and final reviewer", () => {
  let state = createTestRun(freeze(createInitialState()), valid, DEMO_NOW);
  const id = state.runs[0].id;
  state = advanceRun(freeze(state), id, DEMO_NOW);
  assert.equal(getRun(state, id).status, "Queued");
  assert.throws(() => advanceRun(state, id, DEMO_NOW), /Assign an analyst/);
  state = assignAnalyst(freeze(state), id, "analyst-03", DEMO_NOW);
  state = advanceRun(freeze(state), id, DEMO_NOW);
  assert.equal(getRun(state, id).status, "Running");
  assert.equal(getRun(state, id).pendingSamples, 24);
  state = advanceRun(freeze(state), id, DEMO_NOW);
  assert.equal(getRun(state, id).status, "Review");
  assert.equal(getRun(state, id).passedSamples, 24);
  assert.equal(getRun(state, id).progress, 100);
  assert.throws(() => advanceRun(state, id, DEMO_NOW), /Review the results/);
  state = reviewResult(
    freeze(state),
    id,
    { decision: "approve", reviewer: "Quality reviewer" },
    DEMO_NOW,
  );
  assert.equal(getRun(state, id).status, "Completed");
  assert.equal(getRun(state, id).completedAt, DEMO_NOW);
  assert.equal(getRun(state, id).review.reviewer, "Quality reviewer");
  assert.throws(() => advanceRun(state, id, DEMO_NOW), /Completed/);
  consistent(state);
});

test("simulated completion preserves previously flagged samples", () => {
  const state = freeze(createInitialState());
  const next = advanceRun(state, "RUN-2044", DEMO_NOW);
  const run = getRun(next, "RUN-2044");
  assert.equal(run.status, "Review");
  assert.equal(run.flaggedSamples, 1);
  assert.equal(run.passedSamples, 23);
  assert.equal(run.pendingSamples, 0);
  consistent(next);
});

test("review needs an explicit decision and context for flagged results", () => {
  const state = freeze(createInitialState());
  assert.throws(
    () => reviewResult(state, "RUN-2047", { decision: "approve" }, DEMO_NOW),
    /review note/,
  );
  assert.throws(
    () => reviewResult(state, "RUN-2047", { decision: "skip" }, DEMO_NOW),
    /approve.*retest/,
  );
  assert.throws(
    () => reviewResult(state, "RUN-2048", { decision: "approve" }, DEMO_NOW),
    /awaiting Review/,
  );
  assert.throws(
    () => reviewResult(state, "missing", { decision: "approve" }, DEMO_NOW),
    /could not be found/,
  );
  assert.throws(
    () =>
      reviewResult(
        state,
        "RUN-2047",
        { decision: "approve", note: "Reviewed", reviewer: " " },
        DEMO_NOW,
      ),
    /reviewer name/,
  );
  assert.throws(
    () =>
      reviewResult(
        state,
        "RUN-2047",
        { decision: "approve", note: "Reviewed" },
        "2020-01-01",
      ),
    /cannot precede/,
  );
  const next = reviewResult(
    state,
    "RUN-2047",
    {
      decision: "approve",
      note: "  Flagged demonstration records reviewed.  ",
      reviewer: "Elena",
    },
    DEMO_NOW,
  );
  assert.equal(
    getRun(next, "RUN-2047").review.note,
    "Flagged demonstration records reviewed.",
  );
  assert.equal(getRun(next, "RUN-2047").flaggedSamples, 2);
  assert.equal(next.activity[0].title, "Results approved");
});

test("retest restores the queue and pending samples while retaining review history", () => {
  const state = freeze(createInitialState());
  assert.throws(
    () =>
      reviewResult(
        state,
        "RUN-2047",
        { decision: "retest", note: " " },
        DEMO_NOW,
      ),
    /review note/,
  );
  const next = reviewResult(
    state,
    "RUN-2047",
    {
      decision: "retest",
      note: "Repeat the simulated review workflow.",
      reviewer: "Elena",
    },
    DEMO_NOW,
  );
  const run = getRun(next, "RUN-2047");
  assert.equal(run.status, "Queued");
  assert.equal(run.progress, 0);
  assert.equal(run.pendingSamples, 18);
  assert.equal(run.flaggedSamples, 0);
  assert.equal(run.passedSamples, 0);
  assert.equal(run.analystId, "analyst-02");
  assert.equal(run.review.decision, "retest");
  assert.equal(run.timeline.at(-1).title, "Retest requested");
  consistent(next);
});

test("notes validate content, preserve text and record immutable activity", () => {
  const state = freeze(createInitialState());
  const next = addRunNote(
    state,
    "RUN-2048",
    "  <script>example</script>  ",
    "Maya",
    DEMO_NOW,
  );
  const run = getRun(next, "RUN-2048");
  assert.equal(run.notes.at(-1).text, "<script>example</script>");
  assert.equal(run.notes.at(-1).author, "Maya");
  assert.equal(run.timeline.at(-1).title, "Test run note added");
  assert.throws(() => addRunNote(state, "RUN-2048", " "), /Enter a note/);
  assert.throws(
    () => addRunNote(state, "RUN-2048", "x".repeat(2001)),
    /2000 characters/,
  );
  assert.throws(() => addRunNote(state, "RUN-2030", "Note"), /Completed/);
  assert.throws(
    () => addRunNote(state, "missing", "Note"),
    /could not be found/,
  );
});

test("chart buckets use UTC dates and distinguish missing turnaround data from zero", () => {
  const state = freeze(createInitialState());
  const chart = getChartData(state);
  assert.equal(chart.volume.length, 7);
  assert.equal(chart.volume[0].date, "2026-09-01");
  assert.equal(chart.volume[0].completed, 1);
  assert.equal(chart.volume[0].turnaroundHours, 32);
  assert.equal(chart.volume[1].turnaroundHours, null);
  assert.equal(chart.volume.at(-1).created, 10);
  assert.equal(
    chart.byAssay.reduce((sum, item) => sum + item.value, 0),
    18,
  );
  assert.equal(
    chart.sampleOutcomes.reduce((sum, item) => sum + item.value, 0),
    444,
  );
  assert.throws(() => getChartData(state, "invalid"), /date/);
  assert.throws(() => getChartData(state, DEMO_NOW, 0), /chart days/);
  assert.throws(() => getChartData(state, DEMO_NOW, 1.5), /chart days/);
});

test("charts and metrics reflect create, review and retest mutations", () => {
  const initial = freeze(createInitialState());
  const created = createTestRun(initial, valid, DEMO_NOW);
  assert.equal(getChartData(created).volume.at(-1).created, 11);
  assert.equal(getMetrics(created).totalSamples, 468);
  const approved = reviewResult(
    created,
    "RUN-2043",
    { decision: "approve" },
    DEMO_NOW,
  );
  assert.equal(getChartData(approved).volume.at(-1).completed, 1);
  assert.equal(getMetrics(approved).completedRuns, 5);
  const retested = reviewResult(
    approved,
    "RUN-2047",
    { decision: "retest", note: "Demonstration retest" },
    DEMO_NOW,
  );
  assert.equal(getMetrics(retested).queuedRuns, 6);
  assert.equal(getMetrics(retested).pendingSamples, 235);
  consistent(retested);
});

test("HTML escaping and CSV export handle untrusted text and spreadsheet formulas", () => {
  assert.equal(
    escapeHtml('<img title="x">&\''),
    "&lt;img title=&quot;x&quot;&gt;&amp;&#39;",
  );
  assert.equal(escapeHtml(null), "");
  const state = createInitialState();
  state.runs[0].title = '=HYPERLINK("https://example.test")';
  state.runs[0].batchId = "Batch, with\nnewline";
  const csv = toCsv(state.runs.slice(0, 1));
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.test"")"'));
  assert.ok(csv.includes('"Batch, with\nnewline"'));
  assert.ok(csv.includes("\r\n"));
  assert.ok(csv.startsWith('"Run","Title","Compound"'));
  assert.equal(toCsv([]).split("\r\n").length, 1);
});

test("storage restores independent valid snapshots, including changed workflows", () => {
  const initial = createInitialState();
  assert.deepEqual(parseStoredState(JSON.stringify(initial)), initial);
  let state = createTestRun(
    initial,
    { ...valid, analystId: "analyst-03" },
    DEMO_NOW,
  );
  const id = state.runs[0].id;
  for (let step = 0; step < 3; step++) {
    state = advanceRun(state, id, DEMO_NOW);
    assert.deepEqual(parseStoredState(JSON.stringify(state)), state);
  }
  state = reviewResult(
    state,
    id,
    { decision: "approve", reviewer: "Reviewer" },
    DEMO_NOW,
  );
  state = reviewResult(
    state,
    "RUN-2047",
    { decision: "retest", note: "Repeat demo run" },
    DEMO_NOW,
  );
  state = addRunNote(state, "RUN-2048", "A note", "Scientist", DEMO_NOW);
  const restored = parseStoredState(JSON.stringify(state));
  assert.deepEqual(restored, state);
  restored.runs[0].timeline[0].title = "Changed";
  assert.notDeepEqual(restored, state);
  assert.deepEqual(parseStoredState('{"runs":[],"activity":[]}'), {
    runs: [],
    activity: [],
  });
});

test("storage rejects malformed payloads, invalid rows and broken sample or workflow invariants", () => {
  for (const input of [
    null,
    undefined,
    1,
    "",
    "not JSON",
    "null",
    "[]",
    "{}",
    '{"runs":null,"activity":[]}',
    "x".repeat(2000001),
  ])
    assert.equal(parseStoredState(input), null);
  const corruptions = [
    (s) => {
      s.runs[0] = null;
    },
    (s) => {
      s.runs[0].id = "bad";
    },
    (s) => {
      s.runs[1].id = s.runs[0].id;
    },
    (s) => {
      s.runs[0].compoundId = "VLA-999";
    },
    (s) => {
      s.runs[0].analystId = "unknown";
    },
    (s) => {
      s.runs[0].analystId = null;
    },
    (s) => {
      s.runs[0].assayType = "unknown";
    },
    (s) => {
      s.runs[0].status = "unknown";
    },
    (s) => {
      s.runs[0].priority = "unknown";
    },
    (s) => {
      s.runs[0].sampleCount = 0;
    },
    (s) => {
      s.runs[0].sampleCount = "24";
    },
    (s) => {
      s.runs[0].passedSamples += 1;
    },
    (s) => {
      s.runs[0].passedSamples = -1;
    },
    (s) => {
      s.runs[0].pendingSamples = 1.5;
    },
    (s) => {
      s.runs[0].progress = 101;
    },
    (s) => {
      s.runs[0].progress = 1;
    },
    (s) => {
      s.runs[0].createdAt = null;
    },
    (s) => {
      s.runs[0].createdAt = "2026-02-30T10:00:00.000Z";
    },
    (s) => {
      s.runs[0].dueAt = "2020-01-01T10:00:00.000Z";
    },
    (s) => {
      s.runs[0].completedAt = DEMO_NOW;
    },
    (s) => {
      s.runs[0].status = "Review";
    },
    (s) => {
      s.runs[0].status = "Queued";
    },
    (s) => {
      s.runs[0].simulated = false;
    },
    (s) => {
      s.runs[0].notes = null;
    },
    (s) => {
      s.runs[0].notes[0].text = 123;
    },
    (s) => {
      s.runs[0].notes.push(s.runs[0].notes[0]);
    },
    (s) => {
      s.runs[0].timeline = [];
    },
    (s) => {
      s.runs[0].timeline[0].title = { bad: true };
    },
    (s) => {
      s.runs[0].review = { decision: "approve" };
    },
    (s) => {
      s.runs.find((r) => r.status === "Completed").review = null;
    },
    (s) => {
      s.activity[0].runId = "missing";
    },
    (s) => {
      s.activity[0].at = "yesterday";
    },
    (s) => {
      s.activity.push(s.activity[0]);
    },
    (s) => {
      s.activity = {};
    },
  ];
  for (const corrupt of corruptions) {
    const state = createInitialState();
    corrupt(state);
    assert.equal(
      parseStoredState(JSON.stringify(state)),
      null,
      corrupt.toString(),
    );
  }
});

test("storage strips unknown fields and rejects excessive collections", () => {
  const state = createInitialState();
  state.extra = "Discarded";
  state.runs[0].extra = "Discarded";
  state.runs[0].notes[0].extra = "Discarded";
  state.runs[0].timeline[0].extra = "Discarded";
  state.activity[0].extra = "Discarded";
  assert.deepEqual(
    parseStoredState(JSON.stringify(state)),
    createInitialState(),
  );
  assert.equal(
    parseStoredState(
      JSON.stringify({ runs: Array(501).fill(state.runs[0]), activity: [] }),
    ),
    null,
  );
  state.runs[0].notes = Array(201).fill(state.runs[0].notes[0]);
  assert.equal(parseStoredState(JSON.stringify(state)), null);
});
