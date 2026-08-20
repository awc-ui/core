/**
 * Axe (WCAG 2.1 A/AA) + ARIA-contract checks for md-text-field on the
 * shared JSDOM bridge. Layout-dependent rules live in e2e.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdTextField } from './md-text-field';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const create = (html: string) => newSpecPage({ components: [MdTextField], html });

describe('md-text-field axe contract', () => {
  it('labeled field with supporting text has no violations', async () => {
    const page = await create('<md-text-field label="Email" supporting-text="We never share it."></md-text-field>');
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('error state has no violations', async () => {
    const page = await create('<md-text-field label="Email" error error-text="Enter a valid address." value="x"></md-text-field>');
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('field with clear + password toggle has no violations', async () => {
    const page = await create('<md-text-field label="Password" type="password" value="hunter2" clearable="internal" password-toggle="internal"></md-text-field>');
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('supporting text and counter are wired via aria-describedby', async () => {
    const page = await create('<md-text-field label="Bio" supporting-text="Tell us more" max-length="100" value="hi"></md-text-field>');
    const sr = page.root!.shadowRoot!;
    const input = sr.querySelector('input')!;
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids.length).toBe(2);
    const support = sr.querySelector('.md-text-field__support-text')!;
    const counter = sr.querySelector('.md-text-field__counter')!;
    expect(ids).toContain(support.id);
    expect(ids).toContain(counter.id);
  });

  it('error text becomes an alert (announced) and aria-invalid flips', async () => {
    const page = await create('<md-text-field label="Email" supporting-text="ok" value="x"></md-text-field>');
    let sr = page.root!.shadowRoot!;
    expect(sr.querySelector('.md-text-field__support-text')!.getAttribute('role')).toBeNull();
    expect(sr.querySelector('input')!.getAttribute('aria-invalid')).toBeNull(); // omitted when valid
    (page.root as HTMLMdTextFieldElement).error = true;
    (page.root as HTMLMdTextFieldElement).errorText = 'Invalid address';
    await page.waitForChanges();
    sr = page.root!.shadowRoot!;
    expect(sr.querySelector('.md-text-field__support-text')!.getAttribute('role')).toBe('alert');
    expect(sr.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('action buttons are keyboard-reachable (no tabindex=-1) and named', async () => {
    const page = await create('<md-text-field label="Password" type="password" value="x" clearable="internal" password-toggle="internal" speech-to-text="external"></md-text-field>');
    const sr = page.root!.shadowRoot!;
    const buttons = Array.from(sr.querySelectorAll('button'));
    expect(buttons.length).toBe(3);
    buttons.forEach((b) => {
      expect(b.getAttribute('tabindex')).toBeNull(); // natively focusable
      expect((b.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
    });
  });

  it('behavior attributes forward to the inner input', async () => {
    const page = await create('<md-text-field label="Card" autocomplete="cc-number" inputmode="numeric" enterkeyhint="next" autocapitalize="off" pattern="[0-9]*"></md-text-field>');
    const input = page.root!.shadowRoot!.querySelector('input')!;
    expect(input.getAttribute('autocomplete')).toBe('cc-number');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('enterkeyhint')).toBe('next');
    expect(input.getAttribute('autocapitalize')).toBe('off');
    expect(input.getAttribute('pattern')).toBe('[0-9]*');
  });

  it('value is NOT reflected to the host attribute (password DOM leak)', async () => {
    const page = await create('<md-text-field label="Password" type="password"></md-text-field>');
    (page.root as HTMLMdTextFieldElement).value = 'hunter2';
    await page.waitForChanges();
    expect(page.root!.getAttribute('value')).toBeNull();
  });

  it('mirrors ONLY aria-haspopup="dialog" onto the input — menu/listbox composites stay host-side', async () => {
    // dialog openers (md-time-picker trigger) get the mirror…
    const dialog = await create('<md-text-field label="Time" aria-haspopup="dialog" aria-expanded="false" aria-controls="pop"></md-text-field>');
    const dialogInput = dialog.root!.shadowRoot!.querySelector('input')!;
    expect(dialogInput.getAttribute('aria-haspopup')).toBe('dialog');
    // …but never aria-expanded (invalid on textbox) or aria-controls
    // (cross-shadow IDREF can't resolve — would be permanently dangling)
    expect(dialogInput.getAttribute('aria-expanded')).toBeNull();
    expect(dialogInput.getAttribute('aria-controls')).toBeNull();
    // menu composites (md-select/md-autocomplete) keep host-side semantics
    const menu = await create('<md-text-field label="Choose" aria-haspopup="menu"></md-text-field>');
    const menuInput = menu.root!.shadowRoot!.querySelector('input')!;
    expect(menuInput.getAttribute('aria-haspopup')).toBeNull();
  });
});
