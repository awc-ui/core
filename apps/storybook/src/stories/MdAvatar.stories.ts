import type { Meta, StoryObj } from '@storybook/web-components';
import { expect, waitFor } from 'storybook/test';
import { html } from 'lit';
import { t } from '../i18n';

/* ═══════════════════════════════════════════════════════════════════════════
   play() helpers — testing-library queries can't cross shadow roots, so the
   interactions address the real host + its shadowRoot directly. Mirrors the
   `.hydrated`-gate pattern used by the other component stories.
   ═══════════════════════════════════════════════════════════════════════════ */
type AvatarEl = HTMLElement & {
  src: string;
  name: string;
  initials: string;
  size: string;
  label: string;
};

/** Await the Stencil `.hydrated` class before reading reflected attrs / shadow DOM. */
const hydrateAvatar = async (el: AvatarEl): Promise<AvatarEl> => {
  await waitFor(() => expect(el.classList.contains('hydrated')).toBe(true));
  return el;
};

/** Trimmed text of the rendered initials span (empty string when absent). */
const initialsTextOf = (el: AvatarEl): string =>
  el.shadowRoot!.querySelector('.md-avatar__initials')?.textContent?.trim() ?? '';

/* ═══════════════════════════════════════════════════════════════════════════
   Shared style helpers
   ═══════════════════════════════════════════════════════════════════════════ */
const sectionLabel = (text: string) => html`
  <h4
    style="
      margin: 0 0 4px;
      font-family: var(--md-sys-typescale-title-small-font-family, system-ui, sans-serif);
      font-size: 14px;
      font-weight: 600;
      color: var(--md-sys-color-on-surface);
    "
  >${text}</h4>
`;

const caption = (text: string) => html`
  <p
    style="
      margin: 0 0 12px;
      font-family: var(--md-sys-typescale-body-small-font-family, system-ui, sans-serif);
      font-size: 12px;
      line-height: 16px;
      color: var(--md-sys-color-on-surface-variant);
    "
  >${text}</p>
`;

const row = (children: unknown) => html`
  <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">${children}</div>
`;

const grid = (children: unknown) => html`
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; align-items: start;">
    ${children}
  </div>
`;

/* ═══════════════════════════════════════════════════════════════════════════
   META
   ═══════════════════════════════════════════════════════════════════════════ */
const meta: Meta = {
  title: 'Data Display/Avatar',
  component: 'md-avatar',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { language: 'html' },
      description: {
        component:
          'Material Design 3 avatar. Renders an image when `src` is set, ' +
          'derives initials from `name` (or accepts explicit `initials`) when ' +
          'the image is missing or fails to load, and falls back to a `person` ' +
          'icon as a last resort. Three sizes (small / medium / large), three ' +
          'shapes (circle / rounded / square), and a deterministic tonal palette ' +
          'keyed off the name so the same user always gets the same color.',
      },
    },
  },
  argTypes: {
    src: { control: 'text', description: 'Image URL (takes precedence over initials).' },
    alt: { control: 'text', description: 'Image alt — also used as the host accessible label.' },
    name: { control: 'text', description: 'Full name — initials are auto-derived (Ada Lovelace → AL).' },
    initials: { control: 'text', description: 'Explicit initials override.' },
    size: {
      control: 'text',
      description:
        'Either a preset (`small`/`medium`/`large`) or any CSS length (`72`, `4rem`, `clamp(28px, 4vw, 72px)`).',
    },
    shape: { control: 'select', options: ['circle', 'rounded', 'square'] },
    label: { control: 'text', description: 'Accessible label override.' },
    colorFromName: {
      control: 'boolean',
      description: 'Deterministically pick a tonal palette bucket from the seed.',
    },
    loading: { control: 'select', options: ['lazy', 'eager'] },
  },
  args: {
    src: '',
    alt: '',
    name: 'Ada Lovelace',
    initials: '',
    size: 'medium',
    shape: 'circle',
    label: '',
    colorFromName: true,
    loading: 'lazy',
  },
};

export default meta;
type Story = StoryObj;

/* ═══════════════════════════════════════════════════════════════════════════
   1. PLAYGROUND
   ═══════════════════════════════════════════════════════════════════════════ */
