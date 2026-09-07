<script lang="ts">
import {objectProps} from '$lib/elements';export let value:string;export let onValue:(value:string)=>void;export let label:string;export let options:readonly {value:string;label:string;icon?:string}[];
$: activeTabIndex=Math.max(0,options.findIndex(option=>option.value===value));
function change(event:CustomEvent){if(event.target!==event.currentTarget)return;const option=options[event.detail.index];if(option)onValue(option.value)}
</script>
<md-tabs class="studio-panel-tabs" aria-label={label} variant="secondary" tab-width="equal" use:objectProps={{activeTabIndex}} on:mdTabChange={change}>{#each options as option}<md-tab label={option.label} use:objectProps={{active:value===option.value}} active={value===option.value||undefined} density={0}/>{/each}</md-tabs>
