// ── Image fade-in on load ──────────────────────────────────────────────────
(function () {
  function markLoaded(img) {
    img.classList.add("img-loaded");
  }

  function watchImage(img) {
    if (img.style.display === "none") return;
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }
    var timeout = setTimeout(function () {
      markLoaded(img);
    }, 2000);
    img.addEventListener(
      "load",
      function () {
        clearTimeout(timeout);
        markLoaded(img);
      },
      { once: true },
    );
    img.addEventListener(
      "error",
      function () {
        clearTimeout(timeout);
        markLoaded(img);
      },
      { once: true },
    );
  }

  document.querySelectorAll('img[loading="lazy"]').forEach(watchImage);

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === "IMG" && node.getAttribute("loading") === "lazy")
          watchImage(node);
        if (node.querySelectorAll)
          node.querySelectorAll('img[loading="lazy"]').forEach(watchImage);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ── Mobile detection ───────────────────────────────────────────────────────
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("isMobile");
  } catch (e) {}
  if (stored === null) {
    var isMobile =
      /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) || window.innerWidth <= 768;
    var val = isMobile ? "1" : "0";
    try {
      localStorage.setItem("isMobile", val);
    } catch (e) {}
    document.documentElement.setAttribute("data-mobile", val);
  } else {
    document.documentElement.setAttribute("data-mobile", stored);
  }
})();

// ── Unified copy button handler ────────────────────────────────────────────
document.addEventListener(
  "click",
  function (e) {
    var btn =
      e.target.closest(".install-code .prose-copy-btn") ||
      e.target.closest(".prose-copy-btn") ||
      e.target.closest(".copy-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    var block =
      btn.closest(".install-code") ||
      btn.closest(".prose-code-block") ||
      btn.closest(".code-block");
    if (!block) return;

    var pre = block.querySelector("pre");
    var code = block.querySelector("code");
    var text = pre ? pre.textContent || "" : code ? code.textContent || "" : "";

    function showCopied() {
      var orig = btn.innerHTML;
      btn.innerHTML =
        '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
      btn.style.color = "var(--color-success)";
      setTimeout(function () {
        btn.innerHTML = orig;
        btn.style.color = "";
      }, 2000);
    }

    function doCopy(txt) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(showCopied, fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        var ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (_) {}
        document.body.removeChild(ta);
        showCopied();
      }
    }

    doCopy(text.trim());
  },
  true,
);

// ── Redirect confirmation popup ────────────────────────────────────────────
(function () {
  var overlay = document.getElementById("redirect-overlay");
  var domainEl = document.getElementById("redirect-domain");
  var cancelBtn = document.getElementById("redirect-cancel");
  var confirmBtn = document.getElementById("redirect-confirm");
  if (!overlay) return;

  var pendingHref = "";
  var triggerElement = null;
  var isOpen = false;

  function isExternal(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.origin !== window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function openRedirect(href, trigger) {
    if (isOpen) return;
    isOpen = true;
    pendingHref = href;
    triggerElement = trigger || null;
    try {
      domainEl.textContent = new URL(href).hostname;
    } catch (e) {
      domainEl.textContent = href;
    }
    overlay.classList.add("open");
    setTimeout(function () {
      confirmBtn.focus();
    }, 60);
  }

  function closeRedirect() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("open");
    pendingHref = "";
    if (triggerElement) {
      triggerElement.focus();
      triggerElement = null;
    }
  }

  function confirmRedirect() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove("open");
    if (pendingHref) window.open(pendingHref, "_blank", "noopener,noreferrer");
    pendingHref = "";
    triggerElement = null;
  }

  function trapFocus(e) {
    if (!isOpen) return;
    var focusable = overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  document.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href");
      if (!href) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      )
        return;
      if (!isExternal(href)) return;
      e.preventDefault();
      e.stopPropagation();
      openRedirect(href, a);
    },
    true,
  );

  cancelBtn.addEventListener("click", closeRedirect);
  confirmBtn.addEventListener("click", confirmRedirect);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeRedirect();
  });

  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (e.key === "Escape") closeRedirect();
    if (e.key === "Enter") confirmRedirect();
    trapFocus(e);
  });
})();

