import { test, expect } from './coverage';
import type { Locator, Page } from '@playwright/experimental-ct-react';
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

type ButtonEvents = {
  activations: Array<{
    value: string; toggle: boolean; selected: boolean; href: string; target: string;
    originalType: string; bubbles: boolean; composed: boolean; cancelable: boolean;
  }>;
  changes: Array<{ value: string; selected: boolean }>;
  clicks: Array<{ defaultPrevented: boolean }>;
};
type ObservedButton = HTMLElement & { testEvents: ButtonEvents };

async function recordButtonEvents(button: Locator) {
  await button.evaluate((element) => {
    const host = element as ObservedButton;
    host.testEvents = { activations: [], changes: [], clicks: [] };
    host.addEventListener('mdClick', (event) => {
      const { value, toggle, selected, href, target, originalEvent } = (event as CustomEvent).detail;
      host.testEvents.activations.push({
        value, toggle, selected, href, target, originalType: originalEvent.type,
        bubbles: event.bubbles, composed: event.composed, cancelable: event.cancelable,
      });
    });
    host.addEventListener('mdChange', (event) => host.testEvents.changes.push((event as CustomEvent).detail));
    // Observe after the component's handler, so cancellation and bubbling are
    // checked together instead of inspecting the custom event in isolation.
    host.parentElement!.addEventListener('click', (event) => {
      if (event.composedPath().includes(host)) host.testEvents.clicks.push({ defaultPrevented: event.defaultPrevented });
    });
  });
}

