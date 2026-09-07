import type { ClientInit } from '@sveltejs/kit';
import { awcHydration } from '$lib/awc';

export const init: ClientInit = () => awcHydration.capture();
