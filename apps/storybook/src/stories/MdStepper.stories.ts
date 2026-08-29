import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type StepperEl = HTMLElement & {
  active: number;
  next(): Promise<void>;
  prev(): Promise<void>;
  reset(): Promise<void>;
  goTo(index: number): Promise<void>;
};
type StepEl = HTMLElement & { active: boolean; completed: boolean };
const getStepper = async (root: HTMLElement): Promise<StepperEl> => {
  const stepper = root.querySelector('md-stepper') as StepperEl;
  await waitFor(() => expect(stepper.classList.contains('hydrated')).toBe(true));
  // Steps hydrate as separate elements; their shadow header is the click target
  // and a click before hydration is a silent no-op — wait for every step too.
  await waitFor(() => {
    const steps = Array.from(stepper.querySelectorAll('md-step'));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((s) => s.classList.contains('hydrated'))).toBe(true);
  });
  return stepper;
};
const stepsOf = (stepper: StepperEl) =>
  Array.from(stepper.querySelectorAll('md-step')) as StepEl[];
/** The clickable step header (`part="inner"`, `role="button"`) lives in md-step's shadow. */
const innerOf = (step: StepEl) =>
  step.shadowRoot!.querySelector('.md-step__inner') as HTMLElement;
/** Text of the swapped `content`-slot panel — i.e. the currently visible step. */
const panelText = (stepper: StepperEl) =>
  (stepper.querySelector('[slot="content"]')?.textContent ?? '').trim();

const meta: Meta = {
  title: 'Navigation/Stepper',
  component: 'md-stepper',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
      description: {
        component:
          'Material Design 3 **stepper**. A `md-stepper` orchestrates slotted `md-step` ' +
          'children: it owns the active index + navigation and pushes layout / i18n down. ' +
          'It is *controlled* — it owns `active`; with `auto-complete` (default on) advancing ' +
          'also marks the step you leave as completed, so the progress line + checks "just work".<br><br>' +
          '**Where step content goes:** vertical steps render their slotted content in a ' +
          'spring-animated panel with built-in Back / Continue. Horizontal steppers keep the ' +
          "step row clean — put the active step's panel in the stepper's `content` slot " +
          '(between the steps and the built-in nav bar) and swap it on `mdStepChange`.<br><br>' +
          'Features: horizontal / vertical · numbered / dot / custom-icon indicators · ' +
          'pending / active / completed / error states · optional + editable steps · ' +
          'error + helper text · built-in content panels with Back / Continue · ' +
          'linear / non-linear · expressive spring motion (shape-morphing active indicator, ' +
          'animated progress connector, staggered entrance) · full a11y, i18n, ' +
          'theming, reduced-motion & forced-colors.',
      },
    },
  },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    indicator: { control: 'inline-radio', options: ['numbered', 'dot'] },
    mode: { control: 'inline-radio', options: ['linear', 'non-linear'] },
    active: { control: { type: 'number', min: 0, max: 3, step: 1 } },
    autoComplete: { control: 'boolean', description: 'Advancing marks the left step completed.' },
    nav: { control: 'boolean', description: 'Built-in Back / Continue navigation.' },
    readonly: { control: 'boolean', description: 'Status trail: headers are text, not buttons.' },
    label: { control: 'text' },
    stepWord: { control: 'text' },
    ofWord: { control: 'text' },
  },
  args: {
    orientation: 'horizontal', indicator: 'numbered', mode: 'linear',
    active: 1, autoComplete: true, nav: true, readonly: false, label: 'Progress', stepWord: 'Step', ofWord: 'of',
  },
};
export default meta;
type Story = StoryObj;

const labelStyle =
  'font: 500 11px/16px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 8px;';
const panel =
  'font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F); margin: 0;';
const panelCard =
  'padding: 16px 20px; border-radius: 16px; background: var(--md-sys-color-surface-container-low, #F7F2FA); ' +
  'color: var(--md-sys-color-on-surface, #1C1B1F); font: 400 14px/20px Roboto, sans-serif;';
const statusStyle =
  'font: 500 13px/20px Roboto, sans-serif; color: var(--md-sys-color-primary, #6750A4); min-height: 20px; margin: 8px 0 0;';

/** One panel per step: a headline + body, rendered into the stepper's `content` slot. */
const panelHtml = (title: string, body: string) =>
  `<div style="font: 500 16px/24px Roboto, sans-serif; margin-bottom: 4px;">${title}</div>` +
  `<div style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">${body}</div>`;

/** Swap the slotted content panel to the active step's panel on mdStepChange. */
const syncPanel = (e: Event, panels: string[]) => {
  const stepper = e.currentTarget as HTMLElement & { active: number };
  const slot = stepper.querySelector<HTMLElement>('[slot="content"]');
  if (!slot) return;
  const i = Math.max(0, Math.min(panels.length - 1, stepper.active));
  slot.innerHTML = panels[i];
};

/** Write a completion message into the demo's status line on mdComplete. */
const markComplete = (e: Event, message = '✓ All steps completed — mdComplete fired') => {
  const stepper = e.currentTarget as HTMLElement;
  const status = stepper.parentElement?.querySelector<HTMLElement>('.flow-status');
  if (status) status.textContent = message;
};

const CHECKOUT_PANELS = (loc?: string) => [
  panelHtml(t(loc, 'stepper.cart'), t(loc, 'stepper.checkoutCartBody')),
  panelHtml(t(loc, 'stepper.shipping'), t(loc, 'stepper.checkoutShippingBody')),
  panelHtml(t(loc, 'stepper.payment'), t(loc, 'stepper.checkoutPaymentBody')),
  panelHtml(t(loc, 'stepper.review'), t(loc, 'stepper.checkoutReviewBody')),
];

