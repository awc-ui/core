/**
 * The inline composer.
 *
 * THE OPEN FORM IS CLONED OUT OF ITS TEMPLATE ON FIRST PRESS, not at load — see
 * the note in `components/composer.mjs` for why it is a template at all, and
 * note that cloning it eagerly defeats the whole point: the elements are back
 * in the document before anything is pressed, and the parity census counts them
 * exactly as it counted the hidden div. Lazy is the requirement, not an
 * optimisation.
 *
 * Nothing is ever posted: the fixture is frozen, and pressing Post raises a
 * snackbar and collapses.
 */

import { raise } from './snackbar.mjs';
import { claim } from './claim.mjs';

export function enhanceComposer(root = document) {
  const closed = root.querySelector('.composer__closed');
  const template = root.querySelector('template.composer__open-template');
  if (!closed || !template) return;
  if (!claim(closed, 'composer')) return;

  const trigger = closed.querySelector('.composer__trigger');
  let open = null;
  let body = '';

  /** Put the form in the document the first time it is needed, and wire it. */
  function materialise() {
    if (open) return open;
    const node = template.content.firstElementChild?.cloneNode(true);
    if (!node) return null;
    template.replaceWith(node);
    open = node;

    const field = open.querySelector('.composer__body');
    const post = open.querySelector('.composer__post');
    const cancel = open.querySelector('.composer__cancel');
    const icon = open.querySelector('.composer__audience-icon');
    const label = open.querySelector('.composer__audience-label');

    /* `mdInput`, whose detail IS the bare string — not the native input event.
       Binding the wrong one is silent: the draft stays empty for ever. */
    field?.addEventListener('mdInput', (event) => {
      body = String(event.detail ?? '');
      post?.toggleAttribute('soft-disabled', body.trim() === '');
    });

    /* The four audience chips are a filter row, which the component will
       happily leave two of selected — one at a time is the rule the SPA builds
       hold in state, and here it has to be enforced on the elements. */
    for (const chip of open.querySelectorAll('.composer__audience')) {
      chip.addEventListener('click', () => {
        for (const other of open.querySelectorAll('.composer__audience')) {
          other.toggleAttribute('selected', other === chip);
        }
        if (icon) icon.textContent = chip.getAttribute('data-icon') ?? '';
        if (label) label.textContent = chip.getAttribute('data-label') ?? '';
      });
    }

    const reset = () => {
      body = '';
      if (field) field.value = '';
      post?.setAttribute('soft-disabled', '');
      show(false);
    };

    cancel?.addEventListener('mdClick', reset);
    post?.addEventListener('mdClick', () => {
      if (body.trim() === '') {
        raise(post.getAttribute('data-need'));
        return;
      }
      raise(post.getAttribute('data-msg'));
      reset();
    });

    return open;
  }

  function show(expanded) {
    closed.toggleAttribute('hidden', expanded);
    open?.toggleAttribute('hidden', !expanded);
  }

  trigger?.addEventListener('click', () => {
    materialise();
    show(true);
  });
}
