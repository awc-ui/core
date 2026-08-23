<!--
  The status dots. `inline` on every one: without it `md-status-dot` is a block,
  and a dot set beside a word sits on its own baseline a few pixels low.

  The `severity` dot carries NO label, and that is the interesting one. It is
  rendered immediately beside a chip holding the same word, so naming it too
  makes every watchlist row announce the severity twice. Unlabelled,
  `md-status-dot` falls back to `role="presentation"` + `aria-hidden`, which is
  what a decorative mark sitting next to its own label should be. The `watch`
  dot stands alone, so its label is the only word available and it keeps one.

  The state and the label are resolved in the script rather than in the markup.
  Svelte's template expressions are plain JavaScript — TypeScript casts are only
  understood inside the script block — so anything needing one belongs here.
-->
<script lang="ts">
  import type { CovenantStatus, SignalSeverity } from '@awc-ui/showcase-kit/data';
  import { covenantDot, severityDot, watchlistDot } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';

  export let kind: 'watch' | 'covenant' | 'severity';
  export let value: string | boolean;

  $: state =
    kind === 'watch'
      ? watchlistDot(Boolean(value))
      : kind === 'covenant'
        ? covenantDot[value as CovenantStatus]
        : severityDot[value as SignalSeverity];

  $: size = kind === 'watch' ? 'medium' : 'small';

  $: label =
    kind === 'watch'
      ? value
        ? $t('kpi.watchlist')
        : $t('facilityStatus.performing')
      : kind === 'covenant'
        ? $t(`covenantStatus.${value}`)
        : undefined;
</script>

<md-status-dot inline {state} {size} {label}></md-status-dot>
