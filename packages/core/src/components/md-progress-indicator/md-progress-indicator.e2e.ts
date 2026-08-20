import { newE2EPage } from '@stencil/core/testing';

describe('md-progress-indicator e2e', () => {
  it('renders linear determinate with M3 ARIA values', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-progress-indicator value="3" max="10" label="Loading"></md-progress-indicator>');
    const el = await page.find('md-progress-indicator');
    expect(el).not.toBeNull();
    expect(el).toHaveClass('md-progress-indicator--linear');
    expect(el.getAttribute('role')).toBe('progressbar');
    expect(el.getAttribute('aria-valuenow')).toBe('3');
    expect(el.getAttribute('aria-valuemax')).toBe('10');
  });

  it('renders circular and omits aria-valuenow when indeterminate', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-progress-indicator variant="circular" indeterminate label="Loading"></md-progress-indicator>');
    const el = await page.find('md-progress-indicator');
    expect(el).not.toBeNull();
    expect(el.getAttribute('aria-valuenow')).toBeNull();
  });

  it('drives a wavy linear indicator without errors (rAF amplitude/travel)', async () => {
    const page = await newE2EPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent('<md-progress-indicator wave value="60" label="Loading"></md-progress-indicator>');
    await page.waitForChanges();
    // let a few animation frames run
    await new Promise((r) => setTimeout(r, 120));
    const maskSize = await page.evaluate(() => {
      const el = document.querySelector('md-progress-indicator') as HTMLElement;
      return getComputedStyle(el).getPropertyValue('--_wave-mask-size').trim();
    });
    expect(maskSize).toBe('40px 10px');
    expect(errors).toHaveLength(0);
  });

  it('renders a wavy circular active <path> and animates it without errors', async () => {
    const page = await newE2EPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent('<md-progress-indicator variant="circular" wave value="60" label="Loading"></md-progress-indicator>');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 160));
    const hasPath = await page.evaluate(() => {
      const el = document.querySelector('md-progress-indicator') as HTMLElement;
      const p = el.shadowRoot?.querySelector('path.md-progress-indicator__circular-active');
      return !!p && (p.getAttribute('d') ?? '').startsWith('M');
    });
    expect(hasPath).toBe(true);
    expect(errors).toHaveLength(0);
  });
});
