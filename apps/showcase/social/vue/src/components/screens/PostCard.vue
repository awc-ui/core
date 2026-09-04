<!--
  One post in the feed. The most-repeated component in the app, so its decisions
  are repeated twelve times a screen.

  THE HEADER, THE PICTURE, THE ACTIONS, THE CAPTION, THE COMMENTS — in that
  order, which every app of this shape uses and is not arbitrary: the picture is
  the content, so nothing but a name goes above it; the actions sit directly
  under it because that is where the thumb is after looking; and the caption
  comes after the actions because it is prose, and prose that pushed the actions
  down would move the target every time a caption ran long.

  THE WHOLE CARD IS NOT A LINK. Only the name, the picture and the comment count
  navigate. Wrapping the card would swallow the four action buttons inside it —
  a control inside a link is reachable but announces the link's name, and
  pressing it with a keyboard fires both.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { engagement, getPersonById, type FeedItem } from '@awc-ui/showcase-kit/social';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';
import { useEngagement } from '~/composables/useEngagement';
import Drill from '~/components/Drill.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import PersonName from '~/components/bits/PersonName.vue';
import PostActions from '~/components/bits/PostActions.vue';
import PostMedia from '~/components/bits/PostMedia.vue';
import When from '~/components/bits/When.vue';

const props = withDefaults(defineProps<{ item: FeedItem; eager?: boolean }>(), { eager: false });
const emit = defineEmits<{ message: [key: string | null, params?: Record<string, string | number>] }>();

const t = useT();
const { isLiked, isSaved, toggleLike, toggleSave } = useEngagement();

const post = computed(() => props.item.post);
const liked = computed(() => isLiked(post.value));
const saved = computed(() => isSaved(post.value));
/* The kit does the arithmetic of turning an override plus a shipped count into
   the number on screen — five builds must not each write
   `likeCount + (liked && !post.liked ? 1 : 0)` slightly differently. */
const counts = computed(() => engagement(post.value, liked.value, saved.value));

const likesWord = computed(() =>
  t.value('social.count.likes').toLocaleLowerCase(t.value.locale),
);

/* Liking announces; UNliking does not. A snackbar is for something the reader
   may want to undo or verify, and taking a like back is already its own
   confirmation — the heart empties. Saving is the other way round: the post
   goes somewhere the reader cannot see from here. */
const onLike = () => emit('message', toggleLike(post.value) ? 'social.msg.liked' : null);
const onSave = () =>
  emit('message', toggleSave(post.value) ? 'social.msg.saved' : 'social.msg.unsaved');
const onShare = () => emit('message', 'social.msg.linkCopied');
</script>

<template>
  <article class="post-card">
    <header class="post-card__head">
      <!-- ONE link around the avatar and the name, with `PersonName` inside it
           rather than `PersonLink` — the latter is an anchor, and an anchor
           inside an anchor is invalid HTML that a framework builds without
           complaint and a screen reader reads as two overlapping links. -->
      <Drill link-class="post-card__author" :to="route.person(item.author.handle)">
        <Avatar :person="item.author" size="small" ring />
        <span class="post-card__names">
          <PersonName :person="item.author" />
          <span v-if="post.locationKey" class="post-card__place">{{ t(post.locationKey) }}</span>
        </span>
      </Drill>
      <When :at="post.postedAt" />
      <!-- No overflow menu. Every action behind one — report, copy link, mute —
           would be a control that does nothing in a fixture-backed demo, and
           the app bar's disclaimer already says this is not a real product. -->
    </header>

    <!-- The href goes INTO `PostMedia`, which puts the anchor around the image
         only. Wrapping the whole thing put the pager buttons inside the link. -->
    <PostMedia :post="post" :eager="eager" :href="route.post(post.id)" />

    <PostActions
      :liked="liked"
      :saved="saved"
      @like="onLike"
      @save="onSave"
      @share="onShare"
      @comment="() => {}"
    />

    <div class="post-card__body">
      <p class="post-card__counts"><Count :value="counts.likeCount" /> {{ likesWord }}</p>

      <!-- The caption is ONE paragraph led by the author's handle, which is how
           every app of this shape writes it — the name is part of the sentence,
           not a label above it. -->
      <p class="post-card__caption">
        <Drill link-class="post-card__handle" :to="route.person(item.author.handle)">
          {{ item.author.handle }}
        </Drill>
        {{ t(post.captionKey) }}
      </p>

      <p v-if="post.commentsDisabled" class="post-card__muted">
        {{ t('social.hint.commentsOff') }}
      </p>
      <template v-else>
        <Drill
          v-if="item.hiddenComments > 0"
          link-class="post-card__more"
          :to="route.post(post.id)"
        >
          {{ t('social.action.viewComments', { count: t.formatNumber(post.commentCount) }) }}
        </Drill>
        <p v-for="comment in item.preview" :key="comment.id" class="post-card__comment">
          <!-- The record carries an author ID, not a handle — resolving it here
               is what stops `per-07` appearing where a name belongs. -->
          <Drill
            link-class="post-card__handle"
            :to="route.person(getPersonById(comment.authorId)?.handle ?? '')"
          >
            {{ getPersonById(comment.authorId)?.handle ?? comment.authorId }}
          </Drill>
          {{ t(comment.bodyKey) }}
        </p>
      </template>
    </div>
  </article>
</template>
