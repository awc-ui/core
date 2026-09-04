/**
 * The composer — the form screen, and the one that argues back.
 *
 * FOUR STEPS IN A LINEAR STEPPER: pick a picture, write a caption, choose an
 * audience, check it. `md-stepper` in `linear` mode refuses to advance while a
 * step is invalid, which is the behaviour worth demonstrating — a wizard that
 * lets you reach the last step with nothing filled in and then says no is a
 * wizard that wasted four clicks.
 *
 * THERE IS NO FILE PICKER, AND THAT IS DELIBERATE. A static showcase cannot
 * accept a photograph, and an `<input type="file">` that took one and then
 * showed generated artwork instead would be the single dishonest control in the
 * app. So the first step PICKS from the fixture's own library and the panel
 * says so. `composerLibrary()` in the kit excludes the viewer's own posts, so
 * the grid is not their feed handed back to them.
 *
 * NOTHING IS EVER POSTED. The last step's button raises a snackbar and resets;
 * the fixture is frozen and a composer that appended to it would make the app
 * disagree with itself on the next reload. The preview is the deliverable.
 *
 * THIS IS THE ONE SCREEN THAT IS NOT COMPLETE WITHOUT JAVASCRIPT, and it cannot
 * be: a wizard is state. What the document carries is the whole form — every
 * step, every picture in the library, every audience option — and the preview
 * in its empty state, which is what the reader would see before touching
 * anything anyway. `src/client/create.mjs` supplies the four transitions.
 */

import {
  AUDIENCES,
  audienceIcon,
  composerLibrary,
  getTotals,
  getViewer,
  route,
  taggablePeople,
} from '@awc-ui/showcase-kit/social';
import { attrs, html } from '../lib/html.mjs';
import { avatar, media, personName } from '../lib/bits.mjs';
import { panel, screen, snackbar } from '../components/shell.mjs';

/** The caption field's cap. Long enough for prose, short enough to be a limit. */
const CAPTION_MAX = 280;

