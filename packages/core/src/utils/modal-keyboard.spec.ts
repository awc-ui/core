import { newSpecPage } from '@stencil/core/testing';
import { MdDialog } from '../components/md-dialog/md-dialog';
import { MdBottomSheet } from '../components/md-bottom-sheet/md-bottom-sheet';
import { MdSideSheet } from '../components/md-side-sheet/md-side-sheet';

const components = [MdDialog, MdBottomSheet, MdSideSheet];
const mounted: Array<{ disconnectedCallback(): void }> = [];
beforeEach(() => {
  for (const component of components) {
    const loaded = component.prototype.componentDidLoad;
    jest.spyOn(component.prototype, 'componentDidLoad').mockImplementation(function (this: MdDialog & MdBottomSheet & MdSideSheet) {
      mounted.push(this); return loaded.call(this);
    });
  }
});
afterEach(() => { mounted.splice(0).reverse().forEach(component => component.disconnectedCallback()); jest.restoreAllMocks(); });

for (const tag of ['md-dialog', 'md-bottom-sheet', 'md-side-sheet']) {
  describe(`${tag} authored keyboard ownership`, () => {
    for (const handling of ['preventDefault', 'stopPropagation'] as const) {
      it(`leaves the parent open when an authored control calls ${handling}`, async () => {
        const page = await newSpecPage({ components, html: `<${tag} open variant="modal"><button>Child popup</button></${tag}>` });
        const root = page.root!, child = root.querySelector('button')!;
        const cancel = jest.fn(), handled = jest.fn((event: KeyboardEvent) => event[handling]());
        root.addEventListener('mdCancel', cancel); child.addEventListener('keydown', handled);
        child.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
        await page.waitForChanges();
        expect(handled).toHaveBeenCalledTimes(1); expect(root.open).toBe(true); expect(cancel).not.toHaveBeenCalled();
      });
    }
    it('handles an unconsumed child Escape exactly once', async () => {
      const page = await newSpecPage({ components, html: `<${tag} open variant="modal"><button>Child</button></${tag}>` });
      const root = page.root!, cancel = jest.fn(); root.addEventListener('mdCancel', cancel);
      root.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, cancelable: true }));
      await page.waitForChanges(); expect(root.open).toBe(false); expect(cancel).toHaveBeenCalledTimes(1);
    });
  });
}
