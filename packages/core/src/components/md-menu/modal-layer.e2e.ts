import { E2EPage, newE2EPage } from '@stencil/core/testing';

type OverlayTag = 'md-dialog' | 'md-side-sheet';
type ClippingOverflow = 'clip' | 'hidden';

const options = Array.from({ length: 10 }, (_, index) =>
  `<md-select-option value="clinician-${index}">Clinician ${index + 1}</md-select-option>`,
).join('');

async function settle(page: E2EPage, milliseconds = 200) {
  await page.waitForChanges();
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
  await page.waitForChanges();
}

async function openFixture(overlayTag: OverlayTag, direction: 'ltr' | 'rtl', dialogOverflow: ClippingOverflow = 'clip') {
  const page = await newE2EPage();
  await page.setViewport({ width: 1120, height: 900 });
  await page.setContent(`
    <style>
      body { margin: 0; }
      md-dialog::part(container) {
        inline-size: 420px;
        min-inline-size: 420px;
        max-inline-size: 420px;
        /* Both clip and hidden clip descendants; clip also prevents focus
           from scrolling the dialog frame and is its production default. */
        overflow: ${dialogOverflow};
      }
      md-side-sheet {
        --md-side-sheet-width: 420px;
        --md-side-sheet-max-width: 420px;
      }
      /* A short sheet makes the same vertical overflow observable without
         depending on option labels being wider than the sheet. */
      md-side-sheet::part(container) {
        inset-block-start: 300px;
        inset-block-end: auto;
        block-size: 240px;
      }
      md-select { display: block; inline-size: 100%; }
    </style>
    <div dir="${direction}">
      <button id="opener">Assign clinician</button>
      <${overlayTag} id="overlay" headline="Assign clinician" ${overlayTag === 'md-side-sheet' ? 'variant="modal"' : ''}>
        <md-select id="clinician" label="Clinician" filterable max-height="250">
          ${options}
        </md-select>
      </${overlayTag}>
    </div>
  `);
  await page.click('#opener');
  const overlay = await page.find('#overlay');
  await overlay.callMethod('show');
  await settle(page, 350);
  const select = await page.find('#clinician');
  await select.callMethod('show');
  await settle(page);
  return page;
}

async function outsideOption(page: E2EPage) {
  return page.evaluate(() => {
    const overlay = document.getElementById('overlay')!;
    const container = overlay.shadowRoot!.querySelector('[part="container"]')!;
    const select = document.getElementById('clinician')!;
    const menu = select.shadowRoot!.querySelector('md-menu')!;
    const viewport = menu.shadowRoot!.querySelector('[part="menu-viewport"]')!;
    const containerRect = container.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const surfaceRect = menu.shadowRoot!.querySelector('[part="surface"]')!.getBoundingClientRect();
    const items = Array.from(select.shadowRoot!.querySelectorAll('md-menu-item'));

    for (let index = 0; index < items.length; index += 1) {
      const rect = items[index].getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      // Test a fully visible option center outside the dialog/sheet. A rect
      // alone is insufficient: clipped elements still report their full rects.
      if (y <= containerRect.bottom + 8 || y >= viewportRect.bottom - 4 || y <= viewportRect.top + 4) continue;
      if (x <= viewportRect.left || x >= viewportRect.right) continue;

      // Follow hit-testing through open shadow roots. Top-layer promotion
      // should leave the original DOM/shadow ownership intact.
      const hits: Element[] = [];
      let root: Document | ShadowRoot = document;
      for (let depth = 0; depth < 12; depth += 1) {
        const hit = root.elementFromPoint(x, y);
        if (!hit || hits.includes(hit)) break;
        hits.push(hit);
        if (!hit.shadowRoot) break;
        root = hit.shadowRoot;
      }

      return {
        x,
        y,
        value: `clinician-${index}`,
        extendsPastOverlay: surfaceRect.bottom > containerRect.bottom + 8,
        hitsMenu: hits.some((hit) => hit === menu || menu.contains(hit) || menu.shadowRoot!.contains(hit)),
        hitsScrim: hits.some((hit) => hit.getAttribute('part') === 'scrim'),
        transformedOverlay: getComputedStyle(container).transform !== 'none',
        overflowX: getComputedStyle(container).overflowX,
        overflowY: getComputedStyle(container).overflowY,
      };
    }
    return null;
  });
}

