<!--
  mm:ss via `clock()` from the kit, NOT `Intl`: the digits stay Latin in every
  locale so the scrubber and the ruler's bar numbers cannot end up in two
  different numbering systems on one screen.
-->
<script lang="ts">
  import { clock } from '@awc-ui/showcase-kit/music';
  export let seconds: number;
</script>

<span class="tabular">{clock(seconds)}</span>
