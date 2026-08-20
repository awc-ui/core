import type { Meta, StoryObj } from "@storybook/web-components";
import { expect, waitFor } from "storybook/test";
import { html } from "lit";
import { drivingCoverage, exerciseProps } from "../testing/coverage-mode";
import { t } from "../i18n";

/** Shadow-piercing play() helpers — testing-library can't cross shadow roots,
 *  so interactions address the picker's real internals directly. */
type DpPlayEl = HTMLElement & { value: string; open: boolean };
const getDatePicker = async (canvasElement: HTMLElement): Promise<DpPlayEl> => {
  const el = canvasElement.querySelector("md-date-picker") as DpPlayEl;
  await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));
  return el;
};
const dpDayCell = (el: DpPlayEl, iso: string) =>
  el.shadowRoot!.querySelector(`[data-date="${iso}"]`) as HTMLElement | null;
const dpFieldInput = (el: DpPlayEl) =>
  (el
    .shadowRoot!.querySelector("md-text-field")
    ?.shadowRoot?.querySelector(".md-text-field__input") ??
    null) as HTMLInputElement | null;
const dpActionButton = (el: DpPlayEl, part: "ok-button" | "cancel-button") =>
  el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement | null;
const dpPanel = (el: DpPlayEl) =>
  el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement | null;
const dpKey = (target: Element, k: string) =>
  target.dispatchEvent(
    // `cancelable: true` mirrors a real keydown so the picker's `preventDefault()`
    // sticks — otherwise every capture/bubble listener re-handles the same key.
    new KeyboardEvent("keydown", {
      key: k,
      bubbles: true,
      composed: true,
      cancelable: true,
    }),
  );

const DOCS_PREVIEW_MIN_BLOCK = "620px";
const DOCS_PREVIEW_IFRAME_HEIGHT = 680;

const meta: Meta = {
  title: "Selection/Date Picker",
  component: "md-date-picker",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "A Material Design 3 date picker. Choose a single calendar date with a",
          "modal-input field (default), bare modal dialog, or docked popup.",
          "Implements the full",
          "MD3 spec: localized weekday/month names, locale-aware first day of week,",
          "a switch-to-text-input toggle inside the dialog, keyboard navigation",
          "(Arrow keys, PageUp/Down for month, Shift+PageUp/Down for year, Home/End,",
          "Enter/Space, Escape), focus trapping, and the WAI-ARIA date-picker dialog",
          "pattern.",
        ].join(" "),
      },
      // Modal scrim uses `position: fixed`; iframe previews keep each story
      // self-contained and tall enough for an opened calendar (~524px panel
      // + trigger field + padding). Stories still mount closed by default.
      story: { inline: false, iframeHeight: DOCS_PREVIEW_IFRAME_HEIGHT },
      source: { language: "html" },
    },
  },
  decorators: [
    (story) => html`
      <div
        style="inline-size: 100%; min-block-size: ${DOCS_PREVIEW_MIN_BLOCK}; box-sizing: border-box;"
      >
        ${story()}
      </div>
    `,
  ],
  argTypes: {
    variant: {
      control: "select",
      options: ["modal-input", "modal", "docked"],
      description: "Presentation variant",
    },
    label: { control: "text", description: "Floating label / a11y name" },
    value: {
      control: "text",
      description:
        "ISO YYYY-MM-DD value. **Uncontrolled:** set once at mount; the picker updates itself on commit. **Controlled:** drive from app state and push back on every `mdChange`.",
    },
    placeholder: { control: "text" },
    min: { control: "text", description: "Earliest selectable date (ISO)" },
    max: { control: "text", description: "Latest selectable date (ISO)" },
    open: {
      control: "boolean",
      description:
        "Whether the calendar panel is open. **Uncontrolled:** the picker toggles internally. **Controlled:** sync from `mdOpen` / `mdClose` / `mdCancel` and set `open` from your state.",
    },
    disabled: { control: "boolean" },
    required: { control: "boolean" },
    error: { control: "boolean" },
    errorText: { control: "text" },
    supportingText: { control: "text" },
    locale: { control: "text", description: "BCP-47 locale tag" },
    dateSeparator: {
      name: "date-separator",
      control: "text",
      description:
        "Separator between day, month, and year in the text field. Empty = locale default. Value/events stay ISO YYYY-MM-DD.",
    },
    firstDayOfWeek: {
      control: "select",
      options: [-1, 0, 1, 2, 3, 4, 5, 6],
      description: "-1 = derive from locale",
    },
    headline: {
      control: "text",
      description: "Modal header supporting text (not auto-translated)",
    },
    selectDateLabel: { name: "select-date-label", control: "text" },
    enterDatesLabel: { name: "enter-dates-label", control: "text" },
    cancelLabel: { name: "cancel-label", control: "text" },
    okLabel: { name: "ok-label", control: "text" },
    scrimDismissible: {
      name: "scrim-dismissible",
      control: "boolean",
      description:
        "Clicking the MODAL scrim dismisses. The docked variant has no scrim — see `outside-click-dismissible`.",
    },
    outsideClickDismissible: {
      name: "outside-click-dismissible",
      control: "boolean",
      description:
        "Clicking outside a DOCKED panel dismisses it. Switch `variant` to `docked` to see this control do anything. Dismissing this way emits `mdCancel`.",
    },
    commitOnSelect: {
      name: "commit-on-select",
      control: "boolean",
      description:
        "A day click stages **and** commits, and the built-in Cancel / OK row is not rendered. Input mode keeps its OK button — typing has no click to collapse.",
    },
  },
  args: {
    variant: "modal-input",
    label: "Date",
    value: "",
    placeholder: "",
    min: "",
    max: "",
    open: false,
    disabled: false,
    required: false,
    error: false,
    errorText: "",
    supportingText: "",
    locale: "",
    dateSeparator: "",
    firstDayOfWeek: -1,
    headline: "Select date",
    selectDateLabel: "Select date",
    enterDatesLabel: "Enter dates",
    cancelLabel: "Cancel",
    okLabel: "OK",
    scrimDismissible: true,
    outsideClickDismissible: true,
    commitOnSelect: false,
  },
};

export default meta;
type Story = StoryObj;

const ROW = "display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start;";
const SECTION = "padding:24px; font-family:Roboto,sans-serif; max-width:960px;";
const HEADING =
  "color: var(--md-sys-color-on-surface-variant, #49454F); margin:20px 0 8px; font-size:13px; font-weight:500; text-transform:uppercase; letter-spacing:0.5px;";
const DEMO_COL =
  "display:flex; flex-direction:column; gap:8px; min-inline-size:280px;";
const CAPTION =
  "font:400 11px/14px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;";
const OPEN_HINT = "Open the calendar to preview styling.";
const SLOT_OPEN_HINT =
  "Click the calendar icon to open — header and actions slots render inside the modal panel.";

type DatePickerEl = HTMLElement & { value: string; open: boolean };

const eventLogStyle =
  'padding: 12px 16px; min-height: 80px; max-height: 220px; overflow: auto; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 12px/20px "Roboto Mono", ui-monospace, monospace; color: var(--md-sys-color-on-surface-variant, #49454F);';

const hintStyle =
  "padding: 12px 16px; background: var(--md-sys-color-surface-variant, #E7E0EC); border-radius: 8px; font: 400 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);";

const stateBadgeStyle =
  'display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; background: var(--md-sys-color-surface-container, #F3EDF7); font: 500 12px/16px "Roboto Mono", ui-monospace, monospace; color: var(--md-sys-color-on-surface, #1C1B1F);';

const btnStyle =
  "padding: 6px 16px; border: 1px solid var(--md-sys-color-outline, #79747E); border-radius: 20px; background: none; cursor: pointer; font: 500 13px/18px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F);";

function appendEventLog(logId: string, name: string, detail?: unknown) {
  const logEl = document.getElementById(logId);
  if (!logEl) return;
  const ts = new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
  const line = document.createElement("div");
  const detailStr =
    detail === undefined ? "" : ` → <code>${JSON.stringify(detail)}</code>`;
  line.innerHTML = `<span style="opacity: 0.87">${ts}</span> <strong>${name}</strong>${detailStr}`;
  logEl.prepend(line);
  if (logEl.children.length > 12) logEl.lastElementChild?.remove();
}

function bindDatePickerEvents(picker: DatePickerEl, logId: string) {
  picker.addEventListener("mdChange", (e) =>
    appendEventLog(logId, "mdChange", (e as CustomEvent).detail),
  );
  picker.addEventListener("mdSelected", (e) =>
    appendEventLog(logId, "mdSelected", (e as CustomEvent).detail),
  );
  picker.addEventListener("mdInput", (e) =>
    appendEventLog(logId, "mdInput", (e as CustomEvent).detail),
  );
  picker.addEventListener("mdOpen", () => appendEventLog(logId, "mdOpen"));
  picker.addEventListener("mdClose", () => appendEventLog(logId, "mdClose"));
  picker.addEventListener("mdCancel", () => appendEventLog(logId, "mdCancel"));
  picker.addEventListener("mdViewChange", (e) =>
    appendEventLog(logId, "mdViewChange", (e as CustomEvent).detail),
  );
  picker.addEventListener("mdMenuOpen", (e) =>
    appendEventLog(logId, "mdMenuOpen", (e as CustomEvent).detail),
  );
  picker.addEventListener("mdMenuSelect", (e) =>
    appendEventLog(logId, "mdMenuSelect", (e as CustomEvent).detail),
  );
  picker.addEventListener("mdModeChange", (e) =>
    appendEventLog(logId, "mdModeChange", (e as CustomEvent).detail),
  );
}

function syncLiveState(picker: DatePickerEl, valueId: string, openId: string) {
  const valueEl = document.getElementById(valueId);
  const openEl = document.getElementById(openId);
  if (valueEl) valueEl.textContent = picker.value || "(empty)";
  if (openEl) openEl.textContent = String(picker.open);
}

