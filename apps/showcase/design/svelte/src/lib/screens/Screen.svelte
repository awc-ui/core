<script lang="ts">
import {t} from '$lib/showcase';

import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';import {crumbsFor} from '$lib/routes';import {pathname} from '$lib/router';export let title:string;export let subtitle:string=undefined;export let crumbLabel:string=undefined;
$: crumbs=crumbsFor($pathname,crumbLabel??null);
</script>
<div class="shell__trail">{#if crumbs.length}<Breadcrumbs {crumbs}/>{/if}</div><div class="screen-head"><div class="screen-head__text"><h1>{title}</h1>{#if subtitle}<p>{subtitle}</p>{/if}</div>{#if $$slots.aside}<div class="screen-head__aside"><slot name="aside"/></div>{/if}</div>{#if $$slots.actions}<div class="screen-toolbar"><md-toolbar variant="floating" color="vibrant" aria-label={$t('Screen actions')}><slot name="actions"/></md-toolbar></div>{/if}<div class="screen-stage"><div class="screen-body"><slot/></div></div>
