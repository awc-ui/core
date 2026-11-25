import { defineCustomElements } from '@awc-ui/core/loader';
import { mount } from 'svelte';
import { activateDeferredFontStylesheet } from '../../shared/deferred-fonts';
import App from './App.svelte';

activateDeferredFontStylesheet();
defineCustomElements(window);

mount(App, { target: document.getElementById('app')! });
