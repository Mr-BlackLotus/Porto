/*
 * Porto — harga crypto real-time dari WebSocket publik Binance (tanpa API key, tanpa login).
 * Memperbarui Store.prices tiap ada transaksi di bursa; bila terputus, mencoba lagi otomatis.
 */
(function (root) {
  'use strict';
  var HOSTS = ['wss://data-stream.binance.vision', 'wss://stream.binance.com:9443'];

  function create(opts) {
    var WS = opts.WebSocket || root.WebSocket;
    var onTick = opts.onTick, onState = opts.onState || function () {};
    var ws = null, keys = [], hostIdx = 0, tries = 0, timer = null, closed = false, last = '';

    function url() {
      var s = keys.map(function (k) { return k.split(':')[1].toLowerCase() + 'usdt@miniTicker'; }).join('/');
      return HOSTS[hostIdx % HOSTS.length] + '/stream?streams=' + s;
    }
    function open() {
      if (closed || !keys.length || !WS) return;
      var w;
      try { w = new WS(url()); } catch (e) { return retry(); }
      ws = w;
      w.onopen = function () { tries = 0; onState('on'); };
      w.onmessage = function (ev) {
        try {
          var d = JSON.parse(ev.data).data;
          if (!d || !d.s || !/USDT$/.test(d.s)) return;
          var p = Number(d.c), o = Number(d.o);
          if (p > 0) onTick('CRYPTO:' + d.s.slice(0, -4), { price: p, prev: o > 0 ? o : null, time: d.E ? Math.round(d.E / 1000) : null });
        } catch (e) { /* abaikan pesan rusak */ }
      };
      w.onclose = function () { if (ws === w) { ws = null; onState('off'); retry(); } };
      w.onerror = function () { try { w.close(); } catch (e) { /* sudah tertutup */ } };
    }
    function retry() {
      if (closed || timer) return;
      tries++;
      if (tries % 2 === 0) hostIdx++;
      timer = setTimeout(function () { timer = null; open(); }, Math.min(30000, 1000 * Math.pow(2, Math.min(tries, 5))));
    }
    return {
      /** Pasang daftar kunci "CRYPTO:BTC"; menyambung ulang hanya bila daftar berubah. */
      setKeys: function (list) {
        var next = list.filter(function (k) { return /^CRYPTO:[A-Z0-9]+$/.test(k); }).sort();
        var sig = next.join(',');
        if (sig === last) return;
        last = sig; keys = next;
        if (ws) { var w = ws; ws = null; try { w.close(); } catch (e) { /* abaikan */ } }
        if (timer) { clearTimeout(timer); timer = null; }
        if (!keys.length) { onState('idle'); return; }
        open();
      },
      stop: function () { closed = true; if (timer) clearTimeout(timer); if (ws) { try { ws.close(); } catch (e) { /* abaikan */ } } }
    };
  }
  var api = { create: create };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Live = api;
}(typeof self !== 'undefined' ? self : this));
