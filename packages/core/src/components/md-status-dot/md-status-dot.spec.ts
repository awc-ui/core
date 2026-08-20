import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdStatusDot } from './md-status-dot';

async function create(html: string): Promise<SpecPage> {
  return newSpecPage({
    components: [MdStatusDot],
    html,
  });
}

describe('md-status-dot', () => {
  // ─── Rendering ─────────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults (neutral, medium, not live)', async () => {
      const page = await create('<md-status-dot></md-status-dot>');
      expect(page.root).toBeTruthy();
      expect(page.root?.classList.contains('md-status-dot')).toBe(true);
      expect(page.root?.classList.contains('md-status-dot--neutral')).toBe(true);
      expect(page.root?.classList.contains('md-status-dot--medium')).toBe(true);
      expect(page.root?.classList.contains('md-status-dot--live')).toBe(false);
    });

    it('reflects state, size and live attributes on the host', async () => {
      const page = await create(
        '<md-status-dot state="online" size="large" live></md-status-dot>',
      );
      expect(page.root?.getAttribute('state')).toBe('online');
      expect(page.root?.getAttribute('size')).toBe('large');
      expect(page.root?.hasAttribute('live')).toBe(true);
    });

    it('renders no inner content (the dot is a styled leaf)', async () => {
      const page = await create('<md-status-dot></md-status-dot>');
      // Shadow root exists, but it should have no element children — pure CSS-driven leaf.
      expect(page.root?.shadowRoot?.children.length ?? 0).toBe(0);
    });
  });

  // ─── States ─────────────────────────────────────────────────────────
  describe('states', () => {
    const states = ['online', 'away', 'busy', 'offline', 'invisible', 'neutral'] as const;

    it.each(states)('applies the md-status-dot--%s modifier class', async (state) => {
      const page = await create(`<md-status-dot state="${state}"></md-status-dot>`);
      expect(page.root?.classList.contains(`md-status-dot--${state}`)).toBe(true);
    });

    it('only applies one state class at a time', async () => {
      const page = await create('<md-status-dot state="online"></md-status-dot>');
      const stateClasses = states.filter((s) => page.root?.classList.contains(`md-status-dot--${s}`));
      expect(stateClasses).toEqual(['online']);
    });
  });

  // ─── Sizes ──────────────────────────────────────────────────────────
  describe('sizes', () => {
    const sizes = ['small', 'medium', 'large'] as const;

    it.each(sizes)('applies the md-status-dot--%s size class', async (size) => {
      const page = await create(`<md-status-dot size="${size}"></md-status-dot>`);
      expect(page.root?.classList.contains(`md-status-dot--${size}`)).toBe(true);
    });
  });

  // ─── Live indicator ─────────────────────────────────────────────────
  describe('live indicator', () => {
    it('adds md-status-dot--live when live is true', async () => {
      const page = await create('<md-status-dot live></md-status-dot>');
      expect(page.root?.classList.contains('md-status-dot--live')).toBe(true);
    });

    it('omits md-status-dot--live when live is unset', async () => {
      const page = await create('<md-status-dot></md-status-dot>');
      expect(page.root?.classList.contains('md-status-dot--live')).toBe(false);
    });

    it('reflects live boolean attribute on the host', async () => {
      const page = await create('<md-status-dot live></md-status-dot>');
      expect(page.root?.hasAttribute('live')).toBe(true);
    });
  });

  // ─── Accessibility ──────────────────────────────────────────────────
  describe('accessibility', () => {
    it('is decorative by default (role="presentation" + aria-hidden)', async () => {
      const page = await create('<md-status-dot state="online"></md-status-dot>');
      expect(page.root?.getAttribute('role')).toBe('presentation');
      expect(page.root?.getAttribute('aria-hidden')).toBe('true');
      expect(page.root?.getAttribute('aria-label')).toBeNull();
    });

    it('promotes to role="img" when a static label is set', async () => {
      const page = await create('<md-status-dot state="online" label="Online"></md-status-dot>');
      expect(page.root?.getAttribute('role')).toBe('img');
      expect(page.root?.getAttribute('aria-label')).toBe('Online');
      expect(page.root?.hasAttribute('aria-hidden')).toBe(false);
    });

    it('promotes to role="status" (live region) when labelled AND live', async () => {
      const page = await create('<md-status-dot state="online" label="Online" live></md-status-dot>');
      expect(page.root?.getAttribute('role')).toBe('status');
      expect(page.root?.getAttribute('aria-label')).toBe('Online');
      expect(page.root?.hasAttribute('aria-hidden')).toBe(false);
    });

    it('treats whitespace-only label as empty (decorative)', async () => {
      const page = await create('<md-status-dot label="   "></md-status-dot>');
      expect(page.root?.getAttribute('role')).toBe('presentation');
      expect(page.root?.getAttribute('aria-hidden')).toBe('true');
    });

    it('reading-order: label takes precedence over default decorative behavior', async () => {
      const page = await create(
        '<md-status-dot state="busy" label="Do not disturb until 3pm"></md-status-dot>',
      );
      expect(page.root?.getAttribute('aria-label')).toBe('Do not disturb until 3pm');
    });

    it('marks `md-status-dot--labelled` modifier when labelled', async () => {
      const page = await create('<md-status-dot label="Online"></md-status-dot>');
      expect(page.root?.classList.contains('md-status-dot--labelled')).toBe(true);
    });
  });

  // ─── RTL ────────────────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders inside an RTL ancestor without layout regressions', async () => {
      const page = await newSpecPage({
        components: [MdStatusDot],
        html: '<div dir="rtl"><md-status-dot state="online"></md-status-dot></div>',
      });
      expect(page.root).toBeTruthy();
      expect(page.root?.classList.contains('md-status-dot--online')).toBe(true);
    });
  });

  // ─── Custom CSS API ─────────────────────────────────────────────────
  describe('custom CSS API', () => {
    it('accepts --md-status-dot-color override on the host', async () => {
      const page = await create(
        '<md-status-dot state="online" style="--md-status-dot-color: rebeccapurple;"></md-status-dot>',
      );
      expect(page.root?.style.getPropertyValue('--md-status-dot-color')).toBe('rebeccapurple');
    });

    it('accepts --md-status-dot-size override on the host', async () => {
      const page = await create(
        '<md-status-dot style="--md-status-dot-size: 24px;"></md-status-dot>',
      );
      expect(page.root?.style.getPropertyValue('--md-status-dot-size')).toBe('24px');
    });

    it('accepts --md-status-dot-outline-color override on the host', async () => {
      const page = await create(
        '<md-status-dot style="--md-status-dot-outline-color: black;"></md-status-dot>',
      );
      expect(page.root?.style.getPropertyValue('--md-status-dot-outline-color')).toBe('black');
    });
  });

  // ─── Combined props ─────────────────────────────────────────────────
  describe('combined props', () => {
    it('produces a coherent class set when all props are set', async () => {
      const page = await create(
        '<md-status-dot state="busy" size="large" live label="Streaming live"></md-status-dot>',
      );
      const cl = page.root?.classList;
      expect(cl?.contains('md-status-dot')).toBe(true);
      expect(cl?.contains('md-status-dot--busy')).toBe(true);
      expect(cl?.contains('md-status-dot--large')).toBe(true);
      expect(cl?.contains('md-status-dot--live')).toBe(true);
      expect(cl?.contains('md-status-dot--labelled')).toBe(true);
      expect(page.root?.getAttribute('role')).toBe('status');
      expect(page.root?.getAttribute('aria-label')).toBe('Streaming live');
    });
  });
});
