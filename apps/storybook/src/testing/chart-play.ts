/**
 * Shared interaction test for the chart stories.
 * ===========================================================
 * Every chart story runs one of these. The point is NOT to re-test the engine
 * — the unit specs own its geometry, and the test-runner already renders every
 * story and runs axe on it. The point is that each CONFIGURATION actually comes
 * up: a story is a set of props, and a set of props can be wrong in ways a
 * spec never sees (a prop that never reaches the engine, a render path that
 * throws only for this combination, a legend that draws no chips for this data).
 *
 * So the shared body asks the questions that are worth asking of every
 * configuration and nothing more: is it alive, did it paint, does what it
 * announces match what it was given. Stories with behaviour of their own pass
 * `extra` and add to it rather than replacing it.
 * ===========================================================
 */
import { expect, waitFor } from "storybook/test";
import { drivingCoverage } from "./coverage-mode";

/** The chart methods every one of these components exposes. */
export type ChartEl = HTMLElement & {
  getInstance(): Promise<unknown>;
  toDataURL(): Promise<string>;
  resize(): Promise<void>;
};

/** A chart that is hydrated AND has an engine — a pre-hydration click is a
 *  silent no-op, so neither on its own is proof it will respond. */
export const alive = async (el: ChartEl): Promise<ChartEl> => {
  await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));
  await waitFor(async () => expect(await el.getInstance()).not.toBeNull());
  return el;
};

/** Every chart in the story — several stories render a row of them. */
export const chartsIn = (canvasElement: HTMLElement): ChartEl[] =>
  Array.from(
    canvasElement.querySelectorAll(
      "md-pie-chart, md-line-chart, md-bar-chart, md-area-chart",
    ),
  ) as ChartEl[];

/** The canvas the engine paints into, and the count of pixels it has touched.
 *  Reading the bitmap is the only way to tell "rendered" from "rendered blank",
 *  which is what a prop that silently failed to apply looks like. */
const painted = (el: ChartEl): number => {
  const cv = el.shadowRoot?.querySelector("canvas") as HTMLCanvasElement | null;
  if (!cv || !cv.width) return 0;
  const img = cv.getContext("2d")!.getImageData(0, 0, cv.width, cv.height).data;
  let on = 0;
  // Every 4th pixel. Coarser missed a chart that is only just starting to draw
  // — a race parked on its first year is a hairline, not a blank canvas — and
  // reporting that as "painted nothing" is a false alarm, not a finding.
  for (let i = 3; i < img.length; i += 16) if (img[i] > 20) on++;
  return on;
};

export interface ChartPlayOptions {
  /** This story deliberately paints nothing (empty state, loading). */
  blank?: boolean;
  /**
   * This story shows the built-in EMPTY STATE.
   *
   * NOT the same as `blank`. A chart with no series still paints its axes and
   * gridlines; the empty state is a DOM overlay (`part="empty"`), not an
   * unpainted canvas. Measured on md-line-chart: ~1200 sample pixels at alpha
   * 160 — exactly the grid. `blank` asserted a belief the components have never
   * held, and only surfaced now because these tests had never run.
   */
  empty?: boolean;
  /**
   * This story has no meaningful opening state — assert only that it is alive.
   *
   * A race is parked on its first year until you start it: whether that year
   * has reached the canvas, and whether it has anything to put in the
   * screen-reader table, are both a coin toss at the moment the test looks.
   * Asserting either way makes a flaky test out of a story that is behaving
   * correctly, so such a story asserts what it is FOR in `extra` instead.
   */
  settling?: boolean;
  /**
   * Skip the generic render-path exercise.
   *
   * Only for stories where flipping props would contradict what the story is
   * demonstrating (an empty/loading state, or one asserting an exact visual).
   */
  skipExercise?: boolean;

  /** Extra steps for behaviour only this story has. */
  extra?: (ctx: {
    charts: ChartEl[];
    canvasElement: HTMLElement;
    step: Step;
  }) => Promise<void>;
}

type Step = (name: string, fn: () => Promise<void>) => Promise<void>;

/**
 * The play function for a chart story.
 *
 * ```ts
 * export const Donut: Story = { render: …, play: chartPlay() };
 * export const Race: Story  = { render: …, play: chartPlay({ extra: async ({ charts }) => { … } }) };
 * ```
 */
