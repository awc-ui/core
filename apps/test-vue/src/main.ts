import { createApp } from 'vue';
import { defineCustomElements } from '@awc-ui/core/loader';
import { activateDeferredFontStylesheet } from '../../shared/deferred-fonts';
import App from './App.vue';

activateDeferredFontStylesheet();
defineCustomElements(window);

const app = createApp(App);
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('md-');
app.mount('#app');