async function buttonEvents(button: Locator) {
  return button.evaluate((element) => (element as ObservedButton).testEvents);
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

  test.describe('React activation contracts', () => {
    test('a canceled toggle retains state and bubbles the click; later activations report the committed value', async ({ mount, page }) => {
      const button = await mount(<md-button toggle value="bookmark">Bookmark</md-button>);
      await waitForComponent(page);
      await recordButtonEvents(button);
      await button.evaluate((el) => el.addEventListener('mdClick', (event) => event.preventDefault(), { once: true }));

      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      await expect(button).not.toHaveClass(/md-button--selected/);
      expect(await buttonEvents(button)).toEqual({
        activations: [{
          value: 'bookmark', toggle: true, selected: true, href: '', target: '_self',
          originalType: 'click', bubbles: true, composed: true, cancelable: true,
        }],
        changes: [], clicks: [{ defaultPrevented: true }],
      });

      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(button).toHaveClass(/md-button--selected/);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      await expect(button).not.toHaveClass(/md-button--selected/);
      const events = await buttonEvents(button);
      expect(events.activations.map(event => event.selected)).toEqual([true, true, false]);
      expect(events.changes).toEqual([{ value: 'bookmark', selected: true }, { value: 'bookmark', selected: false }]);
      expect(events.clicks).toEqual([{ defaultPrevented: true }, { defaultPrevented: false }, { defaultPrevented: false }]);
    });

    for (const key of ['Enter', 'Space']) {
      test(`real ${key} activation toggles once and clears its pressed state`, async ({ mount, page }) => {
        const button = await mount(<md-button toggle value="favorite">Favorite</md-button>);
        await waitForComponent(page);
        await recordButtonEvents(button);
        await button.focus();
        await page.keyboard.down(key);
        await expect(button).toHaveClass(/md-button--pressing/);
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.up(key);
        await expect(button).not.toHaveClass(/md-button--pressing/);
        await expect(button).not.toHaveClass(/md-button--pressed(?:\s|$)/);
        const events = await buttonEvents(button);
        expect(events.activations).toHaveLength(1);
        expect(events.changes).toEqual([{ value: 'favorite', selected: true }]);
        await expect(button).toBeFocused();
      });
    }

    test('pointer release, leaving, and cancellation clear press feedback without extra activation', async ({ mount, page }) => {
      const button = await mount(<md-button>Press feedback</md-button>);
      await waitForComponent(page);
      await recordButtonEvents(button);
      await button.hover();
      await page.mouse.down();
      await expect(button).toHaveClass(/md-button--pressed(?:\s|$)/);
      await page.mouse.up();
      await expect(button).not.toHaveClass(/md-button--pressing/);
      expect((await buttonEvents(button)).activations).toHaveLength(1);

      await button.hover();
      await page.mouse.down();
      await expect(button).toHaveClass(/md-button--pressing/);
      await page.mouse.move(1000, 600);
      await expect(button).not.toHaveClass(/md-button--pressing/);
      await page.mouse.up();
      expect((await buttonEvents(button)).activations).toHaveLength(1);

      await button.update(<md-button shape-morph={false}>Press feedback</md-button>);
      await button.hover();
      await page.mouse.down();
      await expect(button).toHaveClass(/md-button--pressing/);
      await expect(button).not.toHaveClass(/md-button--pressed(?:\s|$)/);
      // Browsers emit pointercancel when a gesture becomes scrolling. Dispatch
      // that public event rather than reaching into the component's handlers.
      await button.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
      await expect(button).not.toHaveClass(/md-button--pressing/);
      await page.mouse.move(1000, 600);
      await page.mouse.up();
      expect((await buttonEvents(button)).activations).toHaveLength(1);
    });

    for (const state of ['soft-disabled', 'loading']) {
      test(`${state} refuses pointer and keyboard activation, then becomes usable after React updates`, async ({ mount, page }) => {
        const button = await mount(<md-button {...{ [state]: true }} toggle>Unavailable</md-button>);
        await waitForComponent(page);
        await recordButtonEvents(button);
        await button.focus();
        await page.keyboard.press('Enter');
        // Disabled styling can remove pointer hit testing. Delivered pointer
        // events must still be harmless (e.g. a press already in flight).
        await button.dispatchEvent('pointerdown', { pointerType: 'mouse', bubbles: true });
        await button.evaluate((el) => (el as HTMLElement).click());
        await expect(button).not.toHaveClass(/md-button--pressing/);
        await expect(button).toHaveAttribute('aria-pressed', 'false');
        expect((await buttonEvents(button)).activations).toEqual([]);
        expect((await buttonEvents(button)).changes).toEqual([]);

        await button.update(<md-button {...{ [state]: false }} toggle>Available</md-button>);
        await expect(button).toHaveAttribute('aria-disabled', 'false');
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
        expect((await buttonEvents(button)).activations).toHaveLength(1);
        expect((await buttonEvents(button)).changes).toEqual([{ value: '', selected: true }]);
      });
    }

    test('submit runs native constraint validation and can be canceled before submitting', async ({ mount, page }) => {
      const form = await mount(
        <form>
          <label>Email<input name="email" type="email" required defaultValue="" /></label>
          <md-button type="submit">Save</md-button>
        </form>,
      );
      await waitForComponent(page);
      await form.evaluate((el) => {
        const observed = el as HTMLFormElement & { submissions: unknown[]; invalidCount: number };
        observed.submissions = [];
        observed.invalidCount = 0;
        observed.addEventListener('invalid', () => observed.invalidCount++, true);
        observed.addEventListener('submit', (event) => {
          event.preventDefault();
          observed.submissions.push(Object.fromEntries(new FormData(observed)));
        });
      });
      const button = form.locator('md-button');
      await button.click();
      expect(await form.evaluate((el: any) => ({ submissions: el.submissions, invalid: el.invalidCount }))).toEqual({ submissions: [], invalid: 1 });
      await expect(form.getByLabel('Email')).toBeFocused();
      await form.getByLabel('Email').fill('reader@example.test');
      await button.click();
      expect(await form.evaluate((el: any) => el.submissions)).toEqual([{ email: 'reader@example.test' }]);

      await button.evaluate((el) => el.addEventListener('mdClick', (event) => event.preventDefault(), { once: true }));
      await button.click();
      expect(await form.evaluate((el: any) => el.submissions)).toEqual([{ email: 'reader@example.test' }]);
    });

    test('reset restores the form default value only when activation is accepted', async ({ mount, page }) => {
      const form = await mount(
        <form>
          <label>Title<input name="title" defaultValue="Original" /></label>
          <md-button type="reset">Reset</md-button>
        </form>,
      );
      await waitForComponent(page);
      await form.evaluate((el: any) => {
        el.resets = 0;
        el.addEventListener('reset', () => el.resets++);
      });
      const button = form.locator('md-button');
      await form.getByLabel('Title').fill('Edited');
      await button.evaluate((el) => el.addEventListener('mdClick', (event) => event.preventDefault(), { once: true }));
      await button.click();
      await expect(form.getByLabel('Title')).toHaveValue('Edited');
      expect(await form.evaluate((el: any) => el.resets)).toBe(0);
      await button.click();
      await expect(form.getByLabel('Title')).toHaveValue('Original');
      expect(await form.evaluate((el: any) => el.resets)).toBe(1);
    });

    test('pointer link activation uses the native anchor once and respects cancellation', async ({ mount, page }) => {
      const button = await mount(<md-button href="#react-button-target" target="">Read</md-button>);
      await waitForComponent(page);
      await recordButtonEvents(button);
      await page.evaluate(() => {
        const original = window.open;
        (window as any).buttonWindowOpens = 0;
        window.open = (...args) => { (window as any).buttonWindowOpens++; return original.apply(window, args); };
      });
      await expect(button.locator('a')).not.toHaveAttribute('target');
      await expect(button.locator('a')).not.toHaveAttribute('rel');
      await button.evaluate((el) => el.addEventListener('mdClick', (event) => event.preventDefault(), { once: true }));
      await button.click();
      expect(new URL(page.url()).hash).toBe('');
      expect((await buttonEvents(button)).clicks).toEqual([{ defaultPrevented: true }]);
      await button.click();
      await expect(page).toHaveURL(/#react-button-target$/);
      expect(await page.evaluate(() => (window as any).buttonWindowOpens)).toBe(0);
      expect((await buttonEvents(button)).activations).toHaveLength(2);
    });

    test('programmatic link activation opens one protected browsing context', async ({ mount, page, context }) => {
      await context.route('**/react-button-destination', (route) => route.fulfill({ contentType: 'text/html', body: '<title>Button destination</title>' }));
      const button = await mount(<md-button href="/react-button-destination" target="_blank">Read</md-button>);
      await waitForComponent(page);
      await recordButtonEvents(button);
      const pages: Page[] = [];
      context.on('page', (opened) => pages.push(opened));
      const opened = context.waitForEvent('page');
      await button.evaluate((el) => (el as HTMLElement).click());
      const destination = await opened;
      try {
        await expect(destination).toHaveTitle('Button destination');
        expect(await destination.evaluate(() => window.opener)).toBeNull();
        expect(pages).toHaveLength(1);
        expect((await buttonEvents(button)).activations).toHaveLength(1);
        expect(new URL(page.url()).pathname).not.toBe('/react-button-destination');
      } finally {
        await destination.close();
      }
    });

    test('an unsafe href neither executes script nor falls through to form submission', async ({ mount, page }) => {
      const form = await mount(
        <form>
          <md-button type="submit" href="javascript:window.buttonUnsafeActivated=true">Unsafe destination</md-button>
        </form>,
      );
      await waitForComponent(page);
      await form.evaluate((el: any) => {
        el.submissions = 0;
        el.addEventListener('submit', (event: Event) => { event.preventDefault(); el.submissions++; });
      });
      const button = form.locator('md-button');
      await recordButtonEvents(button);
      await expect(button.locator('a')).toHaveCount(0);
      await button.click();
      expect(await page.evaluate(() => (window as any).buttonUnsafeActivated)).toBeUndefined();
      expect(await form.evaluate((el: any) => el.submissions)).toBe(0);
      expect((await buttonEvents(button)).activations).toHaveLength(1);
    });

    test('React adds and removes named icon slots with the corresponding layout state', async ({ mount, page }) => {
      const button = await mount(<md-button>Continue</md-button>);
      await waitForComponent(page);
      await expect(button).not.toHaveClass(/md-button--with-(?:leading|trailing)-icon/);
      await button.update(
        <md-button>
          <span slot="leading-icon" aria-hidden="true">★</span>
          Continue
          <span slot="trailing-icon" aria-hidden="true">→</span>
        </md-button>,
      );
      await expect(button).toHaveClass(/md-button--with-leading-icon/);
      await expect(button).toHaveClass(/md-button--with-trailing-icon/);
      expect(await button.evaluate((el) => [...el.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name]')].map(slot => slot.assignedElements().map(node => node.textContent)))).toEqual([['★'], ['→']]);
      await button.update(<md-button>Continue</md-button>);
      await expect(button).not.toHaveClass(/md-button--with-(?:leading|trailing)-icon/);
      expect(await button.evaluate((el) => [...el.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name]')].map(slot => slot.assignedElements().length))).toEqual([0, 0]);
      await expect(button).toHaveText('Continue');
    });
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
