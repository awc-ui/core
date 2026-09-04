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
 */

import { useRef, useState } from 'react';
import {
  AUDIENCES,
  audienceIcon,
  composerLibrary,
  getTotals,
  getViewer,
  taggablePeople,
  type Audience,
  type Media as MediaRecord,
} from '@awc-ui/showcase-kit/social';
import { useT } from '@/lib/showcase';
import { useCustomEvent } from '@/components/elements';
import { Panel, Screen } from '@/components/Shell';
import { Avatar, Media, PersonName } from '@/components/bits';
import { PanelSkeleton } from '@/components/skeletons';
import { Snackbar, useSnackbar } from './Snackbar';

/** The caption field's cap. Long enough for prose, short enough to be a limit. */
const CAPTION_MAX = 280;

export function CreateScreen() {
  const t = useT();
  const totals = getTotals();
  const viewer = getViewer();
  const { message, say, close } = useSnackbar();

  const library = composerLibrary(12);
  const people = taggablePeople();

  const [step, setStep] = useState(0);
  const [media, setMedia] = useState<MediaRecord | null>(null);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<Audience>('public');
  const [tagged, setTagged] = useState<string[]>([]);

  const captionRef = useRef<HTMLElement | null>(null);
  /* `md-text-field`'s `mdInput` detail IS the bare string — unlike `md-search`,
     which carries `{ value }`. Two different components, two different shapes;
     assuming one from the other has cost this repo two silent bugs, one of
     which blanked a field and one of which set a filter to an object. */
  useCustomEvent<CustomEvent<string>>(captionRef, 'mdInput', (event) =>
    setCaption(String(event.detail ?? '').slice(0, CAPTION_MAX)),
  );

  const stepperRef = useRef<HTMLElement | null>(null);
  /*
   * THE VETO GOES ON `mdBeforeChange`, NOT `mdStepChange`.
   *
   * Only the first is `cancelable` — the second is the announcement that the
   * move has already happened, and `preventDefault()` on it does nothing at
   * all. Listening to the wrong one is silent: the wizard advances past an
   * empty step and no error is thrown. Found by `scripts/verify-browser.mjs`,
   * which is the only check that presses the button.
   *
   * Refusing is `preventDefault()` rather than disabling Continue, so the
   * reader gets a stated reason instead of a dead control. Backwards is always
   * allowed: revisiting a completed step cannot invalidate anything.
   */
  useCustomEvent<CustomEvent<{ index: number; previous: number }>>(
    stepperRef,
    'mdBeforeChange',
    (event) => {
      const { index, previous } = event.detail ?? { index: 0, previous: 0 };
      if (index <= previous) return;
      if (previous === 0 && media === null) {
        event.preventDefault();
        say('social.hint.needMedia');
        return;
      }
      if (previous === 1 && caption.trim() === '') {
        event.preventDefault();
        say('social.hint.needCaption');
      }
    },
  );

  /* And the move itself, once the stepper has decided to make it. */
  useCustomEvent<CustomEvent<{ index: number }>>(stepperRef, 'mdStepChange', (event) =>
    setStep(event.detail?.index ?? 0),
  );

  const reset = () => {
    setStep(0);
    setMedia(null);
    setCaption('');
    setAudience('public');
    setTagged([]);
  };

  const audienceSpec = AUDIENCES.find((a) => a.value === audience)!;

  return (
    <Screen
      title={t('social.screen.create.title')}
      subtitle={t('social.screen.create.subtitle')}
      skeleton={<PanelSkeleton height="600px" lines={6} />}
    >
      <div className="composer">
        <div className="composer__form">
          {/*
            EVERY ONE OF THESE WORDS IS A PROP WITH AN ENGLISH DEFAULT, and the
            buttons they name live in the stepper's shadow root — so an
            unlabelled stepper renders "Continue" and "Back" under a Romanian
            heading and there is no CSS or markup anywhere to notice it from.
            Same class of trap as a chart's `label-plot`.

            `mode`, not `variant`: `variant` takes default | mobile, so
            `variant="linear"` was an invalid value the component ignored — the
            wizard was never linear. And the controlled prop is `active`;
            `active-index` is not a prop at all, so the stepper was running
            uncontrolled while this file believed it was driving it.
          */}
          <md-stepper
            ref={stepperRef}
            mode="linear"
            active={step}
            orientation="vertical"
            label={t('social.screen.create.title')}
            step-word={t('social.stepper.step')}
            of-word={t('social.stepper.of')}
            completed-word={t('social.stepper.completed')}
            current-word={t('social.stepper.current')}
            error-word={t('social.stepper.error')}
            optional-word={t('social.stepper.optional')}
            next-label={t('social.stepper.next')}
            back-label={t('social.stepper.back')}
            finish-label={t('social.stepper.finish')}
          >
            {/* ---------------------------------------------------- step 1 */}
            <md-step label={t('social.panel.media')} icon="image" completed={media !== null || undefined}>
              <p className="muted">{t('social.hint.pickPicture')}</p>
              <ul className="composer__library">
                {library.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="composer__pick"
                      data-on={media?.id === item.id ? '' : undefined}
                      aria-pressed={media?.id === item.id}
                      aria-label={t(item.altKey)}
                      onClick={() => setMedia(item)}
                    >
                      <Media media={item} className="composer__thumb" />
                    </button>
                  </li>
                ))}
              </ul>
            </md-step>

            {/* ---------------------------------------------------- step 2 */}
            <md-step
              label={t('social.panel.caption')}
              icon="edit"
              completed={caption.trim() !== '' || undefined}
            >
              <md-text-field
                ref={captionRef}
                label={t('social.panel.caption')}
                value={caption}
                multiline
                rows="4"
                full-width
                maxlength={CAPTION_MAX}
                supporting-text={t('social.hint.captionLimit', { max: CAPTION_MAX })}
              />
              <p className="muted composer__count">
                {t('social.common.characters', { count: caption.length, max: CAPTION_MAX })}
              </p>
            </md-step>

            {/* ---------------------------------------------------- step 3 */}
            <md-step label={t('social.panel.audience')} icon="visibility" completed>
              {/*
                A RADIO GROUP, NOT A SELECT. Four options, each of which needs a
                sentence of explanation — a select shows one at a time and hides
                the explanations behind it, which is the wrong shape for a
                choice about who can see something.
              */}
              <div className="composer__audience" role="radiogroup" aria-label={t('social.panel.audience')}>
                {AUDIENCES.map((option) => (
                  <label key={option.value} className="composer__option" data-on={audience === option.value ? '' : undefined}>
                    <md-radio
                      name="audience"
                      value={option.value}
                      checked={audience === option.value || undefined}
                      onClick={() => setAudience(option.value)}
                    />
                    <span className="composer__option-text">
                      <span className="strong">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {audienceIcon[option.value]}
                        </span>
                        {t(option.labelKey)}
                      </span>
                      <span className="muted">
                        {t(option.hintKey, { count: t.formatNumber(totals.followerCount) })}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <p className="muted">{t('social.hint.tapToTag')}</p>
              <div className="facet-row">
                {people.slice(0, 8).map((person) => (
                  <md-chip
                    key={person.id}
                    variant="filter"
                    appearance="outlined"
                    label={person.displayName}
                    selected={tagged.includes(person.id) || undefined}
                    onClick={() =>
                      setTagged((prev) =>
                        prev.includes(person.id)
                          ? prev.filter((id) => id !== person.id)
                          : [...prev, person.id],
                      )
                    }
                  />
                ))}
              </div>
            </md-step>

            {/* ---------------------------------------------------- step 4 */}
            <md-step label={t('social.panel.preview')} icon="task_alt">
              <div className="row">
                <md-button
                  variant="filled"
                  icon="send"
                  onClick={() => {
                    say('social.msg.posted');
                    reset();
                  }}
                >
                  {t('social.action.post')}
                </md-button>
                <md-button variant="text" onClick={reset}>
                  {t('social.action.cancel')}
                </md-button>
              </div>
            </md-step>
          </md-stepper>
        </div>

        {/*
          THE PREVIEW IS ALWAYS VISIBLE, not a fourth step you arrive at. It is
          the whole point of a composer: the reader is not filling in a form,
          they are making a thing, and they should be able to see the thing
          while they make it. It shows what is decided so far and says plainly
          what is not.
        */}
        <aside className="composer__preview">
          <Panel title={t('social.panel.preview')}>
            <article className="post-card">
              <header className="post-card__head">
                <span className="post-card__author">
                  <Avatar person={viewer} size="small" />
                  <span className="post-card__names">
                    {/* Not a link: this is a preview of a post that does not
                        exist yet, and a profile link inside it invites the
                        reader to navigate away mid-compose. */}
                    <PersonName person={viewer} />
                  </span>
                </span>
                <md-chip
                  variant="assist"
                  appearance="outlined"
                  color="secondary"
                  icon={audienceIcon[audience]}
                  label={t(audienceSpec.labelKey)}
                />
              </header>

              {media ? (
                <Media media={media} eager />
              ) : (
                <div className="composer__placeholder">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add_photo_alternate
                  </span>
                  <p className="muted">{t('social.hint.needMedia')}</p>
                </div>
              )}

              <div className="post-card__body">
                <p className="post-card__caption">
                  <span className="post-card__handle">{viewer.handle}</span>{' '}
                  {caption.trim() === '' ? (
                    <span className="muted">{t('social.hint.needCaption')}</span>
                  ) : (
                    caption
                  )}
                </p>
                {tagged.length > 0 ? (
                  <p className="muted">
                    {t('social.panel.tagged.short')}:{' '}
                    {tagged
                      .map((id) => people.find((p) => p.id === id)?.displayName)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                ) : null}
              </div>
            </article>
          </Panel>
        </aside>
      </div>

      <Snackbar message={message} onClose={close} />
    </Screen>
  );
}
