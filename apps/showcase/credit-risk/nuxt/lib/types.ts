/**
 * Shapes shared between a screen and the components it composes.
 *
 * `<script setup>` cannot contain ES module exports — type-only ones included —
 * so anything two SFCs need to agree on lives here rather than in whichever
 * component happened to declare it first.
 */

export interface Crumb {
  label: string;
  /** Root-relative path WITHOUT the base path. Omit on the final crumb. */
  href?: string;
}

export interface ChartSeries {
  label: string;
  data?: (number | null)[];
  id?: string;
  /** Which entry of `yAxes` measures this series. Omit for the first axis. */
  yAxisIndex?: number;
}

export interface OrgNode {
  id: string;
  name: string;
  title?: string;
  avatarInitials?: string;
  children?: OrgNode[];
}
