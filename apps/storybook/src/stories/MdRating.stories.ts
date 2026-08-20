import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing helpers for play(): testing-library queries can't cross
 *  shadow roots, so interactions address the real internals directly. */
type RatingEl = HTMLElement & { value: number; max: number };
const getRating = async (canvasElement: HTMLElement): Promise<RatingEl> => {
  const rating = canvasElement.querySelector('md-rating') as RatingEl;
  await waitFor(() => expect(rating.classList.contains('hydrated')).toBe(true));
  return rating;
};
const sliderOf = (rating: RatingEl) =>
  rating.shadowRoot!.querySelector('.md-rating__items') as HTMLElement;
const itemAt = (rating: RatingEl, i: number) =>
  rating.shadowRoot!.querySelectorAll('.md-rating__item')[i] as HTMLElement;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }));

const meta: Meta = {
  title: 'Selection/Rating',
  component: 'md-rating',
  tags: ['autodocs'],
  parameters: { docs: { source: { language: 'html' } } },
  argTypes: {
    value: { control: { type: 'number', min: 0, max: 10, step: 0.5 } },
    max: { control: { type: 'number', min: 1, max: 12 } },
    precision: { control: { type: 'select' }, options: [1, 0.5] },
    size: { control: { type: 'select' }, options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    readonly: { control: 'boolean' },
    disabled: { control: 'boolean' },
    softDisabled: { control: 'boolean' },
    icon: { control: 'text' },
    emptyIcon: { control: 'text' },
    outlineEmpty: { control: 'boolean' },
    showValueLabel: { control: 'boolean' },
    hover: { control: { type: 'select' }, options: ['preview', 'off'] },
  },
  args: {
    value: 3,
    max: 5,
    precision: 1,
    size: 'md',
    readonly: false,
    disabled: false,
    softDisabled: false,
    icon: 'star',
    emptyIcon: 'star',
    outlineEmpty: true,
    showValueLabel: false,
    hover: 'preview',
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args) => html`
    <md-rating
      value=${args.value}
      max=${args.max}
      precision=${args.precision}
      size=${args.size}
      ?readonly=${args.readonly}
      ?disabled=${args.disabled}
      ?soft-disabled=${args.softDisabled}
      icon=${args.icon}
      empty-icon=${args.emptyIcon}
      ?outline-empty=${args.outlineEmpty}
      ?show-value-label=${args.showValueLabel}
      hover=${args.hover}
    ></md-rating>
  `,
  /** Pointer + keyboard slider flow, scripted (see the Interactions panel). */
  play: async ({ canvasElement, step }) => {
    const rating = await getRating(canvasElement);

    await step('Clicking the 3rd star toggles it: re-click clears, next click selects 3', async () => {
      expect(rating.shadowRoot!.querySelectorAll('.md-rating__item').length).toBe(5);
      const changes: number[] = [];
      const onChange = (e: Event) => changes.push((e as CustomEvent<number>).detail);
      rating.addEventListener('mdChange', onChange);
      // Default args start at value=3, so clicking the 3rd star re-clicks the
      // current value → clears to defaultValue (0)…
      itemAt(rating, 2).click();
      await waitFor(() => expect(rating.value).toBe(0));
      // …and clicking it again selects 3.
      itemAt(rating, 2).click();
      await waitFor(() => expect(rating.value).toBe(3));
      rating.removeEventListener('mdChange', onChange);
      expect(changes).toEqual([0, 3]);
    });

    await step('The slider role element takes real focus', async () => {
      expect(sliderOf(rating).getAttribute('role')).toBe('slider');
      sliderOf(rating).focus();
      await waitFor(() => expect(rating.shadowRoot!.activeElement).toBe(sliderOf(rating)));
    });

    await step('ArrowRight increments to 4 (aria-valuenow follows)', async () => {
      key(sliderOf(rating), 'ArrowRight');
      await waitFor(() => expect(rating.value).toBe(4));
      await waitFor(() => expect(sliderOf(rating).getAttribute('aria-valuenow')).toBe('4'));
    });

    await step('Home clears to 0', async () => {
      key(sliderOf(rating), 'Home');
      await waitFor(() => expect(rating.value).toBe(0));
      await waitFor(() => expect(sliderOf(rating).getAttribute('aria-valuenow')).toBe('0'));
    });

    await step('Arrow, End and digit keys move the value; non-slider keys are ignored', async () => {
      // value is 0 here (previous step). Walk it up and down with arrows.
      key(sliderOf(rating), 'ArrowUp');
      await waitFor(() => expect(rating.value).toBe(1));
      key(sliderOf(rating), 'ArrowUp');
      await waitFor(() => expect(rating.value).toBe(2));
      key(sliderOf(rating), 'ArrowLeft');
      await waitFor(() => expect(rating.value).toBe(1));
      key(sliderOf(rating), 'ArrowDown');
      await waitFor(() => expect(rating.value).toBe(0));
      // End jumps to max.
      key(sliderOf(rating), 'End');
      await waitFor(() => expect(rating.value).toBe(5));
      await waitFor(() => expect(sliderOf(rating).getAttribute('aria-valuenow')).toBe('5'));
      // Typing a digit selects it directly…
      key(sliderOf(rating), '3');
      await waitFor(() => expect(rating.value).toBe(3));
      // …but a digit greater than max is rejected (no change).
      key(sliderOf(rating), '9');
      await waitFor(() => expect(rating.value).toBe(3));
      // A non-slider key (Escape) is left untouched so ancestors can handle it.
      key(sliderOf(rating), 'Escape');
      await waitFor(() => expect(rating.value).toBe(3));
    });

    await step('focusRating() programmatically focuses the slider', async () => {
      sliderOf(rating).blur();
      await waitFor(() => expect(rating.shadowRoot!.activeElement).toBe(null));
      await (rating as unknown as { focusRating(): Promise<void> }).focusRating();
      await waitFor(() => expect(rating.shadowRoot!.activeElement).toBe(sliderOf(rating)));
    });

    await step('Pressing an item starts the clipped ripple animation', async () => {
      const item = itemAt(rating, 1);
      const rect = item.getBoundingClientRect();
      const ripple = item.querySelector('.md-rating__icon--ripple') as HTMLElement;
      item.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(ripple.getAnimations().length).toBeGreaterThan(0));
    });

    await step('Shrinking max re-clamps the value into the announced range', async () => {
      rating.value = 5;
      await waitFor(() => expect(rating.value).toBe(5));
      rating.max = 3;
      await waitFor(() => expect(rating.value).toBe(3));
      await waitFor(() => expect(sliderOf(rating).getAttribute('aria-valuemax')).toBe('3'));
      await waitFor(() => expect(sliderOf(rating).getAttribute('aria-valuenow')).toBe('3'));
    });

    await step('A non-numeric value is coerced back to 0', async () => {
      rating.value = Number.NaN;
      await waitFor(() => expect(rating.value).toBe(0));
    });

    await step('Reset to the initial resting render (visual baseline)', async () => {
      // The interactions above left value=0, max=3 and the slider focused; restore
      // the story's initial args (value=3, max=5) and drop focus so the screenshot
      // matches a fresh render.
      rating.max = 5;
      rating.value = 3;
      sliderOf(rating).blur();
      await waitFor(() => {
        expect(rating.max).toBe(5);
        expect(rating.value).toBe(3);
        expect(rating.shadowRoot!.activeElement).toBe(null);
      });
    });
  },
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; gap:24px; align-items:center; flex-wrap:wrap;">
      <md-rating value="3" size="xs"></md-rating>
      <md-rating value="3" size="sm"></md-rating>
      <md-rating value="3" size="md"></md-rating>
      <md-rating value="3" size="lg"></md-rating>
      <md-rating value="3" size="xl"></md-rating>
    </div>
  `,
};

export const Precision: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:16px;">
      <md-rating value="3" precision="1" show-value-label></md-rating>
      <md-rating value="3.5" precision="0.5" show-value-label></md-rating>
    </div>
  `,
};

