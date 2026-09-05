<!--
  The masthead. One per page — the host carries `role="banner"`.

  The leading affordance toggles the rail between its collapsed and expanded
  variants. It lives HERE rather than in the rail's own `expandable` toggle for
  one reason: two toggles for one thing is worse than one toggle that comes and
  goes — and below 900px the rail does not exist, so the button is not
  rendered at all rather than left toggling nothing. `mdLeadingClick` fires only for the prop-based button,
  which is exactly the one being used — and it is a camelCase custom event, so
  it goes through `v-awc` (`@mdLeadingClick` would silently listen for
  `md-leading-click`, which the library never emits).

  The trailing slot is CAPPED AT THREE elements by the component (the fourth is
  hidden and warned about), and M3 wants it sparse. Two are used: who is signed
  in, and their portrait. There is no notifications bell, because Activity is a
  destination in the rail already.

  Not a single visible string is written here — `useT()` resolves all of them,
  including the ones that look like constants (the brand name).
-->
<script setup lang="ts">
import { getViewer } from '@awc-ui/showcase-kit/community';
import { COMPACT_NAV, useMediaQuery } from '~/lib/media';
import { useT } from '~/composables/useShowcase';
import { useShell } from '~/composables/useShell';

const t = useT();
const viewer = getViewer();
const compactNav = useMediaQuery(COMPACT_NAV);
const { toggleRail } = useShell();

const barListeners = { mdLeadingClick: () => toggleRail() };
</script>

<template>
  <md-app-bar
    v-awc="{ on: barListeners }"
    class="shell__appbar"
    variant="small"
    :subtitle="t('community.app.title')"
    :leading-icon="compactNav ? undefined : 'menu'"
    :leading-icon-label="compactNav ? undefined : t('community.nav.menu')"
  >
    <!--
      THE DISCLAIMER IS PART OF THE CHROME, not a footnote.

      Every person in this app is invented, every caption was written for it,
      and every picture is generated artwork — all presented in the shape of a
      real social app, which is exactly the combination a reader could mistake
      for one. The stakes are higher here than in the three consoles: those
      invent a bank, this one invents PEOPLE. So the disclaimer sits in the app
      bar, beside the brand it qualifies, visible on every screen rather than
      at the bottom of one.

      It goes in the `headline` SLOT rather than the `headline` prop because
      the two are alternatives, and the slot renders inside the same
      `part="title"` span the prop does — so the brand keeps the app bar's own
      title typography and the chip simply sits next to it.

      `md-tooltip` carries the full sentence, and the chip's own label already
      says the load-bearing part: the tooltip is elaboration, never the only
      place the disclaimer exists.
    -->
    <span slot="headline" class="shell__brand">
      {{ t('community.app.brand') }}
      <md-tooltip :text="t('community.app.demoNotice')">
        <md-chip
          :label="t('community.app.demo')"
          appearance="outlined"
          color="warning"
          icon="science"
        ></md-chip>
      </md-tooltip>
    </span>

    <!-- WHO IS SIGNED IN, and nothing else. The three consoles put a reporting
         date and a base currency here because every figure on their screens is
         measured against those two facts. Nothing on these screens is: a feed
         is not "as of" anything, and the relative timestamps say when each post
         was without a reference date in the chrome. What DOES need saying is
         whose account this is, because "your posts" and "people you follow" are
         only meaningful once you know who "you" is. -->
    <div slot="trailing" class="shell__meta">
      <span>{{ viewer.displayName }}</span>
      <span class="shell__handle">@{{ viewer.handle }}</span>
    </div>
    <md-avatar
      slot="trailing"
      :src="viewer.avatar"
      :name="viewer.displayName"
      :label="t('community.app.viewer', { name: viewer.displayName })"
      size="small"
    ></md-avatar>
  </md-app-bar>
</template>
