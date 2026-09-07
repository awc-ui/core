// Fictional train movements in schematic coordinates, not a transit data feed.
import { stations } from "./model.mjs";

export const TRAIN_SPEED = 28;
export const STATION_DWELL = 1.8;
export const TERMINAL_DWELL = 2.8;
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const point = (x, y) => ({ x, y });

function quadratic(start, control, end) {
  return Array.from({ length: 24 }, (_, i) => {
    const t = (i + 1) / 24;
    return point(
      (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
      (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y,
    );
  });
}

function makeRoute(id, path, points, stationIds) {
  let total = 0;
  const samples = points.map((p, i) => {
    if (i > 0) total += distance(points[i - 1], p);
    return { ...p, distance: total };
  });
  const stops = stationIds.map((stationId) => {
    const station = stations.find((s) => s.id === stationId);
    let nearest = { distance: 0, error: Infinity };
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1];
      const b = samples[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fraction = Math.max(
        0,
        Math.min(
          1,
          ((station.x - a.x) * dx + (station.y - a.y) * dy) /
            (dx * dx + dy * dy),
        ),
      );
      const error = Math.hypot(
        station.x - a.x - dx * fraction,
        station.y - a.y - dy * fraction,
      );
      if (error < nearest.error)
        nearest = {
          distance: a.distance + (b.distance - a.distance) * fraction,
          error,
        };
    }
    return { id: station.id, name: station.name, distance: nearest.distance };
  });
  const phases = [];
  let duration = 0;
  const add = (from, to, direction, dwelling) => {
    const seconds = dwelling
      ? from === 0 || from === stops.length - 1
        ? TERMINAL_DWELL
        : STATION_DWELL
      : Math.abs(stops[to].distance - stops[from].distance) / TRAIN_SPEED;
    phases.push({
      from,
      to,
      direction,
      dwelling,
      start: duration,
      end: duration + seconds,
    });
    duration += seconds;
  };
  for (let i = 0; i < stops.length; i++) {
    add(i, i, i === stops.length - 1 ? -1 : 1, true);
    if (i < stops.length - 1) add(i, i + 1, 1, false);
  }
  for (let i = stops.length - 1; i > 0; i--) {
    if (i < stops.length - 1) add(i, i, -1, true);
    add(i, i - 1, -1, false);
  }
  return { id, path, samples, stops, phases, duration, length: total };
}

const gardenPoints = [
  point(82, 58),
  point(220, 58),
  ...quadratic(point(220, 58), point(245, 58), point(265, 80)),
  point(302, 117),
  ...quadratic(point(302, 117), point(316, 130), point(330, 130)),
  ...quadratic(point(330, 130), point(344, 130), point(357, 117)),
  point(395, 80),
  ...quadratic(point(395, 80), point(418, 58), point(440, 58)),
  point(672, 58),
];

export const movementRoutes = [
  makeRoute(
    "M1",
    "M82 230 H672",
    [point(82, 230), point(672, 230)],
    ["ST01", "ST02", "ST03", "ST04", "ST05", "ST06"],
  ),
  makeRoute(
    "M2",
    "M330 42 V325 H500",
    [point(330, 42), point(330, 325), point(500, 325)],
    ["ST07", "ST08", "ST03", "ST09", "ST10"],
  ),
  makeRoute(
    "M3",
    "M82 58 H220 Q245 58 265 80 L302 117 Q316 130 330 130 Q344 130 357 117 L395 80 Q418 58 440 58 H672",
    gardenPoints,
    ["ST11", "ST12", "ST08", "ST13", "ST14", "ST15"],
  ),
];

export const simulatedTrains = movementRoutes.flatMap((route) => [
  {
    id: `${route.id}-A`,
    line: route.id,
    label: `${route.id.slice(1)}A`,
    offset: 0.08 * route.duration,
  },
  {
    id: `${route.id}-B`,
    line: route.id,
    label: `${route.id.slice(1)}B`,
    offset: 0.58 * route.duration,
  },
]);

export function pointAlongRoute(route, position) {
  const value = Math.max(0, Math.min(route.length, position));
  const end = route.samples.findIndex((sample) => sample.distance >= value);
  const b = route.samples[Math.max(1, end)];
  const a = route.samples[Math.max(0, end - 1)];
  const fraction = (value - a.distance) / (b.distance - a.distance || 1);
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

export function trainAtTime(route, elapsed, offset = 0) {
  const time =
    (((elapsed + offset) % route.duration) + route.duration) % route.duration;
  const phase = route.phases.find((p) => time < p.end) || route.phases[0];
  const from = route.stops[phase.from];
  const to = route.stops[phase.to];
  const progress = (time - phase.start) / (phase.end - phase.start);
  const position = phase.dwelling
    ? from.distance
    : from.distance + (to.distance - from.distance) * progress;
  const next = phase.dwelling ? route.stops[phase.from + phase.direction] : to;
  return {
    ...pointAlongRoute(route, position),
    position,
    dwelling: phase.dwelling,
    direction: phase.direction,
    current: from,
    next,
    destination:
      route.stops[phase.direction === 1 ? route.stops.length - 1 : 0],
  };
}

export function advanceSimulationTime(elapsed, milliseconds, speed, running) {
  return running
    ? elapsed + (Math.max(0, milliseconds) / 1000) * speed
    : elapsed;
}
