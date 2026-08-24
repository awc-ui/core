<!--
  A drill link into the next screen down.

  It carries a REAL, fully-prefixed `href`, which is the whole reason this is an
  `<a>` and not a button: ⌘-click opens a tab, middle-click opens a tab, "copy
  link address" copies something that resolves, and the deep link works on a
  cold load because `scripts/fan-out-routes.mjs` writes an `index.html` at every
  route. The handler only vetoes the plain left-click.

  In the SvelteKit build these screens were copied from, the framework
  intercepted in-app anchors on the app's behalf and this file was three lines.
  Here that interception is the router's job, and it is this handler.
-->
<script lang="ts">
  import { isPlainClick, navigate } from '$lib/router';
  import { withBase } from '$lib/routes';

  /** Root-relative path WITHOUT the base path — the mount is prefixed here. */
  export let href: string;

  function onClick(event: MouseEvent) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<a class="drill" href={withBase(href)} on:click={onClick}><slot /></a>
