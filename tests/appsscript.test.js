// Menguji logika apps-script/Code.gs dengan Google Sheets tiruan di memori.
// Jalankan: node tests/appsscript.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- Sheets tiruan ----------
class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  setName(n) { this.name = n; return this; }
  getLastRow() {
    let last = 0;
    this.rows.forEach((r, i) => { if (r && r.some(v => v !== '' && v != null)) last = i + 1; });
    return last;
  }
  getMaxRows() { return 1000; }
  getRange(r, c, nr = 1, nc = 1) {
    const self = this;
    const api = {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = self.rows[r - 1 + i] || [];
          const o = [];
          for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
          out.push(o);
        }
        return out;
      },
      setValues(vals) {
        vals.forEach((vr, i) => {
          const row = (self.rows[r - 1 + i] = self.rows[r - 1 + i] || []);
          vr.forEach((v, j) => { row[c - 1 + j] = v; });
        });
        return api;
      },
      clearContent() {
        for (let i = 0; i < nr; i++) {
          const row = self.rows[r - 1 + i];
          if (row) for (let j = 0; j < nc; j++) row[c - 1 + j] = '';
        }
        return api;
      }
    };
    ['setFontWeight', 'setBackground', 'setFontColor', 'setWrap', 'setNumberFormat'].forEach(m => { api[m] = () => api; });
    return api;
  }
  appendRow(vals) { this.rows[this.getLastRow()] = vals.slice(); }
  deleteRow(n) { this.rows.splice(n - 1, 1); }
  setFrozenRows() {}
  setColumnWidth() {}
}

const book = { sheets: [new Sheet('Sheet1')] };
const ctx = {
  SpreadsheetApp: {
    getActive: () => ({
      getSheetByName: n => book.sheets.find(s => s.name === n) || null,
      insertSheet: n => { const s = new Sheet(n); book.sheets.push(s); return s; },
      getSheets: () => book.sheets,
      deleteSheet: s => { book.sheets = book.sheets.filter(x => x !== s); }
    })
  },
  Utilities: {
    getUuid: () => require('crypto').randomUUID(),
    formatDate: d => d.toISOString().slice(0, 10)
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Session: { getScriptTimeZone: () => 'UTC' },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: s => ({ text: s, setMimeType() { return this; } })
  },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  console
};
vm.createContext(ctx);
const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8')
  .replace("var TOKEN = 'GANTI_DENGAN_KATA_SANDI_ANDA';", "var TOKEN = 'rahasia-penuh';")
  .replace("var CHAT_TOKEN = 'GANTI_DENGAN_KATA_SANDI_CHAT';", "var CHAT_TOKEN = 'rahasia-chat';");
vm.runInContext(src, ctx);

const get = params => JSON.parse(vm.runInContext('doGet(__e).text', Object.assign(ctx, { __e: { parameter: params } })));
const post = body => JSON.parse(vm.runInContext('doPost(__e).text', Object.assign(ctx, { __e: { postData: { contents: JSON.stringify(body) } } })));

// ---------- setup ----------
vm.runInContext('setup()', ctx);
const names = book.sheets.map(s => s.name).sort();
assert.deepStrictEqual(names, ['Crypto Reward', 'Crypto Transaksi', 'ID Dividen', 'ID Transaksi', 'US Dividen', 'US Transaksi']);
vm.runInContext('setup()', ctx); // aman dijalankan ulang
assert.strictEqual(book.sheets.length, 6);

// ---------- otorisasi ----------
assert(/Token salah/.test(get({ action: 'ping', token: 'salah' }).error));
assert.strictEqual(get({ action: 'ping', token: 'rahasia-chat' }).akses, 'chat');
assert.strictEqual(get({ action: 'ping', token: 'rahasia-penuh' }).akses, 'full');
assert(/tidak boleh/.test(get({ action: 'all', token: 'rahasia-chat' }).error), 'token chat tidak boleh membaca semua');
assert(/Token salah/.test(post({ action: 'add', token: 'rahasia-chat', sheet: 'transaksi', row: { id: 'x', kode: 'BBCA' } }).error), 'token chat tidak boleh menulis lewat POST');

