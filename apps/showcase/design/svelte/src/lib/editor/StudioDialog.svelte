<script lang="ts">
import {t} from '$lib/showcase';
import {objectProps} from '$lib/elements';export let open:boolean;export let onClose:()=>void;export let title:string;export let fullscreen=false;
function ownClose(event:CustomEvent){if(event.target===event.currentTarget)onClose()}
</script>
{#if open}<md-dialog locale={$t.locale} class="studio-dialog" {open} headline={title} fullscreen={fullscreen||undefined} close-label={$t('Close dialog')} use:objectProps={{open,fullscreen}} on:mdClose={ownClose} on:mdCancel={ownClose}><div class="studio-dialog__content"><slot/></div>{#if $$slots.actions}<div slot="actions" class="studio-dialog__actions"><slot name="actions"/></div>{/if}</md-dialog>{/if}
