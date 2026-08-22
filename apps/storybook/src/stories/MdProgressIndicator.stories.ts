import type { Meta, StoryObj } from "@storybook/web-components";
import { expect, waitFor } from "storybook/test";
import { drivingCoverage, exerciseProps } from "../testing/coverage-mode";
import { html, render as litRender } from "lit";
import { keyed } from "lit/directives/keyed.js";
import "@awc-ui/core/define";
import { t } from "../i18n";

const meta: Meta = {
  title: "Communication/Progress Indicator",
  component: "md-progress-indicator",
  tags: ["autodocs"],
  parameters: {
    docs: {
      source: { language: "html" },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["linear", "circular"],
      description: "Visual variant",
    },
    value: {
      control: { type: "range", min: 0, max: 100 },
      description: "Current progress (0–100)",
    },
    max: {
      control: "number",
      description: "Maximum value",
    },
    indeterminate: {
      control: "boolean",
      description: "Indeterminate mode (unknown progress)",
    },
    thickness: {
      control: { type: "range", min: 2, max: 16 },
      description: "Track / stroke thickness in dp",
    },
    wave: {
      control: "boolean",
      description: "Enable the wavy (M3 Expressive) active indicator",
    },
    waveAmplitude: {
      control: { type: "range", min: 0, max: 10 },
      description:
        "Wave amplitude (center-to-peak), dp. 0 = auto (linear 3, circular 1.6)",
    },
    waveLength: {
      control: { type: "range", min: 0, max: 80 },
      description:
        "Wavelength (peak-to-peak), dp. 0 = auto (linear 40 det+indet, circular 15)",
    },
    waveSpeed: {
      control: { type: "range", min: 0, max: 160 },
      description:
        "Wave travel speed, dp/sec. 0 = auto (= wavelength, ~1 wave/sec)",
    },
    size: {
      control: { type: "range", min: 0, max: 96 },
      description: "Circular size, dp. 0 = auto (non-wavy 40, wavy 48)",
    },
    fourColor: {
      control: "boolean",
      description: "Four-color cycling (circular indeterminate)",
    },
    label: {
      control: "text",
      description: "Accessible label",
    },
  },
  args: {
    variant: "linear",
    value: 60,
    max: 100,
    indeterminate: false,
    thickness: 4,
    wave: false,
    waveAmplitude: 0,
    waveLength: 0,
    waveSpeed: 0,
    size: 0,
    fourColor: false,
    label: "Progress",
  },
};
export default meta;
type Story = StoryObj;

/* ── play() helpers ─────────────────────────────────────────
 * testing-library queries can't cross shadow roots, so play()
 * interactions address the component and its shadowRoot directly.
 * Mirrors the Stencil-hydration gate used across the other stories. */
type ProgressEl = HTMLElement & {
  value: number;
  max: number;
  variant: "linear" | "circular";
  indeterminate: boolean;
  wave: boolean;
  thickness: number;
  complete: boolean;
};
const getProgress = async (
  canvasElement: HTMLElement,
  index = 0,
): Promise<ProgressEl> => {
  const el = canvasElement.querySelectorAll("md-progress-indicator")[
    index
  ] as ProgressEl;
  await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));
  return el;
};

/* ── Playground ─────────────────────────────────────────── */

export const Playground: Story = {
  render: (args) => html`
    <div style="width: 320px;">
      <md-progress-indicator
        variant=${args.variant}
        value=${args.value}
        max=${args.max}
        ?indeterminate=${args.indeterminate}
        thickness=${args.thickness}
        ?wave=${args.wave}
        wave-amplitude=${args.waveAmplitude}
        wave-length=${args.waveLength}
        wave-speed=${args.waveSpeed}
        size=${args.size}
        ?four-color=${args.fourColor}
        label=${args.label}
      ></md-progress-indicator>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = await getProgress(canvasElement);

    // Baseline ARIA the component builds from role + label + value/max.
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.getAttribute("aria-label")).toBe("Progress");
    expect(el.getAttribute("aria-valuemin")).toBe("0");
    expect(el.getAttribute("aria-valuemax")).toBe("100");
    expect(el.getAttribute("aria-valuenow")).toBe("60");
    expect(el.classList.contains("md-progress-indicator--linear")).toBe(true);

    // Everything below MUTATES the live component, and play() runs on VIEW —
    // ungated, the reader watches the bar jump to 8px and flip indeterminate
    // before settling. Same gate (and same reason) as the block that follows.
    if (drivingCoverage()) {
      // A value change flows through the @Watch('value') → ariaValueNow render.
      el.value = 90;
      await waitFor(() => expect(el.getAttribute("aria-valuenow")).toBe("90"));

      // thickness runs onDimensionChange → syncHostStyles, which writes the
      // resolved dp onto the host's own inline custom property.
      el.thickness = 8;
      await waitFor(() =>
        expect(el.style.getPropertyValue("--_thickness")).toBe("8px"),
      );

      // max = 0 exercises the fraction `!this.max` guard and the ariaValueMax
      // sanitiser: the announced max is 0 and value clamps into [0, 0].
      el.max = 0;
      await waitFor(() => expect(el.getAttribute("aria-valuemax")).toBe("0"));
      expect(el.getAttribute("aria-valuenow")).toBe("0");

      // Indeterminate drops aria-valuenow entirely (unknown progress) and flags the host.
      el.max = 100;
      el.indeterminate = true;
      await waitFor(() => expect(el.hasAttribute("aria-valuenow")).toBe(false));
      expect(el.classList.contains("md-progress-indicator--indeterminate")).toBe(
        true,
      );

      // Restore the declarative baseline so the visual snapshot stays stable.
      el.indeterminate = false;
      el.thickness = 4;
      el.value = 60;
      await waitFor(() => expect(el.getAttribute("aria-valuenow")).toBe("60"));

      // variant / wave / four-colour / indeterminate each select a different
      // draw path, and none were reachable from a story.
      await exerciseProps(el, [
        ["indeterminate", true],
        ["indeterminate", false],
        ["variant", "circular"],
        ["variant", "linear"],
        ["wave", true],
        ["fourColor", true],
        ["size", "large"],
        ["thickness", 8],
        ["value", 0],
        ["value", 50],
        ["value", 100],
        ["complete", true],
      ]);
    }
  },
};

/* ── Linear Determinate ─────────────────────────────────── */

export const LinearDeterminate: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 24px; width: 320px;"
    >
      <md-progress-indicator value="0"></md-progress-indicator>
      <md-progress-indicator value="25"></md-progress-indicator>
      <md-progress-indicator value="50"></md-progress-indicator>
      <md-progress-indicator value="75"></md-progress-indicator>
      <md-progress-indicator value="100"></md-progress-indicator>
    </div>
  `,
};

