<script lang="ts">
import {type Layer} from '@awc-ui/showcase-kit/design';import {colorOf,textLayout} from '@awc-ui/pictor-model';import {t} from '$lib/showcase';import LiveControl from './LiveControl.svelte';import AdjustmentImage from './AdjustmentImage.svelte';
export let layer:Layer;export let presentation=false;
$: fill=colorOf(layer.fill,'none');$: width=layer.rect.w*20;$: height=layer.rect.h*20;$: label=layer.textKey?$t(layer.textKey):layer.name;$: text=textLayout(layer,label);
</script>
{#if layer.componentId?.startsWith('awc:')}<div class="layer__live" data-live={presentation?'':undefined}><LiveControl {layer} {presentation}/></div>
{:else if layer.art}<div class="layer__image"><AdjustmentImage art={layer.art} alt={layer.art.altKey?$t(layer.art.altKey):layer.name} adjustments={layer.adjustments}/></div>
{:else if layer.kind!=='group'}<svg class="layer__paint" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">{#if layer.kind==='text'}<text x="0" y={text.top} {fill} font-size={text.size} font-family="Arial, sans-serif" font-weight="600">{#each text.lines as line,i}<tspan x="0" dy={i?text.lineHeight:0}>{line}</tspan>{/each}</text>{:else if layer.kind==='ellipse'}<ellipse cx={width/2} cy={height/2} rx={width/2} ry={height/2} {fill}/>{:else}<rect {width} {height} {fill}/>{/if}</svg>{/if}
