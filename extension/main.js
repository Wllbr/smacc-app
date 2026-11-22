/* ZOD - runs inside SMACC's own page (world: MAIN), before SMACC's scripts.
   1. Translation cache: every SMACC page asks the server for ~35 screen texts one by one
      (CommonWebService.asmx/GetLocalResourcesJS, each ~0.1 s and blocking the page).
      The answers are kept in this computer's browser for 7 days, per language, so later page loads skip them.
   1b. A read-only lookup SMACC repeats within 2 seconds (customer record, discount, date…) gets the answer the
      server has just given, instead of freezing the page again for the same answer.
   2. A small bridge so the add-on can fill SMACC fields the way SMACC itself does ($(field).val(x).blur()),
      one box at a time or a new invoice's whole header in one go.
   3. Item window: the item code box gets the cursor as soon as the window opens, and X / إلغاء close the
      window at once (SMACC's blocking checks of the box being left are skipped: cancelling discards the window).
   4. Prints open apart from this tab, so SMACC keeps working while a print (and its print dialog) is open.
   5. Customer boxes: typing a name, mobile, VAT or CR number lists the matching customers from the add-on's
      customer list (cust.js) in SMACC's own list, at once and without a server call; a saved customer, and
      every customer record SMACC loads, is passed to cust.js so its list stays up to date.
   6. Sales invoice: the invoice type follows the customer's VAT number, and the items stay when the customer changes.
   7. Item card: choosing a category, "اضافة جديد" and حفظ no longer wait for server answers SMACC does not use
      (the whole item list of the category, three times) or already has (a category's empty units / prices).
   8. Answers that do not change for a while (settings, salesperson, branch, discount, item details, prices,
      today's date) are kept for minutes to hours, so pages, new invoices and items typed in stop waiting for them;
      stock is always asked fresh; the list's dates are put in the company's date format by the add-on itself.
   9. SMACC's grey loading screen: a thin moving line at the top while a page starts, and the hidden box SMACC
      opened and closed around every server call is skipped.
   10. Drafts (fast.js): a new sales invoice saved is told to fast.js, which then closes its tab when another new
      invoice is waiting in another tab; and fast.js can ask how many items an invoice has and their total. */
