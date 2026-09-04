<!--
  The composer — the form screen, and the one that argues back.

  FOUR STEPS IN A LINEAR STEPPER: pick a picture, write a caption, choose an
  audience, check it. `md-stepper` in `linear` mode refuses to advance while a
  step is invalid, which is the behaviour worth demonstrating.

  THREE THINGS ABOUT `md-stepper` THAT ARE EASY TO GET WRONG, all found by
  pressing the buttons in the React port:
    · the mode prop is `mode`, not `variant` (`variant` is default | mobile);
    · the controlled index is `active`, not `active-index`;
    · the CANCELABLE event is `mdBeforeChange` — `mdStepChange` is the
      announcement that the move already happened.
  And every one of its words — Continue, Back, Step, of — is an English default
  rendered inside its shadow root, so they all have to be passed.

  THERE IS NO FILE PICKER, DELIBERATELY. A static showcase cannot accept a
  photograph, and an `<input type="file">` that took one and then showed
  generated artwork would be the single dishonest control in the app.

  NOTHING IS EVER POSTED. The last step raises a snackbar and resets.
-->
<script lang="ts">
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
  import { t } from '$lib/showcase';
  import Screen from '$lib/components/Screen.svelte';
  import Panel from '$lib/components/Panel.svelte';
  import PanelSkeleton from '$lib/skeletons/PanelSkeleton.svelte';
  import Avatar from '$lib/bits/Avatar.svelte';
  import Media from '$lib/bits/Media.svelte';
  import PersonName from '$lib/bits/PersonName.svelte';
  import SnackbarHost from './SnackbarHost.svelte';
  import { createSnackbar } from './snackbar';

  /** The caption field's cap. Long enough for prose, short enough to be a limit. */
  const CAPTION_MAX = 280;

  const totals = getTotals();
  const viewer = getViewer();
  const library = composerLibrary(12);
  const people = taggablePeople();
  const { message, say, close } = createSnackbar();

  let step = 0;
  let media: MediaRecord | null = null;
  let caption = '';
  let audience: Audience = 'public';
  let tagged: string[] = [];

  $: audienceSpec = AUDIENCES.find((a) => a.value === audience)!;
  $: taggedNames = tagged
    .map((id) => people.find((p) => p.id === id)?.displayName)
    .filter(Boolean)
    .join(', ');

  function onCaption(event: CustomEvent<string>) {
    caption = String(event.detail ?? '').slice(0, CAPTION_MAX);
  }

  /* THE VETO. Backwards is always allowed: revisiting a completed step cannot
     invalidate anything. Refusing is `preventDefault()` rather than disabling
     Continue, so the reader gets a stated reason instead of a dead control. */
  function onBeforeChange(event: CustomEvent<{ index: number; previous: number }>) {
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
  }

  function reset() {
    step = 0;
    media = null;
    caption = '';
    audience = 'public';
    tagged = [];
  }

  function toggleTag(id: string) {
    tagged = tagged.includes(id) ? tagged.filter((x) => x !== id) : [...tagged, id];
  }
</script>

