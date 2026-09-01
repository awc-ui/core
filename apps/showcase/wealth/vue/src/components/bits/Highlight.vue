<!--
  The run of `text` a search query matched, wrapped in `<mark>`.

  FILTERING IS THE KIT'S; SHOWING WHY A ROW SURVIVED IS THE VIEW'S. The
  selectors match case-insensitively on a TRIMMED query (`fold(search.trim())`
  in `selectors.ts`), so this splits on the same trimmed needle with the `i`
  flag — a table that highlighted a different substring from the one that kept
  the row would be worse than no highlight at all.

  NEVER BUILT AS AN HTML STRING. Interpolating the query into markup and
  setting `innerHTML` is an injection with a text field for a source, and the
  fixture holds names with `&` and `.` that would break it even with a
  co-operative reader. `split()` with ONE capture group returns the pieces as
  strings and Vue makes the nodes: every match is escaped by construction, and
  a query that occurs three times in one cell is marked three times.

  The mark's colours are a CONTAINER/ON-CONTAINER PAIR, never a literal. The
  user-agent default for `<mark>` is black on yellow, which survives into the
  dark theme and lands a light-mode highlight in the middle of a dark table. A
  token pair is contrast-checked in both themes and follows a re-themed
  palette. `tertiary` is the accent role this console does not spend on a
  health state, so a hit reads as "this is what you asked for" rather than as a
  warning about the row. The `<mark>` element itself carries the same fact into
  the accessibility tree — the reason it is `<mark>` and not a `<span class>`.

  The kit matches its fields JOINED BY A SPACE, so a query that straddles two
  of them keeps the row and marks nothing. That is the honest outcome — no
  single cell contains that text.
-->
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ text: string; query?: string }>();

/**
 * The regex metacharacters, so a query can be dropped into a pattern.
 * WITHOUT THIS, TYPING `(` THROWS — half the punctuation on a keyboard is
 * syntax to `RegExp`. `$&` in the replacement is the character that matched.
 */
const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

// One capture group makes the result alternate: even indices are the text
// between matches, odd indices are the matches themselves.
const parts = computed(() => {
  const needle = props.query?.trim() ?? '';
  if (!needle) return [props.text];
  return props.text.split(new RegExp(`(${needle.replace(REGEX_METACHARACTERS, '\\$&')})`, 'gi'));
});

const markStyle = {
  background: 'var(--md-sys-color-tertiary-container)',
  color: 'var(--md-sys-color-on-tertiary-container)',
  fontWeight: 500,
  // Inline padding only: padding-block would grow the line box and shift the
  // baseline of the one cell in the row that happens to contain a match.
  paddingInline: '1px',
  borderRadius: 'var(--md-sys-shape-corner-extra-small)',
};
</script>

<template>
  <template v-for="(part, index) in parts" :key="index">
    <mark v-if="index % 2 === 1" :style="markStyle">{{ part }}</mark>
    <template v-else>{{ part }}</template>
  </template>
</template>
