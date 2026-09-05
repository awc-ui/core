<!--
  A drill link into the next screen down.

  It carries a REAL, fully-prefixed `href`, which is the whole reason this is an
  `<a>` and not a button: ⌘-click opens a tab, middle-click opens a tab, "copy
  link address" copies something that resolves, and the deep link works on a
  cold load because `scripts/fan-out-routes.mjs` writes an `index.html` at every
  route. The handler only vetoes the plain left-click.
-->
<script lang="ts">
  import { isPlainClick, navigate } from '$lib/router';
  import { withBase } from '$lib/routes';

  /** Root-relative path WITHOUT the base path — the mount is prefixed here. */
  export let href: string;
  /**
   * The anchor's class. REPLACES `drill` rather than adding to it.
   *
   * This vertical has six kinds of link — a person, a post's media, a grid
   * tile, a handle, a suggestion row — and only one of them is a drill. Left
   * hard-coded, every one of them would inherit the drill's underline and
   * colour on top of its own.
   */
  export let linkClass = 'drill';

  /*
   * `$$restProps` forwards everything else onto the anchor, and the grid tiles
   * need it: their accessible name is the picture's alt plus whose it is, which
   * arrives as `aria-label`. Without the spread, a grid of forty links is forty
   * links all named the same thing.
   */

  function onClick(event: MouseEvent) {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    navigate(href);
  }
</script>

<a class={linkClass} href={withBase(href)} on:click={onClick} {...$$restProps}><slot /></a>
