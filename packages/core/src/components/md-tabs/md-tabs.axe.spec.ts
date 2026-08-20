/**
 * Axe (WCAG 2.1 A/AA) sweep + APG Tabs contract checks for the md-tabs
 * family, on the shared JSDOM axe bridge (mock-doc itself is not
 * axe-compatible; layout-dependent rules live in e2e).
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdTabs } from './md-tabs';
import { MdTab } from '../md-tab/md-tab';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [MdTabs, MdTab];
const create = (html: string) => newSpecPage({ components: COMPONENTS, html });

describe('md-tabs axe contract', () => {
  it('labeled tablist + text tabs + wired panels has no violations', async () => {
    const page = await create(`
      <md-tabs aria-label="Sections">
        <md-tab id="t1" label="One" active controls="p1"></md-tab>
        <md-tab id="t2" label="Two" controls="p2"></md-tab>
        <md-tab id="t3" label="Three" disabled controls="p3"></md-tab>
      </md-tabs>
      <div id="p1" role="tabpanel" aria-labelledby="t1">one</div>
      <div id="p2" role="tabpanel" aria-labelledby="t2" hidden>two</div>
      <div id="p3" role="tabpanel" aria-labelledby="t3" hidden>three</div>
    `);
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('icon-only tabs WITH aria-label have no violations', async () => {
    const page = await create(`
      <md-tabs aria-label="Views">
        <md-tab icon="home" aria-label="Home" active></md-tab>
        <md-tab icon="settings" aria-label="Settings"></md-tab>
      </md-tabs>
    `);
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('secondary variant has no violations', async () => {
    const page = await create(`
      <md-tabs aria-label="Sections" variant="secondary">
        <md-tab label="A" active></md-tab>
        <md-tab label="B"></md-tab>
      </md-tabs>
    `);
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('APG semantics: roles, selection, disabled, roving tabindex', async () => {
    const page = await create(`
      <md-tabs aria-label="Sections" active-tab-index="1">
        <md-tab label="A"></md-tab>
        <md-tab label="B"></md-tab>
        <md-tab label="C" disabled></md-tab>
      </md-tabs>
    `);
    await page.waitForChanges();
    const tabs = Array.from(page.body.querySelectorAll('md-tab'));
    const host = page.body.querySelector('md-tabs')!;
    expect(host.getAttribute('role')).toBe('tablist');
    expect(host.getAttribute('aria-orientation')).toBe('horizontal');
    expect(tabs.map((t) => t.getAttribute('role'))).toEqual(['tab', 'tab', 'tab']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
    expect(tabs[2].getAttribute('aria-disabled')).toBe('true');
    expect(tabs.map((t) => t.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']); // exactly ONE focusable
  });

  it('icon-only tab with NO accessible name warns in dev', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await create('<md-tabs aria-label="x"><md-tab icon="home" active></md-tab></md-tabs>');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('accessible name'), expect.anything());
    warn.mockRestore();
  });

  it('tab ids auto-assign (unique) so panels can aria-labelledby them', async () => {
    const page = await create('<md-tabs aria-label="x"><md-tab label="A" active></md-tab><md-tab label="B"></md-tab></md-tabs>');
    await page.waitForChanges();
    const ids = Array.from(page.body.querySelectorAll('md-tab')).map((t) => t.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
