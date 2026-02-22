// docs.js - markdown parser + doc page initialiser

function parseMarkdown(md) {
  var blocks = [];

  // fenced code blocks
  md = md.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
    var esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var idx = blocks.length;
    blocks.push('<pre><code>' + esc + '</code><button class="copy-btn">' + getIcon('copy') + ' Copy</button></pre>');
    return '\x00BLOCK' + idx + '\x00';
  });

  // inline code
  md = md.replace(/`([^`]+)`/g, '<code>$1</code>');

  // headings
  md = md.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  md = md.replace(/^### (.+)$/gm,  '<h3>$1</h3>');
  md = md.replace(/^## (.+)$/gm,   '<h2>$1</h2>');
  md = md.replace(/^# (.+)$/gm,    '<h1>$1</h1>');

  // blockquote
  md = md.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // bold/italic
  md = md.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  md = md.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // hr
  md = md.replace(/^---$/gm, '<hr>');

  // links
  md = md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // unordered lists
  md = md.replace(/((?:^- .+\n?)+)/gm, function (block) {
    var items = block.trim().split('\n').map(function (l) { return '<li>' + l.replace(/^- /, '') + '</li>'; }).join('');
    return '<ul>' + items + '</ul>';
  });

  // ordered lists
  md = md.replace(/((?:^\d+\. .+\n?)+)/gm, function (block) {
    var items = block.trim().split('\n').map(function (l) { return '<li>' + l.replace(/^\d+\. /, '') + '</li>'; }).join('');
    return '<ol>' + items + '</ol>';
  });

  // paragraphs
  md = md.replace(/^(?!<[a-z%\x00])(.+)$/gm, function (line) {
    if (line.indexOf('\x00BLOCK') === 0) return line;
    return '<p>' + line + '</p>';
  });

  // restore code blocks
  md = md.replace(/\x00BLOCK(\d+)\x00/g, function (_, i) { return blocks[parseInt(i)]; });
  return md;
}

function buildTOC(contentEl) {
  var headings = Array.from(contentEl.querySelectorAll('h2, h3'));
  if (headings.length < 2) return;
  var tocLinks = document.getElementById('toc-links');
  var tocContainer = document.getElementById('docs-toc');
  if (!tocLinks || !tocContainer) return;
  tocLinks.innerHTML = '';
  headings.forEach(function (h, i) {
    h.id = 'h-' + i;
    var a = document.createElement('a');
    a.href = '#h-' + i;
    a.className = 'docs-toc-link' + (h.tagName === 'H3' ? ' h3' : '');
    a.textContent = h.textContent;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
    });
    tocLinks.appendChild(a);
  });
  tocContainer.style.display = 'block';
}

function attachCopyBtns(el) {
  el.querySelectorAll('pre .copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var code = btn.previousElementSibling.textContent;
      navigator.clipboard.writeText(code).then(function () {
        btn.innerHTML = getIcon('check') + ' Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.innerHTML = getIcon('copy') + ' Copy';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });
}

function initDocSearch(contentEl) {
  var searchWrap = document.createElement('div');
  searchWrap.className = 'docs-search-wrap';
  searchWrap.innerHTML =
    '<span class="docs-search-icon" id="docs-search-icon"></span>' +
    '<input type="text" id="docs-search-input" class="docs-search-input" placeholder="Search this page..." autocomplete="off" spellcheck="false">' +
    '<button class="docs-search-clear" id="docs-search-clear" style="display:none;"></button>';

  var parent = contentEl.parentNode;
  parent.insertBefore(searchWrap, contentEl);

  document.getElementById('docs-search-icon').innerHTML = getIcon('search', 13);
  document.getElementById('docs-search-clear').innerHTML = getIcon('close', 11);

  var input = document.getElementById('docs-search-input');
  var clearBtn = document.getElementById('docs-search-clear');
  var highlights = [];

  function clearHighlights() {
    highlights.forEach(function (el) {
      var parent = el.parentNode;
      if (parent) parent.replaceChild(document.createTextNode(el.textContent), el);
    });
    highlights = [];
    contentEl.normalize();
  }

  function highlightText(query) {
    clearHighlights();
    if (!query) return;
    var walker = document.createTreeWalker(contentEl, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);

    var re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    var firstHit = null;

    nodes.forEach(function (textNode) {
      if (!textNode.nodeValue.match(re)) return;
      var frag = document.createDocumentFragment();
      var parts = textNode.nodeValue.split(re);
      parts.forEach(function (part) {
        if (re.test(part)) {
          re.lastIndex = 0;
          var mark = document.createElement('mark');
          mark.className = 'docs-highlight';
          mark.textContent = part;
          highlights.push(mark);
          if (!firstHit) firstHit = mark;
          frag.appendChild(mark);
        } else {
          frag.appendChild(document.createTextNode(part));
        }
        re.lastIndex = 0;
      });
      textNode.parentNode.replaceChild(frag, textNode);
    });

    if (firstHit) {
      setTimeout(function () {
        firstHit.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }

  input.addEventListener('input', function () {
    var q = input.value.trim();
    clearBtn.style.display = q ? 'flex' : 'none';
    highlightText(q);
  });

  clearBtn.addEventListener('click', function () {
    input.value = '';
    clearBtn.style.display = 'none';
    clearHighlights();
    input.focus();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      if (document.getElementById('docs-search-input')) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      clearBtn.style.display = 'none';
      clearHighlights();
      input.blur();
    }
  });
}

// ---- FIXED: was missing the function declaration entirely ----
function buildFooterNav(manifest, slug, rootPath) {
  var nav = document.getElementById('docs-footer-nav');
  if (!nav) return;
  var idx = manifest.findIndex(function (d) { return d.slug === slug; });
  nav.innerHTML = '';
  if (idx > 0) {
    var prev = manifest[idx - 1];
    nav.innerHTML += '<a href="' + rootPath + 'docs/' + prev.slug + '/">' +
      '<span class="nav-lbl">' + getIcon('arrowLeft', 11) + ' Previous</span>' +
      '<span class="nav-ttl">' + escHtml(prev.title) + '</span></a>';
  }
  if (idx < manifest.length - 1) {
    var next = manifest[idx + 1];
    nav.innerHTML += '<a href="' + rootPath + 'docs/' + next.slug + '/" class="next">' +
      '<span class="nav-lbl">Next ' + getIcon('arrowRight', 11) + '</span>' +
      '<span class="nav-ttl">' + escHtml(next.title) + '</span></a>';
  }
}

function initDocPage(slug, rootPath) {
  var contentEl = document.getElementById('docs-content');
  var navEl = document.getElementById('docs-nav');
  if (!contentEl) return;

  var manifest = (window.SITE_CONFIG && window.SITE_CONFIG.docs && window.SITE_CONFIG.docs.manifest) || [];

  // sidebar
  if (navEl) {
    navEl.innerHTML = '';
    manifest.forEach(function (doc) {
      var a = document.createElement('a');
      a.href = rootPath + 'docs/' + doc.slug + '/';
      a.className = 'docs-nav-link' + (doc.slug === slug ? ' active' : '');
      a.textContent = doc.title;
      navEl.appendChild(a);
    });
    // add readme/announcements link
    var readmeA = document.createElement('a');
    readmeA.href = rootPath + 'docs/readme/';
    readmeA.className = 'docs-nav-link' + (slug === 'readme' ? ' active' : '');
    readmeA.innerHTML = getIcon('fileText', 13) + ' Announcements';
    navEl.appendChild(readmeA);
  }

  var current = manifest.find(function (d) { return d.slug === slug; });
  if (current) {
    document.title = current.title + ' — AirLink Docs';
    var bt = document.getElementById('breadcrumb-title');
    if (bt) bt.textContent = current.title;
  }

  fetch('docs.md')
    .then(function (r) { if (!r.ok) throw new Error('404'); return r.text(); })
    .then(function (md) {
      contentEl.innerHTML = parseMarkdown(md);
      buildTOC(contentEl);
      attachCopyBtns(contentEl);
      buildFooterNav(manifest, slug, rootPath);
      initDocSearch(contentEl);
    })
    .catch(function () {
      contentEl.innerHTML = '<p class="docs-error">Could not load <code>docs.md</code>.</p>';
    });
}