/* ── Linear Indeterminate ───────────────────────────────── */

export const LinearIndeterminate: Story = {
  render: () => html`
    <div style="width: 320px;">
      <md-progress-indicator indeterminate></md-progress-indicator>
    </div>
  `,
};

/* ── Circular Determinate ───────────────────────────────── */

export const CircularDeterminate: Story = {
  render: () => html`
    <div style="display: flex; gap: 24px; align-items: center;">
      <md-progress-indicator
        variant="circular"
        value="0"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        value="25"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        value="50"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        value="75"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        value="100"
      ></md-progress-indicator>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = await getProgress(canvasElement, 2); // the value="50" ring
    expect(el.classList.contains("md-progress-indicator--circular")).toBe(true);
    expect(el.getAttribute("aria-valuenow")).toBe("50");

    const active = () =>
      el.shadowRoot?.querySelector(
        ".md-progress-indicator__circular-active",
      ) as SVGCircleElement | null;

    // Flat circular determinate paints its active arc as a dashed ring whose dash
    // length is the fraction (updateCircularFlat / declarative render) — ~0.5 here.
    await waitFor(() => {
      const da = active()?.getAttribute("stroke-dasharray") ?? "";
      expect(parseFloat(da)).toBeGreaterThan(0.4);
    });
    expect(
      parseFloat(active()?.getAttribute("stroke-dasharray") ?? "1"),
    ).toBeLessThan(0.6);

    // Raising the value wakes the rAF loop, which eases the sweep upward and
    // repaints the dash in lockstep — the arc grows past 0.8.
    el.value = 90;
    await waitFor(
      () =>
        expect(
          parseFloat(active()?.getAttribute("stroke-dasharray") ?? "0"),
        ).toBeGreaterThan(0.8),
      { timeout: 2500 },
    );

    el.value = 50; // restore for a stable visual snapshot
    await waitFor(() =>
      expect(
        parseFloat(active()?.getAttribute("stroke-dasharray") ?? "1"),
      ).toBeLessThan(0.6),
    );
  },
};

/* ── Circular Indeterminate ─────────────────────────────── */

export const CircularIndeterminate: Story = {
  render: () => html`
    <div style="display: flex; gap: 24px; align-items: center;">
      <md-progress-indicator
        variant="circular"
        indeterminate
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        indeterminate
        four-color
      ></md-progress-indicator>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Flat circular indeterminate (index 0).
    const el = await getProgress(canvasElement, 0);
    expect(el.getAttribute("role")).toBe("progressbar");
    expect(el.classList.contains("md-progress-indicator--indeterminate")).toBe(
      true,
    );
    // Indeterminate progress is unknown → no aria-valuenow announced.
    expect(el.hasAttribute("aria-valuenow")).toBe(false);

    // syncSpinnerTrackVars (reached via componentWillLoad → syncHostStyles for the
    // circular variant) precomputes the complement-track keyframe custom properties
    // on the host so the CSS spinner track can follow the rotating active arc.
    expect(el.style.getPropertyValue("--_spin-da-0").length).toBeGreaterThan(0);
    expect(el.style.getPropertyValue("--_spin-da-50").length).toBeGreaterThan(
      0,
    );
    expect(el.style.getPropertyValue("--_spin-do-100").length).toBeGreaterThan(
      0,
    );

    // The four-color variant (index 1) flags the host class that drives the
    // primary → primary-container → tertiary → tertiary-container colour cycle.
    const fourColor = await getProgress(canvasElement, 1);
    expect(
      fourColor.classList.contains("md-progress-indicator--four-color"),
    ).toBe(true);
  },
};

