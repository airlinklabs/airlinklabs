(function() {
  // ── Search + tag filter ───────────────────────────────────────────────
  var searchInput = document.getElementById('reg-search');
  var cards       = Array.from(document.querySelectorAll('.addon-card'));
  var emptyEl     = document.getElementById('reg-empty');
  var activeTag   = 'all';
  var searchQuery = '';

  function filterCards() {
    var q = searchQuery.trim().toLowerCase();
    var visible = 0;
    cards.forEach(function(card) {
      var name = (card.dataset.name || '');
      var desc = (card.dataset.desc || '');
      var tags = (card.dataset.tags || '');

      var matchesSearch = !q || name.indexOf(q) !== -1 || desc.indexOf(q) !== -1;
      var matchesTag    = activeTag === 'all' || tags.split(',').indexOf(activeTag) !== -1;

      if (matchesSearch && matchesTag) {
        card.style.display = '';
        visible++;
      } else {
        card.style.display = 'none';
      }
    });
    if (emptyEl) emptyEl.style.display = visible === 0 ? 'block' : 'none';
    // hide the grid border when empty
    var grid = document.getElementById('addon-grid');
    if (grid) grid.style.display = visible === 0 ? 'none' : '';
  }

  if (searchInput) {
    searchInput.addEventListener('input', function() {
      searchQuery = searchInput.value;
      filterCards();
    });
  }

  document.querySelectorAll('.tag-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      activeTag = btn.dataset.tag || 'all';
      // visual state
      document.querySelectorAll('.tag-btn').forEach(function(b) {
        var isActive = b.dataset.tag === activeTag;
        b.style.color       = isActive ? 'var(--color-text-1)'        : 'var(--color-text-3)';
        b.style.background  = isActive ? 'var(--color-bg-3)'          : 'transparent';
        b.style.borderColor = isActive ? 'var(--color-border-input)'  : 'var(--color-border)';
      });
      filterCards();
    });
  });

  // ── Modal ─────────────────────────────────────────────────────────────
  var overlay  = document.getElementById('addon-overlay');
  var modal    = document.getElementById('addon-modal');
  var closeBtn = document.getElementById('am-close');
  var goInstall = document.getElementById('am-go-install');

  if (!overlay || !modal) return;

  function openOverlay() {
    overlay.style.opacity       = '1';
    overlay.style.pointerEvents = 'auto';
    modal.style.transform       = 'translateY(0)';
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    overlay.style.opacity       = '0';
    overlay.style.pointerEvents = 'none';
    modal.style.transform       = 'translateY(12px)';
    document.body.style.overflow = '';
  }

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function switchTab(name) {
    modal.querySelectorAll('.addon-tab').forEach(function(t) {
      var on = t.dataset.tab === name;
      t.style.borderBottomColor = on ? 'var(--color-text-1)' : 'transparent';
      t.style.color             = on ? 'var(--color-text-1)' : 'var(--color-text-3)';
    });
    modal.querySelectorAll('.addon-panel').forEach(function(p) {
      p.style.display = p.dataset.panel === name ? '' : 'none';
    });
  }

  function openAddon(addon) {
    // icon
    var iconEl = document.getElementById('am-icon');
    iconEl.innerHTML = '';
    if (addon.icon) {
      var img = document.createElement('img');
      img.src = addon.icon;
      img.alt = '';
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      img.onerror = function() {
        iconEl.innerHTML = puzzleIcon();
      };
      iconEl.appendChild(img);
    } else {
      iconEl.innerHTML = puzzleIcon();
    }

    document.getElementById('am-name').textContent   = addon.name || '';
    document.getElementById('am-byline').textContent = 'by ' + (addon.author || 'Unknown') + ' · ' + (addon.version || '');
    document.getElementById('am-github').href        = addon.github || '#';
    document.getElementById('am-desc').textContent   = addon.longDescription || addon.description || '';

    // features
    var featEl = document.getElementById('am-features');
    featEl.innerHTML = '';
    if (addon.features && addon.features.length) {
      var title = document.createElement('p');
      title.style.cssText = 'font-size:10px;font-family:var(--font-mono);color:var(--color-text-3);text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;';
      title.textContent = 'Features';
      featEl.appendChild(title);
      var ul = document.createElement('ul');
      ul.style.cssText = 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;';
      addon.features.forEach(function(f) {
        var li = document.createElement('li');
        li.style.cssText = 'display:flex;align-items:flex-start;gap:7px;font-size:12px;color:var(--color-text-2);line-height:1.5;';
        li.innerHTML = '<svg width="11" height="11" fill="none" stroke="var(--color-success)" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>' + esc(f);
        ul.appendChild(li);
      });
      featEl.appendChild(ul);
    }

    // install steps
    var stepsEl = document.getElementById('am-steps');
    stepsEl.innerHTML = '';
    (addon.installSteps || []).forEach(function(step, i) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:12px;align-items:flex-start;margin-bottom:14px;';
      var num = document.createElement('div');
      num.style.cssText = 'width:20px;height:20px;flex-shrink:0;border:1px solid var(--color-border);border-radius:50%;background:var(--color-bg-3);display:flex;align-items:center;justify-content:center;font-size:10px;font-family:var(--font-mono);color:var(--color-text-3);margin-top:1px;';
      num.textContent = i + 1;
      var body = document.createElement('div');
      body.style.cssText = 'flex:1;min-width:0;';
      if (step.title) {
        var h4 = document.createElement('h4');
        h4.style.cssText = 'font-size:12px;font-weight:600;color:var(--color-text-1);margin:0 0 7px;';
        h4.textContent = step.title;
        body.appendChild(h4);
      }
      var codeWrap = document.createElement('div');
      codeWrap.className = 'code-block';
      codeWrap.style.cssText = 'background:var(--color-bg);border:1px solid var(--color-border);border-radius:8px;padding:10px 12px;position:relative;';
      (step.commands || []).forEach(function(cmd) {
        var code = document.createElement('code');
        code.style.cssText = 'font-size:11px;color:var(--color-text-1);font-family:var(--font-mono);line-height:1.6;display:block;';
        code.textContent = cmd;
        codeWrap.appendChild(code);
      });
      // copy button
      var copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      copyBtn.style.cssText = 'position:absolute;top:6px;right:6px;font-size:10px;font-family:var(--font-mono);color:var(--color-text-3);background:var(--color-bg-2);border:1px solid var(--color-border);padding:2px 7px;border-radius:4px;cursor:pointer;';
      copyBtn.innerHTML = 'Copy';
      codeWrap.appendChild(copyBtn);
      body.appendChild(codeWrap);
      wrap.appendChild(num);
      wrap.appendChild(body);
      stepsEl.appendChild(wrap);
    });

    // note
    var noteEl     = document.getElementById('am-note');
    var noteTextEl = document.getElementById('am-note-text');
    if (addon.installNote && noteEl && noteTextEl) {
      noteTextEl.textContent = addon.installNote;
      noteEl.style.display   = 'flex';
    } else if (noteEl) {
      noteEl.style.display = 'none';
    }

    switchTab('overview');
    openOverlay();
  }

  function puzzleIcon() {
    return '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--color-text-3);"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
  }

  // Tab clicks
  modal.querySelectorAll('.addon-tab').forEach(function(tab) {
    tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
  });

  if (goInstall) goInstall.addEventListener('click', function() { switchTab('install'); });
  closeBtn.addEventListener('click', closeOverlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeOverlay(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeOverlay(); });

  // Card clicks
  cards.forEach(function(card) {
    card.addEventListener('click', function() {
      try {
        var addon = JSON.parse(card.dataset.addon);
        openAddon(addon);
      } catch(err) { console.error('addon parse error', err); }
    });
  });
})();
