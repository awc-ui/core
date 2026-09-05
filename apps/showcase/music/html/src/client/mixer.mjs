/**
 * The mixer's presses, and the rule they demonstrate.
 *
 * `audibleTracks()` FROM THE KIT DECIDES WHAT IS SILENT, not this file. Solo
 * and mute do not compose symmetrically — any solo silences every unsoloed
 * track, and an explicitly muted one stays silent regardless — and that rule
 * lives in one place so five builds cannot each get it slightly different.
 *
 * NOTHING IS TRANSLATED HERE. Both spellings of every label and every sentence
 * were written onto the elements at build time.
 */
import { audibleTracks, muteIcon, panPosition, volumeDb } from '@awc-ui/showcase-kit/music';
import { claimAll } from './claim.mjs';
import { raise } from './snackbar.mjs';

/*
 * THESE LISTEN FOR `click`, NOT `mdClick`.
 *
 * `mdClick` is raised by the real `<button>` inside the component's shadow
 * root, so it fires for a reader's press and NOT for `element.click()` on the
 * host. The native `click` is composed and crosses the shadow boundary, so it
 * covers both — which matters because the browser suite presses by calling
 * `click()`, and a control wired to `mdClick` alone looks completely inert to
 * it while working perfectly for a person. That asymmetry is exactly the kind
 * of thing a test suite exists to rule out, so the build takes the event both
 * can raise.
 */
export function enhanceMixer(root = document) {
  const strips = [...root.querySelectorAll('.strip[data-track]')];
  if (strips.length === 0) return;

  /* The flags live on the ELEMENTS, which is this build's equivalent of a store
     — there is nowhere else to put them and no reason to invent one. */
  const state = strips.map((strip) => ({
    strip,
    id: strip.getAttribute('data-track'),
    muted: false,
    soloed: false,
  }));

  function render() {
    const audible = audibleTracks(state.map((s) => ({ id: s.id, muted: s.muted, soloed: s.soloed })));
    for (const entry of state) {
      const heard = audible.has(entry.id);
      entry.strip.toggleAttribute('data-silent', !heard);

      const mute = entry.strip.querySelector('.strip__mute');
      mute?.setAttribute('icon', muteIcon(heard));
      mute?.setAttribute('aria-pressed', String(entry.muted));
      mute?.toggleAttribute('data-on', entry.muted);
      mute?.setAttribute('aria-label', mute.getAttribute(entry.muted ? 'data-label-unmute' : 'data-label-mute') ?? '');
      if (entry.muted) mute?.setAttribute('color', 'error');
      else mute?.removeAttribute('color');

      const solo = entry.strip.querySelector('.strip__solo');
      solo?.setAttribute('aria-pressed', String(entry.soloed));
      solo?.toggleAttribute('data-on', entry.soloed);
      solo?.setAttribute('aria-label', solo.getAttribute(entry.soloed ? 'data-label-unsolo' : 'data-label-solo') ?? '');
      if (entry.soloed) solo?.setAttribute('color', 'primary');
      else solo?.removeAttribute('color');

      /* The screen-reader line has to agree with the dimming, and both come
         from the same derived answer. */
      const word = entry.strip.querySelector('.visually-hidden');
      if (word) {
        const label = word.getAttribute(heard ? 'data-audible' : 'data-inaudible');
        if (label) word.textContent = `${label} — ${word.textContent.split('—').pop()?.trim() ?? ''}`;
      }
    }
  }

  /*
   * THE FADERS AND THE PAN, whose readouts have to be recomputed on the spot.
   *
   * This is the ONE place the build's "no formatting in the client" rule bends,
   * and only as far as the kit allows: `volumeDb` and `panPosition` are the
   * same functions the other four call, and the WORDS around the numbers —
   * "Silent", "Left", "dB" — are read off the readout's own data attributes,
   * written by the build in the page's language. The client still composes no
   * sentence of its own.
   */
  for (const entry of state) {
    const readouts = entry.strip.querySelectorAll('.strip__readout');
    const volumeOut = readouts[0];
    const panOut = readouts[1];

    entry.strip.querySelector('.strip__fader')?.addEventListener('mdInput', (event) => {
      const value = Number(event.detail?.value ?? 0) / 100;
      const db = volumeDb(value);
      if (!volumeOut) return;
      volumeOut.textContent =
        db === null
          ? volumeOut.getAttribute('data-silent') ?? ''
          : (volumeOut.getAttribute('data-db') ?? '{value}').replace(
              '{value}',
              new Intl.NumberFormat(document.documentElement.lang || 'en', {
                maximumFractionDigits: 1,
              }).format(db),
            );
    });

    entry.strip.querySelector('.strip__pan')?.addEventListener('mdInput', (event) => {
      const value = Number(event.detail?.value ?? 0) / 100;
      const at = panPosition(value);
      if (!panOut) return;
      const amount = new Intl.NumberFormat(document.documentElement.lang || 'en').format(at.amount);
      panOut.textContent =
        at.side === 'centre'
          ? panOut.getAttribute('data-centre') ?? ''
          : (panOut.getAttribute(at.side === 'left' ? 'data-left' : 'data-right') ?? '{amount}').replace(
              '{amount}',
              amount,
            );
    });

    entry.strip.querySelector('.strip__mute')?.addEventListener('click', (event) => {
      entry.muted = !entry.muted;
      render();
      raise(event.currentTarget.getAttribute(entry.muted ? 'data-msg-muted' : 'data-msg-unmuted'));
    });
    entry.strip.querySelector('.strip__solo')?.addEventListener('click', (event) => {
      entry.soloed = !entry.soloed;
      render();
      raise(event.currentTarget.getAttribute(entry.soloed ? 'data-msg-soloed' : 'data-msg-unsoloed'));
    });
  }

  render();
}

/** The like buttons in every track list, and on the track drill. */
export function enhanceLikes(root = document) {
  for (const button of claimAll(root, '.track-row__like, .track__like', 'like')) {
    button.addEventListener('click', () => {
      const liked = !button.hasAttribute('data-liked');
      button.toggleAttribute('data-liked', liked);
      button.toggleAttribute('selected', liked);
      button.setAttribute('icon', liked ? 'favorite' : 'favorite_border');
      const label = button.getAttribute(liked ? 'data-label-unlike' : 'data-label-like');
      if (label) button.setAttribute('aria-label', label);
      if (button.classList.contains('track__like')) {
        button.setAttribute('variant', liked ? 'tonal' : 'outlined');
        button.textContent = button.getAttribute(liked ? 'data-label-unlike' : 'data-label-like') ?? '';
      }
      raise(button.getAttribute(liked ? 'data-msg-liked' : 'data-msg-unliked'));
    });
  }
}

/** The follow button on an artist. One press, both states pre-written. */
export function enhanceFollow(root = document) {
  for (const button of claimAll(root, '.artist__follow', 'follow')) {
    button.addEventListener('click', () => {
      const followed = !button.hasAttribute('data-followed');
      button.toggleAttribute('data-followed', followed);
      button.setAttribute('variant', followed ? 'outlined' : 'filled');
      button.setAttribute('icon', followed ? 'check' : 'person_add');
      button.textContent = button.getAttribute(followed ? 'data-label-unfollow' : 'data-label-follow') ?? '';
      raise(button.getAttribute(followed ? 'data-msg-followed' : 'data-msg-unfollowed'));
    });
  }
}
