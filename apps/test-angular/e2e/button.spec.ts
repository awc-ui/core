import { test, expect } from '@playwright/test';

test.describe('md-button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('md-button');
  });

  test('renders with default filled variant', async ({ page }) => {
    const button = page.locator('md-button[variant="filled"]').first();
    await expect(button).toBeVisible();
    await expect(button).toHaveClass(/md-button--filled/);
  });

  test.describe('variants', () => {
    const variants = ['filled', 'outlined', 'text', 'elevated', 'tonal'] as const;

    for (const variant of variants) {
      test(`renders ${variant} variant with correct class`, async ({ page }) => {
        const button = page.locator(`md-button[variant="${variant}"]`).first();
        await expect(button).toBeVisible();
        await expect(button).toHaveClass(new RegExp(`md-button--${variant}`));
      });
    }
  });

  test('fires mdClick event on click', async ({ page }) => {
    const button = page.locator('md-button[variant="filled"]').first();

    const clicked = await button.evaluate((el) => {
      return new Promise<boolean>((resolve) => {
        el.addEventListener('mdClick', () => resolve(true), { once: true });
        el.click();
      });
    });

    expect(clicked).toBe(true);
  });

  test('disabled button has aria-disabled and does not fire mdClick', async ({ page }) => {
    const button = page.locator('md-button[disabled]').first();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-disabled', 'true');

    const clicked = await button.evaluate((el) => {
      let fired = false;
      el.addEventListener('mdClick', () => { fired = true; }, { once: true });
      el.click();
      return fired;
    });

    expect(clicked).toBe(false);
  });

  test('loading button shows spinner in shadow DOM', async ({ page }) => {
    const button = page.locator('md-button[loading]').first();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-disabled', 'true');

    const hasSpinner = await button.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__loading') !== null,
    );
    expect(hasSpinner).toBe(true);
  });

  test('button with icon renders icon element in shadow DOM', async ({ page }) => {
    const button = page.locator('md-button[icon="add"]').first();
    await expect(button).toBeVisible();

    const iconText = await button.evaluate(
      (el) => el.shadowRoot!.querySelector('.md-button__icon')?.textContent?.trim(),
    );
    expect(iconText).toBe('add');
  });

  test('keyboard Enter fires mdClick event', async ({ page }) => {
    const button = page.locator('md-button[variant="filled"]').first();

    await button.evaluate((el) => {
      (window as any).__mdClickFired = false;
      el.addEventListener('mdClick', () => {
        (window as any).__mdClickFired = true;
      }, { once: true });
    });

    await button.focus();
    await page.keyboard.press('Enter');

    const fired = await page.evaluate(() => (window as any).__mdClickFired);
    expect(fired).toBe(true);
  });

  test('keyboard Enter does NOT fire mdClick on disabled button', async ({ page }) => {
    const button = page.locator('md-button[disabled]').first();

    await button.evaluate((el) => {
      (window as any).__mdClickFiredDisabled = false;
      el.addEventListener('mdClick', () => {
        (window as any).__mdClickFiredDisabled = true;
      }, { once: true });
    });

    await button.focus();
    await page.keyboard.press('Enter');

    const fired = await page.evaluate(() => (window as any).__mdClickFiredDisabled);
    expect(fired).toBe(false);
  });

  test('button has role="button" and tabindex="0"', async ({ page }) => {
    const button = page.locator('md-button[variant="filled"]').first();
    await expect(button).toHaveAttribute('role', 'button');
    await expect(button).toHaveAttribute('tabindex', '0');
  });

  test('disabled button has tabindex="-1"', async ({ page }) => {
    const button = page.locator('md-button[disabled]').first();
    await expect(button).toHaveAttribute('tabindex', '-1');
  });

  test('button label is rendered via slot', async ({ page }) => {
    const button = page.locator('md-button[variant="filled"]').first();
    const text = await button.textContent();
    expect(text?.trim()).toBe('Filled');
  });
});
