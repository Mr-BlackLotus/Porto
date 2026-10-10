/**
 * Porto — backend Google Sheets (Google Apps Script).
 *
 * Cara pakai (sekali saja):
 *  1. Buka spreadsheet "Porto" > Extensions (Ekstensi) > Apps Script.
 *  2. Hapus isi default, tempel seluruh file ini.
 *  3. Ganti TOKEN dan CHAT_TOKEN di bawah dengan dua kata sandi berbeda buatan Anda sendiri.
 *  4. Pilih fungsi `setup` lalu Run (setujui izin). Ini membuat 6 tab terpisah:
 *       ID Transaksi, ID Dividen, US Transaksi, US Dividen, Crypto Transaksi, Crypto Reward
 *  5. Deploy > New deployment > Web app:
 *       Execute as: Me | Who has access: Anyone
 *     Salin URL Web App ke aplikasi Porto (menu Pengaturan) beserta TOKEN.
 *
 * Setiap kali file ini diubah, buat deployment versi baru (Deploy > Manage deployments > Edit > New version).
 *
 * TOKEN      : akses penuh, dipakai aplikasi web. Jangan dibagikan.
 * CHAT_TOKEN : akses terbatas (hanya menambah transaksi/dividen dan membaca posisi). Dipakai untuk
 *              mencatat lewat chat dengan Claude. Tidak bisa menghapus atau mengubah data.
 */

var TOKEN = 'GANTI_DENGAN_KATA_SANDI_ANDA';
var CHAT_TOKEN = 'GANTI_DENGAN_KATA_SANDI_CHAT';

// Fee otomatis (persen) bila fee tidak diisi saat mencatat lewat chat. Sesuaikan dengan broker Anda.
var FEE = {
  ID: { beli: 0.15, jual: 0.25 },
  US: { beli: 0, jual: 0 },
  CRYPTO: { beli: 0.2, jual: 0.2 }
};
// Mata uang pencatatan crypto: 'IDR' atau 'USD' (samakan dengan Pengaturan di aplikasi).
var CRYPTO_CCY = 'IDR';

var PLACEHOLDERS = ['GANTI_DENGAN_KATA_SANDI_ANDA', 'GANTI_DENGAN_KATA_SANDI_CHAT'];

var MARKETS = {
  ID: {
    tab: 'ID', mult: 100, integerQty: true, kodeRe: /^[A-Z0-9]{2,6}$/, divTab: 'Dividen',
    qtyHeader: 'Lot', hargaHeader: 'Harga per Lembar (Rp)', feeHeader: 'Fee (Rp)', divHeader: 'Total Diterima (Rp)',
    yahoo: function (k) { return k + '.JK'; }
  },
  US: {
    tab: 'US', mult: 1, integerQty: false, kodeRe: /^[A-Z][A-Z0-9.\-]{0,9}$/, divTab: 'Dividen',
    qtyHeader: 'Jumlah (lembar)', hargaHeader: 'Harga per Lembar (USD)', feeHeader: 'Fee (USD)', divHeader: 'Total Diterima (USD)',
    yahoo: function (k) { return k; }
  },
  CRYPTO: {
    tab: 'Crypto', mult: 1, integerQty: false, kodeRe: /^[A-Z0-9]{2,10}$/, divTab: 'Reward',
    qtyHeader: 'Jumlah (koin)', hargaHeader: 'Harga per Koin', feeHeader: 'Fee', divHeader: 'Total Diterima',
    yahoo: function (k) { return k + '-USD'; }
  }
};
var MARKET_KEYS = ['ID', 'US', 'CRYPTO'];

var KINDS = {
  transaksi: {
    cols: ['id', 'tanggal', 'kode', 'jenis', 'qty', 'harga', 'fee', 'catatan'],
    textCols: [1, 2, 3, 4, 8]
  },
  dividen: {
    cols: ['id', 'tanggal', 'kode', 'qty', 'dps', 'pajak', 'jumlah', 'catatan'],
    textCols: [1, 2, 3, 8]
  }
};

function tabName_(pasar, kind) {
  var m = MARKETS[pasar];
  return m.tab + ' ' + (kind === 'transaksi' ? 'Transaksi' : m.divTab);
}

function headers_(pasar, kind) {
  var m = MARKETS[pasar];
  if (kind === 'transaksi') return ['ID', 'Tanggal', 'Kode', 'Jenis (BELI/JUAL)', m.qtyHeader, m.hargaHeader, m.feeHeader, 'Catatan'];
  return ['ID', 'Tanggal', 'Kode', m.qtyHeader + ' (opsional)', 'Per Lembar/Koin (opsional)', 'Pajak (%)', m.divHeader, 'Catatan'];
}

