import { APP_BASE_HREF } from "@angular/common";
import {
  APP_INITIALIZER,
  type ApplicationConfig,
  provideZoneChangeDetection,
} from "@angular/core";
import {
  UrlSerializer,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
} from "@angular/router";
import { PREBOOT_SCRIPT } from "@awc-ui/showcase-kit/preboot";
import { routes } from "./app.routes";
import { BASE } from "./lib/studio.service";
import { PictorUrlSerializer } from "./lib/angular-routes";
function bootScripts() {
  return () => {
    if (!document.querySelector("[data-awc-preboot]")) {
      const preboot = document.createElement("script");
      preboot.dataset["awcPreboot"] = "";
      preboot.textContent = PREBOOT_SCRIPT;
      document.head.appendChild(preboot);
    }
    return import("@awc-ui/showcase-kit/dock");
  };
}
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: UrlSerializer, useClass: PictorUrlSerializer },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: "top" }),
    ),
    { provide: APP_BASE_HREF, useValue: BASE + "/" },
    { provide: APP_INITIALIZER, useFactory: bootScripts, multi: true },
  ],
};
