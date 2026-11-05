const namedKeys = new Set(['Enter', 'Space', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
const printableKey = key => typeof key === 'string' && key.length === 1 && key.codePointAt(0) > 32 && !/[\p{C}\p{Zl}\p{Zp}]/u.test(key);

/** A key names input inside the isolated view; it never names an OS command. */
export const isNativePreviewKey = key => namedKeys.has(key) || printableKey(key);

/** Text editors retain input/composition delivery; menus receive real typeahead keys. */
export function nativePreviewKeyCommand(event, { typeahead = false } = {}) {
  if (event.isComposing) return null;
  const key = event.key === ' ' ? 'Space' : event.key;
  if (!namedKeys.has(key) && !(typeahead && printableKey(key) && !event.ctrlKey && !event.altKey && !event.metaKey)) return null;
  const modifiers = [['shiftKey', 'shift'], ['ctrlKey', 'control'], ['altKey', 'alt'], ['metaKey', 'meta']].filter(([name]) => event[name]).map(([, value]) => value);
  return { command: 'key', key, modifiers };
}

const dismissiblePreviews = new Set(['md-snackbar', 'md-tooltip', 'md-dialog', 'md-bottom-sheet', 'md-side-sheet']);

/** Overlay keyboard handling is enabled only with the retained native contract. */
export function nativePreviewKeyboardPolicy(tag, { retained = false, scenario = false } = {}) {
  const typeahead = tag === 'md-fab-menu' && !scenario;
  return { typeahead, nativeEscape: typeahead || !scenario && retained && dismissiblePreviews.has(tag) };
}

/** Route a real textarea key event without blurring before a native dismissal. */
export function handleNativePreviewKeyDown(event, { typeahead = false, nativeEscape = false, send, releaseFocus }) {
  if (event.isComposing) return;
  if (event.key === 'Escape' && !nativeEscape) {
    event.preventDefault(); event.stopPropagation(); releaseFocus(); return;
  }
  const command = nativePreviewKeyCommand(event, { typeahead });
  if (!command) return;
  event.preventDefault(); event.stopPropagation(); send(command);
}
