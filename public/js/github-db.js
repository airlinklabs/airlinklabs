// ── GitHub data loader: SQLite db → API fallback → localStorage cache ─────
(function () {
  var PANEL_REPO = "AirlinkLabs/panel";
  var DAEMON_REPO = "AirlinkLabs/daemon";
  var DB_URL = "public/assets/github.db";
  var LS_KEY = "airlink_github_data";
  var LS_TTL = 10 * 60 * 1000; // 10 min

  var SQL = null;

  // ── Load sql.js from CDN ────────────────────────────────────────────────
  function loadSqlJs() {
    return new Promise(function (resolve, reject) {
      if (window.initSqlJs) {
        window
          .initSqlJs({
            locateFile: function (f) {
              return (
                "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.2/" + f
              );
            },
          })
          .then(resolve)
          .catch(reject);
        return;
      }
      var s = document.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.2/sql-wasm.js";
      s.onload = function () {
        window
          .initSqlJs({
            locateFile: function (f) {
              return (
                "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.14.2/" + f
              );
            },
          })
          .then(resolve)
          .catch(reject);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── Safe DB query — returns [] instead of throwing on empty tables ──────
  function safeQuery(db, sql) {
    try {
      var results = db.exec(sql);
      if (!results || !results.length || !results[0].values) return [];
      return results[0].values;
    } catch (e) {
      return [];
    }
  }

  // ── Fetch the built-in .db file ─────────────────────────────────────────
  async function loadBuiltinDb() {
    var res = await fetch(DB_URL);
    if (!res.ok) throw new Error("Failed to fetch " + DB_URL);
    var buf = await res.arrayBuffer();
    SQL = await loadSqlJs();
    return new SQL.Database(new Uint8Array(buf));
  }

  // ── Fetch fresh data from GitHub API ────────────────────────────────────
  async function fetchGitHubData() {
    var headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    async function ghFetch(url) {
      var r = await fetch(url, { headers });
      if (!r.ok) throw new Error(r.status + " " + url);
      return r.json();
    }

    // Fetch all repos in the AirlinkLabs org
    var repos = [];
    try {
      repos = await ghFetch(
        "https://api.github.com/orgs/AirlinkLabs/repos?per_page=100",
      );
    } catch (e) {
      // Fallback to known repos
      repos = [{ full_name: PANEL_REPO }, { full_name: DAEMON_REPO }];
    }

    // Tag commits with repo and normalize
    function normalizeCommit(c, repo) {
      var commit = c.commit || {};
      var author = commit.author || {};
      var ghAuthor = c.author || {};
      return {
        sha: c.sha || "",
        repo: repo,
        message: author.message || commit.message || "",
        author_name: author.name || "",
        author_date: author.date || "",
        author_avatar: ghAuthor.avatar_url || "",
        html_url: c.html_url || "",
      };
    }

    // Fetch commits from each repo (limit to keep within rate limits)
    var commitPromises = (repos || []).slice(0, 10).map(function (repo) {
      return ghFetch(
        "https://api.github.com/repos/" +
          repo.full_name +
          "/commits?per_page=10",
      )
        .then(function (commits) {
          return {
            repo: repo.full_name.replace("AirlinkLabs/", ""),
            commits: commits,
          };
        })
        .catch(function () {
          return {
            repo: repo.full_name.replace("AirlinkLabs/", ""),
            commits: [],
          };
        });
    });

    var repoResults = await Promise.all(commitPromises);
    var allCommits = [];
    repoResults.forEach(function (r) {
      (r.commits || []).forEach(function (c) {
        allCommits.push(normalizeCommit(c, r.repo));
      });
    });

    // Sort all commits by date descending
    allCommits.sort(function (a, b) {
      return new Date(b.author_date) - new Date(a.author_date);
    });

    // Fetch contributors from all repos
    var contribMap = {};
    var contribPromises = (repos || []).slice(0, 10).map(function (repo) {
      return ghFetch(
        "https://api.github.com/repos/" +
          repo.full_name +
          "/contributors?per_page=100",
      ).catch(function () {
        return [];
      });
    });

    var contribResults = await Promise.all(contribPromises);
    contribResults.forEach(function (list) {
      (list || []).forEach(function (c) {
        if (!c.login || c.login.indexOf("[bot]") !== -1) return;
        if (contribMap[c.login]) {
          contribMap[c.login].contributions += c.contributions;
        } else {
          contribMap[c.login] = {
            login: c.login,
            avatar_url: c.avatar_url,
            html_url: c.html_url,
            contributions: c.contributions,
          };
        }
      });
    });

    return {
      commits: allCommits,
      contributors: Object.values(contribMap).sort(function (a, b) {
        return b.contributions - a.contributions;
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Render commits ──────────────────────────────────────────────────────
  function renderCommits(commits) {
    var el = document.getElementById("commit-list");
    if (!el) return;

    if (!commits || !commits.length) {
      el.innerHTML = '<p class="hub-empty">No commits found.</p>';
      return;
    }

    var COMMIT_SHOW = 5;

    function formatDate(c) {
      if (!c.author_date) return "";
      var d = new Date(c.author_date);
      var now = new Date();
      var diff = Math.floor((now - d) / 1000);
      if (diff < 60) return "just now";
      if (diff < 3600) return Math.floor(diff / 60) + "m ago";
      if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
      if (diff < 86400 * 30) return Math.floor(diff / 86400) + "d ago";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    function renderSingle(c) {
      var msg = (c.message || "").split("\n")[0].trim();
      if (msg.length > 82) msg = msg.slice(0, 79) + "…";
      if (!msg) msg = "No commit message";

      var date = formatDate(c);
      var repoLabel = c.repo;
      var sha = (c.sha || "").slice(0, 7);

      var h = "";
      h +=
        '<a href="' +
        (c.html_url || "#") +
        '" class="hub-list-row" target="_blank" rel="noopener">';
      h += '<div class="commit-row-main">';
      h += '<div class="commit-row-meta">';
      h += '<span class="commit-tag">' + escHtml(repoLabel) + "</span>";
      if (sha) h += '<span class="commit-sha">' + sha + "</span>";
      h += "</div>";
      h += '<p class="hub-list-title">' + escHtml(msg) + "</p>";
      h +=
        '<p class="hub-list-description">' +
        escHtml(c.author_name || "unknown") +
        "</p>";
      h += "</div>";
      h += '<span class="hub-list-meta">' + date + "</span>";
      h +=
        '<span class="hub-arrow" aria-hidden="true"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>';
      h += "</a>";
      return h;
    }

    var html = "";
    // Show first COMMIT_SHOW commits
    commits.slice(0, COMMIT_SHOW).forEach(function (c) {
      html += renderSingle(c);
    });

    // If more commits exist, add a "Show more" button
    if (commits.length > COMMIT_SHOW) {
      html += '<div class="commit-more-wrap">';
      html +=
        '<button type="button" class="commit-more-btn" id="commit-more-btn">Show ' +
        (commits.length - COMMIT_SHOW) +
        " more commits</button>";
      html += "</div>";
    }

    el.innerHTML = html;

    // Bind the show more button
    var moreBtn = document.getElementById("commit-more-btn");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        var popup = document.createElement("div");
        popup.className = "commit-popup-overlay";
        popup.innerHTML =
          '<div class="commit-popup">' +
          '<div class="commit-popup-header">' +
          "<h3>All commits</h3>" +
          '<button type="button" class="commit-popup-close" id="commit-popup-close">&times;</button>' +
          "</div>" +
          '<div class="commit-popup-list">' +
          commits.slice(COMMIT_SHOW).map(renderSingle).join("") +
          "</div>" +
          "</div>";
        document.body.appendChild(popup);

        // Close handlers
        var closeBtn = document.getElementById("commit-popup-close");
        function closePopup() {
          popup.remove();
        }
        closeBtn.addEventListener("click", closePopup);
        popup.addEventListener("click", function (e) {
          if (e.target === popup) closePopup();
        });
      });
    }
  }

  // ── Render contributors ─────────────────────────────────────────────────
  function renderContributors(contributors) {
    var el = document.getElementById("contrib-grid");
    if (!el) return;

    if (!contributors || !contributors.length) {
      el.innerHTML = '<p class="hub-empty">No contributors found.</p>';
      return;
    }

    var coreLogins = ["thavanish", "privt", "achul"];
    var html = "";
    contributors.forEach(function (c) {
      var isCore = coreLogins.indexOf(c.login) !== -1;
      html +=
        '<a href="' +
        (c.html_url || "#") +
        '" class="contrib-card' +
        (isCore ? " contrib-card--core" : "") +
        '" target="_blank" rel="noopener">';
      if (c.avatar_url) {
        html +=
          '<img src="' +
          c.avatar_url +
          '&s=80" alt="" width="40" height="40" loading="lazy">';
      } else {
        html += '<span class="contrib-avatar-placeholder"></span>';
      }
      html += "<div>";
      html +=
        '<p class="contrib-name">' +
        escHtml(c.login || c.name || "unknown") +
        "</p>";
      var n = c.contributions;
      html +=
        '<p class="contrib-count">' +
        n +
        " contribution" +
        (n !== 1 ? "s" : "") +
        "</p>";
      html += "</div>";
      html += "</a>";
    });
    el.innerHTML = html;
  }

  // ── Show skeleton loading state ─────────────────────────────────────────
  function showCommitSkeletons() {
    var el = document.getElementById("commit-list");
    if (!el) return;
    var html = "";
    for (var i = 0; i < 6; i++) {
      html += '<div class="hub-list-row hub-skeleton">';
      html +=
        '<div class="commit-row-main"><div class="skeleton-line skeleton-line--wide"></div><div class="skeleton-line skeleton-line--narrow"></div></div>';
      html += '<div class="skeleton-line skeleton-line--date"></div>';
      html += "<span></span>";
      html += "</div>";
    }
    el.innerHTML = html;
  }

  function showContribSkeletons() {
    var el = document.getElementById("contrib-grid");
    if (!el) return;
    var html = "";
    for (var i = 0; i < 8; i++) {
      html += '<div class="contrib-card contrib-card--skeleton">';
      html += '<span class="contrib-avatar-placeholder"></span>';
      html +=
        '<div><div class="skeleton-line skeleton-line--name"></div><div class="skeleton-line skeleton-line--count"></div></div>';
      html += "</div>";
    }
    el.innerHTML = html;
  }

  function escHtml(s) {
    var d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  // ── Main ────────────────────────────────────────────────────────────────
  async function main() {
    // Show skeletons immediately
    showCommitSkeletons();
    showContribSkeletons();

    // 1. Try localStorage cache first (if fresh)
    var cached = null;
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        cached = JSON.parse(raw);
        var age = Date.now() - new Date(cached.generatedAt).getTime();
        if (age < LS_TTL && cached.commits && cached.commits.length) {
          renderCommits(cached.commits);
          renderContributors(cached.contributors);
          // Still refresh in background if older than 2 min
          if (age > 2 * 60 * 1000) {
            fetchGitHubData()
              .then(function (data) {
                try {
                  localStorage.setItem(LS_KEY, JSON.stringify(data));
                } catch (e) {}
              })
              .catch(function () {});
          }
          return;
        }
      }
    } catch (e) {
      /* ignore */
    }

    // 2. Try the built-in SQLite DB
    var dbLoaded = false;
    try {
      var db = await loadBuiltinDb();
      var commitRows = safeQuery(
        db,
        "SELECT sha, repo, message, author_name, author_date, author_avatar, html_url FROM commits ORDER BY author_date DESC",
      );
      var contribRows = safeQuery(
        db,
        "SELECT login, name, avatar_url, html_url, contributions, bio, company FROM contributors ORDER BY contributions DESC",
      );

      if (commitRows.length > 0 || contribRows.length > 0) {
        dbLoaded = true;
        var commits = commitRows.map(function (r) {
          return {
            sha: r[0],
            repo: r[1],
            message: r[2],
            author_name: r[3],
            author_date: r[4],
            author_avatar: r[5],
            html_url: r[6],
          };
        });
        var contribs = contribRows.map(function (r) {
          return {
            login: r[0],
            name: r[1],
            avatar_url: r[2],
            html_url: r[3],
            contributions: r[4],
          };
        });
        renderCommits(commits);
        renderContributors(contribs);
      }
    } catch (e) {
      // DB failed — will fall through to API
    }

    // 3. Always fetch from GitHub API for fresh data
    fetchGitHubData()
      .then(function (data) {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(data));
        } catch (e) {}
        renderCommits(data.commits);
        renderContributors(data.contributors);
      })
      .catch(function (err) {
        // API also failed
        if (!dbLoaded && cached) {
          // Last resort: stale cache
          renderCommits(cached.commits || []);
          renderContributors(cached.contributors || []);
        } else if (!dbLoaded && !cached) {
          var commitEl = document.getElementById("commit-list");
          var contribEl = document.getElementById("contrib-grid");
          if (commitEl)
            commitEl.innerHTML =
              '<p class="hub-empty">Could not load commits. Check back soon.</p>';
          if (contribEl)
            contribEl.innerHTML =
              '<p class="hub-empty">Could not load contributors. Check back soon.</p>';
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
