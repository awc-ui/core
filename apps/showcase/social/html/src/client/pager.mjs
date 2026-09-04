/**
 * The pager over a post's pictures.
 *
 * EVERY PICTURE IS ALREADY IN THE DOCUMENT and all but the first carry
 * `hidden`, so paging is an attribute flip on elements that exist rather than
 * an `<img>` this module would have to build — which would mean knowing each
 * picture's URL, its aspect ratio and its TRANSLATED alt text in a script that
 * has no dictionary. Same reason the labels travel as data attributes
 * everywhere else in this build.
 *
 * The buttons are `soft-disabled` at the ends rather than `disabled`: a
 * disabled control leaves the tab order, so tabbing across a carousel at its
 * last picture would silently skip the button that comes back.
 */

export function enhancePager(root = document) {
  for (const frame of root.querySelectorAll('.post-media[data-total]:not([data-bound])')) {
    const total = Number(frame.getAttribute('data-total'));
    if (!Number.isFinite(total) || total < 2) continue;
    frame.setAttribute('data-bound', '');

    const frames = [...frame.querySelectorAll('.post-media__frame')];
    const dots = [...frame.querySelectorAll('.post-media__dot')];
    const status = frame.querySelector('[data-count-template]');
    const prev = frame.querySelector('.post-media__nav--prev');
    const next = frame.querySelector('.post-media__nav--next');
    let index = 0;

    const show = (to) => {
      index = Math.max(0, Math.min(total - 1, to));
      frames.forEach((el, i) => el.toggleAttribute('hidden', i !== index));
      dots.forEach((el, i) => el.toggleAttribute('data-on', i === index));
      prev?.toggleAttribute('soft-disabled', index === 0);
      next?.toggleAttribute('soft-disabled', index === total - 1);

      /* The "%index% of %total%" sentence was written by the build in the page's
         language; only the two numbers are filled in. They are plain digits
         rather than locale-formatted ones because a carousel index never
         reaches the thousands separator that would make the difference. */
      const template = status?.getAttribute('data-count-template');
      if (status && template) {
        status.textContent = template
          .replace('%index%', String(index + 1))
          .replace('%total%', String(total));
      }
    };

    prev?.addEventListener('mdClick', () => show(index - 1));
    next?.addEventListener('mdClick', () => show(index + 1));
  }
}
