import test from "node:test";
import assert from "node:assert/strict";
import {
  assets,
  initialAlarms,
  selectAssets,
  selectAlarms,
  acknowledgeAlarm,
  validateSignup,
  checkChallenge,
  chartData,
  sampleValue,
  history,
  DEMO_CODE,
  RECOVERY_CODE,
  escapeHtml,
} from "../src/model.js";

test("equipment search, area filter and sort work together without changing fixture order", () => {
  const original = assets.map((a) => a.id);
  assert.deepEqual(
    selectAssets({
      area: "Intake",
      query: "pump",
      sortBy: "name",
      order: "desc",
    }).map((a) => a.id),
    ["P-102", "P-101"],
  );
  assert.equal(selectAssets({ query: "PLC-02.DP" }).at(0).id, "FLT-201");
  assert.equal(selectAssets({ area: "Storage", query: "pump" }).length, 0);
  assert.deepEqual(
    assets.map((a) => a.id),
    original,
  );
});
test("alarm acknowledgment is immutable, idempotent, and does not clear the fault", () => {
  const next = acknowledgeAlarm(
    initialAlarms,
    "ALM-1042",
    "Inspect bearing",
    "2026-09-07T14:40:00Z",
  );
  assert.equal(initialAlarms[0].acknowledged, false);
  assert.equal(next[0].acknowledged, true);
  assert.equal(next[0].severity, "Critical");
  assert.equal(next[0].note, "Inspect bearing");
  assert.equal(selectAlarms(next, "Critical", "active").length, 1);
  assert.equal(selectAlarms(next, "All", "acknowledged").length, 1);
  assert.deepEqual(acknowledgeAlarm(next, "ALM-1042", "Changed"), next);
  assert.deepEqual(acknowledgeAlarm(next, "missing"), next);
});
test("registration rejects invalid details, password mismatch and missing demo consent", () => {
  const data = {
    name: "Ada Operator",
    email: "ada@example.test",
    password: "example-pass-123",
    confirm: "example-pass-123",
    consent: "yes",
  };
  assert.equal(validateSignup(data), null);
  assert.equal(validateSignup({ ...data, name: " " }).field, "name");
  assert.equal(validateSignup({ ...data, email: "invalid" }).field, "email");
  assert.equal(
    validateSignup({ ...data, password: "short" }).field,
    "password",
  );
  assert.equal(
    validateSignup({ ...data, confirm: "different" }).field,
    "confirm",
  );
  assert.equal(
    validateSignup({ ...data, consent: undefined }).field,
    "consent",
  );
});
test("MFA requires a pending, unexpired challenge and a correct complete code", () => {
  const challenge = {
    name: "Ada",
    email: "ada@example.test",
    expiresAt: 10000,
    attempts: 0,
  };
  assert.equal(checkChallenge(null, DEMO_CODE, false, 1000).ok, false);
  assert.equal(checkChallenge(challenge, "48291", false, 1000).ok, false);
  assert.equal(checkChallenge(challenge, "000000", false, 1000).ok, false);
  assert.equal(checkChallenge(challenge, DEMO_CODE, false, 1000).ok, true);
  assert.equal(checkChallenge(challenge, RECOVERY_CODE, true, 1000).ok, true);
  assert.equal(checkChallenge(challenge, RECOVERY_CODE, false, 1000).ok, false);
  assert.equal(checkChallenge(challenge, DEMO_CODE, false, 10000).ok, false);
  assert.equal(
    checkChallenge({ ...challenge, attempts: 5 }, DEMO_CODE, false, 1000).ok,
    false,
  );
});
test("offline telemetry stays absent and standby stays zero across updates", () => {
  const offline = assets.find((a) => a.status === "Offline"),
    standby = assets.find((a) => a.status === "Standby");
  for (let tick = 0; tick < 100; tick++) {
    assert.equal(sampleValue(offline, tick), null);
    assert.equal(sampleValue(standby, tick), 0);
  }
  assert.ok(history(offline).every((v) => v === null));
  assert.ok(history(standby).every((v) => v === 0));
});
test("historian range changes duration while preserving ordered samples and measurement units", () => {
  for (const [range, hours] of [
    ["1h", 1],
    ["6h", 6],
    ["24h", 24],
  ]) {
    const { data, unit, min, max } = chartData("pressure", range);
    assert.equal(unit, "bar");
    assert.equal(data.length, 31);
    assert.equal(data.at(-1).x - data[0].x, hours * 3600000);
    assert.ok(
      data.every(
        (p, i) => p.y >= min && p.y <= max && (i === 0 || p.x > data[i - 1].x),
      ),
    );
  }
  assert.equal(chartData("power").unit, "kW");
});
test("current values match the endpoints of sparklines and historian charts, including when paused", () => {
  for (const tick of [0, 1, 12, 99]) {
    assert.equal(history(assets[0], tick).at(-1), sampleValue(assets[0], tick));
    assert.equal(
      chartData("flow", "1h", tick).data.at(-1).y,
      sampleValue(assets[0], tick),
    );
    assert.equal(
      chartData("pressure", "6h", tick).data.at(-1).y,
      sampleValue(assets[2], tick),
    );
  }
});
test("operator text is escaped before it enters HTML", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
});
