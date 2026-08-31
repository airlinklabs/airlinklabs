// ── GitHub data loader: SQLite db → API fallback → localStorage cache ─────
(function () {
  var PANEL_REPO = "AirlinkLabs/panel";
  var DAEMON_REPO = "AirlinkLabs/daemon";
  var DB_URL = "public/assets/github.db";
  var LS_KEY = "airlink_github_data";
  var LS_TTL = 10 * 60 * 1000; // 10 min

  var SQL = null;
  var db = null;

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

  // ── Fetch the built-in .db file ─────────────────────────────────────────
  async function loadBuiltinDb() {
    var res = await fetch(DB_URL);
    if (!res.ok) throw new Error("Failed to fetch " + DB_URL);
    var buf = await res.arrayBuffer();
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

    var results = await Promise.all([
      ghFetch(
        "https://api.github.com/repos/" + PANEL_REPO + "/commits?per_page=15",
      ).catch(function () {
        return [];
      }),
      ghFetch(
        "https://api.github.com/repos/" + DAEMON_REPO + "/commits?per_page=15",
      ).catch(function () {
        return [];
      }),
      ghFetch(
        "https://api.github.com/repos/" +
          PANEL_REPO +
          "/contributors?per_page=100",
      ).catch(function () {
        return [];
      }),
      ghFetch(
        "https://api.github.com/repos/" +
          DAEMON_REPO +
          "/contributors?per_page=100",
      ).catch(function () {
        return [];
      }),
    ]);

    var panelCommits = results[0];
    var daemonCommits = results[1];
    var panelContribs = results[2];
    var daemonContribs = results[3];

    // Merge contributors
    var contribMap = {};
    [panelContribs, daemonContribs].forEach(function (list) {
      list.forEach(function (c) {
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
      commits: panelCommits.concat(daemonCommits).map(function (c) {
        var commit = c.commit || {};
        var author = commit.author || {};
        var ghAuthor = c.author || {};
        return {
          sha: c.sha,
          repo: panelCommits.indexOf(c) !== -1 ? "panel" : "daemon",
          message: author.message || "",
          author_name: author.name || "",
          author_date: author.date || "",
          author_avatar: ghAuthor.avatar_url || "",
          html_url: c.html_url || "",
        };
      }),
      contributors: Object.values(contribMap).sort(function (a, b) {
        return b.contributions - a.contributions;
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Render commits ──────────────────────────────────────────────────────
  function renderCommits(commits) {
    var el = document.getElementById("commit-list");
    if (!el || !commits.length) return;
    var html = "";
    commits.slice(0, 12).forEach(function (c) {
      var msg = c.message.split("\n")[0];
      if (msg.length > 80) msg = msg.slice(0, 77) + "...";
      var date = c.author_date
        ? new Date(c.author_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "";
      html +=
        '<a href="' +
        c.html_url +
        '" class="hub-list-row" target="_blank" rel="noopener">';
      html += '<div><p class="hub-list-title">' + escHtml(msg) + "</p>";
      html +=
        '<p class="hub-list-description">' +
        escHtml(c.author_name || "unknown") +
        " · " +
        c.repo +
        "</p></div>";
      html += '<span class="hub-list-meta">' + date + "</span>";
      html +=
        '<span class="hub-arrow" aria-hidden="true"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>';
      html += "</a>";
    });
    el.innerHTML = html;
  }

  // ── Render contributors ─────────────────────────────────────────────────
  function renderContributors(contributors) {
    var el = document.getElementById("contrib-grid");
    if (!el || !contributors.length) return;
    var html = "";
    contributors.forEach(function (c) {
      html +=
        '<a href="' +
        c.html_url +
        '" class="contrib-card" target="_blank" rel="noopener">';
      html +=
        '<img src="' +
        (c.avatar_url || "") +
        '" alt="" width="40" height="40" loading="lazy">';
      html += '<div><p class="contrib-name">' + escHtml(c.login) + "</p>";
      html +=
        '<p class="contrib-count">' +
        c.contributions +
        " contribution" +
        (c.contributions !== 1 ? "s" : "") +
        "</p></div>";
      html += "</a>";
    });
    el.innerHTML = html;
  }

  function escHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Main ────────────────────────────────────────────────────────────────
  async function main() {
    // 1. Try localStorage cache first
    var cached = null;
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        cached = JSON.parse(raw);
        if (Date.now() - new Date(cached.generatedAt).getTime() < LS_TTL) {
          renderCommits(cached.commits);
          renderContributors(cached.contributors);
          return; // fresh enough
        }
      }
    } catch (e) {
      /* ignore */
    }

    // 2. Load sql.js and built-in db
    try {
      SQL = await loadSqlJs();
      db = await loadBuiltinDb();
      var commits = db
        .exec("SELECT * FROM commits ORDER BY author_date DESC")
        .values.map(function (r) {
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
      var contribs = db
        .exec("SELECT * FROM contributors ORDER BY contributions DESC")
        .values.map(function (r) {
          return {
            login: r[0],
            name: r[1],
            avatar_url: r[2],
            html_url: r[3],
            contributions: r[4],
            bio: r[5],
            company: r[6],
          };
        });
      renderCommits(commits);
      renderContributors(contribs);
    } catch (e) {
      // db load failed, try cached even if stale
      if (cached) {
        renderCommits(cached.commits);
        renderContributors(cached.contributors);
      }
      return;
    }

    // 3. Background: try GitHub API for fresh data
    fetchGitHubData()
      .then(function (data) {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        // Re-render with fresh data
        renderCommits(data.commits);
        renderContributors(data.contributors);
      })
      .catch(function () {
        // API failed, keep using db data
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
