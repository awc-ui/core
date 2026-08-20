import type { Meta, StoryObj } from "@storybook/web-components";
import { expect, waitFor } from "storybook/test";
import { html } from "lit";
import { drivingCoverage, exerciseProps } from "../testing/coverage-mode";
import { t } from "../i18n";

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the picker internals directly. */
type TimePickerEl = HTMLElement & { value: string; show: () => Promise<void> };
const getPicker = async (
  root: HTMLElement,
  selector = "md-time-picker",
): Promise<TimePickerEl> => {
  const el = root.querySelector(selector) as TimePickerEl;
  await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));
  return el;
};
const sr = (el: TimePickerEl) => el.shadowRoot!;
const dialogOf = (el: TimePickerEl) => sr(el).querySelector('[part="dialog"]');
const hourInput = (el: TimePickerEl) =>
  sr(el).querySelector('[part="input-hour"]') as HTMLInputElement;
const minuteInput = (el: TimePickerEl) =>
  sr(el).querySelector('[part="input-minute"]') as HTMLInputElement;
const amRadio = (el: TimePickerEl) =>
  sr(el).querySelector('[part="period-am"]') as HTMLButtonElement;
const pmRadio = (el: TimePickerEl) =>
  sr(el).querySelector('[part="period-pm"]') as HTMLButtonElement;
/** The clock face is unique to the dial variant — null in input mode. */
const dialFace = (el: TimePickerEl) => sr(el).querySelector('[part="dial"]');
const toggleModeBtn = (el: TimePickerEl) =>
  sr(el).querySelector('[part="toggle-mode"]') as HTMLElement;
const confirmBtn = (el: TimePickerEl) =>
  sr(el).querySelector('[part="confirm-button"]') as HTMLElement;

/** The HH/MM tiles are uncontrolled <input>s driven by native `input`
 *  events — set the value, then dispatch so the component's handler runs. */
const typeInto = (input: HTMLInputElement, text: string) => {
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
};
const pressEnter = (input: HTMLInputElement) =>
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    }),
  );

type ChangeDetail = {
  value: string;
  hours: number;
  minutes: number;
  period: string;
};

const meta: Meta = {
  title: "Selection/Time Picker",
  component: "md-time-picker",
  tags: ["autodocs"],
  parameters: {
    docs: {
      source: { language: "html" },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["dial", "input"],
      description: "Initial picker mode",
    },
    format: {
      control: "select",
      options: ["12h", "24h"],
      description: "12-hour (with AM/PM) or 24-hour clock",
    },
    periodLayout: {
      name: "period-layout",
      control: "inline-radio",
      options: ["vertical", "horizontal"],
      description:
        "AM/PM selector layout. `vertical` is 52×80dp next to the minute tile; `horizontal` is 216×38dp below HH:MM. Ignored when format is 24h.",
    },
    orientation: {
      control: "inline-radio",
      options: ["vertical", "horizontal"],
      description:
        "Dialog orientation. `vertical` (default) is the portrait 328dp dialog. `horizontal` is the landscape 572dp (608dp in 24h) dialog with HH:MM + AM/PM in a left column and the 256dp dial in a right column. Has no effect on the input variant.",
    },
    label: { control: "text", description: "Trigger floating label" },
    headline: { control: "text", description: "Headline above the picker" },
    value: { control: "text", description: "24-hour HH:MM" },
    minuteStep: {
      name: "minute-step",
      control: { type: "number", min: 1, max: 30 },
      description: "Minute snap increment on the dial",
    },
    disabled: { control: "boolean" },
    open: { control: "boolean" },
    amLabel: { name: "am-label", control: "text" },
    pmLabel: { name: "pm-label", control: "text" },
    cancelLabel: { name: "cancel-label", control: "text" },
    okLabel: { name: "ok-label", control: "text" },
  },
  args: {
    variant: "input",
    format: "12h",
    periodLayout: "vertical",
    orientation: "vertical",
    label: "Select time",
    headline: "",
    value: "",
    minuteStep: 1,
    disabled: false,
    open: false,
    amLabel: "AM",
    pmLabel: "PM",
    cancelLabel: "Cancel",
    okLabel: "OK",
  },
};

export default meta;
type Story = StoryObj;

const symbolsLink = html`
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined"
  />
`;

