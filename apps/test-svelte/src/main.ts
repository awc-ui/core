import { defineCustomElements } from '@awc-ui/core/loader';
import '@awc-ui/tokens/tokens.css';
import 'material-icons/iconfont/material-icons.css';
import 'material-symbols/outlined.css';
import { mount } from 'svelte';
import App from './App.svelte';

defineCustomElements(window);

mount(App, { target: document.getElementById('app')! });
