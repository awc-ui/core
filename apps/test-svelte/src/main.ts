import { defineCustomElements } from '@awc-ui/core/loader';
import '@awc-ui/tokens/tokens.css';
import 'material-icons/iconfont/material-icons.css';
import 'material-symbols/outlined.css';
import App from './App.svelte';

defineCustomElements(window);

new (App as any)({ target: document.getElementById('app')! });
