var sounds = (function () {
  var ctx = null;
  var muted = false;

  try { muted = localStorage.getItem('muted') === 'true'; } catch (e) {}

  // AudioContext must be created AND used inside the same user gesture call stack.
  // If you create it outside a gesture it starts suspended and resume() is async —
  // by the time it resolves the gesture callstack is gone and the browser blocks audio again.
  // Solution: create the context lazily on first play() call, which is always called
  // from inside a gesture handler. Brand new AudioContext starts as 'running' when
  // created inside a gesture, so no resume() crap needed at all.
  function getCtx() {
    if (ctx) {
      // already exists — if it got suspended (tab hidden etc) kick it back
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function osc(c, type, freq, gain, dur, freqEnd) {
    var o = c.createOscillator();
    var g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur);
  }

  var library = {
    click:        function (c) { osc(c, 'sine', 200, 0.4,  0.09, 120); },
    hover:        function (c) { osc(c, 'sine', 700, 0.06, 0.04); },
    transition:   function (c) { osc(c, 'sine', 240, 0.18, 0.26, 190); },
    themeToggle:  function (c) { osc(c, 'sine', 320, 0.30, 0.18, 540); },
    copy:         function (c) { osc(c, 'sine', 620, 0.28, 0.06); setTimeout(function () { osc(c, 'sine', 920, 0.24, 0.06); }, 75); },
    modalOpen:    function (c) { osc(c, 'sine', 280, 0.22, 0.22, 380); },
    modalClose:   function (c) { osc(c, 'sine', 380, 0.22, 0.18, 240); },
    select:       function (c) { osc(c, 'sine', 440, 0.26, 0.12, 520); },
    toggle:       function (c) { osc(c, 'sine', 360, 0.22, 0.14, 290); },
    wizNext:      function (c) { osc(c, 'sine', 380, 0.22, 0.14, 480); },
    wizBack:      function (c) { osc(c, 'sine', 480, 0.20, 0.12, 360); },
    wizResult:    function (c) {
      osc(c, 'sine', 440, 0.26, 0.1);
      setTimeout(function () { osc(c, 'sine', 660, 0.22, 0.1); }, 100);
      setTimeout(function () { osc(c, 'sine', 880, 0.20, 0.14); }, 200);
    },
    filterChange: function (c) { osc(c, 'sine', 500, 0.20, 0.10, 420); },
    search:       function (c) { osc(c, 'sine', 580, 0.14, 0.08); },
    error:        function (c) { osc(c, 'sawtooth', 180, 0.20, 0.18, 140); },
  };

  function play(name) {
    if (muted) return;
    var fn = library[name];
    if (!fn) return;
    var c = getCtx();
    if (!c) return;
    // edge case: context suspended (tab was hidden and came back)
    // can't fire synchronously so schedule after resume
    if (c.state === 'suspended') {
      c.resume().then(function () { try { fn(c); } catch (e) {} });
      return;
    }
    try { fn(c); } catch (e) {}
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem('muted', muted ? 'true' : 'false'); } catch (e) {}
    return muted;
  }

  function isMuted() { return muted; }

  return { play: play, toggle: toggle, isMuted: isMuted };
})();

// ~ https://github.com/thavanish edited this shitty code
