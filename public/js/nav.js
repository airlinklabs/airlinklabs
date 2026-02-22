// nav.js - mobile menu + smooth scroll + navbar scroll effect

function initNav() {
  var toggle = document.querySelector('.hamburger');
  var navLinks = document.querySelector('.nav-links');

  if (toggle && navLinks) {
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = toggle.classList.toggle('open');
      navLinks.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !toggle.contains(e.target) && !navLinks.contains(e.target)) {
        toggle.classList.remove('open');
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    navLinks.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('click', function () {
        toggle.classList.remove('open');
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // smooth scroll anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var href = this.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        var navH = 60;
        window.scrollTo({ top: target.offsetTop - navH - 16, behavior: 'smooth' });
      }
    });
  });

  // navbar scroll shadow
  window.addEventListener('scroll', function () {
    var nb = document.querySelector('.navbar');
    if (!nb) return;
    nb.style.borderBottomColor = window.scrollY > 20 ? 'var(--border2)' : 'var(--border)';
  }, { passive: true });
}

initNav();
