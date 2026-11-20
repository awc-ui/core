jest.mock('../../utils/slot-refresh', () => ({ refreshNewSlots: jest.fn() }));
import { newSpecPage } from '@stencil/core/testing';
import { refreshNewSlots } from '../../utils/slot-refresh';
import { MdTabPanel } from './md-tab-panel';

// R6-15 (5-2): on cold loads Chrome left the panel's slotted text out of its accessibility tree (tools/ax Web captures 1–6/24,
// diag52 5/48; restored only by re-inserting the slot). The panel hands every render's shadow root to refreshNewSlots, which
// re-inserts a newly rendered default slot on the next frame and once more 250 ms later (tools/ax 0/24, 5-2-006/007).
describe('md-tab-panel slot refresh', () => {
  beforeEach(() => (refreshNewSlots as jest.Mock).mockClear());

  it('hands its shadow root, with the panel slot rendered, to refreshNewSlots after rendering', async () => {
    const page = await newSpecPage({ components: [MdTabPanel], html: '<md-tab-panel>Your workspace</md-tab-panel>' });
    const calls = (refreshNewSlots as jest.Mock).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).toBe(page.root!.shadowRoot);
    expect(page.root!.shadowRoot!.querySelector('.md-tab-panel__body slot:not([name])')).not.toBeNull();
  });

  it('calls it again after a re-render (activation), so a slot a later render creates is covered', async () => {
    const page = await newSpecPage({ components: [MdTabPanel], html: '<md-tab-panel>Your workspace</md-tab-panel>' });
    const before = (refreshNewSlots as jest.Mock).mock.calls.length;
    page.root!.active = true;
    await page.waitForChanges();
    expect((refreshNewSlots as jest.Mock).mock.calls.length).toBeGreaterThan(before);
  });
});
