import { newE2EPage } from '@stencil/core/testing';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * md-autocomplete's public events are its own (mdInput/mdChange/mdOpen/
 * mdClose/mdClear). The inner md-text-field's composed mdInput/mdChange/
 * mdSearch must not escape the shadow root: hosts would otherwise receive a
 * second mdInput per keystroke, an undocumented mdSearch, and an mdChange
 * carrying the TYPED text (not a committed value) when focus moves into the
 * listbox.
 */
describe('md-autocomplete events', () => {
  it('emits only its own events, one mdInput per keystroke, and mdChange only on commit', async () => {
    const page = await newE2EPage({ html: '<md-autocomplete label="Fruit"></md-autocomplete>' });
    await page.$eval('md-autocomplete', (el: any) => {
      el.options = [{ value: 'a', label: 'Alpha' }, { value: 'c', label: 'Charlie' }];
      (window as any).got = [];
      for (const name of ['mdInput', 'mdChange', 'mdSearch'])
        el.addEventListener(name, (e: CustomEvent) =>
          (window as any).got.push([name, e.detail, (e.composedPath()[0] as HTMLElement).localName]),
        );
    });
    await page.waitForChanges();
    await page.$eval('md-autocomplete', (el: any) => el.focusInput());
    await page.keyboard.type('al');
    await sleep(400);
    await page.keyboard.press('ArrowDown');
    await sleep(300);
    await page.keyboard.press('Enter');
    await sleep(500);
    const got = await page.evaluate(() => (window as any).got);
    expect(got.filter((g: any[]) => g[2] !== 'md-autocomplete')).toEqual([]);
    expect(got.filter((g: any[]) => g[0] === 'mdSearch')).toEqual([]);
    expect(got.filter((g: any[]) => g[0] === 'mdInput').map((g: any[]) => g[1])).toEqual(['a', 'al', 'Alpha']);
    expect(got.filter((g: any[]) => g[0] === 'mdChange').map((g: any[]) => g[1])).toEqual(['a']);
  });
});
