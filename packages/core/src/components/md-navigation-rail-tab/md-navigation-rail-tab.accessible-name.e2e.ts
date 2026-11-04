import { newE2EPage } from '@stencil/core/testing';

const tabNames = async (page: any): Promise<string[]> => {
  const out: string[] = [];
  const walk = (n: any) => { if (!n) return; if (n.role === 'tab') out.push(n.name); (n.children || []).forEach(walk); };
  walk(await page.accessibility.snapshot());
  return out;
};

/*
 * WCAG 4.1.2: label-visibility="none" (and an expanded rail with "selected") remove the
 * label from rendering, so the destination must carry its label as an explicit name.
 */
describe('md-navigation-rail-tab accessible name', () => {
  it('label-visibility="none" keeps every destination named', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary" label-visibility="none" active-index="0">
        <md-navigation-rail-tab icon="home" label="Home"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="search" label="Search"></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    expect(await tabNames(page)).toEqual(['Home', 'Search']);
  });

  it('expanded rail with label-visibility="selected" keeps inactive destinations named', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary" label-visibility="selected" variant="expanded" active-index="0">
        <md-navigation-rail-tab icon="inbox" label="Inbox"></md-navigation-rail-tab>
        <md-navigation-rail-tab icon="send" label="Sent"></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    expect(await tabNames(page)).toEqual(['Inbox', 'Sent']);
  });

  it('an author aria-label still wins', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-navigation-rail label="Primary" label-visibility="none" active-index="0">
        <md-navigation-rail-tab icon="home" label="Home" aria-label="Start page"></md-navigation-rail-tab>
      </md-navigation-rail>`);
    await page.waitForChanges();
    expect(await tabNames(page)).toEqual(['Start page']);
  });
});
