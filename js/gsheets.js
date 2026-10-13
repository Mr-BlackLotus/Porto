/*
 * Porto — login Google dan akses Google Sheets langsung dari browser (tanpa Apps Script, tanpa token buatan sendiri).
 *
 *  - Login: Google Identity Services (token model). Akses ditentukan oleh pembagian spreadsheet di Drive:
 *    hanya akun yang punya akses Editor ke spreadsheet yang bisa membaca dan menulis.
 *  - Data: Sheets API v4, tab yang sama dengan apps-script/Code.gs sehingga keduanya bisa dipakai bersamaan.
 *  - Harga: crypto dari Binance (data publik), saham Indonesia/US dan kurs dari rumus GOOGLEFINANCE
 *    yang ditulis ke tab "Harga" lalu dibaca kembali.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GSheets = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var API = 'https://sheets.googleapis.com/v4/spreadsheets/';
  var USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';
  var BINANCE = 'https://data-api.binance.vision/api/v3/ticker/24hr';
  var SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
  var DRIVE = 'https://www.googleapis.com/drive/v3/files';
  var SHEET_TITLE = 'Porto';
  var MARKETS = ['ID', 'US', 'CRYPTO'];
  var KINDS = ['transaksi', 'dividen'];
  var PRICE_TAB = 'Harga';
  var EXTRA = ['high52', 'low52', 'pe', 'eps'];

  var TAB = {
    ID: { transaksi: 'ID Transaksi', dividen: 'ID Dividen' },
    US: { transaksi: 'US Transaksi', dividen: 'US Dividen' },
    CRYPTO: { transaksi: 'Crypto Transaksi', dividen: 'Crypto Reward' }
  };
  var COLS = {
    transaksi: ['id', 'tanggal', 'kode', 'jenis', 'qty', 'harga', 'fee', 'catatan'],
    dividen: ['id', 'tanggal', 'kode', 'qty', 'dps', 'pajak', 'jumlah', 'catatan']
  };
  var HDR = {
    ID: { qty: 'Lot', harga: 'Harga per Lembar (Rp)', fee: 'Fee (Rp)', div: 'Total Diterima (Rp)' },
    US: { qty: 'Jumlah (lembar)', harga: 'Harga per Lembar (USD)', fee: 'Fee (USD)', div: 'Total Diterima (USD)' },
    CRYPTO: { qty: 'Jumlah (koin)', harga: 'Harga per Koin', fee: 'Fee', div: 'Total Diterima' }
  };

  function headers(pasar, kind) {
    var h = HDR[pasar];
    if (kind === 'transaksi') return ['ID', 'Tanggal', 'Kode', 'Jenis (BELI/JUAL)', h.qty, h.harga, h.fee, 'Catatan'];
    return ['ID', 'Tanggal', 'Kode', h.qty + ' (opsional)', 'Per Lembar/Koin (opsional)', 'Pajak (%)', h.div, 'Catatan'];
  }

  // ---------------------------------------------------------------- util
  function parseSheetId(input) {
    var s = String(input || '').trim();
    var m = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
  }

  function a1(tab, ref) { return "'" + String(tab).replace(/'/g, "''") + "'!" + ref; }
  function enc(s) { return encodeURIComponent(s); }
  function newId() { return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /** Sel tanggal yang diketik manual di Sheet kembali sebagai nomor seri; ubah ke YYYY-MM-DD. */
  function dateText(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
    }
    return v === undefined || v === null ? '' : String(v);
  }

  function humanError(status, body) {
    var raw = '';
    try { raw = JSON.stringify(body || {}); } catch (e) { raw = ''; }
    var msg = body && body.error && body.error.message ? String(body.error.message) : '';
    if (/has not been used|SERVICE_DISABLED|accessNotConfigured|is disabled/i.test(raw)) {
      return 'Google Sheets API dan Google Drive API belum diaktifkan di project Google Cloud Anda. Aktifkan keduanya lalu coba lagi.';
    }
    if (status === 403) return 'Akun ini tidak punya akses ke spreadsheet. Bagikan spreadsheet ke email yang dipakai login sebagai Editor.';
    if (status === 404) return 'Spreadsheet tidak ditemukan. Periksa URL atau ID spreadsheet.';
    if (status === 429) return 'Terlalu banyak permintaan ke Google. Coba lagi sebentar lagi.';
    if (status === 400 && msg) return 'Google menolak permintaan: ' + msg;
    return msg || ('Google membalas ' + status);
  }

  // ---------------------------------------------------------------- login
  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (typeof window === 'undefined') return reject(new Error('Login Google hanya tersedia di browser.'));
      if (window.google && window.google.accounts && window.google.accounts.oauth2) return resolve(window.google.accounts.oauth2);
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) resolve(window.google.accounts.oauth2);
        else reject(new Error('Layanan login Google gagal dimuat.'));
      };
      s.onerror = function () { reject(new Error('Tidak bisa memuat layanan login Google. Periksa koneksi internet atau pemblokir iklan.')); };
      document.head.appendChild(s);
    });
  }

  /**
   * opts: { clientId, loadGis, hint: () => email, now, fetch }
   * requestAccessToken harus dipicu klik pengguna; ensure() dipanggil dari penangan klik atau submit.
   */
  function createAuth(opts) {
    var now = opts.now || function () { return Date.now(); };
    var doFetch = opts.fetch || function (u, o) { return fetch(u, o); };
    var st = { token: null, exp: 0, client: null, email: '' };
    var inflight = null;
    var KEY = 'porto.auth.v1';
    var store = opts.storage !== undefined ? opts.storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    function persist() {
      if (!store) return;
      try {
        if (st.token) store.setItem(KEY, JSON.stringify({ t: st.token, e: st.exp, c: opts.clientId }));
        else store.removeItem(KEY);
      } catch (e) { /* penyimpanan diblokir */ }
    }
    // Token yang masih berlaku dipulihkan agar muat ulang halaman tidak memaksa login ulang.
    (function restore() {
      if (!store) return;
      try {
        var v = JSON.parse(store.getItem(KEY) || 'null');
        if (v && v.t && v.c === opts.clientId && v.e > now() + 30000) { st.token = v.t; st.exp = v.e; }
        else if (v) store.removeItem(KEY);
      } catch (e) { /* abaikan */ }
    }());

    function client() {
      return (opts.loadGis || loadGis)().then(function (oauth2) {
        if (!st.client) {
          st.client = oauth2.initTokenClient({
            client_id: opts.clientId,
            scope: SCOPE,
            callback: function () {},
            error_callback: function () {}
          });
          st.oauth2 = oauth2;
        }
        return st.client;
      });
    }

    function signIn() {
      if (inflight) return inflight;
      inflight = signInOnce().then(function (t) { inflight = null; return t; }, function (e) { inflight = null; throw e; });
      return inflight;
    }

    function signInOnce() {
      return client().then(function (c) {
        return new Promise(function (resolve, reject) {
          c.callback = function (resp) {
            if (!resp || resp.error) {
              var e = resp && resp.error;
              reject(new Error(e === 'access_denied' ? 'Akses ditolak. Pastikan email ini terdaftar sebagai Test user di Google Cloud.' : 'Login Google gagal' + (e ? ' (' + e + ')' : '') + '.'));
              return;
            }
            st.token = resp.access_token;
            st.exp = now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
            persist();
            resolve(st.token);
          };
          c.error_callback = function (err) {
            var t = err && err.type;
            reject(new Error(t === 'popup_closed' ? 'Jendela login Google ditutup sebelum selesai.'
              : t === 'popup_failed_to_open' ? 'Browser memblokir jendela login Google. Izinkan pop-up untuk situs ini lalu coba lagi.'
              : 'Login Google gagal.'));
          };
          var hint = opts.hint && opts.hint();
          c.requestAccessToken(hint ? { hint: hint } : {});
        });
      });
    }

    function fetchEmail() {
      return doFetch(USERINFO, { headers: { Authorization: 'Bearer ' + st.token } })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (j) { st.email = (j && j.email) || ''; return st.email; })
        .catch(function () { return ''; });
    }

    return {
      token: function () { return st.token && now() < st.exp ? st.token : null; },
      /** Sisa waktu token dalam milidetik (0 bila tidak ada). */
      remaining: function () { return st.token ? Math.max(0, st.exp - now()) : 0; },
      email: function () { return st.email; },
      ensure: function () {
        if (st.token && now() < st.exp) return Promise.resolve(st.token);
        return signIn();
      },
      signIn: function () { return signIn().then(function () { return fetchEmail(); }); },
      invalidate: function () { st.token = null; st.exp = 0; persist(); },
      signOut: function () {
        var t = st.token;
        st.token = null; st.exp = 0; st.email = ''; persist();
        if (t && st.oauth2 && st.oauth2.revoke) { try { st.oauth2.revoke(t, function () {}); } catch (e) { /* abaikan */ } }
      }
    };
  }

  // ---------------------------------------------------------------- cari / buat spreadsheet
  /**
   * Dengan izin drive.file aplikasi hanya melihat file yang dibuatnya sendiri, jadi cukup cari
   * spreadsheet "Porto" milik akun yang login; bila belum ada, buat baru lengkap dengan tab-nya.
   * opts: { auth, fetch, preferred } preferred = ID tersimpan sebelumnya (dicoba lebih dulu).
   */
  function locateSheet(opts) {
    var auth = opts.auth;
    var doFetch = opts.fetch || function (u, o) { return fetch(u, o); };
    function call(method, url, body) {
      return auth.ensure().then(function (token) {
        var o = { method: method, headers: { Authorization: 'Bearer ' + token } };
        if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
        return doFetch(url, o);
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(humanError(r.status, j));
          return j;
        });
      });
    }
    var q = "name = '" + SHEET_TITLE + "' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
    return call('GET', DRIVE + '?q=' + enc(q) + '&orderBy=createdTime&pageSize=10&fields=' + enc('files(id,name)')).then(function (j) {
      var files = (j && j.files) || [];
      if (files.length) {
        var pref = files.filter(function (f) { return f.id === opts.preferred; })[0];
        return (pref || files[0]).id;
      }
      var sheets = [];
      MARKETS.forEach(function (p) { KINDS.forEach(function (k) { sheets.push({ properties: { title: TAB[p][k] } }); }); });
      sheets.push({ properties: { title: PRICE_TAB } });
      return call('POST', 'https://sheets.googleapis.com/v4/spreadsheets', { properties: { title: SHEET_TITLE }, sheets: sheets })
        .then(function (c) {
          var data = [];
          MARKETS.forEach(function (p) { KINDS.forEach(function (k) { data.push({ range: a1(TAB[p][k], 'A1:H1'), values: [headers(p, k)] }); }); });
          return call('POST', 'https://sheets.googleapis.com/v4/spreadsheets/' + c.spreadsheetId + '/values:batchUpdate', { valueInputOption: 'RAW', data: data })
            .then(function () { return c.spreadsheetId; });
        });
    });
  }

  // ---------------------------------------------------------------- klien Sheets
  /** opts: { sheetId, auth, fetch, sleep } */
  function createClient(opts) {
    var sheetId = opts.sheetId;
    var auth = opts.auth;
    var doFetch = opts.fetch || function (u, o) { return fetch(u, o); };
    var sleep = opts.sleep || function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    var metaCache = null;
    var base = API + sheetId;

    function req(method, url, body, retried) {
      return auth.ensure().then(function (token) {
        var o = { method: method, headers: { Authorization: 'Bearer ' + token } };
        if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
        return doFetch(url, o);
      }).then(function (r) {
        if (r.status === 401 && !retried) { auth.invalidate(); return req(method, url, body, true); }
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(humanError(r.status, j));
          return j;
        });
      });
    }

    function meta(force) {
      if (metaCache && !force) return Promise.resolve(metaCache);
      return req('GET', base + '?fields=' + enc('sheets.properties(sheetId,title)')).then(function (j) {
        var m = {};
        ((j && j.sheets) || []).forEach(function (s) { m[s.properties.title] = s.properties.sheetId; });
        metaCache = m;
        return m;
      });
    }

    function valuesUpdate(data) {
      if (!data.length) return Promise.resolve();
      return req('POST', base + '/values:batchUpdate', { valueInputOption: 'RAW', data: data });
    }

    /** Buat tab yang belum ada (enam tab data + tab Harga) beserta judul kolomnya. */
    function ensureTabs() {
      return meta(true).then(function (m) {
        var needed = [];
        MARKETS.forEach(function (p) {
          KINDS.forEach(function (k) {
            if (!(TAB[p][k] in m)) needed.push({ tab: TAB[p][k], pasar: p, kind: k });
          });
        });
        if (!(PRICE_TAB in m)) needed.push({ tab: PRICE_TAB });
        if (!needed.length) return m;
        var requests = needed.map(function (n) { return { addSheet: { properties: { title: n.tab } } }; });
        return req('POST', base + ':batchUpdate', { requests: requests }).then(function () {
          var hdr = needed.filter(function (n) { return n.pasar; }).map(function (n) {
            return { range: a1(n.tab, 'A1:H1'), values: [headers(n.pasar, n.kind)] };
          });
          return valuesUpdate(hdr);
        }).then(function () { return meta(true); });
      });
    }

    function rowToObj(kind, pasar, arr) {
      var o = { pasar: pasar };
      COLS[kind].forEach(function (c, i) {
        var v = arr[i];
        o[c] = c === 'tanggal' ? dateText(v) : (v === undefined || v === null ? '' : v);
      });
      return o;
    }
    function objToRow(kind, o) {
      return COLS[kind].map(function (c) { var v = o[c]; return v === undefined || v === null ? '' : v; });
    }

    function readAll() {
      return ensureTabs().then(function () {
        var plan = [];
        MARKETS.forEach(function (p) { KINDS.forEach(function (k) { plan.push({ p: p, k: k, tab: TAB[p][k] }); }); });
        var q = plan.map(function (x) { return 'ranges=' + enc(a1(x.tab, 'A2:H')); }).join('&');
        return req('GET', base + '/values:batchGet?' + q + '&valueRenderOption=UNFORMATTED_VALUE').then(function (j) {
          var out = { transaksi: [], dividen: [] };
          var fix = [];
          (j.valueRanges || []).forEach(function (vr, idx) {
            var x = plan[idx];
            (vr.values || []).forEach(function (arr, i) {
              if (!arr || String(arr[2] === undefined ? '' : arr[2]).trim() === '') return;
              var o = rowToObj(x.k, x.p, arr);
              if (String(o.id).trim() === '') {
                o.id = newId();
                fix.push({ range: a1(x.tab, 'A' + (i + 2)), values: [[o.id]] });
              }
              out[x.k].push(o);
            });
          });
          // beri ID pada baris yang diketik manual agar bisa diubah dan dihapus dari aplikasi
          return valuesUpdate(fix).then(function () { return out; });
        });
      });
    }

    function append(kind, row) {
      var tab = TAB[row.pasar][kind];
      var url = base + '/values/' + enc(a1(tab, 'A:H')) + ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS';
      return req('POST', url, { values: [objToRow(kind, row)] });
    }

    function findRow(tab, id) {
      return req('GET', base + '/values/' + enc(a1(tab, 'A:A')) + '?valueRenderOption=UNFORMATTED_VALUE').then(function (j) {
        var v = (j && j.values) || [];
        for (var i = 1; i < v.length; i++) if (v[i] && String(v[i][0]) === String(id)) return i + 1;
        return -1;
      });
    }

    function deleteRow(tab, rowNum) {
      return meta().then(function (m) {
        return req('POST', base + ':batchUpdate', { requests: [{ deleteDimension: { range: { sheetId: m[tab], dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum } } }] });
      });
    }

    function remove(kind, id, pasar) {
      var targets = pasar && TAB[pasar] ? [pasar] : MARKETS;
      return targets.reduce(function (chain, p) {
        return chain.then(function () {
          return findRow(TAB[p][kind], id).then(function (r) { return r > 0 ? deleteRow(TAB[p][kind], r) : null; });
        });
      }, Promise.resolve());
    }

    function update(kind, row) {
      var others = MARKETS.filter(function (p) { return p !== row.pasar; });
      // jika pasar diganti, hapus baris dari tab pasar lama
      return others.reduce(function (chain, p) {
        return chain.then(function () {
          return findRow(TAB[p][kind], row.id).then(function (r) { return r > 0 ? deleteRow(TAB[p][kind], r) : null; });
        });
      }, Promise.resolve()).then(function () {
        var tab = TAB[row.pasar][kind];
        return findRow(tab, row.id).then(function (r) {
          if (r < 0) return append(kind, row);
          return req('PUT', base + '/values/' + enc(a1(tab, 'A' + r + ':H' + r)) + '?valueInputOption=RAW', { values: [objToRow(kind, row)] });
        });
      });
    }

    function replaceAll(next) {
      return ensureTabs().then(function () {
        var ranges = [];
        MARKETS.forEach(function (p) { KINDS.forEach(function (k) { ranges.push(a1(TAB[p][k], 'A2:H')); }); });
        return req('POST', base + '/values:batchClear', { ranges: ranges });
      }).then(function () {
        var data = [];
        MARKETS.forEach(function (p) {
          KINDS.forEach(function (k) {
            var rows = (next[k] || []).filter(function (r) { return r.pasar === p; });
            if (rows.length) data.push({ range: a1(TAB[p][k], 'A2'), values: rows.map(function (r) { return objToRow(k, r); }) });
          });
        });
        return valuesUpdate(data);
      });
    }

    // ---------------------------------------------------------------- harga
    function binance(keys) {
      if (!keys.length) return Promise.resolve({ prices: {}, missing: [] });
      var syms = keys.map(function (k) { return k.split(':')[1] + 'USDT'; });
      var one = function (s) {
        return doFetch(BINANCE + '?type=MINI&symbol=' + enc(s)).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
      };
      return doFetch(BINANCE + '?type=MINI&symbols=' + enc(JSON.stringify(syms))).then(function (r) {
        if (r.ok) return r.json();
        if (r.status === 400) {
          // satu simbol tidak dikenal membuat seluruh permintaan ditolak; tanya satu per satu
          return Promise.all(syms.map(one)).then(function (arr) { return arr.filter(Boolean); });
        }
        throw new Error('Binance ' + r.status);
      }).then(function (rows) {
        var by = {};
        (Array.isArray(rows) ? rows : [rows]).forEach(function (x) { if (x && x.symbol) by[x.symbol] = x; });
        var prices = {}, missing = [];
        keys.forEach(function (k, i) {
          var x = by[syms[i]];
          var price = x ? Number(x.lastPrice) : 0;
          if (price > 0) {
            var open = Number(x.openPrice);
            prices[k] = { price: price, prev: open > 0 ? open : null, time: x.closeTime ? Math.round(Number(x.closeTime) / 1000) : null };
          } else missing.push(k);
        });
        return { prices: prices, missing: missing };
      }).catch(function () {
        // Binance tidak terjangkau (jaringan, pemblokiran, CORS): pakai GOOGLEFINANCE
        return { prices: {}, missing: keys };
      });
    }

    function gfSymbol(key) {
      var p = key.split(':'), kode = p[1];
      if (p[0] === 'ID') return 'IDX:' + kode;
      if (p[0] === 'US') return kode.replace(/-/g, '.');
      return 'CURRENCY:' + kode + 'USD';
    }

    function cellState(v) {
      if (typeof v === 'number') return v > 0 ? 'ok' : 'bad';
      var s = String(v === undefined || v === null ? '' : v);
      if (s === '' || /^loading/i.test(s)) return 'pending';
      if (/^#ERROR/i.test(s)) return 'parse';
      return 'bad'; // #N/A dan sejenisnya
    }

    function writeFormulas(rows, sep) {
      var values = rows.map(function (r) {
        var row = [r.key, '=GOOGLEFINANCE("' + r.sym + '")', '=GOOGLEFINANCE("' + r.sym + '"' + sep + '"closeyest")'];
        // ringkasan valuasi untuk saham: tertinggi/terendah 52 minggu, P/E, EPS (bisa kosong untuk sebagian emiten)
        EXTRA.forEach(function (a) { row.push(r.stock ? '=GOOGLEFINANCE("' + r.sym + '"' + sep + '"' + a + '")' : ''); });
        return row;
      });
      return req('POST', base + '/values:batchClear', { ranges: [a1(PRICE_TAB, 'A2:G')] }).then(function () {
        return req('PUT', base + '/values/' + enc(a1(PRICE_TAB, 'A2:G' + (rows.length + 1))) + '?valueInputOption=USER_ENTERED', { values: values });
      });
    }

    function readFormulas(rows) {
      return req('GET', base + '/values/' + enc(a1(PRICE_TAB, 'A2:G' + (rows.length + 1))) + '?valueRenderOption=UNFORMATTED_VALUE').then(function (j) {
        return (j && j.values) || [];
      });
    }

    function pollFormulas(rows, attempts) {
      return readFormulas(rows).then(function (v) {
        var pending = false;
        rows.forEach(function (r, i) {
          var a = v[i] || [];
          if (cellState(a[1]) === 'pending' || cellState(a[2]) === 'pending') pending = true;
        });
        if (pending && attempts > 1) return sleep(1500).then(function () { return pollFormulas(rows, attempts - 1); });
        return v;
      });
    }

    function googleFinance(keys) {
      var seen = {};
      var rows = [{ key: 'FX:USDIDR', sym: 'CURRENCY:USDIDR' }];
      keys.forEach(function (k) {
        if (!seen[k]) { seen[k] = 1; rows.push({ key: k, sym: gfSymbol(k), stock: k.indexOf('CRYPTO:') !== 0 }); }
      });
      return meta().then(function (m) { return PRICE_TAB in m ? m : ensureTabs(); })
        .then(function () { return writeFormulas(rows, ','); })
        .then(function () { return pollFormulas(rows, 6); })
        .then(function (v) {
          // rumus dua argumen memakai pemisah sesuai bahasa spreadsheet; bila koma ditolak, ulangi dengan titik koma
          var parse = rows.some(function (r, i) { var a = v[i] || []; return cellState(a[2]) === 'parse'; });
          if (!parse) return v;
          return writeFormulas(rows, ';').then(function () { return pollFormulas(rows, 6); });
        })
        .then(function (v) {
          var prices = {}, errors = {}, fx = null;
          rows.forEach(function (r, i) {
            var a = v[i] || [];
            var price = cellState(a[1]) === 'ok' ? a[1] : 0;
            var prev = cellState(a[2]) === 'ok' ? a[2] : null;
            if (r.key === 'FX:USDIDR') { if (price > 0) fx = price; return; }
            if (price > 0) {
              prices[r.key] = { price: price, prev: prev, time: null };
              EXTRA.forEach(function (name, j) {
                var v = a[3 + j];
                if (typeof v === 'number' && isFinite(v) && v !== 0) prices[r.key][name] = v;
              });
            }
            else errors[r.key] = 'Tidak ditemukan';
          });
          return { prices: prices, errors: errors, fx: fx };
        });
    }

    /** keys: "PASAR:KODE". Mengembalikan { prices, errors, fx } seperti endpoint harga Apps Script. */
    function prices(keys) {
      var crypto = [], stocks = [];
      keys.forEach(function (k) {
        var p = k.split(':');
        if (p[0] === 'CRYPTO') crypto.push(k);
        else if (p[0] === 'ID' || p[0] === 'US') stocks.push(k);
      });
      return binance(crypto).then(function (b) {
        return googleFinance(stocks.concat(b.missing)).then(function (g) {
          var all = Object.assign({}, g.prices, b.prices);
          return { prices: all, errors: g.errors, fx: g.fx };
        });
      });
    }

    return {
      ensureTabs: ensureTabs, readAll: readAll, append: append, update: update, remove: remove,
      replaceAll: replaceAll, prices: prices
    };
  }

  return {
    SCOPE: SCOPE, TAB: TAB, PRICE_TAB: PRICE_TAB, headers: headers,
    locateSheet: locateSheet, parseSheetId: parseSheetId, loadGis: loadGis, createAuth: createAuth, createClient: createClient
  };
}));
