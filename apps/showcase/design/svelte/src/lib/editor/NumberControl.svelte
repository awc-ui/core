<script lang="ts">
import {t} from '$lib/showcase';

import {objectProps} from '$lib/elements'; export let value:number|null; export let onValue:(value:number)=>void; export let label:string; export let min=0;export let max=48;export let step=1;
function change(event:CustomEvent){if(typeof event.detail?.value==='number'&&Number.isFinite(event.detail.value))onValue(event.detail.value)}
</script>
<md-number-field locale={$t.locale === 'ar' ? 'ar-u-nu-arab' : $t.locale} increment-label={$t('Increment')} decrement-label={$t('Decrement')} value-missing-label={$t('Please enter a number.')} use:objectProps={{value}} {value} {label} {min} {max} {step} placeholder={value===null?$t('Mixed'):undefined} variant="outlined" density={-2} steppers="none" {...$$restProps} on:mdChange={change}/>
