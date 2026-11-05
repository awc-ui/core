import { newE2EPage } from '@stencil/core/testing';

describe('md-tabs dynamic disabled recovery', () => {
  it('restores a Tab stop when one previously disabled tab becomes available', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-tabs aria-label="Views"><md-tab label="One"></md-tab><md-tab label="Two"></md-tab></md-tabs>');
    const tabs = await page.findAll('md-tab'); tabs.forEach(tab => tab.setProperty('disabled', true)); await page.waitForChanges();
    expect((await page.findAll('md-tab[tabindex="0"]')).length).toBe(0);
    tabs[1].setProperty('disabled', false); await page.waitForChanges();
    expect((await page.findAll('md-tab[tabindex="0"]')).length).toBe(1);
    expect((await page.find('md-tab[tabindex="0"]')).getAttribute('label')).toBe('Two');
  });
});
