/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-date-picker`.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdDatePicker } from './md-date-picker';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { MdButton } from '../md-button/md-button';
import { MdTooltip } from '../md-tooltip/md-tooltip';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [
  MdDatePicker,
  MdTextField,
  MdIconButton,
  MdButton,
  MdRipple,
  MdMenu,
  MdMenuItem,
  MdTooltip,
];

describe('md-date-picker · axe', () => {
  function wrap(inner: string): string {
    return `<body><h1>Schedule</h1>${inner}</body>`;
  }

  it('closed modal-input field has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: '<md-date-picker label="Date"></md-date-picker>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('modal open with calendar has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: '<md-date-picker value="2025-06-15" open></md-date-picker>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('docked open has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('disabled field has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: '<md-date-picker disabled value="2025-06-15"></md-date-picker>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('typed-entry mode has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: '<md-date-picker value="2025-06-15" open></md-date-picker>',
    });
    const toggle = page.root?.shadowRoot?.querySelector(
      '[part="mode-toggle"]',
    ) as HTMLButtonElement;
    toggle.click();
    await page.waitForChanges();
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('dir="rtl" docked open has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: '<md-date-picker variant="docked" value="2025-06-15" open></md-date-picker>',
    });
    expect(
      await runAxe(page, {
        wrap: (inner) => `<body dir="rtl"><h1>Schedule</h1>${inner}</body>`,
      }),
    ).toHaveNoViolations();
  });
});
