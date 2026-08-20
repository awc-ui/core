/**
 * Interaction e2e for md-text-field — every audit defect class gets a
 * real-browser guard: form participation (FormData, reset, Enter-submit,
 * fieldset-disabled), focused programmatic writes, IME composition,
 * keyboard-reachable action buttons, counter truth, type churn, readonly
 * guards, constraint validity, legend clamp geometry, focus delegation.
 */
import { newE2EPage } from '@stencil/core/testing';

describe('md-text-field e2e', () => {
  it('participates in forms: FormData, reset, Enter-submit, fieldset-disabled', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f">
        <fieldset id="fs">
          <md-text-field name="q" label="Query" value="initial"></md-text-field>
        </fieldset>
        <button type="submit">go</button>
      </form>
    `);
    await page.waitForChanges();
    // FormData sees the value under `name`
    let entries = await page.evaluate(() => Array.from(new FormData(document.getElementById('f') as HTMLFormElement).entries()));
    expect(entries).toEqual([['q', 'initial']]);

    // typing updates FormData
    await page.evaluate(() => (document.querySelector('md-text-field') as HTMLElement & { setFocus: () => Promise<void> }).setFocus());
    await page.keyboard.type(' plus');
    await page.waitForChanges();
    entries = await page.evaluate(() => Array.from(new FormData(document.getElementById('f') as HTMLFormElement).entries()));
    expect(entries).toEqual([['q', 'initial plus']]);

    // form.reset() restores the default
    await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).reset());
    await page.waitForChanges();
    const after = await page.evaluate(() => ({
      value: (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value,
      dom: document.querySelector('md-text-field')!.shadowRoot!.querySelector('input')!.value,
    }));
    expect(after.value).toBe('initial');
    expect(after.dom).toBe('initial');

    // Enter submits
    const submitted = await page.evaluate(async () => {
      let count = 0;
      document.getElementById('f')!.addEventListener('submit', (e) => { e.preventDefault(); count++; });
      (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
      return new Promise<number>((resolve) => {
        document.querySelector('md-text-field')!.shadowRoot!.querySelector('input')!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
        );
        setTimeout(() => resolve(count), 100);
      });
    });
    expect(submitted).toBe(1);

    // fieldset disabled propagates
    await page.evaluate(() => ((document.getElementById('fs') as HTMLFieldSetElement).disabled = true));
    await page.waitForChanges();
    const disabled = await page.evaluate(() =>
      (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).disabled,
    );
    expect(disabled).toBe(true);
  });

  it('required blocks native submission until filled (constraint validity surfaces)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f"><md-text-field name="r" label="Required" required></md-text-field></form>
    `);
    await page.waitForChanges();
    const state = await page.evaluate(async () => {
      const form = document.getElementById('f') as HTMLFormElement;
      const field = document.querySelector('md-text-field') as HTMLMdTextFieldElement;
      const invalidBefore = !form.checkValidity();
      field.value = 'filled';
      await new Promise((r) => setTimeout(r, 50));
      return { invalidBefore, validAfter: form.checkValidity(), fieldCheck: await field.checkValidity() };
    });
    expect(state.invalidBefore).toBe(true); // empty required field blocks the form
    expect(state.validAfter).toBe(true);
    expect(state.fieldCheck).toBe(true);
  });

  it('programmatic value write while FOCUSED reaches the visible input (autocomplete pick)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="City"></md-text-field>');
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.type('Ber');
    await page.waitForChanges();
    // consumer (e.g. md-autocomplete) sets the picked option while focus stays in the field
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => { el.value = 'Berlin'; });
    await page.waitForChanges();
    const dom = await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).value);
    expect(dom).toBe('Berlin'); // previously stayed "Ber" and reverted on next keystroke
    await page.keyboard.type('!');
    await page.waitForChanges();
    const value = await page.evaluate(() => (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value);
    expect(value).toBe('Berlin!');
  });

  it('IME composition survives restrict (composition not cancelled per keystroke)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Name" restrict="alphanumeric"></md-text-field>');
    await page.waitForChanges();
    const result = await page.evaluate(async () => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      // simulate an IME session: provisional text contains chars restrict would strip
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.value = 'に';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }));
      const midComposition = input.value; // must NOT be stripped mid-composition
      input.value = '日本';
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '日本' }));
      await new Promise((r) => setTimeout(r, 50));
      return { midComposition, final: (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value };
    });
    expect(result.midComposition).toBe('に'); // untouched while composing
    // on commit the pipeline runs once: alphanumeric restrict strips CJK — deterministic, not per-keystroke cancellation
    expect(result.final).toBe('');
  });

  it('clear and password-reveal are keyboard-operable; Escape clears', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Password" type="password" value="hunter2" clearable="internal" password-toggle="internal"></md-text-field>');
    await page.waitForChanges();
    // Tab reaches the buttons
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.press('Tab'); // -> clear
    await page.keyboard.press('Tab'); // -> password toggle
    await page.keyboard.press('Enter');
    await page.waitForChanges();
    const revealed = await page.evaluate(() =>
      (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).type,
    );
    expect(revealed).toBe('text'); // keyboard-revealed

    // Escape clears from the input itself
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.press('Escape');
    await page.waitForChanges();
    const value = await page.evaluate(() => (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value);
    expect(value).toBe('');
  });

  it('readonly blocks clear + speech mutations', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Locked" value="keep" readonly clearable="internal"></md-text-field>');
    await page.waitForChanges();
    await page.evaluate(() => {
      const sr = document.querySelector('md-text-field')!.shadowRoot!;
      (sr.querySelector('.md-text-field__clear') as HTMLButtonElement | null)?.click();
      (sr.querySelector('input') as HTMLInputElement).focus();
    });
    await page.keyboard.press('Escape');
    await page.waitForChanges();
    const value = await page.evaluate(() => (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value);
    expect(value).toBe('keep');
  });

  it('type churn through number restores the visible value', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Mixed" value="abc12"></md-text-field>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => { el.type = 'number'; });
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => { el.type = 'text'; });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const dom = await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).value);
    expect(dom).toBe('abc12'); // previously permanently blanked
  });

  it('outlined legend never overflows the host on long labels', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <md-text-field variant="outlined" style="width: 160px; display: block;"
        label="An exceptionally long label that used to blow out the fieldset" value="x"></md-text-field>
    `);
    await page.waitForChanges();
    const geom = await page.evaluate(() => {
      const host = document.querySelector('md-text-field')!;
      const fieldset = host.shadowRoot!.querySelector('.md-text-field__fieldset')!;
      return {
        host: Math.round(host.getBoundingClientRect().width),
        fieldset: Math.round(fieldset.getBoundingClientRect().width),
      };
    });
    expect(geom.fieldset).toBeLessThanOrEqual(geom.host + 2); // was host+238px
  });

  it('host.focus() reaches the inner input (delegatesFocus) and select() works', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Focus me" value="abcdef"></md-text-field>');
    await page.waitForChanges();
    const state = await page.evaluate(async () => {
      const host = document.querySelector('md-text-field') as HTMLMdTextFieldElement;
      host.focus();
      const focusedTag = host.shadowRoot!.activeElement?.tagName ?? 'none';
      await host.select();
      const input = host.shadowRoot!.querySelector('input') as HTMLInputElement;
      return { focusedTag, selection: input.value.substring(input.selectionStart ?? 0, input.selectionEnd ?? 0) };
    });
    expect(state.focusedTag).toBe('INPUT');
    expect(state.selection).toBe('abcdef');
  });

  it('format-on="input" without a parser falls back safely (no feedback-loop corruption)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Amount"></md-text-field>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatOn = 'input';
      el.formatter = (v: string) => Number(v.replace(/\D/g, '') || 0).toLocaleString('en-US');
    });
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.type('1234');
    await page.waitForChanges();
    const value = await page.evaluate(() => (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value);
    expect(value).toBe('1234'); // raw preserved (blur-format fallback); was "1,2334"-style corruption
  });

  it('mid-text keystroke preserves the caret (internalWrite guard)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Caret"></md-text-field>');
    await page.waitForChanges();
    const caret = await page.evaluate(async () => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      input.value = 'abcdef';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
      input.setSelectionRange(3, 3);
      document.execCommand('insertText', false, 'X'); // real mid-text keystroke path
      await new Promise((r) => setTimeout(r, 80));
      return { value: (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value, caret: input.selectionStart };
    });
    expect(caret.value).toBe('abcXdef');
    expect(caret.caret).toBe(4); // NOT thrown to the end
  });

  it('Escape inside an open <dialog> clears WITHOUT closing it (preventDefault)', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <dialog id="d"><md-text-field label="Q" value="text" clearable="internal"></md-text-field></dialog>
    `);
    await page.evaluate(() => (document.getElementById('d') as HTMLDialogElement).showModal());
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.press('Escape');
    await page.waitForChanges();
    const s1 = await page.evaluate(() => ({
      value: (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value,
      open: (document.getElementById('d') as HTMLDialogElement).open,
    }));
    expect(s1.value).toBe(''); // cleared
    expect(s1.open).toBe(true); // dialog survived the clearing press
  });

  it('cleared field still SUBMITS an empty entry (x= like native)', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-text-field name="x" value="has"></md-text-field><input name="nx" value="n"/></form>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => { el.value = ''; });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const entries = await page.evaluate(() => Array.from(new FormData(document.getElementById('f') as HTMLFormElement).entries()));
    expect(entries).toEqual([['x', ''], ['nx', 'n']]); // '' present, not absent
  });

  it('validity follows the SUBMITTED value, not the formatted display', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-text-field name="n" label="Num" pattern="[0-9]+"></md-text-field></form>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatter = (v: string) => Number(v || 0).toLocaleString('en-US');
      el.parser = (v: string) => v.replace(/[^0-9]/g, '');
    });
    await page.waitForChanges();
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).focus());
    await page.keyboard.type('1234');
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).blur());
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 80));
    const s1 = await page.evaluate(() => ({
      display: (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).value,
      formValid: (document.getElementById('f') as HTMLFormElement).checkValidity(),
    }));
    expect(s1.display).toBe('1,234'); // formatted display active
    expect(s1.formValid).toBe(true); // raw "1234" matches [0-9]+ — display commas must not block submit
  });

  it('type=number holding a value it cannot represent blocks submission (badInput)', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-text-field name="n" type="number" value="abc"></md-text-field></form>');
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const valid = await page.evaluate(() => (document.getElementById('f') as HTMLFormElement).checkValidity());
    expect(valid).toBe(false); // never silently submit "abc" for a number field
  });

  it('live-formatter max-length never splits surrogate pairs', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Emoji" max-length="3" format-on="input"></md-text-field>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatter = (v: string) => v;
      el.parser = (v: string) => v;
    });
    await page.waitForChanges();
    await page.evaluate(async () => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      input.value = 'ab😀';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 50));
    });
    const value = await page.evaluate(() => (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value);
    expect(value).toBe('ab'); // emoji dropped whole — never a lone surrogate (U+FFFD)
  });

  it('type churn while FOCUSED mid-typing keeps the USER value (no stale clobber)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="T" value="SAVED-DATA"></md-text-field>');
    await page.waitForChanges();
    await page.evaluate(() => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      input.select();
    });
    await page.keyboard.type('user-replacement');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => { el.type = 'search'; });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 60));
    await page.keyboard.type('!');
    await page.waitForChanges();
    const s1 = await page.evaluate(() => ({
      value: (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value,
      dom: (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).value,
    }));
    expect(s1.value).toBe('user-replacement!'); // was silently reverted to SAVED-DATA!
    expect(s1.dom).toBe('user-replacement!');
  });


  it('assigning formatter via JS reformats the RESTING display (element accessor bridge)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="N" value="1234"></md-text-field>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatter = (v: string) => `#${v}`;
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 50));
    const dom = await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).value);
    expect(dom).toBe('#1234'); // previously stayed raw until blur
  });

  it('live-formatter mid-string keystroke keeps the caret NEAR the edit point', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Card"></md-text-field>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatOn = 'input';
      el.formatter = (v: string) => (v.match(/.{1,4}/g) ?? []).join(' ');
      el.parser = (v: string) => v.replace(/\s/g, '');
    });
    await page.waitForChanges();
    const caret = await page.evaluate(async () => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      for (const ch of '41111111') {
        document.execCommand('insertText', false, ch);
        await new Promise((r) => setTimeout(r, 10));
      }
      // caret to position 6 ('4111 1|111'), type mid-string
      input.setSelectionRange(6, 6);
      document.execCommand('insertText', false, '9');
      await new Promise((r) => setTimeout(r, 80));
      const first = { value: input.value, caret: input.selectionStart };
      // sustained mid-string typing must NOT scramble (the global strip-diff
      // caret math interleaved "987" into garbage)
      document.execCommand('insertText', false, '8');
      document.execCommand('insertText', false, '7');
      await new Promise((r) => setTimeout(r, 80));
      return { ...first, sustained: input.value };
    });
    expect(caret.value).toBe('4111 1911 1'); // formatted with the 9 inserted mid-string
    expect(caret.caret).toBe(7); // exactly after the inserted 9 ('4111 19|11 1')
    expect(caret.sustained).toBe('4111 1987 111'); // 11 digits in order — no scramble
  });

  it('paste into restrict+max-length keeps ALL legal characters', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Phone" restrict="numeric" max-length="10"></md-text-field>');
    await page.waitForChanges();
    const value = await page.evaluate(async () => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      document.execCommand('insertText', false, '(555) 123-4567'); // paste-like insertion
      await new Promise((r) => setTimeout(r, 50));
      return (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value;
    });
    expect(value).toBe('5551234567'); // was "555123" — native truncation ran before restrict
  });

  it('checkValidity() answers for the SUBMITTED value via ElementInternals', async () => {
    const page = await newE2EPage();
    await page.setContent('<form><md-text-field name="n" label="Num" pattern="[0-9]+"></md-text-field></form>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatter = (v: string) => Number(v || 0).toLocaleString('en-US');
      el.parser = (v: string) => v.replace(/[^0-9]/g, '');
      el.value = '1234';
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 80));
    const ok = await page.evaluate(() => (document.querySelector('md-text-field') as HTMLMdTextFieldElement).checkValidity());
    expect(ok).toBe(true); // inner input shows "1,234" (patternMismatch) — internals knows the truth
  });

  it('--md-text-field-container-color keeps applying while FOCUSED', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="C" style="--md-text-field-container-color: rgb(1, 2, 3);"></md-text-field>');
    await page.waitForChanges();
    const bg = await page.evaluate(() => {
      const host = document.querySelector('md-text-field')!;
      (host.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
      return getComputedStyle(host.shadowRoot!.querySelector('.md-text-field__container')!).backgroundColor;
    });
    expect(bg).toBe('rgb(1, 2, 3)'); // focus previously swapped to the hardcoded tint
  });


  it('live-formatter caret: content-position 0 and decimal separators (round-5 cases)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="Amount"></md-text-field>');
    await page.waitForChanges();
    await page.$eval('md-text-field', (el: HTMLMdTextFieldElement) => {
      el.formatOn = 'input';
      // en-US grouping that PRESERVES a typed decimal point
      el.formatter = (v: string) => {
        const [i, d] = v.split('.');
        const grouped = (i || '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return d !== undefined ? `${grouped}.${d}` : grouped;
      };
      el.parser = (v: string) => v.replace(/,/g, '');
    });
    await page.waitForChanges();
    const r = await page.evaluate(async () => {
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      for (const ch of '1234.5') {
        document.execCommand('insertText', false, ch);
        await new Promise((res) => setTimeout(res, 10));
      }
      const decimal = { display: input.value, value: (document.querySelector('md-text-field') as HTMLMdTextFieldElement).value };
      // select the FIRST group and delete: caret must land at 0, not the end
      input.setSelectionRange(0, 2);
      document.execCommand('delete', false);
      await new Promise((res) => setTimeout(res, 50));
      const afterDelete = { display: input.value, caret: input.selectionStart };
      document.execCommand('insertText', false, '9');
      await new Promise((res) => setTimeout(res, 50));
      return { decimal, afterDelete, retype: input.value };
    });
    expect(r.decimal.display).toBe('1,234.5'); // decimals stay where typed
    expect(r.decimal.value).toBe('1234.5');
    expect(r.afterDelete.caret).toBe(0); // NOT teleported to the end
    expect(r.retype[0]).toBe('9'); // retyping the first group starts at the front
  });


  it('setCustomValidity blocks and releases the form; getValidity reads back', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-text-field name="u" label="User" value="ok"></md-text-field></form>');
    await page.waitForChanges();
    const r = await page.evaluate(async () => {
      const el = document.querySelector('md-text-field') as HTMLMdTextFieldElement;
      const form = document.getElementById('f') as HTMLFormElement;
      await el.setCustomValidity('Taken — choose another');
      const blocked = !form.checkValidity();
      const read = await el.getValidity();
      await el.setCustomValidity('');
      await new Promise((res) => setTimeout(res, 50));
      return { blocked, msg: read.validationMessage, custom: read.flags.customError, releasedValid: form.checkValidity() };
    });
    expect(r.blocked).toBe(true);
    expect(r.custom).toBe(true);
    expect(r.msg).toBe('Taken — choose another');
    expect(r.releasedValid).toBe(true);
  });

  it('Enter submission includes the default submitter name/value', async () => {
    const page = await newE2EPage();
    await page.setContent(`
      <form id="f"><md-text-field name="q" label="Q" value="v"></md-text-field>
        <button type="submit" name="action" value="save">Save</button></form>
    `);
    await page.waitForChanges();
    const entries = await page.evaluate(async () => {
      const form = document.getElementById('f') as HTMLFormElement;
      let captured: Array<[string, string]> = [];
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        captured = Array.from(new FormData(form, (e as SubmitEvent).submitter).entries()) as Array<[string, string]>;
      });
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((res) => setTimeout(res, 100));
      return captured;
    });
    expect(entries).toEqual([['q', 'v'], ['action', 'save']]);
  });

  it('forced-colors: filled resting/focused container = Field; hover keeps FieldText label (CDP)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field variant="filled" label="HCM" value="x" style="width: 260px;"></md-text-field>');
    await page.waitForChanges();
    // puppeteer 21's emulateMediaFeatures rejects 'forced-colors' — raw CDP
    const cdp = await (page as unknown as { createCDPSession: () => Promise<{ send: (m: string, p: unknown) => Promise<unknown> }> }).createCDPSession();
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [
        { name: 'forced-colors', value: 'active' },
        { name: 'prefers-color-scheme', value: 'dark' },
      ],
    });
    await page.waitForChanges();
    await new Promise((r) => setTimeout(r, 300));
    const colors = await page.evaluate(() => {
      const host = document.querySelector('md-text-field')!;
      const container = host.shadowRoot!.querySelector('.md-text-field__container')!;
      const label = host.shadowRoot!.querySelector('.md-text-field__label')!;
      const resting = getComputedStyle(container).backgroundColor;
      (host.shadowRoot!.querySelector('input') as HTMLInputElement).focus();
      const focused = getComputedStyle(container).backgroundColor;
      return { resting, focused, label: getComputedStyle(label).color };
    });
    // Field maps to black in dark HCM emulation; labels to FieldText (white)
    expect(colors.resting).toBe('rgb(0, 0, 0)');
    expect(colors.focused).toBe('rgb(0, 0, 0)');
    expect(colors.label).toBe('rgb(255, 255, 255)');

    // HOVER must not leak author colors either (blur first, then real hover)
    await page.evaluate(() => (document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement).blur());
    const box = await page.evaluate(() => {
      const r = document.querySelector('md-text-field')!.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    await page.mouse.move(box.x, box.y);
    await new Promise((r) => setTimeout(r, 200));
    const hover = await page.evaluate(() => {
      const sr = document.querySelector('md-text-field')!.shadowRoot!;
      return {
        label: getComputedStyle(sr.querySelector('.md-text-field__label')!).color,
        indicator: getComputedStyle(sr.querySelector('.md-text-field__indicator')!).backgroundColor,
      };
    });
    expect(hover.label).toBe('rgb(255, 255, 255)'); // FieldText
    expect(hover.indicator).toBe('rgb(255, 255, 255)'); // FieldText — was author on-surface
  });

  it('condensed density holds WITH a clear button (buttons must not inflate the container)', async () => {
    const page = await newE2EPage();
    await page.setContent('<md-text-field label="D" density="-2" clearable="internal" value="x"></md-text-field>');
    await page.waitForChanges();
    const h = await page.evaluate(() =>
      Math.round(document.querySelector('md-text-field')!.shadowRoot!.querySelector('.md-text-field__container')!.getBoundingClientRect().height),
    );
    expect(h).toBe(48); // was silently 56 with any action button visible
  });


  it('host re-dispatches a bubbling change event (form delegation parity)', async () => {
    const page = await newE2EPage();
    await page.setContent('<form id="f"><md-text-field name="q" label="Q"></md-text-field></form>');
    await page.waitForChanges();
    const count = await page.evaluate(async () => {
      let n = 0;
      document.getElementById('f')!.addEventListener('change', () => n++);
      const input = document.querySelector('md-text-field')!.shadowRoot!.querySelector('input') as HTMLInputElement;
      input.focus();
      document.execCommand('insertText', false, 'x');
      input.blur(); // real change fires on commit
      await new Promise((r) => setTimeout(r, 100));
      return n;
    });
    expect(count).toBe(1); // the form heard it (native change is non-composed)
  });

});