export const States: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:12px;">
      <md-rating value="4"></md-rating>
      <md-rating value="4" readonly></md-rating>
      <md-rating value="4" disabled></md-rating>
      <md-rating value="4" soft-disabled></md-rating>
    </div>
  `,
  /** Non-interactive modes (readonly / disabled / soft-disabled) swallow pointer
   *  and keyboard input while still exposing the correct ARIA surface. */
  play: async ({ canvasElement, step }) => {
    const ratings = Array.from(canvasElement.querySelectorAll('md-rating')) as RatingEl[];
    for (const r of ratings) {
      await waitFor(() => expect(r.classList.contains('hydrated')).toBe(true));
    }
    const [, readonlyR, disabledR, softR] = ratings;

    await step('Readonly renders as role="img" and ignores clicks + keys', async () => {
      expect(sliderOf(readonlyR).getAttribute('role')).toBe('img');
      // Clicking star 1 would drop an interactive rating to 1; the guard keeps 4.
      itemAt(readonlyR, 0).click();
      expect(readonlyR.value).toBe(4);
      key(sliderOf(readonlyR), 'ArrowLeft');
      expect(readonlyR.value).toBe(4);
    });

    await step('Disabled stays role="slider" but aria-disabled and inert', async () => {
      const slider = sliderOf(disabledR);
      expect(slider.getAttribute('role')).toBe('slider');
      expect(slider.getAttribute('aria-disabled')).toBe('true');
      expect(slider.getAttribute('tabindex')).toBe('-1');
      itemAt(disabledR, 0).click();
      expect(disabledR.value).toBe(4);
      key(slider, 'End');
      expect(disabledR.value).toBe(4);
    });

    await step('Soft-disabled remains focusable yet ignores keys', async () => {
      const slider = sliderOf(softR);
      expect(slider.getAttribute('aria-disabled')).toBe('true');
      // Soft-disabled keeps tabindex 0 for discoverability, unlike hard-disabled.
      expect(slider.getAttribute('tabindex')).toBe('0');
      slider.focus();
      await waitFor(() => expect(softR.shadowRoot!.activeElement).toBe(slider));
      key(slider, 'ArrowLeft');
      expect(softR.value).toBe(4);
    });

    await step('Reset to the initial resting render (visual baseline)', async () => {
      // The soft-disabled step left its slider focused; drop focus so the
      // screenshot matches a fresh render (all values were unchanged at 4).
      sliderOf(softR).blur();
      await waitFor(() => expect(softR.shadowRoot!.activeElement).toBe(null));
    });
  },
};

export const WithValueLabel: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:12px;">
      <md-rating value="4" show-value-label></md-rating>
      <md-rating value="2.5" precision="0.5" show-value-label></md-rating>
    </div>
  `,
};

