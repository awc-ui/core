<!--
  An `md-button` that reports through `mdClick`.

  §9.1: listen to the component's own event, never the native `click` — the
  native one fires even when the component's `disabled` / `soft-disabled` /
  `loading` guard has already suppressed the action. A component rather than a
  copy-pasted guard at six call sites; it renders NO wrapper element, because an
  `md-toolbar` wires roving focus over its DIRECT children and a wrapper around
  the button would drop it out of the roving group.

  The React build exports this from `HouseholdTabs.tsx`; a Svelte component is
  one file, so it lives beside the screens that share it.

  `soft-disabled={softDisabled || undefined}` — NEVER a literal `false` string:
  on a form-associated element the ATTRIBUTE's presence is what disables.
-->
<script lang="ts">
  export let icon: string;
  export let variant: 'text' | 'tonal' | 'filled' | 'outlined' | 'elevated' = 'text';
  export let softDisabled = false;
  export let onActivate: () => void;

  function activate() {
    if (softDisabled) return;
    onActivate();
  }
</script>

<md-button
  {variant}
  size="sm"
  {icon}
  soft-disabled={softDisabled || undefined}
  on:mdClick={activate}
>
  <slot />
</md-button>