/* ── All Variants ───────────────────────────────────────── */

export const AllVariants: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 32px; padding: 24px; align-items: flex-start;"
    >
      <h3
        style="margin: 0; font: var(--md-sys-typescale-title-medium-font, 500 16px/24px Roboto);"
      >
        Linear
      </h3>
      <div
        style="width: 320px; display: flex; flex-direction: column; gap: 16px;"
      >
        <md-progress-indicator value="60"></md-progress-indicator>
        <md-progress-indicator indeterminate></md-progress-indicator>
      </div>

      <h3
        style="margin: 0; font: var(--md-sys-typescale-title-medium-font, 500 16px/24px Roboto);"
      >
        Circular
      </h3>
      <div style="display: flex; gap: 24px; align-items: center;">
        <md-progress-indicator
          variant="circular"
          value="60"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          indeterminate
        ></md-progress-indicator>
      </div>
    </div>
  `,
};

/* ── Thickness ──────────────────────────────────────────── */

export const Thickness: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 24px; padding: 24px;"
    >
      <h3 style="margin: 0;">Linear thickness</h3>
      <div
        style="width: 320px; display: flex; flex-direction: column; gap: 20px;"
      >
        <label style="font-size: 13px; color: #666;">thickness=2</label>
        <md-progress-indicator value="60" thickness="2"></md-progress-indicator>
        <label style="font-size: 13px; color: #666;"
          >thickness=4 (default)</label
        >
        <md-progress-indicator value="60" thickness="4"></md-progress-indicator>
        <label style="font-size: 13px; color: #666;">thickness=8</label>
        <md-progress-indicator value="60" thickness="8"></md-progress-indicator>
        <label style="font-size: 13px; color: #666;">thickness=12</label>
        <md-progress-indicator
          value="60"
          thickness="12"
        ></md-progress-indicator>
      </div>

      <h3 style="margin: 0;">Circular thickness</h3>
      <div style="display: flex; gap: 24px; align-items: center;">
        <md-progress-indicator
          variant="circular"
          value="60"
          thickness="2"
          size="48"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          value="60"
          thickness="4"
          size="48"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          value="60"
          thickness="6"
          size="48"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          value="60"
          thickness="8"
          size="48"
        ></md-progress-indicator>
      </div>
    </div>
  `,
};

/* ── Wavy Linear (animated) ─────────────────────────────── */

export const WavyLinear: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The wavy active indicator travels at ~1 wavelength/sec toward the leading edge, " +
          "and the amplitude animates in/out — flattening near 0% and ≥95% progress.",
      },
    },
  },
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 24px; width: 320px; padding: 24px;"
    >
      <h3 style="margin: 0;">
        Wavy — default (4px, amplitude 3, wavelength 40)
      </h3>
      <md-progress-indicator wave value="60"></md-progress-indicator>

      <h3 style="margin: 0;">Wavy — thick (8px)</h3>
      <md-progress-indicator
        wave
        value="60"
        thickness="8"
      ></md-progress-indicator>

      <h3 style="margin: 0;">Wavy — near 0%</h3>
      <md-progress-indicator wave value="6"></md-progress-indicator>

      <h3 style="margin: 0;">Wavy — near 100%</h3>
      <md-progress-indicator wave value="98"></md-progress-indicator>

      <h3 style="margin: 0;">Wavy — indeterminate (continuous, no pause)</h3>
      <md-progress-indicator wave indeterminate></md-progress-indicator>

      <h3 style="margin: 0;">
        Wavy — custom (amplitude 5, wavelength 60, faster)
      </h3>
      <md-progress-indicator
        wave
        value="50"
        wave-amplitude="5"
        wave-length="60"
        wave-speed="120"
      ></md-progress-indicator>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = await getProgress(canvasElement, 0); // wave value="60"
    expect(el.classList.contains("md-progress-indicator--wave")).toBe(true);

    // The wave+linear branch of syncHostStyles publishes the resolved wavelength
    // (default 40px) as a host custom property.
    await waitFor(() =>
      expect(el.style.getPropertyValue("--_wave-length-px")).toBe("40px"),
    );

    const wavePath = () =>
      el.shadowRoot?.querySelector(
        ".md-progress-indicator__linear-wave-path",
      ) as SVGPathElement | null;

    // A value change re-measures the layout width and repaints the filled SVG wave
    // path (updateLinearPath → buildLinearWaveSVGPath): a non-empty "M …" path.
    el.value = 85;
    await waitFor(
      () => {
        const d = wavePath()?.getAttribute("d") ?? "";
        expect(d.length).toBeGreaterThan(0);
        expect(d.startsWith("M")).toBe(true);
      },
      { timeout: 2500 },
    );

    el.value = 60; // restore for a stable visual snapshot
    await waitFor(() => expect(el.getAttribute("aria-valuenow")).toBe("60"));

    // Wavy linear INDETERMINATE (index 4): the rAF loop draws BOTH sweeping bars as
    // filled SVG wave paths each frame (updateLinearIndeterminate → buildLinearWaveSVGPath)
    // and masks the track under them (buildTrackMask writes an inline mask-image).
    const indetEl = await getProgress(canvasElement, 4);
    expect(indetEl.hasAttribute("aria-valuenow")).toBe(false);

    const indetTrack = () =>
      indetEl.shadowRoot?.querySelector(
        ".md-progress-indicator__track--full",
      ) as HTMLDivElement | null;
    const indetPaths = () =>
      Array.from(
        indetEl.shadowRoot?.querySelectorAll(
          ".md-progress-indicator__linear-wave-path",
        ) ?? [],
      ) as SVGPathElement[];

    // buildTrackMask writes an inline mask-image every frame → its presence proves
    // updateLinearIndeterminate is running the per-frame masked-track draw.
    await waitFor(
      () =>
        expect(
          (indetTrack()?.style.getPropertyValue("mask-image") ?? "").length,
        ).toBeGreaterThan(0),
      { timeout: 2500 },
    );
    // As a bar sweeps into view its wavy path gets a non-empty "M …" filled shape.
    await waitFor(
      () =>
        expect(
          indetPaths().some((p) => (p.getAttribute("d") ?? "").startsWith("M")),
        ).toBe(true),
      { timeout: 3000 },
    );
  },
};