/** Jalankan sekali dari editor untuk menyiapkan tab dan judul kolom. Aman dijalankan ulang. */
function setup() {
  var ss = SpreadsheetApp.getActive();

  // Migrasi dari versi lama (tab "Transaksi" dan "Dividen" tanpa pasar) menjadi tab pasar ID.
  var legacyT = ss.getSheetByName('Transaksi');
  if (legacyT && !ss.getSheetByName('ID Transaksi')) legacyT.setName('ID Transaksi');
  var legacyD = ss.getSheetByName('Dividen');
  if (legacyD && !ss.getSheetByName('ID Dividen')) legacyD.setName('ID Dividen');

  MARKET_KEYS.forEach(function (pasar) {
    Object.keys(KINDS).forEach(function (kind) {
      var def = KINDS[kind];
      var name = tabName_(pasar, kind);
      var sh = ss.getSheetByName(name) || ss.insertSheet(name);
      var hdr = headers_(pasar, kind);
      sh.getRange(1, 1, 1, hdr.length).setValues([hdr])
        .setFontWeight('bold').setBackground('#0D4F4A').setFontColor('#FFFFFF').setWrap(true);
      sh.setFrozenRows(1);
      def.textCols.forEach(function (c) { sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
      sh.setColumnWidth(1, 90);
      sh.setColumnWidth(8, 220);
    });
  });

  var first = ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

// ---------------------------------------------------------------- util

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** 'full' untuk TOKEN, 'chat' untuk CHAT_TOKEN, null bila salah atau belum diganti. */
function level_(token) {
  if (!token) return null;
  if (PLACEHOLDERS.indexOf(TOKEN) < 0 && token === TOKEN) return 'full';
  if (PLACEHOLDERS.indexOf(CHAT_TOKEN) < 0 && token === CHAT_TOKEN) return 'chat';
  return null;
}

function sheet_(pasar, kind) {
  var ss = SpreadsheetApp.getActive();
  var name = tabName_(pasar, kind);
  var sh = ss.getSheetByName(name);
  if (!sh) { setup(); sh = ss.getSheetByName(name); }
  return sh;
}

function toRow_(kind, row) {
  return KINDS[kind].cols.map(function (c) {
    var v = row[c];
    return v === undefined || v === null ? '' : v;
  });
}

function findRow_(sh, id) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function cellText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}

function newId_() { return 'm' + Utilities.getUuid().replace(/-/g, '').slice(0, 9); }

function readTab_(pasar, kind) {
  var def = KINDS[kind];
  var sh = sheet_(pasar, kind);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var range = sh.getRange(2, 1, last - 1, def.cols.length);
  var values = range.getValues();
  var out = [];
  var needIds = false;
  values.forEach(function (r) {
    if (String(r[2]).trim() === '') return; // baris tanpa kode diabaikan
    if (String(r[0]).trim() === '') { r[0] = newId_(); needIds = true; } // baris yang diketik manual diberi ID
    var o = { pasar: pasar };
    def.cols.forEach(function (c, i) { o[c] = cellText_(r[i]); });
    out.push(o);
  });
  if (needIds) {
    // tulis balik ID agar stabil untuk ubah dan hapus
    var ids = values.map(function (r) { return [r[0]]; });
    sh.getRange(2, 1, ids.length, 1).setValues(ids);
  }
  return out;
}

function readAll_(kind) {
  var out = [];
  MARKET_KEYS.forEach(function (p) { out = out.concat(readTab_(p, kind)); });
  return out;
}

function writeTab_(pasar, kind, rows) {
  var def = KINDS[kind];
  var sh = sheet_(pasar, kind);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, def.cols.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, def.cols.length).setValues(rows.map(function (r) { return toRow_(kind, r); }));
  }
}

function pasarOf_(v) { return MARKETS[v] ? v : 'ID'; }

// ---------------------------------------------------------------- GET

