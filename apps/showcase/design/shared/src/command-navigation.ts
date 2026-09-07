/** Scroll only the command list, keeping its active descendant in view.
 * Focus stays in the combobox and the surrounding dialog/page stays still. */
export function scrollCommandIntoView(list: HTMLElement | null, index: number): void {
  const item = list?.querySelectorAll<HTMLElement>('[role="option"]')[index];
  if (!list || !item) return;
  const viewport = list.getBoundingClientRect();
  const bounds = item.getBoundingClientRect();
  if (bounds.top < viewport.top) list.scrollTop += bounds.top - viewport.top;
  else if (bounds.bottom > viewport.bottom) list.scrollTop += bounds.bottom - viewport.bottom;
}
