import { newSpecPage } from '@stencil/core/testing';
import { MdAppBar } from './md-app-bar';

describe('md-app-bar', () => {
  async function create(html: string) {
    return newSpecPage({ components: [MdAppBar], html });
  }

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-app-bar></md-app-bar>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-app-bar');
      expect(page.root).toHaveClass('md-app-bar--small');
    });

    it('shows inline title for variant=small', async () => {
      const page = await create('<md-app-bar headline="Inbox"></md-app-bar>');
      const title = page.root?.shadowRoot?.querySelector('.md-app-bar__title');
      expect(title?.textContent).toBe('Inbox');
    });

    it('centers the title via title-alignment=center', async () => {
      const page = await create('<md-app-bar title-alignment="center" headline="Home"></md-app-bar>');
      expect(page.root).toHaveClass('md-app-bar--center');
      expect(page.root?.shadowRoot?.querySelector('.md-app-bar__title')?.textContent).toBe('Home');
    });

    it('renders an inline subtitle on the small variant', async () => {
      const page = await create('<md-app-bar headline="Inbox" subtitle="3 new"></md-app-bar>');
      expect(page.root).toHaveClass('md-app-bar--with-subtitle');
      const subtitle = page.root?.shadowRoot?.querySelector('.md-app-bar__subtitle--inline');
      expect(subtitle?.textContent).toBe('3 new');
    });

    it('shows expanded block for variant=medium', async () => {
      const page = await create('<md-app-bar variant="medium" headline="Messages"></md-app-bar>');
      expect(page.root).toHaveClass('md-app-bar--medium');
      expect(page.root).toHaveClass('md-app-bar--flexible');
      expect(page.root?.shadowRoot?.querySelector('[part="expanded"]')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-app-bar__expanded-headline')?.textContent).toBe(
        'Messages',
      );
    });

    it('shows expanded block for variant=large', async () => {
      const page = await create('<md-app-bar variant="large" headline="Settings"></md-app-bar>');
      expect(page.root).toHaveClass('md-app-bar--large');
      expect(page.root?.shadowRoot?.querySelector('[part="expanded"]')).toBeTruthy();
    });

    it('renders subtitle on medium variant', async () => {
      const page = await create(
        '<md-app-bar variant="medium" headline="Album" subtitle="January 2024"></md-app-bar>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="expanded"] .md-app-bar__subtitle')?.textContent).toBe(
        'January 2024',
      );
      expect(page.root).toHaveClass('md-app-bar--with-subtitle');
    });

    it('always shows expanded headline on flexible variants', async () => {
      const page = await create('<md-app-bar variant="medium" headline="Title"></md-app-bar>');
      expect(page.root).not.toHaveClass('md-app-bar--collapsed');
      expect(page.root?.shadowRoot?.querySelector('[part="expanded"]')?.getAttribute('aria-hidden')).toBeFalsy();
    });

    it('renders search variant with inline search field', async () => {
      const page = await create(
        '<md-app-bar variant="search" search-placeholder="Search apps"></md-app-bar>',
      );
      expect(page.root).toHaveClass('md-app-bar--search');
      const input = page.root?.shadowRoot?.querySelector('[part="search-input"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.getAttribute('placeholder')).toBe('Search apps');
      expect(input.getAttribute('aria-label')).toBe('Search apps');
    });

    it('applies search-focused class when the search field is focused', async () => {
      const page = await create('<md-app-bar variant="search"></md-app-bar>');
      const input = page.root?.shadowRoot?.querySelector('[part="search-input"]') as HTMLInputElement;
      const pill = page.root?.shadowRoot?.querySelector('.md-app-bar__search');
      expect(pill).not.toHaveClass('md-app-bar__search--focused');
      input?.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-app-bar--search-focused');
      expect(pill).toHaveClass('md-app-bar__search--focused');
    });

    it('sets with-search-trailing class when search-trailing slot is used', async () => {
      const page = await newSpecPage({
        components: [MdAppBar],
        html: `<md-app-bar variant="search">
          <md-icon-button slot="search-trailing" icon="mic"></md-icon-button>
        </md-app-bar>`,
      });
      expect(page.root).toHaveClass('md-app-bar--with-search-trailing');
    });

    it('hides trailing slot children beyond the maximum of three', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const page = await newSpecPage({
        components: [MdAppBar],
        html: `<md-app-bar headline="Title">
          <span slot="trailing" id="t1">1</span>
          <span slot="trailing" id="t2">2</span>
          <span slot="trailing" id="t3">3</span>
          <span slot="trailing" id="t4">4</span>
        </md-app-bar>`,
      });
      await page.waitForChanges();

      expect(page.root?.querySelector('#t1')?.hasAttribute('hidden')).toBe(false);
      expect(page.root?.querySelector('#t4')?.hasAttribute('hidden')).toBe(true);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('uses search row layout classes', async () => {
      const page = await create('<md-app-bar variant="search"></md-app-bar>');
      expect(page.root).toHaveClass('md-app-bar--search');
      expect(page.root?.shadowRoot?.querySelector('.md-app-bar__row--search')).toBeTruthy();
      expect(page.root?.shadowRoot?.querySelector('.md-app-bar__search-host')).toBeTruthy();
    });

    it('accepts spacing and size CSS custom property overrides', async () => {
      const page = await create(
        '<md-app-bar style="--md-app-bar-padding-inline-start: 8px; --md-app-bar-icon-size: 20px;">Title</md-app-bar>',
      );
      expect(page.root).toBeTruthy();
    });
  });

  describe('props', () => {
    it('reflects scrolled attribute and applies scrolled class', async () => {
      const page = await create('<md-app-bar scrolled headline="Title"></md-app-bar>');
      expect(page.root).toHaveClass('md-app-bar--scrolled');
      expect(page.root?.getAttribute('scrolled')).not.toBeNull();
    });

    it('does not apply scrolled class by default', async () => {
      const page = await create('<md-app-bar headline="Title"></md-app-bar>');
      expect(page.root).not.toHaveClass('md-app-bar--scrolled');
      expect(page.root?.hasAttribute('scrolled')).toBe(false);
    });

    it('renders prop-based leading icon fallback', async () => {
      const page = await create(
        '<md-app-bar leading-icon="menu" leading-icon-label="Menu"></md-app-bar>',
      );
      const button = page.root?.shadowRoot?.querySelector(
        'md-icon-button[part="leading-icon"]',
      ) as HTMLElement | null;
      expect(button).toBeTruthy();
      expect(button?.getAttribute('aria-label')).toBe('Menu');
    });
  });

  describe('accessibility', () => {
    it('uses role=banner', async () => {
      const page = await create('<md-app-bar></md-app-bar>');
      expect(page.root?.getAttribute('role')).toBe('banner');
    });
  });

  describe('events', () => {
    it('emits mdLeadingClick from prop-based leading icon', async () => {
      const page = await create(
        '<md-app-bar leading-icon="menu" leading-icon-label="Menu"></md-app-bar>',
      );
      const spy = jest.fn();
      page.root?.addEventListener('mdLeadingClick', spy);
      page.root?.shadowRoot?.querySelector('[part="leading-icon"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdSearchActivate when the search field is focused', async () => {
      const page = await create('<md-app-bar variant="search"></md-app-bar>');
      const activateSpy = jest.fn();
      page.root?.addEventListener('mdSearchActivate', activateSpy);
      page.root?.shadowRoot
        ?.querySelector('[part="search-input"]')
        ?.dispatchEvent(new FocusEvent('focus'));
      await page.waitForChanges();
      expect(activateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('parts', () => {
    it('exposes top-variant part attributes', async () => {
      const page = await create('<md-app-bar headline="Title"></md-app-bar>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="row"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="title"]')).toBeTruthy();
    });

    it('exposes search-variant part attributes', async () => {
      const page = await create('<md-app-bar variant="search"></md-app-bar>');
      const shadow = page.root?.shadowRoot;
      expect(shadow?.querySelector('[part="search-host"]')).toBeTruthy();
      expect(shadow?.querySelector('[part="search-input"]')).toBeTruthy();
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdAppBar],
        html: '<div dir="rtl"><md-app-bar headline="بريد"></md-app-bar></div>',
      });
      expect(page.body.querySelector('md-app-bar')).toBeTruthy();
    });
  });
});
