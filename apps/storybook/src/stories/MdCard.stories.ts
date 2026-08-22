import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/** Shadow-piercing / hydration helpers for play(): testing-library can't cross
 *  shadow roots, and roving/reflected state (role, tabindex, aria-*) only lands
 *  after hydration + the next render flush. `cardsOf` awaits `.hydrated` first. */
type CardEl = HTMLElement & { interactive: boolean };
const cardsOf = async (canvasElement: HTMLElement): Promise<CardEl[]> => {
  const cards = [...canvasElement.querySelectorAll('md-card')] as CardEl[];
  await waitFor(() => expect(cards.length).toBeGreaterThan(0));
  await waitFor(() =>
    expect(cards.every((c) => c.classList.contains('hydrated'))).toBe(true),
  );
  return cards;
};
const key = (target: Element, k: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: k, bubbles: true, composed: true }),
  );
// Synthesises the pointer gesture the drag machinery listens for. Same
// dispatch primitive as `key`, just a PointerEvent. Note: a synthetic pointer
// has no *active* browser pointer, so `el.setPointerCapture(pointerId)` (called
// on pointerdown) throws NotFoundError — play() stubs it to a no-op first.
const pointer = (
  target: Element,
  type: string,
  clientX: number,
  clientY: number,
  button = 0,
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: 1,
      button,
      clientX,
      clientY,
      bubbles: true,
      composed: true,
    }),
  );

const cardContent = (title: string, body: string) => html`
  <div style="padding: 16px;">
    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 500;">${title}</h3>
    <p style="margin: 0; font-size: 14px;">${body}</p>
  </div>
`;

const imageCardContent = (title: string, body: string) => html`
  <img
    src="https://picsum.photos/seed/md3card/400/200"
    alt="Sample"
    style="width: 100%; height: 200px; object-fit: cover; display: block;"
  />
  <div style="padding: 16px;">
    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 500;">${title}</h3>
    <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">${body}</p>
  </div>
`;

// Same two clips already used in the List "video leading" story so reviewers
// see consistent media across the design-system docs and the assets stay
// cached after the first paint.
const VIDEO_BBB = 'https://www.w3schools.com/html/mov_bbb.mp4';
const VIDEO_SINTEL = 'https://media.w3.org/2010/05/sintel/trailer.mp4';

const videoCardContent = (
  src: string,
  posterSeed: string,
  title: string,
  body: string,
) => html`
  <video
    muted
    loop
    autoplay
    playsinline
    preload="auto"
    poster="https://picsum.photos/seed/${posterSeed}/400/225"
    aria-label=${title}
    style="width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: #000;"
  >
    <source src=${src} type="video/mp4" />
  </video>
  <div style="padding: 16px;">
    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 500;">${title}</h3>
    <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">${body}</p>
  </div>
`;

const meta: Meta = {
  title: 'Containment/Card',
  component: 'md-card',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['elevated', 'filled', 'outlined'],
      description: 'Visual style variant',
    },
    interactive: {
      control: 'boolean',
      description: 'Whether the card is clickable with state layers',
    },
    dragEnabled: {
      control: 'boolean',
      description: 'Enables pointer-event-based drag on the card',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the card (interactive only)',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Stretch to 100% of the parent inline-size',
    },
    fullHeight: {
      control: 'boolean',
      description: 'Stretch to 100% of the parent block-size',
    },
  },
  args: {
    variant: 'elevated',
    interactive: false,
    dragEnabled: false,
    disabled: false,
    fullWidth: false,
    fullHeight: false,
  },
};
export default meta;
type Story = StoryObj;

export const Playground: Story = {
  render: (args, { globals }) => html`
    <md-card
      variant=${args.variant}
      ?interactive=${args.interactive}
      ?drag-enabled=${args.dragEnabled}
      ?disabled=${args.disabled}
      ?full-width=${args.fullWidth}
      ?full-height=${args.fullHeight}
      style="max-width: 360px;"
    >
      ${cardContent(t(globals.locale, 'card.playground-title'), t(globals.locale, 'card.playground-body'))}
    </md-card>
  `,
};

export const AllVariants: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card variant="elevated" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.elevated-title'), t(globals.locale, 'card.elevated-body'))}
      </md-card>
      <md-card variant="filled" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.filled-title'), t(globals.locale, 'card.filled-body'))}
      </md-card>
      <md-card variant="outlined" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.outlined-title'), t(globals.locale, 'card.outlined-body'))}
      </md-card>
    </div>
  `,
};

export const InteractiveCards: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card variant="elevated" interactive style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.elevated-interactive-title'), t(globals.locale, 'card.interactive-body'))}
      </md-card>
      <md-card variant="filled" interactive style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.filled-interactive-title'), t(globals.locale, 'card.interactive-body'))}
      </md-card>
      <md-card variant="outlined" interactive style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.outlined-interactive-title'), t(globals.locale, 'card.interactive-body'))}
      </md-card>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const cards = await cardsOf(canvasElement);
    expect(cards.length).toBe(3); // elevated, filled, outlined

    await step('Interactive cards expose button semantics', async () => {
      // role/tabindex are produced by the component from `interactive` — they are
      // never written into the story markup, so reading them back proves wiring.
      for (const card of cards) {
        expect(card.getAttribute('role')).toBe('button');
        expect(card.getAttribute('tabindex')).toBe('0');
      }
    });

    await step('Pointer click emits mdClick carrying the underlying MouseEvent', async () => {
      const elevated = cards[0];
      let evt: CustomEvent | undefined;
      elevated.addEventListener('mdClick', (e) => { evt = e as CustomEvent; }, { once: true });
      elevated.click();
      await waitFor(() => expect(evt).toBeTruthy()); // component fired mdClick
      // detail is the real forwarded MouseEvent, not a literal we handed in.
      expect(evt!.detail).toBeInstanceOf(MouseEvent);
      expect((evt!.detail as MouseEvent).type).toBe('click');
    });

    await step('Enter and Space on a focused card also activate it', async () => {
      const filled = cards[1];
      filled.focus();
      expect(document.activeElement).toBe(filled); // tabindex=0 host is focusable
      let count = 0;
      const onClick = () => { count += 1; };
      filled.addEventListener('mdClick', onClick);
      key(filled, 'Enter');
      await waitFor(() => expect(count).toBe(1)); // keyboard → mdClick
      key(filled, ' ');
      await waitFor(() => expect(count).toBe(2)); // Space activates too
      filled.removeEventListener('mdClick', onClick);
    });

    await step('Guard: a non-interactive card drops its role and never emits', async () => {
      const card = cards[2];
      expect(card.getAttribute('role')).toBe('button'); // starts interactive
      let fired = 0;
      card.addEventListener('mdClick', () => { fired += 1; });
      card.interactive = false; // flip it inert — a real transition
      await waitFor(() => expect(card.getAttribute('role')).toBe(null)); // button role removed
      card.click();
      key(card, 'Enter');
      await new Promise((r) => setTimeout(r, 0));
      expect(fired).toBe(0); // neither pointer nor keyboard emits on an inert card
    });

    // Let the ripple/press animations from the activations settle before teardown.
    await new Promise((r) => setTimeout(r, 300));
  },
};

export const WithImage: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card variant="elevated" style="max-width: 360px; overflow: hidden;">
        ${imageCardContent(t(globals.locale, 'card.mountain-title'), t(globals.locale, 'card.mountain-body'))}
      </md-card>
      <md-card variant="filled" interactive style="max-width: 360px; overflow: hidden;">
        ${imageCardContent(t(globals.locale, 'card.image-interactive-title'), t(globals.locale, 'card.image-interactive-body'))}
      </md-card>
      <md-card variant="outlined" style="max-width: 360px; overflow: hidden;">
        ${imageCardContent(t(globals.locale, 'card.image-outlined-title'), t(globals.locale, 'card.image-outlined-body'))}
      </md-card>
    </div>
  `,
};

