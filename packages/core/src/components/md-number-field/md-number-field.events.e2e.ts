import { newE2EPage } from '@stencil/core/testing';

/**
 * md-number-field's public events are its own typed mdInput / mdChange /
 * mdValidityChange. The inner md-text-field's events are an implementation
 * detail and must not escape the host — in particular its string-detail
 * mdSearch, which it raises on every keystroke.
 */
describe('md-number-field event surface (e2e)', () => {
  it('typing and committing raise only the number-field events', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-number-field label="Qty"></md-number-field>');
    await page.evaluate(() => {
      const w = window as unknown as { log: string[] };
      w.log = [];
      const nf = document.querySelector('md-number-field')!;
      for (const n of ['mdInput', 'mdChange', 'mdSearch', 'mdClear', 'mdPasswordToggle', 'mdSpeechResult', 'mdValidityChange']) {
        document.addEventListener(n, (e) => {
          if (e.composedPath()[0] === nf || (e.target as Element) === nf) {
            w.log.push(`${n}<${(e.composedPath()[0] as Element).localName}>:${JSON.stringify((e as CustomEvent).detail)}`);
          }
        });
      }
      const tf = nf.shadowRoot!.querySelector('md-text-field')!;
      (tf.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
    });
    await page.keyboard.type('12');
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    const log: string[] = await page.evaluate(() => (window as unknown as { log: string[] }).log);
    expect(log.filter((l) => l.startsWith('mdSearch'))).toEqual([]);
    // Every event that reaches the document came from the number-field itself.
    expect(log.every((l) => /<md-number-field>/.test(l))).toBe(true);
    expect(log.filter((l) => l.startsWith('mdInput')).length).toBe(2);
  });
});
