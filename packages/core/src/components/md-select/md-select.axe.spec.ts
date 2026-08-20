/**
 * Axe (WCAG 2.1 A/AA + best-practice) sweep for the non-virtualized `md-select`.
 *
 * Renders the declarative select in its common configurations, hydrates the
 * Declarative Shadow DOM into JSDOM, and runs axe-core inside that realm. The
 * WASM-virtualized combobox/listbox path needs a real browser, so its ARIA +
 * axe coverage lives in `virtualized-a11y.e2e.ts`.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSelect } from './md-select';
import { MdSelectOption } from '../md-select-option/md-select-option';
import { MdMenu } from '../md-menu/md-menu';
import { MdMenuItem } from '../md-menu-item/md-menu-item';
import { MdTextField } from '../md-text-field/md-text-field';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [
  MdSelect,
  MdSelectOption,
  MdMenu,
  MdMenuItem,
  MdTextField,
  MdIconButton,
  MdRipple,
];

const OPTIONS = `
  <md-select-option value="red">Red</md-select-option>
  <md-select-option value="green">Green</md-select-option>
  <md-select-option value="blue">Blue</md-select-option>
`;

// A heading gives axe a document outline so heading-order/region heuristics have
// context (matches the other axe specs in the repo).
const wrap = (inner: string) => `<body><h1>Form</h1>${inner}</body>`;

describe('md-select · axe', () => {
  it('closed, no selection has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour">${OPTIONS}</md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('closed with a selected value has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" value="green">${OPTIONS}</md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('open with options exposed has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" open>${OPTIONS}</md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('disabled has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" disabled value="red">${OPTIONS}</md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('required + error + supporting text has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select
        label="Colour"
        required
        error
        error-text="Please choose a colour"
        supporting-text="Pick one"
      >${OPTIONS}</md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('clearable with a value (clear button) has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" clearable value="blue">${OPTIONS}</md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('options with leading icons + supporting text have no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Account" open>
        <md-select-option value="a" supporting-text="ID 1">
          <span slot="leading-icon" aria-hidden="true">person</span>
          Alice
        </md-select-option>
        <md-select-option value="b" supporting-text="ID 2">
          <span slot="leading-icon" aria-hidden="true">star</span>
          Bob
        </md-select-option>
      </md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('a disabled option has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="Colour" open>
        <md-select-option value="red">Red</md-select-option>
        <md-select-option value="green" disabled>Green</md-select-option>
      </md-select>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('inside an RTL container has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-select label="اللون" open>${OPTIONS}</md-select>`,
    });
    expect(
      await runAxe(page, { wrap: (inner) => `<body dir="rtl"><h1>نموذج</h1>${inner}</body>` }),
    ).toHaveNoViolations();
  });
});
