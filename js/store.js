/*
 * Porto — penyimpanan data.
 * Dua mode:
 *  - lokal  : disimpan di browser (localStorage), cocok untuk mencoba.
 *  - sheet  : disimpan di Google Sheets milik Anda lewat Apps Script (apps-script/Code.gs).
 */
(function (root) {
  'use strict';

  var KEY_DATA = 'porto.data.v1';
  var KEY_CACHE = 'porto.cache.v1';
  var KEY_SETTINGS = 'porto.settings.v1';
  var KEY_MANUAL = 'porto.manual.v1';
  var KEY_PRICES = 'porto.prices.v1';

  var DEFAULTS = { url: '', token: '', feeBeli: 0.15, feeJual: 0.25 };

  var COLS = {
    transaksi: ['id', 'tanggal', 'kode', 'jenis', 'lot', 'harga', 'fee', 'catatan'],
    dividen: ['id', 'tanggal', 'kode', 'lot', 'dps', 'pajak', 'jumlah', 'catatan']
  };
  var NUMERIC = { lot: 1, harga: 1, fee: 1, dps: 1, pajak: 1, jumlah: 1 };

  var data = { transaksi: [], dividen: [] };
  var settings = load(KEY_SETTINGS, DEFAULTS);
  var manual = load(KEY_MANUAL, {});
  var prices = load(KEY_PRICES, { at: 0, items: {} });

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      var v = JSON.parse(raw);
      return typeof fallback === 'object' && !Array.isArray(fallback)
        ? Object.assign(clone(fallback), v) : v;
    } catch (e) { return clone(fallback); }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* penyimpanan penuh / diblokir */ }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function clean(kind, row) {
    var out = {};
    COLS[kind].forEach(function (c) {
      var v = row[c];
      if (NUMERIC[c]) out[c] = (v === '' || v == null) ? '' : Number(v);
      else out[c] = v == null ? '' : String(v);
    });
    out.kode = String(out.kode || '').trim().toUpperCase();
    out.tanggal = String(out.tanggal || '').slice(0, 10);
    if (!out.id) out.id = uid();
    return out;
  }

  function isSheet() { return !!(settings.url && /^https:\/\//.test(settings.url)); }

  function api(method, payload) {
    var url = settings.url;
    var opts;
    if (method === 'GET') {
      var q = Object.keys(payload || {}).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]);
      }).join('&');
      url += (url.indexOf('?') > -1 ? '&' : '?') + q + '&token=' + encodeURIComponent(settings.token || '');
      opts = { method: 'GET' };
    } else {
      // text/plain menghindari preflight CORS yang tidak didukung Apps Script
      payload.token = settings.token || '';
      opts = { method: 'POST', body: JSON.stringify(payload) };
    }
    return fetch(url, opts).then(function (r) {
      if (!r.ok) throw new Error('Server membalas ' + r.status);
      return r.json();
    }).then(function (j) {
      if (j && j.error) throw new Error(j.error);
      return j;
    });
  }

  // Mode lokal menulis ke KEY_DATA; mode sheet hanya menyimpan cache di KEY_CACHE
  // sehingga data lokal tidak tertimpa saat Sheet disambungkan.
  function persistLocal() { save(isSheet() ? KEY_CACHE : KEY_DATA, data); }
  var EMPTY = { transaksi: [], dividen: [] };

  var Store = {
    get data() { return data; },
    get settings() { return settings; },
    get manual() { return manual; },
    get prices() { return prices; },
    isSheet: isSheet,
    COLS: COLS,

    saveSettings: function (patch) {
      settings = Object.assign({}, settings, patch);
      save(KEY_SETTINGS, settings);
    },

    /** Muat data awal. Mode sheet: ambil dari Google Sheets, cadangkan ke cache lokal. */
    init: function () {
      if (!isSheet()) {
        data = load(KEY_DATA, EMPTY);
        return Promise.resolve({ mode: 'lokal' });
      }
      data = load(KEY_CACHE, EMPTY);
      return Store.reload();
    },

    reload: function () {
      return api('GET', { action: 'all' }).then(function (j) {
        data = {
          transaksi: (j.transaksi || []).map(function (r) { return clean('transaksi', r); }),
          dividen: (j.dividen || []).map(function (r) { return clean('dividen', r); })
        };
        persistLocal();
        return { mode: 'sheet' };
      });
    },

    /** Data yang dicatat dalam mode lokal (terpisah dari cache Sheet). */
    localData: function () {
      var l = load(KEY_DATA, EMPTY);
      return { transaksi: l.transaksi || [], dividen: l.dividen || [] };
    },

    /** Sambungkan ke Sheet; bila gagal, pengaturan dan data lama dikembalikan. */
    connect: function (url, token) {
      var prevSettings = clone(settings);
      var prevData = data;
      Store.saveSettings({ url: url, token: token });
      return Store.reload().catch(function (e) {
        settings = prevSettings;
        save(KEY_SETTINGS, settings);
        data = prevData;
        throw e;
      });
    },

    disconnect: function () {
      Store.saveSettings({ url: '', token: '' });
      data = load(KEY_DATA, EMPTY);
    },

    uploadLocal: function () {
      return Store.replaceAll(Store.localData());
    },

    ping: function () {
      return api('GET', { action: 'ping' });
    },

    add: function (kind, row) {
      var r = clean(kind, row);
      var step = isSheet() ? api('POST', { action: 'add', sheet: kind, row: r }) : Promise.resolve();
      return step.then(function () {
        data[kind].push(r);
        persistLocal();
        return r;
      });
    },

    update: function (kind, row) {
      var r = clean(kind, row);
      var step = isSheet() ? api('POST', { action: 'update', sheet: kind, row: r }) : Promise.resolve();
      return step.then(function () {
        var i = data[kind].findIndex(function (x) { return x.id === r.id; });
        if (i > -1) data[kind][i] = r; else data[kind].push(r);
        persistLocal();
        return r;
      });
    },

    remove: function (kind, id) {
      var step = isSheet() ? api('POST', { action: 'delete', sheet: kind, id: id }) : Promise.resolve();
      return step.then(function () {
        data[kind] = data[kind].filter(function (x) { return x.id !== id; });
        persistLocal();
      });
    },

    /** Ganti seluruh isi (impor / unggah data lokal ke Sheet). */
    replaceAll: function (next) {
      var n = {
        transaksi: (next.transaksi || []).map(function (r) { return clean('transaksi', r); }),
        dividen: (next.dividen || []).map(function (r) { return clean('dividen', r); })
      };
      var step = isSheet() ? api('POST', { action: 'replaceAll', transaksi: n.transaksi, dividen: n.dividen }) : Promise.resolve();
      return step.then(function () {
        data = n;
        persistLocal();
      });
    },

    // ---- harga ----
    setManual: function (kode, price) {
      if (price > 0) manual[kode] = price; else delete manual[kode];
      save(KEY_MANUAL, manual);
    },

    fetchPrices: function (symbols) {
      if (!isSheet()) return Promise.reject(new Error('Harga otomatis butuh koneksi ke Google Sheets (menu Pengaturan).'));
      if (!symbols.length) return Promise.resolve(prices);
      return api('GET', { action: 'prices', symbols: symbols.join(',') }).then(function (j) {
        var items = Object.assign({}, prices.items);
        Object.keys(j.prices || {}).forEach(function (k) {
          if (j.prices[k] && j.prices[k].price > 0) items[k] = j.prices[k];
        });
        prices = { at: Date.now(), items: items, errors: j.errors || {} };
        save(KEY_PRICES, prices);
        return prices;
      });
    },

    /** Harga yang dipakai: live > manual > tidak ada. */
    priceFor: function (kode) {
      var live = prices.items && prices.items[kode];
      if (live && live.price > 0) return { price: live.price, prev: live.prev, source: 'live', time: live.time };
      if (manual[kode] > 0) return { price: manual[kode], prev: null, source: 'manual' };
      return null;
    }
  };

  root.Store = Store;
}(typeof self !== 'undefined' ? self : this));
