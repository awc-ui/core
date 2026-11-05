import { RenderError } from './native-render.mjs';

// Native dispatch metadata is separate from the source component detail payload.
export function nativeEventMetadata(event) {
  const result = {};
  const invalid = () => { throw new RenderError(502, 'INVALID_LIVE_FRAME', 'The native renderer returned invalid event metadata.'); };
  if (Object.hasOwn(event, 'defaultPrevented')) {
    if (typeof event.defaultPrevented !== 'boolean') invalid();
    result.defaultPrevented = event.defaultPrevented;
  }
  if (Object.hasOwn(event, 'propagationPath')) {
    if (!Array.isArray(event.propagationPath) || event.propagationPath.length > 64 || event.propagationPath.some(id => typeof id !== 'string' || id.length > 256)) invalid();
    result.propagationPath = [...event.propagationPath];
  }
  if (Object.hasOwn(event, 'activation')) {
    const activation = event.activation;
    if (!activation || typeof activation !== 'object' || Array.isArray(activation)) invalid();
    result.activation = {};
    // Swift actions carry an identity and entry kind; Compose can report the
    // observed input source/coordinates without inventing those Swift fields.
    if (Object.hasOwn(activation, 'id') || Object.hasOwn(activation, 'kind')) {
      if (typeof activation.id !== 'string' || !activation.id.length || activation.id.length > 256 || !['nativeControl', 'programmatic', 'implicitSubmit'].includes(activation.kind)) invalid();
      Object.assign(result.activation, { id: activation.id, kind: activation.kind });
    } else if (!Object.hasOwn(activation, 'source')) invalid();
    if (Object.hasOwn(activation, 'source')) {
      if (!['pointer', 'keyboard', 'accessibility', 'unknown'].includes(activation.source)) invalid();
      result.activation.source = activation.source;
    }
    for (const coordinate of ['x', 'y']) if (Object.hasOwn(activation, coordinate)) {
      if (typeof activation[coordinate] !== 'number' || !Number.isFinite(activation[coordinate]) || Math.abs(activation[coordinate]) > 16384) invalid();
      result.activation[coordinate] = activation[coordinate];
    }
  }
  return result;
}
