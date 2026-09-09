import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  setDevice,
  applyScene,
  watts,
  statusText,
  createRoutine,
} from "../src/model.js";

const device = (state, id) => state.devices.find((item) => item.id === id);

test("separate households do not share mutable device, routine or activity state", () => {
  const first = createState();
  const second = createState();
  setDevice(first, "ceiling", { on: false, level: 5 });
  first.routines[0].enabled = false;
  first.activity[0].text = "Changed";
  assert.equal(device(second, "ceiling").on, true);
  assert.equal(device(second, "ceiling").level, 72);
  assert.equal(second.routines[0].enabled, true);
  assert.equal(second.activity[0].text, "Front door locked");
});

test("unavailable devices cannot be changed and preserve the active scene", () => {
  const state = createState();
  applyScene(state, "movie");
  const before = structuredClone(state);
  assert.equal(setDevice(state, "plug", { on: true }), false);
  assert.equal(setDevice(state, "missing", { on: true }), false);
  assert.deepEqual(state, before);
});

test("device changes clamp levels, preserve unrelated properties and clear the active scene", () => {
  const state = createState();
  applyScene(state, "movie");
  assert.equal(
    setDevice(state, "ceiling", {
      on: false,
      level: 150,
      name: "Wrong",
      watts: 0,
    }),
    true,
  );
  assert.equal(device(state, "ceiling").on, false);
  assert.equal(device(state, "ceiling").level, 100);
  assert.equal(device(state, "ceiling").name, "Ceiling lights");
  assert.equal(device(state, "ceiling").watts, 36);
  assert.equal(state.activeScene, null);
  setDevice(state, "ceiling", { level: -10 });
  assert.equal(device(state, "ceiling").level, 0);
  setDevice(state, "ceiling", { level: "not a number" });
  assert.equal(device(state, "ceiling").level, 0);
  setDevice(state, "coffee", { level: 30 });
  assert.equal("level" in device(state, "coffee"), false);
});

test("power reflects light brightness, powered devices, climate and offline state", () => {
  const state = createState();
  assert.equal(watts(state), 415);
  state.climateOn = false;
  assert.equal(watts(state), 95);
  setDevice(state, "ceiling", { level: 0 });
  assert.equal(watts(state), 69);
  setDevice(state, "coffee", { on: true });
  assert.equal(watts(state), 919);
  device(state, "coffee").online = false;
  assert.equal(watts(state), 69);
  setDevice(state, "purifier", { on: false });
  assert.equal(watts(state), 34);
});

test("movie and away scenes apply coordinated changes and update climate", () => {
  const state = createState();
  state.climateOn = false;
  assert.equal(applyScene(state, "movie"), true);
  assert.equal(device(state, "ceiling").level, 15);
  assert.equal(device(state, "lamp").level, 25);
  assert.equal(device(state, "speaker").on, true);
  assert.equal(statusText(device(state, "blinds")), "Closed");
  assert.equal(state.climateOn, true);
  assert.equal(state.target, 22);
  assert.equal(state.activeScene, "movie");
  setDevice(state, "coffee", { on: true });
  setDevice(state, "door", { on: false });
  assert.equal(applyScene(state, "away"), true);
  assert.ok(
    state.devices
      .filter((item) => item.type === "light")
      .every((item) => !item.on),
  );
  assert.equal(device(state, "coffee").on, false);
  assert.equal(device(state, "speaker").on, false);
  assert.equal(statusText(device(state, "door")), "Locked");
  assert.equal(state.target, 18);
  assert.equal(state.activeScene, "away");
  assert.equal(watts(state), 355);
});

test("scenes preserve offline devices and unknown scenes do not mutate state", () => {
  const state = createState();
  const ceiling = device(state, "ceiling");
  ceiling.online = false;
  applyScene(state, "away");
  assert.equal(ceiling.on, true);
  assert.equal(statusText(ceiling), "Offline");
  const before = structuredClone(state);
  assert.equal(applyScene(state, "missing"), false);
  assert.deepEqual(state, before);
});

test("invalid routine names, times and scenes are rejected without adding a routine", () => {
  const state = createState();
  const before = structuredClone(state.routines);
  const valid = {
    name: "Evening",
    time: "19:00",
    scene: "movie",
    days: "Every day",
  };
  const invalid = [
    { name: "" },
    { name: "  \n " },
    { time: "" },
    { time: "7:00" },
    { time: "24:00" },
    { time: "12:60" },
    { time: "12:00:00" },
    { time: " 12:00" },
    { scene: "unknown" },
  ];
  for (const patch of invalid) {
    assert.equal(
      createRoutine(state, { ...valid, ...patch }),
      false,
      JSON.stringify(patch),
    );
    assert.deepEqual(state.routines, before);
  }
});

test("valid routine boundaries, trimmed names and supported repeat choices are stored", () => {
  const state = createState();
  assert.equal(
    createRoutine(state, {
      name: "  Early lights  ",
      time: "00:00",
      scene: "home",
      days: "Weekdays",
    }),
    true,
  );
  const first = state.routines.at(-1);
  assert.equal(first.name, "Early lights");
  assert.equal(first.time, "00:00");
  assert.equal(first.days, "Weekdays");
  assert.equal(first.enabled, true);
  assert.equal(
    createRoutine(state, {
      name: "x".repeat(90),
      time: "23:59",
      scene: "night",
      days: "Every day",
    }),
    true,
  );
  assert.equal(state.routines.at(-1).name.length, 60);
  assert.equal(state.routines.at(-1).time, "23:59");
  assert.equal(state.routines.at(-1).days, "Every day");
});

test("routines created in the same millisecond have independent identities", (t) => {
  t.mock.method(Date, "now", () => 1700000000000);
  const state = createState();
  const routine = {
    name: "Evening",
    time: "19:00",
    scene: "movie",
    days: "Every day",
  };
  assert.equal(createRoutine(state, routine), true);
  assert.equal(
    createRoutine(state, { ...routine, name: "Second evening" }),
    true,
  );
  assert.notEqual(state.routines.at(-1).id, state.routines.at(-2).id);
});

test("scene replay is idempotent and preserves unrelated device settings", () => {
  const state = createState();
  setDevice(state, "purifier", { level: 63 });
  applyScene(state, "night");
  const afterFirstRun = structuredClone(state);
  applyScene(state, "night");
  assert.deepEqual(state, afterFirstRun);
  assert.equal(device(state, "purifier").level, 63);
  assert.equal(device(state, "bedside").on, true);
  assert.equal(device(state, "bedside").level, 10);
});

test("device status describes lock and blind state independently of generic power", () => {
  const state = createState();
  const door = device(state, "door");
  const blinds = device(state, "blinds");
  setDevice(state, "door", { on: false });
  assert.equal(statusText(door), "Unlocked");
  setDevice(state, "door", { on: true });
  assert.equal(statusText(door), "Locked");
  setDevice(state, "blinds", { level: 100 });
  assert.equal(statusText(blinds), "100% open");
  setDevice(state, "blinds", { level: 0 });
  assert.equal(statusText(blinds), "Closed");
  blinds.online = false;
  assert.equal(statusText(blinds), "Offline");
});
