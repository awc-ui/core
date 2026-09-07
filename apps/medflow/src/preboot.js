(() => {
  const root = document.documentElement;
  const read = (key) => {
    try {
      return localStorage.getItem(`medflow-${key}`);
    } catch {
      return null;
    }
  };
  root.dataset.railExpanded =
    read("rail-expanded") === "false" ? "false" : "true";
  const theme = read("theme");
  root.dataset.theme = ["light", "dark"].includes(theme)
    ? theme
    : matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  const density = read("density");
  if (density === "0") delete root.dataset.density;
  else
    root.dataset.density = ["-1", "-2", "-3", "-4"].includes(density)
      ? density
      : "-1";
  root.lang = read("language") === "ar" ? "ar" : "en";
  const direction = read("direction");
  root.dir = ["rtl", "ltr"].includes(direction)
    ? direction
    : root.lang === "ar"
      ? "rtl"
      : "ltr";
  try {
    const primary = JSON.parse(read("primary"));
    if (/^#[0-9a-f]{6}$/i.test(primary?.hex)) {
      root.dataset.primary = primary.hex.toUpperCase();
      // The library-generated stylesheet is cached for the first paint.
      if (typeof primary.css === "string" && primary.css.length < 20000)
        document.getElementById("medflow-primary-theme").textContent =
          primary.css;
    }
  } catch {
    // Discard invalid saved color preferences, keeping the default theme.
  }
})();
