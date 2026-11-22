/* ZOD - quick product and stock tools. Runs inside SMACC's own page (world: MAIN), top window only.
   1. Item card: "نسخ الصنف" (F4) copies the item on screen into a new item form: same category, type, unit,
      cost, price-channel prices, taxes and options. Not copied: item code, barcode, picture.
   2. Sales / purchase invoice item window: "صنف جديد" (F4) opens the item card in a window on the same page,
      empty or as a copy of the item in the window. After you save it there, the new item is put into the
      invoice item window.
   3. Sales invoice item window: "تحويل مخزون" shows the item's stock in every warehouse and fills in a
      stock transfer to the invoice's warehouse. You check it and press حفظ.
   4. Every new item (اضافة جديد, a copy, or the window from the invoice) gets VAT 15%: purchases and sales tax
      groups, which SMACC leaves on "اختر".
   The add-on never saves by itself: saving is always SMACC's own حفظ button (or Ctrl+S). */
(function () {
  'use strict';
  if (window.__zodTools || window.top !== window) return;
  window.__zodTools = true;
  var $ = window.jQuery;
  if (!$) return;

  var PG = location.pathname.split('/').pop().toLowerCase();
  var IS_ITEM = PG === 'itemcardmasterpage.aspx';
  var IS_SI = PG === 'salesinvoicepage.aspx';
  var IS_PI = PG === 'purchaseinvoicepage.aspx';
  if (!IS_ITEM && !IS_SI && !IS_PI) return;

  var ITEM_URL = '/Inventory/ItemCardMasterPage.aspx';
  var TRANSFER_URL = '/Inventory/StockTransferPage.aspx';

  /* ---------- helpers ---------- */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitFor(fn, ms, step) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function loop() {
        var r = null;
        try { r = fn(); } catch (e) { r = null; }
        if (r || Date.now() - t0 > ms) return res(r || null);
        setTimeout(loop, step || 120);
      })();
    });
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text, title) {
    var b = el('button', cls, text);
    b.type = 'button';
    if (title) b.title = title;
    return b;
  }
  function trim(v) { return String(v == null ? '' : v).trim(); }
  function num(s) { var x = parseFloat(String(s == null ? '' : s).replace(/,/g, '')); return isFinite(x) ? x : null; }
  function fmtQty(n) { return (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function lsGet(k) { try { return localStorage.getItem('zod|' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('zod|' + k, v); } catch (e) { /* ignore */ } }
  function lsJSON(k) { try { return JSON.parse(lsGet(k) || 'null'); } catch (e) { return null; } }
  function toast(msg, kind) {   // shown by fast.js
    document.dispatchEvent(new CustomEvent('zod:toast', { detail: JSON.stringify({ msg: msg, kind: kind || '' }) }));
  }
  function css(doc, id, text) {
    if (!doc || doc.getElementById(id)) return;
    var s = doc.createElement('style');
    s.id = id;
    s.textContent = text;
    (doc.head || doc.documentElement).appendChild(s);
  }
  function post(url, body) {
    return fetch(url, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: body
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { return j.d; });
  }
  function q(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

  /* styles used inside SMACC pages shown in the window (and on the item card page itself) */
  var COMMON_CSS =
    '.zod-fbanner{margin:8px 15px;padding:8px 12px;border-radius:6px;background:#eef5fc;border:1px solid #bbdefb;color:#0d3c78;font-size:13px;direction:rtl;line-height:1.6}' +
    '.zod-fbanner b{color:#0d47a1}' +
    '.zod-pulse{box-shadow:0 0 0 3px #ffb74d!important;animation:zodpulse 1.2s ease-in-out 3}' +
    '@keyframes zodpulse{50%{box-shadow:0 0 0 7px rgba(255,183,77,.35)}}';
  var FRAME_CSS = COMMON_CSS +
    '.header,.nav-wrapper,.help-wrapper,.HeaderRow,footer.footer,.zod-fab,.zod-jump{display:none!important}' +
    '.content-wrapper{width:100%!important;margin:0!important;max-width:none!important}' +
    'body{padding-top:0!important}';
  var TOP_CSS = COMMON_CSS +
    'html.zod-ov-on,html.zod-ov-on body{overflow:hidden!important}' +
    '.zod-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.5);display:none;direction:rtl}' +
    '.zod-ov.zod-ov-open{display:flex;justify-content:center;padding:14px}' +
    '.zod-ov-box{background:#fff;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.35);display:flex;flex-direction:column;width:100%;max-width:1400px;overflow:hidden}' +
    '.zod-ov-head{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#1f5f9e;color:#fff}' +
    '.zod-ov-title{font-size:16px;font-weight:700;white-space:nowrap}' +
    '.zod-ov-sub{font-size:13px;opacity:.92;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.zod-ov-x{background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 6px}' +
    '.zod-ov-bar{padding:9px 14px;border-bottom:1px solid #e3e8ef;background:#f7f9fc;font-size:13px;color:#263238;display:flex;flex-direction:column;gap:7px}' +
    '.zod-ov-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}' +
    '.zod-ov-lbl{color:#546e7a;min-width:56px}' +
    '.zod-ov-status{color:#37474f;min-height:18px}' +
    '.zod-ov-status.zod-ok{color:#1b5e20;font-weight:700}' +
    '.zod-ov-status.zod-err{color:#b71c1c;font-weight:700}' +
    '.zod-ov-main{position:relative;flex:1;min-height:0;background:#fff}' +
    '.zod-ov-wait{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#607d8b;font-size:14px}' +
    '.zod-ov-main iframe{position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden;background:#fff}' +
    '.zod-ov-main iframe.zod-on{visibility:visible}' +
    '.zod-obtn{border:1px solid #b0bec5;background:#fff;color:#263238;border-radius:16px;padding:3px 12px;font-size:12px;cursor:pointer;line-height:18px}' +
    '.zod-obtn:hover{border-color:#1565c0;color:#0d47a1}' +
    '.zod-obtn.zod-sel{background:#1565c0;border-color:#1565c0;color:#fff}' +
    '.zod-obtn[disabled]{opacity:.45;cursor:default;border-color:#cfd8dc;color:#90a4ae;background:#f5f7f8}' +
    '.zod-obtn b{font-weight:700}' +
    '.zod-go{background:#1b7f3b;border-color:#1b7f3b;color:#fff}' +
    '.zod-go:hover{background:#156530;color:#fff}' +
    '.zod-qty{width:90px;padding:3px 8px;border:1px solid #90caf9;border-radius:6px;font-size:14px;text-align:center;direction:ltr}' +
    '.zod-iw{display:flex;flex-direction:column;gap:6px}' +
    '.zod-iw .btn{width:100%;white-space:normal}' +
    '.zod-iw .zod-iw-new{background:#e8f5e9;border-color:#a5d6a7;color:#1b5e20}' +
    '.zod-iw .zod-iw-tr{background:#e3f0fc;border-color:#90caf9;color:#0d47a1}' +
    '.zod-iw .btn:hover{filter:brightness(.95)}' +
    '.zod-miss{margin:2px 0 8px;padding:6px 10px;border-radius:6px;background:#fff3e0;border:1px solid #ffb74d;color:#8a3b00;font-size:12px;direction:rtl}';

  /* ---------- SMACC screen state (works on this page or on a page inside the window) ---------- */
  function F(w, k) { return w.document.getElementById('cpBulk_cpForm_' + k); }
  function editingIn(w) { try { return w.jQuery('.btnSaveAddUpdate:visible').length > 0; } catch (e) { return false; } }
  function addingItem(w) { return editingIn(w) && w.jQuery('#hdSaveType').val() === 'SaveNew'; }
  function viewedItem(w) {   // code of the item shown read-only (not a category), or ''
    if (editingIn(w)) return '';
    var c = F(w, 'ItemCode'), sub = F(w, 'SubItemSupport'), sc = F(w, 'SizeOrColorSupport');
    if (!c || !trim(c.value) || (sub && sub.checked) || (sc && sc.checked)) return '';
    return trim(c.value);
  }
  function itemWin() { return document.querySelector('.modal.in[id$="DetailOuterContainer"]'); }

  /* ---------- item copy ---------- */
  var COPY_FIELDS = ['ItemName', 'ItemType', 'txtDescription', 'txtEquivalentItem', 'txtSupplierCode', 'chkHoldFromSale',
    'txtHSNCode', 'IsMunicipalityFeeEnabled', 'IsMeasurementRequired', 'IsAvailableInECommerce',
    'VATCategoryCode', 'TaxExemptionReasonCode', 'InwardTaxGroupID', 'OutwardTaxGroupID'];

  function itemSnap(w) {
    var J = w.jQuery, s = { code: viewedItem(w), f: {}, units: [], chan: {}, prices: {} };
    COPY_FIELDS.forEach(function (k) {
      var e = F(w, k);
      if (e) s.f[k] = e.type === 'checkbox' ? e.checked : e.value;
    });
    J('#grvItemCartUnitDetails .gridRow').each(function () {
      var r = J(this);
      s.units.push({ type: r.find('.unitType').val(), code: r.find('.UnitCodeHelper').val(), name: r.find('.UnitCode').val(),
        frac: r.find('.UnitFraction').val(), cost: r.find('.CostPrice').val() });
    });
    J('#tblPriceChannelDetails > thead > tr > th').each(function () {
      var c = J(this).find('input[type=checkbox]');
      if (this.id && c.length) s.chan[this.id] = c.is(':checked');
    });
    J('#tblPriceChannelDetails > tbody > tr').each(function () {
      var ut = J(this).find('.ChannelPriceItemUnitCode').attr('data-unittype'), p = {};
      J(this).find('.PriceTextBox[data-pricechannelcode]').each(function () { p[J(this).attr('data-pricechannelcode')] = J(this).val(); });
      if (ut) s.prices[ut] = p;
    });
    return s;
  }
  function usable(e) { return e && !e.disabled && !e.readOnly; }
  function setField(w, e, v, how) {
    var J = w.jQuery;
    if (e.type === 'checkbox') {
      if (e.checked === !!v) return false;
      J(e).prop('checked', !!v).change();
      return true;
    }
    if (String(e.value) === String(v)) return false;
    if (e.tagName === 'SELECT' && !J(e).find('option').filter(function () { return this.value === String(v); }).length) return false;
    if (how === 'blur') J(e).val(v).blur(); else J(e).val(v).change();
    return true;
  }
  async function itemRestore(w, s) {
    var J = w.jQuery, missed = [];
    COPY_FIELDS.forEach(function (k) {
      var e = F(w, k);
      if (!usable(e) || !(k in s.f)) return;
      try { setField(w, e, s.f[k], k === 'txtSupplierCode' ? 'blur' : 'change'); } catch (err) { missed.push(k); }
    });
    await sleep(250);
    // units: same rows, unit names, fractions and cost (barcodes stay empty).
    // SMACC unlocks the cost box only once the units tab has been shown.
    J('a[href="#tabUnits"]').click();
    await sleep(500);
    var rows = function () { return J('#grvItemCartUnitDetails .gridRow'); };
    for (var i = 0; i < s.units.length; i++) {
      var u = s.units[i];
      if (i > 0) {
        var n0 = rows().length;
        J('#btnAddNewUnit').click();
        if (!await waitFor(function () { return rows().length > n0; }, 2500)) { missed.push('الوحدة ' + u.name); continue; }
        await sleep(150);
      }
      var r = rows().eq(i), uc = r.find('.UnitCode')[0];
      if (String(r.find('.UnitCodeHelper').val()) !== String(u.code) && usable(uc)) {
        J(uc).val(u.name).blur();
        await sleep(700);
        if (String(r.find('.UnitCodeHelper').val()) !== String(u.code)) { J(uc).val(u.code).blur(); await sleep(700); }
        if (String(r.find('.UnitCodeHelper').val()) !== String(u.code)) missed.push('الوحدة ' + u.name);
      }
      var fr = r.find('.UnitFraction')[0];
      if (i > 0 && usable(fr) && num(fr.value) !== num(u.frac)) { J(fr).val(u.frac).blur(); await sleep(150); }
      var cp = r.find('.CostPrice')[0];
      if (num(u.cost) && usable(cp)) J(cp).val(u.cost).blur();
    }
    await sleep(250);
    // price channels: open the tab like a user would, so SMACC builds a price row per unit
    J('a[href="#tabPriceChannel"]').click();
    await sleep(700);
    Object.keys(s.chan).forEach(function (c) {
      if (!s.chan[c]) return;
      var cb = J('#tblPriceChannelDetails > thead > tr > th').filter(function () { return this.id === c; }).find('input[type=checkbox]')[0];
      if (cb && !cb.disabled && !cb.checked) J(cb).prop('checked', true).change();
    });
    await sleep(250);
    Object.keys(s.prices).forEach(function (ut) {
      var tr = J('#tblPriceChannelDetails > tbody > tr').filter(function () { return J(this).find('.ChannelPriceItemUnitCode').attr('data-unittype') === ut; });
      Object.keys(s.prices[ut]).forEach(function (c) {
        var p = s.prices[ut][c], inp = tr.find('.PriceTextBox[data-pricechannelcode="' + c + '"]')[0];
        if (!num(p)) return;
        if (usable(inp)) J(inp).val(p).change().blur(); else missed.push('سعر ' + c);
      });
    });
    await sleep(200);
    J('a[href="#tabGeneralInfo"]').click();
    return missed;
  }
  function banner(w, html) {
    var d = w.document, f = d.getElementById('divForm'), b = d.getElementById('zod-ibanner');
    if (!html) { if (b) b.remove(); return; }
    if (!f) return;
    if (!b) { b = d.createElement('div'); b.id = 'zod-ibanner'; b.className = 'zod-fbanner'; }
    b.innerHTML = html;
    if (b.parentElement !== f) f.insertBefore(b, f.firstChild);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function focusName(w) {
    var n = F(w, 'ItemName');
    if (!n) return;
    try {
      w.jQuery('a[href="#tabGeneralInfo"]').click();
      w.focus();
      n.focus();
      n.setSelectionRange(n.value.length, n.value.length);
    } catch (e) { /* ignore */ }
  }
  /* ---------- new items: VAT 15% ----------
     SMACC opens a new item with the VAT category "التوريدات الخاضعة للضريبة" (S) but both tax groups on "اختر".
     The add-on puts in the 15% groups (purchases PurchaseTax15, sales SalesTax15) once per new-item form, only
     while the category is S and a group is still "اختر" (an exempt / zero-rated copy stays as it is). They can
     still be changed before حفظ. */
  var VAT = [['InwardTaxGroupID', 'PurchaseTax15', 'ضريبة المشتريات 15%'], ['OutwardTaxGroupID', 'SalesTax15', 'ضريبة المبيعات 15%']];
  function vatDefaults(w) {
    var done = [], cat = F(w, 'VATCategoryCode');
    if (!addingItem(w)) return done;
    if (usable(cat) && !cat.value) setField(w, cat, 'S');
    if (cat && cat.value && cat.value !== 'S') return done;
    VAT.forEach(function (x) {
      var e = F(w, x[0]);
      if (usable(e) && (!e.value || e.value === '0') && setField(w, e, x[1])) done.push(x[2]);
    });
    return done;
  }
  var vatWins = [];   // windows watched (this page, the item card inside the window on an invoice)
  function vatWatch(w) {
    if (!w || vatWins.indexOf(w) >= 0) return;
    vatWins.push(w);
    var since = 0, done = false;
    var t = setInterval(function () {
      try {
        if (w.closed) { clearInterval(t); return; }
        if (!w.jQuery || !addingItem(w)) { since = 0; done = false; return; }
        if (done || w.__zodCopying) return;
        if (!since) since = Date.now();
        if (Date.now() - since < 450) return;   // SMACC finishes setting up the blank form first
        done = true;
        vatDefaults(w);
      } catch (e) { /* the page in that window is changing */ }
    }, 250);
  }

  /* copy the item shown on screen (in window w) into a new item form; returns the snapshot or null */
  async function copyItem(w) {
    var code = viewedItem(w);
    if (!code) return null;
    var s = itemSnap(w);
    var add = w.jQuery('.btnAddNew1:visible').first();
    if (!add.length) return null;
    w.__zodCopying = true;
    try {
      add.click();
      if (!await waitFor(function () { return addingItem(w); }, 8000)) return null;
      await sleep(500);
      var missed = await itemRestore(w, s);
      vatDefaults(w);   // the copied item had no tax group
    } finally { w.__zodCopying = false; }
    w.__zodCopySrc = s;
    banner(w, 'نسخة من الصنف <b dir="ltr">' + esc(s.code) + '</b> · ' + esc(s.f.ItemName) +
      ' — غيّر الاسم (وأدخل الباركود إن وجد) ثم احفظ. نُسخت الفئة والوحدة والتكلفة والأسعار والضريبة؛ لم يُنسخ الرمز والباركود والصورة.' +
      (missed.length ? '<br>لم تُنسخ: ' + esc(missed.join('، ')) : ''));
    focusName(w);
    return s;
  }
  /* ask before saving a copy whose name was not changed */
  function guardCopy(w) {
    if (w.__zodGuard) return;
    w.__zodGuard = true;
    w.document.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('.btnSaveAddUpdate') : null, s = w.__zodCopySrc;
      if (!t || !s || !addingItem(w)) return;
      var n = F(w, 'ItemName');
      if (n && trim(n.value) === trim(s.f.ItemName) &&
          !w.confirm('اسم الصنف الجديد هو نفس اسم الصنف الأصلي (' + s.code + ').\nهل تريد الحفظ على أي حال؟')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }, true);
  }
  function tidy(w) {   // drop the copy note once the new-item form is closed
    if (w.__zodCopySrc && !addingItem(w)) w.__zodCopySrc = null;
    if (!addingItem(w) && w.document.getElementById('zod-ibanner')) banner(w, null);
  }

  /* ---------- watch SMACC's own save (item card and stock transfer) ---------- */
  function hookSave(w) {
    if (!w || w.__zodSaveHook || typeof w.CallServerFunction !== 'function') return;
    w.__zodSaveHook = true;
    var orig = w.CallServerFunction;
    w.CallServerFunction = function (path) {
      var isSave = /\/SaveRec$/i.test(String(path || ''));
      var pre = isSave ? preSave(w) : null;
      var r = orig.apply(this, arguments);
      if (pre) setTimeout(function () { try { postSave(w, pre, r); } catch (e) { /* the save itself already went through */ } }, 0);
      return r;
    };
  }
  function preSave(w) {
    var p = w.location.pathname.toLowerCase();
    if (p.indexOf('itemcardmasterpage') >= 0) {
      return { page: 'item', isNew: w.jQuery('#hdSaveType').val() === 'SaveNew',
        parent: trim(w.jQuery('#cpBulk_cpForm_hfParentItemCode').val()),
        inTax: trim(w.jQuery('#cpBulk_cpForm_InwardTaxGroupID').val()), outTax: trim(w.jQuery('#cpBulk_cpForm_OutwardTaxGroupID').val()) };
    }
    if (p.indexOf('stocktransferpage') >= 0) return { page: 'transfer' };
    return null;
  }
  function postSave(w, pre, r) {
    if (pre.page === 'item') {
      if (typeof r !== 'string' || r.toLowerCase().indexOf('parentitemcode') < 0) return;   // SMACC showed an error
      var o = JSON.parse(r);
      if (o.isUpdate || !pre.isNew) return;
      var def = lsJSON('itemdef') || {};
      if (pre.parent) def.parent = pre.parent;
      if (pre.inTax && pre.inTax !== '0') def.inTax = pre.inTax;
      if (pre.outTax && pre.outTax !== '0') def.outTax = pre.outTax;
      lsSet('itemdef', JSON.stringify(def));
      w.__zodCopySrc = null;
      if (typeof w.__zodOnSaved === 'function') w.__zodOnSaved(trim(o.Id));
    } else if (pre.page === 'transfer') {
      if (r !== 'success') return;
      setTimeout(function () {
        var no = trim(w.jQuery('.txtPrimaryKey').first().val());
        if (typeof w.__zodOnSaved === 'function') w.__zodOnSaved(no);
      }, 400);
    }
  }
  function frameSave(w) {
    if (!w || !editingIn(w)) return;
    var a = w.document.activeElement;
    if (a && a !== w.document.body && a.blur) a.blur();
    setTimeout(function () { w.jQuery('.btnSaveAddUpdate:visible').first().click(); }, 250);
  }

  /* ---------- the window on top of the page ---------- */
  var OV = null, FR = {}, cur = null;
  function ensureOv() {
    if (OV) return OV;
    css(document, 'zod-tools-css', TOP_CSS);
    var root = el('div', 'zod-ov'), box = el('div', 'zod-ov-box'), head = el('div', 'zod-ov-head');
    var title = el('span', 'zod-ov-title'), sub = el('span', 'zod-ov-sub'), x = button('zod-ov-x', '×', 'إغلاق (Esc)');
    var bar = el('div', 'zod-ov-bar'), main = el('div', 'zod-ov-main'), wait = el('div', 'zod-ov-wait');
    head.appendChild(title); head.appendChild(sub); head.appendChild(x);
    main.appendChild(wait);
    box.appendChild(head); box.appendChild(bar); box.appendChild(main);
    root.appendChild(box);
    document.body.appendChild(root);
    x.addEventListener('click', function () { closeOv(false); });
    OV = { root: root, title: title, sub: sub, bar: bar, main: main, wait: wait };
    return OV;
  }
  function releaseModalFocus() { try { $(document).off('focusin.bs.modal'); } catch (e) { /* ignore */ } }
  function restoreModalFocus() {
    try { var m = $('.modal.in').last().data('bs.modal'); if (m && m.enforceFocus) m.enforceFocus(); } catch (e) { /* ignore */ }
  }
  function openOv(kind, title, sub) {
    ensureOv();
    if (cur) closeOv(true);
    OV.title.textContent = title;
    OV.sub.textContent = sub || '';
    OV.bar.textContent = '';
    OV.wait.textContent = 'جاري فتح الشاشة…';
    Object.keys(FR).forEach(function (k) { FR[k].f.classList.remove('zod-on'); });
    OV.root.classList.add('zod-ov-open');
    document.documentElement.classList.add('zod-ov-on');
    releaseModalFocus();
    cur = { kind: kind };
    return cur;
  }
  function closeOv(force) {
    if (!cur) return;
    var o = FR[cur.kind], w = o ? frameOk(o) : null;
    if (!force && w && editingIn(w) && !window.confirm('إغلاق النافذة بدون حفظ؟')) return;
    if (w) {   // leave SMACC's form clean for next time
      try {
        w.jQuery('.modal.in').find('.CancelDialog, [id$=btnCancelDialog]').first().click();
        if (editingIn(w)) w.jQuery('.btnCancelAddUpdate:visible').first().click();
      } catch (e) { /* ignore */ }
    }
    if (cur.timer) clearInterval(cur.timer);
    cur = null;
    OV.root.classList.remove('zod-ov-open');
    document.documentElement.classList.remove('zod-ov-on');
    restoreModalFocus();
  }
  function frameOk(o) {
    try {
      var w = o.f.contentWindow;
      if (!w || !w.jQuery || w.document.readyState !== 'complete') return null;
      if (w.location.pathname.toLowerCase() !== o.url.toLowerCase()) return null;
      if (!w.document.querySelector('.btnAddNew1')) return null;
      return w;
    } catch (e) { return null; }
  }
  function prepFrame(w) {
    css(w.document, 'zod-frame-css', FRAME_CSS);
    hookSave(w);
    guardCopy(w);
    if (!w.__zodKeys) {
      w.__zodKeys = true;
      w.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyS') {
          e.preventDefault();
          e.stopPropagation();
          frameSave(w);
        }
      }, true);
    }
  }
  /* SMACC page inside the window; loaded once and kept for next time */
  function getFrame(kind, url) {
    var o = FR[kind];
    if (!o) {
      o = FR[kind] = { f: el('iframe'), url: url, loads: 0 };
      o.f.title = kind;
      o.f.addEventListener('load', function () {
        o.loads++;
        try { prepFrame(o.f.contentWindow); } catch (e) { /* other page (login) */ }
      });
      OV.main.appendChild(o.f);
      o.f.src = url;
    }
    var mine = cur, t0 = Date.now();
    o.nav = o.nav || Date.now();
    return waitFor(function () {
      if (cur !== mine) return 'gone';
      try {   // after a login inside the window SMACC opens its home page: go back to our screen
        var fw = o.f.contentWindow, p = fw.location.pathname.toLowerCase();
        if (fw.document.readyState === 'complete' && p !== o.url.toLowerCase() && p.indexOf('login') < 0 && Date.now() - o.nav > 4000) {
          o.nav = Date.now();
          o.f.src = o.url;
        }
        if (p.indexOf('login') >= 0) o.f.classList.add('zod-on');   // let the user sign in there
      } catch (e) { /* not loaded yet */ }
      if (Date.now() - t0 > 25000) o.f.classList.add('zod-on');
      return frameOk(o);
    }, 120000, 200).then(function (w) {
      if (!w || w === 'gone' || cur !== mine) return null;
      prepFrame(w);
      return sleep(o.ready ? 50 : 700).then(function () {
        o.ready = true;
        if (cur !== mine) return null;
        o.f.classList.add('zod-on');
        return w;
      });
    });
  }
  function bar() { return OV.bar; }
  function setStatus(c, text, kind) {
    if (!c.status || cur !== c) return;
    c.status.textContent = text || '';
    c.status.className = 'zod-ov-status' + (kind ? ' zod-' + kind : '');
  }

  /* ---------- 1. item card page: copy button ---------- */
  async function copyHere() {
    if (!viewedItem(window)) { toast('اعرض صنفاً أولاً (ليس فئة) ثم اضغط نسخ'); return; }
    var s = await copyItem(window);
    if (!s) toast('تعذر نسخ الصنف');
  }
  function setupItemPage() {
    css(document, 'zod-tools-css', TOP_CSS);
    hookSave(window);
    guardCopy(window);
    vatWatch(window);
    var btn = null;
    setInterval(function () {
      var add = document.querySelector('.btnAddNew1');
      if (add && add.parentElement) {
        if (!btn) {
          btn = button('btn btn-darkgray btn-md bot-buffer zod-copy', '⧉ نسخ الصنف',
            'صنف جديد بنفس الفئة والوحدة والتكلفة والأسعار والضريبة (F4)');
          btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); copyHere(); });
        }
        if (btn.previousElementSibling !== add) add.parentElement.insertBefore(btn, add.nextSibling);
        btn.style.display = viewedItem(window) ? '' : 'none';
      }
      tidy(window);
    }, 500);
  }

  /* ---------- 2. invoice: new item without leaving the invoice ---------- */
  // SMACC resets the quantity to 0 when the warehouse has no stock and clears an item code it does not
  // know, so remember what was typed
  var lastQty = 0, lastTyped = '';
  function inItemWin(t) { return t && t.closest ? t.closest('[id$="DetailOuterContainer"]') : null; }
  function looksLikeCode(t) { return /^[0-9A-Za-z][0-9A-Za-z\-_.\/]*$/.test(t) && /\d/.test(t); }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (!inItemWin(t)) return;
    if (t.id === 'Quantity') lastQty = num(t.value) || 0;
    if (t.id === 'ItemCode') { lastTyped = trim(t.value); hideMiss(); }
  }, true);
  document.addEventListener('focusout', function (e) {
    var t = e.target, m = inItemWin(t), typed = lastTyped;
    if (!m || t.id !== 'ItemCode' || !typed) return;
    setTimeout(function () {
      if (cur || !m.classList.contains('in') || lastTyped !== typed) return;
      if (!trim(t.value) && !trim($(m).find('#ItemName').val())) showMiss(m, typed);
    }, 1500);
  }, true);
  function hideMiss() { var d = document.querySelector('.zod-miss'); if (d) d.remove(); }
  function showMiss(m, typed) {
    var ic = m.querySelector('#ItemCode'), host = ic ? (ic.closest('.parentCtrlSCN') || ic.parentElement) : null;
    if (!host || !host.parentElement) return;
    hideMiss();
    var d = el('div', 'zod-miss');
    d.appendChild(document.createTextNode('«' + typed + '» غير موجود في الأصناف. '));
    var b = button('zod-obtn zod-go', 'إنشاء صنف جديد ' + (looksLikeCode(typed) ? 'بهذا الباركود' : 'بهذا الاسم') + ' (F4)');
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); quickNewItem(); });
    d.appendChild(b);
    host.parentElement.insertBefore(d, host.nextSibling);
  }

  async function applyItemDefaults(w, c) {
    var J = w.jQuery, done = vatDefaults(w);
    var t = c.typed;
    if (t) {
      if (looksLikeCode(t)) {
        J('a[href="#tabUnits"]').click();   // the barcode box unlocks once the units tab is shown
        await sleep(500);
        if (cur !== c || !addingItem(w)) return;
        var bc = J('#grvItemCartUnitDetails .gridRow').first().find('.ItemUnitCode')[0];
        if (usable(bc) && !bc.value) { J(bc).val(t).blur(); done.push('الباركود ' + t); }
      } else {
        var n = F(w, 'ItemName');
        if (usable(n) && !n.value) { J(n).val(t).change(); done.push('الاسم'); }
      }
    }
    banner(w, 'صنف جديد للفاتورة — بعد «حفظ» يُضاف إلى نافذة الصنف في الفاتورة تلقائياً.' +
      (done.length ? '<br>تمت تعبئة: ' + esc(done.join('، ')) + ' (يمكن تغييرها)' : ''));
    focusName(w);
  }
  async function resetItemForm(w) {
    if (editingIn(w)) {
      w.jQuery('.btnCancelAddUpdate:visible').first().click();
      await waitFor(function () { return !editingIn(w); }, 5000);
      await sleep(200);
    }
  }
  async function loadItem(w, code) {
    var J = w.jQuery, ddl = J('#cpBulk_cpForm_ddlOpenSearch');
    if (!ddl.length) return false;
    if (!ddl.find('option').filter(function () { return this.value === code; }).length) ddl.append(J('<option>').val(code).text(code));
    ddl.val(code).change();
    return !!await waitFor(function () { return viewedItem(w) === code; }, 8000);
  }
  async function selectCategory(w, code) {
    var span = w.jQuery('#simpleTreeContainer li').filter(function () { return this.getAttribute('node_code') === code; }).children('span').first();
    if (!span.length) return false;
    span.click();
    return !!await waitFor(function () { return trim(w.jQuery('#cpBulk_cpForm_hfItemCode').val()) === code && !editingIn(w); }, 6000);
  }
  async function quickNewItem() {
    var m = itemWin();
    if (!m) { toast('افتح نافذة الصنف أولاً (F3)'); return; }
    var $m = $(m), ic = $m.find('#ItemCode')[0];
    if (ic && document.activeElement === ic) {   // F4 while typing: let SMACC look the code up first
      $(ic).blur();
      await sleep(1200);
      if (cur) return;
    }
    var typed = trim($m.find('#ItemCode').val());
    var known = typed && trim($m.find('#ItemName').val()) ? typed : '';
    hideMiss();
    var c = openOv('item', 'صنف جديد', 'بعد الحفظ يُضاف الصنف إلى نافذة الصنف في الفاتورة');
    c.typed = known ? '' : (typed || lastTyped);
    var row = el('div', 'zod-ov-row'), bCopy = null;
    row.appendChild(el('span', 'zod-ov-lbl', 'ابدأ بـ:'));
    if (known) {
      bCopy = button('zod-obtn', '⧉ نسخة من الصنف ' + known, 'نفس الفئة والوحدة والتكلفة والأسعار والضريبة');
      row.appendChild(bCopy);
    }
    var bBlank = button('zod-obtn', 'صنف جديد فارغ', 'في آخر فئة استخدمتها، أو اختر الفئة من الشجرة');
    row.appendChild(bBlank);
    c.status = el('div', 'zod-ov-status', 'جاري فتح شاشة الأصناف… (أول مرة تأخذ بضع ثوانٍ)');
    bar().appendChild(row);
    bar().appendChild(c.status);

    var w = await getFrame('item', ITEM_URL);
    if (cur !== c) return;
    if (!w) { setStatus(c, 'تعذر فتح شاشة الأصناف. إذا ظهرت صفحة الدخول سجّل الدخول ثم أعد المحاولة.', 'err'); return; }
    c.w = w;
    vatWatch(w);
    w.__zodOnSaved = function (code) { if (cur === c) itemSaved(c, code); };
    c.wasAdding = addingItem(w);
    c.timer = setInterval(function () {   // each time a blank new-item form opens, fill what we know
      if (cur !== c) return;
      var a = addingItem(w);
      if (a && !c.wasAdding && c.mode === 'blank') setTimeout(function () { if (cur === c && addingItem(w)) applyItemDefaults(w, c); }, 500);
      c.wasAdding = a;
      tidy(w);
    }, 300);

    async function start(mode) {
      if (cur !== c || c.busy) return;
      c.busy = true;
      c.mode = mode;
      if (bCopy) bCopy.classList.toggle('zod-sel', mode === 'copy');
      bBlank.classList.toggle('zod-sel', mode === 'blank');
      try {
        await resetItemForm(w);
        c.wasAdding = false;
        if (mode === 'copy') {
          setStatus(c, 'جاري نسخ الصنف ' + known + '…');
          if (!await loadItem(w, known)) { setStatus(c, 'لم يتم العثور على الصنف ' + known + ' في بطاقة الأصناف. اختر «صنف جديد فارغ».', 'err'); return; }
          c.wasAdding = true;   // the copy fills the form itself
          var s = await copyItem(w);
          if (cur !== c) return;
          if (!s) { setStatus(c, 'تعذر النسخ. اختر «صنف جديد فارغ».', 'err'); return; }
          setStatus(c, 'غيّر الاسم ثم اضغط «حفظ» أعلى الشاشة (أو Ctrl+S).', 'ok');
        } else {
          var def = lsJSON('itemdef') || {}, ok = def.parent ? await selectCategory(w, def.parent) : false;
          if (cur !== c) return;
          if (ok) {
            w.jQuery('.btnAddNew1:visible').first().click();
            await waitFor(function () { return addingItem(w); }, 8000);
            setStatus(c, 'اكتب الاسم والسعر ثم اضغط «حفظ» (أو Ctrl+S). لفئة أخرى: اضغط «الغاء» واختر الفئة من الشجرة ثم «اضافة جديد».', 'ok');
          } else {
            setStatus(c, 'اختر الفئة من شجرة الأصناف ثم اضغط «اضافة جديد». بعد الحفظ يُضاف الصنف للفاتورة.');
          }
        }
      } finally { c.busy = false; }
    }
    if (bCopy) bCopy.addEventListener('click', function () { start('copy'); });
    bBlank.addEventListener('click', function () { start('blank'); });
    if (c.typed) row.appendChild(el('span', 'zod-ov-lbl', '  ' + (looksLikeCode(c.typed) ? 'الباركود: ' : 'الاسم: ') + c.typed));
    start(known ? 'copy' : 'blank');
  }
  function itemSaved(c, code) {
    setTimeout(async function () {
      if (cur !== c) return;
      closeOv(true);
      if (!code) return;
      toast('تم حفظ الصنف ' + code + ' ووضعه في نافذة الصنف', 'ok');
      lastTyped = '';
      hideMiss();
      var m = itemWin();
      if (!m) return;
      $(m).find('#ItemCode').val(code).blur();
      await waitFor(function () { return trim($(m).find('#ItemName').val()); }, 8000);
      $(m).find('#Quantity').focus().select();
    }, 800);
  }

  /* ---------- 3. sales invoice: stock transfer without leaving the invoice ---------- */
  function fetchStock(code) {
    return post('/WebServices/CommonWebService.asmx/SelectItemCardCurrentStockInAllWarehouses', "{ 'itemCode' : '" + q(code) + "'}")
      .then(function (d) {
        return (JSON.parse(d) || []).map(function (r) {
          return { code: trim(r.WarehouseCode), name: trim(r.WarehouseName) || trim(r.WarehouseCode), qty: Number(r.CurrentQuantity) || 0 };
        });
      });
  }
  async function quickTransfer() {
    var m = itemWin();
    if (!m) { toast('افتح نافذة الصنف أولاً (F3)'); return; }
    var $m = $(m), code = trim($m.find('#ItemCode').val()), name = trim($m.find('#ItemName').val());
    if (!code || !name) { toast('اختر الصنف في نافذة الصنف أولاً'); return; }
    var to = trim($('#cpBulk_cpForm_WarehouseCode').val()), toName = trim($('#cpBulk_cpForm_WarehouseName').val()) || to;
    if (!to) { toast('اختر المخزن في رأس الفاتورة أولاً'); return; }
    var have = num($m.find('#InHandQuantity').val()) || 0, want = lastQty > 0 ? lastQty : 0;
    var c = openOv('transfer', 'تحويل مخزون', name + '  (' + code + ')');
    c.code = code; c.to = to; c.toName = toName; c.want = want;

    var rFrom = el('div', 'zod-ov-row'), chips = el('span', 'zod-ov-row');
    rFrom.appendChild(el('span', 'zod-ov-lbl', 'من مخزن:'));
    chips.textContent = 'جاري قراءة المخزون في كل المخازن…';
    rFrom.appendChild(chips);
    var rTo = el('div', 'zod-ov-row'), toInfo = el('b', null, toName);
    var qty = el('input', 'zod-qty');
    qty.type = 'number'; qty.min = '0'; qty.step = 'any';
    var go = button('zod-obtn zod-go', 'تعبئة التحويل', 'يعبّئ نموذج التحويل أدناه بالمخزن والصنف والكمية (Enter)');
    rTo.appendChild(el('span', 'zod-ov-lbl', 'إلى:'));
    rTo.appendChild(toInfo);
    var toHave = el('span', null, ' (الموجود ' + fmtQty(have) + ')');
    rTo.appendChild(toHave);
    rTo.appendChild(el('span', 'zod-ov-lbl', '  الكمية:'));
    rTo.appendChild(qty);
    rTo.appendChild(go);
    c.status = el('div', 'zod-ov-status', '');
    bar().appendChild(rFrom);
    bar().appendChild(rTo);
    bar().appendChild(c.status);

    var frameP = getFrame('transfer', TRANSFER_URL);   // starts loading now, while we read the stock
    var stock = null;
    try { stock = await fetchStock(code); } catch (e) { stock = null; }
    if (cur !== c) return;
    if (!stock) { chips.textContent = 'تعذر قراءة المخزون'; }
    else {
      var mine = stock.filter(function (s) { return s.code === to; })[0];
      if (mine) { have = mine.qty; toHave.textContent = ' (الموجود ' + fmtQty(have) + ')'; }
      chips.textContent = '';
      c.btns = [];
      stock.filter(function (s) { return s.code !== to; }).forEach(function (s) {
        var b = button('zod-obtn', '', 'التحويل من ' + s.name);
        b.appendChild(document.createTextNode(s.name + ' '));
        b.appendChild(el('b', null, fmtQty(s.qty)));
        if (s.qty <= 0) b.disabled = true;
        b.addEventListener('click', function () { pick(s); fill(); });
        b.__s = s;
        c.btns.push(b);
        chips.appendChild(b);
      });
    }
    var best = (stock || []).filter(function (s) { return s.code !== to && s.qty > 0; })
      .sort(function (a, b) { return b.qty - a.qty; })[0];
    function pick(s) {
      c.from = s;
      (c.btns || []).forEach(function (b) { b.classList.toggle('zod-sel', b.__s === s); });
      var need = want > have ? want - have : (want || 1);
      var v = num(qty.value);
      if (!v || v > s.qty) qty.value = String(Math.min(v || need, s.qty));
      qty.max = String(s.qty);
    }
    if (!best) {
      setStatus(c, stock ? 'لا توجد كمية من هذا الصنف في المخازن الأخرى.' : 'تعذر قراءة المخزون. أعد المحاولة.', 'err');
      go.disabled = true;
      return;
    }
    pick(best);

    var w = await frameP;
    if (cur !== c) return;
    if (!w) { setStatus(c, 'تعذر فتح شاشة تحويل المخزون. إذا ظهرت صفحة الدخول سجّل الدخول ثم أعد المحاولة.', 'err'); return; }
    c.w = w;
    w.__zodOnSaved = function (no) { if (cur === c) transferSaved(c, no); };

    async function fill() {
      if (cur !== c || !c.w || !c.from) return;
      if (c.busy) { c.again = true; return; }
      c.busy = true;
      try {
        do { c.again = false; await fillTransfer(c, w, num(qty.value) || 0); } while (c.again && cur === c);
      } finally { c.busy = false; }
    }
    c.fill = fill;
    go.addEventListener('click', fill);
    fill();
  }
  async function fillTransfer(c, w, n) {
    var J = w.jQuery, from = c.from;
    if (!(n > 0)) { setStatus(c, 'اكتب الكمية.', 'err'); return; }
    if (n > from.qty) { setStatus(c, 'الكمية أكبر من الموجود في ' + from.name + ' (' + fmtQty(from.qty) + ').', 'err'); return; }
    setStatus(c, 'جاري تعبئة نموذج التحويل…');
    // start from a fresh, empty transfer
    J('.modal.in').find('.CancelDialog, [id$=btnCancelDialog]').first().click();
    if (editingIn(w)) {
      J('.btnCancelAddUpdate:visible').first().click();
      await waitFor(function () { return !editingIn(w); }, 5000);
      await sleep(250);
    }
    if (!editingIn(w)) {
      var add = J('.btnAddNew1:visible').first();
      if (add.length) add.click(); else J('#linkPageForm').click();
      if (!await waitFor(function () { return editingIn(w); }, 8000)) { setStatus(c, 'تعذر فتح تحويل جديد.', 'err'); return; }
      await sleep(400);
    }
    if (cur !== c) return;
    J('#cpBulk_cpForm_WarehouseCodeFrom').val(from.code).blur();
    await waitFor(function () { return trim(J('#cpBulk_cpForm_WarehouseNameFrom').val()); }, 5000);
    J('#cpBulk_cpForm_WarehouseCodeTo').val(c.to).blur();
    await waitFor(function () { return trim(J('#cpBulk_cpForm_WarehouseNameTo').val()); }, 5000);
    if (cur !== c) return;
    J('#cpBulk_cpForm_btnAddNew').click();
    var mm = await waitFor(function () { return J('.modal.in').filter(function () { return J(this).find('#ItemCode').length; })[0]; }, 6000);
    if (!mm) { setStatus(c, 'تعذر فتح نافذة الصنف في التحويل.', 'err'); return; }
    await sleep(300);
    J(mm).find('#ItemCode').val(c.code).blur();
    await waitFor(function () { return trim(J(mm).find('#ItemName').val()); }, 8000);
    await sleep(300);
    if (cur !== c) return;
    J(mm).find('#Quantity').val(String(n)).change().blur();
    await sleep(500);
    var got = num(J(mm).find('#Quantity').val());
    if (!got) { setStatus(c, 'رفض SMACC الكمية (الموجود في ' + from.name + ' غير كافٍ؟). عدّلها في النافذة أدناه.', 'err'); return; }
    J(mm).find('[id$=btnOkDialog]').first().click();
    await waitFor(function () { return !J(mm).hasClass('in'); }, 5000);
    if (cur !== c) return;
    c.qty = got;
    try { w.scrollTo(0, 0); } catch (e) { /* ignore */ }
    J('.btnSaveAddUpdate:visible').first().addClass('zod-pulse');
    setStatus(c, '✓ جاهز: ' + fmtQty(got) + ' من ' + from.name + ' إلى ' + c.toName + '. راجع ثم اضغط «حفظ» أعلى النموذج (أو Ctrl+S).', 'ok');
  }
  function transferSaved(c, no) {
    setTimeout(async function () {
      if (cur !== c) return;
      var from = c.from ? c.from.name : '', n = c.qty;
      closeOv(true);
      toast('تم التحويل ' + (no || '') + ': ' + fmtQty(n || 0) + ' من ' + from, 'ok');
      var m = itemWin();
      if (!m || trim($(m).find('#ItemCode').val()) !== c.code) return;
      $(m).find('#ItemCode').val(c.code).blur();   // SMACC reloads the item with the new quantity on hand
      await waitFor(function () { return (num($(m).find('#InHandQuantity').val()) || 0) > 0; }, 8000);
      var qf = $(m).find('#Quantity');
      if (c.want > 0) qf.val(String(c.want)).change();
      qf.focus().select();
    }, 600);
  }

  /* ---------- buttons in the invoice item window ---------- */
  function addItemButtons(m) {
    if (!m || m.querySelector('.zod-iw')) return;
    css(document, 'zod-tools-css', TOP_CSS);
    var box = el('div', 'form-group bot-buffer zod-iw');
    var bNew = button('btn btn-sm btn-gray bot-buffer zod-iw-new', '＋ صنف جديد', 'صنف جديد بدون ترك الفاتورة، فارغ أو نسخة من الصنف المكتوب (F4)');
    bNew.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); quickNewItem(); });
    box.appendChild(bNew);
    if (IS_SI) {
      var bTr = button('btn btn-sm btn-gray bot-buffer zod-iw-tr', '⇄ تحويل مخزون', 'تحويل كمية من مخزن آخر إلى مخزن هذه الفاتورة');
      bTr.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); quickTransfer(); });
      box.appendChild(bTr);
    }
    // under SMACC's own buttons on the left of the window ("الكمية التي باليد" / "الأخير سعر التكلفه")
    var groups = Array.prototype.filter.call(m.querySelectorAll('.modal-body .col-md-12 > .form-group'), function (g) {
      return g.querySelector('button.btn') && !g.closest('table');
    });
    var anchor = m.querySelector('.BaseUnitInHandWarehouse') || groups[groups.length - 1];
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor.nextSibling);
    else {
      var foot = m.querySelector('.modal-footer');
      if (!foot) return;
      box.style.flexDirection = 'row';
      box.style.display = 'inline-flex';
      box.style.margin = '0 8px';
      foot.insertBefore(box, foot.firstChild);
    }
  }
  function setupInvoicePage() {
    $(document).on('shown.bs.modal', '.modal', function () {
      if (/DetailOuterContainer$/.test(this.id)) { lastQty = 0; lastTyped = ''; hideMiss(); addItemButtons(this); }
    });
    $(document).on('hidden.bs.modal', '.modal', function () {
      if (/DetailOuterContainer$/.test(this.id)) hideMiss();
    });
    var m = document.querySelector('[id$="DetailOuterContainer"].modal');
    if (m) addItemButtons(m);
  }

  /* ---------- keys ---------- */
  window.addEventListener('keydown', function (e) {
    if (cur) {   // window open: keys must not reach the invoice underneath (typing still works)
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); closeOv(false); }
      else if ((e.key === 'Enter' || e.code === 'NumpadEnter') && e.target && e.target.classList && e.target.classList.contains('zod-qty')) {
        e.preventDefault();
        if (cur.fill) cur.fill();
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        var o = FR[cur.kind];
        frameSave(o ? frameOk(o) : null);
      }
      return;
    }
    if (e.key !== 'F4' || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
    if (IS_ITEM) { e.preventDefault(); e.stopPropagation(); copyHere(); }
    else if (itemWin()) { e.preventDefault(); e.stopPropagation(); quickNewItem(); }
  }, true);

  if (IS_ITEM) setupItemPage();
  else setupInvoicePage();
  // for checking the add-on by hand from the browser console
  window.__zodToolsT = { copyItem: copyItem, quickNewItem: quickNewItem, quickTransfer: quickTransfer, closeOv: closeOv,
    fetchStock: fetchStock, preSave: preSave, postSave: postSave, vatDefaults: vatDefaults };
})();
