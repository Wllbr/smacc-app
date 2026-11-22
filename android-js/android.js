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
