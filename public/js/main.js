// ── Image fade-in on load ─────────────────────────────────────────────────────
(function () {
  function markLoaded(img) {
    img.classList.add('img-loaded');
  }

  function watchImage(img) {
    // Images hidden with display:none don't need the fade treatment
    if (img.style.display === 'none') return;
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }
    // Hard timeout — if the image hasn't loaded in 2s, reveal it anyway
    var timeout = setTimeout(function () { markLoaded(img); }, 2000);
    img.addEventListener('load',  function () { clearTimeout(timeout); markLoaded(img); }, { once: true });
    img.addEventListener('error', function () { clearTimeout(timeout); markLoaded(img); }, { once: true });
  }

  document.querySelectorAll('img[loading="lazy"]').forEach(watchImage);

  // Pick up dynamically injected lazy images (modal gifs, registry step icons)
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG' && node.getAttribute('loading') === 'lazy') watchImage(node);
        if (node.querySelectorAll) node.querySelectorAll('img[loading="lazy"]').forEach(watchImage);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();


(function () {
  var stored = null;
  try { stored = localStorage.getItem('isMobile'); } catch (e) {}
  if (stored === null) {
    var isMobile = (
      /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768
    );
    var val = isMobile ? '1' : '0';
    try { localStorage.setItem('isMobile', val); } catch (e) {}
    document.documentElement.setAttribute('data-mobile', val);
  } else {
    document.documentElement.setAttribute('data-mobile', stored);
  }
})();

// ── Theme ─────────────────────────────────────────────────────────────────────
(function () {
  function applyTheme(t) {
    document.documentElement.className = t;
    try { localStorage.setItem('theme', t); } catch (e) {}
    document.querySelectorAll('.theme-icon-sun').forEach(function (el) {
      el.style.display = t === 'light' ? '' : 'none';
    });
    document.querySelectorAll('.theme-icon-moon').forEach(function (el) {
      el.style.display = t !== 'light' ? '' : 'none';
    });
  }

  var saved = 'dark';
  try { saved = localStorage.getItem('theme') || 'dark'; } catch (e) {}
  applyTheme(saved);

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-theme-toggle]')) return;
    var next = document.documentElement.className === 'light' ? 'dark' : 'light';
    applyTheme(next);
    if (typeof sounds !== 'undefined') sounds.play('themeToggle');
  });
})();

// ── Mute button sync ──────────────────────────────────────────────────────────
(function () {
  function syncMute() {
    var muted = typeof sounds !== 'undefined' && sounds.isMuted();
    document.querySelectorAll('.mute-state-on').forEach(function (el)  { el.style.display = muted ? 'none' : ''; });
    document.querySelectorAll('.mute-state-off').forEach(function (el) { el.style.display = muted ? '' : 'none'; });
    var btn = document.getElementById('mute-btn');
    if (btn) btn.style.color = muted ? 'var(--color-text-4)' : 'var(--color-text-3)';
  }

  syncMute();

  var muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', function () {
      if (typeof sounds !== 'undefined') sounds.toggle();
      syncMute();
    });
  }

  var muteBtnMobile = document.getElementById('mute-btn-mobile');
  if (muteBtnMobile) {
    muteBtnMobile.addEventListener('click', function () {
      if (typeof sounds !== 'undefined') sounds.toggle();
      syncMute();
    });
  }
})();

// ── Copy buttons ──────────────────────────────────────────────────────────────
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.copy-btn');
  if (!btn) return;
  e.stopPropagation();

  var block = btn.closest('.code-block');
  if (!block) return;

  var text = Array.from(block.querySelectorAll('code'))
    .map(function (c) { return c.textContent; })
    .join('\n');

  navigator.clipboard.writeText(text).then(function () {
    if (typeof sounds !== 'undefined') sounds.play('copy');
    var orig = btn.innerHTML;
    btn.innerHTML = '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
    btn.style.color       = 'var(--color-success)';
    btn.style.borderColor = 'var(--color-success)';
    setTimeout(function () {
      btn.innerHTML         = orig;
      btn.style.color       = '';
      btn.style.borderColor = '';
    }, 2000);
  });
});

// ── Click sounds ──────────────────────────────────────────────────────────────
document.addEventListener('click', function (e) {
  if (typeof sounds === 'undefined') return;
  var el = e.target.closest('a[href], button, [data-feature-id], [data-clickable]');
  if (!el) return;
  if (el.closest('[data-theme-toggle]')) return;
  if (el.closest('.copy-btn')) return;
  if (el.id === 'mute-btn' || el.id === 'mute-btn-mobile') return;
  if (el.id === 'redirect-confirm' || el.id === 'redirect-cancel') return;
  sounds.play('click');
});

