export const DEMO_EMAIL = "operator@example.test";
export const DEMO_PASSWORD = "DemoPass!2026";
export const DEMO_CODE = "482916";
export const RECOVERY_CODE = "AWCDEMO1";
export const assets = [
  {
    id: "P-101",
    name: "Intake pump",
    area: "Intake",
    icon: "water_pump",
    status: "Running",
    value: 1248,
    unit: "m³/h",
    load: 72,
    tag: "PLC-01.FLOW.PV",
    signal: "Flow rate",
    min: 0,
    max: 1600,
    health: 98,
    protocol: "OPC UA",
    address: "ns=2;s=Intake.P101",
    note: "Duty pump supplying the treatment train.",
  },
  {
    id: "P-102",
    name: "Standby pump",
    area: "Intake",
    icon: "water_pump",
    status: "Standby",
    value: 0,
    unit: "m³/h",
    load: 0,
    tag: "PLC-01.P102.PV",
    signal: "Flow rate",
    min: 0,
    max: 1600,
    health: 100,
    protocol: "OPC UA",
    address: "ns=2;s=Intake.P102",
    note: "Available for the next duty rotation.",
  },
  {
    id: "FLT-201",
    name: "Sand filtration",
    area: "Filtration",
    icon: "filter_alt",
    status: "Warning",
    value: 2.8,
    unit: "bar",
    load: 86,
    tag: "PLC-02.DP.PV",
    signal: "Differential pressure",
    min: 0,
    max: 4,
    health: 84,
    protocol: "Modbus TCP",
    address: "Holding register 40201",
    note: "Differential pressure is above the 2.5 bar advisory limit.",
  },
  {
    id: "TK-301",
    name: "Clearwater tank",
    area: "Storage",
    icon: "water_full",
    status: "Running",
    value: 78.4,
    unit: "%",
    load: 78,
    tag: "PLC-03.LEVEL.PV",
    signal: "Tank level",
    min: 0,
    max: 100,
    health: 99,
    protocol: "OPC UA",
    address: "ns=2;s=Storage.TK301",
    note: "Clearwater storage level remains within the 30–90% operating band.",
  },
  {
    id: "P-401",
    name: "Distribution pump",
    area: "Distribution",
    icon: "valve",
    status: "Critical",
    value: 8.4,
    unit: "mm/s",
    load: 94,
    tag: "PLC-04.VIB.PV",
    signal: "Vibration",
    min: 0,
    max: 12,
    health: 62,
    protocol: "OPC UA",
    address: "ns=2;s=Distribution.P401",
    note: "Vibration exceeds the 7.1 mm/s demo threshold. Inspect the bearing assembly.",
  },
  {
    id: "RTU-05",
    name: "Remote telemetry",
    area: "Distribution",
    icon: "router",
    status: "Offline",
    value: null,
    unit: "ms",
    load: null,
    tag: "RTU-05.COMMS.RTT",
    signal: "Response time",
    min: 0,
    max: 500,
    health: 0,
    protocol: "MQTT",
    address: "plant/north/rtu05/status",
    note: "No recent sample. The last valid observation is retained in the historian.",
  },
];
export const initialAlarms = [
  {
    id: "ALM-1042",
    asset: "P-401",
    severity: "Critical",
    title: "High vibration detected",
    detail: "8.4 mm/s · limit 7.1 mm/s",
    time: "14:32:08",
    acknowledged: false,
  },
  {
    id: "ALM-1041",
    asset: "RTU-05",
    severity: "Critical",
    title: "Communication timeout",
    detail: "No response after 3 polling attempts",
    time: "14:29:41",
    acknowledged: false,
  },
  {
    id: "ALM-1040",
    asset: "FLT-201",
    severity: "Warning",
    title: "Filter pressure rising",
    detail: "2.8 bar · advisory limit 2.5 bar",
    time: "14:24:16",
    acknowledged: false,
  },
  {
    id: "ALM-1039",
    asset: "P-102",
    severity: "Info",
    title: "Duty cycle completed",
    detail: "Standby pump ready for rotation",
    time: "14:18:52",
    acknowledged: false,
  },
];
export const statusColor = (status) =>
  ({
    Running: "success",
    Standby: "info",
    Warning: "warning",
    Critical: "error",
    Offline: "error",
    Info: "info",
  })[status] || "primary";
