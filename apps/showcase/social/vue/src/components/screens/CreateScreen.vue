<!--
  The composer — the form screen, and the one that argues back.

  FOUR STEPS IN A LINEAR STEPPER: pick a picture, write a caption, choose an
  audience, check it. `md-stepper` in `linear` mode refuses to advance while a
  step is invalid, which is the behaviour worth demonstrating — a wizard that
  lets you reach the last step with nothing filled in and THEN says no has
  wasted four clicks.

  THREE THINGS ABOUT `md-stepper` THAT ARE EASY TO GET WRONG, all found by
  pressing the buttons in the React port:
    · the mode prop is `mode`, not `variant` (`variant` is default | mobile);
    · the controlled index is `active`, not `active-index`;
    · the CANCELABLE event is `mdBeforeChange` — `mdStepChange` is the
      announcement that the move already happened, and `preventDefault()` on it
      does nothing at all.
  And every one of its words — Continue, Back, Step, of — is an English default
  rendered inside its shadow root, so they all have to be passed.

  THERE IS NO FILE PICKER, DELIBERATELY. A static showcase cannot accept a
  photograph, and an `<input type="file">` that took one and then showed
  generated artwork would be the single dishonest control in the app.

  NOTHING IS EVER POSTED. The last step raises a snackbar and resets; the
  fixture is frozen. The preview is the deliverable.
-->
<script setup lang="ts">
import { computed, ref } from 'vue';
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
import { useT } from '~/composables/useShowcase';
import Screen from '~/components/Screen.vue';
import Panel from '~/components/Panel.vue';
import PanelSkeleton from '~/components/skeletons/PanelSkeleton.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Media from '~/components/bits/Media.vue';
import PersonName from '~/components/bits/PersonName.vue';
import SnackbarHost from './SnackbarHost.vue';
import { useSnackbar } from './useSnackbar';

/** The caption field's cap. Long enough for prose, short enough to be a limit. */
const CAPTION_MAX = 280;

const t = useT();
const totals = getTotals();
const viewer = getViewer();
const { message, say, close } = useSnackbar();

const library = composerLibrary(12);
const people = taggablePeople();

const step = ref(0);
const media = ref<MediaRecord | null>(null);
const caption = ref('');
const audience = ref<Audience>('public');
const tagged = ref<string[]>([]);

const audienceSpec = computed(() => AUDIENCES.find((a) => a.value === audience.value)!);
const taggedNames = computed(() =>
  tagged.value.map((id) => people.find((p) => p.id === id)?.displayName).filter(Boolean).join(', '),
);

const captionListeners = {
  mdInput: (event: CustomEvent<string>) => {
    caption.value = String(event.detail ?? '').slice(0, CAPTION_MAX);
  },
};

const stepperListeners = {
  /* THE VETO. Backwards is always allowed: revisiting a completed step cannot
     invalidate anything. Refusing is `preventDefault()` rather than disabling
     Continue, so the reader gets a stated reason instead of a dead control. */
  mdBeforeChange: (event: CustomEvent<{ index: number; previous: number }>) => {
    const { index, previous } = event.detail ?? { index: 0, previous: 0 };
    if (index <= previous) return;
    if (previous === 0 && media.value === null) {
      event.preventDefault();
      say('social.hint.needMedia');
      return;
    }
    if (previous === 1 && caption.value.trim() === '') {
      event.preventDefault();
      say('social.hint.needCaption');
    }
  },
  mdStepChange: (event: CustomEvent<{ index: number }>) => {
    step.value = event.detail?.index ?? 0;
  },
};

function reset() {
  step.value = 0;
  media.value = null;
  caption.value = '';
  audience.value = 'public';
  tagged.value = [];
}

const postListeners = { mdClick: () => { say('social.msg.posted'); reset(); } };
const cancelListeners = { mdClick: () => reset() };

function toggleTag(id: string) {
  tagged.value = tagged.value.includes(id)
    ? tagged.value.filter((x) => x !== id)
    : [...tagged.value, id];
}
</script>

