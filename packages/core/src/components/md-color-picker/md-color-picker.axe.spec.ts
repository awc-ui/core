/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-color-picker`.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdColorPicker } from './md-color-picker';
import { MdButton } from '../md-button/md-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

/**
 * The axe bridge hydrates declarative shadow DOM into real shadow roots, so
 * `label` (for/id association) and `aria-prohibited-attr` (role vs aria-label)
 * are evaluated correctly and MUST stay enabled — they guard the channel-input
 * labels and the preview swatch's naming role. No per-component overrides needed.
 */
const PICKER_AXE_RULES = {};

describe('md-color-picker · axe', () => {
  function wrap(inner: string): string {
    return `<body><h1>Colour</h1>${inner}</body>`;
  }

  it('inline default has no violations', async () => {
    const page = await newSpecPage({
      components: [MdColorPicker],
      html: '<md-color-picker value="#6750A4"></md-color-picker>',
    });
    expect(await runAxe(page, { wrap, rules: PICKER_AXE_RULES })).toHaveNoViolations();
  });

  it('inline with alpha and presets has no violations', async () => {
    const page = await newSpecPage({
      components: [MdColorPicker],
      html: '<md-color-picker alpha presets="#000000,#FFFFFF,#FF5722"></md-color-picker>',
    });
    expect(await runAxe(page, { wrap, rules: PICKER_AXE_RULES })).toHaveNoViolations();
  });

  it('inline hsl format has no violations', async () => {
    const page = await newSpecPage({
      components: [MdColorPicker],
      html: '<md-color-picker format="hsl" value="hsl(259, 35%, 48%)"></md-color-picker>',
    });
    expect(await runAxe(page, { wrap, rules: PICKER_AXE_RULES })).toHaveNoViolations();
  });

  it('popover open has no violations', async () => {
    const page = await newSpecPage({
      components: [MdColorPicker, MdButton, MdRipple],
      html: '<md-color-picker variant="popover" open value="#6750A4"></md-color-picker>',
    });
    expect(await runAxe(page, { wrap, rules: PICKER_AXE_RULES })).toHaveNoViolations();
  });

  it('disabled inline has no violations', async () => {
    const page = await newSpecPage({
      components: [MdColorPicker],
      html: '<md-color-picker disabled alpha value="#6750A4"></md-color-picker>',
    });
    expect(await runAxe(page, { wrap, rules: PICKER_AXE_RULES })).toHaveNoViolations();
  });

  it('dir="rtl" wrapper has no violations', async () => {
    const page = await newSpecPage({
      components: [MdColorPicker],
      html: '<md-color-picker alpha value="#6750A4"></md-color-picker>',
    });
    expect(
      await runAxe(page, {
        wrap: (inner) => `<body dir="rtl"><h1>Colour</h1>${inner}</body>`,
        rules: PICKER_AXE_RULES,
      }),
    ).toHaveNoViolations();
  });
});