(function () {
  'use strict';
  if (window.__zodMain) return;
  window.__zodMain = true;

  /* ---------- 1. translation cache ---------- */
  var RX = /\/WebServices\/CommonWebService\.asmx\/GetLocalResourcesJS(\?|$)/i;
  var PFX = 'zodtr1|';
  var TTL = 7 * 24 * 60 * 60 * 1000;
  var LS = null;
  try { LS = window.localStorage; } catch (e) { LS = null; }
  var stats = window.__zodTrStats = { hit: 0, miss: 0, stored: 0 };

  function lang() {
    var d = document.documentElement ? (document.documentElement.getAttribute('dir') || '') : '';
    return String(window.loggedInCulture || '') + '/' + d.toLowerCase();
  }
  function keyFor(body) { return PFX + lang() + '|' + String(body).replace(/\s+/g, ''); }
  function valid(text) {
    try { var o = JSON.parse(text); return !!o && typeof o.d === 'string'; } catch (e) { return false; }
  }
  function read(k) {
    try {
      var v = LS.getItem(k);
      if (!v) return null;
      var o = JSON.parse(v);
      if (!o || typeof o.r !== 'string' || Date.now() - o.t > TTL) return null;
      return o.r;
    } catch (e) { return null; }
  }
  function clearAll() {
    try {
      for (var i = LS.length - 1; i >= 0; i--) {
        var k = LS.key(i);
        if (k && k.indexOf('zodtr') === 0) LS.removeItem(k);
      }
    } catch (e) { /* ignore */ }
  }
  function write(k, text) {
    try { LS.setItem(k, JSON.stringify({ t: Date.now(), r: text })); stats.stored++; }
    catch (e) { clearAll(); }   // storage full: start again
  }
  /* answer an XHR from the cache, the same way the browser would have */
  function answer(xhr, text, async, url) {
    var props = {
      readyState: 4, status: 200, statusText: 'OK', responseText: text, response: text,
      responseURL: url || location.origin + '/WebServices/CommonWebService.asmx/GetLocalResourcesJS'
    };
    Object.keys(props).forEach(function (p) {
      Object.defineProperty(xhr, p, { configurable: true, get: function () { return props[p]; } });
    });
    xhr.getAllResponseHeaders = function () { return 'content-type: application/json; charset=utf-8\r\n'; };
    xhr.getResponseHeader = function (n) { return /^content-type$/i.test(n) ? 'application/json; charset=utf-8' : null; };
    function fire() {
      ['readystatechange', 'load', 'loadend'].forEach(function (t) {
        try { xhr.dispatchEvent(t === 'readystatechange' ? new Event(t) : new ProgressEvent(t)); } catch (e) { /* ignore */ }
      });
    }
    if (async) setTimeout(fire, 0); else fire();
  }

  if (LS && window.XMLHttpRequest) {
    var P = XMLHttpRequest.prototype, oOpen = P.open, oSend = P.send;
    P.open = function (method, url, async) {
      try {
        this.__zodTr = (String(method).toUpperCase() === 'POST' && RX.test(String(url))) ?
          { async: arguments.length < 3 || async !== false } : null;
      } catch (e) { this.__zodTr = null; }
      return oOpen.apply(this, arguments);
    };
    P.send = function (body) {
      var z = this.__zodTr;
      if (!z || typeof body !== 'string') return oSend.apply(this, arguments);
      var k, hit = null;
      try { k = keyFor(body); hit = read(k); } catch (e) { hit = null; }
      if (hit !== null) {
        stats.hit++;
        answer(this, hit, z.async);
        return;
      }
      stats.miss++;
      var xhr = this;
      function store() {
        try { if (xhr.readyState === 4 && xhr.status === 200 && valid(xhr.responseText)) write(k, xhr.responseText); }
        catch (e) { /* ignore */ }
      }
      if (z.async) xhr.addEventListener('load', store);
      var r = oSend.apply(this, arguments);
      if (!z.async) store();
      return r;
    };
  }
  document.addEventListener('zod:trclear', clearAll);

  /* ---------- 1b. the same question again, straight away ----------
     While a new invoice is set up, SMACC asks the server the same thing several times within a second and waits
     for every answer with the page frozen: the customer record (CustomersPage LoadRec) 3 times, the discount
     (GetDiscountRate) twice, the date (GetSmaccDate) twice. When exactly the same lookup goes to the same address
     again within 2 seconds, and nothing else was sent to the server in between, it gets the answer the server
     has just given. Only these read-only lookups; anything else sent to the server (a save, for example) makes
     the add-on forget all of them. Every page also loads the language list twice in a row (LoadLocalLanguages).
     And filling the salesperson before the customer makes SMACC ask for the customer with an empty code
     (CustomersPage LoadRec, key ''), whose answer is always "none" ({"d":""}): the add-on answers that itself. */
  var SAME = /\/(webservices\/commonwebservice\.asmx\/(getsmaccdate|selectsalesmandetails|autocompletesearchcodename)|inventory\/customerspage\.aspx\/loadrec|inventory\/[a-z]+page\.aspx\/getdiscountrate|common\/companyprofile\.aspx\/loadlocallanguages)$/;
  var NO_CUSTOMER = /^\{\s*'key'\s*:\s*''\s*\}$/;
  var SAME_MS = 2000;
  var lastAns = {};   // address → { body, text, t } of the latest real answer
  var sameStats = window.__zodSameStats = { hit: 0, real: 0, none: 0 };
  function pathOf(url) {
    try { return new URL(String(url), location.href).pathname.toLowerCase(); } catch (e) { return ''; }
  }
  /* a customer saved (customers screen, or "إنشاء" next to an invoice's customer box): tell cust.js */
  var CUST_SAVE = /\/inventory\/customerspage\.aspx\/(saverec|updaterec|insertrec|deleterec)$/;
  function custSaved(xhr, body) {
    var code = '';
    try {
      var m = String(body || '').match(/CustomerCode\\?["']?\s*:\s*\\?["']?(\d+)/);
      code = m ? m[1] : '';
    } catch (e) { code = ''; }
    xhr.addEventListener('load', function () {
      try { if (xhr.status === 200) document.dispatchEvent(new CustomEvent('zod:custsaved', { detail: code })); }
      catch (e) { /* ignore */ }
    });
  }
  /* a customer record SMACC loads itself (a customer chosen in an invoice, opened in the customers screen):
     cust.js takes the ZATCA "other buyer ID" (mostly the CR number) from it, which SMACC's customer list lacks */
  var CUST_REC = /\/inventory\/customerspage\.aspx\/loadrec$/;
  function custRec(xhr) {
    xhr.addEventListener('load', function () {
      try {
        var t = xhr.status === 200 ? xhr.responseText : '';
        if (typeof t === 'string' && t.length > 20) document.dispatchEvent(new CustomEvent('zod:custrec', { detail: t }));
      } catch (e) { /* ignore */ }
    });
  }
  if (window.XMLHttpRequest) {
    var P2 = XMLHttpRequest.prototype, open2 = P2.open, send2 = P2.send;
    P2.open = function (method, url, async) {
      try {
        this.__zodSame = {
          path: pathOf(url), url: new URL(String(url), location.href).href,
          post: String(method).toUpperCase() === 'POST', async: arguments.length < 3 || async !== false
        };
      } catch (e) { this.__zodSame = null; }
      return open2.apply(this, arguments);
    };
    P2.send = function (body) {
      var z = this.__zodSame;
      if (z && RX.test(z.path)) return send2.apply(this, arguments);   // translations: a lookup (cache above)
      if (z && z.post && CUST_SAVE.test(z.path)) custSaved(this, body);
      if (z && z.post && CUST_REC.test(z.path)) custRec(this);
      if (!z || !z.post || !SAME.test(z.path) || (body != null && typeof body !== 'string')) {
        lastAns = {};   // this may change something on the server: forget every answer
        return send2.apply(this, arguments);
      }
      var b = body == null ? '' : body, prev = lastAns[z.path];
      if (!z.async && NO_CUSTOMER.test(b) && /\/customerspage\.aspx\/loadrec$/.test(z.path)) {
        sameStats.none++;
        answer(this, '{"d":""}', false, z.url);
        return;
      }
      var same = prev && prev.body === b && Date.now() - prev.t < SAME_MS;
      if (same && !z.async) {
        sameStats.hit++;
        answer(this, prev.text, false, z.url);
        return;
      }
      if (!same) delete lastAns[z.path];
      if (z.async) return send2.apply(this, arguments);   // only the waiting (blocking) calls are answered
      sameStats.real++;
      var r = send2.apply(this, arguments);
      try {
        if (this.readyState === 4 && this.status === 200 && typeof this.responseText === 'string') {
          lastAns[z.path] = { body: b, text: this.responseText, t: Date.now() };
        }
      } catch (e) { /* no answer to keep */ }
      return r;
    };
  }

  /* ---------- 2. bridge: fill SMACC fields with SMACC's own jQuery ---------- */
  function runStep($, s) {
    var $el = $(s.sel).first();
    if (!$el.length) return;
    // ifEmpty: only an empty box that can be typed in (SMACC may have filled it from an earlier box)
    if (s.ifEmpty && ($.trim($el.val() || '') || $el.prop('disabled') || $el.prop('readonly') || !$el.is(':visible'))) return;
    if (s.ifDiff && ($el.val() === s.val || $el.prop('disabled'))) return;
    if (s.op === 'blur') $el.val(s.val).blur();
    else if (s.op === 'change') $el.val(s.val).change();
    else if (s.op === 'focus') $el.focus().select();
  }
  /* A new invoice's header filled in one go. Filling the salesperson makes SMACC put the cursor in the warehouse
     box while it is still empty, and an empty box with the cursor opens SMACC's full warehouse list: a slow
     server search that held up the next lookups by about half a second, for a box filled a moment later anyway.
     So while the header is being filled, the boxes being filled do not open their list. */
  function fillAll($, steps) {
    var held = [];
    steps.forEach(function (s) {
      var ac = $(s.sel).first().data('ui-autocomplete');
      if (!ac || Object.prototype.hasOwnProperty.call(ac, 'search')) return;
      ac.search = function (v) { if (v) return Object.getPrototypeOf(this).search.apply(this, arguments); };
      held.push(ac);
    });
    try {
      steps.forEach(function (s) {
        try { runStep($, s); } catch (err) { /* SMACC's own field code failed: go on with the next box */ }
      });
    } finally {
      held.forEach(function (ac) { delete ac.search; });
    }
  }
  document.addEventListener('zod:jq', function (e) {
    var $ = window.jQuery;
    if (!$) return;
    try {
      var o = JSON.parse(e.detail);
      if (o.op === 'fill') { fillAll($, o.steps || []); try { taxCheck(); } catch (err) { /* ignore */ } return; }
      if (o.op === 'grid') {   // fast.js asks: does the invoice have items? (answer on <html>, read at once)
        var g = typeof window.IsRecordExistsInGrid === 'function' ? (window.IsRecordExistsInGrid() ? '1' : '0') : '';
        document.documentElement.setAttribute('data-zod-grid', g);
        return;
      }
      if (o.op === 'dr') {   // fast.js asks: how many items, and their total (answer on <html>, read at once)
        document.documentElement.setAttribute('data-zod-dr', JSON.stringify(gridSum($)));
        return;
      }
      runStep($, o);
    } catch (err) {
      /* SMACC's own field code failed (e.g. logged out): leave the field as it is */
    }
  });

  /* ---------- 3. item window: cursor in the item code box ---------- */
  function focusItemCode($m) {
    var $ic = $m.find('#ItemCode');
    if ($m.hasClass('in') && $ic.length && !$ic.prop('disabled') && !$ic.prop('readonly') && !$ic.val()) $ic.focus();
  }
  function initItemFocus() {
    var $ = window.jQuery;
    if (!$ || window.__zodItemFocus) return;
    window.__zodItemFocus = true;
    // the item window opens (and closes) without its half-second slide-in, so the item list comes up at once
    $(document).on('show.bs.modal', '.modal', function (e) {
      if (e.target === this && /DetailOuterContainer$/.test(this.id)) $(this).removeClass('fade');
    });
    $(document).on('shown.bs.modal', '.modal', function () {
      if (/DetailOuterContainer$/.test(this.id)) focusItemCode($(this));
    });
    $(document).on('click', '.btnAddContinue', function () {
      var $m = $(this).closest('.modal');
      setTimeout(function () { focusItemCode($m); }, 400);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initItemFocus);
  else initItemFocus();

  /* Item window: X and إلغاء close it at once.
     Leaving a box in the item window makes SMACC check it again with blocking server calls: the item code box
     looks the item up (SelectItemCardDetailString, SelectItemCardCurrentStock) even when it is empty, and the
     quantity, price and discount boxes work the line out again. Pressing X or إلغاء leaves the box first, so the
     tab froze (0.3 to 3 seconds) before the window closed. إلغاء throws away everything in the window (SMACC keeps
     nothing from it), so those checks are skipped when the box is left by pressing X or إلغاء. If the press is
     dragged off the button and the window stays open, the skipped checks run after all. */
  var CLOSE_BTN = '.close[data-dismiss="modal"], .CancelDialog, [id$="btnCancelDialog"]';
  var closing = null;
  function itemWinOf(n) {
    var m = n && n.closest ? n.closest('.modal') : null;
    return m && /DetailOuterContainer$/.test(m.id) ? m : null;
  }
  function closeList(f) {   // what SMACC's item list does itself when its box is left
    try {
      var ac = window.jQuery && window.jQuery(f).data('ui-autocomplete');
      if (ac) { clearTimeout(ac.searching); ac.close(); }
    } catch (e) { /* no list */ }
  }
  function catchUp(c) {   // the window stayed open: let SMACC check the box after all
    var $ = window.jQuery, f = c.field, win = itemWinOf(f);
    if (!$ || !win || !$(win).hasClass('in') || !(c.hit.change || c.hit.blur || c.hit.focusout)) return;
    try {
      if (c.hit.change) $(f).trigger('change');
      if (c.hit.blur || c.hit.focusout) $(f).trigger('blur');
    } catch (e) { /* SMACC's own field code failed: leave the box as it is */ }
  }
  document.addEventListener('mousedown', function (e) {
    var old = closing;
    closing = null;
    if (old) catchUp(old);
    var t = e.target, btn = e.button === 0 && t && t.closest ? t.closest(CLOSE_BTN) : null;
    var win = itemWinOf(btn), f = document.activeElement;
    if (!win || !f || f === btn || !win.contains(f) || !/^(INPUT|SELECT|TEXTAREA)$/.test(f.tagName)) return;
    var c = closing = { btn: btn, field: f, armed: true, hit: {} };
    setTimeout(function () { c.armed = false; }, 0);   // the box is left during this press, not later
  }, true);
  function skipCheck(e) {
    var c = closing;
    if (!c || !c.armed || e.target !== c.field) return;
    c.hit[e.type] = true;
    e.stopImmediatePropagation();
    if (e.type === 'blur') closeList(c.field);
  }
  ['change', 'blur', 'focusout'].forEach(function (t) { window.addEventListener(t, skipCheck, true); });
  window.addEventListener('click', function (e) {
    var c = closing, t = e.target;
    if (c && t && t.closest && t.closest(CLOSE_BTN) === c.btn) closing = null;   // released on the button: the window closes
  }, true);
  window.addEventListener('mouseup', function () {
    var c = closing;
    if (!c) return;
    setTimeout(function () {   // runs after the click, if there is one
      if (closing !== c) return;
      closing = null;
      catchUp(c);
    }, 0);
  }, true);

  /* ---------- 4. prints open in their own browser process ----------
     SMACC opens a print (PrintReport.aspx, FAPrintReport.aspx …) with window.open, and the print page opens
     Chrome's print dialog by itself. Without 'noopener' Chrome keeps that window together with this tab, so this
     tab stops while the print loads and for as long as the print dialog stays open. SMACC never uses the window
     it gets back for these pages, so they are opened with 'noopener' (same address, same login). */
  var PRINT_PAGE = /\/[^\/]*print[^\/]*\.aspx$/i;
  function isPrintPage(url) {
    try { return PRINT_PAGE.test(new URL(String(url), document.baseURI).pathname); } catch (e) { return false; }
  }
  function noop() { /* the print window cannot be reached from here any more */ }
  var winOpen = window.open;
  if (typeof winOpen === 'function') {
    window.open = function (url, target, features) {
      if (url && isPrintPage(url)) {
        var f = features ? String(features) : '';
        if (!/(^|,)\s*noopener\s*(=|,|$)/i.test(f)) f = f ? f + ',noopener' : 'noopener';
        try {
          winOpen.call(window, url, target || '_blank', f);
          return { closed: false, focus: noop, blur: noop, close: noop, print: noop, postMessage: noop };
        } catch (e) { /* fall back to SMACC's own call */ }
      }
      return winOpen.apply(this, arguments);
    };
  }

  /* ---------- 5. customer boxes: name, mobile, VAT or CR number ----------
     SMACC's customer boxes (SCN on INV_CustomersNames) search the server for the code or name typed, with its
     "loading" window, one search at a time. The add-on keeps every customer on this computer (cust.js), so while
     a customer box is typed in, the matching customers (by name, mobile, VAT or CR number) go straight into
     SMACC's own list, with their mobile, VAT and CR numbers. Choosing one works exactly as before (SMACC's own
     code fills the customer). SMACC's old list is not used: an empty box shows nothing (SMACC listed every
     customer), and a double click no longer opens SMACC's list or its "العملاء" search window. The server is
     still asked while the add-on has no list yet (its first fetch; shown the same way, code and name only) and
     for a box limited by SMACC (e.g. to one salesperson's customers, off at ZOD). The list opens under the box,
     or above it when there is more room there, and never covers it. */
  var custAns = null;
  document.addEventListener('zod:custa', function (e) { custAns = typeof e.detail === 'string' ? e.detail : null; });
  function askCust(term) {   // cust.js answers while this waits (events run at once, also across worlds)
    custAns = null;
    try { document.dispatchEvent(new CustomEvent('zod:custq', { detail: String(term == null ? '' : term) })); }
    catch (e) { return null; }
    try { return custAns ? JSON.parse(custAns) : null; } catch (e) { return null; }
  }
  function node(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function custRow($, ul, it) {   // name, code, "مكرر" / "موقوف", then mobile · VAT · CR (what matched in green)
    var z = it.zod, a = node('a'), row = node('div', 'zod-crow'), top = node('div', 'zod-ctop');
    top.appendChild(node('span', 'zod-cname' + (z.h === 'n' ? ' zod-chit' : ''), z.n));
    var code = node('bdi', 'zod-ccode' + (z.h === 'c' ? ' zod-chit' : ''), z.c);
    code.dir = 'ltr';
    top.appendChild(code);
    if (z.d) { var d = node('span', 'zod-cdup', 'مكرر'); d.title = z.d; top.appendChild(d); }
    if (z.s) top.appendChild(node('span', 'zod-cstop', 'موقوف'));
    row.appendChild(top);
    var meta = node('div', 'zod-cmeta');
    [['p', 'جوال', z.p], ['v', 'ضريبي', z.v], ['r', 'سجل', z.r], ['o', z.ol, z.o]].forEach(function (f) {
      if (!f[2]) return;
      var s = node('span', 'zod-cf' + (z.h === f[0] ? ' zod-chit' : ''), f[1] + ' ');
      var b = node('bdi', null, f[2]);
      b.dir = 'ltr';
      s.appendChild(b);
      meta.appendChild(s);
    });
    if (z.d) meta.appendChild(node('span', 'zod-cduptext', z.d));
    if (meta.firstChild) row.appendChild(meta);
    a.appendChild(row);
    return $('<li class="zod-cli"></li>').append(a).appendTo(ul);
  }
  function placeMenu(input, ul) {   // under the box, or above it when there is more room there; never over it
    var r = input.getBoundingClientRect(), below = window.innerHeight - r.bottom - 10, above = r.top - 75;   // SMACC's fixed header
    var down = below >= 260 || below >= above;
    ul.style.setProperty('max-height', Math.max(140, Math.floor(down ? below : above)) + 'px', 'important');
    return down ? { my: 'right top', at: 'right bottom+2', collision: 'fit none' } : { my: 'right bottom', at: 'right top-2', collision: 'fit none' };
  }
  function custScn(t) {   // SMACC's customer box (SCN) of this input, when the add-on answers it
    var $ = window.jQuery, scn = $ && t && t.tagName === 'INPUT' ? $(t).data('jq-SCN') : null, o = scn && scn.options;
    if (!o || String(o.table) !== 'INV_CustomersNames') return null;
    // optionalParam "false,<salesperson>,0,": SMACC's "customers linked to the salesperson" is off (as at ZOD),
    // the server then lists every customer. When it is on ("true,…"), SMACC's own search is used.
    var op = String(o.optionalParam || '');
    return o.subSupport || !(!op || /^false(,|$)/i.test(op)) || o.isSearchInGivenValues === 'True' ? null : scn;
  }
  function hookCust(input) {
    var $ = window.jQuery;
    if (!$ || !input) return;
    var $i = $(input), scn = $i.data('jq-SCN'), ac = $i.data('ui-autocomplete');
    if (!scn || !ac || ac.__zodCust || !scn.options || String(scn.options.table) !== 'INV_CustomersNames') return;
    if (typeof ac.source !== 'function' || typeof ac._renderItem !== 'function') return;
    ac.__zodCust = true;
    var src = ac.source, render = ac._renderItem, menu = ac._renderMenu, pos = ac.options.position, more = 0;
    ac.source = function (req, resp) {
      var term = String((req && req.term) || '').trim();
      if (!custScn(input)) return src.apply(this, arguments);
      more = 0;
      // empty box, or not typed in since it got focus (SMACC searches on focus): no list
      if (!term || !input.__zodTyped) { resp([]); return; }
      var a = askCust(term);
      if (a && a.ready) {   // from this computer; nothing found = no list (cust.js then looks for new customers)
        more = (a.total || 0) - (a.items || []).length;
        resp((a.items || []).map(function (x) { return { Code: x.c, Name: x.n, zod: x }; }));
        return;
      }
      // no list on this computer yet (its first fetch is running): SMACC's search, shown the same way
      return src.call(this, req, function (list) {
        resp((list || []).map(function (x) {
          return x && x.Code != null ? $.extend({}, x, { zod: { c: String(x.Code).trim(), n: String(x.Name || '').trim() } }) : x;
        }));
      });
    };
    ac._renderItem = function (ul, it) { return it && it.zod ? custRow($, ul, it) : render.apply(this, arguments); };
    ac._renderMenu = function (ul, items) {
      var mine = !!(items && items[0] && items[0].zod);
      $(ul).toggleClass('zod-cmenu', mine);
      if (mine) this.options.position = placeMenu(this.element[0], $(ul)[0]);   // wider, lined up with the box's right edge
      else { this.options.position = pos; $(ul)[0].style.removeProperty('max-height'); }
      var r = menu.apply(this, arguments);
      if (mine && more > 0) $('<li class="zod-cmore"></li>').text('و' + more + ' عميل غيرهم، اكتب أكثر لتضييق البحث').appendTo(ul);
      return r;
    };
  }
  window.addEventListener('focus', function (e) {   // capture: before SMACC's own focus handler searches
    var t = e.target;
    if (t && t.nodeType === 1 && t.classList.contains('ui-autocomplete-input')) {
      t.__zodTyped = false;
      try { hookCust(t); } catch (err) { /* SMACC's own list as it is */ }
    }
  }, true);
  function typed(e) { var t = e.target; if (t && t.__zodTyped === false) t.__zodTyped = true; }
  window.addEventListener('input', typed, true);
  window.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') typed(e); }, true);
  window.addEventListener('dblclick', function (e) {   // capture: SMACC's double click opens its old list / search window
    if (custScn(e.target)) e.stopImmediatePropagation();
  }, true);
  document.addEventListener('zod:custnew', function () {   // new customers came in: search the box being typed in again
    var t = document.activeElement, $ = window.jQuery, ac = $ && t && t.__zodTyped ? $(t).data('ui-autocomplete') : null;
    if (ac && ac.__zodCust && String(t.value || '').trim()) try { ac.search(); } catch (e) { /* ignore */ }
  });

  /* ---------- 6. sales invoice: a customer with a VAT number makes it a "فاتورة ضريبية" ----------
     When the customer of a new (or edited) sales invoice becomes one with a VAT number (SMACC fills the invoice's
     VAT box from the customer), the invoice type becomes "فاتورة ضريبية". Changing to a customer without one
     makes it "فاتورة مبسطة" again, if it was the add-on that chose ضريبية. Checked while the code box is not
     being typed in. SMACC refuses a type change once the invoice has items (IsRecordExistsInGrid); between
     ضريبية and مبسطة the lines and their VAT stay the same (only export / nominal invoices change taxes), so on
     a plain invoice (not export, nominal or Global Blue) the add-on changes it anyway, with SMACC's own handler.

     6b. The items stay when the customer is changed: SMACC's change handler on the customer box empties the item
     grid (ClearNGData) whenever the customer changes, typed or picked from the list, so the items had to be
     entered again. The customer does not set item prices (the price type is per line), and SMACC's blur handler
     (SetCustomerProperties) still fills the VAT number, address, buyer ID and credit days and applies the
     customer's tax exemption to the lines. So while the invoice has items, only that change handler is skipped. */
  var TAX_PAGE = window.top === window && /\/inventory\/salesinvoicepage\.aspx$/i.test(location.pathname);
  var taxSeen = null, taxSetFor = '', keptAt = 0;
  function gridItems() { return typeof window.IsRecordExistsInGrid === 'function' && !!window.IsRecordExistsInGrid(); }
  function keepItems() {   // wrap SMACC's "customer changed: clear the items" handler (again if SMACC binds it again)
    var $ = window.jQuery, c = document.getElementById('cpBulk_cpForm_CustomerCode');
    var ev = $ && $._data && c ? $._data(c, 'events') : null;
    ((ev && ev.change) || []).forEach(function (h) {
      if (h.__zodKeep || typeof h.handler !== 'function' || String(h.handler).indexOf('ClearNGData') < 0) return;
      var orig = h.handler;
      h.handler = function () {
        if (gridItems()) { keptAt = Date.now(); taxToast('تغيّر العميل والأصناف باقية كما هي'); return; }
        return orig.apply(this, arguments);
      };
      h.__zodKeep = true;
    });
  }
  function plainInvoice() {
    return ['cpBulk_cpForm_IsExportInvoice', 'cpBulk_cpForm_IsNominalInvoice', 'cpBulk_cpForm_IsGlobalBlueInvoice'].every(function (id) {
      var b = document.getElementById(id);
      return !b || !b.checked;
    });
  }
  function setType($, t, to, items) {   // SMACC's own change handler; with items, its "has items" check says no for this call
    var irg = window.IsRecordExistsInGrid, swap = items && typeof irg === 'function';
    if (swap) window.IsRecordExistsInGrid = function () { return false; };
    try { $(t).val(to).change(); } finally { if (swap) window.IsRecordExistsInGrid = irg; }
  }
  function vatOk(v) {
    var d = String(v || '').replace(/\D/g, ''), seen = {}, n = 0;
    if (!/^3\d{13}3$/.test(d)) return false;
    for (var i = 0; i < d.length; i++) if (!seen[d[i]]) { seen[d[i]] = 1; n++; }
    return n > 2;   // 300000000000003 and the like are placeholders
  }
  function taxToast(msg, kind) {
    try { document.dispatchEvent(new CustomEvent('zod:toast', { detail: JSON.stringify({ msg: msg, kind: kind == null ? 'ok' : kind }) })); } catch (e) { /* ignore */ }
  }
  function taxCheck() {
    if (!TAX_PAGE) return;
    var $ = window.jQuery, c = document.getElementById('cpBulk_cpForm_CustomerCode'),
      v = document.getElementById('cpBulk_cpForm_VATNumber'), t = document.getElementById('cpBulk_cpForm_TaxCategoryCode');
    if (!$ || !c || !t || document.activeElement === c) return;
    var code = String(c.value || '').trim(), vat = v ? String(v.value || '').trim() : '', key = code + '|' + vat;
    if (key === taxSeen) return;
    var first = taxSeen === null, no = document.getElementById('cpBulk_cpForm_InvoiceNumber');
    taxSeen = key;
    if (!code || c.disabled || c.readOnly || t.disabled || !c.offsetParent) return;   // not editing
    if (first && no && String(no.value || '').trim()) return;   // a saved invoice, as it was opened
    var save = document.querySelectorAll('.btnSaveAddUpdate'), on = false;
    for (var i = 0; i < save.length; i++) if (save[i].offsetParent) on = true;
    if (!on) return;   // not adding or editing
    var has = vatOk(vat), to = has ? '1' : taxSetFor && t.value === '1' ? '2' : '';
    if (!has) taxSetFor = '';
    if (!to || t.value === to || !t.querySelector('option[value="' + to + '"]')) return;
    var items = gridItems();
    if (items && !plainInvoice()) {   // export / nominal invoice with items: SMACC's rule stands
      if (has) taxToast('للعميل رقم ضريبي، لكن نوع الفاتورة لا يتغير بعد إضافة الأصناف في فاتورة تصدير أو اسمية', '');
      return;
    }
    setType($, t, to, items);
    if (t.value !== to) return;
    taxSetFor = has ? code : '';
    taxToast((has ? 'نوع الفاتورة: فاتورة ضريبية (للعميل رقم ضريبي)' : 'نوع الفاتورة: فاتورة مبسطة (العميل بدون رقم ضريبي)') +
      (Date.now() - keptAt < 5000 ? ' · الأصناف باقية كما هي' : ''));
  }
  if (TAX_PAGE) setInterval(function () { try { keepItems(); taxCheck(); } catch (e) { /* ignore */ } }, 300);

  /* ---------- 7. item card: no waiting for answers SMACC does not use, or already has ----------
     Choosing a category, "اضافة جديد" and حفظ froze the item card for 1 to 4 seconds: SMACC waits for the server
     call after call (each one blocks the page).
     - GetItemsByParentCode sends every item of the category (60-100 KB, 0.6-0.9 s), and SMACC asks it three times
       for one new item: category chosen, "اضافة جديد", حفظ. It only checks whether that list is empty, and at
       "اضافة جديد" and حفظ (isSizeColorParentItem) not even that, unless the category is a size / colour parent.
       So there it is not asked; for an item (no sub items) the answer is "none" (only categories have items);
       for a category, "it has items" is remembered on this computer once SMACC has seen it (7 days).
     - A category has no units, prices, comments or extra codes, yet SMACC asks for each (0.1-1.4 s each). After
       the server has answered "none" for a category, the add-on gives that answer itself (7 days; anything saved
       or deleted on this screen forgets the item and its category).
     - The price channel list, the code setup per level and the language list never change: asked once per page.
     The stack of the waiting call says which SMACC function asked (SetSelectedTeeViewNodeInfo = an item or category
     chosen, isSizeColorParentItem = add / save, Load...OnTreeItemSelect = its details). */
  var ITEM_PG = /\/inventory\/itemcardmasterpage\.aspx$/i.test(location.pathname);
  if (ITEM_PG && window.XMLHttpRequest) (function () {
    var IKEY = 'zod|icache', ITTL = 7 * 24 * 60 * 60 * 1000, NONE = '{"d":""}';
    var DETAIL = /\/(getitemcardunitinfobycode|getpricechannelsbyitemcode|getitemcardspecialcommentsbycode|getitemcardcodesextendedbyitemcode|getitemcardshipmentinfobycode)$/;
    var STATIC = /\/(selectpricechannel|selectitemcodesetup|loadlocallanguages)$/;
    var LOOKUP = /\/(get|select|load|search|check|calculate|autocomplete|is|validate|fill|bind|show|generate|zatca)[a-z]*$/;
    var ist = window.__zodItemStats = { skip: 0, none: 0, kids: 0, same: 0, real: 0 };
    var stat = {};     // this page: "path|body" -> answer
    var card = null;   // the item / category SMACC loaded last (GetItemCardInfoByCode): { code, sub, sc }
    function load() {
      var c = null;
      try { c = JSON.parse(localStorage.getItem(IKEY) || 'null'); } catch (e) { c = null; }
      if (!c || c.v !== 1) c = { v: 1, kids: {}, empty: {} };
      return c;
    }
    function save(c) { try { localStorage.setItem(IKEY, JSON.stringify(c)); } catch (e) { /* ignore */ } }
    function fresh(t) { return typeof t === 'number' && Date.now() - t < ITTL; }
    function codeIn(body) { var m = /'(?:item|parent)?code'\s*:\s*'([^']*)'/i.exec(body || ''); return m ? m[1] : null; }
    function caller() {
      var lim = Error.stackTraceLimit;
      try { Error.stackTraceLimit = 40; return String(new Error().stack || ''); }
      catch (e) { return ''; } finally { Error.stackTraceLimit = lim; }
    }
    function jv(sel) { var $ = window.jQuery; return $ ? String($(sel).val() || '') : ''; }
    function before(path, b) {
      if (STATIC.test(path)) {
        var k = path + '|' + b;
        if (stat[k] != null) { ist.same++; return { text: stat[k] }; }
        return { keep: k };
      }
      if (/\/getitemcardinfobycode$/.test(path)) return { info: true };
      if (/\/getitemsbyparentcode$/.test(path)) {
        var code = codeIn(b), st = caller();
        if (code == null) return null;
        if (st.indexOf('isSizeColorParentItem') >= 0) {   // the answer counts only for a size / colour parent
          var $ = window.jQuery, li = $ ? $('#simpleTreeContainer .selectedItem').closest('li').first() : null;
          if (li && li.length && li.attr('node_code') && li.attr('sizecolor_support') === 'true' && li.attr('sub_support') === 'true') return null;
          ist.skip++;
          return { text: NONE };
        }
        if (st.indexOf('SetSelectedTeeViewNodeInfo') < 0 || !card || card.code !== code) return null;
        if (!card.sub && !card.sc) { ist.none++; return { text: NONE }; }   // an item: no sub items
        if (card.sub && !card.sc) {   // a category: only "empty or not" is used
          if (fresh(load().kids[code])) { ist.kids++; return { text: '{"d":"[]"}' }; }
          return { kids: code };
        }
        return null;
      }
      if (DETAIL.test(path)) {
        var c2 = codeIn(b);
        if (c2 == null || !card || card.code !== c2 || !card.sub || card.sc) return null;   // categories only
        if (caller().indexOf('OnTreeItemSelect') < 0) return null;
        var k2 = path.split('/').pop() + '|' + c2;
        if (fresh(load().empty[k2])) { ist.none++; return { text: NONE }; }
        return { empty: k2 };
      }
      if (!LOOKUP.test(path)) {   // a save, delete... : forget what was learnt about this item and its category
        var c3 = load(), item = jv('#cpBulk_cpForm_hfItemCode') || jv('#hdItemCode'), parent = jv('#cpBulk_cpForm_hfParentItemCode');
        Object.keys(c3.empty).forEach(function (x) { var y = x.split('|')[1]; if (y === item || y === parent) delete c3.empty[x]; });
        if (path.indexOf('delete') >= 0) c3.kids = {};
        save(c3);
        card = null;
        return { saved: /\/saverec$/.test(path) && jv('#hdSaveType') === 'SaveNew' ? parent : '' };
      }
      return null;
    }
    function after(plan, text) {
      ist.real++;
      if (!plan) return;
      if (plan.keep && valid(text)) stat[plan.keep] = text;
      if (plan.info) {
        card = null;
        var o = JSON.parse(text), d = o && typeof o.d === 'string' && o.d ? JSON.parse(o.d) : null;
        if (d && d.ItemCode != null) card = { code: String(d.ItemCode), sub: d.SubItemSupport === true, sc: d.SizeOrColorSupport === true };
      }
      if (plan.kids || plan.empty || plan.saved) {
        var c = load();
        if (plan.kids) { if (text !== NONE && valid(text)) c.kids[plan.kids] = Date.now(); else delete c.kids[plan.kids]; }
        if (plan.empty) { if (text === NONE) c.empty[plan.empty] = Date.now(); else delete c.empty[plan.empty]; }
        if (plan.saved && text.toLowerCase().indexOf('parentitemcode') >= 0) c.kids[plan.saved] = Date.now();   // saved in it
        Object.keys(c.kids).forEach(function (x) { if (!fresh(c.kids[x])) delete c.kids[x]; });
        Object.keys(c.empty).forEach(function (x) { if (!fresh(c.empty[x])) delete c.empty[x]; });
        save(c);
      }
    }
    var P3 = XMLHttpRequest.prototype, open3 = P3.open, send3 = P3.send;
    P3.open = function (method, url, async) {
      try {
        this.__zodIt = String(method).toUpperCase() === 'POST' ?
          { path: pathOf(url), url: new URL(String(url), location.href).href, sync: arguments.length >= 3 && async === false } : null;
      } catch (e) { this.__zodIt = null; }
      return open3.apply(this, arguments);
    };
    P3.send = function (body) {
      var z = this.__zodIt, plan = null;
      if (!z || (body != null && typeof body !== 'string') || RX.test(z.path)) return send3.apply(this, arguments);
      var b = body == null ? '' : body;
      try { plan = before(z.path, b); } catch (e) { plan = null; }
      if (plan && plan.text != null && z.sync) { answer(this, plan.text, false, z.url); return; }
      if (plan && !z.sync) {   // SMACC asks these while waiting; anything else only for its save / delete part
        if (plan.saved == null) plan = null;
        else { var x = this, pl = plan; x.addEventListener('load', function () { try { if (x.status === 200) after(pl, String(x.responseText || '')); } catch (e) { /* ignore */ } }); plan = null; }
      }
      var r = send3.apply(this, arguments);
      try { if (plan && this.readyState === 4 && this.status === 200 && typeof this.responseText === 'string') after(plan, this.responseText); }
      catch (e) { /* ignore */ }
      return r;
    };
  })();

  /* ---------- 8. answers that do not change for a while ----------
     SMACC asks the server the same read-only questions again and again, and the page is frozen for each answer
     (0.1-0.8 s): every page load asks for the page's fixed texts (twice), the language list, today's date and
     the list's dates in the company's format; every new invoice for your salesperson, branch, customer name,
     discount (twice) and today's date; every item typed in for 16 answers (the same stock three times, the same
     prices twice), and its quantity for 5 more. Measured: page start 4-5 s, new invoice 3-4 s, one item 3-3.5 s.
     The answers are kept and given again:
       - settings (fixed texts, languages, tax method, your salesperson, salesperson / branch / customer names,
         discount, price-channel order): 10 minutes to 12 hours, on this computer (all tabs);
       - item details and prices 10 minutes (ZOD sets prices once), cost 2 minutes: in this tab only;
       - stock is always asked fresh: the answer is only given again within the same 3 seconds (SMACC asks the
         same stock three times for one item code, within about a second);
       - today's date: 10 minutes, the same day only and never between 23:50 and 00:10;
       - the list's dates: the add-on writes them in the company's date format once it has seen it (checked daily).
     Anything saved or deleted in this tab forgets the item answers (and, outside invoices / returns / stock
     transfers, the settings too); the login page forgets everything; so does "تحديث ذاكرة السرعة" (Ctrl+K). */
  (function () {
    var Lst = null, Sst = null;
    try { Lst = window.localStorage; Sst = window.sessionStorage; } catch (e) { Lst = null; }
    if (!Lst || !Sst || !window.XMLHttpRequest) return;
    var AC = 'zod|ac|', FMT = 'zod|fmtdate', M = 60 * 1000, H = 60 * M;
    var DOC_PG = /\/(sales|purchase)(invoice|return|order|quotation)page\.aspx$|\/stocktransferpage\.aspx$/i.test(location.pathname);
    var ITEM_PG8 = /\/inventory\/itemcardmasterpage\.aspx$/i.test(location.pathname);
    function exact(b) { return /'isExact'\s*:\s*'True'/.test(b); }
    var RULES = {   // method (end of the address): [keep for, L = this computer / S = this tab, which bodies, special]
      selectcommonstring: [12 * H, 'L'],
      loadlocallanguages: [12 * H, 'L'],
      selectalloutwardtaxgroupids_validatecalculationmethod: [12 * H, 'L'],
      getsalesmanfromuserprofile: [12 * H, 'L'],
      selectsalesmandetails: [H, 'L'],
      autocompletesearchcodename: [30 * M, 'L', function (b) {
        return exact(b) && /'table'\s*:\s*'INV_(Salesman|Warehouse|Customers)Names'/.test(b);
      }],
      getdiscountrate: [10 * M, 'L'],
      selectprioritypricechannels: [10 * M, 'L'],
      getsmaccdate: [10 * M, 'L', null, 'day'],
      autocompletesmartcodenamesearch: [3 * 1000, 'S', exact],   // has the stock: one item entry only
      getitemsbyparentcode: [10 * M, 'S', function () { return !ITEM_PG8; }],   // item card: section 7
      selectitemcarddetailstring: [10 * M, 'S'],
      selectitemcardunitnamestring: [10 * M, 'S'],
      getitemimageinfo: [10 * M, 'S', null, 'null'],   // no picture = {"d":null}
      selectactiveaddonbyitemcode: [10 * M, 'S'],
      selectitemcardpricechannelstring: [10 * M, 'S'],
      selectitemcardunitstring: [10 * M, 'S'],
      selectinventorycost: [2 * M, 'S'],
      selectitemcardcurrentstock: [3 * 1000, 'S']   // fresh: one item entry only
    };
    var LOOKUP8 = /\/(get|select|load|search|check|calculate|autocomplete|is|validate|fill|bind|show|generate|zatca|formatting|itemcardnetstock)[a-z0-9_]*$/;
    var HARMLESS = /\/(cleardocumentimagesinfo|setservervariable|setsessioncountrycode)$/;   // change nothing that is kept
    var st8 = window.__zodAcStats = { hit: 0, real: 0, kept: 0, dates: 0, clear: 0 };
    function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function nearMidnight() { var d = new Date(), m = d.getHours() * 60 + d.getMinutes(); return m >= 23 * 60 + 50 || m < 10; }
    function clearAc(which) {   // 'L', 'S' or 'LS'
      st8.clear++;
      [['L', Lst], ['S', Sst]].forEach(function (p) {
        if (which.indexOf(p[0]) < 0) return;
        try {
          for (var i = p[1].length - 1; i >= 0; i--) {
            var k = p[1].key(i);
            if (k && k.indexOf(AC) === 0) p[1].removeItem(k);
          }
        } catch (e) { /* ignore */ }
      });
    }
    function forgetAll() { clearAc('LS'); try { Lst.removeItem(FMT); } catch (e) { /* ignore */ } }
    function get(k, s, rule) {
      try {
        var o = JSON.parse(s.getItem(k) || 'null');
        if (!o || typeof o.r !== 'string' || !(o.x > Date.now())) return null;
        if (rule[3] === 'day' && (o.day !== today() || nearMidnight())) return null;
        return o.r;
      } catch (e) { return null; }
    }
    function put(k, s, rule, text) {
      var v = JSON.stringify({ x: Date.now() + rule[0], r: text, day: rule[3] === 'day' ? today() : '' });
      try { s.setItem(k, v); st8.kept++; }
      catch (e) { clearAc(s === Lst ? 'L' : 'S'); try { s.setItem(k, v); } catch (e2) { /* full: not kept */ } }
    }
    function okAnswer(text, rule) {
      try {
        var o = JSON.parse(text);
        return !!o && Object.prototype.hasOwnProperty.call(o, 'd') && (o.d !== null || rule[3] === 'null');
      } catch (e) { return false; }
    }
    function prune() {   // answers past their time
      var now = Date.now();
      [Lst, Sst].forEach(function (s) {
        try {
          for (var i = s.length - 1; i >= 0; i--) {
            var k = s.key(i);
            if (!k || k.indexOf(AC) !== 0) continue;
            var o = null;
            try { o = JSON.parse(s.getItem(k)); } catch (e) { o = null; }
            if (!o || !(o.x > now)) s.removeItem(k);
          }
        } catch (e) { /* ignore */ }
      });
    }
    /* the list's dates: SMACC sends them as 20261120,20261119,… and gets them back in the company's format */
    var FMT_RX = /^\{ 'date' : '([0-9,]*)','isSaveFormat' : 'false'\}$/;
    var PATS = ['d/m/y', 'm/d/y', 'y/m/d', 'd-m-y', 'm-d-y', 'y-m-d', 'd.m.y', 'y.m.d'];
    function fmt(p, s) { return p.replace('d', s.slice(6, 8)).replace('m', s.slice(4, 6)).replace('y', s.slice(0, 4)); }
    function goodDay(s) {
      if (!/^\d{8}$/.test(s)) return false;
      var m = +s.slice(4, 6), d = +s.slice(6, 8);
      return m >= 1 && m <= 12 && d >= 1 && d <= 31;
    }
    function fmtAnswer(toks) {   // the formats that fit every date SMACC has sent back (last day) must all agree
      try {
        var o = JSON.parse(Lst.getItem(FMT) || 'null');
        if (!o || !o.c || !o.c.length || !(Date.now() - o.t < 24 * H)) return null;
        var outs = o.c.map(function (p) { return JSON.stringify({ d: toks.map(function (x) { return fmt(p, x); }) }); });
        return outs.every(function (x) { return x === outs[0]; }) ? outs[0] : null;   // 01/01: d/m = m/d
      } catch (e) { return null; }
    }
    function fmtLearn(toks, text) {
      try {
        var d = JSON.parse(text).d;
        if (!Array.isArray(d) || d.length !== toks.length) return;
        var c = PATS.filter(function (p) { return toks.every(function (s, i) { return fmt(p, s) === d[i]; }); });
        var old = null;
        try { old = JSON.parse(Lst.getItem(FMT) || 'null'); } catch (e) { old = null; }
        if (old && old.c && old.c.length) {
          var both = old.c.filter(function (p) { return c.indexOf(p) >= 0; });
          if (both.length) c = both;   // none in common: the format was changed, start from this answer
        }
        Lst.setItem(FMT, JSON.stringify({ t: Date.now(), c: c }));   // [] = not a plain format (Hijri…): always ask
      } catch (e) { /* ignore */ }
    }

    if (/\/login\.aspx$/i.test(location.pathname)) forgetAll();   // a new login (maybe another user)
    document.addEventListener('zod:trclear', forgetAll);
    window.addEventListener('load', function () { setTimeout(prune, 4000); });

    var P4 = XMLHttpRequest.prototype, open4 = P4.open, send4 = P4.send;
    P4.open = function (method, url, async) {
      try {
        var p = pathOf(url);
        this.__zodAc = String(method).toUpperCase() === 'POST' ? {
          path: p, name: p.split('/').pop(), url: new URL(String(url), location.href).href,
          sync: arguments.length >= 3 && async === false
        } : null;
      } catch (e) { this.__zodAc = null; }
      return open4.apply(this, arguments);
    };
    P4.send = function (body) {
      var z = this.__zodAc;
      if (!z || (body != null && typeof body !== 'string') || RX.test(z.path)) return send4.apply(this, arguments);
      var b = body == null ? '' : body, rule = RULES[z.name], k = null, s = null, toks = null;
      try {
        if (!LOOKUP8.test(z.path)) {   // a save, a delete…: what was kept may have changed
          if (!HARMLESS.test(z.path)) clearAc(DOC_PG ? 'S' : 'LS');
        } else if (z.name === 'formattingdates') {
          var m = FMT_RX.exec(b), t = m ? m[1].split(',').filter(Boolean) : [];
          if (z.sync && t.length && t.every(goodDay)) {
            var own = fmtAnswer(t);
            if (own) { st8.dates++; answer(this, own, false, z.url); return; }
            toks = t;
          }
        } else if (rule && z.sync && (!rule[2] || rule[2](b))) {
          s = rule[1] === 'L' ? Lst : Sst;
          k = AC + z.path + '|' + b;
          var hit = get(k, s, rule);
          if (hit !== null) { st8.hit++; answer(this, hit, false, z.url); return; }
        }
      } catch (e) { k = null; toks = null; }
      var r = send4.apply(this, arguments);
      try {
        if ((k || toks) && this.readyState === 4 && this.status === 200 && typeof this.responseText === 'string') {
          if (k) { st8.real++; if (okAnswer(this.responseText, rule)) put(k, s, rule, this.responseText); }
          else fmtLearn(toks, this.responseText);
        }
      } catch (e) { /* ignore */ }
      return r;
    };
  })();

  /* ---------- 9. SMACC's loading screen ----------
     A page starts behind SMACC's grey screen with its logo, shown until SMACC's start-up code has run (2-5 s, the
     page is frozen meanwhile anyway). The add-on hides it then and shows a thin moving line at the top instead,
     so the page can be seen as it draws.
     SMACC also opens and closes that screen as a Bootstrap window around every server call it waits for. The page
     is frozen during such a call, so it is never seen, but opening and closing it measures the whole (very big)
     page twice: about 10 ms each time, 32 times for a new invoice and 32 for an item code. The add-on skips that
     for those calls; when SMACC really shows the screen (the ZATCA resend wait) it is left alone. */
  (function () {
    var root = document.documentElement;
    if (root) try {
      var css = document.createElement('style');
      css.id = 'zod-boot-css';
      css.textContent = 'html.zod-boot #TheLoadingOuterContainer{display:none!important}' +
        'html.zod-boot::after{content:"";position:fixed;top:0;left:0;width:35%;height:3px;z-index:2147483647;' +
        'pointer-events:none;background:linear-gradient(90deg,rgba(31,111,178,0),#1f6fb2 50%,rgba(31,111,178,0));' +
        'will-change:transform;animation:zodboot 1.1s linear infinite}' +
        '@keyframes zodboot{from{transform:translateX(-100%)}to{transform:translateX(290%)}}';
      root.appendChild(css);
      root.classList.add('zod-boot');
    } catch (e) { /* ignore */ }
    function started() { if (root) root.classList.remove('zod-boot'); }
    window.addEventListener('load', function () { setTimeout(started, 50); });
    setTimeout(started, 30000);

    var boxStats = window.__zodBoxStats = { skip: 0 };
    function inWait() {   // asked from inside CallServerFunction (SMACC's blocking server call)?
      var lim = Error.stackTraceLimit;
      try { Error.stackTraceLimit = 60; return String(new Error().stack || '').indexOf('CallServerFunction') >= 0; }
      catch (e) { return false; } finally { Error.stackTraceLimit = lim; }
    }
    function patchBox() {
      var $ = window.jQuery;
      if (!$ || !$.fn || typeof $.fn.modal !== 'function' || $.fn.modal.__zodBox) return;
      var orig = $.fn.modal;
      var quick = function (opt) {
        if ((opt === 'show' || opt === 'hide') && this.length === 1 && this[0].id === 'TheLoadingOuterContainer') {
          var m = this.data('bs.modal');
          if (!(m && m.isShown) && inWait()) {
            if (opt === 'hide') this[0].style.display = 'none';
            else $(document).off('focusin.bs.modal');   // what Bootstrap's show + hide would have left
            boxStats.skip++;
            return this;
          }
        }
        return orig.apply(this, arguments);
      };
      Object.keys(orig).forEach(function (k) { quick[k] = orig[k]; });
      quick.Constructor = orig.Constructor;
      quick.noConflict = orig.noConflict;
      quick.__zodBox = true;
      $.fn.modal = quick;
    }
    document.addEventListener('DOMContentLoaded', patchBox, true);   // before SMACC's start-up code
    window.addEventListener('load', patchBox);
  })();

  /* ---------- 10. drafts: a new sales invoice saved ----------
     fast.js keeps a few new sales invoices open at once, each in its own tab. SMACC keeps an invoice being made in
     its own page until حفظ, which then sends the header and the items together (CollectHeader, CollectGrid) just
     before SaveRec, so the tabs do not mix. SaveRec's answer starts with "success||<number>" (or "OfflineStandard")
     when SMACC has saved it: fast.js is told (zod:invsaved), with whether it was a new invoice (not an edit) and a
     Global Blue one (SMACC shows that one's form afterwards, so its tab stays). */
  function gridSum($) {   // the invoice's items: how many, and the total of their lines
    var rows = [], n = 0, t = 0;
    try { rows = $('#BaseGrid').NG('GetNGData') || []; } catch (e) { rows = []; }
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r || !String(r.ItemCode == null ? '' : r.ItemCode).trim()) continue;   // the empty line
      n++;
      var g = parseFloat(String(r.GrandAmount == null ? '' : r.GrandAmount).replace(/,/g, ''));
      if (isFinite(g)) t += g;
    }
    return { n: n, t: Math.round(t * 100) / 100 };
  }
  if (TAX_PAGE && window.XMLHttpRequest) {
    var SAVE_RX = /\/inventory\/salesinvoicepage\.aspx\/saverec$/;
    var P5 = XMLHttpRequest.prototype, open5 = P5.open, send5 = P5.send;
    P5.open = function (method, url) {
      try { this.__zodSave = String(method).toUpperCase() === 'POST' && SAVE_RX.test(pathOf(url)); }
      catch (e) { this.__zodSave = false; }
      return open5.apply(this, arguments);
    };
    P5.send = function (body) {
      if (this.__zodSave) {
        var xhr = this, b = typeof body === 'string' ? body : '';
        var gb = document.getElementById('cpBulk_cpForm_IsGlobalBlueInvoice');
        var info = { ins: /"isInserting"\s*:\s*"true"/i.test(b), gb: !!(gb && gb.checked), no: '' };
        xhr.addEventListener('load', function () {   // also for SMACC's waiting call: before SMACC reads the answer
          try {
            if (xhr.status !== 200) return;
            var d = String(JSON.parse(xhr.responseText).d || '');
            if (d.indexOf('success') < 0 && d.split('||')[0].indexOf('OfflineStandard') < 0) return;   // not saved
            info.no = String(d.split('||')[1] || '').trim();
            document.dispatchEvent(new CustomEvent('zod:invsaved', { detail: JSON.stringify(info) }));
          } catch (e) { /* not an answer we know: nothing */ }
        });
      }
      return send5.apply(this, arguments);
    };
  }
})();
