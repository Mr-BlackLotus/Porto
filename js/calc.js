/*
 * Porto — logika perhitungan portofolio (murni, tanpa DOM).
 * Metode biaya: harga rata-rata (average cost), standar untuk saham IDX.
 * 1 lot = 100 lembar.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOT = 100;

  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }

  function day(d) {
    return String(d || '').slice(0, 10);
  }

  function monthOf(d) {
    return day(d).slice(0, 7);
  }

  function upper(k) {
    return String(k || '').trim().toUpperCase();
  }

  /** Urutkan: tanggal naik, BELI sebelum JUAL pada hari yang sama, lalu urutan input. */
  function sortTrx(trx) {
    return trx
      .map(function (t, i) { return { t: t, i: i }; })
      .sort(function (a, b) {
        var da = day(a.t.tanggal), db = day(b.t.tanggal);
        if (da !== db) return da < db ? -1 : 1;
        if (a.t.jenis !== b.t.jenis) return a.t.jenis === 'BELI' ? -1 : 1;
        return a.i - b.i;
      })
      .map(function (x) { return x.t; });
  }

  /** Bangun buku besar dari seluruh transaksi. */
  function buildLedger(trx) {
    var pos = {};
    var events = [];
    var warnings = [];
    var perTrx = {};
    var totalBuy = 0;
    var totalSell = 0;

    sortTrx(trx).forEach(function (t) {
      var kode = upper(t.kode);
      var shares = Math.round(num(t.lot)) * LOT;
      var price = num(t.harga);
      var gross = shares * price;
      var fee = num(t.fee);
      var p = pos[kode];
      if (!p) {
        p = pos[kode] = {
          kode: kode, shares: 0, cost: 0, realized: 0,
          bought: 0, sold: 0, firstDate: day(t.tanggal)
        };
      }

      if (t.jenis === 'BELI') {
        p.shares += shares;
        p.cost += gross + fee;
        p.bought += gross + fee;
        totalBuy += gross + fee;
        return;
      }

      // JUAL
      var sellShares = shares;
      if (shares > p.shares + 1e-9) {
        warnings.push({
          id: t.id, kode: kode, tanggal: day(t.tanggal),
          message: 'Jual ' + (shares / LOT) + ' lot ' + kode + ' melebihi kepemilikan (' + (p.shares / LOT) + ' lot)'
        });
        sellShares = p.shares;
      }
      var ratio = shares > 0 ? sellShares / shares : 0;
      var proceeds = (gross - fee) * ratio;
      var avg = p.shares > 0 ? p.cost / p.shares : 0;
      var costSold = avg * sellShares;
      var realized = proceeds - costSold;

      events.push({
        id: t.id, tanggal: day(t.tanggal), month: monthOf(t.tanggal), kode: kode,
        shares: sellShares, proceeds: proceeds, costSold: costSold, realized: realized
      });
      perTrx[t.id] = realized;

      p.cost -= costSold;
      p.shares -= sellShares;
      if (p.shares <= 1e-9) { p.shares = 0; p.cost = 0; }
      p.realized += realized;
      p.sold += proceeds;
      totalSell += proceeds;
    });

    var all = Object.keys(pos).map(function (k) { return pos[k]; });
    return {
      positions: pos,
      open: all.filter(function (p) { return p.shares > 0; }),
      all: all,
      events: events,
      warnings: warnings,
      perTrx: perTrx,
      totalBuy: totalBuy,
      totalSell: totalSell,
      realizedTotal: events.reduce(function (s, e) { return s + e.realized; }, 0)
    };
  }

  function addMonths(ym, n) {
    var y = Number(ym.slice(0, 4));
    var m = Number(ym.slice(5, 7)) - 1 + n;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + String(m + 1).padStart(2, '0');
  }

  /** Profit per bulan = profit jual (terealisasi) + dividen. Bulan kosong ikut diisi. */
  function monthly(trx, ledger, dividends, nowDate) {
    var map = {};
    function slot(m) {
      return map[m] || (map[m] = { month: m, realized: 0, dividend: 0, total: 0, trades: 0, divCount: 0 });
    }
    trx.forEach(function (t) { slot(monthOf(t.tanggal)).trades += 1; });
    ledger.events.forEach(function (e) { slot(e.month).realized += e.realized; });
    dividends.forEach(function (d) {
      var s = slot(monthOf(d.tanggal));
      s.dividend += num(d.jumlah);
      s.divCount += 1;
    });

    var keys = Object.keys(map).filter(Boolean).sort();
    if (!keys.length) return [];
    var now = monthOf(nowDate || new Date().toISOString());
    var first = keys[0];
    var last = keys[keys.length - 1] > now ? keys[keys.length - 1] : now;

    var out = [];
    var cum = 0;
    for (var m = first; m <= last; m = addMonths(m, 1)) {
      var s = slot(m);
      s.total = s.realized + s.dividend;
      cum += s.total;
      s.cumulative = cum;
      out.push(s);
    }
    return out;
  }

  /** Total dividen per saham dan per tahun. */
  function dividendSummary(dividends) {
    var byKode = {};
    var byYear = {};
    var total = 0;
    dividends.forEach(function (d) {
      var k = upper(d.kode);
      var v = num(d.jumlah);
      var y = day(d.tanggal).slice(0, 4);
      var r = byKode[k] || (byKode[k] = { kode: k, total: 0, count: 0, last: '' });
      r.total += v;
      r.count += 1;
      if (day(d.tanggal) > r.last) r.last = day(d.tanggal);
      byYear[y] = (byYear[y] || 0) + v;
      total += v;
    });
    return {
      total: total,
      byKode: Object.keys(byKode).map(function (k) { return byKode[k]; })
        .sort(function (a, b) { return b.total - a.total; }),
      byYear: byYear
    };
  }

  /**
   * Ringkasan portofolio. priceFor(kode) -> { price, prev } atau null.
   * Saham tanpa harga dinilai pada harga rata-rata (hasPrice=false).
   */
  function summarize(ledger, dividends, priceFor) {
    var divs = dividendSummary(dividends);
    var divMap = {};
    divs.byKode.forEach(function (r) { divMap[r.kode] = r.total; });

    var rows = ledger.open.map(function (p) {
      var q = priceFor ? priceFor(p.kode) : null;
      var hasPrice = !!(q && q.price > 0);
      var avg = p.cost / p.shares;
      var price = hasPrice ? q.price : avg;
      var prev = hasPrice && q.prev > 0 ? q.prev : null;
      var value = p.shares * price;
      var unrealized = value - p.cost;
      return {
        kode: p.kode,
        shares: p.shares,
        lot: p.shares / LOT,
        avg: avg,
        cost: p.cost,
        price: price,
        prev: prev,
        hasPrice: hasPrice,
        source: hasPrice ? q.source : null,
        value: value,
        unrealized: unrealized,
        unrealizedPct: p.cost > 0 ? unrealized / p.cost * 100 : 0,
        dayChange: prev ? p.shares * (price - prev) : 0,
        dayPct: prev ? (price - prev) / prev * 100 : 0,
        realized: p.realized,
        dividend: divMap[p.kode] || 0
      };
    }).sort(function (a, b) { return b.value - a.value; });

    var cost = 0, value = 0, unrealized = 0, dayChange = 0;
    rows.forEach(function (r) {
      cost += r.cost; value += r.value; unrealized += r.unrealized; dayChange += r.dayChange;
    });
    rows.forEach(function (r) { r.weight = value > 0 ? r.value / value * 100 : 0; });

    var realized = ledger.realizedTotal;
    var totalReturn = realized + unrealized + divs.total;
    return {
      rows: rows,
      cost: cost,
      value: value,
      unrealized: unrealized,
      unrealizedPct: cost > 0 ? unrealized / cost * 100 : 0,
      realized: realized,
      dividend: divs.total,
      totalReturn: totalReturn,
      returnPct: ledger.totalBuy > 0 ? totalReturn / ledger.totalBuy * 100 : 0,
      totalBuy: ledger.totalBuy,
      dayChange: dayChange,
      dividends: divs,
      missingPrices: rows.filter(function (r) { return !r.hasPrice; }).map(function (r) { return r.kode; })
    };
  }

  /** Estimasi fee dari persentase. */
  function estimateFee(jenis, lot, harga, feeBeliPct, feeJualPct) {
    var gross = Math.round(num(lot)) * LOT * num(harga);
    var pct = jenis === 'JUAL' ? feeJualPct : feeBeliPct;
    return Math.round(gross * num(pct) / 100);
  }

  return {
    LOT: LOT,
    num: num,
    day: day,
    monthOf: monthOf,
    upper: upper,
    sortTrx: sortTrx,
    buildLedger: buildLedger,
    monthly: monthly,
    dividendSummary: dividendSummary,
    summarize: summarize,
    estimateFee: estimateFee,
    addMonths: addMonths
  };
}));
