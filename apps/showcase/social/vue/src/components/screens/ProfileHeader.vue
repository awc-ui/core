<!--
  The header, shared by the two profile screens.

  YOUR PROFILE AND SOMEONE ELSE'S ARE THE SAME SCREEN with two differences: the
  follow button, and which tabs exist. Written twice they would drift on the
  third change; written once, the differences are one slot and one prop.

  THE THREE COUNTS ARE EXACT, not compact. A follower total is a number people
  check — "1.2K followers" on an account with 1,180 is a figure its owner would
  dispute — which is the distinction `countOptions` draws and the reason
  `<Count exact>` exists.
-->
<script setup lang="ts">
import type { ProfileSummary } from '@awc-ui/showcase-kit/social';
import { useT } from '~/composables/useShowcase';
import Panel from '~/components/Panel.vue';
import AccountKindChip from '~/components/bits/AccountKindChip.vue';
import Avatar from '~/components/bits/Avatar.vue';
import Count from '~/components/bits/Count.vue';
import Verified from '~/components/bits/Verified.vue';

defineProps<{ summary: ProfileSummary }>();
const t = useT();
</script>

<template>
  <Panel>
    <div class="profile-head">
      <Avatar :person="summary.person" size="large" ring />

      <div class="profile-head__text">
        <div class="profile-head__names">
          <h2 class="profile-head__name">
            {{ summary.person.displayName }}
            <Verified :person="summary.person" />
          </h2>
          <span class="profile-head__handle">@{{ summary.person.handle }}</span>
          <AccountKindChip :person="summary.person" />
        </div>

        <dl class="stat-row">
          <div>
            <dt>{{ t('social.count.posts') }}</dt>
            <dd><Count :value="summary.posts.length" exact /></dd>
          </div>
          <div>
            <dt>{{ t('social.count.followers') }}</dt>
            <dd><Count :value="summary.person.followerCount" exact /></dd>
          </div>
          <div>
            <dt>{{ t('social.count.following') }}</dt>
            <dd><Count :value="summary.person.followingCount" exact /></dd>
          </div>
          <div>
            <dt>{{ t('social.count.likes') }}</dt>
            <dd><Count :value="summary.likes" /></dd>
          </div>
        </dl>

        <p class="profile-head__bio">{{ t(summary.person.bioKey) }}</p>
        <p v-if="summary.person.locationKey" class="muted profile-head__place">
          <span class="material-symbols-outlined" aria-hidden="true">place</span>
          {{ t(summary.person.locationKey) }}
        </p>
      </div>

      <div v-if="$slots.action" class="profile-head__action"><slot name="action" /></div>
    </div>

    <div v-if="summary.topTopics.length > 0" class="row">
      <span class="muted">{{ t('social.panel.topics') }}</span>
      <md-chip
        v-for="topic in summary.topTopics"
        :key="topic.id"
        variant="assist"
        appearance="outlined"
        color="secondary"
        :icon="topic.icon"
        :label="t(topic.labelKey)"
      ></md-chip>
    </div>
  </Panel>
</template>
