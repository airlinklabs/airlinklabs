// commits.js - recent commit previews and popup

var _commitsState = {};

function timeAgo(date) {
  var s = Math.floor((Date.now() - date) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
  return Math.floor(s / 2592000) + 'mo ago';
}

function buildCommitItem(c, isFirst) {
  var date = new Date(c.commit.author.date);
  var msg = c.commit.message.split('\n')[0];
  var author = (c.author && c.author.login) || c.commit.author.name;
  var avatar = c.author && c.author.avatar_url;
  var sha = c.sha.slice(0, 7);

  var div = document.createElement('div');
  div.className = 'commit-item' + (isFirst ? ' latest' : '');
  div.innerHTML =
    (isFirst ? '<div class="commit-badge">' + getIcon('star', 10) + ' Latest</div>' : '') +
    '<div class="commit-item-top">' +
      (avatar ? '<img src="' + avatar + '" class="commit-avatar-img" onerror="this.style.display=\'none\'">' : '') +
      '<span class="commit-author">' + escHtml(author) + '</span>' +
      '<span class="commit-time">' + timeAgo(date) + '</span>' +
    '</div>' +
    '<a href="' + c.html_url + '" class="commit-msg-link" target="_blank" rel="noopener">' + escHtml(msg) + '</a>' +
    '<span class="commit-sha">' + getIcon('commit', 10) + ' ' + sha + '</span>';
  return div;
}

function fetchCommitPreview(repo) {
  return cachedFetch('commits-preview-' + repo,
    'https://api.github.com/repos/' + repo + '/commits?per_page=3').catch(function () { return []; });
}

function fetchCommitsPage(repo, page) {
  return cachedFetch('commits-' + repo + '-p' + page,
    'https://api.github.com/repos/' + repo + '/commits?per_page=15&page=' + page).catch(function () { return []; });
}

function initCommitsPopup() {
  var overlay = document.createElement('div');
  overlay.className = 'commits-overlay';
  overlay.innerHTML =
    '<div class="commits-popup">' +
      '<div class="commits-popup-header">' +
        '<div>' +
          '<div class="commits-popup-repo" id="cp-repo"></div>' +
          '<div class="commits-popup-sub">Commit history</div>' +
        '</div>' +
        '<button class="commits-popup-close" id="cp-close">' + getIcon('close') + '</button>' +
      '</div>' +
      '<div class="commits-popup-body" id="cp-body"></div>' +
      '<div class="commits-popup-footer" id="cp-footer" style="display:none">' +
        '<button class="btn-load-more" id="cp-load-more">Load more</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  var body = document.getElementById('cp-body');
  var footer = document.getElementById('cp-footer');
  var loadMore = document.getElementById('cp-load-more');
  var repoLabel = document.getElementById('cp-repo');
  var currentRepo = null;

  function close() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  document.getElementById('cp-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('active')) close(); });

  // load more is bound once, uses currentRepo
  loadMore.addEventListener('click', function () {
    if (!currentRepo) return;
    var s = _commitsState[currentRepo];
    if (!s || s.done) return;
    loadMore.disabled = true;
    loadMore.textContent = 'Loading...';
    fetchCommitsPage(currentRepo, s.page).then(function (more) {
      s.page++;
      more.forEach(function (c) {
        s.commits.push(c);
        body.appendChild(buildCommitItem(c, false));
      });
      if (more.length < 15) {
        s.done = true;
        footer.style.display = 'none';
      } else {
        loadMore.disabled = false;
        loadMore.textContent = 'Load more';
      }
    }).catch(function () {
      loadMore.disabled = false;
      loadMore.textContent = 'Load more';
    });
  });

  function open(repo) {
    currentRepo = repo;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    repoLabel.textContent = repo;

    // if we already have data, render it right away
    var st = _commitsState[repo];
    if (st && st.commits.length) {
      body.innerHTML = '';
      st.commits.forEach(function (c, i) { body.appendChild(buildCommitItem(c, i === 0)); });
      footer.style.display = st.done ? 'none' : 'block';
      loadMore.disabled = false;
      loadMore.textContent = 'Load more';
      return;
    }

    body.innerHTML = '<div class="commit-loading">Loading...</div>';
    footer.style.display = 'none';

    fetchCommitsPage(repo, 1).then(function (commits) {
      _commitsState[repo] = { page: 2, commits: commits, done: commits.length < 15 };
      body.innerHTML = '';
      if (!commits.length) {
        body.innerHTML = '<div class="commit-loading">No commits found.</div>';
        return;
      }
      commits.forEach(function (c, i) { body.appendChild(buildCommitItem(c, i === 0)); });
      footer.style.display = _commitsState[repo].done ? 'none' : 'block';
      loadMore.disabled = false;
      loadMore.textContent = 'Load more';
    }).catch(function () {
      body.innerHTML = '<div class="commit-loading" style="color:var(--red)">Could not load commits.</div>';
    });
  }

  // use event delegation so it works even if buttons are added after this runs
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-view-commits');
    if (btn) {
      var repo = btn.dataset.repo;
      if (repo) open(repo);
    }
  });
}

function loadCommitPreviews() {
  var cfg = window.SITE_CONFIG && window.SITE_CONFIG.site || {};
  var panel = cfg.githubPanel || 'AirlinkLabs/panel';
  var daemon = cfg.githubDaemon || 'AirlinkLabs/daemon';

  // update labels and data-repo from config in case they differ
  var panelLabel = document.getElementById('panel-repo-label');
  var daemonLabel = document.getElementById('daemon-repo-label');
  var btnPanel = document.getElementById('btn-view-panel');
  var btnDaemon = document.getElementById('btn-view-daemon');
  if (panelLabel) panelLabel.textContent = panel.split('/').pop();
  if (daemonLabel) daemonLabel.textContent = daemon.split('/').pop();
  if (btnPanel) btnPanel.dataset.repo = panel;
  if (btnDaemon) btnDaemon.dataset.repo = daemon;

  [{ repo: panel, id: 'preview-panel' }, { repo: daemon, id: 'preview-daemon' }].forEach(function (p) {
    var el = document.getElementById(p.id);
    if (!el) return;
    fetchCommitPreview(p.repo).then(function (commits) {
      el.innerHTML = '';
      if (!commits.length) {
        el.innerHTML = '<div class="commit-loading">No commits found.</div>';
        return;
      }
      commits.slice(0, 3).forEach(function (c, i) { el.appendChild(buildCommitItem(c, i === 0)); });
    }).catch(function () {
      el.innerHTML = '<div class="commit-loading" style="color:var(--red)">Could not load.</div>';
    });
  });
}

initCommitsPopup();
loadCommitPreviews();
