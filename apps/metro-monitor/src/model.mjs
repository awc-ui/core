// Fictional metro network. All telemetry is deterministic simulation data.
export const lines = [
  { id: "M1", name: "River line", color: "var(--metro-line-1)" },
  { id: "M2", name: "Airport line", color: "var(--metro-line-2)" },
  { id: "M3", name: "Garden line", color: "var(--metro-line-3)" },
];
/** @type {Array<[string,string,string[],number,number,number,number,string]>} */
const raw = [
  ["ST01", "Westgate", ["M1"], 82, 230, 32, 420, "normal"],
  ["ST02", "Riverside", ["M1"], 202, 230, 54, 690, "attention"],
  ["ST03", "Central exchange", ["M1", "M2"], 330, 230, 91, 1420, "busy"],
  ["ST04", "City hall", ["M1"], 452, 230, 61, 760, "normal"],
  ["ST05", "East market", ["M1"], 572, 230, 48, 640, "normal"],
  ["ST06", "Eastend", ["M1"], 672, 230, 28, 310, "normal"],
  ["ST07", "North park", ["M2"], 330, 42, 35, 380, "normal"],
  ["ST08", "Museum quarter", ["M2", "M3"], 330, 130, 64, 890, "normal"],
  ["ST09", "Southbank", ["M2"], 330, 325, 52, 680, "normal"],
  ["ST10", "Airport terminal", ["M2"], 500, 325, 58, 720, "normal"],
  ["ST11", "Hillcrest", ["M3"], 82, 58, 22, 240, "normal"],
  ["ST12", "Botanical garden", ["M3"], 202, 58, 41, 470, "normal"],
  ["ST13", "University", ["M3"], 460, 58, 73, 860, "normal"],
  ["ST14", "Tech park", ["M3"], 572, 58, 46, 520, "attention"],
  ["ST15", "Innovation hub", ["M3"], 672, 58, 30, 360, "normal"],
];
export const stations = raw.map(
  ([id, name, lines, x, y, occupancy, passengers, status], i) => ({
    id,
    name,
    lines,
    x,
    y,
    occupancy,
    passengers,
    status,
    headway: 2.6 + (i % 5) * 0.2,
    temperature: 22 + (i % 4),
    equipment: status === "attention" ? 96 : 100,
    trend: [20, 28, 24, 40, 34, 52, occupancy],
  }),
);
export const incidentFixture = [
  {
    id: "INC-1042",
    stationId: "ST03",
    title: "High platform occupancy",
    detail:
      "Platform 2 is above the 85% occupancy threshold. Open the overflow entrance and direct passengers to the rear carriages.",
    severity: "warning",
    state: "open",
    time: "08:42",
    category: "Passenger flow",
  },
  {
    id: "INC-1041",
    stationId: "ST02",
    title: "Lift E-02 unavailable",
    detail:
      "The east entrance lift is out of service. Step-free access is available from the west entrance. Maintenance team ETA: 09:15.",
    severity: "error",
    state: "open",
    time: "08:36",
    category: "Accessibility",
  },
  {
    id: "INC-1040",
    stationId: "ST14",
    title: "Ventilation inspection due",
    detail:
      "Air handling unit AHU-03 reported reduced output. Air quality remains within the operating range; a technician has been assigned.",
    severity: "info",
    state: "acknowledged",
    time: "08:28",
    category: "Equipment",
  },
];
export const statusLabels = {
  normal: "Operational",
  attention: "Needs attention",
  busy: "Busy",
};
export function selectStations(
  rows,
  {
    query = "",
    line = "all",
    status = "all",
    sort = "name",
    order = "asc",
    localize = (value) => value,
    locale = "en-US",
  } = {},
) {
  const q = query.trim().toLowerCase();
  return rows
    .filter(
      (s) =>
        (!q ||
          `${s.name} ${localize(s.name)} ${s.id}`.toLowerCase().includes(q)) &&
        (line === "all" || s.lines.includes(line)) &&
        (status === "all" || s.status === status),
    )
    .sort((a, b) => {
      const v =
        typeof a[sort] === "number"
          ? a[sort] - b[sort]
          : String(sort === "name" ? localize(a[sort]) : a[sort]).localeCompare(
              String(sort === "name" ? localize(b[sort]) : b[sort]),
              locale,
            );
      return order === "desc" ? -v : v;
    });
}
export function getSummary(rows, incidents) {
  return {
    online: rows.length,
    passengers: rows.reduce((n, s) => n + s.passengers, 0),
    occupancy: Math.round(
      rows.reduce((n, s) => n + s.occupancy, 0) / Math.max(rows.length, 1),
    ),
    headway: rows.length
      ? (rows.reduce((n, s) => n + s.headway, 0) / rows.length).toFixed(1)
      : "0.0",
    incidents: incidents.filter(
      (i) => i.state !== "resolved" && rows.some((s) => s.id === i.stationId),
    ).length,
  };
}
export function updateIncident(rows, id, state) {
  if (!["acknowledged", "resolved"].includes(state))
    throw new Error("Unknown incident state");
  return rows.map((i) =>
    i.id === id && i.state !== "resolved" ? { ...i, state } : i,
  );
}
export function simulateSnapshot(rows, tick) {
  return rows.map((s, i) => ({
    ...s,
    occupancy: Math.max(
      10,
      Math.min(96, s.occupancy + Math.round(Math.sin(tick + i) * 3)),
    ),
    passengers: Math.max(0, s.passengers + Math.round(Math.cos(tick + i) * 12)),
  }));
}
export function getFlow(period = "today", line = "all") {
  const factor =
    line === "all" ? 1 : line === "M1" ? 0.48 : line === "M2" ? 0.3 : 0.22;
  const values =
    period === "week"
      ? [51, 64, 60, 71, 82, 66, 78]
      : [10, 12, 9, 17, 32, 48, 64, 83, 74, 61, 72, 85];
  return {
    labels:
      period === "week"
        ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        : [
            "06:00",
            "06:15",
            "06:30",
            "06:45",
            "07:00",
            "07:15",
            "07:30",
            "07:45",
            "08:00",
            "08:15",
            "08:30",
            "08:45",
          ],
    series: [
      {
        label: "Entries",
        data: values.map((x) => Math.round(x * factor * 100)),
        color: "primary",
      },
      {
        label: "Exits",
        data: values.map((x, i) =>
          Math.round((x * 0.78 + Math.sin(i) * 8) * factor * 100),
        ),
        color: "tertiary",
      },
    ],
  };
}
export function toCSV(rows, localize = (value) => value) {
  const cell = (v) => '"' + String(v).replaceAll('"', '""') + '"';
  return [
    [
      "Station ID",
      "Station",
      "Lines",
      "Status",
      "Occupancy (%)",
      "Passengers / hour",
      "Headway (min)",
    ].map((value) => localize(value)),
    ...rows.map((s) => [
      s.id,
      localize(s.name),
      s.lines.join(" / "),
      localize(statusLabels[s.status]),
      s.occupancy,
      s.passengers,
      s.headway.toFixed(1),
    ]),
  ]
    .map((r) => r.map(cell).join(","))
    .join("\r\n");
}
