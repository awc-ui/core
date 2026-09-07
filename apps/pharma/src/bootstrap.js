try {
  await import("./app.js");
} catch (error) {
  console.error("Vela could not start", error);
  document.getElementById("app").innerHTML =
    '<main id="main" class="startup"><p class="eyebrow">Vela / Research operations</p><h1>Your workspace could not load.</h1><p>Please reload to try again.</p><a href="">Reload workspace</a></main>';
}
