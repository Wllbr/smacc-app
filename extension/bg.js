/* ZOD - أدوات SMACC - made by younis_albaloushy
   Service worker: a second window for fast.js (opened from the label at the top left).
   - fast.js sends {zod:'w'}: the window comes up (or is made, centred over the SMACC window) and gets its sound back
   - when another window takes the focus (SMACC clicked, Alt+Tab, ...) or Alt+Q: it minimises and is muted, so it
     waits where it was; nothing in it is lost
   - the window's own X closes it
   Also the list of sales invoice drafts (tabs) for fast.js: see "drafts" below. */
'use strict';

var HOME = 'https://poki.com/ar';
var KEY = 'zod|w';      // chrome.storage.session: { win, tab, st } (the worker can sleep between events)
var shownAt = 0;        // just brought up: Windows reports a focus change or two while that happens

function load() {
  return chrome.storage.session.get(KEY).then(function (o) { return o[KEY] || null; }, function () { return null; });
}
function save(w) {
  if (!w) return chrome.storage.session.remove(KEY).catch(function () {});
  var o = {};
  o[KEY] = w;
  return chrome.storage.session.set(o).catch(function () {});
}
function winOf(w) {   // the window, or null if it was closed
  if (!w) return Promise.resolve(null);
  return chrome.windows.get(w.win).catch(function () { save(null); return null; });
}
function mute(w, on) {
  if (w && w.tab != null) chrome.tabs.update(w.tab, { muted: on }).catch(function () {});
}

async function show(fromWin) {
  shownAt = Date.now();
  var w = await load(), win = await winOf(w);
  if (win) {
    mute(w, false);
    await chrome.windows.update(w.win, win.state === 'minimized'
      ? { state: w.st || 'normal', focused: true } : { focused: true });
    shownAt = Date.now();
    return;
  }
  var o = { url: HOME, type: 'popup', focused: true };
  try {   // centred over the SMACC window, a little smaller, so a click on SMACC around it hides it
    var b = await chrome.windows.get(fromWin);
    if (b && b.state !== 'minimized' && b.width > 500 && b.height > 400) {
      o.width = Math.round(b.width * 0.86);
      o.height = Math.round(b.height * 0.88);
      o.left = b.left + Math.round((b.width - o.width) / 2);
      o.top = b.top + Math.round((b.height - o.height) / 2);
    }
  } catch (e) { /* Chrome places it */ }
  var nw = await chrome.windows.create(o);
  if (o.width && (Math.abs(nw.width - o.width) > 3 || Math.abs(nw.left - o.left) > 3)) {   // the size was not taken
    chrome.windows.update(nw.id, { left: o.left, top: o.top, width: o.width, height: o.height }).catch(function () {});
  }
  shownAt = Date.now();
  await save({ win: nw.id, tab: nw.tabs && nw.tabs[0] ? nw.tabs[0].id : null, st: 'normal' });
}

async function hide() {
  var w = await load(), win = await winOf(w);
  if (!win || win.state === 'minimized') return;
  w.st = win.state === 'maximized' || win.state === 'fullscreen' ? win.state : 'normal';   // it comes back the same
  await save(w);
  mute(w, true);
  await chrome.windows.update(w.win, { state: 'minimized' }).catch(function () {});
}

chrome.runtime.onMessage.addListener(function (m, sender) {
  if (m && m.zod === 'w' && sender.tab) show(sender.tab.windowId).catch(function () {});
});

chrome.windows.onFocusChanged.addListener(function (id) {
  load().then(function (w) {
    if (!w) return;
    if (id === w.win) { mute(w, false); return; }   // back (also from the taskbar): its sound too
    setTimeout(function () {   // between two windows Windows reports "no window" for a moment
      if (Date.now() - shownAt < 1500) return;
      winOf(w).then(function (win) { if (win && !win.focused) hide().catch(function () {}); });
    }, 250);
  });
});

chrome.windows.onRemoved.addListener(function (id) {
  load().then(function (w) { if (w && w.win === id) save(null); });
});

chrome.commands.onCommand.addListener(function (c) {
  if (c === 'hide') hide().catch(function () {});
});

/* ---------- drafts (fast.js section 8): several new sales invoices at once, each in its own tab ----------
   The sales invoice tabs tell this worker about themselves (an invoice open or not, its customer, items and total),
   so each one can show the others in its bar and go to one; "+" opens a new invoice in a tab next to it (up to 5
   open), and after a new invoice is saved its tab closes and the most recently used other new invoice comes up.
   Kept in chrome.storage.session (the worker can sleep): { <tab id>: { n, st, cust, items, tot, no, win, t, act } },
   st = 'new' (opened by "+", page still starting), 'add', 'edit' or 'view' (no invoice open); n = the draft's number,
   only while an invoice is open. The add-on has no "tabs" permission: it never sees any tab's address or title. */
