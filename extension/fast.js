/* ZOD - speed helpers for every SMACC page. Never saves anything by itself.
   - remembers the list page size (10/20/30/50/100) per screen on this computer
   - keyboard: F2 new (on sales / purchase invoices: new invoice and straight into the item window, or add an
     item when an invoice is already open) · Ctrl+S save · F3 add item · Ctrl+Enter "add and continue" in the
     item window · Ctrl+K quick search
   - new sales / purchase invoice: fills salesperson, warehouse and the usual payment method from the
     last invoices saved on this computer, and customer no. 2 (نقدي) on sales invoices
     (only empty fields; everything can be changed as usual)
   - purchase invoice: shows the supplier's recent invoices and warns when one has the same total
   - quick search: type an invoice / return number; results show while typing (no Enter needed), with the
     invoice's returns and a "↩ إرجاع" button that opens a ready return
   - price check in the quick search: type an item name or code to see its retail price (before VAT),
     its cost and its stock in each branch, without opening the item card
   - customer search (F8 or the person button), apart from the quick search: by name, mobile, VAT or CR
     number (cust.js keeps the list); choosing a customer makes a new sales invoice for them (or puts them on
     the new sales invoice being added)
   - right after login: opens a new sales invoice instead of the home page
   - sales invoice drafts: "+" at the top keeps the invoice being made as it is and opens a new one in a tab next
     to it (up to 5); buttons go from one to another; a saved new invoice's tab closes and the other comes up
   - keeps the SMACC login alive while SMACC is in use, on the server and against SMACC's own 8-minute
     "تحذير مهلة الجلسة" timer (stops after 4 hours without use)
   - animated "made by" + version label at the top left: a click opens the quick search */