/* ── Wavy Circular (animated, new) ──────────────────────── */

export const WavyCircular: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "M3 Expressive wavy circular indicator (48px, 15px wavelength snapped to an integer " +
          "number of waves, 1.6px amplitude). The wave travels around the ring and flattens at the endpoints.",
      },
    },
  },
  render: () => html`
    <div
      style="display: flex; gap: 32px; align-items: center; padding: 24px; flex-wrap: wrap;"
    >
      <md-progress-indicator
        variant="circular"
        wave
        value="25"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        wave
        value="50"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        wave
        value="75"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        wave
        value="50"
        size="72"
        thickness="6"
      ></md-progress-indicator>
      <md-progress-indicator
        variant="circular"
        wave
        indeterminate
      ></md-progress-indicator>
    </div>
  `,
  play: async ({ canvasElement }) => {
    // Wavy circular DETERMINATE (value=50, index 1): the rAF loop repaints the
    // active + track arcs as SVG <path>s each frame (updateCircularPath →
    // circularPaths → wavyArcPath / arcPath), not the flat variant's dashed <circle>.
    const det = await getProgress(canvasElement, 1);
    expect(det.getAttribute("aria-valuenow")).toBe("50");

    const activePath = () =>
      det.shadowRoot?.querySelector(
        ".md-progress-indicator__circular-active",
      ) as SVGPathElement | null;
    const trackPath = () =>
      det.shadowRoot?.querySelector(
        ".md-progress-indicator__circular-track",
      ) as SVGPathElement | null;

    // Mid-progress: a wavy active arc AND a gapped complement track arc are painted.
    await waitFor(() => {
      expect((activePath()?.getAttribute("d") ?? "").startsWith("M")).toBe(
        true,
      );
      expect((trackPath()?.getAttribute("d") ?? "").startsWith("M")).toBe(true);
    });

    // Near completion the leftover arc no longer fits both 4px gaps, so circularPaths
    // hides the track (trackEnd ≤ trackStart → empty d) while the active arc keeps
    // growing — exercises the other branch of the determinate track computation.
    det.value = 99;
    await waitFor(() => expect(trackPath()?.getAttribute("d")).toBe(""), {
      timeout: 2500,
    });
    expect((activePath()?.getAttribute("d") ?? "").startsWith("M")).toBe(true);

    det.value = 50; // restore for a stable visual snapshot
    await waitFor(() => expect(det.getAttribute("aria-valuenow")).toBe("50"));

    // Wavy circular INDETERMINATE (index 4): updateCircularPath's indeterminate branch
    // rotates the <g> wrapper (indeterminateRotation) and repaints the arc from the
    // eased sweep (indeterminateSweep). No known value → no aria-valuenow.
    const indet = await getProgress(canvasElement, 4);
    expect(indet.hasAttribute("aria-valuenow")).toBe(false);

    const indetActive = () =>
      indet.shadowRoot?.querySelector(
        ".md-progress-indicator__circular-active",
      ) as SVGPathElement | null;
    const rotG = () =>
      indet.shadowRoot?.querySelector("g") as SVGGElement | null;
    await waitFor(
      () => {
        expect((indetActive()?.getAttribute("d") ?? "").startsWith("M")).toBe(
          true,
        );
        expect(rotG()?.getAttribute("transform") ?? "").toContain("rotate");
      },
      { timeout: 2500 },
    );
  },
};

/* ── Wavy vs Flat comparison ────────────────────────────── */