/* ─── Playground ──────────────────────────────────────────── */
export const Playground: Story = {
  render: (args, { globals }) => html`
    <div style="width: 760px; max-width: 100%;">
      <md-stepper
        orientation=${args.orientation}
        indicator=${args.indicator}
        mode=${args.mode}
        active=${args.active}
        auto-complete=${args.autoComplete}
        nav=${args.nav}
        ?readonly=${args.readonly}
        label=${args.label}
        step-word=${args.stepWord}
        of-word=${args.ofWord}
        @mdStepChange=${(e: Event) => syncPanel(e, CHECKOUT_PANELS(globals.locale))}
        @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAllComplete'))}
      >
        <md-step label=${t(globals.locale, 'stepper.cart')}><p style=${panel}>${t(globals.locale, 'stepper.playgroundCartBody')}</p></md-step>
        <md-step label=${t(globals.locale, 'stepper.shipping')} description=${t(globals.locale, 'stepper.descAddressMethod')}><p style=${panel}>${t(globals.locale, 'stepper.playgroundShippingBody')}</p></md-step>
        <md-step label=${t(globals.locale, 'stepper.payment')}><p style=${panel}>${t(globals.locale, 'stepper.playgroundPaymentBody')}</p></md-step>
        <md-step label=${t(globals.locale, 'stepper.review')}><p style=${panel}>${t(globals.locale, 'stepper.playgroundReviewBody')}</p></md-step>
        ${args.orientation === 'horizontal'
          ? html`<div slot="content" style=${panelCard}>
              ${unsafeHTML(CHECKOUT_PANELS(globals.locale)[Math.max(0, Math.min(CHECKOUT_PANELS(globals.locale).length - 1, Number(args.active) || 0))])}
            </div>`
          : null}
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
};

const ONBOARDING_PANELS = (loc?: string) => [
  panelHtml(t(loc, 'stepper.welcomeAboard'), t(loc, 'stepper.onboardWelcomeBody')),
  panelHtml(t(loc, 'stepper.yourProfile'), t(loc, 'stepper.onboardProfileBody')),
  panelHtml(t(loc, 'stepper.preferences'), t(loc, 'stepper.onboardPrefsBody')),
  panelHtml(t(loc, 'stepper.allSet'), t(loc, 'stepper.onboardDoneBody')),
];
const DEPLOY_PANELS = (loc?: string) => [
  panelHtml(t(loc, 'stepper.connectRepo'), t(loc, 'stepper.deployConnectBody')),
  panelHtml(t(loc, 'stepper.configureBuild'), t(loc, 'stepper.deployConfigBody')),
  panelHtml(t(loc, 'stepper.deploy'), t(loc, 'stepper.deployDeployBody')),
];

/* ─── Horizontal wizard (content slot + built-in nav) ─────── */
export const Horizontal: Story = {
  name: 'Horizontal Wizard (content slot)',
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 40px; width: 760px; max-width: 100%;">
      <div>
        <div style=${labelStyle}>Numbered — the content slot swaps on mdStepChange; Back / Continue are built in</div>
        <md-stepper
          active="0"
          @mdStepChange=${(e: Event) => syncPanel(e, CHECKOUT_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusOrderPlacedFired'))}
        >
          <md-step label=${t(globals.locale, 'stepper.cart')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.shipping')} description=${t(globals.locale, 'stepper.descAddressMethod')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.payment')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.review')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(CHECKOUT_PANELS(globals.locale)[0])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
      <div>
        <div style=${labelStyle}>Dot indicator — the active dot grows into a bigger dot</div>
        <md-stepper
          indicator="dot"
          active="0"
          @mdStepChange=${(e: Event) => syncPanel(e, ONBOARDING_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusOnboardingFinished'))}
        >
          <md-step label=${t(globals.locale, 'stepper.welcome')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.profile')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.preferences')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.done')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(ONBOARDING_PANELS(globals.locale)[0])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
      <div>
        <div style=${labelStyle}>Custom indicator icons</div>
        <md-stepper
          active="0"
          @mdStepChange=${(e: Event) => syncPanel(e, DEPLOY_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusDeployed'))}
        >
          <md-step label=${t(globals.locale, 'stepper.connect')} icon="cable"></md-step>
          <md-step label=${t(globals.locale, 'stepper.configure')} icon="tune"></md-step>
          <md-step label=${t(globals.locale, 'stepper.deploy')} icon="rocket_launch"></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(DEPLOY_PANELS(globals.locale)[0])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
    </div>
  `,
};

