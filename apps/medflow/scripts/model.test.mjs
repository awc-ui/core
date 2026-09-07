import test from "node:test";
import assert from "node:assert/strict";
import {
  clinicians,
  createInitialState,
  filterCases,
  getMetrics,
  clinicianLoad,
  assignCases,
  updateCaseStatus,
  addCaseNote,
  createCase,
  escapeHtml,
} from "../src/model.js";

const NOW = "2026-09-07T07:30:00.000Z";
const validCase = {
  patient: "Avery Example",
  age: "38",
  sex: "Other",
  department: "Emergency",
  summary: "Intake assessment",
  priority: "High",
  room: "ED-14",
};

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

test("initial state is deterministic, complete, and independently editable", () => {
  const first = createInitialState();
  const second = createInitialState();
  assert.deepEqual(first, second);
  assert.equal(first.cases.length, 22);
  assert.equal(new Set(first.cases.map((item) => item.id)).size, 22);
  for (const item of first.cases) {
    assert.ok(
      !item.assigneeId ||
        clinicians.some((person) => person.id === item.assigneeId),
    );
    assert.ok(Number.isFinite(Date.parse(item.admittedAt)));
    assert.ok(Number.isFinite(Date.parse(item.dueAt)));
    assert.ok(item.notes.length && item.timeline.length);
  }
  first.cases[0].notes[0].text = "Changed locally";
  assert.notEqual(second.cases[0].notes[0].text, "Changed locally");
});

test("metrics and clinician workload exclude discharged cases", () => {
  const state = createInitialState();
  const metrics = getMetrics(state);
  assert.equal(metrics.activeCases, 19);
  assert.equal(metrics.unassignedCases, 5);
  assert.equal(metrics.criticalCases, 4);
  assert.equal(metrics.readyForDischargeCases, 3);
  assert.equal(metrics.dischargedCases, 3);
  assert.equal(metrics.availableClinicians, 6);
  assert.equal(clinicianLoad(state, "cl-02"), 3);
  assert.equal(clinicianLoad(state, "cl-08"), 0);
  assert.equal(getMetrics({ cases: [] }).assignmentRate, 0);
});

test("search matches patient, MRN, room, and clinician without mutating input", () => {
  const state = deepFreeze(createInitialState());
  assert.equal(
    filterCases(state.cases, { query: "  mARGaret  " })[0].patient,
    "Margaret Lawson",
  );
  assert.equal(
    filterCases(state.cases, { query: "MRN-85042" })[0].id,
    "CASE-1042",
  );
  assert.equal(filterCases(state.cases, { query: "ED-12" })[0].id, "CASE-1036");
  assert.equal(filterCases(state.cases, { query: "Sarah Chen" }).length, 2);
  assert.equal(
    filterCases(state.cases, {
      department: "Emergency",
      priority: "High",
      assignee: "unassigned",
      status: "New",
    }).length,
    2,
  );
  assert.equal(filterCases(state.cases, { status: "active" }).length, 19);
  assert.equal(filterCases(state.cases)[0].priority, "Critical");
  assert.equal(
    filterCases(state.cases, { sortBy: "priority", sortOrder: "desc" })[0]
      .priority,
    "Routine",
  );
  const newest = filterCases(state.cases, {
    sortBy: "admittedAt",
    sortOrder: "desc",
  });
  assert.equal(newest[0].id, "CASE-1032");
});

test("bulk assignment is immutable, deduplicated, and records an audit trail", () => {
  const state = deepFreeze(createInitialState());
  const updated = assignCases(
    state,
    ["CASE-1041", "CASE-1036", "CASE-1041"],
    "cl-01",
    NOW,
  );
  assert.equal(clinicianLoad(updated, "cl-01"), 3);
  assert.equal(
    updated.cases.find((item) => item.id === "CASE-1041").assigneeId,
    "cl-01",
  );
  assert.equal(
    state.cases.find((item) => item.id === "CASE-1041").assigneeId,
    null,
  );
  assert.equal(updated.activity.length, state.activity.length + 1);
  assert.equal(updated.activity[0].at, NOW);
  assert.equal(
    updated.cases.find((item) => item.id === "CASE-1041").timeline.at(-1).title,
    "Care team assigned",
  );
  assert.equal(
    updated.cases[0],
    state.cases[0],
    "Unchanged cases preserve their references",
  );
  assert.equal(assignCases(updated, ["CASE-1041"], "cl-01", NOW), updated);
});

test("capacity check counts only newly assigned cases, and rejects atomically", () => {
  const state = deepFreeze(createInitialState());
  // Cardiology starts with 3 of 5 active slots; its discharged case is excluded.
  const updated = assignCases(
    state,
    ["CASE-1042", "CASE-1041", "CASE-1036"],
    "cl-02",
    NOW,
  );
  assert.equal(clinicianLoad(updated, "cl-02"), 5);
  assert.throws(
    () =>
      assignCases(state, ["CASE-1041", "CASE-1036", "CASE-1032"], "cl-02", NOW),
    /capacity for 2 more cases/,
  );
  assert.equal(clinicianLoad(state, "cl-02"), 3);
  assert.throws(
    () => assignCases(updated, ["CASE-1032"], "cl-02", NOW),
    /capacity for 0 more cases/,
  );
});

