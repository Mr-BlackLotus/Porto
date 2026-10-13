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

  // ------------------------------------------------------------------ dividen resmi
  function addDays(ms, n) { return ms + n * 86400000; }
  function pctDiff(a, b) { return b > 0 ? (a - b) / b * 100 : null; }

  /**
   * rec: { items:[{cum,ex,pay,dps,jenis}], planned:[{periode,note}] } (js/dividends.js).
   * ctx: { price, shares, avg, lastSell, high52, low52, pe, eps }. today: 'YYYY-MM-DD'.
   */
  function dividendPlan(rec, today, ctx) {
    var t = parts(today);
    if (!rec || !t) return null;
    ctx = ctx || {};
    var tMs = utc(t.y, t.m, t.d);
    var items = (rec.items || []).map(function (x) {
      var p = parts(x.cum);
      return p ? { cum: day(x.cum), ex: day(x.ex), pay: day(x.pay), dps: num(x.dps), jenis: x.jenis || '', ms: utc(p.y, p.m, p.d), month: p.m, d: p.d, y: p.y } : null;
    }).filter(Boolean).sort(function (a, b) { return a.ms - b.ms; });
    if (!items.length) return null;
    var past = items.filter(function (x) { return x.ms <= tMs; });
    var future = items.filter(function (x) { return x.ms > tMs; });
    var last = past.length ? past[past.length - 1] : null;

    var trailing = past.filter(function (x) { return x.ms > addDays(tMs, -365); });
    var trailDps = trailing.reduce(function (s, x) { return s + x.dps; }, 0);
    var price = num(ctx.price);

    // jadwal berikutnya: resmi > rencana > perkiraan dari pola 24 bulan terakhir
    var next = null;
    if (future.length) {
      var f = future[0];
      next = { kind: 'resmi', cum: f.cum, pay: f.pay, month: f.month, dps: f.dps, daysAway: daysBetween(tMs, f.ms) };
    } else {
      var thisPeriod = t.y * 100 + t.m;
      var plan = (rec.planned || []).filter(function (x) { var q = /^(\d{4})-(\d{2})$/.exec(x.periode || ''); return q && (+q[1] * 100 + +q[2]) >= thisPeriod; })
        .sort(function (a, b) { return a.periode < b.periode ? -1 : 1; })[0];
      if (plan) {
        var q = /^(\d{4})-(\d{2})$/.exec(plan.periode);
        var end = utc(+q[1], +q[2] + 1, 0 + 1) - 86400000; // akhir bulan rencana
        next = { kind: 'rencana', cum: null, month: +q[2], dps: null, note: plan.note, daysAway: Math.max(0, daysBetween(tMs, end)), endMs: end,
          refDps: last ? last.dps : null };
      } else {
        var recent = past.filter(function (x) { return x.ms > addDays(tMs, -730); });
        var best = null;
        recent.forEach(function (x) {
          var y = t.y, ms = utc(y, x.month, Math.min(x.d, 28));
          while (ms <= tMs) { y += 1; ms = utc(y, x.month, Math.min(x.d, 28)); }
          if (!best || ms < best.ms) best = { ms: ms, month: x.month, dps: x.dps };
        });
        if (best) next = { kind: 'perkiraan', cum: ymdOf(best.ms), month: best.month, dps: best.dps, daysAway: daysBetween(tMs, best.ms) };
      }
    }

    // jendela beli: 3 bulan sebelum cum date (atau akhir bulan rencana)
    var window = null;
    if (next) {
      var endMs = next.kind === 'rencana' ? next.endMs : (function () { var p = parts(next.cum); return utc(p.y, p.m, p.d); }());
      var startMs = addDays(endMs, -90);
      window = { from: ymdOf(startMs), to: ymdOf(endMs), fromMonth: new Date(startMs).getUTCMonth() + 1, toMonth: new Date(endMs).getUTCMonth() + 1,
        state: tMs > endMs ? 'passed' : tMs >= startMs ? 'inside' : 'upcoming', daysToStart: Math.max(0, daysBetween(tMs, startMs)) };
    }

    var refDps = next ? (next.dps != null ? next.dps : next.refDps) : null;
    var plan2 = {
      last: last, upcoming: future, next: next, window: window,
      trailing: { dps: trailDps, count: trailing.length },
      yieldTrailing: price > 0 ? trailDps / price * 100 : null,
      yieldOnCost: num(ctx.avg) > 0 ? trailDps / num(ctx.avg) * 100 : null,
      yieldIfHigh: num(ctx.high52) > 0 ? trailDps / num(ctx.high52) * 100 : null,
      nextYield: price > 0 && refDps ? refDps / price * 100 : null,
      estAmount: refDps && num(ctx.shares) > 0 ? refDps * num(ctx.shares) : null,
      pattern: past.filter(function (x) { return x.ms > addDays(tMs, -730); }).map(function (x) { return { month: x.month, dps: x.dps, jenis: x.jenis, cum: x.cum }; })
    };
    plan2.decision = decide(plan2, ctx, tMs);
    return plan2;
  }

  /** Penilaian ringkas dari tiga sinyal: jendela beli, posisi di rentang 52 minggu, dan harga jual terakhir. */
  function decide(plan, ctx, tMs) {
    var price = num(ctx.price), score = 0, reasons = [];
    var inWin = plan.window && plan.window.state === 'inside';
    if (inWin) { score += 1; reasons.push('masuk jendela 3 bulan sebelum pembagian dividen'); }
    else if (plan.window && plan.window.state === 'upcoming') reasons.push('jendela beli dividen belum dimulai');
    var h = num(ctx.high52), l = num(ctx.low52);
    var fromHigh = h > 0 ? pctDiff(price, h) : null;
    var rangePos = h > l && l > 0 ? (price - l) / (h - l) : null;
    if (fromHigh != null) {
      if (fromHigh <= -10) { score += 1; reasons.push('harga ' + Math.abs(Math.round(fromHigh * 10) / 10).toString().replace('.', ',') + '% di bawah tertinggi 52 minggu'); }
      else if (fromHigh >= -3) { score -= 1; reasons.push('harga dekat tertinggi 52 minggu'); }
    }
    var ls = ctx.lastSell > 0 ? pctDiff(price, ctx.lastSell) : null;
    if (ls != null) {
      if (ls <= -3) { score += 1; reasons.push('lebih murah dari harga jual terakhir Anda'); }
      else if (ls >= 10) { score -= 1; reasons.push('sudah naik jauh dari harga jual terakhir Anda'); }
    }
    var verdict = score >= 2 ? 'layak' : score <= -1 ? 'tunggu' : 'netral';
    return { verdict: verdict, score: score, reasons: reasons, fromHigh: fromHigh, rangePos: rangePos, vsLastSell: ls };
  }

  /** Ringkasan valuasi dari data Google Finance (bisa tidak lengkap untuk sebagian emiten). */
  function valuation(ctx, dividendYieldPct) {
    var price = num(ctx.price), out = {};
    if (num(ctx.high52) > 0 && num(ctx.low52) > 0) {
      out.range = { high: num(ctx.high52), low: num(ctx.low52), fromHigh: pctDiff(price, num(ctx.high52)), fromLow: pctDiff(price, num(ctx.low52)) };
    }
    if (num(ctx.pe) > 0) {
      out.pe = num(ctx.pe);
      out.peLabel = out.pe >= 25 ? 'tinggi' : out.pe <= 10 ? 'rendah' : 'menengah';
    }
    if (num(ctx.eps) > 0 && price > 0) out.earningsYield = num(ctx.eps) / price * 100;
    if (dividendYieldPct != null) out.dividendYield = dividendYieldPct;
    return Object.keys(out).length ? out : null;
  }

  return { rebuyInsight: rebuyInsight, dividendOutlook: dividendOutlook, dividendPlan: dividendPlan, valuation: valuation };
}));
