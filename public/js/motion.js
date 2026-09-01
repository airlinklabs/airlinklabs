/* Made by https://github.com/bthavanish */
// motion.js — Progressive animation system
(function () {
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  if (prefersReduced) {
    document
      .querySelectorAll("[data-animate], [data-animate-group]")
      .forEach(function (el) {
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.filter = "none";
      });
    return;
  }

  var EASE = "cubic-bezier(0.4, 0, 0.2, 1)";
  var SPRING = "cubic-bezier(0.34, 1.12, 0.64, 1)";
  var BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  var ANIM = {
    "fade-up": {
      from: { opacity: 0, transform: "translateY(24px)" },
      to: { opacity: 1, transform: "none" },
    },
    "fade-down": {
      from: { opacity: 0, transform: "translateY(-24px)" },
      to: { opacity: 1, transform: "none" },
    },
    "fade-left": {
      from: { opacity: 0, transform: "translateX(30px)" },
      to: { opacity: 1, transform: "none" },
    },
    "fade-right": {
      from: { opacity: 0, transform: "translateX(-30px)" },
      to: { opacity: 1, transform: "none" },
    },
    fade: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    scale: {
      from: { opacity: 0, transform: "scale(0.9)" },
      to: { opacity: 1, transform: "none" },
    },
    "scale-up": {
      from: { opacity: 0, transform: "scale(0.85)" },
      to: { opacity: 1, transform: "none" },
    },
    blur: {
      from: { opacity: 0, filter: "blur(10px)" },
      to: { opacity: 1, filter: "none" },
    },
    "blur-up": {
      from: { opacity: 0, filter: "blur(6px)", transform: "translateY(16px)" },
      to: { opacity: 1, filter: "none", transform: "none" },
    },
    "rotate-in": {
      from: { opacity: 0, transform: "rotate(-4deg) scale(0.95)" },
      to: { opacity: 1, transform: "none" },
    },
    "flip-x": {
      from: {
        opacity: 0,
        transform: "perspective(600px) rotateX(12deg)",
      },
      to: { opacity: 1, transform: "none" },
    },
  };

  // Set initial states
  var animatedEls = document.querySelectorAll("[data-animate]");
  var groupEls = document.querySelectorAll("[data-animate-group]");

  animatedEls.forEach(function (el) {
    var type = el.getAttribute("data-animate") || "fade-up";
    var def = ANIM[type] || ANIM["fade-up"];
    var delay = parseInt(el.dataset.animateDelay || "0");
    var dur = el.dataset.animateDur || "500";

    el.style.opacity = def.from.opacity;
    if (def.from.transform) el.style.transform = def.from.transform;
    if (def.from.filter) el.style.filter = def.from.filter;
    el.style.transition = "none";
    el.style.transitionDelay = delay + "ms";
    el.style.transitionDuration = dur + "ms";
    el.style.transitionTimingFunction = SPRING;
    el.classList.add("will-animate");
  });

  groupEls.forEach(function (el) {
    el.style.opacity = "0";
    el.style.transform = "translateY(16px)";
    el.style.transition = "none";
    Array.from(el.children).forEach(function (child) {
      child.style.opacity = "0";
      child.style.transform = "translateY(14px)";
      child.style.transition = "none";
    });
    el.classList.add("will-animate");
  });

  // Scroll observer
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        if (el.hasAttribute("data-animate")) {
          var type = el.getAttribute("data-animate") || "fade-up";
          var def = ANIM[type] || ANIM["fade-up"];
          var dur = el.dataset.animateDur || "500";

          el.style.transition =
            "opacity " +
            dur +
            "ms " +
            EASE +
            ", transform " +
            dur +
            "ms " +
            SPRING +
            ", filter " +
            dur +
            "ms " +
            EASE;
          el.style.opacity = def.to.opacity;
          if (def.to.transform) el.style.transform = def.to.transform;
          if (def.to.filter !== undefined)
            el.style.filter = def.to.filter || "none";
          el.classList.remove("will-animate");
          el.classList.add("motion-visible");
        }

        if (el.hasAttribute("data-animate-group")) {
          var children = Array.from(el.children);
          var stagger = parseInt(el.dataset.animateStagger || "60");
          var baseDelay = parseInt(el.dataset.animateDelay || "0");
          var childDur = el.dataset.animateChildDur || "420";

          el.style.transition =
            "opacity 300ms " + EASE + ", transform 300ms " + EASE;
          el.style.opacity = "1";
          el.style.transform = "none";

          children.forEach(function (child, i) {
            setTimeout(
              function () {
                child.style.transition =
                  "opacity " +
                  childDur +
                  "ms " +
                  EASE +
                  ", transform " +
                  childDur +
                  "ms " +
                  BOUNCE;
                child.style.opacity = "1";
                child.style.transform = "none";
              },
              baseDelay + i * stagger,
            );
          });
          el.classList.remove("will-animate");
          el.classList.add("motion-visible");
        }

        observer.unobserve(el);
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -30px 0px" },
  );

  animatedEls.forEach(function (el) {
    observer.observe(el);
  });
  groupEls.forEach(function (el) {
    observer.observe(el);
  });
})();
