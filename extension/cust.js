/* ZOD - customers: find a customer by name, mobile, VAT number or CR number, and duplicate warnings.
   Never saves anything.
   - Customer list on this computer: code, name, phones, VAT no., CR no. and "stopped" of every customer, taken
     from SMACC's own customers list (the customers screen's list call, 1000 customers a call, only while SMACC is
     not being used), so a search needs no server call. When a page opens it asks SMACC (one small call) whether
     customers were added and fetches only the new ones; once a day the whole list is fetched again. A customer
     saved in SMACC on this computer is fetched again straight away. The first fetch is kept after every call, so
     moving to another SMACC page (or tab) carries on where it stopped; until it is done, searches say so.
   - CR numbers: most are kept in the ZATCA "other buyer ID" of the customer card (type CRN), which SMACC's list
     doesn't have. They are taken from every customer card SMACC loads (a customer chosen in an invoice, opened in
     the customers screen; main.js passes it on) and, for the customers with a VAT number, read one card at a time
     in the background, only while SMACC is not being used, until all are known (it carries on where it stopped).
   - Customer boxes (sales invoice, return, order...): typing a name, mobile, VAT or CR number shows the matching
     customers in SMACC's own list at once, with their mobile, VAT and CR numbers (main.js puts them in SMACC's
     list). Picking one works exactly as before. Ctrl+K (fast.js) finds customers the same way.
   - Adding or editing a customer (the customers screen, or "إنشاء" next to the customer box): a name, mobile,
     VAT or CR number that another customer already has shows a red warning under the box, with that customer.
   - Customers that share a mobile, VAT or CR number with another customer are marked "مكرر" in the results.
   - The search box of the invoices / returns list with "اسم العميل" chosen: the matching customers show under it;
     picking one searches SMACC's list with that customer's exact name. */
