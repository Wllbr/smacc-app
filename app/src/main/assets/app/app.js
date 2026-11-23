/* ZOD SMACC - the app's own screens. Served by the app at https://<your smacc host>/zod-app/, so the
   calls below go to SMACC with the phone's own login, exactly as SMACC's pages make them.
   Everything here only READS from SMACC (and signs in). Creating or editing a document still opens
   SMACC's own screen: saving is only built from a recording of SMACC doing that exact save. */
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
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2600); }
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
    if (document.body.classList.contains('sheet')) { closeSheet(); return true; }
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
    try {
      if (r[0] === 'docs') screenDocs(r[1] || 'si', alive);
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
  function closeSheet() { document.body.classList.remove('sheet'); }
  $('sheet-bg').addEventListener('click', closeSheet);
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
      tile(IC.plus, 'فاتورة مبيعات جديدة', 'New sales invoice', function () { smacc('/Inventory/SalesInvoicePage.aspx#zod-new'); }, 'main'),
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
    setBar(L(D.ar, D.en), true, IC.plus, function () { smacc(D.url + (D.add || '')); });
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
    if (D.ret) btn('ghost', L('عمل مرتجع (شاشة SMACC)', 'Make a return (SMACC screen)'), function () { smacc(D.ret + '#zod-return=' + encodeURIComponent(no)); });
    if (D.open) btn('ghost', L('تعديل في SMACC', 'Edit in SMACC'), function () { smacc(D.url + '#zod-open=' + encodeURIComponent(no)); });
  }
  /* SMACC's own print of the document (the same address SMACC's print button opens). In the app it is
     loaded out of sight and goes straight to Android's print / save-as-PDF screen. */
  function printDoc(pageId, no) {
    var path = '/Inventory/PrintReport.aspx?page_id=' + pageId + '&record_number=' + encodeURIComponent(btoa(no));
    if (APP && typeof APP.printPage === 'function') {
      try { APP.printPage(path); toast(L('جارٍ تجهيز الطباعة…', 'Preparing the print…')); return; } catch (e) { /* older app: SMACC's page */ }
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
      nb.addEventListener('click', function () { smacc('/Inventory/SalesInvoicePage.aspx#zod-new=' + encodeURIComponent(x.CustomerCode)); });
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
