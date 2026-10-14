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

  /** Hitung ulang angka analisis dengan harga sekarang. a: entri js/analisa.js. */
  function analysisMetrics(a, price, today) {
    if (!a) return null;
    price = num(price);
    var t = parts(today), d = parts(a.tanggal);
    var age = t && d ? daysBetween(utc(d.y, d.m, d.d), utc(t.y, t.m, t.d)) : null;
    var eps = a.input && num(a.input.eps) > 0 ? num(a.input.eps) : 0;
    var out = { ageDays: age, stale: age != null && age > 14, eps: eps };
    if (a.hargaRujukan && num(a.hargaRujukan.nilai) > 0 && price > 0) {
      out.moveSince = pctDiff(price, num(a.hargaRujukan.nilai));
      out.moved = Math.abs(out.moveSince) >= 10;
    }
    if (eps > 0 && price > 0) {
      out.perFwd = price / eps;
      out.earningsYield = eps / price * 100;
      out.scenarios = ((a.input.kelipatan) || []).map(function (k) {
        var v = eps * num(k.per);
        return { label: k.label, per: num(k.per), ket: k.ket || '', value: v, mos: pctDiff(v, price) };
      });
    }
    return out;
  }


  // ------------------------------------------------------------------ ringkasan otomatis (dividen, valuasi, pertumbuhan)
  function round1(v) { return Math.round(v * 10) / 10; }

  /**
   * recs: [{date:'YYYY-MM-DD', dps, jenis?}] dari data resmi atau catatan Anda. today: 'YYYY-MM-DD'. price: harga sekarang.
   * Mengembalikan dividen terakhir (jumlah dan % dari harga sekarang), total 12 bulan, frekuensi dan bulan pembagian.
   */
  function dividendSummary(recs, today, price) {
    var t = parts(today);
    if (!t) return null;
    var tMs = utc(t.y, t.m, t.d), pr = num(price);
    var list = (recs || []).map(function (x) {
      var p = parts(x.date);
      return p && num(x.dps) > 0 ? { ms: utc(p.y, p.m, p.d), date: day(x.date), dps: num(x.dps), month: p.m, jenis: x.jenis || '' } : null;
    }).filter(Boolean).sort(function (a, b) { return a.ms - b.ms; });
    var past = list.filter(function (x) { return x.ms <= tMs; });
    if (!past.length) return { count: 0, hadRecordsWithoutDps: (recs || []).length > 0 && !list.length };
    var last = past[past.length - 1];
    var yr = 365 * 86400000;
    var win1 = past.filter(function (x) { return x.ms > tMs - yr; });
    var win2 = past.filter(function (x) { return x.ms > tMs - 2 * yr && x.ms <= tMs - yr; });
    var basis = win1.length ? win1 : win2;
    var n = basis.length;
    var label = n === 1 ? 'sekali setahun' : n === 2 ? 'dua kali setahun' : n === 4 ? 'empat kali setahun (triwulanan)' : n + ' kali setahun';
    var trailDps = win1.reduce(function (s, x) { return s + x.dps; }, 0);
    var seen = {}, months = [];
    past.filter(function (x) { return x.ms > tMs - 2 * yr; }).forEach(function (x) { if (!seen[x.month]) { seen[x.month] = 1; months.push(x.month); } });
    months.sort(function (a, b) { return a - b; });
    return {
      count: past.length,
      last: { date: last.date, dps: last.dps, jenis: last.jenis },
      lastYield: pr > 0 ? last.dps / pr * 100 : null,
      trailing: { dps: trailDps, count: win1.length },
      annualYield: pr > 0 && trailDps > 0 ? trailDps / pr * 100 : null,
      frequency: { count: n, label: label, fromOlder: !win1.length },
      months: months
    };
  }

  /**
   * Menilai murah / wajar / mahal dari sinyal yang tersedia. ctx: { price, pe, high52, low52 }.
   * am: hasil analysisMetrics (opsional, memberi PER ke depan dan nilai wajar). divYield: imbal dividen setahun (%) atau null.
   */
  function valuationVerdict(ctx, am, divYield) {
    var price = num(ctx.price), score = 0, reasons = [], signals = 0;
    if (!(price > 0)) return null;
    var per = null, perSrc = '';
    if (am && am.perFwd > 0) { per = am.perFwd; perSrc = 'PER ke depan'; }
    else if (num(ctx.pe) > 0) { per = num(ctx.pe); perSrc = 'PER'; }
    if (per) {
      signals++;
      var ptxt = perSrc + ' ' + String(round1(per)).replace('.', ',') + 'x';
      if (per < 12) { score += 1; reasons.push(ptxt + ', tergolong rendah'); }
      else if (per <= 20) reasons.push(ptxt + ', menengah');
      else if (per <= 30) { score -= 1; reasons.push(ptxt + ', agak tinggi'); }
      else { score -= 2; reasons.push(ptxt + ', tinggi'); }
    }
    if (am && am.scenarios && am.scenarios.length) {
      signals++;
      var avg = am.scenarios.reduce(function (s, x) { return s + x.mos; }, 0) / am.scenarios.length;
      if (avg >= 15) { score += 1; reasons.push('harga ' + String(Math.round(avg)).replace('.', ',') + '% di bawah rata-rata nilai wajar skenario'); }
      else if (avg <= -15) { score -= 1; reasons.push('harga ' + String(Math.round(Math.abs(avg))) + '% di atas rata-rata nilai wajar skenario'); }
      else reasons.push('harga dekat rata-rata nilai wajar skenario');
    }
    var h = num(ctx.high52), l = num(ctx.low52);
    var rangePos = h > l && l > 0 ? (price - l) / (h - l) : null;
    if (rangePos != null) {
      signals++;
      if (rangePos <= 0.25) { score += 0.5; reasons.push('harga di seperempat bawah rentang 52 minggu'); }
      else if (rangePos >= 0.85) { score -= 0.5; reasons.push('harga di dekat tertinggi 52 minggu'); }
      else reasons.push('harga di tengah rentang 52 minggu');
    }
    if (divYield != null && divYield > 0) {
      signals++;
      if (divYield >= 5) { score += 0.5; reasons.push('imbal dividen ' + String(round1(divYield)).replace('.', ',') + '% tergolong tinggi'); }
    }
    if (!signals) return null;
    var label = score >= 1 ? 'Murah' : score <= -1 ? 'Mahal' : 'Wajar';
    return { label: label, tone: label === 'Murah' ? 'good' : label === 'Mahal' ? 'warn' : 'neutral', score: score, reasons: reasons,
      confidence: signals >= 3 ? 'cukup' : signals === 2 ? 'terbatas' : 'rendah', rangePos: rangePos };
  }

  /**
   * Pertumbuhan 12 bulan. fund: { laba: persen, pendapatan?: persen, periode, ket } (dari js/analisa.js, opsional).
   * Pertumbuhan harga memakai harga setahun lalu dari Google Finance atau Binance.
   */
  function growthVerdict(price, price1y, fund) {
    var out = { price: null, fundamental: null };
    price = num(price); price1y = num(price1y);
    if (price > 0 && price1y > 0) {
      var g = pctDiff(price, price1y);
      var lb = g >= 10 ? 'Bagus' : g <= -10 ? 'Buruk' : 'Datar';
      out.price = { pct: g, label: lb, tone: lb === 'Bagus' ? 'good' : lb === 'Buruk' ? 'warn' : 'neutral', from: price1y };
    }
    if (fund && isFinite(Number(fund.laba))) {
      var e = Number(fund.laba);
      var lf = e >= 10 ? 'Bagus' : e >= 3 ? 'Sedang' : e >= 0 ? 'Lemah' : 'Buruk';
      out.fundamental = { pct: e, label: lf, tone: lf === 'Bagus' ? 'good' : lf === 'Sedang' ? 'neutral' : 'warn', periode: fund.periode || '', pendapatan: fund.pendapatan, ket: fund.ket || '' };
    }
    return out.price || out.fundamental ? out : null;
  }

  /**
   * Nilai wajar kasar untuk emiten tanpa riset: EPS dikali PER patokan, dan dividen setahun dibagi target imbal hasil.
   * ctx: { price, eps, pe, dps }  (dps = total dividen 12 bulan terakhir per lembar). Hasilnya asumsi umum, bukan target analis.
   */
  function fairValue(ctx) {
    var price = num(ctx.price);
    if (!(price > 0)) return null;
    var eps = num(ctx.eps) > 0 ? num(ctx.eps) : (num(ctx.pe) > 0 ? price / num(ctx.pe) : 0);
    var rows = [];
    if (eps > 0) {
      [['Konservatif', 10], ['Wajar', 15], ['Optimis', 20]].forEach(function (x) {
        var v = eps * x[1];
        rows.push({ label: x[0], basis: 'PER ' + x[1] + 'x dari laba per lembar', value: v, mos: pctDiff(v, price) });
      });
    }
    var dps = num(ctx.dps);
    if (dps > 0 && dps / price >= 0.02) { // emiten berdividen kecil dinilai dari laba, bukan dividen
      [['Konservatif', 8], ['Wajar', 6], ['Optimis', 4]].forEach(function (x) {
        var v = dps / (x[1] / 100);
        rows.push({ label: x[0], basis: 'imbal dividen ' + x[1] + '% dari dividen setahun', value: v, mos: pctDiff(v, price) });
      });
    }
    return rows.length ? { eps: eps, dps: dps, rows: rows } : null;
  }

  /** Katalis (sinyal positif) dan risiko (sinyal negatif) yang bisa disimpulkan dari angka. */
  function signalLists(x) {
    var kat = [], ris = [];
    var vv = x.valuation, ds = x.dividend, gv = x.growth;
    if (vv) vv.reasons.forEach(function (r) {
      if (/rendah|di bawah rata-rata|seperempat bawah|tergolong tinggi/.test(r)) kat.push(r.charAt(0).toUpperCase() + r.slice(1) + '.');
      else if (/tinggi|di atas rata-rata|dekat tertinggi|agak tinggi/.test(r)) ris.push(r.charAt(0).toUpperCase() + r.slice(1) + '.');
    });
    if (ds && ds.count) {
      if (ds.annualYield >= 4) kat.push('Dividen rutin ' + ds.frequency.label + ' dengan imbal ' + String(round1(ds.annualYield)).replace('.', ',') + '% per tahun.');
      if (!ds.trailing.count) ris.push('Tidak ada dividen dalam 12 bulan terakhir.');
    } else if (x.isStock) ris.push('Belum ada data dividen, jadi tidak ada penopang dari dividen.');
    if (gv && gv.fundamental) {
      if (gv.fundamental.pct >= 10) kat.push('Laba tumbuh ' + String(round1(gv.fundamental.pct)).replace('.', ',') + '%.');
      else if (gv.fundamental.pct < 3) ris.push('Pertumbuhan laba lemah (' + String(round1(gv.fundamental.pct)).replace('.', ',') + '%).');
    }
    if (gv && gv.price) {
      if (gv.price.pct >= 10) kat.push('Harga naik ' + String(round1(gv.price.pct)).replace('.', ',') + '% dalam setahun, tren positif.');
      else if (gv.price.pct <= -10) ris.push('Harga turun ' + String(round1(Math.abs(gv.price.pct))).replace('.', ',') + '% dalam setahun, tren belum berbalik.');
    }
    if (x.vsAvgPct != null && x.vsAvgPct < -10) ris.push('Posisi Anda sedang rugi lebih dari 10% dari harga rata-rata.');
    if (x.vsAvgPct != null && x.vsAvgPct < -3) kat.push('Harga di bawah rata-rata Anda; membeli lagi menurunkan harga rata-rata.');
    return { katalis: kat, risiko: ris };
  }

  /** Rekomendasi otomatis dari tiga sudut pandang, murni dari angka di atas (bukan AI). */
  function autoAnalysis(x) {
    var vv = x.valuation, ds = x.dividend, gv = x.growth, rg = x.rangePos, out = {};
    // value investing
    if (vv) {
      out.value = vv.label === 'Murah' ? { label: 'Layak dicicil', tone: 'good' } : vv.label === 'Mahal' ? { label: 'Tunggu lebih murah', tone: 'warn' } : { label: 'Tahan, beli bila turun', tone: 'neutral' };
      out.value.alasan = vv.reasons.slice();
      if (gv && gv.fundamental && gv.fundamental.tone === 'warn') {
        out.value.alasan.push('laba tumbuh ' + gv.fundamental.label.toLowerCase() + ' (' + String(round1(gv.fundamental.pct)).replace('.', ',') + '%), jadi beli bertahap saja');
      }
    } else out.value = { label: 'Data belum cukup', tone: 'neutral', alasan: ['PER dan EPS dari Google Finance belum tersedia untuk emiten ini.'] };
    // dividen
    if (ds && ds.count) {
      var y = ds.annualYield;
      out.dividen = y >= 5 ? { label: 'Menarik', tone: 'good' } : y >= 2.5 ? { label: 'Cukup', tone: 'neutral' } : { label: 'Kecil', tone: 'neutral' };
      out.dividen.alasan = ['Imbal dividen 12 bulan terakhir ' + (y != null ? String(round1(y)).replace('.', ',') + '%' : 'belum bisa dihitung') + ' dari harga sekarang.',
        'Dibagikan ' + ds.frequency.label + '.'];
    } else out.dividen = { label: 'Belum ada data', tone: 'neutral', alasan: ['Belum ada data dividen untuk emiten ini.'] };
    // trader
    var tScore = 0, ta = [];
    if (gv && gv.price) {
      if (gv.price.pct >= 10) { tScore += 1; ta.push('harga naik ' + String(round1(gv.price.pct)).replace('.', ',') + '% dalam setahun'); }
      else if (gv.price.pct <= -10) { tScore -= 1; ta.push('harga turun ' + String(round1(Math.abs(gv.price.pct))).replace('.', ',') + '% dalam setahun'); }
      else ta.push('harga relatif datar dalam setahun');
    }
    if (rg != null) {
      if (rg >= 0.9) { tScore -= 1; ta.push('harga di dekat puncak 52 minggu'); }
      else if (rg <= 0.2) ta.push('harga di dekat dasar 52 minggu');
    }
    if (x.vsAvgPct != null) ta.push('harga sekarang ' + (x.vsAvgPct < 0 ? 'di bawah' : 'di atas') + ' harga rata-rata Anda ' + String(round1(Math.abs(x.vsAvgPct))).replace('.', ',') + '%');
    if (!(gv && gv.price) && rg == null) out.trader = { label: 'Data belum cukup', tone: 'neutral', alasan: ['Harga setahun lalu dan rentang 52 minggu belum tersedia.'] };
    else {
      var up = gv && gv.price && gv.price.pct >= 10, down = gv && gv.price && gv.price.pct <= -10;
      out.trader = { alasan: ta };
      if (rg != null && rg >= 0.9) { out.trader.label = 'Dekat puncak, tunggu koreksi'; out.trader.tone = 'warn'; }
      else if (up) { out.trader.label = 'Tren naik'; out.trader.tone = 'good'; }
      else if (down) { out.trader.label = 'Tren turun, tunggu konfirmasi'; out.trader.tone = 'warn'; }
      else { out.trader.label = 'Netral'; out.trader.tone = 'neutral'; }
    }
    var pts = (out.value.tone === 'good' ? 2 : out.value.tone === 'warn' ? -2 : 0) + (out.dividen.tone === 'good' ? 1 : 0) +
      (out.trader.tone === 'good' ? 1 : out.trader.tone === 'warn' ? -1 : 0);
    var known = (vv ? 1 : 0) + (ds && ds.count ? 1 : 0) + (out.trader.label !== 'Data belum cukup' ? 1 : 0);
    out.overall = !known ? { label: 'Data belum cukup', tone: 'neutral', catatan: 'Belum ada cukup data otomatis untuk menilai emiten ini.' }
      : pts >= 2 ? { label: 'Akumulasi bertahap', tone: 'good', catatan: 'Sebagian besar sinyal mendukung. Tetap bagi pembelian bertahap.' }
      : pts <= -2 ? { label: 'Tunggu, jangan menambah dulu', tone: 'warn', catatan: 'Sinyal valuasi dan harga belum mendukung.' }
      : { label: 'Pantau', tone: 'neutral', catatan: 'Sinyal campuran, belum ada alasan kuat untuk membeli atau menjual.' };
    out.overall.sinyal = known;
    return out;
  }

  return { rebuyInsight: rebuyInsight, dividendOutlook: dividendOutlook, dividendPlan: dividendPlan, valuation: valuation, analysisMetrics: analysisMetrics,
    dividendSummary: dividendSummary, valuationVerdict: valuationVerdict, growthVerdict: growthVerdict, autoAnalysis: autoAnalysis, fairValue: fairValue, signalLists: signalLists };
}));
