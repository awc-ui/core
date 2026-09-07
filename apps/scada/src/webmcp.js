// Optional progressive enhancement. The ordinary UI is independent of WebMCP.
export function registerMonitoringTools(context, api) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const tools = [
    {
      name: "read_monitoring_snapshot",
      title: "Read simulated plant status",
      description:
        "Read the current simulated equipment readings and alarm states. Does not change the app.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== "object" || Object.keys(input).length)
          throw new Error("Expected an empty object.");
        return api.snapshot();
      },
    },
    {
      name: "open_asset_details",
      title: "Inspect simulated equipment",
      description:
        "Open the visible read-only equipment inspection panel for an exact asset ID from the snapshot.",
      inputSchema: {
        type: "object",
        properties: { assetId: { type: "string" } },
        required: ["assetId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          Object.keys(input).some((k) => k !== "assetId") ||
          typeof input.assetId !== "string" ||
          !api.assetExists(input.assetId)
        )
          throw new Error("Choose an asset ID from the monitoring snapshot.");
        await api.inspect(input.assetId);
        return { assetId: input.assetId, panel: "open", source: "simulation" };
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  return () => lifecycle.abort();
}