// ── Redirect confirmation popup ───────────────────────────────────────────────
(function () {
  var overlay    = document.getElementById('redirect-overlay');
  var domainEl   = document.getElementById('redirect-domain');
  var cancelBtn  = document.getElementById('redirect-cancel');
  var confirmBtn = document.getElementById('redirect-confirm');
  if (!overlay) return;

  var pendingHref = '';

  function isExternal(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.origin !== window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function openRedirect(href) {
    pendingHref = href;
    try { domainEl.textContent = new URL(href).hostname; } catch (e) { domainEl.textContent = href; }
    overlay.classList.add('open');
    if (typeof sounds !== 'undefined') sounds.play('modalOpen');
  }

  function closeRedirect() {
    overlay.classList.remove('open');
    pendingHref = '';
    if (typeof sounds !== 'undefined') sounds.play('modalClose');
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || !isExternal(href)) return;
    e.preventDefault();
    openRedirect(href);
  });

  cancelBtn.addEventListener('click', closeRedirect);

  confirmBtn.addEventListener('click', function () {
    if (typeof sounds !== 'undefined') sounds.play('click');
    overlay.classList.remove('open');
    if (pendingHref) window.open(pendingHref, '_blank', 'noopener,noreferrer');
    pendingHref = '';
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeRedirect();
  });

  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeRedirect();
    if (e.key === 'Enter')  confirmBtn.click();
  });
})();

// ── Loading screen + staggered hero reveal ────────────────────────────────────
(function () {
  var EASE   = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var SPRING = 'cubic-bezier(0.34, 1.12, 0.64, 1)';
  var screen  = document.getElementById('loading-screen');
  var content = document.getElementById('page-content');

  function staggerIn(els, baseDelay) {
    els.forEach(function (el, i) {
      if (!el) return;
      el.style.opacity    = '0';
      el.style.transform  = 'translateY(18px)';
      el.style.transition = 'none';
      setTimeout(function () {
        el.style.transition = 'opacity 400ms ' + EASE + ', transform 400ms ' + SPRING;
        el.style.opacity    = '1';
        el.style.transform  = 'translateY(0)';
      }, baseDelay + i * 70);
    });
  }

  function reveal() {
    if (screen) {
      screen.style.transition = 'opacity 280ms ' + EASE;
      screen.style.opacity    = '0';
      setTimeout(function () { screen.style.display = 'none'; }, 300);
    }

    var delay = screen ? 240 : 0;

    // Non-SPA pages — fade up the whole content block
    if (content) {
      content.style.opacity    = '0';
      content.style.transform  = 'translateY(14px)';
      content.style.transition = 'none';
      setTimeout(function () {
        content.style.transition = 'opacity 380ms ' + EASE + ', transform 380ms ' + SPRING;
        content.style.opacity    = '1';
        content.style.transform  = 'translateY(0)';
      }, delay);
      return;
    }

    // SPA home — stagger individual hero elements
    staggerIn([
      document.querySelector('#hero-left > div:first-child'),
      document.querySelector('#hero-left h1'),
      document.querySelector('#hero-left > p'),
      document.querySelector('#hero-left > div:nth-child(4)'),
      document.querySelector('#hero-left > div:last-child'),
      document.getElementById('hero-mockup'),
    ], delay);
  }

  if (document.readyState === 'complete') {
    setTimeout(reveal, 40);
  } else {
    window.addEventListener('load', function () { setTimeout(reveal, 40); });
  }

  // Outgoing internal navigation — page is already painted so switch loading screen
  // to frosted glass mode before showing it
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto')) return;
    if (a.target === '_blank') return;
    e.preventDefault();

    if (content) {
      content.style.transition = 'opacity 180ms ' + EASE + ', transform 180ms ' + EASE;
      content.style.opacity    = '0';
      content.style.transform  = 'translateY(-8px)';
    }

    function go() { window.location.href = href; }

    if (screen) {
      setTimeout(function () {
        screen.classList.add('glass');
        screen.style.display    = 'flex';
        screen.style.opacity    = '0';
        screen.style.transition = 'opacity 160ms ' + EASE;
        void screen.offsetHeight;
        screen.style.opacity    = '1';
        setTimeout(go, 200);
      }, content ? 160 : 0);
    } else {
      setTimeout(go, content ? 200 : 0);
    }
  });
})();