function tokensClash_() {
  return PLACEHOLDERS.indexOf(TOKEN) < 0 && TOKEN === CHAT_TOKEN;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (tokensClash_()) return json_({ error: 'TOKEN dan CHAT_TOKEN harus berbeda.' });
    var lvl = level_(p.token);
    if (!lvl) {
      var unset = PLACEHOLDERS.indexOf(TOKEN) >= 0 ? ' TOKEN di Code.gs belum diganti.' : '';
      return json_({ error: 'Token salah.' + unset });
    }
    var a = p.action;

    if (a === 'ping') return json_({ ok: true, akses: lvl });

    // ---- aksi untuk pencatatan lewat chat (CHAT_TOKEN atau TOKEN) ----
    if (a === 'catat') return withLock_(function () { return json_(chatAdd_(p)); });
    if (a === 'catat_dividen') return withLock_(function () { return json_(chatAddDividend_(p)); });
    if (a === 'posisi') return json_(positions_(p.pasar));
    if (a === 'daftar') return json_(recent_(p));

    // ---- aksi penuh (aplikasi web) ----
    if (lvl !== 'full') return json_({ error: 'Token ini tidak boleh melakukan aksi tersebut.' });
    if (a === 'all') return json_({ transaksi: readAll_('transaksi'), dividen: readAll_('dividen') });
    if (a === 'prices') return json_(fetchPrices_(String(p.symbols || '')));
    return json_({ error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (x) { /* abaikan */ }
  }
}

// ---------------------------------------------------------------- POST (aplikasi web, TOKEN penuh)

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (tokensClash_()) return json_({ error: 'TOKEN dan CHAT_TOKEN harus berbeda.' });
    if (level_(body.token) !== 'full') return json_({ error: 'Token salah.' });
    return withLock_(function () { return json_(handlePost_(body)); });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function handlePost_(body) {
  if (body.action === 'replaceAll') {
    ['transaksi', 'dividen'].forEach(function (kind) {
      MARKET_KEYS.forEach(function (p) {
        var rows = (body[kind] || []).filter(function (r) { return pasarOf_(r.pasar) === p; });
        writeTab_(p, kind, rows);
      });
    });
    return { ok: true };
  }

  var kind = body.sheet;
  if (!KINDS[kind]) return { error: 'Jenis data tidak dikenal.' };

  if (body.action === 'add') {
    var p1 = pasarOf_(body.row.pasar);
    sheet_(p1, kind).appendRow(toRow_(kind, body.row));
    return { ok: true };
  }
  if (body.action === 'update') {
    var pu = pasarOf_(body.row.pasar);
    // pindah pasar: hapus dari tab lama bila ada
    MARKET_KEYS.forEach(function (pk) {
      if (pk === pu) return;
      var s = sheet_(pk, kind);
      var rr = findRow_(s, body.row.id);
      if (rr > 0) s.deleteRow(rr);
    });
    var sh = sheet_(pu, kind);
    var r = findRow_(sh, body.row.id);
    if (r < 0) sh.appendRow(toRow_(kind, body.row));
    else sh.getRange(r, 1, 1, KINDS[kind].cols.length).setValues([toRow_(kind, body.row)]);
    return { ok: true };
  }
  if (body.action === 'delete') {
    var targets = body.pasar && MARKETS[body.pasar] ? [body.pasar] : MARKET_KEYS;
    targets.forEach(function (pk) {
      var s2 = sheet_(pk, kind);
      var d = findRow_(s2, body.id);
      if (d > 0) s2.deleteRow(d);
    });
    return { ok: true };
  }
  return { error: 'Aksi tidak dikenal.' };
}

// ---------------------------------------------------------------- pencatatan lewat chat

function today_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

/**
 * Angka dari parameter. Aturan (tegas agar tidak ambigu):
 *  - satu titik = desimal  ("200.50" = 200,5; "9.000" = 9)
 *  - lebih dari satu titik = pemisah ribuan ("1.500.000" = 1500000)
 *  - koma dipakai desimal ("2,5"), kecuali pola ribuan jelas ("1,500,000")
 * Kirim angka polos tanpa pemisah ribuan agar aman: 9000, 0.0025.
 */
function parseNum_(v) {
  if (v === undefined || v === null || String(v).trim() === '') return NaN;
  var s = String(v).trim().replace(/\s/g, '');
  var dots = (s.match(/\./g) || []).length;
  var commas = (s.match(/,/g) || []).length;
  if (dots && commas) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (dots > 1) {
    s = s.replace(/\./g, '');
  } else if (commas) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) && commas > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  return Number(s);
}

function validDate_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function feeDecimals_(pasar) {
  if (pasar === 'ID') return 0;
  if (pasar === 'US') return 2;
  return CRYPTO_CCY === 'USD' ? 2 : 0;
}

