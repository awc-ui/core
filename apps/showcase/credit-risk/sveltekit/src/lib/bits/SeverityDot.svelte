<!--
  The severity marker beside the counterparty's name, at the head of the row.

  IT CARRIES A LABEL, and that is the whole difference from the dot that used to
  sit inside the severity cell. That one was decorative on purpose: the chip
  immediately beside it held the same word, so naming both announced the
  severity twice per row. Here the dot stands alone at the other end of the row,
  so an unlabelled one would leave its colour as the only carrier of meaning —
  exactly the failure `md-status-dot`'s `label` exists to prevent.
-->
<script lang="ts">
  import type { SignalSeverity } from '@awc-ui/showcase-kit/data';
  import { severityDot } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';

  export let severity: SignalSeverity;
</script>

<md-status-dot
  inline
  state={severityDot[severity]}
  size="small"
  label={$t(`severity.${severity}`)}
></md-status-dot>
