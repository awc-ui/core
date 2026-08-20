import { newSpecPage } from '@stencil/core/testing';
import { MdDialog } from './md-dialog';
import { MdButton } from '../md-button/md-button';
import { MdRipple } from '../md-ripple/md-ripple';

describe('md-dialog', () => {
  async function create(html: string) {
    return newSpecPage({
      components: [MdDialog, MdButton, MdRipple],
      html,
    });
  }

  describe('rendering', () => {
    it('renders with defaults', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root).toBeTruthy();
      expect(page.root).toHaveClass('md-dialog');
    });

    it('is not open by default', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root).not.toHaveClass('md-dialog--open');
    });

    it('opens with open prop', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      expect(page.root).toHaveClass('md-dialog--open');
    });

    it('renders headline text', async () => {
      const page = await create('<md-dialog headline="My Title">Content</md-dialog>');
      const headline = page.root?.shadowRoot?.querySelector('.md-dialog__headline');
      expect(headline?.textContent).toContain('My Title');
    });

    it('renders icon from prop', async () => {
      const page = await create('<md-dialog icon="warning">Content</md-dialog>');
      const icon = page.root?.shadowRoot?.querySelector('.md-dialog__icon');
      expect(icon).toBeTruthy();
      expect(icon?.textContent).toBe('warning');
    });

    it('renders scrim for basic dialog', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-dialog__scrim');
      expect(scrim).toBeTruthy();
    });

    it('does not render scrim for full-screen dialog', async () => {
      const page = await create('<md-dialog fullscreen>Content</md-dialog>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-dialog__scrim');
      expect(scrim).toBeNull();
    });

    it('renders divider when divider prop is true', async () => {
      const page = await create('<md-dialog divider>Content</md-dialog>');
      const divider = page.root?.shadowRoot?.querySelector('.md-dialog__divider');
      expect(divider).toBeTruthy();
    });

    it('does not render divider by default', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const dividers = page.root?.shadowRoot?.querySelectorAll('.md-dialog__divider');
      expect(dividers?.length).toBe(0);
    });
  });

  describe('fullscreen variant', () => {
    it('applies fullscreen class', async () => {
      const page = await create('<md-dialog fullscreen>Content</md-dialog>');
      expect(page.root).toHaveClass('md-dialog--fullscreen');
    });

    it('renders full-screen header', async () => {
      const page = await create('<md-dialog fullscreen headline="Edit">Content</md-dialog>');
      const header = page.root?.shadowRoot?.querySelector('.md-dialog__header');
      expect(header).toBeTruthy();
    });

    it('renders close button in full-screen header', async () => {
      const page = await create('<md-dialog fullscreen>Content</md-dialog>');
      const closeBtn = page.root?.shadowRoot?.querySelector('.md-dialog__close-btn');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close');
    });

    it('renders header headline in full-screen', async () => {
      const page = await create('<md-dialog fullscreen headline="Edit Profile">Content</md-dialog>');
      const headline = page.root?.shadowRoot?.querySelector('.md-dialog__header-headline');
      expect(headline?.textContent).toBe('Edit Profile');
    });

    it('renders header divider when header-divider is true', async () => {
      const page = await create('<md-dialog fullscreen header-divider>Content</md-dialog>');
      const dividers = page.root?.shadowRoot?.querySelectorAll('.md-dialog__divider');
      expect(dividers?.length).toBe(1);
    });
  });

  describe('accessibility', () => {
    it('has role=alertdialog on basic container', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const container = page.root?.shadowRoot?.querySelector('.md-dialog__container');
      expect(container?.getAttribute('role')).toBe('alertdialog');
    });

    it('has role=dialog on full-screen container', async () => {
      const page = await create('<md-dialog fullscreen>Content</md-dialog>');
      const container = page.root?.shadowRoot?.querySelector('.md-dialog__container');
      expect(container?.getAttribute('role')).toBe('dialog');
    });

    it('has aria-modal=true', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const container = page.root?.shadowRoot?.querySelector('.md-dialog__container');
      expect(container?.getAttribute('aria-modal')).toBe('true');
    });

    it('has aria-labelledby linked to headline', async () => {
      const page = await create('<md-dialog headline="Title">Content</md-dialog>');
      const container = page.root?.shadowRoot?.querySelector('.md-dialog__container');
      const headlineId = container?.getAttribute('aria-labelledby');
      expect(headlineId).toBeTruthy();
      const headline = page.root?.shadowRoot?.querySelector(`#${headlineId}`);
      expect(headline).toBeTruthy();
    });

    it('has aria-describedby linked to content', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const container = page.root?.shadowRoot?.querySelector('.md-dialog__container');
      const contentId = container?.getAttribute('aria-describedby');
      expect(contentId).toBeTruthy();
      const content = page.root?.shadowRoot?.querySelector(`#${contentId}`);
      expect(content).toBeTruthy();
    });

    it('container has tabindex=-1 for programmatic focus', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const container = page.root?.shadowRoot?.querySelector('.md-dialog__container');
      expect(container?.getAttribute('tabindex')).toBe('-1');
    });

    it('scrim has aria-hidden=true', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-dialog__scrim');
      expect(scrim?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('methods', () => {
    it('show() opens dialog', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-dialog--open');
    });

    it('close() closes dialog', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-dialog--open');
    });
  });

  describe('events', () => {
    it('emits mdOpen when opened', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdOpen', spy);
      await page.rootInstance.show();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdClose when closed', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdClose', spy);
      await page.rootInstance.close();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits mdCancel on Escape', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('closes on Escape', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await page.waitForChanges();
      expect(page.root).not.toHaveClass('md-dialog--open');
    });

    it('emits mdCancel on scrim click', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const scrim = page.root?.shadowRoot?.querySelector('.md-dialog__scrim') as HTMLElement;
      scrim?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does not close scrim click when scrim-dismissible=false', async () => {
      const page = await create('<md-dialog open scrim-dismissible="false">Content</md-dialog>');
      const scrim = page.root?.shadowRoot?.querySelector('.md-dialog__scrim') as HTMLElement;
      scrim?.click();
      await page.waitForChanges();
      expect(page.root).toHaveClass('md-dialog--open');
    });

    it('emits mdCancel on full-screen close button click', async () => {
      const page = await create('<md-dialog open fullscreen>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const closeBtn = page.root?.shadowRoot?.querySelector('.md-dialog__close-btn') as HTMLElement;
      closeBtn?.click();
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyboard', () => {
    it('does nothing on Escape when closed', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      page.root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await page.waitForChanges();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('icon', () => {
    it('adds has-icon class when icon prop is set', async () => {
      const page = await create('<md-dialog icon="delete">Content</md-dialog>');
      expect(page.root).toHaveClass('md-dialog--has-icon');
    });

    it('renders icon slot', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="icon"]');
      expect(slot).toBeTruthy();
    });
  });

  describe('parts', () => {
    it('exposes container part', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root?.shadowRoot?.querySelector('[part="container"]')).toBeTruthy();
    });

    it('exposes content part', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root?.shadowRoot?.querySelector('[part="content"]')).toBeTruthy();
    });

    it('exposes actions part', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root?.shadowRoot?.querySelector('[part="actions"]')).toBeTruthy();
    });

    it('exposes scrim part', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root?.shadowRoot?.querySelector('[part="scrim"]')).toBeTruthy();
    });

    it('exposes header part', async () => {
      const page = await create('<md-dialog>Content</md-dialog>');
      expect(page.root?.shadowRoot?.querySelector('[part="header"]')).toBeTruthy();
    });

    it('exposes divider part when divider is true', async () => {
      const page = await create('<md-dialog divider>Content</md-dialog>');
      expect(page.root?.shadowRoot?.querySelector('[part="divider"]')).toBeTruthy();
    });
  });

  describe('slots', () => {
    it('renders default slot for content', async () => {
      const page = await create('<md-dialog>Hello World</md-dialog>');
      expect(page.root?.textContent).toContain('Hello World');
    });

    it('renders actions slot', async () => {
      const page = await create('<md-dialog><button slot="actions">OK</button></md-dialog>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="actions"]');
      expect(slot).toBeTruthy();
    });

    it('renders headline slot', async () => {
      const page = await create('<md-dialog headline="Title">Content</md-dialog>');
      const slot = page.root?.shadowRoot?.querySelector('slot[name="headline"]');
      expect(slot).toBeTruthy();
    });
  });

  describe('RTL', () => {
    it('renders in RTL context', async () => {
      const page = await newSpecPage({
        components: [MdDialog, MdButton, MdRipple],
        html: '<div dir="rtl"><md-dialog headline="عنوان">محتوى</md-dialog></div>',
      });
      expect(page.root).toBeTruthy();
    });
  });

  describe('i18n / localization', () => {
    it('uses English close label by default', async () => {
      const page = await create('<md-dialog fullscreen>Content</md-dialog>');
      const closeBtn = page.root?.shadowRoot?.querySelector('.md-dialog__close-btn');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Close');
    });

    it('localizes close label from locale', async () => {
      const page = await create('<md-dialog fullscreen locale="de-DE">Content</md-dialog>');
      const closeBtn = page.root?.shadowRoot?.querySelector('.md-dialog__close-btn');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Schließen');
    });

    it('prefers explicit close-label over locale', async () => {
      const page = await create(
        '<md-dialog fullscreen locale="de-DE" close-label="Dismiss">Content</md-dialog>',
      );
      const closeBtn = page.root?.shadowRoot?.querySelector('.md-dialog__close-btn');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Dismiss');
    });

    it('renders locale-aware default action buttons', async () => {
      const page = await create('<md-dialog locale="ja-JP">Content</md-dialog>');
      const cancelBtn = page.root?.shadowRoot?.querySelector('[part="cancel-button"]');
      const okBtn = page.root?.shadowRoot?.querySelector('[part="ok-button"]');
      expect(cancelBtn?.textContent?.trim()).toBe('キャンセル');
      expect(okBtn?.textContent?.trim()).toBe('OK');
    });

    it('renders custom cancel and ok labels', async () => {
      const page = await create(
        '<md-dialog cancel-label="Anulează" ok-label="Confirmă">Content</md-dialog>',
      );
      const cancelBtn = page.root?.shadowRoot?.querySelector('[part="cancel-button"]');
      const okBtn = page.root?.shadowRoot?.querySelector('[part="ok-button"]');
      expect(cancelBtn?.textContent?.trim()).toBe('Anulează');
      expect(okBtn?.textContent?.trim()).toBe('Confirmă');
    });

    it('hides default actions when actions slot is provided', async () => {
      const page = await create(
        '<md-dialog><button slot="actions">Done</button>Content</md-dialog>',
      );
      expect(page.root?.shadowRoot?.querySelector('[part="cancel-button"]')).toBeNull();
      expect(page.root?.shadowRoot?.querySelector('[part="ok-button"]')).toBeNull();
    });

    it('default cancel emits mdCancel', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      const spy = jest.fn();
      page.root?.addEventListener('mdCancel', spy);
      const cancelBtn = page.root?.shadowRoot?.querySelector(
        '[part="cancel-button"]',
      ) as HTMLElement;
      cancelBtn?.dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
      await page.waitForChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(page.root).not.toHaveClass('md-dialog--open');
    });

    it('default ok closes without mdCancel', async () => {
      const page = await create('<md-dialog open>Content</md-dialog>');
      const cancelSpy = jest.fn();
      page.root?.addEventListener('mdCancel', cancelSpy);
      const okBtn = page.root?.shadowRoot?.querySelector(
        '[part="ok-button"]',
      ) as HTMLElement;
      okBtn?.dispatchEvent(new CustomEvent('mdClick', { bubbles: true }));
      await page.waitForChanges();
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(page.root).not.toHaveClass('md-dialog--open');
    });
  });
});
