# Vue Web Components and Nuxt SSR — @awc-ui/vue

Typed Vue 3 components for [AWC UI](https://www.npmjs.com/package/@awc-ui/core) — accessible Material Design 3 Web Components with automatic registration and Nuxt SSR support.

## Install

```bash
npm install @awc-ui/vue @awc-ui/core
```

Requires Vue 3.

## Usage

Register the plugin once (it loads the custom elements and teaches Vue's compiler about `md-*` tags):

```ts
// main.ts
import { createApp } from "vue";
import { AwcUiVue } from "@awc-ui/vue";
import App from "./App.vue";

createApp(App).use(AwcUiVue).mount("#app");
```

Then use the typed component wrappers:

```vue
<script setup lang="ts">
import { MdButton } from "@awc-ui/vue";
</script>

<template>
  <MdButton variant="filled">Click me</MdButton>
</template>
```

## Documentation

[Vue and Nuxt SSR guide](https://awc-ui.dev/frameworks/vue/) · [All component docs](https://awc-ui.dev/components/)

Component manuals and AI-readable documentation also ship with [`@awc-ui/core`](https://www.npmjs.com/package/@awc-ui/core).
