<!--
  The builder, with a remount key.

  "Start another proposal" has to clear a dozen uncontrolled custom elements.
  Re-keying the form is the only honest way to do it: every control drops its
  own value with the element, so there is no reset routine to keep in sync with
  the field list. `{#key}` destroys and recreates the `ProposalForm` component
  instance, which resets its state and every element it authored — the same
  thing `key={generation}` does in the React build.

  The form itself lives in `ProposalForm.svelte` — a separate component because
  `{#key}` only recreates what is INSIDE it, and the state being cleared has to
  live inside the thing being recreated.
-->
<script lang="ts">
  import ProposalForm from './ProposalForm.svelte';

  let generation = 0;

  function restart() {
    generation += 1;
  }
</script>

{#key generation}
  <ProposalForm onRestart={restart} />
{/key}
