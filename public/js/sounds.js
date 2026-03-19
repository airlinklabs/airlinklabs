var sounds = (function() {
  var ctx = null;
  var muted = false;
  var ready = false;

  try { muted = localStorage.getItem('muted') === 'true'; } catch(e) {}

  // AudioContext must not be created before a user gesture.
  // We create it lazily on the first interaction.
  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Unlock on first touch or click so subsequent plays work on mobile
  function unlock() {
    if (ready) return;
    ready = true;
    var c = getCtx();
    if (c && c.state === 'suspended') c.resume();
  }
  document.addEventListener('click',     unlock, { once: false, passive: true });
  document.addEventListener('touchstart', unlock, { once: false, passive: true });
  document.addEventListener('keydown',   unlock, { once: false, passive: true });

  function play(name) {
    if (muted) return;
    var c = getCtx();
    if (!c) return;
    try {
      switch(name) {
        case 'click':       playClick(c);       break;
        case 'hover':       playHover(c);       break;
        case 'transition':  playTransition(c);  break;
        case 'themeToggle': playThemeToggle(c); break;
        case 'drawerOpen':  playDrawerOpen(c);  break;
        case 'drawerClose': playDrawerClose(c); break;
        case 'copy':        playCopy(c);        break;
      }
    } catch(e) {}
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

  function playClick(c)       { osc(c, 'sine', 180, 0.15, 0.10, 100); }
  function playHover(c)       { osc(c, 'sine', 800, 0.025, 0.04); }
  function playTransition(c)  { osc(c, 'sine', 220, 0.05, 0.28, 180); }
  function playThemeToggle(c) { osc(c, 'sine', 300, 0.09, 0.18, 520); }
  function playDrawerOpen(c)  { osc(c, 'sine', 240, 0.08, 0.20, 320); }
  function playDrawerClose(c) { osc(c, 'sine', 320, 0.08, 0.20, 240); }

  function playCopy(c) {
    osc(c, 'sine', 600, 0.09, 0.07);
    setTimeout(function() { osc(c, 'sine', 900, 0.09, 0.07); }, 80);
  }

  function toggle() {
    muted = !muted;
    try { localStorage.setItem('muted', muted ? 'true' : 'false'); } catch(e) {}
    return muted;
  }

  function isMuted() { return muted; }

  return { play: play, toggle: toggle, isMuted: isMuted };
})();
