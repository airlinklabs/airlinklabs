// motion.js — IntersectionObserver-powered data-animate runner
(function () {
  if (!("IntersectionObserver" in window)) return;
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) return;

  var ANIMATIONS = {
    blur: {
      initial: "filter: blur(8px); opacity: 0; transform: translateY(12px)",
      visible: "filter: blur(0); opacity: 1; transform: translateY(0)",
    },
    "fade-up": {
      initial: "opacity: 0; transform: translateY(24px)",
      visible: "opacity: 1; transform: translateY(0)",
    },
    fade: {
      initial: "opacity: 0",
      visible: "opacity: 1",
    },
  };

  var els = document.querySelectorAll("[data-animate], [data-animate-group]");
  els.forEach(function (el) {
    var type = el.getAttribute("data-animate") || "fade-up";
    var anim = ANIMATIONS[type] || ANIMATIONS["fade-up"];
    el.style.cssText += ";" + anim.initial;
    el.style.transition = "none";
    el.classList.add("will-animate");
  });

  var obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var type = el.getAttribute("data-animate") || "fade-up";
        var anim = ANIMATIONS[type] || ANIMATIONS["fade-up"];
        var delay = el.dataset.animateDelay
          ? parseInt(el.dataset.animateDelay)
          : 0;
        setTimeout(function () {
          el.classList.remove("will-animate");
          el.classList.add("motion-visible");
          el.style.transition =
            "opacity 500ms cubic-bezier(0.4, 0, 0.2, 1), transform 500ms cubic-bezier(0.34, 1.12, 0.64, 1), filter 500ms cubic-bezier(0.4, 0, 0.2, 1)";
          el.style.cssText += ";" + anim.visible;
          // Animate children of data-animate-group
          if (el.hasAttribute("data-animate-group")) {
            var children = el.children;
            for (var i = 0; i < children.length; i++) {
              var childDelay = i * 60;
              (function (child, d) {
                setTimeout(function () {
                  child.style.opacity = "1";
                  child.style.transition =
                    "opacity 450ms cubic-bezier(0.4, 0, 0.2, 1), transform 450ms cubic-bezier(0.34, 1.12, 0.64, 1)";
                  child.style.transform = "none";
                }, d);
              })(children[i], childDelay);
            }
          }
        }, delay);
        obs.unobserve(el);
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -30px 0px" },
  );
  els.forEach(function (el) {
    obs.observe(el);
  });
})();
