<script lang="ts">
import {objectProps} from '$lib/elements';export let value:string;export let onValue:(value:any)=>void;export let label:string;export let options:readonly {value:string;label:string}[];
</script>
<md-select use:objectProps={{value}} {value} {label} variant="outlined" density={-2} {...$$restProps} on:mdChange={event=>onValue(String(event.detail))}>{#each options as option}<md-select-option value={option.value} label={option.label}/>{/each}</md-select>
