// Optional progressive enhancement; unsupported browsers use the normal UI.
export function registerMetroTools(context, actions) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const definitions = [
    {
      name: "get_metro_station_status",
      title: "Get metro station status",
      description:
        "Read simulated metro station telemetry in the currently signed-in demo workspace.",
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw Error("This tool expects an empty object.");
        return {
          simulation: true,
          stations: actions
            .getStations()
            .map(({ id, name, lines, status, occupancy, passengers }) => ({
              id,
              name,
              lines,
              status,
              occupancy,
              passengers,
            })),
        };
      },
    },
    {
      name: "inspect_metro_station",
      title: "Inspect metro station",
      description:
        "Open the station detail panel for a simulated metro station. This changes the visible selection only.",
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      inputSchema: {
        type: "object",
        properties: { stationId: { type: "string" } },
        required: ["stationId"],
        additionalProperties: false,
      },
      execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          Array.isArray(input) ||
          Object.keys(input).length !== 1 ||
          typeof input.stationId !== "string"
        )
          throw Error("Provide one stationId string.");
        const station = actions
          .getStations()
          .find((s) => s.id === input.stationId);
        if (!station) throw Error("Unknown station ID.");
        actions.inspect(station);
        return {
          stationId: station.id,
          panel: "station details",
          simulation: true,
        };
      },
    },
  ];
  for (const tool of definitions) {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  return () => lifecycle.abort();
}