function holdings_(pasar) {
  var map = {};
  readTab_(pasar, 'transaksi').forEach(function (t) {
    var k = String(t.kode).toUpperCase();
    var q = Number(t.qty) || 0;
    var h = map[k] || (map[k] = { kode: k, qty: 0, cost: 0 });
    var gross = q * MARKETS[pasar].mult * (Number(t.harga) || 0);
    var fee = Number(t.fee) || 0;
    if (String(t.jenis).toUpperCase() === 'BELI') { h.qty += q; h.cost += gross + fee; }
    else {
      var avg = h.qty > 0 ? h.cost / h.qty : 0;
      var sold = Math.min(q, h.qty);
      h.cost -= avg * sold;
      h.qty -= sold;
    }
  });
  return map;
}

function chatAdd_(p) {
  var pasar = String(p.pasar || 'ID').toUpperCase();
  var m = MARKETS[pasar];
  if (!m) return { error: 'Pasar harus ID, US, atau CRYPTO.' };
  var jenis = String(p.jenis || '').toUpperCase();
  if (jenis !== 'BELI' && jenis !== 'JUAL') return { error: 'Jenis harus BELI atau JUAL.' };
  var kode = String(p.kode || '').trim().toUpperCase();
  if (!m.kodeRe.test(kode)) return { error: 'Kode tidak valid untuk pasar ' + pasar + '.' };
  var qty = parseNum_(p.jumlah);
  if (!(qty > 0)) return { error: 'Jumlah harus lebih dari 0.' };
  if (m.integerQty && Math.round(qty) !== qty) return { error: 'Jumlah lot saham Indonesia harus bilangan bulat.' };
  var harga = parseNum_(p.harga);
  if (!(harga > 0)) return { error: 'Harga harus lebih dari 0.' };
  var tanggal = p.tanggal ? String(p.tanggal) : today_();
  if (!validDate_(tanggal)) return { error: 'Tanggal harus berformat YYYY-MM-DD.' };

  var gross = qty * m.mult * harga;
  var fee = parseNum_(p.fee);
  if (isNaN(fee)) {
    var pct = jenis === 'JUAL' ? FEE[pasar].jual : FEE[pasar].beli;
    var f = Math.pow(10, feeDecimals_(pasar));
    fee = Math.round(gross * pct / 100 * f) / f;
  }
  if (fee < 0) return { error: 'Fee tidak boleh negatif.' };

  var sh = sheet_(pasar, 'transaksi');
  var id = p.id ? String(p.id).slice(0, 40) : newId_();
  if (findRow_(sh, id) > 0) return { ok: true, duplikat: true, id: id, pesan: 'Transaksi dengan ID ini sudah tercatat.' };

  if (jenis === 'JUAL') {
    var h = holdings_(pasar)[kode];
    var have = h ? h.qty : 0;
    if (qty > have + 1e-9) return { error: 'Jual ' + qty + ' ' + kode + ' melebihi kepemilikan (' + have + ').' };
  }

  var row = { id: id, tanggal: tanggal, kode: kode, jenis: jenis, qty: qty, harga: harga, fee: fee, catatan: String(p.catatan || '').slice(0, 120) };
  sh.appendRow(toRow_('transaksi', row));
  var after = holdings_(pasar)[kode];
  return {
    ok: true, id: id, pasar: pasar, tercatat: row,
    nilai: gross, bersih: jenis === 'JUAL' ? gross - fee : gross + fee,
    posisi: after ? { kode: kode, jumlah: after.qty, hargaRataRata: after.qty > 0 ? after.cost / (after.qty * m.mult) : 0 } : { kode: kode, jumlah: 0, hargaRataRata: 0 }
  };
}

function chatAddDividend_(p) {
  var pasar = String(p.pasar || 'ID').toUpperCase();
  var m = MARKETS[pasar];
  if (!m) return { error: 'Pasar harus ID, US, atau CRYPTO.' };
  var kode = String(p.kode || '').trim().toUpperCase();
  if (!m.kodeRe.test(kode)) return { error: 'Kode tidak valid untuk pasar ' + pasar + '.' };
  var jumlah = parseNum_(p.jumlah);
  if (!(jumlah > 0)) return { error: 'Total diterima harus lebih dari 0.' };
  var tanggal = p.tanggal ? String(p.tanggal) : today_();
  if (!validDate_(tanggal)) return { error: 'Tanggal harus berformat YYYY-MM-DD.' };

  var sh = sheet_(pasar, 'dividen');
  var id = p.id ? String(p.id).slice(0, 40) : newId_();
  if (findRow_(sh, id) > 0) return { ok: true, duplikat: true, id: id, pesan: 'Pencatatan dengan ID ini sudah ada.' };

  var qty = parseNum_(p.qty), dps = parseNum_(p.dps), pajak = parseNum_(p.pajak);
  var row = {
    id: id, tanggal: tanggal, kode: kode,
    qty: isNaN(qty) ? '' : qty, dps: isNaN(dps) ? '' : dps, pajak: isNaN(pajak) ? '' : pajak,
    jumlah: jumlah, catatan: String(p.catatan || '').slice(0, 120)
  };
  sh.appendRow(toRow_('dividen', row));
  return { ok: true, id: id, pasar: pasar, tercatat: row };
}