/* ─── 1. Playground ─────────────────────────────────── */
export const Playground: Story = {
  render: (args) => html`
    <div style="padding: 24px; max-width: 700px;">
      <md-date-picker
        style=${args.variant === "docked" ? "max-inline-size: 280px;" : ""}
        variant=${args.variant}
        label=${args.label}
        value=${args.value || ""}
        placeholder=${args.placeholder || ""}
        min=${args.min || ""}
        max=${args.max || ""}
        ?open=${args.open}
        ?disabled=${args.disabled}
        ?required=${args.required}
        ?error=${args.error}
        error-text=${args.errorText || ""}
        supporting-text=${args.supportingText || ""}
        locale=${args.locale || ""}
        first-day-of-week=${args.firstDayOfWeek}
        headline=${args.headline}
        select-date-label=${args.selectDateLabel}
        enter-dates-label=${args.enterDatesLabel}
        cancel-label=${args.cancelLabel}
        ok-label=${args.okLabel}
        .scrimDismissible=${args.scrimDismissible}
        .outsideClickDismissible=${args.outsideClickDismissible}
        ?commit-on-select=${args.commitOnSelect}
      ></md-date-picker>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const el = canvasElement.querySelector("md-date-picker") as HTMLElement;
    await waitFor(() => expect(el.classList.contains("hydrated")).toBe(true));

    // Coverage-gated: opening the panel and switching variants is highly
    // visible, and play() runs whenever the story is viewed. md-date-picker is
    // the second-largest coverage gap in the library (346 uncovered lines) and
    // none of these paths were reachable from a story.
    if (!drivingCoverage()) return;
    await exerciseProps(el, [
      ["variant", "modal"],
      ["variant", "docked"],
      ["fieldVariant", "filled"],
      ["firstDayOfWeek", 1],
      ["clearable", true],
      ["required", true],
      ["error", true],
      ["open", true],
      ["open", false],
      ["value", "2026-03-15"],
      ["value", ""],
      ["commitOnSelect", true],
      ["commitOnSelect", false],
      ["outsideClickDismissible", false],
      ["outsideClickDismissible", true],
    ]);
  },
};

/* ─── 2. Variants ───────────────────────────────────── */
export const Variants: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { globals }) => html`
    <div
      style="display: flex; flex-direction: column; gap: 32px; padding: 24px; max-width: 420px;"
    >
      <div>
        <h4 style="margin: 0 0 8px; font: 500 14px system-ui;">
          Modal input (default)
        </h4>
        <md-date-picker
          variant="modal-input"
          label=${t(globals.locale, "date-picker.event-date")}
          value="2025-06-15"
        ></md-date-picker>
      </div>

      <div>
        <h4 style="margin: 0 0 8px; font: 500 14px system-ui;">Docked</h4>
        <md-date-picker
          variant="docked"
          label=${t(globals.locale, "date-picker.start-date")}
        ></md-date-picker>
      </div>

      <div>
        <h4 style="margin: 0 0 8px; font: 500 14px system-ui;">
          Modal (surface from your own trigger)
        </h4>
        <md-button id="dp-modal-trigger" variant="filled"
          >${t(globals.locale, "date-picker.pick-a-date")}</md-button
        >
        <md-date-picker
          id="dp-modal"
          variant="modal"
          label=${t(globals.locale, "date-picker.report-date")}
        ></md-date-picker>
        <script>
          (() => {
            const btn = document.getElementById("dp-modal-trigger");
            const dp = document.getElementById("dp-modal");
            if (btn && dp) btn.addEventListener("click", () => dp.show());
          })();
        </script>
      </div>
    </div>
  `,
};

/* ─── 3. Modal input — opened ───────────────────────── */
export const ModalInputOpen: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { viewMode }) => html`
    <div style="padding: 24px;">
      <md-date-picker
        variant="modal-input"
        label="Appointment"
        value="2025-06-15"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
  /** Modal calendar: clicking a day stages it (mdSelected); only OK commits value + closes. */
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);

    await step("Modal opens with the seeded date staged", async () => {
      expect(picker.open).toBe(true);
      // aria-selected reflects on the next render flush → assert inside waitFor.
      await waitFor(() =>
        expect(
          dpDayCell(picker, "2025-06-15")?.getAttribute("aria-selected"),
        ).toBe("true"),
      );
    });

    const committedBefore = picker.value; // '2025-06-15'
    let fieldTextBefore = "";
    let selectedDetail: { value: string } | undefined;

    await step(
      "Clicking a calendar day stages it (mdSelected) without committing",
      async () => {
        await waitFor(() => expect(dpFieldInput(picker)?.value).toBeTruthy());
        fieldTextBefore = dpFieldInput(picker)!.value; // seeded 06/15/2025
        picker.addEventListener(
          "mdSelected",
          (e) => {
            selectedDetail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        dpDayCell(picker, "2025-06-28")!.click();
        await waitFor(() =>
          expect(
            dpDayCell(picker, "2025-06-28")?.getAttribute("aria-selected"),
          ).toBe("true"),
        );
        expect(
          dpDayCell(picker, "2025-06-15")?.getAttribute("aria-selected"),
        ).toBe("false");
        expect(selectedDetail?.value).toBe("2025-06-28");
        // GUARD: staging neither commits the value nor closes the modal.
        expect(picker.value).toBe(committedBefore);
        expect(picker.open).toBe(true);
      },
    );

    await step(
      "OK commits: value + field text update and the modal closes",
      async () => {
        let changeDetail: { value: string } | undefined;
        picker.addEventListener(
          "mdChange",
          (e) => {
            changeDetail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        const ok = dpActionButton(picker, "ok-button")!;
        await waitFor(() =>
          expect(ok.classList.contains("hydrated")).toBe(true),
        );
        ok.click();
        await waitFor(() => expect(picker.value).not.toBe(committedBefore)); // moved
        expect(picker.value).toBe("2025-06-28"); // to the clicked day
        expect(changeDetail?.value).toBe("2025-06-28");
        await waitFor(() => expect(picker.open).toBe(false)); // modal closes
        await waitFor(() => {
          const now = dpFieldInput(picker)?.value ?? "";
          expect(now).not.toBe(fieldTextBefore); // trigger field text changed
          expect(now).toContain("28");
        });
        // Let the panel bloom-out (~200ms) finish before teardown.
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

/* ─── 3a. Modal date input — typed-entry view ─────── */
/** MD3 "modal date input" — click the edit icon in the calendar header, or use the play function. */
export const ModalDateInputOpen: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { viewMode }) => html`
    <div style="padding: 24px;">
      <md-date-picker
        id="modal-date-input-demo"
        variant="modal-input"
        label="Date"
        headline="Select date"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
  play: async () => {
    const picker = document.getElementById("modal-date-input-demo") as
      | (HTMLElement & { shadowRoot: ShadowRoot })
      | null;
    const toggle = picker?.shadowRoot?.querySelector(
      '[part="mode-toggle"]',
    ) as HTMLElement | null;
    toggle?.click();
  },
};

/* ─── 4. Docked — opened ────────────────────────────── */
/**
 * The docked anatomy: an outlined text field above an anchored calendar whose
 * header uses month + year dropdown menu buttons, each flanked by prev/next
 * chevron icon buttons (`‹ [Aug ▾] ›   ‹ [2025 ▾] ›`; active trigger shows `▸`),
 * baseline md-menu month/year
 * pickers (radio on the left, replaces the day grid while open), weekday row,
 * four distinct day-cell states (unselected box, today ring, selected fill,
 * outside muted), and a Cancel / OK action row.
 */
export const DockedOpen: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { viewMode }) => html`
    <div style="padding: 24px; block-size: 620px;">
      <md-date-picker
        style="max-inline-size: 280px;"
        variant="docked"
        label="Date"
        value="2025-08-17"
        supporting-text="MM/DD/YYYY"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
  /** Pick a day → it stages (mdSelected) but only OK commits value + closes. */
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);

    await step("Docked panel opens with the seeded date staged", async () => {
      expect(picker.open).toBe(true);
      await waitFor(() =>
        expect(
          dpDayCell(picker, "2025-08-17")?.getAttribute("aria-selected"),
        ).toBe("true"),
      );
    });

    const committedBefore = picker.value; // '2025-08-17'
    let fieldTextBefore = "";
    let selectedDetail: { value: string } | undefined;

    await step(
      "Clicking a day stages it (mdSelected) without committing",
      async () => {
        await waitFor(() => expect(dpFieldInput(picker)?.value).toBeTruthy());
        fieldTextBefore = dpFieldInput(picker)!.value;
        picker.addEventListener(
          "mdSelected",
          (e) => {
            selectedDetail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        dpDayCell(picker, "2025-08-22")!.click();
        // aria-selected is reflected on the next render flush → assert inside waitFor.
        await waitFor(() =>
          expect(
            dpDayCell(picker, "2025-08-22")?.getAttribute("aria-selected"),
          ).toBe("true"),
        );
        expect(
          dpDayCell(picker, "2025-08-17")?.getAttribute("aria-selected"),
        ).toBe("false");
        expect(selectedDetail?.value).toBe("2025-08-22");
        // GUARD: staging neither commits the value nor closes the docked panel.
        expect(picker.value).toBe(committedBefore);
        expect(picker.open).toBe(true);
      },
    );

    await step(
      "OK commits: value + field text update and the panel closes",
      async () => {
        let changeDetail: { value: string } | undefined;
        picker.addEventListener(
          "mdChange",
          (e) => {
            changeDetail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        dpActionButton(picker, "ok-button")!.click();
        await waitFor(() => expect(picker.value).not.toBe(committedBefore)); // moved
        expect(picker.value).toBe("2025-08-22"); // to the clicked day
        expect(changeDetail?.value).toBe("2025-08-22");
        await waitFor(() => expect(picker.open).toBe(false)); // menu closes
        await waitFor(() => {
          const now = dpFieldInput(picker)?.value ?? "";
          expect(now).not.toBe(fieldTextBefore); // field text changed
          expect(now).toContain("22");
        });
        // Let the panel bloom-out (~200ms) finish before teardown.
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

/* ─── 4a. Docked — opened at inline-end ─────────────── */
/** Docked picker at the far inline-end edge — panel auto-flips to end alignment so it stays in the viewport. */
export const DockedOpenRight: Story = {
  parameters: {
    layout: "fullscreen",
    controls: { disable: true },
  },
  render: (_args, { viewMode }) => html`
    <div
      style="display: flex; justify-content: flex-end; padding: 24px; inline-size: 100%; min-block-size: 620px; box-sizing: border-box;"
    >
      <md-date-picker
        style="max-inline-size: 280px;"
        variant="docked"
        label="Date"
        value="2025-08-17"
        supporting-text="MM/DD/YYYY"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
};

/* ─── 5. States ─────────────────────────────────────── */
/** `commit-on-select` collapses stage-then-confirm into a single click: the day
 *  click emits `mdSelected` AND `mdChange`, the panel dismisses, and the
 *  built-in Cancel / OK row is not rendered. */
export const CommitOnSelect: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "By default a day click only **stages** (`mdSelected`) and OK **commits** (`mdChange`) — " +
          "in every variant, docked included. `commit-on-select` collapses the two into one click: " +
          "both events fire together, the panel dismisses, and the built-in Cancel / OK row is not " +
          "rendered, since nothing is left for it to confirm. Without that row the panel would end " +
          "flush against its own edge, so the calendar takes the row's bottom inset instead.<br><br>" +
          "Reach for it on a **low-stakes, reversible** field — a filter, a preference. Keep the " +
          "confirm step when the choice is expensive to get wrong. A slotted `actions` row is " +
          "honoured either way, and **input mode keeps its OK button**: typing has no click to collapse.",
      },
    },
  },
  render: () => html`
    <div style="${ROW} gap: 24px;">
      <div style=${DEMO_COL}>
        <md-date-picker
          label="Default"
          value="2026-08-10"
        ></md-date-picker>
        <p style=${CAPTION}>Pick a day → staged. Only OK commits.</p>
      </div>
      <div style=${DEMO_COL}>
        <md-date-picker
          label="commit-on-select"
          value="2026-08-10"
          commit-on-select
        ></md-date-picker>
        <p style=${CAPTION}>Pick a day → committed and closed, no action row.</p>
      </div>
      <div style=${DEMO_COL}>
        <md-date-picker
          label="docked + commit-on-select"
          variant="docked"
          value="2026-08-10"
          commit-on-select
        ></md-date-picker>
        <p style=${CAPTION}>Same one-click commit in the docked popup.</p>
      </div>
    </div>
  `,
  /** Proves the difference: the same day click stages in one picker and commits in the other. */
  play: async ({ canvasElement, step }) => {
    const [staging, instant] = Array.from(
      canvasElement.querySelectorAll("md-date-picker"),
    ) as DpPlayEl[];
    await waitFor(() =>
      expect(instant.classList.contains("hydrated")).toBe(true),
    );

    await step("default picker: a day click stages, value unchanged", async () => {
      staging.open = true;
      await waitFor(() => expect(dpPanel(staging)).toBeTruthy());
      await waitFor(() => expect(dpDayCell(staging, "2026-08-20")).toBeTruthy());
      dpDayCell(staging, "2026-08-20")!.click();
      await waitFor(() => expect(staging.value).toBe("2026-08-10"));
      expect(staging.open).toBe(true);
      expect(dpActionButton(staging, "ok-button")).toBeTruthy();
      staging.open = false;
      await waitFor(() => expect(staging.open).toBe(false));
    });

    await step("commit-on-select: no action row, the click commits", async () => {
      instant.open = true;
      await waitFor(() => expect(dpPanel(instant)).toBeTruthy());
      expect(dpActionButton(instant, "ok-button")).toBeNull();
      expect(dpActionButton(instant, "cancel-button")).toBeNull();
      await waitFor(() => expect(dpDayCell(instant, "2026-08-20")).toBeTruthy());
      dpDayCell(instant, "2026-08-20")!.click();
      await waitFor(() => expect(instant.value).toBe("2026-08-20"));
      await waitFor(() => expect(instant.open).toBe(false));
    });
  },
};

export const OutsideClickDismissible: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "A **modal** puts a scrim between the panel and the page, and clicking it dismisses — " +
          "`scrim-dismissible` turns that off. A **docked** panel has no scrim, so the outside click " +
          "is caught on the document instead; `outside-click-dismissible` is its opt-out.<br><br>" +
          "Either way the dismissal is a **cancel**: `mdCancel` fires and anything staged is discarded. " +
          "Set it to `false` when a stray click must not throw away a half-made choice, or when the " +
          "picker sits inside another popup whose own click-away handling would close both at once. " +
          "Turning it off strips nothing else — `Escape`, the trigger toggle and Cancel / OK all still work.",
      },
    },
  },
  render: () => html`
    <div style="${ROW} gap: 24px;">
      <div style=${DEMO_COL}>
        <md-date-picker
          label="Default"
          variant="docked"
          value="2026-08-10"
        ></md-date-picker>
        <p style=${CAPTION}>Open it, then click the background — it closes.</p>
      </div>
      <div style=${DEMO_COL}>
        <md-date-picker
          label="outside-click-dismissible=false"
          variant="docked"
          value="2026-08-10"
          outside-click-dismissible="false"
        ></md-date-picker>
        <p style=${CAPTION}>Same click leaves this one open. Esc still closes it.</p>
      </div>
    </div>
  `,
  /** Opens both, then sends one outside pointerdown: exactly one panel should react. */
  play: async ({ canvasElement, step }) => {
    const [dismissible, sticky] = Array.from(
      canvasElement.querySelectorAll("md-date-picker"),
    ) as DpPlayEl[];
    await waitFor(() => expect(sticky.classList.contains("hydrated")).toBe(true));

    let cancels = 0;
    dismissible.addEventListener("mdCancel", () => (cancels += 1));

    await step("both docked panels open", async () => {
      dismissible.open = true;
      sticky.open = true;
      await waitFor(() => expect(dpPanel(dismissible)).toBeTruthy());
      await waitFor(() => expect(dpPanel(sticky)).toBeTruthy());
    });

    await step("one outside pointerdown dismisses only the default", async () => {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, composed: true }),
      );
      await waitFor(() => expect(dismissible.open).toBe(false));
      expect(cancels).toBe(1);
      expect(sticky.open).toBe(true);
    });

    await step("Escape still closes the opted-out picker", async () => {
      dpKey(dpPanel(sticky)!, "Escape");
      await waitFor(() => expect(sticky.open).toBe(false));
    });
  },
};

export const States: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { globals }) => html`
    <div
      style="display: flex; flex-direction: column; gap: 24px; padding: 24px; max-width: 360px;"
    >
      <md-date-picker label="Default"></md-date-picker>
      <md-date-picker label="Pre-selected" value="2025-06-15"></md-date-picker>
      <md-date-picker
        label="Required"
        required
        supporting-text=${t(globals.locale, "date-picker.field-required")}
      ></md-date-picker>
      <md-date-picker
        label="With error"
        error
        error-text=${t(globals.locale, "date-picker.invalid-date")}
      ></md-date-picker>
      <md-date-picker
        label="Constrained"
        min="2025-06-01"
        max="2025-06-30"
        supporting-text=${t(globals.locale, "date-picker.june-only")}
      ></md-date-picker>
      <md-date-picker
        label="Disabled"
        value="2025-06-15"
        disabled
      ></md-date-picker>
    </div>
  `,
};

/* ─── 8. Localization ───────────────────────────────── */
/** Side-by-side locale demos with explicit label overrides. See `JapaneseLocale` for locale-only copy. */
export const DateSeparators: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div style="${SECTION}">
      <p style="${CAPTION}; margin-block-end: 16px;">
        Override the separator between day, month, and year in the text field.
        <code>value</code> and <code>mdChange</code> always stay ISO
        <code>YYYY-MM-DD</code>.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            label="Slash (en-US)"
            locale="en-US"
            date-separator="/"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">date-separator="/" → 06/15/2025</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            label="Dot (de-DE)"
            locale="de-DE"
            date-separator="."
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">date-separator="." → 15.06.2025</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            label="Dash"
            locale="en-US"
            date-separator="-"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">date-separator="-" → 06-15-2025</p>
        </div>
      </div>
    </div>
  `,
};

export const Localization: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div
      style="display: flex; flex-direction: column; gap: 24px; padding: 24px; max-width: 360px;"
    >
      <md-date-picker
        label="Français"
        locale="fr-FR"
        value="2025-06-15"
        headline="Sélectionner une date"
        select-date-label="Sélectionner une date"
        enter-dates-label="Saisir une date"
        cancel-label="Annuler"
        ok-label="OK"
      ></md-date-picker>
      <md-date-picker
        label="Deutsch (week starts Monday)"
        locale="de-DE"
        value="2025-06-15"
        headline="Datum auswählen"
        select-date-label="Datum auswählen"
        enter-dates-label="Datum eingeben"
        cancel-label="Abbrechen"
        ok-label="OK"
      ></md-date-picker>
      <md-date-picker
        label="日付"
        locale="ja-JP"
        value="2025-06-15"
        headline="日付を選択"
        select-date-label="日付を選択"
        enter-dates-label="日付を入力"
        cancel-label="キャンセル"
        ok-label="OK"
        previous-month-label="前の月"
        next-month-label="次の月"
        previous-year-label="前の年"
        next-year-label="次の年"
        choose-month-label="月を選択"
        choose-year-label="年を選択"
        choose-month-year-label="月と年を選択"
        choose-month-and-year-label="月と年を選択"
        toggle-calendar-label="カレンダー入力に切り替え"
        toggle-text-label="テキスト入力に切り替え"
        open-calendar-label="カレンダーを開く"
        close-calendar-label="カレンダーを閉じる"
        year-grid-label="年"
      ></md-date-picker>
      <md-date-picker
        label="Force Monday start"
        first-day-of-week="1"
        value="2025-06-15"
      ></md-date-picker>
    </div>
  `,
};

/** Japanese UI strings from `locale="ja-JP"` only — no explicit label props. */
export const JapaneseLocale: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div style="padding: 24px;">
      <md-date-picker locale="ja-JP" value="2025-06-15"></md-date-picker>
    </div>
  `,
};

/** Japanese docked variant — tooltip labels via explicit props (locale formats dates only). */
export const JapaneseDocked: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div style="padding: 24px; max-width: 360px;">
      <md-date-picker
        variant="docked"
        label="日付"
        locale="ja-JP"
        value="2025-06-15"
        previous-month-label="前の月"
        next-month-label="次の月"
        previous-year-label="前の年"
        next-year-label="次の年"
        choose-month-label="月を選択"
        choose-year-label="年を選択"
        cancel-label="キャンセル"
        ok-label="OK"
      ></md-date-picker>
    </div>
  `,
};

/* ─── 9. RTL ────────────────────────────────────────── */
export const RTL: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div
      dir="rtl"
      style="display: flex; flex-direction: column; gap: 32px; padding: 24px; max-width: 420px;"
    >
      <div>
        <h4 style="margin: 0 0 8px; font: 500 14px system-ui;">Modal input</h4>
        <md-date-picker
          label="التاريخ"
          locale="ar"
          value="2025-06-15"
          headline="اختر تاريخًا"
          select-date-label="اختر تاريخًا"
          enter-dates-label="أدخل التاريخ"
          cancel-label="إلغاء"
          ok-label="موافق"
        ></md-date-picker>
      </div>

      <div>
        <h4 style="margin: 0 0 8px; font: 500 14px system-ui;">Docked</h4>
        <md-date-picker
          style="max-inline-size: 280px;"
          variant="docked"
          label="التاريخ"
          locale="ar"
          value="2025-08-17"
          previous-month-label="الشهر السابق"
          next-month-label="الشهر التالي"
          previous-year-label="السنة السابقة"
          next-year-label="السنة التالية"
          choose-month-label="اختر الشهر"
          choose-year-label="اختر السنة"
          cancel-label="إلغاء"
          ok-label="موافق"
        ></md-date-picker>
      </div>
    </div>
  `,
};

/* ─── 10. Dark theme ────────────────────────────────── */
export const DarkTheme: Story = {
  parameters: { controls: { disable: true } },
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <md-date-picker label="Dark date" value="2025-06-15"></md-date-picker>
  `,
};

/* ==========================================================
   CUSTOM CSS (--md-date-picker-* properties)
   ========================================================== */
export const CustomCSS: Story = {
  name: "Custom CSS Properties",
  parameters: {
    controls: { disable: true },
    docs: {
      source: {
        code: `/* Calendar trigger icon — prop shorthand */
<md-date-picker label="Schedule" calendar-icon="schedule" value="2025-06-15"></md-date-picker>

/* Calendar trigger icon — custom SVG via slot */
<md-date-picker class="brand-theme" label="Event" value="2025-06-15">
  <svg slot="calendar-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>
  </svg>
</md-date-picker>

<style>
.brand-theme {
  --md-date-picker-icon-color: #6750a4; /* colors calendar-button + nav icons */
}
</style>`,
      },
    },
  },
  render: () => html`
    <style>
      /* ── Trigger icon colors (one per picker) ── */
      .icon-star {
        --md-date-picker-icon-color: #f9a825;
      }
      .icon-emoji {
        --md-date-picker-icon-color: #e65100;
      }
      .icon-event {
        --md-date-picker-icon-color: #00897b;
      }
      .icon-heart {
        --md-date-picker-icon-color: #e91e63;
      }
      .icon-clock {
        --md-date-picker-icon-color: #5e35b1;
      }
      .icon-teal {
        --md-date-picker-icon-color: #00897b;
      }
      .icon-coral {
        --md-date-picker-icon-color: #ff6f61;
      }

      /* ── Selected day pill — CSS vars ── */
      .sel-default {
        /* inherits MD3 primary — shown for side-by-side comparison */
      }
      .sel-brand {
        --md-date-picker-day-selected-bg: #6750a4;
        --md-date-picker-day-selected-color: #ffffff;
      }
      .sel-coral {
        --md-date-picker-day-selected-bg: #ff6f61;
        --md-date-picker-day-selected-color: #ffffff;
      }
      .sel-error {
        --md-date-picker-day-selected-bg: var(--md-sys-color-error, #b3261e);
        --md-date-picker-day-selected-color: var(
          --md-sys-color-on-error,
          #ffffff
        );
      }

      /* ── Today indicator — CSS vars ── */
      .today-brand-ring {
        --md-date-picker-today-outline-color: #6750a4;
      }
      .today-error-ring {
        --md-date-picker-today-outline-color: var(
          --md-sys-color-error,
          #b3261e
        );
      }
      .today-ocean-ring {
        --md-date-picker-today-outline-color: #00897b;
      }
      .today-coral-ring {
        --md-date-picker-today-outline-color: #ff6f61;
      }

      .colors-brand {
        --md-date-picker-day-selected-bg: #6750a4;
        --md-date-picker-day-selected-color: #ffffff;
        --md-date-picker-today-outline-color: #6750a4;
        --md-date-picker-weekday-color: #6750a4;
        --md-date-picker-icon-color: #6750a4;
        --md-date-picker-action-color: #6750a4;
      }
      .colors-danger {
        --md-date-picker-day-selected-bg: var(--md-sys-color-error, #b3261e);
        --md-date-picker-day-selected-color: var(
          --md-sys-color-on-error,
          #ffffff
        );
        --md-date-picker-today-outline-color: var(
          --md-sys-color-error,
          #b3261e
        );
        --md-date-picker-weekday-color: var(--md-sys-color-error, #b3261e);
        --md-date-picker-action-color: var(--md-sys-color-error, #b3261e);
      }
      .colors-ocean {
        --md-date-picker-day-color: #004d40;
        --md-date-picker-day-selected-bg: #00695c;
        --md-date-picker-day-selected-color: #ffffff;
        --md-date-picker-today-outline-color: #00897b;
        --md-date-picker-weekday-color: #00695c;
        --md-date-picker-icon-color: #00897b;
      }
      .bg-warm {
        --md-date-picker-container-color: #fff8e1;
        --md-date-picker-header-color: #ffe082;
        --md-date-picker-headline-color: #e65100;
        --md-date-picker-supporting-color: #ef6c00;
      }
      .bg-cool {
        --md-date-picker-container-color: #e3f2fd;
        --md-date-picker-header-color: #90caf9;
        --md-date-picker-headline-color: #1565c0;
        --md-date-picker-supporting-color: #1976d2;
        --md-date-picker-menu-color: #bbdefb;
      }
      .bg-surface {
        --md-date-picker-container-color: var(
          --md-sys-color-surface-container-low,
          #f7f2fa
        );
        --md-date-picker-header-color: var(
          --md-sys-color-surface-container,
          #f3edf7
        );
      }
      .panel-sharp {
        --md-date-picker-container-shape: 0px;
      }
      .panel-subtle {
        --md-date-picker-container-shape: 8px;
      }
      .field-ocean {
        --md-date-picker-field-color: #006a6a;
        --md-date-picker-field-text-color: #006a6a;
        --md-date-picker-label-color: #006a6a;
        --md-date-picker-field-supporting-color: #006a6a;
      }
      .field-pill-brand {
        --md-date-picker-field-container-color: #6750a4;
        --md-date-picker-field-container-shape: var(
          --md-sys-shape-corner-full,
          9999px
        );
        --md-date-picker-field-filled-pill: 1;
        --md-date-picker-field-text-color: #ffffff;
        --md-date-picker-label-color: #e8def8;
        --md-date-picker-field-supporting-color: #6750a4;
        --md-date-picker-icon-color: #ffffff;
      }
      .field-square-coral {
        --md-date-picker-field-container-color: #c0392b;
        --md-date-picker-field-container-shape: var(
          --md-sys-shape-corner-none,
          0px
        );
        --md-date-picker-field-text-color: #ffffff;
        --md-date-picker-label-color: #ffe8e6;
        --md-date-picker-field-supporting-color: #c0392b;
        --md-date-picker-icon-color: #ffffff;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">
        Calendar trigger icon — <code>calendar-icon</code> prop (trailing
        toggle)
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            label="Default (calendar_today)"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">Built-in <code>calendar_today</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-event"
            label="Event"
            calendar-icon="event"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}"><code>calendar-icon="event"</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-clock"
            label="Today"
            calendar-icon="today"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}"><code>calendar-icon="today"</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-star"
            label="Schedule"
            calendar-icon="schedule"
            value="2025-09-01"
          ></md-date-picker>
          <p style="${CAPTION}"><code>calendar-icon="schedule"</code></p>
        </div>
      </div>

      <p style="${HEADING}">
        Calendar trigger icon — <code>slot="calendar-icon"</code> (overrides
        prop)
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-star"
            label="Star (SVG)"
            value="2025-06-15"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">
            Gold star SVG · <code>--md-date-picker-icon-color: #f9a825</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-emoji"
            label="Calendar (emoji)"
            value="2025-12-31"
          >
            <span
              slot="calendar-icon"
              style="font-size:24px; line-height:1"
              aria-hidden="true"
              >📅</span
            >
          </md-date-picker>
          <p style="${CAPTION}">
            Calendar emoji · icon color <code>#e65100</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-heart"
            label="Favorite (SVG)"
            value="2025-02-14"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">Heart SVG · pink <code>#e91e63</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-clock"
            label="Schedule (clock)"
            value="2025-09-01"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">Clock SVG · purple <code>#5e35b1</code></p>
        </div>
      </div>

      <p style="${HEADING}">Leading field icon vs calendar trigger icon</p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-coral"
            label="Both icons"
            value="2025-06-15"
          >
            <span slot="leading-icon" class="material-symbols-outlined"
              >cake</span
            >
          </md-date-picker>
          <p style="${CAPTION}">
            Leading <code>cake</code> + default trailing
            <code>calendar_today</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-teal"
            label="Leading + custom trigger"
            value="2025-06-15"
            calendar-icon="event"
          >
            <span slot="leading-icon" class="material-symbols-outlined"
              >cake</span
            >
          </md-date-picker>
          <p style="${CAPTION}">
            Leading <code>cake</code> + trailing <code>event</code> via prop
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Calendar trigger color — <code>--md-date-picker-icon-color</code>
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-coral"
            label="Coral trigger"
            calendar-icon="event"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>::part(calendar-button)</code> + host icon color
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="icon-teal"
            variant="docked"
            style="max-inline-size:280px;"
            label="Docked nav"
            value="2025-08-17"
          ></md-date-picker>
          <p style="${CAPTION}">
            Docked chevrons, menu carets, and calendar toggle
          </p>
        </div>
      </div>

      <p style="${HEADING}">Selected day pill — CSS vars (default vs custom)</p>
      <p style="${CAPTION}; margin-block-end:12px;">
        ${OPEN_HINT} Selected date is pre-set on each picker.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-default"
            label="Default pill"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">MD3 primary fill — no overrides</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-brand"
            label="Brand purple"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-day-selected-bg: #6750a4</code><br />
            <code>--md-date-picker-day-selected-color: #fff</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-coral"
            label="Coral pill"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">Coral bg + white label via CSS vars</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-error"
            label="Error pill"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">Error token bg + on-error label color</p>
        </div>
      </div>

      <p style="${HEADING}">Today indicator — CSS vars (outline ring color)</p>
      <p style="${CAPTION}; margin-block-end:12px;">
        ${OPEN_HINT} No value set — calendar opens on the current month so
        today’s ring is visible.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker label="Default today ring"></md-date-picker>
          <p style="${CAPTION}">Primary outline ring — MD3 default</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-brand-ring"
            label="Brand ring"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-today-outline-color: #6750a4</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-error-ring"
            label="Error ring"
          ></md-date-picker>
          <p style="${CAPTION}">Error token outline ring</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-ocean-ring"
            label="Ocean ring"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-today-outline-color: #00897b</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-coral-ring"
            label="Coral ring"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-today-outline-color: #ff6f61</code>
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Combined colors — selected + today + weekday + actions
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="colors-brand"
            label="Brand theme"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            Full brand palette — ${OPEN_HINT.toLowerCase()}
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="colors-danger"
            label="Error theme"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">Selection, today ring, weekdays, OK/Cancel</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="colors-ocean"
            label="Ocean teal"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">Day text, selected bg, today ring, nav icons</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            label="Inline override"
            value="2025-06-15"
            style="--md-date-picker-day-selected-bg: coral; --md-date-picker-day-selected-color: white; --md-date-picker-today-outline-color: coral;"
          ></md-date-picker>
          <p style="${CAPTION}">Per-instance <code>style</code> attribute</p>
        </div>
      </div>

      <p style="${HEADING}">Custom backgrounds — panel, header, menu surface</p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="bg-warm"
            label="Warm panel"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-container-color</code>,
            <code>--md-date-picker-header-color</code> — open calendar to
            preview
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="bg-cool"
            label="Cool panel"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            Container + header +
            <code>--md-date-picker-menu-color</code> (docked menus)
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="bg-surface"
            label="Surface tokens"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            MD3 surface-container-low / surface-container header band
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Field outline — <code>--md-date-picker-field-color</code> / label / text
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="field-ocean"
            label="Ocean field"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            Outline, label, and input text color on the trigger field
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Field fill + shape — <code>field-variant="filled"</code> + container
        vars
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="field-pill-brand"
            field-variant="filled"
            label="Pill · brand"
            locale="en-US"
            date-separator="/"
            value="2025-06-15"
            supporting-text="MM/DD/YYYY"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>field-filled-pill: 1</code> + <code>corner-full</code> ·
            purple fill
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="field-square-coral"
            field-variant="filled"
            label="Square · coral"
            locale="en-US"
            date-separator="/"
            value="2025-06-15"
            supporting-text="MM/DD/YYYY"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-field-container-shape: corner-none</code> ·
            coral fill
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Panel shape — <code>--md-date-picker-container-shape</code>
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="panel-sharp"
            label="Sharp panel"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">0px — square dialog corners</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="panel-subtle"
            label="Subtle panel"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">8px — reduced corner radius</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            label="Default shape"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            Default <code>--md-sys-shape-corner-extra-large</code>
          </p>
        </div>
      </div>
    </div>
  `,
};

/* ==========================================================
   CSS ::part() STYLING
   ========================================================== */
export const CSSParts: Story = {
  name: "CSS ::part() Styling",
  parameters: { controls: { disable: true } },
  render: () => html`
    <style>
      /* ── Selected day pill — shape via ::part(day-selected) ── */
      .sel-part-default {
        /* MD3 circular default */
      }
      .sel-part-pill-brand {
        --md-date-picker-field-container-color: #6750a4;
        --md-date-picker-field-container-shape: var(
          --md-sys-shape-corner-full,
          9999px
        );
        --md-date-picker-field-filled-pill: 1;
        --md-date-picker-field-text-color: #ffffff;
        --md-date-picker-label-color: #e8def8;
        --md-date-picker-field-supporting-color: #6750a4;
        --md-date-picker-icon-color: #ffffff;
        --md-date-picker-day-selected-bg: #6750a4;
        --md-date-picker-day-selected-color: #ffffff;
      }
      .sel-part-pill-brand::part(day-selected) {
        --md-button-container-shape: var(--md-sys-shape-corner-full, 9999px);
        --md-button-container-color: #6750a4;
        --md-button-label-color: #ffffff;
      }
      .sel-part-square-coral {
        --md-date-picker-field-container-color: #c0392b;
        --md-date-picker-field-container-shape: var(
          --md-sys-shape-corner-none,
          0px
        );
        --md-date-picker-field-text-color: #ffffff;
        --md-date-picker-label-color: #ffe8e6;
        --md-date-picker-field-supporting-color: #c0392b;
        --md-date-picker-icon-color: #ffffff;
        --md-date-picker-day-selected-bg: #ff6f61;
        --md-date-picker-day-selected-color: #ffffff;
      }
      .sel-part-square-coral::part(day-selected) {
        --md-button-container-shape: var(--md-sys-shape-corner-none, 0px);
        --md-button-container-color: #ff6f61;
        --md-button-label-color: #ffffff;
      }
      .sel-part-rounded-error::part(day-selected) {
        --md-button-container-shape: 12px;
        --md-button-container-color: var(--md-sys-color-error, #b3261e);
        --md-button-label-color: var(--md-sys-color-on-error, #ffffff);
      }

      /* ── Today indicator — ::part(day-today) ── */
      .today-part-default {
        /* MD3 1px primary ring */
      }
      .today-part-thick::part(day-today) {
        --md-button-label-color: #1565c0;
        box-shadow: 0 0 0 3px #1565c0;
      }
      .today-part-filled::part(day-today) {
        --md-button-container-color: #00897b;
        --md-button-label-color: #ffffff;
        --md-button-container-shape: 20px;
        box-shadow: none;
      }
      .today-part-coral-ring::part(day-today) {
        --md-button-label-color: #ff6f61;
        box-shadow: 0 0 0 2px #ff6f61;
      }
      .today-part-square::part(day-today) {
        --md-button-container-shape: var(--md-sys-shape-corner-none, 0px);
        --md-button-label-color: #6750a4;
        box-shadow: 0 0 0 2px #6750a4;
      }

      /* Day selection shapes — ::part() on calendar cells only (not the field). */
      .day-shape-square::part(day-selected),
      .day-shape-square::part(day-today) {
        --md-button-container-shape: var(--md-sys-shape-corner-none, 0px);
      }
      .day-shape-pill::part(day-selected) {
        --md-button-container-shape: var(--md-sys-shape-corner-full, 9999px);
      }
      .day-shape-rounded::part(day-selected),
      .day-shape-rounded::part(day-today) {
        --md-button-container-shape: 12px;
      }

      /* Field trigger */
      .parts-field::part(field) {
        --md-text-field-outline-color: #1565c0;
        --md-text-field-label-color: #1565c0;
        --md-text-field-active-indicator-color: #1565c0;
      }
      .parts-field::part(supporting-text) {
        font-style: italic;
      }
      .parts-leading-icon {
        --md-date-picker-icon-color: #e65100;
      }

      /* Modal header & panel backgrounds */
      .parts-header::part(header) {
        background: linear-gradient(135deg, #e8def8 0%, #f3edff 100%);
        border-block-end: none;
      }
      .parts-header::part(headline) {
        font-style: italic;
        letter-spacing: 0.5px;
        color: var(--md-sys-color-on-surface-variant, #49454f);
      }
      .parts-header::part(supporting) {
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .parts-panel::part(panel) {
        background: linear-gradient(180deg, #e8f5e9 0%, #ffffff 40%);
      }

      /* Nav buttons & chevrons */
      .parts-nav::part(calendar-button) {
        --md-icon-button-icon-color: #e65100;
        --md-icon-button-container-color: #fff3e0;
      }
      .parts-nav::part(prev-button),
      .parts-nav::part(next-button) {
        --md-icon-button-icon-color: #1565c0;
      }
      .parts-docked-nav::part(prev-month-button),
      .parts-docked-nav::part(next-month-button),
      .parts-docked-nav::part(prev-year-button),
      .parts-docked-nav::part(next-year-button) {
        --md-icon-button-icon-color: #6a1b9a;
      }
      .parts-docked-nav::part(month-menu-button),
      .parts-docked-nav::part(year-menu-button) {
        font-weight: 700;
      }

      /* Day cells — weekday accent */
      .parts-days::part(weekday) {
        text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        font-weight: 600;
      }
      .parts-days::part(day-selected) {
        --md-button-container-color: #7b1fa2;
        --md-button-label-color: #ffffff;
      }
      .parts-days::part(day-today) {
        --md-button-label-color: #1565c0;
      }

      /* Actions */
      .parts-actions::part(ok-button) {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .parts-actions::part(cancel-button) {
        opacity: 0.7;
      }

      /* Mode toggle */
      .parts-toggle::part(mode-toggle) {
        --md-icon-button-icon-color: #00838f;
        --md-icon-button-container-color: #e0f7fa;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">
        Field + selected day — host vars, <code>field-variant="filled"</code>,
        <code>::part(day-selected)</code>
      </p>
      <p style="${CAPTION}; margin-block-end:12px;">
        Filled trigger field uses
        <code>--md-date-picker-field-container-*</code> on the host.
        ${OPEN_HINT} Day cells use matching
        <code>::part(day-selected)</code> shapes.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-part-default"
            variant="docked"
            style="max-inline-size:280px;"
            label="Default circle"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">MD3 filled circle — no ::part overrides</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-part-pill-brand"
            variant="docked"
            style="max-inline-size:280px;"
            field-variant="filled"
            label="Pill · brand"
            locale="en-US"
            date-separator="/"
            value="2025-06-15"
            supporting-text="MM/DD/YYYY"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>field-filled-pill: 1</code> + <code>corner-full</code> ·
            purple fill · 06/15/2025
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-part-square-coral"
            variant="docked"
            style="max-inline-size:280px;"
            field-variant="filled"
            label="Square · coral"
            locale="en-US"
            date-separator="/"
            value="2025-06-15"
            supporting-text="MM/DD/YYYY"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>corner-none</code> + coral <code>#c0392b</code> fill ·
            06/15/2025
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="sel-part-rounded-error"
            variant="docked"
            style="max-inline-size:280px;"
            label="Rounded · error"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            12px radius + error token fill on
            <code>::part(day-selected)</code> only
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Today indicator — <code>::part(day-today)</code> outline, fill, shape
      </p>
      <p style="${CAPTION}; margin-block-end:12px;">
        ${OPEN_HINT} No value set — today’s ring/fill visible on the current
        month.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-part-default"
            variant="docked"
            style="max-inline-size:280px;"
            label="Default ring"
          ></md-date-picker>
          <p style="${CAPTION}">1px primary outline ring</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-part-thick"
            variant="docked"
            style="max-inline-size:280px;"
            label="Thick outline"
          ></md-date-picker>
          <p style="${CAPTION}"><code>box-shadow: 0 0 0 3px #1565c0</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-part-filled"
            variant="docked"
            style="max-inline-size:280px;"
            label="Filled today"
          ></md-date-picker>
          <p style="${CAPTION}">Teal fill + white label, no ring</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-part-coral-ring"
            variant="docked"
            style="max-inline-size:280px;"
            label="Coral ring"
          ></md-date-picker>
          <p style="${CAPTION}">2px coral outline + matching label color</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="today-part-square"
            variant="docked"
            style="max-inline-size:280px;"
            label="Square ring"
          ></md-date-picker>
          <p style="${CAPTION}"><code>corner-none</code> + brand-purple ring</p>
        </div>
      </div>

      <p style="${HEADING}">
        Day shape — <code>::part(day-selected)</code> /
        <code>::part(day-today)</code>
      </p>
      <p style="${CAPTION}; margin-block-end:12px;">
        ${OPEN_HINT} Styles target calendar day cells via <code>::part()</code>,
        not the text field. Selected date is 15 June 2025 on each picker.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="docked"
            style="max-inline-size:280px;"
            label="Circular (default)"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            Default MD3 — filled circle on select, ring on today
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="day-shape-square"
            variant="docked"
            style="max-inline-size:280px;"
            label="Square corners"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-button-container-shape: corner-none</code> on selected +
            today
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="day-shape-pill"
            variant="docked"
            style="max-inline-size:280px;"
            label="Pill selected"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>--md-button-container-shape: corner-full</code> on selected
            day
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="day-shape-rounded"
            variant="docked"
            style="max-inline-size:280px;"
            label="Rounded 12px"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            12px radius on selected + today via <code>::part()</code>
          </p>
        </div>
      </div>

      <p style="${HEADING}">::part(field) — trigger field + icon color var</p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="parts-field"
            label="Custom field"
            value="2025-06-15"
            supporting-text="MM/DD/YYYY"
          ></md-date-picker>
          <p style="${CAPTION}">
            Outline + label via nested <code>md-text-field</code> vars on
            <code>::part(field)</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="parts-leading-icon"
            label="Leading icon part"
            value="2025-06-15"
          >
            <span slot="leading-icon" class="material-symbols-outlined"
              >event</span
            >
          </md-date-picker>
          <p style="${CAPTION}">
            <code>--md-date-picker-icon-color</code> — slotted leading icon +
            trailing toggle
          </p>
        </div>
      </div>

      <p style="${HEADING}">::part(header) / ::part(panel) — backgrounds</p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            class="parts-header"
            label="Header gradient"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>::part(header)</code>, <code>::part(headline)</code>,
            <code>::part(supporting)</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            class="parts-panel"
            label="Panel gradient"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            <code>::part(panel)</code> — dialog / docked popup surface
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        ::part(calendar-button) / ::part(prev-button) / ::part(next-button)
      </p>
      <div style="${ROW}">
        <md-date-picker
          class="parts-nav"
          label="Nav parts"
          value="2025-06-15"
        ></md-date-picker>
      </div>

      <p style="${HEADING}">
        ::part(prev-month-button) / ::part(menu-caret) — docked nav
      </p>
      <div style="${ROW}">
        <md-date-picker
          class="parts-docked-nav"
          variant="docked"
          style="max-inline-size:280px;"
          label="Docked nav"
          value="2025-08-17"
        ></md-date-picker>
      </div>

      <p style="${HEADING}">
        ::part(weekday) / ::part(day-selected) / ::part(day-today) — combined
        accent
      </p>
      <p style="${CAPTION}; margin-block-end:12px;">${OPEN_HINT}</p>
      <div style="${ROW}">
        <md-date-picker
          class="parts-days"
          variant="docked"
          style="max-inline-size:280px;"
          label="Day cell colors"
          value="2025-06-15"
        ></md-date-picker>
      </div>

      <p style="${HEADING}">::part(cancel-button) / ::part(ok-button)</p>
      <div style="${ROW}">
        <md-date-picker
          class="parts-actions"
          label="Actions"
          value="2025-06-15"
        ></md-date-picker>
      </div>

      <p style="${HEADING}">
        ::part(mode-toggle) — calendar / text-input switch
      </p>
      <div style="${ROW}">
        <md-date-picker
          class="parts-toggle"
          label="Mode toggle"
          value="2025-06-15"
        ></md-date-picker>
      </div>

      <p
        style="color: var(--md-sys-color-on-surface-variant, #49454F); font-size:12px; margin-top:16px;"
      >
        Day shapes use <code>--md-button-container-shape</code> on
        <code>::part(day-selected)</code> / <code>::part(day-today)</code>, or
        host vars <code>--md-date-picker-day-selected-shape</code> /
        <code>--md-date-picker-day-today-shape</code>. Colors can also use
        <code>--md-date-picker-day-selected-bg</code> (see Custom CSS story).
        Field styling uses <code>--md-date-picker-field-*</code> or
        <code>::part(field)</code> — separate from day cells. Key parts:
        <code>field</code>, <code>leading-icon</code>, <code>panel</code>,
        <code>header</code>, <code>day-selected</code>, <code>day-today</code>,
        <code>weekday</code>, <code>calendar-button</code>.
      </p>
    </div>
  `,
};

/* ==========================================================
   SLOTTED ICONS & NAMED SLOTS
   ========================================================== */
export const Slots: Story = {
  name: "Custom Icons (Named Slots)",
  parameters: {
    controls: { disable: true },
    docs: {
      source: {
        code: `<!-- Calendar trigger icon — prop shorthand -->
<md-date-picker label="Schedule" calendar-icon="schedule" value="2025-06-15"></md-date-picker>

<!-- Calendar trigger icon — custom SVG via slot (overrides prop) -->
<md-date-picker label="Event date" value="2025-06-15">
  <svg slot="calendar-icon" viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"/>
  </svg>
</md-date-picker>`,
      },
    },
  },
  render: () => html`
    <style>
      .slot-icon-star {
        --md-date-picker-icon-color: #f9a825;
      }
      .slot-icon-emoji {
        --md-date-picker-icon-color: #e65100;
      }
      .slot-icon-event {
        --md-date-picker-icon-color: #00897b;
      }
      .slot-icon-heart {
        --md-date-picker-icon-color: #e91e63;
      }
      .slot-icon-clock {
        --md-date-picker-icon-color: #5e35b1;
      }
      .slot-icon-fa {
        --md-date-picker-icon-color: #0277bd;
      }
      .slot-icon-cake {
        --md-date-picker-icon-color: #e65100;
      }
      .slot-icon-schedule {
        --md-date-picker-icon-color: #5e35b1;
      }
    </style>
    <div style="${SECTION}">
      <p style="${HEADING}">
        Calendar trigger icon — default <code>calendar_today</code>
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            label="Default trigger"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}">
            Built-in <code>calendar_today</code> trailing toggle
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        Calendar trigger icon — <code>calendar-icon</code> prop
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-event"
            label="Event"
            calendar-icon="event"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}"><code>calendar-icon="event"</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-clock"
            label="Today"
            calendar-icon="today"
            value="2025-06-15"
          ></md-date-picker>
          <p style="${CAPTION}"><code>calendar-icon="today"</code></p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-fa"
            label="Schedule"
            calendar-icon="schedule"
            value="2025-09-01"
          ></md-date-picker>
          <p style="${CAPTION}"><code>calendar-icon="schedule"</code></p>
        </div>
      </div>

      <p style="${HEADING}">
        Calendar trigger icon — <code>slot="calendar-icon"</code>
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-star"
            label="Star (SVG)"
            value="2025-06-15"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">Gold star SVG</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-emoji"
            label="Calendar (emoji)"
            value="2025-12-31"
          >
            <span
              slot="calendar-icon"
              style="font-size:24px; line-height:1"
              aria-hidden="true"
              >📅</span
            >
          </md-date-picker>
          <p style="${CAPTION}">Calendar emoji 📅</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-heart"
            label="Favorite (SVG)"
            value="2025-02-14"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">Heart SVG</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-clock"
            label="Schedule (clock)"
            value="2025-09-01"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">Clock SVG</p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-fa"
            label="FontAwesome-style"
            value="2025-07-04"
          >
            <i
              slot="calendar-icon"
              style="font-size:20px; font-style:normal; font-family:serif;"
              aria-hidden="true"
              >⏰</i
            >
          </md-date-picker>
          <p style="${CAPTION}">Icon-font / emoji — any inline element works</p>
        </div>
      </div>

      <p style="${HEADING}">Leading field icon vs calendar trigger icon</p>
      <p style="${CAPTION}; margin-block-end:12px;">
        Requires <code>variant="modal-input"</code> — the trailing toggle is
        only on the outlined field.
      </p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-cake"
            label="Leading only"
            value="2025-06-15"
          >
            <span slot="leading-icon" class="material-symbols-outlined"
              >cake</span
            >
          </md-date-picker>
          <p style="${CAPTION}">
            Leading <code>cake</code> + default trailing
            <code>calendar_today</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-schedule"
            label="Trigger only"
            value="2025-06-15"
          >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">
            No leading icon · custom event/schedule SVG via
            <code>slot="calendar-icon"</code>
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            class="slot-icon-event"
            label="Both icons"
            value="2025-06-15"
          >
            <span slot="leading-icon" class="material-symbols-outlined"
              >cake</span
            >
            <svg
              slot="calendar-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"
              />
            </svg>
          </md-date-picker>
          <p style="${CAPTION}">
            Leading <code>cake</code> + custom clock SVG trigger
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        <code>slot="header"</code> — replace modal header
      </p>
      <p style="${CAPTION}; margin-block-end:12px;">${SLOT_OPEN_HINT}</p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            label="Custom header"
            value="2025-06-15"
          >
            <div
              slot="header"
              style="padding:24px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; font:500 24px/32px Roboto,sans-serif;"
            >
              Pick your date ✨
            </div>
          </md-date-picker>
          <p style="${CAPTION}">
            Closed field — click calendar icon to preview
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            label="Custom header preview"
            value="2025-06-15"
          >
            <div
              slot="header"
              style="padding:24px; background:linear-gradient(135deg,#667eea,#764ba2); color:white; font:500 24px/32px Roboto,sans-serif;"
            >
              Pick your date ✨
            </div>
          </md-date-picker>
          <p style="${CAPTION}">
            Same slotted header — click the calendar icon to preview (see
            ModalInputOpen story for a pre-opened panel)
          </p>
        </div>
      </div>

      <p style="${HEADING}">
        <code>slot="actions"</code> — replace Cancel / OK row
      </p>
      <p style="${CAPTION}; margin-block-end:12px;">${SLOT_OPEN_HINT}</p>
      <div style="${ROW}">
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            label="Custom actions"
            value="2025-06-15"
          >
            <div
              slot="actions"
              style="display:flex; gap:8px; justify-content:flex-end; padding:8px 12px 12px;"
            >
              <md-button variant="text">Skip</md-button>
              <md-button variant="filled" icon="check">Confirm</md-button>
            </div>
          </md-date-picker>
          <p style="${CAPTION}">
            Closed field — click calendar icon to preview
          </p>
        </div>
        <div style="${DEMO_COL}">
          <md-date-picker
            variant="modal-input"
            label="Custom actions preview"
            value="2025-06-15"
          >
            <div
              slot="actions"
              style="display:flex; gap:8px; justify-content:flex-end; padding:8px 12px 12px;"
            >
              <md-button variant="text">Skip</md-button>
              <md-button variant="filled" icon="check">Confirm</md-button>
            </div>
          </md-date-picker>
          <p style="${CAPTION}">
            Same slotted actions — click the calendar icon to preview (see
            ModalInputOpen story for a pre-opened panel)
          </p>
        </div>
      </div>

      <p
        style="color: var(--md-sys-color-on-surface-variant, #49454F); font-size:12px; margin-top:16px;"
      >
        Slots: <code>leading-icon</code> (field leading),
        <code>calendar-icon</code> (trailing calendar toggle — overrides
        <code>calendar-icon</code> prop), <code>header</code>,
        <code>actions</code>. Style the toggle via
        <code>::part(calendar-button)</code> or
        <code>--md-date-picker-icon-color</code>. See
        <strong>Custom CSS Properties</strong>.
      </p>
    </div>
  `,
};

/* ─── 15. Uncontrolled ──────────────────────────────── */
export const Uncontrolled: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "**Uncontrolled mode** — set initial `value` (optional) and let the picker manage `value` and `open` internally. " +
          "Listen to `mdChange`, `mdInput`, `mdOpen`, `mdClose`, and `mdCancel` to react; no parent state is required.",
      },
    },
  },
  render: () => {
    const refreshState = () => {
      const picker = document.getElementById(
        "uncontrolled-date-picker",
      ) as DatePickerEl | null;
      if (picker)
        syncLiveState(picker, "uncontrolled-value", "uncontrolled-open");
    };

    const onAnyEvent = () => refreshState();

    setTimeout(() => {
      const picker = document.getElementById(
        "uncontrolled-date-picker",
      ) as DatePickerEl | null;
      if (!picker) return;
      bindDatePickerEvents(picker, "uncontrolled-event-log");
      ["mdChange", "mdInput", "mdOpen", "mdClose", "mdCancel"].forEach(
        (name) => {
          picker.addEventListener(name, onAnyEvent);
        },
      );
      refreshState();
    }, 0);

    return html`
      <div
        style="display: flex; flex-direction: column; gap: 20px; padding: 24px; max-width: 520px;"
      >
        <div>
          <h3
            style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 12px;"
          >
            Uncontrolled — picker owns <code>value</code> and <code>open</code>
          </h3>
          <md-date-picker
            id="uncontrolled-date-picker"
            variant="modal-input"
            label="Event date"
            headline="Select date"
          ></md-date-picker>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="${stateBadgeStyle}"
            >value: <strong id="uncontrolled-value">(empty)</strong></span
          >
          <span style="${stateBadgeStyle}"
            >open: <strong id="uncontrolled-open">false</strong></span
          >
        </div>

        <div>
          <h4
            style="font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;"
          >
            Event log
          </h4>
          <div id="uncontrolled-event-log" style="${eventLogStyle}">
            <div style="opacity: 0.87;">
              Open the calendar, pick a date, cancel, or type in the dialog…
            </div>
          </div>
        </div>

        <div style="${hintStyle}">
          <strong>Uncontrolled:</strong> Mount with optional initial attributes,
          then interact. The component updates its own <code>value</code> and
          <code>open</code> props. Events are informational — use them to sync
          forms, analytics, or side effects.
        </div>
      </div>
    `;
  },
};

/* ─── 16. Controlled ────────────────────────────────── */
export const Controlled: Story = {
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story:
          "**Controlled mode** — your application holds `value` and `open` as the source of truth. " +
          "Listen to `mdChange` for commits, `mdOpen` / `mdClose` / `mdCancel` for panel state, " +
          "then push the updated props back onto the element (or re-render in your framework).",
      },
    },
  },
  render: () => {
    let value = "2025-06-15";
    let open = false;

    const getPicker = () =>
      document.getElementById("controlled-date-picker") as DatePickerEl | null;

    const renderParentState = () => {
      const valueEl = document.getElementById("controlled-parent-value");
      const openEl = document.getElementById("controlled-parent-open");
      if (valueEl) valueEl.textContent = value || "(empty)";
      if (openEl) openEl.textContent = String(open);
    };

    const applyToPicker = () => {
      const picker = getPicker();
      if (!picker) return;
      picker.value = value;
      picker.open = open;
      syncLiveState(
        picker,
        "controlled-picker-value",
        "controlled-picker-open",
      );
      renderParentState();
    };

    const handleChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      appendEventLog("controlled-event-log", "mdChange", detail);
      value = detail.value ?? "";
      applyToPicker();
    };

    const handleInput = (e: Event) => {
      appendEventLog(
        "controlled-event-log",
        "mdInput",
        (e as CustomEvent).detail,
      );
    };

    const handleOpen = () => {
      appendEventLog("controlled-event-log", "mdOpen");
      open = true;
      applyToPicker();
    };

    const handleClose = () => {
      appendEventLog("controlled-event-log", "mdClose");
      open = false;
      applyToPicker();
    };

    const handleCancel = () => {
      appendEventLog("controlled-event-log", "mdCancel");
      open = false;
      applyToPicker();
    };

    setTimeout(applyToPicker, 0);

    return html`
      <div
        style="display: flex; flex-direction: column; gap: 20px; padding: 24px; max-width: 560px;"
      >
        <div>
          <h3
            style="font: 500 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface, #1C1B1F); margin: 0 0 12px;"
          >
            Controlled — parent owns <code>value</code> and <code>open</code>
          </h3>
          <md-date-picker
            id="controlled-date-picker"
            variant="modal-input"
            label="Appointment"
            headline="Select date"
            value=${value}
            ?open=${open}
            @mdChange=${handleChange}
            @mdInput=${handleInput}
            @mdOpen=${handleOpen}
            @mdClose=${handleClose}
            @mdCancel=${handleCancel}
          ></md-date-picker>
        </div>

        <div>
          <h4
            style="font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;"
          >
            Parent state (source of truth)
          </h4>
          <div
            style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px;"
          >
            <span style="${stateBadgeStyle}"
              >value:
              <strong id="controlled-parent-value">${value}</strong></span
            >
            <span style="${stateBadgeStyle}"
              >open:
              <strong id="controlled-parent-open">${String(open)}</strong></span
            >
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button
              style="${btnStyle}"
              @click=${() => {
                value = "2025-12-25";
                applyToPicker();
              }}
            >
              Set value → 2025-12-25
            </button>
            <button
              style="${btnStyle}"
              @click=${() => {
                value = "";
                applyToPicker();
              }}
            >
              Clear value
            </button>
            <button
              style="${btnStyle}"
              @click=${() => {
                open = true;
                applyToPicker();
              }}
            >
              Open externally
            </button>
          </div>
        </div>

        <div>
          <h4
            style="font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;"
          >
            Picker props (mirrors parent)
          </h4>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <span style="${stateBadgeStyle}"
              >value:
              <strong id="controlled-picker-value">${value}</strong></span
            >
            <span style="${stateBadgeStyle}"
              >open:
              <strong id="controlled-picker-open">${String(open)}</strong></span
            >
          </div>
        </div>

        <div>
          <h4
            style="font: 500 12px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.5px;"
          >
            Event log
          </h4>
          <div id="controlled-event-log" style="${eventLogStyle}">
            <div style="opacity: 0.87;">
              Interact with the picker or use the external buttons…
            </div>
          </div>
        </div>

        <div style="${hintStyle}">
          <strong>Controlled:</strong> Update your store on
          <code>mdChange</code> (value) and <code>mdOpen</code> /
          <code>mdClose</code> / <code>mdCancel</code> (open), then write
          <code>picker.value</code> and <code>picker.open</code> back. Use
          external buttons to set or clear the value, or open the modal
          programmatically; close via Cancel, OK, or Escape.
        </div>
      </div>
    `;
  },
  /** Prove the parent-owned `value` prop drives the field text and calendar selection. */
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);
    const buttons = [
      ...canvasElement.querySelectorAll("button"),
    ] as HTMLButtonElement[];
    const setValueBtn = buttons.find((b) =>
      b.textContent?.includes("2025-12-25"),
    );
    const openBtn = buttons.find((b) =>
      b.textContent?.includes("Open externally"),
    );

    let initialText = "";
    await step("Initial controlled value renders in the field", async () => {
      await waitFor(() => expect(dpFieldInput(picker)?.value).toBeTruthy());
      initialText = dpFieldInput(picker)!.value;
      expect(initialText).toContain("15"); // 2025-06-15 → e.g. 6/15/2025
      expect(picker.value).toBe("2025-06-15");
    });

    await step(
      "Parent pushes a new value → field text and prop follow",
      async () => {
        expect(setValueBtn).toBeTruthy();
        setValueBtn!.click();
        await waitFor(() =>
          expect(dpFieldInput(picker)!.value).not.toBe(initialText),
        ); // changed
        expect(dpFieldInput(picker)!.value).toContain("12"); // December, 12/25/2025
        await waitFor(() => expect(picker.value).toBe("2025-12-25"));
      },
    );

    await step(
      "Opening reflects the pushed value; Escape dismisses",
      async () => {
        let cancelled = false;
        picker.addEventListener(
          "mdCancel",
          () => {
            cancelled = true;
          },
          { once: true },
        );
        expect(openBtn).toBeTruthy();
        openBtn!.click();
        await waitFor(() => expect(picker.open).toBe(true));
        // The controlled value drives the staged calendar selection.
        await waitFor(() =>
          expect(
            dpDayCell(picker, "2025-12-25")?.getAttribute("aria-selected"),
          ).toBe("true"),
        );
        // GUARD: Escape dismisses (mdCancel) and closes the modal.
        dpKey(dpPanel(picker)!, "Escape");
        await waitFor(() => expect(cancelled).toBe(true));
        await waitFor(() => expect(picker.open).toBe(false));
        // Let the panel bloom-out (~200ms) finish before teardown.
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

/* ─── 17. Accessibility ─────────────────────────────── */
export const Accessibility: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div style="padding: 24px; max-width: 480px;">
      <p style="font: 14px/1.5 system-ui;">
        The trigger advertises <code>aria-haspopup="dialog"</code>. The dialog
        uses <code>role="dialog"</code> + <code>aria-modal="true"</code>, traps
        Tab focus, and restores focus to the trigger on close. The grid uses
        <code>role="grid"</code>/<code>gridcell</code> with roving
        <code>tabindex</code>.
      </p>
      <ul style="font: 14px/1.6 system-ui;">
        <li>Arrow keys move day-by-day / week-by-week</li>
        <li>Home / End jump to start / end of week</li>
        <li>PageUp / PageDown change month (Shift = year)</li>
        <li>Enter / Space select; Escape dismisses</li>
      </ul>
      <md-date-picker
        label="Try keyboard nav"
        value="2025-06-15"
      ></md-date-picker>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: "Responsiveness",
  parameters: {
    docs: {
      description: {
        story:
          "The date-picker trigger is a full-width text field by default — " +
          "it stretches to fill its parent column. In narrow forms (320px) the " +
          "label and value stay on one row; the calendar popover opens as a " +
          "modal dialog that covers the viewport on phones. Place the picker " +
          "inside a <code>max-inline-size</code> container for comfortable " +
          "reading width on desktop.",
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .dp-resp-shell {
        display: flex;
        flex-direction: column;
        gap: 32px;
        max-width: 1100px;
      }
      .dp-resp-vp__label {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        color: var(--md-sys-color-on-surface-variant, #49454f);
        margin-block-end: 6px;
      }
      .dp-resp-vp {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        box-sizing: border-box;
        margin-block-end: 12px;
      }
      .dp-resp-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .dp-resp-live {
        resize: horizontal;
        overflow: auto;
        min-inline-size: 240px;
        max-inline-size: 100%;
        inline-size: 480px;
      }
    </style>

    <div class="dp-resp-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Form column at four breakpoints</h3>
        <p
          style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);"
        >
          Date picker in a booking form — trigger fills the column; open the
          calendar to preview the modal.
        </p>
        ${[
          { label: "XS · 320 px (phone)", width: "320px" },
          { label: "SM · 480 px (large phone)", width: "480px" },
          { label: "MD · 768 px (tablet)", width: "768px" },
          { label: "LG · 1024 px (desktop)", width: "1024px" },
        ].map(
          (vp) => html`
            <div>
              <div class="dp-resp-vp__label">${vp.label}</div>
              <div
                class="dp-resp-vp"
                style="inline-size: ${vp.width}; max-inline-size: 100%;"
              >
                <div class="dp-resp-form">
                  <md-date-picker
                    label=${t(globals.locale, "date-picker.check-in")}
                    value="2025-06-15"
                  ></md-date-picker>
                  <md-date-picker
                    label=${t(globals.locale, "date-picker.check-out")}
                    value="2025-06-22"
                  ></md-date-picker>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">
          Side-by-side fields that stack on phones
        </h3>
        <p
          style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);"
        >
          Two pickers in a flex row reflow to a column below 480px.
        </p>
        ${[
          { label: "XS · 320 px (stacked)", width: "320px" },
          { label: "MD · 768 px (row)", width: "768px" },
        ].map(
          (vp) => html`
            <div>
              <div class="dp-resp-vp__label">${vp.label}</div>
              <div
                class="dp-resp-vp"
                style="inline-size: ${vp.width}; max-inline-size: 100%; container-type: inline-size;"
              >
                <div style="display: flex; flex-wrap: wrap; gap: 12px;">
                  <md-date-picker
                    label=${t(globals.locale, "date-picker.start-date")}
                    value="2025-01-01"
                    style="flex: 1 1 200px; min-inline-size: 0;"
                  ></md-date-picker>
                  <md-date-picker
                    label=${t(globals.locale, "date-picker.end-date")}
                    value="2025-12-31"
                    style="flex: 1 1 200px; min-inline-size: 0;"
                  ></md-date-picker>
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Live resize playground</h3>
        <p
          style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant, #49454F);"
        >
          Drag the bottom-right corner to see the trigger adapt.
        </p>
        <div class="dp-resp-vp dp-resp-live">
          <md-date-picker
            label=${t(globals.locale, "date-picker.event-date")}
            value="2025-06-15"
          ></md-date-picker>
        </div>
      </section>
    </div>
  `,
};

/* ─── 18. Imperative methods ────────────────────────── */
/** Exercises the public API: `clear()`, `show()`, `close()`, and `focusInput()`. */
export const ImperativeMethods: Story = {
  parameters: { controls: { disable: true } },
  render: () => html`
    <div style="padding: 24px;">
      <md-date-picker
        id="imperative-dp"
        variant="modal-input"
        label="Date"
        value="2025-06-15"
      ></md-date-picker>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);
    const api = picker as unknown as {
      show(): Promise<void>;
      close(): Promise<void>;
      clear(): Promise<void>;
      focusInput(): Promise<void>;
    };

    await step(
      "clear() empties the committed value and emits mdChange",
      async () => {
        await waitFor(() => expect(dpFieldInput(picker)?.value).toBeTruthy());
        expect(dpFieldInput(picker)!.value).toContain("15"); // seeded 06/15/2025
        let changeVal: string | undefined;
        let changeSeen = false;
        picker.addEventListener(
          "mdChange",
          (e) => {
            changeVal = (e as CustomEvent).detail.value;
            changeSeen = true;
          },
          { once: true },
        );
        await api.clear();
        await waitFor(() => expect(picker.value).toBe(""));
        expect(changeSeen).toBe(true);
        expect(changeVal).toBe("");
        // Field text follows the cleared value while unfocused.
        await waitFor(() => expect(dpFieldInput(picker)?.value ?? "").toBe(""));
      },
    );

    await step("show() opens the picker and emits mdOpen", async () => {
      let opened = false;
      picker.addEventListener(
        "mdOpen",
        () => {
          opened = true;
        },
        { once: true },
      );
      await api.show();
      await waitFor(() => expect(picker.open).toBe(true));
      expect(opened).toBe(true);
      await waitFor(() => expect(dpPanel(picker)).toBeTruthy());
    });

    await step(
      "close() dismisses the open picker and emits mdClose",
      async () => {
        let closed = false;
        picker.addEventListener(
          "mdClose",
          () => {
            closed = true;
          },
          { once: true },
        );
        await api.close();
        await waitFor(() => expect(picker.open).toBe(false));
        await waitFor(() => expect(closed).toBe(true));
        // Let the close-focus restore (rAF) settle before the next step.
        await new Promise((r) => setTimeout(r, 300));
      },
    );

    await step(
      "focusInput() moves focus into the trigger text field",
      async () => {
        await api.focusInput();
        const tf = picker.shadowRoot!.querySelector("md-text-field") as
          | (HTMLElement & { shadowRoot: ShadowRoot })
          | null;
        expect(tf).toBeTruthy();
        await waitFor(() =>
          expect(tf!.shadowRoot.activeElement).toBe(dpFieldInput(picker)),
        );
      },
    );
  },
};

/* ─── 19. Modal year grid ───────────────────────────── */
/** Opens the modal year grid via the month/year toggle and navigates by picking a year. */
export const ModalYearGrid: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { viewMode }) => html`
    <div style="padding: 24px;">
      <md-date-picker
        variant="modal-input"
        label="Date"
        value="2025-06-15"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);
    await waitFor(() =>
      expect(
        dpDayCell(picker, "2025-06-15")?.getAttribute("aria-selected"),
      ).toBe("true"),
    );

    await step(
      "Month/year toggle opens the year grid (mdMenuOpen: year)",
      async () => {
        let menuOpenType: string | undefined;
        picker.addEventListener(
          "mdMenuOpen",
          (e) => {
            menuOpenType = (e as CustomEvent).detail.type;
          },
          { once: true },
        );
        const monthToggle = picker.shadowRoot!.querySelector(
          '[part~="month-toggle"]',
        ) as HTMLElement | null;
        expect(monthToggle).toBeTruthy();
        monthToggle!.click();
        await waitFor(
          () =>
            expect(
              picker.shadowRoot!.querySelector("[data-year]"),
            ).toBeTruthy(),
          { timeout: 4000 },
        );
        expect(menuOpenType).toBe("year");
      },
    );

    await step(
      "Picking a year navigates the calendar without committing the value",
      async () => {
        let selectDetail: { type: string; value: number } | undefined;
        let viewSource: string | undefined;
        picker.addEventListener(
          "mdMenuSelect",
          (e) => {
            selectDetail = (e as CustomEvent).detail;
          },
          { once: true },
        );
        picker.addEventListener(
          "mdViewChange",
          (e) => {
            viewSource = (e as CustomEvent).detail.source;
          },
          { once: true },
        );
        const yearCell = picker.shadowRoot!.querySelector(
          '[data-year="2027"]',
        ) as HTMLElement | null;
        expect(yearCell).toBeTruthy();
        // Year-grid cells are md-buttons that hydrate a beat after the grid paints;
        // a pre-hydration click is a silent no-op, so gate on `.hydrated` first.
        await waitFor(() =>
          expect(yearCell!.classList.contains("hydrated")).toBe(true),
        );
        yearCell!.click();
        await waitFor(() => expect(selectDetail?.type).toBe("year"), {
          timeout: 4000,
        });
        expect(selectDetail?.value).toBe(2027);
        await waitFor(() => expect(viewSource).toBe("year-menu"), {
          timeout: 4000,
        });
        // Calendar returns to day view on the newly-selected year, same month.
        await waitFor(
          () => expect(dpDayCell(picker, "2027-06-15")).toBeTruthy(),
          { timeout: 4000 },
        );
        // GUARD: navigating the year grid does not commit a new value.
        expect(picker.value).toBe("2025-06-15");
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};

/* ─── 20. Docked navigation (chevrons + menus) ──────── */
/** Docked chevrons emit mdViewChange; month/year menu buttons open selection menus dismissed by Escape. */
export const DockedNavigation: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { viewMode }) => html`
    <div style="padding: 24px; block-size: 620px;">
      <md-date-picker
        style="max-inline-size: 280px;"
        variant="docked"
        label="Date"
        value="2025-08-17"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);
    await waitFor(() =>
      expect(
        dpDayCell(picker, "2025-08-17")?.getAttribute("aria-selected"),
      ).toBe("true"),
    );

    await step(
      "Next-month chevron advances the view (mdViewChange: chevron-month)",
      async () => {
        let source: string | undefined;
        picker.addEventListener(
          "mdViewChange",
          (e) => {
            source = (e as CustomEvent).detail.source;
          },
          { once: true },
        );
        const nextMonth = picker.shadowRoot!.querySelector(
          '[part~="next-month-button"]',
        ) as HTMLElement | null;
        expect(nextMonth).toBeTruthy();
        nextMonth!.click();
        await waitFor(() => expect(source).toBe("chevron-month"), {
          timeout: 4000,
        });
        await waitFor(
          () => expect(dpDayCell(picker, "2025-09-15")).toBeTruthy(),
          { timeout: 4000 },
        );
      },
    );

    await step(
      "Next-year chevron advances the view (mdViewChange: chevron-year)",
      async () => {
        let source: string | undefined;
        picker.addEventListener(
          "mdViewChange",
          (e) => {
            source = (e as CustomEvent).detail.source;
          },
          { once: true },
        );
        const nextYear = picker.shadowRoot!.querySelector(
          '[part~="next-year-button"]',
        ) as HTMLElement | null;
        expect(nextYear).toBeTruthy();
        nextYear!.click();
        await waitFor(() => expect(source).toBe("chevron-year"), {
          timeout: 4000,
        });
        await waitFor(
          () => expect(dpDayCell(picker, "2026-09-15")).toBeTruthy(),
          { timeout: 4000 },
        );
      },
    );

    await step(
      "Month menu button opens a selection menu; Escape closes it back to the grid",
      async () => {
        let menuType: string | undefined;
        picker.addEventListener(
          "mdMenuOpen",
          (e) => {
            menuType = (e as CustomEvent).detail.type;
          },
          { once: true },
        );
        const monthBtn = picker.shadowRoot!.querySelector(
          '[part~="month-menu-button"]',
        ) as HTMLElement | null;
        expect(monthBtn).toBeTruthy();
        monthBtn!.click();
        await waitFor(
          () =>
            expect(
              picker.shadowRoot!.querySelector('[part~="month-menu"]'),
            ).toBeTruthy(),
          { timeout: 4000 },
        );
        expect(menuType).toBe("month");
        dpKey(dpPanel(picker)!, "Escape");
        // Menu blooms out and the day grid returns; picker stays open.
        await waitFor(
          () =>
            expect(
              picker.shadowRoot!.querySelector('[part~="month-menu"]'),
            ).toBeNull(),
          { timeout: 4000 },
        );
        expect(picker.open).toBe(true);
        await waitFor(
          () => expect(dpDayCell(picker, "2026-09-15")).toBeTruthy(),
          { timeout: 4000 },
        );
        await new Promise((r) => setTimeout(r, 400));
      },
    );

    await step(
      "Year menu button opens the year selection menu (mdMenuOpen: year)",
      async () => {
        let menuType: string | undefined;
        picker.addEventListener(
          "mdMenuOpen",
          (e) => {
            menuType = (e as CustomEvent).detail.type;
          },
          { once: true },
        );
        const yearBtn = picker.shadowRoot!.querySelector(
          '[part~="year-menu-button"]',
        ) as HTMLElement | null;
        expect(yearBtn).toBeTruthy();
        yearBtn!.click();
        await waitFor(
          () =>
            expect(
              picker.shadowRoot!.querySelector('[part~="year-menu"]'),
            ).toBeTruthy(),
          { timeout: 4000 },
        );
        expect(menuType).toBe("year");
        dpKey(dpPanel(picker)!, "Escape");
        await waitFor(
          () =>
            expect(
              picker.shadowRoot!.querySelector('[part~="year-menu"]'),
            ).toBeNull(),
          { timeout: 4000 },
        );
        await new Promise((r) => setTimeout(r, 400));
      },
    );
  },
};

/* ─── 21. Keyboard navigation ───────────────────────── */
/** Arrow/Space/PageDown/Enter drive the day grid: move focus, stage, change month, and commit. */
export const KeyboardNavigation: Story = {
  parameters: { controls: { disable: true } },
  render: (_args, { viewMode }) => html`
    <div style="padding: 24px;">
      <md-date-picker
        variant="modal-input"
        label="Date"
        value="2025-06-15"
        ?open=${viewMode !== "docs"}
      ></md-date-picker>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const picker = await getDatePicker(canvasElement);
    await waitFor(() =>
      expect(
        dpDayCell(picker, "2025-06-15")?.getAttribute("aria-selected"),
      ).toBe("true"),
    );

    await step(
      "ArrowDown + Space moves focus a week ahead and stages that day",
      async () => {
        let selectedValue: string | undefined;
        picker.addEventListener(
          "mdSelected",
          (e) => {
            selectedValue = (e as CustomEvent).detail.value;
          },
          { once: true },
        );
        // ArrowDown = +7 days (2025-06-15 → 2025-06-22). Let the roving-focus move
        // render and land on 2025-06-22 before Space stages the *focused* day —
        // firing both keys in the same tick double-processes the grid.
        dpKey(dpDayCell(picker, "2025-06-15")!, "ArrowDown");
        await waitFor(() =>
          expect(
            picker.shadowRoot!.activeElement?.getAttribute("data-date"),
          ).toBe("2025-06-22"),
        );
        dpKey(dpDayCell(picker, "2025-06-22")!, " ");
        await waitFor(() =>
          expect(
            dpDayCell(picker, "2025-06-22")?.getAttribute("aria-selected"),
          ).toBe("true"),
        );
        expect(selectedValue).toBe("2025-06-22");
        // GUARD: Space stages only — no commit, panel stays open.
        expect(picker.value).toBe("2025-06-15");
        expect(picker.open).toBe(true);
      },
    );

    await step("PageDown advances the visible month", async () => {
      dpKey(dpDayCell(picker, "2025-06-22")!, "PageDown");
      // Focus was on 2025-06-22 → +1 month → July grid now rendered.
      await waitFor(
        () => expect(dpDayCell(picker, "2025-07-22")).toBeTruthy(),
        { timeout: 4000 },
      );
    });

    await step(
      "Enter on a day commits the value and closes the panel",
      async () => {
        let changeValue: string | undefined;
        picker.addEventListener(
          "mdChange",
          (e) => {
            changeValue = (e as CustomEvent).detail.value;
          },
          { once: true },
        );
        dpKey(dpDayCell(picker, "2025-07-22")!, "Enter");
        await waitFor(() => expect(picker.value).toBe("2025-07-22"), {
          timeout: 4000,
        });
        expect(changeValue).toBe("2025-07-22");
        await waitFor(() => expect(picker.open).toBe(false), { timeout: 4000 });
        await new Promise((r) => setTimeout(r, 300));
      },
    );
  },
};