(function () {
  'use strict';
  if (window.__zodFast) return;
  window.__zodFast = true;

  var PG = location.pathname.split('/').pop().toLowerCase();
  var DOCS = [
    { k: 'si', page: 'salesinvoicepage.aspx', url: '/Inventory/SalesInvoicePage.aspx', field: 'InvoiceNumber', date: 'InvoiceDate', who: 'CustomerName', name: 'فاتورة مبيعات' },
    { k: 'sr', page: 'salesreturnpage.aspx', url: '/Inventory/SalesReturnPage.aspx', field: 'DocumentNumber', date: 'DocumentDate', who: 'CustomerName', name: 'مرتجع مبيعات' },
    { k: 'pi', page: 'purchaseinvoicepage.aspx', url: '/Inventory/PurchaseInvoicePage.aspx', field: 'InvoiceNumber', date: 'InvoiceDate', who: 'SupplierName', name: 'فاتورة مشتريات' },
    { k: 'pr', page: 'purchasereturnpage.aspx', url: '/Inventory/PurchaseReturnPage.aspx', field: 'DocumentNumber', date: 'DocumentDate', who: 'SupplierName', name: 'مرتجع مشتريات' }
  ];
  var CUR = DOCS.filter(function (d) { return d.page === PG; })[0] || null;
  var DEFAULT_CUSTOMER = '2';   // نقدي: put on every new sales invoice (can be changed as usual)
  var MADE_BY = 'younis_albaloushy';

  // right after login SMACC opens its home page (dashboard): go straight to a new sales invoice instead
  if (PG === 'default.aspx' && window.top === window && /\/login\.aspx/i.test(document.referrer || '')) {
    location.replace('/Inventory/SalesInvoicePage.aspx#zod-new');
    return;
  }
  var appPage = false;   // true once we know this is a SMACC screen (not the login page)

  /* ---------- helpers ---------- */
  function $id(id) { return document.getElementById(id); }
  function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); }
  function firstVisible(sel, root) {
    var a = (root || document).querySelectorAll(sel);
    for (var i = 0; i < a.length; i++) if (vis(a[i])) return a[i];
    return null;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function lsGet(k) { try { return localStorage.getItem('zod|' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('zod|' + k, v); } catch (e) { /* ignore */ } }
  function lsJSON(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch (e) { return null; } }
  function val(id) { var e = $id(id); return e ? String(e.value || '').trim() : ''; }
  function num(s) { var x = parseFloat(String(s == null ? '' : s).replace(/,/g, '')); return isFinite(x) ? x : null; }
  function fmtDate(d) {
    d = String(d || '');
    return /^\d{8}$/.test(d) ? d.slice(6, 8) + '/' + d.slice(4, 6) + '/' + d.slice(0, 4) : d;
  }
  function fmtAmount(n) {
    var x = Number(n);
    return isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }
  function latinDigits(s) {
    return String(s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x6F0); });
  }
  /* ask SMACC's own jQuery (main.js) to fill a field the way SMACC does */
  function jq(op, sel, v) {
    document.dispatchEvent(new CustomEvent('zod:jq', { detail: JSON.stringify({ op: op, sel: sel, val: v }) }));
  }
  function waitFor(fn, ms, every) {   // every: how often to look (default 0.1 s)
    return new Promise(function (res) {
      var t0 = Date.now();
      (function loop() {
        var r = null;
        try { r = fn(); } catch (e) { r = null; }
        if (r || Date.now() - t0 > ms) return res(r || null);
        setTimeout(loop, every || 100);
      })();
    });
  }
  function period() {
    var s = $id('HeaderBar1_ddlFiscalPeriods');
    return s && s.value ? s.value : 'x';
  }
  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  /* SMACC's own list call. Search is exact (InvoiceNumber, DocumentNumber) or "contains" (names).
     SMACC answers one request at a time per login, so keep the number of calls small. */
  function listCall(url, field, text, size, page) {
    var esc = String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var body = "{ 'CurrentPage' : '" + (page || 1) + "', 'RecordsPerPage' : '" + (size || 20) +
      "' ,'DDLSearchSelectedValue' : '" + field + "', 'SearchText' : '" + esc + "' }";
    return fetch(url + '/LoadPageListing', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var o = JSON.parse(j.d);
      return { rows: Array.isArray(o.pageList) ? o.pageList : [], total: Number(o.totalRecords) || 0 };
    });
  }
  function listSearch(url, field, text, size) {
    return listCall(url, field, text, size, 1).then(function (r) { return r.rows; });
  }
  /* add-on links point to "#" (their click handler cancels it), never to "javascript:…": Chrome blocks
     "javascript:" addresses started by an add-on and lists each one as an error of the add-on */
  function linkLike(a) {
    a.href = '#';
    a.setAttribute('role', 'button');
    a.addEventListener('auxclick', function (ev) {   // middle click: same as a click, not a tab with "#"
      if (ev.button !== 1) return;
      ev.preventDefault();
      ev.stopPropagation();
      a.click();
    });
    return a;
  }
  /* new tab in its own process ("noopener"): with a plain window.open Chrome keeps it in this tab's
     process, and this tab froze while SMACC's heavy page loaded there */
  function openTab(url) { window.open(url, '_blank', 'noopener'); }
  /* open a record read-only with SMACC's own "view" (eye) action */
  function viewRecord(no) {
    var t = el('table');
    t.style.display = 'none';
    var tr = t.insertRow();
    tr.setAttribute('data-recordid', no);
    var a = el('a', 'ViewDetailsPageListIcon');   // no href: SMACC finds it by its class
    tr.insertCell().appendChild(a);
    document.body.appendChild(t);
    a.click();
    setTimeout(function () { t.remove(); }, 3000);
  }
  function pill(text, no, cls, title, onClick) {
    var a = linkLike(el('a', 'zod-pill ' + (cls || '')));
    if (text) a.appendChild(document.createTextNode(text + ' '));
    var b = el('bdi', null, no);
    b.dir = 'ltr';
    a.appendChild(b);
    if (title) a.title = title;
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      onClick(ev);
    });
    return a;
  }

  var toastEl = null, toastTimer = 0;
  function toast(msg, kind) {
    if (!document.body) return;
    if (!toastEl) { toastEl = el('div', 'zod-toast'); document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.className = 'zod-toast zod-toast-show' + (kind ? ' zod-toast-' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'zod-toast'; }, kind === 'ok' ? 4500 : 2800);
  }
  // messages from tools.js (runs in the page's own world)
  document.addEventListener('zod:toast', function (e) {
    try { var o = JSON.parse(e.detail); toast(String(o.msg || ''), o.kind || ''); } catch (err) { /* ignore */ }
  });

  /* ---------- screen state ---------- */
  function editing() { return !!firstVisible('.btnSaveAddUpdate'); }                    // add or edit mode
  function adding() { return editing() && !!$id('cpBulk_cpForm_InvoiceNumber') && !val('cpBulk_cpForm_InvoiceNumber'); }
  function itemWindow() { return document.querySelector('.modal.in[id$="DetailOuterContainer"]'); }
  function formBox() { return $id('TheListForm'); }
  function setBanner(id, cls, build) {
    var f = formBox(), b = $id(id);
    if (!f || !build) { if (b) b.remove(); return null; }
    if (!b) { b = el('div'); b.id = id; }
    b.className = 'zod-banner ' + cls;
    b.textContent = '';
    build(b);
    if (b.parentElement !== f) f.insertBefore(b, f.firstChild);
    return b;
  }

  /* ---------- 1. list page size ---------- */
  var psKey = 'pagesize|' + PG;
  function applyPageSize() {
    var s = $id('ddlPageCount'), v = lsGet(psKey);
    if (!s || !v || s.value === v) return;
    for (var i = 0; i < s.options.length; i++) {
      if (s.options[i].value === v) { s.value = v; return; }
    }
  }
  // runs before SMACC's own start-up code, so the first list already loads with the saved size
  document.addEventListener('DOMContentLoaded', applyPageSize, true);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.id === 'ddlPageCount' && t.value) lsSet(psKey, t.value);
  }, true);

  /* ---------- 2. keyboard ---------- */
  function doNew() {
    if (editing()) { toast('احفظ أو ألغِ المستند المفتوح أولاً'); return; }
    var add = firstVisible('.btnAddNew1');
    if (add) { add.click(); return; }
    var tab = $id('linkPageForm');
    if (!tab || !document.querySelector('.btnAddNew1')) { toast('لا يوجد "اضافة جديد" في هذه الصفحة'); return; }
    tab.click();
    // with nothing loaded, SMACC opens a new document by itself when the tab is shown
    waitFor(function () { return editing() ? 'open' : firstVisible('.btnAddNew1'); }, 4000, 30).then(function (b) {
      if (b === 'open') return;
      if (b) b.click(); else toast('زر "اضافة جديد" غير متاح هنا');
    });
  }
  function doSave() {
    var save = firstVisible('.btnSaveAddUpdate');
    if (!save) { toast('لا يوجد شيء للحفظ الآن'); return; }
    if (itemWindow()) { toast('أكمل نافذة الصنف أولاً (موافق أو الغاء)'); return; }
    if (save.disabled) return;
    var a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();   // let SMACC finish the field being typed in
    setTimeout(function () { if (vis(save) && !save.disabled) save.click(); }, 250);
  }
  function doItem() {
    var m = itemWindow();
    if (m) { jq('focus', '#' + m.id + ' #ItemCode'); return; }
    if (!editing()) { toast('اضغط F2 لمستند جديد أولاً'); return; }
    var b = firstVisible('#cpBulk_cpForm_btnAddNewItem');
    if (!b) { toast('لا يوجد زر "اضافة صنف جديد" هنا'); return; }
    b.click();   // SMACC checks the header (salesperson, warehouse…) and opens the item window
  }
  /* F2 on sales / purchase invoices: go straight to adding an item */
  var f2busy = false;
  function headerReady() {
    if (DEF === 'si') {
      if (!val('cpBulk_cpForm_SalesmanCode') || !val('cpBulk_cpForm_WarehouseCode')) return false;
      return !val('cpBulk_cpForm_CustomerCode') || !!val('cpBulk_cpForm_CustomerName');   // SMACC still filling the customer
    }
    return !!(val('cpBulk_cpForm_SupplierCode') && val('cpBulk_cpForm_WarehouseName'));
  }
  function askHeader() {   // what is missing before SMACC lets us add an item
    var m = DEF === 'pi'
      ? (!val('cpBulk_cpForm_SupplierCode') ? ['#cpBulk_cpForm_SupplierCode', 'اختر المورد'] : ['#cpBulk_cpForm_WarehouseName', 'اختر المخزن'])
      : (!val('cpBulk_cpForm_SalesmanCode') ? ['#cpBulk_cpForm_SalesmanCode', 'اختر البائع'] : ['#cpBulk_cpForm_WarehouseCode', 'اختر المخزن']);
    jq('focus', m[0]);
    toast(m[1] + ' ثم اضغط F2 لإضافة صنف');
  }
  function doF2() {
    if (!DEF) { doNew(); return; }
    if (itemWindow() || editing()) { pickedCust = ''; doItem(); return; }
    if (f2busy) return;
    f2busy = true;
    defDone = false;
    doNew();
    waitFor(adding, 6000, 30).then(function (ok) {
      if (!ok) return null;
      applyDefaults();   // now, not after the usual short delay
      if (DEF === 'pi' && !val('cpBulk_cpForm_SupplierCode')) return 'ask';   // purchases: supplier first
      return waitFor(function () { return !adding() ? 'gone' : headerReady(); }, 4000, 30);
    }).then(function (r) {
      if (!r || r === 'gone' || !adding()) { if (r === null && adding()) askHeader(); return; }
      if (r === 'ask') { askHeader(); return; }
      doItem();
    }).then(function () { f2busy = false; pickedCust = ''; }, function () { f2busy = false; pickedCust = ''; });
  }
  // listen on window (capture) so it runs before SMACC's own key handlers, which stop some keys
  window.addEventListener('keydown', function (e) {
    if (!appPage || e.defaultPrevented) return;
    if (document.documentElement.classList.contains('zod-ov-on')) return;   // a tools.js window is open on top
    var ctrl = e.ctrlKey || e.metaKey, c = e.code, k = e.key;
    if (k === 'F8' && !ctrl && !e.altKey && !e.shiftKey) {   // customer search (from the quick search: with its text)
      e.preventDefault();
      e.stopPropagation();
      var pre = jump && jInput && e.target && jump.contains(e.target) ? jInput.value.trim() : '';
      toggleCusts(!!pre || !custOpen(), pre);
      return;
    }
    if (cpan && e.target && cpan.contains(e.target)) {   // keys typed in the customer search
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); toggleCusts(false); return; }
      if ((k === 'ArrowDown' || k === 'ArrowUp') && !ctrl && !e.altKey && !e.shiftKey) {   // move between customers
        if (e.target === cInput && cInput.value.trim() !== cLastQ) custSearch();   // typed a moment ago: search first
        var crows = Array.prototype.slice.call(cpan.querySelectorAll('.zod-jrow'));
        var cat = crows.indexOf(e.target.closest ? e.target.closest('.zod-jrow') : null);
        if (!crows.length || (e.target === cInput && k === 'ArrowUp')) return;
        e.preventDefault();
        e.stopPropagation();
        var cto = cat < 0 ? (k === 'ArrowDown' ? 0 : -1) : cat + (k === 'ArrowDown' ? 1 : -1);
        if (cto < 0) cInput.focus();
        else if (crows[cto]) crows[cto].focus();
        return;
      }
      if (k === 'Enter' || c === 'NumpadEnter') {   // the customer chosen, or the first one
        e.preventDefault();
        e.stopPropagation();
        if (/^(BUTTON|SUMMARY|A)$/.test(e.target.tagName)) { e.target.click(); return; }
        var crow = e.target.closest && e.target.closest('.zod-jrow');
        if (crow && crow.__zc) { invoiceFor(crow.__zc, ctrl); return; }
        if (cInput.value.trim() !== cLastQ) custSearch();
        if (cFound && cFound.items.length) invoiceFor(cFound.items[0], ctrl);
        return;
      }
      if (!ctrl || (c !== 'KeyK' && c !== 'KeyS')) return;
    }
    if (jump && e.target && jump.contains(e.target)) {   // keys typed in the quick search box
      if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); toggleJump(false); return; }
      if ((k === 'ArrowDown' || k === 'ArrowUp') && !ctrl && !e.altKey && !e.shiftKey) {   // move between results
        var rows = Array.prototype.slice.call(jump.querySelectorAll('.zod-jrow, .zod-irow'));
        var at = rows.indexOf(e.target.closest ? e.target.closest('.zod-jrow, .zod-irow') : null);
        if (!rows.length || (e.target === jInput && k === 'ArrowUp')) return;
        e.preventDefault();
        e.stopPropagation();
        var to = at < 0 ? (k === 'ArrowDown' ? 0 : -1) : at + (k === 'ArrowDown' ? 1 : -1);
        if (to < 0) jInput.focus();
        else if (rows[to]) rows[to].focus();
        return;
      }
      if (k === 'Enter' || c === 'NumpadEnter') {
        e.preventDefault();
        e.stopPropagation();
        var row = e.target.closest && e.target.closest('.zod-jrow');
        var irow = e.target.closest && e.target.closest('.zod-irow');
        if (/^(BUTTON|SUMMARY|A)$/.test(e.target.tagName)) { e.target.click(); return; }
        if (irow && irow.__zi) { queueDetails(irow.__zi, true); return; }
        if (row && row.__zgo) { toggleCusts(true, row.__zgo); return; }
        if (row && row.__zr) { openResult(row.__zr, ctrl); return; }
        var q = jNorm(), same = q === jLastQ && !jBusy;
        if (same && jResults.length) openResult(jResults[0], ctrl);
        else if (same && custQuery() && !(jItems && jItems.length)) toggleCusts(true, iNorm());   // a customer: their search
        else if (same && jItems && jItems.length) queueDetails(jItems[0], true);
        else search(false);
        return;
      }
      if (!ctrl || (c !== 'KeyK' && c !== 'KeyS')) return;
    }
    if (ctrl && !e.altKey && !e.shiftKey && c === 'KeyS') { e.preventDefault(); e.stopPropagation(); doSave(); return; }
    if (ctrl && !e.altKey && !e.shiftKey && c === 'KeyK') { e.preventDefault(); e.stopPropagation(); toggleJump(true); return; }
    if (ctrl && !e.altKey && (c === 'Enter' || c === 'NumpadEnter')) {
      var m = itemWindow();
      if (!m) return;
      var b = firstVisible('.btnAddContinue', m) || firstVisible('.OkDialog', m);
      if (b) { e.preventDefault(); e.stopPropagation(); b.click(); }
      return;
    }
    if (ctrl || e.altKey) return;
    if (k === 'F2') { e.preventDefault(); doF2(); return; }
    if (k === 'F3') { e.preventDefault(); doItem(); return; }
  }, true);

  /* ---------- 3. remembered defaults for new invoices ---------- */
  var DEF = CUR && (CUR.k === 'si' || CUR.k === 'pi') ? CUR.k : null;
  var defKey = 'defaults|' + PG;
  function header() {
    return {
      sm: val('cpBulk_cpForm_SalesmanCode'),
      whc: val('cpBulk_cpForm_WarehouseCode'),
      whn: val('cpBulk_cpForm_WarehouseName'),
      pay: val('PaymentType')
    };
  }
  function remember() {
    var h = header();
    if (!h.sm && !h.whc && !h.whn) return;
    var hist = lsJSON(defKey) || [];
    hist.push(h);
    lsSet(defKey, JSON.stringify(hist.slice(-10)));
  }
  function usualPay(hist) {   // the payment method used in most (60%+) of the last invoices
    if (hist.length < 3) return '';
    var c = {}, best = '', n = 0;
    hist.forEach(function (h) { if (h.pay) c[h.pay] = (c[h.pay] || 0) + 1; });
    Object.keys(c).forEach(function (k) { if (c[k] > n) { best = k; n = c[k]; } });
    return n / hist.length >= 0.6 ? best : '';
  }
  function fillable(id) {
    var e = $id(id);
    return e && !e.disabled && !e.readOnly && vis(e) && !String(e.value || '').trim() ? e : null;
  }
  var defShown = false, defDone = false;
  function applyDefaults() {
    if (!DEF || !adding() || defDone) return;
    defDone = true;   // once per new invoice
    var hist = lsJSON(defKey) || [];
    var last = hist[hist.length - 1] || {}, steps = [];
    // SMACC looks each box up on the server while the box loses focus (it waits for the answer), so the boxes
    // are filled one after the other, in one go (main.js), and each step first checks that its box is still
    // empty: SMACC may have filled it from an earlier one (the warehouse from the salesperson)
    if (DEF === 'si' && last.sm && fillable('cpBulk_cpForm_SalesmanCode')) {
      steps.push({ op: 'blur', sel: '#cpBulk_cpForm_SalesmanCode', val: last.sm, ifEmpty: true });
    }
    var cb = $id('cpBulk_cpForm_CustomerCode'), pc = pickedCust;
    pickedCust = '';
    if (DEF === 'si' && pc && cb && !cb.disabled && !cb.readOnly && vis(cb)) {
      steps.push({ op: 'blur', sel: '#cpBulk_cpForm_CustomerCode', val: pc });   // the customer chosen in the customer search
    } else if (DEF === 'si' && DEFAULT_CUSTOMER && fillable('cpBulk_cpForm_CustomerCode')) {
      steps.push({ op: 'blur', sel: '#cpBulk_cpForm_CustomerCode', val: DEFAULT_CUSTOMER, ifEmpty: true });   // SMACC fills the name
    }
    if (DEF === 'si' && last.whc && fillable('cpBulk_cpForm_WarehouseCode')) {
      steps.push({ op: 'blur', sel: '#cpBulk_cpForm_WarehouseCode', val: last.whc, ifEmpty: true });
    }
    if (DEF === 'pi' && last.whn && fillable('cpBulk_cpForm_WarehouseName')) {
      steps.push({ op: 'blur', sel: '#cpBulk_cpForm_WarehouseName', val: last.whn, ifEmpty: true });
    }
    var pay = usualPay(hist), ps = $id('PaymentType');
    if (pay && ps && !ps.disabled && (steps.length || ps.value !== pay) &&   // the boxes above may change it
        Array.prototype.some.call(ps.options, function (o) { return o.value === pay; })) {
      steps.push({ op: 'change', sel: '#PaymentType', val: pay, ifDiff: true });   // only if SMACC chose another one
    }
    if (!steps.length) return;
    document.dispatchEvent(new CustomEvent('zod:jq', { detail: JSON.stringify({ op: 'fill', steps: steps }) }));
    setTimeout(showDefaults, 900);
  }
  function showDefaults() {
    if (!adding()) return;
    var parts = [];
    if (DEF === 'si' && val('cpBulk_cpForm_CustomerCode')) parts.push('العميل: ' + (val('cpBulk_cpForm_CustomerName') || val('cpBulk_cpForm_CustomerCode')));
    if (DEF === 'si' && val('cpBulk_cpForm_SalesmanName')) parts.push('البائع: ' + val('cpBulk_cpForm_SalesmanName'));
    if (val('cpBulk_cpForm_WarehouseName')) parts.push('المخزن: ' + val('cpBulk_cpForm_WarehouseName'));
    var ps = $id('PaymentType');
    if (ps && ps.selectedIndex >= 0) parts.push('طريقة الدفع: ' + ps.options[ps.selectedIndex].text.trim());
    if (!parts.length) return;
    setBanner('zod-def', 'zod-banner-info', function (b) {
      b.appendChild(el('b', null, 'تعبئة تلقائية: '));
      b.appendChild(el('span', null, parts.join(' · ')));
      b.appendChild(el('span', 'zod-sep', ' — يمكن تغييرها كالعادة'));
    });
    defShown = true;
  }
  // remember the header when a NEW invoice is saved (button or Ctrl+S)
  document.addEventListener('click', function (e) {
    if (!DEF || !e.target || !e.target.closest) return;
    if (e.target.closest('.btnSaveAddUpdate') && adding()) remember();
  }, true);
  // fill as soon as a new invoice opens, however it was opened ("اضافة جديد", F2, the "ادارة" tab…)
  var wasAdding = false;
  function watchAdding() {
    var now = adding();
    if (now && !wasAdding) setTimeout(applyDefaults, 600);
    if (!now) defDone = false;
    wasAdding = now;
  }

  /* ---------- 4. purchase invoice: supplier's recent invoices + same-total warning ---------- */
  var sup = { name: '', rows: null, key: '', busy: false };
  function formNet() {
    var a = document.querySelectorAll('#TheListForm #NetAmount');
    for (var i = 0; i < a.length; i++) {
      if (!a[i].closest('.ng-outer2, .modal')) return num(a[i].value);
    }
    return null;
  }
  function loadSupplier(name) {
    sup.busy = true;
    listSearch('/Inventory/PurchaseInvoicePage.aspx', 'SupplierName', name, 2000).then(function (rows) {
      if (sup.name !== name) return;
      sup.rows = rows.filter(function (r) { return String(r.SupplierName || '').trim() === name; })
        .map(function (r) { return { no: String(r.InvoiceNumber || '').trim(), date: String(r.InvoiceDate || ''), net: Number(r.NetAmount) || 0 }; })
        .sort(function (a, b) { return b.no.localeCompare(a.no, undefined, { numeric: true }); });
    }).catch(function () {   // logged out or no access: just no list
      if (sup.name === name) sup.rows = [];
    }).then(function () {
      sup.busy = false;
      sup.key = '';
      supplierTick();
    });
  }
  function openDoc(url, no) { openTab(url + '#zod-open=' + encodeURIComponent(no)); }
  function supplierTick() {
    if (!CUR || CUR.k !== 'pi') return;
    var name = editing() ? val('cpBulk_cpForm_SupplierName') : '';
    if (!name) { sup.name = ''; sup.rows = null; sup.key = ''; setBanner('zod-dup'); return; }
    if (name !== sup.name) { sup.name = name; sup.rows = null; sup.key = ''; loadSupplier(name); return; }
    if (!sup.rows) return;
    var inv = val('cpBulk_cpForm_InvoiceNumber'), net = formNet();
    var key = name + '|' + inv + '|' + net;
    if (key === sup.key && $id('zod-dup')) return;
    sup.key = key;
    var others = sup.rows.filter(function (r) { return r.no !== inv; });
    // same supplier + same total in the last 60 days: possibly the same supplier invoice entered twice
    var d60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), since = String(d60.getFullYear()) +
      String(d60.getMonth() + 1).padStart(2, '0') + String(d60.getDate()).padStart(2, '0');
    var same = net && net > 0 ? others.filter(function (r) { return Math.abs(r.net - net) < 0.01 && r.date >= since; }) : [];
    var url = '/Inventory/PurchaseInvoicePage.aspx';
    if (same.length) {
      setBanner('zod-dup', 'zod-banner-warn', function (b) {
        b.appendChild(el('b', null, 'تنبيه: لنفس المورد ' + (same.length > 1 ? same.length + ' فواتير' : 'فاتورة') +
          ' بنفس المبلغ ' + fmtAmount(net) + ' ريال خلال آخر 60 يوماً: '));
        same.slice(0, 5).forEach(function (r) {
          b.appendChild(pill('', r.no + ' · ' + fmtDate(r.date).slice(0, 5), 'zod-pill-inv',
            r.no + ' · ' + fmtDate(r.date) + ' · ' + fmtAmount(r.net) + ' ريال\nاضغط لفتحها في تبويب جديد',
            function () { openDoc(url, r.no); }));
        });
        b.appendChild(el('span', 'zod-sep', ' — تأكد أنها ليست نفس فاتورة المورد (رقم المرجع) قبل الحفظ'));
      });
      return;
    }
    setBanner('zod-dup', 'zod-banner-info', function (b) {
      if (!others.length) { b.appendChild(el('span', null, 'لا توجد فواتير سابقة لهذا المورد في هذه السنة المالية')); return; }
      b.appendChild(el('b', null, 'آخر فواتير هذا المورد (' + others.length + ' هذه السنة): '));
      others.slice(0, 4).forEach(function (r) {
        b.appendChild(pill('', r.no + ' · ' + fmtDate(r.date).slice(0, 5) + ' · ' + fmtAmount(r.net), 'zod-pill-inv',
          r.no + ' · ' + fmtDate(r.date) + ' · ' + fmtAmount(r.net) + ' ريال\nاضغط لفتحها في تبويب جديد',
          function () { openDoc(url, r.no); }));
      });
    });
  }

  /* ---------- 5. quick search (Ctrl+K) ---------- */
  var jump = null, jInput = null, jList = null, jStatus = null, jResults = [], jLastQ = '';
  var jTimer = 0, jBusy = '', jOpenAfter = false, jRets = null;
  var RET_PAGE = { si: '/Inventory/SalesReturnPage.aspx', pi: '/Inventory/PurchaseReturnPage.aspx' };
  function jNorm() { return latinDigits(jInput.value).toUpperCase().replace(/\s+/g, ''); }
  /* returns already known on this computer (kept by the returns part of the add-on) */
  function loadRets() {
    var keys = ['s', 'p'].map(function (x) { return 'zodret|' + location.host + '|' + x + '|' + period(); });
    try {
      chrome.storage.local.get(keys).then(function (o) {
        var out = {};
        ['s', 'p'].forEach(function (x, i) {
          var m = {};
          ((o[keys[i]] && o[keys[i]].rows) || []).forEach(function (r) {
            if (!r[2]) return;
            (m[r[2]] = m[r[2]] || []).push(r);
          });
          out[x] = m;
        });
        jRets = out;
        if (jResults.length) drawResults();
      }).catch(function () { /* ignore */ });
    } catch (e) { /* ignore */ }
  }
  function retsFor(r) {
    if (!RET_PAGE[r.d.k] || !jRets) return null;
    return jRets[r.d.k === 'si' ? 's' : 'p'][r.no] || [];
  }
  function startReturn(r, part, newTab) {
    var url = RET_PAGE[r.d.k] + '#zod-return=' + encodeURIComponent(r.no) + (part ? '&part=1' : '');
    if (!newTab && editing()) { newTab = true; toast('المستند الحالي مفتوح للتعديل، فُتح المرتجع في تبويب جديد'); }
    if (newTab) { openTab(url); return; }
    toggleJump(false);
    location.href = url;   // on the same return page only the hash changes; the returns part picks it up
  }
  /* number prefixes in use per document type (e.g. INV-, RINV-, 0002-), from the oldest and newest
     document of the selected fiscal year; kept for a day */
  function getPrefixes() {
    var k = 'prefixes2|' + location.host + '|' + period(), c = lsJSON(k);
    if (c && Date.now() - c.t < 24 * 60 * 60 * 1000) return Promise.resolve(c.p);
    var pre = function (d, rows) { return rows[0] ? String(rows[0][d.field] || '').trim().replace(/\d+$/, '') : ''; };
    return Promise.all(DOCS.map(function (d) {
      return listCall(d.url, '0', '', 1, 1).then(function (first) {
        var list = [pre(d, first.rows)];
        if (first.total < 2) return list;
        return listCall(d.url, '0', '', 1, first.total).then(function (last) {
          list.unshift(pre(d, last.rows));   // newest first
          return list;
        });
      }).then(function (list) {
        return list.filter(function (x, i) { return x && list.indexOf(x) === i; });
      }).catch(function () { return []; });
    })).then(function (arr) {
      var p = {};
      DOCS.forEach(function (d, i) { p[d.k] = arr[i]; });
      if (arr.some(function (a) { return a.length; })) lsSet(k, JSON.stringify({ t: Date.now(), p: p }));
      return p;
    });
  }
  /* which exact numbers to look up for one document type */
  function candidates(q, prefixes) {
    prefixes = prefixes || [];
    if (/^\d+$/.test(q)) return prefixes.length ? prefixes.map(function (p) { return p + q; }) : [q];
    var m = q.match(/^([A-Z]+)(\d+)$/);   // INV106048 -> INV-106048
    if (m) q = m[1] + '-' + m[2];
    if (!prefixes.length) return [q];
    return prefixes.some(function (p) { return q.indexOf(p) === 0; }) ? [q] : [];
  }
  function openResult(r, newTab) {
    if (!newTab && editing()) { newTab = true; toast('المستند الحالي مفتوح للتعديل، فُتح البحث في تبويب جديد'); }
    if (newTab) { openDoc(r.d.url, r.no); return; }
    toggleJump(false);
    if (CUR && CUR.k === r.d.k) viewRecord(r.no);
    else location.href = r.d.url + '#zod-open=' + encodeURIComponent(r.no);
  }
  function drawResults() {
    jList.textContent = '';
    markResults();
    if (jResults.length) jList.appendChild(section('المستندات'));
    jResults.forEach(function (r, i) {
      var b = el('div', 'zod-jrow');
      b.tabIndex = 0;
      b.setAttribute('role', 'button');
      b.__zr = r;
      b.appendChild(el('span', 'zod-jtype zod-jt-' + r.d.k, r.d.name));
      var no = el('bdi', 'zod-jno', r.no);
      no.dir = 'ltr';
      b.appendChild(no);
      var rets = retsFor(r), sum = 0, full = false;
      if (rets && rets.length) {
        sum = rets.reduce(function (t, x) { return t + (Number(x[3]) || 0); }, 0);
        full = Number(r.net) > 0 && sum >= Number(r.net) - 0.01;
      }
      if (full) b.appendChild(el('span', 'zod-jfull', 'مرتجع بالكامل'));
      else if (RET_PAGE[r.d.k]) {
        var act = el('button', 'zod-jact', '↩ إرجاع');
        act.type = 'button';
        act.title = 'مرتجع كامل لهذه الفاتورة: تفتح شاشة المرتجع وفيها كل الأصناف، تراجعها ثم تضغط «حفظ».\nShift + ضغط: مرتجع جزئي · Ctrl + ضغط: في تبويب جديد';
        act.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          startReturn(r, ev.shiftKey, ev.ctrlKey || ev.metaKey);
        });
        b.appendChild(act);
      }
      var meta = [fmtDate(r.date), r.who, fmtAmount(r.net) + ' ريال'];
      if (rets && rets.length) meta.push('مرتجع: ' + rets.map(function (x) { return x[0]; }).join('، ') + (full ? '' : ' (' + fmtAmount(sum) + ' ريال)'));
      b.appendChild(el('span', 'zod-jmeta', meta.filter(Boolean).join(' · ')));
      b.title = 'اضغط للفتح · Ctrl + ضغط للفتح في تبويب جديد';
      b.addEventListener('click', function (ev) { openResult(r, ev.ctrlKey || ev.metaKey); });
      b.addEventListener('auxclick', function (ev) { if (ev.button === 1) openResult(r, true); });
      if (i === 0) b.classList.add('zod-jfirst');
      jList.appendChild(b);
    });
  }
  /* ----- price check: items by name or code -----
     SMACC's own item search (the one in the invoice item window) gives code, name and retail price;
     the item's unit gives the retail price and the cost (this fiscal year's cost, the same as its
     average cost), and the item card's "all warehouses" list gives the stock in each branch.
     Only the retail price is shown, before VAT, as SMACC stores it and as it is used at ZOD. */
  var jItems = null, jItemsBox = null, detQueue = [], detBusy = false, detCache = {};
  // stock always fresh: an item's details are only re-used while the same search is still being typed (5 s)
  var ITEM_MAX = 15, ITEM_AUTO = 3, DET_TTL = 5 * 1000;
  var DOC_SHAPE = /^[A-Z]*-?\d+(-\d+)?$/;   // INV-106048, RINV10442, 0002-2644, 106048
  function iNorm() { return latinDigits(jInput.value).trim().replace(/\s+/g, ' '); }
  function wsCall(fn, body) {
    return fetch('/WebServices/CommonWebService.asmx/' + fn, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return typeof j.d === 'string' ? JSON.parse(j.d) : j.d; });
  }
  /* a number with a known document prefix (INV-, RINV-, 0002-…) is a document, not an item */
  function knownDocPrefix(q) {
    var c = lsJSON('prefixes2|' + location.host + '|' + period());
    if (!c || !c.p) return false;
    var m = q.match(/^([A-Z]+)(\d+)$/), qq = m ? m[1] + '-' + m[2] : q;
    return Object.keys(c.p).some(function (k) {
      return (c.p[k] || []).some(function (p) { return p && /\D/.test(p) && qq.indexOf(p) === 0; });
    });
  }
  function itemSearch(term) {   // exactly SMACC's own call ("contains" on code and name, stock items)
    var body = "{'codeOrName':'" + btoa(encodeURIComponent(term)) + "','isExact':'False','itemType':'1', " +
      "'onlyBaseItemCode':'False','isSizeColorParent':'False','isProductionCall':'False'," +
      "'appendSalesPriceAndStock':'true','warehouseCode':''}";
    return wsCall('AutoCompleteSmartCodeNameSearch', body).then(function (d) {
      return (Array.isArray(d) ? d : []).map(function (s) {
        var p = String(s).split('<-|->');   // code <-|-> name <-|-> " | price" <-|-> " | stock"
        return { code: String(p[0] || '').trim(), name: String(p[1] || '').trim(), price: num(String(p[2] || '').replace(/^[\s|]+/, '')) };
      }).filter(function (x) { return x.code; });
    });
  }
  function itemDetails(code) {
    var c = "'" + String(code).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    var out = { retail: null, cost: null, unit: '', stock: [] };
    return wsCall('SelectItemCardUnitString', "{ 'itemCode' : " + c + ",'unitType' : '1' }").then(function (o) {
      var u = o && o.Table && o.Table[0];
      if (!u) return;
      out.unit = String(u.UnitName || '').trim();
      out.cost = num(u.CostPrice);
      // "1|سعر التجزئه|20.330000|1;2|سعر الجمله|18.770000|1;3|سعر التوزيع|17.980000|1": channel 1 = retail
      String(u.PriceChannelDetails || '').split(';').forEach(function (x) {
        var a = x.split('|');
        if (a[0] === '1' && num(a[2]) != null) out.retail = num(a[2]);
      });
    }, function () { /* keep the retail price from the item search */ }).then(function () {
      return wsCall('SelectItemCardCurrentStockInAllWarehouses', "{ 'itemCode' : " + c + "}");
    }).then(function (rows) {
      out.stock = (Array.isArray(rows) ? rows : []).map(function (r) {
        return { name: String(r.WarehouseName || r.WarehouseCode || '').trim(), qty: Number(r.CurrentQuantity) || 0 };
      });
      return out;
    });
  }
  /* SMACC answers one request at a time per login: item details load one after the other */
  function queueDetails(it, front) {
    if (it.det || it.loading) return;
    it.loading = true;
    it.err = false;
    drawItemDet(it);
    if (front) detQueue.unshift(it); else detQueue.push(it);
    nextDetails();
  }
  function nextDetails() {
    if (detBusy) return;
    var it = detQueue.shift();
    if (!it) return;
    if (!jItems || jItems.indexOf(it) < 0) { it.loading = false; nextDetails(); return; }   // an older search
    var c = detCache[it.code];
    if (c && Date.now() - c.t < DET_TTL) { it.det = c.det; it.loading = false; drawItemDet(it); nextDetails(); return; }
    detBusy = true;
    itemDetails(it.code).then(function (det) {
      it.det = det;
      detCache[it.code] = { t: Date.now(), det: det };
    }, function () { it.err = true; }).then(function () {
      it.loading = false;
      detBusy = false;
      drawItemDet(it);
      nextDetails();
    });
  }
  function fmtQty(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 }); }
  function copyCode(code) {
    var ok = function () { toast('نُسخ رمز الصنف ' + code, 'ok'); };
    var old = function () {
      var t = el('textarea');
      t.value = code;
      t.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(t);
      t.select();
      try { if (document.execCommand('copy')) ok(); } catch (e) { /* ignore */ }
      t.remove();
    };
    try { navigator.clipboard.writeText(code).then(ok, old); } catch (e) { old(); }
  }
  /* item card: name + code on the right, retail price and cost on the left, stock per branch below */
  function drawItemDet(it) {
    var p = it.pbox, b = it.box, d = it.det;
    if (!p || !b) return;
    p.textContent = '';
    b.textContent = '';
    var retail = d && d.retail != null ? d.retail : it.price;
    var below = !!(d && d.cost > 0 && retail != null && retail < d.cost - 0.005);
    p.classList.toggle('zod-ibelow', below);
    p.appendChild(el('div', 'zod-ilabel', 'سعر التجزئة' + (d && d.unit ? ' / ' + d.unit : '')));
    p.appendChild(el('div', 'zod-iretail', retail != null ? fmtAmount(retail) : '—'));
    if (d && d.cost != null) {
      var c = el('div', 'zod-icost', 'التكلفة ');
      c.appendChild(el('b', null, fmtAmount(d.cost)));
      p.appendChild(c);
      if (below) p.appendChild(el('div', 'zod-iwarn', 'السعر أقل من التكلفة'));
    } else if (it.loading) {
      p.appendChild(el('div', 'zod-icost', 'التكلفة …'));
    }
    if (d) {
      var total = 0;
      d.stock.forEach(function (w) {
        total += w.qty;
        var s = el('span', 'zod-wh' + (w.qty < 0 ? ' zod-whneg' : w.qty ? '' : ' zod-wh0'));
        s.appendChild(document.createTextNode(w.name.replace(/^\s*فرع\s+/, '') + ' '));
        s.appendChild(el('b', null, fmtQty(w.qty)));
        b.appendChild(s);
      });
      if (!d.stock.length) b.appendChild(el('span', 'zod-iwait', 'لا يوجد مخزون مسجّل لهذا الصنف'));
      else b.appendChild(el('span', 'zod-whsum', 'المجموع ' + fmtQty(total)));
    } else {
      b.appendChild(el('span', 'zod-iwait' + (it.loading ? ' zod-iload' : ''), it.loading ? 'جارٍ جلب التكلفة والمخزون…' : it.err ?
        'تعذّر الجلب، اضغط للمحاولة مرة أخرى' : 'اضغط لعرض التكلفة والمخزون في كل فرع'));
    }
  }
  function section(text, small) {
    var h = el('div', 'zod-jsec', text);
    if (small) h.appendChild(el('small', null, small));
    return h;
  }
  /* "has results": the hint under the search box makes room */
  function markResults() {
    if (jump) jump.classList.toggle('zod-jhasres', jResults.length > 0 || !!(jItems && jItems.length) || !!(jCustBox && jCustBox.firstChild));
  }

  /* ----- customers have their own search (F8): here only a line that opens it ----- */
  var jCusts = null, jCustBox = null;   // jCusts stays null: no customers in this list
  // a mobile (05xxxxxxxx, 9665xxxxxxxx) or a VAT number (15 digits, 3...3): a customer, not an item
  var CUST_NUM = /^(?:00966|966|0)?5\d{8}$|^3\d{13}3$/;
  function custDigits() { return latinDigits(iNorm()).replace(/[\s\-+().\/]/g, ''); }
  function custQuery() {   // could this be a customer search? (short numbers are documents, items or customer codes)
    var term = iNorm(), dq = custDigits();
    if (!term) return false;
    return /^\d+$/.test(dq) ? dq.length >= 7 : term.length >= 2 && !DOC_SHAPE.test(jNorm());
  }
  function canPickCustomer() {
    var box = $id('cpBulk_cpForm_CustomerCode');
    return !!(CUR && CUR.k === 'si' && editing() && box && vis(box) && !box.disabled && !box.readOnly);
  }
  function drawCusts() {   // "ابحث عن «…» في العملاء  F8"
    if (!jCustBox) return;
    jCustBox.textContent = '';
    var term = iNorm();
    if (jLastQ && custQuery()) {
      var b = el('div', 'zod-jrow zod-jgo');
      b.tabIndex = 0;
      b.setAttribute('role', 'button');
      b.__zgo = term;
      b.appendChild(el('span', 'zod-jtype zod-jt-cu', 'عميل'));
      b.appendChild(el('span', 'zod-jgotext', 'ابحث عن «' + term + '» في العملاء'));
      var kb = el('kbd', 'zod-jgokey', 'F8');
      kb.dir = 'ltr';
      b.appendChild(kb);
      b.title = 'بحث العملاء منفصل: اضغط هنا أو F8';
      b.addEventListener('click', function () { toggleCusts(true, term); });
      jCustBox.appendChild(b);
    }
    markResults();
  }
  function drawItems() {
    if (!jItemsBox) return;
    jItemsBox.textContent = '';
    markResults();
    if (!jItems || !jItems.length) return;
    jItemsBox.appendChild(section('الأصناف (' + (jItems.length >= 100 ? '100+' : jItems.length) + ')', 'السعر بدون ضريبة'));
    jItems.slice(0, ITEM_MAX).forEach(function (it, i) {
      var r = el('div', 'zod-irow');
      r.tabIndex = 0;
      r.setAttribute('role', 'button');
      r.__zi = it;
      var main = el('div', 'zod-imain');
      main.appendChild(el('div', 'zod-iname', it.name));
      var sub = el('div', 'zod-isub');
      var code = el('bdi', 'zod-icode', it.code);
      code.dir = 'ltr';
      sub.appendChild(code);
      var cp = el('button', 'zod-icopy', 'نسخ الرمز');
      cp.type = 'button';
      cp.title = 'نسخ رمز الصنف للصقه في نافذة الصنف';
      cp.addEventListener('click', function (ev) { ev.stopPropagation(); copyCode(it.code); });
      sub.appendChild(cp);
      main.appendChild(sub);
      r.appendChild(main);
      it.pbox = el('div', 'zod-iprice');
      r.appendChild(it.pbox);
      it.box = el('div', 'zod-istock');
      r.appendChild(it.box);
      r.title = 'اضغط لعرض التكلفة والمخزون';
      r.addEventListener('click', function () { queueDetails(it, true); });
      jItemsBox.appendChild(r);
      drawItemDet(it);
      if (i < ITEM_AUTO) queueDetails(it, false);
    });
    if (jItems.length > ITEM_MAX) jItemsBox.appendChild(el('div', 'zod-imore', 'تظهر أول ' + ITEM_MAX + ' أصناف، اكتب أكثر لتضييق البحث'));
  }

  /* auto = started by typing (results only); otherwise Enter: a single result opens */
  function search(auto) {
    clearTimeout(jTimer);
    var q = jNorm(), term = iNorm();
    detQueue = [];
    if (!q) { jLastQ = ''; jResults = []; jItems = null; jCusts = null; drawResults(); drawItems(); drawCusts(); jSay(''); return; }
    if (q === jBusy) { if (!auto) jOpenAfter = true; return; }   // the same search is already running
    jLastQ = q;
    jBusy = q;
    jOpenAfter = !auto;
    jResults = [];
    jItems = null;
    jCusts = null;
    drawResults();
    drawItems();
    drawCusts();
    jSay('جارٍ البحث…', true);
    // 9 digits or more is a mobile, VAT, CR number or barcode, not an invoice / return number
    var wantDocs = DOC_SHAPE.test(q) && !/^\d{9,}$/.test(q), wantItems = term.length >= 2 && !knownDocPrefix(q) && !CUST_NUM.test(custDigits());
    var docsDone = !wantDocs, itemsDone = !wantItems, failed = false;
    function status() {
      if (docsDone && itemsDone && jBusy === q) jBusy = '';
      if (q !== jLastQ) return;
      var nd = jResults.length, ni = jItems ? jItems.length : 0, nc = jCusts ? jCusts.items.length : 0, busy = !docsDone || !itemsDone;
      if (nd) jSay(nd === 1 ? 'اضغط المستند لفتحه، أو «↩ إرجاع» لعمل مرتجع' : 'أكثر من مستند، اختر واحداً', busy);
      else if (busy) jSay('جارٍ البحث…', true);
      else if (ni || nc) jSay('');
      else if (failed) jSay('تعذّر البحث، تأكد من تسجيل الدخول ثم حاول مرة أخرى');
      else jSay(notFound());
    }
    function notFound() {
      var cq = custQuery(), what = [];
      if (wantDocs) what.push('مستند');
      if (wantItems) what.push('صنف');
      var msg = what.length ? 'لا يوجد ' + what.join(' ولا ') + (/^\d+$/.test(custDigits()) ? ' بهذا الرقم' : ' بهذا الاسم أو الرقم') : '';
      if (wantDocs && !wantItems && !cq) msg = 'لا يوجد مستند بهذا الرقم في السنة المالية المختارة';
      if (cq) msg = (msg ? msg + ' · ' : '') + 'للبحث في العملاء: Enter أو F8';
      return msg;
    }
    if (wantItems) {   // sent first: SMACC answers in order, and an item search is one quick call
      itemSearch(term).then(function (items) {
        if (q !== jLastQ) return;
        jItems = items;
        drawItems();
      }, function () { failed = true; }).then(function () { itemsDone = true; status(); });
    }
    if (!wantDocs) { if (!wantItems) status(); return; }
    getPrefixes().then(function (p) {
      var jobs = [], plan = DOCS.map(function (d) { return [d, candidates(q, p[d.k])]; });
      if (!plan.some(function (x) { return x[1].length; })) {   // unknown prefix (e.g. last year's): try it everywhere
        plan = DOCS.map(function (d) { return [d, [q.replace(/^([A-Z]+)(\d+)$/, '$1-$2')]]; });
      }
      plan.forEach(function (x) {
        var d = x[0];
        x[1].forEach(function (c) {
          jobs.push(listSearch(d.url, d.field, c, 5).then(function (rows) {
            return rows.map(function (x) {
              return { d: d, no: String(x[d.field] || '').trim(), date: x[d.date], who: String(x[d.who] || '').trim(), net: x.NetAmount };
            });
          }).catch(function () { return null; }));
        });
      });
      return Promise.all(jobs);
    }).then(function (lists) {
      docsDone = true;
      if (q !== jLastQ) { status(); return; }
      var seen = {};
      if (lists.some(function (l) { return l === null; })) failed = true;
      jResults = [];
      lists.forEach(function (l) {
        (l || []).forEach(function (r) {
          var k = r.d.k + '|' + r.no;
          if (r.no && !seen[k]) { seen[k] = 1; jResults.push(r); }
        });
      });
      drawResults();
      if (jResults.length === 1 && jOpenAfter) {
        if (jBusy === q) jBusy = '';
        jSay('جارٍ الفتح…', true);
        openResult(jResults[0], false);
        return;
      }
      status();
    }).catch(function () {
      docsDone = true;
      failed = true;
      status();
    });
  }
  function jSay(text, busy) {
    jStatus.textContent = text || '';
    jStatus.classList.toggle('zod-jbusy', !!busy);
  }
  function glassIcon() {   // magnifier drawn as SVG (no image files)
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'zod-jglass');
    s.setAttribute('aria-hidden', 'true');
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '10.5');
    c.setAttribute('cy', '10.5');
    c.setAttribute('r', '6.5');
    var l = document.createElementNS(NS, 'path');
    l.setAttribute('d', 'M15.5 15.5 L21 21');
    [c, l].forEach(function (x) {
      x.setAttribute('fill', 'none');
      x.setAttribute('stroke', 'currentColor');
      x.setAttribute('stroke-width', '2.2');
      x.setAttribute('stroke-linecap', 'round');
      s.appendChild(x);
    });
    return s;
  }
  function buildJump() {
    jump = el('div', 'zod-jump');
    jump.dir = 'rtl';
    var head = el('div', 'zod-jhead');
    head.appendChild(el('span', 'zod-jtitle', 'بحث سريع'));
    head.appendChild(el('span', 'zod-jsub', 'فواتير · مرتجعات · أسعار ومخزون الأصناف'));
    var x = el('button', 'zod-jclose', '×');
    x.type = 'button';
    x.title = 'إغلاق (Esc)';
    x.addEventListener('click', function () { toggleJump(false); });
    head.appendChild(x);
    jump.appendChild(head);
    var body = el('div', 'zod-jbody');
    var field = el('div', 'zod-jfield');
    field.appendChild(glassIcon());
    jInput = el('input', 'zod-jinput');
    jInput.type = 'text';
    jInput.dir = 'auto';   // numbers left to right, item names in Arabic right to left
    jInput.autocomplete = 'off';
    jInput.spellcheck = false;
    jInput.placeholder = 'رقم فاتورة أو مرتجع، أو اسم صنف أو رمزه';
    field.appendChild(jInput);
    var wipe = el('button', 'zod-jx', '×');
    wipe.type = 'button';
    wipe.title = 'مسح';
    wipe.addEventListener('click', function () {
      jInput.value = '';
      field.classList.remove('zod-jfilled');
      search(true);
      jInput.focus();
    });
    field.appendChild(wipe);
    body.appendChild(field);
    jInput.addEventListener('input', function () {   // search by itself shortly after typing stops
      field.classList.toggle('zod-jfilled', !!jInput.value);
      clearTimeout(jTimer);
      var q = jNorm();
      if (q.length < 3) { if (!q) search(true); return; }
      jTimer = setTimeout(function () { search(true); }, 450);
    });
    var hint = el('div', 'zod-jhint');
    [['فاتورة أو مرتجع: ', 'INV-106048 · 0002-2644 · 106048 (يكفي الرقم بدون البادئة)'],
      ['عميل: ', 'له بحث خاص: F8 أو زر العميل أسفل الشاشة'],
      ['صنف: ', 'جرس ريموت · 020004 (السعر والتكلفة والمخزون في كل فرع)']].forEach(function (h) {
      var row = el('div');
      row.appendChild(el('b', null, h[0]));
      row.appendChild(document.createTextNode(h[1]));
      hint.appendChild(row);
    });
    body.appendChild(hint);
    jStatus = el('div', 'zod-jstatus');
    body.appendChild(jStatus);
    var scroll = el('div', 'zod-jscroll');   // documents and items scroll together; the search box stays in view
    jList = el('div', 'zod-jlist');
    scroll.appendChild(jList);
    jItemsBox = el('div', 'zod-ilist');
    scroll.appendChild(jItemsBox);
    jCustBox = el('div', 'zod-jlist zod-clist');   // last: "ابحث في العملاء"
    scroll.appendChild(jCustBox);
    body.appendChild(scroll);
    jump.appendChild(body);
    var help = el('details', 'zod-jhelp');
    help.open = lsGet('jhelp') === '1';
    help.addEventListener('toggle', function () { lsSet('jhelp', help.open ? '1' : '0'); });
    help.appendChild(el('summary', null, 'اختصارات لوحة المفاتيح'));
    [['F2', 'مستند جديد · في الفواتير: فاتورة جديدة ثم نافذة الصنف مباشرة (أو إضافة صنف للفاتورة المفتوحة)'], ['Ctrl+S', 'حفظ'], ['F3', 'إضافة صنف'], ['Ctrl+Enter', 'إضافة ومتابعة (في نافذة الصنف)'],
      ['F4', 'صنف جديد (في نافذة الصنف) · نسخ الصنف (في بطاقة الصنف)'], ['Ctrl+K', 'هذا البحث'], ['F8', 'بحث العملاء وفاتورة جديدة للعميل'], ['↓ ↑', 'التنقل بين النتائج'], ['Esc', 'إغلاق البحث']]
      .forEach(function (s) {
        var row = el('div');
        var kbd = el('kbd', null, s[0]);
        kbd.dir = 'ltr';
        row.appendChild(kbd);
        row.appendChild(document.createTextNode(' ' + s[1]));
        help.appendChild(row);
      });
    var clr = linkLike(el('a', 'zod-jclear', 'تحديث ذاكرة السرعة'));
    clr.title = 'يمسح ما حفظته الإضافة على هذا الجهاز (نصوص الشاشات والإعدادات والخصم وبيانات الأصناف وأسعارها ومخزونها)، فيُطلب من SMACC من جديد';
    clr.addEventListener('click', function (e) {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent('zod:trclear'));
      toast('تم. ستُطلب نصوص الشاشات والإعدادات والأسعار والمخزون من SMACC من جديد', 'ok');
    });
    help.appendChild(clr);
    jump.appendChild(help);
    document.body.appendChild(jump);
  }
  function toggleJump(open) {
    if (!document.body) return;
    if (!jump) buildJump();
    jump.classList.toggle('zod-jopen', !!open);
    if (open && cpan) cpan.classList.remove('zod-jopen');   // one window at a time
    if (open) {
      loadRets();
      jInput.focus();
      jInput.select();
      var C = window.__zodCust;   // the customer list (cust.js): ready for the next search
      if (C && !C.ready()) C.ensure();   // zod:custready redraws when the list is here
    }
  }
  function buildFab() {
    var b = el('button', 'zod-fab', '⌕');
    b.type = 'button';
    b.title = 'بحث سريع برقم الفاتورة أو المرتجع، أو باسم الصنف لمعرفة سعره وتكلفته ومخزونه (Ctrl+K)\nبحث العملاء: F8 أو الزر بجانبه\nواختصارات: F2 جديد / إضافة صنف · Ctrl+S حفظ · F3 إضافة صنف';
    b.addEventListener('click', function () { toggleJump(!(jump && jump.classList.contains('zod-jopen'))); });
    document.body.appendChild(b);
    var cbtn = el('button', 'zod-fab zod-fab-cust');
    cbtn.type = 'button';
    cbtn.appendChild(personIcon());
    cbtn.title = 'بحث العملاء بالاسم أو الجوال أو الرقم الضريبي أو السجل التجاري، وفاتورة مبيعات جديدة للعميل (F8)';
    cbtn.addEventListener('click', function () { toggleCusts(!custOpen()); });
    document.body.appendChild(cbtn);
  }

  /* ---------- 5b. customer search (F8 or the person button): a new sales invoice for the customer ----------
     Its own window, apart from the quick search: by name, mobile, VAT, CR number or code, from the customer
     list on this computer (cust.js), so customers show while typing. Enter (first customer, or the one chosen
     with the arrows) or a click:
     - on a new sales invoice being added here: puts the customer on it, then the item window if it has no item
     - anywhere else: a new sales invoice with that customer, then the item window, as F2 does (in a new tab
       while a document is being added or edited here, so it is not lost)
     Ctrl + Enter, Ctrl + click, middle click or "بطاقة": the customer's card in a new tab. */
  var cpan = null, cInput = null, cList = null, cStatus = null, cTimer = 0, cFound = null, cLastQ = null, C_MAX = 30;
  var pickedCust = '';   // the next new sales invoice made by F2 gets this customer instead of نقدي
  function custOpen() { return !!(cpan && cpan.classList.contains('zod-jopen')); }
  function cardOf(x) { openTab('/Inventory/CustomersPage.aspx#zod-open=' + encodeURIComponent(x.c)); }
  function gridHasItems() {   // main.js asks SMACC (IsRecordExistsInGrid) and answers on <html> at once
    jq('grid');
    return document.documentElement.getAttribute('data-zod-grid') === '1';
  }
  function invoiceFor(x, card) {
    if (card) { cardOf(x); return; }
    toggleCusts(false);
    var url = '/Inventory/SalesInvoicePage.aspx#zod-new=' + encodeURIComponent(x.c);
    if (CUR && CUR.k === 'si') {
      if (adding() && canPickCustomer()) {   // a new invoice is open here: the customer goes on it
        var items = gridHasItems();
        jq('blur', '#cpBulk_cpForm_CustomerCode', x.c);   // as if the code was typed in the customer box
        toast('العميل في الفاتورة: ' + x.c + ' · ' + x.n, 'ok');
        if (items || itemWindow()) return;
        waitFor(function () { return !adding() ? 'gone' : headerReady(); }, 4000, 30).then(function (r) {
          if (r && r !== 'gone' && adding() && !itemWindow()) doItem();
        });
        return;
      }
      if (editing()) { openTab(url); toast('فاتورة جديدة للعميل في تبويب جديد (المستند المفتوح هنا كما هو)', 'ok'); return; }
      pickedCust = x.c;
      toast('فاتورة جديدة للعميل: ' + x.c + ' · ' + x.n, 'ok');
      doF2();
      return;
    }
    if (editing()) { openTab(url); toast('فاتورة جديدة للعميل في تبويب جديد (المستند المفتوح هنا كما هو)', 'ok'); return; }
    location.href = url;
  }
  function personIcon() {   // drawn as SVG (no image files)
    var NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'zod-fabicon');
    s.setAttribute('aria-hidden', 'true');
    var c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '12');
    c.setAttribute('cy', '8');
    c.setAttribute('r', '4');
    var l = document.createElementNS(NS, 'path');
    l.setAttribute('d', 'M4.5 20.5c0-4.2 3.4-6.5 7.5-6.5s7.5 2.3 7.5 6.5');
    [c, l].forEach(function (x) {
      x.setAttribute('fill', 'none');
      x.setAttribute('stroke', 'currentColor');
      x.setAttribute('stroke-width', '2.2');
      x.setAttribute('stroke-linecap', 'round');
      s.appendChild(x);
    });
    return s;
  }
  function cSay(text, busy) {
    cStatus.textContent = text || '';
    cStatus.classList.toggle('zod-jbusy', !!busy);
  }
  function custRowEl(x, first, into) {
    var b = el('div', 'zod-jrow zod-jcust' + (first ? ' zod-jfirst' : ''));
    b.tabIndex = 0;
    b.setAttribute('role', 'button');
    b.__zc = x;
    var no = el('bdi', 'zod-jno', x.c);
    no.dir = 'ltr';
    b.appendChild(no);
    b.appendChild(el('span', 'zod-jcname' + (x.h === 'n' ? ' zod-chit' : ''), x.n));
    if (x.d) { var d = el('span', 'zod-cdup', 'مكرر'); d.title = x.d; b.appendChild(d); }
    if (x.s) b.appendChild(el('span', 'zod-cstop', 'موقوف'));
    var card = el('button', 'zod-jact zod-jcard', 'بطاقة');
    card.type = 'button';
    card.tabIndex = -1;
    card.title = 'فتح بطاقة العميل في تبويب جديد';
    card.addEventListener('click', function (ev) { ev.stopPropagation(); cardOf(x); });
    b.appendChild(card);
    var meta = el('span', 'zod-jmeta');
    [['p', 'جوال', x.p], ['v', 'ضريبي', x.v], ['r', 'سجل', x.r], ['o', x.ol, x.o]].forEach(function (f) {
      if (!f[2]) return;
      var s = el('span', 'zod-cf' + (x.h === f[0] ? ' zod-chit' : ''), f[1] + ' ');
      var v = el('bdi', null, f[2]);
      v.dir = 'ltr';
      s.appendChild(v);
      meta.appendChild(s);
    });
    if (x.d) meta.appendChild(el('span', 'zod-cduptext', x.d));
    if (meta.firstChild) b.appendChild(meta);
    b.title = (into ? 'اضغط لوضع هذا العميل في الفاتورة المفتوحة' : 'اضغط لعمل فاتورة مبيعات جديدة لهذا العميل') + ' · Ctrl + ضغط: بطاقة العميل';
    b.addEventListener('click', function (ev) { invoiceFor(x, ev.ctrlKey || ev.metaKey); });
    b.addEventListener('auxclick', function (ev) { if (ev.button === 1) { ev.preventDefault(); cardOf(x); } });
    return b;
  }
  function custSearch() {
    clearTimeout(cTimer);
    if (!cpan) return;
    var C = window.__zodCust, term = cInput.value.trim(), dq = latinDigits(term).replace(/[\s\-+().\/]/g, '');
    cLastQ = term;
    cFound = null;
    cList.textContent = '';
    if (!term) { cSay(''); return; }
    if (!C) { cSay('بحث العملاء غير متاح في هذه الصفحة'); return; }
    if (!C.ready()) {
      C.ensure();
      var pg = C.progress && C.progress();
      cSay('قائمة العملاء قيد التحميل لأول مرة' + (pg && pg.total ? ' (' + pg.got + ' من ' + pg.total + ')' : '') +
        '… تظهر النتائج هنا عند جاهزيتها', true);
      return;
    }
    if (!/^\d+$/.test(dq) && term.length < 2) { cSay('اكتب حرفين على الأقل'); return; }
    var r = C.search(term, C_MAX);
    cFound = r;
    if (!r || !r.items.length) {
      cSay('لا يوجد عميل بهذا الاسم أو الرقم');
      if (C.fresh) C.fresh();   // maybe added a moment ago on another computer (zod:custnew searches again)
      return;
    }
    cSay('');
    var into = adding() && canPickCustomer();
    cList.appendChild(section('العملاء (' + r.total + ')', into ? 'Enter أو ضغط: يوضع في الفاتورة المفتوحة' : 'Enter أو ضغط: فاتورة مبيعات جديدة له'));
    r.items.forEach(function (x, i) { cList.appendChild(custRowEl(x, i === 0, into)); });
    if (r.total > r.items.length) cList.appendChild(el('div', 'zod-imore', 'يظهر أول ' + r.items.length + ' عميل، اكتب أكثر لتضييق البحث'));
  }
  function custAgain() {   // the list came in (or new customers): search again, unless customers are shown
    if (custOpen() && cLastQ && !(cFound && cFound.items.length)) custSearch();
  }
  document.addEventListener('zod:custready', custAgain);
  document.addEventListener('zod:custprog', custAgain);
  document.addEventListener('zod:custnew', custAgain);
  function buildCusts() {
    cpan = el('div', 'zod-jump zod-cpan');
    cpan.dir = 'rtl';
    var head = el('div', 'zod-jhead');
    head.appendChild(el('span', 'zod-jtitle', 'بحث العملاء'));
    head.appendChild(el('span', 'zod-jsub', 'الاسم · الجوال · الرقم الضريبي · السجل التجاري · الرمز'));
    var x = el('button', 'zod-jclose', '×');
    x.type = 'button';
    x.title = 'إغلاق (Esc)';
    x.addEventListener('click', function () { toggleCusts(false); });
    head.appendChild(x);
    cpan.appendChild(head);
    var body = el('div', 'zod-jbody');
    var field = el('div', 'zod-jfield');
    field.appendChild(glassIcon());
    cInput = el('input', 'zod-jinput');
    cInput.type = 'text';
    cInput.dir = 'auto';
    cInput.autocomplete = 'off';
    cInput.spellcheck = false;
    cInput.placeholder = 'اسم العميل، أو جواله، أو رقمه الضريبي، أو سجله التجاري';
    field.appendChild(cInput);
    var wipe = el('button', 'zod-jx', '×');
    wipe.type = 'button';
    wipe.title = 'مسح';
    wipe.addEventListener('click', function () {
      cInput.value = '';
      field.classList.remove('zod-jfilled');
      custSearch();
      cInput.focus();
    });
    field.appendChild(wipe);
    body.appendChild(field);
    cInput.addEventListener('input', function () {   // from this computer: results while typing
      field.classList.toggle('zod-jfilled', !!cInput.value);
      clearTimeout(cTimer);
      cTimer = setTimeout(custSearch, 120);
    });
    cStatus = el('div', 'zod-jstatus');
    body.appendChild(cStatus);
    var scroll = el('div', 'zod-jscroll');
    cList = el('div', 'zod-jlist zod-clist');
    scroll.appendChild(cList);
    body.appendChild(scroll);
    cpan.appendChild(body);
    var foot = el('div', 'zod-jhelp zod-cfoot');
    [['Enter', 'فاتورة مبيعات جديدة للعميل'], ['Ctrl+Enter', 'بطاقة العميل'], ['↓ ↑', 'التنقل'], ['Esc', 'إغلاق']].forEach(function (k) {
      var row = el('span');
      var kbd = el('kbd', null, k[0]);
      kbd.dir = 'ltr';
      row.appendChild(kbd);
      row.appendChild(document.createTextNode(' ' + k[1]));
      foot.appendChild(row);
    });
    cpan.appendChild(foot);
    document.body.appendChild(cpan);
  }
  function toggleCusts(open, pre) {
    if (!document.body) return;
    if (!cpan) buildCusts();
    if (open && jump) jump.classList.remove('zod-jopen');   // one window at a time
    cpan.classList.toggle('zod-jopen', !!open);
    if (!open) return;
    if (pre) cInput.value = pre;
    cInput.parentNode.classList.toggle('zod-jfilled', !!cInput.value);
    cInput.focus();
    cInput.select();
    custSearch();
  }

  /* ---------- 6. stay logged in ----------
     SMACC logs out in two ways:
     a) its server forgets the login after a while without requests. While SMACC is being used (mouse or
        keys in any SMACC tab in the last 4 hours) ask SMACC for one line of a small list every 4 minutes,
        the same request its own list pages make. One SMACC tab does it for all of them.
     b) its own timer in every page: after 500 seconds (about 8 minutes) without mouse or keys in any
        SMACC tab it shows "تحذير مهلة الجلسة" with a 1-minute countdown, then logs every tab out. It
        keeps the time of the last use in its "lastactivity" cookie, updated by its own listener for the
        made-up event "mouseclick" (with mousemove, keydown…). Firing that event tells SMACC it is in use;
        nothing else on the page listens to it. If the warning shows anyway (e.g. after the computer
        slept), press SMACC's own "متابعة".
     Both stop after 4 hours without use, so SMACC then logs out as usual. */
  var KA_EVERY = 4 * 60 * 1000, KA_IDLE = 4 * 60 * 60 * 1000, kaDead = false, actSaved = 0;
  function markActive(e) {
    if (e && e.isTrusted === false) return;   // only real mouse / keys count
    var now = Date.now();
    if (now - actSaved < 30000) return;
    actSaved = now;
    lsSet('ka|act', String(now));
  }
  function inUse() { return Date.now() - (Number(lsGet('ka|act')) || 0) <= KA_IDLE; }
  function keepAlive() {
    if (kaDead) return;
    var now = Date.now();
    if (!inUse()) return;   // not used for 4 hours: let SMACC log out
    if (now - (Number(lsGet('ka|last')) || 0) < KA_EVERY - 20000) return;   // another SMACC tab just did it
    lsSet('ka|last', String(now));
    listCall('/Inventory/PurchaseReturnPage.aspx', '0', '', 1, 1).catch(function () {
      kaDead = true;   // already logged out (or no access): stop until the next page
    });
  }
  function holdTimer() {
    if (!inUse()) return;
    var box = $id('TheTimerContainer');
    if (!box) return;   // this SMACC page has no session timer
    window.dispatchEvent(new Event('mouseclick'));   // SMACC: "in use now"
    if (box.classList.contains('in')) {   // the warning is already showing: "متابعة"
      var ok = firstVisible('.okTimerDialog', box);
      if (ok && !ok.disabled) ok.click();
    }
  }
  function startKeepAlive() {
    ['keydown', 'mousedown', 'mousemove', 'wheel', 'touchstart'].forEach(function (t) {
      window.addEventListener(t, markActive, { capture: true, passive: true });
    });
    markActive();   // opening a page counts as using SMACC
    setInterval(keepAlive, 60000);
    setInterval(holdTimer, 20000);
  }

  /* ---------- 7. label at the top left: animated, a click opens the quick search ---------- */
  function buildBadge() {
    var v = '';
    try { v = chrome.runtime.getManifest().version; } catch (e) { /* ignore */ }
    var b = el('button', 'zod-badge');
    b.type = 'button';
    b.dir = 'ltr';
    var t = el('span', 'zod-btext');
    ('made by ' + MADE_BY).split('').forEach(function (ch, i) {   // one span per letter: a wave runs through them
      var s = el('span', 'zod-bch', ch === ' ' ? '\u00a0' : ch);
      s.style.animationDelay = (i * 0.06).toFixed(2) + 's';
      t.appendChild(s);
    });
    b.appendChild(t);
    if (v) b.appendChild(el('span', 'zod-bver', '· v' + v));
    b.title = 'ZOD - أدوات SMACC' + (v ? ' الإصدار ' + v : '') + ' — اضغط لعرض البحث السريع والاختصارات';
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });   // the SMACC field keeps its focus
    var tm = 0, want = true;
    b.addEventListener('click', function (e) {
      clearTimeout(tm);
      if (e.detail === 3) {   // bg.js
        if (jump) toggleJump(false);
        try { chrome.runtime.sendMessage({ zod: 'w' }, function () { void chrome.runtime.lastError; }); } catch (err) { /* add-on reloaded */ }
        return;
      }
      if (e.detail > 3) return;
      if (e.detail < 2) want = !(jump && jump.classList.contains('zod-jopen'));   // a second quick click: the same
      tm = setTimeout(function () { toggleJump(want); }, e.detail ? 320 : 0);
    });
    document.body.appendChild(b);
    try {   // left by 3.3.11 / 3.3.12
      ['zod|fx|top', 'zod|fx|snd', 'zod|game|top', 'zod|game|snd'].forEach(function (x) { localStorage.removeItem(x); });
      ['zod|fx|run', 'zod|game|run'].forEach(function (x) { sessionStorage.removeItem(x); });
    } catch (e) { /* ignore */ }
  }

  /* ---------- 8. drafts: several new sales invoices at once, each in its own tab ----------
     A bar at the top of the sales invoice screen. "+" keeps the invoice being made here as it is (a draft, in this
     tab) and opens a new sales invoice in a tab next to it, with F2 done there (salesperson, warehouse, نقدي and the
     item window); up to 5 invoices open at once. With another invoice open in another tab, every open invoice shows
     as a button with its number, customer, items and total: a click goes to its tab (Ctrl+Tab works too).
     After a NEW invoice is saved here (not an edit), if another new invoice is open in another tab, this tab closes
     after 3 seconds and the last one used comes up (the print SMACC opens after the save stays in front);
     "إبقاء مفتوحة" keeps it open. The last open invoice's tab never closes. With no invoice open here, "+" is F2.
     bg.js keeps the list of tabs. SMACC keeps an invoice being made in its own page until حفظ, which sends the header
     and the items together, so the tabs do not mix; and Chrome is told not to unload a tab with an invoice open. */
  var DR_MAX = 5, drBar = null, drList = {}, drMe = null, drSent = '', drNewUntil = 0, drClosing = false, drBox = null;
  function drState() {
    if (adding()) { drNewUntil = 0; return 'add'; }
    if (editing()) return 'edit';
    return Date.now() < drNewUntil ? 'new' : 'view';   // a "+" tab whose F2 is not done yet
  }
  function drItems() {   // main.js counts the items in SMACC's grid and answers on <html> at once
    jq('dr');
    var a = null;
    try { a = JSON.parse(document.documentElement.getAttribute('data-zod-dr') || 'null'); } catch (e) { a = null; }
    return { n: a ? Number(a.n) || 0 : 0, t: a ? Number(a.t) || 0 : 0 };
  }
  function drInfo() {
    var o = { st: drState(), cust: '', items: 0, tot: 0, no: '', vis: document.visibilityState === 'visible' };
    if (o.st === 'add' || o.st === 'edit') {
      var a = drItems();
      o.items = a.n;
      o.tot = a.t;
      o.cust = val('cpBulk_cpForm_CustomerName').slice(0, 60);
      o.no = val('cpBulk_cpForm_InvoiceNumber');
    }
    return o;
  }
  function drSend(m, cb) {
    try {
      chrome.runtime.sendMessage(m, function (r) {
        void chrome.runtime.lastError;
        if (cb) cb(r || null);
      });
    } catch (e) { if (cb) cb(null); }   // the add-on was updated: this page no longer reaches it
  }
  function drTake(r) {
    if (!r || !r.list) return;
    drList = r.list;
    if (r.me != null) drMe = Number(r.me);
    drDraw();
  }
  function drTick() {
    if (drClosing) return;
    var s = JSON.stringify(drInfo());
    if (s === drSent) return;
    drSent = s;
    drSend({ zod: 'd', op: 'put', info: JSON.parse(s) }, drTake);
  }
  function drOpenList() {   // the tabs with an invoice open, by draft number
    return Object.keys(drList).map(function (k) {
      var e = drList[k] || {};
      return { id: Number(k), n: e.n, st: e.st, cust: e.cust, items: e.items, tot: e.tot, no: e.no, act: e.act };
    }).filter(function (e) {
      return e.st === 'add' || e.st === 'edit' || e.st === 'new';
    }).sort(function (a, b) { return (a.n || 99) - (b.n || 99); });
  }
  function drName(e) {
    if (e.st === 'new') return 'فاتورة جديدة…';
    if (e.st === 'edit') return 'تعديل ' + (e.no || '');
    return e.cust || 'بدون عميل';
  }
  function drChip(e) {
    var me = e.id === drMe;
    var b = el('button', 'zod-dchip' + (me ? ' zod-don' : ''));
    b.type = 'button';
    b.appendChild(el('span', 'zod-dnum', String(e.n || '')));
    b.appendChild(el('span', 'zod-dname', drName(e)));
    if (e.st !== 'new') b.appendChild(el('span', 'zod-dsub', e.items ? 'أصناف ' + e.items + ' · ' + fmtAmount(e.tot) : 'فارغة'));
    b.title = 'المسودة ' + (e.n || '') + ': ' + drName(e) +
      (e.st === 'new' ? '' : '، الأصناف ' + (e.items || 0) + '، الإجمالي ' + fmtAmount(e.tot || 0)) +
      (me ? ' (هذا التبويب)' : ' — اضغط للانتقال إليها');
    b.addEventListener('mousedown', function (ev) { ev.preventDefault(); });   // the SMACC field keeps its focus
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (!me) drSend({ zod: 'd', op: 'go', tab: e.id });
    });
    return b;
  }
  function drDraw() {
    if (!drBar) return;
    var open = drOpenList(), here = adding() || editing();
    var others = open.filter(function (e) { return e.id !== drMe; });
    drBar.textContent = '';
    drBar.classList.toggle('zod-dhide', !here && !others.length);   // no invoice open anywhere: SMACC's own buttons
    if (others.length) open.forEach(function (e) { drBar.appendChild(drChip(e)); });
    var p = el('button', 'zod-dplus' + (others.length ? '' : ' zod-dplus-wide'), others.length ? '+' : '+ مسودة جديدة');
    p.type = 'button';
    p.title = here
      ? 'مسودة جديدة: تبقى هذه الفاتورة كما هي في تبويبها، وتُفتح فاتورة جديدة في تبويب بجانبه (حتى ' + DR_MAX +
        ' فواتير مفتوحة). بعد حفظ فاتورة جديدة يُغلق تبويبها وتظهر الفاتورة المفتوحة الأخرى'
      : 'فاتورة جديدة في هذا التبويب (F2)';
    p.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    p.addEventListener('click', function (ev) { ev.preventDefault(); drPlus(); });
    drBar.appendChild(p);
  }
  function drMaxMsg() { return 'مفتوحة ' + DR_MAX + ' فواتير الآن: احفظ إحداها أو أغلق تبويبها أولاً'; }
  function drPlus() {
    if (!(adding() || editing())) { doF2(); return; }   // nothing open here: a new invoice in this tab
    if (drOpenList().length >= DR_MAX) { toast(drMaxMsg()); return; }
    drSend({ zod: 'd', op: 'new' }, function (r) {
      if (!r) { toast('حُدّثت الإضافة: احفظ هذه الفاتورة ثم أعد تحميل الصفحة (F5)'); return; }
      if (r.err === 'max') toast(drMaxMsg());
      drTake(r);
    });
  }
  function drBusy() {   // SMACC shows a message or a window: it stays to be read
    var m = document.querySelectorAll('.modal.in, .ui-dialog');
    for (var i = 0; i < m.length; i++) if (m[i].id !== 'TheLoadingOuterContainer' && vis(m[i])) return true;
    return false;
  }
  function drSaved(o) {
    if (!o.ins || o.gb) return;   // an edit, or Global Blue (SMACC shows its form now): the tab stays
    drSend({ zod: 'd', op: 'list' }, function (r) {
      drTake(r);
      var others = drOpenList().filter(function (e) { return e.id !== drMe && (e.st === 'add' || e.st === 'new'); });
      if (!others.length) return;   // the only new invoice open: this tab stays, as before
      others.sort(function (a, b) { return (b.act || 0) - (a.act || 0); });
      drCountdown(o.no, others[0]);
    });
  }
  function drCountdown(no, to) {
    if (drBox) drBox.remove();
    var box = drBox = el('div', 'zod-dsaved'), txt = el('span'), keep = el('button', 'zod-dkeep', 'إبقاء مفتوحة');
    var left = 3, iv = 0;
    keep.type = 'button';
    box.appendChild(txt);
    box.appendChild(keep);
    document.body.appendChild(box);
    function show() {   // the number left to right inside the Arabic text (0002-15 stays 0002-15)
      txt.textContent = 'حُفظت الفاتورة ';
      if (no) { var b = el('bdi', null, no); b.dir = 'ltr'; txt.appendChild(b); }
      txt.appendChild(document.createTextNode('. يُغلق هذا التبويب بعد ' + left + ' ث وتظهر المسودة ' + (to.n || '') +
        (to.cust ? ' (' + to.cust + ')' : '')));
    }
    function stop() { clearInterval(iv); box.remove(); if (drBox === box) drBox = null; }
    show();
    iv = setInterval(function () {
      if (--left > 0) { show(); return; }
      stop();
      if (drBusy()) { toast('بقي هذا التبويب مفتوحاً: في الصفحة رسالة من SMACC'); return; }
      if (adding() && drItems().n) { toast('بقي هذا التبويب مفتوحاً: فيه فاتورة جديدة بأصناف'); return; }
      drClosing = true;
      drSend({ zod: 'd', op: 'done' }, function (r) {
        if (r && r.closed) return;
        drClosing = false;   // no other invoice open any more: the tab stays
        drSent = '';
      });
    }, 1000);
    keep.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    keep.addEventListener('click', function (ev) { ev.preventDefault(); stop(); });
  }
  function drStart(fromPlus) {
    var was = false;
    try { was = !!sessionStorage.getItem('zod|dr'); } catch (e) { was = false; }
    if (!CUR || CUR.k !== 'si') {   // a sales invoice tab went to another SMACC page: off the list
      if (was) {
        try { sessionStorage.removeItem('zod|dr'); } catch (e) { /* ignore */ }
        drSend({ zod: 'd', op: 'bye' });
      }
      return;
    }
    try { sessionStorage.setItem('zod|dr', '1'); } catch (e) { /* ignore */ }
    if (fromPlus) drNewUntil = Date.now() + 15000;
    drBar = el('div', 'zod-drafts zod-dhide');
    drBar.dir = 'rtl';
    document.body.appendChild(drBar);
    try {
      chrome.runtime.onMessage.addListener(function (m) { if (m && m.zod === 'dl') drTake(m); });
    } catch (e) { /* the add-on was updated */ }
    document.addEventListener('zod:invsaved', function (e) {
      try { drSaved(JSON.parse(e.detail) || {}); } catch (err) { /* ignore */ }
    });
    document.addEventListener('visibilitychange', drTick);
    drTick();
    setInterval(drTick, 1000);
  }

  /* ---------- start ---------- */
  onReady(function () {
    appPage = !!($id('HeaderBar1_ddlFiscalPeriods') || document.querySelector('.btnAddNew1, #PageListing'));
    if (!appPage) return;
    buildFab();
    buildBadge();
    startKeepAlive();
    if (DEF) setInterval(watchAdding, 300);
    var nh = /^#zod-new(?:=([^&]+))?$/.exec(location.hash);
    drStart(!!(DEF === 'si' && nh));
    if (DEF === 'si' && nh) {   // right after login, or a customer chosen in the customer search (#zod-new=<code>)
      try { pickedCust = nh[1] ? decodeURIComponent(nh[1]).trim() : ''; } catch (e) { pickedCust = ''; }
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
      var go = function () { setTimeout(doF2, 0); };   // right after SMACC's own start-up (its load handlers)
      if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
    }
    setInterval(function () {
      if (defShown && !adding()) { setBanner('zod-def'); defShown = false; }
      supplierTick();
    }, 1000);
  });
})();
