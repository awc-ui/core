jest.mock('../../utils/slot-refresh', () => ({ refreshNewSlots: jest.fn() }));
import { newSpecPage } from '@stencil/core/testing';
import { refreshNewSlots } from '../../utils/slot-refresh';
import { MdStep } from './md-step';

// R6-15 (5-2): on cold loads Chrome left the open step panel's slotted text out of its accessibility tree in every md-stepper
// layout (tools/ax Web captures 12/120 over five cases, diag52 17/120; restored by re-inserting / re-naming the slot). The panel's
// slot appears on a later render (md-stepper sets data-panel-mode / data-orientation after it loads), so md-step hands every
// render's shadow root to refreshNewSlots, which re-inserts a newly rendered default slot on the next frame and once more 250 ms
// later (tools/ax 0/24 in each of the five layouts, 5-2-006/007).
const attrs = (more: Record<string, string> = {}) => Object.entries({ 'data-index': '0', 'data-total': '1', 'data-active': '0',
  'data-position': 'first', 'data-indicator': 'numbered', 'data-mode': 'non-linear', 'data-connector': 'line', ...more })
  .map(([k, v]) => `${k}="${v}"`).join(' ');
const panelSlotAtCall = () => (refreshNewSlots as jest.Mock).mock.calls.some(([root]) => !!(root as ShadowRoot).querySelector('#md-step-panel slot:not([name])'));

describe('md-step slot refresh', () => {
  beforeEach(() => (refreshNewSlots as jest.Mock).mockClear());

  it('hands its shadow root to refreshNewSlots once the vertical panel slot is rendered', async () => {
    const page = await newSpecPage({ components: [MdStep], html: `<md-step label="Account" ${attrs({ 'data-orientation': 'vertical' })}>Complete this section</md-step>` });
    expect((refreshNewSlots as jest.Mock).mock.calls.every(([root]) => root === page.root!.shadowRoot)).toBe(true);
    expect(panelSlotAtCall()).toBe(true);
  });

  it('covers the horizontal panel slot that appears when the stepper switches the step to panel mode', async () => {
    const page = await newSpecPage({ components: [MdStep], html: `<md-step label="Account" ${attrs({ 'data-orientation': 'horizontal' })}>Complete this section</md-step>` });
    expect(page.root!.shadowRoot!.querySelector('#md-step-panel')).toBeNull();
    (refreshNewSlots as jest.Mock).mockClear();
    page.root!.setAttribute('data-panel-mode', 'step');
    page.root!.label = 'Account details';
    await page.waitForChanges();
    expect(page.root!.shadowRoot!.querySelector('#md-step-panel slot:not([name])')).not.toBeNull();
    expect(panelSlotAtCall()).toBe(true);
  });
});
