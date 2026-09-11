import { newE2EPage } from '@stencil/core/testing';

type E2EPage = Awaited<ReturnType<typeof newE2EPage>>;
type ValiditySnapshot = { valid: boolean; validationMessage: string; flags: Record<string, boolean> };
type ValidatableControl = HTMLElement & {
  getValidity(): Promise<ValiditySnapshot>;
  checkValidity(): Promise<boolean>;
  reportValidity(): Promise<boolean>;
  setCustomValidity(message: string): Promise<void>;
  error?: boolean;
  errorText?: string;
};
type AuditWindow = Window & {
  __inlineValidationAudit: { invalids: Event[]; submits: number; values: Array<[string, FormDataEntryValue][]> };
};
type ControlCase = { tag: string; markup: string; property: string; value: unknown };

const option = '<md-select-option value="ok">Available choice</md-select-option>';
const controls: ControlCase[] = [
  { tag: 'md-text-field', markup: '<md-text-field id="field" name="value" label="Name" required></md-text-field>', property: 'value', value: 'Ada' },
  { tag: 'md-number-field', markup: '<md-number-field id="field" name="value" label="Quantity" required></md-number-field>', property: 'value', value: 3 },
  { tag: 'md-select', markup: `<md-select id="field" name="value" label="Choice" required>${option}</md-select>`, property: 'value', value: 'ok' },
  { tag: 'md-autocomplete', markup: `<md-autocomplete id="field" name="value" label="City" required>${option}</md-autocomplete>`, property: 'value', value: 'ok' },
  { tag: 'md-multi-select', markup: `<md-multi-select id="field" name="value" label="Teams" required>${option}</md-multi-select>`, property: 'value', value: ['ok'] },
  { tag: 'md-date-picker', markup: '<md-date-picker id="field" name="value" label="Date" required></md-date-picker>', property: 'value', value: '2026-09-11' },
  { tag: 'md-time-picker', markup: '<md-time-picker id="field" name="value" label="Time" required></md-time-picker>', property: 'value', value: '09:30' },
  { tag: 'md-otp-field', markup: '<md-otp-field id="field" name="value" label="Code" length="6" required></md-otp-field>', property: 'value', value: '246810' },
  { tag: 'md-checkbox', markup: '<md-checkbox id="field" name="value" aria-label="Accept terms" required></md-checkbox>', property: 'checked', value: true },
  { tag: 'md-radio', markup: '<md-radio id="field" name="value" value="ok" aria-label="Available choice" required></md-radio>', property: 'checked', value: true },
  { tag: 'md-switch', markup: '<md-switch id="field" name="value" aria-label="Enable access" required></md-switch>', property: 'selected', value: true },
];

async function settle(page: E2EPage) {
  await page.waitForChanges();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.waitForChanges();
}

async function fixture(page: E2EPage, markup: string) {
  await page.setContent(`<button id="sentinel" type="button">Keep focus here</button><form id="form">${markup}</form>`);
  await settle(page);
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>('#form')!;
    const audit = { invalids: [] as Event[], submits: 0, values: [] as Array<[string, FormDataEntryValue][]> };
    (window as unknown as AuditWindow).__inlineValidationAudit = audit;
    // Keep Event objects: the capture listener runs before the control cancels
    // invalid, so defaultPrevented must be read after dispatch completes.
    form.addEventListener('invalid', (event) => audit.invalids.push(event), true);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      audit.submits += 1;
      audit.values.push(Array.from(new FormData(form).entries()));
    });
    document.querySelector<HTMLButtonElement>('#sentinel')!.focus();
  });
}

const validity = (page: E2EPage, selector = '#field') =>
  page.$eval(selector, (el) => (el as ValidatableControl).getValidity());

const audit = (page: E2EPage) => page.evaluate(() => {
  const state = (window as unknown as AuditWindow).__inlineValidationAudit;
  return {
    submits: state.submits,
    values: state.values,
    invalids: state.invalids.map((event) => ({
      id: (event.target as HTMLElement).id,
      canceled: event.defaultPrevented,
    })),
    focused: document.activeElement?.id,
  };
});

/** Read rendered text through composite controls without counting hidden
 * popover options, style text, or an input's value as an inline message. */
const visibleText = (page: E2EPage, selector = '#field') => page.$eval(selector, (host) => {
  const text: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent?.trim();
      if (!value) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      if (Array.from(range.getClientRects()).some((rect) => rect.width > 0 && rect.height > 0)) text.push(value);
      return;
    }
    if (node instanceof Element) {
      if (node.matches('style, script, template, [hidden], [aria-hidden="true"]')) return;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
      if (node.shadowRoot) Array.from(node.shadowRoot.childNodes).forEach(visit);
    }
    Array.from(node.childNodes).forEach(visit);
  };
  visit(host);
  return text.join(' ').replace(/\s+/g, ' ').trim();
});

const requestSubmit = (page: E2EPage) => page.evaluate(() => {
  document.querySelector<HTMLFormElement>('#form')!.requestSubmit();
});

