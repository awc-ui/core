<!--
  Every status chip in the console, behind one `kind`.

  Deliberately NOT one file per chip. The React build has a `bits.tsx` full of
  one-line chip components because a React component is a function call and
  costs nothing to declare. A Svelte component is a separate file with its own
  script block, and seventeen of them that each render a single `<md-chip>`
  with a different colour lookup would be more ceremony than the thing they
  wrap. So this is one component with a `kind` — the same trade the credit-risk
  Svelte build made.

  Every kind resolves BOTH halves of a domain value through the kit: the COLOUR
  through the status maps in `@awc-ui/showcase-kit/wealth`, the LABEL through
  the dictionary key that travels beside the value. Nothing here contains
  English, so nothing here can render English into a translated page. Never
  write `status === 'breach' ? 'error' : …` in a screen — use this.

  `variant="assist"` throughout: these are informational, not filters and not
  removable user input. A screen that wants a toggleable facet wants
  `variant="filter"` and owns its own state.

  The `orderSide` chip is deliberately NOT green/red: `success` and `error`
  mean "went well" and "went wrong" everywhere else in this console, and a sell
  is neither. The mapping is in the kit and the reasoning with it. `assetClass`
  is filled and tonal, driven by a ROLE NAME: `assetClassRole` names the same
  palette entries the donut uses, so the slice and the chip stay the same hue —
  and `cash` resolves to `undefined` and takes the neutral surface treatment.
-->
<script lang="ts">
  import {
    allocationColor,
    assetClassRole,
    goalColor,
    kycColor,
    mandateColor,
    orderColor,
    orderSideColor,
    priorityColor,
    proposalColor,
    riskProfileColor,
    riskToleranceColor,
    segmentColor,
    strategyColor,
  } from '@awc-ui/showcase-kit/wealth';
  import { t } from '$lib/showcase';

  export let kind:
    | 'strategy'
    | 'mandate'
    | 'segment'
    | 'riskProfile'
    | 'riskTolerance'
    | 'kyc'
    | 'clientRole'
    | 'assetClass'
    | 'instrumentType'
    | 'allocation'
    | 'goalStatus'
    | 'priority'
    | 'proposalStatus'
    | 'proposalType'
    | 'orderStatus'
    | 'orderSide'
    | 'activityCategory';
  /** The domain value — a Strategy, KycStatus, OrderSide, … as a string. */
  export let value: string;
  /** Elaboration for a tooltip-ish `title`. Rarely needed. */
  export let title: string | undefined = undefined;

  type Look = {
    /** Dictionary prefix; the label is `` `${key}.${value}` ``. */
    key: string;
    color: (value: string) => string | undefined;
    appearance: 'filled' | 'outlined' | 'elevated';
  };

  // The kit's maps are keyed on their own union types; the chip receives the
  // value as a plain string, so the lookup goes through a widened view. A
  // value outside the union resolves to `undefined`, which md-chip treats as
  // its neutral surface — the same behaviour a wrong key would get in React.
  const pick =
    (map: unknown) =>
    (v: string): string | undefined =>
      (map as Record<string, string | undefined>)[v];

  const LOOKS: Record<string, Look> = {
    strategy: { key: 'wealth.strategy', color: pick(strategyColor), appearance: 'filled' },
    mandate: { key: 'wealth.mandate', color: pick(mandateColor), appearance: 'outlined' },
    segment: { key: 'wealth.segment', color: pick(segmentColor), appearance: 'outlined' },
    riskProfile: { key: 'wealth.riskProfile', color: pick(riskProfileColor), appearance: 'filled' },
    riskTolerance: {
      key: 'wealth.riskTolerance',
      color: pick(riskToleranceColor),
      appearance: 'outlined',
    },
    kyc: { key: 'wealth.kycStatus', color: pick(kycColor), appearance: 'filled' },
    clientRole: { key: 'wealth.clientRole', color: () => 'secondary', appearance: 'outlined' },
    assetClass: { key: 'wealth.assetClass', color: pick(assetClassRole), appearance: 'filled' },
    instrumentType: { key: 'wealth.instrumentType', color: () => 'info', appearance: 'outlined' },
    allocation: {
      key: 'wealth.allocationStatus',
      color: pick(allocationColor),
      appearance: 'filled',
    },
    goalStatus: { key: 'wealth.goalStatus', color: pick(goalColor), appearance: 'filled' },
    priority: { key: 'wealth.priority', color: pick(priorityColor), appearance: 'outlined' },
    proposalStatus: {
      key: 'wealth.proposalStatus',
      color: pick(proposalColor),
      appearance: 'filled',
    },
    proposalType: { key: 'wealth.proposalType', color: () => 'secondary', appearance: 'outlined' },
    orderStatus: { key: 'wealth.orderStatus', color: pick(orderColor), appearance: 'filled' },
    orderSide: { key: 'wealth.orderSide', color: pick(orderSideColor), appearance: 'filled' },
    activityCategory: {
      key: 'wealth.activityCategory',
      color: () => 'secondary',
      appearance: 'outlined',
    },
  };

  $: look = LOOKS[kind];
  $: color = look.color(value);
  $: label = $t(`${look.key}.${value}`);
</script>

<md-chip variant="assist" appearance={look.appearance} {color} {label} {title}></md-chip>
