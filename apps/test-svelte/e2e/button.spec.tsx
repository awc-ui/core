import { test, expect } from './coverage';
import type { Page } from '@playwright/experimental-ct-react';

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
  test('renders with default filled variant', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Filled</md-button>);
    await waitForComponent(page);
    await expect(component).toBeVisible();
    await expect(component).toHaveClass(/md-button--filled/);
  });

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

  test('disabled button has aria-disabled and does not fire mdClick', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" disabled>Disabled</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toBeVisible();
    await expect(component).toHaveAttribute('aria-disabled', 'true');

    const clicked = await component.evaluate((el) => {
      let fired = false;
      el.addEventListener('mdClick', () => { fired = true; }, { once: true });
      (el as HTMLElement).click();
      return fired;
    });

    expect(clicked).toBe(false);
  });

  test('loading button shows spinner in shadow DOM', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" loading>Loading</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toBeVisible();
    await expect(component).toHaveAttribute('aria-disabled', 'true');

    const hasSpinner = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__loading') !== null,
    );
    expect(hasSpinner).toBe(true);
  });

  test('button with icon renders icon element in shadow DOM', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" icon="add">With Icon</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toBeVisible();

    const iconText = await component.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__icon')?.textContent?.trim(),
    );
    expect(iconText).toBe('add');
  });

  test('keyboard Enter fires mdClick event', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Press me</md-button>);
    await waitForComponent(page);

    await component.evaluate((el) => {
      (window as any).__mdClickFired = false;
      el.addEventListener('mdClick', () => {
        (window as any).__mdClickFired = true;
      }, { once: true });
    });

    await component.focus();
    await page.keyboard.press('Enter');

    const fired = await page.evaluate(() => (window as any).__mdClickFired);
    expect(fired).toBe(true);
  });

  test('keyboard Enter does NOT fire mdClick on disabled button', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" disabled>Disabled</md-button>,
    );
    await waitForComponent(page);

    await component.evaluate((el) => {
      (window as any).__mdClickFiredDisabled = false;
      el.addEventListener('mdClick', () => {
        (window as any).__mdClickFiredDisabled = true;
      }, { once: true });
    });

    await component.focus();
    await page.keyboard.press('Enter');

    const fired = await page.evaluate(() => (window as any).__mdClickFiredDisabled);
    expect(fired).toBe(false);
  });

  test('button has role="button" and tabindex="0"', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">OK</md-button>);
    await waitForComponent(page);
    await expect(component).toHaveAttribute('role', 'button');
    await expect(component).toHaveAttribute('tabindex', '0');
  });

  test('disabled button has tabindex="-1"', async ({ mount, page }) => {
    const component = await mount(
      <md-button variant="filled" disabled>Disabled</md-button>,
    );
    await waitForComponent(page);
    await expect(component).toHaveAttribute('tabindex', '-1');
  });

  test('button label is rendered via slot', async ({ mount, page }) => {
    const component = await mount(<md-button variant="filled">Hello World</md-button>);
    await waitForComponent(page);
    const text = await component.textContent();
    expect(text?.trim()).toBe('Hello World');
  });
});
