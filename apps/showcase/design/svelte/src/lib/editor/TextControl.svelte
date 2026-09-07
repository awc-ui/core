<script lang="ts">
import {objectProps} from '$lib/elements';
export let value=''; export let onValue:(value:string)=>void; export let live=false; export let label:string=undefined; export let placeholder:string=undefined;
</script>
<md-text-field use:objectProps={{value}} {value} {label} {placeholder} variant="outlined" density={-2} {...$$restProps} on:mdInput={event=>{if(live)onValue(String(event.detail??''))}} on:mdChange={event=>{if(!live)onValue(String(event.detail??''))}} />