<Screen title={$t('social.screen.create.title')} subtitle={$t('social.screen.create.subtitle')}>
  <svelte:fragment slot="skeleton"><PanelSkeleton height="600px" lines={6} /></svelte:fragment>

  <div class="composer">
    <div class="composer__form">
      <md-stepper
        on:mdBeforeChange={onBeforeChange}
        on:mdStepChange={(e) => (step = e.detail?.index ?? 0)}
        mode="linear"
        active={step}
        orientation="vertical"
        label={$t('social.screen.create.title')}
        step-word={$t('social.stepper.step')}
        of-word={$t('social.stepper.of')}
        completed-word={$t('social.stepper.completed')}
        current-word={$t('social.stepper.current')}
        error-word={$t('social.stepper.error')}
        optional-word={$t('social.stepper.optional')}
        next-label={$t('social.stepper.next')}
        back-label={$t('social.stepper.back')}
        finish-label={$t('social.stepper.finish')}
      >
        <md-step
          label={$t('social.panel.media')}
          icon="image"
          completed={media !== null || undefined}
        >
          <p class="muted">{$t('social.hint.pickPicture')}</p>
          <ul class="composer__library">
            {#each library as item (item.id)}
              <li>
                <button
                  type="button"
                  class="composer__pick"
                  data-on={media?.id === item.id ? '' : undefined}
                  aria-pressed={media?.id === item.id}
                  aria-label={$t(item.altKey)}
                  on:click={() => (media = item)}
                >
                  <Media media={item} className="composer__thumb" />
                </button>
              </li>
            {/each}
          </ul>
        </md-step>

        <md-step
          label={$t('social.panel.caption')}
          icon="edit"
          completed={caption.trim() !== '' || undefined}
        >
          <md-text-field
            on:mdInput={onCaption}
            label={$t('social.panel.caption')}
            value={caption}
            multiline="fixed"
            rows="4"
            full-width
            maxlength={CAPTION_MAX}
            supporting-text={$t('social.hint.captionLimit', { max: CAPTION_MAX })}
          ></md-text-field>
          <p class="muted composer__count">
            {$t('social.common.characters', { count: caption.length, max: CAPTION_MAX })}
          </p>
        </md-step>

        <md-step label={$t('social.panel.audience')} icon="visibility" completed>
          <!-- A RADIO GROUP, NOT A SELECT. Four options, each needing a sentence
               of explanation — a select shows one at a time and hides the
               explanations behind it. -->
          <div class="composer__audience" role="radiogroup" aria-label={$t('social.panel.audience')}>
            {#each AUDIENCES as option (option.value)}
              <label class="composer__option" data-on={audience === option.value ? '' : undefined}>
                <md-radio
                  name="audience"
                  value={option.value}
                  checked={audience === option.value || undefined}
                  on:click={() => (audience = option.value)}
                ></md-radio>
                <span class="composer__option-text">
                  <span class="strong">
                    <span class="material-symbols-outlined" aria-hidden="true">
                      {audienceIcon[option.value]}
                    </span>
                    {$t(option.labelKey)}
                  </span>
                  <span class="muted">
                    {$t(option.hintKey, { count: $t.formatNumber(totals.followerCount) })}
                  </span>
                </span>
              </label>
            {/each}
          </div>

          <p class="muted">{$t('social.hint.tapToTag')}</p>
          <div class="facet-row">
            {#each people.slice(0, 8) as person (person.id)}
              <md-chip
                variant="filter"
                appearance="outlined"
                label={person.displayName}
                selected={tagged.includes(person.id) || undefined}
                on:click={() => toggleTag(person.id)}
              ></md-chip>
            {/each}
          </div>
        </md-step>

        <md-step label={$t('social.panel.preview')} icon="task_alt">
          <div class="row">
            <md-button
              on:mdClick={() => { say('social.msg.posted'); reset(); }}
              variant="filled"
              icon="send"
            >
              {$t('social.action.post')}
            </md-button>
            <md-button on:mdClick={reset} variant="text">
              {$t('social.action.cancel')}
            </md-button>
          </div>
        </md-step>
      </md-stepper>
    </div>

    <!-- THE PREVIEW IS ALWAYS VISIBLE, not a fourth step you arrive at. It is
         the whole point of a composer: the reader is not filling in a form,
         they are making a thing, and they should see it while they make it. -->
    <aside class="composer__preview">
      <Panel title={$t('social.panel.preview')}>
        <article class="post-card">
          <header class="post-card__head">
            <span class="post-card__author">
              <Avatar person={viewer} size="small" />
              <span class="post-card__names">
                <!-- Not a link: this previews a post that does not exist yet,
                     and a profile link inside it invites the reader to navigate
                     away mid-compose. -->
                <PersonName person={viewer} />
              </span>
            </span>
            <md-chip
              variant="assist"
              appearance="outlined"
              color="secondary"
              icon={audienceIcon[audience]}
              label={$t(audienceSpec.labelKey)}
            ></md-chip>
          </header>

          {#if media}
            <Media {media} eager />
          {:else}
            <div class="composer__placeholder">
              <span class="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
              <p class="muted">{$t('social.hint.needMedia')}</p>
            </div>
          {/if}

          <div class="post-card__body">
            <p class="post-card__caption">
              <span class="post-card__handle">{viewer.handle}</span>
              {#if caption.trim() === ''}
                <span class="muted">{$t('social.hint.needCaption')}</span>
              {:else}{caption}{/if}
            </p>
            {#if tagged.length > 0}
              <p class="muted">{$t('social.panel.tagged.short')}: {taggedNames}</p>
            {/if}
          </div>
        </article>
      </Panel>
    </aside>
  </div>

  <SnackbarHost message={$message} on:close={close} />
</Screen>
