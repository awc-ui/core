/**
 * The composer: the picture picker, the caption, the audience, the tags, the
 * stepper's veto, and the live preview beside all of it.
 *
 * THIS IS THE ONE SCREEN THAT NEEDS JAVASCRIPT TO BE ITSELF, because a wizard
 * is state. What the document already carries is the whole form and the preview
 * in its empty state — which is what a reader sees before touching anything
 * anyway — so this adds the transitions rather than the content.
 *
 * NOTHING HERE COMPOSES A SENTENCE. The two refusals ride on the stepper as
 * data attributes, the audience chip's label and icon ride on each option, the
 * character count is a two-hole template, and every picture the preview can
 * show is already in the markup with its translated alt text. This module sets
 * attributes and toggles `hidden`.
 */

import { raise } from './snackbar.mjs';

/** The caption field's cap, mirrored from the screen that renders it. */
const CAPTION_MAX = 280;

export function enhanceCreate(root = document) {
  const stepper = root.querySelector('.composer__stepper:not([data-bound])');
  if (!stepper) return;
  stepper.setAttribute('data-bound', '');

  const preview = root.querySelector('.composer__preview');
  const placeholder = root.querySelector('.composer__placeholder');
  const captionField = root.querySelector('.composer__caption');
  const captionText = root.querySelector('.composer__caption-text');
  const captionCount = root.querySelector('.composer__count');
  const audienceChip = root.querySelector('.composer__audience-chip');
  const taggedRow = root.querySelector('.composer__tagged');
  const taggedNames = root.querySelector('.composer__tagged-names');
  const steps = [...stepper.querySelectorAll('md-step')];

  let media = null;
  let caption = '';
  const tagged = [];

  /* ------------------------------------------------------------- picture */

  const showMedia = () => {
    for (const frame of root.querySelectorAll('.composer__preview-media')) {
      frame.toggleAttribute('hidden', frame.getAttribute('data-media') !== media);
    }
    placeholder?.toggleAttribute('hidden', media !== null);
    steps[0]?.toggleAttribute('completed', media !== null);
  };

  for (const pick of root.querySelectorAll('.composer__pick')) {
    pick.addEventListener('click', () => {
      media = pick.getAttribute('data-media');
      for (const other of root.querySelectorAll('.composer__pick')) {
        const on = other === pick;
        other.toggleAttribute('data-on', on);
        other.setAttribute('aria-pressed', String(on));
      }
      showMedia();
    });
  }

  /* ------------------------------------------------------------- caption */

  const showCaption = () => {
    const empty = caption.trim() === '';
    if (captionText) {
      /* The placeholder sentence was written into the element by the build, so
         it has to be kept: emptying the node would lose the only copy of it.
         It is stashed on the element the first time it is replaced. */
      if (!captionText.hasAttribute('data-placeholder')) {
        captionText.setAttribute('data-placeholder', captionText.textContent ?? '');
      }
      captionText.textContent = empty
        ? (captionText.getAttribute('data-placeholder') ?? '')
        : caption;
      captionText.classList.toggle('muted', empty);
    }

    const template = captionCount?.getAttribute('data-count-template');
    if (captionCount && template) {
      captionCount.textContent = template
        .replace('%count%', String(caption.length))
        .replace('%max%', String(CAPTION_MAX));
    }
    steps[1]?.toggleAttribute('completed', !empty);
  };

  /* `md-text-field`'s `mdInput` detail IS the bare string — unlike `md-search`,
     which carries `{ value }`. Two different components, two different shapes;
     assuming one from the other has cost this repo two silent bugs, one of
     which blanked a field and one of which set a filter to an object. */
  captionField?.addEventListener('mdInput', (event) => {
    caption = String(event.detail ?? '').slice(0, CAPTION_MAX);
    showCaption();
  });

  /* ------------------------------------------------------------ audience */

  for (const option of root.querySelectorAll('.composer__option')) {
    option.addEventListener('click', () => {
      for (const other of root.querySelectorAll('.composer__option')) {
        other.toggleAttribute('data-on', other === option);
      }
      audienceChip?.setAttribute('label', option.getAttribute('data-label') ?? '');
      audienceChip?.setAttribute('icon', option.getAttribute('data-icon') ?? '');
    });
  }

  /* ---------------------------------------------------------------- tags */

  root.querySelector('.composer__tags')?.addEventListener('mdSelect', (event) => {
    const chip = event.target;
    const id = chip?.dataset?.person;
    if (!id) return;
    const at = tagged.indexOf(id);
    if (event.detail?.selected && at === -1) tagged.push(id);
    else if (!event.detail?.selected && at !== -1) tagged.splice(at, 1);

    /* The names are the chips' own labels — proper nouns, identical in all
       three locales, and already on the elements. The separator is a comma,
       which is the one piece of punctuation this list needs; a translated
       conjunction would need a dictionary this module does not have, and the
       kit's `social.common.and` is not used by any of the five builds here. */
    if (taggedNames) {
      taggedNames.textContent = tagged
        .map((personId) =>
          root
            .querySelector(`.composer__tags md-chip[data-person="${personId}"]`)
            ?.getAttribute('label'),
        )
        .filter(Boolean)
        .join(', ');
    }
    taggedRow?.toggleAttribute('hidden', tagged.length === 0);
  });

  /* -------------------------------------------------------- the stepper */

  /*
   * THE VETO GOES ON `mdBeforeChange`, NOT `mdStepChange`.
   *
   * Only the first is cancelable — the second is the announcement that the move
   * has already happened, and `preventDefault()` on it does nothing at all.
   * Listening to the wrong one is silent: the wizard advances past an empty
   * step and no error is thrown.
   *
   * Refusing is `preventDefault()` rather than disabling Continue, so the reader
   * gets a stated reason instead of a dead control. Backwards is always allowed:
   * revisiting a completed step cannot invalidate anything.
   */
  stepper.addEventListener('mdBeforeChange', (event) => {
    const { index = 0, previous = 0 } = event.detail ?? {};
    if (index <= previous) return;
    if (previous === 0 && media === null) {
      event.preventDefault();
      raise(stepper.getAttribute('data-need-media'));
      return;
    }
    if (previous === 1 && caption.trim() === '') {
      event.preventDefault();
      raise(stepper.getAttribute('data-need-caption'));
    }
  });

  /* ---------------------------------------------------------- the finish */

  const reset = () => {
    media = null;
    caption = '';
    tagged.length = 0;
    for (const pick of root.querySelectorAll('.composer__pick')) {
      pick.removeAttribute('data-on');
      pick.setAttribute('aria-pressed', 'false');
    }
    for (const chip of root.querySelectorAll('.composer__tags md-chip')) {
      chip.removeAttribute('selected');
    }
    const first = root.querySelector('.composer__option');
    for (const option of root.querySelectorAll('.composer__option')) {
      option.toggleAttribute('data-on', option === first);
    }
    audienceChip?.setAttribute('label', first?.getAttribute('data-label') ?? '');
    audienceChip?.setAttribute('icon', first?.getAttribute('data-icon') ?? '');
    if (captionField) captionField.value = '';
    if (taggedNames) taggedNames.textContent = '';
    taggedRow?.setAttribute('hidden', '');
    stepper.setAttribute('active', '0');
    showMedia();
    showCaption();
  };

  const post = root.querySelector('.composer__post');
  post?.addEventListener('mdClick', () => {
    raise(post.getAttribute('data-msg'));
    reset();
  });
  root.querySelector('.composer__cancel')?.addEventListener('mdClick', reset);

  /* The preview starts empty and the two steps start incomplete; running both
     once puts the DOM into the state the rest of this module maintains, rather
     than trusting the markup to have said the same thing twice. */
  if (preview) {
    showMedia();
    showCaption();
  }
}
