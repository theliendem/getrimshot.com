// Rimshot — getrimshot.com

(() => {
  const root = document.documentElement;

  // ---------- Theme ----------

  const THEME_COLORS = { dark: "#000000", light: "#f2f2f7" };

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
  // Each .screen has data-shot="/path/{theme}/name.jpg". Only the current
  // theme's file is requested; if it's missing, fall back to the other
  // theme, then to the labeled placeholder.

  function showScreenshots(theme) {
    const other = theme === "dark" ? "light" : "dark";
    document.querySelectorAll(".screen[data-shot]").forEach((screen) => {
      const img = screen.querySelector("img.shot");
      if (!img) return;
      const url = (t) => screen.dataset.shot.replace("{theme}", t);
      const use = (t) => {
        img.dataset.variant = t;
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

  const demo = document.getElementById("show-demo");
  if (demo) initShowDemo(demo);

  function initShowDemo(el) {
    const groups = JSON.parse(el.dataset.show);
    const timeline = el.querySelector(".timeline");
    const button = el.querySelector("[data-play]");
    const label = button.querySelector("span");
    const iconPlay = button.querySelector(".i-play");
    const iconStop = button.querySelector(".i-stop");
    const readout = {};
    el.querySelectorAll("[data-r]").forEach((n) => (readout[n.dataset.r] = n));

    // Build the timeline and a flat list of beats to schedule.
    const beats = [];
    let measureNo = 0;
    groups.forEach((g, gi) => {
      const beatDur = 60 / g.bpm;
      const groupEl = document.createElement("div");
      groupEl.className = "tl-group";
      groupEl.style.setProperty("--dur", (g.count * g.beats * beatDur).toFixed(3));
      groupEl.innerHTML =
        `<div class="tl-label"><strong>${g.count} × ${g.beats}/${g.unit}</strong><span>${g.bpm} BPM</span></div>`;
      const measuresEl = document.createElement("div");
      measuresEl.className = "tl-measures";
      for (let m = 0; m < g.count; m++) {
        measureNo++;
        const mEl = document.createElement("div");
        mEl.className = "tl-measure";
        for (let b = 0; b < g.beats; b++) {
          const bEl = document.createElement("div");
          bEl.className = "tl-beat";
          mEl.appendChild(bEl);
          beats.push({
            el: bEl,
            measureEl: mEl,
            downbeat: b === 0,
            dur: beatDur,
            measure: measureNo,
            group: gi,
          });
        }
        measuresEl.appendChild(mEl);
      }
      groupEl.appendChild(measuresEl);
      timeline.appendChild(groupEl);
    });

    let ctx = null;
    let master = null;
    let playing = false;
    let timer = 0;
    let raf = 0;
    let nextIndex = 0;
    let nextTime = 0;
    let endTime = 0;
    let queue = [];
    let voices = [];
    let current = -1;

    function setReadouts(beat) {
      const g = groups[beat.group];
      readout.measure.textContent = beat.measure;
      readout.bpm.textContent = g.bpm;
      readout.time.textContent = `${g.beats}/${g.unit}`;
      readout.group.textContent = `${beat.group + 1} of ${groups.length}`;
    }

    function resetView() {
      beats.forEach((b) => b.el.classList.remove("is-now", "is-done"));
      timeline.querySelectorAll(".is-now").forEach((n) => n.classList.remove("is-now"));
      current = -1;
      setReadouts(beats[0]);
    }

    function showBeat(i) {
      if (current >= 0) {
        beats[current].el.classList.replace("is-now", "is-done");
        if (beats[current].measureEl !== beats[i].measureEl) {
          beats[current].measureEl.classList.remove("is-now");
        }
      }
      beats[i].el.classList.add("is-now");
      beats[i].measureEl.classList.add("is-now");
      if (current < 0 || beats[current].measure !== beats[i].measure) setReadouts(beats[i]);
      current = i;
    }

    function click(time, accent) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = accent ? 1760 : 1320;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(accent ? 0.9 : 0.55, time + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
      osc.connect(gain).connect(master);
      osc.start(time);
      osc.stop(time + 0.08);
      voices.push(osc);
      osc.onended = () => { voices = voices.filter((v) => v !== osc); };
    }

    // Look-ahead scheduler: audio is timed by the AudioContext clock,
    // visuals follow it on each animation frame.
    function schedule() {
      while (nextIndex < beats.length && nextTime < ctx.currentTime + 0.12) {
        const beat = beats[nextIndex];
        click(nextTime, beat.downbeat);
        queue.push({ time: nextTime, index: nextIndex });
        nextTime += beat.dur;
        nextIndex++;
      }
      if (nextIndex >= beats.length) {
        clearInterval(timer);
        endTime = nextTime;
      }
    }

    function draw() {
      const now = ctx.currentTime;
      while (queue.length && queue[0].time <= now) showBeat(queue.shift().index);
      if (nextIndex >= beats.length && !queue.length && now >= endTime) {
        stop();
        return;
      }
      raf = requestAnimationFrame(draw);
    }

    function setButton(on) {
      button.setAttribute("aria-pressed", String(on));
      label.textContent = on ? "Stop" : "Play";
      iconPlay.hidden = on;
      iconStop.hidden = !on;
    }

    async function play() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        // Let Safari play through the silent switch, like the app does.
        try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.7;
        master.connect(ctx.destination);
      }
      if (ctx.state !== "running") await ctx.resume();

      resetView();
      queue = [];
      nextIndex = 0;
      nextTime = ctx.currentTime + 0.08;
      endTime = Infinity;
      playing = true;
      setButton(true);
      schedule();
      timer = setInterval(schedule, 25);
      raf = requestAnimationFrame(draw);
    }

    function stop() {
      playing = false;
      clearInterval(timer);
      cancelAnimationFrame(raf);
      if (ctx) {
        const now = ctx.currentTime;
        voices.forEach((v) => { try { v.stop(now); } catch (e) {} });
      }
      voices = [];
      queue = [];
      resetView();
      setButton(false);
    }

    button.addEventListener("click", () => (playing ? stop() : play()));

    // Background tabs throttle timers, which would smear the click. Stop cleanly instead.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && playing) stop();
    });

    resetView();
  }
})();
