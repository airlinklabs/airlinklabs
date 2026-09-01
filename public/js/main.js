// ── Image fade-in on load ─────────────────────────────────────────────────────
(function () {
  function markLoaded(img) {
    img.classList.add("img-loaded");
  }

  function watchImage(img) {
    // Images hidden with display:none don't need the fade treatment
    if (img.style.display === "none") return;
    if (img.complete && img.naturalWidth > 0) {
      markLoaded(img);
      return;
    }
    // Hard timeout — if the image hasn't loaded in 2s, reveal it anyway
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

  // Pick up dynamically injected lazy images (modal gifs, registry step icons)
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

// ── Copy buttons (installer wizard code blocks) ───────────────────────────────
document.addEventListener("click", function (e) {
  var btn = e.target.closest(".copy-btn");
  if (!btn) return;
  e.stopPropagation();

  var block = btn.closest(".code-block") || btn.closest(".install-code");
  if (!block) return;

  var text = Array.from(block.querySelectorAll("code"))
    .map(function (c) {
      return c.textContent;
    })
    .join("\n");

  navigator.clipboard.writeText(text).then(function () {
    var orig = btn.innerHTML;
    btn.innerHTML =
      '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
    btn.style.color = "var(--color-success)";
    setTimeout(function () {
      btn.innerHTML = orig;
      btn.style.color = "";
    }, 2000);
  });
});

// ── Copy buttons (prose code blocks in docs / blog) ───────────────────────────
document.addEventListener("click", function (e) {
  var btn = e.target.closest(".prose-copy-btn");
  if (!btn) return;
  e.stopPropagation();

  var block = btn.closest(".prose-code-block");
  if (!block) return;

  var pre = block.querySelector("pre");
  var code = block.querySelector("code");
  var text = pre ? pre.textContent || "" : code ? code.textContent || "" : "";

  function copyAndNotify(txt) {
    navigator.clipboard
      .writeText(txt)
      .then(function () {
        var orig = btn.innerHTML;
        btn.innerHTML =
          '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
        btn.style.color = "var(--color-success)";
        btn.style.borderColor = "var(--color-success)";
        setTimeout(function () {
          btn.innerHTML = orig;
          btn.style.color = "";
          btn.style.borderColor = "";
        }, 2000);
      })
      .catch(function () {
        // fallback: textarea + execCommand
        var ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        var orig = btn.innerHTML;
        btn.innerHTML =
          '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
        btn.style.color = "var(--color-success)";
        btn.style.borderColor = "var(--color-success)";
        setTimeout(function () {
          btn.innerHTML = orig;
          btn.style.color = "";
          btn.style.borderColor = "";
        }, 2000);
      });
  }

  copyAndNotify(text.trim());
});

// ── Copy button for install section ────────────────────────────────────────
document.addEventListener(
  "click",
  function (e) {
    var btn = e.target.closest(".install-code .prose-copy-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    var block = btn.closest(".install-code");
    if (!block) return;
    var code = block.querySelector("code");
    if (!code) return;
    var text = code.textContent || "";

    function doCopy(txt) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(ok, fail);
      } else {
        fail();
      }
      function ok() {
        showCopied(btn);
      }
      function fail() {
        var ta = document.createElement("textarea");
        ta.value = txt;
        ta.style.cssText = "position:fixed;left:-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch (_) {}
        document.body.removeChild(ta);
        showCopied(btn);
      }
    }
    function showCopied(b) {
      var orig = b.innerHTML;
      b.innerHTML =
        '<svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> Copied';
      b.style.color = "var(--color-success)";
      setTimeout(function () {
        b.innerHTML = orig;
        b.style.color = "";
      }, 2000);
    }
    doCopy(text.trim());
  },
  true,
);

// ── Redirect confirmation popup ───────────────────────────────────────────────
(function () {
  var overlay = document.getElementById("redirect-overlay");
  var domainEl = document.getElementById("redirect-domain");
  var cancelBtn = document.getElementById("redirect-cancel");
  var confirmBtn = document.getElementById("redirect-confirm");
  if (!overlay) return;

  var pendingHref = "";
  var triggerElement = null;

  function isExternal(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.origin !== window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function openRedirect(href, trigger) {
    pendingHref = href;
    triggerElement = trigger || null;
    try {
      domainEl.textContent = new URL(href).hostname;
    } catch (e) {
      domainEl.textContent = href;
    }
    overlay.classList.add("open");
    confirmBtn.focus();
  }

  function closeRedirect() {
    overlay.classList.remove("open");
    pendingHref = "";
    if (triggerElement) {
      triggerElement.focus();
      triggerElement = null;
    }
  }

  function trapFocus(e) {
    if (!overlay.classList.contains("open")) return;
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

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href]");
    if (!a) return;
    var href = a.getAttribute("href");
    if (!href || !isExternal(href)) return;
    e.preventDefault();
    openRedirect(href, a);
  });

  cancelBtn.addEventListener("click", closeRedirect);

  confirmBtn.addEventListener("click", function () {
    overlay.classList.remove("open");
    if (pendingHref) window.open(pendingHref, "_blank", "noopener,noreferrer");
    pendingHref = "";
    triggerElement = null;
  });

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeRedirect();
  });

  document.addEventListener("keydown", function (e) {
    if (!overlay.classList.contains("open")) return;
    if (e.key === "Escape") closeRedirect();
    if (e.key === "Enter") confirmBtn.click();
    trapFocus(e);
  });
})();

