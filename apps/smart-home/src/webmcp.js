import { setDevice, applyScene, scenes, watts } from "./model.js";

export function registerHomeTools(context, state, onUpdate) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const snapshot = () => ({
    demo: true,
    devices: state.devices.map(
      ({ id, name, room, type, online, on, level }) => ({
        id,
        name,
        room,
        type,
        online,
        on,
        ...(level === undefined ? {} : { level }),
      }),
    ),
    climate: {
      enabled: state.climateOn,
      target: state.target,
      mode: state.climate,
    },
    currentWatts: watts(state),
    activeScene: state.activeScene,
  });
  const tools = [
    {
      name: "read_home",
      title: "Read home status",
      description:
        "Read the simulated home devices and climate. No physical devices are connected.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input = {}) {
        if (
          !input ||
          Array.isArray(input) ||
          typeof input !== "object" ||
          Object.keys(input).length
        )
          throw new Error("No arguments expected.");
        return snapshot();
      },
    },
    {
      name: "set_home_devices",
      title: "Set demo devices",
      description:
        "Set power or level for one or more simulated devices and update the visible controls. Use read_home for device IDs. Lock on means locked. Blinds use level only. State lasts for this tab.",
      inputSchema: {
        type: "object",
        properties: {
          devices: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                on: { type: "boolean" },
                level: { type: "number", minimum: 0, maximum: 100 },
              },
              required: ["id"],
              additionalProperties: false,
            },
          },
        },
        required: ["devices"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (
          !input ||
          Object.keys(input).some((k) => k !== "devices") ||
          !Array.isArray(input.devices) ||
          !input.devices.length ||
          input.devices.length > 12
        )
          throw new Error("Provide between one and twelve device changes.");
        const ids = new Set();
        for (const patch of input.devices) {
          if (
            !patch ||
            typeof patch !== "object" ||
            Object.keys(patch).some((k) => !["id", "on", "level"].includes(k))
          )
            throw new Error("Invalid device change.");
          const d = state.devices.find((d) => d.id === patch.id);
          if (!d || !d.online || ids.has(d.id))
            throw new Error("Device unavailable or repeated.");
          if (!("on" in patch) && !("level" in patch))
            throw new Error("Provide power or level.");
          if (
            "on" in patch &&
            (typeof patch.on !== "boolean" || d.type === "blinds")
          )
            throw new Error("Invalid power setting.");
          if (
            "level" in patch &&
            (d.level === undefined ||
              !Number.isFinite(patch.level) ||
              patch.level < 0 ||
              patch.level > 100)
          )
            throw new Error(
              "Level must be between zero and one hundred for an adjustable device.",
            );
          ids.add(d.id);
        }
        for (const patch of input.devices) setDevice(state, patch.id, patch);
        await onUpdate();
        return snapshot();
      },
    },
    {
      name: "apply_home_scene",
      title: "Apply a demo scene",
      description:
        "Apply a built-in scene to the simulated lights, devices, and climate and update the visible home. No physical devices are connected.",
      inputSchema: {
        type: "object",
        properties: {
          scene: { type: "string", enum: scenes.map((s) => s.id) },
        },
        required: ["scene"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (
          !input ||
          Object.keys(input).some((k) => k !== "scene") ||
          !scenes.some((s) => s.id === input.scene)
        )
          throw new Error("Unknown scene.");
        applyScene(state, input.scene);
        await onUpdate();
        return snapshot();
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  return () => lifecycle.abort();
}