test("assignment rejects missing cases, discharged cases, and unavailable clinicians", () => {
  const state = deepFreeze(createInitialState());
  assert.throws(() => assignCases(state, [], "cl-01"), /Select at least one/);
  assert.throws(
    () => assignCases(state, ["missing"], "cl-01"),
    /could not be found/,
  );
  assert.throws(
    () => assignCases(state, ["CASE-1041"], "missing"),
    /valid clinician/,
  );
  assert.throws(() => assignCases(state, ["CASE-1041"], "cl-04"), /in surgery/);
  assert.throws(() => assignCases(state, ["CASE-1041"], "cl-08"), /off shift/);
  assert.throws(() => assignCases(state, ["CASE-1023"], "cl-01"), /discharged/);
  const result = assignCases(state, ["CASE-1042"], null, NOW);
  assert.equal(result.cases[0].assigneeId, null);
  assert.equal(result.cases[0].timeline.at(-1).title, "Assignment removed");
});

test("case progression requires assignment and an explicit discharge preparation step", () => {
  const state = deepFreeze(createInitialState());
  assert.throws(
    () => updateCaseStatus(state, "CASE-1041", "In progress", NOW),
    /Assign a clinician/,
  );
  assert.throws(
    () => updateCaseStatus(state, "CASE-1042", "Discharged", NOW),
    /Ready for discharge/,
  );
  assert.throws(
    () => updateCaseStatus(state, "CASE-1023", "In progress", NOW),
    /discharged/,
  );
  assert.throws(
    () => updateCaseStatus(state, "CASE-1042", "Unknown", NOW),
    /valid case status/,
  );
  const progress = updateCaseStatus(
    state,
    "CASE-1042",
    "Ready for discharge",
    NOW,
  );
  const final = updateCaseStatus(progress, "CASE-1042", "Discharged", NOW);
  assert.equal(final.cases[0].status, "Discharged");
  assert.equal(clinicianLoad(final, "cl-02"), 2);
  assert.equal(
    final.cases[0].timeline.at(-1).detail,
    "Ready for discharge → Discharged",
  );
  assert.equal(final.activity[0].title, "Discharge completed");
  assert.equal(state.cases[0].status, "Awaiting review");
});

test("notes preserve user content as data while HTML escaping prevents injection", () => {
  const state = deepFreeze(createInitialState());
  const raw = '<img src=x onerror="alert(1)"> & patient\'s update';
  const updated = addCaseNote(
    state,
    "CASE-1042",
    `  ${raw}  `,
    "<b>Coordinator</b>",
    NOW,
  );
  const note = updated.cases[0].notes.at(-1);
  assert.equal(note.text, raw);
  assert.equal(note.author, "<b>Coordinator</b>");
  assert.equal(note.at, NOW);
  assert.equal(
    escapeHtml(note.text),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; patient&#39;s update",
  );
  assert.equal(escapeHtml(note.author), "&lt;b&gt;Coordinator&lt;/b&gt;");
  assert.equal(escapeHtml(null), "");
  assert.equal(state.cases[0].notes.length + 1, updated.cases[0].notes.length);
  assert.throws(() => addCaseNote(state, "CASE-1042", "  "), /Write a note/);
  assert.throws(
    () => addCaseNote(state, "CASE-1042", "a".repeat(5001)),
    /5,000/,
  );
  assert.throws(
    () => addCaseNote(state, "CASE-1023", "Late note"),
    /discharged/,
  );
});

test("case creation validates required values and assigns fresh unique IDs", () => {
  const state = deepFreeze(createInitialState());
  for (const age of ["", "abc", null, true, -1, 121, 1.5]) {
    assert.throws(
      () => createCase(state, { ...validCase, age }, NOW),
      /whole-number age/,
    );
  }
  assert.throws(
    () => createCase(state, { ...validCase, patient: " " }, NOW),
    /full name/,
  );
  assert.throws(
    () => createCase(state, { ...validCase, summary: "" }, NOW),
    /case summary/,
  );
  assert.throws(
    () => createCase(state, { ...validCase, department: "Unknown" }, NOW),
    /valid department/,
  );
  assert.throws(
    () => createCase(state, { ...validCase, priority: "Urgent" }, NOW),
    /valid priority/,
  );
  const updated = createCase(state, { ...validCase, age: 0 }, NOW);
  assert.equal(updated.cases[0].age, 0);
  assert.equal(updated.cases[0].id, "CASE-1043");
  assert.equal(updated.cases[0].initials, "AE");
  assert.equal(updated.cases[0].status, "New");
  assert.equal(updated.cases[0].assigneeId, null);
  assert.equal(updated.cases[0].admittedAt, NOW);
  assert.equal(updated.cases.length, 23);
  assert.equal(state.cases.length, 22);
  const next = createCase(
    updated,
    { ...validCase, patient: "<script>alert(1)</script>" },
    NOW,
  );
  assert.equal(next.cases[0].id, "CASE-1044");
  assert.ok(!escapeHtml(next.cases[0].patient).includes("<script>"));
  assert.notEqual(updated.activity[0].id, next.activity[0].id);
});

test("invalid timestamps are rejected before a new state is produced", () => {
  const state = deepFreeze(createInitialState());
  assert.throws(
    () => assignCases(state, ["CASE-1041"], "cl-01", "invalid"),
    /valid event date/,
  );
  assert.throws(
    () => createCase(state, validCase, "invalid"),
    /valid event date/,
  );
});
