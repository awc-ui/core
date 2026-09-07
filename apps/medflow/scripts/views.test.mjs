import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  getMetrics,
  updateCaseStatus,
} from "../src/model.js";
import { visibleCases } from "../src/views.js";

test("critical queue remains consistent with its counter after discharge", () => {
  let data = createInitialState();
  const critical = data.cases.find(
    (c) => c.priority === "Critical" && c.assigneeId,
  );
  data = updateCaseStatus(data, critical.id, "Ready for discharge");
  data = updateCaseStatus(data, critical.id, "Discharged");
  const cases = visibleCases({ data, queue: "critical", filters: {} });
  assert.equal(cases.length, getMetrics(data).criticalCases);
  assert.equal(
    cases.some((c) => c.id === critical.id),
    false,
  );
});
test("critical queue does not reintroduce archived cases through a status filter", () => {
  let data = createInitialState();
  const critical = data.cases.find(
    (c) => c.priority === "Critical" && c.assigneeId,
  );
  data = updateCaseStatus(data, critical.id, "Ready for discharge");
  data = updateCaseStatus(data, critical.id, "Discharged");
  assert.equal(
    visibleCases({ data, queue: "critical", filters: { status: "Discharged" } })
      .length,
    0,
  );
});
