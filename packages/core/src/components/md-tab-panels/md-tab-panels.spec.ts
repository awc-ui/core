import { newSpecPage } from '@stencil/core/testing';
import { MdTabPanels } from './md-tab-panels';
import { MdTabPanel } from '../md-tab-panel/md-tab-panel';
import { MdTabs } from '../md-tabs/md-tabs';
import { MdTab } from '../md-tab/md-tab';

const COMPONENTS = [MdTabs, MdTab, MdTabPanels, MdTabPanel];

const FIXTURE = `
  <md-tabs aria-label="Sections" active-tab-index="1">
    <md-tab label="One"></md-tab>
    <md-tab label="Two"></md-tab>
    <md-tab label="Three"></md-tab>
  </md-tabs>
  <md-tab-panels>
    <md-tab-panel>first</md-tab-panel>
    <md-tab-panel>second</md-tab-panel>
    <md-tab-panel>third</md-tab-panel>
  </md-tab-panels>
`;

describe('md-tab-panels', () => {
  it('follows the tabs initial activeTabIndex and manages active/inert', async () => {
    const page = await newSpecPage({ components: COMPONENTS, html: FIXTURE });
    await page.waitForChanges();
    const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
    expect(panels.map((p) => p.hasAttribute('active'))).toEqual([false, true, false]);
    expect(panels.map((p) => p.hasAttribute('inert'))).toEqual([true, false, true]);
  });

  it('follows mdTabChange', async () => {
    const page = await newSpecPage({ components: COMPONENTS, html: FIXTURE });
    await page.waitForChanges();
    await (page.body.querySelector('md-tabs') as HTMLMdTabsElement).selectTab(2);
    await page.waitForChanges();
    const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
    expect(panels.map((p) => p.hasAttribute('active'))).toEqual([false, false, true]);
  });

  it('keeps panels inert while all tabs are disabled and resumes the requested tab when enabled', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: FIXTURE.replace(/<md-tab label=/g, '<md-tab disabled label='),
      flushQueue: false,
    });
    const tablist = page.body.querySelector('md-tabs')!;
    const change = jest.fn();
    tablist.addEventListener('mdTabChange', change);
    await page.waitForChanges();

    const tabs = Array.from(tablist.querySelectorAll('md-tab'));
    const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
    const state = () => panels.map(panel => [panel.hasAttribute('active'), panel.hasAttribute('inert'), panel.tabIndex]);
    const inactive = [false, true, -1];
    expect(tablist.activeTabIndex).toBe(1);
    expect(state()).toEqual([inactive, inactive, inactive]);
    expect(change).not.toHaveBeenCalled();

    await tablist.selectTab(0);
    expect(tablist.activeTabIndex).toBe(1);
    expect(change).not.toHaveBeenCalled();

    tabs[1].disabled = false;
    await page.waitForChanges();
    expect(state()).toEqual([inactive, [true, false, 0], inactive]);
    expect(change.mock.calls[0][0].detail).toEqual({ index: 1, previousIndex: -1 });

    tabs[1].disabled = true;
    await page.waitForChanges();
    expect(state()).toEqual([inactive, inactive, inactive]);
    expect(change.mock.calls[1][0].detail).toEqual({ index: -1, previousIndex: 1 });
  });

  it('links panels only to tabs in the managed default slot', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: FIXTURE.replace('<md-tab label="One">', `
        <md-tab id="named" label="Named" slot="unused"></md-tab>
        <div><md-tab id="nested" label="Nested"></md-tab></div>
        <md-tab label="One">`),
    });
    const [, , ...tabs] = Array.from(page.body.querySelectorAll('md-tab'));
    const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
    expect(page.body.querySelector('#named')!.getAttribute('aria-controls')).toBeNull();
    expect(page.body.querySelector('#nested')!.getAttribute('aria-controls')).toBeNull();
    expect(tabs.map(tab => tab.getAttribute('aria-controls'))).toEqual(panels.map(panel => panel.id));
    expect(panels.map(panel => panel.getAttribute('aria-labelledby'))).toEqual(tabs.map(tab => tab.id));
  });

  it('wires ARIA both ways: tab controls -> panel, panel aria-labelledby -> tab', async () => {
    const page = await newSpecPage({ components: COMPONENTS, html: FIXTURE });
    await page.waitForChanges();
    const tabs = Array.from(page.body.querySelectorAll('md-tab'));
    const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
    panels.forEach((panel, i) => {
      expect(panel.id.length).toBeGreaterThan(0);
      expect(panel.getAttribute('aria-labelledby')).toBe(tabs[i].id);
      expect(tabs[i].getAttribute('controls')).toBe(panel.id);
      expect(panel.getAttribute('role')).toBe('tabpanel');
    });
    // active panel focusable, inactive not
    expect(panels[1].getAttribute('tabindex')).toBe('0');
    expect(panels[0].getAttribute('tabindex')).toBe('-1');
  });

  it('keeps separate tab groups uniquely linked and stable when selection changes', async () => {
    // Repeated Math.random values used to give both groups the same ids.
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const page = await newSpecPage({ components: COMPONENTS, html: FIXTURE + FIXTURE });
      await page.waitForChanges();
      const tabs = Array.from(page.body.querySelectorAll('md-tab'));
      const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
      const ids = [...tabs, ...panels].map((element) => element.id);

      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      panels.forEach((panel, i) => {
        expect(panel.getAttribute('aria-labelledby')).toBe(tabs[i].id);
        expect(tabs[i].getAttribute('controls')).toBe(panel.id);
      });

      await (page.body.querySelector('md-tabs') as HTMLMdTabsElement).selectTab(2);
      await page.waitForChanges();
      expect([...tabs, ...panels].map((element) => element.id)).toEqual(ids);
      expect(panels.map((panel) => panel.hasAttribute('active'))).toEqual([
        false, false, true, false, true, false,
      ]);
    } finally {
      random.mockRestore();
    }
  });

  it('for="" resolves the tabs by id when not a sibling', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `
        <md-tabs id="远tabs" aria-label="t"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>
        <div><md-tab-panels for="远tabs"><md-tab-panel>a</md-tab-panel><md-tab-panel>b</md-tab-panel></md-tab-panels></div>
      `,
    });
    await page.waitForChanges();
    await (page.body.querySelector('md-tabs') as HTMLMdTabsElement).selectTab(1);
    await page.waitForChanges();
    const panels = Array.from(page.body.querySelectorAll('md-tab-panel'));
    expect(panels.map((p) => p.hasAttribute('active'))).toEqual([false, true]);
  });
});
