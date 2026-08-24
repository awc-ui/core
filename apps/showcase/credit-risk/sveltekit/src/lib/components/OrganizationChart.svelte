<script lang="ts">
  import { objectProps, type OrgNode } from '$lib/elements';

  export let nodes: OrgNode[] = [];

  $: props = { nodes };
</script>

<md-organization-chart use:objectProps={props} {...$$restProps}></md-organization-chart>
