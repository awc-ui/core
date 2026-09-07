<script lang="ts">
import {t} from '$lib/showcase';
import Screen from './Screen.svelte';import {navigate} from '$lib/router';import {route} from '$lib/routes';</script><Screen title={$t('A little off canvas')} subtitle={$t('That design, project, or asset could not be found.')}><div class="pictor-empty"><span class="material-symbols-outlined" aria-hidden="true">explore_off</span><h2>{$t('Let\'s find your next idea.')}</h2><!-- AWC owns keyboard activation inside its shadow control. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<md-button variant="filled" on:click={()=>navigate(route.projects())}>{$t('Back to projects')}</md-button></div></Screen>