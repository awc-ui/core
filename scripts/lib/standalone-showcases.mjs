/** Standalone applications staged alongside the cross-framework showcases. */
export const STANDALONE_SHOWCASES = Object.freeze([
  {
    id: "aero",
    title: "Aero",
    frameworks: ["react"],
    required: ["favicon.svg"],
  },
  {
    id: "smart-home",
    title: "Habitat — Maple House",
    frameworks: ["html"],
    required: ["awc/md3.esm.js", "awc/md3.css", "app.js", "vendor/awc-theme.mjs", "images/living-room.png"],
  },
  {
    id: "encore",
    title: "Encore",
    frameworks: ["html", "react", "vue", "angular", "svelte"],
    required: ["awc/md3.esm.js", "awc/md3.css"],
    extra: { html: ["app.js", "model.js"] },
  },
  {
    id: "frame",
    title: "Frame",
    frameworks: ["html", "react", "vue", "angular", "svelte"],
    required: ["awc/md3.esm.js", "awc/md3.css"],
    extra: { html: ["player.js"] },
  },
  {
    id: "medflow",
    title: "Medflow",
    frameworks: ["html"],
    required: [
      "awc/md3.esm.js",
      "awc/md3.css",
      "bootstrap.js",
      "app.js",
      "vendor/theme.js",
    ],
  },
  {
    id: "pharma",
    title: "Vela",
    frameworks: ["html"],
    required: [
      "awc/md3.esm.js",
      "awc/md3.css",
      "bootstrap.js",
      "app.js",
      "vendor/theme.js",
    ],
  },
  {
    id: "booking",
    title: "Roam",
    frameworks: ["html"],
    required: [
      "awc/md3.esm.js",
      "awc/md3.css",
      "bootstrap.js",
      "app.js",
      "vendor/theme.js",
    ],
  },
  {
    id: "metro-monitor",
    title: "Metro pulse",
    frameworks: ["react"],
    required: [],
  },
  {
    id: "scada",
    title: "Sentinel",
    frameworks: ["html"],
    required: [
      "awc/md3.esm.js",
      "awc/md3.css",
      "app.js",
      "vendor/awc-theme.mjs",
    ],
  },
]);
