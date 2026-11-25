// Svelte claims light-DOM children by position, so temporarily detach Stencil's
// render comments before the framework starts walking the server document.
import type { ClientInit } from '@sveltejs/kit';
import { captureServerRender } from '$lib/adopt';

export const init: ClientInit = () => {
  captureServerRender();
};
