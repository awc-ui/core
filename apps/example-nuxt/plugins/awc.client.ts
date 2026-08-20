// Client-only: register the custom elements so the server-rendered Declarative
// Shadow DOM hydrates. (defineCustomElements self-guards `window`.)
import { defineNuxtPlugin } from '#app';
import { defineCustomElements } from '@awc-ui/core/loader';

export default defineNuxtPlugin(() => {
  defineCustomElements(window);
});
