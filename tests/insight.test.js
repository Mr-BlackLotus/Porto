const assert = require('assert');
const I = require('../js/insight.js');
const trx = [
  { jenis: 'BELI', tanggal: '2026-01-05', harga: 8000 },
  { jenis: 'JUAL', tanggal: '2026-03-10', harga: 10000 },
  { jenis: 'JUAL', tanggal: '2026-06-01', harga: 9000 }
];
let r = I.rebuyInsight(trx, 8000, 8500);
assert.strictEqual(r.lastSell.harga, 9000);
assert.ok(Math.abs(r.diffPct - (-11.111)) < 0.01);
assert.strictEqual(r.tone, 'good');
assert.ok(Math.abs(r.vsAvgPct - (-5.882)) < 0.01);
assert.strictEqual(I.rebuyInsight(trx, 9100, 0).tone, 'neutral');
assert.strictEqual(I.rebuyInsight(trx, 9500, 0).tone, 'warn');
assert.strictEqual(I.rebuyInsight([{ jenis: 'BELI', harga: 1, tanggal: '2026-01-01' }], 5, 1), null);
assert.strictEqual(I.rebuyInsight(trx, 0, 0), null);

// dividen: Maret dan September tiap tahun (2024, 2025), hari ini 2026-01-20
const dv = [
  { tanggal: '2024-03-12', dps: 100, jumlah: 1000 }, { tanggal: '2024-09-10', dps: 80, jumlah: 800 },
  { tanggal: '2025-03-14', dps: 120, jumlah: 1200 }, { tanggal: '2025-09-12', dps: 90, jumlah: 900 }
];
let o = I.dividendOutlook(dv, '2026-01-20');
assert.strictEqual(o.count, 4);
assert.strictEqual(o.months[0].month, 3);
assert.strictEqual(o.months[0].nextDate, '2026-03-13');
assert.strictEqual(o.months[0].routine, true);
assert.strictEqual(o.upcoming.length, 1, 'hanya Maret dalam 90 hari');
assert.strictEqual(o.upcoming[0].month, 3);
assert.strictEqual(o.upcoming[0].avgDps, 110);
assert.strictEqual(o.last12Dps, 210, 'dividen 12 bulan terakhir (Mar25 dan Sep25)');
// bulan sudah lewat tahun ini -> tahun depan
o = I.dividendOutlook(dv, '2026-04-01');
assert.strictEqual(o.months[0].month, 9); assert.strictEqual(o.months[0].nextDate, '2026-09-11');
assert.strictEqual(o.upcoming.length, 0);
assert.strictEqual(I.dividendOutlook([], '2026-01-01').count, 0);
assert.strictEqual(I.dividendOutlook([{ tanggal: 'x' }], '2026-01-01').count, 0);
console.log('Semua tes insight lulus.');
