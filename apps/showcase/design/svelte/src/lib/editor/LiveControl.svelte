<script lang="ts">
import {t} from '$lib/showcase';
import {type Layer} from '@awc-ui/showcase-kit/design';export let layer:Layer;export let presentation:boolean;let activated=false;</script>
{#if layer.componentId==='awc:button'}<!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" icon={activated?'check':'arrow_forward'} on:click={()=>{if(presentation)activated=!activated}}>{activated?$t('You made it happen!'):layer.name}</md-button>
{:else if layer.componentId==='awc:text-field'}<md-text-field variant="outlined" label={layer.name} placeholder={$t('Try typing here…')}/>
{:else if layer.componentId==='awc:switch'}<div class="live-switch"><span>{layer.name}</span><md-switch aria-label={layer.name} icons/></div>
{:else}<md-card variant="filled"><span class="live-card__eyebrow">{$t('MADE OF POSSIBILITIES')}</span><strong>{layer.name}</strong><p>{$t('A real component. Ready for your next idea.')}</p><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="tonal" on:click={()=>{if(presentation)activated=!activated}}>{activated?$t('Nice work!'):$t('Explore more')}</md-button></md-card>{/if}
