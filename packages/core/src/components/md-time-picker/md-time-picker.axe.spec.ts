/**
 * Axe (WCAG 2.1 A/AA) + ARIA-contract checks for md-time-picker on the
 * shared JSDOM bridge. Layout-dependent rules (focus trap, contrast,
 * dial geometry) live in e2e.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdTimePicker } from './md-time-picker';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdButton } from '../md-button/md-button';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const create = (html: string) =>
  newSpecPage({ components: [MdTimePicker, MdTextField, MdButton, MdIconButton], html });

describe('md-time-picker axe contract', () => {
  it('closed trigger has no violations', async () => {
    const page = await create('<md-time-picker label="Meeting time" value="14:30"></md-time-picker>');
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('open input-variant dialog has no violations', async () => {
    const page = await create('<md-time-picker variant="input" value="14:30" open></md-time-picker>');
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('open dial-variant dialog has no violations', async () => {
    const page = await create('<md-time-picker variant="dial" value="14:30" open></md-time-picker>');
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('open 24h dial dialog with an error state has no violations', async () => {
    const page = await create('<md-time-picker variant="dial" format="24h" value="14:30" open></md-time-picker>');
    const hour = page.root!.shadowRoot!.querySelector('[part="input-hour"]') as HTMLInputElement;
    hour.value = '99';
    hour.dispatchEvent(new Event('input', { bubbles: true }));
    await page.waitForChanges();
    expect(await runAxe(page)).toHaveNoViolations();
  });

  it('dialog is a labelled modal (role=dialog + aria-modal + aria-labelledby)', async () => {
    const page = await create('<md-time-picker open></md-time-picker>');
    const dialog = page.root!.shadowRoot!.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelledBy = dialog.getAttribute('aria-labelledby')!;
    const headline = page.root!.shadowRoot!.getElementById(labelledBy)!;
    expect(headline.textContent!.length).toBeGreaterThan(0);
  });

  it('trigger popup semantics reach the inner input (aria-haspopup mirror)', async () => {
    const page = await create('<md-time-picker label="Meeting time"></md-time-picker>');
    const field = page.root!.shadowRoot!.querySelector('md-text-field[part="trigger"]')!;
    const input = field.shadowRoot!.querySelector('input')!;
    // The host attributes alone are invisible to AT (focus lands on the
    // inner input) — md-text-field mirrors the *global* popup attribute
    // onto the input. aria-expanded stays host-only: a textbox may not
    // carry it (axe aria-allowed-attr), and no allowed role fits a
    // readonly opener input without an unresolvable cross-shadow
    // aria-controls reference.
    expect(input.getAttribute('aria-haspopup')).toBe('dialog');
    expect(input.getAttribute('aria-expanded')).toBeNull();
    // host keeps the state channel for programmatic consumers
    expect(field.getAttribute('aria-expanded')).toBe('false');
    (page.root as any).open = true;
    await page.waitForChanges();
    expect(field.getAttribute('aria-expanded')).toBe('true');
  });

  it('AM/PM group keeps the radiogroup contract with localized names', async () => {
    const page = await create(
      '<md-time-picker period-label="Période" am-label="vorm." pm-label="nachm." value="14:30" open></md-time-picker>',
    );
    const sr = page.root!.shadowRoot!;
    const group = sr.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-label')).toBe('Période');
    const radios = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(radios.length).toBe(2);
    // roving tabindex: exactly the checked radio is tabbable
    const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked.length).toBe(1);
    expect(checked[0].getAttribute('tabindex')).toBe('0');
    const unchecked = radios.find((r) => r.getAttribute('aria-checked') === 'false')!;
    expect(unchecked.getAttribute('tabindex')).toBe('-1');
  });

  it('mode-toggle and actions are named and keyboard-reachable', async () => {
    const page = await create('<md-time-picker open toggle-dial-label="Cadran" ok-label="Valider"></md-time-picker>');
    const sr = page.root!.shadowRoot!;
    const toggle = sr.querySelector('[part="toggle-mode"]')!;
    expect((toggle.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
    const ok = sr.querySelector('[part="confirm-button"]')!;
    expect(ok.textContent).toContain('Valider');
  });
});
