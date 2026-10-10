// Jalankan: node tests/calc.test.js
const assert = require('assert');
const C = require('../js/calc.js');

const near = (a, b, msg) => assert(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);

// ---------- Saham Indonesia (lot = 100 lembar) ----------
const trx = [
  { id: 't1', tanggal: '2026-01-10', kode: 'bbca', jenis: 'BELI', qty: 10, harga: 9000, fee: 13500 },
  { id: 't2', tanggal: '2026-02-05', kode: 'BBCA', jenis: 'JUAL', qty: 5, harga: 10000, fee: 12500 },
  { id: 't3', tanggal: '2026-02-20', kode: 'TLKM', jenis: 'BELI', qty: 20, harga: 3000, fee: 9000 },
  { id: 't4', tanggal: '2026-04-02', kode: 'TLKM', jenis: 'JUAL', qty: 20, harga: 2800, fee: 14000 }
];
const divs = [
  { id: 'd1', tanggal: '2026-03-15', kode: 'BBCA', jumlah: 450000 },
  { id: 'd2', tanggal: '2026-04-20', kode: 'TLKM', jumlah: 100000 }
];

const L = C.buildLedger(trx, 100);

// BBCA: beli 1000 lembar, biaya 9.013.500 -> rata-rata 9.013,5
// Jual 500 @10.000 fee 12.500 -> hasil 4.987.500, modal terjual 4.506.750, profit 480.750
near(L.perTrx.t2, 480750, 'profit jual BBCA');
near(L.positions.BBCA.shares, 500, 'sisa lembar BBCA');
near(L.positions.BBCA.cost, 4506750, 'sisa modal BBCA');
near(L.perTrx.t4, 5586000 - 6009000, 'rugi jual TLKM');
assert.strictEqual(L.positions.TLKM.shares, 0);
assert.strictEqual(L.open.length, 1);
assert.strictEqual(L.warnings.length, 0);

// Data lama yang memakai kolom "lot" tetap terbaca
const legacy = C.buildLedger([{ id: 'l', tanggal: '2026-01-01', kode: 'BBRI', jenis: 'BELI', lot: 2, harga: 4000, fee: 0 }], 100);
near(legacy.positions.BBRI.shares, 200, 'kolom lot lama');

