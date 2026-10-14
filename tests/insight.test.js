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

// ---- dividen resmi ----
{
  const rec = {
    items: [
      { cum: '2025-03-20', pay: '2025-04-11', dps: 250, jenis: 'Final' },
      { cum: '2025-12-02', pay: '2025-12-22', dps: 55, jenis: 'Interim' },
      { cum: '2026-03-27', pay: '2026-04-08', dps: 281, jenis: 'Final' },
      { cum: '2026-08-28', pay: '2026-09-16', dps: 25, jenis: 'Interim' }
    ],
    planned: [{ periode: '2026-12', note: 'Desember' }]
  };
  let p = I.dividendPlan(rec, '2026-10-13', { price: 9000, shares: 1000, avg: 9000, lastSell: 10000, high52: 10500, low52: 7500 });
  assert.strictEqual(p.last.cum, '2026-08-28');
  assert.strictEqual(p.trailing.dps, 55 + 281 + 25, 'dividen 12 bulan terakhir (cum setelah 2025-10-13)');
  assert.ok(Math.abs(p.yieldTrailing - 361 / 9000 * 100) < 1e-9);
  assert.strictEqual(p.next.kind, 'rencana'); assert.strictEqual(p.next.month, 12);
  assert.strictEqual(p.window.state, 'inside'); assert.strictEqual(p.window.fromMonth, 10); assert.strictEqual(p.window.toMonth, 12);
  assert.strictEqual(p.decision.verdict, 'layak');
  assert.strictEqual(p.estAmount, 25 * 1000, 'perkiraan memakai dividen terakhir sebagai acuan');
  // harga dekat tertinggi 52 minggu dan sudah jauh di atas harga jual terakhir => tunggu
  p = I.dividendPlan(rec, '2026-10-13', { price: 10450, shares: 1000, lastSell: 9000, high52: 10500, low52: 7500 });
  assert.strictEqual(p.decision.verdict, 'tunggu');
  // jadwal resmi di depan
  const rec2 = { items: rec.items.concat([{ cum: '2026-12-03', pay: '2026-12-22', dps: 60, jenis: 'Interim' }]) };
  p = I.dividendPlan(rec2, '2026-10-13', { price: 9000 });
  assert.strictEqual(p.next.kind, 'resmi'); assert.strictEqual(p.next.dps, 60); assert.strictEqual(p.next.cum, '2026-12-03');
  assert.strictEqual(p.window.from, '2026-09-04');
  // tanpa rencana dan tanpa jadwal resmi => perkiraan dari pola
  p = I.dividendPlan({ items: rec.items }, '2026-10-13', { price: 9000 });
  assert.strictEqual(p.next.kind, 'perkiraan'); assert.strictEqual(p.next.month, 12);
  assert.strictEqual(I.dividendPlan(null, '2026-10-13', {}), null);
  // valuasi
  const v = I.valuation({ price: 9000, high52: 10000, low52: 8000, pe: 30, eps: 300 }, 4);
  assert.strictEqual(v.peLabel, 'tinggi'); assert.ok(Math.abs(v.range.fromHigh + 10) < 1e-9); assert.ok(Math.abs(v.earningsYield - 3.3333) < 0.001);
  assert.strictEqual(I.valuation({ price: 1 }, null), null);
  console.log('Semua tes dividen resmi lulus.');
}

