<!--
  The run of `text` a search query matched, wrapped in `<mark>`.

  FILTERING IS THE KIT'S; SHOWING WHY A ROW SURVIVED IS THE VIEW'S. The
  selectors match case-insensitively on a TRIMMED query (`fold(search.trim())`
  in `selectors.ts`), so this splits on the same trimmed needle with the `i`
  flag — a table that highlighted a different substring from the one that kept
  the row would be worse than no highlight at all.

  NEVER BUILT AS AN HTML STRING. Interpolating the query into markup and
  setting `innerHTML` is an injection with a text field for a source. `split()`
  with ONE capture group returns the pieces as strings and Svelte makes the
  nodes: every match is escaped by construction, and a query that occurs three
  times in one cell is marked three times. One capture group makes the result
  alternate: even indices are the text between matches, odd indices are the
  matches themselves.

  THE MARK'S COLOURS ARE A CONTAINER/ON-CONTAINER PAIR, never a literal. The
  user-agent default for `<mark>` is black on yellow, which survives into the
  dark theme and lands a light-mode highlight in the middle of a dark table. A
  token pair is contrast-checked in both themes and follows a re-themed
  palette. `tertiary` is the accent role this console does not spend on a
  health state, so a hit reads as "this is what you asked for" rather than as a
  warning about the row. The weight is a SECOND CARRIER — colour alone would
  fail WCAG 1.4.1 — and the `<mark>` element itself carries the same fact into
  the accessibility tree, which is the whole reason it is `<mark>` and not a
  `<span class>`. Inline padding only: padding-block would grow the line box
  and shift the baseline of the one cell in the row that contains a match.
-->
<script lang="ts">
  export let text: string;
  export let query: string | undefined = undefined;

  /**
   * The regex metacharacters, so a query can be dropped into a pattern.
   * WITHOUT THIS, TYPING `(` THROWS. `$&` in the replacement is the character
   * that matched, so each one comes back escaped and matches itself literally.
   */
  const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

  const MARK_STYLE = [
    'background: var(--md-sys-color-tertiary-container)',
    'color: var(--md-sys-color-on-tertiary-container)',
    'font-weight: 500',
    'padding-inline: 1px',
    'border-radius: var(--md-sys-shape-corner-extra-small)',
  ].join('; ');

  $: needle = query?.trim() ?? '';
  $: parts = needle
    ? text.split(new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'))
    : [text];
</script>

{#each parts as part, index}{#if index % 2 === 1}<mark style={MARK_STYLE}>{part}</mark>{:else}{part}{/if}{/each}
