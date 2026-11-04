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

    // Recordings: data-video="/path/name-{theme}" has name-{theme}.mp4 and
    // name-{theme}-poster.webp. The swap keeps the playback position.
    document.querySelectorAll("video[data-video]").forEach((video) => {
      const base = video.dataset.video.replace("{theme}", theme);
      if (video.getAttribute("src") === `${base}.mp4`) return;
      const time = video.currentTime;
      const playing = !video.paused;
      video.poster = `${base}-poster.webp`;
      video.src = `${base}.mp4`;
      if (time) video.addEventListener("loadedmetadata", () => { video.currentTime = time; }, { once: true });
      if (playing) video.play().catch(() => {});
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

  // ---------- Traveling phone ----------
  // On wide screens the hero phone stays put on screen while the page
  // scrolls, slides across, and lands in the Show section's empty
  // .phone-slot. The phone never leaves its place in the layout; it only
  // gets a transform. Narrow screens hide the slot and skip all this.

  const phone = document.querySelector("[data-travel]");
  const slot = document.querySelector("[data-travel-slot]");
  const heroCopy = document.querySelector(".hero-copy");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  if (reduceMotion.matches) {
    document.querySelectorAll("video[autoplay]").forEach((v) => { v.removeAttribute("autoplay"); v.pause(); });
  }

  if (phone && slot) {
    const wide = window.matchMedia("(min-width: 881px)");
    let dx = 0;
    let distance = 0;
    let active = false;
    let frame = 0;

    const clamp = (v) => Math.min(1, Math.max(0, v));
    const smooth = (v) => v * v * (3 - 2 * v);

    // The Show copy scrolls into view while the phone is still on the
    // right, so it stays hidden until the phone has crossed out of its way.
    const showCopy = slot.parentElement.querySelector(".copy");
    let slideEnd = 0;
    let clearAt = 1;

    function measure() {
      phone.style.transform = "";
      if (heroCopy) heroCopy.style.opacity = "";
      if (showCopy) showCopy.style.opacity = "";
      active = false;
      if (!wide.matches) return;
      if (reduceMotion.matches) {
        // No travel: the slot gets its own copy of the phone.
        if (!slot.firstChild) slot.append(phone.cloneNode(true));
        return;
      }
      slot.textContent = "";
      const from = phone.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      dx = to.left - from.left;
      distance = to.top - from.top;
      slideEnd = distance * 0.3;
      // How far across the phone is when its right edge clears the copy.
      clearAt = showCopy && dx < 0
        ? Math.min(0.95, clamp((from.right + 24 - showCopy.getBoundingClientRect().left) / -dx))
        : 0;
      active = distance > 0 && dx < 0;
      update();
    }

    function update() {
      frame = 0;
      if (!active) return;
      const y = Math.min(window.scrollY, distance);
      // Across in the first 30% of the trip, then it rides down to the slot.
      const p = smooth(clamp(y / slideEnd));
      phone.style.transform = `translate3d(${(dx * p).toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      if (heroCopy) heroCopy.style.opacity = String(1 - clamp(p / 0.45));
      if (showCopy) showCopy.style.opacity = String(clamp((p - clearAt) / (1 - clearAt)));
    }

    window.addEventListener("scroll", () => { if (active && !frame) frame = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    wide.addEventListener("change", measure);
    reduceMotion.addEventListener("change", measure);
    measure();
  }

  // ---------- Show demo ----------
  // The player itself is in show-player.js, loaded before this file.

  const demo = document.getElementById("show-demo");
  if (demo && demo.dataset.show && window.RimshotShowPlayer) {
    window.RimshotShowPlayer.mount(demo, JSON.parse(demo.dataset.show));
  }
})();
