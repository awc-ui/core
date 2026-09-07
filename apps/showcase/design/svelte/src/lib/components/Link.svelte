<script lang="ts">import {navigate,isPlainClick} from '$lib/router';import {withBase} from '$lib/routes';export let href:string;
function follow(event:MouseEvent){if(isPlainClick(event)){event.preventDefault();navigate(href)}}
</script>
<a href={withBase(href)} {...$$restProps} on:click={follow}><slot/></a>