/* ─── Vertical wizard (built-in content panels + actions) ──── */
export const VerticalWizard: Story = {
  name: 'Vertical Wizard (content panels)',
  render: (_args, { globals }) => html`
    <div style="width: 520px; max-width: 100%;">
      <div style=${labelStyle}>Self-driving wizard — panels spring open/closed; the built-in Back / Continue navigate and auto-complete</div>
      <md-stepper
        orientation="vertical"
        active="0"
        @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAccountCreated'))}
      >
        <md-step label=${t(globals.locale, 'stepper.account')} description=${t(globals.locale, 'stepper.descYourDetails')}>
          <p style=${panel}>${t(globals.locale, 'stepper.verticalAccountBody')}</p>
        </md-step>
        <md-step label=${t(globals.locale, 'stepper.shipping')} description=${t(globals.locale, 'stepper.descWhereToDeliver')}>
          <p style=${panel}>${t(globals.locale, 'stepper.verticalShippingBody')}</p>
        </md-step>
        <md-step label=${t(globals.locale, 'stepper.payment')}>
          <p style=${panel}>${t(globals.locale, 'stepper.verticalPaymentBody')}</p>
        </md-step>
        <md-step label=${t(globals.locale, 'stepper.review')}>
          <p style=${panel}>${t(globals.locale, 'stepper.verticalReviewBody')}</p>
        </md-step>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
  /** A vertical step's built-in Continue / Back emit mdStepNext / mdStepBack;
   *  the stepper navigates and rescues focus onto the new active header. */
  play: async ({ canvasElement, step }) => {
    const stepper = await getStepper(canvasElement);
    const steps = stepsOf(stepper);
    const actionsOf = (s: StepEl) =>
      Array.from(s.shadowRoot!.querySelectorAll('.md-step__actions md-button')) as HTMLElement[];

    await step("A step's built-in Continue advances via mdStepNext and moves focus", async () => {
      expect(stepper.active).toBe(0);
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      actionsOf(steps[0])[1].click(); // the active step's Continue button (index 1 = filled)

      await waitFor(() => expect(stepper.active).toBe(1)); // mdStepNext → next()
      expect(detail).toEqual({ index: 1, previous: 0 });
      await waitFor(() => expect(steps[0].hasAttribute('completed')).toBe(true)); // auto-completed the left step
      // The pressed button collapsed with its panel, so focus is rescued onto the new header.
      await waitFor(() => {
        const focused = steps[1].shadowRoot!.activeElement as HTMLElement | null;
        expect(focused?.classList.contains('md-step__inner')).toBe(true);
      });
    });

    await step("A step's built-in Back steps back via mdStepBack", async () => {
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      actionsOf(steps[1])[0].click(); // the active step's Back button (index 0 = text)

      await waitFor(() => expect(stepper.active).toBe(0)); // mdStepBack → prev()
      expect(detail).toEqual({ index: 0, previous: 1 });
      await waitFor(() => {
        const focused = steps[0].shadowRoot!.activeElement as HTMLElement | null;
        expect(focused?.classList.contains('md-step__inner')).toBe(true); // focus rescued again
      });
      await new Promise((r) => setTimeout(r, 300)); // let the panel spring settle
    });
  },
};

const OPTIONAL_PANELS = (loc?: string) => [
  panelHtml(t(loc, 'stepper.account'), t(loc, 'stepper.optionalAccountBody')),
  panelHtml(t(loc, 'stepper.addonsOptional'), t(loc, 'stepper.optionalAddonsBody')),
  panelHtml(t(loc, 'stepper.payment'), t(loc, 'stepper.optionalPaymentBody')),
];
const EDITABLE_PANELS = (loc?: string) => [
  panelHtml(`${t(loc, 'stepper.account')} ✎`, t(loc, 'stepper.editableAccountBody')),
  panelHtml(`${t(loc, 'stepper.shipping')} ✎`, t(loc, 'stepper.editableShippingBody')),
  panelHtml(t(loc, 'stepper.payment'), t(loc, 'stepper.editablePaymentBody')),
];
const ERROR_PANELS = (loc?: string) => [
  panelHtml(t(loc, 'stepper.account'), t(loc, 'stepper.errorAccountBody')),
  panelHtml(t(loc, 'stepper.shipping'), t(loc, 'stepper.errorShippingBody')),
  panelHtml(t(loc, 'stepper.paymentActionNeeded'), t(loc, 'stepper.errorPaymentBody')),
];

/* ─── Optional + editable + error ─────────────────────────── */
export const StatesShowcase: Story = {
  name: 'Optional · Editable · Error',
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 40px; width: 760px; max-width: 100%;">
      <div>
        <div style=${labelStyle}>Optional step (skippable, captioned)</div>
        <md-stepper
          active="1"
          @mdStepChange=${(e: Event) => syncPanel(e, OPTIONAL_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAllComplete'))}
        >
          <md-step label=${t(globals.locale, 'stepper.account')} completed></md-step>
          <md-step label=${t(globals.locale, 'stepper.addons')} optional></md-step>
          <md-step label=${t(globals.locale, 'stepper.payment')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(OPTIONAL_PANELS(globals.locale)[1])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
      <div>
        <div style=${labelStyle}>Editable completed steps (pencil — click to revisit; downstream completion survives)</div>
        <md-stepper
          mode="linear"
          active="2"
          @mdStepChange=${(e: Event) => syncPanel(e, EDITABLE_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAllComplete'))}
        >
          <md-step label=${t(globals.locale, 'stepper.account')} completed editable></md-step>
          <md-step label=${t(globals.locale, 'stepper.shipping')} completed editable></md-step>
          <md-step label=${t(globals.locale, 'stepper.payment')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(EDITABLE_PANELS(globals.locale)[2])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
      <div>
        <div style=${labelStyle}>Error with helper text</div>
        <md-stepper
          active="2"
          @mdStepChange=${(e: Event) => syncPanel(e, ERROR_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAllComplete'))}
        >
          <md-step label=${t(globals.locale, 'stepper.account')} completed></md-step>
          <md-step label=${t(globals.locale, 'stepper.shipping')} completed></md-step>
          <md-step label=${t(globals.locale, 'stepper.payment')} error error-text=${t(globals.locale, 'stepper.cardDeclined')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(ERROR_PANELS(globals.locale)[2])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
    </div>
  `,
  /** In LINEAR mode the reachability gate still lets you (a) skip forward when
   *  every prior step is completed or optional, and (b) click back to any earlier
   *  step. Exercises canNavigateTo's linear branches via real header clicks. */
  play: async ({ canvasElement, step }) => {
    // getStepper resolves the first stepper on the page — the linear "Optional"
    // wizard: Account (completed) · Add-ons (optional) · Payment.
    const stepper = await getStepper(canvasElement);
    const steps = stepsOf(stepper);

    await step('Linear: a click can skip forward past an optional step', async () => {
      expect(stepper.active).toBe(1); // sitting on the optional "Add-ons" step
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      innerOf(steps[2]).click(); // Payment — reachable: every prior step is completed or optional

      await waitFor(() => expect(stepper.active).toBe(2)); // linear gate allowed the forward jump
      expect(detail).toEqual({ index: 2, previous: 1 });
      await waitFor(() => expect(steps[2].hasAttribute('active')).toBe(true));
    });

    await step('Linear: clicking an earlier step navigates back (back is always allowed)', async () => {
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      innerOf(steps[0]).click(); // Account — target <= active, so the linear gate allows it

      await waitFor(() => expect(stepper.active).toBe(0));
      expect(detail).toEqual({ index: 0, previous: 2 });
      await waitFor(() => expect(steps[0].hasAttribute('active')).toBe(true));
      await new Promise((r) => setTimeout(r, 300)); // let connector fill animations settle
    });
  },
};

const SURVEY_PANELS = (loc?: string) => [
  panelHtml(t(loc, 'stepper.personal'), t(loc, 'stepper.surveyPersonalBody')),
  panelHtml(t(loc, 'stepper.address'), t(loc, 'stepper.surveyAddressBody')),
  panelHtml(t(loc, 'stepper.review'), t(loc, 'stepper.surveyReviewBody')),
  panelHtml(t(loc, 'stepper.pay'), t(loc, 'stepper.surveyPayBody')),
];

/* ─── Read-only status trail ───────────────────────────────── */
/**
 * `readonly` turns the stepper into something to READ rather than something to
 * drive: a review trail, an order's progress, a pipeline stage. Every header
 * stops being a button — no click, no keyboard activation, no ripple, no hover
 * state layer, no tab stop, no `role="button"` — while `aria-current` still
 * tells a screen reader which stage is live.
 *
 * It is not `nav="false"`, which only hides the Back / Continue bar and leaves
 * every header clickable; and it is not `disabled`, which refuses and dims. A
 * stage that has not happened yet is a fact being reported, so it stays at full
 * contrast. `readonly` also makes `mode` irrelevant: nothing navigates, so
 * linear gating no longer greys out the stages ahead.
 */
