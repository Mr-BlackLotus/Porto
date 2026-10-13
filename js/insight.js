/*
 * Porto — info otomatis per emiten (berbasis aturan sederhana dari catatan Anda sendiri, bukan AI dan bukan saran investasi).
 *  - rebuyInsight: selisih harga sekarang terhadap harga jual terakhir dan harga rata-rata.
 *  - dividendOutlook: pola bulan pembagian dividen dari riwayat dividen yang Anda catat.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Insight = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function day(s) { return String(s || '').slice(0, 10); }
  function parts(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day(s));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function utc(y, m, d) { return Date.UTC(y, m - 1, d); }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function ymdOf(ms) { return new Date(ms).toISOString().slice(0, 10); }

  /** trx: transaksi satu emiten. price: harga sekarang. avg: harga rata-rata bila masih memegang (atau 0). */
  function rebuyInsight(trx, price, avg) {
    price = num(price);
    var sells = (trx || []).filter(function (t) { return t.jenis === 'JUAL' && num(t.harga) > 0; })
      .sort(function (a, b) { return day(a.tanggal) < day(b.tanggal) ? -1 : day(a.tanggal) > day(b.tanggal) ? 1 : 0; });
    if (!sells.length || !(price > 0)) return null;
    var last = sells[sells.length - 1];
    var diff = (price - num(last.harga)) / num(last.harga) * 100;
    var tone, msg;
    if (diff <= -10) { tone = 'good'; msg = 'jauh lebih murah dari harga jual terakhir. Bisa jadi peluang beli lagi; periksa dulu kondisi emitennya.'; }
    else if (diff <= -3) { tone = 'good'; msg = 'lebih murah dari harga jual terakhir. Membeli lagi sekarang berarti masuk lebih rendah dari saat Anda keluar.'; }
    else if (diff < 3) { tone = 'neutral'; msg = 'hampir sama dengan harga jual terakhir. Belum ada keuntungan harga dari membeli lagi.'; }
    else if (diff < 10) { tone = 'warn'; msg = 'lebih mahal dari harga jual terakhir. Membeli lagi sekarang berarti masuk lebih tinggi dari saat Anda keluar.'; }
    else { tone = 'warn'; msg = 'sudah naik cukup jauh dari harga jual terakhir. Bila ingin masuk lagi, pertimbangkan menunggu koreksi.'; }
    var vsAvg = num(avg) > 0 ? (price - avg) / avg * 100 : null;
    return { lastSell: { tanggal: day(last.tanggal), harga: num(last.harga) }, price: price, diffPct: diff, tone: tone, message: msg, vsAvgPct: vsAvg };
  }

  /**
   * divs: catatan dividen satu emiten ({tanggal, dps, jumlah}). today: 'YYYY-MM-DD'.
   * Mengembalikan pola bulan pembagian dan jadwal perkiraan dalam windowDays ke depan.
   */
  function dividendOutlook(divs, today, windowDays) {
    windowDays = windowDays || 90;
    var t = parts(today);
    if (!t) return { count: 0 };
    var tMs = utc(t.y, t.m, t.d);
    var recs = (divs || []).map(function (x) {
      var p = parts(x.tanggal);
      return p ? { y: p.y, m: p.m, d: p.d, ms: utc(p.y, p.m, p.d), amount: num(x.jumlah), dps: num(x.dps) } : null;
    }).filter(Boolean).sort(function (a, b) { return a.ms - b.ms; });
    if (!recs.length) return { count: 0 };

    var byMonth = {};
    recs.forEach(function (r) {
      var g = byMonth[r.m] || (byMonth[r.m] = { month: r.m, years: [], days: [], amounts: [], dps: [] });
      if (g.years.indexOf(r.y) < 0) g.years.push(r.y);
      g.days.push(r.d); g.amounts.push(r.amount); if (r.dps > 0) g.dps.push(r.dps);
    });
    function avg(a) { return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : 0; }
    var months = Object.keys(byMonth).map(function (k) {
      var g = byMonth[k];
      var avgDay = Math.max(1, Math.min(28, Math.round(avg(g.days))));
      var y = t.y, ms = utc(y, g.month, avgDay);
      if (ms < tMs) { y += 1; ms = utc(y, g.month, avgDay); }
      return {
        month: g.month, years: g.years.sort(), times: g.days.length, avgDay: avgDay,
        avgAmount: avg(g.amounts), avgDps: avg(g.dps),
        nextDate: ymdOf(ms), daysAway: daysBetween(tMs, ms), routine: g.years.length >= 2
      };
    }).sort(function (a, b) { return a.daysAway - b.daysAway; });

    var yearAgo = tMs - 365 * 86400000;
    var last12 = recs.filter(function (r) { return r.ms > yearAgo && r.ms <= tMs; });
    return {
      count: recs.length,
      first: ymdOf(recs[0].ms),
      last: ymdOf(recs[recs.length - 1].ms),
      lastAmount: recs[recs.length - 1].amount,
      months: months,
      upcoming: months.filter(function (m) { return m.daysAway <= windowDays; }),
      last12Dps: last12.reduce(function (s, r) { return s + r.dps; }, 0),
      last12Amount: last12.reduce(function (s, r) { return s + r.amount; }, 0),
      windowDays: windowDays
    };
  }

  return { rebuyInsight: rebuyInsight, dividendOutlook: dividendOutlook };
}));
