import test from "node:test";
import assert from "node:assert/strict";
import {
  stations,
  incidentFixture,
  selectStations,
  getSummary,
  updateIncident,
  simulateSnapshot,
  toCSV,
} from "./model.mjs";
import {
  DemoAuth,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CODE,
  DEMO_RECOVERY,
} from "./auth.mjs";
test("station filters intersect; search trims and ignores case", () => {
  assert.deepEqual(
    selectStations(stations, {
      query: "  CENTRAL ",
      line: "M2",
      status: "busy",
    }).map((s) => s.id),
    ["ST03"],
  );
  assert.equal(
    selectStations(stations, { query: "central", line: "M3" }).length,
    0,
  );
});
test("sort is numeric, does not mutate source, and unknown search is empty", () => {
  const before = stations.map((s) => s.id);
  const sorted = selectStations(stations, { sort: "occupancy", order: "desc" });
  assert.equal(sorted[0].id, "ST03");
  assert.deepEqual(
    stations.map((s) => s.id),
    before,
  );
  assert.equal(selectStations(stations, { query: "nonexistent" }).length, 0);
});
test("scoped summary and incident transitions agree", () => {
  const scoped = stations.filter((s) => s.lines.includes("M2"));
  assert.equal(getSummary(scoped, incidentFixture).incidents, 1);
  const ack = updateIncident(incidentFixture, "INC-1042", "acknowledged");
  assert.equal(getSummary(scoped, ack).incidents, 1);
  const resolved = updateIncident(ack, "INC-1042", "resolved");
  assert.equal(getSummary(scoped, resolved).incidents, 0);
  assert.deepEqual(
    updateIncident(resolved, "INC-1042", "acknowledged"),
    resolved,
  );
  assert.equal(incidentFixture[0].state, "open");
  assert.throws(() => updateIncident(incidentFixture, "INC-1042", "invalid"));
});
test("simulation stays bounded and leaves fixtures unchanged", () => {
  for (let tick = 0; tick < 100; tick++)
    for (const s of simulateSnapshot(stations, tick)) {
      assert(s.occupancy >= 0 && s.occupancy <= 100);
      assert(s.passengers >= 0);
    }
  assert.equal(stations[2].occupancy, 91);
});
test("CSV quotes station names and exports selected records only", () => {
  const csv = toCSV([{ ...stations[0], name: 'West, "Gate"' }]);
  assert(csv.includes('"West, ""Gate"""'));
  assert.equal(csv.split("\r\n").length, 2);
  assert(!csv.includes("Central exchange"));
});
test("demo login requires correct password followed by valid MFA", async () => {
  const auth = new DemoAuth();
  await assert.rejects(auth.signin(DEMO_EMAIL, "wrong"));
  assert.throws(() => auth.verify(DEMO_CODE));
  const c = await auth.signin(DEMO_EMAIL.toUpperCase(), DEMO_PASSWORD);
  assert.equal(c.user.email, DEMO_EMAIL);
  assert.throws(() => auth.verify("246"));
  assert.throws(() => auth.verify("000000"));
  assert.equal(auth.verify(DEMO_CODE).name, "Alex Morgan");
  assert.throws(() => auth.verify(DEMO_CODE));
});
test("MFA expires and cancellation invalidates a challenge", async () => {
  let now = 1000;
  const auth = new DemoAuth(() => now);
  await auth.signin(DEMO_EMAIL, DEMO_PASSWORD);
  now += 300001;
  assert.throws(() => auth.verify(DEMO_CODE), /expired/);
  await auth.signin(DEMO_EMAIL, DEMO_PASSWORD);
  auth.cancel();
  assert.throws(() => auth.verify(DEMO_CODE), /Sign in again/);
});
test("retry limit cannot be bypassed by refreshing code", async () => {
  let now = 1000;
  const auth = new DemoAuth(() => now);
  await auth.signin(DEMO_EMAIL, DEMO_PASSWORD);
  for (let i = 0; i < 5; i++) assert.throws(() => auth.verify("000000"));
  assert.throws(() => auth.verify(DEMO_CODE), /Too many/);
  assert.throws(() => auth.resend(), /Wait/);
  now += 30001;
  assert.equal(auth.verify(DEMO_CODE).email, DEMO_EMAIL);
});
test("recovery code is single-use across sign-ins", async () => {
  assert.equal(DEMO_RECOVERY.length, 8);
  const auth = new DemoAuth();
  await auth.signin(DEMO_EMAIL, DEMO_PASSWORD);
  assert.equal(auth.verify("METR-2026", true).email, DEMO_EMAIL);
  await auth.signin(DEMO_EMAIL, DEMO_PASSWORD);
  assert.throws(() => auth.verify(DEMO_RECOVERY, true), /already used/);
  assert.equal(auth.verify(DEMO_CODE).email, DEMO_EMAIL);
});
test("signup validates matching passwords and duplicate accounts", async () => {
  const auth = new DemoAuth();
  const input = {
    name: "Jordan Lee",
    email: "jordan@example.test",
    password: "DemoOnly!12345",
    confirm: "DemoOnly!12345",
  };
  await assert.rejects(
    auth.signup({ ...input, confirm: "different" }),
    /do not match/,
  );
  await assert.rejects(
    auth.signup({ ...input, password: "short", confirm: "short" }),
    /12 characters/,
  );
  await assert.rejects(
    auth.signup({ ...input, email: "invalid" }),
    /valid email/,
  );
  assert.equal((await auth.signup(input)).enroll, true);
  assert.equal(auth.verify(DEMO_CODE).name, "Jordan Lee");
  await assert.rejects(auth.signup(input), /already exists/);
  await auth.signin(input.email, input.password);
  assert.equal(auth.verify(DEMO_RECOVERY, true).email, input.email);
  assert(!JSON.stringify([...auth.accounts.values()]).includes(input.password));
});
test("canceling an asynchronous signup cannot create an account or challenge", async () => {
  const auth = new DemoAuth();
  const p = auth.signup({
    name: "Temporary",
    email: "temp@example.test",
    password: "Temporary!1234",
    confirm: "Temporary!1234",
  });
  auth.cancel();
  await assert.rejects(p, /canceled/);
  assert.equal(auth.accounts.size, 0);
  assert.equal(auth.challenge, null);
});
import { registerMetroTools } from "./webmcp.mjs";
test("agent tools validate input, inspect the same station and clean up", () => {
  const registered = [];
  let selected = null;
  const context = {
    registerTool: (tool, options) => registered.push({ tool, options }),
  };
  const cleanup = registerMetroTools(context, {
    getStations: () => stations,
    inspect: (s) => (selected = s),
  });
  assert.equal(registered.length, 2);
  assert.equal(registered[0].tool.execute({}).stations.length, 15);
  assert.throws(() => registered[0].tool.execute({ unexpected: true }));
  assert.throws(() => registered[1].tool.execute({ stationId: "bad" }));
  assert.equal(selected, null);
  assert.equal(
    registered[1].tool.execute({ stationId: "ST03" }).stationId,
    "ST03",
  );
  assert.equal(selected.id, "ST03");
  cleanup();
  assert(registered.every((x) => x.options.signal.aborted));
  assert.doesNotThrow(() => registerMetroTools(undefined, {})());
});
