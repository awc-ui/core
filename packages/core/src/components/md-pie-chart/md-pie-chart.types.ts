/**
 * Single slice in a pie chart. Pie charts are categorical
 * (one ring of slices) rather than series-based — each
 * `MdPieDatum` is one slice.
 *
 * A slice may carry `children`, which are drawn as a second ring outside it,
 * subdividing exactly its own arc — a breakdown of a breakdown, like browser
 * versions inside browser families. Nesting is arbitrary depth; the radial band
 * is split evenly between the levels.
 *
 * Declared in a dedicated module (rather than inline in the component
 * `.tsx`) so the Angular wrapper generator resolves it as an `import`
 * reference. Inline component-local types are emitted incorrectly as a
 * generic type argument by `@stencil/angular-output-target`.
 */
export interface MdPieDatum {
  /** Slice label (used in legend, tooltip, a11y). */
  label: string;
  /** Slice value — proportional to the slice's angle. */
  value: number;
  /** Slice colour (MD3 role or raw CSS colour). */
  color?: string;
  /** Stable identifier (returned in click events). */
  id?: string;
  /** Whether this slice is "selected" (exploded outward). */
  selected?: boolean;
  /**
   * Hide this slice — it keeps its legend chip (struck through, so it can be
   * brought back) but contributes nothing to the ring.
   *
   * Setting it makes visibility YOURS: the chart otherwise remembers the
   * reader's own legend toggles across data updates, and an explicit value here
   * overrides that.
   */
  hidden?: boolean;
  /**
   * How far this slice reaches, 0..1 of the chart's outer radius — a SECOND
   * dimension on top of the angle. Population density against land area, say:
   * the angle is how big a country is, the radius how densely it is populated.
   *
   * Omitted means full radius, so a chart where only some slices set it still
   * makes sense. Values are clamped, and a floor keeps a tiny one visible: a
   * slice drawn at zero radius is indistinguishable from missing data.
   */
  radius?: number;
  /**
   * Slices drawn in a ring outside this one, dividing its own arc between them.
   * Their values are taken in proportion to each other, so they do not have to
   * add up to the parent's value — a parent whose children fall short is not
   * silently redrawn smaller than the number it reports.
   */
  children?: MdPieDatum[];
}
