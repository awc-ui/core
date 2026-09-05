<!--
  Avatar, name, optional group, time and audience.

  TWO SHAPES IN ONE: a plain post says "Ada Lindqvist", a group post says
  "Ada Lindqvist › Nordic Film Club" with both halves linking somewhere
  different. The chevron rather than the word "in" is deliberate — see the note
  on `.post-card__in` in app.css — and the translated "in {group}" string is
  still used, on the group link's accessible name, where word order matters.
-->
<script setup lang="ts">
import type { FeedItem } from '@awc-ui/showcase-kit/community';
import Drill from '~/components/Drill.vue';
import Avatar from '~/components/bits/Avatar.vue';
import AudienceMark from '~/components/bits/AudienceMark.vue';
import PersonName from '~/components/bits/PersonName.vue';
import When from '~/components/bits/When.vue';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';

const props = withDefaults(defineProps<{ item: FeedItem; compact?: boolean }>(), { compact: false });
const t = useT();
</script>

<template>
  <header class="post-card__head">
    <Drill link-class="post-card__author" :to="route.person(props.item.author.handle)">
      <Avatar :person="props.item.author" :size="props.compact ? 'small' : 'medium'" />
    </Drill>
    <div class="post-card__names">
      <span class="post-card__in">
        <Drill link-class="post-card__author" :to="route.person(props.item.author.handle)">
          <PersonName :person="props.item.author" />
        </Drill>
        <template v-if="props.item.group">
          <span aria-hidden="true">›</span>
          <Drill
            link-class="post-card__group"
            :to="route.group(props.item.group.slug)"
            :aria-label="t('community.hint.postedIn', { group: props.item.group.name })"
          >
            {{ props.item.group.name }}
          </Drill>
        </template>
      </span>
      <span class="post-card__meta">
        <Drill link-class="when" :to="route.post(props.item.post.id)">
          <When :at="props.item.post.postedAt" />
        </Drill>
        <span aria-hidden="true">·</span>
        <AudienceMark
          :audience="props.item.post.audience"
          :label-key="props.item.post.audienceKey"
        />
        <template v-if="props.item.post.pinned">
          <span aria-hidden="true">·</span>
          <span>{{ t('community.hint.pinned') }}</span>
        </template>
      </span>
    </div>
  </header>
</template>