export const ReadonlyTrail: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 760px; max-width: 100%;">
      <div style=${labelStyle}>Nothing here is clickable — hover a step and see</div>
      <md-stepper readonly nav="false" active="1" auto-complete="false">
        <md-step
          label=${t(globals.locale, 'stepper.personal')}
          description=${t(globals.locale, 'stepper.statusComplete')}
          completed
        ></md-step>
        <md-step
          label=${t(globals.locale, 'stepper.address')}
          description=${t(globals.locale, 'stepper.statusInProgress')}
        ></md-step>
        <md-step
          label=${t(globals.locale, 'stepper.review')}
          description=${t(globals.locale, 'stepper.statusNotStarted')}
        ></md-step>
        <md-step
          label=${t(globals.locale, 'stepper.pay')}
          description=${t(globals.locale, 'stepper.statusNotStarted')}
        ></md-step>
      </md-stepper>
    </div>
  `,
};

/* ─── Non-linear ──────────────────────────────────────────── */
export const NonLinear: Story = {
  render: (_args, { globals }) => html`
    <div style="width: 760px; max-width: 100%;">
      <div style=${labelStyle}>Click any step to jump (no order enforcement) — the panel follows</div>
      <md-stepper
        mode="non-linear"
        active="2"
        @mdStepChange=${(e: Event) => syncPanel(e, SURVEY_PANELS(globals.locale))}
        @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusSurveySubmitted'))}
      >
        <md-step label=${t(globals.locale, 'stepper.personal')} completed></md-step>
        <md-step label=${t(globals.locale, 'stepper.address')} completed></md-step>
        <md-step label=${t(globals.locale, 'stepper.review')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.pay')}></md-step>
        <div slot="content" style=${panelCard}>${unsafeHTML(SURVEY_PANELS(globals.locale)[2])}</div>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
  /** Clicking a step header jumps the active index there (non-linear = no gating). */
  play: async ({ canvasElement, step }) => {
    const stepper = await getStepper(canvasElement);
    const steps = stepsOf(stepper);

    await step('Clicking a step header jumps the active index back to it', async () => {
      expect(stepper.active).toBe(2);
      const panelBefore = panelText(stepper); // the "Review" panel
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      innerOf(steps[0]).click(); // click the "Personal" header

      await waitFor(() => expect(stepper.active).toBe(0)); // jumped from 2 → 0
      expect(detail).toEqual({ index: 0, previous: 2 }); // event fired with payload
      await waitFor(() => {
        expect(steps[0].hasAttribute('active')).toBe(true); // header #1 is now current
        expect(steps[2].hasAttribute('active')).toBe(false); // old active released
      });
      expect(panelText(stepper)).not.toBe(panelBefore); // visible panel swapped
      expect(panelText(stepper)).toContain('Personal');
    });

    await step('Non-linear lets a click skip forward over incomplete steps', async () => {
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      innerOf(steps[3]).click(); // straight to "Pay" — linear mode would block this jump

      await waitFor(() => expect(stepper.active).toBe(3));
      expect(detail).toEqual({ index: 3, previous: 0 });
      await waitFor(() => expect(steps[3].hasAttribute('active')).toBe(true));
      expect(panelText(stepper)).toContain('Pay');
    });

    await step('Clicking the already-active step is a no-op (no event, no move)', async () => {
      let fired = false;
      stepper.addEventListener('mdStepChange', () => { fired = true; }, { once: true });
      innerOf(steps[3]).click(); // step 3 is already active → guarded early-return
      await new Promise((r) => setTimeout(r, 80));
      expect(fired).toBe(false);
      expect(stepper.active).toBe(3);
      await new Promise((r) => setTimeout(r, 300)); // let connector fill animations settle
    });

    await step('Footer Back button walks back and rescues focus on the first step', async () => {
      const nav = stepper.shadowRoot!.querySelector('.md-stepper__nav') as HTMLElement;
      expect(nav).toBeTruthy(); // horizontal footer nav bar rendered
      const backBtn = Array.from(nav.querySelectorAll('md-button'))[0] as HTMLElement;

      expect(stepper.active).toBe(3);
      backBtn.click();
      await waitFor(() => expect(stepper.active).toBe(2)); // handleFooterBack → prev()
      backBtn.click();
      await waitFor(() => expect(stepper.active).toBe(1));
      backBtn.click();
      await waitFor(() => expect(stepper.active).toBe(0));
      // Back disables itself on the first step while focused, so focus is rescued to the header.
      await waitFor(() => {
        const focused = stepsOf(stepper)[0].shadowRoot!.activeElement as HTMLElement | null;
        expect(focused?.classList.contains('md-step__inner')).toBe(true);
      });
    });

    await step('Footer Continue button advances via next()', async () => {
      const nav = stepper.shadowRoot!.querySelector('.md-stepper__nav') as HTMLElement;
      const nextBtn = Array.from(nav.querySelectorAll('md-button'))[1] as HTMLElement;
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      nextBtn.click(); // footer Continue → next()

      await waitFor(() => expect(stepper.active).toBe(1));
      expect(detail).toEqual({ index: 1, previous: 0 });
      await new Promise((r) => setTimeout(r, 300)); // let connector fill animations settle
    });

    // Reset to the first-render resting state so the visual baseline captures the
    // clean render (active=2 "Review", steps 0-1 completed) — not the post-play state.
    await step('Reset to the resting first-render state for a clean visual baseline', async () => {
      stepper.active = 2; // Review, as first rendered → mdStepChange re-syncs the panel
      await waitFor(() => expect(stepper.active).toBe(2));
      steps[0].completed = true; // Personal
      steps[1].completed = true; // Address
      steps[2].completed = false; // Review (active, not yet done)
      steps[3].completed = false; // Pay
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => {
        expect(steps[2].hasAttribute('active')).toBe(true);
        expect(steps[0].hasAttribute('completed')).toBe(true);
        expect(steps[1].hasAttribute('completed')).toBe(true);
        expect(steps[3].hasAttribute('completed')).toBe(false);
        expect(panelText(stepper)).toContain('Review');
      });
      await new Promise((r) => setTimeout(r, 300)); // let connector fill + panel spring settle
    });
  },
};

