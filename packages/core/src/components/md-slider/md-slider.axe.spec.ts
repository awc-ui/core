/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for md-slider. The slider is
 * an interactive control built on native `<input type="range">` thumbs, so its
 * value/orientation/label semantics are what matter for assistive tech.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSlider } from './md-slider';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const wrap = (inner: string) => `<body><h1>Settings</h1><main>${inner}</main></body>`;
const thumbs = (root: HTMLElement) =>
  Array.from(root.shadowRoot!.querySelectorAll('input[type="range"]')) as HTMLInputElement[];

describe('md-slider · axe', () => {
  it('single horizontal has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider aria-label="Volume" value="40"></md-slider>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('range has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider range label-start="Min price" label-end="Max price" value-start="20" value-end="80"></md-slider>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('vertical + stops + value-indicator has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider orientation="vertical" full-height stops step="10" value-indicator aria-label="Brightness" value="60"></md-slider>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('disabled has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider disabled aria-label="Locked" value="30"></md-slider>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});

describe('md-slider · ARIA contract', () => {
  it('single thumb exposes range value semantics', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider aria-label="Volume" min="0" max="50" value="20" value-text="20 percent"></md-slider>`,
    });
    const [t] = thumbs(page.root!);
    expect(t.getAttribute('type')).toBe('range');
    expect(t.getAttribute('aria-label')).toBe('Volume');
    expect(t.getAttribute('aria-valuemin')).toBe('0');
    expect(t.getAttribute('aria-valuemax')).toBe('50');
    expect(t.getAttribute('aria-valuenow')).toBe('20');
    expect(t.getAttribute('aria-valuetext')).toBe('20 percent');
    expect(t.getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('range exposes two labelled thumbs with their own values', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider range label-start="From" label-end="To" value-start="20" value-end="80"></md-slider>`,
    });
    const ts = thumbs(page.root!);
    expect(ts).toHaveLength(2);
    expect(ts.map((t) => t.getAttribute('aria-label'))).toEqual(['From', 'To']);
    expect(ts.map((t) => t.getAttribute('aria-valuenow'))).toEqual(['20', '80']);
  });

  it('vertical reports a vertical orientation', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider orientation="vertical" aria-label="Zoom" value="50"></md-slider>`,
    });
    expect(thumbs(page.root!)[0].getAttribute('aria-orientation')).toBe('vertical');
  });

  it('disabled marks the thumb disabled', async () => {
    const page = await newSpecPage({
      components: [MdSlider],
      html: `<md-slider disabled aria-label="x" value="30"></md-slider>`,
    });
    expect(thumbs(page.root!)[0].hasAttribute('disabled')).toBe(true);
  });
});
