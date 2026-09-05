/* Made by https://github.com/bthavanish */
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

  // ── Hero entrance: show everything immediately ─────────────────────────
  if (isHome) {
    var sidebar = document.querySelector(".site-sidebar");
    var mainContent = document.querySelector(".docs-main, .site-main");
    var heroSection = document.querySelector(".hub-hero");
    var heroBg = document.querySelector(".hero-bg");
    var heroCarousel = document.querySelector(".hero-carousel");

    if (heroSection) heroSection.classList.add("visible");
    if (sidebar) sidebar.classList.add("sidebar-visible");
    if (mainContent) mainContent.classList.add("sidebar-visible");
    if (heroBg) heroBg.classList.add("sunk");
    if (heroCarousel) heroCarousel.classList.add("visible");

    document
      .querySelectorAll(".hub-section, .hero-text-animated")
      .forEach(function (s) {
        s.classList.add("revealed");
      });

    // Show construction popup if enabled
    if (window.__underConstruction) {
      var constructionOverlay = document.getElementById("construction-overlay");
      if (constructionOverlay) {
        setTimeout(function () {
          constructionOverlay.classList.add("open");
        }, 400);
      }
    }
  } else {
    // Non-home pages: show sidebar immediately
    var sidebar = document.querySelector(".site-sidebar");
    var mainContent = document.querySelector(".docs-main, .site-main");
    if (sidebar) sidebar.classList.add("sidebar-visible");
    if (mainContent) mainContent.classList.add("sidebar-visible");
  }

  // Fade carousel when hero-viewport leaves viewport
  if (isHome) {
    var heroCarouselEl = document.querySelector(".hero-carousel");
    var heroViewportEl = document.querySelector(".hero-viewport");
    if (heroCarouselEl && heroViewportEl) {
      var carouselObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              heroCarouselEl.style.opacity = "";
            } else {
              heroCarouselEl.style.opacity = "0";
            }
          });
        },
        { threshold: 0 },
      );
      carouselObserver.observe(heroViewportEl);
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
// ── About modal ─────────────────────────────────────────────────────────────
(function () {
  var overlay = document.getElementById("about-overlay");
  var closeBtn = document.getElementById("about-close");
  var aboutBtn = document.getElementById("about-btn");
  if (!overlay || !aboutBtn) return;

  function openModal() {
    overlay.classList.add("open");
  }

  function closeModal() {
    overlay.classList.remove("open");
  }

  aboutBtn.addEventListener("click", function (e) {
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
})();

// ── About section tab-swap ──────────────────────────────────────────────────
(function () {
  var cards = document.querySelectorAll("[data-about]");
  var showcases = document.querySelectorAll("[data-about-showcase]");
  if (!cards.length || !showcases.length) return;

  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      var key = card.getAttribute("data-about");
      cards.forEach(function (c) {
        c.classList.remove("about-card--active");
      });
      showcases.forEach(function (s) {
        s.classList.remove("feature-showcase--active");
      });
      card.classList.add("about-card--active");
      var target = document.querySelector(
        '[data-about-showcase="' + key + '"]',
      );
      if (target) target.classList.add("feature-showcase--active");
    });
  });
})();