/* ─── Imperative controls ─────────────────────────────────── */
export const ImperativeControls: Story = {
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 16px; width: 760px; max-width: 100%;">
      <div style=${labelStyle}>nav="false" — you own navigation: next() / prev() / reset() + your own buttons</div>
      <md-stepper
        id="ctrl-stepper"
        active="0"
        nav="false"
        @mdStepChange=${(e: Event) => syncPanel(e, CHECKOUT_PANELS(globals.locale))}
        @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusImperativeComplete'))}
      >
        <md-step label=${t(globals.locale, 'stepper.cart')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.shipping')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.payment')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.review')}></md-step>
        <div slot="content" style=${panelCard}>${unsafeHTML(CHECKOUT_PANELS(globals.locale)[0])}</div>
      </md-stepper>
      <div style="display: flex; gap: 8px;">
        <md-button variant="text" size="sm" @click=${() => (document.getElementById('ctrl-stepper') as any)?.prev()}>${t(globals.locale, 'back')}</md-button>
        <md-button variant="filled" size="sm" @click=${() => (document.getElementById('ctrl-stepper') as any)?.next()}>${t(globals.locale, 'stepper.continue')}</md-button>
        <md-button variant="outlined" size="sm" @click=${() => (document.getElementById('ctrl-stepper') as any)?.reset()}>${t(globals.locale, 'stepper.reset')}</md-button>
      </div>
      <p class="flow-status" style=${statusStyle}></p>
      <p style=${panel}>next() auto-completes the step it leaves; reset() clears everything.</p>
    </div>
  `,
  /** next()/prev()/reset() move activeIndex, swap the visible panel, and emit. */
  play: async ({ canvasElement, step }) => {
    const stepper = await getStepper(canvasElement);
    const steps = stepsOf(stepper);

    await step('next() advances the index, emits mdStepChange, swaps the panel', async () => {
      expect(stepper.active).toBe(0);
      expect(steps[0].hasAttribute('completed')).toBe(false); // Cart not yet done
      const panelBefore = panelText(stepper); // the "Cart" panel
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      await stepper.next();

      await waitFor(() => expect(stepper.active).toBe(1)); // index advanced 0 → 1
      expect(detail).toEqual({ index: 1, previous: 0 }); // event fired with payload
      await waitFor(() => {
        expect(steps[1].hasAttribute('active')).toBe(true); // Shipping is now current
        expect(steps[0].hasAttribute('active')).toBe(false);
      });
      await waitFor(() => expect(steps[0].hasAttribute('completed')).toBe(true)); // auto-completed the step it left
      expect(panelText(stepper)).not.toBe(panelBefore); // visible panel swapped
      expect(panelText(stepper)).toContain('Shipping');
    });

    await step('prev() steps back and reverts the auto-completion', async () => {
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      await stepper.prev();

      await waitFor(() => expect(stepper.active).toBe(0)); // back to Cart
      expect(detail).toEqual({ index: 0, previous: 1 });
      await waitFor(() => expect(steps[0].hasAttribute('completed')).toBe(false)); // stepping back un-completes it
      expect(panelText(stepper)).toContain('Cart');
    });

    await step('next() past the last step fires mdComplete without over-advancing', async () => {
      while (stepper.active < steps.length - 1) await stepper.next(); // walk to Review (last)
      await waitFor(() => expect(stepper.active).toBe(3));
      // auto-complete reflects `completed` on each step it left; the attribute
      // settles a render tick after `active` lands, so assert it inside waitFor.
      await waitFor(() =>
        expect(steps.slice(0, 3).every((s) => s.hasAttribute('completed'))).toBe(true),
      ); // all passed steps completed

      let completed = false;
      stepper.addEventListener('mdComplete', () => { completed = true; }, { once: true });
      await stepper.next(); // Finish
      await waitFor(() => expect(completed).toBe(true)); // mdComplete emitted
      expect(stepper.active).toBe(3); // clamped — no phantom 5th step
    });

    await step('reset() returns to the first step and clears all completion', async () => {
      await stepper.reset();
      await waitFor(() => expect(stepper.active).toBe(0));
      // reset() clears `completed`, removing the reflected attribute on the next
      // render tick — wait for the removal to settle before asserting.
      await waitFor(() =>
        expect(stepsOf(stepper).every((s) => !s.hasAttribute('completed'))).toBe(true),
      ); // every check cleared
      await new Promise((r) => setTimeout(r, 300)); // let connector fill animations settle
    });

    await step('goTo() enforces linear reachability (forward gated, completed revisitable)', async () => {
      expect(stepper.active).toBe(0);
      // Forward jump over incomplete steps is refused by canNavigateTo (linear gate).
      await stepper.goTo(3);
      await new Promise((r) => setTimeout(r, 60));
      expect(stepper.active).toBe(0); // blocked — did not move

      // Mark a downstream step completed → goTo may now revisit it.
      steps[2].completed = true;
      await waitFor(() => expect(steps[2].hasAttribute('completed')).toBe(true));
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });
      await stepper.goTo(2);
      await waitFor(() => expect(stepper.active).toBe(2)); // completed step is reachable
      expect(detail).toEqual({ index: 2, previous: 0 });
    });

    await step('goTo() backward is always allowed; goTo(current) is a no-op', async () => {
      await stepper.goTo(1); // backward jump — allowed regardless of completion
      await waitFor(() => expect(stepper.active).toBe(1));

      let fired = false;
      stepper.addEventListener('mdStepChange', () => { fired = true; }, { once: true });
      await stepper.goTo(1); // same index → commitChange early-returns
      await new Promise((r) => setTimeout(r, 60));
      expect(fired).toBe(false);
      expect(stepper.active).toBe(1);
    });

    await step('Changing a config prop re-syncs data-* on every step (onConfigChange watch)', async () => {
      (stepper as StepperEl & { nextDisabled: boolean }).nextDisabled = true;
      await waitFor(() => expect(steps[0].getAttribute('data-next-disabled')).toBe('true'));
      (stepper as StepperEl & { nextDisabled: boolean }).nextDisabled = false;
      await waitFor(() => expect(steps[0].getAttribute('data-next-disabled')).toBe('false'));
    });

    await step('Out-of-range active clamps to the last step (watch re-entry)', async () => {
      stepper.active = 99;
      await waitFor(() => expect(stepper.active).toBe(3)); // clamped to the last index, not 99
    });

    await step('Setting a step into error is announced assertively (mutation observer)', async () => {
      const alert = stepper.shadowRoot!.querySelector('[role="alert"]') as HTMLElement;
      (steps[1] as StepEl & { errorText: string }).errorText = 'Card declined';
      (steps[1] as StepEl & { error: boolean }).error = true; // reflects → stepper observer → announceError

      await waitFor(() => {
        expect(alert.textContent).toContain('Card declined'); // errorText surfaced
        expect(alert.textContent).toContain('Shipping'); // step 2's label in the announcement
      });
      await new Promise((r) => setTimeout(r, 300)); // let animations settle
    });

    await step('mdBeforeChange preventDefault vetoes a user-driven change', async () => {
      // The clamp above parked us on the last step (3); a vetoed prev() must
      // neither move the index nor emit mdStepChange (commitChange early-returns).
      expect(stepper.active).toBe(3);
      const veto = (e: Event) => e.preventDefault();
      let changed = false;
      const onChange = () => { changed = true; };
      stepper.addEventListener('mdBeforeChange', veto);
      stepper.addEventListener('mdStepChange', onChange);

      await stepper.prev(); // user-driven → cancelable mdBeforeChange → vetoed

      await new Promise((r) => setTimeout(r, 80));
      expect(stepper.active).toBe(3); // preventDefault blocked the commit
      expect(changed).toBe(false); // no mdStepChange followed the veto
      stepper.removeEventListener('mdBeforeChange', veto);
      stepper.removeEventListener('mdStepChange', onChange);
    });

    await step('Negative active clamps up to the first step', async () => {
      stepper.active = -5;
      await waitFor(() => expect(stepper.active).toBe(0)); // clamped to 0, not left negative
    });

    await step('Removing the active last step re-clamps active down (slotchange)', async () => {
      stepper.active = 99;
      await waitFor(() => expect(stepper.active).toBe(3)); // park on the last step
      const before = stepsOf(stepper);
      expect(before.length).toBe(4);
      let detail: { index: number; previous: number } | undefined;
      stepper.addEventListener('mdStepChange', (e) => { detail = (e as CustomEvent).detail; }, { once: true });

      before[before.length - 1].remove(); // light-DOM removal fires the slot's slotchange

      await waitFor(() => expect(stepsOf(stepper).length).toBe(3)); // the step really left the DOM
      await waitFor(() => expect(stepper.active).toBe(2)); // re-clamped to the new last index
      expect(detail?.index).toBe(2); // the active watch emitted with the clamped index
    });

    // Reset to the first-render resting state so the visual baseline captures the
    // clean render (active=0 "Cart", four steps, none completed, no error) — not the
    // heavily-mutated post-play state (removed step, error, clamped active).
    await step('Reset to the resting first-render state for a clean visual baseline', async () => {
      // The slotchange test removed the last (Review) step; re-attach the held
      // reference so the row is whole again, matching the fresh render.
      if (!steps[3].isConnected) stepper.appendChild(steps[3]);
      await waitFor(() => {
        const now = stepsOf(stepper);
        expect(now.length).toBe(4);
        expect(now.every((s) => s.classList.contains('hydrated'))).toBe(true);
      });
      stepper.active = 0; // back to Cart → mdStepChange re-syncs the panel
      await waitFor(() => expect(stepper.active).toBe(0));
      // Clear the error + all completion the coverage steps set, and re-enable nav
      // (done after the active move so these explicit values are the final word).
      stepsOf(stepper).forEach((s) => {
        const es = s as StepEl & { error: boolean; errorText: string };
        es.error = false;
        es.errorText = '';
        es.completed = false;
      });
      (stepper as StepperEl & { nextDisabled: boolean }).nextDisabled = false;
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => {
        expect(stepper.active).toBe(0);
        expect(stepsOf(stepper).every((s) => !s.hasAttribute('completed'))).toBe(true);
        expect(stepsOf(stepper).some((s) => s.hasAttribute('error'))).toBe(false);
        expect(panelText(stepper)).toContain('Cart');
      });
      await new Promise((r) => setTimeout(r, 300)); // let connector fill + panel settle
    });
  },
};

const GERMAN_PANELS = [
  panelHtml('Konto', 'Angemeldet als ionut@example.com.'),
  panelHtml('Versand (optional)', 'Expressversand oder Abholstation wählen — oder mit „Weiter" überspringen.'),
  panelHtml('Zahlung', '„Fertig" schließt die Bestellung ab.'),
];
const ARABIC_PANELS = [
  panelHtml('الحساب', 'تم تسجيل الدخول.'),
  panelHtml('الشحن', 'أدخل عنوان التسليم — يتدفق خط التقدم من اليمين إلى اليسار.'),
  panelHtml('الدفع', 'اضغط إنهاء لإتمام الطلب.'),
];

/* ─── Localization & RTL ──────────────────────────────────── */
export const Localization: Story = {
  name: 'Localization & RTL',
  render: () => html`
    <div style="display: grid; gap: 40px; width: 760px; max-width: 100%;">
      <div>
        <div style=${labelStyle}>German — localized announcements, captions and nav buttons (Zurück / Weiter / Fertig)</div>
        <md-stepper
          active="1"
          label="Bestellvorgang"
          step-word="Schritt" of-word="von" completed-word="abgeschlossen" current-word="aktuell"
          error-word="Fehler" optional-word="Optional"
          back-label="Zurück" next-label="Weiter" finish-label="Fertig"
          @mdStepChange=${(e: Event) => syncPanel(e, GERMAN_PANELS)}
          @mdComplete=${(e: Event) => markComplete(e, '✓ Bestellung abgeschlossen')}
        >
          <md-step label="Konto" completed></md-step>
          <md-step label="Versand" optional></md-step>
          <md-step label="Zahlung"></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(GERMAN_PANELS[1])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
      <div dir="rtl">
        <div style=${labelStyle}>Arabic (RTL) — mirrored layout, connector fill and nav</div>
        <md-stepper
          active="1"
          label="الدفع"
          step-word="خطوة" of-word="من" current-word="الحالية"
          back-label="رجوع" next-label="متابعة" finish-label="إنهاء"
          @mdStepChange=${(e: Event) => syncPanel(e, ARABIC_PANELS)}
          @mdComplete=${(e: Event) => markComplete(e, '✓ اكتمل الطلب')}
        >
          <md-step label="الحساب" completed></md-step>
          <md-step label="الشحن"></md-step>
          <md-step label="الدفع"></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(ARABIC_PANELS[1])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
    </div>
  `,
};

/* ─── Compact / Responsive ────────────────────────────────── */
export const CompactResponsive: Story = {
  name: 'Compact / Responsive',
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: (_args, { globals }) => html`
    <div style=${labelStyle}>Drag the right edge — labels collapse below ~600px (descriptions hide; names stay in aria-label)</div>
    <div style="resize: horizontal; overflow: auto; inline-size: 360px; min-inline-size: 280px; max-inline-size: 100%; padding: 16px; border: 1px dashed var(--md-sys-color-outline, #79747E); border-radius: 12px;">
      <md-stepper
        active="0"
        @mdStepChange=${(e: Event) => syncPanel(e, CHECKOUT_PANELS(globals.locale))}
        @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAllComplete'))}
      >
        <md-step label=${t(globals.locale, 'stepper.accountDetails')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.shippingAddress')} description=${t(globals.locale, 'stepper.descAddressMethod')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.paymentMethod')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.reviewConfirm')}></md-step>
        <div slot="content" style=${panelCard}>${unsafeHTML(CHECKOUT_PANELS(globals.locale)[0])}</div>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
};

