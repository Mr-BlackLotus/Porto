/**
 * Porto — backend Google Sheets (Google Apps Script).
 *
 * Cara pakai (sekali saja):
 *  1. Buka spreadsheet "Porto" > Extensions (Ekstensi) > Apps Script.
 *  2. Hapus isi default, tempel seluruh file ini.
 *  3. Ganti TOKEN di bawah dengan kata sandi buatan Anda sendiri.
 *  4. Pilih fungsi `setup` lalu Run (setujui izin). Ini membuat tab Transaksi & Dividen.
 *  5. Deploy > New deployment > Web app:
 *       Execute as: Me | Who has access: Anyone
 *     Salin URL Web App ke aplikasi Porto (menu Pengaturan) beserta TOKEN yang sama.
 *
 * Setiap kali file ini diubah, buat deployment versi baru (Deploy > Manage deployments > Edit > New version).
 */

var TOKEN = 'GANTI_DENGAN_KATA_SANDI_ANDA';

var SHEETS = {
  transaksi: {
    name: 'Transaksi',
    cols: ['id', 'tanggal', 'kode', 'jenis', 'lot', 'harga', 'fee', 'catatan'],
    headers: ['ID', 'Tanggal', 'Kode Saham', 'Jenis', 'Lot', 'Harga per Lembar', 'Fee', 'Catatan'],
    textCols: [1, 2, 3, 4, 8]
  },
  dividen: {
    name: 'Dividen',
    cols: ['id', 'tanggal', 'kode', 'lot', 'dps', 'pajak', 'jumlah', 'catatan'],
    headers: ['ID', 'Tanggal', 'Kode Saham', 'Lot', 'Dividen per Lembar', 'Pajak (%)', 'Total Diterima', 'Catatan'],
    textCols: [1, 2, 3, 8]
  }
};

/** Jalankan sekali dari editor untuk menyiapkan tab dan judul kolom. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (k) {
    var def = SHEETS[k];
    var sh = ss.getSheetByName(def.name) || ss.insertSheet(def.name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
        .setFontWeight('bold').setBackground('#0D4F4A').setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
    def.textCols.forEach(function (c) { sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('@'); });
    sh.setColumnWidth(1, 90);
  });
  var first = ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function authorized_(token) {
  return TOKEN !== 'GANTI_DENGAN_KATA_SANDI_ANDA' && token === TOKEN;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (TOKEN === 'GANTI_DENGAN_KATA_SANDI_ANDA') return json_({ error: 'TOKEN di Code.gs belum diganti.' });
    if (!authorized_(p.token)) return json_({ error: 'Token salah.' });
    if (p.action === 'ping') return json_({ ok: true });
    if (p.action === 'all') {
      return json_({ transaksi: readAll_('transaksi'), dividen: readAll_('dividen') });
    }
    if (p.action === 'prices') {
      var symbols = String(p.symbols || '').split(',').map(function (s) { return s.trim().toUpperCase(); })
        .filter(function (s) { return /^[A-Z0-9]{2,6}$/.test(s); }).slice(0, 60);
      return json_(fetchPrices_(symbols));
    }
    return json_({ error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents);
    if (!authorized_(body.token)) return json_({ error: 'Token salah.' });

    if (body.action === 'replaceAll') {
      writeAll_('transaksi', body.transaksi || []);
      writeAll_('dividen', body.dividen || []);
      return json_({ ok: true });
    }

    var def = SHEETS[body.sheet];
    if (!def) return json_({ error: 'Sheet tidak dikenal.' });
    var sh = sheet_(body.sheet);

    if (body.action === 'add') {
      sh.appendRow(toRow_(def, body.row));
      return json_({ ok: true });
    }
    if (body.action === 'update') {
      var r = findRow_(sh, body.row.id);
      if (r < 0) sh.appendRow(toRow_(def, body.row));
      else sh.getRange(r, 1, 1, def.cols.length).setValues([toRow_(def, body.row)]);
      return json_({ ok: true });
    }
    if (body.action === 'delete') {
      var d = findRow_(sh, body.id);
      if (d > 0) sh.deleteRow(d);
      return json_({ ok: true });
    }
    return json_({ error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* abaikan */ }
  }
}

function sheet_(kind) {
  var def = SHEETS[kind];
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(def.name);
  if (!sh) { setup(); sh = ss.getSheetByName(def.name); }
  return sh;
}

function toRow_(def, row) {
  return def.cols.map(function (c) {
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

function readAll_(kind) {
  var def = SHEETS[kind];
  var sh = sheet_(kind);
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, def.cols.length).getValues();
  return values.filter(function (r) { return r[0] !== '' && r[2] !== ''; }).map(function (r) {
    var o = {};
    def.cols.forEach(function (c, i) { o[c] = cellText_(r[i]); });
    return o;
  });
}

function writeAll_(kind, rows) {
  var def = SHEETS[kind];
  var sh = sheet_(kind);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, def.cols.length).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, def.cols.length).setValues(rows.map(function (r) { return toRow_(def, r); }));
  }
}

/**
 * Harga saham IDX dari Yahoo Finance (kode + ".JK"), di-cache 5 menit.
 * Harga bursa bisa tertunda; sumber ini bukan data resmi.
 */
function fetchPrices_(symbols) {
  var cache = CacheService.getScriptCache();
  var prices = {};
  var errors = {};
  var todo = [];
  symbols.forEach(function (s) {
    var hit = cache.get('px_' + s);
    if (hit) prices[s] = JSON.parse(hit); else todo.push(s);
  });

  if (todo.length) {
    var reqs = todo.map(function (s) {
      return {
        url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s) + '.JK?interval=1d&range=7d',
        muteHttpExceptions: true,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      };
    });
    var res = UrlFetchApp.fetchAll(reqs);
    res.forEach(function (r, i) {
      var s = todo[i];
      try {
        var j = JSON.parse(r.getContentText());
        var result = j.chart.result[0];
        var price = result.meta.regularMarketPrice;
        var closes = (result.indicators.quote[0].close || []).filter(function (c) { return c != null; });
        var prev = closes.length >= 2 ? closes[closes.length - 2] : (result.meta.chartPreviousClose || null);
        if (!(price > 0)) throw new Error('harga kosong');
        var item = { price: price, prev: prev, time: result.meta.regularMarketTime || null };
        prices[s] = item;
        cache.put('px_' + s, JSON.stringify(item), 300);
      } catch (err) {
        errors[s] = 'Tidak ditemukan';
      }
    });
  }
  return { prices: prices, errors: errors };
}
