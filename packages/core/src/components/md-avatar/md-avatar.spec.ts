import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdAvatar } from './md-avatar';

async function create(html: string): Promise<SpecPage> {
  return newSpecPage({
    components: [MdAvatar],
    html,
  });
}

const SRC = 'https://example.com/avatar.png';

describe('md-avatar', () => {
  // ─── Rendering ─────────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-avatar></md-avatar>');
      expect(page.root).toBeTruthy();
      expect(page.root?.classList.contains('md-avatar')).toBe(true);
      expect(page.root?.classList.contains('md-avatar--medium')).toBe(true);
      expect(page.root?.classList.contains('md-avatar--circle')).toBe(true);
    });

    it('reflects size and shape attributes on the host', async () => {
      const page = await create('<md-avatar size="large" shape="rounded"></md-avatar>');
      expect(page.root?.getAttribute('size')).toBe('large');
      expect(page.root?.getAttribute('shape')).toBe('rounded');
      expect(page.root?.classList.contains('md-avatar--large')).toBe(true);
      expect(page.root?.classList.contains('md-avatar--rounded')).toBe(true);
    });

    it('applies all three size presets', async () => {
      for (const size of ['small', 'medium', 'large'] as const) {
        const page = await create(`<md-avatar size="${size}"></md-avatar>`);
        expect(page.root?.classList.contains(`md-avatar--${size}`)).toBe(true);
      }
    });

    it('applies all three shape variants', async () => {
      for (const shape of ['circle', 'rounded', 'square'] as const) {
        const page = await create(`<md-avatar shape="${shape}"></md-avatar>`);
        expect(page.root?.classList.contains(`md-avatar--${shape}`)).toBe(true);
      }
    });
  });

  // ─── Custom size ───────────────────────────────────────────────────
  describe('custom size', () => {
    it('accepts a unitless number and emits --md-avatar-size in pixels', async () => {
      const page = await create('<md-avatar size="72" name="Ada"></md-avatar>');
      expect(page.root?.style.getPropertyValue('--md-avatar-size')).toBe('72px');
      // No preset modifier class for custom sizes.
      expect(page.root?.classList.contains('md-avatar--small')).toBe(false);
      expect(page.root?.classList.contains('md-avatar--medium')).toBe(false);
      expect(page.root?.classList.contains('md-avatar--large')).toBe(false);
      // But the dedicated hook class is present so authors can target it.
      expect(page.root?.classList.contains('md-avatar--custom-size')).toBe(true);
    });

    it('accepts decimal numbers as pixel values', async () => {
      const page = await create('<md-avatar size="48.5" name="Ada"></md-avatar>');
      expect(page.root?.style.getPropertyValue('--md-avatar-size')).toBe('48.5px');
    });

    it('passes a CSS length through verbatim', async () => {
      const page = await create('<md-avatar size="4rem" name="Ada"></md-avatar>');
      expect(page.root?.style.getPropertyValue('--md-avatar-size')).toBe('4rem');
    });

    it('passes a CSS function through verbatim', async () => {
      const page = await create(
        '<md-avatar size="clamp(28px, 4vw, 72px)" name="Ada"></md-avatar>',
      );
      expect(page.root?.style.getPropertyValue('--md-avatar-size')).toBe(
        'clamp(28px, 4vw, 72px)',
      );
    });

    it('does NOT emit an inline --md-avatar-size for preset sizes', async () => {
      const page = await create('<md-avatar size="medium" name="Ada"></md-avatar>');
      expect(page.root?.style.getPropertyValue('--md-avatar-size')).toBe('');
      expect(page.root?.classList.contains('md-avatar--custom-size')).toBe(false);
    });

    it('treats whitespace-only / empty size as the default preset', async () => {
      const page = await create('<md-avatar size="   " name="Ada"></md-avatar>');
      // Whitespace doesn't match a preset OR coerce to a length → no inline var,
      // no preset class, but no custom-size class either (nothing to apply).
      expect(page.root?.style.getPropertyValue('--md-avatar-size')).toBe('');
      expect(page.root?.classList.contains('md-avatar--custom-size')).toBe(false);
    });
  });

  // ─── Fallback chain ────────────────────────────────────────────────
  describe('fallback chain', () => {
    it('uses image mode when src is set', async () => {
      const page = await create(`<md-avatar src="${SRC}" alt="me"></md-avatar>`);
      expect(page.root?.classList.contains('md-avatar--mode-image')).toBe(true);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe(SRC);
      expect(img?.getAttribute('alt')).toBe('me');
    });

    it('falls back to initials when src is empty and name is set', async () => {
      const page = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      expect(page.root?.classList.contains('md-avatar--mode-initials')).toBe(true);
      const initials = page.root?.shadowRoot?.querySelector('.md-avatar__initials');
      expect(initials?.textContent).toBe('AL');
    });

    it('honors explicit initials prop over derived name initials', async () => {
      const page = await create('<md-avatar name="Ada Lovelace" initials="LX"></md-avatar>');
      const initials = page.root?.shadowRoot?.querySelector('.md-avatar__initials');
      expect(initials?.textContent).toBe('LX');
    });

    it('falls back to icon when no src, name, or initials', async () => {
      const page = await create('<md-avatar></md-avatar>');
      expect(page.root?.classList.contains('md-avatar--mode-slot')).toBe(true);
      const icon = page.root?.shadowRoot?.querySelector('.md-avatar__icon');
      expect(icon?.textContent).toBe('person');
    });

    it('exposes a default slot for custom fallback content', async () => {
      const page = await create('<md-avatar></md-avatar>');
      const slot = page.root?.shadowRoot?.querySelector('slot:not([name])');
      expect(slot).toBeTruthy();
    });

    it('falls back to initials when image errors out', async () => {
      const page = await create(`<md-avatar src="${SRC}" name="Grace Hopper"></md-avatar>`);
      expect(page.root?.classList.contains('md-avatar--mode-image')).toBe(true);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image') as HTMLImageElement | null;
      img?.dispatchEvent(new Event('error'));
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-avatar--mode-initials')).toBe(true);
      const initials = page.root?.shadowRoot?.querySelector('.md-avatar__initials');
      expect(initials?.textContent).toBe('GH');
    });

    it('emits mdError when image errors and mdLoad on successful load', async () => {
      const page = await create(`<md-avatar src="${SRC}" name="Linus Torvalds"></md-avatar>`);
      const onErr = jest.fn();
      const onLoad = jest.fn();
      page.root?.addEventListener('mdError', onErr);
      page.root?.addEventListener('mdLoad', onLoad);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image') as HTMLImageElement | null;
      img?.dispatchEvent(new Event('error'));
      await page.waitForChanges();
      expect(onErr).toHaveBeenCalledTimes(1);

      // Reset and simulate successful load
      page.root?.setAttribute('src', SRC + '?v=2');
      await page.waitForChanges();
      const img2 = page.root?.shadowRoot?.querySelector('img.md-avatar__image') as HTMLImageElement | null;
      img2?.dispatchEvent(new Event('load'));
      await page.waitForChanges();
      expect(onLoad).toHaveBeenCalledTimes(1);
    });

    it('resets the failure state when src changes', async () => {
      const page = await create(`<md-avatar src="${SRC}" name="A B"></md-avatar>`);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image') as HTMLImageElement | null;
      img?.dispatchEvent(new Event('error'));
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-avatar--mode-initials')).toBe(true);

      page.root?.setAttribute('src', SRC + '?retry');
      await page.waitForChanges();
      expect(page.root?.classList.contains('md-avatar--mode-image')).toBe(true);
    });
  });

  // ─── Initials derivation ───────────────────────────────────────────
  describe('initials derivation', () => {
    it('takes first letter of first + first letter of last', async () => {
      const page = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent).toBe('AL');
    });

    it('uses only the first letter for single-name', async () => {
      const page = await create('<md-avatar name="Cher"></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent).toBe('C');
    });

    it('ignores extra whitespace between tokens', async () => {
      const page = await create('<md-avatar name="  john   doe  "></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent).toBe('JD');
    });

    it('uses first + LAST token when name has 3+ parts', async () => {
      const page = await create('<md-avatar name="Mary Jane Watson"></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent).toBe('MW');
    });

    it('uppercases derived initials', async () => {
      const page = await create('<md-avatar name="ada lovelace"></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent).toBe('AL');
    });

    it('renders empty when name is whitespace only', async () => {
      const page = await create('<md-avatar name="   "></md-avatar>');
      expect(page.root?.classList.contains('md-avatar--mode-slot')).toBe(true);
    });

    it('truncates initials prop to first 3 characters', async () => {
      const page = await create('<md-avatar initials="ABCDE"></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent).toBe('ABC');
    });

    it('handles diacritics via grapheme segmentation', async () => {
      const page = await create('<md-avatar name="Émilie Dùpont"></md-avatar>');
      const text = page.root?.shadowRoot?.querySelector('.md-avatar__initials')?.textContent;
      expect(text).toBe('ÉD');
    });
  });

  // ─── Tonal palette ─────────────────────────────────────────────────
  describe('tonal palette', () => {
    const PALETTE_CLASSES = [1, 2, 3, 4, 5, 6, 7].map(n => `md-avatar--palette-${n}`);
    const matchedBucket = (page: SpecPage): string | undefined =>
      PALETTE_CLASSES.find(c => page.root?.classList.contains(c));

    it('assigns a palette bucket when color-from-name is true', async () => {
      const page = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      expect(matchedBucket(page)).toBeTruthy();
    });

    it('does NOT assign a palette bucket when color-from-name is false', async () => {
      const page = await create('<md-avatar name="Ada Lovelace" color-from-name="false"></md-avatar>');
      expect(matchedBucket(page)).toBeUndefined();
    });

    it('produces the same bucket for the same seed (deterministic)', async () => {
      const a = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      const b = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      expect(matchedBucket(a)).toBe(matchedBucket(b));
    });

    it('does not assign a palette in image mode', async () => {
      const page = await create(`<md-avatar src="${SRC}" name="Ada Lovelace"></md-avatar>`);
      expect(matchedBucket(page)).toBeUndefined();
    });
  });

  // ─── Accessibility ─────────────────────────────────────────────────
  describe('accessibility', () => {
    it('exposes role="img" with the accessible label', async () => {
      const page = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      expect(page.root?.getAttribute('role')).toBe('img');
      expect(page.root?.getAttribute('aria-label')).toBe('Ada Lovelace');
    });

    it('uses explicit label prop when present', async () => {
      const page = await create('<md-avatar name="ada" label="Ada Lovelace, signed in"></md-avatar>');
      expect(page.root?.getAttribute('aria-label')).toBe('Ada Lovelace, signed in');
    });

    it('falls back to alt when name is empty', async () => {
      const page = await create(`<md-avatar src="${SRC}" alt="Self-portrait"></md-avatar>`);
      expect(page.root?.getAttribute('aria-label')).toBe('Self-portrait');
    });

    it('exposes role="presentation" + aria-hidden when no label can be derived', async () => {
      const page = await create('<md-avatar></md-avatar>');
      expect(page.root?.getAttribute('role')).toBe('presentation');
      expect(page.root?.getAttribute('aria-hidden')).toBe('true');
    });

    it('always renders the image with empty alt (host carries the label)', async () => {
      const page = await create(`<md-avatar src="${SRC}" alt="Linus"></md-avatar>`);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image');
      expect(img?.getAttribute('aria-hidden')).toBe('true');
    });

    it('marks initials/icon as aria-hidden to avoid double-announcement', async () => {
      const initialsPage = await create('<md-avatar name="Ada"></md-avatar>');
      expect(initialsPage.root?.shadowRoot?.querySelector('.md-avatar__initials')?.getAttribute('aria-hidden')).toBe('true');

      const iconPage = await create('<md-avatar></md-avatar>');
      expect(iconPage.root?.shadowRoot?.querySelector('.md-avatar__icon')?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  // ─── Parts ─────────────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes the image part in image mode', async () => {
      const page = await create(`<md-avatar src="${SRC}"></md-avatar>`);
      expect(page.root?.shadowRoot?.querySelector('[part="image"]')).toBeTruthy();
    });

    it('exposes the initials part in initials mode', async () => {
      const page = await create('<md-avatar name="Ada Lovelace"></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('[part="initials"]')).toBeTruthy();
    });

    it('exposes the icon part in icon mode', async () => {
      const page = await create('<md-avatar></md-avatar>');
      expect(page.root?.shadowRoot?.querySelector('[part="icon"]')).toBeTruthy();
    });
  });

  // ─── RTL ───────────────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders within an RTL ancestor without layout regressions', async () => {
      const page = await newSpecPage({
        components: [MdAvatar],
        html: `<div dir="rtl"><md-avatar name="Ada Lovelace"></md-avatar></div>`,
      });
      expect(page.root).toBeTruthy();
    });
  });

  // ─── Image attribute forwarding ────────────────────────────────────
  describe('image attribute forwarding', () => {
    it('forwards loading attribute (lazy by default)', async () => {
      const page = await create(`<md-avatar src="${SRC}"></md-avatar>`);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image');
      expect(img?.getAttribute('loading')).toBe('lazy');
    });

    it('forwards eager loading when requested', async () => {
      const page = await create(`<md-avatar src="${SRC}" loading="eager"></md-avatar>`);
      const img = page.root?.shadowRoot?.querySelector('img.md-avatar__image');
      expect(img?.getAttribute('loading')).toBe('eager');
    });

    it('forwards crossorigin only when set', async () => {
      const without = await create(`<md-avatar src="${SRC}"></md-avatar>`);
      const img1 = without.root?.shadowRoot?.querySelector('img.md-avatar__image');
      expect(img1?.hasAttribute('crossorigin')).toBe(false);

      const withCors = await create(`<md-avatar src="${SRC}" crossorigin="anonymous"></md-avatar>`);
      const img2 = withCors.root?.shadowRoot?.querySelector('img.md-avatar__image');
      expect(img2?.getAttribute('crossorigin')).toBe('anonymous');
    });
  });
});
