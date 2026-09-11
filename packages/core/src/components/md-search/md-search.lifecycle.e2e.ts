import { newE2EPage } from '@stencil/core/testing';

describe('md-search overlay handoff', () => {
  it.each(['full-screen', 'docked'])('waits for custom %s exit motion before handing focus to a dialog', async (layout) => {
    const page = await newE2EPage();
    await page.setContent(`
      <button id="opener">Search workspace</button>
      <md-search layout="${layout}" trigger-for="#opener"
        style="--md-search-fullscreen-expand-duration:1ms;--md-search-fullscreen-collapse-duration:650ms;--md-search-expand-duration:450ms">
        <button slot="results">Open report</button>
      </md-search>
      <md-dialog headline="Report details"><button id="report-action">Download report</button></md-dialog>
    `);
    const result = await page.evaluate(async () => {
      const search = document.querySelector('md-search') as HTMLMdSearchElement & {
        show(): Promise<void>; close(): Promise<void>; whenClosed(): Promise<void>;
      };
      const dialog = document.querySelector('md-dialog') as HTMLElement & { show(): Promise<void> };
      const opener = document.querySelector('#opener') as HTMLButtonElement;
      const frame = () => new Promise<void>((done) => requestAnimationFrame(() => done()));
      const shellAnimations = () => search.getAnimations({ subtree: true }).filter((animation) => {
        const target = (animation.effect as KeyframeEffect).target;
        return (target === search || target?.getRootNode() === search.shadowRoot)
          && animation.effect?.getTiming().iterations !== Infinity;
      });
      opener.focus();
      await search.show();
      await frame(); await frame(); await frame();
      await Promise.allSettled(shellAnimations().map((animation) => animation.finished));
      const closed = search.whenClosed();
      const start = performance.now();
      await search.close();
      await closed;
      const exitMs = performance.now() - start;
      const atCompletion = {
        exitMs,
        pendingShellMotion: shellAnimations().filter((animation) => animation.playState === 'running').length,
        closedClass: search.classList.contains('md-search--closed'),
        restoredFocus: document.activeElement === opener,
        overflow: document.body.style.overflow,
      };
      await dialog.show();
      await frame(); await frame();
      return {
        ...atCompletion,
        dialogOwnsFocus: document.activeElement === dialog || dialog.contains(document.activeElement),
        dialogLocksScroll: document.body.style.overflow === 'hidden',
      };
    });
    expect(result.pendingShellMotion).toBe(0);
    expect(result.closedClass).toBe(true);
    expect(result.restoredFocus).toBe(true);
    expect(result.overflow).toBe('');
    expect(result.dialogOwnsFocus).toBe(true);
    expect(result.dialogLocksScroll).toBe(true);
    if (layout === 'full-screen') expect(result.exitMs).toBeGreaterThanOrEqual(600);
  });

  it('restores focus to the recreated built-in icon trigger', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-search></md-search>');
    await page.evaluate(() => {
      const search = document.querySelector('md-search')!;
      const trigger = search.shadowRoot!.querySelector('[part="trigger-button"]') as HTMLElement;
      trigger.focus();
      trigger.click();
    });
    await page.waitForFunction(() => document.querySelector('md-search')!.hasAttribute('open'));
    const restored = await page.evaluate(async () => {
      const search = document.querySelector('md-search') as HTMLMdSearchElement & {
        close(): Promise<void>; whenClosed(): Promise<void>;
      };
      await search.close();
      await search.whenClosed();
      return search.shadowRoot!.activeElement === search.shadowRoot!.querySelector('[part="trigger-button"]');
    });
    expect(restored).toBe(true);
  });

  it('does not retain a fixed close delay under reduced motion', async () => {
    const page = await newE2EPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setContent('<md-search style="--md-search-fullscreen-collapse-duration:10s"></md-search>');
    const result = await page.evaluate(async () => {
      const search = document.querySelector('md-search') as HTMLMdSearchElement & {
        show(): Promise<void>; close(): Promise<void>; whenClosed(): Promise<void>;
      };
      await search.show();
      await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
      const start = performance.now();
      await search.close();
      await search.whenClosed();
      return {
        exitMs: performance.now() - start,
        open: search.hasAttribute('open'),
        overflow: document.body.style.overflow,
      };
    });
    expect(result.exitMs).toBeLessThan(1000);
    expect(result.open).toBe(false);
    expect(result.overflow).toBe('');
  });
});
