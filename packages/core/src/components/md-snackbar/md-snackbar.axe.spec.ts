/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for md-snackbar. As a live
 * region with an optional action + close, its role / politeness / labels are
 * what assistive tech relies on.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSnackbar } from './md-snackbar';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { MdRipple } from '../md-ripple/md-ripple';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [MdSnackbar, MdIconButton, MdRipple];
const wrap = (inner: string) => `<body><h1>Page</h1><main>${inner}</main></body>`;

describe('md-snackbar · axe', () => {
  it('message only has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-snackbar open message="Saved"></md-snackbar>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('with action + closeable has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-snackbar open message="Item archived" action="Undo" closeable></md-snackbar>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('assertive (error) + top-end position has no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-snackbar open message="Upload failed" politeness="assertive" position="top-end" closeable></md-snackbar>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});

describe('md-snackbar · ARIA contract', () => {
  it('polite (default) is a status live region', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-snackbar open message="Saved"></md-snackbar>`,
    });
    const host = page.root!;
    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(host.getAttribute('aria-atomic')).toBe('true');
  });

  it('assertive switches to an alert live region', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-snackbar open message="Failed" politeness="assertive"></md-snackbar>`,
    });
    const host = page.root!;
    expect(host.getAttribute('role')).toBe('alert');
    expect(host.getAttribute('aria-live')).toBe('assertive');
  });

  it('close button has an accessible label', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-snackbar open message="x" closeable></md-snackbar>`,
    });
    const close = page.root!.shadowRoot!.querySelector('md-icon-button');
    expect(close?.getAttribute('aria-label')).toBe('Dismiss');
  });
});
