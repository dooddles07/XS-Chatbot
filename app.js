/* =============================================================
   XS — scroll choreography
   ============================================================= */
(function () {
  'use strict';

  /* the page opens on a scripted intro, so always start at the top */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof window.gsap !== 'undefined';

  /* ---------------------------------------------------------
     chat (works with or without motion)
     --------------------------------------------------------- */
  var replies = [
    "Good start. What outcome would make this obviously worth it?",
    "Say the version you're afraid to say. That's usually the real brief.",
    "Strip it to one sentence. If it survives, we build it.",
    "Here's the sharper question: what happens if you do nothing?",
    "Name the constraint. Constraints are where the interesting shape comes from."
  ];
  var replyIndex = 0;

  var log = document.getElementById('chatLog');
  var form = document.getElementById('chatForm');
  var field = document.getElementById('chatField');

  function bubble(text, who) {
    var wrap = document.createElement('div');
    wrap.className = 'msg msg--' + who;
    var p = document.createElement('p');
    p.textContent = text;
    wrap.appendChild(p);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    if (hasGsap && !reduced) {
      gsap.from(wrap, { y: 14, opacity: 0, duration: 0.45, ease: 'power3.out' });
    }
    return wrap;
  }

  function ask(text) {
    if (!text.trim()) return;
    bubble(text.trim(), 'me');

    var typing = document.createElement('div');
    typing.className = 'msg msg--bot';
    typing.innerHTML = '<p><span class="dots"><i></i><i></i><i></i></span></p>';
    log.appendChild(typing);
    log.scrollTop = log.scrollHeight;

    setTimeout(function () {
      typing.remove();
      bubble(replies[replyIndex % replies.length], 'bot');
      replyIndex++;
    }, 900);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ask(field.value);
    field.value = '';
  });

  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      ask(chip.textContent);
      document.getElementById('ask').scrollIntoView({ block: 'center' });
    });
  });

  /* ---------------------------------------------------------
     split manifesto into words (needed in both modes)
     --------------------------------------------------------- */
  var head = document.getElementById('manifestoHead');
  var words = head.textContent.trim().split(/\s+/);
  head.innerHTML = words
    .map(function (w) { return '<span class="w">' + w + '</span>'; })
    .join(' ');

  if (!hasGsap || reduced) return;

  /* ---------------------------------------------------------
     motion
     --------------------------------------------------------- */
  gsap.registerPlugin(ScrollTrigger);

  var ease = 'power3.out';

  /* scroll progress ---------------------------------------- */
  gsap.to('.scroll-progress i', {
    scaleX: 1,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
  });

  /* hero entrance ------------------------------------------
     Only hide things once the tab is actually on screen: a
     backgrounded tab throttles rAF, and a frozen timeline would
     otherwise leave the hero blank until the user came back. */
  var intro;

  function playIntro() {
    gsap.set('.hero-title .in', { yPercent: 115 });
    gsap.set('.reveal-up', { y: 26, opacity: 0 });
    buildIntro();
  }

  if (document.visibilityState === 'visible') playIntro();
  else document.addEventListener('visibilitychange', function onShow() {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', onShow);
    playIntro();
  });

  function buildIntro() {
  intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
  intro
    .from('.nav', { y: -70, opacity: 0, duration: 1 })
    .to('.eyebrow', { y: 0, opacity: 1, duration: 0.9 }, 0.15)
    .to('.hero-title .in', { yPercent: 0, duration: 1.5, stagger: 0.11 }, 0.2)
    .to('.hero-copy, .cta-round', { y: 0, opacity: 1, duration: 1, stagger: 0.1 }, 0.75)
    .to('.hero-rule i', { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, 0.5)
    .to({}, { duration: 0.01 }, 0);
  }

  /* background film: the descent is driven by page scroll --- */
  var film = document.getElementById('bgVideo');
  film.loop = false;
  film.pause();

  function driveFilm() {
    if (!film.duration || !isFinite(film.duration)) return;

    gsap.to(film, {
      currentTime: film.duration - 0.05,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.55
      }
    });
  }

  if (film.readyState >= 1) driveFilm();
  else film.addEventListener('loadedmetadata', driveFilm, { once: true });

  /* one muted blip decodes the first frame, then it only ever moves on scroll */
  film.play().then(function () {
    film.pause();
    film.currentTime = 0;
  }).catch(function () {});

  /* anything that starts playback on its own gets stopped */
  film.addEventListener('play', function () { film.pause(); });

  /* slow push-in keeps the fixed film from feeling flat ----- */
  gsap.to(film, {
    scale: 1.02,
    ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.8 }
  });

  /* headline splits apart + fades on exit ------------------ */
  gsap.utils.toArray('.hero-title .in').forEach(function (el) {
    var depth = parseFloat(el.dataset.depth);
    gsap.to(el.parentNode, {
      y: function () { return -window.innerHeight * depth * 0.42; },
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true }
    });
  });

  gsap.to('.hero-inner', {
    opacity: 0,
    filter: 'blur(6px)',
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: 0.4 }
  });

  /* pointer parallax --------------------------------------- */
  var bgX = gsap.quickTo(film, 'x', { duration: 1.4, ease: 'power3' });
  var bgY = gsap.quickTo(film, 'y', { duration: 1.4, ease: 'power3' });
  var inX = gsap.quickTo('.hero-inner', 'x', { duration: 1.3, ease: 'power3' });

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var nx = e.clientX / window.innerWidth - 0.5;
    var ny = e.clientY / window.innerHeight - 0.5;
    bgX(nx * 34);
    bgY(ny * 24);
    inX(nx * -14);
  }, { passive: true });

  /* nav ------------------------------------------------------ */
  ScrollTrigger.create({
    start: 'top -60',
    end: 99999,
    onToggle: function (self) { document.querySelector('.nav').classList.toggle('is-stuck', self.isActive); }
  });

  ['signal', 'ask', 'manifesto'].forEach(function (id) {
    var link = document.querySelector('[data-nav="' + id + '"]');
    ScrollTrigger.create({
      trigger: '#' + id,
      start: 'top 55%',
      end: 'bottom 45%',
      onToggle: function (self) { link.classList.toggle('is-active', self.isActive); }
    });
  });

  /* masked line reveals ------------------------------------- */
  gsap.utils.toArray('.signal .mask .in, .card-head .in').forEach(function (el, i) {
    gsap.fromTo(el,
      { yPercent: 118 },
      {
        yPercent: 0,
        duration: 1.15,
        ease: 'expo.out',
        delay: (i % 2) * 0.08,
        scrollTrigger: { trigger: el.closest('section'), start: 'top 72%' }
      }
    );
  });

  /* 01 — counter drift -------------------------------------- */
  gsap.utils.toArray('[data-drift]').forEach(function (el) {
    var d = parseFloat(el.dataset.drift);
    gsap.fromTo(el,
      { x: d },
      {
        x: -d,
        ease: 'none',
        scrollTrigger: { trigger: '.signal', start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      }
    );
  });

  /* 02 — card rises into place ------------------------------ */
  gsap.fromTo('#askCard',
    { scale: 0.9, y: 90, opacity: 0.35 },
    {
      scale: 1, y: 0, opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '#askCard', start: 'top 92%', end: 'top 38%', scrub: 0.7 }
    }
  );

  gsap.fromTo('.card-copy, .chat',
    { y: 40, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: ease,
      scrollTrigger: { trigger: '#askCard', start: 'top 60%' }
    }
  );

  gsap.fromTo('.chip',
    { y: 18, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 0.6, stagger: 0.08, ease: ease,
      scrollTrigger: { trigger: '.chips', start: 'top 88%' }
    }
  );

  gsap.fromTo('.msg--bot',
    { y: 20, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 0.8, ease: ease,
      scrollTrigger: { trigger: '.chat', start: 'top 70%' }
    }
  );

  /* 03 — word-by-word illumination -------------------------- */
  gsap.to('.manifesto-head .w', {
    color: '#dde7d6',
    ease: 'none',
    stagger: 0.5,
    scrollTrigger: {
      trigger: '.manifesto',
      start: 'top bottom',
      end: 'top 38%',
      scrub: 0.5,
      invalidateOnRefresh: true
    }
  });

  gsap.to('.foot-rule', {
    scaleX: 1, duration: 1.4, ease: 'power2.inOut',
    scrollTrigger: { trigger: '.foot-rule', start: 'top 92%' }
  });

  gsap.fromTo('.foot > *',
    { y: 22, opacity: 0 },
    {
      y: 0, opacity: 1, duration: 0.8, stagger: 0.12, ease: ease,
      scrollTrigger: { trigger: '.foot', start: 'top 92%' }
    }
  );

  /* recompute once webfonts land ---------------------------- */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }

  /* smooth in-page jumps that respect the fixed nav ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
    });
  });
})();