(function () {
  'use strict';
  if (window.__zodCustJs) return;
  window.__zodCustJs = true;

  var LIST = '/Inventory/CustomersPage.aspx';
  var KEY = 'zodcust1|' + location.host;
  var CHUNK = 1000, TAIL_SIZE = 200, DAY = 24 * 60 * 60 * 1000, TAIL_EVERY = 30 * 1000, MAX = 30;
  var PG = location.pathname.split('/').pop().toLowerCase();
  var NC = 'cpBulk_cpForm_NewCustomerAndAccountCreationForm1_';
  var TAB = Math.random().toString(36).slice(2);   // this page, for the locks shared by all SMACC tabs

  /* ---------- helpers ---------- */
  function $id(id) { return document.getElementById(id); }
  function vis(e) { return !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function lsGet(k) { try { return localStorage.getItem('zod|' + k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem('zod|' + k, v); } catch (e) { /* ignore */ } }
  function latinDigits(s) {
    return String(s == null ? '' : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x6F0); });
  }
  function toast(msg, kind) {
    document.dispatchEvent(new CustomEvent('zod:toast', { detail: JSON.stringify({ msg: msg, kind: kind || '' }) }));
  }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  /* SMACC's own customers list call (the customers screen). SMACC answers one request at a time per login. */
  function listCall(field, text, size, page) {
    var esc = String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return fetch(LIST + '/LoadPageListing', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: "{ 'CurrentPage' : '" + page + "', 'RecordsPerPage' : '" + size +
        "' ,'DDLSearchSelectedValue' : '" + field + "', 'SearchText' : '" + esc + "' }"
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var o = JSON.parse(j.d);
      return { rows: Array.isArray(o.pageList) ? o.pageList : [], total: Number(o.totalRecords) || 0 };
    });
  }

  /* ---------- what counts as "the same" ---------- */
  function digits(s) { return latinDigits(s).replace(/\D/g, ''); }
  function junk(d) {   // 0500000000, 555555555, 300000000000003: placeholders, not numbers
    var seen = {}, n = 0;
    for (var i = 0; i < d.length; i++) if (!seen[d[i]]) { seen[d[i]] = 1; n++; }
    return n <= 2;
  }
  /* SMACC keeps phones as "966-0501234567": the same mobile is 0501234567, 501234567 or 00966501234567 */
  function phoneKey(s) {
    var d = digits(s).replace(/^00/, '');
    if (d.indexOf('966') === 0 && d.length > 9) d = d.slice(3);
    d = d.replace(/^0+/, '');
    return d.length >= 7 && !junk(d) ? d : '';
  }
  function idKey(s) { var d = digits(s); return d.length >= 5 && !junk(d) ? d : ''; }   // VAT (15 digits), CR (10)
  function normName(s) {
    return latinDigits(s).toLowerCase()
      .replace(/[ً-ٰٟـ]/g, '')   // harakat, small alef, tatweel
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^0-9a-zء-ي٠-٩کگی]+/g, ' ')
      .trim();
  }
  function nameKey(s) { var k = normName(s).replace(/\s+/g, ''); return k.length >= 3 ? k : ''; }
  function showPhone(s) { return String(s || '').trim().replace(/^\+?966-/, ''); }

  /* ---------- the customer list ----------
     kept as one text: customers split by \x1e, fields by \x1f: code, name, phone 1, phone 2, VAT no., CR no.,
     stopped. SMACC's list has no ZATCA "other buyer ID" (most CR numbers are kept there, type CRN), so those come
     from the customer's own record (CustomersPage LoadRec) and are kept apart (BM: code -> [type, number]): from
     every record SMACC loads itself (a customer chosen in an invoice, opened in the customers screen), and, for the
     customers with a VAT number, one record at a time while SMACC is not being used, until all are known. */
  var IDX = null, BM = null, loading = null, building = false, rev = 0;
  var KEYB = 'zodcustb1|' + location.host;
  var KEYP = 'zodcustp1|' + location.host;   // a first fetch not finished yet: the next page carries on from it
  var prog = null;   // {got, total} while the list is fetched and there is none yet
  function announce(what) { document.dispatchEvent(new CustomEvent(what)); }   // fast.js (Ctrl+K) redraws
  var ID_NAME = { CRN: 'سجل', '700': 'رقم 700', NAT: 'هوية', IQA: 'إقامة', PAS: 'جواز', GCC: 'هوية خليجية', MOM: 'ترخيص', MLS: 'ترخيص', SAG: 'ترخيص', TIN: 'رقم ضريبي', OTH: 'معرف' };
  function clean(v) { return String(v == null ? '' : v).replace(/[\x1e\x1f\r\n\t]+/g, ' ').trim(); }
  function compact(r) {
    return [clean(r.CustomerCode), clean(r.CustomerName), clean(r.Phone1), clean(r.Phone2), clean(r.VATNumber),
      clean(r.CCRNumber), r.StopDealing === true || String(r.StopDealing).toLowerCase() === 'true' ? '1' : ''];
  }
  function buyerOf(rec) {   // [type, number] of the ZATCA "other buyer ID" in a customer record ('' = none)
    var t = String(rec.OtherBuyerID == null ? '' : rec.OtherBuyerID).trim().toUpperCase(), v = clean(rec.BuyerIDValue);
    if (!t || t === '0' || !v) return ['', ''];
    return [t, v];
  }
  function put(m, k, i) { if (k) { var a = m[k] || (m[k] = []); if (a.indexOf(i) < 0) a.push(i); } }
  function drop(m, k, i) { var a = k && m[k]; if (!a) return; var j = a.indexOf(i); if (j >= 0) a.splice(j, 1); if (!a.length) delete m[k]; }
  function setBuyer(r, i, maps) {   // the row's buyer ID from BM, kept in the CR map too
    var e = BM && BM[r.c];
    if (r.b) drop(maps.r, idKey(r.b), i);
    r.bt = e ? e[0] : '';
    r.b = e ? e[1] : '';
    r.rd = digits(r.r) + ' ' + digits(r.b);
    put(maps.r, idKey(r.b), i);
  }
  function hydrate(st) {
    var rows = [], byCode = {}, maps = { p: {}, v: {}, r: {}, n: {} };
    String(st.data || '').split('\x1e').forEach(function (line) {
      if (!line) return;
      var f = line.split('\x1f');
      if (!f[0]) return;
      var r = { c: f[0], n: f[1] || '', p1: f[2] || '', p2: f[3] || '', v: f[4] || '', r: f[5] || '', s: f[6] === '1', b: '', bt: '' };
      r.nn = normName(r.n);
      r.pd = digits(r.p1) + ' ' + digits(r.p2);
      r.k1 = phoneKey(r.p1);
      r.k2 = phoneKey(r.p2);
      r.vd = digits(r.v);
      r.nd = (latinDigits(r.n).match(/\d{7,}/g) || []).join(' ');   // a mobile written in the name
      if (byCode[r.c] !== undefined) rows[byCode[r.c]] = r; else { byCode[r.c] = rows.length; rows.push(r); }
    });
    rows.forEach(function (r, i) {
      put(maps.p, r.k1, i);
      put(maps.p, r.k2, i);
      put(maps.v, idKey(r.v), i);
      put(maps.r, idKey(r.r), i);
      put(maps.n, nameKey(r.n), i);
      setBuyer(r, i, maps);
    });
    IDX = { t: Number(st.t) || 0, total: Number(st.total) || rows.length, rows: rows, byCode: byCode, maps: maps, rev: ++rev };
    return IDX;
  }
  function pack(rows) { return rows.map(function (f) { return f.join('\x1f'); }).join('\x1e'); }
  function unpack(r) { return [r.c, r.n, r.p1, r.p2, r.v, r.r, r.s ? '1' : '']; }
  function store(o) {
    try { return chrome.storage.local.set(o).catch(function () { /* kept in this page only */ }); }
    catch (e) { return Promise.resolve(); }
  }
  function save(st) {
    var was = !!IDX;
    hydrate(st).__data = st.data;
    if (!was) { prog = null; announce('zod:custready'); }
    return store({ [KEY]: st });
  }
  var bTimer = 0;
  function saveB() {   // written a few seconds after the last change
    clearTimeout(bTimer);
    bTimer = setTimeout(function () { BM.__t = Date.now(); store({ [KEYB]: { v: 1, m: BM } }); }, 3000);
  }
  function setB(code, e) {   // a customer's buyer ID, from its record
    code = String(code || '').trim();
    if (!BM || !code) return;
    var old = BM[code];
    if (old && old[0] === e[0] && old[1] === e[1]) return;
    BM[code] = e;
    saveB();
    if (IDX && IDX.byCode[code] !== undefined) {
      var i = IDX.byCode[code];
      setBuyer(IDX.rows[i], i, IDX.maps);
      IDX.rev = ++rev;
    }
  }
  function load() {
    if (IDX) return Promise.resolve(IDX);
    if (loading) return loading;
    loading = new Promise(function (res) {
      try {
        chrome.storage.local.get([KEY, KEYB, KEYP]).then(function (o) {
          var st = o && o[KEY], b = o && o[KEYB], pt = o && o[KEYP];
          if (!BM) BM = b && b.v === 1 && b.m ? b.m : {};
          if (st && st.v === 2 && st.data && !IDX) { hydrate(st).__data = st.data; announce('zod:custready'); }
          if (!IDX && pt && pt.v === 1) prog = { got: pt.got || 0, total: pt.total || 0 };
          res(IDX);
        }, function () { BM = BM || {}; res(IDX); });
      } catch (e) { BM = BM || {}; res(IDX); }
    });
    return loading;
  }
  try {   // another SMACC tab fetched the list or buyer IDs: use its copy
    chrome.storage.onChanged.addListener(function (ch, area) {
      if (area !== 'local' || !(IDX || started)) return;
      var nb = ch[KEYB] && ch[KEYB].newValue;
      if (nb && nb.v === 1 && nb.m && BM && nb.m.__t !== BM.__t) {
        BM = nb.m;
        if (IDX) { IDX.rows.forEach(function (r, i) { setBuyer(r, i, IDX.maps); }); IDX.rev = ++rev; }
      }
      var nv = ch[KEY] && ch[KEY].newValue;
      if (nv && nv.v === 2 && nv.data && (!IDX || nv.data !== IDX.__data)) {
        var was = !!IDX;
        hydrate(nv).__data = nv.data;
        if (!was) { prog = null; announce('zod:custready'); }
        if (started) readBuyers();   // e.g. the tab that fetched the list was closed before the buyer IDs were done
      }
      var np = ch[KEYP] && ch[KEYP].newValue;   // another tab is fetching the list: how far it got
      if (np && np.v === 1 && !IDX) { prog = { got: np.got || 0, total: np.total || 0 }; announce('zod:custprog'); }
    });
  } catch (e) { /* ignore */ }

  /* fetch only while SMACC is not being used in any tab: every SMACC tab notes its last key / mouse press */
  var lastIn = 0, inSaved = 0;
  function noteInput(e) {
    if (e && e.isTrusted === false) return;
    lastIn = Date.now();
    if (lastIn - inSaved > 1000) { inSaved = lastIn; lsSet('cust|in', String(lastIn)); }
  }
  ['keydown', 'mousedown', 'wheel', 'touchstart'].forEach(function (t) {
    window.addEventListener(t, noteInput, { capture: true, passive: true });
  });
  function smaccBusy() { return !!document.querySelector('#TheLoadingOuterContainer.in'); }
  function quiet(ms) {
    return new Promise(function (res) {
      (function loop() {
        var last = Math.max(lastIn, Number(lsGet('cust|in')) || 0), left = last + ms - Date.now();
        if (left <= 0 && !smaccBusy()) return res();
        setTimeout(loop, Math.max(left, 250));
      })();
    });
  }
  /* one tab fetches the list at a time; it renews the lock every 3 s, so a closed or reloaded tab's lock runs out
     after 15 s and another tab carries on */
  function locked() {
    return Date.now() - (Number(lsGet('cust|lock')) || 0) < 15000 && lsGet('cust|lockby') !== TAB;
  }
  var lockWait = 0;
  function waitLock() {   // another tab is fetching: its list arrives through chrome.storage; if it stops, take over
    if (lockWait) return;
    lockWait = setInterval(function () {
      if (IDX && Date.now() - IDX.t < DAY) { clearInterval(lockWait); lockWait = 0; return; }
      if (!locked()) { clearInterval(lockWait); lockWait = 0; rebuild(); }
    }, 5000);
  }
  window.addEventListener('pagehide', function () {   // leaving the page: the next page (or tab) carries on at once
    if (building && lsGet('cust|lockby') === TAB) lsSet('cust|lock', '0');
  });
  function getPart() {
    try {
      return chrome.storage.local.get(KEYP).then(function (o) { var p = o && o[KEYP]; return p && p.v === 1 ? p : null; },
        function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function dropPart() { try { chrome.storage.local.remove(KEYP).catch(function () { /* ignore */ }); } catch (e) { /* ignore */ } }

  /* the whole list, 1000 customers a call, each call only after 1 s without use. What was fetched is kept after
     every call, so moving to another SMACC page carries on where it stopped (if under 6 hours old) */
  function rebuild() {
    if (building) return Promise.resolve();
    if (locked()) { waitLock(); return Promise.resolve(); }
    building = true;
    lsSet('cust|lock', String(Date.now()));
    lsSet('cust|lockby', TAB);
    var beat = setInterval(function () { lsSet('cust|lock', String(Date.now())); }, 3000);
    var first = !IDX, rows = [], total = 0, p = 1, t0 = Date.now();
    return getPart().then(function (part) {
      if (part && part.page > 0 && Date.now() - part.t0 < 6 * 3600 * 1000) {
        t0 = part.t0;
        total = part.total || 0;
        p = part.page + 1;
        rows = String(part.data || '').split('\x1e').filter(Boolean).map(function (l) { return l.split('\x1f'); });
      }
      if (first) { prog = { got: rows.length, total: total }; announce('zod:custprog'); }
      return (function next() {
        // a pause between calls, so SMACC's own calls (this tab or another) never wait behind more than one
        return wait(rows.length ? 300 : 0).then(function () { return quiet(rows.length ? 1000 : 1500); }).then(function () {
          lsSet('cust|lock', String(Date.now()));
          return listCall('0', '', CHUNK, p);
        }).then(function (x) {
          total = x.total;
          rows = rows.concat(x.rows.map(compact));
          var done = !x.rows.length || p >= Math.ceil(total / CHUNK);
          if (first) { prog = { got: Math.min(rows.length, total), total: total }; announce('zod:custprog'); }
          if (done) return null;
          p++;
          return store({ [KEYP]: { v: 1, t0: t0, total: total, page: p - 1, got: rows.length, data: pack(rows) } }).then(next);
        });
      })();
    }).then(function () {
      if (!rows.length) return null;
      lsSet('cust|tail', String(Date.now()));
      var st = { v: 2, t: t0, total: total, data: pack(rows) };
      return save(st).then(function () {
        dropPart();
        if (first) toast('قائمة العملاء جاهزة للبحث بالاسم والجوال والرقم الضريبي والسجل (' + IDX.rows.length + ' عميل)', 'ok');
        readBuyers();
      });
    }).catch(function () { /* logged out or no access: the next page carries on */ }).then(function () {
      clearInterval(beat);
      building = false;
      if (lsGet('cust|lockby') === TAB) lsSet('cust|lock', '0');
    });
  }
  function upsert(list, total) {
    if (!IDX || !list.length) return Promise.resolve();
    var rows = IDX.rows.map(unpack), at = {};
    rows.forEach(function (f, i) { at[f[0]] = i; });
    list.forEach(function (f) {
      if (!f[0]) return;
      if (at[f[0]] !== undefined) rows[at[f[0]]] = f; else { at[f[0]] = rows.length; rows.push(f); }
    });
    return save({ v: 2, t: IDX.t, total: total || Math.max(IDX.total, rows.length), data: pack(rows) });
  }
  /* new customers: SMACC's list is in code order and new customers get the next code, so they are at its end */
  function tail(force) {
    if (!IDX || building) return Promise.resolve();
    if (!force && Date.now() - (Number(lsGet('cust|tail')) || 0) < TAIL_EVERY) return Promise.resolve();
    lsSet('cust|tail', String(Date.now()));
    return listCall('0', '', 1, 1).then(function (r) {
      if (r.total === IDX.total) return null;
      if (r.total < IDX.total) return rebuild();   // customers were deleted
      var from = Math.floor(IDX.total / TAIL_SIZE) + 1, to = Math.ceil(r.total / TAIL_SIZE), got = [];
      if (to - from > 10) return rebuild();
      var p = from;
      return (function next() {
        if (p > to) return upsert(got, r.total).then(function () { if (got.length) announce('zod:custnew'); });   // main.js searches again
        return listCall('0', '', TAIL_SIZE, p++).then(function (x) {
          got = got.concat(x.rows.map(compact));
          return next();
        });
      })();
    }).catch(function () { /* try again later */ });
  }
  function refreshCode(code) {   // one customer again, after it was saved
    code = String(code || '').trim();
    if (!IDX || !code) return Promise.resolve();
    return listCall('CustomerCode', code, 20, 1).then(function (r) {
      var f = r.rows.map(compact).filter(function (x) { return x[0] === code; });
      return upsert(f, 0);
    }).catch(function () { /* the daily fetch catches it */ });
  }
  var started = false;
  function ensure() {
    return load().then(function () {
      if (!started) {
        started = true;
        if (!IDX || Date.now() - IDX.t > DAY) rebuild();   // reads the buyer IDs when done
        else quiet(1500).then(function () { return tail(false); }).then(readBuyers);
      }
      return IDX;
    });
  }
  function fresh() {   // before a duplicate check or a customer form: new customers from the last 20 s too
    if (!IDX || building) return;
    if (Date.now() - (Number(lsGet('cust|tail')) || 0) < 20000) return;
    quiet(600).then(function () { return tail(true); });
  }
  function idName(t) { return ID_NAME[t] || ('معرف ' + t); }
  /* a customer record (CustomersPage LoadRec): its buyer ID, and its name / phones / VAT / CR if they changed */
  function learn(rec) {
    var code = clean(rec && rec.CustomerCode);
    if (!code || !IDX) return;
    setB(code, buyerOf(rec));
    var f = compact(rec), i = IDX.byCode[code];
    if (i === undefined || unpack(IDX.rows[i]).join('\x1f') !== f.join('\x1f')) upsert([f], 0);
  }
  function loadRec(code) {
    return fetch(LIST + '/LoadRec', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: "{ 'key' : '" + String(code).replace(/[^0-9A-Za-z\-_.]/g, '') + "'}"
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) {
      var d = typeof j.d === 'string' && j.d ? JSON.parse(j.d) : j.d;
      return Array.isArray(d) ? d[0] || null : d || null;
    });
  }
  /* buyer IDs of the customers with a VAT number, one record every ~0.6 s while SMACC is not being used
     (2.5 s without key / mouse in any SMACC tab), in one tab at a time; carries on where it stopped */
  var reading = false;
  function readBuyers() {
    if (reading || !IDX || !BM) return;
    reading = true;
    (function step() {
      var lk = Number(lsGet('cust|blk')) || 0;
      if (Date.now() - lk < 20000 && lsGet('cust|bown') !== TAB) { setTimeout(step, 30000); return; }   // another tab does it
      var code = null;
      for (var i = 0; i < IDX.rows.length && !code; i++) if (IDX.rows[i].v && !BM[IDX.rows[i].c]) code = IDX.rows[i].c;
      if (!code) { reading = false; return; }   // all known
      lsSet('cust|blk', String(Date.now()));
      lsSet('cust|bown', TAB);
      wait(500).then(function () { return quiet(2500); }).then(function () {
        lsSet('cust|blk', String(Date.now()));
        return loadRec(code);
      }).then(function (rec) {
        if (rec && clean(rec.CustomerCode) === code) setB(code, buyerOf(rec));
        else setB(code, ['', '']);   // no such record: do not ask again
        step();
      }, function () { reading = false; lsSet('cust|blk', '0'); });   // logged out: stop until the next page
    })();
  }

  /* ---------- search ---------- */
  function dupsOf(i) {   // other customers with this customer's mobile / VAT / CR
    var r = IDX.rows[i], out = [];
    function look(label, m, k) {
      if (!k || !m[k]) return;
      var codes = m[k].filter(function (j) { return j !== i; }).map(function (j) { return IDX.rows[j].c; });
      if (codes.length) out.push(label + ': ' + codes.slice(0, 5).join('، ') + (codes.length > 5 ? ' …' : ''));
    }
    look('نفس الجوال', IDX.maps.p, r.k1);
    if (r.k2 !== r.k1) look('نفس الجوال', IDX.maps.p, r.k2);
    look('نفس الرقم الضريبي', IDX.maps.v, idKey(r.v));
    look('نفس السجل التجاري', IDX.maps.r, idKey(r.r));
    if (idKey(r.b) !== idKey(r.r)) look(r.bt === 'CRN' ? 'نفس السجل التجاري' : 'نفس ' + idName(r.bt), IDX.maps.r, idKey(r.b));
    return out.filter(function (x, k) { return out.indexOf(x) === k; }).join(' · ');
  }
  function item(i, hit) {
    var r = IDX.rows[i];
    return {
      c: r.c, n: r.n, p: [showPhone(r.p1), showPhone(r.p2)].filter(Boolean).join(' / '),
      v: r.v, r: r.r || (r.bt === 'CRN' ? r.b : ''), o: r.b && r.bt !== 'CRN' ? r.b : '', ol: r.b && r.bt !== 'CRN' ? idName(r.bt) : '',
      s: r.s, d: dupsOf(i), h: hit
    };
  }
  function idHit(r, dq) { return digits(r.r).indexOf(dq) >= 0 || r.bt === 'CRN' ? 'r' : 'o'; }
  /* digits: code, mobile, VAT, CR (or other buyer ID) number; anything else: the name (every word typed, any order) */
  function search(term, max) {
    if (!IDX) return null;
    var raw = latinDigits(term).trim();
    if (!raw) return { items: [], total: 0, empty: true };
    var dq = raw.replace(/[\s\-+().\/]/g, ''), found = [], rows = IDX.rows;
    function add(i, rank, hit) { found.push({ i: i, rank: rank, hit: hit }); }
    if (/^\d+$/.test(dq)) {
      var qk = dq.length >= 9 ? phoneKey(dq) : '';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r.c === dq) add(i, 0, 'c');
        else if (qk && (r.k1 === qk || r.k2 === qk)) add(i, 1, 'p');
        else if (dq.length >= 5 && r.vd === dq) add(i, 1, 'v');
        else if (dq.length >= 5 && (' ' + r.rd + ' ').indexOf(' ' + dq + ' ') >= 0) add(i, 1, idHit(r, dq));
        else if (dq.length <= 6 && r.c.indexOf(dq) >= 0) add(i, 2, 'c');
        else if (dq.length >= 4) {
          if (r.pd.indexOf(dq) >= 0 || (qk && (r.k1 + ' ' + r.k2).indexOf(qk) >= 0)) add(i, 3, 'p');
          else if (r.vd.indexOf(dq) >= 0) add(i, 4, 'v');
          else if (r.rd.indexOf(dq) >= 0) add(i, 4, idHit(r, dq));
          else if (r.nd && (r.nd.indexOf(dq) >= 0 || (qk && r.nd.indexOf(qk) >= 0))) add(i, 3, 'n');
        }
      }
    } else {
      var toks = normName(raw).split(' ').filter(Boolean);
      if (!toks.length) return { items: [], total: 0, sure: false };
      var whole = toks.join(' ');
      for (var j = 0; j < rows.length; j++) {
        var nn = rows[j].nn, ok = true;
        for (var k = 0; k < toks.length && ok; k++) ok = nn.indexOf(toks[k]) >= 0;
        if (!ok) continue;
        add(j, nn === whole ? 0 : nn.indexOf(whole) === 0 ? 1 : (' ' + nn).indexOf(' ' + toks[0]) >= 0 ? 2 : 3, 'n');
      }
    }
    found.sort(function (a, b) {
      return a.rank - b.rank || (Number(rows[a.i].c) || 0) - (Number(rows[b.i].c) || 0);
    });
    return {
      total: found.length,
      items: found.slice(0, max || MAX).map(function (f) { return item(f.i, f.hit); }),
      // 7+ digits is a mobile / VAT / CR number, not a customer code: nothing found means there is none
      sure: /^\d{7,}$/.test(dq)
    };
  }
  /* main.js (SMACC's own page) asks while the customer box is typed in, and waits for the answer */
  document.addEventListener('zod:custq', function (e) {
    var a;
    if (!IDX) { ensure(); a = { ready: false, got: prog ? prog.got : 0, total: prog ? prog.total : 0 }; }
    else {
      var s = search(String(e.detail || ''), MAX);
      a = { ready: true, empty: !!s.empty, sure: !!s.sure, total: s.total, items: s.items };
      // nothing found: maybe a customer added a moment ago on another computer (fresh() waits 20 s between asks)
      if (!s.empty && !s.total) fresh();
      else if (Date.now() - (Number(lsGet('cust|tail')) || 0) > 5 * 60 * 1000) fresh();
    }
    document.dispatchEvent(new CustomEvent('zod:custa', { detail: JSON.stringify(a) }));
  });
  /* SMACC loaded a customer record itself (main.js passes it on): learn its buyer ID */
  document.addEventListener('zod:custrec', function (e) {
    var rec = null;
    try { var j = JSON.parse(String(e.detail || '')); rec = typeof j.d === 'string' && j.d ? JSON.parse(j.d) : null; } catch (err) { rec = null; }
    if (Array.isArray(rec)) rec = rec[0];
    if (rec && typeof rec === 'object') load().then(function () { learn(rec); });
  });
  /* a customer was saved in SMACC on this computer (main.js sees the save) */
  document.addEventListener('zod:custsaved', function (e) {
    var code = String(e.detail || '').trim() || (PG === 'customerspage.aspx' ? String(($id('cpBulk_cpForm_CustomerCode') || {}).value || '').trim() : '');
    setTimeout(function () {
      ensure().then(function () { return tail(true); }).then(function () { return refreshCode(code); });
    }, 700);
  });

  /* ---------- duplicate warnings in the customer forms ---------- */
  var FORMS = [
    {   // customers screen
      box: function () { return PG === 'customerspage.aspx' ? $id('TheListForm') || $id('divForm') : null; },
      code: 'cpBulk_cpForm_CustomerCode',
      fields: [['cpBulk_cpForm_CustomerName', 'n'], ['cpBulk_cpForm_Phone1', 'p'], ['cpBulk_cpForm_Phone2', 'p'],
        ['cpBulk_cpForm_VATNumber', 'v'], ['cpBulk_cpForm_CCRNumber', 'r'], ['BuyerIDValue', 'b', 'OtherBuyerID']]
    },
    {   // "إنشاء" next to the customer box of an invoice
      box: function () { return $id('TheNewCustomerAndAccountCreationForm'); },
      code: NC + 'CustomerCode',
      fields: [[NC + 'CustomerName', 'n'], [NC + 'Phone1', 'p'], [NC + 'Phone2', 'p'], [NC + 'VATNumber', 'v'],
        [NC + 'CCRNumber', 'r'], [NC + 'BuyerIDValue', 'b', NC + 'OtherBuyerID']]
    }
  ];
  var WHAT = { n: 'يوجد عميل بنفس الاسم', p: 'رقم الجوال مسجّل للعميل', v: 'الرقم الضريبي مسجّل للعميل', r: 'السجل التجاري مسجّل للعميل', b: 'هذا المعرف مسجّل للعميل' };
  function others(type, value, own) {
    var k = type === 'n' ? nameKey(value) : type === 'p' ? phoneKey(value) : idKey(value);
    var m = type === 'n' ? IDX.maps.n : type === 'p' ? IDX.maps.p : type === 'v' ? IDX.maps.v : IDX.maps.r;
    if (!k || !m[k]) return [];
    return m[k].map(function (i) { return IDX.rows[i]; }).filter(function (r) { return r.c !== own; });
  }
  function openCustomer(code) { window.open(LIST + '#zod-open=' + encodeURIComponent(code), '_blank', 'noopener'); }
  function showWarn(f, type, hits) {
    var w = f.__zodWarn;
    f.classList.toggle('zod-dupfield', hits.length > 0);
    if (!hits.length) { if (w) { w.remove(); f.__zodWarn = null; } return; }
    if (!w || !w.isConnected) {
      w = f.__zodWarn = el('div', 'zod-dupwarn');
      w.dir = 'rtl';
      var at = f.closest('.input-group') || f;
      at.parentNode.insertBefore(w, at.nextSibling);
    }
    w.textContent = '';
    w.appendChild(document.createTextNode('⚠ ' + WHAT[type] + ' '));
    hits.slice(0, 2).forEach(function (r, i) {
      if (i) w.appendChild(document.createTextNode('، '));
      var a = el('a', 'zod-dupcode');
      a.href = '#';
      a.setAttribute('role', 'button');
      a.title = 'فتح بطاقة العميل ' + r.c + ' في تبويب جديد';
      var b = el('bdi', null, r.c);
      b.dir = 'ltr';
      a.appendChild(b);
      a.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); openCustomer(r.c); });
      w.appendChild(a);
      w.appendChild(document.createTextNode(' ' + r.n));
    });
    if (hits.length > 2) w.appendChild(document.createTextNode(' و' + (hits.length - 2) + ' غيرهم'));
  }
  var formOpen = {};
  function checkForms() {
    FORMS.forEach(function (fm, n) {
      var box = fm.box(), open = !!(box && vis(box));
      if (open && !formOpen[n]) { ensure(); fresh(); }   // a customer form just opened
      formOpen[n] = open;
      fm.fields.forEach(function (fd) {
        var f = $id(fd[0]);
        if (!f) return;
        var editable = open && IDX && vis(f) && !f.readOnly && !f.disabled, type = fd[1];
        if (editable && fd[2]) {   // ZATCA "other buyer ID": compared when a type is chosen (CRN = CR number)
          var t = $id(fd[2]), tv = t ? String(t.value || '').trim().toUpperCase() : '';
          editable = !!tv && tv !== '0';
          if (tv === 'CRN') type = 'r';
        }
        var v = editable ? String(f.value || '').trim() : '';
        var c = $id(fm.code), own = c ? String(c.value || '').trim() : '';
        var sig = v + '|' + type + '|' + own + '|' + (IDX ? IDX.rev : 0);
        if (f.__zodSig === sig) return;
        f.__zodSig = sig;
        showWarn(f, type, v ? others(type, v, own) : []);
      });
    });
  }
  var checkTimer = 0;
  document.addEventListener('input', function () {   // typing: check straight away
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkForms, 150);
  }, true);

  /* ---------- opened from a warning or Ctrl+K: #zod-open=<customer code> on the customers screen ---------- */
  function openFromHash() {
    var hm = PG === 'customerspage.aspx' && location.hash.match(/zod-open=([^&]+)/);
    if (!hm) return;
    var code = decodeURIComponent(hm[1]);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    var tries = 0;
    (function waitForList() {
      if (!document.querySelector('#PageListing tbody tr[data-recordid]') && tries++ < 60) { setTimeout(waitForList, 500); return; }
      var t = el('table');   // SMACC's own "view" (eye) action of the list, for this customer
      t.style.display = 'none';
      var tr = t.insertRow();
      tr.setAttribute('data-recordid', code);
      var a = el('a', 'ViewDetailsPageListIcon');
      tr.insertCell().appendChild(a);
      document.body.appendChild(t);
      a.click();
      setTimeout(function () { t.remove(); }, 3000);
    })();
  }

  /* ---------- the documents list's search box (sales invoices, returns...) when "اسم العميل" is chosen ----------
     SMACC finds only the exact text inside the name (the name may have two spaces: "شركة امكان  المتحدة"), and
     no mobile, VAT or CR number. Typing there shows the matching customers; picking one (click, ↑/↓ + Enter, or
     Enter / SMACC's search button when only one customer matches) puts that customer's exact name in the box and
     runs SMACC's own search. Nothing found: SMACC searches the text as typed, as before. */
  var LB = { box: null, inp: null, items: [], at: -1, picked: '' };
  var LB_DOCS = { 'salesinvoicepage.aspx': 'فواتيره', 'salesreturnpage.aspx': 'مرتجعاته' };
  function lbParts() {
    // (#btnSearch is another dialog's hidden button; the list's own search button is #BtnPageListSearch)
    var sel = $id('ddlSearchOptionSelect'), inp = $id('txtPageListingSearch'), btn = $id('BtnPageListSearch');
    if (!sel || !inp || !btn || sel.value !== 'CustomerName') return null;
    return { inp: inp, btn: btn };
  }
  function lbOpen() { return !!(LB.box && LB.box.style.display !== 'none'); }
  function lbClose() {
    if (LB.box) LB.box.style.display = 'none';
    LB.items = [];
    LB.at = -1;
  }
  function lbPlace() {
    if (!lbOpen() || !LB.inp) return;
    var r = LB.inp.getBoundingClientRect();
    if (!r.width) { lbClose(); return; }
    var w = Math.min(Math.max(r.width, 440), window.innerWidth - 16);
    LB.box.style.top = Math.round(r.bottom + 3) + 'px';
    LB.box.style.left = Math.round(Math.max(8, r.right - w)) + 'px';   // right edges in line (RTL page)
    LB.box.style.width = Math.round(w) + 'px';
  }
  function lbMark() {
    Array.prototype.forEach.call(LB.box.querySelectorAll('.zod-lrow'), function (row, i) {
      row.classList.toggle('zod-lon', i === LB.at);
      if (i === LB.at && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    });
  }
  function lbPick(x, P) {
    P = P || lbParts();
    if (!P) return;
    P.inp.value = x.n;
    LB.picked = x.n;
    lbClose();
    P.btn.click();   // SMACC's own search, with this customer's exact name
  }
  function lbOne(P) {   // the one customer that matches what is typed (when it is not that exact name already)
    var term = P.inp.value.trim();
    if (!IDX || !term || term === LB.picked) return null;
    var s = search(term, 2);
    return s && s.total === 1 && s.items[0].n !== term ? s.items[0] : null;
  }
  function lbRow(x) {   // as in the customer box: name, code, "مكرر" / "موقوف", then mobile · VAT · CR
    var row = el('div', 'zod-lrow'), top = el('div', 'zod-ctop');
    top.appendChild(el('span', 'zod-cname' + (x.h === 'n' ? ' zod-chit' : ''), x.n));
    var c = el('bdi', 'zod-ccode' + (x.h === 'c' ? ' zod-chit' : ''), x.c);
    c.dir = 'ltr';
    top.appendChild(c);
    if (x.d) { var d = el('span', 'zod-cdup', 'مكرر'); d.title = x.d; top.appendChild(d); }
    if (x.s) top.appendChild(el('span', 'zod-cstop', 'موقوف'));
    row.appendChild(top);
    var meta = el('div', 'zod-cmeta');
    [['p', 'جوال', x.p], ['v', 'ضريبي', x.v], ['r', 'سجل', x.r], ['o', x.ol, x.o]].forEach(function (f) {
      if (!f[2]) return;
      var s = el('span', x.h === f[0] ? 'zod-chit' : null, f[1] + ' ');
      var b = el('bdi', null, f[2]);
      b.dir = 'ltr';
      s.appendChild(b);
      meta.appendChild(s);
    });
    if (x.d) meta.appendChild(el('span', 'zod-cduptext', x.d));
    row.appendChild(meta);
    return row;
  }
  function lbShow() {
    var P = lbParts();
    if (!P || document.activeElement !== P.inp) { lbClose(); return; }
    var term = P.inp.value.trim();
    if (!term || term === LB.picked || (!/\d/.test(term) && term.length < 2)) { lbClose(); return; }
    if (!LB.box) {
      LB.box = el('div', 'zod-lbox');
      LB.box.dir = 'rtl';
      LB.box.addEventListener('mousedown', function (e) { e.preventDefault(); });   // the box keeps the focus
      document.body.appendChild(LB.box);
    }
    LB.inp = P.inp;
    LB.box.textContent = '';
    LB.items = [];
    LB.at = -1;
    if (!IDX) {
      ensure();
      LB.box.appendChild(el('div', 'zod-lnote', 'قائمة العملاء قيد التحميل لأول مرة' +
        (prog && prog.total ? ' (' + prog.got + ' من ' + prog.total + ')' : '') + '… حتى تجهز يبحث SMACC بالنص كما هو'));
    } else {
      var s = search(term, 8);
      LB.items = s.items;
      if (!s.items.length) {
        LB.box.appendChild(el('div', 'zod-lnote', 'لا يوجد عميل بهذا الاسم أو الجوال أو الرقم الضريبي أو السجل'));
      } else {
        var docs = LB_DOCS[PG] || 'مستنداته';
        LB.box.appendChild(el('div', 'zod-lhead', s.total === 1 ? 'اضغط Enter أو اختر العميل لعرض ' + docs :
          'اختر العميل لعرض ' + docs + ' (' + s.total + ' عميل)'));
        s.items.forEach(function (x, i) {
          var row = lbRow(x);
          row.title = 'عرض ' + docs + ' بالاسم الكامل كما هو في SMACC';
          row.addEventListener('click', function () { lbPick(x); });
          row.addEventListener('mousemove', function () { if (LB.at !== i) { LB.at = i; lbMark(); } });
          LB.box.appendChild(row);
        });
        if (s.total > s.items.length) LB.box.appendChild(el('div', 'zod-lnote', 'و ' + (s.total - s.items.length) + ' عميل غيرهم… اكتب أكثر لتضييق البحث'));
      }
    }
    LB.box.style.display = 'block';
    lbPlace();
  }
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'txtPageListingSearch') { LB.picked = ''; lbShow(); }
  }, true);
  document.addEventListener('focusin', function (e) { if (e.target && e.target.id === 'txtPageListingSearch') lbShow(); }, true);
  document.addEventListener('focusout', function (e) {
    if (e.target && e.target.id === 'txtPageListingSearch') setTimeout(function () { if (document.activeElement !== LB.inp) lbClose(); }, 150);
  }, true);
  document.addEventListener('change', function (e) { if (e.target && e.target.id === 'ddlSearchOptionSelect') lbClose(); }, true);
  document.addEventListener('zod:custready', function () { if (lbOpen()) lbShow(); });
  document.addEventListener('zod:custprog', function () { if (lbOpen() && !IDX) lbShow(); });
  window.addEventListener('scroll', lbPlace, true);
  window.addEventListener('resize', lbPlace);
  /* window, capture: before SMACC's own key handling. SMACC's Enter in this box (keypress) clicks the toolbar's
     save button instead of searching; a cancelled keydown sends no keypress, so Enter here searches instead */
  window.addEventListener('keydown', function (e) {
    var P = lbParts();
    if (!P || e.target !== P.inp || e.isComposing) return;
    var k = e.key, open = lbOpen();
    function stop() { e.preventDefault(); e.stopImmediatePropagation(); }
    if ((k === 'ArrowDown' || k === 'ArrowUp') && open && LB.items.length) {
      stop();
      LB.at = k === 'ArrowDown' ? (LB.at + 1) % LB.items.length : LB.at <= 0 ? LB.items.length - 1 : LB.at - 1;
      lbMark();
    } else if (k === 'Enter' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      stop();
      var x = open && LB.at >= 0 ? LB.items[LB.at] : lbOne(P);
      if (x) lbPick(x, P);
      else { lbClose(); P.btn.click(); }   // SMACC's list search with the text as typed
    } else if (k === 'Escape' && open) {
      stop();
      lbClose();
    }
  }, true);
  window.addEventListener('click', function (e) {   // SMACC's search button: one matching customer = its exact name
    var P = lbParts();
    if (!P || !e.isTrusted || !(e.target === P.btn || P.btn.contains(e.target))) return;
    var x = lbOne(P);
    if (x) { P.inp.value = x.n; LB.picked = x.n; }
    lbClose();
  }, true);

  /* for fast.js (Ctrl+K) */
  window.__zodCust = {
    ensure: ensure,
    fresh: fresh,   // nothing found: ask SMACC for customers added since the last look (at most every 20 s)
    ready: function () { return !!IDX; },
    search: function (term, max) { return IDX ? search(term, max) : null; },
    count: function () { return IDX ? IDX.rows.length : 0; },
    progress: function () { return IDX ? null : prog || { got: 0, total: 0 }; }   // the first fetch, while it runs
  };

  /* ---------- start ---------- */
  function start() {
    if (!($id('HeaderBar1_ddlFiscalPeriods') || document.querySelector('.btnAddNew1, #PageListing'))) return;   // not a SMACC screen
    openFromHash();
    var ls = $id('ddlSearchOptionSelect');
    var wanted = PG === 'customerspage.aspx' || $id('cpBulk_cpForm_CustomerCode') || $id('TheNewCustomerAndAccountCreationForm') ||
      (ls && ls.querySelector('option[value="CustomerName"]'));
    if (wanted) setTimeout(ensure, 1500);   // after SMACC's own start-up
    setInterval(checkForms, 700);
  }
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
