// Rimshot — /s/, a shared show.
//
// The apps share a show as https://getrimshot.com/s/#1.<data>, where <data> is
// base64url (no padding) of raw DEFLATE of the show's JSON. The show lives in
// the fragment, so it never reaches the server. This page decodes it, plays it
// with show-player.js and offers to open it in the app.

(() => {
  const APP_STORE = "https://apps.apple.com/us/app/rimshot-metronome/id6816163060";
  const ANDROID_BETA = "https://getrimshot.com/android/";

  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  // iPadOS reports itself as a Mac, so tell them apart by touch.
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  const showEl = document.getElementById("share-show");
  const errorEl = document.getElementById("share-error");
  const openBtn = showEl.querySelector("[data-open-app]");
  const getBtn = showEl.querySelector("[data-get-app]");
  const hint = showEl.querySelector("[data-open-hint]");
  const qrCard = showEl.querySelector("[data-qr]");
  const defaultTitle = document.title;
  let player = null;

  // ---------- Decoding ----------

  function canInflate() {
    if (typeof DecompressionStream === "undefined") return false;
    try {
      new DecompressionStream("deflate-raw");
      return true;
    } catch (e) {
      return false;
    }
  }

  function fail(reason) {
    const error = new Error(reason);
    error.reason = reason;
    return error;
  }

  async function decodeShow(hash) {
    const payload = hash.replace(/^#/, "");
    const dot = payload.indexOf(".");
    if (dot < 0 || payload.length > 65536) throw fail("unreadable");
    const version = payload.slice(0, dot);
    if (version !== "1") throw fail(/^\d+$/.test(version) && Number(version) > 1 ? "newer" : "unreadable");
    if (!canInflate()) throw fail("browser");
    try {
      let b64 = payload.slice(dot + 1).replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return normalize(JSON.parse(await new Response(stream).text()));
    } catch (e) {
      throw e.reason ? e : fail("unreadable");
    }
  }

  function clamp(value, lo, hi, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
  }

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  const ACCENTS = { a: "accented", n: "normal", s: "silent" };

  // Applies the defaults and limits the apps use, and turns the short keys
  // into the groups show-player.js plays. Unknown keys are ignored.
  function normalize(json) {
    if (!json || !Array.isArray(json.g) || !json.g.length) throw fail("unreadable");
    const groups = [];
    json.g.forEach((raw, i) => {
      const g = raw && typeof raw === "object" ? raw : {};
      const sig = /^(\d+)\/(\d+)$/.exec(text(g.t));
      const beats = sig ? clamp(sig[1], 1, 12, 4) : 4;
      const unit = sig ? clamp(sig[2], 1, 32, 4) : 4;
      const bpm = clamp(g.b ?? 120, 40, 300, 120);
      // A linked ramp starts at the previous group's tempo. On the first group it isn't linked.
      const linked = Number(g.f) === 1 && i > 0;
      let start = null;
      if (linked) start = groups[i - 1].bpm;
      else if (g.r != null) start = clamp(g.r, 40, 300, bpm);
      const letters = text(g.a);
      groups.push({
        count: clamp(g.m ?? 1, 1, 999, 1),
        beats,
        unit,
        bpm,
        start,
        accents: Array.from({ length: beats }, (_, b) => ACCENTS[letters[b]] || (b === 0 ? "accented" : "normal")),
        sub: g.d === 2 || g.d === 3 ? g.d : 1,
        section: text(g.s),
        notes: text(g.c),
      });
    });
    return { name: text(json.n) || "Shared Show", groups };
  }

  // ---------- Rendering ----------

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  function clock(seconds) {
    const s = Math.max(1, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function renderShow(show, payload) {
    const measures = show.groups.reduce((sum, g) => sum + g.count, 0);
    showEl.querySelector("[data-show-name]").textContent = show.name;
    showEl.querySelector("[data-show-summary]").textContent =
      `${plural(show.groups.length, "group")} · ${plural(measures, "measure")} · about ${clock(window.RimshotShowPlayer.duration(show.groups))}`;
    document.title = `${show.name} · Rimshot`;

    if (player) player.destroy();
    player = window.RimshotShowPlayer.mount(document.getElementById("show-demo"), show.groups);

    const d = encodeURIComponent(payload);
    hint.hidden = true;
    setPrimary(openBtn);
    if (isIOS) {
      openBtn.href = `rimshot://s?d=${d}`;
    } else if (isAndroid) {
      openBtn.href = `intent://s?d=${d}#Intent;scheme=rimshot;package=com.neildembla.rimshot;S.browser_fallback_url=${encodeURIComponent(ANDROID_BETA)};end`;
    } else {
      // On a computer, the phone is where the app is.
      openBtn.hidden = true;
      setPrimary(getBtn);
      showQR(location.href);
    }

    errorEl.hidden = true;
    showEl.hidden = false;
  }

  const ERRORS = {
    unreadable: ["This show link is incomplete.", "Ask whoever sent it to share it again."],
    newer: ["This show needs a newer Rimshot.", "It was shared from a newer version of Rimshot. Open it in the app."],
    browser: ["This browser can't open shared shows.", "Update it, or open the link in Rimshot."],
  };

  function renderError(reason) {
    if (player) {
      player.destroy();
      player = null;
    }
    const [title, body] = ERRORS[reason] || ERRORS.unreadable;
    errorEl.querySelector("[data-error-title]").textContent = title;
    errorEl.querySelector("[data-error-text]").textContent = body;
    document.title = defaultTitle;
    showEl.hidden = true;
    errorEl.hidden = false;
  }

  function setPrimary(btn) {
    [openBtn, getBtn].forEach((b) => {
      const primary = b === btn;
      b.classList.toggle("btn-primary", primary);
      b.classList.toggle("btn-secondary", !primary);
    });
  }

  async function load() {
    const payload = location.hash.replace(/^#/, "");
    try {
      renderShow(await decodeShow(payload), payload);
    } catch (e) {
      renderError(e.reason);
    }
  }

  // ---------- Open in Rimshot ----------
  // On iOS, Safari shows an error for rimshot:// when the app isn't installed
  // and the page stays put. If it's still here after 1.5 s, the app didn't open.

  let fallback = 0;
  const cancelFallback = () => clearTimeout(fallback);

  openBtn.addEventListener("click", () => {
    if (!isIOS) return;
    cancelFallback();
    fallback = setTimeout(() => {
      setPrimary(getBtn);
      hint.hidden = false;
    }, 1500);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelFallback();
  });
  window.addEventListener("pagehide", cancelFallback);

  if (!isAndroid) getBtn.href = APP_STORE;

  // ---------- QR code (computers only) ----------

  function showQR(url) {
    const draw = () => {
      const svg = qrSVG(url);
      const slot = qrCard.querySelector("[data-qr-code]");
      slot.textContent = "";
      if (!svg) return;
      slot.append(svg);
      qrCard.hidden = false;
    };
    if (window.qrcode) return draw();
    const script = document.createElement("script");
    script.src = "/assets/js/qrcode.js";
    script.onload = draw;
    document.head.append(script);
  }

  // Dark modules on white, with a quiet zone, so any camera reads it in either theme.
  function qrSVG(url) {
    let qr = null;
    for (const level of ["M", "L"]) {
      try {
        qr = window.qrcode(0, level);
        qr.addData(url);
        qr.make();
        break;
      } catch (e) {
        qr = null; // Too long for this level.
      }
    }
    if (!qr) return null;
    const n = qr.getModuleCount();
    let d = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `-3 -3 ${n + 6} ${n + 6}`);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("aria-hidden", "true");
    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("x", "-3");
    bg.setAttribute("y", "-3");
    bg.setAttribute("width", n + 6);
    bg.setAttribute("height", n + 6);
    bg.setAttribute("fill", "#fff");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#000");
    svg.append(bg, path);
    return svg;
  }

  window.addEventListener("hashchange", load);
  load();
})();