export const Playground: Story = {
  render: (args) => html`
    <md-avatar
      src=${args.src || ''}
      alt=${args.alt || ''}
      name=${args.name || ''}
      initials=${args.initials || ''}
      size=${args.size}
      shape=${args.shape}
      label=${args.label || ''}
      color-from-name=${args.colorFromName ? 'true' : 'false'}
      loading=${args.loading}
    ></md-avatar>
  `,
  /**
   * Drives the runtime code paths that static rendering never reaches:
   * the `@Watch('src')` reset, the image load/error handlers + `mdLoad`/`mdError`
   * events, single-token initial derivation, the whitespace-initials → icon
   * fallback, and the custom-size coercion guard.
   */
  play: async ({ canvasElement, step }) => {
    const avatar = await hydrateAvatar(canvasElement.querySelector('md-avatar') as AvatarEl);

    await step('setting src → @Watch resets state, image renders, mdLoad fires', async () => {
      let loaded: { src: string } | undefined;
      avatar.addEventListener(
        'mdLoad',
        (e) => { loaded = (e as CustomEvent<{ src: string }>).detail; },
        { once: true },
      );
      // 1×1 transparent GIF — loads reliably offline, unlike a remote URL.
      const okSrc =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      avatar.src = okSrc; // @Watch('src') onSrcChange() runs → imageFailed = false
      // hasImage becomes true → the host switches into image mode + renders <img>.
      await waitFor(() => expect(avatar.classList.contains('md-avatar--mode-image')).toBe(true));
      const img = avatar.shadowRoot!.querySelector('.md-avatar__image') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img!.getAttribute('aria-hidden')).toBe('true'); // img always silent to AT
      // handleImageLoad() fired the event with the resolved src.
      await waitFor(() => expect(loaded).toBeTruthy());
      expect(loaded!.src).toBe(okSrc);
    });

    await step('broken src → onError falls back to name-initials, mdError fires', async () => {
      let errored: { src: string } | undefined;
      avatar.addEventListener(
        'mdError',
        (e) => { errored = (e as CustomEvent<{ src: string }>).detail; },
        { once: true },
      );
      const badSrc = 'https://broken.invalid/nope.png';
      avatar.src = badSrc; // @Watch resets, <img> re-renders, then errors
      // handleImageError() emits mdError and flips imageFailed → initials mode.
      await waitFor(() => expect(errored).toBeTruthy());
      expect(errored!.src).toBe(badSrc);
      await waitFor(() => expect(avatar.classList.contains('md-avatar--mode-initials')).toBe(true));
      expect(initialsTextOf(avatar)).toBe('AL'); // from name="Ada Lovelace"
    });

    await step('single-token name → first grapheme, uppercased', async () => {
      avatar.src = ''; // clear the image path (fires @Watch again)
      avatar.initials = '';
      avatar.name = 'cher'; // one token → firstGrapheme('cher').toLocaleUpperCase()
      await waitFor(() => expect(initialsTextOf(avatar)).toBe('C'));
    });

    await step('whitespace-only initials collapse to the person-icon slot', async () => {
      avatar.name = '';
      // initials is truthy → truncate('') → segmentGraphemes('') = [] → slice() fallback → ''.
      avatar.initials = '   ';
      await waitFor(() => expect(avatar.classList.contains('md-avatar--mode-slot')).toBe(true));
      expect(avatar.shadowRoot!.querySelector('.md-avatar__initials')).toBeNull();
      expect(avatar.shadowRoot!.querySelector('.md-avatar__icon')).not.toBeNull();
    });

    await step('numeric size wires --md-avatar-size; blank size falls back to preset', async () => {
      avatar.size = '72'; // coerceCssLength('72') → '72px'
      await waitFor(() => expect(avatar.classList.contains('md-avatar--custom-size')).toBe(true));
      expect(avatar.style.getPropertyValue('--md-avatar-size')).toBe('72px');
      avatar.size = '   '; // trims to '' → guard returns undefined → no custom size
      await waitFor(() => expect(avatar.classList.contains('md-avatar--custom-size')).toBe(false));
    });

    await step('three-token name → first + last grapheme (middle dropped)', async () => {
      avatar.src = '';
      avatar.initials = '';
      // tokens.length > 1 with 3 tokens → firstGrapheme('mary') + firstGrapheme('watson'), uppercased.
      avatar.name = 'mary jane watson';
      await waitFor(() => expect(initialsTextOf(avatar)).toBe('MW'));
    });

    await step('@Watch("src") clears a prior image failure → recovers to image mode', async () => {
      // Seed a distinct initials fallback so the failure state is observable.
      avatar.name = '';
      avatar.initials = 'AL';
      // First: a broken URL fails → imageFailed flips true → initials mode renders "AL".
      // The avatar was already in initials mode from the previous step ("MW"), so the
      // src → image → error → initials re-render is async: wait on the *text* (not just
      // the class) so we don't latch onto the stale "MW" render before it lands.
      avatar.src = 'https://broken.invalid/again.png';
      await waitFor(() => {
        expect(avatar.classList.contains('md-avatar--mode-initials')).toBe(true);
        expect(initialsTextOf(avatar)).toBe('AL');
      });
      // Now a valid src: onSrcChange() must reset imageFailed=false, otherwise
      // hasImage (`!!src && !imageFailed`) would stay false and the tile would be
      // stuck in initials mode. Returning to image mode proves the @Watch reset ran.
      const okSrc =
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      avatar.src = okSrc;
      await waitFor(() => expect(avatar.classList.contains('md-avatar--mode-image')).toBe(true));
      const img = avatar.shadowRoot!.querySelector('.md-avatar__image') as HTMLImageElement | null;
      expect(img).not.toBeNull();
      expect(img!.getAttribute('src')).toBe(okSrc);
    });

    await step('explicit initials are capped at 3 graphemes', async () => {
      avatar.src = '';
      avatar.name = '';
      // truncate('wxyz') → segmentGraphemes(text, 3) yields ['W','X','Y'] → joined + uppercased.
      avatar.initials = 'wxyz';
      await waitFor(() => expect(initialsTextOf(avatar)).toBe('WXY'));
    });

    await step('color-from-name toggles the deterministic palette class', async () => {
      avatar.src = '';
      avatar.initials = '';
      avatar.name = 'Ada Lovelace';
      const hasPaletteClass = () =>
        Array.from(avatar.classList).some((c) => /^md-avatar--palette-[1-7]$/.test(c));
      // colorFromName=true → paletteIndex hashes the seed into a 1..7 bucket → palette class present.
      (avatar as unknown as { colorFromName: boolean }).colorFromName = true;
      await waitFor(() => expect(hasPaletteClass()).toBe(true));
      // colorFromName=false → paletteIndex getter returns 0 → no palette class.
      (avatar as unknown as { colorFromName: boolean }).colorFromName = false;
      await waitFor(() => expect(hasPaletteClass()).toBe(false));
    });
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. ALL THREE MODES — image → initials → icon
   ═══════════════════════════════════════════════════════════════════════════ */
export const FallbackChain: Story = {
  render: () => html`
    ${caption(
      'The avatar resolves the first available source: `src` (image) → `initials` (explicit) → `name` (auto-derived) → default slot → built-in person icon.',
    )}
    ${row(html`
      <md-avatar src="https://i.pravatar.cc/80?img=11" alt="Photo avatar"></md-avatar>
      <md-avatar name="Ada Lovelace" label="Ada Lovelace"></md-avatar>
      <md-avatar initials="JD" label="John Doe"></md-avatar>
      <md-avatar name="Cher" label="Cher"></md-avatar>
      <md-avatar></md-avatar>
    `)}
    ${caption('From left: image · auto-initials from name · explicit initials · single-letter from one-word name · icon fallback.')}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. SIZES
   ═══════════════════════════════════════════════════════════════════════════ */
export const Sizes: Story = {
  render: () => html`
    ${caption('Three preset sizes (24 / 40 / 56dp). The `size` prop also accepts any CSS length — unitless numbers default to pixels, units pass through verbatim.')}
    ${grid(html`
      <div>
        ${sectionLabel('Presets')}
        ${row(html`
          <md-avatar size="small" name="Ada Lovelace"></md-avatar>
          <md-avatar size="medium" name="Ada Lovelace"></md-avatar>
          <md-avatar size="large" name="Ada Lovelace"></md-avatar>
        `)}
      </div>

      <div>
        ${sectionLabel('Custom sizes (prop-driven)')}
        ${caption('`size="72"` → 72px · `size="4rem"` · `size="10vw"` · `size="clamp(...)"`')}
        ${row(html`
          <md-avatar size="72" name="Ada Lovelace" label="72px"></md-avatar>
          <md-avatar size="4rem" name="Linus Torvalds" label="4rem"></md-avatar>
          <md-avatar
            size="clamp(28px, 4vw, 72px)"
            name="Grace Hopper"
            label="clamp 28–72px"
          ></md-avatar>
          <md-avatar size="96" name="Marie Curie" label="96px"></md-avatar>
        `)}
      </div>

      <div>
        ${sectionLabel('Custom sizes (CSS-property override)')}
        ${caption('Per-instance `--md-avatar-size` still works — and wins over the prop.')}
        ${row(html`
          <md-avatar style="--md-avatar-size: 72px;" name="Ada Lovelace"></md-avatar>
          <md-avatar style="--md-avatar-size: 96px;" name="Ada Lovelace"></md-avatar>
        `)}
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. SHAPES
   ═══════════════════════════════════════════════════════════════════════════ */
export const Shapes: Story = {
  render: () => html`
    ${caption('Three shape presets: `circle` (default), `rounded` (12dp), `square` (sharp).')}
    ${row(html`
      <md-avatar shape="circle" name="Ada Lovelace"></md-avatar>
      <md-avatar shape="rounded" name="Ada Lovelace"></md-avatar>
      <md-avatar shape="square" name="Ada Lovelace"></md-avatar>
      <md-avatar shape="circle" src="https://i.pravatar.cc/80?img=11" alt="A"></md-avatar>
      <md-avatar shape="rounded" src="https://i.pravatar.cc/80?img=11" alt="A"></md-avatar>
      <md-avatar shape="square" src="https://i.pravatar.cc/80?img=11" alt="A"></md-avatar>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. AUTO-INITIALS — every input style
   ═══════════════════════════════════════════════════════════════════════════ */
export const Initials: Story = {
  render: (_args, { globals }) => html`
    ${grid(html`
      <div>
        ${sectionLabel('First + last (most common)')}
        ${caption('`name="Ada Lovelace"` → `AL`')}
        ${row(html`
          <md-avatar name="Ada Lovelace" label="Ada Lovelace"></md-avatar>
          <md-avatar name="Marie Curie" label="Marie Curie"></md-avatar>
          <md-avatar name="Linus Torvalds" label="Linus Torvalds"></md-avatar>
          <md-avatar name="Grace Hopper" label="Grace Hopper"></md-avatar>
        `)}
      </div>

      <div>
        ${sectionLabel('Single token → first letter')}
        ${caption('`name="Cher"` → `C`')}
        ${row(html`
          <md-avatar name="Cher" label="Cher"></md-avatar>
          <md-avatar name="Madonna" label="Madonna"></md-avatar>
          <md-avatar name="Prince" label="Prince"></md-avatar>
          <md-avatar name="Banksy" label="Banksy"></md-avatar>
        `)}
      </div>

      <div>
        ${sectionLabel('Three+ tokens → first + last')}
        ${caption('`name="Mary Jane Watson"` → `MW`')}
        ${row(html`
          <md-avatar name="Mary Jane Watson" label="Mary Jane Watson"></md-avatar>
          <md-avatar name="John Ronald Reuel Tolkien" label="J.R.R. Tolkien"></md-avatar>
          <md-avatar name="José Saramago" label="José Saramago"></md-avatar>
          <md-avatar name="Émilie Du Châtelet" label="Émilie Du Châtelet"></md-avatar>
        `)}
      </div>

      <div>
        ${sectionLabel('Explicit override via `initials`')}
        ${caption('`initials="VIP"` — verbatim, max 3 graphemes')}
        ${row(html`
          <md-avatar initials="VIP" label="VIP"></md-avatar>
          <md-avatar initials="🚀" label=${t(globals.locale, 'avatar.rocketAccount')}></md-avatar>
          <md-avatar initials="α" label=${t(globals.locale, 'avatar.alphaCohort')}></md-avatar>
          <md-avatar initials="MD3" label="MD3 team"></md-avatar>
        `)}
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   6. DETERMINISTIC PALETTE — same seed → same color
   ═══════════════════════════════════════════════════════════════════════════ */
export const TonalPalette: Story = {
  render: () => html`
    ${caption(
      'With `color-from-name` (default `true`) the container color is a deterministic hash of the seed. Reloading or rendering the same name elsewhere produces the same color — perfect for identity-by-color.',
    )}
    ${row(html`
      <md-avatar name="Ada Lovelace" label="Ada Lovelace"></md-avatar>
      <md-avatar name="Linus Torvalds" label="Linus Torvalds"></md-avatar>
      <md-avatar name="Grace Hopper" label="Grace Hopper"></md-avatar>
      <md-avatar name="Marie Curie" label="Marie Curie"></md-avatar>
      <md-avatar name="Alan Turing" label="Alan Turing"></md-avatar>
      <md-avatar name="Margaret Hamilton" label="Margaret Hamilton"></md-avatar>
      <md-avatar name="Dennis Ritchie" label="Dennis Ritchie"></md-avatar>
      <md-avatar name="Hedy Lamarr" label="Hedy Lamarr"></md-avatar>
      <md-avatar name="Tim Berners-Lee" label="Tim Berners-Lee"></md-avatar>
      <md-avatar name="Radia Perlman" label="Radia Perlman"></md-avatar>
    `)}
    ${caption('Disable the palette with `color-from-name="false"` to use the neutral on-surface tone:')}
    ${row(html`
      <md-avatar color-from-name="false" name="Ada Lovelace" label="Ada Lovelace"></md-avatar>
      <md-avatar color-from-name="false" name="Linus Torvalds" label="Linus Torvalds"></md-avatar>
      <md-avatar color-from-name="false" name="Grace Hopper" label="Grace Hopper"></md-avatar>
      <md-avatar color-from-name="false" name="Marie Curie" label="Marie Curie"></md-avatar>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   7. IMAGE — load + error fallback
   ═══════════════════════════════════════════════════════════════════════════ */
export const Image: Story = {
  render: (_args, { globals }) => html`
    ${caption('When `src` loads successfully it fills the tile. When it errors the avatar automatically falls back to initials.')}
    ${row(html`
      <md-avatar src="https://i.pravatar.cc/80?img=11" alt="User A"></md-avatar>
      <md-avatar src="https://i.pravatar.cc/80?img=47" alt="User B"></md-avatar>
      <md-avatar src="https://i.pravatar.cc/80?img=33" alt="User C"></md-avatar>
      <md-avatar src="https://i.pravatar.cc/80?img=5" alt="User D"></md-avatar>
    `)}
    ${caption('Image error fallback — broken URL falls back to initials from `name`:')}
    ${row(html`
      <md-avatar src="https://broken.example.com/missing.jpg" name="Ada Lovelace" label="Ada Lovelace"></md-avatar>
      <md-avatar src="https://broken.example.com/missing.jpg" name="Linus Torvalds" label="Linus Torvalds"></md-avatar>
      <md-avatar src="https://broken.example.com/missing.jpg" initials="JD" label="John Doe"></md-avatar>
      <md-avatar src="https://broken.example.com/missing.jpg" label=${t(globals.locale, 'avatar.unknownUser')}></md-avatar>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   8. CUSTOM SLOT FALLBACK
   ═══════════════════════════════════════════════════════════════════════════ */
export const CustomFallback: Story = {
  render: (_args, { globals }) => html`
    ${caption('Slot any element to replace the built-in person icon when no src/initials are available.')}
    ${row(html`
      <md-avatar label=${t(globals.locale, 'avatar.robotAccount')}>
        <span class="material-symbols-outlined">smart_toy</span>
      </md-avatar>
      <md-avatar label=${t(globals.locale, 'avatar.verifiedAccount')}>
        <span class="material-symbols-outlined">verified</span>
      </md-avatar>
      <md-avatar label=${t(globals.locale, 'avatar.system')}>
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
      </md-avatar>
      <md-avatar label=${t(globals.locale, 'avatar.partyEmoji')}>
        <span>🎉</span>
      </md-avatar>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   9. AVATAR GROUPS — stacked / overlapping
   Default look = opaque biting overlap. Each tile is fully opaque (palettes
   are now opaque too), the leftmost paints on top via z-index, and a
   negative margin produces the "+N more" stack. No mix-blend-mode, no
   outline — the result is a clean bite-mark where each tile covers the
   one behind it.
   ═══════════════════════════════════════════════════════════════════════════ */
export const AvatarGroup: Story = {
  render: (_args, { globals }) => html`
    ${caption('Stack avatars with a negative margin and a descending z-index. Each tile is opaque, so the front avatar fully covers the one behind it — exactly the "bite-mark" pattern.')}
    <div style="display: inline-flex; align-items: center;">
      <md-avatar
        size="medium"
        name="Ada Lovelace"
        label="Ada Lovelace"
        style="margin-inline-end: -12px; z-index: 4;"
      ></md-avatar>
      <md-avatar
        size="medium"
        name="Linus Torvalds"
        label="Linus Torvalds"
        style="margin-inline-end: -12px; z-index: 3;"
      ></md-avatar>
      <md-avatar
        size="medium"
        name="Grace Hopper"
        label="Grace Hopper"
        style="margin-inline-end: -12px; z-index: 2;"
      ></md-avatar>
      <md-avatar
        size="medium"
        initials="+5"
        label=${t(globals.locale, 'avatar.moreMembers')}
        color-from-name="false"
        style="z-index: 1;"
      ></md-avatar>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   9b. AVATAR GROUPS — OUTLINED
   Alternative styling for groups that sit over imagery or busy backgrounds —
   a 2px surface-colored outline gives each avatar a clean separating ring.
   ═══════════════════════════════════════════════════════════════════════════ */
export const AvatarGroupOutlined: Story = {
  render: (_args, { globals }) => html`
    ${caption('Use this when the group sits on imagery or a patterned background and a clear separator helps readability. A 2 px surface-colored outline gives each tile a discrete ring.')}
    <div style="display: inline-flex; align-items: center;">
      <md-avatar
        size="medium"
        name="Ada Lovelace"
        label="Ada Lovelace"
        style="--md-avatar-outline-color: var(--md-sys-color-surface); --md-avatar-outline-width: 2px; margin-inline-end: -8px; z-index: 4;"
      ></md-avatar>
      <md-avatar
        size="medium"
        name="Linus Torvalds"
        label="Linus Torvalds"
        style="--md-avatar-outline-color: var(--md-sys-color-surface); --md-avatar-outline-width: 2px; margin-inline-end: -8px; z-index: 3;"
      ></md-avatar>
      <md-avatar
        size="medium"
        name="Grace Hopper"
        label="Grace Hopper"
        style="--md-avatar-outline-color: var(--md-sys-color-surface); --md-avatar-outline-width: 2px; margin-inline-end: -8px; z-index: 2;"
      ></md-avatar>
      <md-avatar
        size="medium"
        initials="+5"
        label=${t(globals.locale, 'avatar.moreMembers')}
        color-from-name="false"
        style="--md-avatar-outline-color: var(--md-sys-color-surface); --md-avatar-outline-width: 2px; z-index: 1;"
      ></md-avatar>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   9c. AVATAR GROUPS — BLENDED (advanced / decorative)
   Uses `mix-blend-mode: multiply` so overlapping tiles blend like ink on
   paper. Best on a white/very-light surface; switch to `screen` on dark
   backgrounds via `[data-theme="dark"]`.
   ═══════════════════════════════════════════════════════════════════════════ */
export const AvatarGroupBlended: Story = {
  render: () => html`
    ${caption('Decorative variant for very light surfaces — palette colors multiply where they overlap, creating a watercolor stack. Each tile remains a complete circle; the seam is a soft color transition rather than a hard bite-mark.')}
    <div
      style="display: inline-flex; align-items: center; isolation: isolate; padding: 8px;"
    >
      <md-avatar
        size="medium"
        name="Ada Lovelace"
        style="margin-inline-end: -12px; mix-blend-mode: multiply; z-index: 4;"
      ></md-avatar>
      <md-avatar
        size="medium"
        name="Linus Torvalds"
        style="margin-inline-end: -12px; mix-blend-mode: multiply; z-index: 3;"
      ></md-avatar>
      <md-avatar
        size="medium"
        name="Grace Hopper"
        style="margin-inline-end: -12px; mix-blend-mode: multiply; z-index: 2;"
      ></md-avatar>
      <md-avatar
        size="medium"
        initials="+5"
        color-from-name="false"
        style="mix-blend-mode: multiply; z-index: 1;"
      ></md-avatar>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   10. IN LISTS — md-list-item integration
   ═══════════════════════════════════════════════════════════════════════════ */
export const InList: Story = {
  render: (_args, { globals }) => html`
    ${caption(
      'The avatar is reused by `md-list-item` for the leading slot. The list-item accepts `leading-avatar` (URL), `leading-avatar-name` (auto-initials seed), or `leading-avatar-label` (explicit initials) and falls through the same chain.',
    )}
    <md-list style="max-inline-size: 380px;" label="Team">
      <md-list-item
        type="button"
        headline="Ada Lovelace"
        supporting-text=${t(globals.locale, 'avatar.online')}
        leading-avatar-name="Ada Lovelace"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-list-item
        type="button"
        headline="Linus Torvalds"
        supporting-text=${t(globals.locale, 'avatar.lastSeen')}
        leading-avatar="https://i.pravatar.cc/80?img=47"
        leading-avatar-alt="Linus Torvalds"
        leading-avatar-name="Linus Torvalds"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-list-item
        type="button"
        headline="Grace Hopper"
        supporting-text=${t(globals.locale, 'avatar.idle')}
        leading-avatar-label="GH"
        trailing-icon="chevron_right"
      ></md-list-item>
      <md-list-item
        type="button"
        headline="Marie Curie"
        supporting-text=${t(globals.locale, 'avatar.offline')}
        leading-avatar-name="Marie Curie"
        trailing-icon="chevron_right"
      ></md-list-item>
    </md-list>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   10b. STATUS DOT
   The canonical "presence pip" pattern — wrap the avatar in a relatively
   positioned span and anchor a small absolutely-positioned `aria-hidden`
   dot to the bottom-inline-end corner. Logical-property insets mean the
   dot auto-flips in RTL with zero extra CSS, an outline in `surface`
   keeps the dot crisp against any palette, and the *meaning* of the dot
   is encoded in the avatar's `label` so AT users hear the status without
   needing a second labelled element.
   ═══════════════════════════════════════════════════════════════════════════ */
export const StatusDot: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Pair `md-avatar` with the dedicated `md-status-dot` component to surface ' +
          'user state (online · away · do-not-disturb · offline · invisible). The ' +
          'dot is a separate component (see the **Components / StatusDot** story for ' +
          'its full API) — it ships its own state colors, sizes, RTL-safe anchor ' +
          'logic, motion-safe pulse animation and forced-colors fallback, so a ' +
          'consumer only needs a single positioned wrapper:<br><br>' +
          '<code>&lt;span style="position: relative; display: inline-flex"&gt;<br>' +
          '&nbsp;&nbsp;&lt;md-avatar name="Ada" label="Ada, online" /&gt;<br>' +
          '&nbsp;&nbsp;&lt;md-status-dot state="online" /&gt;<br>' +
          '&lt;/span&gt;</code><br><br>' +
          '**Accessibility:** the dot is decorative by default (`role="presentation"` + ' +
          '`aria-hidden`) — the avatar\'s own `label` carries the spoken status, so ' +
          'screen readers hear *"Ada Lovelace, online, image"* once instead of ' +
          'doubling. For numeric badges (unread counts, +N overflow) reach for ' +
          '`md-badge` instead — it\'s a sibling component for the top-corner ' +
          'notification slot.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .status-anchor {
        position: relative;
        display: inline-flex;
        line-height: 0;
      }
    </style>

    ${grid(html`
      <div>
        ${sectionLabel('Presence states')}
        ${caption('Six semantic states. Color is paired with the avatar\'s `label` so colour-blind and screen-reader users get the same information through other channels.')}
        ${row(html`
          <span class="status-anchor">
            <md-avatar name="Ada Lovelace"   label="Ada Lovelace, online"></md-avatar>
            <md-status-dot state="online"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar name="Linus Torvalds" label="Linus Torvalds, away"></md-avatar>
            <md-status-dot state="away"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar name="Grace Hopper"   label="Grace Hopper, do not disturb"></md-avatar>
            <md-status-dot state="busy"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar name="Marie Curie"    label="Marie Curie, offline"></md-avatar>
            <md-status-dot state="offline"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar name="Alan Turing"    label="Alan Turing, invisible"></md-avatar>
            <md-status-dot state="invisible"></md-status-dot>
          </span>
        `)}
      </div>

      <div>
        ${sectionLabel('Sizes')}
        ${caption('Pair `size="small/medium/large"` on the dot with the matching avatar size — 8 / 12 / 16 px lands at roughly 1/3 of the tile diameter on each preset.')}
        ${row(html`
          <span class="status-anchor">
            <md-avatar size="small"  name="Ada Lovelace" label=${t(globals.locale, 'avatar.onlineLower')}></md-avatar>
            <md-status-dot state="online" size="small"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar size="medium" name="Ada Lovelace" label=${t(globals.locale, 'avatar.onlineLower')}></md-avatar>
            <md-status-dot state="online" size="medium"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar size="large"  name="Ada Lovelace" label=${t(globals.locale, 'avatar.onlineLower')}></md-avatar>
            <md-status-dot state="online" size="large"></md-status-dot>
          </span>
        `)}
      </div>

      <div>
        ${sectionLabel('Shape-aware anchor')}
        ${caption('The default offset hugs a circular avatar. For rounded or square avatars, nudge the anchor outward via `--md-status-dot-inset-end` and `--md-status-dot-inset-block-end` so the pip kisses the corner instead of overlapping the radius.')}
        ${row(html`
          <span class="status-anchor">
            <md-avatar shape="circle"  name="Ada Lovelace" label=${t(globals.locale, 'avatar.onlineLower')}></md-avatar>
            <md-status-dot state="online"></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar shape="rounded" name="Ada Lovelace" label=${t(globals.locale, 'avatar.onlineLower')}></md-avatar>
            <md-status-dot
              state="online"
              style="--md-status-dot-inset-end: -3px; --md-status-dot-inset-block-end: -3px;"
            ></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar shape="square"  name="Ada Lovelace" label=${t(globals.locale, 'avatar.onlineLower')}></md-avatar>
            <md-status-dot
              state="online"
              style="--md-status-dot-inset-end: -4px; --md-status-dot-inset-block-end: -4px; border-radius: 4px;"
            ></md-status-dot>
          </span>
        `)}
      </div>

      <div>
        ${sectionLabel('Live indicator')}
        ${caption('Add the `live` boolean to pulse the dot outward in its own colour — green pulses green, busy pulses red, away pulses amber. The animation is wrapped in `prefers-reduced-motion: no-preference`; reduced-motion users see a static dot.')}
        ${row(html`
          <span class="status-anchor">
            <md-avatar name="Ada Lovelace"   label="Ada Lovelace, live now"></md-avatar>
            <md-status-dot state="online" live></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar src="https://i.pravatar.cc/80?img=47" alt="Linus Torvalds, streaming"></md-avatar>
            <md-status-dot state="busy" live></md-status-dot>
          </span>
          <span class="status-anchor">
            <md-avatar size="large" name="Grace Hopper" label="Grace Hopper, in a meeting"></md-avatar>
            <md-status-dot state="away" size="large" live></md-status-dot>
          </span>
        `)}
      </div>

      <div>
        ${sectionLabel('In an avatar group')}
        ${caption('Combine the bite-mark group with per-tile dots. Each tile gets its own positioned wrapper; the group\'s `aria-label` summarises membership and presence in one AT announcement, and individual tiles are silenced.')}
        <div role="group" aria-label="Active reviewers — Ada Lovelace (online), Linus Torvalds (away), Grace Hopper (do not disturb)" style="display: inline-flex; align-items: center; padding: 8px;">
          <span class="status-anchor" style="margin-inline-end: -12px; z-index: 3;">
            <md-avatar name="Ada Lovelace" aria-hidden="true"></md-avatar>
            <md-status-dot state="online" aria-hidden="true"></md-status-dot>
          </span>
          <span class="status-anchor" style="margin-inline-end: -12px; z-index: 2;">
            <md-avatar name="Linus Torvalds" aria-hidden="true"></md-avatar>
            <md-status-dot state="away" aria-hidden="true"></md-status-dot>
          </span>
          <span class="status-anchor" style="z-index: 1;">
            <md-avatar name="Grace Hopper" aria-hidden="true"></md-avatar>
            <md-status-dot state="busy" aria-hidden="true"></md-status-dot>
          </span>
        </div>
      </div>

      <div>
        ${sectionLabel('In a list')}
        ${caption('Inside a labelled `md-list-item`, the avatar is decorative (the row owns the label). Move the *spoken* status into `supporting-text` — the colored dot is the sighted-only cue; the supporting text is the AT cue.')}
        <md-list label="Team" style="max-inline-size: 380px;">
          <md-list-item type="button" headline="Ada Lovelace" supporting-text=${t(globals.locale, 'avatar.online')} trailing-icon="chevron_right">
            <span slot="leading" class="status-anchor" aria-hidden="true">
              <md-avatar size="small" name="Ada Lovelace"></md-avatar>
              <md-status-dot state="online" size="small"></md-status-dot>
            </span>
          </md-list-item>
          <md-list-item type="button" headline="Linus Torvalds" supporting-text=${t(globals.locale, 'avatar.awayBack')} trailing-icon="chevron_right">
            <span slot="leading" class="status-anchor" aria-hidden="true">
              <md-avatar size="small" name="Linus Torvalds"></md-avatar>
              <md-status-dot state="away" size="small"></md-status-dot>
            </span>
          </md-list-item>
          <md-list-item type="button" headline="Grace Hopper" supporting-text=${t(globals.locale, 'avatar.doNotDisturb')} trailing-icon="chevron_right">
            <span slot="leading" class="status-anchor" aria-hidden="true">
              <md-avatar size="small" name="Grace Hopper"></md-avatar>
              <md-status-dot state="busy" size="small"></md-status-dot>
            </span>
          </md-list-item>
        </md-list>
      </div>

      <div>
        ${sectionLabel('RTL — anchor auto-flips')}
        ${caption('`md-status-dot` uses logical-property insets internally, so wrapping the parent in `dir="rtl"` flips the dot to the bottom-left automatically — no CSS overrides, no media queries.')}
        <div dir="rtl">
          ${row(html`
            <span class="status-anchor">
              <md-avatar name="إيدا لوفليس" label="إيدا لوفليس، متصل"></md-avatar>
              <md-status-dot state="online"></md-status-dot>
            </span>
            <span class="status-anchor">
              <md-avatar name="عمر خالد"    label="عمر خالد، غير متصل"></md-avatar>
              <md-status-dot state="offline"></md-status-dot>
            </span>
            <span class="status-anchor">
              <md-avatar name="ليلى أحمد"   label="ليلى أحمد، مشغول"></md-avatar>
              <md-status-dot state="busy"></md-status-dot>
            </span>
          `)}
        </div>
      </div>

      <div style="grid-column: 1 / -1;">
        ${sectionLabel('Implementation pattern — copy & paste')}
        ${caption('Drop this snippet next to any `md-avatar`. The status logic — colors, sizes, anchor, RTL flip, motion-safe pulse — is owned by `md-status-dot`, so the consumer only writes the positioned wrapper.')}
        <pre style="margin: 0; padding: 12px 14px; background: var(--md-sys-color-surface-container, #F3EDF7); border-radius: 8px; font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface); white-space: pre-wrap;"><code>&lt;span style="position: relative; display: inline-flex;"&gt;
  &lt;md-avatar name="Ada Lovelace" label="Ada Lovelace, online"&gt;&lt;/md-avatar&gt;
  &lt;md-status-dot state="online"&gt;&lt;/md-status-dot&gt;
&lt;/span&gt;

&lt;!-- Live / pulsing --&gt;
&lt;span style="position: relative; display: inline-flex;"&gt;
  &lt;md-avatar name="Ada Lovelace" label="Ada Lovelace, live now"&gt;&lt;/md-avatar&gt;
  &lt;md-status-dot state="online" live&gt;&lt;/md-status-dot&gt;
&lt;/span&gt;

&lt;!-- Standalone (no avatar) — promote to role="status" with a label --&gt;
&lt;md-status-dot state="busy" label="In a meeting until 3pm"&gt;&lt;/md-status-dot&gt;</code></pre>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   11. RTL
   ═══════════════════════════════════════════════════════════════════════════ */
export const RTL: Story = {
  render: () => html`
    ${caption('The avatar is intrinsically square so the tile itself is direction-agnostic. Surrounding flow (margins, stacks) flips automatically because every layout rule uses logical properties (`margin-inline-*`, `inset-inline-*`).')}
    <div dir="rtl">
      ${row(html`
        <md-avatar name="إيدا لوفليس" label="إيدا لوفليس"></md-avatar>
        <md-avatar src="https://i.pravatar.cc/80?img=33" alt="بروفايل"></md-avatar>
        <md-avatar initials="أ" label="مستخدم"></md-avatar>
        <md-avatar label="مستخدم بلا اسم"></md-avatar>
      `)}
    </div>
    ${caption('Avatar group in RTL — `margin-inline-end` flips, so the leftmost-in-DOM tile becomes the rightmost-on-screen and the bite-mark direction reverses naturally.')}
    <div dir="rtl" style="display: inline-flex; align-items: center; padding-block-start: 8px;">
      <md-avatar name="ليلى أحمد"   style="margin-inline-end: -12px; z-index: 4;"></md-avatar>
      <md-avatar name="عمر خالد"    style="margin-inline-end: -12px; z-index: 3;"></md-avatar>
      <md-avatar name="سارة يوسف"   style="margin-inline-end: -12px; z-index: 2;"></md-avatar>
      <md-avatar initials="+5" color-from-name="false" style="z-index: 1;"></md-avatar>
    </div>
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   11b. LOCALIZATION
   Demonstrates Intl.Segmenter-based grapheme handling across writing
   systems. The same `name=` API works regardless of script: every locale
   produces the right "first letter of first + first letter of last" /
   "first letter only" derivation, even for scripts where a single
   logical character spans multiple code units (Devanagari clusters,
   Tamil, Korean syllables) or where a "letter" is a multi-code-point
   ZWJ emoji sequence.
   ═══════════════════════════════════════════════════════════════════════════ */
export const Localization: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`md-avatar` is **content-agnostic and locale-aware out of the box**. ' +
          'Every visible string is caller-supplied (via `name`, `initials`, `label`, ' +
          '`alt`); the component itself ships zero hard-coded user-facing copy. ' +
          'Initials are derived with `Intl.Segmenter` (`granularity: "grapheme"`), ' +
          'so a logical "letter" stays a letter across every Unicode script — ' +
          'including emoji ZWJ sequences (`👨‍👩‍👧‍👦`), Devanagari aksharas, Tamil ' +
          'clusters, Korean Hangul syllables and combining diacritics (`É`).<br><br>' +
          'Set `lang="…"` on the avatar (or any ancestor) so screen readers pick ' +
          'the right pronunciation engine and your CSS `font-family` stack falls ' +
          'through to a script-appropriate fallback. Set `dir="rtl"` on the wrapper ' +
          'for right-to-left scripts; both attributes inherit through the light ' +
          'DOM into the avatar automatically.',
      },
    },
  },
  render: (_args, { globals }) => {
    const samples: Array<{ lang: string; dir?: 'ltr' | 'rtl'; name: string; expected: string; note: string }> = [
      { lang: 'en', name: 'Ada Lovelace',          expected: 'AL', note: 'Latin · English' },
      { lang: 'fr', name: 'Émilie Du Châtelet',     expected: 'ÉC', note: 'Latin + diacritics · French' },
      { lang: 'de', name: 'Ada Größe',              expected: 'AG', note: 'Latin + ß · German' },
      { lang: 'es', name: 'Iñigo Montoya',          expected: 'IM', note: 'Latin + Ñ · Spanish' },
      { lang: 'tr', name: 'İrem Çelik',             expected: 'İÇ', note: 'Latin + dotted I · Turkish' },
      { lang: 'vi', name: 'Nguyễn Hữu',             expected: 'NH', note: 'Latin + tone marks · Vietnamese' },
      { lang: 'el', name: 'Άννα Παπαδάκη',          expected: 'ΆΠ', note: 'Greek script' },
      { lang: 'ru', name: 'Ада Лавлейс',            expected: 'АЛ', note: 'Cyrillic · Russian' },
      { lang: 'ar', dir: 'rtl', name: 'إيدا لوفليس', expected: 'إل', note: 'Arabic · RTL' },
      { lang: 'he', dir: 'rtl', name: 'דנה כהן',     expected: 'דכ', note: 'Hebrew · RTL' },
      { lang: 'fa', dir: 'rtl', name: 'مریم میرزاخانی', expected: 'مم', note: 'Persian · RTL' },
      { lang: 'hi', name: 'आदा लवलेस',              expected: 'आल', note: 'Devanagari clusters · Hindi' },
      { lang: 'ta', name: 'ஆதா லவ்லேஸ்',            expected: 'ஆல', note: 'Tamil aksharas' },
      { lang: 'th', name: 'อาดา เลิฟเลซ',           expected: 'อเ', note: 'Thai (no spaces between syllables)' },
      { lang: 'zh-Hans', name: '埃达 洛芙莱斯',         expected: '埃洛', note: 'Simplified Chinese · two-token name' },
      { lang: 'zh-Hant', name: '艾達 洛夫萊斯',         expected: '艾洛', note: 'Traditional Chinese' },
      { lang: 'ja', name: 'エイダ ラブレス',           expected: 'エラ', note: 'Japanese · Katakana' },
      { lang: 'ja', name: '鈴木 一郎',                expected: '鈴一', note: 'Japanese · Kanji' },
      { lang: 'ko', name: '김아다 러브레이스',          expected: '김러', note: 'Korean · Hangul syllables' },
    ];

    return html`
      ${grid(html`
        <div>
          ${sectionLabel('Auto-initials across scripts')}
          ${caption('Each tile is `<md-avatar lang="…" name="…">`. Initials are derived by `Intl.Segmenter`; the second column shows the expected derivation so you can verify visually.')}
          <div style="display: grid; grid-template-columns: max-content 1fr max-content; gap: 12px 16px; align-items: center;">
            ${samples.map(
              (s) => html`
                <md-avatar
                  lang=${s.lang}
                  dir=${s.dir ?? 'ltr'}
                  name=${s.name}
                  label=${s.name}
                ></md-avatar>
                <span style="font: 400 14px/20px var(--md-sys-typescale-body-medium-font-family, system-ui); color: var(--md-sys-color-on-surface);" lang=${s.lang} dir=${s.dir ?? 'ltr'}>
                  ${s.name}
                </span>
                <span style="font: 500 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface-variant);">
                  ${s.lang} · ${s.note} → <code>${s.expected}</code>
                </span>
              `,
            )}
          </div>
        </div>

        <div>
          ${sectionLabel('Single-token names → one grapheme')}
          ${caption('When the name is a single token, only the first grapheme cluster is taken — works for stage names, mononyms, monograms and aksharas alike.')}
          ${row(html`
            <md-avatar lang="en" name="Cher"        label="Cher"></md-avatar>
            <md-avatar lang="en" name="Madonna"     label="Madonna"></md-avatar>
            <md-avatar lang="hi" name="कृष्ण"        label="कृष्ण"></md-avatar>
            <md-avatar lang="ta" name="அருண்"       label="அருண்"></md-avatar>
            <md-avatar lang="ja" name="桜"           label="桜"></md-avatar>
            <md-avatar lang="ko" name="박"           label="박"></md-avatar>
          `)}
        </div>

        <div>
          ${sectionLabel('Emoji & ZWJ sequences')}
          ${caption('A "letter" can be a multi-code-point emoji. Family ZWJ (`👨‍👩‍👧‍👦`), flag (`🇪🇺`), modifier (`👋🏽`) and skin-tone sequences are all counted as a **single** grapheme — `Intl.Segmenter` keeps them whole.')}
          ${row(html`
            <md-avatar initials="🚀"           label=${t(globals.locale, 'avatar.rocketProject')}></md-avatar>
            <md-avatar initials="🇪🇺"          label=${t(globals.locale, 'avatar.euTeam')}></md-avatar>
            <md-avatar initials="👋🏽"          label=${t(globals.locale, 'avatar.greeter')}></md-avatar>
            <md-avatar initials="👨‍👩‍👧‍👦"   label=${t(globals.locale, 'avatar.familyAccount')}></md-avatar>
            <md-avatar initials="🏳️‍🌈"        label=${t(globals.locale, 'avatar.prideChannel')}></md-avatar>
          `)}
        </div>

        <div>
          ${sectionLabel('Combining marks stay glued')}
          ${caption('Diacritics composed via combining code points (`E + ◌́` → `É`) count as one grapheme. Without `Intl.Segmenter` the avatar would render `E` and drop the accent; with it the accent is preserved.')}
          ${row(html`
            <md-avatar name="É̀mile Zola"      label="Émile Zola"></md-avatar>
            <md-avatar name="Łukasz Kowalski" label="Łukasz"></md-avatar>
            <md-avatar name="Søren Kierkegaard" label="Søren"></md-avatar>
            <md-avatar name="Müller Schmidt"  label="Müller"></md-avatar>
            <md-avatar name="Ñoño Pérez"      label="Ñoño Pérez"></md-avatar>
          `)}
        </div>

        <div>
          ${sectionLabel('RTL inside an LTR page')}
          ${caption('Set `dir="rtl"` on the avatar itself when an Arabic / Hebrew / Persian name appears in an otherwise LTR layout — the bidi algorithm renders the name in its correct visual order without affecting the rest of the page.')}
          <div style="display: flex; gap: 16px; align-items: center;" dir="ltr">
            <span style="font: 400 14px/20px system-ui;">${t(globals.locale, 'avatar.teamMembers')}</span>
            <md-avatar dir="rtl" lang="ar" name="إيدا لوفليس" label="إيدا لوفليس"></md-avatar>
            <md-avatar dir="rtl" lang="he" name="דנה כהן"     label="דנה כהן"></md-avatar>
            <md-avatar lang="en" name="Ada Lovelace"           label="Ada Lovelace"></md-avatar>
          </div>
        </div>

        <div>
          ${sectionLabel('Use with your i18n dictionary')}
          ${caption('Drive the avatar from whichever i18n layer you already use (`i18next`, `@formatjs/intl`, `react-intl`, `vue-i18n`, `$localize`, `svelte-i18n`, …). Pass the localized name into `name` / `label` / `alt`; the component handles the rest.')}
          <pre style="margin: 0; padding: 12px 14px; background: var(--md-sys-color-surface-container, #F3EDF7); border-radius: 8px; font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface);"><code>// React + react-intl
const fullName = intl.formatMessage(
  { id: 'profile.fullName' },
  { first: user.first, last: user.last }
);
&lt;md-avatar lang={intl.locale} dir={intl.locale === 'ar' ? 'rtl' : 'ltr'}
           name={fullName} label={fullName} /&gt;</code></pre>
        </div>
      `)}
    `;
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   11c. ACCESSIBILITY
   Showcases every accessibility code-path of the avatar: labelled image
   role, presentation fallback, image alt forwarding, group-level labels,
   status-dot pairing, and rich-content slotted icons. Each example
   surfaces the resolved ARIA so reviewers can verify what an assistive
   technology user actually hears.
   ═══════════════════════════════════════════════════════════════════════════ */
export const Accessibility: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`md-avatar` ships **opinionated, WCAG 2.1 AA-clean defaults** so the ' +
          'common case ("user/group identity tile") needs zero ARIA from the caller:<br><br>' +
          '• When any of `label`, `alt`, or `name` resolves to a non-empty string, ' +
          'the host gets `role="img"` + `aria-label` (in that priority order).<br>' +
          '• When **no** label is derivable, the host degrades to ' +
          '`role="presentation"` + `aria-hidden="true"` so it doesn\'t add noise ' +
          'next to a labelled control (e.g. a list-item that already has its own ' +
          'headline).<br>' +
          '• The internal `<img>` is **always** `aria-hidden="true"` with `alt=""` ' +
          '— the host carries the label, so screen readers don\'t double-announce.<br>' +
          '• Initials and the fallback `person` icon are both `aria-hidden="true"` ' +
          '— they\'re purely visual.<br>' +
          '• Tested with `axe-core` — zero violations across all variants and modes.',
      },
    },
  },
  render: (_args, { globals }) => html`
    <style>
      .a11y-card {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 12px 20px;
        padding: 16px;
        border: 1px solid var(--md-sys-color-outline-variant);
        border-radius: 12px;
        background: var(--md-sys-color-surface-container-low);
        align-items: center;
      }
      .a11y-card__notes {
        margin: 0;
        font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface-variant);
      }
      .a11y-card__notes strong {
        color: var(--md-sys-color-on-surface);
        font-weight: 600;
      }
      .a11y-status {
        position: relative;
        display: inline-flex;
      }
      .a11y-pre {
        margin: 0;
        padding: 12px 14px;
        background: var(--md-sys-color-surface-container);
        border-radius: 8px;
        font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace;
        color: var(--md-sys-color-on-surface);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
    </style>

    ${grid(html`
      <div>
        ${sectionLabel('1 · Labelled tile (default — `role="img"`)')}
        ${caption('A `name` is enough — the host is announced as "Ada Lovelace, image" by VoiceOver / NVDA / TalkBack. Initials are silent (`aria-hidden`), so the label isn\'t doubled.')}
        <div class="a11y-card">
          <md-avatar name="Ada Lovelace"></md-avatar>
          <p class="a11y-card__notes">
            <strong>host:</strong> role="img" · aria-label="Ada Lovelace"<br>
            <strong>initials:</strong> aria-hidden="true"<br>
            <strong>SR output:</strong> <em>"Ada Lovelace, image"</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('2 · Explicit `label` overrides')}
        ${caption('Use `label` when the visible initials are abbreviated or symbolic — the screen reader gets the full name, the eye gets the glyph.')}
        <div class="a11y-card">
          <md-avatar initials="JD" label="John Doe (administrator)"></md-avatar>
          <p class="a11y-card__notes">
            <strong>host:</strong> role="img" · aria-label="John Doe (administrator)"<br>
            <strong>SR output:</strong> <em>"John Doe (administrator), image"</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('3 · Image with `alt` fallback')}
        ${caption('When `src` is set, `alt` is mirrored onto both the host (as `aria-label`) **and** the internal `<img>` (as the native `alt` attribute) so a broken-image glyph still has a sighted-user caption. Crucially the img is also `aria-hidden="true"`, so AT only sees the host\'s single label — there\'s no double announcement.')}
        <div class="a11y-card">
          <md-avatar src="https://i.pravatar.cc/80?img=11" alt="Photo of Ada Lovelace"></md-avatar>
          <p class="a11y-card__notes">
            <strong>host:</strong> role="img" · aria-label="Photo of Ada Lovelace"<br>
            <strong>img:</strong> alt="Photo of Ada Lovelace" · aria-hidden="true" (silent to AT)<br>
            <strong>SR output:</strong> <em>"Photo of Ada Lovelace, image"</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('4 · Decorative — `role="presentation"`')}
        ${caption('When no label, alt or name can be derived, the avatar is hidden from AT entirely. Use this inside a list-item / button / link whose own headline already names the user — pairing a labelled tile next to a labelled control would announce the same name twice.')}
        <div class="a11y-card">
          <md-avatar></md-avatar>
          <p class="a11y-card__notes">
            <strong>host:</strong> role="presentation" · aria-hidden="true"<br>
            <strong>SR output:</strong> <em>(silent — fully decorative)</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('5 · Status dot pairing — use `md-status-dot`')}
        ${caption('Compose a presence indicator with the dedicated `md-status-dot` component. The dot is decorative by default (`role="presentation"` + `aria-hidden`) — encode the state in the avatar\'s `label` so screen-reader users hear the status without doubling.')}
        <div class="a11y-card">
          <span class="a11y-status">
            <md-avatar name="Ada Lovelace" label="Ada Lovelace, online"></md-avatar>
            <md-status-dot state="online"></md-status-dot>
          </span>
          <p class="a11y-card__notes">
            <strong>md-avatar:</strong> role="img" · aria-label="Ada Lovelace, online"<br>
            <strong>md-status-dot:</strong> role="presentation" · aria-hidden="true" (decorative by default)<br>
            <strong>SR output:</strong> <em>"Ada Lovelace, online, image"</em>
          </p>
        </div>
        <div style="display: flex; gap: 16px; padding-block-start: 12px; align-items: center;">
          <span class="a11y-status">
            <md-avatar name="Linus Torvalds" label="Linus Torvalds, away"></md-avatar>
            <md-status-dot state="away"></md-status-dot>
          </span>
          <span class="a11y-status">
            <md-avatar name="Grace Hopper" label="Grace Hopper, do not disturb"></md-avatar>
            <md-status-dot state="busy"></md-status-dot>
          </span>
        </div>
      </div>

      <div>
        ${sectionLabel('6 · Avatar group — wrapper label')}
        ${caption('A group of avatars is a single semantic unit. Mark each tile decorative (`color-from-name="false"` is unrelated — keep their visuals; just don\'t label individual tiles) and put one `aria-label` on the group wrapper that summarises the membership.')}
        <div class="a11y-card">
          <div role="group" aria-label="Pull request reviewers — Ada Lovelace, Linus Torvalds, Grace Hopper, plus 5 more" style="display: inline-flex; align-items: center;">
            <md-avatar name="Ada Lovelace"   aria-hidden="true" style="margin-inline-end: -12px; z-index: 4;"></md-avatar>
            <md-avatar name="Linus Torvalds" aria-hidden="true" style="margin-inline-end: -12px; z-index: 3;"></md-avatar>
            <md-avatar name="Grace Hopper"   aria-hidden="true" style="margin-inline-end: -12px; z-index: 2;"></md-avatar>
            <md-avatar initials="+5" color-from-name="false" aria-hidden="true" style="z-index: 1;"></md-avatar>
          </div>
          <p class="a11y-card__notes">
            <strong>group:</strong> role="group" · aria-label="Pull request reviewers — Ada Lovelace, Linus Torvalds, Grace Hopper, plus 5 more"<br>
            <strong>tiles:</strong> aria-hidden="true" each (silenced individually so the group label isn\'t echoed four times)<br>
            <strong>SR output:</strong> <em>"Pull request reviewers — Ada Lovelace, Linus Torvalds, Grace Hopper, plus 5 more, group"</em>
          </p>
        </div>
      </div>

      <div>
        ${sectionLabel('7 · Inside a labelled control (list-item / button)')}
        ${caption('When the avatar sits inside a row that already carries a label (a `md-list-item` headline, a profile-menu button, a chip), let the avatar be decorative. The list-item becomes the focusable, labelled element; the avatar is silent.')}
        <md-list label="Team" style="max-inline-size: 380px;">
          <md-list-item
            type="button"
            headline="Ada Lovelace"
            supporting-text=${t(globals.locale, 'avatar.online')}
            leading-avatar-name="Ada Lovelace"
            trailing-icon="chevron_right"
          ></md-list-item>
          <md-list-item
            type="button"
            headline="Linus Torvalds"
            supporting-text=${t(globals.locale, 'avatar.lastSeen')}
            leading-avatar="https://i.pravatar.cc/80?img=47"
            leading-avatar-alt="Linus Torvalds"
            leading-avatar-name="Linus Torvalds"
            trailing-icon="chevron_right"
          ></md-list-item>
        </md-list>
        <p style="margin: 8px 0 0; font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface-variant);">
          <strong>The list-item is the labelled control;</strong> the inner avatar is exposed as decorative so the row is read once: <em>"Ada Lovelace, online, button"</em>.
        </p>
      </div>

      <div>
        ${sectionLabel('8 · High-contrast / forced-colors')}
        ${caption('Under Windows high-contrast (or any `forced-colors: active` mode), the host swaps to system tokens (`ButtonFace` / `ButtonText`) and adds a 1 px outline so the tile is always distinguishable from its neighbours, regardless of palette.')}
        <pre class="a11y-pre">@media (forced-colors: active) {
  :host {
    --_container-color: ButtonFace;
    --_label-color:     ButtonText;
    --_outline-color:   ButtonText;
    --_outline-width:   1px;
  }
}</pre>
      </div>

      <div>
        ${sectionLabel('9 · Keyboard / focus — wrap in `md-button`')}
        ${caption('A bare `<md-avatar>` is **non-interactive** — no `role="button"`, no `tabindex`, no Enter/Space handlers. For a clickable identity chip, drop the avatar into the `leading-icon` slot of an `md-button` (or any other interactive component in the library: `md-icon-button`, `md-list-item type="button"`, `md-chip`). The button owns the focus ring, the ripple, the keyboard activation and the announced role; the avatar stays a pure presentational tile.')}
        ${row(html`
          <md-button variant="tonal" size="lg" aria-label="Open Ada Lovelace's profile">
            <md-avatar slot="leading-icon" size="small" name="Ada Lovelace" aria-hidden="true"></md-avatar>
            Ada Lovelace
          </md-button>
          <md-button variant="outlined" size="lg" aria-label="Switch account: Linus Torvalds">
            <md-avatar slot="leading-icon" size="small" src="https://i.pravatar.cc/48?img=47" alt="" aria-hidden="true"></md-avatar>
            ${t(globals.locale, 'avatar.switchAccount')}
          </md-button>
          <md-button variant="text" size="lg" aria-label="View profile: Grace Hopper" trailing-icon="chevron_right">
            <md-avatar slot="leading-icon" size="small" name="Grace Hopper" aria-hidden="true"></md-avatar>
            Grace Hopper
          </md-button>
        `)}
        <p style="margin: 8px 0 0; font: 400 12px/18px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--md-sys-color-on-surface-variant);">
          <strong>md-button:</strong> role="button" · aria-label="Open Ada Lovelace's profile" · keyboard activation (Enter / Space) and ripple<br>
          <strong>md-avatar:</strong> aria-hidden="true" (parent owns the label, focus ring, ripple)
        </p>
        <pre class="a11y-pre" style="margin-block-start: 12px;"><code>&lt;md-button variant="tonal" size="lg" aria-label="Open Ada Lovelace's profile"&gt;
  &lt;md-avatar
    slot="leading-icon"
    size="small"
    name="Ada Lovelace"
    aria-hidden="true"
  &gt;&lt;/md-avatar&gt;
  Ada Lovelace
&lt;/md-button&gt;</code></pre>
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   12. DARK THEME
   ═══════════════════════════════════════════════════════════════════════════ */
export const DarkTheme: Story = {
  render: () => html`
    ${row(html`
      <md-avatar src="https://i.pravatar.cc/80?img=11" alt="A"></md-avatar>
      <md-avatar name="Ada Lovelace" label="Ada Lovelace"></md-avatar>
      <md-avatar name="Linus Torvalds" label="Linus Torvalds"></md-avatar>
      <md-avatar name="Grace Hopper" label="Grace Hopper"></md-avatar>
      <md-avatar label="Fallback"></md-avatar>
    `)}
  `,
  decorators: [
    (story) => html`
      <div
        data-theme="dark"
        style="background: var(--md-sys-color-surface, #141218); padding: 24px; border-radius: 16px;"
      >
        ${story()}
      </div>
    `,
  ],
};

/* ═══════════════════════════════════════════════════════════════════════════
   13. CUSTOM CSS — custom properties + parts
   ═══════════════════════════════════════════════════════════════════════════ */
export const CustomCSS: Story = {
  render: () => html`
    <style>
      .brand { --md-avatar-container-color: #6750A4; --md-avatar-label-color: #FFFFFF; }
      .danger { --md-avatar-container-color: var(--md-sys-color-error); --md-avatar-label-color: var(--md-sys-color-on-error); }
      .pixelated::part(image) { image-rendering: pixelated; }
      .ring { --md-avatar-outline-color: var(--md-sys-color-primary); --md-avatar-outline-width: 3px; }
      .uppercase::part(initials) { text-transform: uppercase; letter-spacing: 0.1em; }
    </style>
    ${grid(html`
      <div>
        ${sectionLabel('Custom properties (per-instance)')}
        ${row(html`
          <md-avatar class="brand" color-from-name="false" name="Brand" label="Brand"></md-avatar>
          <md-avatar class="danger" color-from-name="false" initials="!" label="Danger"></md-avatar>
          <md-avatar style="--md-avatar-container-color: teal; --md-avatar-label-color: white;" color-from-name="false" name="Teal team" label="Teal team"></md-avatar>
        `)}
      </div>
      <div>
        ${sectionLabel('CSS Shadow Parts')}
        ${row(html`
          <md-avatar class="ring" src="https://i.pravatar.cc/80?img=5" alt="With ring"></md-avatar>
          <md-avatar class="uppercase" name="Ada Lovelace" label="Uppercase initials"></md-avatar>
          <md-avatar class="pixelated" src="https://i.pravatar.cc/24?img=12" alt="Pixelated"></md-avatar>
        `)}
      </div>
    `)}
  `,
};

/* ═══════════════════════════════════════════════════════════════════════════
   14. Intl.Segmenter FALLBACK (runtime path)
   `segmentGraphemes()` uses `Intl.Segmenter` when present and degrades to a
   `charAt()` loop on runtimes that lack it. Evergreen browsers always ship
   Segmenter, so the fallback is otherwise unreachable — here we temporarily
   remove it to exercise (and immediately restore) that branch.
   ═══════════════════════════════════════════════════════════════════════════ */
export const SegmenterFallback: Story = {
  name: 'Intl.Segmenter fallback',
  render: () => html`<md-avatar name="Ada Lovelace" label="Ada Lovelace"></md-avatar>`,
  play: async ({ canvasElement }) => {
    const avatar = await hydrateAvatar(canvasElement.querySelector('md-avatar') as AvatarEl);
    // Baseline with Segmenter present: two-token name → "AL".
    await waitFor(() => expect(initialsTextOf(avatar)).toBe('AL'));

    const IntlAny = Intl as unknown as { Segmenter?: unknown };
    const original = IntlAny.Segmenter;
    try {
      // Force the `typeof SegmenterCtor === 'function'` guard false → charAt() loop.
      IntlAny.Segmenter = undefined;
      avatar.name = 'Zoe Zebra'; // two tokens via charAt fallback → "ZZ"
      await waitFor(() => expect(initialsTextOf(avatar)).toBe('ZZ'));
      avatar.name = 'Xavier'; // single token via charAt fallback → "X"
      await waitFor(() => expect(initialsTextOf(avatar)).toBe('X'));
    } finally {
      IntlAny.Segmenter = original; // always restore the global
    }

    // After restoration the component still derives initials correctly.
    avatar.name = 'Grace Hopper';
    await waitFor(() => expect(initialsTextOf(avatar)).toBe('GH'));
  },
};
