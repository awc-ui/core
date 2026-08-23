import { newE2EPage } from '@stencil/core/testing';

/**
 * A button given `href` must BE a link, not imitate one.
 *
 * It previously rendered no anchor at all: the host carried role="button"
 * and navigation happened in JS via window.open. A plain click worked, so it
 * looked fine — but the accessibility tree saw a button, and every affordance
 * the browser gives a link was missing: middle-click, cmd/ctrl-click, "copy
 * link address", the status-bar URL preview, and working at all before the
 * runtime loads (which server-rendered pages depend on).
 */
describe('md-button · href renders a real link', () => {
  it('exposes an anchor with the right semantics, and only one tab stop', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <a id="before" href="#x">before</a>
      <md-button id="b" href="#target">Go</md-button>
    `);
    await page.waitForChanges();

    const info = await page.evaluate(() => {
      const host = document.getElementById('b')!;
      const a = host.shadowRoot!.querySelector('a.md-button__anchor');
      return {
        hasAnchor: !!a,
        role: a?.getAttribute('role'),
        href: a?.getAttribute('href'),
        hostRole: host.getAttribute('role'),
        hostTabindex: host.getAttribute('tabindex'),
      };
    });

    expect(info.hasAnchor).toBe(true);
    expect(info.role).toBe('link');
    expect(info.href).toBe('#target');
    // A link must not also announce as a button, nor be a second tab stop.
    expect(info.hostRole).toBeNull();
    expect(info.hostTabindex).toBeNull();

    await page.focus('#before');
    await page.keyboard.press('Tab');
    const landed = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const inner = el?.shadowRoot?.activeElement;
      return { host: el?.id, inner: inner?.tagName };
    });
    expect(landed.host).toBe('b');
    expect(landed.inner).toBe('A');
  }, 60000);

  it('navigates from the PADDING, not just the label', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button id="b" size="xl" href="#target">Go</md-button>`);
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 200));

    // 4px inside the leading edge — well inside the padding, far from the
    // label. Without the stretched hit area this misses the anchor entirely.
    const pt = await page.evaluate(() => {
      const r = document.getElementById('b')!.getBoundingClientRect();
      return { x: Math.round(r.left + 4), y: Math.round(r.top + r.height / 2) };
    });
    await page.mouse.click(pt.x, pt.y);
    await new Promise(r => setTimeout(r, 300));

    expect(await page.evaluate(() => location.hash)).toBe('#target');
  }, 60000);

  it('cancelling mdClick still vetoes navigation', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button id="b" href="#nope">Go</md-button>`);
    await page.waitForChanges();
    await page.evaluate(() => {
      document
        .getElementById('b')!
        .addEventListener('mdClick', (e: Event) => e.preventDefault());
    });

    await page.click('#b');
    await new Promise(r => setTimeout(r, 300));

    expect(await page.evaluate(() => location.hash)).toBe('');
  }, 60000);

  it('renders no anchor for an unsafe href, and does not navigate', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-button id="b" href="javascript:window.__pwned = 1">Unsafe</md-button>`,
    );
    await page.waitForChanges();

    const hasAnchor = await page.evaluate(
      () => !!document.getElementById('b')!.shadowRoot!.querySelector('a.md-button__anchor'),
    );
    // An inert anchor would be worse than none: it would still look and
    // announce like a link.
    expect(hasAnchor).toBe(false);

    await page.click('#b');
    await new Promise(r => setTimeout(r, 200));
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  }, 60000);

  it('a disabled link-button drops the anchor entirely', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button id="b" href="#target" disabled>Go</md-button>`);
    await page.waitForChanges();

    const info = await page.evaluate(() => {
      const host = document.getElementById('b')!;
      return {
        hasAnchor: !!host.shadowRoot!.querySelector('a.md-button__anchor'),
        hostRole: host.getAttribute('role'),
        hostTabindex: host.getAttribute('tabindex'),
      };
    });

    // There is no disabled state for <a>; a focusable link that refuses to
    // navigate is worse than no link.
    expect(info.hasAnchor).toBe(false);
    expect(info.hostRole).toBe('button');
    expect(info.hostTabindex).toBe('-1');
  }, 60000);

  it('leaves a plain button untouched', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button id="b">Press</md-button>`);
    await page.waitForChanges();

    const info = await page.evaluate(() => {
      const host = document.getElementById('b')!;
      return {
        hasAnchor: !!host.shadowRoot!.querySelector('a.md-button__anchor'),
        hostRole: host.getAttribute('role'),
        hostTabindex: host.getAttribute('tabindex'),
      };
    });

    expect(info.hasAnchor).toBe(false);
    expect(info.hostRole).toBe('button');
    expect(info.hostTabindex).toBe('0');
  }, 60000);
});

/**
 * A native <a>.click() navigates. md-button behaved that way before it grew a
 * real anchor, and keyboard activation routes through el.click() too — so a
 * programmatic click must still navigate even though it never reaches the
 * anchor. Caught by a Storybook play function, not by the tests above.
 */
describe('md-button · programmatic and keyboard activation still navigate', () => {
  it('el.click() navigates even though it never reaches the anchor', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button id="b" href="https://example.com/x" target="_blank">Go</md-button>`);
    await page.waitForChanges();

    const opened = await page.evaluate(() => {
      const calls: string[] = [];
      const orig = window.open;
      window.open = ((url?: string | URL) => { calls.push(String(url)); return null; }) as typeof window.open;
      (document.getElementById('b') as HTMLElement).click();
      window.open = orig;
      return calls;
    });
    expect(opened).toEqual(['https://example.com/x']);
  }, 60000);

  it('a real pointer click does NOT also navigate programmatically', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-button id="b" href="#target">Go</md-button>`);
    await page.waitForChanges();
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => {
      (window as unknown as { __opens: number }).__opens = 0;
      const orig = window.open;
      window.open = ((...a: unknown[]) => { (window as unknown as { __opens: number }).__opens++; return orig.apply(window, a as never); }) as typeof window.open;
    });
    await page.click('#b');
    await new Promise(r => setTimeout(r, 300));

    // The anchor handled it; window.open must not fire as well or the user
    // gets two navigations.
    expect(await page.evaluate(() => (window as unknown as { __opens: number }).__opens)).toBe(0);
    expect(await page.evaluate(() => location.hash)).toBe('#target');
  }, 60000);
});
