// Jalankan: node tests/calc.test.js
const assert = require('assert');
const C = require('../js/calc.js');

const near = (a, b, msg) => assert(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);

const trx = [
  { id: 't1', tanggal: '2026-01-10', kode: 'bbca', jenis: 'BELI', lot: 10, harga: 9000, fee: 13500 },
  { id: 't2', tanggal: '2026-02-05', kode: 'BBCA', jenis: 'JUAL', lot: 5, harga: 10000, fee: 12500 },
  { id: 't3', tanggal: '2026-02-20', kode: 'TLKM', jenis: 'BELI', lot: 20, harga: 3000, fee: 9000 },
  { id: 't4', tanggal: '2026-04-02', kode: 'TLKM', jenis: 'JUAL', lot: 20, harga: 2800, fee: 14000 }
];
const divs = [
  { id: 'd1', tanggal: '2026-03-15', kode: 'BBCA', jumlah: 450000 },
  { id: 'd2', tanggal: '2026-04-20', kode: 'TLKM', jumlah: 100000 }
];

const L = C.buildLedger(trx);

// BBCA: beli 1000 lembar, biaya 9.013.500 -> rata-rata 9.013,5
// Jual 500 @10.000 fee 12.500 -> hasil 4.987.500, modal terjual 4.506.750, profit 480.750
near(L.perTrx.t2, 480750, 'profit jual BBCA');
near(L.positions.BBCA.shares, 500, 'sisa lembar BBCA');
near(L.positions.BBCA.cost, 4506750, 'sisa modal BBCA');

// TLKM: beli 2000 lembar, biaya 6.009.000. Jual semua @2.800 fee 14.000 -> hasil 5.586.000, rugi 423.000
near(L.perTrx.t4, 5586000 - 6009000, 'rugi jual TLKM');
assert.strictEqual(L.positions.TLKM.shares, 0);
assert.strictEqual(L.open.length, 1);
assert.strictEqual(L.warnings.length, 0);

// Bulanan: Jan 0, Feb +480.750, Mar +450.000 (dividen), Apr -423.000 + 100.000, lalu diisi sampai bulan sekarang
const M = C.monthly(trx, L, divs, '2026-05-09');
assert.deepStrictEqual(M.map(m => m.month), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05']);
near(M[1].total, 480750, 'Feb');
near(M[2].total, 450000, 'Mar');
near(M[3].total, -323000, 'Apr');
near(M[4].total, 0, 'Mei kosong');
near(M[4].cumulative, 480750 + 450000 - 323000, 'kumulatif');

// Ringkasan dengan harga: BBCA 500 lembar @9.500 -> nilai 4.750.000, belum terealisasi +243.250
const S = C.summarize(L, divs, k => (k === 'BBCA' ? { price: 9500, prev: 9400, source: 'live' } : null));
near(S.value, 4750000, 'nilai');
near(S.unrealized, 4750000 - 4506750, 'belum terealisasi');
near(S.realized, 480750 - 423000, 'terealisasi');
near(S.dividend, 550000, 'dividen');
near(S.totalReturn, S.realized + S.unrealized + S.dividend, 'total');
near(S.dayChange, 500 * 100, 'perubahan harian');

// Tanpa harga: dinilai pada harga rata-rata, tanpa profit semu
const S2 = C.summarize(L, divs, () => null);
near(S2.unrealized, 0, 'tanpa harga');
assert.deepStrictEqual(S2.missingPrices, ['BBCA']);

// Jual melebihi kepemilikan harus memberi peringatan
const bad = C.buildLedger([
  { id: 'a', tanggal: '2026-01-01', kode: 'ANTM', jenis: 'BELI', lot: 1, harga: 1500, fee: 0 },
  { id: 'b', tanggal: '2026-01-02', kode: 'ANTM', jenis: 'JUAL', lot: 3, harga: 1600, fee: 0 }
]);
assert.strictEqual(bad.warnings.length, 1);
assert.strictEqual(bad.warnings[0].id, 'b');
assert.strictEqual(bad.positions.ANTM.shares, 0);

// Beli dan jual di hari yang sama: BELI diproses lebih dulu
const same = C.buildLedger([
  { id: 'x', tanggal: '2026-03-01', kode: 'GOTO', jenis: 'JUAL', lot: 1, harga: 100, fee: 0 },
  { id: 'y', tanggal: '2026-03-01', kode: 'GOTO', jenis: 'BELI', lot: 1, harga: 90, fee: 0 }
]);
assert.strictEqual(same.warnings.length, 0);
near(same.perTrx.x, 1000, 'hari sama');

// Fee otomatis
assert.strictEqual(C.estimateFee('BELI', 10, 9000, 0.15, 0.25), 13500);
assert.strictEqual(C.estimateFee('JUAL', 5, 10000, 0.15, 0.25), 12500);

console.log('Semua tes perhitungan lulus.');
