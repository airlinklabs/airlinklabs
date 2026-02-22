// main.js - core utilities, loading screen, animations, popups

// ---- loading screen with progress bar ----
(function () {
  var screen = null;
  var bar = null;
  var progress = 0;
  var THRESHOLD = 500;
  var start = Date.now();
  var shown = false;
  var timer = null;

  function buildScreen() {
    var cfg = window.SITE_CONFIG || {};
    var site = cfg.site || {};
    var uc = cfg.underConstruction || {};

    screen = document.createElement('div');
    screen.id = 'loading-screen';

    var isSubPage = window.location.pathname.match(/\/(docs|marketplace)\//);
    var logoPath = isSubPage ? '../../public/assets/plane.png' : 'public/assets/plane.png';
    var faviconUrl = site.faviconUrl || '';

    screen.innerHTML =
      '<div class="loading-logo-wrap">' +
        (faviconUrl
          ? '<img src="' + faviconUrl + '" alt="logo">'
          : '<img src="' + logoPath + '" alt="logo" onerror="this.style.display=\'none\'">') +
        '<span>' + (site.title || 'AirLink') + '</span>' +
      '</div>' +
      '<div class="loading-bar-wrap">' +
        '<div class="loading-bar-fill" id="loading-bar"></div>' +
      '</div>' +
      '<div class="loading-sub" id="loading-sub">' +
        (uc.enabled ? getIcon('warning', 12) + ' ' + (uc.navbarBadge || 'Under Construction') : 'Loading...') +
      '</div>';

    document.body.appendChild(screen);
    bar = document.getElementById('loading-bar');

    var tick = setInterval(function () {
      if (progress < 85) {
        progress += Math.random() * 15;
        if (progress > 85) progress = 85;
        if (bar) bar.style.width = progress + '%';
      }
    }, 180);

    screen._tick = tick;
  }

  function show() {
    if (!screen) buildScreen();
    shown = true;
  }

  function hide() {
    clearTimeout(timer);
    if (screen && screen._tick) clearInterval(screen._tick);
    if (bar) {
      progress = 100;
      bar.style.width = '100%';
    }
    setTimeout(function () {
      if (screen) screen.classList.add('done');
      setTimeout(function () {
        if (screen && screen.parentNode) screen.parentNode.removeChild(screen);
      }, 550);
    }, 280);
  }

  timer = setTimeout(function () {
    if (document.readyState !== 'complete') show();
  }, THRESHOLD);

  window.addEventListener('load', function () {
    clearTimeout(timer);
    if (shown) {
      hide();
    }
  });

  setTimeout(hide, 7000);
})();


// ---- theme toggle ----
function initTheme() {
  document.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'dark';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch(e) {}
      updateThemeIcons();
    });
  });
  updateThemeIcons();
}

function updateThemeIcons() {
  var isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  document.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.innerHTML = isDark ? getIcon('sun') : getIcon('moon');
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  });
}


// ---- path prefix helper ----
// Returns the relative prefix to reach the site root from the current page
function getRootPrefix() {
  var path = window.location.pathname;
  if (path.match(/\/(docs)\//)) return '../../';
  if (path.match(/\/(marketplace)\//)) return '../';
  return '';
}


// ---- github cache (sessionStorage + pre-fetched static files) ----
var CACHE_TTL = 5 * 60 * 1000;

function keyToFile(key) {
  return key
    .replace(/^contributors-[^/]+\/([\w-]+)$/i, 'contributors-$1')
    .replace(/^commits-[^/]+\/([\w-]+)-/i, 'commits-$1-')
    .replace(/^repo-[^/]+\/([\w-]+)$/i, 'repo-$1')
    .replace(/[/\\:*?"<>|]/g, '-');
}

function cacheFilePath(filename) {
  return getRootPrefix() + 'public/api-cache/' + filename + '.json';
}

function cachedFetch(key, url) {
  // 1. session cache
  try {
    var e = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (e && Date.now() - e.ts < CACHE_TTL) return Promise.resolve(e.data);
  } catch(er) {}

  // 2. pre-built static file
  var file = keyToFile(key);
  return fetch(cacheFilePath(file))
    .then(function (r) {
      if (!r.ok) return Promise.reject();
      return r.json();
    })
    .then(function (d) {
      try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: d })); } catch(er) {}
      return d;
    })
    .catch(function () {
      // 3. live API
      return fetch(url)
        .then(function (r) {
          if (!r.ok) return Promise.reject(r.status);
          return r.json();
        })
        .then(function (d) {
          try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: d })); } catch(er) {}
          return d;
        });
    });
}


