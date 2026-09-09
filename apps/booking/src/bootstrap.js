try {
  await import("./app.js");
} catch (error) {
  console.error("Roam could not start", error);
  document.getElementById("startup").innerHTML = '<h1>Your getaway could not load.</h1><p>Please reload to try again.</p><a href="">Reload Roam</a>';
  document.getElementById("startup").hidden = false;
}