export function createScreen(t, locale) {
  const totals = getTotals();
  const viewer = getViewer();
  const library = composerLibrary(12);
  const people = taggablePeople();
  const first = AUDIENCES[0];

  return screen(t, {
    locale,
    here: route.create(),
    title: t('social.screen.create.title'),
    subtitle: t('social.screen.create.subtitle'),
    children: html`<div class="composer">
        <div class="composer__form">
          <!-- EVERY ONE OF THESE WORDS IS A PROP WITH AN ENGLISH DEFAULT, and
               the buttons they name live in the stepper's shadow root — so an
               unlabelled stepper renders "Continue" and "Back" under a Romanian
               heading and there is no CSS or markup anywhere to notice it from.

               mode, not variant: variant takes default or mobile, so
               variant="linear" was an invalid value the component ignored and
               the wizard was never linear. And the controlled prop is active;
               active-index is not a prop at all. -->
          <md-stepper${attrs({
            class: 'composer__stepper',
            mode: 'linear',
            active: '0',
            orientation: 'vertical',
            label: t('social.screen.create.title'),
            'step-word': t('social.stepper.step'),
            'of-word': t('social.stepper.of'),
            'completed-word': t('social.stepper.completed'),
            'current-word': t('social.stepper.current'),
            'error-word': t('social.stepper.error'),
            'optional-word': t('social.stepper.optional'),
            'next-label': t('social.stepper.next'),
            'back-label': t('social.stepper.back'),
            'finish-label': t('social.stepper.finish'),
            /* The two refusals, already translated. The client vetoes the move;
               it never composes the sentence explaining why. */
            'data-need-media': t('social.hint.needMedia'),
            'data-need-caption': t('social.hint.needCaption'),
          })}>
            <md-step${attrs({ label: t('social.panel.media'), icon: 'image' })}>
              <p class="muted">${t('social.hint.pickPicture')}</p>
              <ul class="composer__library">
                ${library.map(
                  (item) => html`<li>
                    <button type="button" class="composer__pick"${attrs({
                      'data-media': item.id,
                      'aria-pressed': 'false',
                      'aria-label': t(item.altKey),
                    })}>${media(t, item, { className: 'composer__thumb' })}</button>
                  </li>`,
                )}
              </ul>
            </md-step>

            <md-step${attrs({ label: t('social.panel.caption'), icon: 'edit' })}>
              <md-text-field${attrs({
                class: 'composer__caption',
                label: t('social.panel.caption'),
                multiline: true,
                rows: '4',
                'full-width': true,
                maxlength: String(CAPTION_MAX),
                'supporting-text': t('social.hint.captionLimit', { max: CAPTION_MAX }),
              })}></md-text-field>
              <!-- Another two-hole template refilled in place as the reader
                   types. "0 of 280 characters" is not that sentence in Arabic. -->
              <p class="muted composer__count"${attrs({
                'data-count-template': t('social.common.characters', {
                  count: '%count%',
                  max: '%max%',
                }),
              })}>${t('social.common.characters', { count: 0, max: CAPTION_MAX })}</p>
            </md-step>

            <md-step${attrs({ label: t('social.panel.audience'), icon: 'visibility', completed: true })}>
              <!-- A RADIO GROUP, NOT A SELECT. Four options, each of which needs
                   a sentence of explanation — a select shows one at a time and
                   hides the explanations behind it, which is the wrong shape for
                   a choice about who can see something. -->
              <div class="composer__audience"${attrs({
                role: 'radiogroup',
                'aria-label': t('social.panel.audience'),
              })}>
                ${AUDIENCES.map(
                  (option) => html`<label class="composer__option"${attrs({
                    'data-audience': option.value,
                    'data-label': t(option.labelKey),
                    'data-icon': audienceIcon[option.value],
                    'data-on': option.value === first.value,
                  })}>
                    <md-radio${attrs({
                      name: 'audience',
                      value: option.value,
                      checked: option.value === first.value,
                    })}></md-radio>
                    <span class="composer__option-text">
                      <span class="strong"><span class="material-symbols-outlined" aria-hidden="true">${
                        audienceIcon[option.value]
                      }</span>${t(option.labelKey)}</span>
                      <span class="muted">${t(option.hintKey, {
                        count: t.formatNumber(totals.followerCount),
                      })}</span>
                    </span>
                  </label>`,
                )}
              </div>

              <p class="muted">${t('social.hint.tapToTag')}</p>
              <div class="facet-row composer__tags">
                ${people.slice(0, 8).map(
                  (person) => html`<md-chip${attrs({
                    variant: 'filter',
                    appearance: 'outlined',
                    'data-person': person.id,
                    label: person.displayName,
                  })}></md-chip>`,
                )}
              </div>
            </md-step>

            <md-step${attrs({ label: t('social.panel.preview'), icon: 'task_alt' })}>
              <div class="row">
                <md-button${attrs({
                  class: 'composer__post',
                  variant: 'filled',
                  icon: 'send',
                  'data-msg': t('social.msg.posted'),
                })}>${t('social.action.post')}</md-button>
                <md-button${attrs({ class: 'composer__cancel', variant: 'text' })}>${t(
                  'social.action.cancel',
                )}</md-button>
              </div>
            </md-step>
          </md-stepper>
        </div>

        <!-- THE PREVIEW IS ALWAYS VISIBLE, not a fourth step you arrive at. It
             is the whole point of a composer: the reader is not filling in a
             form, they are making a thing, and they should be able to see the
             thing while they make it. It shows what is decided so far and says
             plainly what is not. -->
        <aside class="composer__preview">
          ${panel({
            title: t('social.panel.preview'),
            children: html`<article class="post-card">
              <header class="post-card__head">
                <span class="post-card__author">
                  ${avatar(t, viewer, { size: 'small' })}
                  <span class="post-card__names">
                    <!-- Not a link: this is a preview of a post that does not
                         exist yet, and a profile link inside it invites the
                         reader to navigate away mid-compose. -->
                    ${personName(t, viewer)}
                  </span>
                </span>
                <md-chip${attrs({
                  class: 'composer__audience-chip',
                  variant: 'assist',
                  appearance: 'outlined',
                  color: 'secondary',
                  icon: audienceIcon[first.value],
                  label: t(first.labelKey),
                })}></md-chip>
              </header>

              <!-- Every picture in the library is written here too, hidden, so
                   choosing one is an attribute flip rather than an img the
                   client has to build with a translated alt it does not have. -->
              ${library.map(
                (item) => html`<span class="composer__preview-media"${attrs({
                  'data-media': item.id,
                  hidden: true,
                })}>${media(t, item, { eager: false })}</span>`,
              )}
              <div class="composer__placeholder">
                <span class="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
                <p class="muted">${t('social.hint.needMedia')}</p>
              </div>

              <div class="post-card__body">
                <p class="post-card__caption">
                  <span class="post-card__handle">${viewer.handle}</span>
                  <!-- AN EXPLICIT SPACE. The Vue and Angular ports both collapse
                       a whitespace-only node between two elements, so both write
                       one deliberately; this build would keep the newline, and a
                       newline is not the same character. Writing it out is what
                       makes the five agree. -->
                  ${' '}
                  <span class="composer__caption-text muted">${t('social.hint.needCaption')}</span>
                </p>
                <p class="muted composer__tagged" hidden>
                  ${t('social.panel.tagged.short')}: <span class="composer__tagged-names"></span>
                </p>
              </div>
            </article>`,
          })}
        </aside>
      </div>

      ${snackbar(t)}`,
  });
}
