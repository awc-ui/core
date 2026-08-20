# @awc-ui/vue

Vue 3 bindings for [AWC UI](https://www.npmjs.com/package/@awc-ui/core) — Material Design 3 web components.

## Install

```bash
npm install @awc-ui/vue @awc-ui/core
```

Requires Vue 3.

## Usage

Register the plugin once (it loads the custom elements and teaches Vue's compiler about `md-*` tags):

```ts
// main.ts
import { createApp } from 'vue';
import { AwcUiVue } from '@awc-ui/vue';
import App from './App.vue';

createApp(App).use(AwcUiVue).mount('#app');
```

Then use the typed component wrappers:

```vue
<script setup lang="ts">
import { MdButton } from '@awc-ui/vue';
</script>

<template>
  <MdButton variant="filled">Click me</MdButton>
</template>
```

## Documentation

Component docs, theming, and per-component manuals ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).
