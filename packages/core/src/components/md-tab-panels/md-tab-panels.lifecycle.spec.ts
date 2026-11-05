import { newSpecPage } from '@stencil/core/testing';
import { MdTabPanels } from './md-tab-panels';

describe('md-tab-panels public binding lifecycle', () => {
  it('rebinds for without retaining the previous tablist listener', async () => {
    const page = await newSpecPage({ components: [MdTabPanels], html: `
      <md-tabs id="first" active-tab-index="1"><md-tab id="authored" controls="external"></md-tab><md-tab></md-tab></md-tabs>
      <md-tabs id="second" active-tab-index="0"><md-tab></md-tab><md-tab></md-tab></md-tabs>
      <md-tab-panels for="first"><md-tab-panel id="panel-a"></md-tab-panel><md-tab-panel></md-tab-panel></md-tab-panels>` });
    const host = page.body.querySelector('md-tab-panels') as HTMLMdTabPanelsElement;
    const panels = Array.from(host.children);
    const active = () => panels.map(panel => panel.hasAttribute('active'));
    expect(active()).toEqual([false, true]);
    expect(panels[0].id).toBe('panel-a');
    expect(panels[0].getAttribute('aria-labelledby')).toBe('authored');
    expect(page.body.querySelector('#authored')!.getAttribute('controls')).toBe('external');
    host.for = 'second';
    await page.waitForChanges();
    expect(active()).toEqual([true, false]);
    page.body.querySelector('#first')!.dispatchEvent(new CustomEvent('mdTabChange', { detail: { index: 1 } }));
    expect(active()).toEqual([true, false]);
    page.body.querySelector('#second')!.dispatchEvent(new CustomEvent('mdTabChange', { detail: { index: 1 } }));
    expect(active()).toEqual([false, true]);
    page.body.querySelector('#second')!.dispatchEvent(new CustomEvent('mdTabChange', { detail: {} }));
    expect(active()).toEqual([false, true]);
  });

  it('skips intervening siblings and safely renders an unmatched tablist', async () => {
    const page = await newSpecPage({ components: [MdTabPanels], html: `
      <md-tabs active-tab-index="invalid"><md-tab aria-controls="authored-panel"></md-tab></md-tabs>
      <p>Help</p><md-tab-panels><md-tab-panel id="authored-panel"></md-tab-panel><span>Not a panel</span></md-tab-panels>` });
    const host = page.body.querySelector('md-tab-panels') as HTMLMdTabPanelsElement;
    expect(host.children[0].hasAttribute('active')).toBe(true);
    expect(host.children[1].hasAttribute('active')).toBe(false);
    host.for = 'missing';
    await page.waitForChanges();
    expect(host.children[0].hasAttribute('active')).toBe(true);
    expect(host.hasAttribute('data-active-resolved')).toBe(true);
  });

  it('unsubscribes when removed and responds again after reconnection', async () => {
    const page = await newSpecPage({ components: [MdTabPanels], html: `
      <md-tabs id="tabs"><md-tab></md-tab><md-tab></md-tab></md-tabs>
      <md-tab-panels for="tabs"><md-tab-panel></md-tab-panel><md-tab-panel></md-tab-panel></md-tab-panels>` });
    const host = page.body.querySelector('md-tab-panels')!;
    const tabs = page.body.querySelector('md-tabs')!;
    host.remove();
    await page.waitForChanges();
    tabs.dispatchEvent(new CustomEvent('mdTabChange', { detail: { index: 1 } }));
    expect(host.children[0].hasAttribute('active')).toBe(true);
    page.body.append(host);
    await page.waitForChanges();
    await Promise.resolve();
    tabs.dispatchEvent(new CustomEvent('mdTabChange', { detail: { index: 1 } }));
    expect(host.children[1].hasAttribute('active')).toBe(true);
  });
});