// Bulanan: Jan 0, Feb +480.750, Mar +450.000, Apr -323.000, Mei kosong (diisi sampai bulan sekarang)
const M = C.monthly(trx, L, divs, '2026-05-09');
assert.deepStrictEqual(M.map(m => m.month), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
near(M[1].total, 480750, 'Feb');
near(M[2].total, 450000, 'Mar');
near(M[3].total, -323000, 'Apr');
near(M[4].cumulative, 480750 + 450000 - 323000, 'kumulatif');

// Ringkasan dengan harga
const S = C.summarize(L, divs, k => (k === 'BBCA' ? { price: 9500, prev: 9400, source: 'live' } : null));
near(S.value, 4750000, 'nilai');
near(S.unrealized, 4750000 - 4506750, 'belum terealisasi');
near(S.realized, 480750 - 423000, 'terealisasi');
near(S.dividend, 550000, 'dividen');
near(S.totalReturn, S.realized + S.unrealized + S.dividend, 'total');
near(S.dayChange, 500 * 100, 'perubahan harian');
near(S.rows[0].qty, 5, 'jumlah lot tersisa');

// Tanpa harga: dinilai pada harga rata-rata
const S2 = C.summarize(L, divs, () => null);
near(S2.unrealized, 0, 'tanpa harga');
assert.deepStrictEqual(S2.missingPrices, ['BBCA']);

// Jual melebihi kepemilikan -> peringatan
const bad = C.buildLedger([
  { id: 'a', tanggal: '2026-01-01', kode: 'ANTM', jenis: 'BELI', qty: 1, harga: 1500, fee: 0 },
  { id: 'b', tanggal: '2026-01-02', kode: 'ANTM', jenis: 'JUAL', qty: 3, harga: 1600, fee: 0 }
], 100);
assert.strictEqual(bad.warnings.length, 1);
assert.strictEqual(bad.warnings[0].id, 'b');
assert.strictEqual(bad.positions.ANTM.shares, 0);

// Beli dan jual di hari yang sama: BELI diproses lebih dulu
const same = C.buildLedger([
  { id: 'x', tanggal: '2026-03-01', kode: 'GOTO', jenis: 'JUAL', qty: 1, harga: 100, fee: 0 },
  { id: 'y', tanggal: '2026-03-01', kode: 'GOTO', jenis: 'BELI', qty: 1, harga: 90, fee: 0 }
], 100);
assert.strictEqual(same.warnings.length, 0);
near(same.perTrx.x, 1000, 'hari sama');

// ---------- Saham US (lembar pecahan, USD) ----------
const us = C.buildLedger([
  { id: 'u1', tanggal: '2026-01-05', kode: 'AAPL', jenis: 'BELI', qty: 2.5, harga: 200, fee: 1 },
  { id: 'u2', tanggal: '2026-03-05', kode: 'AAPL', jenis: 'JUAL', qty: 1, harga: 230, fee: 0.5 }
], 1);
// modal 2,5 x 200 + 1 = 501 -> rata-rata 200,4. Jual 1 @230 fee 0,5 -> 229,5 - 200,4 = 29,1
near(us.perTrx.u2, 29.1, 'profit jual AAPL');
near(us.positions.AAPL.shares, 1.5, 'sisa lembar AAPL');
const usS = C.summarize(us, [], () => ({ price: 250, prev: 245, source: 'live' }));
near(usS.value, 375, 'nilai US');
near(usS.rows[0].qty, 1.5, 'jumlah lembar US');

// ---------- Crypto (koin pecahan) ----------
const cr = C.buildLedger([
  { id: 'c1', tanggal: '2026-02-01', kode: 'BTC', jenis: 'BELI', qty: 0.01, harga: 1000000000, fee: 20000 },
  { id: 'c2', tanggal: '2026-04-01', kode: 'BTC', jenis: 'JUAL', qty: 0.01, harga: 1200000000, fee: 24000 }
], 1);
// modal 10.000.000 + 20.000 = 10.020.000; hasil 12.000.000 - 24.000 = 11.976.000; profit 1.956.000
near(cr.perTrx.c2, 1956000, 'profit jual BTC');
assert.strictEqual(cr.open.length, 0);
assert.strictEqual(cr.warnings.length, 0);

// Menjual seluruh koin pecahan tidak boleh meninggalkan sisa debu atau peringatan
const dust = C.buildLedger([
  { id: 'd1', tanggal: '2026-01-01', kode: 'ETH', jenis: 'BELI', qty: 0.1, harga: 50000000, fee: 0 },
  { id: 'd2', tanggal: '2026-01-02', kode: 'ETH', jenis: 'BELI', qty: 0.2, harga: 50000000, fee: 0 },
  { id: 'd3', tanggal: '2026-01-03', kode: 'ETH', jenis: 'JUAL', qty: 0.3, harga: 55000000, fee: 0 }
], 1);
assert.strictEqual(dust.warnings.length, 0);
assert.strictEqual(dust.open.length, 0);

// ---------- Gabungan lintas pasar ----------
const usM = { trx: [{ tanggal: '2026-03-05' }], ledger: us, dividends: [{ tanggal: '2026-03-20', kode: 'AAPL', jumlah: 2 }], rate: 16000 };
const idM = { trx: trx, ledger: L, dividends: divs, rate: 1 };
const merged = C.mergeMonthly([idM, usM], '2026-05-09');
// Maret: dividen BBCA 450.000 + profit AAPL 29,1 x 16.000 + dividen AAPL 2 x 16.000
near(merged[2].total, 450000 + 29.1 * 16000 + 2 * 16000, 'gabungan Maret');

// ---------- Fee otomatis ----------
assert.strictEqual(C.estimateFee('BELI', 10, 9000, 0.15, 0.25, 100, 0), 13500);
assert.strictEqual(C.estimateFee('JUAL', 5, 10000, 0.15, 0.25, 100, 0), 12500);
assert.strictEqual(C.estimateFee('BELI', 2.5, 200, 0.1, 0.1, 1, 2), 0.5);
assert.strictEqual(C.estimateFee('BELI', 10, 9000, 0.15, 0.25), 13500);

// ---------- Konfigurasi pasar ----------
assert(C.MARKETS.ID.kodeRe.test('BBCA') && !C.MARKETS.ID.kodeRe.test('B'));
assert(C.MARKETS.US.kodeRe.test('BRK-B') && C.MARKETS.US.kodeRe.test('AAPL'));
assert(C.MARKETS.CRYPTO.kodeRe.test('BTC'));
assert.strictEqual(C.multOf('ID'), 100);
assert.strictEqual(C.multOf('US'), 1);
assert.strictEqual(C.pasarOf({}), 'ID');

console.log('Semua tes perhitungan lulus.');