/* ─── Dark theme ──────────────────────────────────────────── */
export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface, #141218); padding: 32px; border-radius: 16px;">${story()}</div>
    `,
  ],
  render: (_args, { globals }) => html`
    <div style="width: 700px; max-width: 100%;">
      <md-stepper
        active="1"
        @mdStepChange=${(e: Event) => syncPanel(e, CHECKOUT_PANELS(globals.locale))}
        @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusAllComplete'))}
      >
        <md-step label=${t(globals.locale, 'stepper.cart')} completed></md-step>
        <md-step label=${t(globals.locale, 'stepper.shipping')} description=${t(globals.locale, 'stepper.descAddressMethod')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.payment')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.review')}></md-step>
        <div slot="content" style="${panelCard} background: var(--md-sys-color-surface-container, #211F26); color: var(--md-sys-color-on-surface, #E6E0E9);">${unsafeHTML(CHECKOUT_PANELS(globals.locale)[1])}</div>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
};

const BRAND_PANELS = [
  panelHtml('Discover', 'Every color hook is a public CSS custom property.'),
  panelHtml('Configure', 'Set the --md-step-* vars on the stepper (or any ancestor).'),
  panelHtml('Apply', 'This stepper is re-branded teal with five variables — see the story source.'),
  panelHtml('Done', 'Connector, halo, bubbles and labels all follow the brand color.'),
];

