import { newSpecPage } from '@stencil/core/testing';
import { MdProgressIndicator } from './md-progress-indicator';

describe('md-progress-indicator', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdProgressIndicator], html });
  }

  const shadow = (page: { root?: Element | null }, sel: string) =>
    page.root?.shadowRoot?.querySelector(sel) ?? null;
  const inst = (page: { rootInstance?: unknown }) =>
    page.rootInstance as unknown as Record<string, unknown>;

  // ── Rendering ────────────────────────────────────────────
  describe('rendering', () => {
    it('renders with defaults (linear)', async () => {
      const page = await create('<md-progress-indicator></md-progress-indicator>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-progress-indicator');
      expect(page.root).toHaveClass('md-progress-indicator--linear');
    });

    it('renders linear variant', async () => {
      const page = await create('<md-progress-indicator variant="linear"></md-progress-indicator>');
      expect(page.root).toHaveClass('md-progress-indicator--linear');
      expect(shadow(page, '.md-progress-indicator__linear')).toBeTruthy();
    });

    it('renders circular variant', async () => {
      const page = await create('<md-progress-indicator variant="circular"></md-progress-indicator>');
      expect(page.root).toHaveClass('md-progress-indicator--circular');
      expect(shadow(page, '.md-progress-indicator__circular')).toBeTruthy();
    });

    it('applies indeterminate class', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      expect(page.root).toHaveClass('md-progress-indicator--indeterminate');
    });

    it('applies wave class', async () => {
      const page = await create('<md-progress-indicator wave></md-progress-indicator>');
      expect(page.root).toHaveClass('md-progress-indicator--wave');
    });

    it('applies four-color class', async () => {
      const page = await create('<md-progress-indicator variant="circular" four-color></md-progress-indicator>');
      expect(page.root).toHaveClass('md-progress-indicator--four-color');
    });
  });

  // ── Accessibility ─────────────────────────────────────────
  describe('accessibility', () => {
    it('has role=progressbar', async () => {
      const page = await create('<md-progress-indicator></md-progress-indicator>');
      expect(page.root?.getAttribute('role')).toBe('progressbar');
    });

    it('sets aria-valuemin to 0', async () => {
      const page = await create('<md-progress-indicator></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuemin')).toBe('0');
    });

    it('sets aria-valuemax to max (default 100)', async () => {
      const page = await create('<md-progress-indicator></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('100');
    });

    it('sets aria-valuemax to the custom max (not hardcoded 100)', async () => {
      const page = await create('<md-progress-indicator max="10" value="3"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('10');
    });

    it('sets aria-valuenow to the raw value (not a 0–100 percentage)', async () => {
      const page = await create('<md-progress-indicator value="3" max="10"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('3');
    });

    it('clamps aria-valuenow into [0, max]', async () => {
      const over = await create('<md-progress-indicator value="150" max="100"></md-progress-indicator>');
      expect(over.root?.getAttribute('aria-valuenow')).toBe('100');
      const under = await create('<md-progress-indicator value="-10"></md-progress-indicator>');
      expect(under.root?.getAttribute('aria-valuenow')).toBe('0');
    });

    it('omits aria-valuenow when indeterminate', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuenow')).toBeNull();
    });

    it('sets aria-label from label prop', async () => {
      const page = await create('<md-progress-indicator label="Loading files"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-label')).toBe('Loading files');
    });

    it('omits aria-label when label is emptied', async () => {
      const page = await create('<md-progress-indicator label=""></md-progress-indicator>');
      expect(page.root?.hasAttribute('aria-label')).toBe(false);
    });

    it('has default label "Progress"', async () => {
      const page = await create('<md-progress-indicator></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-label')).toBe('Progress');
    });

    it('sanitizes a non-positive max to 0 (keeps ARIA range valid)', async () => {
      const page = await create('<md-progress-indicator max="0" value="2"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('0');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('0');
    });

    it('guards against NaN from non-numeric value/max', async () => {
      const page = await create('<md-progress-indicator value="abc" max="xyz"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuemax')).toBe('0');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('0');
    });

    it('omits aria-valuenow for indeterminate circular', async () => {
      const page = await create('<md-progress-indicator variant="circular" indeterminate label="Loading"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuenow')).toBeNull();
    });
  });

  // ── Linear determinate ────────────────────────────────────
  describe('linear determinate', () => {
    it('renders active indicator with correct width', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const active = shadow(page, '.md-progress-indicator__active') as HTMLElement;
      expect(active).toBeTruthy();
      expect(active.style.getPropertyValue('--_fill-width')).toBe('60%');
    });

    it('renders track for partial progress', async () => {
      const page = await create('<md-progress-indicator value="50"></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__track')).toBeTruthy();
    });

    it('track element is always mounted (rAF-driven — stays in DOM at 100%)', async () => {
      const page = await create('<md-progress-indicator value="100"></md-progress-indicator>');
      // The flat linear track is now always mounted and driven per-frame by updateLinearFlat()
      // (same as the wavy variant). The element exists; its --_track-start pushes it off-screen.
      expect(shadow(page, '.md-progress-indicator__track')).toBeTruthy();
    });

    it('track carries the --determinate modifier class', async () => {
      const page = await create('<md-progress-indicator value="50"></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__track--determinate')).toBeTruthy();
    });

    it('track start uses a fixed gap token (not coupled to thickness)', async () => {
      const page = await create('<md-progress-indicator value="50" thickness="12"></md-progress-indicator>');
      const track = shadow(page, '.md-progress-indicator__track') as HTMLElement;
      expect(track.style.getPropertyValue('--_track-start')).toContain('var(--_gap)');
      expect(page.root?.style.getPropertyValue('--_gap')).toBe('');
    });

    it('shows the stop indicator across ALL determinate states (incl. 0% and 100%)', async () => {
      for (const v of [0, 50, 100]) {
        const page = await create(`<md-progress-indicator value="${v}"></md-progress-indicator>`);
        expect(shadow(page, '.md-progress-indicator__stop')).toBeTruthy();
      }
    });

    it('does not render a stop indicator when indeterminate', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__stop')).toBeNull();
    });
  });

  // ── No buffer (removed in M3 2024) ────────────────────────
  describe('buffer removed', () => {
    it('does not expose a buffer prop on the instance', async () => {
      const page = await create('<md-progress-indicator value="30"></md-progress-indicator>');
      expect((page.rootInstance as Record<string, unknown>).buffer).toBeUndefined();
    });

    it('never renders a buffer element', async () => {
      const page = await create('<md-progress-indicator value="30" buffer="60"></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__buffer')).toBeNull();
    });
  });

  // ── Linear indeterminate ──────────────────────────────────
  describe('linear indeterminate', () => {
    it('renders two animated bars', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      expect(page.root?.shadowRoot?.querySelectorAll('.md-progress-indicator__bar').length).toBe(2);
    });

    it('renders primary and secondary bars', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__bar--primary')).toBeTruthy();
      expect(shadow(page, '.md-progress-indicator__bar--secondary')).toBeTruthy();
    });

    it('renders a full-width track', async () => {
      const page = await create('<md-progress-indicator indeterminate></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__track--full')).toBeTruthy();
    });
  });

  // ── Wave (linear) ─────────────────────────────────────────
  describe('wave (linear)', () => {
    it('renders a <path> element as the active indicator for wave determinate', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      // Wave determinate draws a filled SVG path, not a masked <div>
      expect(shadow(page, '.md-progress-indicator__linear-wave-path')).toBeTruthy();
    });

    it('wave SVG path is empty at 0% (no fill yet)', async () => {
      const page = await create('<md-progress-indicator wave value="0"></md-progress-indicator>');
      const path = shadow(page, '.md-progress-indicator__linear-wave-path') as Element;
      expect(path).toBeTruthy();
      expect(path.getAttribute('d') ?? '').toBe('');
    });

    it('sets the wave mask custom property', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      const mask = page.root?.style.getPropertyValue('--_wave-mask');
      expect(mask).toContain('url(');
      expect(mask).toContain('data:image/svg+xml');
    });

    it('sets wave mask size from default wavelength (40) and fixed 10dp height', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      expect(page.root?.style.getPropertyValue('--_wave-mask-size')).toBe('40px 10px');
    });

    it('wave linear indeterminate (JS-draw mode) renders ghost bars with an SVG overlay', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      // Ghost bars drive the CSS position/scale; the SVG paths are drawn imperatively
      expect(shadow(page, '.md-progress-indicator__bar-inner--ghost')).toBeTruthy();
      expect(shadow(page, '.md-progress-indicator__linear-wave-svg')).toBeTruthy();
      expect(shadow(page, '.md-progress-indicator__track--full')).toBeTruthy();
    });

    it('wave linear indeterminate uses the linear default wavelength (40px, h=10px)', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      // linear wl=40, h=2*3+4=10
      expect(page.root?.style.getPropertyValue('--_wave-mask-size')).toBe('40px 10px');
    });

    it('wave travel duration is 1000ms at default speed (1 wavelength/sec, wl=40)', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      expect(page.root?.style.getPropertyValue('--_wave-duration')).toBe('1000ms');
    });

    it('honors custom wave-amplitude and wave-length overrides', async () => {
      const page = await create(
        '<md-progress-indicator wave wave-amplitude="5" wave-length="60" value="50"></md-progress-indicator>',
      );
      // height = 2*5 + thickness(4) = 14
      expect(page.root?.style.getPropertyValue('--_wave-mask-size')).toBe('60px 14px');
    });

    it('scales the travel duration with a custom wave-speed', async () => {
      // wavelength 40 / speed 80 = 0.5s = 500ms
      const page = await create(
        '<md-progress-indicator wave wave-length="40" wave-speed="80" value="50"></md-progress-indicator>',
      );
      expect(page.root?.style.getPropertyValue('--_wave-duration')).toBe('500ms');
    });

    it('removes wave custom properties when wave is off', async () => {
      const page = await create('<md-progress-indicator value="50"></md-progress-indicator>');
      expect(page.root?.style.getPropertyValue('--_wave-mask')).toBe('');
    });
  });

  // ── Wave amplitude ────────────────────────────────────────
  describe('wave amplitude', () => {
    const amp = (page: { rootInstance?: unknown }) =>
      (page.rootInstance as unknown as { amplitudeTarget: number }).amplitudeTarget;

    it('is full (1) for mid-range determinate progress', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      expect(amp(page)).toBe(1);
    });

    it('is full (1) near 0% — no endpoint flattening in the current spec', async () => {
      const page = await create('<md-progress-indicator wave value="5"></md-progress-indicator>');
      expect(amp(page)).toBe(1);
    });

    it('is full (1) near 100% — no endpoint flattening in the current spec', async () => {
      const page = await create('<md-progress-indicator wave value="97"></md-progress-indicator>');
      expect(amp(page)).toBe(1);
    });

    it('is 0 when value is exactly 0 (no progress → no wave)', async () => {
      const page = await create('<md-progress-indicator wave value="0"></md-progress-indicator>');
      expect(amp(page)).toBe(0);
    });

    it('is full (1) for indeterminate wave regardless of value', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      expect(amp(page)).toBe(1);
    });

    it('is 0 when wave is disabled', async () => {
      const page = await create('<md-progress-indicator value="50"></md-progress-indicator>');
      expect(amp(page)).toBe(0);
    });

    it('is 0 when reducedMotion is true', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { reducedMotion: boolean; amplitudeTarget: number };
      i.reducedMotion = true;
      expect(i.amplitudeTarget).toBe(0);
    });
  });

  // ── Thickness & sizing ────────────────────────────────────
  describe('thickness & sizing', () => {
    it('sets the thickness custom property', async () => {
      const page = await create('<md-progress-indicator thickness="8"></md-progress-indicator>');
      expect(page.root?.style.getPropertyValue('--_thickness')).toBe('8px');
    });

    it('linear height equals thickness without wave', async () => {
      const page = await create('<md-progress-indicator thickness="8"></md-progress-indicator>');
      expect(page.root?.style.getPropertyValue('--_linear-height')).toBe('8px');
    });

    it('linear wave height = 2*amplitude + thickness', async () => {
      const page = await create('<md-progress-indicator wave thickness="8"></md-progress-indicator>');
      // 2*3 + 8 = 14
      expect(page.root?.style.getPropertyValue('--_linear-height')).toBe('14px');
    });
  });

  // ── Circular size clamping ────────────────────────────────
  describe('circular size clamping', () => {
    it('clamps size below 24dp up to the M3 minimum', async () => {
      const page = await create('<md-progress-indicator variant="circular" size="10"></md-progress-indicator>');
      expect(shadow(page, 'svg')?.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(page.root?.style.getPropertyValue('--_size')).toBe('24px');
    });

    it('clamps size above 240dp down to the M3 maximum', async () => {
      const page = await create('<md-progress-indicator variant="circular" size="300"></md-progress-indicator>');
      expect(shadow(page, 'svg')?.getAttribute('viewBox')).toBe('0 0 240 240');
      expect(page.root?.style.getPropertyValue('--_size')).toBe('240px');
    });

    it('auto size defaults to 40dp (non-wavy)', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="50"></md-progress-indicator>');
      expect(shadow(page, 'svg')?.getAttribute('viewBox')).toBe('0 0 40 40');
      expect(page.root?.style.getPropertyValue('--_size')).toBe('40px');
    });

    it('auto size defaults to 48dp when wavy', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      expect(shadow(page, 'svg')?.getAttribute('viewBox')).toBe('0 0 48 48');
      expect(page.root?.style.getPropertyValue('--_size')).toBe('48px');
    });

    it('honors an explicit size within range', async () => {
      const page = await create('<md-progress-indicator variant="circular" size="64"></md-progress-indicator>');
      expect(shadow(page, 'svg')?.getAttribute('viewBox')).toBe('0 0 64 64');
      expect(page.root?.style.getPropertyValue('--_size')).toBe('64px');
    });
  });

  // ── Circular flat determinate ─────────────────────────────
  describe('circular flat determinate', () => {
    it('renders track and active circles', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__circular-track')).toBeTruthy();
      expect(shadow(page, '.md-progress-indicator__circular-active')).toBeTruthy();
    });

    it('uses round caps on the active arc', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__circular-active')?.getAttribute('stroke-linecap')).toBe('round');
    });

    it('sets stroke-dasharray for determinate progress', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="50"></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__circular-active')?.getAttribute('stroke-dasharray')).toBeTruthy();
    });

    it('omits the inline stroke-dasharray for indeterminate (CSS-driven)', async () => {
      const page = await create('<md-progress-indicator variant="circular" indeterminate></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__circular-active')?.getAttribute('stroke-dasharray')).toBeNull();
    });

    it('indeterminate track uses the --spinner modifier class', async () => {
      const page = await create('<md-progress-indicator variant="circular" indeterminate></md-progress-indicator>');
      expect(shadow(page, '.md-progress-indicator__circular-track--spinner')).toBeTruthy();
    });

    it('track element is ALWAYS mounted for determinate (never removed from DOM)', async () => {
      for (const v of [0, 50, 90, 100]) {
        const page = await create(`<md-progress-indicator variant="circular" value="${v}"></md-progress-indicator>`);
        expect(shadow(page, '.md-progress-indicator__circular-track--determinate')).toBeTruthy();
      }
    });

    it('track is visible (opacity not 0) at partial progress within gap range', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="50"></md-progress-indicator>');
      const tr = shadow(page, '.md-progress-indicator__circular-track--determinate') as HTMLElement;
      expect(tr.style.opacity).not.toBe('0');
    });

    it('track is hidden (opacity 0) when progress leaves no room for the gap', async () => {
      // At 90% the track no longer fits → opacity should be 0 (not removed from DOM)
      const page = await create('<md-progress-indicator variant="circular" value="90"></md-progress-indicator>');
      const tr = shadow(page, '.md-progress-indicator__circular-track--determinate') as HTMLElement;
      expect(tr.style.opacity).toBe('0');
    });

    it('track dashoffset starts at f + idealGap (constant 4dp visual gap)', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60" thickness="4"></md-progress-indicator>');
      const tr = shadow(page, '.md-progress-indicator__circular-track--determinate') as Element;
      const offset = parseFloat(tr.getAttribute('stroke-dashoffset') ?? '0');
      // r=(40-4)/2=18, C=2π*18≈113.097, idealGap=(4+4)/C≈0.07074
      const r = (40 - 4) / 2;
      const C = 2 * Math.PI * r;
      const idealGap = (4 + 4) / C;
      expect(offset).toBeCloseTo(-(0.6 + idealGap), 3);
    });
  });

  // ── Circular flat completion ──────────────────────────────
  describe('circular flat completion', () => {
    it('renders a completion-path element (empty d in steady state)', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="50"></md-progress-indicator>');
      const path = shadow(page, '.md-progress-indicator__circular-active-path');
      expect(path).toBeTruthy();
      expect(path!.getAttribute('d') ?? '').toBe('');
    });

    it('terminal track state: active circle hidden, track is a full ring, path empty', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { _completedTrack: boolean };
      i._completedTrack = true;
      await page.waitForChanges();

      const active = shadow(page, '.md-progress-indicator__circular-active') as HTMLElement;
      expect(active.style.opacity).toBe('0');

      const tr = shadow(page, '.md-progress-indicator__circular-track--determinate') as Element;
      expect(tr.getAttribute('stroke-dasharray')).toBeFalsy();

      const completionPath = shadow(page, '.md-progress-indicator__circular-active-path') as Element;
      expect(completionPath.getAttribute('d') ?? '').toBe('');
    });

    it('terminal track state: no --complete or --completing host class (indicator stays visible)', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { _completedTrack: boolean };
      i._completedTrack = true;
      await page.waitForChanges();

      expect(page.root).not.toHaveClass('md-progress-indicator--complete');
      expect(page.root).not.toHaveClass('md-progress-indicator--completing');
    });
  });

  // ── complete prop guards ──────────────────────────────────
  describe('complete prop guards', () => {
    it('no-op when indeterminate', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" indeterminate></md-progress-indicator>',
      );
      const i = inst(page);
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.ccPhase).toBe(0);
    });

    it('no-op when already _completed', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { _completed: boolean; ccPhase: number };
      i._completed = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.ccPhase).toBe(0);
    });

    it('no-op when already _completedTrack', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { _completedTrack: boolean; ccPhase: number };
      i._completedTrack = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.ccPhase).toBe(0);
    });

    it('starts the completion sequence (ccPhase > 0) for flat circular determinate', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { ccPhase: number };
      expect(i.ccPhase).toBe(0);
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.ccPhase).toBeGreaterThan(0);
    });

    it('skips the fill phase and goes straight to erase at 100%', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="100"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { ccPhase: number };
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      // Already full — no fill needed, starts at phase 3 (erase)
      expect(i.ccPhase).toBe(3);
    });
  });

  // ── Circular wavy ─────────────────────────────────────────
  describe('circular wavy', () => {
    it('renders the active indicator as a <path> (not a circle)', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      const active = shadow(page, 'path.md-progress-indicator__circular-active');
      expect(active).toBeTruthy();
      expect((active as Element).tagName.toLowerCase()).toBe('path');
    });

    it('produces a non-empty path for mid-range progress', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      const d = shadow(page, 'path.md-progress-indicator__circular-active')?.getAttribute('d') ?? '';
      expect(d.startsWith('M')).toBe(true);
      expect(d).toContain('C');
    });

    it('renders a wavy track path with a gap for partial progress', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      expect(shadow(page, 'path.md-progress-indicator__circular-track')).toBeTruthy();
    });

    it('snaps the wave to an integer number of vertices (>= 5)', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { circularVertices: number };
      expect(Number.isInteger(i.circularVertices)).toBe(true);
      expect(i.circularVertices).toBeGreaterThanOrEqual(5);
    });

    it('wavy circular completion starts phase 1 on triggering complete', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      const i = page.rootInstance as unknown as { ccPhase: number };
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.ccPhase).toBeGreaterThan(0);
    });
  });

  // ── Parts ──────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes track / active-indicator / stop-indicator on linear', async () => {
      const page = await create('<md-progress-indicator value="50"></md-progress-indicator>');
      expect(shadow(page, '[part="track"]')).toBeTruthy();
      expect(shadow(page, '[part="active-indicator"]')).toBeTruthy();
      expect(shadow(page, '[part="stop-indicator"]')).toBeTruthy();
    });

    it('exposes track / active-indicator on circular', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="50"></md-progress-indicator>');
      expect(shadow(page, '[part="track"]')).toBeTruthy();
      expect(shadow(page, '[part="active-indicator"]')).toBeTruthy();
    });

    it('exposes track / active-indicator on circular wavy', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      expect(shadow(page, '[part="track"]')).toBeTruthy();
      expect(shadow(page, '[part="active-indicator"]')).toBeTruthy();
    });
  });

  // ── RTL ────────────────────────────────────────────────────
  describe('RTL', () => {
    it('renders in an RTL context (linear)', async () => {
      const page = await newSpecPage({
        components: [MdProgressIndicator],
        html: '<div dir="rtl"><md-progress-indicator value="50"></md-progress-indicator></div>',
      });
      expect(page.body.querySelector('md-progress-indicator')).toBeTruthy();
    });

    it('renders in an RTL context (circular)', async () => {
      const page = await newSpecPage({
        components: [MdProgressIndicator],
        html: '<div dir="rtl"><md-progress-indicator variant="circular" value="50"></md-progress-indicator></div>',
      });
      expect(page.body.querySelector('md-progress-indicator')).toBeTruthy();
    });
  });

  // ── Fraction math ──────────────────────────────────────────
  describe('fraction math', () => {
    it('computes fill width with a custom max', async () => {
      const page = await create('<md-progress-indicator value="3" max="10"></md-progress-indicator>');
      const active = shadow(page, '.md-progress-indicator__active') as HTMLElement;
      expect(active.style.getPropertyValue('--_fill-width')).toBe('30%');
    });

    it('defaults max to 100', async () => {
      const page = await create('<md-progress-indicator value="50"></md-progress-indicator>');
      const active = shadow(page, '.md-progress-indicator__active') as HTMLElement;
      expect(active.style.getPropertyValue('--_fill-width')).toBe('50%');
    });

    it('clamps fraction to 0 when value is negative', async () => {
      const page = await create('<md-progress-indicator value="-5"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('0');
    });

    it('clamps fraction to 1 when value exceeds max', async () => {
      const page = await create('<md-progress-indicator value="200" max="100"></md-progress-indicator>');
      expect(page.root?.getAttribute('aria-valuenow')).toBe('100');
    });
  });

  // ── Host class states ─────────────────────────────────────────
  describe('host class states', () => {
    it('adds --completing class when _completing is true', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      (page.rootInstance as any)._completing = true;
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-progress-indicator--completing');
    });

    it('adds --complete class when _completed is true', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      (page.rootInstance as any)._completed = true;
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-progress-indicator--complete');
    });

    it('has neither --completing nor --complete in steady state', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      expect(page.root).not.toHaveClass('md-progress-indicator--completing');
      expect(page.root).not.toHaveClass('md-progress-indicator--complete');
    });
  });

  // ── mdComplete event ──────────────────────────────────────────
  describe('mdComplete event', () => {
    it('emits mdComplete when handleComplete is called', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const events: Event[] = [];
      page.root!.addEventListener('mdComplete', (e) => events.push(e));
      (page.rootInstance as any).handleComplete();
      await page.waitForChanges();
      expect(events.length).toBe(1);
    });

    it('linear: handleComplete sets _completed=true and _completedTrack=false', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.handleComplete();
      expect(i._completed).toBe(true);
      expect(i._completedTrack).toBe(false);
    });

    it('flat circular: handleComplete sets _completedTrack=true and _completed=false', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.handleComplete();
      expect(i._completedTrack).toBe(true);
      expect(i._completed).toBe(false);
    });

    it('wavy circular: handleComplete sets _completed=true and _completedTrack=false', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.handleComplete();
      expect(i._completed).toBe(true);
      expect(i._completedTrack).toBe(false);
    });

    it('wavy linear: handleComplete sets _completed=true', async () => {
      const page = await create('<md-progress-indicator wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.handleComplete();
      expect(i._completed).toBe(true);
      expect(i._completedTrack).toBe(false);
    });

    it('handleComplete resets _completing, _fillComplete, ccPhase, and flcPhase', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i._completing = true;
      i._fillComplete = true;
      i.ccPhase = 2;
      i.flcPhase = 1;
      i.handleComplete();
      expect(i._completing).toBe(false);
      expect(i._fillComplete).toBe(false);
      expect(i.ccPhase).toBe(0);
      expect(i.flcPhase).toBe(0);
    });
  });

  // ── onLinearAnimEnd ───────────────────────────────────────────
  describe('onLinearAnimEnd', () => {
    it('triggers handleComplete for animationName "md-linear-complete"', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.onLinearAnimEnd({ animationName: 'md-linear-complete' });
      expect(i._completed).toBe(true);
    });

    it('ignores unrelated animation names', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.onLinearAnimEnd({ animationName: 'some-other-animation' });
      expect(i._completed).toBe(false);
    });
  });

  // ── linear wave completion trigger ────────────────────────────
  describe('linear wave completion trigger', () => {
    it('sets wlcPhase=1 when complete is set for wave linear', async () => {
      const page = await create('<md-progress-indicator wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.wlcPhase).toBe(1);
    });

    it('no-op (wlcPhase stays 0) when _completing is already true', async () => {
      const page = await create('<md-progress-indicator wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i._completing = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.wlcPhase).toBe(0);
    });

    it('no-op when _completed is already true', async () => {
      const page = await create('<md-progress-indicator wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i._completed = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.wlcPhase).toBe(0);
    });

    it('snaps amp to 1 before starting wave linear completion', async () => {
      const page = await create('<md-progress-indicator wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.amp = 0.5;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.amp).toBe(1);
    });
  });

  // ── linear flat completion trigger ────────────────────────────
  describe('linear flat completion trigger', () => {
    it('sets flcPhase=1 in normal conditions', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.flcPhase).toBe(1);
    });

    it('under reducedMotion: snaps _completing=true and _fillComplete=true (no rAF)', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.reducedMotion = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i._completing).toBe(true);
      expect(i._fillComplete).toBe(true);
      expect(i.flcPhase).toBe(0);
    });
  });

  // ── circular completion under reducedMotion ───────────────────
  describe('circular completion under reducedMotion', () => {
    it('flat circular + reducedMotion: complete immediately sets _completedTrack', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.reducedMotion = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i._completedTrack).toBe(true);
      expect(i.ccPhase).toBe(0);
    });

    it('wavy circular + reducedMotion: complete immediately sets _completed', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.reducedMotion = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i._completed).toBe(true);
      expect(i.ccPhase).toBe(0);
    });
  });

  // ── complete prop guard: _completing ──────────────────────────
  describe('complete prop guard: _completing', () => {
    it('no-op on circular when _completing is already true', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i._completing = true;
      (page.root as unknown as { complete: boolean }).complete = true;
      await page.waitForChanges();
      expect(i.ccPhase).toBe(0);
    });
  });

  // ── _fillComplete state ────────────────────────────────────────
  describe('_fillComplete state', () => {
    it('renders fill width at 100% when _fillComplete and _completing are both true', async () => {
      // _fillComplete is only ever set together with _completing (the reducedMotion
      // completion path). _completing blocks componentDidRender from overwriting the
      // imperatively-managed style, so the declarative 100% render value lands.
      const page = await create('<md-progress-indicator value="40"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i._fillComplete = true;
      i._completing = true;
      await page.waitForChanges();
      const active = shadow(page, '.md-progress-indicator__active') as HTMLElement;
      expect(active.style.getPropertyValue('--_fill-width')).toBe('100%');
    });
  });

  // ── buildTrackMask utility ────────────────────────────────────
  describe('buildTrackMask', () => {
    it('returns "none" for empty intervals', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      expect((page.rootInstance as any).buildTrackMask([], 400)).toBe('none');
    });

    it('returns a linear-gradient for a single interval', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      const result = (page.rootInstance as any).buildTrackMask([[100, 200]], 400);
      expect(result).toMatch(/^linear-gradient/);
      expect(result).toContain('transparent');
    });

    it('merges overlapping intervals into one gradient band', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      const single = (page.rootInstance as any).buildTrackMask([[100, 300]], 400);
      const merged = (page.rootInstance as any).buildTrackMask([[100, 200], [150, 300]], 400);
      // Overlapping [100,200] + [150,300] = [100,300] → same result as single [100,300]
      expect(merged.split('transparent').length).toBe(single.split('transparent').length);
    });

    it('keeps two separate (non-overlapping) intervals as distinct transparent bands', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      const result = (page.rootInstance as any).buildTrackMask([[50, 100], [200, 300]], 400);
      // Two intervals → 4 transparent stops (start + end for each)
      expect(result.split('transparent').length - 1).toBeGreaterThanOrEqual(4);
    });
  });

  // ── buildLinearWaveSVGPath edge cases ─────────────────────────
  describe('buildLinearWaveSVGPath', () => {
    it('returns empty string when endX <= startX', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      expect((page.rootInstance as any).buildLinearWaveSVGPath(100, 50, 0, 0)).toBe('');
    });

    it('returns arc-based dot path when inset=true and fill is shorter than one cap diameter', async () => {
      const page = await create('<md-progress-indicator wave value="50" thickness="4"></md-progress-indicator>');
      // With r=2 and endX-startX=4: bodyStart=2, bodyEnd=2 → bodyEnd <= bodyStart → dot
      const result = (page.rootInstance as any).buildLinearWaveSVGPath(0, 4, 0, 0, true);
      expect(result).toContain('a '); // SVG arc command
    });
  });

  // ── resolved geometry ─────────────────────────────────────────
  describe('resolved geometry', () => {
    it('resolvedWavelength defaults to 15 for circular wave', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      expect((page.rootInstance as any).resolvedWavelength).toBe(15);
    });

    it('resolvedAmplitude defaults to 1.6 for circular wave', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      expect((page.rootInstance as any).resolvedAmplitude).toBe(1.6);
    });

    it('resolvedWavelength defaults to 40 for linear wave', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      expect((page.rootInstance as any).resolvedWavelength).toBe(40);
    });

    it('resolvedAmplitude defaults to 3 for linear wave', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      expect((page.rootInstance as any).resolvedAmplitude).toBe(3);
    });

    it('resolvedWaveSpeed equals resolvedWavelength when waveSpeed is 0 (default)', async () => {
      const page = await create('<md-progress-indicator wave value="50"></md-progress-indicator>');
      const i = page.rootInstance as any;
      expect(i.resolvedWaveSpeed).toBe(i.resolvedWavelength);
    });

    it('custom wave-length overrides for circular', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave wave-length="25" value="50"></md-progress-indicator>',
      );
      expect((page.rootInstance as any).resolvedWavelength).toBe(25);
    });

    it('custom wave-amplitude overrides for circular', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave wave-amplitude="3" value="50"></md-progress-indicator>',
      );
      expect((page.rootInstance as any).resolvedAmplitude).toBe(3);
    });
  });

  // ── fraction getter ────────────────────────────────────────────
  describe('fraction getter', () => {
    it('returns 0 when max is 0 (avoids divide-by-zero)', async () => {
      const page = await create('<md-progress-indicator value="50" max="0"></md-progress-indicator>');
      expect((page.rootInstance as any).fraction).toBe(0);
    });

    it('clamps to 1 when value exceeds max', async () => {
      const page = await create('<md-progress-indicator value="200" max="100"></md-progress-indicator>');
      expect((page.rootInstance as any).fraction).toBe(1);
    });

    it('clamps to 0 when value is negative', async () => {
      const page = await create('<md-progress-indicator value="-10"></md-progress-indicator>');
      expect((page.rootInstance as any).fraction).toBe(0);
    });
  });

  // ── syncSpinnerTrackVars ───────────────────────────────────────
  describe('syncSpinnerTrackVars', () => {
    it('sets --_spin-da-0 / --_spin-da-50 / --_spin-da-100 for circular', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="50"></md-progress-indicator>');
      const s = page.root?.style;
      expect(s?.getPropertyValue('--_spin-da-0')).toBeTruthy();
      expect(s?.getPropertyValue('--_spin-da-50')).toBeTruthy();
      expect(s?.getPropertyValue('--_spin-da-100')).toBeTruthy();
    });

    it('does not set spinner CSS vars for linear', async () => {
      const page = await create('<md-progress-indicator value="60"></md-progress-indicator>');
      expect(page.root?.style.getPropertyValue('--_spin-da-0')).toBe('');
    });

    it('gap variables sum to 1 − dash (period stays 1)', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" value="50" thickness="4"></md-progress-indicator>',
      );
      const s = page.root?.style;
      const da = parseFloat(s?.getPropertyValue('--_spin-da-50') ?? '0');
      const gap = parseFloat(s?.getPropertyValue('--_spin-gap-50') ?? '0');
      expect(da + gap).toBeCloseTo(1, 3);
    });
  });

  // ── wave indeterminate reducedMotion fallback ──────────────────
  describe('wave indeterminate reducedMotion fallback', () => {
    it('uses CSS bars (no ghost bars) when wave + indeterminate + reducedMotion=true', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      (page.rootInstance as any).reducedMotion = true;
      await page.waitForChanges();
      expect(shadow(page, '.md-progress-indicator__bar-inner--ghost')).toBeNull();
    });

    it('applies --wave class to CSS bars in wave + reducedMotion mode', async () => {
      const page = await create('<md-progress-indicator wave indeterminate></md-progress-indicator>');
      (page.rootInstance as any).reducedMotion = true;
      await page.waitForChanges();
      expect(shadow(page, '.md-progress-indicator__bar--wave')).toBeTruthy();
    });
  });

  // ── circular wavy indeterminate rendering ─────────────────────
  describe('circular wavy indeterminate rendering', () => {
    it('renders a <g> rotation group element', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave indeterminate></md-progress-indicator>',
      );
      expect(page.root?.shadowRoot?.querySelector('g')).toBeTruthy();
    });

    it('active path has non-empty d (CIRCULAR_INDET_MIN sweep = 10%)', async () => {
      const page = await create(
        '<md-progress-indicator variant="circular" wave indeterminate></md-progress-indicator>',
      );
      const d =
        page.root?.shadowRoot?.querySelector('path.md-progress-indicator__circular-active')?.getAttribute('d') ?? '';
      expect(d).toMatch(/^M/);
    });
  });

  // ── ariaValueMax edge cases ────────────────────────────────────
  describe('ariaValueMax edge cases', () => {
    it('treats negative max as invalid → 0', async () => {
      const page = await create('<md-progress-indicator max="-5"></md-progress-indicator>');
      expect((page.rootInstance as any).ariaValueMax).toBe(0);
    });

    it('treats 0 max as invalid → 0', async () => {
      const page = await create('<md-progress-indicator max="0"></md-progress-indicator>');
      expect((page.rootInstance as any).ariaValueMax).toBe(0);
    });

    it('ariaValueNow is clamped to [0, ariaValueMax]', async () => {
      const page = await create('<md-progress-indicator value="200" max="100"></md-progress-indicator>');
      expect((page.rootInstance as any).ariaValueNow).toBe(100);
    });

    it('ariaValueNow is 0 when value is negative', async () => {
      const page = await create('<md-progress-indicator value="-10" max="100"></md-progress-indicator>');
      expect((page.rootInstance as any).ariaValueNow).toBe(0);
    });
  });

  // ── flatCompletionD getter ────────────────────────────────────
  describe('flatCompletionD getter', () => {
    it('returns empty string when ccPhase is 0 (steady state)', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      expect((page.rootInstance as any).flatCompletionD).toBe('');
    });

    it('returns a non-empty path when ccPhase > 0 and ccFrac > 0', async () => {
      const page = await create('<md-progress-indicator variant="circular" value="60"></md-progress-indicator>');
      const i = page.rootInstance as any;
      i.ccPhase = 1;
      i.ccFrac = 0.5;
      expect(i.flatCompletionD).toMatch(/^M/);
    });
  });

  // ── circularVertices ──────────────────────────────────────────
  describe('circularVertices', () => {
    it('is always >= 5 (minimum vertex count)', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave size="24"></md-progress-indicator>');
      expect((page.rootInstance as any).circularVertices).toBeGreaterThanOrEqual(5);
    });

    it('snaps to an integer', async () => {
      const page = await create('<md-progress-indicator variant="circular" wave value="50"></md-progress-indicator>');
      const v = (page.rootInstance as any).circularVertices;
      expect(Number.isInteger(v)).toBe(true);
    });
  });
});
