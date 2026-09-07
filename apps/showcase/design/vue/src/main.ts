import { createApp } from "vue";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "material-symbols/outlined.css";
import "@awc-ui/core/css/tokens.css";
// The library's pre-upgrade size floors: every layout-critical `md-*` holds its
// settled box from the FIRST frame, before its lazy chunk arrives, and each
// rule self-retires on `.hydrated`.
import "@awc-ui/core/css/pre-upgrade.css";
import "@awc-ui/showcase-kit/design/app.css";
import "@awc-ui/pictor-model/styles.css";
// The bare import registers `<awc-showcase-dock>` and, on the client, stamps the
// persisted/URL state onto <html>. Nothing here listens for
// `awc-showcase-change`: `composables/useShowcase.ts` owns the one subscription,
// and a second listener would re-render every screen twice per change.
import "@awc-ui/showcase-kit/dock";
import App from "~/App.vue";
import { awcDirective } from "~/lib/awc";
import { startRouter } from "~/lib/router";

const container = document.getElementById("root");
if (!container) throw new Error("[showcase] #root is missing from index.html");

const app = createApp(App);
app.directive("awc", awcDirective);
startRouter();
app.mount(container);

const runtimeUrl = `${import.meta.env.BASE_URL}awc-runtime/md3/md3.esm.js`;
import(/* @vite-ignore */ runtimeUrl).catch((error: unknown) => {
  console.error("[awc-ui] component registration failed", runtimeUrl, error);
});
