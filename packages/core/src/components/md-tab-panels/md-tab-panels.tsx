import { Component, Element, Host, h, Prop, Watch } from '@stencil/core';

/**
 * Panel region for `md-tabs`: place directly AFTER the tablist (or point
 * `for` at its id) with one `md-tab-panel` per tab, in tab order.
 *
 * - Shows the panel matching the tabs' `activeTabIndex`, following
 *   `mdTabChange` automatically.
 * - `sizing="stable"` (default): all panels stack in one grid cell and
 *   inactive ones stay in layout (hidden), so the region — and any
 *   shrink-to-fit card around it — keeps the SAME width/height no matter
 *   which tab is active. `sizing="active"` sizes to the active panel only.
 * - Wires the APG ARIA contract both ways: each tab gets `aria-controls`,
 *   each panel gets `aria-labelledby`, ids auto-assigned where missing.
 *
 * @slot - `md-tab-panel` elements, one per tab
 */
@Component({
  tag: 'md-tab-panels',
  styleUrl: 'md-tab-panels.css',
  shadow: true,
})
export class MdTabPanels {
  @Element() el!: HTMLElement;

  /** id of the `md-tabs` to follow. Empty = nearest preceding md-tabs sibling. */
  @Prop() for: string = '';

  /** stable = reserve the largest panel's box; active = size to the active panel. */
  @Prop({ reflect: true }) sizing: 'stable' | 'active' = 'stable';

  private tabsEl: (HTMLElement & { activeTabIndex?: number }) | null = null;
  private hasLoaded = false;
  private uid = `md-tab-panels-${Math.random().toString(36).slice(2, 7)}`;

  private onTabChange = (e: Event) => {
    const detail = (e as CustomEvent<{ index: number }>).detail;
    if (detail && typeof detail.index === 'number') this.show(detail.index);
  };

  @Watch('for')
  onForChange() {
    this.unwire();
    this.wire();
  }

  componentDidLoad() {
    this.hasLoaded = true;
    const slot = this.el.shadowRoot?.querySelector('slot');
    slot?.addEventListener('slotchange', () => this.sync());
    this.wire();
  }

  connectedCallback() {
    // house rule: reconnects must rebind (disconnect tears the listener down)
    if (this.hasLoaded) queueMicrotask(() => this.wire());
  }

  disconnectedCallback() {
    this.unwire();
  }

  private findTabs(): (HTMLElement & { activeTabIndex?: number }) | null {
    if (this.for) {
      return (this.el.getRootNode() as Document | ShadowRoot).getElementById?.(this.for) ?? document.getElementById(this.for);
    }
    let n: Element | null = this.el.previousElementSibling;
    while (n) {
      if (n.tagName === 'MD-TABS') return n as HTMLElement;
      n = n.previousElementSibling;
    }
    return null;
  }

  private wire() {
    const tabs = this.findTabs();
    if (this.tabsEl && this.tabsEl !== tabs) this.unwire();
    this.tabsEl = tabs;
    tabs?.addEventListener('mdTabChange', this.onTabChange);
    this.sync();
  }

  private unwire() {
    this.tabsEl?.removeEventListener('mdTabChange', this.onTabChange);
    this.tabsEl = null;
  }

  private panels(): HTMLElement[] {
    const slot = this.el.shadowRoot?.querySelector('slot');
    // flatten — panels forwarded through wrapper slots are managed too
    return (slot?.assignedElements({ flatten: true }) ?? []).filter(
      (e) => e.tagName === 'MD-TAB-PANEL',
    ) as HTMLElement[];
  }

  /** Current index + ARIA wiring (tabs aria-controls ↔ panels aria-labelledby). */
  private sync() {
    const tabs = this.tabsEl;
    const tabEls = tabs ? (Array.from(tabs.querySelectorAll('md-tab')) as HTMLElement[]) : [];
    this.panels().forEach((panel, i) => {
      if (!panel.id) panel.id = `${this.uid}-panel-${i}`;
      const tab = tabEls[i];
      if (tab) {
        if (!tab.id) tab.id = `${this.uid}-tab-${i}`;
        panel.setAttribute('aria-labelledby', tab.id);
        if (!tab.hasAttribute('controls') && !tab.hasAttribute('aria-controls')) {
          tab.setAttribute('controls', panel.id);
        }
      }
    });
    const index = typeof tabs?.activeTabIndex === 'number'
      ? tabs.activeTabIndex
      : parseInt(tabs?.getAttribute('active-tab-index') ?? '0', 10) || 0;
    this.show(index);
  }

  private show(index: number) {
    this.panels().forEach((panel, i) => {
      const active = i === index;
      // mock-doc has no toggleAttribute — set/remove explicitly
      if (active) {
        panel.setAttribute('active', '');
        panel.removeAttribute('inert');
      } else {
        panel.removeAttribute('active');
        panel.setAttribute('inert', '');
      }
    });
  }

  render() {
    return (
      <Host>
        <slot />
      </Host>
    );
  }
}