export const WithVideo: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Card media slot accepts a `<video>` element the same way it accepts `<img>`. ' +
          'Use `muted loop autoplay playsinline preload="auto"` so the clip begins immediately ' +
          'on browsers that gate autoplay behind a muted track, and provide a `poster` so ' +
          'the card never paints an empty black box while the file is buffering. ' +
          'Always set `overflow: hidden` on the host so the video respects the card\u2019s rounded corners. ' +
          'These clips are the same Big Buck Bunny and Sintel trailers already used in the List \u201cvideo leading\u201d story.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card variant="elevated" style="max-width: 360px; overflow: hidden;">
        ${videoCardContent(
          VIDEO_BBB,
          'card-video-bbb',
          'Big Buck Bunny',
          'Open-source short film by the Blender Foundation \u2014 great test asset for media-card layouts.',
        )}
      </md-card>

      <md-card variant="filled" interactive style="max-width: 360px; overflow: hidden;">
        ${videoCardContent(
          VIDEO_SINTEL,
          'card-video-sintel',
          'Sintel \u00b7 Trailer',
          'Interactive card. Click anywhere on the surface to follow the call-to-action.',
        )}
      </md-card>

      <md-card variant="outlined" style="max-width: 360px; overflow: hidden;">
        ${videoCardContent(
          VIDEO_BBB,
          'card-video-bbb-2',
          'Outlined media card',
          'Outlined surfaces still clip media to the corner-medium shape thanks to overflow: hidden.',
        )}
      </md-card>
    </div>

    <h4 style="margin: 32px 0 8px; font-size: 14px; font-weight: 500; color: var(--md-sys-color-on-surface-variant);">
      Rich media card \u2014 overline, headline, supporting text and actions
    </h4>
    <md-card variant="elevated" style="max-width: 420px; overflow: hidden;">
      <div style="position: relative;">
        <video
          muted
          loop
          autoplay
          playsinline
          preload="auto"
          poster="https://picsum.photos/seed/card-video-rich/420/236"
          aria-label="Sintel trailer"
          style="width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: #000;"
        >
          <source src=${VIDEO_SINTEL} type="video/mp4" />
        </video>
        <span
          aria-hidden="true"
          class="material-symbols-outlined"
          style="
            position: absolute;
            inset-block-end: 8px;
            inset-inline-start: 8px;
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 500;
            line-height: 1;
            color: white;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(4px);
            font-family: var(--md-sys-typescale-label-medium-font-family, Roboto, sans-serif);
          "
        >
          0:52
        </span>
      </div>
      <div style="padding: 16px;">
        <p style="margin: 0 0 4px; font-size: 11px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant);">
          ${t(globals.locale, 'card.trailer-overline')}
        </p>
        <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 500;">
          Sintel
        </h3>
        <p style="margin: 0 0 12px; font-size: 14px; line-height: 20px; color: var(--md-sys-color-on-surface-variant);">
          ${t(globals.locale, 'card.sintel-body')}
        </p>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <md-button variant="text">${t(globals.locale, 'save')}</md-button>
          <md-button variant="filled" icon="play_arrow">${t(globals.locale, 'card.play')}</md-button>
        </div>
      </div>
    </md-card>
  `,
};

export const States: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card interactive style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.state-enabled-title'), t(globals.locale, 'card.state-enabled-body'))}
      </md-card>
      <md-card interactive disabled style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.state-disabled-title'), t(globals.locale, 'card.state-disabled-body'))}
      </md-card>
      <md-card interactive soft-disabled style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.state-soft-disabled-title'), t(globals.locale, 'card.state-soft-disabled-body'))}
      </md-card>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl" style="display: flex; gap: 16px; flex-wrap: wrap;">
      <md-card variant="elevated" style="max-width: 300px;">
        ${cardContent('بطاقة مرتفعة', 'هذا نص بديل لاختبار الاتجاه من اليمين لليسار')}
      </md-card>
      <md-card variant="filled" interactive style="max-width: 300px;">
        ${cardContent('بطاقة ممتلئة', 'بطاقة تفاعلية مع دعم RTL')}
      </md-card>
      <md-card variant="outlined" style="max-width: 300px;">
        ${cardContent('بطاقة محددة', 'محتوى RTL داخل بطاقة محددة')}
      </md-card>
    </div>
  `,
};