export const WavyVsFlat: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 20px; width: 320px; padding: 24px;"
    >
      <h3 style="margin: 0;">Flat (default shape)</h3>
      <md-progress-indicator value="60" thickness="4"></md-progress-indicator>
      <md-progress-indicator value="60" thickness="8"></md-progress-indicator>

      <h3 style="margin: 0;">Wavy (expressive shape)</h3>
      <md-progress-indicator
        wave
        value="60"
        thickness="4"
      ></md-progress-indicator>
      <md-progress-indicator
        wave
        value="60"
        thickness="8"
      ></md-progress-indicator>

      <h3 style="margin: 0;">Circular: flat vs wavy</h3>
      <div style="display: flex; gap: 24px; align-items: center;">
        <md-progress-indicator
          variant="circular"
          value="60"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          wave
          value="60"
        ></md-progress-indicator>
      </div>
    </div>
  `,
};

/* ── Four-Color Circular ────────────────────────────────── */

export const FourColor: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Four-color cycle (circular indeterminate): primary → primary-container → tertiary → tertiary-container.",
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 32px; align-items: center; padding: 24px;">
      <div style="text-align: center;">
        <md-progress-indicator
          variant="circular"
          indeterminate
        ></md-progress-indicator>
        <div style="margin-top: 8px; font-size: 13px; color: #666;">
          Default
        </div>
      </div>
      <div style="text-align: center;">
        <md-progress-indicator
          variant="circular"
          indeterminate
          four-color
        ></md-progress-indicator>
        <div style="margin-top: 8px; font-size: 13px; color: #666;">
          Four-color
        </div>
      </div>
    </div>
  `,
};

/* ── Circular Sizes ─────────────────────────────────────── */

export const CircularSizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "M3 specifies a circular size range of **24 dp (minimum) to 240 dp (maximum)**. " +
          "The component clamps the `size` prop to this range — values below 24 snap up, values " +
          "above 240 snap down. Scale `thickness` in proportion; a good rule of thumb is " +
          "`thickness ≈ size / 10`.",
      },
    },
  },
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 32px; padding: 24px;"
    >
      <div>
        <p
          style="margin: 0 0 12px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Small — 24 dp (M3 minimum) to 64 dp
        </p>
        <div
          style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;"
        >
          <md-progress-indicator
            variant="circular"
            size="24"
            thickness="2"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="32"
            thickness="3"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="40"
            thickness="4"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="48"
            thickness="4"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="64"
            thickness="6"
            value="60"
          ></md-progress-indicator>
        </div>
      </div>
      <div>
        <p
          style="margin: 0 0 12px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Medium — 80 dp to 120 dp
        </p>
        <div
          style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;"
        >
          <md-progress-indicator
            variant="circular"
            size="80"
            thickness="7"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="96"
            thickness="8"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="120"
            thickness="10"
            value="60"
          ></md-progress-indicator>
        </div>
      </div>
      <div>
        <p
          style="margin: 0 0 12px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Large — 160 dp to 240 dp (M3 maximum). Reserve for large / extra-large
          windows.
        </p>
        <div
          style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;"
        >
          <md-progress-indicator
            variant="circular"
            size="160"
            thickness="14"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="200"
            thickness="16"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="240"
            thickness="20"
            value="60"
          ></md-progress-indicator>
        </div>
      </div>
      <div>
        <p
          style="margin: 0 0 12px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Clamping — values outside 24–240 dp are clamped. size="10" → 24 dp,
          size="300" → 240 dp.
        </p>
        <div style="display: flex; gap: 20px; align-items: center;">
          <md-progress-indicator
            variant="circular"
            size="10"
            thickness="2"
            value="60"
          ></md-progress-indicator>
          <md-progress-indicator
            variant="circular"
            size="300"
            thickness="20"
            value="60"
          ></md-progress-indicator>
        </div>
      </div>
    </div>
  `,
};

/* ── Circular with icon button ──────────────────────────── */

export const CircularWithIcon: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Circular indicator composed with an `md-icon-button` centred inside it using a " +
          "`position:relative` wrapper and `position:absolute; inset:0` on the button. " +
          "The button remains fully interactive — tap it to act on the current state " +
          "(cancel a download, pause/resume, play).",
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .circ-btn-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .circ-btn-wrap md-icon-button {
        position: absolute;
        inset: 0;
        margin: auto;
      }
    </style>
    <div
      style="display: flex; flex-direction: column; gap: 40px; padding: 24px;"
    >
      <div>
        <p
          style="margin: 0 0 16px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Determinate — stop (cancel download / upload)
        </p>
        <div
          style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;"
        >
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              value="60"
            ></md-progress-indicator>
            <md-icon-button
              icon="stop"
              aria-label=${t(globals.locale, "progress.stop")}
              size="xs"
            ></md-icon-button>
          </div>
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              wave
              value="60"
            ></md-progress-indicator>
            <md-icon-button
              icon="stop"
              aria-label=${t(globals.locale, "progress.stop")}
              size="xs"
            ></md-icon-button>
          </div>
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              size="72"
              thickness="6"
              value="60"
            ></md-progress-indicator>
            <md-icon-button
              icon="stop"
              aria-label=${t(globals.locale, "progress.stop")}
              size="sm"
            ></md-icon-button>
          </div>
        </div>
      </div>

      <div>
        <p
          style="margin: 0 0 16px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Indeterminate — pause (loading / cancel)
        </p>
        <div
          style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;"
        >
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              indeterminate
            ></md-progress-indicator>
            <md-icon-button
              icon="pause"
              aria-label=${t(globals.locale, "progress.pause")}
              size="xs"
            ></md-icon-button>
          </div>
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              wave
              indeterminate
            ></md-progress-indicator>
            <md-icon-button
              icon="pause"
              aria-label=${t(globals.locale, "progress.pause")}
              size="xs"
            ></md-icon-button>
          </div>
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              indeterminate
              size="72"
              thickness="6"
            ></md-progress-indicator>
            <md-icon-button
              icon="pause"
              aria-label=${t(globals.locale, "progress.pause")}
              size="sm"
            ></md-icon-button>
          </div>
        </div>
      </div>

      <div>
        <p
          style="margin: 0 0 16px; font-size: 13px; font-family: sans-serif; color: #444;"
        >
          Determinate — play (media buffering)
        </p>
        <div
          style="display: flex; gap: 32px; align-items: center; flex-wrap: wrap;"
        >
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              value="35"
            ></md-progress-indicator>
            <md-icon-button
              icon="play_arrow"
              aria-label=${t(globals.locale, "progress.play")}
              size="xs"
            ></md-icon-button>
          </div>
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              wave
              value="35"
            ></md-progress-indicator>
            <md-icon-button
              icon="play_arrow"
              aria-label=${t(globals.locale, "progress.play")}
              size="xs"
            ></md-icon-button>
          </div>
          <div class="circ-btn-wrap">
            <md-progress-indicator
              variant="circular"
              size="72"
              thickness="6"
              value="35"
            ></md-progress-indicator>
            <md-icon-button
              icon="play_arrow"
              aria-label=${t(globals.locale, "progress.play")}
              size="sm"
            ></md-icon-button>
          </div>
        </div>
      </div>
    </div>
  `,
};

