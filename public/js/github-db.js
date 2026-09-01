/* Made by https://github.com/bthavanish */
// ── GitHub data loader: reads build-time JSON cache ──────────────────────────
// No runtime API calls, no SQLite, no CDNs. Data is fetched during `npm run cache`.
(function () {
  var DATA_URL = "public/assets/github-data.json";

  // ── Render commits ──────────────────────────────────────────────────────
  function renderCommits(commits) {
    var el = document.getElementById("commit-list");
    if (!el) return;

    if (!commits || !commits.length) {
      // Keep skeleton — don't replace with "No commits found"
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
    commits.slice(0, COMMIT_SHOW).forEach(function (c) {
      html += renderSingle(c);
    });

    if (commits.length > COMMIT_SHOW) {
      html += '<div class="commit-more-wrap">';
      html +=
        '<button type="button" class="commit-more-btn" id="commit-more-btn">Show ' +
        (commits.length - COMMIT_SHOW) +
        " more commits</button>";
      html += "</div>";
    }

    el.innerHTML = html;

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
      // Keep skeleton — don't replace with "No contributors found"
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
        '<p class="contrib-name">' + escHtml(c.login || "unknown") + "</p>";
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
    showCommitSkeletons();
    showContribSkeletons();

    try {
      var res = await fetch(DATA_URL);
      if (!res.ok) throw new Error("Failed to load " + DATA_URL);
      var data = await res.json();
      renderCommits(data.commits || []);
      renderContributors(data.contributors || []);
    } catch (err) {
      // Keep skeleton loading state on error — don't show "Could not load" text
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
