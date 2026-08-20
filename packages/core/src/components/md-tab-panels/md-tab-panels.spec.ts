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
