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
    pr: { page: 'PurchaseReturnPage', ret: true },
    sa: { page: 'StockAdjustmentPage', add: '#cpBulk_cpForm_btnAddNew' },   // stock adjustment
    os: { page: 'ItemCardOpeningStockPage', plain: true },                  // opening stock (one item at a time)
    ic: { page: 'ItemCardMasterPage', item: true }                          // item card: extra barcodes of an item
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
    var F = { kind: kind, msgs: [], saveCalls: [], custCalls: [], auth: false, closed: false, lost: false, onLost: null, fresh: false };
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
      if (vis(ld) || (w.jQuery && w.jQuery.active > 0)) return true;
      try { return !!(w.Sys && w.Sys.WebForms && w.Sys.WebForms.PageRequestManager.getInstance().get_isInAsyncPostBack()); } catch (e) { return false; }
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
          var path = '';
          try { path = String(u).split('?')[0]; } catch (e) { path = ''; }
          // a document's SaveRec, or the customer window's (CustomersPage.aspx/SaveRec, answer "...<||><new code>")
          this.__zodSave = /\/saverec$/i.test(path) ? (/customerspage\.aspx/i.test(path) ? 'cust' : 'doc') : '';
          return o1.apply(this, arguments);
        };
        XP.send = function () {
          if (!this.__zodSave) return s1.apply(this, arguments);
          var x = this, rec = { done: false, ans: '', status: 0, t: Date.now() };
          (x.__zodSave === 'cust' ? F.custCalls : F.saveCalls).push(rec);
          var fin = function () {
            if (rec.done) return;
            rec.done = true; rec.status = x.status;
            try { rec.ans = String(JSON.parse(x.responseText).d || ''); } catch (e) { rec.ans = ''; }
          };
          x.addEventListener('loadend', fin);
          var r = s1.apply(this, arguments);
          if (x.readyState === 4) fin();   // SMACC's CallServerFunction waits for its answer (synchronous call)
          return r;
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
        waitFor(function () {
          $ = w.jQuery;
          if (!$ || busy()) return false;
          if (P.item) return d.getElementById('cpBulk_cpForm_ddlOpenSearch') && d.querySelector('.btnUpdate1');
          return P.plain ? d.getElementById('cpBulk_cpForm_txtWarehouseCode') : d.querySelector('.btnAddNew1') && d.getElementById('linkPageForm');
        }, 45000).then(function (ok) {
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
    F.start = async function (reuse) {
      await F.ready; need();
      if (reuse && F.fresh && editing()) return F;   // opened in advance and nothing typed in it since
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
      F.fresh = true;
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
      F.fresh = false;
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
      F.fresh = false;
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
      F.fresh = false;
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

    /* What this login is held to in this page (read after start()): SMACC's own per-user values (a branch
       and salesman linked to the user: _linkedWarehouseCode / _linkedSalesmanCode, empty for the owner) and
       whether SMACC has locked its branch / salesman boxes. Seen in SalesInvoicePage 23/11/2026. */
    F.locks = function () {
      if (!w || !d) return null;
      var g = function (k) { try { var v = w[k]; return v == null ? '' : clean(v); } catch (e) { return ''; } };
      var box = function (ids) {
        for (var i = 0; i < ids.length; i++) {
          var e = d.getElementById(ids[i]);
          if (e) return { val: clean(e.value), off: !!(e.disabled || e.readOnly) };
        }
        return null;
      };
      return {
        wh: g('_linkedWarehouseCode'), whName: g('_linkedWarehouseName'),
        sm: g('_linkedSalesmanCode'), smName: g('_linkedSalesmanName'),
        minus: g('_AllowSaleMinusStock').toLowerCase() === 'true',
        whBox: box(['cpBulk_cpForm_WarehouseCode', 'cpBulk_cpForm_WarehouseCodeFrom']),
        whNameBox: box(['cpBulk_cpForm_WarehouseName', 'cpBulk_cpForm_WarehouseNameFrom']),
        toBox: box(['cpBulk_cpForm_WarehouseCodeTo']),
        smBox: box(['cpBulk_cpForm_SalesmanCode'])
      };
    };
    /* the screens this login may open: the links of SMACC's own menu (#side-menu) in this page */
    F.pages = function () {
      var out = {};
      if (!d) return out;
      Array.prototype.forEach.call(d.querySelectorAll('#side-menu a[href]'), function (a) {
        var m = /(\w+)\.aspx/i.exec(a.getAttribute('href') || '');
        if (m) out[m[1].toLowerCase()] = 1;
      });
      return out;
    };

    /* A new customer through SMACC's own window next to the invoice's customer box (#btnCustCreate).
       The customer box is emptied first (with a customer in it SMACC opens THAT customer for editing), then
       "new" (#a001); SMACC gives the code itself. Its own save (#a005) runs SMACC's checks (VAT number
       format, the national address for a tax invoice, an ID number when an ID type is chosen), then
       CollectData and CustomersPage.aspx/SaveRec (answer "...<||><new code>"), and puts the new customer in
       the invoice. Seen on 23/11/2026 up to the save; the save itself has never been pressed from here.
       c: { name, phone, vat, cr, city, district, street, building, postal, addNo, dry } (dry = fill only) */
    F.newCustomer = async function (c, tax) {
      need();
      if (!editing()) await F.start();
      F.fresh = false;
      var before = F.msgs.length, n0 = F.custCalls.length, X = '#cpBulk_cpForm_NewCustomerAndAccountCreationForm1_';
      var M = d.getElementById('TheNewCustomerAndAccountCreationForm');
      var shut = async function () {
        if (M && M.classList.contains('in')) { var x = M.querySelector('.close'); if (x) x.click(); else $(M).modal('hide'); }
        await waitFor(function () { return !M || !M.classList.contains('in'); }, 4000);
        await settle();
      };
      var tc = $('#cpBulk_cpForm_TaxCategoryCode');   // the invoice type decides SMACC's checks
      if (tax && tc.length && !tc.prop('disabled') && tc.val() !== String(tax)) { tc.val(String(tax)).change(); await settle(); }
      $('#cpBulk_cpForm_CustomerCode').val('').blur();
      $('#cpBulk_cpForm_CustomerName').val('');
      await settle();
      before = F.msgs.length;   // (emptying the invoice's customer makes SMACC complain about the salesman: not about the new customer)
      var cb = d.getElementById('btnCustCreate');
      if (!cb || !M) return { ok: false, msg: 'SMACC\'s new customer button is not there' };
      cb.click();
      if (!await waitFor(function () { return M.classList.contains('in'); }, 8000)) return { ok: false, msg: msgsSince(before) || 'SMACC did not open its customer window' };
      await settle();
      var nb = d.getElementById('a001');
      if (nb) nb.click();
      await settle(); await sleep(300);
      if (String(w._isCustomerUpdateMode) === 'true' || clean($(X + 'CustomerCode').val())) { await shut(); return { ok: false, msg: 'SMACC opened an existing customer instead of a new one' }; }
      var set = function (id, v) {
        if (v == null || String(v).trim() === '') return;
        var $e = $(X + id);
        if (!$e.length || $e.prop('disabled')) return;
        $e.focus().val(String(v).trim()).trigger('keyup').trigger('change').blur();
      };
      set('CustomerName', c.name);
      await settle();
      set('Phone1', c.phone);
      set('VATNumber', c.vat);
      if (c.cr) { $(X + 'OtherBuyerID').val('CRN').change(); await settle(); set('BuyerIDValue', c.cr); }
      set('City', c.city); set('District', c.district); set('StreetName', c.street);
      set('BuildingNumber', c.building); set('PostalCode', c.postal); set('AdditionalNumber', c.addNo);
      await settle();
      var held = { name: clean($(X + 'CustomerName').val()), phone: clean($(X + 'Phone1').val()), vat: clean($(X + 'VATNumber').val()),
        idType: clean($(X + 'OtherBuyerID').val()), cr: clean($(X + 'BuyerIDValue').val()), country: clean($(X + 'CountryName').val()) };
      // SMACC empties a box it refuses on the way (seen 23/11/2026: a mobile already on another customer →
      // "تليفون السجل موجود مسبقا" and the box emptied): stop rather than save the customer without it
      var dg = function (x) { return String(x || '').replace(/\D/g, ''); }, gone = [];
      if (!held.name) gone.push('SMACC did not keep the name');
      if (c.phone && dg(held.phone) !== dg(c.phone)) gone.push('SMACC did not keep the mobile number');
      if (c.vat && dg(held.vat) !== dg(c.vat)) gone.push('SMACC did not keep the VAT number');
      if (c.cr && dg(held.cr) !== dg(c.cr)) gone.push('SMACC did not keep the CR number');
      if (c.dry) { await shut(); return { ok: false, dry: true, held: held, gone: gone, msg: msgsSince(before) }; }
      if (gone.length) { var why = msgsSince(before); await shut(); return { ok: false, held: held, msg: (why ? why + '\n' : '') + gone.join('\n') }; }
      var save = d.getElementById('a005');
      if (!save) { await shut(); return { ok: false, msg: 'SMACC\'s save button is not there' }; }
      save.click();
      var t0 = Date.now(), code = '';
      for (;;) {
        await sleep(200);
        if (F.auth || F.lost) return { ok: false, unsure: F.custCalls.length > n0, auth: F.auth, msg: 'SMACC page changed' };
        var calls = F.custCalls.slice(n0), last = calls[calls.length - 1];
        if (last && last.done) {
          if (last.ans.indexOf('<||>') >= 0) { code = clean(last.ans.split('<||>')[1]); break; }
          if (!busy()) { await shut(); return { ok: false, msg: msgsSince(before) || last.ans || 'SMACC did not save the customer' }; }
        }
        var red = F.msgs.slice(before).some(function (x) { return /red|warning/i.test(x.color); });
        if (!calls.length && red && !busy() && Date.now() - t0 > 1500) { await shut(); return { ok: false, msg: msgsSince(before) }; }   // a check stopped it
        if (Date.now() - t0 > 45000) { await shut(); return { ok: false, unsure: calls.length > 0, msg: msgsSince(before) || 'no answer from SMACC' }; }
      }
      await waitFor(function () { return !M.classList.contains('in'); }, 6000);
      await settle();
      var inv = clean($('#cpBulk_cpForm_CustomerCode').val());
      if (M.classList.contains('in')) await shut();
      return { ok: true, code: code || inv, name: held.name, vat: held.vat, notes: msgsSince(before) };
    };

    /* One counted item into SMACC's stock adjustment (StockAdjustmentPage, item window
       #TheAdjustmentDetailOuterContainer): the code (SMACC fills the name, units, quantity in hand and
       average cost), then the counted quantity in the small unit's box (PhysicalQty2; PhysicalQty1 = 0), and
       SMACC works out the difference and its value; then its OK. Checked on 23/11/2026: counted 3 of an
       item with 0 in hand gave PhysicalQuantity 3, AdjustedQuantity 3, Amount = 3 x average cost. */
    F.adjItem = async function (it) {
      need();
      F.fresh = false;
      var before = F.msgs.length, out = { code: it.code, ok: false };
      var addBtn = $(P.add).first();
      if (!addBtn.length) { out.msg = 'no add-item button'; return out; }
      addBtn.click();
      var m = await waitFor(function () { return d.querySelector('.modal.in[id$="DetailOuterContainer"]'); }, 8000);
      if (!m) { out.msg = msgsSince(before) || 'SMACC did not open its item window'; return out; }
      await sleep(250);
      var $m = $(m), g = function (id) { return num($m.find('#' + id).val()); };
      $m.find('#ItemCode').val(String(it.code)).blur();
      await waitFor(function () { return clean($m.find('#ItemName').val()) || F.msgs.length > before; }, 8000);
      await settle();
      out.name = clean($m.find('#ItemName').val());
      if (!out.name) { out.msg = msgsSince(before) || 'item not found'; await closeItemWindow(m); return out; }
      out.frac = g('UnitFraction') || 1;
      out.inHand = $m.find('#InHandQuantity').length ? g('InHandQuantity') : g('InHandQty1') * out.frac + g('InHandQty2');
      setBox($m.find('#PhysicalQty1'), 0);
      setBox($m.find('#PhysicalQty2'), it.counted);
      await settle();
      out.physical = $m.find('#PhysicalQuantity').length ? g('PhysicalQuantity') : g('PhysicalQty1') * out.frac + g('PhysicalQty2');
      out.adjusted = g('AdjustedQuantity');
      out.price = g('Price');
      out.amount = g('Amount');
      if (Math.abs(out.physical - Number(it.counted)) > 0.0001) { out.msg = msgsSince(before) || 'SMACC did not take the counted quantity'; await closeItemWindow(m); return out; }
      if (it.skipZero && Math.abs(out.adjusted) < 0.00001 && Math.abs(out.physical - out.inHand) < 0.00001) { await closeItemWindow(m); out.ok = true; out.skipped = true; return out; }
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

    /* Opening stock (ItemCardOpeningStockPage), one item of one branch at a time, the way the page is used:
       branch code (blur), search by item code (its own partial page update), pick it from the results;
       SMACC then shows the base unit's average cost and the opening quantity of each unit. Seen 23/11/2026;
       its save (btnSaveForm) has never been pressed from here. */
    F.osLoad = async function (wh, code) {
      need();
      var X = '#cpBulk_cpForm_', before = F.msgs.length, $wb = $(X + 'txtWarehouseCode');
      if (($wb.prop('disabled') || $wb.prop('readonly')) && clean($wb.val()) !== String(wh)) return { ok: false, msg: 'SMACC holds this login to another branch' };
      if (clean($(X + 'txtWarehouseCode').val()) !== String(wh) || !clean($(X + 'txtWarehouseName').val())) {
        $(X + 'txtWarehouseCode').val(String(wh)).blur();
        await settle();
        await waitFor(function () { return clean($(X + 'txtWarehouseName').val()); }, 6000);
      }
      if (!clean($(X + 'txtWarehouseName').val())) return { ok: false, msg: msgsSince(before) || 'SMACC did not find the branch' };
      $(X + 'ddlSearchType').val('itemcode').change();
      $(X + 'txtOpenSearch').val(String(code));
      var b = d.getElementById('cpBulk_cpForm_btnOpenSearch');
      if (!b) return { ok: false, msg: 'no search button' };
      b.click();
      await sleep(300); await settle();
      var opt = await waitFor(function () {
        return Array.prototype.filter.call(d.querySelectorAll('#cpBulk_cpForm_ddlOpenSearch option'), function (o) { return o.value === String(code); })[0] || null;
      }, 10000);
      if (!opt) return { ok: false, msg: msgsSince(before) || 'item not found' };
      if (clean($(X + 'txtItemCode').val()) !== String(code)) {
        $(X + 'ddlOpenSearch').val(String(code)).change();
        await sleep(300); await settle();
        await waitFor(function () { return clean($(X + 'txtItemCode').val()) === String(code); }, 10000);
      }
      return F.osRead();
    };
    F.osRead = function () {
      var X = '#cpBulk_cpForm_';
      var units = Array.prototype.map.call(d.querySelectorAll('[id*="ListViewDropdown_txtUnitQuantity"]'), function (q, i) {
        var row = q.closest('tr'), fr = row && row.querySelector('[id*="txtUnitFraction"]');
        return { i: i, qty: num(q.value), frac: fr ? num(fr.value) || 1 : 1, unit: clean(row ? row.innerText || row.textContent : ''), off: !!q.disabled };
      });
      var cost = $(X + 'lbBaseUnitAverageCostPrice');
      return { ok: !!clean($(X + 'txtItemCode').val()), code: clean($(X + 'txtItemCode').val()), name: clean($(X + 'txtItemName').val()),
        wh: clean($(X + 'txtWarehouseCode').val()), whName: clean($(X + 'txtWarehouseName').val()), date: clean($(X + 'txtDate').val()),
        whOff: !!($(X + 'txtWarehouseCode').prop('disabled') || $(X + 'txtWarehouseCode').prop('readonly')),
        cost: num(cost.val()), costOff: !!cost.prop('disabled'), units: units };
    };
    /* the quantities (one per unit, in the order of SMACC's rows) and the cost typed into SMACC's boxes */
    F.osSet = async function (qtys, cost) {
      need();
      var X = '#cpBulk_cpForm_';
      Array.prototype.forEach.call(d.querySelectorAll('[id*="ListViewDropdown_txtUnitQuantity"]'), function (q, i) {
        if (qtys[i] != null) setBox($(q), qtys[i]);
      });
      if (cost != null) setBox($(X + 'lbBaseUnitAverageCostPrice'), cost);
      await settle();
      return F.osRead();
    };
    /* SMACC's own save of this page; its answer is the message it shows (green = saved) */
    F.osSave = async function () {
      need();
      var before = F.msgs.length, b = d.getElementById('cpBulk_cpForm_btnSaveForm');
      if (!b) return { ok: false, msg: 'SMACC\'s save button is not there' };
      F.saving = true;
      try {
        b.click();
        await sleep(400);
        await waitFor(function () { return F.lost || F.auth || !busy(); }, 60000, 200);   // (a full page reload = lost)
        await sleep(600);
        if (F.lost || F.auth) return { ok: false, unsure: true, auth: F.auth, msg: 'SMACC page changed' };
        var msgs = F.msgs.slice(before), red = msgs.some(function (x) { return /red|warning/i.test(x.color); });
        var green = msgs.some(function (x) { return /green|success/i.test(x.color) || /تم الحفظ|بنجاح|success/i.test(x.text); });
        return { ok: green && !red, unsure: !green && !red, msg: msgsSince(before), read: F.osRead() };
      } finally { F.saving = false; F.savedAt = Date.now(); }
    };

    /* ---------- item card: one more barcode for an item ----------
       SMACC keeps extra barcodes for each unit of an item: units tab → the barcode button on the unit's row →
       its "إضافة باركود" window (a list; "تم" puts it on the row). The item code and the unit code stay as they
       are. The app works that window like a person: open the item, تحديث, units tab, barcode button, إضافة
       باركود, type the barcode (SMACC checks it on leaving the box), تم, then SMACC's own Save. Every step up to
       Save was run on SMACC's page on 23/11/2026 (item 020004, then cancelled: nothing saved); Save itself has
       never been pressed from here. The barcode is then read back from SMACC to be sure it was kept. */
    F.icShown = function () { return d ? clean($('#cpBulk_cpForm_ItemCode').val()) : ''; };
    F.icLoad = async function (code) {   // shows the item read-only in SMACC's page (as its own open search does)
      await F.ready; need();
      code = String(code);
      if (editing()) await F.cancel();
      if (F.icShown() === code) return true;
      var ddl = $('#cpBulk_cpForm_ddlOpenSearch');
      if (!ddl.length) return false;
      if (!ddl.find('option').filter(function () { return this.value === code; }).length) ddl.append($('<option>').val(code).text(code));
      ddl.val(code).change();
      await sleep(300); await settle();
      return !!await waitFor(function () { return F.icShown() === code && !busy(); }, 15000);
    };
    function icRow(unit) {
      return $('#grvItemCartUnitDetails .gridRow').filter(function () { return clean($(this).find('.unitType').val()) === String(unit || 1); }).first();
    }
    function icCodes(row) {
      try { var a = JSON.parse(row.find('.AddViewBarCode').attr('data-itemcardbarcodedetails') || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    F.icBarcodes = function () { return icCodes(icRow(1)).map(function (x) { return clean(x.ItemCardCode); }).filter(Boolean); };
    /* opt.dry: every step, then SMACC's Cancel (nothing saved). opt.onAsk: a question SMACC asks while saving. */
    F.icAddBarcode = async function (code, bc, opt) {
      opt = opt || {};
      await F.ready; need();
      code = String(code); bc = clean(bc);
      var before = F.msgs.length;
      if (!await F.icLoad(code)) return { ok: false, msg: msgsSince(before) || 'SMACC did not open the item' };
      if ($('#cpBulk_cpForm_SubItemSupport').is(':checked')) return { ok: false, msg: 'this is a category, not an item' };
      if (!icRow(1).length) return { ok: false, msg: 'the item has no unit' };
      if (F.icBarcodes().some(function (x) { return x.toLowerCase() === bc.toLowerCase(); })) return { ok: true, already: true };
      var up = firstVisible('.btnUpdate1');
      if (!up) return { ok: false, msg: 'no edit button: this login may not change items' };
      up.click();
      if (!await waitFor(editing, 10000)) return { ok: false, msg: msgsSince(before) || 'SMACC did not open the item for changes' };
      await settle();
      var mo = null;
      var stop = async function (m) {   // SMACC's own الغاء in its window, then its Cancel: nothing kept
        try { if (mo && mo.classList.contains('in')) { var cb = mo.querySelector('#btnCancelDialog'); if (cb) cb.click(); await sleep(400); } } catch (e) { /* ignore */ }
        await F.cancel();
        return { ok: false, msg: msgsSince(before) || m };
      };
      $('a[href="#tabUnits"]').click();   // SMACC unlocks the unit boxes once the units tab is shown
      await sleep(600);
      var b = icRow(1).find('.AddViewBarCode')[0];
      if (!vis(b) || b.disabled) return stop('SMACC\'s barcode button is not there');
      b.click();
      mo = await waitFor(function () { var m = d.getElementById('BarCodeModal'); return m && m.classList.contains('in') ? m : null; }, 4000);
      if (!mo) return stop('SMACC did not open its barcode window');
      await sleep(300);
      var n0 = mo.querySelectorAll('tbody tr').length, addB = mo.querySelector('#btnAddBarCodesExtended');
      if (!addB || addB.disabled) return stop('SMACC\'s add barcode button is not there');
      addB.click();
      var inp = await waitFor(function () {
        var r = mo.querySelectorAll('tbody tr');
        return r.length > n0 ? r[r.length - 1].querySelector('input.AllowForwardSlashChar') : null;
      }, 3000);
      if (!inp) return stop('SMACC did not add a barcode line');
      $(inp).val(bc).blur();   // SMACC checks the barcode on leaving the box
      await sleep(250);
      var okB = mo.querySelector('#btnOkDialog');
      if (clean(inp.value) !== bc || /Textbox_EntryError/.test(inp.className) || !okB || okB.disabled) return stop('SMACC did not accept the barcode');
      okB.click();
      await waitFor(function () { return !mo.classList.contains('in'); }, 3000);
      await sleep(200);
      if (!F.icBarcodes().some(function (x) { return x === bc; })) return stop('SMACC did not accept the barcode');
      if (opt.dry) { var seen = F.icBarcodes(); await F.cancel(); return { ok: true, dry: true, held: seen, msg: msgsSince(before) }; }
      var r = await F.save(opt.onAsk, { loose: true });
      await sleep(300); await settle();
      if (editing()) await F.cancel();   // SMACC refused: leave its page clean for the next one
      var kept = null;
      try {
        var res = await fetch('/Inventory/ItemCardMasterPage.aspx/GetItemCardCodesExtendedByItemCode', {
          method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: "{ 'itemCode' : '" + code.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'}"
        });
        var j = res.ok ? await res.json() : null, a = j && j.d ? JSON.parse(j.d) : [];
        kept = (Array.isArray(a) ? a : []).some(function (x) { return clean(x.ItemCardCode) === bc; });
      } catch (e) { kept = null; }
      if (kept) return { ok: true, msg: r.notes || '' };
      if (kept === false) return { ok: false, auth: r.auth, msg: r.msg || r.notes || 'not saved' };   // SMACC does not have it
      return { ok: false, unsure: true, auth: r.auth, msg: r.msg || r.notes || 'no answer from SMACC' };
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
    F.save = function (onAsk, opt) {
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
            if (last.status === 200 && !openModal()) {
              var red0 = F.msgs.slice(before).some(function (x) { return /red|warning/i.test(x.color); });
              if (opt && opt.loose && !red0 && !/error|exception|خطأ/i.test(a)) { finish({ ok: false, unsure: true, ans: a, msg: msgsSince(before) || a }); return; }
              finish({ ok: false, msg: msgsSince(before) || a || 'not saved' });
              return;
            }
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
