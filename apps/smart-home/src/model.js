export const rooms = [
  { id: "living", name: "Living room", icon: "chair", temperature: 21.8 },
  { id: "kitchen", name: "Kitchen", icon: "kitchen", temperature: 22.1 },
  { id: "bedroom", name: "Bedroom", icon: "bed", temperature: 20.5 },
  { id: "office", name: "Office", icon: "desk", temperature: 21.2 },
  { id: "entry", name: "Entrance", icon: "door_front", temperature: 20.8 },
];
const defaults = [
  {
    id: "ceiling",
    name: "Ceiling lights",
    room: "living",
    icon: "light_group",
    type: "light",
    on: true,
    level: 72,
    watts: 36,
    favorite: true,
  },
  {
    id: "lamp",
    name: "Floor lamp",
    room: "living",
    icon: "floor_lamp",
    type: "light",
    on: true,
    level: 45,
    watts: 12,
    favorite: false,
  },
  {
    id: "speaker",
    name: "Living room speaker",
    room: "living",
    icon: "speaker",
    type: "speaker",
    on: false,
    level: 35,
    watts: 18,
    favorite: true,
  },
  {
    id: "pendant",
    name: "Pendant lights",
    room: "kitchen",
    icon: "light",
    type: "light",
    on: true,
    level: 80,
    watts: 24,
    favorite: false,
  },
  {
    id: "coffee",
    name: "Coffee maker",
    room: "kitchen",
    icon: "coffee_maker",
    type: "plug",
    on: false,
    watts: 850,
    favorite: false,
  },
  {
    id: "bedside",
    name: "Bedside lamps",
    room: "bedroom",
    icon: "table_lamp",
    type: "light",
    on: false,
    level: 30,
    watts: 16,
    favorite: false,
  },
  {
    id: "blinds",
    name: "Window blinds",
    room: "bedroom",
    icon: "blinds",
    type: "blinds",
    on: true,
    level: 75,
    watts: 0,
    favorite: true,
  },
  {
    id: "desk",
    name: "Desk light",
    room: "office",
    icon: "desk",
    type: "light",
    on: true,
    level: 65,
    watts: 14,
    favorite: false,
  },
  {
    id: "purifier",
    name: "Air purifier",
    room: "office",
    icon: "air",
    type: "fan",
    on: true,
    level: 40,
    watts: 35,
    favorite: true,
  },
  {
    id: "door",
    name: "Front door",
    room: "entry",
    icon: "lock",
    type: "lock",
    on: true,
    watts: 0,
    favorite: true,
  },
  {
    id: "porch",
    name: "Porch light",
    room: "entry",
    icon: "outdoor_garden",
    type: "light",
    on: false,
    level: 100,
    watts: 18,
    favorite: false,
  },
  {
    id: "plug",
    name: "Hallway plug",
    room: "entry",
    icon: "outlet",
    type: "plug",
    on: false,
    watts: 10,
    online: false,
    favorite: false,
  },
];
export const scenes = [
  {
    id: "home",
    name: "Welcome home",
    icon: "home",
    description: "A little light. The right temperature.",
    summary: "5 lights · climate on",
    patch: {
      ceiling: { on: true, level: 72 },
      lamp: { on: true, level: 45 },
      pendant: { on: true, level: 80 },
      desk: { on: true, level: 65 },
      porch: { on: true },
      door: { on: true },
    },
    temp: 22,
  },
  {
    id: "movie",
    name: "Movie night",
    icon: "movie",
    description: "Dim the lights and settle in.",
    summary: "Soft lighting · speaker on",
    patch: {
      ceiling: { on: true, level: 15 },
      lamp: { on: true, level: 25 },
      speaker: { on: true, level: 30 },
      blinds: { level: 0 },
    },
    temp: 22,
  },
  {
    id: "away",
    name: "Away",
    icon: "directions_walk",
    description: "Lights off. Door locked. Less energy.",
    summary: "Lights off · door locked",
    patch: {
      ceiling: { on: false },
      lamp: { on: false },
      pendant: { on: false },
      desk: { on: false },
      bedside: { on: false },
      porch: { on: false },
      speaker: { on: false },
      coffee: { on: false },
      door: { on: true },
    },
    temp: 18,
  },
  {
    id: "night",
    name: "Good night",
    icon: "bedtime",
    description: "Wind down, close the blinds, sleep well.",
    summary: "Blinds closed · 19°C",
    patch: {
      ceiling: { on: false },
      lamp: { on: false },
      pendant: { on: false },
      desk: { on: false },
      speaker: { on: false },
      bedside: { on: true, level: 10 },
      blinds: { level: 0 },
      door: { on: true },
    },
    temp: 19,
  },
];
export function createState() {
  return {
    devices: defaults.map((d) => ({ online: true, ...d })),
    route: "home",
    room: "all",
    target: 22,
    climate: "auto",
    climateOn: true,
    activeScene: null,
    period: "week",
    routines: [
      {
        id: "morning",
        name: "A gentle start",
        time: "07:00",
        days: "Weekdays",
        scene: "home",
        enabled: true,
      },
      {
        id: "evening",
        name: "Settle in",
        time: "19:30",
        days: "Every day",
        scene: "movie",
        enabled: true,
      },
      {
        id: "sleep",
        name: "Time to unwind",
        time: "23:00",
        days: "Every day",
        scene: "night",
        enabled: false,
      },
    ],
    activity: [
      { icon: "lock", text: "Front door locked", time: "18:42" },
      {
        icon: "light_mode",
        text: "Living room lights turned on",
        time: "18:35",
      },
      { icon: "air", text: "Air purifier set to 40%", time: "18:20" },
    ],
  };
}
export const clamp = (v, min, max) =>
  Math.max(min, Math.min(max, Number(v) || 0));
