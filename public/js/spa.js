(function () {
  var sections = Array.from(document.querySelectorAll('.spa-section'));
  if (!sections.length) return;

  var current    = 0;
  var animating  = false;
  var DURATION   = 340;
  var EASE       = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var touchStartY = 0;
  var touchStartTime = 0;

  function show(index) {
    if (index === current || animating) return;
    if (index < 0 || index >= sections.length) return;
    animating = true;

    if (typeof sounds !== 'undefined') sounds.play('transition');

    var outEl  = sections[current];
    var inEl   = sections[index];
    var goDown = index > current;

    inEl.style.display       = 'flex';
    inEl.style.opacity       = '0';
    inEl.style.transform     = 'translateY(' + (goDown ? '22px' : '-22px') + ')';
    inEl.style.transition    = 'none';
    inEl.style.pointerEvents = 'none';
    void inEl.offsetHeight;

    outEl.style.transition    = 'opacity ' + DURATION + 'ms ' + EASE + ', transform ' + DURATION + 'ms ' + EASE;
    outEl.style.opacity       = '0';
    outEl.style.transform     = 'translateY(' + (goDown ? '-22px' : '22px') + ')';
    outEl.style.pointerEvents = 'none';

    inEl.style.transition = 'opacity ' + DURATION + 'ms ' + EASE + ', transform ' + DURATION + 'ms ' + EASE;
    inEl.style.opacity    = '1';
    inEl.style.transform  = 'translateY(0)';

    setTimeout(function () {
      outEl.style.display      = 'none';
      outEl.style.opacity      = '';
      outEl.style.transform    = '';
      outEl.style.transition   = '';
      outEl.style.pointerEvents = '';
      inEl.style.transition    = '';
      inEl.style.pointerEvents = '';
      current   = index;
      animating = false;
      updateNav();
    }, DURATION);
  }

  // Set initial layout — all sections absolutely positioned inside spa-root
  sections.forEach(function (s, i) {
    s.style.position       = 'absolute';
    s.style.inset          = '0';
    s.style.display        = i === 0 ? 'flex' : 'none';
    s.style.flexDirection  = 'column';
    s.style.alignItems     = 'center';
    s.style.justifyContent = 'center';
    s.style.overflowX      = 'hidden';
    s.style.overflowY      = 'auto';
    s.style.boxSizing      = 'border-box';
  });

  // Mouse wheel
  var wheelCooldown = false;
  window.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (wheelCooldown) return;
    wheelCooldown = true;
    setTimeout(function () { wheelCooldown = false; }, DURATION + 80);
    if (e.deltaY > 0) show(current + 1); else show(current - 1);
  }, { passive: false });

  // Keyboard arrows
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); show(current - 1); }
  });

  // Touch — non-passive touchmove on spa-root blocks pull-to-refresh
  document.addEventListener('touchstart', function (e) {
    touchStartY    = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  var spaRoot = document.getElementById('spa-root');
  if (spaRoot) {
    spaRoot.addEventListener('touchmove', function (e) {
      // Allow scroll inside elements that actually overflow (activity lists, etc)
      var target = e.target;
      while (target && target !== spaRoot) {
        var ov = window.getComputedStyle(target).overflowY;
        if ((ov === 'auto' || ov === 'scroll') && target.scrollHeight > target.clientHeight) return;
        target = target.parentElement;
      }
      e.preventDefault();
    }, { passive: false });
  }

  document.addEventListener('touchend', function (e) {
    var dy = touchStartY - e.changedTouches[0].clientY;
    var dt = Date.now() - touchStartTime;
    if (Math.abs(dy) > 40 && dt < 600) {
      if (dy > 0) show(current + 1); else show(current - 1);
    }
  }, { passive: true });

  // Section nav dots injected into #right-strip
  var strip = document.getElementById('right-strip');
  if (strip) {
    var divider = document.createElement('div');
    divider.style.cssText = 'width:20px;height:1px;background:var(--color-border);margin:6px 0;flex-shrink:0;';
    strip.appendChild(divider);

    sections.forEach(function (s, i) {
      var btn = document.createElement('button');
      btn.setAttribute('aria-label', 'Section ' + (i + 1));
      btn.style.cssText = [
        'display:flex;align-items:center;justify-content:center;',
        'width:52px;height:38px;',
        'background:transparent;border:none;border-right:2px solid transparent;',
        'cursor:pointer;padding:0;flex-shrink:0;',
        'font-size:11px;font-family:var(--font-mono);font-weight:600;',
        'color:var(--color-text-3);',
        'transition:color 160ms,background 160ms,border-color 160ms;',
      ].join('');
      btn.textContent = i + 1;
      btn.addEventListener('click', function () { show(i); });
      strip.appendChild(btn);
    });
  }

  function updateNav() {
    if (!strip) return;
    strip.querySelectorAll('button[aria-label^="Section"]').forEach(function (btn, i) {
      var on = i === current;
      btn.style.color            = on ? 'var(--color-text-1)' : 'var(--color-text-3)';
      btn.style.background       = on ? 'var(--color-bg-hover)' : '';
      btn.style.borderRightColor = on ? 'var(--color-text-1)' : 'transparent';
    });
  }

  updateNav();

  // Anchor jump links (#spa-xxx)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#spa-"]');
    if (!a) return;
    var id  = a.getAttribute('href').slice(1);
    var idx = sections.findIndex(function (s) { return s.id === id; });
    if (idx !== -1) { e.preventDefault(); show(idx); }
  });
})();