/* ─── Playground ───────────────────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    ${symbolsLink}
    <md-time-picker
      label=${args.label}
      headline=${args.headline}
      variant=${args.variant}
      format=${args.format}
      period-layout=${args.periodLayout}
      orientation=${args.orientation}
      value=${args.value || ""}
      minute-step=${args.minuteStep}
      am-label=${args.amLabel}
      pm-label=${args.pmLabel}
      cancel-label=${args.cancelLabel}
      ok-label=${args.okLabel}
      ?disabled=${args.disabled}
      ?open=${args.open}
    ></md-time-picker>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector("md-time-picker") as HTMLElement;
    await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));

    // Coverage-gated: these flips are VISIBLE (the panel opens, the layout
    // switches), and play() runs whenever the story is viewed. Un-gated they
    // would make the picker thrash in front of anyone opening it — the same
    // regression the chart stories shipped once.
    if (!drivingCoverage()) return;
    await exerciseProps(el, [
      ["format", "24h"],
      ["format", "12h"],
      ["orientation", "horizontal"],
      ["orientation", "vertical"],
      ["periodLayout", "stacked"],
      ["variant", "filled"],
      ["minuteStep", 5],
      ["open", true],
      ["open", false],
    ]);
  },
};

/* ─── Variants ────────────────────────────────────────────────── */
export const AllVariants: Story = {
  render: () => html`
    ${symbolsLink}
    <div
      style="display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start;"
    >
      <md-time-picker
        label="Dial (12h)"
        variant="dial"
        format="12h"
      ></md-time-picker>
      <md-time-picker
        label="Dial (24h)"
        variant="dial"
        format="24h"
      ></md-time-picker>
      <md-time-picker
        label="Input (12h)"
        variant="input"
        format="12h"
      ></md-time-picker>
      <md-time-picker
        label="Input (24h)"
        variant="input"
        format="24h"
      ></md-time-picker>
    </div>
  `,
};

/* ─── Formats ─────────────────────────────────────────────────── */
export const Format12Hour: Story = {
  name: "12-hour Clock",
  render: (_args, { globals }) => html`
    ${symbolsLink}
    <md-time-picker
      label=${t(globals.locale, "time-picker.meeting")}
      variant="input"
      format="12h"
      value="14:30"
    ></md-time-picker>
  `,
};

export const Format24Hour: Story = {
  name: "24-hour Clock",
  render: (_args, { globals }) => html`
    ${symbolsLink}
    <md-time-picker
      label=${t(globals.locale, "time-picker.departure")}
      variant="input"
      format="24h"
      value="22:05"
    ></md-time-picker>
  `,
};