// ---- copy buttons on code blocks ----
function initCopyButtons() {
  document.querySelectorAll('.code-block').forEach(function (block) {
    if (block.querySelector('.copy-btn')) return;
    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.innerHTML = getIcon('copy') + ' Copy';
    btn.addEventListener('click', function () {
      var text = Array.from(block.querySelectorAll('code')).map(function (c) { return c.textContent; }).join('\n');
      navigator.clipboard.writeText(text).then(function () {
        btn.innerHTML = getIcon('check') + ' Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.innerHTML = getIcon('copy') + ' Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
    block.appendChild(btn);
  });
}


// ---- scroll animations ----
function initScrollAnimations() {
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up').forEach(function (el) {
    obs.observe(el);
  });
}


// ---- image folder manifest loader ----
function loadImagesFromFolder(folder, cb) {
  var prefix = getRootPrefix();
  // If folder already starts with the prefix (e.g. called from marketplace with '../public/...')
  // avoid double-prefixing
  var resolvedFolder = folder;
  if (prefix && !folder.startsWith(prefix) && !folder.startsWith('http')) {
    resolvedFolder = prefix + folder;
  }
  fetch(resolvedFolder + '/manifest.json')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (data) {
      var imgs = (data.images || []).map(function (f) { return resolvedFolder + '/' + f; });
      cb(imgs);
    })
    .catch(function () { cb([]); });
}


// ---- slideshow helper ----
function makeSlideshow(container, images, iconKey, opts) {
  opts = opts || {};
  var cur = 0;
  var arrowClass = opts.arrowClass || 'feat-slide-arrow';
  var imgClass   = opts.imgClass   || 'feat-slide-img';
  var dotClass   = opts.dotClass   || 'feat-dot';
  var emptyClass = opts.emptyClass || 'feat-slide-empty';

  function render() {
    container.innerHTML = '';

    if (opts.closeBtn) {
      var close = document.createElement('button');
      close.className = 'feat-slide-close';
      close.innerHTML = getIcon('close');
      close.addEventListener('click', opts.closeBtn);
      container.appendChild(close);
    }

    if (!images || !images.length) {
      var empty = document.createElement('div');
      empty.className = emptyClass;
      empty.innerHTML = getIcon(iconKey || 'puzzle', 56);
      container.appendChild(empty);
      return;
    }

    if (images.length > 1) {
      var counter = document.createElement('div');
      counter.className = 'feat-counter';
      counter.textContent = (cur + 1) + '/' + images.length;
      container.appendChild(counter);
    }

    var img = document.createElement('img');
    img.className = imgClass;
    img.alt = '';
    img.src = images[cur];
    img.addEventListener('error', function () {
      var fb = document.createElement('div');
      fb.className = emptyClass;
      fb.innerHTML = getIcon(iconKey || 'puzzle', 56);
      if (img.parentNode) img.parentNode.replaceChild(fb, img);
    });
    container.appendChild(img);

    if (images.length > 1) {
      var prev = document.createElement('button');
      prev.className = arrowClass + ' prev';
      prev.innerHTML = getIcon('chevLeft');
      prev.addEventListener('click', function () { cur = (cur - 1 + images.length) % images.length; render(); });
      container.appendChild(prev);

      var next = document.createElement('button');
      next.className = arrowClass + ' next';
      next.innerHTML = getIcon('chevRight');
      next.addEventListener('click', function () { cur = (cur + 1) % images.length; render(); });
      container.appendChild(next);

      // FIX: was dotClass + 's' which made class e.g. "feat-dots" but CSS targets ".feat-slide-dots"
      var dots = document.createElement('div');
      dots.className = 'feat-slide-dots';
      images.forEach(function (_, i) {
        var dot = document.createElement('div');
        dot.className = dotClass + (i === cur ? ' active' : '');
        dot.addEventListener('click', function () { cur = i; render(); });
        dots.appendChild(dot);
      });
      container.appendChild(dots);
    }
  }

  render();
}


// ---- under construction ----
function initUC() {
  var uc = window.SITE_CONFIG && window.SITE_CONFIG.underConstruction;
  if (!uc || !uc.enabled) return;

  var dismissed = false;
  try { dismissed = sessionStorage.getItem('uc-dismissed') === '1'; } catch(e) {}
  if (!dismissed) {
    var overlay = document.createElement('div');
    overlay.className = 'uc-overlay';
    overlay.innerHTML =
      '<div class="uc-popup">' +
        '<div class="uc-icon">' + getIcon('warning', 28) + '</div>' +
        '<h2>' + escHtml(uc.popupTitle || 'Under Construction') + '</h2>' +
        '<p>' + escHtml(uc.popupMessage || uc.message || '') + '</p>' +
        '<button class="btn btn-primary" id="uc-dismiss">Got it</button>' +
      '</div>';
    document.body.appendChild(overlay);
    setTimeout(function () { overlay.classList.add('active'); }, 120);
    document.getElementById('uc-dismiss').addEventListener('click', function () {
      overlay.classList.remove('active');
      try { sessionStorage.setItem('uc-dismissed', '1'); } catch(e) {}
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
    });
  }

  var nav = document.querySelector('.nav-actions');
  if (nav) {
    var badge = document.createElement('span');
    badge.className = 'uc-badge';
    badge.innerHTML = getIcon('warning', 12) + ' ' + escHtml(uc.navbarBadge || 'Under Construction');
    nav.prepend(badge);
  }
}


// ---- helpers ----
function escHtml(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}


// ---- init on DOM ready ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    initUC();
    initCopyButtons();
    initScrollAnimations();
  });
} else {
  initTheme();
  initUC();
  initCopyButtons();
  initScrollAnimations();
}
