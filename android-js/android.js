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
