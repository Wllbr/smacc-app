/* Stands in for the chrome.* APIs the extension's content scripts use, inside the Android app.
   - chrome.storage.local: kept in IndexedDB on the phone (per SMACC address), with onChanged
     reaching every SMACC page open in the app (BroadcastChannel).
   - chrome.runtime: getManifest / sendMessage / onMessage. There is no background worker on the
     phone, so messages get no answer (the second window and the drafts tabs are desktop-only). */
function () {
  var listeners = [];
  var bc = null;
  try { bc = new BroadcastChannel('zod-storage'); } catch (e) { bc = null; }
  if (bc) bc.onmessage = function (ev) { fire(ev.data); };

  function fire(changes) {
    listeners.slice().forEach(function (fn) {
      try { fn(changes, 'local'); } catch (e) { console.error('[zod] onChanged', e); }
    });
  }
  function announce(changes) {
    if (!Object.keys(changes).length) return;
    setTimeout(function () { fire(changes); }, 0);
    if (bc) { try { bc.postMessage(changes); } catch (e) { /* ignore */ } }
  }

  var dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise(function (res, rej) {
        var r = indexedDB.open('zod-ext', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      });
    }
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', mode);
        var out = fn(t.objectStore('kv'));
        t.oncomplete = function () { res(out); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  function keyList(k) {
    if (k == null) return null;
    if (typeof k === 'string') return [k];
    if (Array.isArray(k)) return k;
    return Object.keys(k);
  }
  function plain(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function withCb(p, cb) {
    if (typeof cb === 'function') p.then(function (v) { cb(v); }, function () { cb(undefined); });
    return p;
  }

  var local = {
    get: function (k, cb) {
      var keys = keyList(k);
      var defs = k && typeof k === 'object' && !Array.isArray(k) ? k : {};
      return withCb(tx('readonly', function (s) {
        var out = {};
        if (keys === null) {
          var c = s.openCursor();
          c.onsuccess = function () { var cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        } else {
          keys.forEach(function (key) {
            var r = s.get(key);
            r.onsuccess = function () {
              if (r.result !== undefined) out[key] = r.result;
              else if (defs[key] !== undefined) out[key] = defs[key];
            };
          });
        }
        return out;
      }), cb);
    },
    set: function (items, cb) {
      var changes = {};
      return withCb(tx('readwrite', function (s) {
        Object.keys(items || {}).forEach(function (key) {
          var nv = plain(items[key]);
          var r = s.get(key);
          r.onsuccess = function () {
            changes[key] = { oldValue: r.result, newValue: nv };
            s.put(nv, key);
          };
        });
      }).then(function () { announce(changes); }), cb);
    },
    remove: function (k, cb) {
      var changes = {};
      return withCb(tx('readwrite', function (s) {
        (keyList(k) || []).forEach(function (key) {
          var r = s.get(key);
          r.onsuccess = function () {
            if (r.result !== undefined) changes[key] = { oldValue: r.result };
            s.delete(key);
          };
        });
      }).then(function () { announce(changes); }), cb);
    },
    clear: function (cb) {
      return withCb(tx('readwrite', function (s) { s.clear(); }), cb);
    }
  };

  var mem = {};   // chrome.storage.session: this page only
  var session = {
    get: function (k, cb) {
      var out = {};
      (keyList(k) || Object.keys(mem)).forEach(function (key) { if (key in mem) out[key] = plain(mem[key]); });
      return withCb(Promise.resolve(out), cb);
    },
    set: function (o, cb) { Object.keys(o || {}).forEach(function (key) { mem[key] = plain(o[key]); }); return withCb(Promise.resolve(), cb); },
    remove: function (k, cb) { (keyList(k) || []).forEach(function (key) { delete mem[key]; }); return withCb(Promise.resolve(), cb); }
  };

  var noop = { addListener: function () {}, removeListener: function () {}, hasListener: function () { return false; } };
  return {
    storage: {
      local: local,
      session: session,
      onChanged: {
        addListener: function (fn) { listeners.push(fn); },
        removeListener: function (fn) { listeners = listeners.filter(function (x) { return x !== fn; }); },
        hasListener: function (fn) { return listeners.indexOf(fn) >= 0; }
      }
    },
    runtime: {
      id: 'zod-android',
      lastError: undefined,
      getManifest: function () { return __MANIFEST__; },
      getURL: function (p) { return p; },
      sendMessage: function (m, cb) {
        if (typeof cb === 'function') setTimeout(function () { cb(undefined); }, 0);
        return Promise.resolve(undefined);
      },
      onMessage: noop
    }
  };
}
