export interface SelectableElement extends HTMLElement {
  selected: boolean;
  value: string;
  type?: string;
}

export interface ToggleableElement extends HTMLElement {
  toggle: boolean;
  shape: string;
  size: string;
  selected: boolean;
  value: string;
  connectedLeft: boolean;
  connectedRight: boolean;
}

export interface MenuElement extends HTMLElement {
  open: boolean;
  anchor?: string;
  persistent?: boolean;
  close(): void;
  show(opts?: { autoFocus?: boolean }): void;
  headline?: string;
}

/**
 * Data-model adapter that lets `md-menu` drive keyboard navigation, typeahead,
 * and focus over a *virtualized* option list — where only the rows in the
 * current scroll window exist in the DOM. The host (md-select / md-multi-select)
 * implements it backed by a `WasmOptionStore`; the menu queries it instead of
 * `querySelectorAll('md-menu-item')` whenever a provider is registered.
 */
export interface VirtualMenuProvider {
  /** Total number of rows in the current (filtered) list. */
  count(): number;
  /** Label of the row at filtered `index` (for typeahead / a11y). */
  labelAt(index: number): string;
  /** Whether the row at filtered `index` is disabled (skipped by arrows). */
  isDisabledAt(index: number): boolean;
  /** Scroll filtered `index` into the rendered window and await the re-render. */
  ensureVisible(index: number): Promise<void>;
  /** The rendered `md-menu-item` for filtered `index`, if currently windowed. */
  domItemForIndex(index: number): HTMLElement | null;
  /**
   * Typeahead: first filtered index at/after `from` whose label starts with
   * `buffer` (wrapping the list), or -1.
   */
  findPrefix(buffer: string, from: number): number;
}

export interface TabElement extends HTMLElement {
  active: boolean;
}

export interface RadioElement extends HTMLElement {
  checked: boolean;
  disabled: boolean;
}

export interface SelectOptionElement extends HTMLElement {
  value: string;
  label: string;
  disabled: boolean;
  selected: boolean;
  icon: string;
  iconColor?: string;
  supportingText: string;
}

export interface FabElement extends HTMLElement {
  selected?: boolean;
  icon?: string;
}

export interface SegmentElement extends HTMLElement {
  segmentIndex: number;
  segmentTotal: number;
  segmentDensity: number;
  segmentMultiselect: boolean;
  selected: boolean;
  value: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
    __STENCIL_DEV_MODE__?: boolean;
  }
}
