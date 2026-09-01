<!--
  The status dots, behind one `kind`. `inline` on every one: without it
  `md-status-dot` is a block, and a dot set beside a word sits on its own
  baseline a few pixels low.

  EVERY DOT HERE CARRIES A LABEL. `md-status-dot`'s colour is the only thing it
  renders, so an unlabelled one leaves colour as the sole carrier of meaning —
  exactly the failure the `label` prop exists to prevent. The only case for
  dropping it is a dot sitting immediately beside a chip that already says the
  same word, where naming both announces the state twice per row; a screen that
  needs that renders a raw `<md-status-dot>` and says why.
-->
<script lang="ts">
  import {
    allocationDot,
    goalDot,
    kycDot,
    orderDot,
  } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';

  export let kind: 'kyc' | 'allocation' | 'goal' | 'order';
  /** The domain value — a KycStatus, AllocationStatus, GoalStatus or OrderStatus. */
  export let value: string;

  // The kit's maps are keyed on their own union types; the dot receives the
  // value as a plain string, so the lookup goes through a widened view.
  type DotMap = Record<string, string | undefined>;
  const LOOKS: Record<string, { key: string; state: DotMap }> = {
    kyc: { key: 'wealth.kycStatus', state: kycDot as DotMap },
    allocation: { key: 'wealth.allocationStatus', state: allocationDot as DotMap },
    goal: { key: 'wealth.goalStatus', state: goalDot as DotMap },
    order: { key: 'wealth.orderStatus', state: orderDot as DotMap },
  };

  $: look = LOOKS[kind];
</script>

<md-status-dot inline state={look.state[value]} size="small" label={$t(`${look.key}.${value}`)}
></md-status-dot>
