// ── Mobile detection ─────────────────────────────────────────────────────────
// Runs once on first load and stores the result. Subsequent loads read the
// stored value so it doesn't re-evaluate on resize or re-visit.
(function() {
  var stored = null;
  try { stored = localStorage.getItem('isMobile'); } catch(e) {}

  if (stored === null) {
    var mobile = (
      /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    );
    var val = mobile ? '1' : '0';
    try { localStorage.setItem('isMobile', val); } catch(e) {}
    document.documentElement.setAttribute('data-mobile', val);
  } else {
    document.documentElement.setAttribute('data-mobile', stored);
  }
})();


(function() {
  function setTheme(t) {
    document.documentElement.className = t;
    try { localStorage.setItem('theme', t); } catch(e) {}
    document.querySelectorAll('.theme-icon-sun').forEach(function(el) {
      el.style.display = t === 'light' ? '' : 'none';
    });
    document.querySelectorAll('.theme-icon-moon').forEach(function(el) {
      el.style.display = t !== 'light' ? '' : 'none';
    });
  }

  var saved = 'dark';
  try { saved = localStorage.getItem('theme') || 'dark'; } catch(e) {}
  setTheme(saved);

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    var next = document.documentElement.className === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (typeof sounds !== 'undefined') sounds.play('themeToggle');
  });
})();

// ── Mute button sync ─────────────────────────────────────────────────────────
(function() {
  function syncMuteButtons() {
    var muted = typeof sounds !== 'undefined' && sounds.isMuted();
    document.querySelectorAll('.mute-state-on').forEach(function(el) {
      el.style.display = muted ? 'none' : '';
    });
    document.querySelectorAll('.mute-state-off').forEach(function(el) {
      el.style.display = muted ? '' : 'none';
    });
    var btn = document.getElementById('mute-btn');
    if (btn) btn.style.color = muted ? 'var(--color-text-4)' : 'var(--color-text-3)';
  }

  syncMuteButtons();

  // Desktop mute button
  var muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', function() {
      if (typeof sounds !== 'undefined') sounds.toggle();
      syncMuteButtons();
    });
  }
})();

// ── Copy buttons ─────────────────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var btn = e.target.closest('.copy-btn');
  if (!btn) return;
  e.stopPropagation();
  var block = btn.closest('.code-block');
  if (!block) return;
  var text = Array.from(block.querySelectorAll('code'))
    .map(function(c) { return c.textContent; })
    .join('\n');
  navigator.clipboard.writeText(text).then(function() {
    if (typeof sounds !== 'undefined') sounds.play('copy');
    var orig = btn.innerHTML;
    btn.innerHTML = '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
    btn.style.color       = 'var(--color-success)';
    btn.style.borderColor = 'var(--color-success)';
    setTimeout(function() {
      btn.innerHTML         = orig;
      btn.style.color       = '';
      btn.style.borderColor = '';
    }, 2000);
  });
});

// ── Click sounds ─────────────────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  if (typeof sounds === 'undefined') return;
  var el = e.target.closest('a[href], button, [data-feature-id]');
  if (!el) return;
  if (el.closest('[data-theme-toggle]')) return;
  if (el.closest('.copy-btn')) return;
  if (el.id === 'mute-btn' || el.id === 'mute-btn-mobile') return;
  sounds.play('click');
});

// ── Loading screen + page transitions ────────────────────────────────────────
// Flow:
//   Page load  → loading screen visible → fades out → page-content fades up
//   Navigation → page-content fades out → navigate → (repeat above on new page)
(function() {
  var EASE   = 'cubic-bezier(0.4,0,0.2,1)';
  var screen = document.getElementById('loading-screen');
  var content = document.getElementById('page-content');

  // Hide loading screen and fade content in
  function revealPage() {
    if (screen) {
      screen.style.transition = 'opacity 340ms ' + EASE;
      screen.style.opacity    = '0';
      setTimeout(function() {
        screen.style.display = 'none';
      }, 360);
    }

    if (content) {
      content.style.opacity    = '0';
      content.style.transform  = 'translateY(16px)';
      content.style.transition = 'none';
      // small delay so transition doesn't start before opacity:0 is painted
      setTimeout(function() {
        content.style.transition = 'opacity 400ms ' + EASE + ', transform 400ms ' + EASE;
        content.style.opacity    = '1';
        content.style.transform  = 'translateY(0)';
      }, screen ? 300 : 30);
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(revealPage, 60);
  } else {
    window.addEventListener('load', function() { setTimeout(revealPage, 60); });
  }

  // Fade content out, show loading screen, then navigate
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
    if (a.target === '_blank') return;

    e.preventDefault();

    function doNavigate() {
      window.location.href = href;
    }

    if (content) {
      content.style.transition = 'opacity 220ms ' + EASE + ', transform 220ms ' + EASE;
      content.style.opacity    = '0';
      content.style.transform  = 'translateY(-10px)';
    }

    if (screen) {
      setTimeout(function() {
        screen.style.display    = 'flex';
        screen.style.opacity    = '0';
        screen.style.transition = 'opacity 200ms ' + EASE;
        void screen.offsetHeight;
        screen.style.opacity = '1';
        setTimeout(doNavigate, 250);
      }, content ? 200 : 0);
    } else {
      setTimeout(doNavigate, content ? 240 : 0);
    }
  });
})();
