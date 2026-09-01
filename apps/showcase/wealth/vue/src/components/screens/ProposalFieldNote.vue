<!--
  The single supporting line under a control that has no supporting line of its
  own — the hint (the default slot), or the error, never both.

  An error REPLACES the hint rather than appearing beneath it. That is the rule
  `md-text-field` applies to its own two (and `md-date-picker` and
  `md-time-picker` forward it), and it is the reason nothing moves when a
  message appears: the line was already there, holding the hint.

  The error's colour is the `error` ROLE via `.field-error`, not a hex and not
  a borrowed class: `.pl-down` is the same red but it means "this figure went
  down", and reusing it here would put a P/L class on a validation message.
-->
<script setup lang="ts">
defineProps<{ error: string }>();
</script>

<template>
  <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  <p v-else class="muted"><slot /></p>
</template>
