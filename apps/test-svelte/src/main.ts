import { defineCustomElements } from '@awc-ui/core/loader';
import { mount } from 'svelte';
import App from './App.svelte';

defineCustomElements(window);

mount(App, { target: document.getElementById('app')! });