async function assertOutsideOptionIsClickable(page: E2EPage, expectedOverflow: ClippingOverflow) {
  const target = await outsideOption(page);
  expect(target).not.toBeNull();
  if (!target) throw new Error('Fixture must expose a visible menu option below the overlay container.');
  expect(target.transformedOverlay).toBe(true);
  expect(target.overflowX).toBe(expectedOverflow);
  expect(target.overflowY).toBe(expectedOverflow);
  expect(target.extendsPastOverlay).toBe(true);
  expect(target.hitsMenu).toBe(true);
  expect(target.hitsScrim).toBe(false);

  await page.mouse.click(target.x, target.y);
  await settle(page);
  const state = await page.evaluate(() => {
    const select = document.getElementById('clinician') as HTMLElement & { value: string; open: boolean };
    const overlay = document.getElementById('overlay') as HTMLElement & { open: boolean };
    return { value: select.value, menuOpen: select.open, overlayOpen: overlay.open };
  });
  expect(state.value).toBe(target.value);
  expect(state.menuOpen).toBe(false);
  expect(state.overlayOpen).toBe(true);
}

async function assertEscapeClosesMenuOnly(page: E2EPage) {
  await page.evaluate(() => {
    const select = document.getElementById('clinician')!;
    (select.shadowRoot!.querySelector('input[role="combobox"]') as HTMLInputElement).focus();
  });
  await page.keyboard.press('Escape');
  await settle(page);

  const state = await page.evaluate(() => {
    const overlay = document.getElementById('overlay') as HTMLElement & { open: boolean };
    const select = document.getElementById('clinician') as HTMLElement & { open: boolean };
    const menu = select.shadowRoot!.querySelector('md-menu') as HTMLElement & { open: boolean };
    const trigger = select.shadowRoot!.querySelector('md-text-field')!;
    let active = document.activeElement;
    const focusChain: Element[] = [];
    while (active) {
      focusChain.push(active);
      active = active.shadowRoot?.activeElement ?? null;
    }
    return {
      overlayOpen: overlay.open,
      selectOpen: select.open,
      menuOpen: menu.open,
      focusOnTrigger: focusChain.includes(trigger),
    };
  });
  expect(state.overlayOpen).toBe(true);
  expect(state.selectOpen).toBe(false);
  expect(state.menuOpen).toBe(false);
  expect(state.focusOnTrigger).toBe(true);
}

describe('md-select popup across a modal clipping boundary', () => {
  for (const direction of ['ltr', 'rtl'] as const) {
    for (const overflow of ['clip', 'hidden'] as const) {
      it(`paints and selects an option outside a transformed md-dialog (${direction}, overflow: ${overflow})`, async () => {
        const page = await openFixture('md-dialog', direction, overflow);
        await assertOutsideOptionIsClickable(page, overflow);
      });
    }

    it(`Escape closes the popup, preserves md-dialog and returns trigger focus (${direction})`, async () => {
      const page = await openFixture('md-dialog', direction);
      await assertEscapeClosesMenuOnly(page);
    });
  }

  it('paints and selects an option outside a transformed modal md-side-sheet', async () => {
    const page = await openFixture('md-side-sheet', 'ltr');
    await assertOutsideOptionIsClickable(page, 'hidden');
  });

  it('Escape closes the popup, preserves modal md-side-sheet and returns trigger focus', async () => {
    const page = await openFixture('md-side-sheet', 'ltr');
    await assertEscapeClosesMenuOnly(page);
  });
});
