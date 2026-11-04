import { RenderError } from './native-render.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit;
const measurement = (value, minimum = 0, maximum = 16384) => Number.isFinite(value) && value >= minimum && value <= maximum;
// Layout may legitimately extend far beyond the captured bitmap (signed
// margins, scrolling, transformed or clipped parts). The frame's pixel cap
// must not clamp or reject those truthful logical measurements.
const coordinateLimit = Number.MAX_SAFE_INTEGER;

function validateMetrics(value, fontUnit, invalid) {
  if (!record(value)) invalid();
  const metrics = {};
  for (const key of ['padding', 'margin', 'border']) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key]) || value[key].length !== 4 ||
        !value[key].every(number => measurement(number, key === 'margin' ? -coordinateLimit : 0, coordinateLimit))) invalid();
    metrics[key] = [...value[key]];
  }
  if (value.gap !== undefined) {
    if (!record(value.gap) || !measurement(value.gap.row, 0, coordinateLimit) || !measurement(value.gap.column, 0, coordinateLimit)) invalid();
    metrics.gap = { row: value.gap.row, column: value.gap.column };
  }
  if (value.typography !== undefined) {
    const type = value.typography;
    if (!record(type) || !measurement(type.size) || type.size === 0 || !measurement(type.lineHeight) ||
        !measurement(type.weight, 1) || type.weight > 1000 || !measurement(type.spacing, -16384) ||
        !text(type.family, 256) || type.unit !== fontUnit) invalid();
    metrics.typography = { size: type.size, lineHeight: type.lineHeight, weight: type.weight,
      spacing: type.spacing, family: type.family, unit: type.unit };
  }
  if (value.display !== undefined) {
    if (!text(value.display, 64)) invalid();
    metrics.display = value.display;
  }
  if (value.direction !== undefined) {
    if (!['ltr', 'rtl'].includes(value.direction)) invalid();
    metrics.direction = value.direction;
  }
  return metrics;
}

/** Only native layout metadata travels with a capture; browser CSS is not a substitute. */
export function validateNativeInspection(value, platform) {
  if (value === undefined) return undefined; // Older hosts remain usable.
  const expected = platform === 'android'
    ? { unit: 'dp', source: 'Compose layout' }
    : { unit: 'pt', source: 'SwiftUI layout' };
  const invalid = () => { throw new RenderError(502, 'INVALID_LIVE_FRAME', 'The native renderer returned invalid layout measurements.'); };
  if (!record(value) || value.version !== 1 || value.unit !== expected.unit || value.source !== expected.source
    || !Array.isArray(value.nodes) || value.nodes.length > 128) invalid();
  const ids = new Set();
  const nodes = value.nodes.map(node => {
    if (!record(node) || !text(node.id, 128) || ids.has(node.id) || !text(node.name, 256) || !record(node.bounds)) invalid();
    ids.add(node.id);
    const bounds = {};
    for (const key of ['x', 'y', 'width', 'height']) {
      const number = node.bounds[key];
      if (!Number.isFinite(number) || Math.abs(number) > coordinateLimit || (['width', 'height'].includes(key) && number < 0)) invalid();
      bounds[key] = number;
    }
    const result = { id: node.id, name: node.name, bounds };
    if (node.parentId !== undefined) {
      if (!text(node.parentId, 128) || node.parentId === node.id) invalid();
      result.parentId = node.parentId;
    }
    if (node.metrics !== undefined) result.metrics = validateMetrics(node.metrics, platform === 'android' ? 'sp' : 'pt', invalid);
    return result;
  });
  const byId = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    const ancestors = new Set([node.id]);
    for (let parent = node.parentId; parent !== undefined; parent = byId.get(parent).parentId) {
      if (!byId.has(parent) || ancestors.has(parent)) invalid();
      ancestors.add(parent);
    }
  }
  return { version: 1, ...expected, nodes };
}