/* ─── Custom CSS / theming ────────────────────────────────── */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand {
        --md-step-active-color: #00897b;
        --md-step-completed-color: #00897b;
        --md-step-connector-filled-color: #00897b;
        --md-step-active-halo-color: #00897b;
        --md-step-label-active-color: #00695c;
      }
    </style>
    <div style="width: 760px; max-width: 100%;">
      <md-stepper
        class="brand"
        active="2"
        @mdStepChange=${(e: Event) => syncPanel(e, BRAND_PANELS)}
        @mdComplete=${(e: Event) => markComplete(e, '✓ Theme applied')}
      >
        <md-step label="Discover" completed></md-step>
        <md-step label="Configure" completed></md-step>
        <md-step label="Apply"></md-step>
        <md-step label="Done"></md-step>
        <div slot="content" style=${panelCard}>${unsafeHTML(BRAND_PANELS[2])}</div>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
};

/* ─── Validation & Async ──────────────────────────────────── */
type VaStepper = HTMLElement & { active: number; nextDisabled: boolean; loading: boolean; __vals?: Record<number, string> };
const VA_FIELDS = (loc?: string) => [t(loc, 'stepper.emailAddress'), t(loc, 'stepper.shippingAddress')];
const inputStyle =
  'width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; font: 400 14px/20px Roboto, sans-serif; ' +
  'border: 1px solid var(--md-sys-color-outline, #79747E); background: var(--md-sys-color-surface, #FEF7FF); color: var(--md-sys-color-on-surface, #1C1B1F);';

/** Render the active step's panel; steps 0-1 are required fields that gate
 *  Continue via `next-disabled`, step 2 is a review summary. */
const vaRender = (stepper: VaStepper, index: number, loc?: string) => {
  const slot = stepper.querySelector<HTMLElement>('[slot="content"]');
  if (!slot) return;
  const vals = stepper.__vals || (stepper.__vals = {});
  if (index < 2) {
    slot.innerHTML =
      `<div style="font: 500 16px/24px Roboto, sans-serif; margin-bottom: 8px;">${VA_FIELDS(loc)[index]}</div>` +
      `<input class="va-input" style="${inputStyle}" placeholder="${t(loc, 'stepper.vaPlaceholder')}" value="${vals[index] || ''}">`;
    const input = slot.querySelector<HTMLInputElement>('.va-input')!;
    const sync = () => { vals[index] = input.value; stepper.nextDisabled = !input.value.trim(); };
    input.addEventListener('input', sync);
    sync();
  } else {
    slot.innerHTML =
      `<div style="font: 500 16px/24px Roboto, sans-serif; margin-bottom: 4px;">${t(loc, 'stepper.review')}</div>` +
      `<div style="font: 400 14px/20px Roboto, sans-serif; color: var(--md-sys-color-on-surface-variant, #49454F);">` +
      `${t(loc, 'stepper.email')}: ${vals[0] || '-'}<br>${t(loc, 'stepper.address')}: ${vals[1] || '-'}<br>${t(loc, 'stepper.vaReviewNote')}</div>`;
    stepper.nextDisabled = false;
  }
};

