<!--
  The third column: birthdays, this week's events, and contacts.

  IT IS ASIDE CONTENT AND IT SAYS SO. `app.css` drops it entirely below 1200px
  rather than stacking it above the feed — a reader who opened the app came for
  the posts.

  THERE IS NO PRESENCE AND NO "ACTIVE NOW" DOT. Every product of this shape has
  one and it would be the single dishonest thing in this showcase: nobody is
  online, there is no socket, and a green dot that is always on says something
  false about a person.
-->
<script setup lang="ts">
import { rightRail } from '@awc-ui/showcase-kit/community';
import Panel from '~/components/Panel.vue';
import Drill from '~/components/Drill.vue';
import Avatar from '~/components/bits/Avatar.vue';
import EventRailRow from './EventRailRow.vue';
import { route } from '~/lib/routes';
import { useT } from '~/composables/useShowcase';

const t = useT();
const rail = rightRail();
</script>

<template>
  <Panel v-if="rail.birthdays.length > 0" :title="t('community.panel.birthdays')">
    <div class="rail-block">
      <Drill
        v-for="person in rail.birthdays"
        :key="person.id"
        link-class="rail-row"
        :to="route.person(person.handle)"
      >
        <span class="material-symbols-outlined" aria-hidden="true">cake</span>
        <span class="rail-row__text">
          <span class="rail-row__name">{{ person.displayName }}</span>
        </span>
      </Drill>
      <span class="rail-row__meta">{{ t('community.hint.birthdayToday') }}</span>
    </div>
  </Panel>

  <Panel v-if="rail.events.length > 0" :title="t('community.panel.upcoming')">
    <div class="rail-block">
      <EventRailRow v-for="event in rail.events" :key="event.id" :event="event" />
    </div>
  </Panel>

  <Panel :title="t('community.panel.contacts')">
    <div class="rail-block">
      <Drill
        v-for="person in rail.contacts"
        :key="person.id"
        link-class="rail-row"
        :to="route.person(person.handle)"
      >
        <Avatar :person="person" size="small" />
        <span class="rail-row__text">
          <span class="rail-row__name">{{ person.displayName }}</span>
        </span>
      </Drill>
    </div>
  </Panel>
</template>
