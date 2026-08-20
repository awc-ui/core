import { newSpecPage, SpecPage } from '@stencil/core/testing';
import { MdOtpField } from './md-otp-field';

async function create(html: string) {
  return newSpecPage({ components: [MdOtpField], html });
}

const cells = (page: SpecPage): HTMLInputElement[] =>
  Array.from(page.root!.shadowRoot!.querySelectorAll('input.md-otp-field__cell'));

/** Simulate typing into a cell: the DOM value lands first, then `input` fires. */
const type = async (page: SpecPage, index: number, text: string) => {
  const input = cells(page)[index];
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await page.waitForChanges();
};

const keydown = async (page: SpecPage, index: number, key: string): Promise<KeyboardEvent> => {
  const evt = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  cells(page)[index].dispatchEvent(evt);
  await page.waitForChanges();
  return evt;
};

/** ClipboardEvent/DataTransfer don't exist in the spec environment — a plain
 *  Event with a stubbed `clipboardData` exercises the same handler. */
const paste = async (page: SpecPage, index: number, text: string) => {
  const evt = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'clipboardData', { value: { getData: () => text } });
  cells(page)[index].dispatchEvent(evt);
  await page.waitForChanges();
};

describe('md-otp-field', () => {
  afterEach(() => {
    // A test that installs fake timers and then hangs never reaches its own
    // `finally`, so they'd stay installed for the rest of the FILE — restore
    // unconditionally so one broken test can't wedge the suite.
    jest.useRealTimers();
  });

  // ─── Rendering ────────────────────────────────────────────
  describe('rendering', () => {
    it('renders 6 cells by default inside a labelled group', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      expect(page.root).toHaveClass('md-otp-field');
      const group = page.root!.shadowRoot!.querySelector('[part="cells"]');
      expect(group?.getAttribute('role')).toBe('group');
      expect(group?.getAttribute('aria-label')).toBe('One-time code');
      expect(cells(page)).toHaveLength(6);
    });

    it('renders `length` cells', async () => {
      const page = await create('<md-otp-field length="4"></md-otp-field>');
      expect(cells(page)).toHaveLength(4);
    });

    it('cells are text inputs; mask renders them as password inputs', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      expect(cells(page)[0].getAttribute('type')).toBe('text');
      (page.root as unknown as MdOtpField).mask = true;
      await page.waitForChanges();
      expect(cells(page).every((c) => c.getAttribute('type') === 'password')).toBe(true);
      expect(page.root).toHaveClass('md-otp-field--masked');
    });

    it('autocomplete: one-time-code on the FIRST cell only', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      const inputs = cells(page);
      expect(inputs[0].getAttribute('autocomplete')).toBe('one-time-code');
      expect(inputs.slice(1).every((c) => c.getAttribute('autocomplete') === 'off')).toBe(true);
    });

    it('inputmode derives from validationType and the inputmode attr overrides it', async () => {
      const numeric = await create('<md-otp-field></md-otp-field>');
      expect(cells(numeric)[0].getAttribute('inputmode')).toBe('numeric');

      const alpha = await create('<md-otp-field validation-type="alpha"></md-otp-field>');
      expect(cells(alpha)[0].getAttribute('inputmode')).toBe('text');

      const overridden = await create('<md-otp-field inputmode="tel"></md-otp-field>');
      expect(cells(overridden)[0].getAttribute('inputmode')).toBe('tel');
    });

    it('does NOT reflect value to an attribute (value privacy)', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      (page.root as unknown as MdOtpField).value = '123456';
      await page.waitForChanges();
      expect(page.root!.getAttribute('value')).toBeNull();
      expect((page.rootInstance as MdOtpField).value).toBe('123456');
    });

    it('sanitizes an authored initial value through the pipeline', async () => {
      const page = await create('<md-otp-field value=" 12a3 4x5 "></md-otp-field>');
      expect((page.rootInstance as MdOtpField).value).toBe('12345');
      expect(cells(page)[0].value).toBe('1');
    });
  });

  // ─── Typing ───────────────────────────────────────────────
  describe('typing', () => {
    it('a valid char fills the cell and updates value + mdInput', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      const onInput = jest.fn();
      page.root!.addEventListener('mdInput', onInput);
      await type(page, 0, '7');
      expect((page.rootInstance as MdOtpField).value).toBe('7');
      expect(onInput).toHaveBeenCalledTimes(1);
      expect((onInput.mock.calls[0][0] as CustomEvent).detail).toBe('7');
    });

    it('typing cell by cell accumulates to a complete code and fires mdComplete once', async () => {
      const page = await create('<md-otp-field length="4"></md-otp-field>');
      const onComplete = jest.fn();
      page.root!.addEventListener('mdComplete', onComplete);
      await type(page, 0, '1');
      await type(page, 1, '2');
      await type(page, 2, '3');
      expect(onComplete).not.toHaveBeenCalled();
      await type(page, 3, '4');
      expect((page.rootInstance as MdOtpField).value).toBe('1234');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect((onComplete.mock.calls[0][0] as CustomEvent).detail).toEqual({ value: '1234' });
    });

    it('rejected chars fire mdInvalidInput, leave value untouched and restore the cell DOM', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      const onInvalid = jest.fn();
      const onInput = jest.fn();
      page.root!.addEventListener('mdInvalidInput', onInvalid);
      page.root!.addEventListener('mdInput', onInput);
      await type(page, 0, 'x');
      expect((page.rootInstance as MdOtpField).value).toBe('');
      expect(cells(page)[0].value).toBe('');
      expect(onInput).not.toHaveBeenCalled();
      expect(onInvalid).toHaveBeenCalledTimes(1);
      expect((onInvalid.mock.calls[0][0] as CustomEvent).detail).toEqual({
        attempted: 'x',
        reason: 'input-change',
      });
    });

    it('a full-length burst into one cell (SMS autofill) replaces the whole value', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      await type(page, 0, '987654');
      expect((page.rootInstance as MdOtpField).value).toBe('987654');
    });

    it('transform="uppercase" upper-cases accepted characters', async () => {
      const page = await create(
        '<md-otp-field validation-type="alphanumeric" transform="uppercase"></md-otp-field>',
      );
      await type(page, 0, 'a');
      expect((page.rootInstance as MdOtpField).value).toBe('A');
      expect(cells(page)[0].value).toBe('A');
    });

    it('typing into a cell beyond the fill point lands at the first empty position (contiguous value)', async () => {
      const page = await create('<md-otp-field value="1"></md-otp-field>');
      await type(page, 4, '9');
      expect((page.rootInstance as MdOtpField).value).toBe('19');
    });
  });

  // ─── Keyboard ─────────────────────────────────────────────
  describe('keyboard', () => {
    it('Backspace on a filled cell clears it (chars after it shift left)', async () => {
      const page = await create('<md-otp-field value="123"></md-otp-field>');
      await keydown(page, 1, 'Backspace');
      expect((page.rootInstance as MdOtpField).value).toBe('13');
    });

    it('Backspace on an empty cell walks back and clears the previous one', async () => {
      const page = await create('<md-otp-field value="12"></md-otp-field>');
      const onInput = jest.fn();
      page.root!.addEventListener('mdInput', onInput);
      await keydown(page, 2, 'Backspace');
      expect((page.rootInstance as MdOtpField).value).toBe('1');
      expect(onInput).toHaveBeenCalledTimes(1);
    });

    it('Delete clears the current cell without moving', async () => {
      const page = await create('<md-otp-field value="123"></md-otp-field>');
      await keydown(page, 0, 'Delete');
      expect((page.rootInstance as MdOtpField).value).toBe('23');
    });

    it('ArrowLeft/ArrowRight/Home/End are consumed (preventDefault) and never edit the value', async () => {
      const page = await create('<md-otp-field value="12"></md-otp-field>');
      for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
        const evt = await keydown(page, 1, key);
        expect(evt.defaultPrevented).toBe(true);
      }
      expect((page.rootInstance as MdOtpField).value).toBe('12');
    });

    it('readonly ignores Backspace/Delete/typing but still consumes navigation keys', async () => {
      const page = await create('<md-otp-field readonly value="123"></md-otp-field>');
      await keydown(page, 0, 'Backspace');
      await keydown(page, 0, 'Delete');
      await type(page, 3, '9');
      expect((page.rootInstance as MdOtpField).value).toBe('123');
      const nav = await keydown(page, 0, 'ArrowRight');
      expect(nav.defaultPrevented).toBe(true);
    });
  });

  // ─── Paste ────────────────────────────────────────────────
  describe('paste', () => {
    it('fills from position 0 regardless of the pasted-into cell', async () => {
      const page = await create('<md-otp-field value="12"></md-otp-field>');
      const onInput = jest.fn();
      page.root!.addEventListener('mdInput', onInput);
      await paste(page, 3, '987654');
      expect((page.rootInstance as MdOtpField).value).toBe('987654');
      expect(onInput).toHaveBeenCalledTimes(1);
    });

    it('filters the pasted text and reports rejects via mdInvalidInput', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      const onInvalid = jest.fn();
      page.root!.addEventListener('mdInvalidInput', onInvalid);
      await paste(page, 0, '12-34');
      expect((page.rootInstance as MdOtpField).value).toBe('1234');
      expect((onInvalid.mock.calls[0][0] as CustomEvent).detail).toEqual({
        attempted: '12-34',
        reason: 'input-paste',
      });
    });

    it('clamps a too-long paste to length (silently — no mdInvalidInput)', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      const onInvalid = jest.fn();
      page.root!.addEventListener('mdInvalidInput', onInvalid);
      await paste(page, 0, '1234567890');
      expect((page.rootInstance as MdOtpField).value).toBe('123456');
      expect(onInvalid).not.toHaveBeenCalled();
    });

    it('a complete paste fires mdComplete even when the value is unchanged (and mdInput stays silent)', async () => {
      const page = await create('<md-otp-field value="123456"></md-otp-field>');
      const onComplete = jest.fn();
      const onInput = jest.fn();
      page.root!.addEventListener('mdComplete', onComplete);
      page.root!.addEventListener('mdInput', onInput);
      await paste(page, 0, '123456');
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onInput).not.toHaveBeenCalled();
    });
  });

  // ─── Completion / commit ordering ─────────────────────────
  describe('completion', () => {
    it('emits mdInput → mdChange → mdComplete when the final cell fills', async () => {
      const page = await create('<md-otp-field length="2"></md-otp-field>');
      const order: string[] = [];
      for (const name of ['mdInput', 'mdChange', 'mdComplete']) {
        page.root!.addEventListener(name, () => order.push(name));
      }
      await type(page, 0, '1');
      await type(page, 1, '2');
      expect(order).toEqual(['mdInput', 'mdInput', 'mdChange', 'mdComplete']);
    });
  });

  // ─── Grouping ─────────────────────────────────────────────
  describe('grouping', () => {
    it('group-size chunks the cells with aria-hidden separators', async () => {
      const page = await create('<md-otp-field group-size="3"></md-otp-field>');
      const separators = page.root!.shadowRoot!.querySelectorAll('[part="separator"]');
      expect(separators).toHaveLength(1);
      expect(separators[0].getAttribute('aria-hidden')).toBe('true');
      expect(separators[0].querySelector('slot[name="separator"]')).not.toBeNull();
    });

    it('group-size 2 on length 6 renders two separators; 0 renders none', async () => {
      const grouped = await create('<md-otp-field group-size="2"></md-otp-field>');
      expect(grouped.root!.shadowRoot!.querySelectorAll('[part="separator"]')).toHaveLength(2);
      const plain = await create('<md-otp-field></md-otp-field>');
      expect(plain.root!.shadowRoot!.querySelectorAll('[part="separator"]')).toHaveLength(0);
    });
  });

  // ─── Accessibility ────────────────────────────────────────
  describe('accessibility', () => {
    it('labels each cell from cell-label-template with 1-based {index} and {length}', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      expect(cells(page)[1].getAttribute('aria-label')).toBe('Character 2 of 6');
      expect(cells(page)[5].getAttribute('aria-label')).toBe('Character 6 of 6');
    });

    it('cell-label-template and label props are translatable overrides', async () => {
      const page = await create(
        '<md-otp-field label="Code" cell-label-template="Zeichen {index} von {length}"></md-otp-field>',
      );
      const group = page.root!.shadowRoot!.querySelector('[part="cells"]');
      expect(group?.getAttribute('aria-label')).toBe('Code');
      expect(cells(page)[0].getAttribute('aria-label')).toBe('Zeichen 1 von 6');
    });

    it('supporting text renders and cells reference it via aria-describedby (same shadow scope)', async () => {
      const page = await create('<md-otp-field supporting-text="Check your phone"></md-otp-field>');
      const support = page.root!.shadowRoot!.querySelector('[part="supporting-text"]');
      expect(support?.textContent).toBe('Check your phone');
      expect(support?.getAttribute('role')).toBeNull();
      const describedBy = cells(page)[0].getAttribute('aria-describedby');
      expect(describedBy).toBe(support?.getAttribute('id'));
    });

    it('error state: errorText replaces supportingText, role="alert", aria-invalid on cells', async () => {
      const page = await create(
        '<md-otp-field supporting-text="Hint" error error-text="Wrong code"></md-otp-field>',
      );
      expect(page.root).toHaveClass('md-otp-field--error');
      const support = page.root!.shadowRoot!.querySelector('[part="supporting-text"]');
      expect(support?.textContent).toBe('Wrong code');
      expect(support?.getAttribute('role')).toBe('alert');
      expect(cells(page).every((c) => c.getAttribute('aria-invalid') === 'true')).toBe(true);
    });

    it('aria-required lands on the first cell only', async () => {
      const page = await create('<md-otp-field required></md-otp-field>');
      const inputs = cells(page);
      expect(inputs[0].getAttribute('aria-required')).toBe('true');
      expect(inputs[1].getAttribute('aria-required')).toBeNull();
    });

    it('reserve-supporting-space renders the support row without text', async () => {
      const page = await create('<md-otp-field reserve-supporting-space></md-otp-field>');
      expect(page.root!.shadowRoot!.querySelector('[part="supporting-text"]')).not.toBeNull();
    });
  });

  // ─── Disabled ─────────────────────────────────────────────
  describe('disabled', () => {
    it('disables every cell and ignores typing', async () => {
      const page = await create('<md-otp-field disabled></md-otp-field>');
      expect(page.root).toHaveClass('md-otp-field--disabled');
      expect(cells(page).every((c) => c.hasAttribute('disabled'))).toBe(true);
      await type(page, 0, '1');
      expect((page.rootInstance as MdOtpField).value).toBe('');
    });
  });

  // ─── Form integration ─────────────────────────────────────
  // The submitted value / required-blocks-submit behaviour rides on
  // ElementInternals, which the Stencil spec mock no-ops (setFormValue /
  // setValidity aren't implemented) — the real FormData round-trip, required
  // gating, incomplete-label gating and autoSubmit are covered in
  // md-otp-field.e2e.ts.
  describe('form', () => {
    it('formResetCallback clears the value', async () => {
      const page = await create('<md-otp-field value="123456"></md-otp-field>');
      (page.rootInstance as MdOtpField).formResetCallback();
      await page.waitForChanges();
      expect((page.rootInstance as MdOtpField).value).toBe('');
      expect(cells(page)[0].value).toBe('');
    });

    it('formStateRestoreCallback restores a sanitized value', async () => {
      const page = await create('<md-otp-field></md-otp-field>');
      (page.rootInstance as MdOtpField).formStateRestoreCallback('98 76a54');
      await page.waitForChanges();
      expect((page.rootInstance as MdOtpField).value).toBe('987654');
    });

    it('exposes the constraint-validation quintet (permissive under the spec mock)', async () => {
      const page = await create('<md-otp-field required></md-otp-field>');
      const instance = page.rootInstance as MdOtpField;
      await instance.setCustomValidity('server says no');
      const validity = await instance.getValidity();
      expect(typeof validity.valid).toBe('boolean');
      expect(await instance.checkValidity()).toBe(true);
      expect(await instance.reportValidity()).toBe(true);
      await instance.setCustomValidity('');
    });

    it('clear() empties the value; setFocus() resolves', async () => {
      const page = await create('<md-otp-field value="123"></md-otp-field>');
      const instance = page.rootInstance as MdOtpField;
      await instance.clear();
      await page.waitForChanges();
      expect(instance.value).toBe('');
      await expect(instance.setFocus()).resolves.toBeUndefined();
    });

    it('re-clamps the value when length shrinks', async () => {
      const page = await create('<md-otp-field value="123456"></md-otp-field>');
      (page.root as unknown as MdOtpField).length = 4;
      await page.waitForChanges();
      expect((page.rootInstance as MdOtpField).value).toBe('1234');
      expect(cells(page)).toHaveLength(4);
    });
  });

  // ─── Density / RTL ────────────────────────────────────────
  describe('density and RTL', () => {
    it('reflects the density prop as an attribute', async () => {
      const page = await create('<md-otp-field density="-2"></md-otp-field>');
      expect(page.root!.getAttribute('density')).toBe('-2');
    });

    it('the cell row is pinned LTR even inside an RTL ancestor', async () => {
      const page = await create('<div dir="rtl"><md-otp-field></md-otp-field></div>');
      const otp = page.body.querySelector('md-otp-field')!;
      const row = otp.shadowRoot!.querySelector('[part="cells"]');
      expect(row?.getAttribute('dir')).toBe('ltr');
    });
  });

  // ─── Custom CSS API ───────────────────────────────────────
  describe('custom CSS API', () => {
    it('accepts per-instance custom-property overrides', async () => {
      const page = await create(
        '<md-otp-field style="--md-otp-field-cell-width: 40px; --md-otp-field-focus-color: coral;"></md-otp-field>',
      );
      const style = page.root!.getAttribute('style');
      expect(style).toContain('--md-otp-field-cell-width: 40px');
      expect(style).toContain('--md-otp-field-focus-color: coral');
    });
  });

  // ─── Parts ────────────────────────────────────────────────
  describe('parts', () => {
    it('exposes cells, cell, separator and supporting-text parts', async () => {
      const page = await create(
        '<md-otp-field group-size="3" supporting-text="Hint"></md-otp-field>',
      );
      const sr = page.root!.shadowRoot!;
      expect(sr.querySelector('[part="cells"]')).not.toBeNull();
      expect(sr.querySelectorAll('[part="cell"]')).toHaveLength(6);
      expect(sr.querySelector('[part="separator"]')).not.toBeNull();
      expect(sr.querySelector('[part="supporting-text"]')).not.toBeNull();
    });
  });
});
