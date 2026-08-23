<!--
  The status dots. `inline` on every one: without it `md-status-dot` is a block,
  and a dot set beside a word sits on its own baseline a few pixels low.

  The `severity` dot carries NO label, and that is the interesting one. It is
  rendered immediately beside a chip holding the same word, so naming it too
  makes every watchlist row announce the severity twice. Unlabelled,
  `md-status-dot` falls back to `role="presentation"` + `aria-hidden`, which is
  what a decorative mark sitting next to its own label should be. The `watch` dot
  stands alone, so its label is the only word available and it keeps one.
-->
<script setup lang="ts">
import { computed } from 'vue';
import type { CovenantStatus, SignalSeverity } from '@awc-ui/showcase-kit/data';
import { covenantDot, severityDot, watchlistDot } from '@awc-ui/showcase-kit/credit-risk';
import { useT } from '~/composables/useShowcase';

const props = defineProps<{
  kind: 'watch' | 'covenant' | 'severity';
  value: string | boolean;
}>();

const t = useT();

const state = computed(() => {
  if (props.kind === 'watch') return watchlistDot(Boolean(props.value));
  if (props.kind === 'covenant') return covenantDot[props.value as CovenantStatus];
  return severityDot[props.value as SignalSeverity];
});

const size = computed(() => (props.kind === 'watch' ? 'medium' : 'small'));

const label = computed(() => {
  if (props.kind === 'watch') {
    return props.value ? t.value('kpi.watchlist') : t.value('facilityStatus.performing');
  }
  if (props.kind === 'covenant') return t.value(`covenantStatus.${props.value}`);
  return undefined;
});
</script>

<template>
  <md-status-dot inline :state="state" :size="size" :label="label"></md-status-dot>
</template>
