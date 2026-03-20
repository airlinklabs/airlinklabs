(function () {
  // ── Elements ───────────────────────────────────────────────────────────────
  var searchInput  = document.getElementById('reg-search');
  var filterBtn    = document.getElementById('reg-filter-btn');
  var filterLabel  = document.getElementById('reg-filter-label');
  var filterMenu   = document.getElementById('reg-filter-menu');
  var addonGrid    = document.getElementById('addon-grid');
  var emptyEl      = document.getElementById('reg-empty');
  var cards        = Array.from(document.querySelectorAll('.addon-card'));

  var activeTag    = 'all';
  var menuOpen     = false;

  // ── Filter dropdown ────────────────────────────────────────────────────────
  function setTag(tag) {
    activeTag = tag;
    if (filterLabel) filterLabel.textContent = tag === 'all' ? 'All tags' : tag;

    // Highlight active item in menu
    if (filterMenu) {
      filterMenu.querySelectorAll('[data-tag]').forEach(function (item) {
        var on = item.dataset.tag === tag;
        item.style.color      = on ? 'var(--color-text-1)'       : 'var(--color-text-2)';
        item.style.background = on ? 'var(--color-bg-hover)'     : 'transparent';
        item.style.fontWeight = on ? '600' : '400';
      });
    }

    if (typeof sounds !== 'undefined') sounds.play('filterChange');
    filterCards();
    closeMenu();
  }

  function openMenu() {
    if (!filterMenu) return;
    menuOpen = true;
    filterMenu.style.display  = 'block';
    filterMenu.style.opacity  = '0';
    filterMenu.style.transform = 'translateY(-6px) scale(0.98)';
    filterMenu.style.transition = 'none';
    void filterMenu.offsetHeight;
    filterMenu.style.transition = 'opacity 160ms cubic-bezier(0.4,0,0.2,1), transform 160ms cubic-bezier(0.34,1.1,0.64,1)';
    filterMenu.style.opacity    = '1';
    filterMenu.style.transform  = 'translateY(0) scale(1)';
    if (filterBtn) filterBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!filterMenu || !menuOpen) return;
    menuOpen = false;
    filterMenu.style.transition = 'opacity 120ms cubic-bezier(0.4,0,0.2,1), transform 120ms cubic-bezier(0.4,0,0.2,1)';
    filterMenu.style.opacity    = '0';
    filterMenu.style.transform  = 'translateY(-4px) scale(0.98)';
    setTimeout(function () {
      if (!menuOpen) filterMenu.style.display = 'none';
    }, 130);
    if (filterBtn) filterBtn.setAttribute('aria-expanded', 'false');
  }

  if (filterBtn) {
    filterBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menuOpen) closeMenu(); else openMenu();
    });
  }

  if (filterMenu) {
    filterMenu.querySelectorAll('[data-tag]').forEach(function (item) {
      item.addEventListener('click', function () { setTag(item.dataset.tag); });
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', function (e) {
    if (!menuOpen) return;
    var wrap = document.getElementById('reg-filter-wrap');
    if (wrap && !wrap.contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menuOpen) closeMenu();
  });

  // ── Search ─────────────────────────────────────────────────────────────────
  var searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        if (typeof sounds !== 'undefined') sounds.play('search');
        filterCards();
      }, 120);
    });
  }

  // ── Filter logic ───────────────────────────────────────────────────────────
  function filterCards() {
    var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var visible = 0;

    cards.forEach(function (card) {
      var name = card.dataset.name || '';
      var desc = card.dataset.desc || '';
      var tags = card.dataset.tags || '';

      var matchSearch = !q || name.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
      var matchTag    = activeTag === 'all' || tags.split(',').indexOf(activeTag.toLowerCase()) !== -1;

      var show = matchSearch && matchTag;
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    });

    if (emptyEl)   emptyEl.style.display  = visible === 0 ? 'block' : 'none';
    if (addonGrid) addonGrid.style.display = visible === 0 ? 'none'  : '';
  }

  // ── Modal ──────────────────────────────────────────────────────────────────
  var overlay   = document.getElementById('addon-overlay');
  var modal     = document.getElementById('addon-modal');
  var closeBtn  = document.getElementById('am-close');
  var goInstall = document.getElementById('am-go-install');

  if (!overlay || !modal) return;

  var EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

  function openOverlay() {
    overlay.style.transition    = 'opacity 200ms ' + EASE;
    overlay.style.opacity       = '1';
    overlay.style.pointerEvents = 'auto';
    modal.style.transition      = 'transform 220ms cubic-bezier(0.34,1.1,0.64,1)';
    modal.style.transform       = 'translateY(0) scale(1)';
    document.body.style.overflow = 'hidden';
    if (typeof sounds !== 'undefined') sounds.play('modalOpen');
  }

  function closeOverlay() {
    overlay.style.transition    = 'opacity 180ms ' + EASE;
    overlay.style.opacity       = '0';
    overlay.style.pointerEvents = 'none';
    modal.style.transition      = 'transform 180ms ' + EASE;
    modal.style.transform       = 'translateY(10px) scale(0.98)';
    document.body.style.overflow = '';
    if (typeof sounds !== 'undefined') sounds.play('modalClose');
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function switchTab(name) {
    modal.querySelectorAll('.addon-tab').forEach(function (t) {
      var on = t.dataset.tab === name;
      t.style.borderBottomColor = on ? 'var(--color-text-1)' : 'transparent';
      t.style.color             = on ? 'var(--color-text-1)' : 'var(--color-text-3)';
      t.style.fontWeight        = on ? '600' : '400';
    });
    modal.querySelectorAll('.addon-panel').forEach(function (p) {
      p.style.display = p.dataset.panel === name ? '' : 'none';
    });
    if (typeof sounds !== 'undefined') sounds.play('select');
  }

  function fallbackIcon() {
    return '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24" style="color:var(--color-text-3);">'
      + '<path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/>'
      + '</svg>';
  }

  function openAddon(addon) {
    // Icon
    var iconEl = document.getElementById('am-icon');
    iconEl.innerHTML = '';
    if (addon.icon) {
      var img = new Image();
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      img.onerror = function () { iconEl.innerHTML = fallbackIcon(); };
      img.src = addon.icon;
      iconEl.appendChild(img);
    } else {
      iconEl.innerHTML = fallbackIcon();
    }

    document.getElementById('am-name').textContent   = addon.name || '';
    document.getElementById('am-byline').textContent = 'by ' + (addon.author || 'Unknown') + ' · ' + (addon.version || '');
    document.getElementById('am-github').href        = addon.github || '#';
    document.getElementById('am-desc').textContent   = addon.longDescription || addon.description || '';

    // Status badge
    var statusEl = document.getElementById('am-status');
    if (statusEl) {
      statusEl.textContent = addon.status || '';
      var colors = {
        working: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', border: 'rgba(34,197,94,0.25)' },
        broken:  { color: 'var(--color-danger)',  bg: 'var(--color-danger-bg)',  border: 'rgba(239,68,68,0.25)' },
      };
      var c = colors[addon.status] || { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', border: 'rgba(245,158,11,0.25)' };
      statusEl.style.color       = c.color;
      statusEl.style.background  = c.bg;
      statusEl.style.borderColor = c.border;
    }

    // Features list
    var featEl = document.getElementById('am-features');
    featEl.innerHTML = '';
    if (addon.features && addon.features.length) {
      var label = document.createElement('p');
      label.style.cssText = 'font-size:10px;font-family:var(--font-mono);color:var(--color-text-3);text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;';
      label.textContent = 'What it does';
      featEl.appendChild(label);
      var ul = document.createElement('ul');
      ul.style.cssText = 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:7px;';
      addon.features.forEach(function (f) {
        var li = document.createElement('li');
        li.style.cssText = 'display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--color-text-2);line-height:1.55;';
        li.innerHTML = '<svg width="11" height="11" fill="none" stroke="var(--color-success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>' + esc(f);
        ul.appendChild(li);
      });
      featEl.appendChild(ul);
    }

    // Install steps
    var stepsEl = document.getElementById('am-steps');
    stepsEl.innerHTML = '';
    (addon.installSteps || []).forEach(function (step, i) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:12px;align-items:flex-start;margin-bottom:16px;';

      var num = document.createElement('div');
      num.style.cssText = 'width:22px;height:22px;flex-shrink:0;border:1px solid var(--color-border);border-radius:50%;background:var(--color-bg-3);display:flex;align-items:center;justify-content:center;font-size:10px;font-family:var(--font-mono);color:var(--color-text-3);margin-top:1px;';
      num.textContent = i + 1;

      var body = document.createElement('div');
      body.style.cssText = 'flex:1;min-width:0;';

      if (step.title) {
        var h4 = document.createElement('h4');
        h4.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-1);margin:0 0 8px;letter-spacing:-0.01em;';
        h4.textContent = step.title;
        body.appendChild(h4);
      }

      if (step.commands && step.commands.length) {
        var codeWrap = document.createElement('div');
        codeWrap.className = 'code-block';
        codeWrap.style.cssText = 'background:var(--color-bg-input);border:1px solid var(--color-border);border-radius:8px;padding:10px 12px;position:relative;';
        step.commands.forEach(function (cmd) {
          var code = document.createElement('code');
          code.style.cssText = 'font-size:11px;color:var(--color-text-1);font-family:var(--font-mono);line-height:1.65;display:block;';
          code.textContent = cmd;
          codeWrap.appendChild(code);
        });
        var copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.style.cssText = 'position:absolute;top:6px;right:6px;font-size:9px;font-family:var(--font-mono);color:var(--color-text-3);background:var(--color-bg-2);border:1px solid var(--color-border);padding:3px 8px;border-radius:4px;cursor:pointer;display:flex;align-items:center;gap:4px;';
        copyBtn.innerHTML = '<svg width="9" height="9" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy';
        codeWrap.appendChild(copyBtn);
        body.appendChild(codeWrap);
      }

      wrap.appendChild(num);
      wrap.appendChild(body);
      stepsEl.appendChild(wrap);
    });

    // Install note
    var noteEl     = document.getElementById('am-note');
    var noteTextEl = document.getElementById('am-note-text');
    if (noteEl && noteTextEl) {
      if (addon.installNote) {
        noteTextEl.textContent = addon.installNote;
        noteEl.style.display   = 'flex';
      } else {
        noteEl.style.display = 'none';
      }
    }

    switchTab('overview');
    openOverlay();
  }

  // Tab clicks
  modal.querySelectorAll('.addon-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { switchTab(tab.dataset.tab); });
  });

  if (goInstall)  goInstall.addEventListener('click',  function () { switchTab('install'); });
  if (closeBtn)   closeBtn.addEventListener('click',   closeOverlay);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlay(); });

  // Card clicks
  cards.forEach(function (card) {
    card.addEventListener('click', function () {
      try {
        openAddon(JSON.parse(card.dataset.addon));
      } catch (err) {
        console.error('addon parse error', err);
      }
    });
  });
})();
