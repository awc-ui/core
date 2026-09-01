<!-- An `md-select` bound to state. `mdChange`'s detail is the new value, a string. -->
<script lang="ts">
  export let label: string;
  export let value: string;
  export let onChange: (value: string) => void;
  export let fullWidth = true;

  function handle(event: CustomEvent<unknown>) {
    onChange((event.detail as string | undefined) ?? '');
  }
</script>

<md-select
  variant="outlined"
  {label}
  {value}
  full-width={fullWidth || undefined}
  on:mdChange={handle}
>
  <slot />
</md-select>
