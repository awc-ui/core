import test from "node:test";
import assert from "node:assert/strict";
import { registerHomeTools } from "../src/webmcp.js";
import { createState } from "../src/model.js";

function setup() {
  const registered = new Map();
  const state = createState();
  let updates = 0;
  const dispose = registerHomeTools(
    {
      registerTool(tool, options) {
        registered.set(tool.name, { ...tool, signal: options.signal });
      },
    },
    state,
    async () => {
      updates++;
    },
  );
  return {
    registered,
    state,
    dispose,
    get updates() {
      return updates;
    },
  };
}
test("home tools register once with explicit mutation annotations and lifecycle cleanup", () => {
  const c = setup();
  assert.deepEqual(
    [...c.registered.keys()],
    ["read_home", "set_home_devices", "apply_home_scene"],
  );
  assert.equal(c.registered.get("read_home").annotations.readOnlyHint, true);
  assert.equal(
    c.registered.get("apply_home_scene").annotations.readOnlyHint,
    false,
  );
  assert.deepEqual(c.registered.get("set_home_devices").inputSchema.required, [
    "devices",
  ]);
  c.dispose();
  assert.ok([...c.registered.values()].every((t) => t.signal.aborted));
  assert.doesNotThrow(() =>
    registerHomeTools(undefined, createState(), () => {}),
  );
});
test("batched changes update the shared state before returning a read-back", async () => {
  const c = setup();
  const result = await c.registered.get("set_home_devices").execute({
    devices: [
      { id: "ceiling", on: false },
      { id: "blinds", level: 0 },
    ],
  });
  assert.equal(c.updates, 1);
  assert.equal(c.state.devices.find((d) => d.id === "ceiling").on, false);
  assert.equal(result.devices.find((d) => d.id === "blinds").level, 0);
  assert.deepEqual(result, c.registered.get("read_home").execute({}));
  assert.equal(result.demo, true);
});
test("an invalid item rejects the entire batch without partial device changes", async () => {
  const c = setup();
  const before = structuredClone(c.state);
  const tool = c.registered.get("set_home_devices");
  for (const invalid of [
    { id: "plug", on: true },
    { id: "ceiling", level: 101 },
    { id: "door", level: 50 },
    { id: "blinds", on: false },
    { id: "missing", on: true },
    { id: "lamp", on: "false" },
  ]) {
    await assert.rejects(() =>
      tool.execute({ devices: [{ id: "speaker", on: true }, invalid] }),
    );
    assert.deepEqual(c.state, before);
  }
  assert.equal(c.updates, 0);
});
test("scene tools apply the same coordinated model changes and reject unknown scenes", async () => {
  const c = setup();
  const tool = c.registered.get("apply_home_scene");
  const result = await tool.execute({ scene: "movie" });
  assert.equal(result.activeScene, "movie");
  assert.equal(result.devices.find((d) => d.id === "ceiling").level, 15);
  assert.equal(c.updates, 1);
  const before = structuredClone(c.state);
  await assert.rejects(() => tool.execute({ scene: "invalid" }));
  assert.deepEqual(c.state, before);
});