/* ── RTL ────────────────────────────────────────────────── */

export const RTL: Story = {
  render: () => html`
    <div
      dir="rtl"
      style="display: flex; flex-direction: column; gap: 24px; padding: 24px;"
    >
      <h3 style="margin: 0;">RTL — Linear</h3>
      <div
        style="width: 320px; display: flex; flex-direction: column; gap: 16px;"
      >
        <md-progress-indicator value="60"></md-progress-indicator>
        <md-progress-indicator indeterminate></md-progress-indicator>
        <md-progress-indicator wave value="50"></md-progress-indicator>
      </div>

      <h3 style="margin: 0;">RTL — Circular</h3>
      <div style="display: flex; gap: 24px;">
        <md-progress-indicator
          variant="circular"
          value="60"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          indeterminate
        ></md-progress-indicator>
      </div>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const waveEl = await getProgress(canvasElement, 2); // wave value="50" under dir="rtl"
    // The inherited RTL direction is what computeRtl() reads to pick the mirrored
    // draw range in updateLinearPath.
    expect(getComputedStyle(waveEl).direction).toBe("rtl");

    const wavePath = () =>
      waveEl.shadowRoot?.querySelector(
        ".md-progress-indicator__linear-wave-path",
      ) as SVGPathElement | null;

    // A value change repaints the wave path via the RTL branch (draws at [W−fillX, W]).
    waveEl.value = 70;
    await waitFor(
      () =>
        expect((wavePath()?.getAttribute("d") ?? "").startsWith("M")).toBe(
          true,
        ),
      { timeout: 2500 },
    );

    // The flat linear indicator in the same RTL context still reports its raw value.
    const flatEl = await getProgress(canvasElement, 0);
    expect(flatEl.getAttribute("aria-valuenow")).toBe("60");

    waveEl.value = 50; // restore for a stable visual snapshot
    await waitFor(() =>
      expect(waveEl.getAttribute("aria-valuenow")).toBe("50"),
    );
  },
};

/* ── Dark Theme ─────────────────────────────────────────── */

export const DarkTheme: Story = {
  render: () => html`
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface, #1C1B1F); padding: 32px; border-radius: 16px; display: flex; flex-direction: column; gap: 24px; align-items: flex-start;"
    >
      <div
        style="width: 280px; display: flex; flex-direction: column; gap: 16px;"
      >
        <md-progress-indicator value="60"></md-progress-indicator>
        <md-progress-indicator indeterminate></md-progress-indicator>
        <md-progress-indicator wave value="60"></md-progress-indicator>
        <md-progress-indicator
          wave
          value="60"
          thickness="8"
        ></md-progress-indicator>
      </div>
      <div style="display: flex; gap: 24px;">
        <md-progress-indicator
          variant="circular"
          value="60"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          wave
          value="60"
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          indeterminate
        ></md-progress-indicator>
        <md-progress-indicator
          variant="circular"
          indeterminate
          four-color
        ></md-progress-indicator>
      </div>
    </div>
  `,
};

/* ── Custom CSS ─────────────────────────────────────────── */

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .error-progress {
        --md-progress-indicator-active-indicator-color: var(
          --md-sys-color-error,
          #b3261e
        );
        --md-progress-indicator-track-color: var(
          --md-sys-color-error-container,
          #f9dedc
        );
        --md-progress-indicator-stop-indicator-color: var(
          --md-sys-color-error,
          #b3261e
        );
      }
      .brand-progress {
        --md-progress-indicator-active-indicator-color: #6200ee;
        --md-progress-indicator-track-color: #e0d4f5;
        --md-progress-indicator-stop-indicator-color: #6200ee;
      }
      .success-progress {
        --md-progress-indicator-active-indicator-color: #2e7d32;
        --md-progress-indicator-track-color: #c8e6c9;
        --md-progress-indicator-stop-indicator-color: #2e7d32;
      }
    </style>
    <div
      style="display: flex; flex-direction: column; gap: 20px; width: 320px; padding: 24px;"
    >
      <label style="font-size: 13px; color: #666;">Default</label>
      <md-progress-indicator value="60"></md-progress-indicator>

      <label style="font-size: 13px; color: #666;">Error</label>
      <md-progress-indicator
        class="error-progress"
        value="60"
      ></md-progress-indicator>

      <label style="font-size: 13px; color: #666;">Brand</label>
      <md-progress-indicator
        class="brand-progress"
        value="60"
      ></md-progress-indicator>

      <label style="font-size: 13px; color: #666;">Success</label>
      <md-progress-indicator
        class="success-progress"
        value="60"
      ></md-progress-indicator>

      <label style="font-size: 13px; color: #666;">Inline override</label>
      <md-progress-indicator
        value="60"
        style="--md-progress-indicator-active-indicator-color: coral; --md-progress-indicator-track-color: #ffe0d0;"
      ></md-progress-indicator>
    </div>
  `,
};

