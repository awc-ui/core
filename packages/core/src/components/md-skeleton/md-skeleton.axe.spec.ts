/**
 * Axe (WCAG 2.1 A/AA) sweep for md-skeleton. The component's whole job is a
 * loading affordance, so its busy-state semantics + decorative opt-out matter.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSkeleton } from './md-skeleton';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const wrap = (inner: string) => `<body><h1>Loading</h1><main>${inner}</main></body>`;

describe('md-skeleton · axe', () => {
  it('text skeleton (announced busy region) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton lines="3" aria-label="Loading article"></md-skeleton>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('shape variants have no violations', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `
        <md-skeleton variant="rectangular"></md-skeleton>
        <md-skeleton variant="rounded"></md-skeleton>
        <md-skeleton variant="circular"></md-skeleton>
      `,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('decorative skeleton (announce=false, aria-hidden) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton announce="false" variant="rounded"></md-skeleton>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('full-width / full-height variants have no violations', async () => {
    const page = await newSpecPage({
      components: [MdSkeleton],
      html: `<md-skeleton variant="rounded" full-width full-height></md-skeleton>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});
