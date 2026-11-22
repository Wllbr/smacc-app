/* ZOD - returns helper for SMACC (purchase + sales).
   Reads SMACC's own returns lists with the same login and fiscal year; never changes anything in SMACC.
   - invoice lists: return number(s) next to each invoice number, "مرتجع بالكامل" when fully returned
   - returns lists: open the original invoice, flag invoices that have more than one return
   - invoice screen: banner when the invoice has returns
   - return screen: warning when the same invoice already has another return
   - "↩ إرجاع" on invoice lists and "مرتجع كامل / جزئي" on a viewed invoice: opens a new return with the
     invoice loaded (and, for a full return, every line ticked with SMACC's own "select all"). Nothing is
     saved: the user checks it and presses حفظ.
   Returns are kept in Chrome's storage: new ones are fetched every few minutes, everything once a day
   (or when the status line above the list is clicked). */
(function () {
  'use strict';

  var PAGES = {
    'purchaseinvoicepage.aspx': { kind: 'invoice', side: 'p' },
    'purchasereturnpage.aspx': { kind: 'return', side: 'p' },
    'salesinvoicepage.aspx': { kind: 'invoice', side: 's' },
    'salesreturnpage.aspx': { kind: 'return', side: 's' }
  };
  var SIDES = {
    p: { inv: '/Inventory/PurchaseInvoicePage.aspx', ret: '/Inventory/PurchaseReturnPage.aspx' },
    s: { inv: '/Inventory/SalesInvoicePage.aspx', ret: '/Inventory/SalesReturnPage.aspx' }
  };
  var page = PAGES[location.pathname.split('/').pop().toLowerCase()];
  if (!page) return;
  var side = SIDES[page.side];

  var FULL_MS = 24 * 60 * 60 * 1000;   // reload every return once a day
  var CHECK_MS = 3 * 60 * 1000;        // look for new returns every 3 minutes
  var CHUNK = 500, INC = 50;

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function fmtDate(d) {
    d = String(d || '');
    return /^\d{8}$/.test(d) ? d.slice(6, 8) + '/' + d.slice(4, 6) + '/' + d.slice(0, 4) : d;
  }
  function fmtAmount(n) {
    var x = Number(n);
    return isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }
  function num(s) {
    var x = parseFloat(String(s || '').replace(/,/g, ''));
    return isFinite(x) ? x : null;
  }
  /* a clickable pill: "<word> <number>" with the number kept left-to-right */
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
  function pill(word, no, cls, title, onClick) {
    var a = linkLike(el('a', 'zod-pill ' + (cls || '')));
    a.appendChild(document.createTextNode(word + ' '));
    var b = el('bdi', null, no);
    b.dir = 'ltr';
    a.appendChild(b);
    if (title) a.title = title;
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      onClick();
    });
    return a;
  }
  function tag(text, cls, title) {
    var s = el('span', 'zod-tag ' + (cls || ''), text);
    if (title) s.title = title;
    return s;
  }
  function retTitle(r) {
    return 'مرتجع ' + r.doc + ' · ' + fmtDate(r.date) + ' · ' + fmtAmount(r.net) + ' ريال\nاضغط لفتح المرتجع';
  }
  function openIn(url, no) {
    openTab(url + '#zod-open=' + encodeURIComponent(no));
  }
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

  function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); }
  function firstVisible(sel, root) {
    var a = (root || document).querySelectorAll(sel);
    for (var i = 0; i < a.length; i++) if (vis(a[i])) return a[i];
    return null;
  }
  function editingNow() { return !!firstVisible('.btnSaveAddUpdate'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitFor(fn, ms) {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function loop() {
        var r = null;
        try { r = fn(); } catch (e) { r = null; }
        if (r || Date.now() - t0 > ms) return res(r || null);
        setTimeout(loop, 100);
      })();
    });
  }

  /* ---------- opened from another page: #zod-open=<number> ---------- */
  var hm = location.hash.match(/zod-open=([^&]+)/);
  if (hm) {
    var openNo = decodeURIComponent(hm[1]);
    history.replaceState(null, '', location.pathname + location.search);
    var tries = 0;
    (function waitForList() {
      if (!document.querySelector('#PageListing tbody tr[data-recordid]') && tries++ < 60) {
        setTimeout(waitForList, 500);
        return;
      }
      viewRecord(openNo);
    })();
  }

  /* ---------- a return made from an invoice: #zod-return=<invoice>[&part=1] ---------- */
  function startReturn(inv, part) {
    openTab(side.ret + '#zod-return=' + encodeURIComponent(inv) + (part ? '&part=1' : ''));
  }
  var RET_TIP = 'تفتح شاشة المرتجع في تبويب جديد والفاتورة محمّلة فيها. لا يُحفظ شيء حتى تضغط «حفظ».';
  function retPill(inv) {
    var a = linkLike(el('a', 'zod-pill zod-pill-ret', '↩ إرجاع'));
    a.title = 'مرتجع كامل لهذه الفاتورة (كل الأصناف بالكميات المتاحة للإرجاع).\n' + RET_TIP + '\nShift + ضغط: مرتجع جزئي (تكتب الكميات بنفسك)';
    a.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      startReturn(inv, ev.shiftKey);
    });
    return a;
  }
  function gridLines() {   // item lines loaded in the return form
    var out = [];
    document.querySelectorAll('#TheListFormGrid .ng-row').forEach(function (r) {
      var c = r.querySelector('#ItemCode');
      var g = function (n) { var x = r.querySelector('#' + n); return x ? x.value : ''; };
      if (!c || !c.value || c.disabled || num(g('Avail_Quantity')) === null) return;   // header row / empty row
      out.push({ row: r, code: c.value.trim(), name: g('ItemName').trim(), avail: num(g('Avail_Quantity')) || 0, qty: num(g('Quantity')) || 0 });
    });
    return out;
  }
  function formTotal() {
    var a = document.querySelectorAll('#TheListForm #NetAmount');
    for (var i = 0; i < a.length; i++) if (!a[i].closest('.ng-row, .modal')) return num(a[i].value);
    return null;
  }
  function retMsg(cls, build) {
    var b = document.getElementById('zod-retmsg'), f = document.getElementById('TheListForm');
    if (b) b.remove();
    if (!f || !build) return;
    b = el('div', 'zod-banner ' + cls);
    b.id = 'zod-retmsg';
    build(b);
    f.insertBefore(b, f.firstChild);
  }
  var preparing = false;
  async function prepareReturn(inv, part) {
    if (preparing) return;
    preparing = true;
    try {
      await waitFor(function () { return document.querySelector('#PageListing tbody tr') && document.getElementById('linkPageForm'); }, 30000);
      await sleep(300);
      if (editingNow()) {
        retMsg('zod-banner-warn', function (b) { b.appendChild(el('b', null, 'احفظ أو ألغِ المرتجع المفتوح أولاً، ثم اضغط «إرجاع» مرة أخرى للفاتورة ' + inv)); });
        return;
      }
      document.getElementById('linkPageForm').click();   // with nothing loaded SMACC opens a new return by itself
      if (!await waitFor(editingNow, 4000)) {
        var add = firstVisible('.btnAddNew1');
        if (add) add.click();
      }
      var box = await waitFor(function () {
        var x = document.getElementById('InvoiceNumber');
        return editingNow() && x && !x.disabled && !x.readOnly ? x : null;
      }, 8000);
      if (!box) {
        retMsg('zod-banner-red', function (b) { b.appendChild(el('b', null, 'تعذّر فتح مرتجع جديد. اضغط "اضافة جديد" ثم اكتب رقم الفاتورة ' + inv)); });
        return;
      }
      box.value = inv;
      document.getElementById('btnSearchInvoice').click();   // SMACC's own search: loads the invoice and its lines
      var lines = await waitFor(function () { var l = gridLines(); return l.length ? l : null; }, 6000);
      if (!lines) {
        retMsg('zod-banner-red', function (b) {
          b.appendChild(el('b', null, 'لم تُحمَّل أصناف الفاتورة ' + inv + '. '));
          b.appendChild(el('span', null, 'تأكد من الرقم ومن السنة المالية المختارة، وأن الفاتورة لم تُرجع بالكامل من قبل.'));
        });
        return;
      }
      var reason = document.getElementById('cpBulk_cpForm_ReturnReason');   // sales only; the reason used on all recent returns
      if (reason && (!reason.value || reason.value === '0') && reason.querySelector('option[value="4"]')) {
        reason.value = '4';
        reason.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (!part) {
        var all = document.getElementById('chkAllItem');
        if (all && !all.checked) all.click();   // SMACC fills every line with the quantity still available to return
        await sleep(500);
        lines = gridLines();
      }
      var open = lines.filter(function (l) { return l.avail > 0; });
      var short = part ? [] : open.filter(function (l) { return l.qty < l.avail - 0.0001; });
      var total = formTotal();
      retMsg(short.length || !open.length ? 'zod-banner-warn' : 'zod-banner-info', function (b) {
        if (!open.length) {
          b.appendChild(el('b', null, 'لا توجد كميات متاحة للإرجاع في الفاتورة ' + inv + ' (ربما أُرجعت بالكامل).'));
          return;
        }
        b.appendChild(el('b', null, (part ? 'مرتجع جزئي للفاتورة ' : 'مرتجع كامل للفاتورة ') + inv + ': '));
        b.appendChild(el('span', null, part ?
          'اكتب كمية المرتجع لكل صنف يرجع (' + open.length + ' صنف في الفاتورة)، ثم اضغط «حفظ».' :
          open.length + ' صنف' + (total !== null ? ' · صافي المرتجع ' + fmtAmount(total) + ' ريال' : '') + '. راجع ثم اضغط «حفظ».'));
        if (short.length) {
          b.appendChild(el('span', 'zod-sep', ' · '));
          b.appendChild(el('b', null, 'لم يضع SMACC الكمية كاملة (ربما الرصيد في المخزن أقل): ' + short.map(function (l) {
            return l.code + ' ' + l.qty + ' من ' + l.avail;
          }).join('، ')));
        }
      });
      if (part && open.length) {
        var q = open[0].row.querySelector('#Quantity');
        if (q && !q.readOnly && !q.disabled) { q.focus(); if (q.select) q.select(); }
      }
    } finally {
      preparing = false;
    }
  }
  function checkReturnHash() {
    var m = location.hash.match(/zod-return=([^&]+)(&part=1)?/);
    if (!m || page.kind !== 'return') return;
    history.replaceState(null, '', location.pathname + location.search);
    prepareReturn(decodeURIComponent(m[1]), !!m[2]);
  }
  checkReturnHash();
  window.addEventListener('hashchange', checkReturnHash);   // from the quick search while already on this page
  setInterval(function () {   // the note goes away once the return is saved or cancelled
    var b = document.getElementById('zod-retmsg');
    if (b && !preparing && !editingNow()) b.remove();
  }, 1000);

  /* ---------- returns cache ---------- */
  var data = null;                 // { full, checked, n, rows: [[doc, date, invoice, net], ...] }
  var byInv = new Map(), byDoc = new Map();
  var status = 'ok', syncing = null;

  function period() {
    var s = document.getElementById('HeaderBar1_ddlFiscalPeriods');
    return s && s.value ? s.value : 'x';
  }
  function cacheKey() { return 'zodret|' + location.host + '|' + page.side + '|' + period(); }

  function index() {
    byInv = new Map();
    byDoc = new Map();
    ((data && data.rows) || []).forEach(function (r) {
      var o = { doc: r[0], date: r[1], inv: r[2], net: r[3] };
      byDoc.set(o.doc, o);
      if (!o.inv) return;
      if (!byInv.has(o.inv)) byInv.set(o.inv, []);
      byInv.get(o.inv).push(o);
    });
    byInv.forEach(function (a) {
      a.sort(function (x, y) { return x.doc.localeCompare(y.doc, undefined, { numeric: true }); });
    });
  }
  function loadCache() {
    var k = cacheKey();
    return chrome.storage.local.get(k).then(function (o) { data = o[k] || null; index(); });
  }
  function saveCache() {
    var o = {};
    o[cacheKey()] = data;
    return chrome.storage.local.set(o);
  }
  function listPage(n, size) {
    var body = "{ 'CurrentPage' : '" + n + "', 'RecordsPerPage' : '" + size +
      "' ,'DDLSearchSelectedValue' : '0', 'SearchText' : '' }";
    return fetch(side.ret + '/LoadPageListing', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: body
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var o = JSON.parse(j.d);
      return {
        total: Number(o.totalRecords) || 0,
        rows: (o.pageList || []).map(function (x) {
          return [String(x.DocumentNumber || '').trim(), String(x.DocumentDate || ''),
            String(x.InvoiceNumber || '').trim(), Number(x.NetAmount) || 0];
        })
      };
    });
  }
  function dedupe(rows) {
    var m = new Map();
    rows.forEach(function (r) { if (r[0]) m.set(r[0], r); });
    return Array.from(m.values());
  }
  function fetchPages(from, to, size) {
    var rows = [], p = Promise.resolve();
    for (var i = from; i <= to; i++) {
      (function (i) {
        p = p.then(function () { return listPage(i, size).then(function (r) { rows = rows.concat(r.rows); }); });
      })(i);
    }
    return p.then(function () { return rows; });
  }
  function sync(force) {
    if (syncing) return syncing;
    status = (!data || force) ? 'loading' : 'busy';
    drawChip();
    syncing = listPage(1, 1).then(function (head) {
      var T = head.total;
      if (force || !data || Date.now() - (data.full || 0) > FULL_MS || T < (data.n || 0)) {
        return fetchPages(1, Math.ceil(T / CHUNK), CHUNK).then(function (rows) {
          data = { full: Date.now(), checked: Date.now(), n: T, rows: dedupe(rows) };
        });
      }
      if (T > data.n) {
        return fetchPages(Math.floor(data.n / INC) + 1, Math.ceil(T / INC), INC).then(function (rows) {
          data.rows = dedupe(data.rows.concat(rows));
          data.n = T;
          data.checked = Date.now();
        });
      }
      data.checked = Date.now();
    }).then(function () {
      index();
      status = 'ok';
      return saveCache();
    }).catch(function () {   // shown on the page as the red "تعذّر" chip, not in Chrome's error list
      status = 'err';
    }).then(function () {
      syncing = null;
      render();
    });
    return syncing;
  }

  /* ---------- status line above the list ---------- */
  var chip = null;
  function drawChip() {
    var tbl = document.getElementById('PageListing');
    if (!tbl || !tbl.parentElement) return;
    if (!chip) {
      chip = el('div', 'zod-chip');
      chip.title = 'اضغط لإعادة تحميل كل المرتجعات من SMACC';
      chip.addEventListener('click', function () { sync(true); });
    }
    if (chip.parentElement !== tbl.parentElement || chip.nextSibling !== tbl) tbl.parentElement.insertBefore(chip, tbl);
    var t = data && data.checked ?
      new Date(data.checked).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
    var txt = status === 'loading' ? 'جاري تحميل المرتجعات من SMACC… (أول مرة قد تأخذ دقيقة)' :
      status === 'busy' ? 'جاري تحديث المرتجعات…' :
      status === 'err' ? 'تعذّر تحديث المرتجعات · اضغط للمحاولة مرة أخرى' :
      'المرتجعات (' + (data ? data.rows.length : 0) + ') · آخر تحديث ' + t + ' · ⟳ تحديث';
    if (chip.textContent !== txt) chip.textContent = txt;
    chip.classList.toggle('zod-chip-err', status === 'err');
  }

  /* ---------- lists ---------- */
  function colIndex(tbl, re) {
    var ths = tbl.querySelectorAll('thead th');
    for (var i = 0; i < ths.length; i++) if (re.test(ths[i].textContent.trim())) return i;
    return -1;
  }
  function mark(cell, key) {
    if (cell.getAttribute('data-zod') === key) return false;
    cell.querySelectorAll('.zod-wrap').forEach(function (e) { e.remove(); });
    cell.setAttribute('data-zod', key);
    return true;
  }

  function renderInvoiceList(tbl) {
    var netCol = colIndex(tbl, /^صافي المبلغ$/);
    tbl.querySelectorAll('tbody tr[data-recordid]').forEach(function (tr) {
      var inv = tr.getAttribute('data-recordid'), cell = tr.cells[0];
      if (!cell) return;
      var rets = byInv.get(inv) || [];
      if (!mark(cell, inv + '|' + rets.map(function (r) { return r.doc; }).join(',') + '|r')) return;
      var invNet = netCol >= 0 && tr.cells[netCol] ? num(tr.cells[netCol].textContent) : null;
      var sum = rets.reduce(function (s, r) { return s + r.net; }, 0);
      var full = rets.length && invNet !== null && invNet > 0 && sum >= invNet - 0.01;
      var wrap = el('span', 'zod-wrap');
      if (full) {
        wrap.appendChild(tag('مرتجع بالكامل', 'zod-full', 'إجمالي المرتجع ' + fmtAmount(sum) + ' من ' + fmtAmount(invNet) + ' ريال'));
      }
      rets.forEach(function (r) {
        var t = retTitle(r) + (invNet !== null ? '\nإجمالي المرتجع ' + fmtAmount(sum) + ' من ' + fmtAmount(invNet) + ' ريال' : '');
        wrap.appendChild(pill('مرتجع', r.doc, '', t, function () { openIn(side.ret, r.doc); }));
      });
      if (!full) wrap.appendChild(retPill(inv));
      cell.appendChild(wrap);
    });
  }

  function renderReturnList(tbl) {
    var invCol = colIndex(tbl, /^رقم الفاتور[هة]$/);
    tbl.querySelectorAll('tbody tr[data-recordid]').forEach(function (tr) {
      var doc = tr.getAttribute('data-recordid');
      var r = byDoc.get(doc);
      var cell = invCol >= 0 && tr.cells[invCol] ? tr.cells[invCol] : tr.cells[0];
      if (!cell) return;
      var inv = r && r.inv;
      if (invCol >= 0) {
        var own = cell.textContent, w = cell.querySelector('.zod-wrap');
        if (w) own = own.replace(w.textContent, '');
        inv = own.trim() || inv;
      }
      if (!inv) return;
      var others = (byInv.get(inv) || []).filter(function (x) { return x.doc !== doc; });
      if (!mark(cell, inv + '|' + others.map(function (x) { return x.doc; }).join(','))) return;
      var wrap = el('span', 'zod-wrap');
      wrap.appendChild(pill(invCol >= 0 ? '↗ فتح' : 'فاتورة', invCol >= 0 ? '' : inv, 'zod-pill-inv',
        'فتح الفاتورة ' + inv + ' (عرض فقط)', function () { openIn(side.inv, inv); }));
      if (others.length) {
        wrap.appendChild(tag(others.length === 1 ? 'مرتجع آخر لنفس الفاتورة' : others.length + ' مرتجعات أخرى لنفس الفاتورة', 'zod-warn',
          'لنفس الفاتورة ' + inv + ' أيضاً:\n' + others.map(function (x) {
            return x.doc + ' · ' + fmtDate(x.date) + ' · ' + fmtAmount(x.net) + ' ريال';
          }).join('\n')));
      }
      cell.appendChild(wrap);
    });
  }

  /* ---------- invoice / return screens ---------- */
  function formState() {
    var invEl = document.getElementById('cpBulk_cpForm_InvoiceNumber') || document.getElementById('InvoiceNumber');
    var docEl = document.getElementById('cpBulk_cpForm_DocumentNumber') || document.getElementById('DocumentNumber');
    var form = document.getElementById('TheListForm');
    var pane = form && form.closest('.tab-pane');
    return {
      inv: invEl ? invEl.value.trim() : '',
      viewOnly: !!(invEl && (invEl.disabled || invEl.readOnly)),
      doc: docEl ? docEl.value.trim() : '',
      form: form,
      visible: !!form && (pane ? pane.classList.contains('active') : !!form.offsetParent)
    };
  }
  function renderBanner() {
    var s = formState();
    var b = document.getElementById('zod-banner');
    if (!s.form || !s.visible || !s.inv || !data) { if (b) b.remove(); return; }
    var rets = byInv.get(s.inv) || [];
    if (page.kind === 'return') rets = rets.filter(function (r) { return r.doc !== s.doc; });
    var key = page.kind + '|' + s.inv + '|' + s.doc + '|' + s.viewOnly + '|' + rets.map(function (r) { return r.doc; }).join(',');
    if (b && b.getAttribute('data-k') === key && b.parentElement === s.form) return;
    if (b) b.remove();
    var sum = rets.reduce(function (t, r) { return t + r.net; }, 0);

    if (page.kind === 'invoice') {
      if (!rets.length) return;
      b = el('div', 'zod-banner zod-banner-red');
      b.appendChild(el('b', null, rets.length > 1 ?
        'هذه الفاتورة عليها ' + rets.length + ' مرتجعات بإجمالي ' + fmtAmount(sum) + ' ريال: ' :
        'هذه الفاتورة عليها مرتجع بمبلغ ' + fmtAmount(sum) + ' ريال: '));
      rets.forEach(function (r) {
        b.appendChild(pill('مرتجع', r.doc, '', retTitle(r), function () { openIn(side.ret, r.doc); }));
      });
    } else {
      if (!rets.length && !s.viewOnly) return;
      b = el('div', 'zod-banner ' + (rets.length ? 'zod-banner-warn' : 'zod-banner-info'));
      if (rets.length) {
        var many = rets.length > 1;
        b.appendChild(el('b', null, (s.viewOnly ?
          (many ? 'لنفس الفاتورة ' + rets.length + ' مرتجعات أخرى' : 'لنفس الفاتورة مرتجع آخر') :
          (many ? 'تنبيه: هذه الفاتورة عليها ' + rets.length + ' مرتجعات سابقة' : 'تنبيه: هذه الفاتورة عليها مرتجع سابق')) +
          ' بإجمالي ' + fmtAmount(sum) + ' ريال: '));
        rets.forEach(function (r) {
          b.appendChild(pill('مرتجع', r.doc, '', retTitle(r), function () { openIn(side.ret, r.doc); }));
        });
        b.appendChild(el('span', 'zod-sep', ' · '));
      }
      b.appendChild(el('span', null, 'الفاتورة الأصلية: '));
      b.appendChild(pill('فاتورة', s.inv, 'zod-pill-inv', 'فتح الفاتورة (عرض فقط)', function () { openIn(side.inv, s.inv); }));
    }
    b.id = 'zod-banner';
    b.setAttribute('data-k', key);
    s.form.insertBefore(b, s.form.firstChild);
  }

  /* viewed (saved) invoice: return buttons next to SMACC's "اضافة جديد" */
  function retButton(text, title, onClick) {
    var b = el('button', 'btn btn-md bot-buffer zod-retbtn', text);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onClick(); });
    return b;
  }
  function renderInvoiceTools() {
    var box = document.getElementById('zod-rettools');
    if (page.kind !== 'invoice') return;
    var s = formState();
    var show = !!(s.form && s.visible && s.inv && s.viewOnly && !editingNow() && data);
    if (!show) { if (box) box.remove(); return; }
    var rets = byInv.get(s.inv) || [], net = formTotal();
    var sum = rets.reduce(function (t, r) { return t + r.net; }, 0);
    var full = rets.length && net !== null && net > 0 && sum >= net - 0.01;
    var key = s.inv + '|' + (full ? 1 : 0);
    var anchor = firstVisible('.btnAddNew1');
    var where = anchor ? anchor.parentNode : s.form;
    if (box && box.getAttribute('data-k') === key && box.parentNode === where) return;
    if (box) box.remove();
    box = el('span', 'zod-rettools');
    box.id = 'zod-rettools';
    box.setAttribute('data-k', key);
    if (full) {
      box.appendChild(tag('مرتجع بالكامل', 'zod-full', 'إجمالي المرتجع ' + fmtAmount(sum) + ' من ' + fmtAmount(net) + ' ريال'));
    } else {
      var inv = s.inv;
      box.appendChild(retButton('↩ مرتجع كامل', 'كل أصناف الفاتورة بالكميات المتاحة للإرجاع.\n' + RET_TIP, function () { startReturn(inv, false); }));
      box.appendChild(retButton('↩ مرتجع جزئي', 'الفاتورة محمّلة وتكتب كمية المرتجع لكل صنف بنفسك.\n' + RET_TIP, function () { startReturn(inv, true); }));
    }
    if (anchor) where.insertBefore(box, anchor.nextSibling);
    else where.insertBefore(box, where.firstChild);
  }

  /* ---------- render loop ---------- */
  var rendering = false;
  function render() {
    rendering = true;
    try {
      var tbl = document.getElementById('PageListing');
      if (tbl) {
        drawChip();
        if (data) (page.kind === 'invoice' ? renderInvoiceList : renderReturnList)(tbl);
      }
      renderBanner();
      renderInvoiceTools();
    } finally {
      rendering = false;
    }
  }
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; render(); }, 150);
  }
  new MutationObserver(function (muts) {
    if (rendering) return;
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t && t.closest && t.closest('.zod-wrap,.zod-chip,.zod-banner,.zod-rettools')) continue;
      schedule();
      return;
    }
  }).observe(document.body, { childList: true, subtree: true });

  setInterval(function () { renderBanner(); renderInvoiceTools(); }, 800);   // field values change without DOM mutations
  setInterval(function () {
    if (!syncing && (!data || Date.now() - (data.checked || 0) > CHECK_MS)) sync();
  }, 60 * 1000);

  loadCache().then(function () {
    render();
    if (!data || Date.now() - (data.checked || 0) > CHECK_MS) sync();
  });
})();
