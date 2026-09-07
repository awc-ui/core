import { readable } from 'svelte/store';
import { createDocumentStore } from '@awc-ui/pictor-model';
export const model=createDocumentStore();
export const document=readable(model.getSnapshot(), set=>model.subscribe(()=>set(model.getSnapshot())));
