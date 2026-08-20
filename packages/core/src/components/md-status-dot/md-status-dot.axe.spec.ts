/**
 * Axe (WCAG 2.1 A/AA) sweep + ARIA-contract checks for md-status-dot.
 *
 * The dot's whole accessibility story is its role mapping — decorative by
 * default, a labelled `role="img"` when static, and a `role="status"` live
 * region when `live`. A wrong role here either hides status from AT or spams
 * spurious live announcements, so these guard the contract directly.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdStatusDot } from './md-status-dot';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

const COMPONENTS = [MdStatusDot];
const wrap = (inner: string) => `<body><h1>Page</h1><main>${inner}</main></body>`;

describe('md-status-dot · axe', () => {
  it('decorative (no label), paired with a labelled avatar surrogate — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<span role="img" aria-label="Ada Lovelace, online" style="position:relative;display:inline-block;width:40px;height:40px;background:#ccc;border-radius:50%;">
               <md-status-dot state="online"></md-status-dot>
             </span>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('standalone labelled (role="img") — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-status-dot state="busy" label="Do not disturb"></md-status-dot>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('live labelled (role="status") — no violations', async () => {
    const page = await newSpecPage({
      components: COMPONENTS,
      html: `<md-status-dot state="online" live label="Live now"></md-status-dot>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('every state, labelled — no violations', async () => {
    const states = ['online', 'away', 'busy', 'offline', 'invisible', 'neutral'];
    const page = await newSpecPage({
      components: COMPONENTS,
      html: states.map((s) => `<md-status-dot state="${s}" label="${s}"></md-status-dot>`).join(''),
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});

describe('md-status-dot · ARIA contract', () => {
  const role = async (html: string) => {
    const page = await newSpecPage({ components: COMPONENTS, html });
    return page.root!;
  };

  it('decorative by default: presentation + aria-hidden, no name', async () => {
    const r = await role(`<md-status-dot state="online"></md-status-dot>`);
    expect(r.getAttribute('role')).toBe('presentation');
    expect(r.getAttribute('aria-hidden')).toBe('true');
    expect(r.getAttribute('aria-label')).toBeNull();
  });

  it('static label → role="img" + aria-label, not hidden', async () => {
    const r = await role(`<md-status-dot state="online" label="Online"></md-status-dot>`);
    expect(r.getAttribute('role')).toBe('img');
    expect(r.getAttribute('aria-label')).toBe('Online');
    expect(r.hasAttribute('aria-hidden')).toBe(false);
  });

  it('live label → role="status" (live region) + aria-label', async () => {
    const r = await role(`<md-status-dot state="busy" live label="On a call"></md-status-dot>`);
    expect(r.getAttribute('role')).toBe('status');
    expect(r.getAttribute('aria-label')).toBe('On a call');
  });

  it('live without a label stays decorative (no spurious live region)', async () => {
    const r = await role(`<md-status-dot state="online" live></md-status-dot>`);
    expect(r.getAttribute('role')).toBe('presentation');
    expect(r.getAttribute('aria-hidden')).toBe('true');
  });

  it('whitespace-only label is treated as empty (decorative)', async () => {
    const r = await role(`<md-status-dot label="   "></md-status-dot>`);
    expect(r.getAttribute('role')).toBe('presentation');
    expect(r.getAttribute('aria-hidden')).toBe('true');
  });
});