<template>
  <Screen :title="t('social.screen.create.title')" :subtitle="t('social.screen.create.subtitle')">
    <template #skeleton><PanelSkeleton height="600px" :lines="6" /></template>

    <div class="composer">
      <div class="composer__form">
        <md-stepper
          v-awc="{ on: stepperListeners }"
          mode="linear"
          :active="step"
          orientation="vertical"
          :label="t('social.screen.create.title')"
          :step-word="t('social.stepper.step')"
          :of-word="t('social.stepper.of')"
          :completed-word="t('social.stepper.completed')"
          :current-word="t('social.stepper.current')"
          :error-word="t('social.stepper.error')"
          :optional-word="t('social.stepper.optional')"
          :next-label="t('social.stepper.next')"
          :back-label="t('social.stepper.back')"
          :finish-label="t('social.stepper.finish')"
        >
          <md-step
            :label="t('social.panel.media')"
            icon="image"
            :completed="media !== null || undefined"
          >
            <p class="muted">{{ t('social.hint.pickPicture') }}</p>
            <ul class="composer__library">
              <li v-for="item in library" :key="item.id">
                <button
                  type="button"
                  class="composer__pick"
                  :data-on="media?.id === item.id ? '' : undefined"
                  :aria-pressed="media?.id === item.id"
                  :aria-label="t(item.altKey)"
                  @click="media = item"
                >
                  <Media :media="item" class-name="composer__thumb" />
                </button>
              </li>
            </ul>
          </md-step>

          <md-step
            :label="t('social.panel.caption')"
            icon="edit"
            :completed="caption.trim() !== '' || undefined"
          >
            <md-text-field
              v-awc="{ on: captionListeners }"
              :label="t('social.panel.caption')"
              :value="caption"
              multiline="fixed"
              rows="4"
              full-width
              :maxlength="CAPTION_MAX"
              :supporting-text="t('social.hint.captionLimit', { max: CAPTION_MAX })"
            ></md-text-field>
            <p class="muted composer__count">
              {{ t('social.common.characters', { count: caption.length, max: CAPTION_MAX }) }}
            </p>
          </md-step>

          <md-step :label="t('social.panel.audience')" icon="visibility" completed>
            <!-- A RADIO GROUP, NOT A SELECT. Four options, each needing a
                 sentence of explanation — a select shows one at a time and
                 hides the explanations behind it, which is the wrong shape for
                 a choice about who can see something. -->
            <div class="composer__audience" role="radiogroup" :aria-label="t('social.panel.audience')">
              <label
                v-for="option in AUDIENCES"
                :key="option.value"
                class="composer__option"
                :data-on="audience === option.value ? '' : undefined"
              >
                <md-radio
                  name="audience"
                  :value="option.value"
                  :checked="audience === option.value || undefined"
                  @click="audience = option.value"
                ></md-radio>
                <span class="composer__option-text">
                  <span class="strong">
                    <span class="material-symbols-outlined" aria-hidden="true">
                      {{ audienceIcon[option.value] }}
                    </span>
                    {{ t(option.labelKey) }}
                  </span>
                  <span class="muted">
                    {{ t(option.hintKey, { count: t.formatNumber(totals.followerCount) }) }}
                  </span>
                </span>
              </label>
            </div>

            <p class="muted">{{ t('social.hint.tapToTag') }}</p>
            <div class="facet-row">
              <md-chip
                v-for="person in people.slice(0, 8)"
                :key="person.id"
                variant="filter"
                appearance="outlined"
                :label="person.displayName"
                :selected="tagged.includes(person.id) || undefined"
                @click="toggleTag(person.id)"
              ></md-chip>
            </div>
          </md-step>

          <md-step :label="t('social.panel.preview')" icon="task_alt">
            <div class="row">
              <md-button v-awc="{ on: postListeners }" variant="filled" icon="send">
                {{ t('social.action.post') }}
              </md-button>
              <md-button v-awc="{ on: cancelListeners }" variant="text">
                {{ t('social.action.cancel') }}
              </md-button>
            </div>
          </md-step>
        </md-stepper>
      </div>

      <!-- THE PREVIEW IS ALWAYS VISIBLE, not a fourth step you arrive at. It is
           the whole point of a composer: the reader is not filling in a form,
           they are making a thing, and they should see it while they make it. -->
      <aside class="composer__preview">
        <Panel :title="t('social.panel.preview')">
          <article class="post-card">
            <header class="post-card__head">
              <span class="post-card__author">
                <Avatar :person="viewer" size="small" />
                <span class="post-card__names">
                  <!-- Not a link: this previews a post that does not exist yet,
                       and a profile link inside it invites the reader to
                       navigate away mid-compose. -->
                  <PersonName :person="viewer" />
                </span>
              </span>
              <md-chip
                variant="assist"
                appearance="outlined"
                color="secondary"
                :icon="audienceIcon[audience]"
                :label="t(audienceSpec.labelKey)"
              ></md-chip>
            </header>

            <Media v-if="media" :media="media" eager />
            <div v-else class="composer__placeholder">
              <span class="material-symbols-outlined" aria-hidden="true">add_photo_alternate</span>
              <p class="muted">{{ t('social.hint.needMedia') }}</p>
            </div>

            <div class="post-card__body">
              <p class="post-card__caption">
                <span class="post-card__handle">{{ viewer.handle }}</span>
                <!-- AN EXPLICIT SPACE, and it has to be explicit. Vue's default
                     `whitespace: 'condense'` DELETES a whitespace-only text node
                     that contains a newline and sits between two ELEMENTS — so
                     the handle ran straight into the caption
                     ("mara.ilvesWrite a caption first"). The React port writes
                     `{' '}` here for the same reason. It survives in the feed
                     card only because there the caption is an interpolation
                     rather than an element, and condense keeps those. -->
                {{ ' ' }}
                <span v-if="caption.trim() === ''" class="muted">
                  {{ t('social.hint.needCaption') }}
                </span>
                <template v-else>{{ caption }}</template>
              </p>
              <p v-if="tagged.length > 0" class="muted">
                {{ t('social.panel.tagged.short') }}: {{ taggedNames }}
              </p>
            </div>
          </article>
        </Panel>
      </aside>
    </div>

    <SnackbarHost :message="message" @close="close" />
  </Screen>
</template>