// ── Page load + Hero entrance animation ───────────────────────────────────
(function () {
  var EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
  var content = document.getElementById("page-content");
  var isHome =
    window.location.pathname === "/" ||
    window.location.pathname === "/index.html";

  // Scroll to #start on home page load
  if (isHome) {
    var startEl = document.getElementById("start");
    if (startEl) {
      setTimeout(function () {
        window.scrollTo({ top: startEl.offsetTop - 80, behavior: "instant" });
      }, 60);
    }
  }

  // ── Hero entrance sequence (home page only) ───────────────────────────
  if (isHome) {
    document.documentElement.classList.add("page-locked");

    var heroViewport = document.querySelector(".hero-viewport");
    var heroSection = document.querySelector(".hub-hero");
    var welcomeEl = document.getElementById("hero-welcome");
    var sections = document.querySelectorAll(
      ".hub-section, .hero-text-animated",
    );

    // Defer section reveals
    sections.forEach(function (s) {
      s.classList.add("deferred");
    });

    function runHeroSequence() {
      // Step 0: Wait for hero bg to sink (500ms), then start welcome
      setTimeout(function () {
        // Step 1: Fade in welcome text
        if (welcomeEl) {
          welcomeEl.classList.add("visible");

          // Step 2: After delay, fade out welcome
          setTimeout(function () {
            welcomeEl.classList.remove("visible");
            welcomeEl.classList.add("exit");

            // Step 3: After welcome exits, show hero text
            setTimeout(function () {
              if (heroSection) heroSection.classList.add("visible");

              // Step 4: After hero text settles, reveal sections + unlock scroll
              setTimeout(function () {
                sections.forEach(function (s, i) {
                  setTimeout(function () {
                    s.classList.add("revealed");
                  }, i * 80);
                });
                document.documentElement.classList.remove("page-locked");

                // Step 5: Show construction popup if enabled
                if (window.__underConstruction) {
                  var overlay = document.getElementById("construction-overlay");
                  if (overlay) {
                    setTimeout(function () {
                      overlay.classList.add("open");
                    }, 400);
                  }
                }
              }, 500);
            }, 500);
          }, 1400);
        } else {
          // No welcome element — just show hero and unlock
          if (heroSection) heroSection.classList.add("visible");
          setTimeout(function () {
            sections.forEach(function (s, i) {
              setTimeout(function () {
                s.classList.add("revealed");
              }, i * 80);
            });
            document.documentElement.classList.remove("page-locked");
            if (window.__underConstruction) {
              var overlay = document.getElementById("construction-overlay");
              if (overlay) {
                setTimeout(function () {
                  overlay.classList.add("open");
                }, 400);
              }
            }
          }, 300);
        }
      }, 500); // Wait for hero bg sinking animation
    }

    // Start sequence after brief paint delay
    requestAnimationFrame(function () {
      requestAnimationFrame(runHeroSequence);
    });
  }

  // Smooth scroll with offset for anchor links
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || href === "#") return;
    var target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    var offset = 80;
    var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({ top: top, behavior: "smooth" });
    history.pushState(null, "", href);
  });

  // Outgoing internal navigation — smooth fade-out then navigate
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("http") ||
      href.startsWith("mailto") ||
      href.startsWith("tel:")
    )
      return;
    if (a.target === "_blank") return;
    e.preventDefault();

    if (content) {
      content.style.transition =
        "opacity 160ms " + EASE + ", transform 160ms " + EASE;
      content.style.opacity = "0";
      content.style.transform = "translateY(-6px)";
    }

    setTimeout(
      function () {
        window.location.href = href;
      },
      content ? 180 : 0,
    );
  });
})();
// ── License modal ────────────────────────────────────────────────────────
(function () {
  var overlay = document.getElementById("license-overlay");
  var closeBtn = document.getElementById("license-close");
  var reposEl = document.getElementById("license-repos");
  var npmEl = document.getElementById("license-npm");
  var cdnEl = document.getElementById("license-cdn");
  var licenseBtn = document.getElementById("license-btn");
  if (!overlay || !licenseBtn) return;

  var licenseData = null;

  function openModal() {
    overlay.classList.add("open");
    if (!licenseData) loadLicenses();
  }

  function closeModal() {
    overlay.classList.remove("open");
  }

  licenseBtn.addEventListener("click", function (e) {
    e.preventDefault();
    openModal();
  });
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
  });

  function loadLicenses() {
    if (licenseData) return renderLicenses(licenseData);
    var script = document.querySelector('script[src*="github-db"]');
    var base = script
      ? script.src.replace(/public\/js\/.*/, "")
      : window.location.pathname.replace(/\/[^/]*$/, "/");
    fetch(base + "public/assets/licenses.json")
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (data) {
        licenseData = data;
        renderLicenses(data);
      })
      .catch(function () {
        if (reposEl)
          reposEl.innerHTML =
            '<p style="font-size:12px;color:var(--color-text-3)">License data not available.</p>';
      });
  }

  function badge(name, url, license) {
    if (!url) return '<span class="license-item-badge">' + license + "</span>";
    return (
      '<a class="license-item-badge" href="' +
      url +
      '" target="_blank" rel="noopener" data-license-link="' +
      url +
      '">' +
      license +
      "</a>"
    );
  }

  function renderLicenses(data) {
    if (reposEl && data.repos && data.repos.length) {
      var repoDescs = {
        panel: "Web interface for managing servers, users, nodes, and backups",
        daemon: "Node agent handling containers, files, and server operations",
        addons: "Community addon registry and marketplace",
        home: "Project website and documentation",
      };
      reposEl.innerHTML = data.repos
        .map(function (r) {
          return (
            '<div class="license-item">' +
            '<div class="license-item-info">' +
            '<div class="license-item-name">' +
            r.name +
            "</div>" +
            (repoDescs[r.name]
              ? '<div class="license-item-desc">' + repoDescs[r.name] + "</div>"
              : "") +
            "</div>" +
            badge(r.name, r.url, r.license || "Unknown") +
            "</div>"
          );
        })
        .join("");
    }
    if (npmEl && data.npm && data.npm.length) {
      var sorted = data.npm.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      npmEl.innerHTML = sorted
        .map(function (p) {
          return (
            '<div class="license-item">' +
            '<div class="license-item-info">' +
            '<div class="license-item-name">' +
            p.name +
            "</div>" +
            '<div class="license-item-version">v' +
            (p.version || "unknown") +
            "</div>" +
            "</div>" +
            badge(p.name, p.repository, p.license || "Unknown") +
            "</div>"
          );
        })
        .join("");
    }
    if (cdnEl && data.cdn && data.cdn.length) {
      cdnEl.innerHTML = data.cdn
        .map(function (c) {
          return (
            '<div class="license-item">' +
            '<div class="license-item-info">' +
            '<div class="license-item-name">' +
            c.name +
            "</div>" +
            '<div class="license-item-version">v' +
            (c.version || "") +
            " · loaded from CDN" +
            "</div>" +
            "</div>" +
            badge(c.name, c.url, c.license || "Unknown") +
            "</div>"
          );
        })
        .join("");
    }
  }

  // Close license modal when a badge is clicked so redirect confirmer can handle it
  overlay.addEventListener("click", function (e) {
    var link = e.target.closest(".license-item-badge[href]");
    if (link) {
      closeModal();
    }
  });
})();

