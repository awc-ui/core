# Vue Web Components and Nuxt SSR — @awc-ui/vue

`@awc-ui/vue` provides typed Vue 3 wrappers that register their underlying
custom elements when imported.

```bash
npm install @awc-ui/vue @awc-ui/core
```

Load the theme once in your application entry:

```ts
import '@awc-ui/core/css/tokens.css';
```

Use normal Vue component events and `v-model`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { MdButton, MdTextField } from '@awc-ui/vue';
const name = ref('');
</script>

<template>
  <MdTextField label="Project name" v-model="name" />
  <MdButton variant="filled">Create project</MdButton>
</template>
```

`@mdInput` and `@mdChange` receive the original `CustomEvent`; read its typed
`detail` payload. The model updates before the event handler runs. Text fields,
autocomplete and OTP update on `mdInput`; select, date/time and numeric controls
update on `mdChange`. Checkbox and switch models are booleans, multi-select
models are arrays, and radios sharing a model select an option by its `value`:

```vue
<MdRadio v-model="plan" name="plan" value="basic">Basic</MdRadio>
<MdRadio v-model="plan" name="plan" value="pro">Pro</MdRadio>
```

Import `MdRadio` from `@awc-ui/vue` and initialize `plan` to the selected option's
value. Individual wrapper imports need neither the plugin nor custom-element
compiler configuration.

## Raw custom elements in Vue

For raw `md-*` tags in precompiled `.vue` files, configure the build-time
compiler. With Vite:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue({
    template: {
      compilerOptions: { isCustomElement: (tag) => tag.startsWith('md-') },
    },
  })],
});
```

Register the raw elements used by the application with static imports:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import '@awc-ui/core/components/md-select';
const country = ref('');
</script>

<template>
  <md-select :value.prop="country" @mdChange="country = $event.detail" />
</template>
```

`AwcUiVue` remains available for lazy-loader registration and runtime-compiled
templates. Its runtime `app.config.compilerOptions` setting cannot configure
Vite's SFC compiler; raw tags still need the build-time setting above.

## Server rendering

See the [Vue and Nuxt SSR guide](https://awc-ui.dev/frameworks/vue/) for compiler configuration and server rendering.
