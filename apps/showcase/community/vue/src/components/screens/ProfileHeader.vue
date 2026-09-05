<!--
  Cover, avatar, name, counts.

  THE AVATAR OVERLAPS THE COVER'S LOWER EDGE by a negative margin rather than
  absolute positioning — see `.profile-head` in app.css. Out of flow, the text
  under it has to be pushed down by a hard-coded amount that is wrong at every
  other avatar size.
-->
<script setup lang="ts">
import type { ProfileSummary } from '@awc-ui/showcase-kit/community';
import Panel from '~/components/Panel.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import Media from '~/components/bits/Media.vue';
import Verified from '~/components/bits/Verified.vue';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ summary: ProfileSummary }>();
const t = useT();
</script>

<template>
  <Panel>
    <div class="profile-head">
      <Media :media="props.summary.person.cover" class-name="profile-head__cover" eager />
      <div class="profile-head__row">
        <span class="profile-head__avatar">
          <Avatar :person="props.summary.person" size="large" />
        </span>
        <div class="profile-head__text">
          <h2 class="profile-head__name">
            {{ props.summary.person.displayName }}
            <Verified :person="props.summary.person" />
          </h2>
          <span class="profile-head__handle">@{{ props.summary.person.handle }}</span>
        </div>
        <div v-if="$slots.action" class="profile-head__action"><slot name="action" /></div>
      </div>
    </div>

    <dl class="stat-row">
      <div>
        <dt>{{ t('community.count.friends') }}</dt>
        <dd><Count :value="props.summary.person.friendCount" /></dd>
      </div>
      <div>
        <dt>{{ t('community.count.posts') }}</dt>
        <dd><Count :value="props.summary.posts.length" /></dd>
      </div>
      <div>
        <dt>{{ t('community.count.reactions') }}</dt>
        <dd><Count :value="props.summary.reactionsReceived" compact /></dd>
      </div>
      <!-- Mutuals are only meaningful for somebody else — on your own profile
           the number would be your friend count again. -->
      <div v-if="props.summary.person.friendship !== 'self'">
        <dt>{{ t('community.count.mutualLabel') }}</dt>
        <dd><Count :value="props.summary.person.mutualCount" /></dd>
      </div>
    </dl>
  </Panel>
</template>
