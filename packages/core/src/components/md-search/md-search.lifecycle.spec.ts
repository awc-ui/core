import { newSpecPage } from '@stencil/core/testing';
import { MdSearch } from './md-search';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const page = await newSpecPage({
    components: [MdSearch],
    html: '<button id="opener">Search</button><md-search layout="full-screen" trigger-for="#opener"><button slot="results">Result</button></md-search><button id="elsewhere">Elsewhere</button>',
  });
  const search = page.body.querySelector('md-search') as HTMLElement;
  const instance = page.rootInstance as MdSearch;
  const opener = page.body.querySelector('#opener') as HTMLButtonElement;
  const elsewhere = page.body.querySelector('#elsewhere') as HTMLButtonElement;
  // Stencil's mock focus() does not update activeElement. Model the browser's
  // focus ownership here; the E2E tests exercise the actual focus round trip.
  let active: Element = document.body;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => active });
  jest.spyOn(opener, 'focus').mockImplementation(() => { active = opener; });
  jest.spyOn(elsewhere, 'focus').mockImplementation(() => { active = elsewhere; });
  document.body.style.overflow = 'auto';
  document.body.style.paddingInlineEnd = '7px';
  opener.focus();
  await instance.show();
  await page.waitForChanges();
  active = search;
  return { page, search, instance, opener, elsewhere };
}

function controlledMotion(search: HTMLElement) {
  const panel = deferred();
  const bar = deferred();
  const panelSampled = deferred();
  const barSampled = deferred();
  let enabled = true;
  Object.defineProperty(search, 'getAnimations', {
    configurable: true,
    value: () => {
      if (!enabled) return [];
      const expanded = search.classList.contains('md-search--open');
      (expanded ? panelSampled : barSampled).resolve();
      return [{
        effect: { target: search, getTiming: () => ({ iterations: 1 }) },
        finished: (expanded ? panel : bar).promise,
      }];
    },
  });
  return { panel, bar, panelSampled, barSampled, disable: () => { enabled = false; } };
}

// Stencil's spec queue is explicit; let the asynchronous motion completion
// enqueue its render before flushing the new bar state.
async function flushMotionRender(page: { waitForChanges: () => Promise<void> }) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await page.waitForChanges();
}

describe('md-search close completion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(document, 'activeElement');
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('padding-inline-end');
  });

  it('preserves immediate mdClose but waits for both exit stages and cleanup', async () => {
    const f = await fixture();
    const motion = controlledMotion(f.search);
    const closeEvent = jest.fn();
    f.search.addEventListener('mdClose', closeEvent);
    let settled = false;
    const closed = f.instance.whenClosed().then(() => { settled = true; });
    await f.instance.close();
    await f.page.waitForChanges();
    await motion.panelSampled.promise;
    expect(closeEvent).toHaveBeenCalledTimes(1);
    expect(f.instance.open).toBe(false);
    expect(settled).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');

    motion.panel.resolve();
    await flushMotionRender(f.page);
    await motion.barSampled.promise;
    expect(f.search).toHaveClass('md-search--closed');
    expect(document.body.style.overflow).toBe('hidden');
    expect(settled).toBe(false);
    motion.bar.resolve();
    await closed;
    expect(settled).toBe(true);
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.paddingInlineEnd).toBe('7px');
    expect(document.activeElement).toBe(f.opener);
  });

  it('keeps the original completion and scroll lock when a closing search reopens', async () => {
    const f = await fixture();
    const motion = controlledMotion(f.search);
    let settled = false;
    const closed = f.instance.whenClosed().then(() => { settled = true; });
    await f.instance.close();
    await f.page.waitForChanges();
    await motion.panelSampled.promise;
    await f.instance.show();
    motion.disable();
    motion.panel.resolve();
    await flushMotionRender(f.page);
    expect(settled).toBe(false);
    expect(f.instance.open).toBe(true);
    expect(f.search).toHaveClass('md-search--open');
    expect(document.body.style.overflow).toBe('hidden');
    await f.instance.close();
    await f.page.waitForChanges();
    await closed;
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.paddingInlineEnd).toBe('7px');
    expect(document.activeElement).toBe(f.opener);
  });

  it('cleans up and settles on disconnect without a late focus or scroll reset', async () => {
    const f = await fixture();
    const motion = controlledMotion(f.search);
    const closed = f.instance.whenClosed();
    await f.instance.close();
    await f.page.waitForChanges();
    await motion.panelSampled.promise;
    f.search.remove();
    await f.page.waitForChanges();
    await closed;
    expect(document.body.style.overflow).toBe('auto');
    expect(document.body.style.paddingInlineEnd).toBe('7px');
    f.elsewhere.focus();
    document.body.style.overflow = 'hidden';
    motion.panel.resolve();
    await flushMotionRender(f.page);
    expect(document.activeElement).toBe(f.elsewhere);
    expect(document.body.style.overflow).toBe('hidden');
    await f.instance.whenClosed();
  });

  it('does not restore focus over a control the user has already moved to', async () => {
    const f = await fixture();
    const motion = controlledMotion(f.search);
    await f.instance.close();
    await f.page.waitForChanges();
    await motion.panelSampled.promise;
    f.elsewhere.focus();
    motion.disable();
    motion.panel.resolve();
    await flushMotionRender(f.page);
    await f.instance.whenClosed();
    expect(document.activeElement).toBe(f.elsewhere);
  });
});
