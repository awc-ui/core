try {
  const root = document.documentElement;
  root.lang = localStorage.getItem("sentinel.language") === "ar" ? "ar" : "en";
  const theme = localStorage.getItem("sentinel.theme");
  root.dataset.theme = theme === "light" ? "light" : "dark";
  const density = localStorage.getItem("sentinel.density");
  if (density === "0") root.removeAttribute("data-density");
  else
    root.dataset.density = ["-1", "-2", "-3", "-4"].includes(density)
      ? density
      : "-1";
  const direction = localStorage.getItem("sentinel.direction");
  root.dir = ["ltr", "rtl"].includes(direction)
    ? direction
    : root.lang === "ar"
      ? "rtl"
      : "ltr";
} catch {}