function positions_(pasar) {
  var keys = pasar && MARKETS[String(pasar).toUpperCase()] ? [String(pasar).toUpperCase()] : MARKET_KEYS;
  var out = {};
  keys.forEach(function (pk) {
    var h = holdings_(pk);
    out[pk] = Object.keys(h).filter(function (k) { return h[k].qty > 0; }).map(function (k) {
      return { kode: k, jumlah: h[k].qty, hargaRataRata: h[k].cost / (h[k].qty * MARKETS[pk].mult), modal: h[k].cost };
    });
  });
  return { posisi: out };
}

function recent_(p) {
  var n = Math.max(1, Math.min(30, Number(p.n) || 10));
  var keys = p.pasar && MARKETS[String(p.pasar).toUpperCase()] ? [String(p.pasar).toUpperCase()] : MARKET_KEYS;
  var kind = p.jenis === 'dividen' ? 'dividen' : 'transaksi';
  var rows = [];
  keys.forEach(function (pk) { rows = rows.concat(readTab_(pk, kind)); });
  rows.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0; });
  return { jenis: kind, baris: rows.slice(0, n) };
}

// ---------------------------------------------------------------- harga

/**
 * symbols: daftar "PASAR:KODE" dipisah koma, misalnya "ID:BBCA,US:AAPL,CRYPTO:BTC".
 * Sumber: Yahoo Finance (IDX = kode.JK, crypto = KODE-USD), di-cache 5 menit.
 * Harga IDX dalam Rp, US dan crypto dalam USD. Kurs USD ke Rp dikirim sebagai `fx`.
 * Data bisa tertunda dan bukan data resmi bursa.
 */
function fetchPrices_(symbols) {
  var cache = CacheService.getScriptCache();
  var prices = {};
  var errors = {};
  var todo = [];

  String(symbols).split(',').slice(0, 80).forEach(function (raw) {
    var parts = raw.trim().toUpperCase().split(':');
    var pasar = parts[0], kode = parts[1];
    if (!MARKETS[pasar] || !kode || !MARKETS[pasar].kodeRe.test(kode)) return;
    var key = pasar + ':' + kode;
    var hit = cache.get('px_' + key);
    if (hit) prices[key] = JSON.parse(hit);
    else todo.push({ key: key, ticker: MARKETS[pasar].yahoo(kode) });
  });

  var fx = null;
  var fxHit = cache.get('fx_usdidr');
  if (fxHit) fx = JSON.parse(fxHit);
  else todo.push({ key: '__FX__', ticker: 'IDR=X' });

  if (todo.length) {
    var reqs = todo.map(function (t) {
      return {
        url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(t.ticker) + '?interval=1d&range=7d',
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      };
    });
    var res = UrlFetchApp.fetchAll(reqs);
    res.forEach(function (r, i) {
      var t = todo[i];
      try {
        var j = JSON.parse(r.getContentText());
        var result = j.chart.result[0];
        var price = result.meta.regularMarketPrice;
        var closes = (result.indicators.quote[0].close || []).filter(function (c) { return c != null; });
        var prev = closes.length >= 2 ? closes[closes.length - 2] : (result.meta.chartPreviousClose || null);
        if (!(price > 0)) throw new Error('harga kosong');
        var item = { price: price, prev: prev, time: result.meta.regularMarketTime || null };
        if (t.key === '__FX__') {
          fx = item;
          cache.put('fx_usdidr', JSON.stringify(item), 1800);
        } else {
          prices[t.key] = item;
          cache.put('px_' + t.key, JSON.stringify(item), 300);
        }
      } catch (err) {
        if (t.key !== '__FX__') errors[t.key] = 'Tidak ditemukan';
      }
    });
  }
  return { prices: prices, errors: errors, fx: fx ? fx.price : null };
}
