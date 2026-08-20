/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for md-meter. The meter is
 * read-only and non-focusable, so what matters for assistive tech is the
 * host-level `role="meter"` value contract: min/max/now clamped into a valid
 * range, a human-readable `aria-valuetext`, and an accessible name — with the
 * visible header text hidden from the tree so nothing is announced twice.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdMeter } from './md-meter';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const wrap = (inner: string) => `<body><h1>Storage</h1><main>${inner}</main></body>`;

describe('md-meter · axe', () => {
  it('default labelled meter has no violations', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="Storage used" value="24"></md-meter>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('meter with visible label and value header has no violations', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="Storage used" value="65" show-label show-value></md-meter>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('custom range + value-text override has no violations', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="Seats taken" min="0" max="10" value="3" value-text="3 of 10 seats" show-label show-value></md-meter>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('semantic status colour has no violations', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="Quota" value="96" color="error" show-label show-value></md-meter>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});

describe('md-meter · ARIA contract', () => {
  it('host exposes the full meter value contract', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="Storage used" min="0" max="512" value="256"></md-meter>`,
    });
    const host = page.root!;
    expect(host.getAttribute('role')).toBe('meter');
    expect(host.getAttribute('aria-label')).toBe('Storage used');
    expect(host.getAttribute('aria-valuemin')).toBe('0');
    expect(host.getAttribute('aria-valuemax')).toBe('512');
    expect(host.getAttribute('aria-valuenow')).toBe('256');
    expect(host.getAttribute('aria-valuetext')).toBe(
      new Intl.NumberFormat(undefined, { style: 'percent' }).format(0.5),
    );
  });

  it('aria-valuenow never leaves [min, max]', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="x" min="10" max="20" value="99"></md-meter>`,
    });
    expect(page.root?.getAttribute('aria-valuenow')).toBe('20');
  });

  it('the visible value duplicate is aria-hidden', async () => {
    const page = await newSpecPage({
      components: [MdMeter],
      html: `<md-meter label="Quota" value="40" show-value></md-meter>`,
    });
    const header = page.root?.shadowRoot?.querySelector('.md-meter__header');
    expect(header?.getAttribute('aria-hidden')).toBe('true');
  });
});
