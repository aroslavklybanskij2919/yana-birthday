(function () {
  'use strict';
  var C = window.CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var params = new URLSearchParams(location.search);
  var TEST = params.get('test') === '1';
  var FLAG = 'yana-bday-won';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pools = { decor: [], items: [] };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // запрет зума щипком (iOS Safari игнорирует user-scalable)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
    document.addEventListener(n, function (e) { e.preventDefault(); });
  });
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest && e.target.closest('.noselect')) e.preventDefault();
  });

  /* ---------- ссылка: только по запросу, не лежит в DOM ---------- */
  function getLink() {
    if (TEST) return C.testLink || '';
    try { return atob(C.giftLink || ''); } catch (e) { return ''; }
  }

  /* ---------- запасной герой: простой кот из плоских форм ---------- */
  var CAT = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140">' +
    '<path d="M92 112c22-4 26-30 10-38" fill="none" stroke="#2B2B2B" stroke-width="9" stroke-linecap="round"/>' +
    '<ellipse cx="58" cy="106" rx="34" ry="30" fill="#2B2B2B"/>' +
    '<path d="M28 44l4-30 20 16zM88 44l-4-30-20 16z" fill="#2B2B2B"/>' +
    '<circle cx="58" cy="58" r="32" fill="#2B2B2B"/>' +
    '<ellipse cx="46" cy="55" rx="6" ry="8" fill="#FFD83D"/><ellipse cx="70" cy="55" rx="6" ry="8" fill="#FFD83D"/>' +
    '<ellipse cx="46" cy="56" rx="2" ry="6" fill="#2B2B2B"/><ellipse cx="70" cy="56" rx="2" ry="6" fill="#2B2B2B"/>' +
    '<path d="M54 68h8l-4 5z" fill="#FFD83D"/></svg>');

  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function loadAll(list) {
    return Promise.all((list || []).map(loadImg)).then(function (a) { return a.filter(Boolean); });
  }

  function fillPeeks(root, offset) {
    var imgs = root.querySelectorAll('img[data-pool]');
    for (var i = 0; i < imgs.length; i++) {
      var el = imgs[i], p = pools[el.dataset.pool];
      if (!p || !p.length) { el.style.display = 'none'; continue; }
      el.src = p[((+el.dataset.i || 0) + (offset || 0)) % p.length].src;
      el.style.display = '';
    }
  }

  var screens = ['s-splash', 's-quiz', 's-game', 's-memory', 's-final'];
  function show(id) {
    screens.forEach(function (s) { $('#' + s).classList.toggle('active', s === id); });
  }

  /* ---------- звук: своя музыка и эффекты на WebAudio, без файлов ---------- */
  var Snd = (function () {
    var ac, master, on = true, timer, step = 0, next = 0, started = false, STEP = 60 / 132 / 2;
    var A = [[76,79,76,72,76,79,84,79],[81,79,76,72,74,76,79,76],[77,81,77,72,77,81,84,81],[79,77,74,71,74,77,79,0],
             [84,79,76,79,84,79,76,72],[81,76,72,76,81,84,81,76],[77,81,84,81,77,72,77,81],[79,74,71,74,79,83,84,0]];
    var BASS = [48, 45, 41, 43];
    try { on = localStorage.getItem('yana-snd') !== '0'; } catch (e) {}
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function tone(type, f, t, d, v, f2) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .05);
    }
    function hat(t) {
      var n = ac.sampleRate * .04, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = .05;
      s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start(t);
    }
    function sched() {
      while (next < ac.currentTime + .15) {
        var bar = Math.floor(step / 8) % 8, k = step % 8, m = A[bar][k];
        if (m) tone('square', hz(m), next, STEP * .9, .035);
        var root = BASS[bar % 4];
        if (k === 0 || k === 4) tone('triangle', hz(root), next, STEP * 1.6, .11);
        else if (k === 2 || k === 6) tone('triangle', hz(root + 7), next, STEP * .9, .06);
        if (k % 2 === 1) hat(next);
        next += STEP; step++;
      }
    }
    function setVol() { if (master) master.gain.setTargetAtTime(on ? .55 : 0, ac.currentTime, .05); }
    return {
      start: function () {
        try {
          if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.connect(ac.destination); setVol(); }
          if (ac.state === 'suspended') ac.resume();
          if (!started) { started = true; next = ac.currentTime + .08; timer = setInterval(sched, 30); }
        } catch (e) {}
      },
      toggle: function () {
        on = !on; try { localStorage.setItem('yana-snd', on ? '1' : '0'); } catch (e) {}
        if (!ac) this.start(); setVol(); return on;
      },
      isOn: function () { return on; },
      pause: function (h) { if (!ac) return; if (h) ac.suspend(); else if (started) ac.resume(); },
      sfx: function (k) {
        if (!ac || !on) return;
        var t = ac.currentTime;
        if (k === 'catch') tone('sine', 660, t, .12, .16, 1250);
        else if (k === 'ok') { tone('triangle', hz(72), t, .12, .16); tone('triangle', hz(76), t + .08, .12, .16); tone('triangle', hz(79), t + .16, .2, .16); }
        else if (k === 'bad') tone('sawtooth', 220, t, .28, .09, 110);
        else if (k === 'flip') tone('sine', 520, t, .07, .12, 760);
        else if (k === 'win') [72, 76, 79, 84, 88].forEach(function (m, i) { tone('triangle', hz(m), t + i * .1, .35, .17); });
      }
    };
  })();
  document.addEventListener('visibilitychange', function () { Snd.pause(document.hidden); });
  // первое касание на любом экране запускает музыку, дальше страхует от остановки системой
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (n) {
    document.addEventListener(n, function () { Snd.start(); }, { passive: true });
  });
  (function mkToggle() {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'snd-btn'; b.setAttribute('aria-label', 'Звук');
    function paint() { b.textContent = Snd.isOn() ? '🔊' : '🔇'; }
    b.addEventListener('click', function () { Snd.toggle(); paint(); });
    paint(); document.body.appendChild(b);
  })();

  /* ---------- 1. заставка ---------- */
  function initSplash() {
    $('#sp-title').innerHTML = (C.splash && C.splash.title) || 'Тебе посылка';
    $('#sp-text').textContent = (C.splash && C.splash.text) || '';
    var btn = $('#btn-open');
    btn.textContent = (C.splash && C.splash.button) || 'Открыть';
    fillPeeks($('#s-splash'), 0);
    btn.addEventListener('click', function () {
      btn.disabled = true;
      Snd.start();
      $('#box').classList.add('open');
      setTimeout(function () { show('s-quiz'); renderQ(); }, reduce ? 80 : 1150);
    });
  }

  /* ---------- 2. квиз ---------- */
  var qi = 0, qLock = false, reactT = 0;
  var PRAISE = ['Да, именно так.', 'В точку.', 'Вот поэтому ты у нас умная.', 'Принято.', 'Конечно. Другого мы и не ждали.'];
  function react(kind) {
    var s = $('#s-quiz');
    s.classList.remove('r-ok', 'r-bad');
    void s.offsetWidth;
    s.classList.add(kind === 'ok' ? 'r-ok' : 'r-bad');
    clearTimeout(reactT);
    reactT = setTimeout(function () { s.classList.remove('r-ok', 'r-bad'); }, 900);
  }
  function say(t) {
    var b = $('#q-say');
    b.textContent = t || '';
    b.classList.toggle('show', !!t);
  }
  function renderQ() {
    var Q = C.questions || [], q = Q[qi];
    if (!q) { startGame(); return; }
    qLock = false;
    $('#q-count').textContent = 'Вопрос ' + (qi + 1) + ' из ' + Q.length;
    $('#q-text').textContent = q.text;
    $('#q-fill').style.width = (qi / Q.length * 100) + '%';
    say('');
    fillPeeks($('#s-quiz'), qi);
    var box = $('#q-opts');
    box.innerHTML = '';
    q.options.forEach(function (label, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.textContent = label;
      b.addEventListener('click', function () { answer(b, i); });
      box.appendChild(b);
    });
  }
  function answer(btn, i) {
    if (qLock || btn.disabled) return;
    var Q = C.questions, q = Q[qi];
    if (i === q.correct) {
      qLock = true;
      btn.classList.add('ok');
      say(PRAISE[qi % PRAISE.length]);
      Snd.sfx('ok');
      react('ok');
      $('#q-fill').style.width = ((qi + 1) / Q.length * 100) + '%';
      setTimeout(function () { qi++; renderQ(); }, 950);
    } else {
      btn.classList.add('bad');
      btn.disabled = true;
      var w = Array.isArray(q.wrong) ? q.wrong[i] : q.wrong;
      say(w || 'Не-а. Ещё разок.');
      Snd.sfx('bad');
      react('bad');
    }
  }

  /* ---------- 3. мини-игра ---------- */
  var cv, ctx, G = { w: 0, h: 0, dpr: 1, run: false, left: 20, score: 0, goal: 10, fails: 0, items: [], fl: [], px: 0, tx: 0, sp: 0, last: 0, raf: 0 };
  var TIME = 30;

  function sizeGame() {
    var r = cv.getBoundingClientRect();
    G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * G.dpr);
    cv.height = Math.round(r.height * G.dpr);
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    G.w = r.width; G.h = r.height;
    if (!G.px) G.px = G.tx = G.w / 2;
  }
  function basketGeom() {
    var w = Math.max(96, Math.min(132, G.w * .3));
    return { w: w, h: 52, y: G.h - Math.max(86, G.h * .13) - 20 };
  }
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function drawBasket() {
    var b = basketGeom(), x = G.px - b.w / 2, y = b.y;
    ctx.save();
    ctx.shadowColor = 'rgba(43,43,43,.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#2B2B2B';
    ctx.beginPath();
    ctx.moveTo(x + 4, y); ctx.lineTo(x + b.w - 4, y); ctx.lineTo(x + b.w - 14, y + b.h - 8);
    ctx.quadraticCurveTo(x + b.w - 15, y + b.h, x + b.w - 26, y + b.h); ctx.lineTo(x + 26, y + b.h);
    ctx.quadraticCurveTo(x + 15, y + b.h, x + 14, y + b.h - 8); ctx.closePath(); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#FFD83D'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (var i = 1; i < 4; i++) { var lx = x + b.w * i / 4; ctx.beginPath(); ctx.moveTo(lx, y + 16); ctx.lineTo(x + b.w / 2 + (lx - (x + b.w / 2)) * .8, y + b.h - 8); ctx.stroke(); }
    ctx.fillStyle = '#FFD83D'; rr(x - 4, y - 7, b.w + 8, 14, 7); ctx.fill();
    ctx.restore();
  }
  function spawn() {
    var p = pools.items.length ? pools.items : pools.decor;
    if (!p.length) return;
    var im = p[Math.floor(Math.random() * p.length)];
    var s = rand(62, 86);
    G.items.push({ im: im, s: s, x: rand(s * .5, G.w - s * .5), y: -s, vy: rand(.38, .56) * G.h, rot: rand(-.4, .4), vr: rand(-1.2, 1.2) });
  }
  function sticker(im) {
    if (im._st) return im._st;
    var pad = 6, w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas');
    c.width = w + pad * 2; c.height = h + pad * 2;
    var x = c.getContext('2d');
    for (var a = 0; a < 16; a++) x.drawImage(im, pad + Math.cos(a / 16 * 6.283) * 4, pad + Math.sin(a / 16 * 6.283) * 4);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'source-over'; x.drawImage(im, pad, pad);
    im._st = c; return c;
  }
  function drawItem(it) {
    var st = sticker(it.im), ar = st.width / st.height, h = it.s, w = Math.min(h * ar, h * 1.3);
    ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
    ctx.shadowColor = 'rgba(43,43,43,.22)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.drawImage(st, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function hud() {
    $('#g-time').textContent = Math.max(0, Math.ceil(G.left));
    $('#g-score').textContent = G.score + ' / ' + G.goal;
  }
  function overlay(title, text, btn, fn) {
    $('#g-title').textContent = title;
    $('#g-text').textContent = text;
    var b = $('#g-btn'); b.textContent = btn;
    b.onclick = fn;
    $('#g-overlay').hidden = false;
  }
  function startGame() {
    show('s-game');
    if (!cv) {
      cv = $('#cv-game'); ctx = cv.getContext('2d');
      var move = function (e) { var r = cv.getBoundingClientRect(); G.tx = e.clientX - r.left; };
      cv.addEventListener('pointerdown', function (e) { try { cv.setPointerCapture(e.pointerId); } catch (x) {} move(e); });
      cv.addEventListener('pointermove', move);
      window.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') G.tx -= 50; else if (e.key === 'ArrowRight') G.tx += 50;
      });
      window.addEventListener('resize', function () { if ($('#s-game').classList.contains('active')) sizeGame(); });
    }
    requestAnimationFrame(function () { sizeGame(); idleOverlay(); draw(); });
  }
  function idleOverlay() {
    G.goal = G.fails >= 2 ? 10 : 20;
    G.score = 0; G.left = TIME; G.items = []; G.fl = []; hud();
    var first = G.fails === 0;
    overlay(first ? 'Лови друзей' : 'Ещё раз',
      'Води корзину пальцем влево-вправо. ' + TIME + ' секунд, нужно поймать ' + G.goal + '.',
      first ? 'Поехали' : 'Давай', beginRound);
  }
  function beginRound() {
    $('#g-overlay').hidden = true;
    G.run = true; G.sp = 0; G.last = performance.now();
    cancelAnimationFrame(G.raf);
    G.raf = requestAnimationFrame(loop);
  }
  function loop(t) {
    var dt = Math.min(.05, (t - G.last) / 1000); G.last = t;
    if (G.run) update(dt);
    draw();
    if (G.run) G.raf = requestAnimationFrame(loop);
  }
  function update(dt) {
    G.left -= dt;
    G.px += (Math.max(30, Math.min(G.w - 30, G.tx)) - G.px) * Math.min(1, dt * 18);
    G.sp -= dt;
    if (G.sp <= 0) { spawn(); G.sp = rand(.4, .54); }
    var b = basketGeom();
    for (var i = G.items.length - 1; i >= 0; i--) {
      var it = G.items[i];
      it.y += it.vy * dt; it.rot += it.vr * dt;
      var bottom = it.y + it.s * .3;
      if (bottom >= b.y && it.y <= b.y + 22 && Math.abs(it.x - G.px) < b.w / 2 + it.s * .15) {
        Snd.sfx('catch'); G.score++; G.fl.push({ x: it.x, y: b.y - 10, t: 0 }); G.items.splice(i, 1); hud();
        if (G.score >= G.goal) { endRound(true); return; }
      } else if (it.y > G.h + it.s) G.items.splice(i, 1);
    }
    for (var j = G.fl.length - 1; j >= 0; j--) { G.fl[j].t += dt; if (G.fl[j].t > .7) G.fl.splice(j, 1); }
    hud();
    if (G.left <= 0) endRound(false);
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, G.w, G.h);
    G.items.forEach(drawItem);
    drawBasket();
    ctx.font = '800 24px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textAlign = 'center';
    G.fl.forEach(function (f) {
      ctx.globalAlpha = 1 - f.t / .7; ctx.lineWidth = 5; ctx.strokeStyle = '#FFD83D'; ctx.fillStyle = '#2B2B2B';
      var y = f.y - f.t * 70; ctx.strokeText('+1', f.x, y); ctx.fillText('+1', f.x, y);
    });
    ctx.globalAlpha = 1;
  }
  function endRound(win) {
    G.run = false;
    if (win) {
      Snd.sfx('win');
      overlay('Поймала!', 'Все друзья в корзине. Но они разбежались по парам, надо собрать.', 'Дальше', startMemory);
      return;
    }
    G.fails++;
    if (G.fails >= 3) {
      overlay('Три попытки — это характер', 'Засчитываю. Заслужила. Осталась ещё одна мелочь.', 'Дальше', startMemory);
      return;
    }
    var msg = G.fails === 1 ? 'Бывает. Они скользкие.' : 'Ладно, планку снижаем до 10. Мы же не звери.';
    overlay('Не хватило: ' + G.score + ' из ' + G.goal, msg, 'Ещё раз', function () { idleOverlay(); });
  }

  /* ---------- 3б. найди пары ---------- */
  function startMemory() {
    var p = pools.items.length ? pools.items : pools.decor;
    if (p.length < 2) { lsSet(FLAG, '1'); showFinale(false); return; }
    show('s-memory');
    var n = Math.min(4, p.length), cards = [], i;
    for (i = 0; i < n; i++) { cards.push(i); cards.push(i); }
    for (i = cards.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    var grid = $('#m-grid'); grid.innerHTML = ''; grid.style.gridTemplateColumns = 'repeat(' + (cards.length > 6 ? 4 : 3) + ',1fr)';
    var open = [], matched = 0, moves = 0, lock = false, say = $('#m-say');
    say.textContent = 'Ходов: 0';
    cards.forEach(function (id) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.dataset.id = id;
      b.innerHTML = '<div class="cin"><div class="face front">?</div><div class="face back"><img alt=""></div></div>';
      b.querySelector('img').src = p[id].src;
      b.addEventListener('click', function () {
        if (lock || b.classList.contains('flip')) return;
        b.classList.add('flip'); Snd.sfx('flip'); open.push(b);
        if (open.length < 2) return;
        moves++; say.textContent = 'Ходов: ' + moves;
        var a = open[0], c = open[1]; open = [];
        if (a.dataset.id === c.dataset.id) {
          a.classList.add('done'); c.classList.add('done'); matched++; Snd.sfx('ok');
          if (matched === n) {
            say.textContent = 'Все пары собраны за ' + moves + ' ход.';
            lsSet(FLAG, '1');
            setTimeout(function () { showFinale(false); }, 1300);
          }
        } else {
          lock = true;
          setTimeout(function () { a.classList.remove('flip'); c.classList.remove('flip'); lock = false; }, 800);
        }
      });
      grid.appendChild(b);
    });
  }

  /* ---------- 4. финал ---------- */
  var scratch = { cv: null, ctx: null, w: 0, h: 0, down: false, lx: 0, ly: 0, n: 0, done: false };
  function buildOrbit() {
    var list = pools.items.concat(pools.decor.slice(0, 0));
    var box = $('#orbit'); box.innerHTML = '';
    if (!list.length) list = pools.decor;
    var n = Math.min(8, Math.max(list.length, 6));
    for (var i = 0; i < n; i++) {
      var im = list[i % list.length];
      var o = document.createElement('div'); o.className = 'o';
      o.style.setProperty('--a', (360 / n * i) + 'deg');
      o.style.setProperty('--s', Math.round(rand(54, 68)) + 'px');
      var inner = document.createElement('div'); inner.className = 'oi';
      var img = document.createElement('img'); img.src = im.src; img.alt = '';
      img.style.transform = 'rotate(' + Math.round(rand(-10, 10)) + 'deg)';
      inner.appendChild(img); o.appendChild(inner); box.appendChild(o);
    }
  }
  function showFinale(skip) {
    show('s-final');
    var g = C.greeting || {};
    $('#f-title').textContent = g.title || 'С днём рождения!';
    $('#f-text').textContent = g.text || '';
    buildOrbit();
    var cvs = $('#cv-scratch'); scratch.cv = cvs; scratch.ctx = cvs.getContext('2d'); scratch.done = false;
    cvs.classList.remove('gone');
    $('#f-hint').classList.remove('gone');
    $('#gift-slot').innerHTML = '';
    if (!skip) $('#s-final').classList.add('locked');
    if (skip) { reveal(true); return; }
    requestAnimationFrame(function () { initScratch(); });
  }
  function initScratch() {
    var s = scratch, r = s.cv.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    s.w = r.width; s.h = r.height;
    s.cv.width = Math.round(s.w * d); s.cv.height = Math.round(s.h * d);
    var c = s.ctx; c.setTransform(d, 0, 0, d, 0, 0);
    c.globalCompositeOperation = 'source-over';
    var gr = c.createLinearGradient(0, 0, s.w, s.h);
    gr.addColorStop(0, '#FFE680'); gr.addColorStop(.5, '#FFD83D'); gr.addColorStop(1, '#F5C400');
    c.fillStyle = gr; c.fillRect(0, 0, s.w, s.h);
    c.fillStyle = 'rgba(43,43,43,.07)';
    for (var i = -s.h; i < s.w; i += 18) { c.beginPath(); c.moveTo(i, s.h); c.lineTo(i + 8, s.h); c.lineTo(i + 8 + s.h, 0); c.lineTo(i + s.h, 0); c.fill(); }
    c.fillStyle = '#2B2B2B'; c.textAlign = 'center'; c.font = '800 20px -apple-system,Segoe UI,Roboto,sans-serif';
    c.fillText('Сотри меня', s.w / 2, s.h / 2 + 7);
    c.globalCompositeOperation = 'destination-out';
    c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 28;
    s.n = 0; s.down = false;
    if (!s.bound) {
      s.bound = true;
      ['touchstart', 'touchmove'].forEach(function (n) { s.cv.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false }); });
      var pt = function (e) { var r2 = s.cv.getBoundingClientRect(); return [e.clientX - r2.left, e.clientY - r2.top]; };
      s.cv.addEventListener('pointerdown', function (e) {
        if (s.done) return;
        s.down = true; try { s.cv.setPointerCapture(e.pointerId); } catch (x) {}
        var p = pt(e); s.lx = p[0]; s.ly = p[1]; stroke(p[0], p[1], p[0], p[1]);
      });
      s.cv.addEventListener('pointermove', function (e) {
        if (!s.down || s.done) return;
        var p = pt(e); stroke(s.lx, s.ly, p[0], p[1]); s.lx = p[0]; s.ly = p[1];
        if (++s.n % 10 === 0) checkScratch();
      });
      var up = function () { s.down = false; if (!s.done) checkScratch(); };
      s.cv.addEventListener('pointerup', up); s.cv.addEventListener('pointercancel', up);
    }
  }
  function stroke(x0, y0, x1, y1) {
    var c = scratch.ctx; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }
  function checkScratch() {
    var s = scratch; if (s.done) return;
    var W = s.cv.width, H = s.cv.height, data;
    try { data = s.ctx.getImageData(0, 0, W, H).data; } catch (e) { return; }
    var cols = 44, rows = 30, clear = 0;
    for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
      var px = Math.floor((x + .5) / cols * W), py = Math.floor((y + .5) / rows * H);
      if (data[(py * W + px) * 4 + 3] < 128) clear++;
    }
    if (clear / (cols * rows) >= .82) reveal(false);
  }
  function reveal(quiet) {
    if (scratch.done && !quiet) return;
    scratch.done = true;
    scratch.cv.classList.add('gone');
    $('#f-hint').classList.add('gone');
    renderGift();
    $('#s-final').classList.remove('locked');
    if (!quiet) { confetti(); Snd.sfx('win'); }
  }
  function renderGift() {
    var link = getLink(), slot = $('#gift-slot');
    if (!link) return;
    slot.innerHTML = '';
    var card = document.createElement('div'); card.className = 'gift';
    card.innerHTML =
      '<div class="row"><div class="star"><svg width="30" height="30" viewBox="0 0 24 24"><path fill="#2B2B2B" d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.8-6.3 3.8 1.7-7L2 9.2l7.1-.6z"/></svg></div>' +
      '<div><div class="t">Telegram Premium</div><div class="s">Подарок для ' + (C.nameFor || C.name || '') + '</div></div></div>' +
      '<div class="acts"></div>' +
      '<div class="how"><b>Как забрать на iPhone</b><ol>' +
      '<li>Нажми «Забрать подарок», откроется Telegram.</li>' +
      '<li>Внизу экрана нажми на сумму покупки: Premium активируется бесплатно.</li>' +
      '<li>Не открылось? Скопируй ссылку, отправь себе в «Избранное» и перейди по ней оттуда.</li></ol>' +
      '<span>На аккаунте не должно быть активного Premium.</span></div>' +
      '<div class="linktext"></div>';
    var a = document.createElement('a');
    a.className = 'btn'; a.textContent = 'Забрать подарок'; a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost'; b.textContent = 'Скопировать ссылку';
    card.querySelector('.acts').appendChild(a); card.querySelector('.acts').appendChild(b);
    var lt = card.querySelector('.linktext'); lt.textContent = link;
    b.addEventListener('click', function () {
      copyText(link).then(function (ok) {
        b.textContent = ok ? 'Скопировано ✓' : 'Выдели ссылку ниже';
        if (!ok) { var r = document.createRange(); r.selectNodeContents(lt); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
        setTimeout(function () { b.textContent = 'Скопировать ссылку'; }, 2200);
      });
    });
    slot.appendChild(card);
    setTimeout(function () { try { card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); } catch (e) {} }, 700);
  }
  function copyText(t) {
    function fallback() {
      try {
        var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, t.length);
        var ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch (e) { return false; }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* ---------- конфетти ---------- */
  function confetti() {
    if (reduce) return;
    var cv2 = $('#confetti'), c = cv2.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 2);
    var W = cv2.clientWidth, H = cv2.clientHeight;
    cv2.width = W * d; cv2.height = H * d; c.setTransform(d, 0, 0, d, 0, 0);
    var cols = ['#FFD83D', '#F5C400', '#FFE98A', '#FFF1B0', '#2B2B2B', '#FFFFFF'], ps = [];
    for (var i = 0; i < 140; i++) ps.push({ x: rand(0, W), y: rand(-H * .6, -10), vx: rand(-1.2, 1.2), vy: rand(2, 5), s: rand(6, 11), r: rand(0, 6), vr: rand(-.2, .2), c: cols[i % cols.length] });
    var t0 = performance.now();
    (function tick(t) {
      c.clearRect(0, 0, W, H);
      var alive = 0;
      ps.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.vy += .03; p.r += p.vr;
        if (p.y < H + 20) alive++;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore();
      });
      if (alive && t - t0 < 7000) requestAnimationFrame(tick); else c.clearRect(0, 0, W, H);
    })(t0);
  }

  /* ---------- старт ---------- */
  function boot() {
    if (params.get('reset') === '1') lsDel(FLAG);
    var timeout = new Promise(function (r) { setTimeout(r, 2500); });
    var load = Promise.all([loadAll(C.assetsDecor), loadAll(C.assetsItems)]).then(function (r) {
      pools.decor = r[0]; pools.items = r[1];
      if (pools.decor.length + pools.items.length < 3) {
        return loadImg(CAT).then(function (cat) { if (cat) { pools.decor.push(cat); pools.items.push(cat); } });
      }
    });
    Promise.race([load, timeout]).then(function () {
      if (lsGet(FLAG) === '1') { showFinale(true); return; }
      initSplash();
    });
  }
  boot();
})();
