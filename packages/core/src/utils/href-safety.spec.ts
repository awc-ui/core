import { newSpecPage } from '@stencil/core/testing';
import { MdButton } from '../components/md-button/md-button';
import { MdIconButton } from '../components/md-icon-button/md-icon-button';
import { MdNavigationTab } from '../components/md-navigation-tab/md-navigation-tab';
import { MdListItem } from '../components/md-list-item/md-list-item';
import { MdNavigationRailTab } from '../components/md-navigation-rail-tab/md-navigation-rail-tab';
import { MdBreadcrumbItem } from '../components/md-breadcrumb-item/md-breadcrumb-item';

/**
 * Cross-component contract for the `href` prop.
 *
 * `sanitizeHref` is unit-tested in `url.spec.ts`; this file proves each
 * component that accepts an `href` is actually wired to it. The two are
 * separate failures: a correct sanitizer that a component forgets to call
 * still ships the vulnerability.
 *
 * The `window.open` spy goes on `page.win`, not the test file's `window`.
 * Each spec page runs against its own mock window, so a spy installed on the
 * outer global is never consulted — and every "did not navigate" assertion
 * would pass without proving anything.
 */

const HOSTILE = 'javascript:alert(document.domain)';
const SAFE = 'https://example.com/docs';

/** Render `tag` with `attrs` and spy on the navigation its own window would do. */
async function renderWithOpenSpy(tag: string, component: unknown, attrs: string) {
  const page = await newSpecPage({
    components: [component as never],
    html: `<${tag} ${attrs}>Go</${tag}>`,
  });
  const openSpy = jest
    .spyOn(page.win as unknown as Window, 'open')
    .mockImplementation(() => null);
  return { page, openSpy };
}

/* Components that still navigate imperatively. md-button left this group when
   it started rendering a real <a> — see the anchor contract below. The other
   two have the same defect and should follow; until they do, their security
   contract is still the window.open one. */
const NAVIGATING_COMPONENTS: Array<[string, unknown]> = [
  ['md-icon-button', MdIconButton],
  ['md-navigation-tab', MdNavigationTab],
];

