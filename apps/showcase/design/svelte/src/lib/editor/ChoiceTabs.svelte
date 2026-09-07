<script lang="ts">
import {objectProps} from '$lib/elements'; export let value:string;export let onValue:(value:string)=>void;export let label:string;export let options:readonly {value:string;label:string;icon?:string}[];
</script>
<md-segmented-button-set class="studio-segments" aria-label={label} density={-2} on:mdChange={event=>{if(event.detail[0])onValue(event.detail[0])}}>{#each options as option}<md-segmented-button value={option.value} label={option.label} icon={option.icon} use:objectProps={{selected:value===option.value}} selected={value===option.value||undefined}/>{/each}</md-segmented-button-set>
