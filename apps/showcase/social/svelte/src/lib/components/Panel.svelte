<!-- A titled surface. Everything on every screen lives in one of these. -->
<script lang="ts">
  export let title: string | undefined = undefined;
  export let subtitle: string | undefined = undefined;
  export let variant: 'elevated' | 'filled' | 'outlined' = 'outlined';
</script>

<md-card {variant} class="panel" full-width>
  <div class="panel__inner">
    {#if title}
      <div class="panel__head">
        <!-- Title and subtitle are ONE heading and share a row, so the pair
             needs a box of its own to sit in — an unclassed `div` here is a
             block container, which stacks them and reads as two headings.
             `.panel__heading` in `app.css` lays the two out side by side and
             drops the subtitle beneath the title only when the card is too
             narrow to hold both. -->
        <div class="panel__heading">
          <h2 class="panel__title">{title}</h2>
          {#if subtitle}<p class="panel__sub">{subtitle}</p>{/if}
        </div>
        <slot name="actions" />
      </div>
    {/if}
    <slot />
  </div>
</md-card>