// ── Hero staggered reveal ───────────────────────────────────────────────────
(function () {
  var EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
  var SPRING = "cubic-bezier(0.34, 1.12, 0.64, 1)";
  var content = document.getElementById("page-content");

  function staggerIn(els, baseDelay) {
    els.forEach(function (el, i) {
      if (!el) return;
      el.style.opacity = "0";
      el.style.transform = "translateY(18px)";
      el.style.transition = "none";
      setTimeout(
        function () {
          el.style.transition =
            "opacity 400ms " + EASE + ", transform 400ms " + SPRING;
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
        },
        baseDelay + i * 70,
      );
    });
  }

  function reveal() {
    // Non-SPA pages — fade up the whole content block
    if (content) {
      content.style.opacity = "0";
      content.style.transform = "translateY(14px)";
      content.style.transition = "none";
      setTimeout(function () {
        content.style.transition =
          "opacity 380ms " + EASE + ", transform 380ms " + SPRING;
        content.style.opacity = "1";
        content.style.transform = "translateY(0)";
      }, 40);
      return;
    }

    // SPA home — stagger individual hero elements
    staggerIn(
      [
        document.querySelector("#hero-left > div:first-child"),
        document.querySelector("#hero-left h1"),
        document.querySelector("#hero-left > p"),
        document.querySelector("#hero-left > div:nth-child(4)"),
        document.querySelector("#hero-left > div:last-child"),
        document.getElementById("hero-mockup"),
      ],
      40,
    );
  }

  if (document.readyState === "complete") {
    setTimeout(reveal, 40);
  } else {
    window.addEventListener("load", function () {
      setTimeout(reveal, 40);
    });
  }

  // Scroll to #start on home page load
  if (
    window.location.pathname === "/" ||
    window.location.pathname === "/index.html"
  ) {
    var startEl = document.getElementById("start");
    if (startEl) {
      setTimeout(function () {
        window.scrollTo({ top: startEl.offsetTop - 80, behavior: "instant" });
      }, 60);
    }
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
      href.startsWith("mailto")
    )
      return;
    if (a.target === "_blank") return;
    e.preventDefault();

    if (content) {
      content.style.transition =
        "opacity 180ms " + EASE + ", transform 180ms " + EASE;
      content.style.opacity = "0";
      content.style.transform = "translateY(-8px)";
    }

    setTimeout(
      function () {
        window.location.href = href;
      },
      content ? 200 : 0,
    );
  });
})();

// ── Docs sidebar search ──────────────────────────────────────────────────────
(function () {
  var search = document.getElementById("docs-search");
  if (!search) return;

  var noResultsEl = document.getElementById("docs-search-no-results");

  search.addEventListener("input", function (e) {
    var q = e.target.value.toLowerCase();
    var links = document.querySelectorAll(
      ".doc-sidebar-link, .docs-sidebar-link",
    );
    var visibleCount = 0;

    links.forEach(function (el) {
      var text = el.textContent.toLowerCase();
      var visible = text.includes(q);
      el.style.display = visible ? "" : "none";
      if (visible) visibleCount++;
    });

    if (noResultsEl) {
      noResultsEl.style.display =
        visibleCount === 0 && q.length > 0 ? "" : "none";
    }
  });
})();

// ── Back to top button ──────────────────────────────────────────────────────
(function () {
  var btn = document.getElementById("back-to-top");
  if (!btn) return;
  window.addEventListener(
    "scroll",
    function () {
      if (window.scrollY > 400) {
        btn.classList.add("visible");
      } else {
        btn.classList.remove("visible");
      }
    },
    { passive: true },
  );
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();

// ── Scroll-triggered animations (flow diagrams + counters) ────────────────────
(function () {
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // Animate counter from 0 to target value
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
      // ease out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      valEl.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Reveal flow diagram nodes and steps
  function revealFlow(el) {
    if (prefersReduced) {
      el.classList.add("revealed");
      return;
    }
    // small delay so the CSS transition kicks in
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

// ── Home page scroll-spy: highlight sidebar section on scroll ─────────────
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

  var scrollTimeout;
  var userScrolled = false;

  function onScroll() {
    userScrolled = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function () {
      userScrolled = false;
    }, 1500);
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id;
          tocLinks.forEach(function (link) {
            link.classList.toggle("active", link.dataset.tocId === id);
          });
        }
      });
    },
    { rootMargin: "-20% 0px -70% 0px" },
  );

  targets.forEach(function (t) {
    observer.observe(t);
  });
})();