// ---- analisis ----
{
  global.window = {};
  eval(require('fs').readFileSync(__dirname + '/../js/analisa.js', 'utf8'));
  const a = global.window.PORTO_ANALISA['ID:BBCA'];
  assert.ok(a.rekomendasi.keseluruhan.label && a.sumber === undefined);
  ['value', 'dividen', 'trader'].forEach(k => assert.ok(a.rekomendasi[k].alasan.length >= 2, k));
  a.berita.forEach(b => assert.ok(/^https:\/\//.test(b.u) && /^\d{4}-\d{2}-\d{2}$/.test(b.tgl)));
  const m = I.analysisMetrics(a, 6000, '2026-10-13');
  assert.strictEqual(m.ageDays, 0); assert.strictEqual(m.stale, false);
  assert.ok(Math.abs(m.perFwd - 6000 / 489) < 1e-9);
  assert.strictEqual(m.scenarios.length, 3);
  assert.ok(Math.abs(m.scenarios[1].value - 489 * 16.7) < 1e-6);
  assert.ok(m.scenarios[1].mos > 30 && m.scenarios[1].mos < 40, 'upside ke 8.165 dari 6.000');
  assert.strictEqual(m.moved, false);
  assert.strictEqual(I.analysisMetrics(a, 5000, '2026-11-20').stale, true);
  assert.strictEqual(I.analysisMetrics(a, 5000, '2026-11-20').moved, true, 'harga turun lebih dari 10% dari rujukan');
  assert.strictEqual(I.analysisMetrics(null, 1, '2026-01-01'), null);
  console.log('Semua tes analisis lulus.');
}

// ---- ringkasan otomatis ----
{
  const T = '2026-10-14';
  // dividen: triwulanan, 4 kali dalam 12 bulan
  const recs = [
    { date: '2024-11-20', dps: 50 }, { date: '2025-03-20', dps: 250 }, { date: '2025-12-02', dps: 55 },
    { date: '2026-03-27', dps: 281 }, { date: '2026-06-15', dps: 20 }, { date: '2026-08-28', dps: 25 }, { date: '2026-12-10', dps: 30 }
  ];
  const d = I.dividendSummary(recs, T, 6000);
  assert.strictEqual(d.last.dps, 25); assert.strictEqual(d.last.date, '2026-08-28');
  assert.ok(Math.abs(d.lastYield - 25 / 6000 * 100) < 1e-9);
  assert.strictEqual(d.trailing.count, 4); assert.strictEqual(d.trailing.dps, 55 + 281 + 20 + 25);
  assert.ok(Math.abs(d.annualYield - 381 / 6000 * 100) < 1e-9);
  assert.strictEqual(d.frequency.count, 4); assert.ok(/triwulanan/.test(d.frequency.label));
  assert.deepStrictEqual(d.months, [3, 6, 8, 11, 12], 'bulan 12 masa depan tidak dihitung; 2 tahun terakhir');
  // sekali setahun
  const once = I.dividendSummary([{ date: '2025-06-10', dps: 100 }, { date: '2026-06-09', dps: 120 }], T, 2000);
  assert.strictEqual(once.frequency.label, 'sekali setahun'); assert.deepStrictEqual(once.months, [6]);
  assert.ok(Math.abs(once.annualYield - 6) < 1e-9);
  // dua kali
  assert.strictEqual(I.dividendSummary([{ date: '2025-11-01', dps: 10 }, { date: '2026-05-01', dps: 10 }], T, 1000).frequency.label, 'dua kali setahun');
  // tanpa data / tanpa dps
  assert.strictEqual(I.dividendSummary([], T, 100).count, 0);
  assert.strictEqual(I.dividendSummary([{ date: '2026-01-01', dps: 0 }], T, 100).hadRecordsWithoutDps, true);
  // dividen terakhir sudah lebih dari 12 bulan: frekuensi dari tahun sebelumnya, total 12 bulan = 0
  const old = I.dividendSummary([{ date: '2025-01-10', dps: 5 }], T, 100);
  assert.strictEqual(old.trailing.dps, 0); assert.strictEqual(old.annualYield, null); assert.strictEqual(old.frequency.fromOlder, true);

  // valuasi
  let vv = I.valuationVerdict({ price: 100, pe: 8, high52: 150, low52: 95 }, null, 6);
  assert.strictEqual(vv.label, 'Murah');
  vv = I.valuationVerdict({ price: 100, pe: 35, high52: 105, low52: 60 }, null, null);
  assert.strictEqual(vv.label, 'Mahal');
  vv = I.valuationVerdict({ price: 100, pe: 15, high52: 150, low52: 60 }, null, null);
  assert.strictEqual(vv.label, 'Wajar'); assert.strictEqual(vv.confidence, 'terbatas');
  assert.strictEqual(I.valuationVerdict({ price: 100 }, null, null), null);
  assert.strictEqual(I.valuationVerdict({ price: 0, pe: 5 }, null, null), null);
  // dengan skenario nilai wajar (BBCA)
  global.window = {}; eval(require('fs').readFileSync(__dirname + '/../js/analisa.js', 'utf8'));
  const a = global.window.PORTO_ANALISA['ID:BBCA'];
  const am = I.analysisMetrics(a, 6225, T);
  vv = I.valuationVerdict({ price: 6225 }, am, 6.1);
  assert.strictEqual(vv.label, 'Murah'); assert.ok(vv.reasons.some(r => /PER ke depan/.test(r)));
  vv = I.valuationVerdict({ price: 12000 }, I.analysisMetrics(a, 12000, T), 3);
  assert.strictEqual(vv.label, 'Mahal');

  // pertumbuhan
  let g = I.growthVerdict(125, 100, null);
  assert.strictEqual(g.price.label, 'Bagus'); assert.strictEqual(g.fundamental, null);
  assert.strictEqual(I.growthVerdict(80, 100, null).price.label, 'Buruk');
  assert.strictEqual(I.growthVerdict(103, 100, null).price.label, 'Datar');
  g = I.growthVerdict(6225, 8500, a.pertumbuhan);
  assert.strictEqual(g.fundamental.label, 'Lemah'); assert.strictEqual(g.price.label, 'Buruk');
  assert.strictEqual(I.growthVerdict(1, 0, null), null);
  assert.strictEqual(I.growthVerdict(1, 1, { laba: -5 }).fundamental.label, 'Buruk');
  assert.strictEqual(I.growthVerdict(1, 1, { laba: 25 }).fundamental.label, 'Bagus');

  // analisa otomatis
  const dsum = I.dividendSummary(recs, T, 6225);
  const gv = I.growthVerdict(6225, 8500, a.pertumbuhan);
  const vv2 = I.valuationVerdict({ price: 6225 }, am, dsum.annualYield);
  let au = I.autoAnalysis({ valuation: vv2, dividend: dsum, growth: gv, rangePos: 0.1, vsAvgPct: -5 });
  assert.strictEqual(au.value.tone, 'good'); assert.strictEqual(au.dividen.label, 'Menarik');
  assert.strictEqual(au.trader.label, 'Tren turun, tunggu konfirmasi');
  assert.strictEqual(au.overall.label, 'Akumulasi bertahap'); // 2 + 1 - 1 = 2
  au = I.autoAnalysis({ valuation: I.valuationVerdict({ price: 100, pe: 40 }, null, null), dividend: { count: 0 }, growth: null, rangePos: 0.95 });
  assert.strictEqual(au.overall.tone, 'warn'); assert.strictEqual(au.trader.label, 'Dekat puncak, tunggu koreksi');
  au = I.autoAnalysis({ valuation: null, dividend: null, growth: null, rangePos: null });
  assert.strictEqual(au.overall.label, 'Data belum cukup');
  au = I.autoAnalysis({ valuation: I.valuationVerdict({ price: 100, pe: 8 }, null, 7), dividend: I.dividendSummary([{ date: '2026-03-01', dps: 8 }], T, 100), growth: I.growthVerdict(130, 100, null), rangePos: 0.5 });
  assert.strictEqual(au.overall.label, 'Akumulasi bertahap'); assert.strictEqual(au.dividen.label, 'Menarik');
  console.log('Semua tes ringkasan otomatis lulus.');
}
