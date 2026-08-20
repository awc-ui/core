import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html, nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type MsEl = HTMLElement & { value: string[]; open: boolean };
const getMs = async (canvasElement: HTMLElement): Promise<MsEl> => {
  const ms = canvasElement.querySelector('md-multi-select') as MsEl;
  await waitFor(() => expect(ms.classList.contains('hydrated')).toBe(true));
  return ms;
};
const fieldOf = (ms: MsEl) => ms.shadowRoot!.querySelector('md-text-field') as HTMLElement;
const chipsOf = (ms: MsEl) => ms.shadowRoot!.querySelectorAll('.md-multi-select__chips md-chip');
const optionByLabel = (ms: MsEl, label: string) =>
  [...ms.shadowRoot!.querySelectorAll('md-menu-item[presentation="option"]')].find(
    (i) => (i as HTMLElement & { headline?: string }).headline === label,
  ) as HTMLElement;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));
// Some stories render several instances; grab the Nth (getMs takes the first).
const getMsAt = async (canvasElement: HTMLElement, index: number): Promise<MsEl> => {
  const ms = canvasElement.querySelectorAll('md-multi-select')[index] as MsEl;
  await waitFor(() => expect(ms.classList.contains('hydrated')).toBe(true));
  return ms;
};
const optionsOf = (ms: MsEl) =>
  ms.shadowRoot!.querySelectorAll('md-menu-item[presentation="option"]');
const selectedOptionCount = (ms: MsEl) =>
  ms.shadowRoot!.querySelectorAll('md-menu-item[presentation="option"][aria-selected="true"]').length;
// The tri-state "Select all" toggle (role=checkbox: aria-checked true/mixed/false).
const selectAllItem = (ms: MsEl) =>
  ms.shadowRoot!.querySelector('[part="select-all-item"]') as HTMLElement;
// In-field chips for display-mode="chips-inline" (distinct from the below/beside
// `.md-multi-select__chips` region and from the hidden measurement row).
const inlineChipsOf = (ms: MsEl) =>
  ms.shadowRoot!.querySelectorAll('.md-multi-select__inline-chips md-chip');
const removeBtnOf = (chip: Element) =>
  chip.shadowRoot!.querySelector('[part="remove"]') as HTMLElement;

const topicOptions = [
  { value: 'design', label: 'Design',  icon: 'palette' },
  { value: 'eng',    label: 'Engineering', icon: 'code' },
  { value: 'prd',    label: 'Product', icon: 'rocket_launch' },
  { value: 'ops',    label: 'Operations', icon: 'settings' },
  { value: 'ppl',    label: 'People', icon: 'group' },
  { value: 'sec',    label: 'Security', icon: 'shield', disabled: true },
];

const brandOptions = Array.from({ length: 12 }, (_, i) => ({
  value: `b${i + 1}`,
  label: `Brand ${i + 1}`,
}));

