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

    var results = await Promise.allSettled([
      ghFetch(
        "https://api.github.com/repos/" + PANEL_REPO + "/commits?per_page=20",
      ),
      ghFetch(
        "https://api.github.com/repos/" + DAEMON_REPO + "/commits?per_page=20",
      ),
      ghFetch(
        "https://api.github.com/repos/" +
          PANEL_REPO +
          "/contributors?per_page=100",
      ),
      ghFetch(
        "https://api.github.com/repos/" +
          DAEMON_REPO +
          "/contributors?per_page=100",
      ),
    ]);

    var panelCommits =
      results[0].status === "fulfilled" ? results[0].value : [];
    var daemonCommits =
      results[1].status === "fulfilled" ? results[1].value : [];
    var panelContribs =
      results[2].status === "fulfilled" ? results[2].value : [];
    var daemonContribs =
      results[3].status === "fulfilled" ? results[3].value : [];

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

    var allCommits = []
      .concat(
        panelCommits.map(function (c) {
          return normalizeCommit(c, "panel");
        }),
      )
      .concat(
        daemonCommits.map(function (c) {
          return normalizeCommit(c, "daemon");
        }),
      );

    // Sort all commits by date descending
    allCommits.sort(function (a, b) {
      return new Date(b.author_date) - new Date(a.author_date);
    });

    // Merge contributors by login, sum contributions
    var contribMap = {};
    [panelContribs, daemonContribs].forEach(function (list) {
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

    var html = "";
    commits.slice(0, 14).forEach(function (c) {
      var msg = (c.message || "").split("\n")[0].trim();
      if (msg.length > 82) msg = msg.slice(0, 79) + "…";
      if (!msg) msg = "No commit message";

      var date = "";
      if (c.author_date) {
        var d = new Date(c.author_date);
        var now = new Date();
        var diff = Math.floor((now - d) / 1000);
        if (diff < 60) date = "just now";
        else if (diff < 3600) date = Math.floor(diff / 60) + "m ago";
        else if (diff < 86400) date = Math.floor(diff / 3600) + "h ago";
        else if (diff < 86400 * 30) date = Math.floor(diff / 86400) + "d ago";
        else
          date = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
      }

      var repoLabel = c.repo === "panel" ? "Panel" : "Daemon";
      var repoClass =
        c.repo === "panel" ? "commit-tag--panel" : "commit-tag--daemon";
      var sha = (c.sha || "").slice(0, 7);

      html +=
        '<a href="' +
        (c.html_url || "#") +
        '" class="hub-list-row" target="_blank" rel="noopener">';
      html += '<div class="commit-row-main">';
      html += '<div class="commit-row-meta">';
      html +=
        '<span class="commit-tag ' + repoClass + '">' + repoLabel + "</span>";
      if (sha) html += '<span class="commit-sha">' + sha + "</span>";
      html += "</div>";
      html += '<p class="hub-list-title">' + escHtml(msg) + "</p>";
      html +=
        '<p class="hub-list-description">' +
        escHtml(c.author_name || "unknown") +
        "</p>";
      html += "</div>";
      html += '<span class="hub-list-meta">' + date + "</span>";
      html +=
        '<span class="hub-arrow" aria-hidden="true"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>';
      html += "</a>";
    });
    el.innerHTML = html;
  }

  // ── Render contributors ─────────────────────────────────────────────────
  function renderContributors(contributors) {
    var el = document.getElementById("contrib-grid");
    if (!el) return;

    if (!contributors || !contributors.length) {
      el.innerHTML = '<p class="hub-empty">No contributors found.</p>';
      return;
    }

    var html = "";
    contributors.forEach(function (c) {
      html +=
        '<a href="' +
        (c.html_url || "#") +
        '" class="contrib-card" target="_blank" rel="noopener">';
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