async function fill(page: E2EPage, control: ControlCase) {
  await page.$eval('#field', (el, property: string, value: unknown) => {
    (el as unknown as Record<string, unknown>)[property] = value;
  }, control.property, control.value);
  await settle(page);
}

describe('inline platform validation (real browser)', () => {
  it.each(controls.map((control) => [control.tag, control] as const))(
    '%s cancels native UI, keeps submission blocked, resets, and accepts a valid value',
    async (_tag, control) => {
      const page = await newE2EPage();
      await fixture(page, control.markup);
      const initial = await validity(page);
      expect(initial.valid).toBe(false);
      expect(initial.validationMessage.length).toBeGreaterThan(0);
      expect(await visibleText(page)).not.toContain(initial.validationMessage);

      await requestSubmit(page);
      await settle(page);
      const failed = await audit(page);
      expect(failed.submits).toBe(0);
      expect(failed.invalids).toEqual([{ id: 'field', canceled: true }]);
      expect(failed.focused).toBe('sentinel');
      expect((await validity(page)).valid).toBe(false);
      expect(await visibleText(page)).toContain(initial.validationMessage);

      await page.evaluate(() => document.querySelector<HTMLFormElement>('#form')!.reset());
      await settle(page);
      expect((await validity(page)).valid).toBe(false);
      expect(await visibleText(page)).not.toContain(initial.validationMessage);

      // Re-reveal before fixing: becoming valid must remove the automatic error.
      await requestSubmit(page);
      await settle(page);
      expect(await visibleText(page)).toContain(initial.validationMessage);
      await fill(page, control);
      expect((await validity(page)).valid).toBe(true);
      expect(await visibleText(page)).not.toContain(initial.validationMessage);
      await requestSubmit(page);
      await settle(page);
      const passed = await audit(page);
      expect(passed.submits).toBe(1);
      expect(passed.values[0].some(([name]) => name === 'value')).toBe(true);
    },
  );

  it.each(['md-text-field', 'md-number-field', 'md-select'])(
    '%s preserves authored errorText without changing the public error prop',
    async (tag) => {
      const page = await newE2EPage();
      await fixture(page, controls.find((control) => control.tag === tag)!.markup);
      await page.$eval('#field', async (el) => {
        const field = el as ValidatableControl;
        field.errorText = 'Use an approved value.';
        await field.setCustomValidity('Server validation rejected this value.');
      });
      await settle(page);
      await requestSubmit(page);
      await settle(page);
      const text = await visibleText(page);
      expect(text).toContain('Use an approved value.');
      expect(text).not.toContain('Server validation rejected this value.');
      const properties = await page.$eval('#field', (el) => {
        const field = el as ValidatableControl;
        return { error: field.error, errorText: field.errorText };
      });
      expect(properties).toEqual({ error: false, errorText: 'Use an approved value.' });
      expect((await validity(page)).flags.customError).toBe(true);
      expect((await audit(page)).submits).toBe(0);
    },
  );

  it('checkValidity does not focus; explicit reportValidity focuses the field and returns false', async () => {
    const page = await newE2EPage();
    await fixture(page, controls[1].markup);
    expect(await page.$eval('#field', (el) => (el as ValidatableControl).checkValidity())).toBe(false);
    await settle(page);
    expect((await audit(page)).focused).toBe('sentinel');
    expect(await page.evaluate(() => document.querySelector<HTMLFormElement>('#form')!.checkValidity())).toBe(false);
    await settle(page);
    expect((await audit(page)).focused).toBe('sentinel');
    expect(await page.$eval('#field', (el) => (el as ValidatableControl).reportValidity())).toBe(false);
    await settle(page);
    expect((await audit(page)).focused).toBe('field');
    expect(await visibleText(page)).toContain((await validity(page)).validationMessage);
  });

  it('md-button submission focuses only the first invalid control, then the next unresolved control', async () => {
    const page = await newE2EPage();
    await fixture(page, `
      <md-text-field id="first" name="first" label="First name" required></md-text-field>
      <md-number-field id="second" name="second" label="Quantity" required></md-number-field>
      <md-button id="submit" type="submit">Continue</md-button>
    `);
    await (await page.find('#submit')).click();
    await settle(page);
    expect((await audit(page)).focused).toBe('first');
    expect((await audit(page)).submits).toBe(0);
    expect(await visibleText(page, '#first')).toContain((await validity(page, '#first')).validationMessage);
    expect(await visibleText(page, '#second')).toContain((await validity(page, '#second')).validationMessage);
    await page.$eval('#first', (el) => { (el as HTMLMdTextFieldElement).value = 'Ada'; });
    await settle(page);
    await (await page.find('#submit')).click();
    await settle(page);
    expect((await audit(page)).focused).toBe('second');
    expect((await audit(page)).submits).toBe(0);
    await page.$eval('#second', (el) => { (el as HTMLMdNumberFieldElement).value = 2; });
    await settle(page);
    await (await page.find('#submit')).click();
    await settle(page);
    expect((await audit(page)).submits).toBe(1);
  });

  it('does not cancel a native input sibling invalid event', async () => {
    const page = await newE2EPage();
    await fixture(page, `${controls[0].markup}<label>Native field<input id="native" name="native" required></label>`);
    await requestSubmit(page);
    await settle(page);
    const failed = await audit(page);
    expect(failed.submits).toBe(0);
    expect(failed.invalids).toEqual([
      { id: 'field', canceled: true },
      { id: 'native', canceled: false },
    ]);
    expect(await visibleText(page)).toContain((await validity(page)).validationMessage);
  });
});

