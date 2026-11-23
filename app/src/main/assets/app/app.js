/* ZOD SMACC - the app's own screens. Served by the app at https://<your smacc host>/zod-app/, so the
   calls below go to SMACC with the phone's own login, exactly as SMACC's pages make them.
   The calls here only READ from SMACC (and sign in). New documents and returns are put together on the
   app's own screens, and SMACC's own page for that document (opened out of sight, form.js) fills them in,
   works out prices, stock, VAT and totals, and saves them with its own Save button. Editing a saved
   document still opens SMACC's own screen. */
(function () {
  'use strict';
  var APP = window.ZodAndroid || null;
  var $ = function (id) { return document.getElementById(id); };
  var view = $('view'), titleEl = $('title'), backBtn = $('back'), actBtn = $('act'), tabsEl = $('tabs');

  /* ---------- settings ---------- */
  var S = { lang: '', dark: false, acc: '#1565c0', fs: 15, wh: '' };
  try { var sv = JSON.parse(localStorage.getItem('zodapp|settings') || '{}'); for (var k in sv) S[k] = sv[k]; } catch (e) { /* defaults */ }
  if (!S.lang) S.lang = /^ar/i.test(navigator.language || 'ar') ? 'ar' : 'en';
  function saveS() { try { localStorage.setItem('zodapp|settings', JSON.stringify(S)); } catch (e) { /* ignore */ } }
  function L(ar, en) { return S.lang === 'ar' ? ar : en; }
  function soft(hex, dark) {   // a light (or dark) tint of the accent colour
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, t = dark ? 0.22 : 0.12, base = dark ? 20 : 255;
    var m = function (c) { return Math.round(base + (c - base) * t); };
    return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')';
  }
  function applyS() {
    var h = document.documentElement;
    h.lang = S.lang; h.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
    h.classList.toggle('dark', !!S.dark);
    h.style.setProperty('--acc', S.acc);
    h.style.setProperty('--acc-soft', soft(S.acc, S.dark));
    h.style.setProperty('--fs', S.fs + 'px');
  }

  /* ---------- helpers ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function add(p) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) p.appendChild(arguments[i]); return p; }
  function ltr(text, cls) { var b = el('bdi', cls, text); return b; }
  function money(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function qty(n) { n = Number(n) || 0; return n.toLocaleString('en-US', { maximumFractionDigits: 3 }); }
  function dateOf(s) { s = String(s || ''); return /^\d{8}$/.test(s) ? s.slice(6) + '/' + s.slice(4, 6) + '/' + s.slice(0, 4) : s; }
  function dmy(d) { var p = function (x) { return (x < 10 ? '0' : '') + x; }; return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear(); }
  function latin(s) { return String(s).replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).replace(/[۰-۹]/g, function (c) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(c); }); }
  function q(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  var toastT = 0;
  function toast(msg, ms) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, ms || 2600); }
  function icon(d) { var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path'); s.setAttribute('viewBox', '0 0 24 24'); p.setAttribute('d', d); s.appendChild(p); return s; }
  var IC = {
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
    doc: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z',
    box: 'M20 2H4c-1 0-2 .9-2 2v3c0 .7.4 1.3 1 1.7V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.7c.6-.4 1-1 1-1.7V4c0-1.1-1-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
    person: 'M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z',
    gear: 'M19.4 13c0-.3.1-.6.1-1s0-.7-.1-1l2.1-1.6c.2-.2.2-.4.1-.6l-2-3.5c-.1-.2-.4-.3-.6-.2l-2.5 1c-.5-.4-1.1-.7-1.7-1l-.4-2.600c0-.2-.2-.4-.5-.4h-4c-.2 0-.4.2-.5.4l-.4 2.600c-.6.3-1.200.6-1.700 1l-2.500-1c-.2-.1-.5 0-.6.2l-2 3.500c-.1.2-.1.5.1.6L4.600 11c0 .3-.1.6-.1 1s0 .7.1 1l-2.100 1.600c-.2.2-.2.4-.1.6l2 3.500c.1.2.4.3.6.2l2.500-1c.5.4 1.100.7 1.700 1l.4 2.600c0 .2.2.4.5.4h4c.2 0 .4-.2.5-.4l.4-2.600c.6-.3 1.200-.6 1.700-1l2.500 1c.2.1.5 0 .6-.2l2-3.500c.1-.2.1-.5-.1-.6L19.400 13zM12 15.500c-1.900 0-3.500-1.600-3.500-3.500s1.600-3.500 3.500-3.500 3.500 1.600 3.500 3.500-1.600 3.500-3.500 3.500z',
    back: 'M20 11H7.8l5.600-5.600L12 4l-8 8 8 8 1.400-1.400L7.800 13H20v-2z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
    undo: 'M12.500 8c-2.600 0-5 1-6.900 2.600L2 7v9h9l-3.600-3.600c1.400-1.200 3.200-1.900 5.100-1.900 3.500 0 6.500 2.300 7.600 5.500l2.400-.8C21 11 17.100 8 12.500 8z',
    cart: 'M7 18c-1.100 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM1 2v2h2l3.600 7.600-1.400 2.400c-.1.300-.2.600-.2 1 0 1.100.9 2 2 2h12v-2H7.400c-.1 0-.2-.1-.2-.2v-.1L8.100 13h7.400c.8 0 1.400-.4 1.700-1l3.600-6.500c.1-.1.2-.300.2-.5 0-.6-.4-1-1-1H5.200l-.9-2H1zm16 16c-1.100 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
    swap: 'M7 11l-4 4 4 4v-3h7v-2H7v-3zm14-2l-4-4v3h-7v2h7v3l4-4z',
    chart: 'M5 9.200h3V19H5zM10.600 5h2.800v14h-2.800zm5.600 8H19v6h-2.800z',
    quote: 'M19 3H5c-1.100 0-2 .9-2 2v14c0 1.100.9 2 2 2h14c1.100 0 2-.9 2-2V5c0-1.100-.9-2-2-2zm-2 14H7v-2h10v2zm0-4H7v-2h10v2zm0-4H7V7h10v2z',
    refresh: 'M17.600 6.400C16.200 4.900 14.200 4 12 4c-4.400 0-8 3.600-8 8s3.600 8 8 8c3.700 0 6.800-2.600 7.700-6h-2.100c-.8 2.300-3 4-5.600 4-3.300 0-6-2.700-6-6s2.700-6 6-6c1.700 0 3.100.7 4.200 1.800L13 11h7V4l-2.400 2.400z'
  };

  /* ---------- SMACC calls (one at a time: SMACC answers one request per login at a time) ---------- */
  function AuthError() { this.auth = true; }
  var chain = Promise.resolve();
  function post(url, body) {
    var run = function () {
      return fetch(url, {
        method: 'POST', credentials: 'include', redirect: 'follow',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Requested-With': 'XMLHttpRequest' },
        body: body || ''
      }).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (r.status === 401 || r.status === 403 || (r.ok && ct.indexOf('json') < 0)) throw new AuthError();
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        var d = j ? j.d : null;
        if (typeof d === 'string' && /^\s*[\[{]/.test(d)) { try { return JSON.parse(d); } catch (e) { return d; } }
        return d;
      });
    };
    var p = chain.then(run, run);
    chain = p.catch(function () {});
    return p;
  }
  function ws(fn, body) { return post('/WebServices/CommonWebService.asmx/' + fn, body); }
  function listCall(url, field, text, size, page) {
    return post(url + '/LoadPageListing', "{ 'CurrentPage' : '" + page + "', 'RecordsPerPage' : '" + size +
      "' ,'DDLSearchSelectedValue' : '" + field + "', 'SearchText' : '" + q(text) + "' }").then(function (o) {
      o = o || {};
      return { rows: Array.isArray(o.pageList) ? o.pageList : [], total: Number(o.totalRecords) || 0 };
    });
  }
  function table(o) { return o && Array.isArray(o.Table) ? o.Table : (Array.isArray(o) ? o : []); }

  /* ---------- navigation ---------- */
  var depth = 0, gen = 0, onAct = null;
  function go(route) { depth++; location.hash = '#/' + route; }
  function setBar(title, canBack, actIcon, actFn) {
    titleEl.textContent = title;
    backBtn.textContent = ''; actBtn.textContent = '';
    if (canBack) backBtn.appendChild(icon(IC.back));
    if (actIcon) actBtn.appendChild(icon(actIcon));
    onAct = actFn || null;
  }
  backBtn.addEventListener('click', function () { window.__appBack(); });
  actBtn.addEventListener('click', function () { if (onAct) onAct(); });
  window.__appBack = function () {   // also the phone's back button; false = leave the app
    if (document.body.classList.contains('sheet')) {
      if (typeof sheetLock === 'function') sheetLock(); else if (!sheetLock) closeSheet();
      return true;
    }
    var r = route();
    if (r[0] === 'home') return false;
    if (depth > 0) { depth--; history.back(); } else location.replace('#/home');
    return true;
  };
  function route() { return (location.hash.replace(/^#\/?/, '') || 'home').split('/').map(decodeURIComponent); }
  var TABS = [['home', IC.home, 'الرئيسية', 'Home'], ['docs/si', IC.doc, 'الفواتير', 'Invoices'], ['items', IC.box, 'الأصناف', 'Items'],
    ['customers', IC.person, 'العملاء', 'Customers'], ['settings', IC.gear, 'الإعدادات', 'Settings']];
  function drawTabs(cur) {
    tabsEl.textContent = '';
    TABS.forEach(function (t) {
      var b = add(el('button', cur === t[0] || (t[0] === 'docs/si' && cur.indexOf('doc') === 0) ? 'on' : ''), icon(t[1]), el('span', null, L(t[2], t[3])));
      b.addEventListener('click', function () { if (route().join('/') !== t[0]) { depth = 0; location.replace('#/' + t[0]); } });
      tabsEl.appendChild(b);
    });
  }
  function render() {
    closeSheet();
    document.body.classList.remove('login');
    var r = route(), my = ++gen;
    view.textContent = ''; view.scrollTop = 0;
    drawTabs(r.join('/'));
    var alive = function () { return my === gen; };
    if (r[0] !== 'new') dropForm();   // SMACC's hidden page for a new document lives only on that screen
    try {
      if (r[0] === 'new') screenNew(r[1], r[2], alive);
      else if (r[0] === 'docs') screenDocs(r[1] || 'si', alive);
      else if (r[0] === 'doc' && r[2]) screenDoc(r[1], r[2], alive);
      else if (r[0] === 'items') screenItems(alive);
      else if (r[0] === 'customers') screenCustomers(alive);
      else if (r[0] === 'reports') screenReports(alive);
      else if (r[0] === 'settings') screenSettings(alive);
      else screenHome(alive);
    } catch (e) { showError(e); }
  }
  window.addEventListener('hashchange', render);

  function spinner() { return el('div', 'spin'); }
  function smacc(url) {   // SMACC's own screen (the app shows it with a Home button to come back)
    location.href = url;
  }
  function showError(e, retry) {
    if (e && e.auth) { showLogin(); return; }
    view.textContent = '';
    var c = add(el('div', 'center'), el('div', null, L('تعذر الاتصال بـ SMACC', 'Could not reach SMACC')), el('div', 'small', String((e && e.message) || '')));
    var b = el('button', 'btn', L('إعادة المحاولة', 'Try again'));
    b.addEventListener('click', retry || render);
    add(view, add(c, b));
  }
  /* ---------- sign in (the app's own screen) ----------
     The number and password typed here are put into SMACC's own login page, loaded out of sight on the
     same address, and SMACC's own login button is pressed: SMACC does the login exactly as on its page.
     "Remember" hands them to the app, which keeps them encrypted on this phone (Android keystore) and,
     next time, gives them back only to this screen (window.__appFill) to sign in by itself. */
  var signRun = 0, autoWait = 0, lastUser = '';
  function smaccLoginPage() {   // fallback for what the app can't answer itself (a code by SMS, a picture code)
    try { if (APP) APP.expectLogin(); } catch (e) { /* ignore */ }
    location.href = '/Login.aspx';
  }
  function showLogin(msg) {
    gen++;
    closeSheet();
    document.body.classList.add('login');
    setBar('ZOD SMACC', false);
    view.textContent = '';
    var auto = false;
    try { auto = !!(APP && typeof APP.autoFill === 'function' && APP.autoLogin() === 'on' && APP.hasLogin()); } catch (e) { auto = false; }
    var last = Number(sessionStorage.getItem('zodapp|autoTry') || 0);
    if (!msg && auto && Date.now() - last > 60000) {
      sessionStorage.setItem('zodapp|autoTry', String(Date.now()));
      add(view, add(el('div', 'center'), spinner(), el('div', null, L('جارٍ تسجيل الدخول…', 'Signing in…'))));
      var asked = false;
      try { asked = !!APP.autoFill(); } catch (e) { asked = false; }
      if (asked) {
        clearTimeout(autoWait);
        autoWait = setTimeout(function () { loginForm(L('تعذر تسجيل الدخول التلقائي', 'Automatic sign-in did not work')); }, 8000);
        return;
      }
    }
    loginForm(msg);
  }
  window.__appFill = function (u, p) {   // the app hands the saved login back (only to this screen)
    clearTimeout(autoWait);
    if (!document.body.classList.contains('login')) return;
    signIn(String(u || ''), String(p || ''), true, true);
  };
  function loginForm(msg, other) {
    clearTimeout(autoWait);
    document.body.classList.add('login');
    setBar('ZOD SMACC', false);
    view.textContent = '';
    var f = el('form', 'card signin');
    f.setAttribute('autocomplete', 'on');
    var mk = function (type, name, ph, ac) {
      var i = el('input');
      i.type = type; i.name = name; i.placeholder = ph; i.autocomplete = ac;
      i.setAttribute('autocapitalize', 'off'); i.spellcheck = false;
      return i;
    };
    var u = mk('text', 'username', L('رقم الدخول', 'Login ID'), 'username'), p = mk('password', 'password', L('كلمة المرور', 'Password'), 'current-password');
    u.dir = 'ltr'; p.dir = 'ltr';
    try { u.value = lastUser || localStorage.getItem('zodapp|user') || ''; } catch (e) { u.value = lastUser; }
    var eye = el('button', 'eye', L('إظهار', 'Show'));
    eye.type = 'button';
    eye.addEventListener('click', function () { var on = p.type === 'password'; p.type = on ? 'text' : 'password'; eye.textContent = on ? L('إخفاء', 'Hide') : L('إظهار', 'Show'); });
    var err = el('div', 'err', msg || '');
    err.setAttribute('role', 'alert');
    if (!msg) err.style.display = 'none';
    add(f, el('div', 'brand', 'ZOD SMACC'), el('div', 'muted small', L('سجّل الدخول بحساب SMACC', 'Sign in with your SMACC account')),
      el('label', null, L('رقم الدخول', 'Login ID')), u,
      el('label', null, L('كلمة المرور', 'Password')), add(el('div', 'pw'), p, eye), err);
    var remember = null;
    if (APP) {
      var on = true;
      try { on = APP.autoLogin() !== 'off'; } catch (e) { on = true; }
      remember = el('button', 'sw' + (on ? ' on' : ''));
      remember.type = 'button';
      remember.addEventListener('click', function () { remember.classList.toggle('on'); });
      add(f, add(el('div', 'set'), add(el('div', 'grow'), el('div', null, L('تسجيل الدخول تلقائياً', 'Sign in automatically')),
        el('div', 'muted small', L('يُحفظ مشفّراً على هذا الجوال فقط', 'Kept encrypted on this phone only'))), remember));
    }
    var go1 = el('button', 'btn', L('تسجيل الدخول', 'Sign in'));
    go1.type = 'submit';
    f.appendChild(go1);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = latin(u.value).trim();
      if (!user || !p.value) { err.textContent = L('اكتب رقم الدخول وكلمة المرور', 'Type your login ID and password'); err.style.display = ''; return; }
      signIn(user, p.value, false, !!(remember && remember.classList.contains('on')));
    });
    add(view, f);
    if (other) {
      var ob = el('button', 'btn ghost', L('فتح صفحة الدخول في SMACC', 'Open SMACC\'s sign-in page'));
      ob.addEventListener('click', smaccLoginPage);
      view.appendChild(ob);
    }
    setTimeout(function () { (u.value ? p : u).focus(); }, 150);
  }
  function signIn(user, pass, auto, remember) {
    var my = ++signRun, stage = 0, poll = 0, timer = 0;
    if (!auto) lastUser = user;
    gen++;
    view.textContent = '';
    add(view, add(el('div', 'center'), spinner(), el('div', null, L('جارٍ تسجيل الدخول…', 'Signing in…'))));
    var old = document.getElementById('zod-login-frame');
    if (old) old.remove();
    var fr = document.createElement('iframe');
    fr.id = 'zod-login-frame';
    fr.setAttribute('aria-hidden', 'true');
    fr.tabIndex = -1;
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:400px;height:700px;border:0;visibility:hidden;pointer-events:none';
    var drop = function () { try { fr.src = 'about:blank'; } catch (e) { /* ignore */ } fr.remove(); };
    var finish = function (ok, why, other) {
      if (my !== signRun || stage === 9) return;
      stage = 9;
      clearInterval(poll); clearTimeout(timer);
      setTimeout(drop, 0);
      if (!ok) { pass = ''; loginForm(why, other); return; }
      try { localStorage.setItem('zodapp|user', user); } catch (e) { /* ignore */ }
      sessionStorage.removeItem('zodapp|autoTry');
      if (APP && !auto) {
        try { if (remember) APP.signedIn(user, pass); else if (APP.autoLogin() === 'on') APP.setAutoLogin(false); } catch (e) { /* older app */ }
      }
      pass = '';
      render();
    };
    var off = function (w) { try { return w.location.pathname.toLowerCase().indexOf('/login.aspx') < 0 && w.location.href !== 'about:blank'; } catch (e) { return false; } };
    fr.addEventListener('load', function () {
      if (my !== signRun || stage === 9) return;
      var w, d;
      try { w = fr.contentWindow; d = fr.contentDocument; } catch (e) { finish(false, L('تعذر فتح صفحة الدخول', 'Could not open the sign-in page'), true); return; }
      if (!w || !d || w.location.href === 'about:blank') return;
      if (off(w)) { finish(true); return; }   // SMACC moved on from its login page: signed in
      var id = d.getElementById('txtLoginID'), pw = d.getElementById('txtPassword'), btn = d.getElementById('btnLogin');
      if (stage === 0) {
        if (!id || !pw || !btn) { finish(false, L('صفحة الدخول في SMACC تغيّرت', 'SMACC\'s sign-in page has changed'), true); return; }
        stage = 1;
        var set = function (e, v) {
          Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set.call(e, v);
          ['input', 'change'].forEach(function (t) { e.dispatchEvent(new w.Event(t, { bubbles: true })); });
        };
        set(id, user);
        set(pw, pass);
        btn.click();   // SMACC's own button: its check, then its form is sent
        poll = setInterval(function () {
          if (off(fr.contentWindow)) { finish(true); return; }
          var dd = null;
          try { dd = fr.contentDocument; } catch (e) { dd = null; }
          var m = dd && dd.querySelector('.modal.in:not([id*="Loading"])');   // a question from SMACC without leaving the page (code by SMS…)
          if (m) finish(false, (m.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) || L('يطلب SMACC تحققاً إضافياً', 'SMACC asks for an extra check'), true);
        }, 150);
        return;
      }
      // the login page came back: not signed in. Show SMACC's own message.
      var vis = function (e) { if (!e) return false; var s = w.getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden'; };
      var cap = d.getElementById('captchadiv'), modal = d.querySelector('.modal.in:not([id*="Loading"])');
      var lb = d.getElementById('lbMessage'), say = lb && vis(d.getElementById('divErrorMsg')) ? (lb.textContent || '').trim() : '';
      if ((cap && vis(cap)) || modal) {
        finish(false, (say || (modal && (modal.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)) || L('يطلب SMACC تحققاً إضافياً', 'SMACC asks for an extra check')), true);
        return;
      }
      finish(false, say || L('لم يتم تسجيل الدخول. تأكد من رقم الدخول وكلمة المرور', 'Not signed in. Check your login ID and password'), !say);
    });
    timer = setTimeout(function () { finish(false, L('انتهى الوقت، حاول مرة أخرى', 'Timed out, try again'), true); }, 45000);
    fr.src = '/Login.aspx';
    document.body.appendChild(fr);
  }

  /* ---------- sheet ---------- */
  var sheetBody = $('sheet-body');
  function openSheet(build) { sheetBody.textContent = ''; build(sheetBody); sheetBody.scrollTop = 0; document.body.classList.add('sheet'); }
  function closeSheet() { sheetLock = false; document.body.classList.remove('sheet'); }
  $('sheet-bg').addEventListener('click', function () { if (typeof sheetLock === 'function') sheetLock(); else if (!sheetLock) closeSheet(); });
  function kv(p, k, v, isLtr) {
    if (v == null || String(v).trim() === '') return;
    var r = el('div', 'kv'), s = el('span');
    if (v instanceof Node) s.appendChild(v); else if (isLtr) s.appendChild(ltr(String(v))); else s.textContent = String(v);
    add(p, add(r, el('span', null, k), s));
  }

  /* ---------- home ---------- */
  var CH = { sales: '408', sret: '409', pur: '403', pret: '404' };
  function footer(from, to) {
    return post('/Default.aspx/Select_Graph_FooterValues', "{'startDate' : '" + from + "','endDate' : '" + to + "','chartID' : '403,404,408,409'}").then(function (rows) {
      var o = {};
      (Array.isArray(rows) ? rows : []).forEach(function (r) { o[String(r.ChartID)] = r; });
      return o;
    });
  }
  function screenHome(alive) {
    setBar('ZOD SMACC', false, IC.refresh, render);
    var stats = el('div', 'stats');
    var today = dmy(new Date());
    add(stats, spinner());
    add(view, stats);
    footer(today, today).then(function (f) {
      if (!alive()) return;
      stats.textContent = '';
      var s = f[CH.sales] || {}, r = f[CH.sret] || {}, p = f[CH.pur] || {};
      var stat = function (cls, label, value, sub) {
        var d = add(el('div', 'stat ' + cls), el('span', 'muted small', label), add(el('b'), ltr(value)));
        if (sub) d.appendChild(el('span', 'muted small', sub));
        return d;
      };
      add(stats,
        stat('big', L('مبيعات اليوم', 'Sales today'), money(s.Field2), qty(s.Field1) + ' ' + L('فاتورة', 'invoices')),
        stat('', L('مرتجعات اليوم', 'Returns today'), money(r.Field2), qty(r.Field1) + ' ' + L('مستند', 'docs')),
        stat('', L('مشتريات اليوم', 'Purchases today'), money(p.Field2), qty(p.Field1) + ' ' + L('فاتورة', 'invoices')));
    }, function (e) { if (!alive()) return; if (e && e.auth) showLogin(); else stats.textContent = ''; });

    var tiles = el('div', 'tiles');
    var tile = function (ic, ar, en, fn, cls) {
      var b = add(el('button', 'tile' + (cls ? ' ' + cls : '')), add(el('i'), icon(ic)), el('span', null, L(ar, en)));
      b.addEventListener('click', fn);
      return b;
    };
    add(view, el('h2', null, L('القوائم', 'Menu')));
    add(tiles,
      tile(IC.plus, 'فاتورة مبيعات جديدة', 'New sales invoice', function () { go('new/si'); }, 'main'),
      tile(IC.undo, 'مرتجع مبيعات جديد', 'New sales return', function () { go('new/sr'); }),
      tile(IC.doc, 'فواتير المبيعات', 'Sales invoices', function () { go('docs/si'); }),
      tile(IC.undo, 'مرتجعات المبيعات', 'Sales returns', function () { go('docs/sr'); }),
      tile(IC.quote, 'عروض الأسعار', 'Quotations', function () { go('docs/sq'); }),
      tile(IC.cart, 'فواتير المشتريات', 'Purchases', function () { go('docs/pi'); }),
      tile(IC.undo, 'مرتجعات المشتريات', 'Purchase returns', function () { go('docs/pr'); }),
      tile(IC.swap, 'تحويل المخزون', 'Stock transfers', function () { go('docs/st'); }),
      tile(IC.box, 'الأصناف والأسعار', 'Items & prices', function () { go('items'); }),
      tile(IC.person, 'العملاء', 'Customers', function () { go('customers'); }),
      tile(IC.chart, 'التقارير', 'Reports', function () { go('reports'); }));
    add(view, tiles);
  }

  /* ---------- document lists ---------- */
  /* rec: what SMACC adds after 'rowIndex' in <page>/LoadRec (the document's header) for that page;
     det: the call and field name SMACC uses for the document's item lines. Both exactly as SMACC's own
     pages send them when a saved document is opened (seen 23/11/2026, view only). */
  var PAY_S = { 1: ['نقدي', 'Cash'], 2: ['أجل', 'Credit'], 3: ['البنك', 'Bank'], 4: ['الشبكة', 'Card'], 6: ['الدفع عند الاستلام', 'Cash on delivery'], 7: ['الدفع الالكتروني', 'Online payment'] };
  var PAY_P = { 1: ['نقدي', 'Cash'], 2: ['أجل', 'Credit'], 3: ['البنك', 'Bank'] };
  var PAY_R = { 1: ['نقدي', 'Cash'], 2: ['على الحساب', 'On account'] };
  var DOCS = {
    si: { url: '/Inventory/SalesInvoicePage.aspx', no: 'InvoiceNumber', date: 'InvoiceDate', who: 'CustomerName', ar: 'فواتير المبيعات', en: 'Sales invoices', one: ['فاتورة مبيعات', 'Sales invoice'],
      print: '403003', open: true, ret: '/Inventory/SalesReturnPage.aspx', add: '#zod-new', rec: '', det: ['LoadInvoiceDetails', 'orderNumber'], pay: PAY_S, cat: true },
    sr: { url: '/Inventory/SalesReturnPage.aspx', no: 'DocumentNumber', date: 'DocumentDate', who: 'CustomerName', ar: 'مرتجعات المبيعات', en: 'Sales returns', one: ['مرتجع مبيعات', 'Sales return'],
      print: '403004', open: true, ref: 'InvoiceNumber', refKind: 'si', rec: '', det: ['LoadReturnDetails', 'documentNumber'], pay: PAY_R },
    sq: { url: '/Inventory/SalesQuotationPage.aspx', no: 'QuotationNumber', date: 'QuotationDate', who: 'CustomerName', ar: 'عروض الأسعار', en: 'Quotations', one: ['عرض سعر', 'Quotation'],
      rec: ", 'isProcessTypeCall' : 'false', 'warehouseCode' : '', 'salesmanCode' : '', 'quotationDate' : ''", det: ['LoadQuotationDetails', 'key'], cat: true },
    pi: { url: '/Inventory/PurchaseInvoicePage.aspx', no: 'InvoiceNumber', date: 'InvoiceDate', who: 'SupplierName', ar: 'فواتير المشتريات', en: 'Purchase invoices', one: ['فاتورة مشتريات', 'Purchase invoice'],
      open: true, ret: '/Inventory/PurchaseReturnPage.aspx', rec: ", 'invoiceDate' : ''", det: ['LoadInvoiceDetails', 'orderNumber'], pay: PAY_P },
    pr: { url: '/Inventory/PurchaseReturnPage.aspx', no: 'DocumentNumber', date: 'DocumentDate', who: 'SupplierName', ar: 'مرتجعات المشتريات', en: 'Purchase returns', one: ['مرتجع مشتريات', 'Purchase return'],
      open: true, ref: 'InvoiceNumber', refKind: 'pi', rec: '', det: ['LoadReturnDetails', 'documentNumber'], pay: { 1: PAY_R[1] } },
    st: { url: '/Inventory/StockTransferPage.aspx', no: 'DocumentNumber', date: 'DocumentDate', who: '', ar: 'تحويل المخزون', en: 'Stock transfers', one: ['تحويل مخزون', 'Stock transfer'],
      transfer: true, rec: '', det: ['LoadItemDetails', 'key'] }
  };
  var PAGE = 20, DOC_SHAPE = /^[A-Za-z]*-?\d+(-\d+)?$/;
  function screenDocs(kind, alive) {
    if (!DOCS[kind]) kind = 'si';
    var D = DOCS[kind];
    setBar(L(D.ar, D.en), true, IC.plus, function () { go('new/' + kind); });
    var chips = el('div', 'chips');
    Object.keys(DOCS).forEach(function (k) {
      var c = el('button', 'chip' + (DOCS[k] === D ? ' on' : ''), L(DOCS[k].ar, DOCS[k].en));
      c.addEventListener('click', function () { if (DOCS[k] !== D) location.replace('#/docs/' + k); });
      chips.appendChild(c);
    });
    var sbox = el('div', 'search'), inp = el('input');
    inp.type = 'search';
    inp.placeholder = D.who ? L('رقم المستند أو الاسم', 'Document number or name') : L('رقم المستند', 'Document number');
    add(view, add(sbox, inp), chips);
    var list = el('div'), more = el('button', 'btn ghost', L('عرض الأقدم', 'Show older')), info = el('div', 'center small');
    more.style.display = 'none';
    add(view, list, more, info);
    var next = 0, run = 0;

    function card(r) {
      var c = el('button', 'card tap');
      c.style.cssText = 'display:block;width:100%;text-align:start';
      var who = D.transfer ? (String(r.WarehouseNameFrom || '') + ' ← ' + String(r.WarehouseNameTo || '')) : String(r[D.who] || '').trim();
      var amount = D.transfer ? r.GrandAmount : (Number(r.NetAmount) || Number(r.GrandAmount) || 0);
      add(c, add(el('div', 'row'), add(el('div', 'grow clip'), ltr(String(r[D.no] || ''), 'pill')), add(el('div', 'amt'), ltr(money(amount)))),
        el('div', 'clip', who || L('بدون اسم', 'No name')),
        add(el('div', 'row muted small'), ltr(dateOf(r[D.date])), el('span', 'grow clip', D.transfer ? (qty(r.NoOfItems) + ' ' + L('صنف', 'items')) : String(r.WarehouseName || ''))));
      c.addEventListener('click', function () { if (r[D.no]) go('doc/' + kind + '/' + encodeURIComponent(String(r[D.no]))); });
      return c;
    }
    function put(rows) { rows.slice().reverse().forEach(function (r) { list.appendChild(card(r)); }); }
    function fail(e) { if (!alive()) return; if (e && e.auth) { showLogin(); return; } info.textContent = L('تعذر التحميل', 'Could not load') + ' · ' + ((e && e.message) || ''); }
    function latest() {
      var my = ++run;
      list.textContent = ''; info.textContent = ''; more.style.display = 'none';
      list.appendChild(spinner());
      listCall(D.url, '0', '', 1, 1).then(function (first) {
        if (!alive() || my !== run) return null;
        var pages = Math.ceil(first.total / PAGE);
        if (!pages) { list.textContent = ''; info.textContent = L('لا توجد مستندات', 'No documents'); return null; }
        return listCall(D.url, '0', '', PAGE, pages).then(function (r) {
          if (!alive() || my !== run) return;
          list.textContent = '';
          put(r.rows);
          next = pages - 1;
          more.style.display = next > 0 ? '' : 'none';
          if (r.rows.length < 8 && next > 0) older();
        });
      }).catch(fail);
    }
    function older() {
      if (next < 1) return;
      var my = run, p = next;
      next = 0; more.style.display = 'none';
      listCall(D.url, '0', '', PAGE, p).then(function (r) {
        if (!alive() || my !== run) return;
        put(r.rows);
        next = p - 1;
        more.style.display = next > 0 ? '' : 'none';
      }).catch(fail);
    }
    function search(text) {
      var my = ++run;
      list.textContent = ''; info.textContent = ''; more.style.display = 'none';
      list.appendChild(spinner());
      var t = latin(text).trim(), byNo = DOC_SHAPE.test(t) || !D.who;
      listCall(D.url, byNo ? D.no : D.who, byNo ? t.toUpperCase() : t, 50, 1).then(function (r) {
        if (!alive() || my !== run) return;
        list.textContent = '';
        put(r.rows);
        if (!r.rows.length) info.textContent = L('لا توجد نتائج', 'No results');
        else if (r.total > r.rows.length) info.textContent = L('أول ', 'First ') + r.rows.length + L(' من ', ' of ') + r.total;
      }).catch(fail);
    }
    more.addEventListener('click', older);
    var tm = 0;
    inp.addEventListener('input', function () {
      clearTimeout(tm);
      tm = setTimeout(function () { var t = inp.value.trim(); if (t) search(t); else latest(); }, 500);
    });
    latest();
  }
  /* ---------- one document: header, item lines and totals (the app's own screen) ---------- */
  function num(v) { return Number(v) || 0; }
  function screenDoc(kind, no, alive) {
    if (!DOCS[kind]) kind = 'si';
    var D = DOCS[kind], head = null;
    setBar(L(D.one[0], D.one[1]), true, IC.refresh, render);
    var box = el('div');
    add(view, box);
    box.appendChild(spinner());
    post(D.url + '/LoadRec', "{ 'key' : '" + q(no) + "', 'rowIndex' : '0'" + D.rec + "}").then(function (h) {
      if (!h || typeof h !== 'object' || String(h[D.no] || '').toUpperCase() !== no.toUpperCase()) throw new Error(L('المستند غير موجود', 'Document not found'));
      head = h;
      return post(D.url + '/' + D.det[0], "{ '" + D.det[1] + "' : '" + q(no) + "'}");
    }).then(function (lines) {
      if (!alive()) return;
      box.textContent = '';
      drawDoc(box, kind, head, Array.isArray(lines) ? lines : table(lines));
    }).catch(function (e) {
      if (!alive()) return;
      if (e && e.auth) { showLogin(); return; }
      box.textContent = '';
      var c = add(el('div', 'center'), el('div', null, L('تعذر فتح المستند', 'Could not open the document')), el('div', 'small', String((e && e.message) || '')));
      var b = el('button', 'btn', L('إعادة المحاولة', 'Try again'));
      b.addEventListener('click', render);
      add(box, add(c, b));
    });
  }
  function drawDoc(box, kind, h, lines) {
    var D = DOCS[kind], no = String(h[D.no]);
    lines = lines.filter(function (x) { return x && (x.ItemCode || x.ItemName); })
      .sort(function (a, b) { return num(a.SerialNumber) - num(b.SerialNumber); });
    var lineTotal = function (x) { return num(x.NetAmount) || num(x.GrandAmount) || num(x.Amount); };
    var net = D.transfer ? (num(h.GrandAmount) || lines.reduce(function (s, x) { return s + lineTotal(x); }, 0)) : num(h.NetAmount);

    var top = el('div', 'card');
    add(top, add(el('div', 'row'), add(el('div', 'grow clip'), ltr(no, 'pill')), add(el('div', 'amt'), ltr(money(net)))));
    if (D.cat && (h.TaxCategoryCode === '1' || h.TaxCategoryCode === '2' || h.TaxCategoryCode === 1 || h.TaxCategoryCode === 2)) {
      top.appendChild(el('div', 'muted small', String(h.TaxCategoryCode) === '1' ? L('فاتورة ضريبية', 'Tax invoice') : L('فاتورة مبسطة', 'Simplified invoice')));
    }
    kv(top, L('التاريخ', 'Date'), dateOf(h[D.date]), true);
    if (kind === 'sq') kv(top, L('صالح حتى', 'Valid until'), dateOf(h.QuotationDateValidUpto), true);
    if (D.who) {
      var name = String(h[D.who] || '').trim();
      if (name && D.who === 'CustomerName' && h.CustomerCode) {
        var a = el('a', null, name);
        a.href = 'javascript:void 0';
        a.addEventListener('click', function () { custSheet({ CustomerCode: h.CustomerCode, CustomerName: name }); });
        kv(top, L('العميل', 'Customer'), a);
      } else kv(top, D.who === 'SupplierName' ? L('المورد', 'Supplier') : L('العميل', 'Customer'), name);
      kv(top, L('الرقم الضريبي', 'VAT number'), h.BuyerVATNumber || h.CustomerVAT || h.VATNumber, true);
      if (D.who === 'CustomerName') kv(top, h.BuyerIDText || L('السجل التجاري / الهوية', 'CR / ID'), h.BuyerIDValue, true);
      if (h.Phone1) { var ph = el('a'); ph.href = 'tel:' + String(h.Phone1).replace(/[^\d+]/g, ''); ph.appendChild(ltr(String(h.Phone1))); kv(top, L('الجوال', 'Phone'), ph); }
    }
    if (D.transfer) { kv(top, L('من', 'From'), h.WarehouseNameFrom); kv(top, L('إلى', 'To'), h.WarehouseNameTo); }
    else kv(top, L('الفرع', 'Branch'), h.WarehouseName);
    kv(top, L('البائع', 'Salesman'), h.SalesmanName);
    var pay = D.pay && D.pay[h.PaymentType];
    if (pay) kv(top, L('طريقة الدفع', 'Payment'), L(pay[0], pay[1]));
    if (D.ref && h[D.ref]) {
      var ra = el('a');
      ra.href = 'javascript:void 0';
      ra.appendChild(ltr(String(h[D.ref])));
      ra.addEventListener('click', function () { go('doc/' + D.refKind + '/' + encodeURIComponent(String(h[D.ref]))); });
      kv(top, L('الفاتورة الأصلية', 'Original invoice'), ra);
    }
    kv(top, L('رقم المرجع', 'Reference'), h.ReferenceNumber, true);
    kv(top, L('ملاحظات', 'Notes'), h.Instructions);
    kv(top, L('أعدّه', 'Prepared by'), String(h.PreparedBy || '').replace(/\s+/g, ' ').trim());
    add(box, top);

    add(box, el('h2', null, L('الأصناف', 'Items') + ' (' + lines.length + ')'));
    var lc = el('div', 'card lines');
    if (!lines.length) lc.appendChild(el('div', 'muted small', L('لا توجد أصناف', 'No items')));
    lines.forEach(function (x) {
      var unit = String(x.UnitName || '').trim();
      var sub = add(el('div', 'row muted small'), ltr(String(x.ItemCode || '')), el('span', 'grow'),
        add(el('span'), ltr(qty(x.Quantity)), document.createTextNode(' '), unit ? el('span', null, unit) : null, document.createTextNode(' × '), ltr(money(x.Price))));
      var extra = [];
      if (num(x.DiscountAmount)) extra.push(L('خصم ', 'Discount ') + money(x.DiscountAmount));
      if (num(x.Tax1Amount)) extra.push(L('ضريبة ', 'VAT ') + money(x.Tax1Amount));
      add(lc, add(el('div', 'line'),
        add(el('div', 'row'), el('div', 'grow', String(x.ItemName || x.ItemCode || '').trim()), add(el('div', 'amt'), ltr(money(lineTotal(x))))),
        sub, extra.length ? el('div', 'muted small', extra.join(' · ')) : null));
    });
    add(box, lc);

    var tc = el('div', 'card');
    if (D.transfer) {
      kv(tc, L('عدد الأصناف', 'Items'), qty(h.TotalItems || h.NoOfItems || lines.length), true);
      kv(tc, L('الكمية', 'Quantity'), qty(h.TotalQuantity), true);
      kv(tc, L('القيمة', 'Value'), money(net), true);
    } else {
      var before = lines.reduce(function (s, x) { return s + (num(x.ItemAmountBeforeDiscount) || num(x.Amount)); }, 0);
      var disc = num(h.ItemDiscountTotal) + num(h.GlobalDiscountAmount);
      var vat = num(h.ItemTax1Total) + num(h.GlobalTax1Amount);
      var noVat = num(h.AmountBeforeTax) || lines.reduce(function (s, x) { return s + (num(x.ItemAmountBeforeTax) || num(x.Amount)); }, 0);
      if (disc) { kv(tc, L('المجموع قبل الخصم', 'Before discount'), money(before), true); kv(tc, L('الخصم', 'Discount'), money(disc), true); }
      kv(tc, L('قبل الضريبة', 'Before VAT'), money(noVat), true);
      kv(tc, L('الضريبة', 'VAT'), money(vat), true);
      kv(tc, L('الصافي', 'Net'), add(el('b'), ltr(money(net))));
      if (num(h.RoundOffDifference) && num(h.RoundOffAmount)) kv(tc, L('بعد التقريب', 'After rounding'), money(h.RoundOffAmount), true);
      if (num(h.AdvanceAmount)) kv(tc, L('المبلغ المقدم', 'Paid in advance'), money(h.AdvanceAmount), true);
    }
    add(box, el('h2', null, L('الإجمالي', 'Totals')), tc);

    var btn = function (cls, text, fn) { var b = el('button', 'btn ' + cls, text); b.addEventListener('click', fn); box.appendChild(b); };
    if (D.print) btn('', L('طباعة / PDF', 'Print / PDF'), function () { printDoc(D.print, no); });
    if (D.ret) btn('ghost', L('عمل مرتجع', 'Make a return'), function () { go('new/' + (kind === 'si' ? 'sr' : 'pr') + '/' + encodeURIComponent(no)); });
    if (D.open) btn('ghost', L('تعديل في SMACC', 'Edit in SMACC'), function () { smacc(D.url + '#zod-open=' + encodeURIComponent(no)); });
  }
  /* Print / PDF: the phone loads SMACC's print in a page the user never sees (SMACC can take up to a
     minute to draw it), then opens Android's print screen. It reports back through __printState. */
  var printBusy = 0;
  window.__printState = function (st) {
    printBusy = 0;
    if (st === 'ready') toast(L('اختر الطابعة أو «حفظ كـ PDF»', 'Pick a printer or "Save as PDF"'));
    else if (st === 'login') { toast(L('انتهت الجلسة، سجّل الدخول ثم اطبع مرة أخرى', 'Signed out: sign in, then print again'), 5000); showLogin(); }
    else toast(L('لم تجهز الطباعة من SMACC، حاول مرة أخرى', 'SMACC did not finish the print, try again'), 5000);
  };
  function printDoc(pageId, no) {
    var path = '/Inventory/PrintReport.aspx?page_id=' + pageId + '&record_number=' + encodeURIComponent(btoa(no));
    if (APP && typeof APP.printPage === 'function') {
      if (printBusy && Date.now() - printBusy < 120000) { toast(L('الطباعة قيد التجهيز… قد تأخذ حتى دقيقة', 'Still preparing the print… up to a minute'), 4000); return; }
      try { APP.printPage(path); printBusy = Date.now(); toast(L('جارٍ تجهيز الطباعة… قد تأخذ حتى دقيقة', 'Preparing the print… up to a minute'), 8000); return; } catch (e) { /* older app: SMACC's page */ }
    }
    smacc(path);
  }

  /* ---------- items: price, cost, stock ---------- */
  function screenItems(alive) {
    setBar(L('الأصناف والأسعار', 'Items & prices'), true);
    var sbox = el('div', 'search'), inp = el('input'), list = el('div'), info = el('div', 'center small', L('اكتب اسم الصنف أو رمزه', 'Type an item name or code'));
    inp.type = 'search'; inp.placeholder = L('اسم الصنف أو الرمز', 'Item name or code');
    add(view, add(sbox, inp), list, info);
    var run = 0, tm = 0;
    function search(t) {
      var my = ++run;
      list.textContent = ''; info.textContent = '';
      list.appendChild(spinner());
      ws('AutoCompleteSmartCodeNameSearch', "{'codeOrName':'" + btoa(encodeURIComponent(t)) + "','isExact':'False','itemType':'1', 'onlyBaseItemCode':'False'," +
        "'isSizeColorParent':'False','isProductionCall':'False','appendSalesPriceAndStock':'true','warehouseCode':'" + q(S.wh || '') + "'}").then(function (d) {
        if (!alive() || my !== run) return;
        list.textContent = '';
        var rows = (Array.isArray(d) ? d : []).map(function (s) {
          var a = String(s).split('<-|->'), n = function (x) { return Number(String(x || '').replace(/^[\s|]+/, '')); };
          return { code: String(a[0] || '').trim(), name: String(a[1] || '').trim(), price: n(a[2]), stock: a.length > 3 ? n(a[3]) : null };
        }).filter(function (x) { return x.code; });
        if (!rows.length) { info.textContent = L('لا توجد أصناف', 'No items found'); return; }
        rows.slice(0, 60).forEach(function (it) {
          var c = el('button', 'card tap');
          c.style.cssText = 'display:block;width:100%;text-align:start';
          add(c, add(el('div', 'row'), el('div', 'grow', it.name), add(el('div', 'amt'), ltr(money(it.price)))),
            add(el('div', 'row muted small'), ltr(it.code), el('span', 'grow'),
              it.stock == null || !S.wh ? null : add(el('span', 'pill ' + (it.stock > 0 ? 'ok' : it.stock < 0 ? 'bad' : 'zero')), ltr(qty(it.stock)))));
          c.addEventListener('click', function () { itemSheet(it); });
          list.appendChild(c);
        });
        if (rows.length > 60) info.textContent = L('أول 60 صنف، اكتب أكثر للتحديد', 'First 60 items; type more to narrow down');
      }).catch(function (e) { if (!alive() || my !== run) return; if (e && e.auth) showLogin(); else { list.textContent = ''; info.textContent = L('تعذر البحث', 'Search failed'); } });
    }
    inp.addEventListener('input', function () {
      clearTimeout(tm);
      var t = latin(inp.value).trim();
      if (t.length < 2) { run++; list.textContent = ''; info.textContent = L('اكتب اسم الصنف أو رمزه', 'Type an item name or code'); return; }
      tm = setTimeout(function () { search(t); }, 450);
    });
    setTimeout(function () { inp.focus(); }, 100);
  }
  function itemSheet(it) {
    openSheet(function (p) {
      add(p, el('h3', null, it.name), add(el('div', 'muted small'), ltr(it.code)));
      var c = el('div', 'card'), st = el('div', 'card');
      c.appendChild(spinner());
      add(p, c, el('h2', null, L('المخزون في كل فرع', 'Stock in each branch')), st);
      var code = "'" + q(it.code) + "'";
      ws('SelectItemCardUnitString', "{ 'itemCode' : " + code + ",'unitType' : '1' }").then(function (o) {
        var u = table(o)[0] || {};
        c.textContent = '';
        var prices = String(u.PriceChannelDetails || '').split(';').map(function (x) { return x.split('|'); }).filter(function (a) { return a.length >= 3; });
        var retail = it.price;
        prices.forEach(function (a) { if (a[0] === '1') retail = Number(a[2]); });
        kv(c, L('الوحدة', 'Unit'), u.UnitName);
        prices.forEach(function (a) { kv(c, a[1], money(a[2]), true); });
        if (!prices.length) kv(c, L('السعر', 'Price'), money(it.price), true);
        kv(c, L('سعر التجزئة مع الضريبة 15%', 'Retail with 15% VAT'), money(retail * 1.15), true);
        var cost = Number(u.AverageCost) || Number(u.CostPrice) || 0;
        kv(c, L('التكلفة', 'Cost'), money(cost), true);
        if (cost && retail < cost) c.appendChild(el('div', 'pill bad', L('السعر أقل من التكلفة', 'Price is below cost')));
      }).catch(function () { c.textContent = L('تعذر تحميل السعر', 'Could not load the price'); }).then(function () {
        return ws('SelectItemCardCurrentStockInAllWarehouses', "{ 'itemCode' : " + code + "}");
      }).then(function (rows) {
        st.textContent = '';
        var total = 0;
        (Array.isArray(rows) ? rows : table(rows)).forEach(function (r) {
          var n = Number(r.CurrentQuantity) || 0;
          total += n;
          kv(st, String(r.WarehouseName || r.WarehouseCode || ''), add(el('span', 'pill ' + (n > 0 ? 'ok' : n < 0 ? 'bad' : 'zero')), ltr(qty(n))));
        });
        kv(st, L('المجموع', 'Total'), qty(total), true);
      }).catch(function () { st.textContent = L('تعذر تحميل المخزون', 'Could not load stock'); });
    });
  }

  /* ---------- customers ---------- */
  var CUST = '/Inventory/CustomersPage.aspx';
  function screenCustomers(alive) {
    setBar(L('العملاء', 'Customers'), true);
    var sbox = el('div', 'search'), inp = el('input'), list = el('div'), info = el('div', 'center small', L('اكتب اسم العميل أو رمزه', 'Type a customer name or code'));
    inp.type = 'search'; inp.placeholder = L('اسم العميل أو الرمز', 'Customer name or code');
    add(view, add(sbox, inp), list, info);
    var run = 0, tm = 0;
    function search(t) {
      var my = ++run, byCode = /^\d{1,6}$/.test(t);
      list.textContent = ''; info.textContent = '';
      list.appendChild(spinner());
      listCall(CUST, byCode ? 'CustomerCode' : 'CustomerName', t, 40, 1).then(function (r) {
        if (!alive() || my !== run) return;
        list.textContent = '';
        if (!r.rows.length) { info.textContent = L('لا يوجد عملاء', 'No customers found'); return; }
        r.rows.forEach(function (x) {
          var c = el('button', 'card tap');
          c.style.cssText = 'display:block;width:100%;text-align:start';
          add(c, add(el('div', 'row'), el('div', 'grow', String(x.CustomerName || '').trim()), ltr(String(x.CustomerCode || ''), 'pill')),
            x.Phone1 ? add(el('div', 'muted small'), ltr(String(x.Phone1))) : null);
          c.addEventListener('click', function () { custSheet(x); });
          list.appendChild(c);
        });
        if (r.total > r.rows.length) info.textContent = L('أول ', 'First ') + r.rows.length + L(' من ', ' of ') + r.total;
      }).catch(function (e) { if (!alive() || my !== run) return; if (e && e.auth) showLogin(); else { list.textContent = ''; info.textContent = L('تعذر البحث', 'Search failed'); } });
    }
    inp.addEventListener('input', function () {
      clearTimeout(tm);
      var t = latin(inp.value).trim();
      if (!t) { run++; list.textContent = ''; info.textContent = L('اكتب اسم العميل أو رمزه', 'Type a customer name or code'); return; }
      tm = setTimeout(function () { search(t); }, 500);
    });
    setTimeout(function () { inp.focus(); }, 100);
  }
  function custSheet(x) {
    openSheet(function (p) {
      add(p, el('h3', null, String(x.CustomerName || '').trim()));
      var c = el('div', 'card');
      c.appendChild(spinner());
      add(p, c);
      var nb = el('button', 'btn', L('فاتورة جديدة لهذا العميل', 'New invoice for this customer'));
      nb.addEventListener('click', function () { closeSheet(); go('new/si/' + encodeURIComponent(x.CustomerCode)); });
      var inv = el('button', 'btn ghost', L('فواتير العميل', 'This customer\'s invoices'));
      inv.addEventListener('click', function () { closeSheet(); sessionStorage.setItem('zodapp|find', String(x.CustomerName || '').trim()); go('docs/si'); });
      add(p, nb, inv);
      post(CUST + '/LoadRec', "{ 'key' : '" + q(x.CustomerCode) + "'}").then(function (o) {
        o = o || {};
        c.textContent = '';
        kv(c, L('الرمز', 'Code'), o.CustomerCode || x.CustomerCode, true);
        [o.Phone1, o.Phone2].forEach(function (ph) {
          if (!ph) return;
          var a = el('a'); a.href = 'tel:' + String(ph).replace(/[^\d+]/g, ''); a.appendChild(ltr(String(ph)));
          kv(c, L('الجوال', 'Phone'), a);
        });
        kv(c, L('الرقم الضريبي', 'VAT number'), o.VATNumber, true);
        kv(c, L('السجل التجاري / الهوية', 'CR / ID'), o.BuyerIDValue || o.CCRNumber, true);
        kv(c, L('الرصيد الحالي', 'Current balance'), money(o.CurrentBalance), true);
        if (Number(o.CreditLimit)) kv(c, L('حد الائتمان', 'Credit limit'), money(o.CreditLimit), true);
        if (Number(o.CreditDays)) kv(c, L('أيام الائتمان', 'Credit days'), o.CreditDays, true);
        kv(c, L('المدينة', 'City'), [o.City, o.District, o.StreetName].filter(Boolean).join(' · '));
        kv(c, L('البائع', 'Salesman'), o.SalesmanName);
        if (o.StopDealing) c.appendChild(el('div', 'pill bad', L('موقوف التعامل', 'Dealing stopped')));
      }).catch(function () { c.textContent = L('تعذر تحميل بيانات العميل', 'Could not load the customer'); });
    });
  }

  /* ---------- reports: sales, returns and purchases for a period ---------- */
  function screenReports(alive) {
    setBar(L('التقارير', 'Reports'), true);
    var now = new Date(), d0 = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return d; };
    var RANGES = [['اليوم', 'Today', now, now], ['أمس', 'Yesterday', d0(1), d0(1)], ['7 أيام', '7 days', d0(6), now], ['30 يوماً', '30 days', d0(29), now],
      ['هذا الشهر', 'This month', new Date(now.getFullYear(), now.getMonth(), 1), now]];
    var chips = el('div', 'chips'), body = el('div'), cur = 2, run = 0;
    RANGES.forEach(function (r, i) {
      var c = el('button', 'chip' + (i === cur ? ' on' : ''), L(r[0], r[1]));
      c.addEventListener('click', function () { cur = i; Array.prototype.forEach.call(chips.children, function (x, j) { x.classList.toggle('on', j === i); }); load(); });
      chips.appendChild(c);
    });
    add(view, chips, body);
    function load() {
      var my = ++run, from = dmy(RANGES[cur][2]), to = dmy(RANGES[cur][3]);
      body.textContent = '';
      body.appendChild(spinner());
      var f;
      footer(from, to).then(function (x) {
        f = x;
        return post('/Default.aspx/GetChartData', "{ 'startDate' : '" + from + "','endDate' : '" + to + "','chartID' : '408','IsAmountType' : 'true'}");
      }).then(function (chart) {
        if (!alive() || my !== run) return;
        body.textContent = '';
        add(body, add(el('div', 'muted small'), ltr(from === to ? from : from + ' – ' + to)));
        var s = f[CH.sales] || {}, r = f[CH.sret] || {}, p = f[CH.pur] || {}, pr = f[CH.pret] || {};
        var block = function (title, rows) {
          var c = el('div', 'card');
          rows.forEach(function (x) { kv(c, x[0], x[1], true); });
          add(body, el('h2', null, title), c);
        };
        block(L('المبيعات', 'Sales'), [[L('عدد الفواتير', 'Invoices'), qty(s.Field1)], [L('إجمالي المبيعات', 'Total sales'), money(s.Field2)],
          [L('مبيعات نقدية', 'Cash sales'), money(s.Field3)], [L('مبيعات آجلة', 'Credit sales'), money(s.Field4)],
          [L('صافي بعد المرتجعات', 'Net after returns'), money((Number(s.Field2) || 0) - (Number(r.Field2) || 0))]]);
        var pts = (Array.isArray(chart) ? chart : []).filter(function (x) { return String(x.ChartID) === '408'; });
        if (pts.length > 1 && pts.length <= 31) {
          var max = Math.max.apply(null, pts.map(function (x) { return Number(x.Amount) || 0; })) || 1, bars = el('div', 'bars');
          pts.forEach(function (x) {
            var u = el('u'); u.style.height = Math.round((Number(x.Amount) || 0) / max * 100) + '%';
            bars.appendChild(add(el('div'), u, pts.length <= 10 ? ltr(String(x.Date).slice(0, 5)) : null));
          });
          add(body, el('h2', null, L('المبيعات اليومية', 'Sales by day')), add(el('div', 'card'), bars));
        }
        block(L('مرتجعات المبيعات', 'Sales returns'), [[L('عدد المستندات', 'Documents'), qty(r.Field1)], [L('مبلغ المرتجعات', 'Returned amount'), money(r.Field2)]]);
        block(L('المشتريات', 'Purchases'), [[L('عدد الفواتير', 'Invoices'), qty(p.Field1)], [L('إجمالي المشتريات', 'Total purchases'), money(p.Field2)],
          [L('مرتجعات المشتريات', 'Purchase returns'), money(pr.Field2)]]);
      }).catch(function (e) { if (!alive() || my !== run) return; if (e && e.auth) showLogin(); else { body.textContent = ''; add(body, el('div', 'center', L('تعذر تحميل التقرير', 'Could not load the report'))); } });
    }
    load();
  }

  /* ---------- settings ---------- */
  function screenSettings(alive) {
    setBar(L('الإعدادات', 'Settings'), true);
    var row = function (card, label, control, sub) {
      var l = add(el('div', 'grow'), el('div', null, label));
      if (sub) l.appendChild(el('div', 'muted small', sub));
      card.appendChild(add(el('div', 'set'), l, control));
    };
    var sw = function (on, fn) { var b = el('button', 'sw' + (on ? ' on' : '')); b.addEventListener('click', function () { var v = !b.classList.contains('on'); b.classList.toggle('on', v); fn(v); }); return b; };
    var sel = function (opts, val, fn) {
      var s = el('select');
      opts.forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; s.appendChild(x); });
      s.value = val;
      s.addEventListener('change', function () { fn(s.value); });
      return s;
    };

    var look = el('div', 'card');
    row(look, L('اللغة', 'Language'), sel([['ar', 'العربية'], ['en', 'English']], S.lang, function (v) { S.lang = v; saveS(); applyS(); render(); }));
    var dots = el('div', 'dots');
    ['#1565c0', '#2e7d32', '#c62828', '#6a1b9a', '#00838f', '#37474f'].forEach(function (c) {
      var b = el('button', c === S.acc ? 'on' : ''); b.style.background = c;
      b.addEventListener('click', function () { S.acc = c; saveS(); applyS(); render(); });
      dots.appendChild(b);
    });
    row(look, L('اللون', 'Colour'), dots);
    row(look, L('الوضع الداكن', 'Dark mode'), sw(S.dark, function (v) { S.dark = v; saveS(); applyS(); }));
    row(look, L('حجم الخط', 'Text size'), sel([['13', L('صغير', 'Small')], ['15', L('عادي', 'Normal')], ['17', L('كبير', 'Large')], ['19', L('أكبر', 'Larger')]], String(S.fs), function (v) { S.fs = Number(v); saveS(); applyS(); }));
    add(view, el('h2', null, L('المظهر', 'Look')), look);

    var work = el('div', 'card'), whSel = sel([['', L('كل الفروع', 'All branches')]], '', function (v) { S.wh = v; saveS(); });
    row(work, L('فرع البحث عن الأصناف', 'Branch for item search'), whSel, L('يظهر مخزون هذا الفرع بجانب كل صنف', 'Shows this branch\'s stock next to each item'));
    add(view, el('h2', null, L('العمل', 'Work')), work);
    ws('AutoCompleteSearchCodeName', "{'table':'INV_WarehouseNames','key':'','isExact':'False','subSupport':'0','optionalParam':''}").then(function (d) {
      if (!alive()) return;
      (Array.isArray(d) ? d : []).forEach(function (s) {
        var a = String(s).split('<-|->'), o = el('option', null, a[1] || a[0]); o.value = a[0]; whSel.appendChild(o);
      });
      whSel.value = S.wh || '';
    }).catch(function () { /* the list stays "all branches" */ });

    if (APP) {
      var acc = el('div', 'card'), has = false, on = false;
      try { has = !!APP.hasLogin(); on = APP.autoLogin() === 'on'; } catch (e) { /* older app */ }
      row(acc, L('تسجيل الدخول تلقائياً', 'Sign in automatically'), sw(on, function (v) { try { APP.setAutoLogin(v); } catch (e) { /* ignore */ }
        if (v && !has) toast(L('سيُحفظ الدخول بعد تسجيل دخولك القادم', 'Your login will be saved the next time you sign in')); }),
        has ? L('بيانات الدخول محفوظة مشفّرة على هذا الجوال فقط', 'Your login is saved, encrypted, on this phone only')
          : L('تُحفظ بيانات الدخول مشفّرة على هذا الجوال بعد أول تسجيل دخول', 'Saved, encrypted, on this phone after your next sign-in'));
      var forget = el('button', 'pill bad', L('حذف', 'Forget'));
      forget.addEventListener('click', function () { try { APP.forgetLogin(); } catch (e) { /* ignore */ } toast(L('حُذفت بيانات الدخول المحفوظة', 'Saved login removed')); render(); });
      if (has) row(acc, L('بيانات الدخول المحفوظة', 'Saved login'), forget);
      add(view, el('h2', null, L('الحساب', 'Account')), acc);

      var adv = el('div', 'card'), rec = false;
      try { rec = !!APP.recording(); } catch (e) { rec = false; }
      row(adv, L('تسجيل لـ Claude', 'Record for Claude'), sw(rec, function (v) { try { APP.setRecording(v); } catch (e) { /* ignore */ } }),
        L('يسجّل طلبات SMACC في ملف لتطوير التطبيق', 'Saves SMACC\'s requests to a file, to develop the app'));
      var full = el('button', 'pill', L('فتح', 'Open'));
      full.addEventListener('click', function () { smacc('/Default.aspx?type=1&showwizard=false'); });
      row(adv, L('موقع SMACC الكامل', 'Full SMACC site'), full);
      add(view, el('h2', null, L('متقدم', 'Advanced')), adv);
      var ver = '';
      try { ver = APP.version(); } catch (e) { ver = ''; }
      add(view, el('div', 'center small', 'ZOD SMACC ' + ver));
    }
  }

  /* ---------- making documents: sales invoice, quotation, purchase, stock transfer, returns ----------
     The app's own screens put the document together. SMACC's own "new" page for it is opened out of sight
     (form.js) as soon as the screen opens; "Review" has SMACC fill it in (its lookups, prices, stock check,
     VAT and totals) and the review shows SMACC's own figures; "Save" presses SMACC's own Save button. */
  var PAY_SI = [['1', 'نقدي', 'Cash'], ['2', 'أجل', 'Credit'], ['3', 'البنك', 'Bank'], ['4', 'الشبكة', 'Card'], ['6', 'الدفع عند الاستلام', 'Cash on delivery'], ['7', 'الدفع الالكتروني', 'Online payment']];
  var PAY_PI = [['1', 'نقدي', 'Cash'], ['2', 'أجل', 'Credit'], ['3', 'البنك', 'Bank']];
  var MAKE = {
    si: { ar: 'فاتورة مبيعات جديدة', en: 'New sales invoice', who: 'cust', sm: true, pay: PAY_SI, cat: true, notes: true, vat: true },
    sq: { ar: 'عرض سعر جديد', en: 'New quotation', who: 'cust', sm: true, cat: true, notes: true, vat: true },
    pi: { ar: 'فاتورة مشتريات جديدة', en: 'New purchase invoice', who: 'sup', pay: PAY_PI, ref: true, notes: true, vat: true, cost: true },
    st: { ar: 'تحويل مخزون جديد', en: 'New stock transfer', transfer: true, ref: true, cost: true },
    sr: { ar: 'مرتجع مبيعات جديد', en: 'New sales return', ret: 'si' },
    pr: { ar: 'مرتجع مشتريات جديد', en: 'New purchase return', ret: 'pi' }
  };
  var LISTS = {};
  function codeList(tbl, sub) {   // SMACC's full lists, the same call its boxes make when opened empty
    if (!LISTS[tbl]) {
      LISTS[tbl] = ws('AutoCompleteSearchCodeName', "{'table':'" + tbl + "','key':'','isExact':'False','subSupport':'" + sub + "','optionalParam':''}").then(function (d) {
        return (Array.isArray(d) ? d : []).map(function (s) { var a = String(s).split('<-|->'); return { code: String(a[0] || '').trim(), name: String(a[1] || '').trim() }; })
          .filter(function (x) { return x.code; });
      });
      LISTS[tbl].catch(function () { delete LISTS[tbl]; });
    }
    return LISTS[tbl];
  }
  var mk = null;   // SMACC's page for the document being made: { kind, F }
  function formFor(kind) {
    if (!window.ZodForm) return null;
    if (mk && mk.kind === kind && !mk.F.closed && !mk.F.lost && !mk.F.auth && !mk.F.broken && !mk.F.savedAt) return mk.F;
    dropForm();
    try { mk = { kind: kind, F: window.ZodForm.open(kind) }; } catch (e) { mk = null; return null; }
    var F = mk.F;
    F.ready.catch(function () { F.broken = true; });
    return F;
  }
  function dropForm() {   // a page still saving, or just saved, is closed only once SMACC has finished its own steps
    if (!mk) return;
    var F = mk.F, t0 = Date.now();
    mk = null;
    (function later() {
      if (F.saving && Date.now() - t0 < 200000) { setTimeout(later, 1000); return; }
      var wait = F.savedAt ? Math.max(0, 8000 - (Date.now() - F.savedAt)) : 0;
      setTimeout(function () { try { F.close(); } catch (e) { /* ignore */ } }, wait);
    })();
  }
  function freshNew(kind) { var h = '#/new/' + kind; if (location.hash === h) render(); else location.replace(h); }
  function draftKey(kind) { return 'zodapp|draft|' + kind; }
  function loadDraft(kind) { try { return JSON.parse(localStorage.getItem(draftKey(kind)) || 'null'); } catch (e) { return null; } }
  function saveDraft(dr) { try { localStorage.setItem(draftKey(dr.kind), JSON.stringify(dr)); } catch (e) { /* ignore */ } }
  function lastOf(kind) { try { return JSON.parse(localStorage.getItem('zodapp|last|' + kind) || '{}') || {}; } catch (e) { return {}; } }
  function field(label, input) { return add(el('label', 'fld'), el('span', null, label), input); }
  function selectEl(opts, val) {
    var s = el('select');
    opts.forEach(function (o) { var x = el('option', null, o[1]); x.value = o[0]; s.appendChild(x); });
    s.value = val;
    if (s.value !== String(val) && opts.length) s.value = opts[0][0];
    return s;
  }
  function pickRow(label, value, sub, fn) {
    var r = add(el('div', 'kv tap'), el('span', null, label), add(el('span'), document.createTextNode(value || L('اختر…', 'Choose…')), sub ? add(el('div', 'muted small'), ltr(sub)) : null));
    r.addEventListener('click', fn);
    return r;
  }
  function stepper(val, max, onChange) {
    var s = el('div', 'step'), minus = el('button', null, '−'), plus = el('button', null, '+'), v = el('b');
    v.appendChild(ltr(qty(val)));
    minus.disabled = val <= 0; plus.disabled = max != null && val >= max;
    minus.addEventListener('click', function (e) { e.stopPropagation(); onChange(Math.max(0, val - 1)); });
    plus.addEventListener('click', function (e) { e.stopPropagation(); onChange(max != null ? Math.min(max, val + 1) : val + 1); });
    return add(s, minus, v, plus);
  }
  function note(cls, text) { return el('div', 'note ' + cls, text); }
  function numIn(v, ph) { var i = el('input'); i.type = 'text'; i.inputMode = 'decimal'; i.dir = 'ltr'; i.value = v == null ? '' : String(v); if (ph) i.placeholder = ph; return i; }
  function readNum(i) { var t = latin(i.value).replace(/,/g, '').trim(); return t === '' ? null : Number(t); }
  /* while SMACC works on the document the sheet can't be swiped away: false = free, true = wait,
     a function = what the phone's back button / a tap outside does instead */
  var sheetLock = false;

  function pickCustomer(done) {
    openSheet(function (p) {
      var inp = el('input'), list = el('div'), info = el('div', 'center small');
      inp.type = 'search'; inp.className = 'sinput'; inp.placeholder = L('اسم العميل أو رمزه', 'Customer name or code');
      var cash = el('button', 'card tap', L('نقدي (عميل بدون اسم)', 'Cash (walk-in customer)'));
      cash.style.cssText = 'display:block;width:100%;text-align:start';
      cash.addEventListener('click', function () { closeSheet(); done({ code: '2', name: 'نقدي', vat: '' }); });
      add(p, el('h3', null, L('العميل', 'Customer')), inp, cash, list, info);
      var run = 0, tm = 0;
      inp.addEventListener('input', function () {
        clearTimeout(tm);
        var t = latin(inp.value).trim();
        if (!t) { run++; list.textContent = ''; return; }
        tm = setTimeout(function () {
          var my = ++run, byCode = /^\d{1,6}$/.test(t);
          list.textContent = ''; info.textContent = ''; list.appendChild(spinner());
          listCall(CUST, byCode ? 'CustomerCode' : 'CustomerName', t, 30, 1).then(function (r) {
            if (my !== run) return;
            list.textContent = '';
            if (!r.rows.length) info.textContent = L('لا يوجد عملاء', 'No customers found');
            r.rows.forEach(function (x) {
              var c = el('button', 'card tap');
              c.style.cssText = 'display:block;width:100%;text-align:start';
              add(c, add(el('div', 'row'), el('div', 'grow', String(x.CustomerName || '').trim()), ltr(String(x.CustomerCode || ''), 'pill')),
                x.Phone1 ? add(el('div', 'muted small'), ltr(String(x.Phone1))) : null);
              c.addEventListener('click', function () {
                c.disabled = true;
                post(CUST + '/LoadRec', "{ 'key' : '" + q(x.CustomerCode) + "'}").then(function (o) { return o || {}; }, function () { return {}; }).then(function (o) {
                  closeSheet();
                  done({ code: String(x.CustomerCode), name: String(x.CustomerName || o.CustomerName || '').trim(), vat: String(o.VATNumber || '').trim(), stop: !!o.StopDealing });
                });
              });
              list.appendChild(c);
            });
          }).catch(function (e) { if (my !== run) return; list.textContent = ''; if (e && e.auth) { closeSheet(); showLogin(); } else info.textContent = L('تعذر البحث', 'Search failed'); });
        }, 450);
      });
      setTimeout(function () { inp.focus(); }, 150);
    });
  }
  function pickSupplier(done) {
    openSheet(function (p) {
      var inp = el('input'), list = el('div'), info = el('div', 'center small');
      inp.type = 'search'; inp.className = 'sinput'; inp.placeholder = L('اسم المورد أو رمزه', 'Supplier name or code');
      add(p, el('h3', null, L('المورد', 'Supplier')), inp, list, info);
      var run = 0, tm = 0;
      function search(t) {
        var my = ++run;
        list.textContent = ''; info.textContent = ''; list.appendChild(spinner());
        ws('AutoCompleteSearchCodeName', "{'table':'INV_SuppliersNames','key':'" + (t ? btoa(encodeURIComponent(t)) : '') + "','isExact':'False','subSupport':'','optionalParam':''}").then(function (d) {
          if (my !== run) return;
          list.textContent = '';
          var rows = (Array.isArray(d) ? d : []).map(function (s) { var a = String(s).split('<-|->'); return { code: String(a[0] || '').trim(), name: String(a[1] || '').trim() }; }).filter(function (x) { return x.code; });
          if (!rows.length) info.textContent = L('لا يوجد موردون', 'No suppliers found');
          rows.forEach(function (x) {
            var c = el('button', 'card tap');
            c.style.cssText = 'display:block;width:100%;text-align:start';
            add(c, add(el('div', 'row'), el('div', 'grow', x.name), ltr(x.code, 'pill')));
            c.addEventListener('click', function () { closeSheet(); done({ code: x.code, name: x.name, vat: '' }); });
            list.appendChild(c);
          });
        }).catch(function (e) { if (my !== run) return; list.textContent = ''; if (e && e.auth) { closeSheet(); showLogin(); } else info.textContent = L('تعذر البحث', 'Search failed'); });
      }
      inp.addEventListener('input', function () { clearTimeout(tm); var t = latin(inp.value).trim(); tm = setTimeout(function () { search(t); }, 450); });
      search('');
      setTimeout(function () { inp.focus(); }, 150);
    });
  }
  /* items: SMACC's item search with this branch's price and stock; the sheet stays open to add several */
  function pickItems(wh, onPick) {
    openSheet(function (p) {
      var inp = el('input'), list = el('div'), info = el('div', 'center small', L('اكتب اسم الصنف أو رمزه', 'Type an item name or code'));
      inp.type = 'search'; inp.className = 'sinput'; inp.placeholder = L('اسم الصنف أو الرمز', 'Item name or code');
      var done = el('button', 'btn', L('تم', 'Done'));
      done.addEventListener('click', closeSheet);
      add(p, el('h3', null, L('إضافة أصناف', 'Add items')), inp, list, info, done);
      var run = 0, tm = 0;
      function search(t) {
        var my = ++run;
        list.textContent = ''; info.textContent = ''; list.appendChild(spinner());
        ws('AutoCompleteSmartCodeNameSearch', "{'codeOrName':'" + btoa(encodeURIComponent(t)) + "','isExact':'False','itemType':'1', 'onlyBaseItemCode':'False'," +
          "'isSizeColorParent':'False','isProductionCall':'False','appendSalesPriceAndStock':'true','warehouseCode':'" + q(wh || '') + "'}").then(function (d) {
          if (my !== run) return;
          list.textContent = '';
          var rows = (Array.isArray(d) ? d : []).map(function (s) {
            var a = String(s).split('<-|->'), n = function (x) { return Number(String(x || '').replace(/^[\s|]+/, '')); };
            return { code: String(a[0] || '').trim(), name: String(a[1] || '').trim(), price: n(a[2]), stock: a.length > 3 ? n(a[3]) : null };
          }).filter(function (x) { return x.code; });
          if (!rows.length) { info.textContent = L('لا توجد أصناف', 'No items found'); return; }
          rows.slice(0, 40).forEach(function (it) {
            var c = el('button', 'card tap');
            c.style.cssText = 'display:block;width:100%;text-align:start';
            var badge = el('span', 'pill', L('أضيف', 'Added'));
            badge.style.display = 'none';
            add(c, add(el('div', 'row'), el('div', 'grow', it.name), add(el('div', 'amt'), ltr(money(it.price)))),
              add(el('div', 'row muted small'), ltr(it.code), el('span', 'grow'), badge,
                it.stock == null || !wh ? null : add(el('span', 'pill ' + (it.stock > 0 ? 'ok' : it.stock < 0 ? 'bad' : 'zero')), ltr(qty(it.stock)))));
            c.addEventListener('click', function () { var n = onPick(it); badge.textContent = L('أضيف', 'Added') + (n > 1 ? ' ×' + n : ''); badge.style.display = ''; });
            list.appendChild(c);
          });
          if (rows.length > 40) info.textContent = L('أول 40 صنف، اكتب أكثر للتحديد', 'First 40 items; type more to narrow down');
        }).catch(function (e) { if (my !== run) return; list.textContent = ''; if (e && e.auth) { closeSheet(); showLogin(); } else info.textContent = L('تعذر البحث', 'Search failed'); });
      }
      inp.addEventListener('input', function () {
        clearTimeout(tm);
        var t = latin(inp.value).trim();
        if (t.length < 2) { run++; list.textContent = ''; info.textContent = L('اكتب اسم الصنف أو رمزه', 'Type an item name or code'); return; }
        tm = setTimeout(function () { search(t); }, 450);
      });
      setTimeout(function () { inp.focus(); }, 150);
    });
  }

  function screenNew(kind, arg, alive) {
    var M = MAKE[kind];
    if (!M) { location.replace('#/home'); return; }
    if (M.ret) { screenReturn(kind, arg, alive); return; }
    setBar(L(M.ar, M.en), true);
    var last = lastOf(kind), dr = loadDraft(kind);
    if (!dr || !Array.isArray(dr.lines)) {
      dr = { kind: kind, lines: [], sm: last.sm || '', wh: last.wh || S.wh || '', whName: last.whName || '', to: last.to || '', pay: last.pay || '1', cat: '', notes: '', ref: '' };
      if (kind === 'si') dr.cust = { code: '2', name: 'نقدي', vat: '' };
    }
    formFor(kind);   // SMACC's page loads now, while the document is put together
    var whs = [], sms = [];
    function save() { saveDraft(dr); }
    function catOf() { return dr.cat || (dr.cust && dr.cust.vat ? '1' : '2'); }
    function draw() {
      if (!alive()) return;
      var y = view.scrollTop;
      view.textContent = '';
      var h = el('div', 'card');
      if (M.who === 'cust') {
        add(h, pickRow(L('العميل', 'Customer'), dr.cust ? dr.cust.name : '', dr.cust ? dr.cust.code + (dr.cust.vat ? ' · ' + dr.cust.vat : '') : '', function () {
          pickCustomer(function (c) { dr.cust = c; dr.cat = ''; save(); draw(); if (c.stop) toast(L('هذا العميل موقوف التعامل', 'Dealing with this customer is stopped'), 4000); });
        }));
      }
      if (M.who === 'sup') {
        add(h, pickRow(L('المورد', 'Supplier'), dr.sup ? dr.sup.name : '', dr.sup ? dr.sup.code : '', function () {
          pickSupplier(function (s) { dr.sup = s; save(); draw(); });
        }));
      }
      var whOpts = [['', L('اختر…', 'Choose…')]].concat(whs.map(function (x) { return [x.code, x.name]; }));
      var setRow = function (label, control) { h.appendChild(add(el('div', 'set'), add(el('div', 'grow'), el('div', null, label)), control)); };
      var whSel = selectEl(whOpts, dr.wh);
      whSel.addEventListener('change', function () {
        dr.wh = whSel.value;
        var f = whs.filter(function (x) { return x.code === dr.wh; })[0];
        dr.whName = f ? f.name : '';
        save();
      });
      setRow(M.transfer ? L('من فرع', 'From branch') : L('الفرع', 'Branch'), whSel);
      if (M.transfer) {
        var toSel = selectEl(whOpts, dr.to);
        toSel.addEventListener('change', function () { dr.to = toSel.value; save(); });
        setRow(L('إلى فرع', 'To branch'), toSel);
      }
      if (M.sm) {
        var smSel = selectEl([['', L('اختر…', 'Choose…')]].concat(sms.map(function (x) { return [x.code, x.name]; })), dr.sm);
        smSel.addEventListener('change', function () { dr.sm = smSel.value; save(); });
        setRow(L('البائع', 'Salesman'), smSel);
      }
      if (M.pay) {
        var paySel = selectEl(M.pay.map(function (x) { return [x[0], L(x[1], x[2])]; }), dr.pay);
        paySel.addEventListener('change', function () { dr.pay = paySel.value; save(); });
        setRow(L('طريقة الدفع', 'Payment'), paySel);
      }
      if (M.cat) {
        var catSel = selectEl([['1', L('فاتورة ضريبية', 'Tax invoice')], ['2', L('فاتورة مبسطة', 'Simplified invoice')]], catOf());
        catSel.addEventListener('change', function () { dr.cat = catSel.value; save(); });
        setRow(L('نوع الفاتورة', 'Invoice type'), catSel);
      }
      if (M.ref) {
        var ref = el('input'); ref.value = dr.ref || ''; ref.dir = 'ltr';
        ref.addEventListener('input', function () { dr.ref = ref.value; save(); });
        h.appendChild(field(kind === 'pi' ? L('رقم فاتورة المورد', 'Supplier\'s invoice number') : L('رقم المرجع', 'Reference'), ref));
      }
      if (M.notes) {
        var nt = el('textarea'); nt.value = dr.notes || '';
        nt.addEventListener('input', function () { dr.notes = nt.value; save(); });
        h.appendChild(field(L('ملاحظات', 'Notes'), nt));
      }
      add(view, h);

      add(view, el('h2', null, L('الأصناف', 'Items') + ' (' + dr.lines.length + ')'));
      var lc = el('div', 'card lines');
      if (!dr.lines.length) lc.appendChild(el('div', 'muted small', L('لا توجد أصناف بعد', 'No items yet')));
      var est = 0, unknown = false;
      dr.lines.forEach(function (ln, i) {
        // a purchase's price is SMACC's purchase price (shown in the review), not the selling price from the search
        var price = ln.price != null ? ln.price : M.cost ? null : ln.listPrice;
        if (price == null) unknown = true;
        else est += Math.max(0, (Number(price) || 0) * ln.qty - (Number(ln.disc) || 0));
        var line = el('div', 'line' + (ln.err ? ' err' : ''));
        var sub = add(el('div', 'row muted small'), ltr(ln.code), el('span', 'grow'),
          M.transfer ? null : price == null ? el('span', null, L('سعر SMACC', 'SMACC\'s price'))
            : add(el('span'), ltr(money(price)), ln.price != null && ln.price !== ln.listPrice ? document.createTextNode(' ✎') : null));
        add(line, add(el('div', 'row'), el('div', 'grow', ln.name), stepper(ln.qty, null, function (n) {
          if (n <= 0) { dr.lines.splice(i, 1); } else { ln.qty = n; ln.err = ''; }
          save(); draw();
        })), sub);
        if (Number(ln.disc)) line.appendChild(el('div', 'muted small', L('خصم ', 'Discount ') + money(ln.disc)));
        if (ln.stock != null && !M.cost && ln.qty > ln.stock) line.appendChild(el('div', 'pill bad', L('المخزون ', 'Stock ') + qty(ln.stock)));
        if (ln.err) line.appendChild(note('bad', ln.err));
        line.addEventListener('click', function () { editLine(i); });
        lc.appendChild(line);
      });
      add(view, lc);
      var addBtn = el('button', 'btn ghost', '+ ' + L('إضافة صنف', 'Add an item'));
      addBtn.addEventListener('click', function () {
        if (!dr.wh) { toast(L('اختر الفرع أولاً', 'Choose the branch first')); return; }
        pickItems(dr.wh, function (it) {
          var ex = dr.lines.filter(function (l) { return l.code === it.code; })[0];
          if (ex) { ex.qty += 1; ex.err = ''; } else dr.lines.push({ code: it.code, name: it.name, qty: 1, listPrice: it.price, price: null, disc: 0, stock: it.stock });
          save(); draw();
          return ex ? ex.qty : 1;
        });
      });
      add(view, addBtn);
      if (dr.lines.length && !M.transfer && unknown) add(view, el('div', 'muted small', L('يضع SMACC سعر الشراء في المراجعة', 'SMACC puts in the purchase price in the review')));
      if (dr.lines.length && !M.transfer && !unknown) {
        var tc = el('div', 'card');
        if (M.vat) {
          kv(tc, L('قبل الضريبة (تقريبي)', 'Before VAT (estimate)'), money(est), true);
          kv(tc, L('الإجمالي مع الضريبة (تقريبي)', 'Total with VAT (estimate)'), add(el('b'), ltr(money(est * 1.15))));
        } else kv(tc, L('الإجمالي (تقريبي)', 'Total (estimate)'), money(est), true);
        add(view, el('h2', null, L('الإجمالي', 'Totals')), tc, el('div', 'muted small', L('الأسعار والضريبة النهائية يحسبها SMACC في المراجعة', 'SMACC works out the final prices and VAT in the review')));
      }
      var go1 = el('button', 'btn', L('مراجعة وحفظ', 'Review and save'));
      go1.addEventListener('click', function () {
        var miss = !dr.lines.length ? L('أضف صنفاً واحداً على الأقل', 'Add at least one item')
          : M.who === 'cust' && !dr.cust ? L('اختر العميل', 'Choose the customer')
          : M.who === 'sup' && !dr.sup ? L('اختر المورد', 'Choose the supplier')
          : !dr.wh ? L('اختر الفرع', 'Choose the branch')
          : M.transfer && (!dr.to || dr.to === dr.wh) ? L('اختر فرعاً آخر للتحويل إليه', 'Choose another branch to transfer to')
          : M.sm && !dr.sm ? L('اختر البائع', 'Choose the salesman') : '';
        if (miss) { toast(miss, 3000); return; }
        if (!document.body.classList.contains('sheet')) reviewMake(kind, dr, { catOf: catOf, redraw: draw });
      });
      var clr = el('button', 'btn ghost', L('مسح والبدء من جديد', 'Clear and start again')), armed = 0;
      clr.addEventListener('click', function () {   // a second tap clears (no pop-up question)
        if (dr.lines.length && Date.now() - armed > 4000) { armed = Date.now(); clr.textContent = L('اضغط مرة أخرى للمسح', 'Tap again to clear'); return; }
        try { localStorage.removeItem(draftKey(kind)); } catch (e) { /* ignore */ }
        freshNew(kind);
      });
      add(view, go1, clr);
      view.scrollTop = y;
    }
    function editLine(i) {
      var ln = dr.lines[i];
      openSheet(function (p) {
        var qn = numIn(ln.qty), pr = numIn(ln.price != null ? ln.price : '', M.cost ? L('سعر SMACC', 'SMACC\'s price') : money(ln.listPrice)), dc = numIn(ln.disc || '');
        add(p, el('h3', null, ln.name), add(el('div', 'muted small'), ltr(ln.code)),
          field(L('الكمية', 'Quantity'), qn),
          M.transfer ? null : field((M.cost ? L('سعر الشراء قبل الضريبة', 'Purchase price before VAT') : L('السعر قبل الضريبة', 'Price before VAT')) +
            (M.cost ? '' : ' (' + L('فارغ = سعر SMACC', 'empty = SMACC\'s price') + ')'), pr),
          M.transfer ? null : field(L('مبلغ الخصم', 'Discount amount'), dc));
        var withVat = el('div', 'muted small');
        var upd = function () { var v = readNum(pr); v = v == null && !M.cost ? ln.listPrice : v; withVat.textContent = M.vat && v != null ? L('السعر مع الضريبة: ', 'Price with VAT: ') + money(v * 1.15) : ''; };
        if (!M.transfer) { p.appendChild(withVat); pr.addEventListener('input', upd); upd(); }
        var ok = el('button', 'btn', L('حفظ', 'Save')), del = el('button', 'btn ghost', L('حذف الصنف', 'Remove the item'));
        ok.addEventListener('click', function () {
          var n = readNum(qn), v = readNum(pr), dsc = readNum(dc);
          if (!(n > 0)) { toast(L('اكتب كمية صحيحة', 'Type a valid quantity')); return; }
          if (v != null && !(v >= 0)) { toast(L('اكتب سعراً صحيحاً', 'Type a valid price')); return; }
          ln.qty = n; ln.price = v; ln.disc = dsc > 0 ? dsc : 0; ln.err = '';
          save(); closeSheet(); draw();
        });
        del.addEventListener('click', function () { dr.lines.splice(i, 1); save(); closeSheet(); draw(); });
        add(p, ok, del);
      });
    }
    view.appendChild(spinner());
    var lists = [codeList('INV_WarehouseNames', '0').then(function (a) { whs = a; }, function () { whs = []; })];
    if (M.sm) lists.push(codeList('INV_SalesmanNames', '').then(function (a) { sms = a; }, function () { sms = []; }));
    var custLoad = null;
    if (arg && M.who === 'cust') {
      custLoad = post(CUST + '/LoadRec', "{ 'key' : '" + q(arg) + "'}").then(function (o) {
        if (o && o.CustomerCode) { dr.cust = { code: String(o.CustomerCode), name: String(o.CustomerName || '').trim(), vat: String(o.VATNumber || '').trim() }; dr.cat = ''; save(); }
      }, function () { /* keep the draft's customer */ });
      lists.push(custLoad);
    }
    Promise.all(lists).then(function () {
      if (dr.wh && !dr.whName) { var f = whs.filter(function (x) { return x.code === dr.wh; })[0]; if (f) dr.whName = f.name; }
      draw();
    });
  }

  /* the review: SMACC fills in its page and works everything out; nothing is saved until "Save" */
  function busySheet(p, text, onCancel) {
    p.textContent = '';
    var line = el('div', 'muted small', '');
    add(p, add(el('div', 'center'), spinner(), el('div', null, text), line));
    sheetLock = onCancel || true;
    if (onCancel) {
      var c = el('button', 'btn ghost', L('إلغاء', 'Cancel'));
      c.addEventListener('click', onCancel);
      p.appendChild(c);
    }
    return line;
  }
  function failSheet(p, msg, back) {
    sheetLock = false;
    p.textContent = '';
    add(p, el('h3', null, L('لم يكتمل', 'Not finished')), note('bad', msg || L('حدث خطأ', 'Something went wrong')));
    var b = el('button', 'btn', L('رجوع', 'Back'));
    b.addEventListener('click', function () { closeSheet(); if (back) back(); });
    p.appendChild(b);
  }
  function headSteps(kind, dr, cat) {
    if (kind === 'si' || kind === 'sq') {
      var s = [{ sel: '#cpBulk_cpForm_SalesmanCode', val: dr.sm, op: 'blur' }, { sel: '#cpBulk_cpForm_CustomerCode', val: dr.cust.code, op: 'blur' },
        { sel: '#cpBulk_cpForm_WarehouseCode', val: dr.wh, op: 'blur' }];
      if (kind === 'si') s.push({ sel: '#PaymentType', val: dr.pay, op: 'change' });
      s.push({ sel: '#cpBulk_cpForm_TaxCategoryCode', val: cat, op: 'change' });
      if (dr.notes) s.push({ sel: '#cpBulk_cpForm_Instructions', val: dr.notes, op: 'type' });
      return s;
    }
    if (kind === 'pi') {
      var t = [{ sel: '#cpBulk_cpForm_SupplierCode', val: dr.sup.code, op: 'blur' }, { sel: '#cpBulk_cpForm_WarehouseName', val: dr.whName, op: 'blur' },
        { sel: '#PaymentType', val: dr.pay, op: 'change' }];
      if (dr.ref) t.push({ sel: '#cpBulk_cpForm_ReferenceNumber', val: dr.ref, op: 'type' });
      if (dr.notes) t.push({ sel: '#cpBulk_cpForm_Instructions', val: dr.notes, op: 'type' });
      return t;
    }
    var u = [{ sel: '#cpBulk_cpForm_WarehouseCodeFrom', val: dr.wh, op: 'blur' }, { sel: '#cpBulk_cpForm_WarehouseCodeTo', val: dr.to, op: 'blur' }];
    if (dr.ref) u.push({ sel: '#cpBulk_cpForm_ReferenceNumber', val: dr.ref, op: 'type' });
    return u;
  }
  function readHead(kind, F) {   // what SMACC put in its header boxes
    var rows = [], bad = [];
    var need = function (label, v) { v = String(v || '').trim(); rows.push([label, v]); if (!v) bad.push(label); };
    if (kind === 'si' || kind === 'sq') {
      need(L('العميل', 'Customer'), F.val('#cpBulk_cpForm_CustomerName'));
      need(L('الفرع', 'Branch'), F.val('#cpBulk_cpForm_WarehouseName'));
      need(L('البائع', 'Salesman'), F.val('#cpBulk_cpForm_SalesmanName'));
      if (kind === 'si') rows.push([L('طريقة الدفع', 'Payment'), F.text('#PaymentType')]);
      rows.push([L('نوع الفاتورة', 'Invoice type'), F.text('#cpBulk_cpForm_TaxCategoryCode')]);
    } else if (kind === 'pi') {
      need(L('المورد', 'Supplier'), F.val('#cpBulk_cpForm_SupplierName'));
      rows.push([L('الرقم الضريبي', 'VAT number'), F.val('#cpBulk_cpForm_VATNumber')]);
      need(L('الفرع', 'Branch'), F.val('#cpBulk_cpForm_WarehouseName'));
      rows.push([L('طريقة الدفع', 'Payment'), F.text('#PaymentType')]);
      rows.push([L('رقم فاتورة المورد', 'Supplier\'s invoice'), F.val('#cpBulk_cpForm_ReferenceNumber')]);
    } else {
      need(L('من فرع', 'From'), F.val('#cpBulk_cpForm_WarehouseNameFrom'));
      need(L('إلى فرع', 'To'), F.val('#cpBulk_cpForm_WarehouseNameTo'));
      rows.push([L('رقم المرجع', 'Reference'), F.val('#cpBulk_cpForm_ReferenceNumber')]);
    }
    return { rows: rows, bad: bad, warn: [] };
  }
  function notesBack(F, notes, head) {   // the notes as SMACC holds them (some pages may have no notes box)
    if (!String(notes || '').trim()) return;
    var v = String(F.val('#cpBulk_cpForm_Instructions') || '').trim();
    if (v) head.rows.push([L('ملاحظات', 'Notes'), v]);
    else head.warn.push(L('لم يقبل SMACC الملاحظات في هذه الشاشة، لن تُحفظ', 'SMACC did not take the notes on this screen; they won\'t be saved'));
  }
  function reviewMake(kind, dr, o) {
    var F = formFor(kind);
    if (!F) { toast(L('حدّث التطبيق: هذه الشاشة تحتاج إصداراً أحدث', 'Update the app: this screen needs a newer version'), 4000); return; }
    var back = function () { F.cancel().catch(function () { /* ignore */ }); o.redraw(); };
    var stopped = false;
    openSheet(function (p) {
      var line = busySheet(p, L('SMACC يجهّز المستند…', 'SMACC is preparing the document…'), function () {
        stopped = true; closeSheet(); back();   // stops after the item SMACC is on; nothing was saved
      });
      (async function () {
        line.textContent = L('فتح صفحة SMACC…', 'Opening SMACC\'s page…');
        await F.start();
        if (stopped) return;
        line.textContent = L('البيانات الأساسية…', 'Header…');
        await F.fill(headSteps(kind, dr, o.catOf()));
        var head = readHead(kind, F), fails = 0, notes = [];
        notesBack(F, dr.notes, head);
        for (var i = 0; i < dr.lines.length; i++) {
          if (stopped) return;
          var ln = dr.lines[i];
          line.textContent = L('الصنف ', 'Item ') + (i + 1) + L(' من ', ' of ') + dr.lines.length + ' · ' + ln.name;
          var r = await F.item({ code: ln.code, qty: ln.qty, price: ln.price, disc: ln.disc });
          ln.err = r.ok ? '' : (r.msg || L('لم يقبله SMACC', 'SMACC did not accept it'));
          if (!r.ok) fails++;
          else {
            if (r.priceLocked) notes.push(ln.name + ': ' + L('SMACC لا يسمح بتغيير السعر، استُخدم سعره', 'SMACC does not allow changing the price; its price is used'));
            if (r.note) notes.push(ln.name + ': ' + r.note);
          }
          if (r.stock != null) ln.stock = r.stock;
        }
        if (stopped) return;
        saveDraft(dr);
        head.warn = head.warn.concat(notes);
        showReview(p, kind, dr, F, head, fails, back);
      })().catch(function (e) {
        if (stopped) return;
        if (e && e.auth) { closeSheet(); showLogin(); return; }
        failSheet(p, L('تعذر تجهيز المستند في SMACC: ', 'SMACC could not prepare the document: ') + ((e && e.message) || ''), back);
      });
    });
  }
  function totalsCard(kind, tot, lines) {
    var tc = el('div', 'card');
    if (MAKE[kind].transfer) {
      kv(tc, L('عدد الأصناف', 'Items'), qty(tot.count != null ? tot.count : lines.length), true);
      kv(tc, L('الكمية', 'Quantity'), qty(tot.qty != null ? tot.qty : lines.reduce(function (s, x) { return s + x.qty; }, 0)), true);
      if (tot.grand != null) kv(tc, L('القيمة', 'Value'), money(tot.grand), true);
      return tc;
    }
    var net = tot.net != null ? tot.net : tot.grand;
    if (tot.disc) kv(tc, L('الخصم', 'Discount'), money(tot.disc), true);
    if (tot.vat != null) kv(tc, L('قبل الضريبة', 'Before VAT'), money((net || 0) - tot.vat), true);
    if (tot.vat != null) kv(tc, L('الضريبة', 'VAT'), money(tot.vat), true);
    kv(tc, L('الصافي', 'Net'), add(el('b'), ltr(money(net))));
    if (tot.rounded != null && Math.abs(tot.rounded - net) > 0.001) kv(tc, L('بعد التقريب', 'After rounding'), money(tot.rounded), true);
    if (tot.toPay != null && Math.abs(tot.toPay - net) > 0.001) kv(tc, L('المطلوب دفعه', 'To pay'), money(tot.toPay), true);
    return tc;
  }
  function linesCard(kind, lines) {
    var lc = el('div', 'card lines');
    lines.forEach(function (x) {
      var extra = [];
      if (x.disc) extra.push(L('خصم ', 'Discount ') + money(x.disc));
      if (x.vat) extra.push(L('ضريبة ', 'VAT ') + money(x.vat));
      var total = x.total || (MAKE[kind].transfer ? x.price * x.qty : 0);
      add(lc, add(el('div', 'line'),
        add(el('div', 'row'), el('div', 'grow', x.name || x.code), add(el('div', 'amt'), ltr(money(total)))),
        add(el('div', 'row muted small'), ltr(x.code), el('span', 'grow'),
          add(el('span'), ltr(qty(x.qty)), document.createTextNode(' '), x.unit ? el('span', null, x.unit) : null, document.createTextNode(' × '), ltr(money(x.price)))),
        extra.length ? el('div', 'muted small', extra.join(' · ')) : null));
    });
    return lc;
  }
  function showReview(p, kind, dr, F, head, fails, back) {
    sheetLock = false;
    p.textContent = '';
    var lines = F.lines(), tot = F.totals(), D = DOCS[kind];
    add(p, el('h3', null, L('مراجعة ', 'Review: ') + L(D.one[0], D.one[1])), el('div', 'muted small', L('هذه أرقام SMACC نفسها. لم يُحفظ شيء بعد.', 'These are SMACC\'s own figures. Nothing is saved yet.')));
    var problems = [];
    head.bad.forEach(function (b) { problems.push(L('لم يقبل SMACC: ', 'SMACC did not accept: ') + b); });
    if (fails) problems.push(L('أصناف لم يقبلها SMACC: ', 'Items SMACC did not accept: ') + fails + L(' (انظر الأسباب في الشاشة)', ' (reasons on the screen)'));
    if (!lines.length) problems.push(L('لا توجد أصناف في SMACC', 'No items in SMACC'));
    if (!fails && lines.length !== dr.lines.length) problems.push(L('عدد الأصناف في SMACC لا يطابق', 'SMACC has a different number of items'));
    var hc = el('div', 'card');
    head.rows.forEach(function (r) { kv(hc, r[0], r[1] || '—'); });
    add(p, hc);
    if (problems.length) p.appendChild(note('bad', problems.join('\n')));
    if (head.warn && head.warn.length) p.appendChild(note('warn', head.warn.join('\n')));
    add(p, el('h2', null, L('الأصناف', 'Items') + ' (' + lines.length + ')'), linesCard(kind, lines), el('h2', null, L('الإجمالي', 'Totals')), totalsCard(kind, tot, lines));
    var row = el('div', 'row2');
    var sv = el('button', 'btn', L('حفظ في SMACC', 'Save in SMACC')), bk = el('button', 'btn ghost', L('رجوع للتعديل', 'Back to edit'));
    if (problems.length) { sv.disabled = true; sv.style.opacity = '.45'; }
    bk.addEventListener('click', function () { closeSheet(); back(); });
    sv.addEventListener('click', function () { if (!problems.length) saveMade(p, kind, F, dr, tot, back); });
    add(p, add(row, bk, sv));
  }
  function saveMade(p, kind, F, dr, tot, back) {
    var saving = L('جارٍ الحفظ في SMACC…', 'Saving in SMACC…'), wait = L('لا تغلق التطبيق', 'Don\'t close the app');
    busySheet(p, saving).textContent = wait;
    Promise.resolve().then(function () {
      return F.save(function (qn, answer) {   // SMACC asks something in its own window: same question, same buttons
        sheetLock = true;
        p.textContent = '';
        add(p, el('h3', null, qn.title || 'SMACC'), note('warn', qn.text || ''));
        qn.buttons.forEach(function (b, i) {
          var x = el('button', i ? 'btn ghost' : 'btn', b);
          x.addEventListener('click', function () { busySheet(p, saving).textContent = wait; answer(i); });
          p.appendChild(x);
        });
      });
    }).catch(function (e) {
      return { ok: false, auth: !!(e && e.auth), unsure: false, msg: (e && e.message) || '' };
    }).then(function (r) {
      sheetLock = false;
      if (r.ok) { savedSheet(p, kind, r, dr, tot); return; }
      if (r.auth) { closeSheet(); dropForm(); showLogin(L('انتهت الجلسة. افتح القائمة وتأكد هل حُفظ المستند قبل الحفظ مرة أخرى.', 'Signed out. Open the list and check whether it was saved before saving again.')); return; }
      p.textContent = '';
      if (r.unsure) {
        dropForm();
        sheetLock = function () { closeSheet(); go('docs/' + kind); };
        add(p, el('h3', null, L('غير مؤكد', 'Not sure')), note('warn', L('لم يصل رد واضح من SMACC. افتح القائمة وتأكد هل حُفظ المستند قبل أن تحاول مرة أخرى.', 'SMACC gave no clear answer. Open the list and check whether it was saved before you try again.') + (r.msg ? '\n' + r.msg : '')));
        var lb = el('button', 'btn', L('فتح القائمة', 'Open the list'));
        lb.addEventListener('click', sheetLock);
        p.appendChild(lb);
        return;
      }
      add(p, el('h3', null, L('لم يُحفظ', 'Not saved')), note('bad', r.msg || r.notes || L('لم يحفظ SMACC المستند', 'SMACC did not save it')));
      var b = el('button', 'btn', L('رجوع للتعديل', 'Back to edit'));
      b.addEventListener('click', function () { closeSheet(); back(); });
      p.appendChild(b);
    });
  }
  function savedSheet(p, kind, r, dr, tot) {
    var D = DOCS[kind], no = r.no;
    try { localStorage.removeItem(draftKey(kind)); } catch (e) { /* ignore */ }
    try {
      if (dr && !MAKE[kind].ret) localStorage.setItem('zodapp|last|' + kind, JSON.stringify({ sm: dr.sm, wh: dr.wh, whName: dr.whName, to: dr.to, pay: dr.pay }));
    } catch (e) { /* ignore */ }
    // the screen under this sheet still shows what was just saved: leaving the sheet always starts a new one
    var leave = function (then) { return function () { closeSheet(); dropForm(); then(); }; };
    var again = leave(function () { freshNew(kind); });
    sheetLock = again;
    p.textContent = '';
    add(p, el('div', 'done-mark', '✓'), add(el('h3', 'center-t'), document.createTextNode(L('تم الحفظ: ', 'Saved: ')), ltr(no || '')));
    if (tot) { var net = tot.net != null ? tot.net : tot.grand; if (net != null) p.appendChild(add(el('div', 'center-t amt'), ltr(money(tot.rounded != null ? tot.rounded : net)))); }
    var warn = String(r.notes || '').split('\n').filter(function (t) { return t && !/تم الحفظ|بنجاح|success/i.test(t); }).join('\n');
    if (warn) p.appendChild(note('warn', warn));
    if (r.offline) p.appendChild(note('warn', L('حفظه SMACC بدون إرسال فوري للهيئة', 'SMACC saved it without sending it to ZATCA right away')));
    if (D.print && no) { var pb = el('button', 'btn', L('طباعة / PDF', 'Print / PDF')); pb.addEventListener('click', function () { printDoc(D.print, no); }); p.appendChild(pb); }
    if (no) { var ob = el('button', 'btn ghost', L('فتح المستند', 'Open it')); ob.addEventListener('click', leave(function () { go('doc/' + kind + '/' + encodeURIComponent(no)); })); p.appendChild(ob); }
    var nb = el('button', 'btn ghost', L('مستند جديد', 'New one'));
    nb.addEventListener('click', again);
    p.appendChild(nb);
  }

  /* returns: the invoice is loaded by SMACC's own search (only what is left to return), then quantities */
  function screenReturn(kind, arg, alive) {
    var M = MAKE[kind];
    setBar(L(M.ar, M.en), true);
    var F = formFor(kind);
    if (!arg) {
      var c = el('div', 'card'), inp = el('input');
      inp.dir = 'ltr'; inp.placeholder = kind === 'sr' ? 'INV-110000' : '0002-1000';
      try { inp.value = sessionStorage.getItem('zodapp|retno|' + kind) || ''; } catch (e) { /* ignore */ }
      var b = el('button', 'btn', L('تحميل الفاتورة', 'Load the invoice'));
      var goNo = function () {
        var no = latin(inp.value).trim().toUpperCase();
        if (!no) { toast(L('اكتب رقم الفاتورة', 'Type the invoice number')); return; }
        try { sessionStorage.setItem('zodapp|retno|' + kind, no); } catch (e) { /* ignore */ }
        location.replace('#/new/' + kind + '/' + encodeURIComponent(no));
      };
      b.addEventListener('click', goNo);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') goNo(); });
      add(c, field(L('رقم الفاتورة الأصلية', 'Original invoice number'), inp), b);
      add(view, c, el('div', 'muted small', L('أو افتح الفاتورة من القائمة واضغط «عمل مرتجع».', 'Or open the invoice from the list and tap "Make a return".')));
      setTimeout(function () { inp.focus(); }, 150);
      return;
    }
    if (!F) { add(view, note('bad', L('حدّث التطبيق: هذه الشاشة تحتاج إصداراً أحدث', 'Update the app: this screen needs a newer version'))); return; }
    var box = el('div');
    add(view, box);
    add(box, add(el('div', 'center'), spinner(), el('div', null, L('SMACC يحمّل الفاتورة ', 'SMACC is loading invoice ') + arg + '…')));
    F.start().then(function () { return F.loadInvoice(arg); }).then(function (r) {
      if (!alive()) return;
      box.textContent = '';
      if (!r.ok) {
        add(box, note('bad', (r.msg || L('لم تُحمَّل أصناف الفاتورة', 'The invoice\'s items did not load')) +
          (kind === 'sr' ? '\n' + L('تأكد من الرقم. لا يسمح SMACC بإرجاع فاتورة لم تُرسل بعد إلى هيئة الزكاة (غالباً فواتير اليوم)، ولا فاتورة أُرجعت بالكامل.',
            'Check the number. SMACC does not allow a return for an invoice not yet sent to ZATCA (often today\'s invoices), or one returned in full.') : '')));
        var ob = el('button', 'btn ghost', L('رقم آخر', 'Another number'));
        ob.addEventListener('click', function () { location.replace('#/new/' + kind); });
        box.appendChild(ob);
        return;
      }
      drawReturn(box, kind, arg, r, F, alive);
    }).catch(function (e) {
      if (!alive()) return;
      if (e && e.auth) { showLogin(); return; }
      box.textContent = '';
      add(box, note('bad', L('تعذر فتح صفحة المرتجع في SMACC: ', 'Could not open SMACC\'s return page: ') + ((e && e.message) || '')));
      var rb = el('button', 'btn', L('إعادة المحاولة', 'Try again'));
      rb.addEventListener('click', function () { dropForm(); render(); });
      box.appendChild(rb);
    });
  }
  function drawReturn(box, kind, no, r, F, alive) {
    var M = MAKE[kind], h = r.head;
    var qs = r.lines.map(function (l) { return l.avail > 0 ? l.avail : 0; });
    var reasons = (h.reasons || []).filter(function (o) { return o[0] && o[0] !== '0'; });
    var st = { reason: reasons.some(function (o) { return o[0] === '4'; }) ? '4' : (reasons[0] ? reasons[0][0] : ''), pay: h.pay, notes: '' };
    function draw() {
      if (!alive()) return;
      var y = view.scrollTop;
      box.textContent = '';
      var top = el('div', 'card');
      var a = add(el('span', 'link'), ltr(no));
      a.addEventListener('click', function () { go('doc/' + M.ret + '/' + encodeURIComponent(no)); });
      kv(top, L('الفاتورة', 'Invoice'), a);
      kv(top, kind === 'sr' ? L('العميل', 'Customer') : L('المورد', 'Supplier'), kind === 'sr' ? h.customer : h.supplier);
      kv(top, L('الرقم الضريبي', 'VAT number'), h.vat, true);
      kv(top, L('الفرع', 'Branch'), h.branch);
      kv(top, L('التاريخ', 'Date'), h.date, true);
      if (reasons.length) {
        var rs = selectEl(reasons, st.reason);
        rs.addEventListener('change', function () { st.reason = rs.value; });
        top.appendChild(field(L('سبب الإرجاع', 'Reason'), rs));
      }
      if ((h.payOptions || []).length) {
        var ps = selectEl(h.payOptions, st.pay);
        ps.addEventListener('change', function () { st.pay = ps.value; });
        top.appendChild(field(L('طريقة الدفع', 'Payment'), ps));
      }
      var nt = el('textarea'); nt.value = st.notes;
      nt.addEventListener('input', function () { st.notes = nt.value; });
      top.appendChild(field(L('ملاحظات', 'Notes'), nt));
      add(box, top);
      var allBtn = el('button', 'chip', L('إرجاع الكل', 'Return all')), noneBtn = el('button', 'chip', L('لا شيء', 'None'));
      allBtn.addEventListener('click', function () { qs = r.lines.map(function (l) { return l.avail > 0 ? l.avail : 0; }); draw(); });
      noneBtn.addEventListener('click', function () { qs = r.lines.map(function () { return 0; }); draw(); });
      add(box, add(el('div', 'row'), el('h2', 'grow', L('الأصناف', 'Items') + ' (' + r.lines.length + ')'), noneBtn, allBtn));
      var lc = el('div', 'card lines');
      r.lines.forEach(function (l, i) {
        var line = el('div', 'line');
        add(line, add(el('div', 'row'), el('div', 'grow', l.name || l.code),
          l.avail > 0 ? stepper(qs[i], l.avail, function (n) { qs[i] = n; draw(); }) : el('span', 'pill zero', L('أُرجع بالكامل', 'Fully returned'))),
          add(el('div', 'row muted small'), ltr(l.code), el('span', 'grow'),
            add(el('span'), document.createTextNode(L('المتاح ', 'Left ')), ltr(qty(l.avail || 0)), document.createTextNode(' · '), ltr(money(l.price)))));
        lc.appendChild(line);
      });
      add(box, lc);
      var go1 = el('button', 'btn', L('مراجعة وحفظ', 'Review and save'));
      go1.addEventListener('click', function () {
        if (!qs.some(function (x) { return x > 0; })) { toast(L('اختر كمية صنف واحد على الأقل', 'Choose a quantity for at least one item')); return; }
        if (!document.body.classList.contains('sheet')) reviewReturn(kind, F, qs, st, draw);
      });
      add(box, go1);
      view.scrollTop = y;
    }
    draw();
  }
  function reviewReturn(kind, F, qs, st, redraw) {
    openSheet(function (p) {
      var line = busySheet(p, L('SMACC يحسب المرتجع…', 'SMACC is working out the return…'));
      (async function () {
        var steps = [];
        if (st.reason) steps.push({ sel: '#cpBulk_cpForm_ReturnReason', val: st.reason, op: 'change' });
        if (st.pay) steps.push({ sel: '#PaymentType', val: st.pay, op: 'change' });
        if (st.notes) steps.push({ sel: '#cpBulk_cpForm_Instructions', val: st.notes, op: 'type' });
        await F.fill(steps);
        line.textContent = L('الكميات…', 'Quantities…');
        var lines = await F.setReturn(qs);
        var bad = [];
        lines.forEach(function (l, i) { if (Math.abs(l.qty - (qs[i] || 0)) > 0.00001) bad.push((l.name || l.code) + ': ' + qty(l.qty) + L(' بدل ', ' instead of ') + qty(qs[i] || 0)); });
        var used = lines.filter(function (l) { return l.qty > 0; });
        var head = { rows: [[L('سبب الإرجاع', 'Reason'), F.text('#cpBulk_cpForm_ReturnReason')], [L('طريقة الدفع', 'Payment'), F.text('#PaymentType')]].filter(function (x) { return x[1]; }), bad: [], warn: [] };
        notesBack(F, st.notes, head);
        if (bad.length) head.bad.push(L('كميات غيّرها SMACC: ', 'Quantities SMACC changed: ') + bad.join('، '));
        sheetLock = false;
        p.textContent = '';
        var D = DOCS[kind], tot = F.totals();
        add(p, el('h3', null, L('مراجعة ', 'Review: ') + L(D.one[0], D.one[1])), el('div', 'muted small', L('هذه أرقام SMACC نفسها. لم يُحفظ شيء بعد.', 'These are SMACC\'s own figures. Nothing is saved yet.')));
        var hc = el('div', 'card');
        head.rows.forEach(function (r) { kv(hc, r[0], r[1]); });
        if (head.rows.length) p.appendChild(hc);
        if (head.bad.length) p.appendChild(note('bad', head.bad.join('\n')));
        if (head.warn.length) p.appendChild(note('warn', head.warn.join('\n')));
        add(p, el('h2', null, L('الأصناف المرتجعة', 'Items returned') + ' (' + used.length + ')'), linesCard(kind, used), el('h2', null, L('الإجمالي', 'Totals')), totalsCard(kind, tot, used));
        var row = el('div', 'row2'), sv = el('button', 'btn', L('حفظ في SMACC', 'Save in SMACC')), bk = el('button', 'btn ghost', L('رجوع للتعديل', 'Back to edit'));
        if (head.bad.length || !used.length) { sv.disabled = true; sv.style.opacity = '.45'; }
        bk.addEventListener('click', function () { closeSheet(); redraw(); });
        sv.addEventListener('click', function () { if (!sv.disabled) saveMade(p, kind, F, null, tot, redraw); });
        add(p, add(row, bk, sv));
      })().catch(function (e) {
        if (e && e.auth) { closeSheet(); showLogin(); return; }
        failSheet(p, L('تعذر تجهيز المرتجع في SMACC: ', 'SMACC could not prepare the return: ') + ((e && e.message) || ''), redraw);
      });
    });
  }

  /* a customer's invoices: the invoices screen opens with the name already searched */
  var docs0 = screenDocs;
  screenDocs = function (kind, alive) {
    docs0(kind, alive);
    var f = sessionStorage.getItem('zodapp|find');
    if (!f) return;
    sessionStorage.removeItem('zodapp|find');
    var inp = view.querySelector('.search input');
    if (inp) { inp.value = f; inp.dispatchEvent(new Event('input')); }
  };

  /* keep the SMACC login alive while the app is on screen */
  setInterval(function () { if (!document.hidden) post('/Webservices/CommonWebService.asmx/GetSmaccDate', '').catch(function () {}); }, 4 * 60 * 1000);

  applyS();
  if (!location.hash) history.replaceState(null, '', '#/home');
  render();
})();