/* ── CSS Parts ──────────────────────────────────────────── */

export const CSSParts: Story = {
  render: () => html`
    <style>
      /* Gradient fill — impossible with a single --active-indicator-color var */
      .gradient-indicator::part(active-indicator) {
        background: linear-gradient(to right, #1a237e, #7c4dff, #ce93d8);
      }
      /* Faded track — clearly shows the track element is being targeted */
      .faded-track::part(track) {
        opacity: 0.15;
      }
      /* Red square stop dot — color + shape change via ::part() */
      .error-stop::part(stop-indicator) {
        background-color: var(--md-sys-color-error, #b3261e);
        border-radius: 0;
      }
    </style>
    <div
      style="display: flex; flex-direction: column; gap: 20px; width: 320px; padding: 24px;"
    >
      <label style="font-size: 13px; color: #666;"
        >Gradient active indicator</label
      >
      <md-progress-indicator
        class="gradient-indicator"
        value="60"
      ></md-progress-indicator>

      <label style="font-size: 13px; color: #666;">Faded track</label>
      <md-progress-indicator
        class="faded-track"
        value="40"
      ></md-progress-indicator>

      <label style="font-size: 13px; color: #666;">Styled stop indicator</label>
      <md-progress-indicator
        class="error-stop"
        value="50"
      ></md-progress-indicator>
    </div>
  `,
};

/* ── States ─────────────────────────────────────────────── */

