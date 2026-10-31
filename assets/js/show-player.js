// Rimshot — show player, shared by the homepage demos and /s/.
//
// Plays a show the way the apps do. BPM is a quarter-note tempo, so 7/8 at
// 160 clicks eighths at 320 a minute. A ramp moves from its start tempo to
// its end tempo beat by beat across the whole group. A silent beat makes no
// sound, including its subdivision clicks.
//
// A group is { count, beats, unit, bpm, start?, accents?, sub?, section?, notes? }:
// bpm is the end tempo, start is set only for a ramp, accents lists
// "accented", "normal" or "silent" per beat (default: beat 1 accented),
// and sub is 1, 2 or 3 clicks per beat.

window.RimshotShowPlayer = (() => {
  let ctx = null;
  let master = null;

  function beatDuration(tempo, unit) {
    return (60 / tempo) * (4 / unit);
  }

  function tempoAt(group, k) {
    const total = group.count * group.beats;
    if (group.start == null || total === 1) return group.bpm;
    return group.start + ((group.bpm - group.start) * k) / (total - 1);
  }

  function accentAt(group, b) {
    return (group.accents && group.accents[b]) || (b === 0 ? "accented" : "normal");
  }

  // Seconds from the first beat to the end of the last, without a count-in.
  function duration(groups) {
    let seconds = 0;
    groups.forEach((g) => {
      for (let k = 0; k < g.count * g.beats; k++) seconds += beatDuration(tempoAt(g, k), g.unit);
    });
    return seconds;
  }

  function tempoLabel(g) {
    return g.start == null ? `${g.bpm} BPM` : `${g.start}→${g.bpm} BPM`;
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // Builds the timeline and wires the Play button inside `el`, which holds the
  // same markup as the homepage #show-demo. Returns { destroy }.
  function mount(el, groups) {
    const timeline = el.querySelector(".timeline");
    const button = el.querySelector("[data-play]");
    const label = button.querySelector("span");
    const iconPlay = button.querySelector(".i-play");
    const iconStop = button.querySelector(".i-stop");
    const countInToggle = el.querySelector("[data-count-in]");
    const readout = {};
    el.querySelectorAll("[data-r]").forEach((n) => (readout[n.dataset.r] = n));
    const measureLabel = readout.measure.previousElementSibling;

    // Build the timeline and a flat list of beats to schedule.
    const beats = [];
    let measureNo = 0;
    timeline.textContent = "";
    groups.forEach((g, gi) => {
      const groupEl = make("div", "tl-group");
      groupEl.style.setProperty("--dur", duration([g]).toFixed(3));
      const labelEl = make("div", "tl-label");
      if (g.section) labelEl.append(make("span", "tl-section", g.section));
      labelEl.append(make("strong", null, `${g.count} × ${g.beats}/${g.unit}`), make("span", null, tempoLabel(g)));
      groupEl.append(labelEl);
      if (g.notes) groupEl.append(make("p", "tl-note", g.notes));
      const measuresEl = make("div", "tl-measures");
      let k = 0;
      for (let m = 0; m < g.count; m++) {
        measureNo++;
        const mEl = make("div", "tl-measure");
        mEl.style.setProperty("--beats", g.beats);
        for (let b = 0; b < g.beats; b++, k++) {
          const accent = accentAt(g, b);
          const bEl = make("div", accent === "silent" ? "tl-beat is-silent" : "tl-beat");
          mEl.append(bEl);
          const tempo = tempoAt(g, k);
          beats.push({
            el: bEl,
            measureEl: mEl,
            accent,
            tempo,
            dur: beatDuration(tempo, g.unit),
            sub: g.sub || 1,
            measure: measureNo,
            group: gi,
          });
        }
        measuresEl.append(mEl);
      }
      groupEl.append(measuresEl);
      timeline.append(groupEl);
    });

    // Two measures at the tempo and meter of the first beat. In 4/4 the first
    // measure accents 1 and 3, otherwise just 1. The second accents every beat.
    const first = groups[0];
    const countInBeats = [];
    for (let m = 1; m <= 2; m++) {
      for (let b = 0; b < first.beats; b++) {
        const strong = m === 2 || b === 0 || (b === 2 && first.beats === 4 && first.unit === 4);
        countInBeats.push({
          countIn: m,
          accent: strong ? "accented" : "normal",
          tempo: beats[0].tempo,
          dur: beats[0].dur,
          sub: 1,
          group: 0,
        });
      }
    }

    let list = beats;
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
      measureLabel.textContent = beat.countIn ? "Count-in" : "Measure";
      readout.measure.textContent = beat.countIn || beat.measure;
      readout.bpm.textContent = Math.round(beat.tempo);
      readout.time.textContent = `${g.beats}/${g.unit}`;
      readout.group.textContent = `${beat.group + 1} of ${groups.length}`;
    }

    function resetView() {
      timeline.querySelectorAll(".is-now, .is-done").forEach((n) => n.classList.remove("is-now", "is-done"));
      current = -1;
      setReadouts(beats[0]);
    }

    function showBeat(i) {
      const beat = list[i];
      const prev = current >= 0 ? list[current] : null;
      if (prev && prev.el) {
        prev.el.classList.replace("is-now", "is-done");
        if (prev.measureEl !== beat.measureEl) prev.measureEl.classList.remove("is-now");
      }
      if (beat.el) {
        beat.el.classList.add("is-now");
        beat.measureEl.classList.add("is-now");
      }
      setReadouts(beat);
      current = i;
    }

    function click(time, kind) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const [freq, level] = { accented: [1760, 0.9], normal: [1320, 0.55], sub: [990, 0.3] }[kind];
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(level, time + 0.002);
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
      while (nextIndex < list.length && nextTime < ctx.currentTime + 0.12) {
        const beat = list[nextIndex];
        if (beat.accent !== "silent") {
          click(nextTime, beat.accent);
          for (let j = 1; j < beat.sub; j++) click(nextTime + (j * beat.dur) / beat.sub, "sub");
        }
        queue.push({ time: nextTime, index: nextIndex });
        nextTime += beat.dur;
        nextIndex++;
      }
      if (nextIndex >= list.length) {
        clearInterval(timer);
        endTime = nextTime;
      }
    }

    function draw() {
      const now = ctx.currentTime;
      while (queue.length && queue[0].time <= now) showBeat(queue.shift().index);
      if (nextIndex >= list.length && !queue.length && now >= endTime) {
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
      list = countInToggle && countInToggle.getAttribute("aria-pressed") === "true" ? countInBeats.concat(beats) : beats;
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

    const onButton = () => (playing ? stop() : play());
    const onToggle = () => {
      const on = countInToggle.getAttribute("aria-pressed") !== "true";
      countInToggle.setAttribute("aria-pressed", String(on));
    };
    // Background tabs throttle timers, which would smear the click. Stop cleanly instead.
    const onVisibility = () => {
      if (document.hidden && playing) stop();
    };

    button.addEventListener("click", onButton);
    if (countInToggle) countInToggle.addEventListener("click", onToggle);
    document.addEventListener("visibilitychange", onVisibility);
    resetView();

    return {
      destroy() {
        if (playing) stop();
        button.removeEventListener("click", onButton);
        if (countInToggle) countInToggle.removeEventListener("click", onToggle);
        document.removeEventListener("visibilitychange", onVisibility);
        timeline.textContent = "";
      },
    };
  }

  return { mount, duration };
})();