const meta: Meta = {
  title: 'Selection/Multi Select',
  component: 'md-multi-select',
  tags: ['autodocs'],
  // 'padded' (not the default 'centered'): a centered story root is a shrink-to-fit
  // flex item, which has no definite width for the trigger's `inline-size: 100%` to
  // fill — so the field would size to its own content. 'padded' gives a full-width
  // block root, matching how a field sits in a real form.
  parameters: {
    layout: 'padded',
    docs: { source: { language: 'html' } },
    // Suppress `color-contrast` for THIS component only. The outlined field's
    // input is transparent by design and its outline (fieldset) overlaps it, so
    // axe can't determine the input's background — it reports a permanent
    // "background could not be determined … overlapped" INCOMPLETE (never a
    // violation). The real contrast is fine and every text colour here is a
    // theme token, so this is pure axe noise. Scoped to the meta: color-contrast
    // stays fully active for every other component.
    a11y: { options: { rules: { 'color-contrast': { enabled: false } } } },
  },
  // NB: the Stencil-hydration gate for addon-a11y (axe must not scan before
  // `.hydrated`) lives GLOBALLY in .storybook/preview.ts `afterEach`
  // — no per-story play() needed here.
  argTypes: {
    variant: { control: { type: 'select' }, options: ['filled', 'outlined'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    displayMode: { control: { type: 'select' }, options: ['chips', 'chips-inline', 'count', 'text'] },
    chipPosition: { control: { type: 'select' }, options: ['bottom', 'top', 'left', 'right'], description: 'Where the chips sit relative to the trigger (display-mode="chips").' },
    trigger: { control: { type: 'select' }, options: ['field', 'button'], description: 'Trigger style: the readonly field, or a compact button that shows chips beside it.' },
    filterable: { control: 'boolean', description: 'Show a search field in the menu header.' },
    loading: { control: 'boolean', description: 'Busy state: trigger spinner + menu progress bar while an async dataset loads.' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    clearable: { control: 'boolean' },
    showSelectAll: { control: 'boolean' },
    maxHeight: { control: { type: 'number' }, description: 'Cap the dropdown height (px); it scrolls with edge shadows above the cap.' },
    width: { control: { type: 'number' }, description: 'Fixed trigger width (px) via --md-multi-select-width. The trigger width is independent of the selection; leave empty to fill the container.' },
  },
  args: {
    variant: 'outlined',
    label: 'Topics',
    placeholder: 'Pick topics…',
    displayMode: 'chips',
    chipPosition: 'bottom',
    trigger: 'field',
    filterable: false,
    loading: false,
    disabled: false,
    error: false,
    clearable: false,
    showSelectAll: false,
    maxHeight: undefined,
    width: undefined,
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args) => html`
    <div style="max-inline-size: 520px;">
      <md-multi-select
        variant=${args.variant}
        label=${args.label}
        placeholder=${args.placeholder}
        display-mode=${args.displayMode}
        chip-position=${args.chipPosition}
        trigger=${args.trigger}
        ?filterable=${args.filterable}
        ?loading=${args.loading}
        ?disabled=${args.disabled}
        ?error=${args.error}
        ?clearable=${args.clearable}
        ?show-select-all=${args.showSelectAll}
        max-height=${args.maxHeight ?? nothing}
        style=${args.width ? `--md-multi-select-width: ${args.width}px` : nothing}
        .options=${topicOptions}
        .value=${['design']}
      ></md-multi-select>
    </div>
  `,
  /** The keep-open multi-select flow, scripted (see the Interactions panel):
   *  open → toggle on/off without the menu closing → chips track value → Escape. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);

    await step('Clicking the field opens the listbox and focuses an option', async () => {
      expect(ms.value).toEqual(['design']);
      expect(chipsOf(ms).length).toBe(1);
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
      await waitFor(() =>
        expect(ms.shadowRoot!.activeElement?.getAttribute('role')).toBe('option'),
      );
    });

    await step('Toggling two options grows value + chips; keep-open holds the menu', async () => {
      optionByLabel(ms, 'Engineering').click();
      await waitFor(() => expect(ms.value).toEqual(['design', 'eng']));
      optionByLabel(ms, 'Product').click();
      await waitFor(() => expect(ms.value).toEqual(['design', 'eng', 'prd']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(3));
      expect(ms.open).toBe(true);
    });

    await step('Toggling a selected option off shrinks value + chips', async () => {
      optionByLabel(ms, 'Engineering').click();
      await waitFor(() => expect(ms.value).toEqual(['design', 'prd']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(2));
      expect(ms.open).toBe(true);
    });

    await step('Escape closes the menu and returns focus to the field', async () => {
      key(ms.shadowRoot!.activeElement ?? fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await waitFor(() => expect(ms.shadowRoot!.activeElement).toBe(fieldOf(ms)));
      // Let the menu's close animation + timers settle before the play
      // returns — a teardown mid-animation registers as an unhandled error.
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Public methods drive open/close and move focus to the trigger', async () => {
      const api = ms as unknown as {
        show(): Promise<void>;
        close(): Promise<void>;
        focusTrigger(): Promise<void>;
      };
      // show() opens without a pointer event…
      await api.show();
      await waitFor(() => expect(ms.open).toBe(true));
      await new Promise((r) => setTimeout(r, 150));
      // …close() closes it again.
      await api.close();
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
      // focusTrigger() lands focus on the readonly field.
      await api.focusTrigger();
      await waitFor(() => expect(ms.shadowRoot!.activeElement).toBe(fieldOf(ms)));
    });

    await step('reset() empties the selection + emits mdChange; a second reset is a guarded no-op', async () => {
      const api = ms as unknown as { reset(): Promise<void> };
      expect(ms.value.length).toBeGreaterThan(0); // ['design','prd'] carried over from the steps above
      let changed: string[] | undefined;
      let emits = 0;
      const onChange = (e: Event) => {
        changed = (e as CustomEvent<string[]>).detail;
        emits += 1;
      };
      ms.addEventListener('mdChange', onChange);
      await api.reset();
      await waitFor(() => expect(ms.value).toEqual([]));
      expect(changed).toEqual([]); // the emitted payload is the empty set
      expect(emits).toBe(1);
      // Already empty → the early-return guard fires no further event.
      await api.reset();
      await new Promise((r) => setTimeout(r, 60));
      expect(emits).toBe(1);
      ms.removeEventListener('mdChange', onChange);
    });

    await step('A closed menu reopens via ArrowDown on the trigger (APG select-only listbox)', async () => {
      expect(ms.open).toBe(false);
      fieldOf(ms).focus();
      key(fieldOf(ms), 'ArrowDown');
      await waitFor(() => expect(ms.open).toBe(true));
      key(ms.shadowRoot!.activeElement ?? fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Enter / Space / ArrowUp on the closed trigger each open the listbox (APG)', async () => {
      // ArrowDown is covered above; the other three APG "open" keys go through the
      // same guarded branch — each must open a closed select and then Escape closes it.
      for (const k of ['Enter', ' ', 'ArrowUp']) {
        expect(ms.open).toBe(false);
        fieldOf(ms).focus();
        key(fieldOf(ms), k);
        await waitFor(() => expect(ms.open).toBe(true));
        key(ms.shadowRoot!.activeElement ?? fieldOf(ms), 'Escape');
        await waitFor(() => expect(ms.open).toBe(false));
        await new Promise((r) => setTimeout(r, 300));
      }
    });

    await step('Reset to the fresh-render resting state (one chip, closed, unfocused)', async () => {
      // The coverage steps above emptied the selection (reset()), left focus on the
      // trigger, and cycled the menu open/closed. Restore the initial render so the
      // VISUAL snapshot matches a fresh mount: value back to ['design'] (one chip),
      // menu closed, nothing focused.
      ms.value = ['design'];
      (ms.shadowRoot!.activeElement as HTMLElement | null)?.blur();
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(ms.value).toEqual(['design']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(1));
      await waitFor(() => expect(ms.open).toBe(false));
      // Let the restored chip render + blur settle before the screenshot.
      await new Promise((r) => setTimeout(r, 120));
    });
  },
};

export const StableWidth: Story = {
  name: 'Stable width (independent of selection)',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:20px; max-inline-size: 440px;">
      <p style="font:400 13px/18px Roboto,sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        The trigger width never tracks the selection — these three fill the same container
        width whether 0, 3, or 8 items are chosen. Give it a fixed, independent width with
        the <code>--md-multi-select-width</code> custom property (last field: 280px).
      </p>
      <md-multi-select label="None selected" display-mode="chips" .options=${brandOptions}></md-multi-select>
      <md-multi-select label="Some selected" display-mode="chips" .options=${brandOptions} .value=${['b1', 'b2', 'b3']}></md-multi-select>
      <md-multi-select label="Many selected" display-mode="chips" .options=${brandOptions} .value=${['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']}></md-multi-select>
      <md-multi-select
        label="Fixed 280px"
        display-mode="chips"
        style="--md-multi-select-width: 280px"
        .options=${brandOptions}
        .value=${['b1', 'b2', 'b3', 'b4', 'b5']}
      ></md-multi-select>
    </div>
  `,
};

export const Variants: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-multi-select variant="filled" label="Filled" .options=${topicOptions} .value=${['design']}></md-multi-select>
      <md-multi-select variant="outlined" label="Outlined" .options=${topicOptions} .value=${['eng']}></md-multi-select>
    </div>
  `,
};

/* ── Density ────────────────────────────────────────────── */
export const Density: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:16px; padding:24px; max-inline-size: 360px;">
      ${[0, -1, -2, -3].map(
        (d) => html`
          <md-multi-select label="Density ${d}" .density=${d} .options=${topicOptions} .value=${['design', 'eng']}></md-multi-select>
        `,
      )}
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        <code>density</code> (0 = comfortable … -3 = compact) is forwarded to the trigger field,
        matching <code>md-select</code>. Note <code>chip-position="left"/"right"</code> pins the
        field to -3 regardless.
      </p>
    </div>
  `,
};

export const DisplayModes: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-multi-select label="Chips (below)" display-mode="chips" .options=${topicOptions} .value=${['design','eng']}></md-multi-select>
      <md-multi-select label="Chips (inline)" display-mode="chips-inline" .options=${topicOptions} .value=${['design','eng','prd']}></md-multi-select>
      <md-multi-select label="Count" display-mode="count" .options=${brandOptions} .value=${['b1','b2','b3','b4','b5']}></md-multi-select>
      <md-multi-select label="Text"  display-mode="text"  .options=${brandOptions} .value=${['b1','b2','b3']}></md-multi-select>
    </div>
  `,
  /** The chips-below (field trigger) removal flow: each ✕ pops one value, and
   *  removing the LAST chip returns focus to the trigger field instead of dropping
   *  it to <body> — plus the now-empty control clears its form value. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement); // first instance: "Chips (below)", value ['design','eng']

    await step('Two selected values render as removable chips below the field', async () => {
      expect(ms.value).toEqual(['design', 'eng']);
      await waitFor(() => expect(chipsOf(ms).length).toBe(2));
    });

    await step("Removing a chip via ✕ shrinks value and emits mdRemove + mdChange", async () => {
      let removed: string | undefined;
      let changed: string[] | undefined;
      ms.addEventListener('mdRemove', (e) => { removed = (e as CustomEvent<string>).detail; }, { once: true });
      ms.addEventListener('mdChange', (e) => { changed = (e as CustomEvent<string[]>).detail; }, { once: true });
      removeBtnOf(chipsOf(ms)[0]).click(); // the 'Design' chip
      await waitFor(() => expect(ms.value).toEqual(['eng']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(1));
      expect(removed).toBe('design');
      expect(changed).toEqual(['eng']);
    });

    await step('Removing the LAST chip empties the selection and returns focus to the trigger field', async () => {
      removeBtnOf(chipsOf(ms)[0]).click(); // the remaining 'Engineering' chip
      await waitFor(() => expect(ms.value).toEqual([]));
      await waitFor(() => expect(chipsOf(ms).length).toBe(0));
      // remaining === 0 → the removed-chip focus handler routes focus to the trigger,
      // not to <body>. (waitFor lets the post-render requestAnimationFrame settle.)
      await waitFor(() => expect(ms.shadowRoot!.activeElement).toBe(fieldOf(ms)));
    });

    await step('Reset to the fresh-render resting state (two chips restored, unfocused)', async () => {
      // The removal steps above emptied this instance and left focus on its trigger
      // field. Restore the initial render for the VISUAL snapshot: value back to
      // ['design','eng'] (two chips below the field) with nothing focused.
      ms.value = ['design', 'eng'];
      (ms.shadowRoot!.activeElement as HTMLElement | null)?.blur();
      (document.activeElement as HTMLElement | null)?.blur();
      await waitFor(() => expect(ms.value).toEqual(['design', 'eng']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(2));
      // Let the restored chips render + blur settle before the screenshot.
      await new Promise((r) => setTimeout(r, 120));
    });
  },
};

export const ChipPositions: Story = {
  name: 'Chip position (top / bottom / left / right)',
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:32px;">
      <md-multi-select label="Bottom (default)" display-mode="chips" chip-position="bottom" .options=${topicOptions} .value=${['design', 'eng', 'prd']}></md-multi-select>
      <md-multi-select label="Top" display-mode="chips" chip-position="top" .options=${topicOptions} .value=${['design', 'eng', 'prd']}></md-multi-select>
      <md-multi-select label="Right" display-mode="chips" chip-position="right" .options=${topicOptions} .value=${['design', 'eng']}></md-multi-select>
      <md-multi-select label="Left" display-mode="chips" chip-position="left" .options=${topicOptions} .value=${['design', 'eng']}></md-multi-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        <code>chip-position</code> places the removable chips around the trigger. left/right
        pair best with <code>trigger="button"</code> (see the Button trigger story).
      </p>
    </div>
  `,
};

export const ButtonTrigger: Story = {
  name: 'Button trigger',
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:32px;">
      <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" trigger="button" chip-position="right" .options=${topicOptions} .value=${['design', 'eng']}></md-multi-select>
      <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" trigger="button" chip-position="left" .options=${topicOptions} .value=${['design', 'eng', 'prd']}></md-multi-select>
      <md-multi-select label="${t(globals.locale, 'multiselect.filters')}" trigger="button" trigger-icon="filter_list" chip-position="right" .options=${brandOptions} .value=${['b1', 'b2', 'b3', 'b4', 'b5']}></md-multi-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        <code>trigger="button"</code> is a compact opener (leading icon + label). The selection
        shows as chips beside it; they wrap to new rows. Set <code>trigger-icon</code> and
        <code>trigger-label</code> to customise the button.
      </p>
    </div>
  `,
  /** The compact button trigger: chips live BESIDE the button and track `value`
   *  — proven by opening from the button, adding one, then popping one via its ✕. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement); // first instance: value ['design','eng']
    const chipLabels = () =>
      [...chipsOf(ms)].map((c) => (c as HTMLElement & { label: string }).label);
    const button = () => ms.shadowRoot!.querySelector('.md-multi-select__button') as HTMLElement;

    await step('Trigger is a button; the selection shows as chips beside it', async () => {
      // Button trigger — the readonly md-text-field path is NOT rendered.
      expect(button()).toBeTruthy();
      expect(ms.shadowRoot!.querySelector('md-text-field')).toBeNull();
      expect(ms.value).toEqual(['design', 'eng']);
      await waitFor(() => expect(chipsOf(ms).length).toBe(2));
      expect(chipLabels()).toEqual(['Design', 'Engineering']);
    });

    await step('Opening from the button and picking an option grows chips + value', async () => {
      let detail: string[] | undefined;
      ms.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });
      button().click();
      await waitFor(() => expect(ms.open).toBe(true));
      optionByLabel(ms, 'Product').click();
      await waitFor(() => expect(ms.value).toEqual(['design', 'eng', 'prd']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(3));
      expect(chipLabels()).toContain('Product');
      expect(detail).toEqual(['design', 'eng', 'prd']); // the emitted payload, not just the DOM
    });

    await step("A chip's ✕ removes its value (and emits mdRemove + mdChange)", async () => {
      let removed: string | undefined;
      let changed: string[] | undefined;
      ms.addEventListener('mdRemove', (e) => { removed = (e as CustomEvent<string>).detail; }, { once: true });
      ms.addEventListener('mdChange', (e) => { changed = (e as CustomEvent<string[]>).detail; }, { once: true });
      removeBtnOf(chipsOf(ms)[0]).click(); // the 'Design' chip
      await waitFor(() => expect(ms.value).toEqual(['eng', 'prd']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(2));
      expect(removed).toBe('design');
      expect(changed).toEqual(['eng', 'prd']);
      key(button(), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const SlottedTrigger: Story = {
  name: 'Slotted trigger (bring your own)',
  parameters: {
    docs: {
      description: {
        story:
          '`trigger="button"` is a convenience, not a ceiling. Any element in ' +
          '`slot="trigger"` becomes the opener: the built-in field / button is not ' +
          'rendered at all, and the chips keep their `chip-position` relationship to ' +
          'whatever you supplied — so the opener sits outside the component\'s own ' +
          'chrome without losing the chip layout.<br><br>' +
          'The element is wired, not re-rendered: click opens, its `id` becomes the ' +
          "menu's anchor, `aria-haspopup=\"listbox\"` advertises the popup, and " +
          '`Escape` closes and returns focus to it. It does NOT inherit `disabled` ' +
          'styling — mirror that onto your own trigger.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:32px;">
      <md-multi-select
        label="${t(globals.locale, 'multiselect.topics')}"
        chip-position="right"
        chip-overflow="wrap"
        .options=${topicOptions}
        .value=${['design', 'eng']}
      >
        <md-button slot="trigger" variant="outlined" size="xs" icon="add">Add topics</md-button>
      </md-multi-select>

      <md-multi-select
        label="${t(globals.locale, 'multiselect.filters')}"
        chip-position="right"
        chip-overflow="wrap"
        .options=${brandOptions}
        .value=${['b1', 'b2']}
      >
        <md-icon-button
          slot="trigger"
          variant="tonal"
          icon="filter_list"
          aria-label="Filter"
        ></md-icon-button>
      </md-multi-select>

      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        Any element works — <code>md-button</code>, <code>md-icon-button</code>,
        <code>md-fab</code>, a plain <code>&lt;button&gt;</code>.
      </p>
    </div>
  `,
  /** The consumer's element IS the trigger: it opens the menu, anchors it, and
   *  the built-in field/button never renders. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);
    const trigger = () => ms.querySelector('[slot="trigger"]') as HTMLElement;

    await step('The built-in trigger is not rendered', async () => {
      expect(ms.shadowRoot!.querySelector('md-text-field')).toBeNull();
      expect(ms.shadowRoot!.querySelector('.md-multi-select__button')).toBeNull();
      expect(trigger()).toBeTruthy();
    });

    await step('It is wired as the anchor and advertises the popup', async () => {
      await waitFor(() => expect(trigger().id).toBeTruthy());
      // Stencil hands `anchor` to md-menu as a PROPERTY (it is a known lazy
      // component), so read it there — the attribute is not reflected.
      const menu = ms.shadowRoot!.querySelector('md-menu') as HTMLElement & { anchor?: string };
      expect(menu.anchor ?? menu.getAttribute('anchor')).toBe(trigger().id);
      expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    });

    await step('Clicking it opens; the chips still sit beside it', async () => {
      await waitFor(() => expect(chipsOf(ms).length).toBe(2));
      trigger().click();
      await waitFor(() => expect(ms.open).toBe(true));
      optionByLabel(ms, 'Product').click();
      await waitFor(() => expect(ms.value).toEqual(['design', 'eng', 'prd']));
      await waitFor(() => expect(chipsOf(ms).length).toBe(3));
    });

    await step('Escape closes and returns focus to the consumer element', async () => {
      key(trigger(), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await waitFor(() => expect(document.activeElement).toBe(trigger()));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const MaxHeight: Story = {
  name: 'Max height (scroll + shadow)',
  // Open in the canvas; closed in autodocs (the fixed popup floats in the
  // stacked Docs layout). See the Themed story for the rationale.
  render: (_args, { globals, viewMode }) => html`
    <div style="max-inline-size: 340px;">
      <md-multi-select
        label="${t(globals.locale, 'multiselect.brands')}"
        max-height="240"
        clearable
        show-select-all
        display-mode="count"
        .options=${brandOptions}
        .value=${['b1','b2','b3','b4','b5','b6']}
        ?open=${viewMode !== 'docs'}
      ></md-multi-select>
    </div>
  `,
};

export const Clearable: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-multi-select label="Count" clearable display-mode="count" .options=${brandOptions} .value=${['b1','b2','b3']}></md-multi-select>
      <md-multi-select label="Text (ellipsis when cut)" clearable display-mode="text" .options=${brandOptions} .value=${['b1','b2','b3','b4','b5','b6','b7','b8']}></md-multi-select>
      <md-multi-select label="Chips inline" clearable display-mode="chips-inline" .options=${topicOptions} .value=${['design','eng']}></md-multi-select>
    </div>
  `,
  /** Clear empties the whole selection in one action. Drives the chips-inline
   *  instance so the reset is visible as chips → 0 (and the ✕ affordance leaving). */
  play: async ({ canvasElement, step }) => {
    const ms = await getMsAt(canvasElement, 2); // the display-mode="chips-inline" instance
    const clearBtn = () => ms.shadowRoot!.querySelector('[part="clear"]') as HTMLElement | null;

    await step('Two selected values render as in-field chips with a clear (×) button', async () => {
      expect(ms.value).toEqual(['design', 'eng']);
      await waitFor(() => expect(inlineChipsOf(ms).length).toBe(2));
      expect(clearBtn()).toBeTruthy(); // the ✕ appears only because there's a selection
    });

    await step('Clicking clear empties value, drops every chip, and fires mdClear + mdChange', async () => {
      let cleared = false;
      let changed: string[] | undefined;
      ms.addEventListener('mdClear', () => { cleared = true; }, { once: true });
      ms.addEventListener('mdChange', (e) => { changed = (e as CustomEvent<string[]>).detail; }, { once: true });
      clearBtn()!.click();
      await waitFor(() => expect(ms.value).toEqual([]));
      await waitFor(() => expect(inlineChipsOf(ms).length).toBe(0));
      // With nothing selected the clear affordance is gone — the guard that it
      // only shows for a non-empty selection.
      await waitFor(() => expect(clearBtn()).toBeNull());
      expect(cleared).toBe(true);
      expect(changed).toEqual([]);
    });
  },
};

export const ChipsInline: Story = {
  name: 'Chips inline (inside the input)',
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 380px;">
      <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" display-mode="chips-inline" .options=${topicOptions} .value=${['design','eng']}></md-multi-select>
      <md-multi-select label="Many topics" display-mode="chips-inline" .options=${topicOptions} .value=${['design','eng','prd','ops','ppl']}></md-multi-select>
      <md-multi-select label="Empty" display-mode="chips-inline" placeholder="${t(globals.locale, 'multiselect.pickTopics')}" .options=${topicOptions}></md-multi-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        <code>chip-overflow="count"</code> (default): chips stay on one line and the
        field keeps its height — extras collapse into a <code>+N</code> counter.
      </p>
    </div>
  `,
};

/* ─── Chips inline — overflow modes ───────────────────────── */
export const ChipsInlineOverflow: Story = {
  name: 'Chips inline (overflow: count vs wrap)',
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 420px;">
      <div>
        <div style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">
          chip-overflow="count" (default) — fixed height, +N counter
        </div>
        <md-multi-select
          label="${t(globals.locale, 'multiselect.topics')}"
          display-mode="chips-inline"
          chip-overflow="count"
          .options=${topicOptions}
          .value=${['design', 'eng', 'prd', 'ops', 'ppl']}
        ></md-multi-select>
      </div>
      <div>
        <div style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">
          chip-overflow="wrap" — chips wrap onto new rows, the field grows
        </div>
        <md-multi-select
          label="${t(globals.locale, 'multiselect.topics')}"
          display-mode="chips-inline"
          chip-overflow="wrap"
          .options=${topicOptions}
          .value=${['design', 'eng', 'prd', 'ops', 'ppl']}
        ></md-multi-select>
      </div>
    </div>
  `,
};

export const SelectAll: Story = {
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-multi-select label="${t(globals.locale, 'multiselect.brands')}" show-select-all variant="outlined" .options=${brandOptions}></md-multi-select>
    </div>
  `,
  /** The tri-state "Select all": header toggle selects every option, toggles them
   *  all off, and lands on the mixed state when only some are selected. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);

    await step('Open — nothing selected, "Select all" reads unchecked', async () => {
      expect(ms.value).toEqual([]);
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
      await waitFor(() => expect(selectAllItem(ms).getAttribute('aria-checked')).toBe('false'));
    });

    let total = 0;
    await step('"Select all" selects every option (value = full set, header ticks)', async () => {
      total = optionsOf(ms).length; // the real option count, read from the DOM
      expect(total).toBeGreaterThan(1);
      let detail: string[] | undefined;
      ms.addEventListener('mdChange', (e) => { detail = (e as CustomEvent<string[]>).detail; }, { once: true });
      selectAllItem(ms).click();
      await waitFor(() => expect(ms.value.length).toBe(total));
      expect(detail?.length).toBe(total); // the emitted payload carried the whole set
      await waitFor(() => expect(selectedOptionCount(ms)).toBe(total)); // every row aria-selected
      await waitFor(() => expect(selectAllItem(ms).getAttribute('aria-checked')).toBe('true'));
    });

    await step('Toggling "Select all" again clears the whole selection', async () => {
      selectAllItem(ms).click();
      await waitFor(() => expect(ms.value).toEqual([]));
      await waitFor(() => expect(selectedOptionCount(ms)).toBe(0));
      await waitFor(() => expect(selectAllItem(ms).getAttribute('aria-checked')).toBe('false'));
    });

    await step('Selecting ONE option puts "Select all" in the mixed (tri-)state', async () => {
      optionByLabel(ms, 'Brand 1').click();
      await waitFor(() => expect(ms.value).toEqual(['b1']));
      // Neither all nor none → the header must report "mixed", not true/false.
      await waitFor(() => expect(selectAllItem(ms).getAttribute('aria-checked')).toBe('mixed'));
      key(fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const MaxSelected: Story = {
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-multi-select label="${t(globals.locale, 'multiselect.pickUpTo3')}" max-selected="3" variant="outlined" .options=${brandOptions}></md-multi-select>
    </div>
  `,
  /** The cap guard: after three picks a fourth is refused — value doesn't grow,
   *  the refused option shows no phantom check, and no mdChange is emitted. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);
    // Record every emitted selection so we can prove the blocked click fires none.
    const emits: string[][] = [];
    ms.addEventListener('mdChange', (e) => emits.push([...(e as CustomEvent<string[]>).detail]));

    await step('Open the menu (cap is 3, nothing selected yet)', async () => {
      expect(ms.value).toEqual([]);
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
    });

    await step('Selecting three options fills the cap (one mdChange each)', async () => {
      optionByLabel(ms, 'Brand 1').click();
      optionByLabel(ms, 'Brand 2').click();
      optionByLabel(ms, 'Brand 3').click();
      await waitFor(() => expect(ms.value).toEqual(['b1', 'b2', 'b3']));
      expect(emits.length).toBe(3);
    });

    await step('A fourth pick is BLOCKED — value holds, no phantom check, no event', async () => {
      const fourth = optionByLabel(ms, 'Brand 4');
      fourth.click();
      // The item self-checks on click, then the component reverts it — it must
      // settle back to unselected (no phantom tick left behind).
      await waitFor(() => expect(fourth.getAttribute('aria-selected')).toBe('false'));
      expect(ms.value).toEqual(['b1', 'b2', 'b3']); // still capped, unchanged
      expect(ms.value).not.toContain('b4');
      expect(emits.length).toBe(3); // the rejected click emitted nothing
      expect(ms.open).toBe(true); // keep-open holds the menu
      key(fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

export const RequiredValidation: Story = {
  name: 'Required (constraint validation)',
  render: (_args, { globals }) => html`
    <form style="max-inline-size: 360px;">
      <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" required variant="outlined" .options=${topicOptions}></md-multi-select>
    </form>
  `,
  /** A required control with no selection reports valueMissing (:invalid); making
   *  a selection satisfies the constraint and flips it to :valid. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);

    await step('An empty required multi-select is :invalid (valueMissing)', async () => {
      expect(ms.value).toEqual([]);
      await waitFor(() => expect(ms.matches(':invalid')).toBe(true));
    });

    await step('Selecting an option satisfies the constraint → :valid', async () => {
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
      optionByLabel(ms, 'Design').click();
      await waitFor(() => expect(ms.value).toEqual(['design']));
      await waitFor(() => expect(ms.matches(':invalid')).toBe(false));
      key(fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

const filterOptions = Array.from({ length: 2000 }, (_, i) => ({ value: `o${i}`, label: `Option ${i}` }));

export const Filterable: Story = {
  name: 'Filterable (search)',
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-multi-select
        label="${t(globals.locale, 'multiselect.option')}"
        filterable
        show-select-all
        max-height="320"
        display-mode="count"
        .options=${filterOptions}
      ></md-multi-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
        2,000 options with a search field in the menu header. Above the virtualization
        threshold the list is windowed automatically.
      </p>
    </div>
  `,
};

export const FilterableSmall: Story = {
  name: 'Filterable (small, client-side)',
  render: () => html`
    <div style="max-inline-size: 360px;">
      <md-multi-select label="Topics" filterable variant="outlined" .options=${topicOptions}></md-multi-select>
    </div>
  `,
  /** The NON-virtual (plain-DOM) filterable path: typing filters the options
   *  client-side, an unmatched query shows the no-results slot, and closing the
   *  menu clears the query so a reopen shows the full list again. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);
    const searchInput = () =>
      ms.shadowRoot!.querySelector('.md-multi-select__search') as HTMLInputElement | null;
    const typeSearch = (q: string) => {
      const si = searchInput()!;
      si.value = q;
      si.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    };

    await step('Opening a filterable list renders a search field over the full option set', async () => {
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
      await waitFor(() => expect(searchInput()).toBeTruthy());
      await waitFor(() => expect(optionsOf(ms).length).toBe(topicOptions.length));
    });

    await step('Typing narrows the client-side list to the matching option', async () => {
      typeSearch('eng');
      await waitFor(() => expect(optionsOf(ms).length).toBe(1));
      expect((optionsOf(ms)[0] as HTMLElement & { headline?: string }).headline).toBe('Engineering');
    });

    await step('A query with no match shows the no-results empty state', async () => {
      typeSearch('zzzz');
      await waitFor(() => expect(optionsOf(ms).length).toBe(0));
      await waitFor(() => expect(ms.shadowRoot!.querySelector('[part="empty"]')).toBeTruthy());
    });

    await step('Closing clears the filter — reopening shows the full list with an empty search', async () => {
      key(searchInput() ?? fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
      await waitFor(() => expect(optionsOf(ms).length).toBe(topicOptions.length));
      expect(searchInput()?.value).toBe(''); // handleMenuClose reset the uncontrolled input
      key(searchInput() ?? fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });
  },
};

// Simulate an async fetch: render with the `loading` attribute (present at
// hydration, so the busy state paints immediately), then drop it and supply the
// options after a delay. Keyed on the element so it runs once per mount.
const asyncLoaded = new WeakSet<Element>();
export const AsyncLoading: Story = {
  name: 'Async data loading',
  // Open in the canvas; closed in autodocs (the fixed popup floats in the
  // stacked Docs layout). See the Themed story for the rationale.
  render: (_args, { globals, viewMode }) => {
    const onRef = (el?: Element) => {
      if (!el || asyncLoaded.has(el)) return;
      asyncLoaded.add(el);
      const ms = el as HTMLElement & { options: unknown[]; loading: boolean };
      setTimeout(() => {
        ms.options = Array.from({ length: 500 }, (_, i) => ({ value: `o${i}`, label: `Option ${i}` }));
        ms.loading = false;
      }, 2200);
    };
    return html`
      <div style="max-inline-size: 360px;">
        <md-multi-select ${ref(onRef)} label="${t(globals.locale, 'multiselect.option')}" filterable virtualize="always" loading show-select-all display-mode="count" max-height="320" ?open=${viewMode !== 'docs'}></md-multi-select>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
          Opens in the <code>loading</code> state — trigger spinner + a wavy progress bar
          in the menu — until the data arrives (~2.2 s), then shows the searchable list.
        </p>
      </div>
    `;
  },
};

// Ten million options packed into WASM linear memory; only the ~visible rows are
// ever in the DOM. Filtering + typeahead run inside WASM. Mirrors the md-select
// story but multi-selectable (checkboxes + "select all").
const VIRTUAL_ROW_COUNT = 10_000_000;
const virtualRowSource = {
  count: VIRTUAL_ROW_COUNT,
  getRow: (i: number) => ({ value: `v${i}`, label: `Option ${i}` }),
};
const virtualLoaded = new WeakSet<Element>();

export const VirtualizedTenMillion: Story = {
  name: 'Virtualized (10,000,000)',
  render: (_args, { globals }) => {
    const onRef = (el?: Element) => {
      if (!el || virtualLoaded.has(el)) return;
      virtualLoaded.add(el);
      const sel = el as HTMLElement & {
        loading?: boolean;
        loadOptions?: (source: { count: number; getRow: (i: number) => { value: string; label: string } }) => Promise<void>;
      };
      sel.loading = true;
      const status = el.parentElement?.querySelector('.vstatus') as HTMLElement | null;
      if (status) status.textContent = 'Loading 10,000,000 options…';
      const t0 = performance.now();
      void sel.loadOptions?.(virtualRowSource).then(() => {
        sel.loading = false;
        if (status) status.textContent = `Ready — 10,000,000 options in ${Math.round(performance.now() - t0)} ms.`;
      });
    };
    return html`
      <div style="max-inline-size: 360px;">
        <md-multi-select
          ${ref(onRef)}
          label="${t(globals.locale, 'multiselect.option')}"
          virtualize="always"
          filterable
          show-select-all
          max-height="320"
          display-mode="count"
        ></md-multi-select>
        <p class="vstatus" style="font:500 12px/16px Roboto,sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px; min-height:16px;"></p>
        <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:4px;">
          Windowed rows, WASM-backed filter/typeahead, multi-select with "select all".
        </p>
      </div>
    `;
  },
};

export const States: Story = {
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:24px; max-inline-size: 360px;">
      <md-multi-select label="Enabled" .options=${topicOptions} .value=${['design']}></md-multi-select>
      <md-multi-select label="Disabled" disabled .options=${topicOptions} .value=${['design']}></md-multi-select>
      <md-multi-select label="Error" error error-text="${t(globals.locale, 'multiselect.pickAtLeastOne')}" .options=${topicOptions}></md-multi-select>
    </div>
  `,
  /** The disabled guard: every open affordance — the show() method, a pointer
   *  click on the field, and the APG open keys — is swallowed while disabled, so
   *  the menu never opens (each of these DOES open an enabled control). */
  play: async ({ canvasElement, step }) => {
    const dis = await getMsAt(canvasElement, 1); // the `disabled` instance

    await step('show() is a no-op on a disabled control', async () => {
      expect(dis.open).toBe(false);
      await (dis as unknown as { show(): Promise<void> }).show();
      await new Promise((r) => setTimeout(r, 60));
      expect(dis.open).toBe(false); // guarded — an enabled control would be open here
    });

    await step('Clicking the disabled field does not toggle the menu open', async () => {
      fieldOf(dis).click(); // runs toggleOpen, which early-returns while disabled
      await new Promise((r) => setTimeout(r, 60));
      expect(dis.open).toBe(false);
    });

    await step('APG open keys (ArrowDown) are ignored while disabled', async () => {
      fieldOf(dis).focus();
      key(fieldOf(dis), 'ArrowDown'); // opens an enabled control (see Playground)
      await new Promise((r) => setTimeout(r, 60));
      expect(dis.open).toBe(false);
    });
  },
};

export const SlottedOptions: Story = {
  name: 'Slotted options',
  render: (_args, { globals }) => html`
    <div style="max-inline-size: 360px;">
      <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" variant="outlined" .value=${['design']}>
        <md-select-option value="design" icon="palette">Design</md-select-option>
        <md-select-option value="eng" icon="code">Engineering</md-select-option>
        <md-select-option value="prd" icon="rocket_launch">Product</md-select-option>
        <md-select-option value="sec" icon="shield" disabled>Security</md-select-option>
      </md-multi-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:8px;">
        Authored with declarative &lt;md-select-option&gt; children instead of the options array.
      </p>
    </div>
  `,
};

export const MatchTriggerWidth: Story = {
  name: 'Match trigger width',
  render: (_args, { globals }) => html`
    <div style="display:flex; gap:48px; flex-wrap:wrap;">
      <div style="width:340px;">
        <p style="font:500 12px/16px Roboto,sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          match-trigger-width (default)
        </p>
        <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" match-trigger-width .options=${topicOptions} .value=${['design']}></md-multi-select>
      </div>
      <div style="width:340px;">
        <p style="font:500 12px/16px Roboto,sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
          match-trigger-width="false"
        </p>
        <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" .matchTriggerWidth=${false} .options=${topicOptions} .value=${['design']}></md-multi-select>
      </div>
    </div>
  `,
};

export const FormParticipation: Story = {
  render: (_args, { globals }) => html`
    <form
      style="max-inline-size: 360px;"
      @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        const values = [...new FormData(e.target as HTMLFormElement).getAll('topics')];
        alert(`topics: ${values.join(', ')}`);
      }}
    >
      <md-multi-select name="topics" label="${t(globals.locale, 'multiselect.topics')}" .options=${topicOptions}></md-multi-select>
      <button type="submit" style="margin-block-start: 12px;">${t(globals.locale, 'submit')}</button>
    </form>
  `,
  /** Form integration: a selection is picked, then a native form reset routes
   *  through formResetCallback and restores the control's default (empty) state. */
  play: async ({ canvasElement, step }) => {
    const ms = await getMs(canvasElement);
    const form = canvasElement.querySelector('form') as HTMLFormElement;

    await step('Pick two options through the menu', async () => {
      fieldOf(ms).click();
      await waitFor(() => expect(ms.open).toBe(true));
      optionByLabel(ms, 'Design').click();
      optionByLabel(ms, 'Engineering').click();
      await waitFor(() => expect(ms.value).toEqual(['design', 'eng']));
      key(fieldOf(ms), 'Escape');
      await waitFor(() => expect(ms.open).toBe(false));
      await new Promise((r) => setTimeout(r, 300));
    });

    await step('Resetting the form restores the initial (empty) selection', async () => {
      expect(ms.value).toEqual(['design', 'eng']);
      form.reset(); // invokes formResetCallback on the form-associated control
      await waitFor(() => expect(ms.value).toEqual([]));
      await waitFor(() => expect(chipsOf(ms).length).toBe(0));
    });
  },
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="max-inline-size: 360px;">
      <md-multi-select label="المواضيع" variant="outlined" .options=${topicOptions} .value=${['design']}></md-multi-select>
    </div>
  `,
};

/* ── Localization ───────────────────────────────────────── */

/**
 * Full localization. Translate BOTH layers:
 *
 *  1. **Your data** — `label`, `placeholder`, and every option `label` are your
 *     strings; feed them from your i18n dictionary.
 *  2. **The component's built-in UI strings** — exposed as props so they aren't
 *     stuck in English: `search-placeholder`, `no-results-text`,
 *     `no-options-text`, `clear-label`, `searching-label`, `filter-label`.
 *
 * Pair with `dir="rtl"` (and `lang`) on a container for right-to-left locales —
 * the whole control (chips, search, clear ✕, caret) mirrors via CSS logical
 * properties. Each is filterable + multi-select so the localized search, the
 * selected chips, and the clear button all show.
 */
const L10N_FRUITS = ['apple', 'banana', 'cherry', 'grape', 'orange', 'lemon', 'peach', 'pear'];
const L10N_LOCALES = [
  {
    code: 'en', dir: 'ltr', label: 'Fruit', placeholder: 'Pick fruit…',
    search: 'Search…', noResults: 'No results', clear: 'Clear selection',
    t: ['Apple', 'Banana', 'Cherry', 'Grape', 'Orange', 'Lemon', 'Peach', 'Pear'],
  },
  {
    code: 'de', dir: 'ltr', label: 'Obst', placeholder: 'Obst auswählen…',
    search: 'Suchen…', noResults: 'Keine Ergebnisse', clear: 'Auswahl löschen',
    t: ['Apfel', 'Banane', 'Kirsche', 'Traube', 'Orange', 'Zitrone', 'Pfirsich', 'Birne'],
  },
  {
    code: 'ja', dir: 'ltr', label: '果物', placeholder: '果物を選択…',
    search: '検索…', noResults: '結果なし', clear: '選択をクリア',
    t: ['りんご', 'バナナ', 'さくらんぼ', 'ぶどう', 'オレンジ', 'レモン', '桃', '梨'],
  },
  {
    code: 'ar', dir: 'rtl', label: 'فاكهة', placeholder: 'اختر فاكهة…',
    search: 'بحث…', noResults: 'لا نتائج', clear: 'مسح الاختيار',
    t: ['تفاحة', 'موز', 'كرز', 'عنب', 'برتقال', 'ليمون', 'خوخ', 'كمثرى'],
  },
];

export const Localization: Story = {
  render: () => html`
    <div style="display:flex; gap:24px; padding:24px; flex-wrap:wrap;">
      ${L10N_LOCALES.map(
        (loc) => html`
          <div dir="${loc.dir}" lang="${loc.code}" style="inline-size:260px;">
            <p style="font:600 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0 0 8px;">
              ${loc.code.toUpperCase()} · ${loc.dir.toUpperCase()}
            </p>
            <md-multi-select
              label="${loc.label}"
              placeholder="${loc.placeholder}"
              display-mode="chips"
              filterable
              clearable
              search-placeholder="${loc.search}"
              no-results-text="${loc.noResults}"
              clear-label="${loc.clear}"
              .options=${L10N_FRUITS.map((value, i) => ({ value, label: loc.t[i] }))}
              .value=${['apple', 'banana']}
            ></md-multi-select>
          </div>
        `,
      )}
    </div>
  `,
};

export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: () => html`
    <div style="max-inline-size: 360px;">
      <md-multi-select variant="outlined" label="Dark" .options=${topicOptions} .value=${['design','eng']}></md-multi-select>
    </div>
  `,
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .pill { --md-multi-select-chip-radius: 999px; }
      .min  { --md-multi-select-min-width: 480px; }
    </style>
    <div style="display:flex; flex-direction:column; gap:16px;">
      <md-multi-select class="pill" variant="outlined" label="Pill chips" .options=${topicOptions} .value=${['design','eng']}></md-multi-select>
      <md-multi-select class="min" variant="outlined" label="Wide" .options=${brandOptions} .value=${['b1','b2']}></md-multi-select>
    </div>
  `,
};

export const Customization: Story = {
  name: 'Customization (slots)',
  // Open the "Custom empty" menu in the canvas (to show the no-options slot), but
  // closed in autodocs — the fixed popup floats in the stacked Docs layout.
  render: (_args, { globals, viewMode }) => html`
    <div style="display:flex; flex-direction:column; gap:28px; max-inline-size: 380px;">
      <md-multi-select label="Custom caret" .options=${topicOptions} .value=${['design']}>
        <span slot="dropdown-icon" class="material-symbols-outlined">unfold_more</span>
      </md-multi-select>

      <md-multi-select label="Custom empty" ?open=${viewMode !== 'docs'}>
        <div slot="no-options" style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:20px; color:var(--md-sys-color-on-surface-variant, #49454F);">
          <span class="material-symbols-outlined" style="font-size:32px;">inbox</span>
          <span style="font:500 13px/18px Roboto;">${t(globals.locale, 'multiselect.noTopicsAvailable')}</span>
        </div>
      </md-multi-select>

      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin:0;">
        Slots: <code>dropdown-icon</code>, <code>loader</code>, <code>menu-loader</code>,
        <code>no-options</code>, <code>no-results</code>. Plus text props
        (<code>loading-text</code>, <code>search-placeholder</code>,
        <code>no-results-text</code>, …), icon props (<code>trigger-icon</code>,
        <code>clear-icon</code>, <code>dropdown-icon</code>), and
        <code>--md-multi-select-*</code> custom properties.
      </p>
    </div>
  `,
};

export const Themed: Story = {
  name: 'Themed (CSS vars + ::part)',
  // This demo re-skins with an arbitrary author palette to show the theming
  // surface; the illustrative teal is not contrast-tuned (picking accessible
  // colors is the consumer's responsibility), so skip the a11y check here.
  parameters: { a11y: { disable: true } },
  // Open the menu in the isolated canvas (to show ::part(menu-surface)), but keep
  // it CLOSED in the autodocs page — a position:fixed popup floats loose and
  // overlaps neighbouring blocks in the stacked Docs layout. Canvas still demos
  // the open surface; the closed teal chips/caret theming shows in Docs.
  render: (_args, { globals, viewMode }) => html`
    <style>
      .teal {
        --md-multi-select-chip-radius: 999px;
        --md-multi-select-caret-color: #00695c;
        --md-multi-select-option-icon-color: #00897b;
        --md-multi-select-search-bg: #e0f2f1;
        --md-multi-select-search-placeholder-color: #00695c;
        --md-multi-select-empty-color: #00695c;
        --md-multi-select-select-all-divider-color: #b2dfdb;
      }
      /* ::part reaches through the shadow boundary — even the popup surface. */
      .teal::part(menu-surface) {
        border-radius: 20px;
        box-shadow: 0 8px 24px rgba(0, 105, 92, 0.28);
      }
      .teal::part(chip) {
        --md-chip-outline-color: #4db6ac;
      }
    </style>
    <div style="max-inline-size: 380px;">
      <md-multi-select
        class="teal"
        label="${t(globals.locale, 'multiselect.teams')}"
        filterable
        show-select-all
        max-height="280"
        .options=${topicOptions}
        .value=${['design', 'eng']}
        ?open=${viewMode !== 'docs'}
      ></md-multi-select>
      <p style="font:400 12px/16px Roboto,sans-serif; color:var(--md-sys-color-on-surface-variant, #49454F); margin-top:12px;">
        Fully re-skinned with <code>--md-multi-select-*</code> custom properties and
        <code>::part(menu-surface)</code> / <code>::part(chip)</code> from the page —
        no shadow-DOM surgery.
      </p>
    </div>
  `,
};

const brandOptionsA11y = Array.from({ length: 8 }, (_, i) => ({ value: `b${i + 1}`, label: `Brand ${i + 1}` }));

/**
 * Accessibility. Every variant here passes axe (see the **Accessibility** panel).
 * The component implements the WAI-ARIA *multi-selectable listbox* + *combobox*
 * patterns:
 *
 * - **Roles/state**: `role="listbox"` + `aria-multiselectable`, `role="option"` +
 *   `aria-selected` per option (virtualized rows carry `aria-setsize`/`aria-posinset`);
 *   the filter is a `role="combobox"` with `aria-controls`/`aria-activedescendant`;
 *   "select all" is a tri-state `role="checkbox"` (`aria-checked` true/false/mixed);
 *   busy state is `aria-busy` + a `role="status"` progress bar.
 * - **Keyboard**: Down/Up/Enter/Space open; arrows move the active option; Space/Enter
 *   toggle *without closing*; Home/End + typeahead; Escape closes and returns focus to
 *   the trigger; Tab closes and moves on. Chips are removable with Delete/Backspace or
 *   their ✕; removing a chip keeps focus on a neighbour.
 * - **Announcements**: a polite live region announces the selection count; the button
 *   trigger conveys `aria-required`/`aria-invalid`/`aria-describedby` with a visible
 *   error message.
 */
export const Accessibility: Story = {
  name: 'Accessibility',
  render: (_args, { globals }) => html`
    <div style="display:flex; flex-direction:column; gap:32px; max-inline-size: 420px;">
      <div>
        <div style="font:500 13px/18px Roboto; color: var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">Labeled, filterable, required — field trigger</div>
        <md-multi-select label="${t(globals.locale, 'multiselect.brands')}" filterable show-select-all required max-height="280" .options=${brandOptionsA11y} .value=${['b1', 'b2']}></md-multi-select>
      </div>
      <div>
        <div style="font:500 13px/18px Roboto; color: var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">Error state conveyed to assistive tech — button trigger</div>
        <md-multi-select label="${t(globals.locale, 'multiselect.topics')}" trigger="button" chip-position="right" required error error-text="${t(globals.locale, 'multiselect.selectAtLeastOneTopic')}" .options=${topicOptions}></md-multi-select>
      </div>
      <div>
        <div style="font:500 13px/18px Roboto; color: var(--md-sys-color-on-surface-variant, #49454F); margin-bottom:8px;">Supporting text (described-by)</div>
        <md-multi-select label="${t(globals.locale, 'multiselect.regions')}" supporting-text="${t(globals.locale, 'multiselect.chooseRegions')}" .options=${brandOptionsA11y} .value=${['b3']}></md-multi-select>
      </div>
    </div>
  `,
};
