(() => {
  try {
    const prefs = JSON.parse(
      localStorage.getItem("vela.preferences.v1") || "{}",
    );
    document.documentElement.dataset.theme =
      prefs.theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.density = [0, -1, -2].includes(
      prefs.density,
    )
      ? prefs.density
      : -1;
    document.documentElement.dir = prefs.rtl === true ? "rtl" : "ltr";
    const css = localStorage.getItem("vela.theme.css");
    if (css) document.getElementById("vela-primary-theme").textContent = css;
  } catch {
    /* Defaults remain usable when storage is unavailable. */
  }
})();