describe('href safety contract', () => {
  /* md-button renders a REAL <a> rather than calling window.open, so its half
     of this contract is asserted on the rendered anchor. The security
     properties are identical and must both hold: an unsafe URL produces no
     link at all, and a link opening a new browsing context severs the opener.
     Asserting on markup rather than a spy is also stronger here — it is what
     the browser actually acts on for middle-click and cmd-click, which never
     reach a JS handler. */
  describe('md-button renders a real anchor', () => {
    async function renderButton(attrs: string) {
      const page = await newSpecPage({
        components: [MdButton as never],
        html: `<md-button ${attrs}>Go</md-button>`,
      });
      return page.root?.shadowRoot?.querySelector('a.md-button__anchor') ?? null;
    }

    it('renders NO anchor for a javascript: URL', async () => {
      expect(await renderButton(`href="${HOSTILE}"`)).toBeNull();
    });

    it('renders an anchor for a safe URL', async () => {
      const a = await renderButton(`href="${SAFE}"`);
      expect(a?.getAttribute('href')).toBe(SAFE);
      expect(a?.getAttribute('role')).toBe('link');
    });

    it('severs the opener when the target opens a new browsing context', async () => {
      const a = await renderButton(`href="${SAFE}" target="_blank"`);
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('severs the opener for a named target too', async () => {
      const a = await renderButton(`href="${SAFE}" target="preview"`);
      expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('does NOT set rel for same-tab navigation, which would strip the referrer', async () => {
      const a = await renderButton(`href="${SAFE}" target="_self"`);
      expect(a?.getAttribute('rel')).toBeNull();
    });
  });

  describe('components that navigate via window.open', () => {
    it.each(NAVIGATING_COMPONENTS)('%s refuses a javascript: URL', async (tag, component) => {
      const { page, openSpy } = await renderWithOpenSpy(tag, component, `href="${HOSTILE}"`);

      page.root?.click();
      await page.waitForChanges();

      expect(openSpy).not.toHaveBeenCalled();
    });

    it.each(NAVIGATING_COMPONENTS)(
      '%s follows a safe URL and severs the opener',
      async (tag, component) => {
        const { page, openSpy } = await renderWithOpenSpy(
          tag,
          component,
          `href="${SAFE}" target="_blank"`,
        );

        page.root?.click();
        await page.waitForChanges();

        expect(openSpy).toHaveBeenCalledWith(SAFE, '_blank', 'noopener,noreferrer');
      },
    );

    it('md-navigation-tab severs the opener for a named target too', async () => {
      const { page, openSpy } = await renderWithOpenSpy(
        'md-navigation-tab',
        MdNavigationTab,
        `href="${SAFE}" target="preview"`,
      );

      page.root?.click();
      await page.waitForChanges();

      expect(openSpy).toHaveBeenCalledWith(SAFE, 'preview', 'noopener,noreferrer');
    });
  });

  describe('components that render an anchor', () => {
    it('md-list-item drops a hostile href and keeps the row inert', async () => {
      const page = await newSpecPage({
        components: [MdListItem],
        html: `<md-list-item type="link" href="${HOSTILE}">Row</md-list-item>`,
      });

      const anchor = page.root?.shadowRoot?.querySelector('a');
      expect(anchor).not.toBeNull();
      expect(anchor?.getAttribute('href')).toBeNull();
    });

    it('md-list-item severs the opener on a targeted safe href', async () => {
      const page = await newSpecPage({
        components: [MdListItem],
        html: `<md-list-item type="link" href="${SAFE}" target="_blank">Row</md-list-item>`,
      });

      const anchor = page.root?.shadowRoot?.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe(SAFE);
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('md-navigation-rail-tab drops a hostile href and stops claiming to be a link', async () => {
      const page = await newSpecPage({
        components: [MdNavigationRailTab],
        html: `<md-navigation-rail-tab href="${HOSTILE}" label="Home"></md-navigation-rail-tab>`,
      });

      expect(page.root?.shadowRoot?.querySelector('a')).toBeNull();
      expect(page.root?.getAttribute('role')).not.toBe('link');
    });

    it('md-navigation-rail-tab keeps a safe href with opener severing', async () => {
      const page = await newSpecPage({
        components: [MdNavigationRailTab],
        html: `<md-navigation-rail-tab href="${SAFE}" target="_blank" label="Home"></md-navigation-rail-tab>`,
      });

      const anchor = page.root?.shadowRoot?.querySelector('a');
      expect(anchor?.getAttribute('href')).toBe(SAFE);
      expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('md-breadcrumb-item drops a hostile href', async () => {
      const page = await newSpecPage({
        components: [MdBreadcrumbItem],
        html: `<md-breadcrumb-item href="${HOSTILE}">Crumb</md-breadcrumb-item>`,
      });

      const anchor = page.root?.shadowRoot?.querySelector('a');
      expect(anchor?.getAttribute('href')).toBeNull();
    });

    it('md-breadcrumb-item defaults rel on a targeted link but lets the consumer override', async () => {
      const withDefault = await newSpecPage({
        components: [MdBreadcrumbItem],
        html: `<md-breadcrumb-item href="${SAFE}" target="_blank">Crumb</md-breadcrumb-item>`,
      });
      expect(withDefault.root?.shadowRoot?.querySelector('a')?.getAttribute('rel')).toBe(
        'noopener noreferrer',
      );

      const withOverride = await newSpecPage({
        components: [MdBreadcrumbItem],
        html: `<md-breadcrumb-item href="${SAFE}" target="_blank" rel="nofollow">Crumb</md-breadcrumb-item>`,
      });
      expect(withOverride.root?.shadowRoot?.querySelector('a')?.getAttribute('rel')).toBe(
        'nofollow',
      );
    });
  });
});
