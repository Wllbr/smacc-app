/* Phone-only additions, run before the extension's scripts on every SMACC page in the app.
   - window.print() goes to Android's print / save-as-PDF screen
   - phone layout: a mobile viewport (unless "Desktop site" is on in the app's menu)
   - window.__zodApp: what the app's bottom buttons call (quick search, customers, new invoice) */
var APP = window.ZodAndroid || null;

if (APP) {
  try { window.print = function () { APP.print(); }; } catch (e) { /* ignore */ }
}

function whenRoot(fn) {
  if (document.documentElement) { fn(); return; }
  var mo = new MutationObserver(function () {
    if (document.documentElement) { mo.disconnect(); fn(); }
  });
  mo.observe(document, { childList: true });
}

function addCss(text) {
  whenRoot(function () {
    var s = document.createElement('style');
    s.textContent = text;
    (document.head || document.documentElement).appendChild(s);
  });
}

var DESKTOP = false;
try { DESKTOP = !!(APP && APP.desktop()); } catch (e) { DESKTOP = false; }

if (TOP && !DESKTOP) {
  var addViewport = function () {
    if (!document.head || document.querySelector('meta[name="viewport"]')) return !!document.head;
    var m = document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width, initial-scale=1';
    document.head.insertBefore(m, document.head.firstChild);
    return true;
  };
  whenRoot(function () {
    if (addViewport()) return;
    var mo = new MutationObserver(function () { if (addViewport()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true });
  });
}

if (TOP) {
  window.__zodApp = {
    quick: function () {
      var b = document.querySelector('.zod-fab:not(.zod-fab-cust)');
      if (!b) return false;
      b.click();
      return true;
    },
    cust: function () {
      var b = document.querySelector('.zod-fab-cust');
      if (!b) return false;
      b.click();
      return true;
    },
    newInvoice: function () {
      if (/\/Inventory\/SalesInvoicePage\.aspx$/i.test(location.pathname) && window.__zodFast && document.body) {
        document.body.dispatchEvent(new KeyboardEvent('keydown',
          { key: 'F2', code: 'F2', keyCode: 113, which: 113, bubbles: true, cancelable: true }));
        return true;
      }
      location.href = '/Inventory/SalesInvoicePage.aspx#zod-new';
      return true;
    },
    closePanels: function () {   // the phone's back button closes an open search first
      var p = document.querySelector('.zod-jump.zod-jopen');
      if (!p) return false;
      var inp = p.querySelector('input') || p;
      inp.dispatchEvent(new KeyboardEvent('keydown',
        { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
      return true;
    }
  };
}

/* Recorder (More → Record for Claude): while on, every request SMACC's pages make is written to a
   file on the phone, so the calls behind "save invoice", "stock transfer" and reports can be studied.
   Never on the login pages (no password is recorded). */
var REC = false;
try { REC = !!(APP && APP.recording()) && !/login|password/i.test(location.pathname); } catch (e) { REC = false; }
if (REC) {
  var recCut = function (s) { s = s == null ? '' : String(s); return s.length > 30000 ? s.slice(0, 30000) + '…[' + s.length + ']' : s; };
  var recPut = function (o) { try { o.t = Date.now(); o.page = location.pathname; APP.log(JSON.stringify(o)); } catch (e) { /* ignore */ } };
  recPut({ ev: 'page', url: location.href, top: TOP });
  var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send, xh = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (m, u, a) { this.__rec = { ev: 'xhr', m: m, url: String(u), sync: a === false, h: {} }; return xo.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { if (this.__rec) this.__rec.h[k] = String(v); return xh.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    var r = this.__rec, x = this;
    if (r) {
      r.body = typeof body === 'string' ? recCut(body) : (body == null ? '' : '[' + Object.prototype.toString.call(body) + ']');
      var done = function () {
        var txt = '';
        try { txt = x.responseType === '' || x.responseType === 'text' ? x.responseText : '[' + x.responseType + ']'; } catch (e) { txt = ''; }
        r.status = x.status; r.res = recCut(txt); recPut(r);
      };
      if (r.sync) { try { return xs.apply(this, arguments); } finally { done(); } }
      x.addEventListener('loadend', done);
    }
    return xs.apply(this, arguments);
  };
  if (window.fetch) {
    var f0 = window.fetch;
    window.fetch = function (input, init) {
      var r = { ev: 'fetch', m: (init && init.method) || 'GET', url: String(input && input.url ? input.url : input),
        body: init && typeof init.body === 'string' ? recCut(init.body) : '' };
      return f0.apply(this, arguments).then(function (res) {
        r.status = res.status;
        try { res.clone().text().then(function (t) { r.res = recCut(t); recPut(r); }, function () { recPut(r); }); } catch (e) { recPut(r); }
        return res;
      }, function (err) { r.status = -1; recPut(r); throw err; });
    };
  }
  document.addEventListener('submit', function (e) {
    var f = e.target, o = { ev: 'form', action: f && f.action, m: f && f.method, fields: {} };
    try { Array.prototype.forEach.call(f.elements, function (el) { if (el.name && el.type !== 'password') o.fields[el.name] = recCut(el.value).slice(0, 2000); }); } catch (err) { /* ignore */ }
    recPut(o);
  }, true);
}

/* Auto sign-in (Settings in the app). On SMACC's login page only:
   - the number and password you type are handed to the app when you press the login button; the app keeps
     them encrypted on the phone (only if you agree) and never gives them back to any page's scripts
   - when a saved login exists the app fills the two boxes and presses the button itself */
if (TOP && APP && /login/i.test(location.pathname)) {
  var lgVis = function (e) { return !!(e && e.offsetParent !== null && !e.disabled); };
  var lgFields = function () {
    var pws = Array.prototype.filter.call(document.querySelectorAll('input[type=password]'), lgVis);
    if (!pws.length) return null;
    var pw = pws[0], scope = pw.form || document, user = null;
    var ins = Array.prototype.filter.call(scope.querySelectorAll('input'), function (e) { return lgVis(e) && /^(text|tel|email|number)$/.test(e.type); });
    ins.forEach(function (e) { if (e.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING) user = e; });
    return { pw: pw, user: user || ins[0] || null, scope: scope };
  };
  var lgUsed = function () {
    try { var f = lgFields(); if (f && f.user && f.user.value && f.pw.value) APP.loginUsed(String(f.user.value), String(f.pw.value)); } catch (e) { /* ignore */ }
  };
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('button, input[type=submit], input[type=button], a')) lgUsed();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Enter') lgUsed(); }, true);
  document.addEventListener('submit', lgUsed, true);
  window.__zodFill = function (u, p) {
    var f = lgFields();
    if (!f || !f.user) return false;
    var set = function (el, v) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      ['input', 'change', 'blur'].forEach(function (t) { el.dispatchEvent(new Event(t, { bubbles: true })); });
    };
    set(f.user, u);
    set(f.pw, p);
    var c = Array.prototype.filter.call(f.scope.querySelectorAll('input[type=submit], button, input[type=button], a[id*="ogin"], a[class*="btn"]'), lgVis);
    var named = c.filter(function (b) { return /log\s*in|sign\s*in|دخول/i.test((b.id || '') + ' ' + (b.value || '') + ' ' + (b.textContent || '')); });
    var btn = named[0] || c[0] || null;
    setTimeout(function () { if (btn) btn.click(); else if (f.pw.form) f.pw.form.submit(); }, 350);
    return true;
  };
  idle(function () { setTimeout(function () { try { if (lgFields()) APP.loginPage(); } catch (e) { /* ignore */ } }, 500); });
}
