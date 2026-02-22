// contributors.js - fetches and renders contributors + member popup

var _memberOverlay = null;
var _allDetails = {};
var _allCustom = {};

function initMemberPopup() {
  _memberOverlay = document.createElement('div');
  _memberOverlay.className = 'member-overlay';
  _memberOverlay.innerHTML =
    '<div class="member-popup">' +
      '<div class="member-popup-header">' +
        '<div class="member-popup-avatar"><img id="mp-avatar" src="" alt=""></div>' +
        '<div class="member-popup-name-block">' +
          '<div class="member-popup-name" id="mp-name"></div>' +
          '<div class="member-popup-handle" id="mp-handle"></div>' +
          '<span class="member-popup-role" id="mp-role"></span>' +
        '</div>' +
        '<button class="member-popup-close-btn" id="mp-close">' + getIcon('close') + '</button>' +
      '</div>' +
      '<div class="member-popup-body">' +
        '<div class="member-popup-left" id="mp-left"></div>' +
        '<div class="member-popup-right" id="mp-right"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(_memberOverlay);

  _memberOverlay.addEventListener('click', function (e) {
    if (e.target === _memberOverlay) closeMember();
  });
  document.getElementById('mp-close').addEventListener('click', closeMember);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMember(); });
}

function closeMember() {
  if (_memberOverlay) {
    _memberOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function openMember(contributor, maxContribs) {
  if (!_memberOverlay) initMemberPopup();

  var login = contributor.login;
  var custom = _allCustom[login] || {};
  var details = _allDetails[login] || {};

  var name = custom.name || details.name || login;
  var role = custom.role || (contributor.contributions > 1 ? contributor.contributions + ' commits' : 'Contributor');
  var about = custom.about || details.bio || '';
  var tagline = custom.tagline || '';
  var location = details.location || '';
  var joined = details.created_at ? new Date(details.created_at).getFullYear() : null;
  var repos = details.public_repos;
  var followers = details.followers;
  var blog = details.blog || '';
  var twitter = details.twitter_username || '';
  var pct = maxContribs > 0 ? Math.round(contributor.contributions / maxContribs * 100) : 0;

  var hue = 0;
  for (var i = 0; i < login.length; i++) hue = (hue + login.charCodeAt(i) * 37) % 360;
  var accentColor = 'hsl(' + hue + ',60%,62%)';

  var avatarEl = document.getElementById('mp-avatar');
  if (avatarEl) { avatarEl.src = contributor.avatar_url; avatarEl.alt = name; }
  var nameEl = document.getElementById('mp-name');
  var handleEl = document.getElementById('mp-handle');
  var roleEl = document.getElementById('mp-role');
  if (nameEl) nameEl.textContent = name;
  if (handleEl) handleEl.textContent = '@' + login;
  if (roleEl) roleEl.textContent = role;

  var left = document.getElementById('mp-left');
  left.innerHTML = '';

  if (about || tagline) {
    var aboutSec = document.createElement('div');
    aboutSec.innerHTML =
      '<div class="member-section-title">About</div>' +
      (tagline ? '<div class="member-tagline">&ldquo;' + escHtml(tagline) + '&rdquo;</div>' : '') +
      (about ? '<div class="member-about-text">' + escHtml(about) + '</div>' : '');
    left.appendChild(aboutSec);
  }

  var statsSec = document.createElement('div');
  var statsHtml = '<div class="member-section-title">Details</div><div class="member-stat-row">';
  if (location) statsHtml += '<div class="member-stat-item">' + getIcon('mapPin') + escHtml(location) + '</div>';
  if (joined) statsHtml += '<div class="member-stat-item">' + getIcon('calendar') + 'GitHub since ' + joined + '</div>';
  if (repos != null) statsHtml += '<div class="member-stat-item">' + getIcon('package') + repos + ' public repos</div>';
  if (followers != null) statsHtml += '<div class="member-stat-item">' + getIcon('userGroup') + followers + ' followers</div>';
  statsHtml += '</div>';
  statsSec.innerHTML = statsHtml;
  left.appendChild(statsSec);

  var linksSec = document.createElement('div');
  var linksHtml = '<div class="member-section-title">Links</div><div class="member-links">';
  linksHtml += '<a href="' + contributor.html_url + '" class="member-link" target="_blank" rel="noopener">' + getIcon('github') + 'GitHub</a>';
  if (blog) {
    var blogUrl = blog.startsWith('http') ? blog : 'https://' + blog;
    linksHtml += '<a href="' + escHtml(blogUrl) + '" class="member-link" target="_blank" rel="noopener">' + getIcon('globe') + 'Website</a>';
  }
  if (twitter) {
    linksHtml += '<a href="https://twitter.com/' + escHtml(twitter) + '" class="member-link" target="_blank" rel="noopener">' + getIcon('twitter') + '@' + escHtml(twitter) + '</a>';
  }
  linksHtml += '</div>';
  linksSec.innerHTML = linksHtml;
  left.appendChild(linksSec);

  var right = document.getElementById('mp-right');
  right.innerHTML = '';

  var box1 = document.createElement('div');
  box1.className = 'member-activity-box';
  box1.innerHTML =
    '<div class="member-right-title member-section-title">Contribution Activity</div>' +
    '<h4>' + contributor.contributions + ' commits to AirLink</h4>' +
    '<div class="member-contrib-bar">' +
      '<div class="member-contrib-pct"><span>Commits</span><span>' + pct + '%</span></div>' +
      '<div class="member-contrib-track"><div class="member-contrib-fill" style="width:' + pct + '%;background:' + accentColor + '"></div></div>' +
    '</div>' +
    '<p style="font-size:12px;color:var(--text3);margin-top:8px;">Across panel &amp; daemon repos</p>';
  right.appendChild(box1);

  if (repos != null || followers != null) {
    var box2 = document.createElement('div');
    box2.className = 'member-activity-box';
    box2.innerHTML =
      '<div class="member-section-title">GitHub Stats</div>' +
      (repos != null ? '<h4>' + repos + ' public repos</h4>' : '') +
      (followers != null ? '<p>' + followers + ' followers on GitHub</p>' : '');
    right.appendChild(box2);
  }

  var box3 = document.createElement('div');
  box3.className = 'member-activity-box';
  box3.innerHTML =
    '<div class="member-section-title">Tech Stack</div>' +
    '<div class="member-tags">' +
      '<span class="member-tag">TypeScript</span>' +
      '<span class="member-tag">Node.js</span>' +
      '<span class="member-tag">Open Source</span>' +
    '</div>';
  right.appendChild(box3);

  _memberOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function loadContributors() {
  var grid = document.getElementById('contributors-grid');
  if (!grid) return;

  initMemberPopup();

  var cfg = window.SITE_CONFIG && window.SITE_CONFIG.team || {};
  var repos = cfg.repos || ['AirlinkLabs/panel', 'AirlinkLabs/daemon'];
  _allCustom = cfg.customContributors || {};

  Promise.all(
    repos.map(function (r) {
      return cachedFetch('contributors-' + r, 'https://api.github.com/repos/' + r + '/contributors?per_page=100')
        .catch(function () { return []; });
    })
  ).then(function (results) {
    var map = new Map();
    results.flat().forEach(function (c) {
      if (!c || !c.id) return;
      var ex = map.get(c.id);
      if (ex) ex.contributions += c.contributions;
      else map.set(c.id, Object.assign({}, c));
    });

    var sorted = Array.from(map.values()).sort(function (a, b) { return b.contributions - a.contributions; });

    // FIX: use querySelectorAll since these IDs appear multiple times in index.html
    var total = sorted.reduce(function (s, c) { return s + c.contributions; }, 0);
    document.querySelectorAll('#stat-contributors').forEach(function (el) { el.textContent = sorted.length || '—'; });
    document.querySelectorAll('#stat-commits').forEach(function (el) { el.textContent = total || '—'; });

    if (!sorted.length) {
      grid.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px;font-family:var(--mono);">No contributors found.</div>';
      return;
    }

    return Promise.all(
      sorted.map(function (c) {
        return cachedFetch('user-' + c.login, 'https://api.github.com/users/' + c.login)
          .catch(function () { return null; });
      })
    ).then(function (details) {
      sorted.forEach(function (c, i) { _allDetails[c.login] = details[i] || {}; });

      var maxContribs = sorted[0].contributions;
      grid.innerHTML = '';

      sorted.forEach(function (contributor, i) {
        var login = contributor.login;
        var custom = _allCustom[login] || {};
        var det = _allDetails[login] || {};

        var name = custom.name || det.name || login;
        var bio = custom.about || det.bio || '';
        var loc = det.location || '';
        var initials = name.substring(0, 2).toUpperCase();
        var pct = Math.round(contributor.contributions / maxContribs * 100);

        var hue = 0;
        for (var j = 0; j < login.length; j++) hue = (hue + login.charCodeAt(j) * 37) % 360;
        var accent = 'hsl(' + hue + ',60%,62%)';
        var accentDim = 'hsl(' + hue + ',40%,22%)';

        var rankBadge = '';
        if (i === 0) rankBadge = '<span class="contrib-rank-badge rank-lead">Lead</span>';
        else if (i <= 2) rankBadge = '<span class="contrib-rank-badge rank-core">Core</span>';

        var bioShort = bio.length > 78 ? bio.slice(0, 76) + '…' : bio;

        var card = document.createElement('div');
        card.className = 'contrib-card fade-up fade-up-d' + Math.min((i % 6) + 1, 6);
        card.innerHTML =
          '<div style="height:3px;background:linear-gradient(90deg,' + accentDim + ',' + accent + ')"></div>' +
          '<div class="contrib-card-top">' +
            '<div class="contrib-avatar">' +
              '<img src="' + contributor.avatar_url + '" alt="' + escHtml(name) + '" loading="lazy" ' +
                'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">' +
              '<div class="contrib-avatar-init" style="display:none;background:' + accentDim + ';color:' + accent + '">' + initials + '</div>' +
            '</div>' +
            '<div class="contrib-info">' +
              '<div class="contrib-name">' + escHtml(name) + '</div>' +
              '<div class="contrib-handle">@' + escHtml(login) + '</div>' +
            '</div>' +
            rankBadge +
          '</div>' +
          '<div class="contrib-card-body">' +
            '<p class="contrib-bio">' + escHtml(bioShort) + '</p>' +
            '<div class="contrib-bar-row">' +
              '<div class="contrib-bar-track"><div class="contrib-bar-fill" style="width:' + pct + '%;background:' + accent + '"></div></div>' +
              '<span class="contrib-commits-count">' + contributor.contributions + ' commits</span>' +
            '</div>' +
          '</div>' +
          '<div class="contrib-card-footer">' +
            '<span class="contrib-location">' + (loc ? getIcon('mapPin') + escHtml(loc.length > 18 ? loc.slice(0, 16) + '…' : loc) : '') + '</span>' +
            '<span class="contrib-view">Profile ' + getIcon('arrowRight') + '</span>' +
          '</div>';

        card.addEventListener('click', function () {
          openMember(contributor, maxContribs);
        });

        grid.appendChild(card);
      });

      initScrollAnimations && initScrollAnimations();
    });
  }).catch(function (err) {
    console.error('contributors error:', err);
    grid.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px;font-family:var(--mono);">Failed to load contributors.</div>';
  });
}

loadContributors();