export function setDevice(state, id, patch) {
  const d = state.devices.find((d) => d.id === id);
  if (!d || !d.online) return false;
  if (typeof patch.on === "boolean") d.on = patch.on;
  if (Number.isFinite(Number(patch.level)) && d.level !== undefined)
    d.level = clamp(patch.level, 0, 100);
  state.activeScene = null;
  return true;
}
export function applyScene(state, id) {
  const scene = scenes.find((s) => s.id === id);
  if (!scene) return false;
  for (const [id, patch] of Object.entries(scene.patch))
    setDevice(state, id, patch);
  state.target = scene.temp;
  state.climateOn = true;
  state.activeScene = id;
  return true;
}
export function watts(state) {
  return Math.round(
    state.devices.reduce(
      (sum, d) =>
        sum +
        (d.online && d.on
          ? d.watts * (d.type === "light" ? d.level / 100 : 1)
          : 0),
      0,
    ) + (state.climateOn ? 320 : 0),
  );
}
export function statusText(d) {
  if (!d.online) return "Offline";
  if (d.type === "lock") return d.on ? "Locked" : "Unlocked";
  if (d.type === "blinds") return d.level === 0 ? "Closed" : `${d.level}% open`;
  return d.on ? "On" : "Off";
}
let routineSequence = 0;
export function createRoutine(state, data) {
  if (
    !String(data.name || "").trim() ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time) ||
    !scenes.some((s) => s.id === data.scene)
  )
    return false;
  state.routines.push({
    id: "routine-" + Date.now() + "-" + ++routineSequence,
    name: String(data.name).trim().slice(0, 60),
    time: data.time,
    days: data.days === "Weekdays" ? "Weekdays" : "Every day",
    scene: data.scene,
    enabled: true,
  });
  return true;
}
export const energy = {
  week: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    data: [8.1, 7.2, 8.8, 6.9, 7.5, 9.1, 6.8],
  },
  day: {
    labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00"],
    data: [0.5, 0.4, 1.6, 1.1, 1.8, 1.4],
  },
};
export const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
