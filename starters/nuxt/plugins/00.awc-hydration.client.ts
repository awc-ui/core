import { preserveSsrClasses } from '@awc-ui/core/ssr/classes';

// Run before Vue claims class attributes; retain native DSD styling meanwhile.
export default defineNuxtPlugin({
  name: 'awc-ssr-classes',
  enforce: 'pre',
  setup(nuxtApp) {
    const finish = preserveSsrClasses();
    nuxtApp.hook('app:mounted', finish);
  },
});
