<!--
  The builder, with a remount key.

  "Start another proposal" has to clear a dozen uncontrolled custom elements.
  Re-keying the form is the only honest way to do it: every control drops its
  own value with the element, so there is no reset routine to keep in sync
  with the field list.

  The reasoning for every control choice — and for why the stepper is NOT
  inside a dialog — lives at the top of `ProposalForm.vue`.
-->
<script setup lang="ts">
import { ref } from 'vue';
import ProposalForm from './ProposalForm.vue';
import './snackbar.css';

const generation = ref(0);
</script>

<template>
  <ProposalForm :key="generation" @restart="generation += 1" />
</template>
