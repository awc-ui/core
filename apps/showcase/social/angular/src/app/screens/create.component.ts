import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
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
import { ShowcaseComponent } from '../lib/screen.base';
import { ScreenComponent } from '../components/screen.component';
import { PanelComponent } from '../components/panel.component';
import { PanelSkeletonComponent } from '../components/skeletons.component';
import { AvatarComponent, MediaComponent, PersonNameComponent } from '../components/bits.component';
import { SnackbarComponent, type SnackbarMessage } from './snackbar.component';

/** The caption field's cap. Long enough for prose, short enough to be a limit. */
const CAPTION_MAX = 280;

/**
 * The composer — the form screen, and the one that argues back.
 *
 * FOUR STEPS IN A LINEAR STEPPER: pick a picture, write a caption, choose an
 * audience, check it. `md-stepper` in `linear` mode refuses to advance while a
 * step is invalid.
 *
 * THREE THINGS ABOUT `md-stepper` THAT ARE EASY TO GET WRONG, all found by
 * pressing the buttons in the React port:
 *   · the mode prop is `mode`, not `variant` (`variant` is default | mobile);
 *   · the controlled index is `active`, not `active-index`;
 *   · the CANCELABLE event is `mdBeforeChange` — `mdStepChange` is the
 *     announcement that the move already happened.
 * And every one of its words — Continue, Back, Step, of — is an English default
 * rendered inside its shadow root, so they all have to be passed.
 *
 * THERE IS NO FILE PICKER, DELIBERATELY. A static showcase cannot accept a
 * photograph, and an `<input type="file">` that took one and then showed
 * generated artwork would be the single dishonest control in the app.
 *
 * NOTHING IS EVER POSTED. The last step raises a snackbar and resets.
 */