export const CustomIcon: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:12px;">
      <md-rating value="3" icon="favorite" empty-icon="favorite"></md-rating>
      <md-rating value="3" icon="bolt" empty-icon="bolt"></md-rating>
      <md-rating value="3" icon="local_fire_department" empty-icon="local_fire_department"></md-rating>
    </div>
  `,
};

export const HoverOff: Story = {
  render: () => html`<md-rating value="3" hover="off"></md-rating>`,
  /** With hover="off" pointer movement emits no preview, but clicks still commit. */
  play: async ({ canvasElement, step }) => {
    const rating = await getRating(canvasElement);

    await step('Pointer movement emits no mdHover when hover is off', async () => {
      const hovers: Array<number | null> = [];
      const onHover = (e: Event) => hovers.push((e as CustomEvent<number | null>).detail);
      rating.addEventListener('mdHover', onHover);
      const item = itemAt(rating, 0);
      const rect = item.getBoundingClientRect();
      // EventEmitter.emit dispatches synchronously, so if a preview were going to
      // fire it would already be recorded by the time dispatchEvent returns.
      item.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + rect.width * 0.8,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      expect(hovers).toHaveLength(0);
      rating.removeEventListener('mdHover', onHover);
    });

    await step('Clicking still commits the value even with hover off', async () => {
      const changes: number[] = [];
      const onChange = (e: Event) => changes.push((e as CustomEvent<number>).detail);
      rating.addEventListener('mdChange', onChange);
      // value starts at 3; selecting the 5th star commits 5 (not a toggle-clear).
      itemAt(rating, 4).click();
      await waitFor(() => expect(rating.value).toBe(5));
      expect(changes.at(-1)).toBe(5);
      rating.removeEventListener('mdChange', onChange);
    });

    await step('Reset to the initial resting render (visual baseline)', async () => {
      // The click above committed value=5; restore the story's initial value=3
      // (nothing was focused or hovered) so the screenshot matches a fresh render.
      rating.value = 3;
      await waitFor(() => expect(rating.value).toBe(3));
    });
  },
};

export const FormParticipation: Story = {
  render: (_args, { globals }) => html`
    <form @submit=${(e: SubmitEvent) => { e.preventDefault(); alert([...new FormData(e.target as HTMLFormElement).entries()].map(([k, v]) => `${k}=${v}`).join(', ')); }}>
      <md-rating name="quality" value="0"></md-rating>
      <button type="submit" style="margin-inline-start: 16px;">${t(globals.locale, 'submit')}</button>
    </form>
  `,
  play: async ({ canvasElement, step }) => {
    const rating = await getRating(canvasElement);
    const form = canvasElement.querySelector('form') as HTMLFormElement;

    await step('Resetting the owning form restores the initial rating', async () => {
      // Initial value at load is 0; pick the 4th star, then reset the form.
      itemAt(rating, 3).click();
      await waitFor(() => expect(rating.value).toBe(4));
      form.reset();
      await waitFor(() => expect(rating.value).toBe(0));
    });
  },
};

export const HalfPrecisionInteractions: Story = {
  render: () => html`
    <md-rating value="0" precision="0.5" max="5" hover="preview" show-value-label></md-rating>
  `,
  play: async ({ canvasElement, step }) => {
    const rating = await getRating(canvasElement);
    const slider = sliderOf(rating);

    await step('Pointer position within an item previews a half vs full step', async () => {
      const item = itemAt(rating, 0);
      const rect = item.getBoundingClientRect();
      const hovers: Array<number | null> = [];
      const onHover = (e: Event) => hovers.push((e as CustomEvent<number | null>).detail);
      rating.addEventListener('mdHover', onHover);
      // Left quarter of the first item → half a star.
      item.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + rect.width * 0.25,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(hovers.at(-1)).toBe(0.5));
      // Right side of the first item → a full star.
      item.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + rect.width * 0.8,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(hovers.at(-1)).toBe(1));
      rating.removeEventListener('mdHover', onHover);
    });

    await step('Leaving the control clears the hover preview', async () => {
      const hovers: Array<number | null> = [];
      const onHover = (e: Event) => hovers.push((e as CustomEvent<number | null>).detail);
      rating.addEventListener('mdHover', onHover);
      slider.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true, composed: true }));
      await waitFor(() => expect(hovers.at(-1)).toBe(null));
      rating.removeEventListener('mdHover', onHover);
    });

    await step('Clicking the left half of an item selects the half-step value', async () => {
      const item = itemAt(rating, 2);
      const rect = item.getBoundingClientRect();
      const changes: number[] = [];
      const onChange = (e: Event) => changes.push((e as CustomEvent<number>).detail);
      rating.addEventListener('mdChange', onChange);
      item.dispatchEvent(
        new MouseEvent('click', {
          clientX: rect.left + rect.width * 0.25,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(rating.value).toBe(2.5));
      expect(changes.at(-1)).toBe(2.5);
      rating.removeEventListener('mdChange', onChange);
    });

    await step('Blurring while hovering clears the preview', async () => {
      const hovers: Array<number | null> = [];
      const onHover = (e: Event) => hovers.push((e as CustomEvent<number | null>).detail);
      rating.addEventListener('mdHover', onHover);
      slider.focus();
      const item = itemAt(rating, 1);
      const rect = item.getBoundingClientRect();
      item.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + rect.width * 0.8,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(hovers.at(-1)).toBe(2));
      slider.blur();
      await waitFor(() => expect(hovers.at(-1)).toBe(null));
      rating.removeEventListener('mdHover', onHover);
    });
  },
};

export const LabelledByHost: Story = {
  render: () => html`
    <span id="rt-ext-label">Product quality</span>
    <md-rating value="3" aria-labelledby="rt-ext-label"></md-rating>
  `,
  play: async ({ canvasElement }) => {
    const rating = await getRating(canvasElement);
    // The focusable slider lives in the shadow root; the host aria-labelledby
    // is resolved and forwarded onto it as the accessible name.
    await waitFor(() => expect(sliderOf(rating).getAttribute('aria-label')).toBe('Product quality'));
  },
};

export const AssociatedLabel: Story = {
  render: () => html`
    <label for="rt-labelled">Overall rating</label>
    <md-rating id="rt-labelled" value="3"></md-rating>
  `,
  play: async ({ canvasElement }) => {
    const rating = await getRating(canvasElement);
    // Nudge a re-render so the <label> association (ElementInternals.labels) is
    // resolved into the slider's accessible name.
    rating.max = 6;
    await waitFor(() => expect(sliderOf(rating).getAttribute('aria-label')).toBe('Overall rating'));
  },
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <md-rating value="2.5" precision="0.5" show-value-label></md-rating>
    </div>
  `,
  /** In RTL the horizontal axis is mirrored for both keyboard and pointer. */
  play: async ({ canvasElement, step }) => {
    const rating = await getRating(canvasElement);
    const slider = sliderOf(rating);

    await step('RTL keyboard mirrors ArrowRight/ArrowLeft', async () => {
      // value=2.5, precision 0.5. In RTL, ArrowRight moves toward the low end.
      key(slider, 'ArrowRight');
      await waitFor(() => expect(rating.value).toBe(2));
      await waitFor(() => expect(slider.getAttribute('aria-valuenow')).toBe('2'));
      key(slider, 'ArrowLeft');
      await waitFor(() => expect(rating.value).toBe(2.5));
      await waitFor(() => expect(slider.getAttribute('aria-valuenow')).toBe('2.5'));
    });

    await step('RTL pointer mirrors the half/full split within an item', async () => {
      const item = itemAt(rating, 0);
      const rect = item.getBoundingClientRect();
      const hovers: Array<number | null> = [];
      const onHover = (e: Event) => hovers.push((e as CustomEvent<number | null>).detail);
      rating.addEventListener('mdHover', onHover);
      // Left quarter in RTL maps to the trailing edge → a FULL star (mirror of LTR).
      item.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + rect.width * 0.25,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(hovers.at(-1)).toBe(1));
      // Right side in RTL maps to the leading edge → a HALF star.
      item.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: rect.left + rect.width * 0.8,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          composed: true,
        }),
      );
      await waitFor(() => expect(hovers.at(-1)).toBe(0.5));
      rating.removeEventListener('mdHover', onHover);
    });
  },
};

export const DarkTheme: Story = {
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
  render: () => html`<md-rating value="3.5" precision="0.5" show-value-label></md-rating>`,
};

export const CustomCSS: Story = {
  render: () => html`
    <style>
      .lava { --md-rating-active-color: #FF5722; --md-rating-pop-scale: 1.25; }
      .glow { --md-rating-state-layer-color: gold; --md-rating-active-color: gold; }
      .dense { --md-rating-item-gap: 0px; --md-rating-active-color: var(--md-sys-color-primary); }
    </style>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <md-rating class="lava" value="3"></md-rating>
      <md-rating class="glow" value="4"></md-rating>
      <md-rating class="dense" value="5"></md-rating>
    </div>
  `,
};
