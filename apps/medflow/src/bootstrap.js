import { t } from "./i18n.js";
import { escapeHtml as esc } from "./model.js";

const label = document.querySelector("#boot-label");
if (label) label.textContent = t("Opening clinical workspace…");
try {
  await import("./app.js");
} catch {
  const app = document.querySelector("#app");
  // A plain navigation link still works when the component library itself failed.
  app.innerHTML = `<main id="main" class="bootstrap-loading page-load-error"><h1>Medflow</h1><p role="alert">${esc(t("The workspace could not finish loading. Please try again."))}</p><a id="retry-bootstrap" href="${esc(location.href)}">${esc(t("Retry loading"))}</a></main>`;
  app.querySelector("#retry-bootstrap").addEventListener("click", (event) => {
    event.preventDefault();
    location.reload();
  });
}
