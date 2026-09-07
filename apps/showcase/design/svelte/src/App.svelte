<script lang="ts">
import {onDestroy} from 'svelte';import {model} from '$lib/document';import {pathname} from '$lib/router';import {route} from '$lib/routes';
import AppFrame from '$lib/components/AppFrame.svelte';import ProjectsScreen from '$lib/screens/ProjectsScreen.svelte';import ProjectScreen from '$lib/screens/ProjectScreen.svelte';import AssetsScreen from '$lib/screens/AssetsScreen.svelte';import AssetScreen from '$lib/screens/AssetScreen.svelte';import EditorScreen from '$lib/screens/EditorScreen.svelte';import ProfileScreen from '$lib/screens/ProfileScreen.svelte';import NotFoundScreen from '$lib/screens/NotFoundScreen.svelte';
$: project=/^\/p\/([^/]+)\/$/.exec($pathname);$: file=/^\/f\/([^/]+)\/$/.exec($pathname);$: asset=/^\/a\/([^/]+)\/$/.exec($pathname);
const decode=(value:string)=>{try{return decodeURIComponent(value)}catch{return ''}};
onDestroy(()=>model.dispose());
</script>
<AppFrame>{#if $pathname===route.projects()}<ProjectsScreen/>{:else if $pathname===route.editor()}<EditorScreen/>{:else if $pathname===route.assets()}<AssetsScreen/>{:else if $pathname===route.profile()}<ProfileScreen/>{:else if project}<ProjectScreen slug={decode(project[1])}/>{:else if file}<EditorScreen fileId={decode(file[1])}/>{:else if asset}<AssetScreen assetId={decode(asset[1])}/>{:else}<NotFoundScreen/>{/if}</AppFrame>