export const States: Story = {
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 16px; width: 320px; padding: 24px;"
    >
      <h3 style="margin: 0;">Empty (0%)</h3>
      <md-progress-indicator value="0"></md-progress-indicator>

      <h3 style="margin: 0;">Partial (40%)</h3>
      <md-progress-indicator value="40"></md-progress-indicator>

      <h3 style="margin: 0;">Complete (100%)</h3>
      <md-progress-indicator value="100"></md-progress-indicator>

      <h3 style="margin: 0;">Indeterminate</h3>
      <md-progress-indicator indeterminate></md-progress-indicator>

      <h3 style="margin: 0;">Wavy</h3>
      <md-progress-indicator wave value="60"></md-progress-indicator>

      <h3 style="margin: 0;">Wavy indeterminate</h3>
      <md-progress-indicator wave indeterminate></md-progress-indicator>
    </div>
  `,
};

/* ── Completion ("closing TV") animation ────────────────── */

type CompletionVariant = {
  key: string;
  label: string;
  variant: "linear" | "circular";
  wave: boolean;
};

const COMPLETION_VARIANTS: CompletionVariant[] = [
  { key: "lin", label: "Linear flat", variant: "linear", wave: false },
  { key: "lin-w", label: "Linear wave", variant: "linear", wave: true },
  { key: "circ", label: "Circular flat", variant: "circular", wave: false },
  { key: "circ-w", label: "Circular wave", variant: "circular", wave: true },
];

export const CompletionAnimation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Watch the full journey: press **Start** and each indicator fills 0 → 100 % over ~2.5 s, " +
          'then auto-fires the M3 "closing TV" completion animation, hides itself, and emits `mdComplete`. ' +
          "The completion is a sticky one-shot (the component never resets internally), so **Reset** " +
          "recreates fresh element nodes so it can be replayed.",
      },
    },
  },
  render: (_args, { globals }) => {
    // The story render() runs once; this host owns its own fill timer + a keyed
    // lit re-render loop. Manual litRender lets us recreate nodes on demand.
    const host = document.createElement("div");

    // gen bumps recreate every indicator via keyed() — the only way to replay a
    // sticky one-shot completion (complete=false is a no-op once it has fired).
    let gen = 0;
    let fillTimer: ReturnType<typeof setInterval> | null = null;
    let statusText = "Press Start to fill 0 → 100 %, then watch it close.";
    let doneLog: string[] = [];

    const indicators = (): HTMLElement[] =>
      Array.from(
        host.querySelectorAll("md-progress-indicator"),
      ) as HTMLElement[];

    const stopTimer = () => {
      if (fillTimer !== null) {
        clearInterval(fillTimer);
        fillTimer = null;
      }
    };

    const setStatus = (msg: string) => {
      statusText = msg;
      draw();
    };

    const onDone = (e: Event) => {
      const which =
        (e.target as HTMLElement).getAttribute("data-label") ?? "indicator";
      doneLog = [`mdComplete — ${which}`, ...doneLog].slice(0, 4);
      draw();
    };

    const start = () => {
      stopTimer();
      // Fresh nodes guarantee value starts at 0 and the one-shot state is clear.
      gen++;
      doneLog = [];
      draw();
      indicators().forEach((el) => {
        (el as unknown as { value: number }).value = 0;
        (el as unknown as { complete: boolean }).complete = false;
      });
      let v = 0;
      setStatus("Filling… 0 %");
      fillTimer = setInterval(() => {
        // Self-clear if the story was unmounted mid-fill (no leaked interval).
        if (!host.isConnected) {
          stopTimer();
          return;
        }
        v = Math.min(100, v + 1.5);
        indicators().forEach((el) => {
          (el as unknown as { value: number }).value = v;
        });
        if (v >= 100) {
          stopTimer();
          // At 100 % auto-trigger the closing-TV completion on each fresh node.
          indicators().forEach((el) => {
            (el as unknown as { complete: boolean }).complete = true;
          });
          setStatus("100 % — closing…");
        } else {
          setStatus(`Filling… ${Math.round(v)} %`);
        }
      }, 40);
    };

    const reset = () => {
      stopTimer();
      gen++; // recreate fresh, non-completed nodes at value 0
      doneLog = [];
      setStatus("Reset — fresh indicators at 0 %. Press Start.");
    };

    const indicatorEl = (v: CompletionVariant) =>
      keyed(
        `${v.key}-${gen}`,
        html`<md-progress-indicator
          data-label=${v.label}
          variant=${v.variant}
          ?wave=${v.wave}
          value="0"
          .complete=${false}
          @mdComplete=${onDone}
        ></md-progress-indicator>`,
      );

    const template = () => html`
      <style>
        .completion-demo {
          display: flex;
          flex-direction: column;
          gap: 24px;
          width: 360px;
          padding: 24px;
        }
        .completion-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 52px;
          justify-content: center;
        }
        .completion-row label {
          font-size: 13px;
          color: #444;
          font-family: sans-serif;
        }
        .completion-row md-progress-indicator {
          width: 100%;
        }
        .completion-row md-progress-indicator[variant="circular"] {
          width: auto;
          align-self: flex-start;
        }
        .completion-controls {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .completion-controls button {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid #6750a4;
          background: #6750a4;
          color: white;
          cursor: pointer;
          font-size: 13px;
        }
        .completion-controls button.reset {
          background: transparent;
          color: #6750a4;
        }
        .completion-status {
          font-size: 12px;
          font-family: monospace;
          color: #555;
          min-height: 18px;
        }
        .completion-log {
          font-size: 11px;
          font-family: monospace;
          color: #6b6b6b;
          white-space: pre-wrap;
          min-height: 64px;
          margin: 0;
        }
      </style>
      <div class="completion-demo">
        ${COMPLETION_VARIANTS.map(
          (v) => html`
            <div class="completion-row">
              <label>${v.label}</label>
              ${indicatorEl(v)}
            </div>
          `,
        )}

        <div class="completion-controls">
          <button @click=${start}>
            ${t(globals.locale, "progress.start")}
          </button>
          <button class="reset" @click=${reset}>
            ${t(globals.locale, "progress.reset")}
          </button>
        </div>
        <div class="completion-status">${statusText}</div>
        <pre class="completion-log">
${doneLog.length ? doneLog.join("\n") : "mdComplete events appear here…"}</pre
        >
      </div>
    `;

    function draw() {
      litRender(template(), host);
    }

    draw();
    return host;
  },
};
