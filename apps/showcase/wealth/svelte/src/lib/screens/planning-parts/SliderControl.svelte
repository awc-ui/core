<!--
  One what-if control: a label, the current value in words, and the slider.

  `controlled`, because the value is the screen's. The manual is blunt about
  the consequence of forgetting the handler — the thumb follows the pointer and
  then springs back on commit — so `mdInput` writes on every move and
  `mdChange` writes again on release. Same handler for both, exactly as the
  React build wires it.

  There is no `value-indicator`: its bubble renders the raw number, which for
  the horizon slider is a sample INDEX and for the contribution an unformatted
  amount. The formatted value sits in the head row instead (the `display`
  slot), where it is localised, and in `value-text`, which is what a screen
  reader announces.
-->
<script lang="ts">
  export let label: string;
  export let valueText: string;
  export let value: number;
  export let min: number;
  export let max: number;
  export let step: number;
  export let stops = false;
  export let onChange: (value: number) => void;

  function handle(event: CustomEvent<unknown>) {
    const next = (event as CustomEvent<{ value: number }>).detail?.value;
    if (typeof next === 'number') onChange(next);
  }
</script>

<div class="plan-control">
  <div class="plan-control__head">
    <span class="plan-control__label">{label}</span>
    <span class="plan-control__value"><slot name="display" /></span>
  </div>
  <div class="plan-control__rail">
    <md-slider
      controlled
      size="sm"
      aria-label={label}
      {value}
      {min}
      {max}
      {step}
      stops={stops || undefined}
      value-text={valueText}
      on:mdInput={handle}
      on:mdChange={handle}
    ></md-slider>
  </div>
</div>