// ── Stagger scroll animations ──────────────────────────────────────────────
(function () {
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) return;
  var staggerEls = document.querySelectorAll("[data-stagger]");
  if (!staggerEls.length) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("stagger-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );

  staggerEls.forEach(function (el) {
    observer.observe(el);
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

// ── Mermaid diagram rendering ─────────────────────────────────────────────
// Astro renders ```mermaid through Shiki which produces:
//   <pre class="astro-code github-dark" data-language="mermaid"><code>...<span>...</span>...</code></pre>
// Mermaid.js expects <pre class="mermaid">. Transform on load so mermaid picks them up.
(function () {
  function decodeEntities(str) {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
  }

  function extractMermaidText(el) {
    var clone = el.cloneNode(true);
    clone.querySelectorAll("span[style]").forEach(function (s) {
      s.removeAttribute("style");
      s.className = "";
    });
    return decodeEntities(clone.textContent || "");
  }

  function initMermaid() {
    var shikiBlocks = document.querySelectorAll('pre[data-language="mermaid"]');
    var directBlocks = document.querySelectorAll("pre > code.language-mermaid");

    if (!shikiBlocks.length && !directBlocks.length) return;

    shikiBlocks.forEach(function (pre) {
      var text = extractMermaidText(pre);
      if (!text.trim()) return;
      var wrapper = document.createElement("div");
      wrapper.className = "prose-mermaid";
      var mermaidPre = document.createElement("pre");
      mermaidPre.className = "mermaid";
      mermaidPre.textContent = text;
      wrapper.appendChild(mermaidPre);
      pre.replaceWith(wrapper);
    });

    directBlocks.forEach(function (codeEl) {
      var text = decodeEntities(codeEl.textContent || "");
      if (!text.trim()) return;
      var wrapper = document.createElement("div");
      wrapper.className = "prose-mermaid";
      var mermaidPre = document.createElement("pre");
      mermaidPre.className = "mermaid";
      mermaidPre.textContent = text;
      wrapper.appendChild(mermaidPre);
      codeEl.closest("pre").replaceWith(wrapper);
    });

    if (typeof window.mermaid === "undefined") {
      import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")
        .then(function (mod) {
          mod.default.initialize({
            startOnLoad: true,
            theme: "dark",
            darkMode: true,
            securityLevel: "loose",
            fontFamily: 'ui-monospace, "SF Mono", "Fira Code", monospace',
            flowchart: {
              useMaxWidth: true,
              htmlLabels: true,
              curve: "cardinal",
            },
            themeVariables: {
              primaryColor: "#1e40af",
              primaryTextColor: "#e0e0e0",
              primaryBorderColor: "#3b82f6",
              lineColor: "#60a5fa",
              secondaryColor: "#7c2d12",
              tertiaryColor: "#1e3a5f",
            },
          });
          mod.default.run();
        })
        .catch(function (err) {
          console.warn("[mermaid] failed to load:", err);
        });
    } else if (window.mermaid.run) {
      window.mermaid.run();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMermaid);
  } else {
    initMermaid();
  }
})();

// ── Auto-add copy buttons to all code blocks ────────────────────────────────
(function () {
  function addCopyButtons() {
    var pres = document.querySelectorAll("pre");
    pres.forEach(function (pre) {
      // Skip if already wrapped or has a button
      if (pre.closest(".prose-code-block") || pre.closest(".install-code"))
        return;
      if (pre.querySelector(".prose-copy-btn")) return;

      var wrapper = document.createElement("div");
      wrapper.className = "prose-code-block";
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      var btn = document.createElement("button");
      btn.className = "prose-copy-btn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Copy code");
      btn.innerHTML =
        '<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy';
      wrapper.appendChild(btn);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addCopyButtons);
  } else {
    addCopyButtons();
  }
})();

// Commit popup
const commitBtn = document.getElementById("commit-more-btn");
const commitPopup = document.getElementById("commit-popup");
const commitClose = document.getElementById("commit-popup-close");
if (commitBtn && commitPopup) {
  commitBtn.addEventListener("click", () => {
    commitPopup.classList.add("open");
    commitBtn.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      if (commitClose) commitClose.focus();
    }, 60);
  });
  if (commitClose)
    commitClose.addEventListener("click", () => {
      commitPopup.classList.remove("open");
      commitBtn.setAttribute("aria-expanded", "false");
      commitBtn.focus();
    });
  commitPopup.addEventListener("click", (e) => {
    if (e.target === commitPopup) {
      commitPopup.classList.remove("open");
      commitBtn.setAttribute("aria-expanded", "false");
      commitBtn.focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && commitPopup.classList.contains("open")) {
      commitPopup.classList.remove("open");
      commitBtn.setAttribute("aria-expanded", "false");
      commitBtn.focus();
    }
  });
  // Focus trap for commit popup
  document.addEventListener("keydown", (e) => {
    if (!commitPopup.classList.contains("open")) return;
    if (e.key === "Tab") {
      var focusable = commitPopup.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
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
  });
}

// ── Hero carousel popup ────────────────────────────────────────────────
(function () {
  var heroPopup = document.getElementById("hero-popup");
  var heroPopupImg = document.getElementById("hero-popup-img");
  var heroPopupDesc = document.getElementById("hero-popup-desc");
  var heroPopupClose = document.getElementById("hero-popup-close");
  var heroTriggerElement = null;

  if (heroPopup) {
    document.addEventListener("click", function (e) {
      var item = e.target.closest(".hero-carousel-item[data-desc]");
      if (item && heroPopupImg && heroPopupDesc) {
        var img = item.querySelector("img");
        if (img) {
          heroTriggerElement = item;
          heroPopupImg.src = img.src;
          heroPopupImg.alt = img.alt;
          heroPopupDesc.textContent = item.dataset.desc || "";
          heroPopup.classList.add("open");
          setTimeout(function () {
            heroPopupClose.focus();
          }, 60);
        }
      }
    });
    if (heroPopupClose) {
      heroPopupClose.addEventListener("click", function () {
        heroPopup.classList.remove("open");
        if (heroTriggerElement) {
          heroTriggerElement.focus();
          heroTriggerElement = null;
        }
      });
    }
    heroPopup.addEventListener("click", function (e) {
      if (e.target === heroPopup) {
        heroPopup.classList.remove("open");
        if (heroTriggerElement) {
          heroTriggerElement.focus();
          heroTriggerElement = null;
        }
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && heroPopup.classList.contains("open")) {
        heroPopup.classList.remove("open");
        if (heroTriggerElement) {
          heroTriggerElement.focus();
          heroTriggerElement = null;
        }
      }
    });
    // Focus trap for hero popup
    document.addEventListener("keydown", function (e) {
      if (!heroPopup.classList.contains("open")) return;
      if (e.key === "Tab") {
        var focusable = heroPopup.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
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
    });
  }
})();

// ── Feature grid popup ────────────────────────────────────────────────
(function () {
  var popup = document.getElementById("feature-popup");
  var popupImg = document.getElementById("feature-popup-img");
  var popupTitle = document.getElementById("feature-popup-title");
  var popupDesc = document.getElementById("feature-popup-desc");
  var popupLong = document.getElementById("feature-popup-long");
  var popupClose = document.getElementById("feature-popup-close");
  var triggerEl = null;

  if (!popup) return;

  var screenshotMap = {
    "server-management":
      "/assets/features/server-management/server-management-dark.png",
    console: "/assets/features/console/console-dark.png",
    "file-manager": "/assets/features/file-manager/file-manager-dark.png",
    nodes: "/assets/features/nodes/nodes-dark.png",
    users: "/assets/features/users/users-dark.png",
    addons: "/assets/features/addons/addons-dark.png",
    api: "/assets/features/api/api-dark.png",
    sftp: "/assets/features/sftp/sftp-dark.png",
    migrations: "/assets/features/migrations/migrations-dark.png",
    "pterodactyl-eggs":
      "/assets/features/pterodactyl-eggs/pterodactyl-eggs-dark.png",
  };

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".feature-grid-trigger");
    if (!btn) return;
    triggerEl = btn;
    var id = btn.dataset.id || "";
    var title = btn.dataset.title || "";
    var desc = btn.dataset.desc || "";
    var long = btn.dataset.long || "";

    popupTitle.textContent = title;
    popupDesc.textContent = desc;
    if (long) {
      popupLong.textContent = long;
      popupLong.style.display = "";
    } else {
      popupLong.style.display = "none";
    }

    if (screenshotMap[id]) {
      popupImg.src = screenshotMap[id];
      popupImg.alt = title;
      popupImg.style.display = "";
    } else {
      popupImg.style.display = "none";
    }

    popup.classList.add("open");
    setTimeout(function () {
      popupClose.focus();
    }, 60);
  });

  function closePopup() {
    popup.classList.remove("open");
    if (triggerEl) {
      triggerEl.focus();
      triggerEl = null;
    }
  }

  if (popupClose) popupClose.addEventListener("click", closePopup);
  popup.addEventListener("click", function (e) {
    if (e.target === popup) closePopup();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && popup.classList.contains("open")) closePopup();
  });
  // Focus trap
  document.addEventListener("keydown", function (e) {
    if (!popup.classList.contains("open")) return;
    if (e.key === "Tab") {
      var focusable = popup.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
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
  });
})();
