// Rimshot — getrimshot.com

(() => {
  const root = document.documentElement;

  // ---------- Theme ----------

  const THEME_COLORS = { dark: "#000000", light: "#efe9dc" };

  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll("[data-set-theme]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.setTheme === theme));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[theme];
    showScreenshots(theme);
  }

  // ---------- Screenshots ----------
  // Each .screen has data-shot="/path/{theme}/name", with name.webp (828px)
  // and name-640.webp beside it. The markup points at the dark set, so
  // crawlers and the preload scanner find it; light-theme visitors get the
  // light set swapped in. If a file is missing, fall back to the other
  // theme, then to the labeled placeholder.

  function showScreenshots(theme) {
    const other = theme === "dark" ? "light" : "dark";
    document.querySelectorAll(".screen[data-shot]").forEach((screen) => {
      const img = screen.querySelector("img.shot");
      if (!img) return;
      const base = (t) => screen.dataset.shot.replace("{theme}", t);
      const url = (t) => `${base(t)}.webp`;
      const use = (t) => {
        img.dataset.variant = t;
        img.srcset = `${base(t)}-640.webp 640w, ${url(t)} 828w`;
        img.src = url(t);
      };
      img.onerror = () => {
        if (img.dataset.variant === theme) {
          use(other);
        } else {
          img.hidden = true;
          screen.classList.add("is-missing");
        }
      };
      img.hidden = false;
      screen.classList.remove("is-missing");
      if (img.getAttribute("src") !== url(theme)) use(theme);
      else img.dataset.variant = theme;
    });
  }

  document.querySelectorAll("[data-set-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.setTheme;
      applyTheme(theme);
      try { localStorage.setItem("theme", theme); } catch (e) {}
    });
  });

  applyTheme(root.dataset.theme === "light" ? "light" : "dark");

  // ---------- Platform ----------
  // On Android, "Get the app" leads to the beta steps instead of the App Store.

  if (root.dataset.platform === "android") {
    document.querySelectorAll("[data-get-app]").forEach((a) => (a.href = "/android/"));
  }

  // ---------- Nav hairline on scroll ----------

  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---------- Accent swatches (page-only preview, not saved) ----------

  const swatches = document.querySelectorAll(".swatch");
  swatches.forEach((sw) => {
    sw.addEventListener("click", () => {
      root.style.setProperty("--accent-l", sw.style.getPropertyValue("--c-l"));
      root.style.setProperty("--accent-d", sw.style.getPropertyValue("--c-d"));
      root.style.setProperty("--ink-l", sw.dataset.inkL);
      root.style.setProperty("--ink-d", sw.dataset.inkD);
      swatches.forEach((s) => s.setAttribute("aria-checked", String(s === sw)));
    });
  });

  // Arrow keys move between swatches, like a native radio group.
  const swatchGroup = document.querySelector(".swatches");
  if (swatchGroup) {
    swatchGroup.addEventListener("keydown", (e) => {
      const list = [...swatches];
      const i = list.indexOf(document.activeElement);
      if (i < 0) return;
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = list[(i + step + list.length) % list.length];
      next.focus();
      next.click();
    });
  }

  // ---------- Show demo ----------
  // The player itself is in show-player.js, loaded before this file.

  const demo = document.getElementById("show-demo");
  if (demo && demo.dataset.show && window.RimshotShowPlayer) {
    window.RimshotShowPlayer.mount(demo, JSON.parse(demo.dataset.show));
  }
})();
