<!--
  Deliberately NOT one file per chip.

  The React build has a `bits.tsx` full of one-line components because a React
  component is a function call and costs nothing to declare. A Svelte component
  is a separate file with its own script block, and four of them that each
  render a single `<md-chip>` with a different colour lookup would be more
  ceremony than the thing they wrap. So this is one component with a `kind`.

  Every kind resolves BOTH halves of a domain value through the kit: the colour
  through the status maps in `@awc-ui/showcase-kit/credit-risk`, the label
  through the dictionary key that travels beside the value. Nothing here
  contains English, so nothing here can render English into a Romanian page.
-->
<script lang="ts">
  import type {
    CovenantStatus,
    FacilityStatus,
    RatingBand,
    SignalSeverity,
  } from '@awc-ui/showcase-kit/data';
  import {
    bandColor,
    covenantColor,
    facilityColor,
    severityColor,
  } from '@awc-ui/showcase-kit/credit-risk';
  import { t } from '$lib/showcase';

  export let kind: 'rating' | 'covenant' | 'facility' | 'severity';
  /** The domain value: a RatingLabel, CovenantStatus, FacilityStatus or SignalSeverity. */
  export let value: string;
  /** Rating only: the band that decides the colour, and the numeric grade. */
  export let band: string | undefined = undefined;
  export let grade: number | undefined = undefined;

  $: color =
    kind === 'rating'
      ? bandColor[band as RatingBand]
      : kind === 'covenant'
        ? covenantColor[value as CovenantStatus]
        : kind === 'facility'
          ? facilityColor[value as FacilityStatus]
          : severityColor[value as SignalSeverity];

  // The facility chip is the only outlined one — a facility status sits in a
  // table beside a rating chip, and two filled chips per row is a wall of
  // colour that stops any of them meaning anything.
  $: appearance = kind === 'facility' ? 'outlined' : 'filled';

  $: label =
    kind === 'rating'
      ? grade == null
        ? $t(`rating.${value}`)
        : `${$t(`rating.${value}`)} · ${grade}`
      : kind === 'covenant'
        ? $t(`covenantStatus.${value}`)
        : kind === 'facility'
          ? $t(`facilityStatus.${value}`)
          : $t(`severity.${value}`);

  $: title = kind === 'rating' ? $t(`ratingBand.${band}`) : undefined;
</script>

<md-chip variant="assist" {appearance} {color} {label} {title}></md-chip>