export const ValidationAndAsync: Story = {
  name: 'Validation & Async',
  parameters: {
    docs: {
      source: { language: 'html' },
      description: {
        story:
          'The two hooks a real wizard needs. **`next-disabled`** gates the built-in Continue on ' +
          "the current step's validity (here the field must be non-empty) - declarative, no event " +
          'wiring. **`mdBeforeChange`** (cancelable) + **`loading`** handle async: leaving Address ' +
          '`preventDefault()`s, shows the spinner while a fake server check runs, then commits by ' +
          'setting `active`. Finish submits async the same way via `mdComplete`. `loading` also ' +
          'disables Back, preventing double-submit.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div data-va style="width: 640px; max-width: 100%;">
      <div style=${labelStyle}>Continue is disabled until the field is filled; leaving "Address" and pressing Finish run async (spinner)</div>
      <md-stepper
        id="va-stepper"
        active="0"
        next-disabled
        @mdStepChange=${(e: CustomEvent<{ index: number }>) => vaRender(e.currentTarget as VaStepper, e.detail.index, globals.locale)}
        @mdBeforeChange=${(e: CustomEvent<{ index: number; previous: number }>) => {
          const sp = e.currentTarget as VaStepper;
          if (e.detail.previous === 1 && e.detail.index === 2) {
            e.preventDefault(); // async "verify address" before advancing
            sp.loading = true;
            window.setTimeout(() => { sp.loading = false; sp.active = 2; }, 900);
          }
        }}
        @mdComplete=${(e: Event) => {
          const sp = e.currentTarget as VaStepper;
          const status = sp.parentElement?.querySelector<HTMLElement>('.flow-status');
          sp.loading = true;
          if (status) status.textContent = t(globals.locale, 'stepper.statusPlacingOrder');
          window.setTimeout(() => { sp.loading = false; if (status) status.textContent = t(globals.locale, 'stepper.statusOrderPlaced'); }, 900);
        }}
      >
        <md-step label=${t(globals.locale, 'stepper.email')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.address')}></md-step>
        <md-step label=${t(globals.locale, 'stepper.review')}></md-step>
        <div slot="content" style=${panelCard}></div>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const stepper = canvasElement.querySelector('md-stepper') as VaStepper | null;
    if (stepper) vaRender(stepper, stepper.active ?? 0);
  },
};

/* ─── Mobile variant ──────────────────────────────────────── */
export const Mobile: Story = {
  name: 'Mobile (compact bar)',
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story:
          '`variant="mobile"` renders a compact MUI-style bar (Back · progress · Continue/Finish) ' +
          'for narrow screens. Progress is dots for `indicator="dot"`, else a "Step N of M" caption. ' +
          "The active step's panel goes in the `content` slot.",
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: grid; gap: 32px; width: 360px; max-width: 100%;">
      <div>
        <div style=${labelStyle}>Dots progress</div>
        <md-stepper
          variant="mobile"
          indicator="dot"
          active="0"
          @mdStepChange=${(e: Event) => syncPanel(e, ONBOARDING_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusOnboardingFinished'))}
        >
          <md-step label=${t(globals.locale, 'stepper.welcome')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.profile')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.preferences')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.done')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(ONBOARDING_PANELS(globals.locale)[0])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
      <div>
        <div style=${labelStyle}>Numbered progress ("Step N of M")</div>
        <md-stepper
          variant="mobile"
          active="0"
          @mdStepChange=${(e: Event) => syncPanel(e, CHECKOUT_PANELS(globals.locale))}
          @mdComplete=${(e: Event) => markComplete(e, t(globals.locale, 'stepper.statusOrderPlaced'))}
        >
          <md-step label=${t(globals.locale, 'stepper.cart')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.shipping')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.payment')}></md-step>
          <md-step label=${t(globals.locale, 'stepper.review')}></md-step>
          <div slot="content" style=${panelCard}>${unsafeHTML(CHECKOUT_PANELS(globals.locale)[0])}</div>
        </md-stepper>
        <p class="flow-status" style=${statusStyle}></p>
      </div>
    </div>
  `,
  /** The compact mobile bar (Back · dots · Continue) drives navigation and its
   *  progress dots track the active / done steps. */
  play: async ({ canvasElement, step }) => {
    const stepper = await getStepper(canvasElement); // first bar = dot indicator
    const steps = stepsOf(stepper);

    await step('Mobile dot bar renders progress dots and advances on Continue', async () => {
      expect(stepper.active).toBe(0);
      const bar = stepper.shadowRoot!.querySelector('.md-stepper__mobile') as HTMLElement;
      expect(bar).toBeTruthy(); // compact mobile bar rendered (replaces the step row)
      const dots = bar.querySelectorAll('.md-stepper__mobile-dot');
      expect(dots.length).toBe(steps.length); // one dot per step
      expect(dots[0].classList.contains('is-active')).toBe(true);

      const nextBtn = Array.from(bar.querySelectorAll('md-button'))[1] as HTMLElement;
      nextBtn.click(); // Continue → next()

      await waitFor(() => expect(stepper.active).toBe(1));
      await waitFor(() => {
        const d = stepper.shadowRoot!.querySelectorAll('.md-stepper__mobile-dot');
        expect(d[1].classList.contains('is-active')).toBe(true); // active dot advanced
        expect(d[0].classList.contains('is-done')).toBe(true); // left step marked done
      });
    });

    await step('Mobile Back steps back and returns the active dot to the first step', async () => {
      const bar = stepper.shadowRoot!.querySelector('.md-stepper__mobile') as HTMLElement;
      const backBtn = Array.from(bar.querySelectorAll('md-button'))[0] as HTMLElement;

      backBtn.click(); // Back → handleFooterBack → prev()

      await waitFor(() => expect(stepper.active).toBe(0));
      await waitFor(() => {
        const d = stepper.shadowRoot!.querySelectorAll('.md-stepper__mobile-dot');
        expect(d[0].classList.contains('is-active')).toBe(true); // back on the first dot
      });
      await new Promise((r) => setTimeout(r, 300)); // settle
    });

    await step('Numbered mobile bar shows a "Step N of M" caption that tracks the active step', async () => {
      const numbered = Array.from(canvasElement.querySelectorAll('md-stepper'))[1] as StepperEl;
      await waitFor(() => expect(numbered.classList.contains('hydrated')).toBe(true));
      await waitFor(() => {
        const ss = Array.from(numbered.querySelectorAll('md-step'));
        expect(ss.length).toBeGreaterThan(0);
        expect(ss.every((s) => s.classList.contains('hydrated'))).toBe(true);
      });

      const bar = numbered.shadowRoot!.querySelector('.md-stepper__mobile') as HTMLElement;
      const caption = bar.querySelector('.md-stepper__mobile-text') as HTMLElement;
      expect(caption).toBeTruthy(); // numbered indicator → caption, not progress dots
      expect(caption.textContent).toContain('Step 1 of 4');

      const nextBtn = Array.from(bar.querySelectorAll('md-button'))[1] as HTMLElement;
      nextBtn.click(); // Continue → next()

      await waitFor(() => expect(numbered.active).toBe(1));
      await waitFor(() => {
        const c = numbered.shadowRoot!.querySelector('.md-stepper__mobile-text') as HTMLElement;
        expect(c.textContent).toContain('Step 2 of 4'); // caption recomputes for the new active step
      });
      await new Promise((r) => setTimeout(r, 300)); // settle
    });

    // Reset both bars to their first-render resting state so the visual baseline
    // captures the clean render (both at step 0, no dots done, "Step 1 of 4",
    // Cart panel) — not the post-play state (numbered bar advanced to step 2).
    await step('Reset both bars to the resting first-render state for a clean visual baseline', async () => {
      const numbered = Array.from(canvasElement.querySelectorAll('md-stepper'))[1] as StepperEl;
      stepper.active = 0; // dot bar back to the first step (no-op if already there)
      numbered.active = 0; // numbered bar back → mdStepChange re-syncs panel + caption
      await waitFor(() => {
        expect(stepper.active).toBe(0);
        expect(numbered.active).toBe(0);
      });
      stepsOf(stepper).forEach((s) => (s.completed = false)); // clear "done" dots
      stepsOf(numbered).forEach((s) => (s.completed = false));
      (document.activeElement as HTMLElement)?.blur();
      await waitFor(() => {
        const c = numbered.shadowRoot!.querySelector('.md-stepper__mobile-text') as HTMLElement;
        expect(c.textContent).toContain('Step 1 of 4'); // caption back to the first step
        expect(panelText(numbered)).toContain('Cart'); // numbered panel back to Cart
      });
      await new Promise((r) => setTimeout(r, 300)); // let the bars settle
    });
  },
};

/* ─── Lazy content ────────────────────────────────────────── */
export const LazyContent: Story = {
  name: 'Lazy content (vertical)',
  parameters: {
    docs: {
      description: {
        story:
          'With `lazy`, only the **active** step\'s content panel is mounted; inactive panels are ' +
          'removed from layout and the a11y tree (no collapse animation). Good for wizards with ' +
          'heavy per-step content. Open the DOM inspector: only one `.md-step__content` exists at a time.',
      },
    },
  },
  render: () => html`
    <div style="width: 520px; max-width: 100%;">
      <div style=${labelStyle}>Only the active step's panel is in the DOM</div>
      <md-stepper orientation="vertical" active="0" lazy @mdComplete=${(e: Event) => markComplete(e, '✓ Done')}>
        <md-step label="Account" description="Your details">
          <p style=${panel}>A heavy form would mount only when this step is active.</p>
        </md-step>
        <md-step label="Shipping" description="Where to deliver">
          <p style=${panel}>Navigate down — the previous panel is removed from the DOM entirely.</p>
        </md-step>
        <md-step label="Payment">
          <p style=${panel}>Each panel enters with a fade; there is no collapse (it is unmounted).</p>
        </md-step>
        <md-step label="Review">
          <p style=${panel}>Press Finish to complete.</p>
        </md-step>
      </md-stepper>
      <p class="flow-status" style=${statusStyle}></p>
    </div>
  `,
};
