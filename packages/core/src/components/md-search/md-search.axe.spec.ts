/**
 * Axe (WCAG 2.1 AA + best-practice) sweep for `md-search`.
 *
 * Renders the component in common configurations, hydrates Declarative
 * Shadow DOM into JSDOM, and runs axe-core inside that realm.
 */
import { newSpecPage } from '@stencil/core/testing';
import { MdSearch } from './md-search';
import { MdIconButton } from '../md-icon-button/md-icon-button';
import { runAxe, toHaveNoViolations } from '../md-accordion/test-utils/axe-spec';

expect.extend(toHaveNoViolations);

describe('md-search · axe', () => {
  function wrap(inner: string): string {
    return `<body><h1>Search</h1>${inner}</body>`;
  }

  it('default (closed, contained full-screen) has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: '<md-search placeholder="Search"></md-search>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('contained docked closed has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: '<md-search variant="contained" layout="docked"></md-search>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('divided docked closed has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: '<md-search variant="divided" layout="docked"></md-search>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('full-screen open with value has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: '<md-search open layout="full-screen" value="cats"></md-search>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('docked open with slotted results has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: `<md-search open layout="docked" value="a">
        <ul slot="results"><li>One</li><li>Two</li></ul>
      </md-search>`,
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('disabled with value has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: '<md-search disabled value="x"></md-search>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });

  it('open + loading has no violations', async () => {
    const page = await newSpecPage({
      components: [MdSearch, MdIconButton],
      html: '<md-search open loading value="q"></md-search>',
    });
    expect(await runAxe(page, { wrap })).toHaveNoViolations();
  });
});