// ── Scroll-triggered animations (flow diagrams + counters) ──────────────────
(function () {
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  function animateCounter(el) {
    var target = parseInt(el.getAttribute("data-counter-to"), 10) || 0;
    var suffix = el.getAttribute("data-counter-suffix") || "";
    var valEl = el.querySelector(".prose-counter-val");
    if (!valEl) return;

    if (prefersReduced) {
      valEl.textContent = target + suffix;
      return;
    }

    var duration = 1200;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      valEl.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function revealFlow(el) {
    if (prefersReduced) {
      el.classList.add("revealed");
      return;
    }
    requestAnimationFrame(function () {
      el.classList.add("revealed");
    });
  }

  if (prefersReduced) return;

  var targets = document.querySelectorAll(".prose-flow, .prose-counter");
  if (!targets.length) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.classList.contains("prose-flow")) {
          revealFlow(el);
        } else if (el.classList.contains("prose-counter")) {
          animateCounter(el);
        }
        observer.unobserve(el);
      });
    },
    { threshold: 0.2 },
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();

// ── Global scroll-spy ──────────────────────────────────────────────────────
(function () {
  var tocLinks = document.querySelectorAll(".site-section-link[data-toc-id]");
  if (!tocLinks.length) return;
  var ids = Array.from(tocLinks).map(function (l) {
    return l.dataset.tocId;
  });
  var targets = ids
    .map(function (id) {
      return document.getElementById(id);
    })
    .filter(Boolean);
  if (!targets.length) return;

  var activeId = null;

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    tocLinks.forEach(function (link) {
      var match = link.dataset.tocId === id;
      link.classList.toggle("active", match);
      if (match) {
        var sidebar = link.closest(
          ".site-sidebar-section, .site-sidebar-context",
        );
        if (sidebar) {
          var linkRect = link.getBoundingClientRect();
          var sideRect = sidebar.getBoundingClientRect();
          if (
            linkRect.top < sideRect.top ||
            linkRect.bottom > sideRect.bottom
          ) {
            link.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }
      }
    });
  }

  var observer = new IntersectionObserver(
    function (entries) {
      var visible = entries
        .filter(function (e) {
          return e.isIntersecting;
        })
        .sort(function (a, b) {
          return a.boundingClientRect.top - b.boundingClientRect.top;
        });
      if (visible.length > 0) setActive(visible[0].target.id);
    },
    { rootMargin: "-10% 0px -80% 0px", threshold: 0 },
  );

  targets.forEach(function (t) {
    observer.observe(t);
  });

  var scrollTimer;
  window.addEventListener(
    "scroll",
    function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var scrollY = window.scrollY + 120;
        var closest = null;
        var closestDist = Infinity;
        targets.forEach(function (t) {
          var top = t.offsetTop;
          var dist = Math.abs(scrollY - top);
          if (dist < closestDist) {
            closestDist = dist;
            closest = t;
          }
        });
        if (closest) setActive(closest.id);
      }, 80);
    },
    { passive: true },
  );
})();

