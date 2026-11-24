/** Follow the tablist's default slot, including tabs forwarded by a wrapper. */
export function getTablistTabs(tablist: HTMLElement): HTMLElement[] {
  const slot = tablist.shadowRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
  const candidates = slot?.assignedElements({ flatten: true }) ??
    Array.from(tablist.children).filter(child => !child.getAttribute('slot'));
  return candidates.filter((child): child is HTMLElement => child.tagName === 'MD-TAB');
}

export function isTabDisabled(tab: HTMLElement): boolean {
  const disabled = (tab as Partial<HTMLMdTabElement>).disabled;
  const authored = tab.getAttribute('disabled');
  return typeof disabled === 'boolean' ? disabled : authored !== null && authored !== 'false';
}

/** Clamp to the nearest enabled index, searching forward with wrapping. */
export function resolveTabIndex(tabs: readonly HTMLElement[], requested: number): number {
  const normalized = Math.round(requested);
  const start = Math.max(0, Math.min(Number.isFinite(normalized) ? normalized : 0, tabs.length - 1));
  for (let offset = 0; offset < tabs.length; offset++) {
    const index = (start + offset) % tabs.length;
    if (!isTabDisabled(tabs[index])) return index;
  }
  return -1;
}
