/**
 * Shared harness for spec-testing the chart ENGINES (pie/bar/line), as opposed
 * to the pure layout maths that already has its own specs.
 *
 * The engines build their own canvas and read the container's geometry, and
 * mock-doc supplies neither: `getBoundingClientRect()` is all zeros (so every
 * render bails before it draws) and the 2D context is an inert stub that
 * records nothing. This installs both.
 *
 * Not named `*.spec.ts` on purpose — the coverage config's testRegex would
 * otherwise report this file as a suite containing no tests.
 */

export type CanvasCall = { op: string; args: unknown[] };

/** Canvas2D style properties, pre-seeded so reads return what was assigned
 *  rather than being auto-stubbed into a recorder function. */
const STYLE_PROPS: Record<string, unknown> = {
  fillStyle: '#000',
  strokeStyle: '#000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  filter: 'none',
  lineDashOffset: 0,
  shadowBlur: 0,
  shadowColor: 'transparent',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  imageSmoothingEnabled: true,
};

export type RecordingCtx = CanvasRenderingContext2D & {
  calls: CanvasCall[];
  /** Ops in call order — handy for asserting paint ORDER, not just presence. */
  ops: () => string[];
  /** Every call for one op. */
  callsTo: (op: string) => CanvasCall[];
  reset: () => void;
};

/**
 * A 2D context that records every method call. Any method the renderer reaches
 * for is auto-stubbed on first use, so this keeps working as the engines grow
 * new drawing calls instead of failing with "not a function".
 */
export function recordingCtx(width = 400, height = 300): RecordingCtx {
  const calls: CanvasCall[] = [];
  const gradient = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    ...STYLE_PROPS,
    calls,
    canvas: { width, height },
    ops: () => calls.map((c) => c.op),
    callsTo: (op: string) => calls.filter((c) => c.op === op),
    reset: () => {
      calls.length = 0;
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
    createPattern: () => null,
    measureText: (t: unknown) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
  };

  return new Proxy(target, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      // Unknown member: assume it's a drawing call and record it.
      const fn = (...args: unknown[]) => {
        calls.push({ op: prop, args });
      };
      t[prop] = fn;
      return fn;
    },
    set(t, prop: string, value) {
      t[prop] = value;
      return true;
    },
  }) as unknown as RecordingCtx;
}

/** A container the engines can measure, since mock-doc rects are all zeros. */
export function makeChartContainer(width = 400, height = 300): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/**
 * Point every canvas the engine creates at one recording context, and give it a
 * `toDataURL`. Returns the context plus a restore fn; call it in `afterEach`.
 */
export function installCanvas(width = 400, height = 300): {
  ctx: RecordingCtx;
  restore: () => void;
} {
  const ctx = recordingCtx(width, height);
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const prevGetContext = Object.getOwnPropertyDescriptor(proto, 'getContext');
  const prevToDataURL = Object.getOwnPropertyDescriptor(proto, 'toDataURL');
  proto.getContext = () => ctx;
  proto.toDataURL = (type?: string) => `data:${type ?? 'image/png'};base64,TEST`;
  return {
    ctx,
    restore: () => {
      if (prevGetContext) Object.defineProperty(proto, 'getContext', prevGetContext);
      else delete proto.getContext;
      if (prevToDataURL) Object.defineProperty(proto, 'toDataURL', prevToDataURL);
      else delete proto.toDataURL;
    },
  };
}

/**
 * Run rAF callbacks to completion so intro/hover/drill animations finish
 * instead of leaving the engine mid-flight. Each engine schedules the next
 * frame from inside the current one, so this drains iteratively with a cap.
 */
export async function flushFrames(max = 240): Promise<void> {
  for (let i = 0; i < max; i++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

/** Resolve after one frame. */
export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));