/* ─── Opened by default (input is the default variant) ─────────── */
export const InputOpen: Story = {
  name: "Input — Open (default)",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="input"
      format="12h"
      value="14:30"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
  /** Open input dialog: the seeded value drives the display, the AM/PM
   *  radio group flips the committed hour, and typing + Enter commits a
   *  fresh time (proved via the mdInput / mdChange payloads). */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);

    await step('Opens pre-filled to 2:30 PM from value="14:30"', async () => {
      await waitFor(() => expect(dialogOf(el)).not.toBeNull());
      // 14:30 in 12h → hour tile shows "2", minute "30", period = PM.
      await waitFor(() => expect(hourInput(el).value).toBe("2"));
      expect(minuteInput(el).value).toBe("30");
      expect(pmRadio(el).getAttribute("aria-checked")).toBe("true");
      expect(amRadio(el).getAttribute("aria-checked")).toBe("false");
    });

    await step(
      "AM/PM toggle flips the checked radio and emits mdInput",
      async () => {
        expect(pmRadio(el).getAttribute("aria-checked")).toBe("true");
        let detail: ChangeDetail | undefined;
        el.addEventListener(
          "mdInput",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        amRadio(el).click();
        // aria-checked reflects on the NEXT render flush → assert in waitFor.
        await waitFor(() =>
          expect(amRadio(el).getAttribute("aria-checked")).toBe("true"),
        );
        expect(pmRadio(el).getAttribute("aria-checked")).toBe("false");
        // Toggling AM rolled 14:30 (2 PM) back to 02:30 (2 AM), not just a class flip.
        expect(detail?.period).toBe("AM");
        expect(detail?.hours).toBe(2);
      },
    );

    await step(
      "Type a new HH:MM, Enter commits mdChange + reflects value + closes",
      async () => {
        const before = el.getAttribute("value"); // "14:30" — the AM toggle is not committed yet
        typeInto(hourInput(el), "9");
        typeInto(minuteInput(el), "15");
        let detail: ChangeDetail | undefined;
        el.addEventListener(
          "mdChange",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        pressEnter(minuteInput(el));
        await waitFor(() => expect(detail).toBeTruthy());
        // 9 AM (period still AM from the toggle) → canonical "09:15", not the seed.
        expect(detail?.value).toBe("09:15");
        expect(detail?.value).not.toBe(before);
        await waitFor(() => expect(el.getAttribute("value")).toBe("09:15"));
        await waitFor(() => expect(dialogOf(el)).toBeNull());
        // Let the close animation settle so teardown doesn't race it.
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

export const Input24hOpen: Story = {
  name: "Input — 24-hour Open",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="input"
      format="24h"
      value="14:30"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

export const DialOpen: Story = {
  name: "Dial — Open (reachable via footer toggle)",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="dial"
      format="12h"
      value="10:30"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
  /** Dial variant, open. The clock face itself is pointer-capture +
   *  bounding-rect geometry (`setPointerCapture` throws on a synthetic
   *  PointerEvent, so a headless tap on a dial number is a no-op) — so
   *  instead we exercise the value-changing control that lives IN the
   *  dial dialog: the AM/PM period toggle. It rolls the draft across
   *  the 12h boundary (10:30 AM → 22:30), the payloads prove the
   *  transition, and OK commits it through the composed md-button. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);

    await step("Opens in DIAL mode pre-filled to 10:30 AM", async () => {
      await waitFor(() => expect(dialogOf(el)).not.toBeNull());
      // The clock face is unique to the dial variant — its presence
      // (vs null in input mode) proves we booted into `variant="dial"`.
      await waitFor(() => expect(dialFace(el)).not.toBeNull());
      // The shared HH/MM tile row seeds from value="10:30" (12h → "10:30").
      await waitFor(() => expect(hourInput(el).value).toBe("10"));
      expect(minuteInput(el).value).toBe("30");
      // 10:30 is before noon → AM radio checked.
      expect(amRadio(el).getAttribute("aria-checked")).toBe("true");
      expect(pmRadio(el).getAttribute("aria-checked")).toBe("false");
    });

    await step(
      "AM→PM toggle rolls 10:30 AM → 22:30 and emits mdInput",
      async () => {
        expect(amRadio(el).getAttribute("aria-checked")).toBe("true");
        let detail: ChangeDetail | undefined;
        el.addEventListener(
          "mdInput",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        pmRadio(el).click();
        // aria-checked reflects on the NEXT render flush → assert in waitFor.
        await waitFor(() =>
          expect(pmRadio(el).getAttribute("aria-checked")).toBe("true"),
        );
        expect(amRadio(el).getAttribute("aria-checked")).toBe("false");
        // Flipping to PM advanced the 24h draft hour by 12 (10 → 22); the
        // payload proves it was a real value roll, not just a class flip.
        expect(detail?.period).toBe("PM");
        expect(detail?.hours).toBe(22);
        expect(detail?.minutes).toBe(30);
      },
    );

    await step(
      "OK commits mdChange = 22:30, reflects value + closes",
      async () => {
        const before = el.getAttribute("value"); // still "10:30" — the toggle is not committed yet
        const ok = confirmBtn(el);
        // A pre-hydration click on the composed md-button is a silent no-op.
        await waitFor(() =>
          expect(ok.classList.contains("hydrated")).toBe(true),
        );
        let detail: ChangeDetail | undefined;
        el.addEventListener(
          "mdChange",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        ok.click();
        await waitFor(() => expect(detail).toBeTruthy());
        // 22:30 is the canonical PM commit — not the seeded 10:30.
        expect(detail?.value).toBe("22:30");
        expect(detail?.value).not.toBe(before);
        await waitFor(() => expect(el.getAttribute("value")).toBe("22:30"));
        await waitFor(() => expect(dialogOf(el)).toBeNull());
        // Let the dialog's close animation settle so teardown doesn't race it.
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

/* ─── Input — 12h vs 24h side-by-side (matches the M3 spec sheet) ─── */
export const InputFormatsComparison: Story = {
  name: "Input — 12h vs 24h",
  parameters: {
    docs: {
      description: {
        story:
          "Side-by-side comparison of the input variant in 12-hour and 24-hour modes — mirrors the canonical *12-hour and 24-hour time picker inputs* spec sheet. The 12h dialog includes the 52×72 vertical AM/PM stack; the 24h dialog drops the AM/PM column entirely (no period concept in 24-hour time) and the dialog stays 328dp wide because the 24dp colon + 12dp gap + 52dp AM/PM (= 88dp) is replaced by 88dp of right-padding negative space.",
      },
    },
    layout: "fullscreen",
  },
  render: (_args, { globals, viewMode }) => html`
    ${symbolsLink}
    <div
      data-theme="dark"
      style="background: var(--md-sys-color-surface, #1c1b1f); color: var(--md-sys-color-on-surface, #E6E0E9); padding: 32px; min-height: 100vh;"
    >
      <div
        style="display: flex; gap: 48px; flex-wrap: wrap; align-items: flex-start;"
      >
        <div>
          <p
            style="margin: 0 0 12px; font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);"
          >
            1) 12-hour input — with AM/PM stack
          </p>
          <md-time-picker
            variant="input"
            format="12h"
            value="07:00"
            headline=${t(globals.locale, "time-picker.enter-time")}
            hide-trigger
            ?open=${viewMode !== "docs"}
          ></md-time-picker>
        </div>
        <div>
          <p
            style="margin: 0 0 12px; font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant);"
          >
            2) 24-hour input — AM/PM hidden
          </p>
          <md-time-picker
            variant="input"
            format="24h"
            value="20:00"
            headline=${t(globals.locale, "time-picker.enter-time")}
            hide-trigger
            ?open=${viewMode !== "docs"}
          ></md-time-picker>
        </div>
      </div>
    </div>
  `,
};

/* ─── 24-hour dial (114dp tiles, no AM/PM) ─────────────────────── */
export const Dial24HourOpen: Story = {
  name: "Dial — 24-hour Open",
  parameters: {
    docs: {
      description: {
        story:
          "MD3 dial variant in 24-hour mode. With no AM/PM column to balance against, the spec widens each HH/MM tile from 96dp to 114dp so the time display stays optically centered inside the 328dp dialog.",
      },
    },
  },
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="dial"
      format="24h"
      value="22:05"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── Horizontal AM/PM toggle (216×38) ─────────────────────────── */
export const HorizontalPeriodToggle: Story = {
  name: "Dial — Horizontal AM/PM Toggle",
  parameters: {
    docs: {
      description: {
        story:
          "Alternate MD3 dial layout where the AM/PM selector renders as a 216dp × 38dp horizontal segmented button placed between the HH:MM display and the clock face. Useful in compact layouts where the inline gutter cannot fit the 52×80 vertical stack.",
      },
    },
  },
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="dial"
      format="12h"
      value="14:30"
      period-layout="horizontal"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── Horizontal (landscape) dial dialog ──────────────────────── */
export const HorizontalDial: Story = {
  name: "Dial — Horizontal (landscape) layout",
  parameters: {
    docs: {
      description: {
        story:
          "Canonical MD3 *landscape* dial dialog. The body splits into two columns: HH:MM tiles + the 216×38dp horizontal AM/PM pill on the left, the 256dp clock dial on the right. Total dialog width is 572dp in 12-hour mode (608dp in 24-hour mode) with the spec's 52dp gap between the time area and the dial.",
      },
    },
  },
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="dial"
      format="12h"
      value="07:00"
      orientation="horizontal"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

export const HorizontalDial24h: Story = {
  name: "Dial — Horizontal 24-hour",
  parameters: {
    docs: {
      description: {
        story:
          "24-hour landscape dialog. Tiles widen to 114dp (no AM/PM column to balance against), expanding the dialog to 608dp wide. AM/PM is never rendered in 24-hour mode regardless of orientation.",
      },
    },
  },
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="dial"
      format="24h"
      value="22:05"
      orientation="horizontal"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── Minute step (only affects the dial; inputs accept 1-minute granularity) ── */
export const MinuteStep5: Story = {
  name: "Minute Step: 5 (Dial)",
  parameters: {
    docs: {
      description: {
        story:
          "`minute-step` snaps the dial selector to the nearest N minutes. Inputs always accept any 1-minute value because users can type the exact minute they want.",
      },
    },
  },
  render: (_args, { globals, viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      label=${t(globals.locale, "time-picker.appointment")}
      variant="dial"
      minute-step="5"
      value="09:15"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

export const MinuteStep15: Story = {
  name: "Minute Step: 15 (Dial)",
  render: (_args, { globals, viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      label=${t(globals.locale, "time-picker.booking")}
      variant="dial"
      minute-step="15"
      value="13:00"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── States ──────────────────────────────────────────────────── */
export const States: Story = {
  render: () => html`
    ${symbolsLink}
    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
      <md-time-picker label="Enabled"></md-time-picker>
      <md-time-picker label="Pre-filled" value="08:45"></md-time-picker>
      <md-time-picker label="Disabled" disabled value="09:00"></md-time-picker>
    </div>
  `,
};

/* ─── Hide built-in trigger / programmatic control ─────────────── */
export const ProgrammaticControl: Story = {
  name: "Programmatic (no trigger)",
  render: (_args, { globals }) => html`
    ${symbolsLink}
    <button
      style="padding:10px 16px;border-radius:20px;border:1px solid var(--md-sys-color-outline);background:transparent;color:var(--md-sys-color-on-surface);cursor:pointer;font:500 14px/20px Roboto,sans-serif;"
      @click=${() => {
        const el = document.querySelector<HTMLElement & { show: () => void }>(
          "#programmatic-tp",
        );
        el?.show();
      }}
    >
      ${t(globals.locale, "time-picker.open-picker")}
    </button>
    <md-time-picker
      id="programmatic-tp"
      hide-trigger
      format="24h"
      value="07:00"
      @mdChange=${(e: CustomEvent) => {
        const out = document.querySelector("#programmatic-tp-out");
        if (out) out.textContent = `Chosen: ${e.detail.value}`;
      }}
    ></md-time-picker>
    <p
      id="programmatic-tp-out"
      style="margin-block-start:12px;font:14px Roboto,sans-serif;"
    >
      Chosen: (none)
    </p>
  `,
  /** No built-in trigger: the external button opens it, the `value` prop
   *  drives the (24h) HH/MM display live, and Enter commits back through
   *  the story's own mdChange wiring. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);

    await step(
      'External button opens it; value="07:00" drives the display',
      async () => {
        const btn = canvasElement.querySelector("button")!;
        btn.click();
        await waitFor(() => expect(dialogOf(el)).not.toBeNull());
        // 24h: hour tile shows the raw hour "7", minute "00".
        await waitFor(() => expect(hourInput(el).value).toBe("7"));
        expect(minuteInput(el).value).toBe("00");
      },
    );

    await step(
      "Setting the value prop live-updates the open HH/MM display",
      async () => {
        const before = hourInput(el).value; // "7"
        el.value = "13:45";
        await waitFor(() => expect(hourInput(el).value).not.toBe(before));
        expect(hourInput(el).value).toBe("13");
        expect(minuteInput(el).value).toBe("45");
      },
    );

    await step(
      "Enter commits → mdChange fires and the demo output reflects it",
      async () => {
        let detail: ChangeDetail | undefined;
        el.addEventListener(
          "mdChange",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        pressEnter(minuteInput(el));
        await waitFor(() => expect(detail).toBeTruthy());
        expect(detail?.value).toBe("13:45");
        expect(detail?.hours).toBe(13);
        expect(detail?.minutes).toBe(45);
        // The story's @mdChange handler writes the chosen value into the <p>.
        const out = canvasElement.querySelector("#programmatic-tp-out")!;
        await waitFor(() => expect(out.textContent).toContain("13:45"));
        await waitFor(() => expect(dialogOf(el)).toBeNull());
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

/* ─── Localization ─────────────────────────────────────────────── */
export const Localized: Story = {
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      label="Heure"
      headline="Choisir une heure"
      variant="input"
      am-label="matin"
      pm-label="soir"
      cancel-label="Annuler"
      ok-label="Confirmer"
      value="14:30"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── RTL ─────────────────────────────────────────────────────── */
export const RTL: Story = {
  name: "RTL Layout",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <div dir="rtl" style="padding:24px;">
      <md-time-picker
        label="الوقت"
        variant="input"
        value="14:30"
        ?open=${viewMode !== "docs"}
      ></md-time-picker>
    </div>
  `,
};

/* ─── Dark theme ──────────────────────────────────────────────── */
export const DarkTheme: Story = {
  decorators: [
    (story) => {
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.style.backgroundColor = "#1c1b1f";
      document.body.style.padding = "24px";
      return story();
    },
  ],
  render: (_args, { globals, viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      label=${t(globals.locale, "time-picker.pick-time")}
      variant="input"
      value="20:15"
      format="24h"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── Custom CSS via custom properties ─────────────────────────── */
export const CustomCSS: Story = {
  name: "Custom CSS (Theming)",
  parameters: {
    docs: {
      description: {
        story:
          "Six showcase recipes covering every axis the picker exposes: colour (brand / destructive), shape (sharp corners), dimensions (compact + touch), and motion (snappy entry). Open any trigger to see the dialog inherit the recipe — every accent surface (trigger, dialog, HH/MM inputs, AM/PM pill, dial, hand, actions) follows the override without leaking into siblings.",
      },
    },
  },
  render: () => html`
    ${symbolsLink}
    <style>
      /* Brand teal — recolour every accent surface in one pass. */
      .brand {
        --md-time-picker-trigger-focus-color: #006a6a;
        --md-time-picker-dial-hand-color: #006a6a;
        --md-time-picker-input-active-outline-color: #006a6a;
        --md-time-picker-input-active-bg: #c7e7e7;
        --md-time-picker-input-active-color: #002020;
        --md-time-picker-period-active-bg: #c7e7e7;
        --md-time-picker-period-active-color: #002020;
        --md-time-picker-action-color: #006a6a;
        --md-time-picker-action-primary-color: #ffffff;
        --md-time-picker-action-confirm-bg: #006a6a;
      }
      /* Destructive — accent surfaces in the error palette. */
      .destructive {
        --md-time-picker-trigger-focus-color: #b3261e;
        --md-time-picker-input-active-outline-color: #b3261e;
        --md-time-picker-input-active-bg: #f9dedc;
        --md-time-picker-input-active-color: #410e0b;
        --md-time-picker-action-primary-color: #ffffff;
        --md-time-picker-action-confirm-bg: #b3261e;
      }
      /* Sharp — flat dialog, square trigger, square inputs, square AM/PM. */
      .sharp {
        --md-time-picker-dialog-shape: 0;
        --md-time-picker-trigger-shape: 0;
        --md-time-picker-input-shape: 0;
        --md-time-picker-period-shape: 0;
        --md-time-picker-action-shape: 4px;
      }
      /* Compact — squeeze the dial dialog onto a 280px column. */
      .compact {
        --md-time-picker-dialog-padding: 16px;
        --md-time-picker-dialog-min-width: 280px;
        --md-time-picker-input-width: 80px;
        --md-time-picker-input-height: 64px;
        --md-time-picker-input-font-size: 36px;
        --md-time-picker-dial-size: 216px;
        --md-time-picker-dial-target-size: 40px;
      }
      /* Touch-first — bigger hit targets across the board. */
      .touch {
        --md-time-picker-trigger-min-width: 280px;
        --md-time-picker-dialog-min-width: 360px;
        --md-time-picker-input-width: 112px;
        --md-time-picker-input-height: 88px;
        --md-time-picker-input-font-size: 56px;
        --md-time-picker-period-vertical-width: 64px;
        --md-time-picker-period-vertical-height: 96px;
        --md-time-picker-period-vertical-height-input: 88px;
        --md-time-picker-dial-size: 320px;
        --md-time-picker-dial-target-size: 60px;
        --md-time-picker-dial-hand-width: 3px;
        --md-time-picker-dial-center-size: 12px;
      }
      /* Snappy — kill the 500ms unfold for desktop power-users. */
      .snappy {
        --md-time-picker-dialog-enter-duration: 150ms;
        --md-time-picker-mode-swap-duration: 100ms;
      }
    </style>
    <div
      style="display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));max-inline-size:840px;"
    >
      <md-time-picker
        class="brand"
        label="Brand teal (colour)"
        value="09:15"
      ></md-time-picker>
      <md-time-picker
        class="destructive"
        label="Destructive (colour)"
        value="22:00"
      ></md-time-picker>
      <md-time-picker
        class="sharp"
        variant="dial"
        label="Sharp (shape)"
        value="14:30"
      ></md-time-picker>
      <md-time-picker
        class="compact"
        variant="dial"
        label="Compact (dimensions)"
        value="07:30"
      ></md-time-picker>
      <md-time-picker
        class="touch"
        variant="dial"
        label="Touch (dimensions)"
        value="11:45"
      ></md-time-picker>
      <md-time-picker
        class="snappy"
        label="Snappy (motion)"
        value="18:00"
      ></md-time-picker>
    </div>
  `,
};

/* ─── CSS Parts ───────────────────────────────────────────────── */
export const CSSParts: Story = {
  name: "CSS Parts",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <style>
      .uppercase::part(headline) {
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--md-sys-color-primary);
      }
      .uppercase::part(confirm-button) {
        font-weight: 700;
      }
    </style>
    <md-time-picker
      class="uppercase"
      label="Custom parts"
      variant="input"
      value="08:00"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
};

/* ─── Accessibility demo ──────────────────────────────────────── */
export const AccessibilityDemo: Story = {
  name: "Accessibility (keyboard)",
  render: () => html`
    ${symbolsLink}
    <div
      style="max-inline-size:640px;font:14px/1.55 Roboto,sans-serif;color:var(--md-sys-color-on-surface-variant);"
    >
      <p>
        The picker opens in the keyboard-first <strong>input</strong> variant by
        default. Both variants share the same typeable HH / MM input row — the
        dial variant just adds the clock face below it. Click the clock icon in
        the footer to swap.
      </p>
      <ul style="padding-inline-start:1.25em;margin:0;">
        <li>
          <strong>HH / MM inputs:</strong> type digits directly (non-digits are
          stripped on input); <kbd>Tab</kbd> moves between HH → MM → AM/PM →
          mode toggle → Cancel → OK; <kbd>Enter</kbd> commits and closes;
          out-of-range values flag <code>aria-invalid="true"</code> immediately
          on every keystroke.
        </li>
        <li>
          <strong>AM / PM toggle:</strong> a WAI-ARIA radio group — Tab lands on
          the checked radio, then <kbd>←</kbd> / <kbd>↑</kbd> selects AM,
          <kbd>→</kbd> / <kbd>↓</kbd> selects PM, <kbd>Home</kbd> /
          <kbd>End</kbd> jump directly. <kbd>Space</kbd> re-confirms the focused
          radio.
        </li>
        <li>
          <strong>Dial:</strong> drag the hand or click a number; releasing an
          hour drag auto-flips the dial to the minute ring AND moves keyboard
          focus into the MM input so the next interaction (drag or type) just
          works.
        </li>
        <li>
          <strong>Global:</strong> <kbd>Esc</kbd> cancels; scrim click cancels;
          focus is trapped inside the dialog while open.
        </li>
      </ul>
    </div>
    <md-time-picker
      label="Accessible time"
      variant="input"
      value="09:30"
    ></md-time-picker>
  `,
};

/* ─── Coverage: value normalization + constraint-validation methods ─── */
export const ValueNormalizationAndValidity: Story = {
  name: "Value normalization + validity API",
  render: () => html`
    ${symbolsLink}
    <md-time-picker
      id="validity-tp"
      name="mtg"
      label="Constrained time"
      value="12:00"
    ></md-time-picker>
  `,
  /** The picker stays CLOSED here (default). We drive its public
   *  constraint-validation surface — the same API a host <form> uses —
   *  and its value-normalization pipeline (reject garbage, canonicalize
   *  unpadded strings) purely through props + @Method calls, asserting
   *  the ElementInternals validity flags the component actually set. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    // Public @Method()s + non-typed props aren't on the narrow helper type.
    const api = el as unknown as {
      value: string;
      min: string;
      max: string;
      required: boolean;
      checkValidity: () => Promise<boolean>;
      reportValidity: () => Promise<boolean>;
      getValidity: () => Promise<{
        valid: boolean;
        valueMissing?: boolean;
        rangeUnderflow?: boolean;
        rangeOverflow?: boolean;
        validationMessage: string;
      }>;
    };

    await step(
      "Garbage value is rejected back to empty (canonical guard)",
      async () => {
        expect(el.getAttribute("value")).toBe("12:00");
        api.value = "99:99"; // regex matches but 99 is out of range → rejected
        await waitFor(() => expect(el.value).toBe(""));
        // The reflected attribute follows the rejection, not the bad input.
        await waitFor(() => expect(el.getAttribute("value")).not.toBe("12:00"));
      },
    );

    await step(
      "Unpadded value is canonicalized to zero-padded HH:MM",
      async () => {
        api.value = "9:05";
        // "9:05" round-trips through the watch to canonical "09:05".
        await waitFor(() => expect(el.value).toBe("09:05"));
        await waitFor(() => expect(el.getAttribute("value")).toBe("09:05"));
      },
    );

    await step(
      "rangeOverflow: value after max fails checkValidity()",
      async () => {
        api.required = true;
        api.min = "09:00";
        api.max = "17:00";
        api.value = "20:00"; // 20:00 > 17:00
        await waitFor(async () =>
          expect(await api.checkValidity()).toBe(false),
        );
        const gv = await api.getValidity();
        expect(gv.valid).toBe(false);
        expect(gv.rangeOverflow).toBe(true);
        expect(gv.validationMessage.length).toBeGreaterThan(0);
      },
    );

    await step("rangeUnderflow: value before min flags underflow", async () => {
      api.value = "06:00"; // 06:00 < 09:00
      const gv = await api.getValidity();
      expect(gv.valid).toBe(false);
      expect(gv.rangeUnderflow).toBe(true);
      expect(await api.checkValidity()).toBe(false);
    });

    await step("In-range value validates clean", async () => {
      api.value = "12:00"; // within [09:00, 17:00]
      await waitFor(async () => expect(await api.checkValidity()).toBe(true));
      const gv = await api.getValidity();
      expect(gv.valid).toBe(true);
      expect(gv.rangeOverflow).toBe(false);
      expect(gv.rangeUnderflow).toBe(false);
    });

    await step("valueMissing: required + empty fails validity", async () => {
      api.value = "";
      const gv = await api.getValidity();
      expect(gv.valid).toBe(false);
      expect(gv.valueMissing).toBe(true);
      expect(await api.checkValidity()).toBe(false);
    });

    await step(
      "Overnight (reversed) window flags underflow AND overflow",
      async () => {
        api.min = "22:00";
        api.max = "06:00";
        api.value = "12:00"; // excluded middle of a 22:00→06:00 window
        const gv = await api.getValidity();
        expect(gv.valid).toBe(false);
        expect(gv.rangeUnderflow).toBe(true);
        expect(gv.rangeOverflow).toBe(true);
        // reportValidity() mirrors checkValidity()'s verdict.
        expect(await api.reportValidity()).toBe(false);
      },
    );
  },
};

/* ─── Coverage: AM/PM radiogroup keyboard (WAI-ARIA) ─── */
export const PeriodKeyboardNav: Story = {
  name: "AM/PM keyboard (radiogroup)",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="input"
      format="12h"
      value="14:30"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
  /** The AM/PM toggle is a WAI-ARIA radiogroup: arrows flip the period,
   *  Home selects AM, End selects PM, Space re-confirms without flipping.
   *  We dispatch keydowns on the radiogroup (bubbles to its onKeyDown)
   *  and assert the checked radio + the emitted mdInput payload. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const key = (k: string) =>
      (
        sr(el).querySelector('[part="period-toggle"]') as HTMLElement
      ).dispatchEvent(
        new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true }),
      );

    await step("Opens on PM (value=14:30)", async () => {
      await waitFor(() => expect(dialogOf(el)).not.toBeNull());
      await waitFor(() =>
        expect(pmRadio(el).getAttribute("aria-checked")).toBe("true"),
      );
    });

    await step("ArrowUp flips PM → AM and rolls 14:30 → 02:30", async () => {
      let detail: ChangeDetail | undefined;
      el.addEventListener(
        "mdInput",
        (e) => {
          detail = (e as CustomEvent).detail;
        },
        { once: true },
      );
      key("ArrowUp");
      await waitFor(() =>
        expect(amRadio(el).getAttribute("aria-checked")).toBe("true"),
      );
      expect(pmRadio(el).getAttribute("aria-checked")).toBe("false");
      expect(detail?.period).toBe("AM");
      expect(detail?.hours).toBe(2);
    });

    await step("End jumps to PM (02:30 → 14:30)", async () => {
      let detail: ChangeDetail | undefined;
      el.addEventListener(
        "mdInput",
        (e) => {
          detail = (e as CustomEvent).detail;
        },
        { once: true },
      );
      key("End");
      await waitFor(() =>
        expect(pmRadio(el).getAttribute("aria-checked")).toBe("true"),
      );
      expect(amRadio(el).getAttribute("aria-checked")).toBe("false");
      expect(detail?.period).toBe("PM");
      expect(detail?.hours).toBe(14);
    });

    await step("Home jumps back to AM", async () => {
      key("Home");
      await waitFor(() =>
        expect(amRadio(el).getAttribute("aria-checked")).toBe("true"),
      );
      expect(pmRadio(el).getAttribute("aria-checked")).toBe("false");
    });

    await step(
      "Space re-confirms the focused radio without flipping",
      async () => {
        key(" ");
        // Space on an already-checked radio is a no-op flip: AM stays AM.
        await waitFor(() =>
          expect(amRadio(el).getAttribute("aria-checked")).toBe("true"),
        );
        expect(pmRadio(el).getAttribute("aria-checked")).toBe("false");
      },
    );
  },
};

/* ─── Coverage: HH/MM spinbutton ArrowUp/ArrowDown ─── */
export const InputArrowBump: Story = {
  name: "HH/MM arrow-key spinner",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="input"
      format="12h"
      value="09:15"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
  /** The HH/MM inputs are WAI-ARIA spinbuttons: ArrowUp/ArrowDown
   *  increment/decrement the focused field (dial hand + draft follow).
   *  We dispatch arrow keydowns straight at each input and assert the
   *  visible buffer + the emitted mdInput draft moved by exactly one. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const arrow = (input: HTMLInputElement, k: "ArrowUp" | "ArrowDown") =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: k, bubbles: true, composed: true }),
      );

    await step("Opens showing 9:15", async () => {
      await waitFor(() => expect(dialogOf(el)).not.toBeNull());
      await waitFor(() => expect(hourInput(el).value).toBe("9"));
      expect(minuteInput(el).value).toBe("15");
    });

    await step("ArrowUp on HH bumps 9 → 10 and emits mdInput", async () => {
      let detail: ChangeDetail | undefined;
      el.addEventListener(
        "mdInput",
        (e) => {
          detail = (e as CustomEvent).detail;
        },
        { once: true },
      );
      arrow(hourInput(el), "ArrowUp");
      await waitFor(() => expect(hourInput(el).value).toBe("10"));
      expect(detail?.hours).toBe(10);
    });

    await step("ArrowDown on HH returns to 9", async () => {
      arrow(hourInput(el), "ArrowDown");
      await waitFor(() => expect(hourInput(el).value).toBe("9"));
    });

    await step(
      "ArrowUp on MM bumps 15 → 16 (step=1) and emits mdInput",
      async () => {
        let detail: ChangeDetail | undefined;
        el.addEventListener(
          "mdInput",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        arrow(minuteInput(el), "ArrowUp");
        await waitFor(() => expect(minuteInput(el).value).toBe("16"));
        expect(detail?.minutes).toBe(16);
      },
    );

    await step("ArrowDown on MM returns to 15", async () => {
      arrow(minuteInput(el), "ArrowDown");
      await waitFor(() => expect(minuteInput(el).value).toBe("15"));
    });
  },
};

/* ─── Coverage: mode toggle + dismissal paths (hide/Esc/disable) ─── */
export const ModeToggleAndDismiss: Story = {
  name: "Mode toggle + dismissal paths",
  render: (_args, { viewMode }) => html`
    ${symbolsLink}
    <md-time-picker
      variant="dial"
      format="12h"
      value="08:00"
      ?open=${viewMode !== "docs"}
    ></md-time-picker>
  `,
  /** Exercises the four control-flow paths that never committed a value:
   *  the footer mode toggle (mdModeChange), programmatic hide(), the
   *  Escape key (document-capture cancel), and runtime disable — each of
   *  which closes without an mdChange. */
  play: async ({ canvasElement, step }) => {
    const el = await getPicker(canvasElement);
    const api = el as unknown as {
      hide: () => Promise<void>;
      disabled: boolean;
    };

    await step(
      "Footer toggle swaps dial → input and emits mdModeChange",
      async () => {
        await waitFor(() => expect(dialFace(el)).not.toBeNull());
        const btn = toggleModeBtn(el);
        // A pre-hydration click on the composed md-icon-button is a no-op.
        await waitFor(() =>
          expect(btn.classList.contains("hydrated")).toBe(true),
        );
        let detail: { mode: string; previousMode: string } | undefined;
        el.addEventListener(
          "mdModeChange",
          (e) => {
            detail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        btn.click();
        await waitFor(() => expect(detail).toBeTruthy());
        expect(detail?.mode).toBe("input");
        expect(detail?.previousMode).toBe("dial");
        // Input mode drops the clock face entirely.
        await waitFor(() => expect(dialFace(el)).toBeNull());
      },
    );

    await step("hide() cancels and closes without mdChange", async () => {
      let changed = false;
      let cancelled = false;
      el.addEventListener(
        "mdChange",
        () => {
          changed = true;
        },
        { once: true },
      );
      el.addEventListener(
        "mdCancel",
        () => {
          cancelled = true;
        },
        { once: true },
      );
      await api.hide();
      await waitFor(() => expect(dialogOf(el)).toBeNull());
      expect(cancelled).toBe(true);
      expect(changed).toBe(false);
    });

    await step("show() reopens (back in the dial variant)", async () => {
      await el.show();
      await waitFor(() => expect(dialogOf(el)).not.toBeNull());
      await waitFor(() => expect(dialFace(el)).not.toBeNull());
    });

    await step("Escape cancels the reopened dialog", async () => {
      let cancelled = false;
      el.addEventListener(
        "mdCancel",
        () => {
          cancelled = true;
        },
        { once: true },
      );
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(dialogOf(el)).toBeNull());
      expect(cancelled).toBe(true);
    });

    await step("Disabling an open picker at runtime closes it", async () => {
      await el.show();
      await waitFor(() => expect(dialogOf(el)).not.toBeNull());
      let cancelled = false;
      el.addEventListener(
        "mdCancel",
        () => {
          cancelled = true;
        },
        { once: true },
      );
      api.disabled = true;
      await waitFor(() => expect(dialogOf(el)).toBeNull());
      expect(cancelled).toBe(true);
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};
