import { createApp } from 'vue';
import { defineCustomElements } from '@awc-ui/core/loader';
import '@awc-ui/tokens/tokens.css';
import 'material-icons/iconfont/material-icons.css';
import 'material-symbols/outlined.css';
import App from './App.vue';

defineCustomElements(window);

const app = createApp(App);
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith('md-');
app.mount('#app');
