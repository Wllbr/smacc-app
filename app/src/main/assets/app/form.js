/* ZOD SMACC - making documents from the app's own screens.

   SMACC's own "new" screen for the document is opened in a page the user never sees (a frame on this same
   address) and the app works it the way a person would:
   - it types into SMACC's boxes with SMACC's own code (jQuery .val().blur() / .change()), so SMACC looks each
     one up itself (salesperson, customer, branch, supplier…);
   - it adds each item through SMACC's own item window (code, quantity, price, discount), where SMACC fills the
     name, price channel, VAT and line total and checks the stock;
   - for a return it types the invoice number and presses SMACC's own search, then sets the quantities;
   - it reads back what SMACC worked out (lines, VAT, totals, SMACC's own messages);
   - only when the user says so, it presses SMACC's own Save button. SMACC builds and sends everything that is
     saved (CollectHeader, CollectGrid, posting, SaveRec) exactly as on its page; nothing here sends a save
     call of its own. SaveRec's answer ("success||<number>") is only read.
   Worked through on SMACC's pages on 23/11/2026 (every step up to Save; Save itself was never pressed). */
window.ZodForm = (function () {
  'use strict';
  var PAGES = {
    si: { page: 'SalesInvoicePage', add: '#cpBulk_cpForm_btnAddNewItem' },
    sq: { page: 'SalesQuotationPage', add: '#cpBulk_cpForm_btnAddNew' },
    pi: { page: 'PurchaseInvoicePage', add: '#cpBulk_cpForm_btnAddNewItem' },
    st: { page: 'StockTransferPage', add: '#cpBulk_cpForm_btnAddNew' },
    sr: { page: 'SalesReturnPage', ret: true },
    pr: { page: 'PurchaseReturnPage', ret: true }
  };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; }
  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  async function waitFor(fn, ms, every) {
    var t = Date.now();
    for (;;) {
      var v = null;
      try { v = fn(); } catch (e) { v = null; }
      if (v) return v;
      if (Date.now() - t > ms) return null;
      await sleep(every || 120);
    }
  }
  function noop() {}
  function stubWindow() {   // what window.open hands back: SMACC's print after a save opens nothing here
    var doc = { write: noop, writeln: noop, open: noop, close: noop };
    return { closed: false, focus: noop, blur: noop, close: noop, print: noop, moveTo: noop, resizeTo: noop,
      addEventListener: noop, document: doc, location: { href: '' } };
  }

  function open(kind) {
    var P = PAGES[kind];
    if (!P) throw new Error('unknown document kind ' + kind);
    var F = { kind: kind, msgs: [], saveCalls: [], auth: false, closed: false, lost: false, onLost: null };
    var fr = document.createElement('iframe'), w = null, d = null, $ = null, loads = 0, hold = 0;
    fr.name = 'zod-app-form';
    fr.setAttribute('aria-hidden', 'true');
    fr.tabIndex = -1;
    // off screen but laid out and focusable, like a real page (SMACC checks :visible and moves the cursor)
    fr.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;height:800px;border:0;opacity:0;pointer-events:none';

    function vis(e) { return !!(e && e.offsetParent); }
    function firstVisible(sel, root) {
      var a = (root || d).querySelectorAll(sel);
      for (var i = 0; i < a.length; i++) if (vis(a[i])) return a[i];
      return null;
    }
    function busy() {
      var ld = d.getElementById('TheLoadingOuterContainer');
      return vis(ld) || (w.jQuery && w.jQuery.active > 0);
    }
    function editing() { return !!firstVisible('.btnSaveAddUpdate'); }
    function msgsSince(n) {
      return F.msgs.slice(n).filter(function (m) { return m.text; }).map(function (m) { return m.text; })
        .filter(function (t, i, a) { return a.indexOf(t) === i; }).join('\n');
    }
    function patch() {   // runs on every load of the frame, before anything is pressed
      w.alert = function (m) { F.msgs.push({ text: clean(m), color: 'Red', t: Date.now() }); };
      w.confirm = function (m) { F.msgs.push({ text: clean(m), color: 'Red', t: Date.now() }); return false; };
      w.prompt = function () { return null; };
      w.open = function () { return stubWindow(); };
      w.print = noop;
      var sm = w.ShowMessageOnClient;
      if (typeof sm === 'function' && !sm.__zod) {
        var nw = function (text, color) {
          try { F.msgs.push({ text: clean(String(text == null ? '' : text).replace(/<[^>]*>/g, ' ')), color: String(color || ''), t: Date.now() }); } catch (e) { /* ignore */ }
          return sm.apply(this, arguments);
        };
        nw.__zod = 1;
        w.ShowMessageOnClient = nw;
      }
      var XP = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
      if (XP && !XP.__zodForm) {   // only READS SaveRec's answer (also for SMACC's waiting calls)
        XP.__zodForm = 1;
        var o1 = XP.open, s1 = XP.send;
        XP.open = function (m, u) {
          try { this.__zodSave = /\/saverec$/i.test(String(u).split('?')[0]); } catch (e) { this.__zodSave = false; }
          return o1.apply(this, arguments);
        };
        XP.send = function () {
          if (this.__zodSave) {
            var x = this, rec = { done: false, ans: '', status: 0, t: Date.now() };
            F.saveCalls.push(rec);
            x.addEventListener('loadend', function () {
              rec.done = true; rec.status = x.status;
              try { rec.ans = String(JSON.parse(x.responseText).d || ''); } catch (e) { rec.ans = ''; }
            });
          }
          return s1.apply(this, arguments);
        };
      }
    }
    // SMACC's own timer logs every tab out after 500 s without mouse or keys in a SMACC page. While the
    // app's screen is open and used, tell SMACC's timer in this page it is in use (its "mouseclick" event,
    // as the PC add-on does) and press "متابعة" if its warning shows anyway.
    var lastUse = Date.now();
    function used() { lastUse = Date.now(); }
    ['touchstart', 'keydown', 'mousedown'].forEach(function (t) { document.addEventListener(t, used, { capture: true, passive: true }); });
    function holdTimer() {
      if (!w || F.closed || Date.now() - lastUse > 30 * 60 * 1000) return;   // not used for 30 minutes: let SMACC log out
      try {
        w.dispatchEvent(new w.Event('mouseclick'));
        var box = d.getElementById('TheTimerContainer');
        if (box && box.classList.contains('in')) { var ok = firstVisible('.okTimerDialog', box); if (ok && !ok.disabled) ok.click(); }
      } catch (e) { /* page changing */ }
    }

    F.ready = new Promise(function (res, rej) {
      var to = setTimeout(function () { rej(new Error('SMACC did not open its page')); }, 60000);
      fr.addEventListener('load', function () {
        loads++;
        try { w = fr.contentWindow; d = fr.contentDocument; } catch (e) { clearTimeout(to); rej(new Error('SMACC page blocked')); return; }
        if (!w || !d || w.location.href === 'about:blank') return;
        if (/login/i.test(w.location.pathname)) {   // signed out
          F.auth = true; clearTimeout(to);
          var err = new Error('signed out'); err.auth = true; rej(err);
          if (loads > 1 && F.onLost) F.onLost('auth');
          return;
        }
        patch();
        if (loads > 1) { F.lost = true; if (F.onLost) F.onLost('reload'); return; }   // SMACC moved the page itself
        waitFor(function () { $ = w.jQuery; return $ && d.querySelector('.btnAddNew1') && d.getElementById('linkPageForm') && !busy(); }, 45000).then(function (ok) {
          clearTimeout(to);
          if (!ok) { rej(new Error('SMACC page did not finish loading')); return; }
          hold = setInterval(holdTimer, 20000);
          res(F);
        });
      });
    });
    F.ready.catch(noop);
    fr.src = '/Inventory/' + P.page + '.aspx';
    document.body.appendChild(fr);

    function need() {
      if (F.closed) throw new Error('closed');
      if (F.auth) { var e = new Error('signed out'); e.auth = true; throw e; }
      if (F.lost) throw new Error('SMACC page changed');
    }
    async function settle() { await sleep(150); await waitFor(function () { return !busy(); }, 20000); }

    /* a new, empty document in SMACC's page (a half-made one from an earlier try is cancelled first) */
    F.start = async function () {
      await F.ready; need();
      if (editing()) await F.cancel();
      var lp = d.getElementById('linkPageForm');
      if (lp) lp.click();   // with nothing loaded SMACC opens a new one by itself
      if (!await waitFor(editing, 4000)) {
        var b = firstVisible('.btnAddNew1') || d.querySelector('.btnAddNew1');
        if (b) b.click();
        if (!await waitFor(editing, 20000)) throw new Error('SMACC did not open a new document');
      }
      await settle();
      await sleep(400);
      F.msgs.length = 0;
      return F;
    };
    F.editing = function () { return !!d && editing(); };
    F.cancel = async function () {
      if (!d || !editing()) return;
      var c = firstVisible('.btnCancel3');
      if (c) c.click();
      await waitFor(function () { return !editing(); }, 6000);
      await settle();
    };
    F.close = function () {
      if (F.closed) return;
      F.closed = true;
      clearInterval(hold);
      try { if (d && editing()) { var c = firstVisible('.btnCancel3'); if (c) c.click(); } } catch (e) { /* ignore */ }
      setTimeout(function () { try { fr.src = 'about:blank'; } catch (e) { /* ignore */ } fr.remove(); }, 300);
    };
    F.val = function (sel) {
      var a = d.querySelectorAll(sel);
      for (var i = 0; i < a.length; i++) if (!a[i].closest('.ng-row, .modal')) return a[i].value;
      return '';
    };
    F.text = function (sel) {   // a select's chosen option
      var s = d.querySelector(sel);
      return s && s.options && s.selectedIndex >= 0 ? clean(s.options[s.selectedIndex].text) : '';
    };
    F.options = function (sel) {
      var s = d.querySelector(sel);
      return s && s.options ? Array.prototype.map.call(s.options, function (o) { return [o.value, clean(o.text)]; }) : [];
    };

    /* boxes of the header, filled in one go: op "blur" = a box SMACC looks up when it is left (code boxes),
       "change" = a list, "type" = plain text. While they are filled the boxes do not open SMACC's full list
       (main.js does the same on the PC). */
    F.fill = async function (steps) {
      need();
      var held = [];
      steps.forEach(function (s) {
        var ac = $(s.sel).first().data('ui-autocomplete');
        if (!ac || Object.prototype.hasOwnProperty.call(ac, 'search')) return;
        ac.search = function (v) { if (v) return Object.getPrototypeOf(this).search.apply(this, arguments); };
        held.push(ac);
      });
      try {
        steps.forEach(function (s) {
          var $el = $(s.sel).first();
          if (!$el.length || $el.prop('disabled') || s.val == null) return;
          var v = String(s.val);
          try {
            if (s.op === 'blur') $el.val(v).blur();
            else if (s.op === 'change') { if ($el.val() !== v) $el.val(v).change(); }
            else { if ($el.val() !== v) $el.val(v).trigger('change').blur(); }
          } catch (e) { /* SMACC's own code for that box failed: the read-back shows it */ }
        });
      } finally {
        held.forEach(function (ac) { delete ac.search; });
        try { $('.ui-autocomplete').hide(); } catch (e) { /* ignore */ }
      }
      await settle();
    };

    function setBox($el, v) {
      if (!$el.length || $el.prop('disabled') || $el.prop('readonly')) return false;
      $el.focus().val(String(v)).trigger('change').blur();
      return true;
    }
    async function closeItemWindow(m) {
      var c = firstVisible('.CancelDialog', m) || m.querySelector('.close');
      if (c) c.click();
      await waitFor(function () { return !m.classList.contains('in'); }, 4000);
      await settle();
    }
    /* one item through SMACC's item window: { code, qty, price (before VAT, optional), disc (amount, optional) } */
    F.item = async function (it) {
      need();
      var before = F.msgs.length, out = { code: it.code, ok: false };
      var addBtn = $(P.add).first();
      if (!addBtn.length) { out.msg = 'no add-item button'; return out; }
      addBtn.click();
      var m = await waitFor(function () { return d.querySelector('.modal.in[id$="DetailOuterContainer"]'); }, 8000);
      if (!m) { out.msg = msgsSince(before) || 'SMACC did not open its item window'; return out; }
      await sleep(250);
      var $m = $(m), $code = $m.find('#ItemCode');
      $code.val(String(it.code)).blur();   // SMACC looks the item up, with this branch's price and stock
      await waitFor(function () { return clean($m.find('#ItemName').val()) || F.msgs.length > before; }, 8000);
      await settle();
      out.name = clean($m.find('#ItemName').val());
      if (!out.name) { out.msg = msgsSince(before) || 'item not found'; await closeItemWindow(m); return out; }
      setBox($m.find('#Quantity'), it.qty);
      await settle();
      if (it.price != null && it.price !== '' && Math.abs(num($m.find('#Price').val()) - Number(it.price)) > 0.00001) {
        if (!setBox($m.find('#Price'), it.price)) out.priceLocked = true;
        await settle();
      }
      if (Number(it.disc) > 0) { setBox($m.find('#DiscountAmount'), it.disc); await settle(); }
      out.qty = num($m.find('#Quantity').val());
      out.price = num($m.find('#Price').val());
      out.disc = num($m.find('#DiscountAmount').val());
      out.vat = num($m.find('#Tax1Amount').val());
      out.total = num($m.find('#GrandAmount').val());
      out.stock = $m.find('#InHandQuantity').length ? num($m.find('#InHandQuantity').val()) : null;
      var u = $m.find('#UnitName')[0];
      out.unit = u && u.options && u.selectedIndex >= 0 ? clean(u.options[u.selectedIndex].text) : clean(u && u.value);
      if (out.qty <= 0) { out.msg = msgsSince(before) || 'SMACC did not accept the quantity'; await closeItemWindow(m); return out; }
      var ok = firstVisible('.OkDialog', m) || m.querySelector('.OkDialog');
      if (!ok) { out.msg = 'no OK button'; await closeItemWindow(m); return out; }
      ok.click();
      if (!await waitFor(function () { return !m.classList.contains('in'); }, 8000)) {
        out.msg = msgsSince(before) || 'SMACC did not take the item';
        await closeItemWindow(m);
        return out;
      }
      await settle();
      out.ok = true;
      out.note = msgsSince(before);
      return out;
    };

    /* the item lines SMACC shows (its grid on the page), and its totals */
    F.lines = function () {
      var rows = Array.prototype.filter.call(d.querySelectorAll('.ng-row'), function (r) {
        var c = r.querySelector('#ItemCode');
        return c && !c.disabled && clean(c.value) && vis(r);
      });
      return rows.map(function (r, i) {
        var g = function (n) { var x = r.querySelector('#' + n); return x ? x.value : ''; };
        var has = function (n) { return !!r.querySelector('#' + n); };
        return {
          i: i, code: clean(g('ItemCode')), name: clean(g('ItemName')), qty: num(g('Quantity')), unit: clean(g('UnitName')),
          price: num(g('Price')), disc: num(g('DiscountAmount')), vat: num(g('Tax1Amount')),
          total: P.ret && kind === 'sr' ? num(g('NetAmount')) : (has('GrandAmount') ? num(g('GrandAmount')) : num(g('NetAmount'))),
          avail: has('Avail_Quantity') ? num(g('Avail_Quantity')) : null
        };
      });
    };
    F.totals = function () {
      var pick = function (ids) {
        for (var i = 0; i < ids.length; i++) {
          var a = d.querySelectorAll('[id="' + ids[i] + '"]');
          for (var j = 0; j < a.length; j++) if (!a[j].closest('.ng-row, .modal') && clean(a[j].value) !== '') return num(a[j].value);
        }
        return null;
      };
      return {
        disc: pick(['ItemDiscountTotal', 'cpBulk_cpForm_ItemDiscountTotal']),
        vat: pick(['ItemTax1Total', 'cpBulk_cpForm_ItemTax1Total']),
        net: pick(['NetAmount', 'cpBulk_cpForm_NetAmount']),
        rounded: pick(['RoundOffAmount']),
        toPay: pick(['NetToPay']),
        grand: pick(['cpBulk_cpForm_GrandAmount', 'GrandAmount']),
        count: pick(['NoOfItems']),
        qty: pick(['TotalQuantity', 'cpBulk_cpForm_ShowTotalQuantity'])
      };
    };

    /* returns: SMACC's own search for the invoice, which loads it and the quantities left to return */
    F.loadInvoice = async function (no) {
      need();
      var before = F.msgs.length, box = d.getElementById('InvoiceNumber'), go = d.getElementById('btnSearchInvoice');
      if (!box || !go || box.disabled || box.readOnly) throw new Error('SMACC\'s invoice box is not open');
      box.value = String(no);
      go.click();
      await waitFor(function () { return F.lines().length || F.msgs.length > before; }, 20000);
      await settle();
      await sleep(400);
      var lines = F.lines();
      if (!lines.length) return { ok: false, msg: msgsSince(before) };
      return {
        ok: true, lines: lines, note: msgsSince(before),
        head: {
          customer: clean(F.val('#CustomerName')), supplier: clean(F.val('#SupplierName')), branch: clean(F.val('#WarehouseName')),
          salesman: clean(F.val('#SalesmanName')), date: clean(F.val('#InvoiceDate')), vat: clean(F.val('#cpBulk_cpForm_VATNumber')),
          pay: F.val('#PaymentType'), payOptions: F.options('#PaymentType'), reasons: F.options('#cpBulk_cpForm_ReturnReason'),
          reason: F.val('#cpBulk_cpForm_ReturnReason')
        }
      };
    };
    /* quantities to return, one per line (in the order of F.lines()); all at the full quantity = SMACC's own
       "all items" box, which fills every line with what is left to return */
    F.setReturn = async function (qtys) {
      need();
      var lines = F.lines(), all = lines.length && lines.every(function (l, i) { return l.avail > 0 && Math.abs((qtys[i] || 0) - l.avail) < 0.00001; });
      var chk = d.getElementById('chkAllItem');
      if (all && chk) {
        if (!chk.checked) chk.click();
        await settle();
        lines = F.lines();
        if (lines.every(function (l) { return Math.abs(l.qty - (l.avail || 0)) < 0.00001; })) return F.lines();
      }
      var rows = Array.prototype.filter.call(d.querySelectorAll('.ng-row'), function (r) {
        var c = r.querySelector('#ItemCode');
        return c && !c.disabled && clean(c.value) && vis(r);
      });
      for (var i = 0; i < rows.length; i++) {
        var q = rows[i].querySelector('#Quantity'), want = Number(qtys[i]) || 0;
        if (!q || Math.abs(num(q.value) - want) < 0.00001) continue;
        setBox($(q), want);
        await settle();
      }
      return F.lines();
    };

    /* SMACC's own Save button. The answer comes from SaveRec ("success||<number>"); a question SMACC asks in
       its own window on the way (onAsk) is shown by the app, and the answer pressed in SMACC's window. */
    function openModal() {
      var a = d.querySelectorAll('.modal.in');
      for (var i = 0; i < a.length; i++) {
        var m = a[i];
        if (/Loading|DetailOuterContainer|TheTimerContainer/i.test(m.id || '') || !vis(m.querySelector('.modal-dialog') || m)) continue;
        return m;
      }
      return null;
    }
    function describe(m) {
      var t = m.querySelector('.modal-title, .modal-header h4, .modal-header');
      var body = m.querySelector('.modal-body');
      var btns = Array.prototype.filter.call(m.querySelectorAll('.modal-footer button, .modal-footer input[type=button], .modal-footer a.btn'), vis);
      return { title: clean(t && t.textContent), text: clean(body ? body.innerText || body.textContent : m.innerText).slice(0, 600),
        buttons: btns.map(function (b) { return clean(b.value || b.textContent) || '?'; }), el: btns };
    }
    F.save = function (onAsk) {
      need();
      return new Promise(function (res) {
        var before = F.msgs.length, n0 = F.saveCalls.length, t0 = Date.now(), asked = null, done = false, lastMsgAt = 0;
        var btn = firstVisible('.btnSaveAddUpdate');
        if (!btn) { res({ ok: false, msg: 'SMACC\'s Save button is not there' }); return; }
        F.saving = true;   // the page is not closed while this runs, and closed only a little after a save
        function finish(r) {
          if (done) return;
          done = true; clearInterval(iv); F.saving = false;
          if (r.ok || r.unsure) F.savedAt = Date.now();
          r.notes = msgsSince(before); res(r);
        }
        var iv = setInterval(function () {
          if (F.auth || F.lost) { finish({ ok: false, unsure: F.saveCalls.length > n0, auth: F.auth, msg: 'SMACC page changed' }); return; }
          var calls = F.saveCalls.slice(n0), last = calls[calls.length - 1];
          if (last && last.done) {
            var a = last.ans, head = a.split('||')[0];
            if (a.indexOf('success') >= 0 || head.indexOf('OfflineStandard') >= 0) {
              finish({ ok: true, no: clean(a.split('||')[1]), offline: head.indexOf('OfflineStandard') >= 0 });
              return;
            }
            if (last.status === 200 && !openModal()) { finish({ ok: false, msg: msgsSince(before) || a || 'not saved' }); return; }
          }
          var m = openModal();
          if (m) {
            if (asked !== m) {
              asked = m;
              var q = describe(m);
              if (onAsk) onAsk({ title: q.title, text: q.text, buttons: q.buttons }, function (i) {
                var b = q.el[i];
                if (b && vis(b)) b.click();
              });
            }
            return;   // waiting for the user's answer: no time limit
          }
          asked = null;
          if (F.msgs.length > before) lastMsgAt = F.msgs[F.msgs.length - 1].t;
          var red = F.msgs.slice(before).some(function (x) { return /red|warning/i.test(x.color); });
          if (!calls.length && red && Date.now() - lastMsgAt > 2000 && !busy()) { finish({ ok: false, msg: msgsSince(before) }); return; }   // a check stopped it before SaveRec
          if (!calls.length && !busy() && Date.now() - t0 > 30000) { finish({ ok: false, msg: msgsSince(before) || 'SMACC did not save' }); return; }
          if (last && last.done && last.status !== 200 && Date.now() - t0 > 8000 && !busy()) { finish({ ok: false, unsure: true, msg: msgsSince(before) || ('SMACC error ' + last.status) }); return; }
          if (Date.now() - t0 > 180000) finish({ ok: false, unsure: calls.length > 0, msg: msgsSince(before) || 'no answer from SMACC' });
        }, 250);
        setTimeout(function () { btn.click(); }, 0);   // SMACC's own button (its calls may hold the page while they run)
      });
    };
    return F;
  }
  return { open: open, PAGES: PAGES };
})();
