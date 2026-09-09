/** Bridge Enter from nested core inputs whose internal text field cannot own the outer form. */
export function submitCompositeFieldOnEnter(event, host) {
  const input = event.composedPath()[0];
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.isComposing ||
    event.keyCode === 229 ||
    host.open ||
    host.disabled ||
    host.softDisabled ||
    input?.localName !== 'input'
  )
    return false;
  const form = host.closest('form');
  if (!form) return false;
  event.preventDefault();
  form.requestSubmit();
  return true;
}
