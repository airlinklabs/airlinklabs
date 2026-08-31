// motion.js — IntersectionObserver-powered data-animate runner
(function () {
  if (!("IntersectionObserver" in window)) return;
  var els = document.querySelectorAll("[data-animate], [data-animate-group]");
  els.forEach(function (el) {
    el.classList.add("will-animate");
  });
  var obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var delay = el.dataset.animateDelay
          ? parseInt(el.dataset.animateDelay)
          : 0;
        setTimeout(function () {
          el.classList.remove("will-animate");
          el.classList.add("motion-visible");
          // Animate children of data-animate-group
          if (el.hasAttribute("data-animate-group")) {
            var children = el.children;
            for (var i = 0; i < children.length; i++) {
              var childDelay = i * 40;
              (function (child, d) {
                setTimeout(function () {
                  child.style.opacity = "1";
                  child.style.transition =
                    "opacity var(--dur-enter) var(--ease-standard), transform var(--dur-enter) var(--ease-standard)";
                  child.style.transform = "none";
                }, d);
              })(children[i], childDelay);
            }
          }
        }, delay);
        obs.unobserve(el);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
  );
  els.forEach(function (el) {
    obs.observe(el);
  });
})();