var DKEY = 'zod|drafts', DMAX = 5, NEW_MS = 30000;
var dq = Promise.resolve();
function dRun(fn) {   // one change at a time
  var p = dq.then(fn);
  dq = p.catch(function () {});
  return p;
}
function dLoad() {
  return chrome.storage.session.get(DKEY).then(function (o) { return o[DKEY] || {}; }, function () { return {}; });
}
function dSave(l) {
  var o = {};
  o[DKEY] = l;
  return chrome.storage.session.set(o).catch(function () {});
}
function dOpen(e) { return !!e && (e.st === 'add' || e.st === 'edit' || e.st === 'new'); }
function dCount(l) { return Object.keys(l).filter(function (k) { return dOpen(l[k]); }).length; }
function dFree(l) {   // the lowest draft number not in use
  var used = {};
  Object.keys(l).forEach(function (k) { if (l[k].n) used[l[k].n] = 1; });
  for (var n = 1; ; n++) if (!used[n]) return n;
}
async function dClean(l) {   // tabs closed while the worker slept, and "+" tabs whose page never started
  var now = Date.now();
  await Promise.all(Object.keys(l).map(function (k) {
    if (l[k].st === 'new' && now - l[k].t > NEW_MS) { delete l[k]; return null; }
    return chrome.tabs.get(Number(k)).then(null, function () { delete l[k]; });
  }));
  return l;
}
function dTell(l, skip) {   // every sales invoice tab redraws its bar
  Object.keys(l).forEach(function (k) {
    var id = Number(k);
    if (id === skip || l[k].st === 'new') return;
    chrome.tabs.sendMessage(id, { zod: 'dl', list: l, me: id }).catch(function () {});
  });
}
function dKeep(id, e, on) {   // Chrome's memory saver must not unload a tab with an invoice open: the invoice would be lost
  if (!!e.keep === on) return;
  e.keep = on;
  chrome.tabs.update(id, { autoDiscardable: !on }).catch(function () {});
}
function dBase(sender) {   // the SMACC address the tab is on (sa5.smacc.com …)
  var o = '';
  try { o = sender.origin && sender.origin !== 'null' ? sender.origin : new URL(sender.url).origin; } catch (e) { o = ''; }
  return /^https:\/\/[a-z0-9-]+\.smacc\.com$/i.test(o) ? o : '';
}

async function dHandle(m, sender) {
  var id = sender.tab.id, now = Date.now();
  var l = await dClean(await dLoad()), e = l[id], changed = false;
  if (m.op === 'put') {   // a sales invoice tab: what it has now
    var i = m.info || {};
    if (!e) { e = l[id] = { n: 0, t: now, act: 0 }; changed = true; }
    ['st', 'cust', 'items', 'tot', 'no'].forEach(function (k) {
      var v = i[k] == null ? '' : i[k];
      if (e[k] !== v) { e[k] = v; changed = true; }
    });
    if (dOpen(e) && !e.n) { e.n = dFree(l); changed = true; }
    if (!dOpen(e) && e.n) { e.n = 0; changed = true; }
    if (e.win !== sender.tab.windowId) { e.win = sender.tab.windowId; changed = true; }
    e.t = now;
    if (i.vis) e.act = now;
    dKeep(id, e, dOpen(e));
    await dSave(l);
    if (changed) dTell(l, id);
    return { list: l, me: id };
  }
  if (m.op === 'bye') {   // the tab went to another SMACC page
    if (e) {
      dKeep(id, e, false);
      delete l[id];
      await dSave(l);
      dTell(l);
    }
    return { list: l, me: id };
  }
  if (m.op === 'new') {   // "+": a new sales invoice in a tab next to this one
    if (dCount(l) >= DMAX) return { err: 'max', list: l, me: id };
    var base = dBase(sender);
    if (!base) return { err: 'url', list: l, me: id };
    var t = await chrome.tabs.create({
      url: base + '/Inventory/SalesInvoicePage.aspx#zod-new', windowId: sender.tab.windowId,
      index: sender.tab.index + 1, openerTabId: id, active: true
    });
    l[t.id] = { n: dFree(l), st: 'new', cust: '', items: 0, tot: 0, no: '', win: t.windowId, t: now, act: now };
    await dSave(l);
    dTell(l);
    return { list: l, me: id };
  }
  if (m.op === 'go') {   // a draft's button: that tab comes up (and its window, if it is another one)
    var to = Number(m.tab);
    if (!l[to]) return { list: l, me: id };
    var tab = await chrome.tabs.update(to, { active: true }).catch(function () { return null; });
    if (tab && tab.windowId !== sender.tab.windowId) chrome.windows.update(tab.windowId, { focused: true }).catch(function () {});
    return { list: l, me: id };
  }
  if (m.op === 'done') {   // a new invoice saved here: the most recently used other new invoice comes up, this tab closes
    var best = null;
    Object.keys(l).forEach(function (k) {
      var x = l[k];
      if (Number(k) === id || (x.st !== 'add' && x.st !== 'new')) return;
      if (!best || (x.act || 0) > (l[best].act || 0)) best = k;
    });
    if (!best) return { stay: true, list: l, me: id };
    // only the tab: the print SMACC opened after the save stays in front, in its own window
    await chrome.tabs.update(Number(best), { active: true }).catch(function () {});
    delete l[id];
    await dSave(l);
    await chrome.tabs.remove(id).catch(function () {});
    dTell(l);
    return { closed: true };
  }
  return { list: l, me: id };   // 'list'
}

chrome.runtime.onMessage.addListener(function (m, sender, reply) {
  if (!m || m.zod !== 'd' || !sender.tab || sender.frameId) return;
  dRun(function () { return dHandle(m, sender); }).then(function (r) { reply(r || {}); }, function () { reply({}); });
  return true;   // the answer comes later
});

chrome.tabs.onRemoved.addListener(function (id) {
  dRun(function () {
    return dLoad().then(function (l) {
      if (!l[id]) return;
      delete l[id];
      return dSave(l).then(function () { dTell(l); });
    });
  });
});
