import { test, expect } from './coverage';
import type { Page } from '@playwright/experimental-ct-react';
import AxeBuilder from '@axe-core/playwright';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

async function waitForComponent(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('md-button');
    return el && el.shadowRoot && el.shadowRoot.querySelector('.md-button__label');
  }, null, { timeout: 10_000 });
}

test.describe('md-button', () => {

  /* ==============================================================
     VARIANTS
     ============================================================== */
  test.describe('variants', () => {
    const variants = ['filled', 'outlined', 'text', 'elevated', 'tonal'] as const;

    for (const variant of variants) {
      test(`renders ${variant} variant with correct class`, async ({ mount, page }) => {
        const component = await mount(
          <md-button variant={variant}>{variant}</md-button>,
        );
        await waitForComponent(page);
        await expect(component).toBeVisible();
        await expect(component).toHaveClass(new RegExp(`md-button--${variant}`));
      });
    }
  });

  /* ==============================================================
     SIZES
     ============================================================== */
  test.describe('sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

    for (const size of sizes) {
      test(`renders ${size} size with correct class`, async ({ mount, page }) => {
        const component = await mount(
          <md-button variant="filled" size={size}>{size}</md-button>,
        );
        await waitForComponent(page);
        await expect(component).toHaveClass(new RegExp(`md-button--${size}`));
      });
    }
  });

  /* ==============================================================
     SHAPES
     ============================================================== */
  test.describe('shapes', () => {
    test('renders round shape by default', async ({ mount, page }) => {
      const component = await mount(<md-button variant="filled">Round</md-button>);
      await waitForComponent(page);
      await expect(component).toHaveClass(/md-button--round/);
    });

    test('renders square shape', async ({ mount, page }) => {
      const component = await mount(
        <md-button variant="filled" shape="square">Square</md-button>,
      );
      await waitForComponent(page);
      await expect(component).toHaveClass(/md-button--square/);
    });
  });

  /* ==============================================================
     CLICK / EVENT
     ============================================================== */
  test('fires mdClick event on click', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Click me</md-button>);
    await waitForComponent(page);

    const clicked = await component.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        (el as HTMLElement).click();
      });
    });

    expect(clicked).toBe(true);
  });

  /* ==============================================================
     HREF NAVIGATION
     ============================================================== */
  /* md-button used to fake links: no anchor, role="button" on the host, and
     navigation performed in JS via window.open. It now renders a real <a>, so
     the browser owns activation — which is what makes middle-click, cmd-click
     and "copy link address" work, none of which ever reach a JS handler.
     Asserted on the rendered markup because that is what the browser acts on. */
  test('button with href renders a real anchor the browser can act on', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" href="https://example.com" target="_blank">
        Link
      </md-button>,
    );
    await waitForComponent(page);

    const link = await component.evaluate((el) => {
      const a = (el as HTMLElement).shadowRoot?.querySelector('a.md-button__anchor');
      return {
        href: a?.getAttribute('href') ?? null,
        role: a?.getAttribute('role') ?? null,
        rel: a?.getAttribute('rel') ?? null,
        hostRole: (el as HTMLElement).getAttribute('role'),
      };
    });

    expect(link.href).toBe('https://example.com');
    expect(link.role).toBe('link');
    // target="_blank" opens a new browsing context, so the opener is severed.
    expect(link.rel).toBe('noopener noreferrer');
    // A link must not also announce as a button.
    expect(link.hostRole).toBeNull();
  });

  /* ==============================================================
     DISABLED
     ============================================================== */
  test('disabled button has aria-disabled and does not fire mdClick', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" disabled>Disabled</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toHaveAttribute('aria-disabled', 'true');

    const clicked = await component.evaluate((el) => {
      let fired = false;
      el.addEventListener('mdClick', () => { fired = true; }, { once: true });
      (el as HTMLElement).click();
      return fired;
    });

    expect(clicked).toBe(false);
  });

  test('disabled button has tabindex="-1"', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" disabled>Disabled</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toHaveAttribute('tabindex', '-1');
  });

  /* ==============================================================
     SOFT-DISABLED
     ============================================================== */
  test('soft-disabled button is visually disabled but remains focusable', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" soft-disabled>Paste</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toHaveAttribute('aria-disabled', 'true');
    await expect(component).toHaveClass(/md-button--disabled/);
    await expect(component).toHaveAttribute('tabindex', '0');
  });

  test('soft-disabled button does not fire mdClick', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" soft-disabled>Paste</md-button>,
    );
    await waitForComponent(page);

    const clicked = await component.evaluate((el) => {
      let fired = false;
      el.addEventListener('mdClick', () => { fired = true; }, { once: true });
      (el as HTMLElement).click();
      return fired;
    });

    expect(clicked).toBe(false);
  });

  /* ==============================================================
     LOADING
     ============================================================== */
  test('loading button shows spinner in shadow DOM', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" loading>Loading</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toHaveAttribute('aria-disabled', 'true');
    await expect(component).toHaveClass(/md-button--loading/);

    const spinner = await component.evaluate((el) => {
      const s = el.shadowRoot!.querySelector('.md-button__loading');
      return s ? { exists: true, ariaHidden: s.getAttribute('aria-hidden') } : { exists: false, ariaHidden: null };
    });
    expect(spinner.exists).toBe(true);
    expect(spinner.ariaHidden).toBe('true');
  });

  test('non-loading button does NOT render spinner', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled">Not loading</md-button>,
    );
    await waitForComponent(page);

    const hasSpinner = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__loading') !== null,
    );
    expect(hasSpinner).toBe(false);
  });

  /* ==============================================================
     ICONS (prop-based)
     ============================================================== */
  test('renders leading icon in shadow DOM', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" icon="add">With Icon</md-button>,
    );
    await waitForComponent(page);

    const iconText = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__icon.material-symbols-outlined')?.textContent?.trim(),
    );
    expect(iconText).toBe('add');
    await expect(component).toHaveClass(/md-button--with-leading-icon/);
  });

  test('renders trailing icon in shadow DOM', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" trailing-icon="arrow_forward">Next</md-button>,
    );
    await waitForComponent(page);

    const iconText = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__trailing-icon.material-symbols-outlined')?.textContent?.trim(),
    );
    expect(iconText).toBe('arrow_forward');
    await expect(component).toHaveClass(/md-button--with-trailing-icon/);
  });

  test('renders both leading and trailing icons', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" icon="add" trailing-icon="arrow_forward">Both</md-button>,
    );
    await waitForComponent(page);

    const [leading, trailing] = await component.evaluate((el) => {
      const l = el.shadowRoot!.querySelector('.md-button__icon')?.textContent?.trim();
      const t = el.shadowRoot!.querySelector('.md-button__trailing-icon')?.textContent?.trim();
      return [l, t];
    });
    expect(leading).toBe('add');
    expect(trailing).toBe('arrow_forward');
  });

  /* ==============================================================
     NAMED ICON SLOTS (custom iconography)
     ============================================================== */
  test('renders slotted leading icon via named slot', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled">
        <span slot="leading-icon" data-testid="custom-icon">★</span>
        Starred
      </md-button>,
    );
    await waitForComponent(page);

    const slottedText = await component.evaluate((el) => {
      const slotted = el.querySelector('[slot="leading-icon"]');
      return slotted?.textContent?.trim();
    });
    expect(slottedText).toBe('★');
  });

  test('renders slotted trailing icon via named slot', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled">
        Go
        <span slot="trailing-icon" data-testid="custom-trailing">→</span>
      </md-button>,
    );
    await waitForComponent(page);

    const slottedText = await component.evaluate((el) => {
      const slotted = el.querySelector('[slot="trailing-icon"]');
      return slotted?.textContent?.trim();
    });
    expect(slottedText).toBe('→');
  });

  /* ==============================================================
     RIPPLE
     ============================================================== */
  test('renders md-ripple by default (ripple enabled)', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">With Ripple</md-button>);
    await waitForComponent(page);

    const hasRipple = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('md-ripple') !== null,
    );
    expect(hasRipple).toBe(true);
  });

  test('does not render md-ripple when ripple=false', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" ripple={false}>No Ripple</md-button>,
    );
    await waitForComponent(page);

    const hasRipple = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('md-ripple') !== null,
    );
    expect(hasRipple).toBe(false);
  });

  /* ==============================================================
     CSS PARTS
     ============================================================== */
  test('exposes part attributes on internal elements', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" icon="add" loading>Parts</md-button>,
    );
    await waitForComponent(page);

    const parts = await component.evaluate((el) => {
      const shadow = el.shadowRoot!;
      return {
        stateLayer: !!shadow.querySelector('[part="state-layer"]'),
        icon: !!shadow.querySelector('[part="icon"]'),
        label: !!shadow.querySelector('[part="label"]'),
        loading: !!shadow.querySelector('[part="loading"]'),
      };
    });
    expect(parts.stateLayer).toBe(true);
    expect(parts.icon).toBe(true);
    expect(parts.label).toBe(true);
    expect(parts.loading).toBe(true);
  });

  /* ==============================================================
     KEYBOARD
     Dispatch KeyboardEvent directly on the element so V8 coverage
     reliably tracks the handleKeyDown code path.
     ============================================================== */
  test('keyboard Enter fires mdClick', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Press me</md-button>);
    await waitForComponent(page);

    const fired = await component.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        setTimeout(() => resolve(false), 200);
      });
    });
    expect(fired).toBe(true);
  });

  test('keyboard Space fires mdClick', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Press me</md-button>);
    await waitForComponent(page);

    const fired = await component.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        setTimeout(() => resolve(false), 200);
      });
    });
    expect(fired).toBe(true);
  });

  test('non-matching key does NOT fire mdClick', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Press me</md-button>);
    await waitForComponent(page);

    const fired = await component.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
        setTimeout(() => resolve(false), 200);
      });
    });
    expect(fired).toBe(false);
  });

  test('keyboard Enter does NOT fire mdClick on disabled button', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" disabled>Disabled</md-button>,
    );
    await waitForComponent(page);

    const fired = await component.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        setTimeout(() => resolve(false), 200);
      });
    });
    expect(fired).toBe(false);
  });

  test('keyboard Space does NOT fire mdClick on soft-disabled button', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" soft-disabled>Paste</md-button>,
    );
    await waitForComponent(page);

    const fired = await component.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
        setTimeout(() => resolve(false), 200);
      });
    });
    expect(fired).toBe(false);
  });

  /* ==============================================================
     A11Y — manual assertions
     ============================================================== */
  test('button has role="button" and tabindex="0"', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">OK</md-button>);
    await waitForComponent(page);
    await expect(component).toHaveAttribute('role', 'button');
    await expect(component).toHaveAttribute('tabindex', '0');
  });

  test('button label is rendered via slot', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Hello World</md-button>);
    await waitForComponent(page);
    const text = await component.textContent();
    expect(text?.trim()).toBe('Hello World');
  });

  /* ==============================================================
     A11Y — axe-core automated scans (WCAG 2.1 AA)

     Page-level rules (landmark-one-main, page-has-heading-one,
     region) are excluded because Playwright CT mounts components
     in a bare HTML page without <main> or <h1>. These rules test
     page structure, not component-level accessibility.
     ============================================================== */
  test.describe('accessibility (axe-core)', () => {
    const PAGE_LEVEL_RULES = ['landmark-one-main', 'page-has-heading-one', 'region'];

    function scanPage(page: Page) {
      return new AxeBuilder({ page }).disableRules(PAGE_LEVEL_RULES).analyze();
    }

    const variants = ['filled', 'outlined', 'text', 'elevated', 'tonal'] as const;

    for (const variant of variants) {
      test(`${variant} variant passes axe scan`, async ({ mount, page }) => {
        await mount(<md-button variant={variant}>Label</md-button>);
        await waitForComponent(page);
        const results = await scanPage(page);
        expect(results.violations).toEqual([]);
      });
    }

    test('disabled button passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" disabled>Disabled</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('soft-disabled button passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" soft-disabled>Paste</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('loading button passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" loading>Loading</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('button with leading icon passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" icon="add">Add</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('button with trailing icon passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" trailing-icon="arrow_forward">Next</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('button with both icons passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" icon="edit" trailing-icon="arrow_forward">Edit</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('xl size button passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="filled" size="xl">Extra Large</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });

    test('square shape button passes axe scan', async ({ mount, page }) => {
      await mount(<md-button variant="outlined" shape="square">Square</md-button>);
      await waitForComponent(page);
      const results = await scanPage(page);
      expect(results.violations).toEqual([]);
    });
  });
});