export const chartPlay =
  ({ blank, empty, settling, extra, skipExercise }: ChartPlayOptions = {}) =>
  async ({
    canvasElement,
    step,
  }: {
    canvasElement: HTMLElement;
    step: Step;
  }) => {
    // Wait for the chart elements to EXIST before capturing them. Querying
    // synchronously at the start of play() races the story's own render: a
    // story that builds its markup in a closure (drill-down keeps a path and
    // re-renders) can have zero charts in the DOM for the first frame. That
    // showed up as "expected 0 to be greater than 0" failing in 16ms under
    // parallel load while passing in isolation — a race, not a broken chart.
    await waitFor(() =>
      expect(chartsIn(canvasElement).length).toBeGreaterThan(0),
    );
    const charts = chartsIn(canvasElement);

    await step("every chart in the story comes up with an engine", async () => {
      for (const el of charts) await alive(el);
    });

    if (empty) {
      await step("it shows its empty state", async () => {
        for (const el of charts) {
          await waitFor(() =>
            expect(el.shadowRoot?.querySelector('[part="empty"]')).toBeTruthy(),
          );
        }
      });
    }

    if (!settling && !empty) {
      await step(
        blank ? "it deliberately paints nothing" : "it paints something",
        async () => {
          // SOME chart, not every one: a story that renders several may include an
          // empty one on purpose — a locale row showing what "no data" looks like
          // — and requiring all of them to paint makes the test wrong rather than
          // the story. Waited for, not read once, since an engine that exists has
          // not necessarily drawn yet.
          if (blank)
            await waitFor(() =>
              expect(charts.every((el) => painted(el) === 0)).toBe(true),
            );
          else
            await waitFor(() =>
              expect(charts.some((el) => painted(el) > 0)).toBe(true),
            );
        },
      );
    }

    await step(
      "it hands back a real frame, and survives being resized",
      async () => {
        for (const el of charts) {
          expect((await el.toDataURL()).startsWith("data:image/")).toBe(true);
          await el.resize();
          expect(await el.getInstance()).not.toBeNull();
        }
      },
    );

    if (!settling && !empty) {
      await step(
        "the screen-reader table says what the chart shows",
        async () => {
          if (blank) return;
          // Again, one is enough — the empty chart in a row of them has nothing
          // to tabulate, and that is the right answer for it.
          //
          // Waited for, like every other assertion here. This one read the table
          // ONCE, so a story that re-renders on interaction (drill-down rebuilds
          // its chart as you descend) could be caught between renders with the
          // tbody momentarily empty — passing alone and failing under parallel
          // load, which is the signature of a read-once assertion, not a bug.
          await waitFor(() => {
            const rows = charts.map(
              (el) =>
                el.shadowRoot
                  ?.querySelector("table")
                  ?.querySelectorAll("tbody tr").length ?? 0,
            );
            expect(Math.max(...rows)).toBeGreaterThan(0);
          });
        },
      );
    }

    if (extra)
      await step("what this story does that the others do not", () =>
        extra({ charts, canvasElement, step }),
      );

    // ONLY under the coverage sweep. play() runs whenever a story is VIEWED, so
    // flipping props here made every chart visibly flicker through stacked /
    // polar / inverted / curve variants before settling — a regression for
    // anyone browsing Storybook. The sweep opts in explicitly via a URL flag.
    if (!skipExercise && drivingCoverage()) {
      await step("it survives its render paths being toggled", () =>
        exerciseRenderPaths(charts),
      );
    }
  };

/**
 * Toggle the props that select different rendering paths, then put them back.
 *
 * Chart stories mounted a chart and asserted it painted, which exercises ONE
 * path through the engine — the four chart files plus engine/bar-chart.ts held
 * ~700 uncovered lines between them despite every chart having stories. Stacking,
 * polar/horizontal layouts, curve modes, value labels, grids and zoom are all
 * separate branches that no story ever reached.
 *
 * Only props the element actually declares are touched, so one list serves bar,
 * line and area. Values are restored afterwards: this runs last, but a story
 * left in a flipped state would still mislead anyone who opens it.
 */

const RENDER_PATH_PROPS: Array<[string, unknown]> = [
  ["stack", true],
  ["showLabels", true],
  ["showTotals", true],
  ["grid", false],
  ["legend", false],
  ["tooltip", false],
  ["inverted", true],
  ["polar", true],
  ["area", true],
  ["showLine", false],
  ["showMarks", true],
  ["curve", "monotone"],
  ["layout", "horizontal"],
  ["axisTicks", false],
  ["noAnimation", true],
];

const exerciseRenderPaths = async (charts: ChartEl[]) => {
  for (const el of charts) {
    const target = el as unknown as Record<string, unknown>;
    const restore: Array<[string, unknown]> = [];
    for (const [prop, value] of RENDER_PATH_PROPS) {
      if (!(prop in target)) continue;
      restore.push([prop, target[prop]]);
      target[prop] = value;
      // One frame per flip so the engine re-runs rather than batching them into
      // a single render, which would exercise far fewer paths.
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }
    // A chart must still hand back a frame after all that.
    expect((await el.toDataURL()).startsWith("data:image/")).toBe(true);
    for (const [prop, value] of restore) target[prop] = value;
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  }
};