/* ── Construction warning popup (first visit only, gated) ─────────────────── */
(function () {
  if (!window.__underConstruction) return;
  // The hero animation sequence handles showing the popup after intro.
  // This fallback handles the OK button + localStorage persistence.
  var overlay = document.getElementById("construction-overlay");
  var okBtn = document.getElementById("construction-ok");
  if (!overlay || !okBtn) return;
  okBtn.addEventListener("click", function () {
    localStorage.setItem("airlink-construction-seen", "1");
    overlay.classList.remove("open");
  });
  // If hero animation didn't run (non-home page), show immediately on first visit
  if (!document.querySelector(".hero-viewport")) {
    if (!localStorage.getItem("airlink-construction-seen")) {
      overlay.classList.add("open");
    }
  }
})();

// ── Procedural hover fill: cursor-tracking radial gradient ────────────────
(function () {
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) return;

  var SEL =
    ".hub-list-row, .docs-list-row, .project-row, .contrib-card, .blog-card, .blog-post-row, .post-back-link";
  var elements = document.querySelectorAll(SEL);
  elements.forEach(function (el) {
    function updatePos(e) {
      var rect = el.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mouse-x", x + "%");
      el.style.setProperty("--mouse-y", y + "%");
    }

    el.addEventListener("mouseenter", updatePos);
    el.addEventListener("mousemove", updatePos);

    el.addEventListener("focusin", function () {
      el.style.setProperty("--mouse-x", "50%");
      el.style.setProperty("--mouse-y", "50%");
    });
  });
})();
