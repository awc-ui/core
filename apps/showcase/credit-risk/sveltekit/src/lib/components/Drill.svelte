<!-- A drill link into the next screen down. -->
<script lang="ts">
  import { base } from '$app/paths';

  /** Root-relative path WITHOUT the base path — `base` is prefixed here. */
  export let href: string;
</script>

<a class="drill" href="{base}{href}"><slot /></a>
