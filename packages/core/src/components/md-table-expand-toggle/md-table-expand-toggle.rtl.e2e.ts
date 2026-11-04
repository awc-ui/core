import { newE2EPage } from '@stencil/core/testing';

// Gate 1 (native parity): the collapsed caret is a directional chevron that
// points toward the inline END (into the row it reveals). The family mirrors its
// directional chevrons in RTL (md-table-pagination); the expand toggle did not, so
// in RTL the collapsed caret pointed backwards (right, toward the row start).
const markup = (dir: string) => `<div dir="${dir}"><md-table column-template="56px 1fr"><md-table-body>
  <md-table-row expandable><md-table-cell><md-table-expand-toggle></md-table-expand-toggle></md-table-cell><md-table-cell>Row</md-table-cell><div slot="expanded">Details</div></md-table-row>
</md-table-body></md-table></div>`;

const transform = (page: import('@stencil/core/testing').E2EPage) =>
  page.evaluate(() => getComputedStyle(document.querySelector('md-table-expand-toggle')!.shadowRoot!.querySelector('md-icon-button')!).transform);

async function open(page: import('@stencil/core/testing').E2EPage) {
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await (await page.find('md-table-row')).callMethod('toggle');
  await page.waitForChanges();
  await new Promise((r) => setTimeout(r, 50));
}

describe('md-table-expand-toggle direction', () => {
  it('mirrors the collapsed caret in RTL and still points down when expanded', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('rtl'));
    expect(await transform(page)).toBe('matrix(-1, 0, 0, 1, 0, 0)');
    await open(page);
    // scaleX(-1) rotate(90deg): the chevron points DOWN, like LTR.
    expect(await transform(page)).toBe('matrix(0, 1, 1, 0, 0, 0)');
  });

  it('is unchanged in LTR (guard)', async () => {
    const page = await newE2EPage();
    await page.setContent(markup('ltr'));
    expect(await transform(page)).toBe('none');
    await open(page);
    expect(await transform(page)).toBe('matrix(0, 1, -1, 0, 0, 0)');
  });
});