// TOKEN dan CHAT_TOKEN yang sama ditolak (token chat tidak boleh punya akses penuh)
vm.runInContext("CHAT_TOKEN = TOKEN", ctx);
assert(/harus berbeda/.test(get({ action: 'ping', token: 'rahasia-penuh' }).error));
assert(/harus berbeda/.test(post({ action: 'replaceAll', token: 'rahasia-penuh', transaksi: [], dividen: [] }).error));
vm.runInContext("CHAT_TOKEN = 'rahasia-chat'", ctx);

// ---------- catat lewat chat ----------
const t = 'rahasia-chat';
let r = get({ action: 'catat', token: t, pasar: 'ID', jenis: 'BELI', kode: 'bbca', jumlah: '10', harga: '9000', tanggal: '2026-10-09', id: 'c-1' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(r.tercatat.kode, 'BBCA');
assert.strictEqual(r.tercatat.harga, 9000);
assert.strictEqual(r.tercatat.fee, 13500, 'fee otomatis 0,15%');
assert.strictEqual(r.posisi.jumlah, 10);
assert(Math.abs(r.posisi.hargaRataRata - 9013.5) < 0.01);

// aturan angka: satu titik = desimal, banyak titik = ribuan, koma = desimal
assert.strictEqual(vm.runInContext('parseNum_("9.000")', ctx), 9);
assert.strictEqual(vm.runInContext('parseNum_("1.500.000")', ctx), 1500000);
assert.strictEqual(vm.runInContext('parseNum_("2,5")', ctx), 2.5);
assert.strictEqual(vm.runInContext('parseNum_("0,0025")', ctx), 0.0025);
assert.strictEqual(vm.runInContext('parseNum_("1,500,000")', ctx), 1500000);
assert.strictEqual(vm.runInContext('parseNum_("0.0025")', ctx), 0.0025);

// idempoten: ID sama tidak menggandakan baris
r = get({ action: 'catat', token: t, pasar: 'ID', jenis: 'BELI', kode: 'BBCA', jumlah: '10', harga: '9000', id: 'c-1' });
assert.strictEqual(r.duplikat, true);
assert.strictEqual(book.sheets.find(s => s.name === 'ID Transaksi').getLastRow(), 2);

// validasi
assert(/bilangan bulat/.test(get({ action: 'catat', token: t, pasar: 'ID', jenis: 'BELI', kode: 'BBCA', jumlah: '2.5', harga: '9000' }).error));
assert(/melebihi kepemilikan/.test(get({ action: 'catat', token: t, pasar: 'ID', jenis: 'JUAL', kode: 'BBCA', jumlah: '99', harga: '9500' }).error));
assert(/Kode tidak valid/.test(get({ action: 'catat', token: t, pasar: 'ID', jenis: 'BELI', kode: 'B', jumlah: '1', harga: '9' }).error));
assert(/YYYY-MM-DD/.test(get({ action: 'catat', token: t, pasar: 'ID', jenis: 'BELI', kode: 'BBCA', jumlah: '1', harga: '9', tanggal: '09-10-2026' }).error));
assert(/Jenis/.test(get({ action: 'catat', token: t, pasar: 'ID', jenis: 'TUKAR', kode: 'BBCA', jumlah: '1', harga: '9' }).error));
assert(/Pasar/.test(get({ action: 'catat', token: t, pasar: 'EU', jenis: 'BELI', kode: 'BBCA', jumlah: '1', harga: '9' }).error));

// jual sebagian
r = get({ action: 'catat', token: t, pasar: 'ID', jenis: 'JUAL', kode: 'BBCA', jumlah: '4', harga: '10000', tanggal: '2026-10-09' });
assert.strictEqual(r.ok, true);
assert.strictEqual(r.posisi.jumlah, 6);

// saham US pecahan dan crypto pecahan (koma desimal gaya Indonesia)
r = get({ action: 'catat', token: t, pasar: 'US', jenis: 'BELI', kode: 'AAPL', jumlah: '2,5', harga: '200.50' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(r.tercatat.qty, 2.5);
assert.strictEqual(r.tercatat.fee, 0);
r = get({ action: 'catat', token: t, pasar: 'CRYPTO', jenis: 'BELI', kode: 'BTC', jumlah: '0,0025', harga: '1.500.000.000' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(r.tercatat.qty, 0.0025);
assert.strictEqual(r.tercatat.harga, 1500000000);
assert.strictEqual(r.tercatat.fee, 7500, 'fee crypto 0,2% dibulatkan ke Rp');
assert.strictEqual(book.sheets.find(s => s.name === 'Crypto Transaksi').getLastRow(), 2);
assert.strictEqual(book.sheets.find(s => s.name === 'US Transaksi').getLastRow(), 2);

// dividen
r = get({ action: 'catat_dividen', token: t, pasar: 'ID', kode: 'BBCA', jumlah: '450000', tanggal: '2026-10-09' });
assert.strictEqual(r.ok, true, JSON.stringify(r));
assert.strictEqual(book.sheets.find(s => s.name === 'ID Dividen').getLastRow(), 2);

// posisi dan daftar (baca)
const pos = get({ action: 'posisi', token: t });
assert.strictEqual(pos.posisi.ID[0].kode, 'BBCA');
assert.strictEqual(pos.posisi.ID[0].jumlah, 6);
assert.strictEqual(pos.posisi.US[0].jumlah, 2.5);
const daftar = get({ action: 'daftar', token: t, pasar: 'ID', n: '5' });
assert.strictEqual(daftar.baris.length, 2);

// ---------- aplikasi web (TOKEN penuh) ----------
const all = get({ action: 'all', token: 'rahasia-penuh' });
assert.strictEqual(all.transaksi.length, 4);
assert.strictEqual(all.dividen.length, 1);
assert(all.transaksi.every(x => ['ID', 'US', 'CRYPTO'].includes(x.pasar)));

// baris yang diketik manual tanpa ID diberi ID
const idTrx = book.sheets.find(s => s.name === 'ID Transaksi');
idTrx.appendRow(['', '2026-09-01', 'TLKM', 'BELI', 5, 3000, 0, 'manual']);
const again = get({ action: 'all', token: 'rahasia-penuh' });
const manual = again.transaksi.find(x => x.kode === 'TLKM');
assert(manual && manual.id, 'ID dibuat otomatis');
assert.strictEqual(idTrx.rows[idTrx.getLastRow() - 1][0], manual.id, 'ID ditulis balik ke sheet');

// update, pindah pasar, hapus
assert.strictEqual(post({ action: 'update', token: 'rahasia-penuh', sheet: 'transaksi', row: Object.assign({}, manual, { qty: 7 }) }).ok, true);
assert.strictEqual(get({ action: 'all', token: 'rahasia-penuh' }).transaksi.find(x => x.id === manual.id).qty, 7);
assert.strictEqual(post({ action: 'delete', token: 'rahasia-penuh', sheet: 'transaksi', pasar: 'ID', id: manual.id }).ok, true);
assert.strictEqual(get({ action: 'all', token: 'rahasia-penuh' }).transaksi.length, 4);

// replaceAll mengelompokkan per pasar
assert.strictEqual(post({
  action: 'replaceAll', token: 'rahasia-penuh',
  transaksi: [
    { id: 'a', pasar: 'US', tanggal: '2026-01-01', kode: 'MSFT', jenis: 'BELI', qty: 1, harga: 400, fee: 0, catatan: '' },
    { id: 'b', pasar: 'CRYPTO', tanggal: '2026-01-01', kode: 'ETH', jenis: 'BELI', qty: 0.5, harga: 50000000, fee: 0, catatan: '' }
  ],
  dividen: []
}).ok, true);
const rep = get({ action: 'all', token: 'rahasia-penuh' });
assert.deepStrictEqual(rep.transaksi.map(x => x.pasar).sort(), ['CRYPTO', 'US']);
assert.strictEqual(rep.dividen.length, 0);

// harga: input tidak valid diabaikan tanpa memanggil jaringan
ctx.UrlFetchApp = { fetchAll: reqs => reqs.map(() => ({ getContentText: () => '{"chart":{"result":null}}' })) };
const px = get({ action: 'prices', token: 'rahasia-penuh', symbols: 'ID:BBCA,XX:FOO,ID:@@' });
assert.deepStrictEqual(Object.keys(px.errors), ['ID:BBCA']);
assert.strictEqual(px.fx, null);

console.log('Semua tes Apps Script lulus.');
