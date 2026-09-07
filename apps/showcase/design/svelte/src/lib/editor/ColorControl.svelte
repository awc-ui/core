<script lang="ts">
import {t} from '$lib/showcase';
import {objectProps} from '$lib/elements';export let value:string;export let onValue:(value:string)=>void;</script>
<md-color-picker locale={$t.locale} {value} use:objectProps={{value}} variant="popup" aria-label={$t('Custom fill color')} show-hex presets="#203D35,#BEE7AA,#F4F1E9,#F2AAA7,#392263,#C2BBF3" on:mdChange={event=>onValue(event.detail.value)}/>
