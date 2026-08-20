import { newE2EPage } from '@stencil/core/testing';

/**
 * Validity has to be exercised in a real browser: mock-doc's attachInternals()
 * returns an empty object, so in spec-land `getValidityOf` falls back to its
 * "unknown resolves to valid" rule and every assertion here would either pass
 * vacuously or fail for the wrong reason.
 */
describe('md-multi-select validity', () => {
  const OPTIONS = `
    <md-select-option value="a">Alpha</md-select-option>
    <md-select-option value="b">Beta</md-select-option>
  `;

  it('is invalid while a required control is empty, and valid once chosen', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-multi-select id="m" required>${OPTIONS}</md-multi-select>`);
    await page.waitForChanges();

    const before = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & {
        getValidity(): Promise<{ valid: boolean; flags: Record<string, boolean> }>;
      };
      return el.getValidity();
    });
    expect(before.valid).toBe(false);
    expect(before.flags.valueMissing).toBe(true);

    const after = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & {
        value: string[];
        getValidity(): Promise<{ valid: boolean }>;
      };
      el.value = ['a'];
      await new Promise((r) => setTimeout(r, 50));
      return el.getValidity();
    });
    expect(after.valid).toBe(true);
  });

  it('reports the configured missing message', async () => {
    const page = await newE2EPage();
    await page.setContent(
      `<md-multi-select id="m" required value-missing-label="Choose one or more">${OPTIONS}</md-multi-select>`,
    );
    await page.waitForChanges();
    const msg = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & {
        getValidity(): Promise<{ validationMessage: string }>;
      };
      return (await el.getValidity()).validationMessage;
    });
    expect(msg).toBe('Choose one or more');
  });

  it('lets a custom message beat valueMissing, as the platform does', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-multi-select id="m" required>${OPTIONS}</md-multi-select>`);
    await page.waitForChanges();
    const msg = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & {
        setCustomValidity(m: string): Promise<void>;
        getValidity(): Promise<{ validationMessage: string }>;
      };
      await el.setCustomValidity('Custom beats missing');
      await new Promise((r) => setTimeout(r, 50));
      return (await el.getValidity()).validationMessage;
    });
    expect(msg).toBe('Custom beats missing');
  });

  it('recovers when the custom message is cleared', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-multi-select id="m">${OPTIONS}</md-multi-select>`);
    await page.waitForChanges();
    const result = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & {
        setCustomValidity(m: string): Promise<void>;
        checkValidity(): Promise<boolean>;
      };
      await el.setCustomValidity('Nope');
      await new Promise((r) => setTimeout(r, 50));
      const invalid = await el.checkValidity();
      await el.setCustomValidity('');
      await new Promise((r) => setTimeout(r, 50));
      const valid = await el.checkValidity();
      return { invalid, valid };
    });
    expect(result.invalid).toBe(false);
    expect(result.valid).toBe(true);
  });

  it('stays silent on mount, then announces a real change once', async () => {
    const page = await newE2EPage();
    await page.setContent(`<md-multi-select id="m">${OPTIONS}</md-multi-select>`);
    await page.waitForChanges();
    const counts = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & {
        setCustomValidity(m: string): Promise<void>;
      };
      let n = 0;
      el.addEventListener('mdValidityChange', () => n++);
      const onMount = n;
      await el.setCustomValidity('Bad');
      await new Promise((r) => setTimeout(r, 50));
      const afterChange = n;
      // Same state again — a re-publish that changes nothing must stay quiet.
      await el.setCustomValidity('Bad');
      await new Promise((r) => setTimeout(r, 50));
      return { onMount, afterChange, afterRepeat: n };
    });
    expect(counts.onMount).toBe(0);
    expect(counts.afterChange).toBe(1);
    expect(counts.afterRepeat).toBe(1);
  });

  it('blocks form submission while required and empty', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-multi-select id="m" name="tags" required>${OPTIONS}</md-multi-select>
        <button type="submit">Go</button>
      </form>
    `);
    await page.waitForChanges();
    const submitted = await page.evaluate(async () => {
      const form = document.querySelector('#f') as HTMLFormElement;
      let fired = false;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        fired = true;
      });
      (form.querySelector('button') as HTMLButtonElement).click();
      await new Promise((r) => setTimeout(r, 80));
      return fired;
    });
    // `required` that does not actually block submit is decorative.
    expect(submitted).toBe(false);
  });

  it('submits the selected values as FormData', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <md-multi-select id="m" name="tags">${OPTIONS}</md-multi-select>
      </form>
    `);
    await page.waitForChanges();
    const values = await page.evaluate(async () => {
      const el = document.querySelector('#m') as HTMLElement & { value: string[] };
      el.value = ['a', 'b'];
      await new Promise((r) => setTimeout(r, 60));
      const form = document.querySelector('#f') as HTMLFormElement;
      return new FormData(form).getAll('tags').map(String);
    });
    expect(values).toEqual(['a', 'b']);
  });
});