@Component({
  selector: 'awc-create-screen',
  standalone: true,
  imports: [
    ScreenComponent,
    PanelComponent,
    PanelSkeletonComponent,
    AvatarComponent,
    MediaComponent,
    PersonNameComponent,
    SnackbarComponent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styles: ':host { display: contents; }',
  template: `
    <awc-screen
      [title]="t('social.screen.create.title')"
      [subtitle]="t('social.screen.create.subtitle')"
      [customSkeleton]="true"
    >
      <awc-panel-skeleton skeleton height="600px" [lines]="6" />

      <div class="composer">
        <div class="composer__form">
          <md-stepper
            mode="linear"
            [attr.active]="step"
            orientation="vertical"
            [attr.label]="t('social.screen.create.title')"
            [attr.step-word]="t('social.stepper.step')"
            [attr.of-word]="t('social.stepper.of')"
            [attr.completed-word]="t('social.stepper.completed')"
            [attr.current-word]="t('social.stepper.current')"
            [attr.error-word]="t('social.stepper.error')"
            [attr.optional-word]="t('social.stepper.optional')"
            [attr.next-label]="t('social.stepper.next')"
            [attr.back-label]="t('social.stepper.back')"
            [attr.finish-label]="t('social.stepper.finish')"
            (mdBeforeChange)="onBeforeChange($any($event))"
            (mdStepChange)="step = $any($event).detail?.index ?? 0"
          >
            <md-step
              [attr.label]="t('social.panel.media')"
              icon="image"
              [attr.completed]="media ? '' : null"
            >
              <p class="muted">{{ t('social.hint.pickPicture') }}</p>
              <ul class="composer__library">
                @for (item of library; track item.id) {
                  <li>
                    <button
                      type="button"
                      class="composer__pick"
                      [attr.data-on]="media?.id === item.id ? '' : null"
                      [attr.aria-pressed]="media?.id === item.id"
                      [attr.aria-label]="t(item.altKey)"
                      (click)="media = item"
                    >
                      <awc-media [media]="item" className="composer__thumb" />
                    </button>
                  </li>
                }
              </ul>
            </md-step>

            <md-step
              [attr.label]="t('social.panel.caption')"
              icon="edit"
              [attr.completed]="caption.trim() !== '' ? '' : null"
            >
              <md-text-field
                [attr.label]="t('social.panel.caption')"
                [attr.value]="caption"
                multiline="fixed"
                rows="4"
                full-width
                [attr.maxlength]="captionMax"
                [attr.supporting-text]="t('social.hint.captionLimit', { max: captionMax })"
                (mdInput)="onCaption($any($event))"
              ></md-text-field>
              <p class="muted composer__count">
                {{ t('social.common.characters', { count: caption.length, max: captionMax }) }}
              </p>
            </md-step>

            <md-step [attr.label]="t('social.panel.audience')" icon="visibility" completed>
              <!-- A RADIO GROUP, NOT A SELECT. Four options, each needing a
                   sentence of explanation — a select shows one at a time and
                   hides the explanations behind it. -->
              <div
                class="composer__audience"
                role="radiogroup"
                [attr.aria-label]="t('social.panel.audience')"
              >
                @for (option of audiences; track option.value) {
                  <label class="composer__option" [attr.data-on]="audience === option.value ? '' : null">
                    <md-radio
                      name="audience"
                      [attr.value]="option.value"
                      [attr.checked]="audience === option.value ? '' : null"
                      (click)="audience = option.value"
                    ></md-radio>
                    <span class="composer__option-text">
                      <span class="strong">
                        <span class="material-symbols-outlined" aria-hidden="true">{{
                          icon(option.value)
                        }}</span>
                        {{ t(option.labelKey) }}
                      </span>
                      <span class="muted">{{
                        t(option.hintKey, { count: t.formatNumber(totals.followerCount) })
                      }}</span>
                    </span>
                  </label>
                }
              </div>

              <p class="muted">{{ t('social.hint.tapToTag') }}</p>
              <div class="facet-row">
                @for (person of people; track person.id) {
                  <md-chip
                    variant="filter"
                    appearance="outlined"
                    [attr.label]="person.displayName"
                    [attr.selected]="tagged.includes(person.id) ? '' : null"
                    (click)="toggleTag(person.id)"
                  ></md-chip>
                }
              </div>
            </md-step>

            <md-step [attr.label]="t('social.panel.preview')" icon="task_alt">
              <div class="row">
                <md-button variant="filled" icon="send" (mdClick)="publish()">
                  {{ t('social.action.post') }}
                </md-button>
                <md-button variant="text" (mdClick)="reset()">
                  {{ t('social.action.cancel') }}
                </md-button>
              </div>
            </md-step>
          </md-stepper>
        </div>

        <!-- THE PREVIEW IS ALWAYS VISIBLE, not a fourth step you arrive at. It
             is the whole point of a composer: the reader is not filling in a
             form, they are making a thing, and they should see it while they
             make it. -->
        <aside class="composer__preview">
          <awc-panel [title]="t('social.panel.preview')">
            <article class="post-card">
              <header class="post-card__head">
                <span class="post-card__author">
                  <awc-avatar [person]="viewer" size="small" />
                  <span class="post-card__names">
                    <!-- Not a link: this previews a post that does not exist
                         yet, and a profile link inside it invites the reader to
                         navigate away mid-compose. -->
                    <awc-person-name [person]="viewer" />
                  </span>
                </span>
                <md-chip
                  variant="assist"
                  appearance="outlined"
                  color="secondary"
                  [attr.icon]="icon(audience)"
                  [attr.label]="t(audienceLabelKey)"
                ></md-chip>
              </header>

              @if (media) {
                <awc-media [media]="media" [eager]="true" />
              } @else {
                <div class="composer__placeholder">
                  <span class="material-symbols-outlined" aria-hidden="true"
                    >add_photo_alternate</span
                  >
                  <p class="muted">{{ t('social.hint.needMedia') }}</p>
                </div>
              }

              <div class="post-card__body">
                <p class="post-card__caption">
                  <span class="post-card__handle">{{ viewer.handle }}</span>
                  <!-- AN EXPLICIT SPACE, and it has to be explicit. Angular
                       compiles with preserveWhitespaces off, which collapses the
                       whitespace-only node between two elements away entirely —
                       so the handle ran straight into the caption
                       ("mara.ilvesWrite a caption first"). Vue's condense mode
                       does the same thing and the React port writes a literal
                       space for the same reason. -->
                  {{ ' ' }}
                  @if (caption.trim() === '') {
                    <span class="muted">{{ t('social.hint.needCaption') }}</span>
                  } @else {
                    {{ caption }}
                  }
                </p>
                @if (tagged.length > 0) {
                  <p class="muted">{{ t('social.panel.tagged.short') }}: {{ taggedNames }}</p>
                }
              </div>
            </article>
          </awc-panel>
        </aside>
      </div>

      <awc-snackbar [message]="message" [onClose]="close" />
    </awc-screen>
  `,
})
export class CreateScreen extends ShowcaseComponent {
  protected readonly totals = getTotals();
  protected readonly viewer = getViewer();
  protected readonly library = composerLibrary(12);
  protected readonly people = taggablePeople().slice(0, 8);
  protected readonly audiences = AUDIENCES;
  protected readonly captionMax = CAPTION_MAX;

  protected step = 0;
  protected media: MediaRecord | null = null;
  protected caption = '';
  protected audience: Audience = 'public';
  protected tagged: string[] = [];

  protected message: SnackbarMessage | null = null;
  protected readonly close = () => {
    this.message = null;
  };

  protected icon(value: Audience) {
    return audienceIcon[value];
  }

  protected get audienceLabelKey() {
    return AUDIENCES.find((a) => a.value === this.audience)!.labelKey;
  }

  protected get taggedNames() {
    return this.tagged
      .map((id) => taggablePeople().find((p) => p.id === id)?.displayName)
      .filter(Boolean)
      .join(', ');
  }

  protected onCaption(event: CustomEvent<string>) {
    this.caption = String(event.detail ?? '').slice(0, CAPTION_MAX);
  }

  /* THE VETO. Backwards is always allowed: revisiting a completed step cannot
     invalidate anything. Refusing is `preventDefault()` rather than disabling
     Continue, so the reader gets a stated reason instead of a dead control. */
  protected onBeforeChange(event: CustomEvent<{ index: number; previous: number }>) {
    const { index, previous } = event.detail ?? { index: 0, previous: 0 };
    if (index <= previous) return;
    if (previous === 0 && this.media === null) {
      event.preventDefault();
      this.message = { key: 'social.hint.needMedia' };
      return;
    }
    if (previous === 1 && this.caption.trim() === '') {
      event.preventDefault();
      this.message = { key: 'social.hint.needCaption' };
    }
  }

  protected toggleTag(id: string) {
    this.tagged = this.tagged.includes(id)
      ? this.tagged.filter((x) => x !== id)
      : [...this.tagged, id];
  }

  protected publish() {
    this.message = { key: 'social.msg.posted' };
    this.reset();
  }

  protected reset() {
    this.step = 0;
    this.media = null;
    this.caption = '';
    this.audience = 'public';
    this.tagged = [];
  }
}
