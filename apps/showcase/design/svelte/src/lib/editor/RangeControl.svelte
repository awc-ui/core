<script lang="ts">
import {objectProps} from '$lib/elements';export let value:number;export let onValue:(value:number)=>void;export let label:string;export let min=0;export let max=100;export let step=5;let draft=value;$: draft=value;
const read=(event:CustomEvent)=>Number(typeof event.detail==='number'?event.detail:event.detail?.value);
</script>
<div class="studio-range"><div><span>{label}</span><strong>{draft}{min===0&&max===100?'%':''}</strong></div><md-slider {min} {max} value={draft} {step} use:objectProps={{value:draft}} aria-label={label} value-indicator on:mdInput={event=>{if(Number.isFinite(read(event)))draft=read(event)}} on:mdChange={event=>{if(Number.isFinite(read(event))){draft=read(event);onValue(draft)}}}/></div>
