import { newSpecPage } from '@stencil/core/testing';
import { createDocument } from '@stencil/core/mock-doc';
import { MdSideSheet } from './md-side-sheet';
import { MdBottomSheet } from '../md-bottom-sheet/md-bottom-sheet';

describe('md-side-sheet resource, naming and composed focus ownership', () => {
  const instances: Array<MdSideSheet | MdBottomSheet> = [];
  beforeEach(() => {
    for (const component of [MdSideSheet, MdBottomSheet]) {
      const loaded = component.prototype.componentDidLoad;
      jest.spyOn(component.prototype, 'componentDidLoad').mockImplementation(function(this: any) {
        instances.push(this); return loaded.call(this);
      });
    }
  });
  afterEach(() => { instances.splice(0).reverse().forEach(instance => instance.disconnectedCallback()); jest.restoreAllMocks(); });
  const make = (html: string) => newSpecPage({ components: [MdSideSheet, MdBottomSheet], html });

  it('does not unlock another modal when a standard sheet disconnects', async () => {
    const page = await make('<md-bottom-sheet open></md-bottom-sheet><md-side-sheet open></md-side-sheet>');
    const side = instances.find(x => x instanceof MdSideSheet)!;
    side.disconnectedCallback(); expect(page.doc.body.style.overflow).toBe('hidden');
  });

  it('restores the original overflow after its own modal closes', async () => {
    const page = await make('<md-side-sheet variant="modal"></md-side-sheet>');
    page.doc.body.style.overflow = 'scroll'; page.rootInstance.open = true; await page.waitForChanges();
    page.rootInstance.open = false; await page.waitForChanges();
    expect(page.doc.body.style.overflow).toBe('scroll');
  });

  it('releases and reacquires resources when an open sheet changes variant without extra open events', async () => {
    const page = await make('<md-side-sheet></md-side-sheet>');
    const open = jest.fn(), close = jest.fn(); page.root!.addEventListener('mdOpen', open); page.root!.addEventListener('mdClose', close);
    page.doc.body.style.overflow = 'clip'; page.rootInstance.open = true; await page.waitForChanges();
    page.root!.setAttribute('variant', 'modal'); await page.waitForChanges(); expect(page.doc.body.style.overflow).toBe('hidden');
    page.root!.setAttribute('variant', 'standard'); await page.waitForChanges(); expect(page.doc.body.style.overflow).toBe('clip');
    expect(open).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled();
  });

  it('reconnects an open modal without re-emitting mdOpen', async () => {
    const page = await make('<md-side-sheet variant="modal" open></md-side-sheet>');
    const open = jest.fn(); page.root!.addEventListener('mdOpen', open);
    page.rootInstance.disconnectedCallback(); page.rootInstance.connectedCallback();
    expect(page.doc.body.style.overflow).toBe('hidden');
    page.doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    await page.waitForChanges(); expect(page.rootInstance.open).toBe(false); expect(open).not.toHaveBeenCalled();
  });

  it('releases the acquired document and registers listeners in the destination after adoption', async () => {
    const page = await make('<md-side-sheet variant="modal"></md-side-sheet>');
    const destination = createDocument(); page.doc.body.style.overflow = 'scroll'; destination.body.style.overflow = 'clip';
    page.rootInstance.open = true; await page.waitForChanges();
    const oldRemove = jest.spyOn(page.doc, 'removeEventListener'), add = jest.spyOn(destination, 'addEventListener');
    Object.defineProperty(page.root!, 'ownerDocument', { configurable: true, get: () => destination });
    page.rootInstance.disconnectedCallback(); page.rootInstance.connectedCallback();
    expect(page.doc.body.style.overflow).toBe('scroll'); expect(destination.body.style.overflow).toBe('hidden');
    expect(oldRemove).toHaveBeenCalledWith('keydown', page.rootInstance.handleDocKeyDown);
    expect(add).toHaveBeenCalledWith('keydown', page.rootInstance.handleDocKeyDown);
  });

  it('only permits the top modal to answer dismissal, including mixed component types', async () => {
    const page = await make('<md-side-sheet open variant="modal"></md-side-sheet><md-bottom-sheet open></md-bottom-sheet>');
    const side = page.doc.querySelector('md-side-sheet')!;
    const cancel = jest.fn(); side.addEventListener('mdCancel', cancel);
    side.shadowRoot!.querySelector('[part="scrim"]')!.dispatchEvent(new MouseEvent('click'));
    await page.waitForChanges(); expect(side.open).toBe(true); expect(cancel).not.toHaveBeenCalled();
  });

  it('does not acquire modal resources for property edits made while disconnected', async () => {
    const page = await make('<md-side-sheet variant="modal"></md-side-sheet>');
    page.rootInstance.disconnectedCallback(); page.doc.body.style.overflow = 'clip';
    page.rootInstance.open = true; await page.waitForChanges(); expect(page.doc.body.style.overflow).toBe('clip');
  });

  it('gives an explicit accessible name precedence over the text headline', async () => {
    const page = await make('<md-side-sheet open headline="Visible" aria-label="Explicit"></md-side-sheet>');
    const container = page.root!.shadowRoot!.querySelector('[part="container"]')!;
    expect(container.getAttribute('aria-label')).toBe('Explicit'); expect(container.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('uses a slotted headline as the accessible name and tracks slot reassignment', async () => {
    const page = await make('<md-side-sheet open><strong slot="headline">Authored</strong></md-side-sheet>');
    const container = page.root!.shadowRoot!.querySelector('[part="container"]')!;
    expect(container.getAttribute('aria-labelledby')).toBeTruthy(); expect(container.hasAttribute('aria-label')).toBe(false);
    page.root!.firstElementChild!.setAttribute('slot', 'actions');
    page.root!.shadowRoot!.querySelector('slot[name="headline"]')!.dispatchEvent(new Event('slotchange'));
    await page.waitForChanges(); expect(container.getAttribute('aria-label')).toBe('Side sheet');
  });

  it('does not treat authored disabled or hidden controls as focus candidates', async () => {
    const page = await make('<md-side-sheet variant="modal" open closeable="false"><button disabled tabindex="0">Disabled</button><input type="hidden" tabindex="0"><div hidden><button>Hidden</button></div><div inert><button>Inert</button></div><button id="valid">Valid</button></md-side-sheet>');
    expect(page.rootInstance.getFocusableElements().map((x: HTMLElement) => x.id)).toEqual(['valid']);
  });

  it('honors disabled fieldsets while preserving the first legend exception', async () => {
    const page = await make('<md-side-sheet variant="modal" open closeable="false"><fieldset disabled><legend><button id="legend">Legend</button></legend><button tabindex="0">Disabled</button></fieldset><button id="last">Last</button></md-side-sheet>');
    expect(page.rootInstance.getFocusableElements().map((x: HTMLElement) => x.id)).toEqual(['legend', 'last']);
  });

  it('follows authored open shadow controls in composed slot order', async () => {
    const page = await make('<md-side-sheet variant="modal" open closeable="false"><div id="shadow"></div><button id="last">Last</button></md-side-sheet>');
    const root = page.root!.querySelector('#shadow')!.attachShadow({ mode: 'open' }); root.innerHTML = '<input id="first">';
    expect(page.rootInstance.getFocusableElements().map((x: HTMLElement) => x.id)).toEqual(['first', 'last']);
  });

  it('does not trap focus after closing or while covered', async () => {
    const page = await make('<md-side-sheet variant="modal" closeable="false"><button>Action</button></md-side-sheet>');
    const focus = jest.spyOn(page.root!.querySelector('button')!, 'focus');
    page.root!.shadowRoot!.querySelectorAll('.md-side-sheet__focus-guard')[1].dispatchEvent(new FocusEvent('focus'));
    expect(focus).not.toHaveBeenCalled();
  });
});
