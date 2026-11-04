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
//
// Clicks are the app's Rimshot sound: three samples rendered by the app's
// own RimshotClick synth (high accent, mid beat, low subdivision). Like the
// app, each click cuts off the one before it.
//
// Playback starts with a two-measure count-in, unless a [data-count-in]
// toggle is there and off. With a [data-loop] toggle on, the show repeats
// like an app loop: two measures of count-off at the first beat's tempo and
// meter, then again.

window.RimshotShowPlayer = (() => {
  let ctx = null;
  let master = null;
  let samples = null;

  const SAMPLE_URLS = {
    accented: "/assets/audio/rimshot-accent.wav",
    normal: "/assets/audio/rimshot-beat.wav",
    sub: "/assets/audio/rimshot-sub.wav",
  };

  // Loads once per page. If it fails, clicks fall back to a synthesized tick.
  function loadSamples() {
    if (!samples) {
      samples = Promise.all(
        Object.entries(SAMPLE_URLS).map(([kind, url]) =>
          fetch(url)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
            .then((data) => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
            .then((buffer) => [kind, buffer])
        )
      ).then(Object.fromEntries, () => null);
    }
    return samples;
  }

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
    const loopToggle = el.querySelector("[data-loop]");
    const readout = {};
    el.querySelectorAll("[data-r]").forEach((n) => (readout[n.dataset.r] = n));
    const measureLabel = readout.measure && readout.measure.previousElementSibling;

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
    // A loop's count-off between passes is the same two measures, so both
    // light the same "Count-in" group at the head of the timeline. Its beats
    // are numbered the way a drummer counts it off: "1 · 2 · | 1 2 3 4".
    const first = groups[0];
    const countEl = make("div", "tl-group tl-count");
    const countLabel = make("div", "tl-label");
    countLabel.append(make("strong", null, "Count-in"), make("span", null, `2 × ${first.beats}/${first.unit}`));
    const countMeasures = make("div", "tl-measures");
    const countSlots = [];
    for (let m = 1; m <= 2; m++) {
      const mEl = make("div", "tl-measure");
      mEl.style.setProperty("--beats", first.beats);
      let n = 0;
      for (let b = 0; b < first.beats; b++) {
        const strong = m === 2 || b === 0 || (b === 2 && first.beats === 4 && first.unit === 4);
        const bEl = make("div", "tl-beat", strong ? String(++n) : null);
        mEl.append(bEl);
        countSlots.push({ el: bEl, measureEl: mEl, strong });
      }
      countMeasures.append(mEl);
    }
    countEl.append(countLabel, countMeasures);
    countEl.style.setProperty("--dur", (beats[0].dur * first.beats * 2).toFixed(3));
    timeline.prepend(countEl);

    function countBeats(countOff) {
      return countSlots.map((slot, i) => ({
        el: slot.el,
        measureEl: slot.measureEl,
        countIn: i < first.beats ? 1 : 2,
        countOff,
        accent: slot.strong ? "accented" : "normal",
        tempo: beats[0].tempo,
        dur: beats[0].dur,
        sub: 1,
        group: 0,
      }));
    }
    const countInBeats = countBeats(false);
    const countOffBeats = countBeats(true);

    // With no Count-in toggle, the show always counts in. The group shows
    // whenever a count-in or a loop's count-off can play.
    const countingIn = () => !countInToggle || countInToggle.getAttribute("aria-pressed") === "true";
    const showCount = () => { countEl.hidden = !countingIn() && !loopToggle; };
    showCount();

    // `list` is [count-in] + beats + [count-off]. Playback ends at `beatsEnd`
    // unless Loop is on, and after the count-off it jumps back to `loopStart`.
    let list = beats;
    let loopStart = 0;
    let beatsEnd = beats.length;
    let finished = false;
    let playing = false;
    let timer = 0;
    let raf = 0;
    let nextIndex = 0;
    let nextTime = 0;
    let endTime = 0;
    let queue = [];
    let voices = [];
    let lastVoice = null;
    let buffers = null;
    let current = -1;

    function setReadouts(beat) {
      const g = groups[beat.group];
      const set = (key, value) => { if (readout[key]) readout[key].textContent = value; };
      if (measureLabel) measureLabel.textContent = beat.countOff ? "Count-off" : beat.countIn ? "Count-in" : "Measure";
      set("measure", beat.countIn || beat.measure);
      set("bpm", Math.round(beat.tempo));
      set("time", `${g.beats}/${g.unit}`);
      set("group", `${beat.group + 1} of ${groups.length}`);
    }

    function resetView() {
      timeline.querySelectorAll(".is-now, .is-done").forEach((n) => n.classList.remove("is-now", "is-done"));
      current = -1;
      setReadouts(beats[0]);
    }

    function showBeat(i) {
      const beat = list[i];
      const prev = current >= 0 ? list[current] : null;
      // A new pass starts with a clean timeline.
      if (beat.countOff && prev && !prev.countOff) {
        timeline.querySelectorAll(".is-now, .is-done").forEach((n) => n.classList.remove("is-now", "is-done"));
      } else if (prev && prev.el) {
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
      if (buffers) {
        const source = ctx.createBufferSource();
        source.buffer = buffers[kind];
        source.connect(master);
        source.start(time);
        if (lastVoice) { try { lastVoice.stop(time); } catch (e) {} }
        lastVoice = source;
        voices.push(source);
        source.onended = () => { voices = voices.filter((v) => v !== source); };
        return;
      }
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
    const looping = () => !!loopToggle && loopToggle.getAttribute("aria-pressed") === "true";

    function schedule() {
      while (!finished && nextTime < ctx.currentTime + 0.12) {
        if (nextIndex === beatsEnd && !looping()) {
          finished = true;
          break;
        }
        if (nextIndex >= list.length) nextIndex = loopStart;
        const beat = list[nextIndex];
        if (beat.accent !== "silent") {
          click(nextTime, beat.accent);
          for (let j = 1; j < beat.sub; j++) click(nextTime + (j * beat.dur) / beat.sub, "sub");
        }
        queue.push({ time: nextTime, index: nextIndex });
        nextTime += beat.dur;
        nextIndex++;
      }
      if (finished) {
        clearInterval(timer);
        endTime = nextTime;
      }
    }

    function draw() {
      const now = ctx.currentTime;
      while (queue.length && queue[0].time <= now) showBeat(queue.shift().index);
      if (finished && !queue.length && now >= endTime) {
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
      buffers = await loadSamples();

      resetView();
      const countIn = countingIn();
      list = (countIn ? countInBeats : []).concat(beats, loopToggle ? countOffBeats : []);
      loopStart = countIn ? countInBeats.length : 0;
      beatsEnd = loopStart + beats.length;
      finished = false;
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
      lastVoice = null;
      queue = [];
      resetView();
      setButton(false);
    }

    const onButton = () => (playing ? stop() : play());
    const onToggle = (e) => {
      const toggle = e.currentTarget;
      toggle.setAttribute("aria-pressed", String(toggle.getAttribute("aria-pressed") !== "true"));
      showCount();
    };
    // Background tabs throttle timers, which would smear the click. Stop cleanly instead.
    const onVisibility = () => {
      if (document.hidden && playing) stop();
    };

    button.addEventListener("click", onButton);
    if (countInToggle) countInToggle.addEventListener("click", onToggle);
    if (loopToggle) loopToggle.addEventListener("click", onToggle);
    document.addEventListener("visibilitychange", onVisibility);
    resetView();

    return {
      destroy() {
        if (playing) stop();
        button.removeEventListener("click", onButton);
        if (countInToggle) countInToggle.removeEventListener("click", onToggle);
        if (loopToggle) loopToggle.removeEventListener("click", onToggle);
        document.removeEventListener("visibilitychange", onVisibility);
        timeline.textContent = "";
      },
    };
  }

  return { mount, duration };
})();
