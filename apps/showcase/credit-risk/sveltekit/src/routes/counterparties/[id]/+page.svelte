<script>
  import CounterpartyScreen from '$lib/screens/CounterpartyScreen.svelte';

  export let data;
</script>

<CounterpartyScreen counterpartyId={data.counterpartyId} />
