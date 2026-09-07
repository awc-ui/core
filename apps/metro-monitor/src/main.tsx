import "./awc-compat.mjs";
import React from "react";
import { createRoot } from "react-dom/client";
import "@awc-ui/core/css/tokens.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "material-symbols/outlined.css";
import "./styles.css";
import { App } from "./App";
import { applyAppearance, readAppearance } from "./appearance.mjs";
import { initializeLanguage } from "./i18n.mjs";
import "./localization.css";
applyAppearance(readAppearance());
initializeLanguage();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
