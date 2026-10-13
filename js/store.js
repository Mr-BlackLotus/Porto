/*
 * Porto — penyimpanan data.
 * Dua mode:
 *  - lokal  : disimpan di browser (localStorage), cocok untuk mencoba.
 *  - sheet  : disimpan di Google Sheets milik Anda, lewat login Google (js/gsheets.js)
 *             atau lewat Apps Script (apps-script/Code.gs).
 * Setiap baris punya `pasar`: ID (saham Indonesia), US (saham US), CRYPTO.
 */
(function (root) {
  'use strict';

  var KEY_DATA = 'porto.data.v1';
  var KEY_CACHE = 'porto.cache.v1';
  var KEY_SETTINGS = 'porto.settings.v1';
  var KEY_MANUAL = 'porto.manual.v1';
  var KEY_PRICES = 'porto.prices.v2';

  var MARKETS = ['ID', 'US', 'CRYPTO'];

  var DEFAULTS = {
    source: '',
    google: { clientId: '', sheetId: '', email: '' },
    url: '',
    token: '',
    market: 'ALL',
    cryptoCcy: 'IDR',
    kurs: 0,
    fee: {
      ID: { beli: 0.15, jual: 0.25 },
      US: { beli: 0, jual: 0 },
      CRYPTO: { beli: 0.2, jual: 0.2 }
    }
  };

  var COLS = {
    transaksi: ['id', 'pasar', 'tanggal', 'kode', 'jenis', 'qty', 'harga', 'fee', 'catatan'],
    dividen: ['id', 'pasar', 'tanggal', 'kode', 'qty', 'dps', 'pajak', 'jumlah', 'catatan']
  };
  var NUMERIC = { qty: 1, harga: 1, fee: 1, dps: 1, pajak: 1, jumlah: 1 };
  var EMPTY = { transaksi: [], dividen: [] };

  var data = { transaksi: [], dividen: [] };
  var settings = normalizeSettings(load(KEY_SETTINGS, DEFAULTS));
  var manual = load(KEY_MANUAL, {});
  var prices = load(KEY_PRICES, { at: 0, items: {}, fx: null });

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

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

  /** Lengkapi pengaturan dan pindahkan fee versi lama (satu pasar) ke fee.ID. */
  function normalizeSettings(s) {
    var out = Object.assign(clone(DEFAULTS), s);
    out.google = Object.assign(clone(DEFAULTS.google), s.google || {});
    if (out.source !== 'google' && out.source !== 'apps') out.source = (out.url && /^https:\/\//.test(out.url)) ? 'apps' : '';
    var fee = clone(DEFAULTS.fee);
    MARKETS.forEach(function (m) {
      if (s.fee && s.fee[m]) fee[m] = Object.assign(fee[m], s.fee[m]);
    });
    if (typeof s.feeBeli === 'number' || typeof s.feeJual === 'number') {
      if (typeof s.feeBeli === 'number') fee.ID.beli = s.feeBeli;
      if (typeof s.feeJual === 'number') fee.ID.jual = s.feeJual;
    }
    out.fee = fee;
    delete out.feeBeli;
    delete out.feeJual;
    if (['ALL'].concat(MARKETS).indexOf(out.market) < 0) out.market = 'ALL';
    if (out.cryptoCcy !== 'USD') out.cryptoCcy = 'IDR';
    return out;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /** Rapikan satu baris. Data lama (kolom "lot", tanpa pasar) otomatis menjadi pasar ID. */
  function clean(kind, row) {
    var src = Object.assign({}, row);
    if ((src.qty === undefined || src.qty === '') && src.lot !== undefined) src.qty = src.lot;
    var out = {};
    COLS[kind].forEach(function (c) {
      var v = src[c];
      if (NUMERIC[c]) out[c] = (v === '' || v == null || isNaN(Number(v))) ? '' : Number(v);
      else out[c] = v == null ? '' : String(v);
    });
    out.pasar = MARKETS.indexOf(String(out.pasar).toUpperCase()) >= 0 ? String(out.pasar).toUpperCase() : 'ID';
    out.kode = String(out.kode || '').trim().toUpperCase();
    out.tanggal = String(out.tanggal || '').slice(0, 10);
    if (kind === 'transaksi') out.jenis = String(out.jenis || '').trim().toUpperCase();
    if (!out.id) out.id = uid();
    return out;
  }

  /** 'google' (login Google + Sheets API), 'apps' (Apps Script) atau 'lokal'. */
  function mode() {
    var g = settings.google;
    if (settings.source === 'google' && g.clientId && g.sheetId) return 'google';
    if (settings.source === 'apps' && settings.url && /^https:\/\//.test(settings.url)) return 'apps';
    return 'lokal';
  }
  function isSheet() { return mode() !== 'lokal'; }

  // ---- Google: auth dan klien dibuat ulang bila Client ID atau Sheet berubah ----
  var gCache = { key: '', auth: null, client: null };
  function google() {
    var g = settings.google;
    var key = g.clientId + '|' + g.sheetId;
    if (gCache.key !== key) {
      if (gCache.auth) gCache.auth.signOut();
      var auth = root.GSheets.createAuth({ clientId: g.clientId, hint: function () { return settings.google.email; } });
      gCache = { key: key, auth: auth, client: root.GSheets.createClient({ sheetId: g.sheetId, auth: auth }) };
    }
    return gCache;
  }

  /** Satu antarmuka untuk dua backend. */
  function remote() {
    if (mode() === 'google') {
      var c = google().client;
      return {
        all: function () { return c.readAll(); },
        add: function (kind, row) { return c.append(kind, row); },
        update: function (kind, row) { return c.update(kind, row); },
        remove: function (kind, id, pasar) { return c.remove(kind, id, pasar); },
        replaceAll: function (n) { return c.replaceAll(n); },
        prices: function (keys) { return c.prices(keys); }
      };
    }
    return {
      all: function () { return api('GET', { action: 'all' }); },
      add: function (kind, row) { return api('POST', { action: 'add', sheet: kind, row: row }); },
      update: function (kind, row) { return api('POST', { action: 'update', sheet: kind, row: row }); },
      remove: function (kind, id, pasar) { return api('POST', { action: 'delete', sheet: kind, id: id, pasar: pasar }); },
      replaceAll: function (n) { return api('POST', { action: 'replaceAll', transaksi: n.transaksi, dividen: n.dividen }); },
      prices: function (keys) { return api('GET', { action: 'prices', symbols: keys.join(',') }); }
    };
  }

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
  function persist() { save(isSheet() ? KEY_CACHE : KEY_DATA, data); }

  function normalizeData(d) {
    return {
      transaksi: ((d && d.transaksi) || []).map(function (r) { return clean('transaksi', r); }),
      dividen: ((d && d.dividen) || []).map(function (r) { return clean('dividen', r); })
    };
  }

  var Store = {
    get data() { return data; },
    get settings() { return settings; },
    get manual() { return manual; },
    get prices() { return prices; },
    isSheet: isSheet,
    mode: mode,
    COLS: COLS,
    MARKETS: MARKETS,

    saveSettings: function (patch) {
      settings = normalizeSettings(Object.assign({}, settings, patch));
      save(KEY_SETTINGS, settings);
    },

    /** Kurs USD ke Rupiah: kurs live dari Sheet, bila tidak ada pakai kurs cadangan dari Pengaturan. */
    fx: function () {
      return (prices.fx > 0 && prices.fx) || (settings.kurs > 0 && settings.kurs) || 0;
    },

    /** Muat data awal. Mode sheet: ambil dari Google Sheets, cadangkan ke cache lokal. */
    init: function () {
      if (!isSheet()) {
        data = normalizeData(load(KEY_DATA, EMPTY));
        return Promise.resolve({ mode: 'lokal' });
      }
      data = normalizeData(load(KEY_CACHE, EMPTY));
      // Token Google hanya bisa diminta lewat klik pengguna, jadi tampilkan cache dulu.
      if (mode() === 'google') return Promise.resolve({ mode: 'google', needLogin: true });
      return Store.reload();
    },

    reload: function () {
      return remote().all().then(function (j) {
        data = normalizeData(j);
        persist();
        return { mode: mode() };
      });
    },

    /** Google: belum login (atau token habis) sehingga perlu klik "Masuk dengan Google". */
    needLogin: function () { return mode() === 'google' && !google().auth.token(); },
    email: function () { return settings.google.email || ''; },

    /** Harus dipanggil dari klik pengguna. Mengembalikan email akun yang masuk. */
    signIn: function () {
      if (mode() !== 'google') return Promise.reject(new Error('Mode Google belum diatur.'));
      return google().auth.signIn().then(function (email) {
        if (email && email !== settings.google.email) {
          Store.saveSettings({ google: Object.assign({}, settings.google, { email: email }) });
        }
        return email;
      });
    },
    signOut: function () {
      if (gCache.auth) gCache.auth.signOut();
    },

    /** Sambungkan lewat login Google; bila gagal, pengaturan dan data lama dikembalikan. */
    googleConnect: function (clientId, sheetInput) {
      var id = root.GSheets.parseSheetId(sheetInput);
      if (!id) return Promise.reject(new Error('Tautan atau ID spreadsheet tidak dikenali.'));
      var prevSettings = clone(settings);
      var prevData = data;
      Store.saveSettings({ source: 'google', google: { clientId: clientId, sheetId: id, email: '' } });
      return Store.signIn().then(function () { return Store.reload(); }).catch(function (e) {
        Store.signOut();
        gCache = { key: '', auth: null, client: null };
        settings = prevSettings;
        save(KEY_SETTINGS, settings);
        data = prevData;
        throw e;
      });
    },

    /** Data yang dicatat dalam mode lokal (terpisah dari cache Sheet). */
    localData: function () {
      return normalizeData(load(KEY_DATA, EMPTY));
    },

    /** Sambungkan ke Sheet; bila gagal, pengaturan dan data lama dikembalikan. */
    connect: function (url, token) {
      var prevSettings = clone(settings);
      var prevData = data;
      Store.saveSettings({ source: 'apps', url: url, token: token });
      return Store.reload().catch(function (e) {
        settings = prevSettings;
        save(KEY_SETTINGS, settings);
        data = prevData;
        throw e;
      });
    },

    disconnect: function () {
      Store.signOut();
      gCache = { key: '', auth: null, client: null };
      Store.saveSettings({ source: '', url: '', token: '', google: { clientId: '', sheetId: '', email: '' } });
      data = normalizeData(load(KEY_DATA, EMPTY));
    },

    uploadLocal: function () {
      return Store.replaceAll(Store.localData());
    },

    ping: function () { return api('GET', { action: 'ping' }); },

    add: function (kind, row) {
      var r = clean(kind, row);
      var step = isSheet() ? remote().add(kind, r) : Promise.resolve();
      return step.then(function () {
        data[kind].push(r);
        persist();
        return r;
      });
    },

    update: function (kind, row) {
      var r = clean(kind, row);
      var step = isSheet() ? remote().update(kind, r) : Promise.resolve();
      return step.then(function () {
        var i = data[kind].findIndex(function (x) { return x.id === r.id; });
        if (i > -1) data[kind][i] = r; else data[kind].push(r);
        persist();
        return r;
      });
    },

    remove: function (kind, id) {
      var existing = data[kind].filter(function (x) { return x.id === id; })[0];
      var step = isSheet()
        ? remote().remove(kind, id, existing ? existing.pasar : '')
        : Promise.resolve();
      return step.then(function () {
        data[kind] = data[kind].filter(function (x) { return x.id !== id; });
        persist();
      });
    },

    /** Ganti seluruh isi (impor / unggah data lokal ke Sheet). */
    replaceAll: function (next) {
      var n = normalizeData(next);
      var step = isSheet() ? remote().replaceAll(n) : Promise.resolve();
      return step.then(function () {
        data = n;
        persist();
      });
    },

    // ---- harga (kunci "PASAR:KODE") ----
    setManual: function (key, price) {
      if (price > 0) manual[key] = price; else delete manual[key];
      save(KEY_MANUAL, manual);
    },

    fetchPrices: function (keys) {
      if (!isSheet()) return Promise.reject(new Error('Harga otomatis butuh koneksi ke Google Sheets (menu Pengaturan).'));
      return remote().prices(keys).then(function (j) {
        var items = Object.assign({}, prices.items);
        Object.keys(j.prices || {}).forEach(function (k) {
          if (j.prices[k] && j.prices[k].price > 0) items[k] = j.prices[k];
        });
        prices = { at: Date.now(), items: items, errors: j.errors || {}, fx: j.fx > 0 ? j.fx : prices.fx };
        save(KEY_PRICES, prices);
        return prices;
      });
    },

    /** Harga mentah dalam mata uang kutipan sumbernya: live lebih dulu, lalu manual. */
    priceFor: function (key) {
      var live = prices.items && prices.items[key];
      if (live && live.price > 0) return { price: live.price, prev: live.prev, source: 'live', time: live.time };
      if (manual[key] > 0) return { price: manual[key], prev: null, source: 'manual' };
      return null;
    }
  };

  root.Store = Store;
}(typeof self !== 'undefined' ? self : this));
