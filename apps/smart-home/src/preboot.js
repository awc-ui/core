try {
  const root = document.documentElement;
  root.dataset.theme =
    localStorage.getItem("habitat.theme") === "dark" ? "dark" : "light";
  const density = localStorage.getItem("habitat.density");
  if (["-1", "-2", "-3", "-4"].includes(density))
    root.dataset.density = density;
  root.lang = localStorage.getItem("habitat.language") === "ar" ? "ar" : "en";
  root.dir =
    localStorage.getItem("habitat.direction") === "rtl" ? "rtl" : "ltr";
} catch {}