export const DarkTheme: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card variant="elevated" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.dark-elevated-title'), t(globals.locale, 'card.dark-elevated-body'))}
      </md-card>
      <md-card variant="filled" interactive style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.dark-filled-title'), t(globals.locale, 'card.dark-filled-body'))}
      </md-card>
      <md-card variant="outlined" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.dark-outlined-title'), t(globals.locale, 'card.dark-outlined-body'))}
      </md-card>
    </div>
  `,
  decorators: [
    (story) => html`
      <div data-theme="dark" style="background: var(--md-sys-color-surface); padding: 24px; border-radius: 16px;">
        ${story()}
      </div>
    `,
  ],
};

export const CustomCSS: Story = {
  render: (_args, { globals }) => html`
    <style>
      .brand-card { --md-card-container-color: #6200ee; --md-card-container-shape: 24px; color: white; }
      .danger-card { --md-card-container-color: var(--md-sys-color-error-container); color: var(--md-sys-color-on-error-container); }
      .sharp-card { --md-card-container-shape: 0; }
      .thick-outline { --md-card-outline-width: 3px; --md-card-outline-color: var(--md-sys-color-primary); }
    </style>
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card class="brand-card" style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.brand-title'), t(globals.locale, 'card.brand-body'))}
      </md-card>
      <md-card variant="filled" class="danger-card" style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.danger-title'), t(globals.locale, 'card.danger-body'))}
      </md-card>
      <md-card variant="elevated" class="sharp-card" style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.sharp-title'), t(globals.locale, 'card.sharp-body'))}
      </md-card>
      <md-card variant="outlined" class="thick-outline" style="max-width: 260px;">
        ${cardContent(t(globals.locale, 'card.thick-outline-title'), t(globals.locale, 'card.thick-outline-body'))}
      </md-card>
    </div>
  `,
};

export const CSSParts: Story = {
  render: (_args, { globals }) => html`
    <style>
      .custom-state::part(state-layer) { background-color: var(--md-sys-color-tertiary); }
      .custom-outline::part(outline) { border-width: 2px; border-style: dashed; }
    </style>
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card interactive class="custom-state" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.custom-state-title'), t(globals.locale, 'card.custom-state-body'))}
      </md-card>
      <md-card variant="outlined" class="custom-outline" style="max-width: 300px;">
        ${cardContent(t(globals.locale, 'card.custom-outline-title'), t(globals.locale, 'card.custom-outline-body'))}
      </md-card>
    </div>
  `,
};

export const ComplexContent: Story = {
  render: (_args, { globals }) => html`
    <md-card variant="elevated" style="max-width: 400px;">
      <img
        src="https://picsum.photos/seed/complex/400/180"
        alt="Header image"
        style="width: 100%; height: 180px; object-fit: cover; display: block;"
      />
      <div style="padding: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--md-sys-color-primary-container); display: flex; align-items: center; justify-content: center;">
            <span class="material-symbols-outlined" style="font-size: 20px; color: var(--md-sys-color-on-primary-container);">person</span>
          </div>
          <div>
            <div style="font-weight: 500; font-size: 16px;">${t(globals.locale, 'card.complex-title')}</div>
            <div style="font-size: 12px; opacity: 0.87;">${t(globals.locale, 'card.complex-subtitle')}</div>
          </div>
        </div>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant);">
          ${t(globals.locale, 'card.complex-body')}
        </p>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <md-button variant="outlined">${t(globals.locale, 'cancel')}</md-button>
          <md-button variant="filled">${t(globals.locale, 'card.action')}</md-button>
        </div>
      </div>
    </md-card>
  `,
};

export const Draggable: Story = {
  render: (_args, { globals }) => html`
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: start;">
      <md-card variant="elevated" drag-enabled style="max-width: 280px;">
        ${cardContent(t(globals.locale, 'card.drag-elevated-title'), t(globals.locale, 'card.drag-elevated-body'))}
      </md-card>
      <md-card variant="filled" drag-enabled style="max-width: 280px;">
        ${cardContent(t(globals.locale, 'card.drag-filled-title'), t(globals.locale, 'card.drag-filled-body'))}
      </md-card>
      <md-card variant="outlined" drag-enabled style="max-width: 280px;">
        ${cardContent(t(globals.locale, 'card.drag-outlined-title'), t(globals.locale, 'card.drag-outlined-body'))}
      </md-card>
      <md-card variant="elevated" interactive drag-enabled style="max-width: 280px;">
        ${cardContent(t(globals.locale, 'card.drag-interactive-title'), t(globals.locale, 'card.drag-interactive-body'))}
      </md-card>
    </div>
  `,
  play: async ({ canvasElement, step }) => {
    const cards = await cardsOf(canvasElement);
    expect(cards.length).toBe(4); // elevated, filled, outlined, interactive

    // A synthetic PointerEvent has no matching *active* browser pointer, so the
    // real el.setPointerCapture(pointerId) the component calls on pointerdown
    // throws NotFoundError and aborts the handler before it wires up the
    // move/up listeners. No-op capture on every host so the drag machinery runs.
    for (const c of cards) {
      (c as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
      (c as unknown as { releasePointerCapture: () => void }).releasePointerCapture = () => {};
    }

    await step('Dragging past the 5px threshold emits start/move/end with real deltas', async () => {
      const card = cards[0];
      expect(card.getAttribute('aria-grabbed')).toBe('false'); // reflected idle state

      let startDetail: any;
      let endDetail: any;
      const moves: any[] = [];
      const onStart = (e: Event) => { startDetail = (e as CustomEvent).detail; };
      const onMove = (e: Event) => { moves.push((e as CustomEvent).detail); };
      const onEnd = (e: Event) => { endDetail = (e as CustomEvent).detail; };
      card.addEventListener('mdDragStart', onStart);
      card.addEventListener('mdDragMove', onMove);
      card.addEventListener('mdDragEnd', onEnd);

      pointer(card, 'pointerdown', 100, 100);
      // Below-threshold nudge (|2| + |1| = 3 < 5) must NOT start the drag.
      pointer(card, 'pointermove', 102, 101);
      expect(startDetail).toBeUndefined();
      expect(moves.length).toBe(0);
      expect(card.getAttribute('aria-grabbed')).toBe('false');

      // Cross the threshold: dx = 40, dy = 20.
      pointer(card, 'pointermove', 140, 120);
      await waitFor(() => expect(startDetail).toBeTruthy()); // mdDragStart fired
      // Detail is computed by the component from the real pointer coords + the
      // recorded start point — never handed in by the test.
      expect(startDetail.startX).toBe(100);
      expect(startDetail.startY).toBe(100);
      expect(startDetail.offsetX).toBe(40);
      expect(startDetail.offsetY).toBe(20);
      expect(moves.length).toBeGreaterThan(0); // mdDragMove emitted once past threshold
      expect(card.style.zIndex).toBe('1000'); // lifted above siblings while dragging
      expect(card.style.transform).toBe('translate(40px, 20px)'); // follows the pointer
      await waitFor(() => expect(card.getAttribute('aria-grabbed')).toBe('true')); // dragging state reflected

      // A further move (drag already started) keeps translating + emitting.
      pointer(card, 'pointermove', 160, 130);
      await waitFor(() => expect(card.style.transform).toBe('translate(60px, 30px)'));

      // Release: mdDragEnd fires and the component resets visuals + aria-grabbed.
      pointer(card, 'pointerup', 160, 130);
      await waitFor(() => expect(endDetail).toBeTruthy());
      expect(endDetail.offsetX).toBe(60);
      expect(endDetail.offsetY).toBe(30);
      await waitFor(() => expect(card.getAttribute('aria-grabbed')).toBe('false'));
      expect(card.style.transform).toBe(''); // translate cleared
      expect(card.style.zIndex).toBe(''); // z-index cleared

      card.removeEventListener('mdDragStart', onStart);
      card.removeEventListener('mdDragMove', onMove);
      card.removeEventListener('mdDragEnd', onEnd);
    });

    await step('A tap that never crosses the threshold resets without emitting drag events', async () => {
      const card = cards[2];
      let events = 0;
      const bump = () => { events += 1; };
      card.addEventListener('mdDragStart', bump);
      card.addEventListener('mdDragEnd', bump);
      pointer(card, 'pointerdown', 300, 300);
      pointer(card, 'pointermove', 302, 301); // sub-threshold
      pointer(card, 'pointerup', 302, 301);
      await new Promise((r) => setTimeout(r, 0));
      expect(events).toBe(0); // never crossed threshold → neither start nor end fires
      expect(card.style.transform).toBe(''); // visuals untouched by a tap
      expect(card.getAttribute('aria-grabbed')).toBe('false');
      card.removeEventListener('mdDragStart', bump);
      card.removeEventListener('mdDragEnd', bump);
    });

    await step('pointerdown guards: non-primary button, disabled, and drag-disabled all no-op', async () => {
      const card = cards[1];
      let started = 0;
      const onStart = () => { started += 1; };
      card.addEventListener('mdDragStart', onStart);

      // Secondary button (button !== 0) is ignored by onPointerDown.
      pointer(card, 'pointerdown', 50, 50, 2);
      pointer(card, 'pointermove', 120, 120);
      expect(started).toBe(0);

      // A disabled card ignores even a primary-button pointerdown.
      (card as unknown as { disabled: boolean }).disabled = true;
      pointer(card, 'pointerdown', 60, 60);
      pointer(card, 'pointermove', 130, 130);
      expect(started).toBe(0);
      (card as unknown as { disabled: boolean }).disabled = false;

      // @Watch('dragEnabled'): turning drag off cancels any drag and drops the
      // aria-grabbed reflection; a following pointerdown short-circuits.
      (card as unknown as { dragEnabled: boolean }).dragEnabled = false;
      await waitFor(() => expect(card.getAttribute('aria-grabbed')).toBe(null));
      pointer(card, 'pointerdown', 70, 70);
      pointer(card, 'pointermove', 140, 140);
      expect(started).toBe(0);

      // Re-enabling restores the reflected drag semantics (watcher's else path).
      (card as unknown as { dragEnabled: boolean }).dragEnabled = true;
      await waitFor(() => expect(card.getAttribute('aria-grabbed')).toBe('false'));

      card.removeEventListener('mdDragStart', onStart);
    });

    await step('After a drag the trailing click is suppressed; a disabled card cancels the click', async () => {
      const card = cards[3]; // interactive + drag-enabled
      expect(card.getAttribute('role')).toBe('button'); // interactive, no focusable content

      let clicks = 0;
      const onClick = () => { clicks += 1; };
      card.addEventListener('mdClick', onClick);

      // A real drag so onPointerUp arms suppressClick for the trailing click.
      pointer(card, 'pointerdown', 200, 200);
      pointer(card, 'pointermove', 240, 210); // dx = 40, dy = 10 → past threshold
      pointer(card, 'pointerup', 240, 210);
      card.click(); // synchronous — fires before the rAF clears suppressClick
      expect(clicks).toBe(0); // click swallowed after a drag

      // Once the rAF runs, suppression lifts and the click path emits again.
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      card.click();
      await waitFor(() => expect(clicks).toBe(1)); // mdClick now fires normally

      // Disabled interactive card: handleClick preventDefaults and never emits.
      (card as unknown as { disabled: boolean }).disabled = true;
      await waitFor(() => expect(card.getAttribute('aria-disabled')).toBe('true'));
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
      card.dispatchEvent(evt);
      expect(clicks).toBe(1); // unchanged — disabled blocks the emit
      expect(evt.defaultPrevented).toBe(true); // handleClick called preventDefault
      (card as unknown as { disabled: boolean }).disabled = false;

      card.removeEventListener('mdClick', onClick);
    });

    // Let ripple / press animations settle before teardown.
    await new Promise((r) => setTimeout(r, 300));
  },
};

export const DragAndDrop: Story = {
  render: (_args, { globals }) => html`
    <style>
      .dnd-zone {
        min-height: 100px;
        padding: 16px;
        border-radius: 16px;
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        align-items: flex-start;
        transition: background-color 0.2s, border-color 0.2s;
      }
      .dnd-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--md-sys-color-on-surface-variant, #666);
        margin-bottom: 8px;
      }
      .dnd-source {
        background: color-mix(in srgb, var(--md-sys-color-primary, #6750a4) 8%, transparent);
        border: 2px solid transparent;
      }
      .dnd-target {
        background: color-mix(in srgb, var(--md-sys-color-tertiary, #7d5260) 6%, transparent);
        border: 2px dashed var(--md-sys-color-outline-variant, #cac4d0);
        margin-top: 16px;
      }
      .dnd-target.dnd-ready { border-color: var(--md-sys-color-primary, #6750a4); }
      .dnd-target.dnd-over {
        background: color-mix(in srgb, var(--md-sys-color-primary, #6750a4) 16%, transparent);
        border-color: var(--md-sys-color-primary, #6750a4);
        border-style: solid;
      }
      .dnd-empty {
        color: var(--md-sys-color-on-surface-variant, #aaa);
        font-size: 14px;
        width: 100%;
        text-align: center;
        align-self: center;
        pointer-events: none;
      }
    </style>

    <div class="dnd-label">${t(globals.locale, 'card.dnd-cards-label')}</div>
    <div class="dnd-zone dnd-source" data-zone="source">
      <md-card variant="elevated" drag-enabled style="width: 220px;">
        ${cardContent('Alpha', t(globals.locale, 'card.dnd-alpha-body'))}
      </md-card>
      <md-card variant="filled" drag-enabled style="width: 220px;">
        ${cardContent('Bravo', t(globals.locale, 'card.dnd-bravo-body'))}
      </md-card>
      <md-card variant="outlined" drag-enabled style="width: 220px;">
        ${cardContent('Charlie', t(globals.locale, 'card.dnd-charlie-body'))}
      </md-card>
    </div>

    <div class="dnd-label" style="margin-top: 24px;">${t(globals.locale, 'card.dnd-dropzone-label')}</div>
    <div class="dnd-zone dnd-target" data-zone="target">
      <span class="dnd-empty">${t(globals.locale, 'card.dnd-empty')}</span>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const source = canvasElement.querySelector('[data-zone="source"]') as HTMLElement;
    const target = canvasElement.querySelector('[data-zone="target"]') as HTMLElement;
    const emptyMsg = target.querySelector('.dnd-empty') as HTMLElement;
    const allZones = [source, target];

    const indicator = document.createElement('div');
    Object.assign(indicator.style, {
      width: '3px',
      alignSelf: 'stretch',
      minHeight: '60px',
      borderRadius: '2px',
      background: 'var(--md-sys-color-primary, #6750a4)',
      flexShrink: '0',
    });

    function updateEmpty() {
      emptyMsg.style.display =
        target.querySelector('md-card') || target.contains(indicator) ? 'none' : '';
    }

    function zoneAtPoint(x: number, y: number) {
      for (const z of allZones) {
        const r = z.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return z;
      }
      return null;
    }

    function insertionRef(zone: HTMLElement, x: number, card: HTMLElement) {
      const cards = [...zone.querySelectorAll('md-card')].filter(c => c !== card);
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (x < r.left + r.width / 2) return c;
      }
      return null;
    }

    canvasElement.querySelectorAll<HTMLElement>('md-card[drag-enabled]').forEach((card) => {
      card.addEventListener('mdDragStart', () => {
        target.classList.add('dnd-ready');
      });

      card.addEventListener('mdDragMove', ((e: CustomEvent) => {
        const { clientX, clientY } = e.detail;
        const zone = zoneAtPoint(clientX, clientY);

        if (zone) {
          const ref = insertionRef(zone, clientX, card);
          zone.insertBefore(indicator, ref);
          target.classList.toggle('dnd-over', zone === target);
        } else {
          indicator.remove();
          target.classList.remove('dnd-over');
        }
        updateEmpty();
      }) as EventListener);

      card.addEventListener('mdDragEnd', ((e: CustomEvent) => {
        card.style.transform = '';
        card.style.zIndex = '';

        if (indicator.parentElement) {
          indicator.parentElement.insertBefore(card, indicator);
          indicator.remove();
        }

        target.classList.remove('dnd-ready', 'dnd-over');
        updateEmpty();
      }) as EventListener);
    });
  },
};

export const CardGrid: Story = {
  render: () => html`
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; max-width: 900px;">
      ${[1, 2, 3, 4, 5, 6].map(
        (i) => html`
          <md-card variant=${i % 3 === 0 ? 'outlined' : i % 3 === 1 ? 'elevated' : 'filled'} interactive>
            <div style="padding: 16px;">
              <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 500;">Card ${i}</h3>
              <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
                Cards are laid out with 8px max gap between them.
              </p>
            </div>
          </md-card>
        `,
      )}
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Accessibility
// ──────────────────────────────────────────────────────────────
export const Accessibility: Story = {
  name: 'Accessibility',
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the WAI-ARIA semantics and keyboard support of ' +
          '<code>md-card</code> — only <code>interactive</code> cards expose ' +
          'a role, focus ring, and keyboard activation. Static cards are ' +
          'pure containers and do not appear in the tab order or to ' +
          'screen-readers as buttons.',
      },
    },
  },
  render: () => html`
    <style>
      .a11y-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; max-width: 900px; }
      .a11y-card-body { padding: 16px; }
      .a11y-list { margin: 0; padding-inline-start: 18px; font-size: 14px; line-height: 1.6; }
      .a11y-key { display: inline-block; padding: 2px 6px; border: 1px solid var(--md-sys-color-outline-variant, #cac4d0); border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: var(--md-sys-color-surface-container, #f3edf7); }
    </style>

    <div style="display: flex; flex-direction: column; gap: 24px;">
      <section>
        <h3 style="margin: 0 0 12px;">1 · Static vs. interactive semantics</h3>
        <div class="a11y-grid">
          <md-card variant="outlined">
            <div class="a11y-card-body">
              <h4 style="margin: 0 0 8px;">Static card</h4>
              <ul class="a11y-list">
                <li>No <code>role</code></li>
                <li>No <code>tabindex</code></li>
                <li>Pure container, invisible to button-style assistive tech</li>
              </ul>
            </div>
          </md-card>

          <md-card variant="filled" interactive aria-label="Open settings">
            <div class="a11y-card-body">
              <h4 style="margin: 0 0 8px;">Interactive card</h4>
              <ul class="a11y-list">
                <li><code>role="button"</code></li>
                <li><code>tabindex="0"</code></li>
                <li>Use <code>aria-label</code> on the host when the visible
                    text is not a sufficient name</li>
              </ul>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 style="margin: 0 0 12px;">2 · Keyboard activation</h3>
        <p style="margin: 0 0 12px; font-size: 14px;">
          Tab to the cards below, then activate with
          <span class="a11y-key">Enter</span> or <span class="a11y-key">Space</span>.
        </p>
        <div class="a11y-grid">
          <md-card
            variant="elevated"
            interactive
            aria-label="Like this card"
            @mdClick=${() => alert('Activated via Enter / Space / click')}
          >
            <div class="a11y-card-body">
              <h4 style="margin: 0 0 8px;">Activatable card</h4>
              <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
                Triggers <code>mdClick</code> identically for pointer and keyboard.
              </p>
            </div>
          </md-card>

          <md-card variant="elevated" interactive disabled>
            <div class="a11y-card-body">
              <h4 style="margin: 0 0 8px;">Disabled (hard)</h4>
              <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
                <code>aria-disabled="true"</code>, <code>tabindex="-1"</code> —
                skipped during Tab navigation.
              </p>
            </div>
          </md-card>

          <md-card variant="elevated" interactive soft-disabled>
            <div class="a11y-card-body">
              <h4 style="margin: 0 0 8px;">Soft-disabled</h4>
              <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
                <code>aria-disabled="true"</code> but still focusable
                (<code>tabindex="0"</code>) so screen-readers can announce
                why the card is currently unavailable.
              </p>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 style="margin: 0 0 12px;">3 · Dragged state announcement</h3>
        <p style="margin: 0 0 12px; font-size: 14px;">
          Draggable cards reflect <code>aria-grabbed</code> on the host and
          flip it to <code>"true"</code> while the pointer drags past the
          5px threshold.
        </p>
        <div class="a11y-grid">
          <md-card variant="elevated" drag-enabled>
            <div class="a11y-card-body">
              <h4 style="margin: 0 0 8px;">Draggable card</h4>
              <p style="margin: 0; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
                <code>aria-grabbed="false"</code> when idle, switches to
                <code>"true"</code> while being dragged.
              </p>
            </div>
          </md-card>
        </div>
      </section>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Localization
// ──────────────────────────────────────────────────────────────
const localeData = [
  {
    locale: 'en-US',
    dir: 'ltr',
    flag: 'US',
    title: 'Daily summary',
    body: 'Tap to read the latest market briefing for North America.',
    cta: 'Read more',
  },
  {
    locale: 'fr-FR',
    dir: 'ltr',
    flag: 'FR',
    title: 'Résumé quotidien',
    body: 'Appuyez pour lire la note de marché du jour pour l\u2019Europe.',
    cta: 'Lire la suite',
  },
  {
    locale: 'de-DE',
    dir: 'ltr',
    flag: 'DE',
    title: 'Tagesübersicht',
    body: 'Tippen Sie, um den heutigen Marktbericht für Europa zu lesen.',
    cta: 'Weiterlesen',
  },
  {
    locale: 'ja-JP',
    dir: 'ltr',
    flag: 'JP',
    title: '今日のサマリー',
    body: 'タップして本日のアジア市場レポートをご覧ください。',
    cta: '続きを読む',
  },
  {
    locale: 'ar-SA',
    dir: 'rtl',
    flag: 'SA',
    title: 'الملخص اليومي',
    body: 'اضغط لقراءة تقرير السوق اليومي لمنطقة الشرق الأوسط.',
    cta: 'اقرأ المزيد',
  },
  {
    locale: 'he-IL',
    dir: 'rtl',
    flag: 'IL',
    title: 'תקציר יומי',
    body: 'הקש לקריאת דו"ח השוק היומי לישראל.',
    cta: 'קרא עוד',
  },
];

export const Localization: Story = {
  name: 'Localization',
  parameters: {
    docs: {
      description: {
        story:
          'Cards are content containers, so they inherit text direction, ' +
          'language, and locale-aware formatting from their context. Wrap ' +
          'the card (or any ancestor) with <code>dir="rtl"</code> and ' +
          '<code>lang="…"</code>, and use <code>Intl</code> for dates / ' +
          'numbers inside slotted content. The card itself uses CSS ' +
          'logical properties throughout, so it mirrors automatically.',
      },
    },
  },
  render: () => {
    const now = new Date();
    const price = 1284.56;

    return html`
      <style>
        .loc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; max-width: 900px; }
        .loc-meta { display: flex; align-items: center; justify-content: space-between; margin-block-end: 8px; }
        .loc-flag { font-weight: 600; font-size: 13px; letter-spacing: 0.5px; color: var(--md-sys-color-on-surface-variant); }
        .loc-date { font-size: 12px; color: var(--md-sys-color-on-surface-variant); }
        .loc-title { margin: 0 0 8px; font-size: 16px; font-weight: 500; }
        .loc-body { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: var(--md-sys-color-on-surface-variant); }
        .loc-price { font-size: 18px; font-weight: 500; margin-block-end: 12px; color: var(--md-sys-color-primary, #6750a4); }
      </style>

      <div class="loc-grid">
        ${localeData.map(
          (l) => html`
            <md-card
              variant="elevated"
              interactive
              lang=${l.locale}
              dir=${l.dir}
              aria-label=${`${l.title} — ${l.locale}`}
            >
              <div style="padding: 16px;">
                <div class="loc-meta">
                  <span class="loc-flag">${l.flag} · ${l.locale}</span>
                  <span class="loc-date">
                    ${new Intl.DateTimeFormat(l.locale, { dateStyle: 'medium' }).format(now)}
                  </span>
                </div>
                <h3 class="loc-title">${l.title}</h3>
                <div class="loc-price">
                  ${new Intl.NumberFormat(l.locale, {
                    style: 'currency',
                    currency:
                      l.locale === 'en-US'
                        ? 'USD'
                        : l.locale === 'ja-JP'
                          ? 'JPY'
                          : l.locale === 'ar-SA'
                            ? 'SAR'
                            : l.locale === 'he-IL'
                              ? 'ILS'
                              : 'EUR',
                  }).format(price)}
                </div>
                <p class="loc-body">${l.body}</p>
                <md-button variant="filled" size="sm">${l.cta}</md-button>
              </div>
            </md-card>
          `,
        )}
      </div>
    `;
  },
};

// ──────────────────────────────────────────────────────────────
// Width & Height (variable + full-width / full-height)
// ──────────────────────────────────────────────────────────────
export const WidthAndHeight: Story = {
  name: 'Width & Height',
  parameters: {
    docs: {
      description: {
        story:
          'Six CSS custom properties expose explicit sizing on both axes — ' +
          '<code>--md-card-width</code>, <code>--md-card-min-width</code>, ' +
          '<code>--md-card-max-width</code>, <code>--md-card-height</code>, ' +
          '<code>--md-card-min-height</code>, ' +
          '<code>--md-card-max-height</code> — plus two boolean ' +
          'attributes (<code>full-width</code>, <code>full-height</code>) ' +
          'that resolve to <code>100%</code>. Combine the two for a ' +
          '"fill but cap" pattern in dashboards and grids.',
      },
    },
  },
  render: () => html`
    <style>
      .wh-card { display: flex; flex-direction: column; gap: 24px; max-width: 1000px; }
      .wh-frame {
        padding: 16px;
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
      }
      .wh-frame.tall { block-size: 320px; }
      .wh-frame.row { display: flex; gap: 16px; flex-wrap: wrap; align-items: stretch; }
      .wh-frame.grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        grid-auto-rows: 200px;
        gap: 16px;
      }
      .wh-h { margin: 0 0 8px; font-size: 16px; font-weight: 500; }
      .wh-body { padding: 16px; flex: 1 1 auto; display: flex; flex-direction: column; }
      .wh-body p { margin: 0 0 12px; font-size: 14px; line-height: 1.5; }
      .wh-spacer { flex: 1 1 auto; }
      .wh-actions { display: flex; gap: 8px; justify-content: flex-end; margin-block-start: auto; }
    </style>

    <div class="wh-card">
      <section>
        <h3 class="wh-h">1 · Variable width via <code>--md-card-width</code> / <code>min</code> / <code>max</code></h3>
        <div class="wh-frame row">
          <md-card variant="elevated" style="--md-card-width: 220px;">
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">Fixed 220px</h4>
              <p>Explicit inline-size.</p>
            </div>
          </md-card>
          <md-card variant="filled" style="--md-card-min-width: 200px; --md-card-max-width: 360px;">
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">200 – 360px range</h4>
              <p>Grows with content but stays inside the bounds.</p>
            </div>
          </md-card>
          <md-card variant="outlined">
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">auto (default)</h4>
              <p>Sized by its content as before.</p>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 class="wh-h">2 · <code>full-width</code> attribute</h3>
        <p style="margin: 0 0 12px; font-size: 14px;">
          Stretches to the parent's inline-size. Pair with
          <code>--md-card-max-width</code> to cap the fluid width.
        </p>
        <div class="wh-frame">
          <md-card variant="elevated" full-width interactive>
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">100% wide</h4>
              <p>Behaves as a fluid block — useful for hero cards / banners.</p>
            </div>
          </md-card>

          <md-card
            variant="filled"
            full-width
            interactive
            style="--md-card-max-width: 480px; margin-block-start: 16px;"
          >
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">100% wide, capped at 480px</h4>
              <p><code>full-width</code> + <code>--md-card-max-width</code> = grow but never overflow a comfortable line length.</p>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 class="wh-h">3 · Variable height via <code>--md-card-height</code> / <code>min</code> / <code>max</code></h3>
        <div class="wh-frame row">
          <md-card variant="elevated" style="width: 240px; --md-card-height: 200px;">
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">Fixed 200px tall</h4>
              <p>Useful for uniform grids.</p>
              <div class="wh-spacer"></div>
              <div class="wh-actions"><md-button variant="text" size="sm">Action</md-button></div>
            </div>
          </md-card>
          <md-card variant="filled" style="width: 240px; --md-card-min-height: 240px;">
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">At least 240px tall</h4>
              <p>Floor only — grows if content is bigger.</p>
              <div class="wh-spacer"></div>
              <div class="wh-actions"><md-button variant="text" size="sm">Action</md-button></div>
            </div>
          </md-card>
          <md-card variant="outlined" style="width: 240px; --md-card-max-height: 160px;">
            <div class="wh-body" style="overflow: auto;" tabindex="0" role="region" aria-label="Scrollable card content">
              <h4 style="margin:0 0 8px;">Capped at 160px</h4>
              <p>Long content scrolls inside the card body. Pair with
                 <code>overflow: auto</code> on the body element.</p>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.</p>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 class="wh-h">4 · <code>full-height</code> in a grid row</h3>
        <p style="margin: 0 0 12px; font-size: 14px;">
          When the parent has a definite block-size (here a grid with
          <code>grid-auto-rows: 200px</code>), <code>full-height</code>
          makes every card line up flush — no matter how much content
          they contain.
        </p>
        <div class="wh-frame grid">
          <md-card variant="elevated" full-height interactive>
            <div class="wh-body"><h4 style="margin:0;">Short</h4></div>
          </md-card>
          <md-card variant="filled" full-height interactive>
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">Medium</h4>
              <p>Some supporting text.</p>
            </div>
          </md-card>
          <md-card variant="outlined" full-height interactive>
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">Long</h4>
              <p>Lots more supporting text — but the card stays exactly
                 the same height as its row neighbors thanks to
                 <code>full-height</code>.</p>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 class="wh-h">5 · <code>full-width</code> + <code>full-height</code> hero</h3>
        <div class="wh-frame tall">
          <md-card
            variant="filled"
            full-width
            full-height
            interactive
            style="--md-card-container-color: var(--md-sys-color-primary-container, #eaddff); color: var(--md-sys-color-on-primary-container, #21005d);"
          >
            <div class="wh-body">
              <h4 style="margin:0 0 8px;">Hero card</h4>
              <p>Combines both attributes to fill the entire framed area —
                 perfect for empty-state placeholders or feature spots.</p>
              <div class="wh-spacer"></div>
              <div class="wh-actions">
                <md-button variant="text">Skip</md-button>
                <md-button variant="filled">Get started</md-button>
              </div>
            </div>
          </md-card>
        </div>
      </section>
    </div>
  `,
};

// ──────────────────────────────────────────────────────────────
// Responsiveness
// ──────────────────────────────────────────────────────────────
export const Responsiveness: Story = {
  name: 'Responsiveness',
  parameters: {
    // The demo's widest viewport box is 1024px. Under the default centred
    // layout the canvas shrink-wraps its content, so the shell's and the boxes'
    // `max-inline-size: 100%` are circular and never bind — the story then
    // overflows a narrower canvas, and CENTRING clips both edges, taking the
    // first characters off every heading. 'padded' gives the root a definite
    // width so those percentage caps resolve.
    layout: 'padded',
    docs: {
      description: {
        story:
          'Cards have no built-in breakpoints — they take whatever width ' +
          'their parent gives them, so responsiveness is a layout concern. ' +
          'The grid below uses <code>grid-template-columns: ' +
          'repeat(auto-fit, minmax(240px, 1fr))</code>, which reflows from ' +
          '1 column at 320px → 2 cols at 480px → 3 cols at 768px → 4 cols ' +
          'at 1024px without a single media query. The hero card combines ' +
          '<code>full-width</code> with <code>--md-card-max-width</code> ' +
          'for a fluid-but-capped layout, and the bottom row uses ' +
          '<code>full-height</code> in a fixed-row grid so card edges line ' +
          'up no matter how much content they contain. Resize the live ' +
          'frame at the bottom to see the same markup adapt.',
      },
    },
  },
  render: () => html`
    <style>
      .resp-card-shell { display: flex; flex-direction: column; gap: 32px; max-width: 1100px; }
      .resp-card-vp__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--md-sys-color-on-surface-variant); margin-block-end: 6px; }
      .resp-card-vp__frame {
        border: 1px dashed var(--md-sys-color-outline-variant, #cac4d0);
        border-radius: 12px;
        padding: 16px;
        background: var(--md-sys-color-surface-container-lowest, #fffbfe);
        container-type: inline-size;
        box-sizing: border-box;
      }
      .resp-card-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 12px;
      }
      .resp-card-grid--row {
        grid-auto-rows: 200px;
      }
      .resp-card-body { padding: 16px; }
      .resp-card-body h4 { margin: 0 0 6px; font-size: 14px; font-weight: 500; }
      .resp-card-body p { margin: 0; font-size: 13px; line-height: 1.4; color: var(--md-sys-color-on-surface-variant); }
      .resp-card-live {
        resize: horizontal;
        overflow: auto;
        min-inline-size: 280px;
        max-inline-size: 100%;
        inline-size: 720px;
      }
    </style>

    <div class="resp-card-shell">
      <section>
        <h3 style="margin: 0 0 4px;">Auto-fit grid at four breakpoints</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Identical card markup. The grid template reflows automatically.
        </p>

        ${[
          { label: 'XS · 320 px (phone)', width: '320px' },
          { label: 'SM · 480 px (large phone)', width: '480px' },
          { label: 'MD · 768 px (tablet)', width: '768px' },
          { label: 'LG · 1024 px (desktop)', width: '1024px' },
        ].map(
          (vp) => html`
            <div style="margin-block-end: 12px;">
              <div class="resp-card-vp__label">${vp.label}</div>
              <div class="resp-card-vp__frame" style="inline-size: ${vp.width}; max-inline-size: 100%;">
                <div class="resp-card-grid">
                  ${[1, 2, 3, 4, 5, 6].map(
                    (i) => html`
                      <md-card variant=${i % 3 === 0 ? 'outlined' : i % 3 === 1 ? 'elevated' : 'filled'} interactive>
                        <div class="resp-card-body">
                          <h4>Card ${i}</h4>
                          <p>Adapts to whatever column width the grid hands it.</p>
                        </div>
                      </md-card>
                    `,
                  )}
                </div>
              </div>
            </div>
          `,
        )}
      </section>

      <section>
        <h3 style="margin: 0 0 4px;"><code>full-width</code> + <code>--md-card-max-width</code> hero</h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Fluid hero card that grows with the viewport but never exceeds 640px,
          so reading-line-length stays comfortable on a 4K monitor.
        </p>
        <div class="resp-card-vp__frame" style="inline-size: 100%;">
          <md-card
            variant="filled"
            full-width
            interactive
            style="--md-card-max-width: 640px; --md-card-container-color: var(--md-sys-color-primary-container, #eaddff); color: var(--md-sys-color-on-primary-container, #21005d); margin-inline: auto;"
          >
            <div style="padding: 24px;">
              <h4 style="margin: 0 0 8px; font-size: 18px;">Welcome back</h4>
              <p style="margin: 0; font-size: 14px; line-height: 1.5;">
                One markup, fluid sizing, capped reading width — the same code
                works for a 320px phone and a 4K monitor.
              </p>
            </div>
          </md-card>
        </div>
      </section>

      <section>
        <h3 style="margin: 0 0 4px;">Aligned-edge row with <code>full-height</code></h3>
        <p style="margin: 0 0 16px; font-size: 14px; color: var(--md-sys-color-on-surface-variant);">
          Cards in a fixed-row grid all line up flush, regardless of content
          length. Resize the frame to watch the row reflow.
        </p>
        <div class="resp-card-vp__frame resp-card-live" tabindex="0" role="region" aria-label="Resizable responsive preview">
          <div class="resp-card-grid resp-card-grid--row">
            <md-card variant="elevated" full-height interactive>
              <div class="resp-card-body">
                <h4>Short</h4>
              </div>
            </md-card>
            <md-card variant="filled" full-height interactive>
              <div class="resp-card-body">
                <h4>Medium</h4>
                <p>Some supporting text.</p>
              </div>
            </md-card>
            <md-card variant="outlined" full-height interactive>
              <div class="resp-card-body">
                <h4>Long</h4>
                <p>Lots more supporting text — the row stays exactly 200px tall.</p>
              </div>
            </md-card>
          </div>
        </div>
      </section>
    </div>
  `,
};
