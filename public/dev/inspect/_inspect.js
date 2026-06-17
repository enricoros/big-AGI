/* Shared helpers for the /dev/inspect/* standalone dev tools.
   Loaded at the END of <body> (DOM ready). Exposes window.Inspect + injects a toast element.
   Light theme only, zero dependencies. */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function utf16Bytes(s) { return (typeof s === 'string' ? s.length : 0) * 2; }
  function kb(b) { return (b || 0) / 1024; }
  function fmtKB(b) {
    var v = kb(b), n;
    if (v < 10) n = v.toFixed(2);
    else if (v < 1000) n = v.toFixed(1);
    else n = Math.round(v).toLocaleString('en-US');
    return n + ' KB';
  }
  function fmtMB(b) { return ((b || 0) / 1048576).toFixed(2) + ' MB'; }
  function pct(part, total) { return total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0; }

  function reqP(req) { return new Promise(function (res, rej) { req.onsuccess = function () { res(req.result); }; req.onerror = function () { rej(req.error); }; }); }
  function openDB(name) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(name);
      r.onupgradeneeded = function () { /* enumerated DB exists; do nothing */ };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      r.onblocked = function () { rej(new Error('open blocked')); };
    });
  }
  function deleteDB(name) {
    return new Promise(function (res, rej) {
      var r = indexedDB.deleteDatabase(name);
      r.onsuccess = function () { res('ok'); };
      r.onerror = function () { rej(r.error || new Error('delete failed')); };
      r.onblocked = function () { res('blocked'); };
    });
  }
  // Recursive byte estimate; handles Blob / ArrayBuffer / typed arrays
  function roughSizeOf(v, depth) {
    depth = depth || 0;
    if (v == null) return 0;
    if (typeof Blob !== 'undefined' && v instanceof Blob) return v.size;
    if (v instanceof ArrayBuffer) return v.byteLength;
    if (ArrayBuffer.isView(v)) return v.byteLength;
    var t = typeof v;
    if (t === 'string') return v.length * 2;
    if (t === 'number') return 8;
    if (t === 'boolean') return 4;
    if (depth > 8) return 0;
    if (Array.isArray(v)) { var s = 0; for (var i = 0; i < v.length; i++) s += roughSizeOf(v[i], depth + 1); return s; }
    if (t === 'object') { var sum = 0; for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) sum += k.length * 2 + roughSizeOf(v[k], depth + 1); return sum; }
    return 0;
  }

  function ensureToast() {
    var t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    return t;
  }
  function toast(msg) {
    var t = ensureToast();
    t.textContent = msg; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 1600);
  }
  function copyText(text, okMsg) {
    return Promise.resolve().then(function () { return navigator.clipboard.writeText(text); })
      .then(function () { toast(okMsg || 'Copied'); })
      .catch(function () {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        toast(ok ? (okMsg || 'Copied') : 'Copy failed - select & copy manually');
      });
  }

  // Hard confirmation for destructive actions: the user must type `phrase` exactly.
  function confirmHard(message, phrase) {
    var ans = window.prompt(message);
    return ans !== null && ans.trim() === phrase;
  }

  window.Inspect = {
    esc: esc, utf16Bytes: utf16Bytes, fmtKB: fmtKB, fmtMB: fmtMB, pct: pct,
    reqP: reqP, openDB: openDB, deleteDB: deleteDB, roughSizeOf: roughSizeOf,
    toast: toast, copyText: copyText, confirmHard: confirmHard,
  };

  ensureToast();
})();