export const statusDot = (status) =>
  ({
    Running: "online",
    Acknowledged: "online",
    Paused: "neutral",
    Standby: "neutral",
    Warning: "away",
    Critical: "busy",
    Offline: "offline",
    Info: "neutral",
  })[status] || "neutral";
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function sampleValue(asset, tick = 0) {
  if (asset.value === null || asset.status === "Standby") return asset.value;
  return Number(
    (
      asset.value +
      Math.sin(tick / 3 + assets.indexOf(asset)) * asset.value * 0.015
    ).toFixed(asset.unit === "m³/h" ? 0 : 1),
  );
}
export function history(asset, tick = 0, points = 24) {
  if (asset.value === null) return Array(points).fill(null);
  if (asset.status === "Standby") return Array(points).fill(0);
  return Array.from({ length: points }, (_, i) =>
    i === points - 1
      ? sampleValue(asset, tick)
      : Number(
          (
            asset.value *
            (0.96 +
              0.045 * Math.sin((i + tick) / 3) +
              0.018 * Math.cos(i * 1.9))
          ).toFixed(1),
        ),
  );
}
export function selectAssets({
  area = "all",
  query = "",
  sortBy = "id",
  order = "asc",
  searchNames = {},
} = {}) {
  const q = query.toLowerCase().trim();
  const rows = assets.filter(
    (a) =>
      (area === "all" || a.area === area) &&
      `${a.id} ${a.name} ${a.tag} ${searchNames[a.id] || ""}`
        .toLowerCase()
        .includes(q),
  );
  const allowed = ["id", "name", "area", "status", "health"];
  const key = allowed.includes(sortBy) ? sortBy : "id";
  return rows.sort(
    (a, b) =>
      (typeof a[key] === "number"
        ? a[key] - b[key]
        : String(a[key]).localeCompare(String(b[key]))) *
      (order === "desc" ? -1 : 1),
  );
}
export function selectAlarms(alarms, severity = "All", state = "active") {
  return alarms.filter(
    (a) =>
      (severity === "All" || a.severity === severity) &&
      (state === "all" ||
        (state === "acknowledged" ? a.acknowledged : !a.acknowledged)),
  );
}
export function acknowledgeAlarm(
  alarms,
  id,
  note = "",
  now = new Date().toISOString(),
) {
  return alarms.map((a) =>
    a.id === id && !a.acknowledged
      ? {
          ...a,
          acknowledged: true,
          note: String(note).slice(0, 500),
          acknowledgedAt: now,
        }
      : a,
  );
}
export function validateSignup({ name, email, password, confirm, consent }) {
  if (!name?.trim()) return { field: "name", message: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ""))
    return { field: "email", message: "Enter a valid email address." };
  if (!password || password.length < 12)
    return { field: "password", message: "Use at least 12 characters." };
  if (password !== confirm)
    return { field: "confirm", message: "Passwords do not match." };
  if (!consent)
    return {
      field: "consent",
      message: "Confirm that you understand this is a demo.",
    };
  return null;
}
export function verifyDemoCode(code, recovery = false) {
  return String(code).trim() === (recovery ? RECOVERY_CODE : DEMO_CODE);
}
export function checkChallenge(
  challenge,
  code,
  recovery = false,
  now = Date.now(),
) {
  if (!challenge)
    return {
      ok: false,
      message: "Start with sign in or create a demo profile.",
    };
  if (now >= challenge.expiresAt)
    return { ok: false, message: "The demo challenge expired. Sign in again." };
  if (challenge.attempts >= 5)
    return {
      ok: false,
      message:
        "Too many attempts. Sign in again to start a new demo challenge.",
    };
  if (!verifyDemoCode(code, recovery))
    return {
      ok: false,
      message: "That code did not match. Use the sample code shown above.",
    };
  return { ok: true };
}
export function chartData(metric = "flow", range = "1h", tick = 0) {
  const settings = {
    flow: { name: "Flow rate", base: 1248, unit: "m³/h", min: 800, max: 1600 },
    pressure: {
      name: "Filter pressure",
      base: 2.8,
      unit: "bar",
      min: 0,
      max: 4,
    },
    power: { name: "Power demand", base: 328, unit: "kW", min: 200, max: 450 },
  };
  const config = settings[metric] || settings.flow;
  const duration = { "1h": 60, "6h": 360, "24h": 1440 }[range] || 60;
  const end = Date.UTC(2026, 8, 7, 14, 36) + tick * 4000;
  const data = Array.from({ length: 31 }, (_, i) => ({
    x: end - ((30 - i) / 30) * duration * 60000,
    y: Number(
      (
        config.base *
        (0.96 +
          0.05 * Math.sin((i + tick) / (range === "1h" ? 2.7 : 4)) +
          0.022 * Math.cos(i * 1.8))
      ).toFixed(1),
    ),
  }));
  const currentAsset = assets.find(
    (a) => a.id === (metric === "pressure" ? "FLT-201" : "P-101"),
  );
  data.at(-1).y =
    metric === "power"
      ? Number((config.base + Math.sin(tick / 3) * 4).toFixed(1))
      : sampleValue(currentAsset, tick);
  return { ...config, data };
}
