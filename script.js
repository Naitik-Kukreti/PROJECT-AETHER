/* ═══════════════════════════════════════════════════════════════
   AETHER — Deep Field Planetary Survey
   Lenis + GSAP ScrollTrigger. Every beat is scrubbed by the wheel.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
  if (window.CustomEase) {
    try { CustomEase.create('aether', 'M0,0 C0.16,1 0.3,1 1,1'); } catch (e) { /* noop */ }
  }

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  var ACCENTS = { '01': '#7FFFD4', '02': '#FF8A3D', '03': '#8FD3FF', '04': '#FFC46B' };

  var scrollY = 0;      // shared with the starfield
  var lenis = null;

  /* ═══════════ 1. PRELOADER ═══════════════════════════════════ */
  var PRE_IMAGES = [
    'assets/img/aether-nebula.jpg',
    'assets/img/aether-earth.jpg',
    'assets/img/aether-surface.jpg',
    'assets/img/aether-rust.jpg',
    'assets/img/aether-ice.jpg',
    'assets/img/aether-gas.jpg'
  ];
  var PRE_STATUS = [
    'ESTABLISHING TELEMETRY LINK',
    'DECODING OPTICAL PLATES',
    'ALIGNING ORBITAL FRAME',
    'SURVEY CYCLE 41 READY'
  ];

  function runPreloader(done) {
    var pre = $('#preloader');
    if (REDUCED || !pre) { document.body.classList.remove('is-loading'); done(); return; }

    var countEl  = $('#preCount');
    var statusEl = $('#preStatus');
    var arc      = $('.pre-arc-fill');
    var CIRC     = 2 * Math.PI * 92;
    var loaded   = 0;
    var total    = PRE_IMAGES.length;
    var target   = 0;
    var shown    = 0;
    var startedAt = performance.now();
    var finished = false;

    arc.style.strokeDasharray = CIRC;
    arc.style.strokeDashoffset = CIRC;

    function bump() {
      loaded++;
      target = Math.round((loaded / total) * 100);
    }
    PRE_IMAGES.forEach(function (src) {
      var im = new Image();
      im.onload = im.onerror = bump;
      im.src = src;
    });
    // hard ceiling so a stalled asset can never trap the visitor
    var ceiling = setTimeout(function () { target = 100; }, 7000);

    var tick = function () {
      var elapsed = performance.now() - startedAt;
      var floor = clamp((elapsed / 1400) * 100, 0, 100);   // never feel stuck
      var goal = Math.max(target, Math.min(floor, 96));
      if (loaded >= total || elapsed > 6000) goal = 100;
      shown += (goal - shown) * 0.18;
      if (goal - shown < 0.6) shown = goal;
      var v = Math.min(100, Math.round(shown));
      countEl.textContent = v;
      arc.style.strokeDashoffset = CIRC * (1 - v / 100);
      var si = clamp(Math.floor(v / 26), 0, PRE_STATUS.length - 1);
      if (statusEl.textContent !== PRE_STATUS[si]) statusEl.textContent = PRE_STATUS[si];

      if (v >= 100 && elapsed > 1100 && !finished) {
        finished = true;
        clearTimeout(ceiling);
        clearInterval(timer);
        gsap.ticker.remove(tick);
        countEl.textContent = '100';
        outro();
      }
    };
    gsap.ticker.add(tick);
    // rAF is throttled in hidden/background tabs — a timer keeps the count honest
    var timer = setInterval(tick, 40);
    // last-resort escape hatch: never trap the visitor behind the loader
    var deadline = setTimeout(function () {
      if (finished) return;
      finished = true;
      clearTimeout(ceiling); clearInterval(timer); gsap.ticker.remove(tick);
      countEl.textContent = '100';
      pre.style.display = 'none';
      document.body.classList.remove('is-loading');
      done();
    }, 9000);

    function outro() {
      clearTimeout(deadline);
      var settled = false;
      var settle = function () {
        if (settled) return;
        settled = true;
        pre.style.display = 'none';
        document.body.classList.remove('is-loading');
        done();
      };
      // if rAF is throttled (hidden tab) the timeline may never land — force it
      setTimeout(settle, 2600);
      var tl = gsap.timeline({ onComplete: settle });
      tl.to('.pre-inner', { opacity: 0, y: -18, duration: .5, ease: 'power2.in' })
        .to('.pre-arc', { scale: 1.35, duration: .6, ease: 'power2.in' }, '<')
        .to(pre, {
          clipPath: 'inset(0% 0% 100% 0%)',
          duration: 1.0,
          ease: 'expo.inOut'
        }, '-=0.15')
        .set(pre, { pointerEvents: 'none' });
    }
  }

  /* ═══════════ 2. SMOOTH SCROLL ═══════════════════════════════ */
  function initLenis() {
    if (REDUCED || typeof Lenis === 'undefined') return;
    var isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    lenis = new Lenis({
      duration: isTouch ? 0.95 : 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      syncTouch: true,
      touchMultiplier: 1.1
    });
    lenis.on('scroll', function (e) {
      scrollY = e.scroll || window.scrollY;
      ScrollTrigger.update();
    });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;   // handy handle for anchors / debugging
  }

  /* ═══════════ 3. STARFIELD ═══════════════════════════════════ */
  function initStars() {
    var cv = $('#stars');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var w = 0, h = 0, dpr = 1, stars = [], t0 = performance.now();

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var divisor = w < 768 ? 6200 : 4200;
      var n = Math.round(clamp((w * h) / divisor, 75, 480));
      stars = [];
      for (var i = 0; i < n; i++) {
        var z = Math.random();
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: z,
          r: 0.24 + z * 1.05,
          a: 0.22 + Math.random() * 0.6,
          tw: Math.random() * Math.PI * 2,
          ts: 0.6 + Math.random() * 1.7
        });
      }
    }

    function draw() {
      var t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        // parallax: deeper stars barely move, near stars drift with the scroll
        var off = (scrollY * (0.012 + s.z * 0.085) + t * (2 + s.z * 7)) % (h + 40);
        var y = s.y - off;
        y = ((y % (h + 40)) + (h + 40)) % (h + 40) - 20;
        var tw = REDUCED ? 1 : 0.62 + 0.38 * Math.sin(t * s.ts + s.tw);
        ctx.globalAlpha = s.a * tw;
        ctx.fillStyle = s.z > 0.86 ? '#CFF6E8' : '#FFFFFF';
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    build();
    draw();
    if (!REDUCED) gsap.ticker.add(draw);
    window.addEventListener('resize', function () { build(); if (REDUCED) draw(); });
  }

  /* ═══════════ 4. CURSOR ══════════════════════════════════════ */
  function initCursor() {
    var el = $('#cursor');
    if (!el || REDUCED) return;
    if (window.matchMedia('(hover: none)').matches) return;

    var dot = $('.cursor-dot', el), ring = $('.cursor-ring', el), lab = $('.cursor-label', el);
    var mx = window.innerWidth / 2, my = window.innerHeight / 2;
    var dx = mx, dy = my, rx = mx, ry = my, live = false;

    window.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      if (!live) { live = true; dx = rx = mx; dy = ry = my; gsap.to(el, { opacity: 1, duration: .4 }); }
    }, { passive: true });
    window.addEventListener('mouseleave', function () { gsap.to(el, { opacity: 0, duration: .3 }); live = false; });

    gsap.ticker.add(function () {
      dx += (mx - dx) * 0.55; dy += (my - dy) * 0.55;
      rx += (mx - rx) * 0.13; ry += (my - ry) * 0.13;
      dot.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    });

    var HOVERS = 'a,button,input,[data-cursor]';
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest(HOVERS) : null;
      if (!t) return;
      ring.classList.add('is-big');
      lab.textContent = t.getAttribute('data-cursor') || '';
    });
    document.addEventListener('mouseout', function (e) {
      var t = e.target.closest ? e.target.closest(HOVERS) : null;
      if (!t) return;
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      ring.classList.remove('is-big');
      lab.textContent = '';
    });
  }

  /* ═══════════ 5. VIDEO PLUMBING (defensive) ══════════════════ */
  function watchVideo(video, onReady) {
    if (!video) return { ok: false };
    var state = { ok: false, dur: 0 };
    var failed = false;

    function fail() {
      if (failed) return;
      failed = true;
      state.ok = false;
      video.style.display = 'none';
    }
    function ready() {
      if (failed || state.ok) return;
      if (!isFinite(video.duration) || video.duration <= 0) return;
      state.ok = true;
      state.dur = video.duration;
      if (onReady) onReady(state);
    }

    video.addEventListener('loadedmetadata', ready);
    video.addEventListener('loadeddata', ready);
    video.addEventListener('error', fail);
    var src = video.querySelector('source');
    if (src) src.addEventListener('error', fail);
    // if the file is still rendering / missing, bail out gracefully
    setTimeout(function () { if (!state.ok) fail(); }, 12000);
    if (video.readyState >= 1) ready();
    return state;
  }

  /* ═══════════ 6. HUD ═════════════════════════════════════════ */
  function initHUD() {
    var railFill = $('#railFill'), railPct = $('#railPct');
    var idxEl = $('#hudIndex'), dots = $$('.hud-dots a');

    var marks = $$('[data-planet]').map(function (sec, i) {
      return { sec: sec, i: i, id: sec.getAttribute('data-planet'), top: 0 };
    });
    var measure = function () {
      marks.forEach(function (m) {
        m.top = m.sec.getBoundingClientRect().top + window.scrollY;
      });
    };
    measure();
    ScrollTrigger.addEventListener('refresh', measure);

    var lastId = null;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var p = self.progress;
        if (railFill) railFill.style.transform = 'scaleY(' + p + ')';
        if (railPct) railPct.textContent = String(Math.round(p * 100)).padStart(3, '0');

        var probe = window.scrollY + window.innerHeight * 0.45;
        var cur = marks[0];
        for (var k = 0; k < marks.length; k++) if (probe >= marks[k].top) cur = marks[k];
        if (!cur || cur.id === lastId) return;
        lastId = cur.id;
        if (idxEl) idxEl.textContent = cur.id;
        document.documentElement.style.setProperty('--accent', ACCENTS[cur.id] || '#7FFFD4');
        dots.forEach(function (d, j) { d.classList.toggle('is-on', j === cur.i); });
      }
    });

    // scroll hint retires after the first move
    var hint = $('#hint');
    if (hint) {
      var retire = function () {
        gsap.to(hint, { opacity: 0, y: 14, duration: .5, ease: 'power2.out' });
        hint.style.pointerEvents = 'none';
        window.removeEventListener('wheel', retire);
        window.removeEventListener('touchmove', retire);
        window.removeEventListener('scroll', onScrollOnce);
      };
      var onScrollOnce = function () { if (window.scrollY > 30) retire(); };
      window.addEventListener('wheel', retire, { passive: true, once: true });
      window.addEventListener('touchmove', retire, { passive: true, once: true });
      window.addEventListener('scroll', onScrollOnce, { passive: true });
    }

    // clocks
    var hudClock = $('#hudClock'), footClock = $('#footClock'), footDate = $('#footDate');
    function pad(n) { return String(n).padStart(2, '0'); }
    function tickClock() {
      var d = new Date();
      var t = pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
      if (hudClock) hudClock.textContent = t + ' UTC';
      if (footClock) footClock.textContent = t;
      if (footDate) footDate.textContent = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    }
    tickClock();
    setInterval(tickClock, 1000);

    // anchor links routed through Lenis
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var t = document.querySelector(id);
        if (!t) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(t, { offset: 0, duration: 1.4 });
        else t.scrollIntoView();
      });
    });
  }

  /* ═══════════ 7. SPLIT TYPE ══════════════════════════════════ */
  function splitAll() {
    if (typeof SplitType === 'undefined') return;
    $$('[data-split]').forEach(function (el) {
      try { new SplitType(el, { types: 'chars', tagName: 'span' }); } catch (e) { /* noop */ }
    });
  }

  /* ═══════════ 8. ACT 01 — MERIDIAN ═══════════════════════════ */
  function initAct() {
    var act = $('#entry-01');
    var stage = $('#actStage');
    var wrap = $('#orbWrap');
    var orb = $('#orbEarth');
    var hero = $('#actHero');
    var split = $('#actSplit');
    var fall = $('.act-fall');
    if (!act || !wrap) return;

    split.removeAttribute('aria-hidden');

    function orbDia() {
      var vh = window.innerHeight;
      return window.innerWidth > 900
        ? clamp(vh * 0.84, 340, 1180)
        : clamp(vh * 0.64, 300, 700);
    }
    function heroY() { return orbDia() / 2 + window.innerHeight * 0.155; }
    function splitX() { return window.innerWidth > 900 ? window.innerWidth * 0.255 : 0; }
    function splitY() { return window.innerWidth > 900 ? 0 : -window.innerHeight * 0.18; }
    function splitScale() { return window.innerWidth > 900 ? 0.34 : 0.30; }

    var chars = $$('#h-meridian .char');
    var heroLines = $$('.js-hero-line', hero);
    var splitBits = $$('.split-copy > *', split);

    if (REDUCED) {
      gsap.set(wrap, { clearProps: 'all' });
      gsap.set(split, { opacity: 1 });
      gsap.set(splitBits, { opacity: 1, y: 0 });
      return;
    }

    gsap.set(wrap, { y: heroY() });
    gsap.set(split, { opacity: 0 });
    gsap.set(splitBits, { opacity: 0, y: 34 });

    var intro = gsap.timeline({ paused: true });
    intro.from(chars, { yPercent: 118, opacity: 0, duration: 1.25, stagger: 0.045, ease: 'expo.out' })
      .from(heroLines, { y: 22, opacity: 0, duration: .9, stagger: .12, ease: 'power3.out' }, 0.25)
      .from(orb, { yPercent: 14, opacity: 0, duration: 1.9, ease: 'expo.out' }, 0)
      .from('.peek', { opacity: 0, xPercent: function (i) { return i === 0 ? -40 : 40; }, duration: 1.2, ease: 'power3.out' }, 0.5);
    initAct.intro = intro;

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: act,
        start: 'top top',
        end: function () {
          return '+=' + Math.round(window.innerHeight * (window.innerWidth > 900 ? 4.2 : 3.2));
        },
        scrub: 1.1,
        pin: stage,
        refreshPriority: 30,
        invalidateOnRefresh: true,
        anticipatePin: 1
      }
    });

    tl.fromTo('.peek-l', { xPercent: 0, opacity: .72 },
        { xPercent: -70, opacity: 0, duration: 15, immediateRender: false }, 0)
      .fromTo('.peek-r', { xPercent: 0, opacity: .72 },
        { xPercent: 70, opacity: 0, duration: 15, immediateRender: false }, 0)
      .fromTo(chars, { yPercent: 0, opacity: 1 },
        { yPercent: -125, opacity: 0, duration: 17, stagger: 0.7, ease: 'power2.in', immediateRender: false }, 5)
      .fromTo(heroLines, { y: 0, opacity: 1 },
        { y: -60, opacity: 0, duration: 13, stagger: 1.2, immediateRender: false }, 4)
      .fromTo(wrap,
        { y: heroY, x: 0, scale: 1 },
        { y: splitY, x: splitX, scale: splitScale, duration: 30, ease: 'power2.inOut' }, 8)
      .to(split, { opacity: 1, duration: 8 }, 24)
      .to(splitBits, { opacity: 1, y: 0, duration: 10, stagger: 2.2, ease: 'power2.out' }, 26)
      .to(splitBits, { opacity: 0, y: -28, duration: 8, stagger: 1.1, ease: 'power2.in' }, 58)
      .to(split, { opacity: 0, duration: 6 }, 63)
      .to(wrap, { x: 0, y: 0, scale: 1.06, duration: 14, ease: 'power2.inOut' }, 58)
      .to(wrap, { scale: 7.4, duration: 28, ease: 'power2.in' }, 72)
      .to($$('.orb-glow', stage), { opacity: 0, duration: 12 }, 78)
      .to(fall, { opacity: 1, duration: 16 }, 80)
      .fromTo(fall.querySelector('img'), { scale: 1.28 }, { scale: 1.02, duration: 20, ease: 'power1.out' }, 80)
      .to(wrap, { opacity: 0, duration: 8 }, 92)
      .set({}, {}, 100);

    var spin = $('#orbVideo');
    watchVideo(spin, function () {
      orb.classList.add('vid-ready');
      var p = spin.play();
      if (p && p.catch) p.catch(function () { orb.classList.remove('vid-ready'); });
    });
  }

  /* ═══════════ 9. SURFACE — scrubbed flyover ══════════════════ */
  function initSurface() {
    var sec = $('#surface');
    var stage = $('#surfaceStage');
    var video = $('#flyVideo');
    var logs = $$('.log');
    var srFill = $('#srFill'), progEl = $('#surfaceProg');
    var alt = $('#altReadout'), scr = $('#scrubReadout');
    if (!sec) return;

    if (REDUCED) { gsap.set(logs, { opacity: 1 }); return; }

    var vs = watchVideo(video, function (st) {
      stage.classList.add('vid-ready');
      video.pause();
      try { video.currentTime = 0.001; } catch (e) { /* noop */ }
      st.ready = true;
    });

    var surfEnd = function () {
      return '+=' + Math.round(window.innerHeight * (window.innerWidth > 900 ? 3.2 : 2.6));
    };

    var wipe = $('#surfaceWipe');
    ScrollTrigger.create({
      trigger: sec, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true,
      onUpdate: function (self) {
        wipe.style.transform = 'translate3d(0,' + (-(1 - self.progress) * 100) + '%,0)';
      }
    });

    var pendingTime = -1;
    var rafScrub = null;

    ScrollTrigger.create({
      trigger: sec,
      start: 'top top',
      end: surfEnd,
      pin: stage,
      refreshPriority: 20,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress;
        if (vs.ok && vs.dur) {
          var t = clamp(p * (vs.dur - 0.06), 0, vs.dur - 0.06);
          pendingTime = t;
          if (!rafScrub) {
            rafScrub = requestAnimationFrame(function () {
              if (pendingTime >= 0 && Math.abs(video.currentTime - pendingTime) > 0.015) {
                try { video.currentTime = pendingTime; } catch (e) { /* noop */ }
              }
              rafScrub = null;
            });
          }
          if (scr) scr.textContent = t.toFixed(2);
        }
        if (srFill) srFill.style.transform = 'scaleX(' + p + ')';
        if (progEl) progEl.textContent = String(Math.min(4, Math.floor(p * 4) + (p > 0 ? 1 : 0))).padStart(2, '0');
        if (alt) alt.textContent = Math.round(412 - p * 294);
      }
    });

    var ltl = gsap.timeline({
      scrollTrigger: { trigger: sec, start: 'top top', end: surfEnd, scrub: 1, invalidateOnRefresh: true }
    });
    logs.forEach(function (el, i) {
      var s = 0.05 + i * 0.235;
      ltl.fromTo(el, { opacity: 0, y: 56, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.075, ease: 'power2.out' }, s)
        .to(el, { opacity: 0, y: -56, filter: 'blur(6px)', duration: 0.065, ease: 'power2.in' }, s + 0.145);
    });
    ltl.set({}, {}, 1);
  }

  /* ═══════════ 10. PLANET WIPES 02–04 ═════════════════════════ */
  function initWipes() {
    $$('.entry').forEach(function (entry) {
      var phero = $('.phero', entry);
      if (!phero) return;
      var inner = $('.phero-inner', phero);
      var edge = $('.wipe-edge', phero);
      var orb = $('.orb', phero);
      var chars = $$('.phero-type .char', phero);
      var meta = $$('.eyebrow, .hero-meta', phero);

      if (REDUCED) { gsap.set([inner, edge, orb], { clearProps: 'transform' }); return; }

      gsap.set(chars, { yPercent: 60, opacity: 0 });
      gsap.set(meta, { opacity: 0, y: 18 });

      ScrollTrigger.create({
        trigger: entry,
        start: 'top bottom',
        end: 'top top',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          var p = self.progress;
          inner.style.transform = 'translate3d(0,' + (-(1 - p) * 100) + '%,0)';
          if (edge) edge.style.opacity = p < 0.995 ? String(0.35 + p * 0.65) : '0';
        }
      });

      gsap.timeline({
        scrollTrigger: { trigger: entry, start: 'top 85%', end: 'top 8%', scrub: 1 }
      })
        .to(chars, { yPercent: 0, opacity: 1, duration: 1, stagger: 0.16, ease: 'power3.out' }, 0)
        .to(meta, { opacity: 1, y: 0, duration: .8, stagger: .2, ease: 'power2.out' }, 0.4);

      var next = phero.nextElementSibling;
      if (next) {
        gsap.to([$('.phero-type', phero), $('.orb-wrap', phero)], {
          opacity: 0, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 62%', end: 'top 16%', scrub: 1 }
        });
      }

      if (orb) {
        gsap.fromTo(orb,
          { yPercent: 8, scale: 1.04 },
          {
            yPercent: -10, scale: 1, ease: 'none',
            scrollTrigger: { trigger: entry, start: 'top top', end: '+=110%', scrub: 1.2 }
          });
      }
    });
  }

  /* ═══════════ 11. 02 — HORIZONTAL SCRUB ══════════════════════ */
  function initHScroll() {
    var sec = $('#hscroll');
    var track = $('#hTrack');
    if (!sec || !track || REDUCED) {
      if (track) gsap.set($$('.hcard', track), { opacity: 1 });
      return;
    }

    var mm = gsap.matchMedia();

    mm.add('(min-width: 901px)', function () {
      var dist = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth + 24);
      };
      var tw = gsap.to(track, {
        x: function () { return -dist(); },
        ease: 'none',
        scrollTrigger: {
          trigger: sec,
          start: 'top top',
          end: function () { return '+=' + (dist() + window.innerHeight * 0.5); },
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          refreshPriority: 10,
          invalidateOnRefresh: true
        }
      });

      var cards = $$('.hcard', track);
      cards.forEach(function (c) {
        gsap.fromTo(c, { opacity: .45, y: 30 }, {
          opacity: 1, y: 0, ease: 'none',
          scrollTrigger: {
            trigger: c, containerAnimation: tw,
            start: 'left 104%', end: 'left 68%', scrub: true
          }
        });
      });
      return function () { gsap.set(track, { clearProps: 'transform' }); };
    });

    mm.add('(max-width: 900px)', function () {
      var cards = $$('.hcard', track);
      gsap.set(cards, { opacity: 0, y: 40 });
      ScrollTrigger.batch(cards, {
        start: 'top 88%',
        onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: .9, stagger: .1, ease: 'power3.out' }); }
      });
    });
  }

  /* ═══════════ 12. 03 — LEDGER ════════════════════════════════ */
  function initLedger() {
    var rows = $$('.lrow');
    if (!rows.length) return;
    if (REDUCED) return;

    gsap.set(rows, { clipPath: 'inset(0% 100% 0% 0%)', opacity: 0 });
    gsap.to(rows, {
      clipPath: 'inset(0% 0% 0% 0%)', opacity: 1,
      duration: .9, stagger: .09, ease: 'power3.out',
      scrollTrigger: { trigger: '.ledger-rows', start: 'top 82%' }
    });

    gsap.from('.ledger-close', {
      opacity: 0, y: 30, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.ledger-close', start: 'top 88%' }
    });
    gsap.from('.ledger-head > *', {
      opacity: 0, y: 26, duration: .9, stagger: .12, ease: 'power3.out',
      scrollTrigger: { trigger: '.ledger-head', start: 'top 85%' }
    });
  }

  /* ═══════════ 13. 04 — ORBITAL DIAGRAM ═══════════════════════ */
  function initOrbital() {
    var sec = $('#orbital');
    if (!sec) return;
    var marks = $$('.omark', sec);
    if (REDUCED) { gsap.set(marks, { opacity: 1 }); return; }

    var rings = $$('.oring', sec);
    gsap.fromTo(rings,
      { scale: .72, opacity: 0, rotate: -8 },
      {
        scale: 1, opacity: 1, rotate: 0, transformOrigin: '400px 400px',
        duration: 1.4, stagger: .1, ease: 'power3.out',
        scrollTrigger: { trigger: '.orbital-stage', start: 'top 78%' }
      });

    gsap.to(rings, {
      rotate: function (i) { return (i % 2 ? -1 : 1) * (10 + i * 5); },
      transformOrigin: '400px 400px', ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1.4 }
    });

    gsap.fromTo('.orbital-planet', { scale: .84 }, {
      scale: 1.08, ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1.2 }
    });

    gsap.set(marks, { opacity: 0 });
    gsap.to(marks, {
      opacity: 1, duration: .8, stagger: .14, ease: 'power2.out',
      scrollTrigger: { trigger: '.orbital-stage', start: 'top 62%' }
    });

    gsap.from('.orbital-head > *', {
      opacity: 0, y: 28, duration: .9, stagger: .12, ease: 'power3.out',
      scrollTrigger: { trigger: '.orbital-head', start: 'top 86%' }
    });
  }

  /* ═══════════ 14. ARCHIVE ════════════════════════════════════ */
  function initArchive() {
    var sec = $('#archive');
    if (!sec) return;
    var video = $('#archiveVideo');
    var bar = $('#filterbar');
    var chars = $$('.archive-type .char', sec);

    if (!REDUCED) {
      gsap.set(chars, { yPercent: 105, opacity: 0 });
      gsap.set(bar, { yPercent: 60, opacity: 0 });

      gsap.timeline({ scrollTrigger: { trigger: sec, start: 'top 72%' } })
        .to(chars, { yPercent: 0, opacity: 1, duration: 1.1, stagger: .035, ease: 'expo.out' })
        .to(bar, { yPercent: 0, opacity: 1, duration: .9, ease: 'power3.out' }, '-=0.55');

      gsap.fromTo('.archive-media', { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 1 }
      });
    }

    if (video) {
      var vs = watchVideo(video, function () { sec.classList.add('vid-ready'); });
      ScrollTrigger.create({
        trigger: sec, start: 'top bottom', end: 'bottom top',
        onEnter: function () { video.preload = 'auto'; video.load(); },
        onToggle: function (self) {
          if (!vs.ok) return;
          if (self.isActive) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
          else video.pause();
        }
      });
    }

    var chips = $$('.chip', sec);
    var count = $('#fbCount');
    var COUNTS = { ALL: 4118, IMAGING: 2461, SPECTRA: 903, TELEMETRY: 612, 'SUB-SURFACE': 142 };
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        chips.forEach(function (o) { o.classList.remove('is-on'); });
        c.classList.add('is-on');
        var key = c.textContent.trim();
        if (count) animateNumber(count, COUNTS[key] != null ? COUNTS[key] : 0, 0);
      });
    });
    var input = $('#fbInput');
    if (input && count) {
      input.addEventListener('input', function () {
        var q = input.value.trim();
        var active = $('.chip.is-on', sec);
        var base = active ? (COUNTS[active.textContent.trim()] || 4118) : 4118;
        var n = q ? Math.max(0, Math.round(base / (1 + q.length * 1.35))) : base;
        animateNumber(count, n, 0);
      });
    }
  }

  /* ═══════════ 15. COUNTERS + BARS ════════════════════════════ */
  function fmt(v, dec) {
    return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function animateNumber(el, to, dec) {
    var obj = { v: parseFloat(String(el.textContent).replace(/,/g, '')) || 0 };
    gsap.to(obj, {
      v: to, duration: 1.6, ease: 'power2.out',
      onUpdate: function () { el.textContent = fmt(obj.v, dec); }
    });
  }

  function initCompare() {
    var rows = $$('.cmp-row:not(.cmp-row--head)');
    if (!rows.length) return;

    if (!REDUCED) {
      gsap.from('.compare-head > *', {
        opacity: 0, y: 30, duration: .95, stagger: .12, ease: 'power3.out',
        scrollTrigger: { trigger: '.compare-head', start: 'top 85%' }
      });
    }

    rows.forEach(function (row) {
      var nums = $$('.count', row);
      var bars = $$('.bar b', row);

      if (REDUCED) {
        nums.forEach(function (n) {
          n.textContent = fmt(parseFloat(n.getAttribute('data-to').replace(/,/g, '')), +n.getAttribute('data-dec') || 0);
        });
        gsap.set(bars, { scaleX: 1 });
        return;
      }

      gsap.set(bars, { scaleX: 0 });
      ScrollTrigger.create({
        trigger: row, start: 'top 82%', once: true,
        onEnter: function () {
          gsap.from(row, { opacity: 0, y: 26, duration: .8, ease: 'power3.out' });
          nums.forEach(function (n, i) {
            var to = parseFloat(n.getAttribute('data-to').replace(/,/g, ''));
            var dec = parseInt(n.getAttribute('data-dec'), 10) || 0;
            var obj = { v: 0 };
            gsap.to(obj, {
              v: to, duration: 1.8, delay: i * 0.06, ease: 'power2.out',
              onUpdate: function () { n.textContent = fmt(obj.v, dec); }
            });
          });
          gsap.to(bars, { scaleX: 1, duration: 1.3, stagger: .08, ease: 'power3.out', delay: .15 });
        }
      });
    });
  }

  /* ═══════════ 16. BACKDROP PARALLAX + FOOTER ═════════════════ */
  function initMisc() {
    if (REDUCED) return;

    gsap.fromTo('.bg-nebula', { yPercent: -6, scale: 1.22 }, {
      yPercent: 8, scale: 1.12, ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: 1.6 }
    });

    gsap.to('.hud-cycle', {
      opacity: 0, duration: .4, ease: 'power2.out',
      scrollTrigger: { trigger: '.foot', start: 'top 92%', toggleActions: 'play none none reverse' }
    });

    gsap.from('.foot-top > *, .foot-col, .foot-bot > *', {
      opacity: 0, y: 30, duration: .9, stagger: .07, ease: 'power3.out',
      scrollTrigger: { trigger: '.foot', start: 'top 86%' }
    });

    var play = $('.playbtn');
    if (play) {
      play.addEventListener('click', function () {
        var t = $('#surface');
        if (t && lenis) lenis.scrollTo(t, { duration: 1.8 });
        else if (t) t.scrollIntoView();
      });
    }
  }

  /* ═══════════ BOOT ═══════════════════════════════════════════ */
  function boot() {
    splitAll();
    initLenis();
    initStars();
    initCursor();
    initHUD();
    initAct();
    initSurface();
    initWipes();
    initHScroll();
    initLedger();
    initOrbital();
    initArchive();
    initCompare();
    initMisc();

    ScrollTrigger.refresh();
    window.addEventListener('resize', function () {
      clearTimeout(boot.rt);
      boot.rt = setTimeout(function () { ScrollTrigger.refresh(); }, 220);
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    }
  }

  function start() {
    boot();
    runPreloader(function () {
      ScrollTrigger.refresh();
      if (!initAct.intro) return;
      initAct.intro.play();
      var handoff = function () { initAct.intro.progress(1); };
      window.addEventListener('wheel', handoff, { passive: true, once: true });
      window.addEventListener('touchstart', handoff, { passive: true, once: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
