<script lang="ts">import {objectProps} from '$lib/elements';export let selected:boolean;export let onValue:(value:boolean)=>void;export let label:string;</script>
<div class="studio-toggle"><span>{label}</span><md-switch use:objectProps={{selected}} selected={selected||undefined} aria-label={label} on:mdChange={event=>onValue(event.detail.selected)}/></div>
