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
        <div>
          <h2 class="panel__title">{title}</h2>
          {#if subtitle}<p class="panel__sub">{subtitle}</p>{/if}
        </div>
        <slot name="actions" />
      </div>
    {/if}
    <slot />
  </div>
</md-card>
