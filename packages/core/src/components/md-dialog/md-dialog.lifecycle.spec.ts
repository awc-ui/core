import { newSpecPage } from '@stencil/core/testing';
import { MdDialog } from './md-dialog';
import { MdBottomSheet } from '../md-bottom-sheet/md-bottom-sheet';

const instances: Array<{ disconnectedCallback(): void }> = [];
afterEach(() => { instances.splice(0).forEach(i => i.disconnectedCallback()); });
async function create(html: string) {
  const page = await newSpecPage({ components: [MdDialog, MdBottomSheet], html });
  if (page.rootInstance) instances.push(page.rootInstance);
  return page;
}

describe('md-dialog lifecycle ownership', () => {
  it('forwards an explicit accessible name ahead of the visible headline', async () => {
    const page = await create('<md-dialog headline="Fallback" aria-label="Explicit name"></md-dialog>');
    const panel = page.root!.shadowRoot!.querySelector('[part=container]')!;
    expect(panel.getAttribute('aria-label')).toBe('Explicit name');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
    page.root!.dialogAriaLabel = ''; await page.waitForChanges();
    expect(panel.hasAttribute('aria-label')).toBe(false);
    expect(panel.getAttribute('aria-labelledby')).toBeTruthy();
  });
  it('renders authored fullscreen headlines through the same slot', async () => {
    const page = await create('<md-dialog fullscreen><span slot="headline">Authored title</span></md-dialog>');
    expect(page.root!.shadowRoot!.querySelector('[part=headline] slot[name=headline]')).toBeTruthy();
  });

  it('keeps closed content inert and out of accessibility', async () => {
    const page = await create('<md-dialog><button>Hidden action</button></md-dialog>');
    const panel = page.root!.shadowRoot!.querySelector('[part=container]')!;
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not report cancellation from a closed surface', async () => {
    const page = await create('<md-dialog></md-dialog>'); const cancel = jest.fn();
    page.root!.addEventListener('mdCancel', cancel);
    page.root!.shadowRoot!.querySelector<HTMLElement>('[part=scrim]')!.click();
    page.rootInstance.handleCloseClick();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('restores authored overflow instead of clearing it', async () => {
    const page = await create('<md-dialog></md-dialog>');
    document.body.style.overflow = 'scroll';
    page.root!.open = true; await page.waitForChanges();
    expect(document.body.style.overflow).toBe('hidden');
    page.root!.open = false; await page.waitForChanges();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('does not unlock another dialog when a closed instance disconnects', async () => {
    const page = await create('<main><md-dialog open></md-dialog><md-dialog></md-dialog></main>');
    const [open, closed] = Array.from(page.body.querySelectorAll('md-dialog'));
    expect(document.body.style.overflow).toBe('hidden'); closed.remove();
    await page.waitForChanges(); expect(document.body.style.overflow).toBe('hidden');
    open.open = false; await page.waitForChanges();
  });

  it('does not acquire global resources while disconnected', async () => {
    const page = await create('<md-dialog></md-dialog>');
    page.root!.remove(); page.rootInstance.disconnectedCallback();
    document.body.style.overflow = 'scroll'; page.root!.open = true;
    await page.waitForChanges(); expect(document.body.style.overflow).toBe('scroll');
  });

  it('does not allow an underlying modal to handle Escape', async () => {
    const page = await create('<main><md-dialog open headline="Lower"></md-dialog><md-bottom-sheet open headline="Upper"></md-bottom-sheet></main>');
    const dialog = page.body.querySelector('md-dialog')!, sheet = page.body.querySelector('md-bottom-sheet')!;
    const cancel = jest.fn(); dialog.addEventListener('mdCancel', cancel);
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await page.waitForChanges();
    expect(dialog.open).toBe(true); expect(cancel).not.toHaveBeenCalled();
    expect(sheet.open).toBe(false);
    dialog.open = false; await page.waitForChanges();
  });
});