// Append after the existing suite. Reuses controls, fixture, settle, validity,
// visibleText, fill, requestSubmit, and audit from inline-validation.e2e.ts.
describe('inline validation field reuse and authored errors', () => {
  it.each(controls.map((control) => [control.tag, control] as const))(
    '%s resets generated errors when reused under a new field name',
    async (_tag, control) => {
      const page = await newE2EPage();
      await fixture(page, control.markup);
      await requestSubmit(page);
      await settle(page);
      const firstMessage = (await validity(page)).validationMessage;
      expect(await visibleText(page)).toContain(firstMessage);

      // Correcting the old field clears the text but leaves its reveal history.
      await fill(page, control);
      expect((await validity(page)).valid).toBe(true);
      expect(await visibleText(page)).not.toContain(firstMessage);

      const empty = control.property === 'checked' || control.property === 'selected'
        ? false : Array.isArray(control.value) ? [] : control.tag === 'md-number-field' ? null : '';
      await page.$eval('#field', (el, property: string, value: unknown) => {
        // Framework keyed-host reuse: new identity and empty value in one turn.
        const field = el as unknown as Record<string, unknown>;
        field.name = 'new-field';
        field[property] = value;
      }, control.property, empty);
      await settle(page);
      const reused = await validity(page);
      expect(reused.valid).toBe(false);
      expect(reused.validationMessage.length).toBeGreaterThan(0);
      expect(await visibleText(page)).not.toContain(reused.validationMessage);

      expect(await page.$eval('#field', (el) => (el as ValidatableControl).reportValidity())).toBe(false);
      await settle(page);
      expect(await visibleText(page)).toContain(reused.validationMessage);
      expect((await audit(page)).submits).toBe(0);
    },
  );

  it.each(['md-checkbox', 'md-radio', 'md-switch'])(
    '%s hides generated errors while its fieldset is disabled and can report again',
    async (tag) => {
      const page = await newE2EPage();
      const control = controls.find((item) => item.tag === tag)!;
      await fixture(page, `<fieldset id="group"><legend>Required choice</legend>${control.markup}</fieldset>`);
      await requestSubmit(page);
      await settle(page);
      const message = (await validity(page)).validationMessage;
      expect(await visibleText(page)).toContain(message);

      await page.$eval('#group', (el) => { (el as HTMLFieldSetElement).disabled = true; });
      await settle(page);
      expect(await visibleText(page)).not.toContain(message);
      expect(await page.evaluate(() => document.querySelector<HTMLFormElement>('#form')!.checkValidity())).toBe(true);
      await requestSubmit(page);
      await settle(page);
      expect((await audit(page)).submits).toBe(1);

      await page.$eval('#group', (el) => { (el as HTMLFieldSetElement).disabled = false; });
      await settle(page);
      expect((await validity(page)).valid).toBe(false);
      expect(await visibleText(page)).not.toContain(message);
      expect(await page.$eval('#field', (el) => (el as ValidatableControl).reportValidity())).toBe(false);
      await settle(page);
      expect(await visibleText(page)).toContain(message);
      expect((await audit(page)).submits).toBe(1);
    },
  );

  it('preserves authored checkbox error and errorText through reset and fieldset disabling', async () => {
    const page = await newE2EPage();
    await fixture(page, '<fieldset id="group"><legend>Agreement</legend><md-checkbox id="field" name="terms" required error error-text="Confirm the terms with your administrator." aria-label="Accept terms"></md-checkbox></fieldset>');
    const authored = 'Confirm the terms with your administrator.';
    const authoredState = () => page.$eval('#field', (el) => {
      const field = el as ValidatableControl;
      return { error: field.error, errorText: field.errorText };
    });
    const expected = { error: true, errorText: authored };
    expect(await authoredState()).toEqual(expected);
    expect(await visibleText(page)).toContain(authored);
    await requestSubmit(page);
    await settle(page);
    await page.evaluate(() => document.querySelector<HTMLFormElement>('#form')!.reset());
    await settle(page);
    expect(await authoredState()).toEqual(expected);
    expect(await visibleText(page)).toContain(authored);
    await page.$eval('#group', (el) => { (el as HTMLFieldSetElement).disabled = true; });
    await settle(page);
    expect(await authoredState()).toEqual(expected);
    expect(await visibleText(page)).toContain(authored);
    await page.$eval('#group', (el) => { (el as HTMLFieldSetElement).disabled = false; });
    await settle(page);
    expect(await authoredState()).toEqual(expected);
    expect(await visibleText(page)).toContain(authored);
  });
});
