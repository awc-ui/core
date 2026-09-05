<script setup lang="ts">
import { computed } from 'vue';
import { joinAction, type Group } from '@awc-ui/showcase-kit/community';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import Media from '~/components/bits/Media.vue';
import Count from '~/components/bits/Count.vue';
import PrivacyChip from '~/components/bits/PrivacyChip.vue';
import RoleChip from '~/components/bits/RoleChip.vue';
import { route } from '~/lib/routes';
import { useEngagement } from '~/composables/useEngagement';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{ group: Group }>();
const emit = defineEmits<{
  (e: 'message', key: string | null, params?: Record<string, string | number>): void;
}>();

const t = useT();
const { roleFor, setRole } = useEngagement();
const role = computed(() => roleFor(props.group));
const action = computed(() => joinAction[role.value]);

function press() {
  /* Joining a PRIVATE group asks rather than joins — which is the whole point
     of the privacy flag, and the state `pending` exists to hold. */
  const next =
    role.value === 'none' ? (props.group.privacy === 'private' ? 'pending' : 'member') : 'none';
  const was = role.value;
  setRole(props.group, next);
  emit(
    'message',
    next === 'member'
      ? 'community.msg.joined'
      : next === 'pending'
        ? 'community.msg.requested'
        : was === 'pending'
          ? 'community.msg.requestCancelled'
          : 'community.msg.left',
    { name: props.group.name },
  );
}
</script>

<template>
  <Panel>
    <div class="group-card" :data-group="props.group.id">
      <Drill :to="route.group(props.group.slug)" :aria-label="props.group.name">
        <Media :media="props.group.cover" class-name="group-card__cover" />
      </Drill>
      <Drill link-class="group-card__name" :to="route.group(props.group.slug)">{{
        props.group.name
      }}</Drill>
      <div class="row">
        <PrivacyChip :group="props.group" />
        <RoleChip :role="role" />
      </div>
      <p class="group-card__about">{{ t(props.group.descriptionKey) }}</p>
      <p class="person-row__meta">
        <Count :value="props.group.memberCount" compact />
        {{ t('community.count.members').toLocaleLowerCase(t.locale)
        }}{{
          props.group.weeklyPostCount > 0
            ? ` · ${
                props.group.weeklyPostCount === 1
                  ? t('community.count.weeklyPostsOne')
                  : t('community.count.weeklyPosts', {
                      count: t.formatNumber(props.group.weeklyPostCount),
                    })
              }`
            : ''
        }}
      </p>
      <md-button v-if="action" :variant="action.variant" size="sm" :icon="action.icon" @click="press">
        {{ t(action.labelKey) }}
      </md-button>
    </div>
  </Panel>
</template>
