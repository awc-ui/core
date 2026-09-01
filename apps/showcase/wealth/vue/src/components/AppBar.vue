<!--
  The masthead. One per page — the host carries `role="banner"`.

  The leading affordance toggles the rail between its collapsed and expanded
  variants. It lives HERE rather than in the rail's own `expandable` toggle for
  one reason: at compact width the rail is not rendered at all, and a control
  that vanishes with the surface it controls is fine, whereas two toggles for
  one thing is not. `mdLeadingClick` fires only for the prop-based button,
  which is exactly the one being used — and it is a camelCase custom event, so
  it goes through `v-awc` (`@mdLeadingClick` would silently listen for
  `md-leading-click`, which the library never emits).

  The trailing slot is CAPPED AT THREE elements by the component (the fourth is
  hidden and warned about), and M3 wants it sparse. Two are used: the reporting
  context, and the signed-in advisor. There is no notifications bell, because
  there is nothing behind it — a control that does nothing is worse than an
  empty corner.

  Not a single visible string is written here — `useT()` resolves all of them,
  including the ones that look like constants (the brand name, the base-currency
  note). The reporting date is formatted through the translator's `formatDate`,
  which is pinned to `timeZone: 'UTC'`, so the date reads the same in every
  locale and on every machine.
-->
<script setup lang="ts">
import { BASE_CURRENCY, getAdvisor, REPORTING_DATE, REPORTING_QUARTER } from '@awc-ui/showcase-kit/wealth';
import { useT } from '~/composables/useShowcase';
import { useShell } from '~/composables/useShell';

const t = useT();
const advisor = getAdvisor();
const { toggleRail } = useShell();

const barListeners = { mdLeadingClick: () => toggleRail() };
</script>

<template>
  <md-app-bar
    v-awc="{ on: barListeners }"
    class="shell__appbar"
    variant="small"
    :subtitle="t('wealth.app.title')"
    leading-icon="menu"
    :leading-icon-label="t('wealth.nav.menu')"
  >
    <!--
      THE DISCLAIMER IS PART OF THE CHROME, not a footnote.

      Every proper noun in this app is invented — the bank, the households,
      the instruments, the advisors — and it is all presented in the shape of
      a real private-banking console, which is exactly the combination a
      reader could mistake for one. So the disclaimer sits in the app bar,
      beside the brand it qualifies, visible on every screen rather than at
      the bottom of one.

      It goes in the `headline` SLOT rather than the `headline` prop because
      the two are alternatives, and the slot renders inside the same
      `part="title"` span the prop does — so the brand keeps the app bar's own
      title typography and the chip simply sits next to it.

      `md-tooltip` carries the full sentence, and the chip's own label already
      says the load-bearing part: the tooltip is elaboration, never the only
      place the disclaimer exists.
    -->
    <span slot="headline" class="shell__brand">
      {{ t('wealth.app.brand') }}
      <md-tooltip :text="t('wealth.app.demoNotice')">
        <md-chip
          :label="t('wealth.app.demo')"
          appearance="outlined"
          color="warning"
          icon="science"
        ></md-chip>
      </md-tooltip>
    </span>

    <div slot="trailing" class="shell__meta">
      <span>{{ t('wealth.app.reportingDate', { date: t.formatDate(REPORTING_DATE, 'medium') }) }}</span>
      <span>{{ t('wealth.app.reportingQuarter', { quarter: REPORTING_QUARTER }) }}</span>
      <span>{{ t('wealth.app.baseCurrency', { currency: BASE_CURRENCY }) }}</span>
    </div>
    <!-- `label` is the accessible name; `name` only supplies the initials.
         Presentational — the avatar is not a control and opens nothing. -->
    <md-avatar
      slot="trailing"
      :name="advisor.name"
      :label="t('wealth.app.advisor', { name: advisor.name })"
      size="small"
    ></md-avatar>
  </md-app-bar>
</template>
