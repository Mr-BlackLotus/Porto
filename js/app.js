/* Porto — antarmuka aplikasi (saham Indonesia, saham US, crypto). */
(function () {
  'use strict';

  var C = Calc, S = Store;
  var MK = C.MARKETS, ORDER = C.MARKET_ORDER;

  // ---------- util ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var MON = Charts.MONTHS;
  var fmtCache = {};
  function nfFor(min, max) {
    var k = min + '-' + max;
    return fmtCache[k] || (fmtCache[k] = new Intl.NumberFormat('id-ID', { minimumFractionDigits: min, maximumFractionDigits: max }));
  }

  function idr(n) { return (n < -0.5 ? '−' : '') + 'Rp ' + nfFor(0, 0).format(Math.abs(Math.round(n))); }
  function usd(n) {
    var r = Math.round(n * 100) / 100;
    return (r < 0 ? '−' : '') + 'US$ ' + nfFor(2, 2).format(Math.abs(r));
  }
  function money(n, ccy) { return ccy === 'USD' ? usd(n) : idr(n); }
  function sgn(n, ccy) { var t = ccy === 'USD' ? 0.005 : 0.5; return n > t ? 1 : n < -t ? -1 : 0; }
  function moneySigned(n, ccy) {
    var s = sgn(n, ccy);
    return s === 0 ? money(0, ccy) : (s > 0 ? '+' : '−') + money(Math.abs(n), ccy);
  }
  function cls(n, ccy) { var s = sgn(n, ccy); return s > 0 ? 'gain' : s < 0 ? 'loss' : 'flat'; }
  function pct(n) {
    var r = Math.round(n * 100) / 100;
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2).replace('.', ',') + '%';
  }
  function pxf(n, ccy) {
    var max = Math.abs(n) < 1 ? 6 : 2;
    var min = ccy === 'USD' ? Math.min(2, max) : 0;
    return nfFor(min, max).format(n);
  }
  function qtyf(n, mk) { return mk === 'ID' ? nfFor(0, 0).format(n) : nfFor(0, 8).format(n); }
  function fmtDate(d) {
    d = C.day(d);
    if (!d) return '–';
    return Number(d.slice(8, 10)) + ' ' + MON[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);
  }
  function fmtMonth(ym) { return Charts.monthLabel(ym) + ' ' + ym.slice(0, 4); }
  function ymd(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function hhmm(ms) {
    return new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
  }

  // ---------- pasar & mata uang ----------
  function ccyOf(mk) { return mk === 'CRYPTO' ? S.settings.cryptoCcy : MK[mk].ccy; }
  function rateOf(mk) { return ccyOf(mk) === 'IDR' ? 1 : (S.fx() || 0); }
  function noun(mk) { return mk === 'CRYPTO' ? 'Reward' : 'Dividen'; }
  function nounLower(mk) { return mk === 'CRYPTO' ? 'reward' : 'dividen'; }
  function pill(mk, mini) { return '<span class="pill mk-' + mk.toLowerCase() + (mini ? ' mini' : '') + '">' + esc(MK[mk].short) + '</span>'; }
  function selMarket() { return S.settings.market; }

  /** Harga dalam mata uang pencatatan pasar. Crypto dikutip USD oleh sumber, dikonversi bila dicatat dalam Rupiah. */
  function priceIn(mk, kode) {
    var key = mk + ':' + kode;
    var live = S.prices.items && S.prices.items[key];
    if (live && live.price > 0) {
      var f = (mk === 'CRYPTO' && ccyOf(mk) === 'IDR') ? S.fx() : 1;
      if (f > 0) return { price: live.price * f, prev: live.prev > 0 ? live.prev * f : null, source: 'live', time: live.time };
    }
    var m = S.manual[key];
    return m > 0 ? { price: m, prev: null, source: 'manual' } : null;
  }

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9"/><path d="M9.5 10c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.4-2.5 1.8-2.5.8-2.5 1.8 1 1.6 2.5 1.6 2.5-.6 2.5-1.6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };

  var ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', markets: true },
    { id: 'transaksi', label: 'Transaksi', icon: 'swap', markets: true },
    { id: 'dividen', label: 'Dividen', icon: 'coin', markets: true },
    { id: 'bulanan', label: 'Bulanan', icon: 'chart', markets: true },
    { id: 'pengaturan', label: 'Pengaturan', icon: 'gear', markets: false }
  ];

  var state = {
    route: 'dashboard',
    loadError: '',
    refreshing: false,
    live: 'idle',
    f: { trx: { kode: '', jenis: '', tahun: '' }, div: { kode: '', tahun: '' } },
    focusId: ''
  };

  var PALETTE = ['#0D4F4A', '#2C9A8E', '#7CC4B6', '#B9810F', '#7A5C2E', '#5B7A99', '#A3B3AD', '#C9D4CF'];
  var MK_COLOR = { ID: '#0D4F4A', US: '#4C6A8C', CRYPTO: '#7A5C9E' };

  // ---------- perhitungan ----------
  function compute() {
    var d = S.data;
    var sel = selMarket();
    var per = {};
    ORDER.forEach(function (mk) {
      var trx = d.transaksi.filter(function (t) { return t.pasar === mk; });
      var dv = d.dividen.filter(function (x) { return x.pasar === mk; });
      var ledger = C.buildLedger(trx, MK[mk].mult);
      per[mk] = {
        mk: mk, trx: trx, dv: dv, ledger: ledger, ccy: ccyOf(mk), rate: rateOf(mk),
        summary: C.summarize(ledger, dv, function (kode) { return priceIn(mk, kode); }),
        has: trx.length > 0 || dv.length > 0
      };
    });
    var all = sel === 'ALL';
    var list = all ? ORDER.filter(function (mk) { return per[mk].has; }) : [sel];
    var dispCcy = all ? 'IDR' : per[sel].ccy;
    function rt(mk) { return all ? per[mk].rate : 1; }

    var agg = { value: 0, cost: 0, unrealized: 0, realized: 0, dividend: 0, totalReturn: 0, totalBuy: 0, dayChange: 0 };
    list.forEach(function (mk) {
      var s = per[mk].summary, r = rt(mk);
      agg.value += s.value * r;
      agg.cost += s.cost * r;
      agg.unrealized += s.unrealized * r;
      agg.realized += s.realized * r;
      agg.dividend += s.dividend * r;
      agg.totalBuy += s.totalBuy * r;
      agg.dayChange += s.dayChange * r;
    });
    agg.totalReturn = agg.realized + agg.unrealized + agg.dividend;
    agg.unrealizedPct = agg.cost > 0 ? agg.unrealized / agg.cost * 100 : 0;
    agg.returnPct = agg.totalBuy > 0 ? agg.totalReturn / agg.totalBuy * 100 : 0;

    var months = C.mergeMonthly(list.map(function (mk) {
      return { trx: per[mk].trx, ledger: per[mk].ledger, dividends: per[mk].dv, rate: rt(mk) };
    }), ymd(new Date()));

    var warnings = [];
    list.forEach(function (mk) { warnings = warnings.concat(per[mk].ledger.warnings); });

    var needFx = all && list.some(function (mk) { return per[mk].ccy === 'USD'; }) && !S.fx();
    var hasData = list.some(function (mk) { return per[mk].has; });
    return { d: d, sel: sel, all: all, per: per, list: list, dispCcy: dispCcy, rt: rt, agg: agg, months: months, warnings: warnings, needFx: needFx, hasData: hasData };
  }

  function knownKodes(mk) {
    var set = {};
    S.data.transaksi.concat(S.data.dividen).forEach(function (t) { if (!mk || t.pasar === mk) set[t.kode] = 1; });
    return Object.keys(set).sort();
  }

  function newWarning(before, after) {
    for (var i = 0; i < ORDER.length; i++) {
      var mk = ORDER[i];
      var pick = function (t) { return t.pasar === mk; };
      var wb = C.buildLedger(before.filter(pick), MK[mk].mult).warnings.map(function (w) { return w.id; });
      var bad = C.buildLedger(after.filter(pick), MK[mk].mult).warnings.filter(function (w) { return wb.indexOf(w.id) < 0; })[0];
      if (bad) return bad;
    }
    return null;
  }

  // ---------- potongan tampilan ----------
  function lead(label, value, extra) {
    return '<div><dt>' + (extra && extra.sw ? '<i class="sw" style="background:' + extra.sw + '"></i>' : '') + label +
      '</dt><span class="fill"></span><dd class="' + ((extra && extra.cls) || '') + '">' + value + '</dd></div>';
  }

  function banner(html, kind) {
    return '<div class="banner ' + (kind || '') + '" role="status"><div>' + html + '</div></div>';
  }

  function loginGate() {
    return '<div class="panel empty login-gate"><h3>Masuk untuk membuka portofolio</h3>' +
      '<p>Data Anda ada di Google Sheets. Masuk dengan akun Google yang punya akses ke spreadsheet.</p>' +
      '<div class="row"><button class="btn primary" data-act="google-login" type="button">Masuk dengan Google</button></div></div>';
  }

  function emptyState(title, text, local) {
    return '<div class="panel empty"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="row">' +
      '<button class="btn primary" data-act="add-trx" type="button">Catat transaksi</button>' +
      (local ? '<button class="btn outline" data-act="load-sample" type="button">Muat data contoh</button>' : '') +
      '</div></div>';
  }

  function yearsOf(rows) {
    var set = {};
    rows.forEach(function (r) { var y = C.day(r.tanggal).slice(0, 4); if (y) set[y] = 1; });
    return Object.keys(set).sort().reverse();
  }

  function selectField(id, label, value, options) {
    return '<div class="field"><label for="' + id + '">' + label + '</label><select id="' + id + '" data-filter="' + id + '">' +
      options.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select></div>';
  }

  function dividendsOf(m) {
    var out = [];
    m.list.forEach(function (mk) {
      per_(m, mk).dv.forEach(function (x) { out.push(Object.assign({}, x, { jumlah: C.num(x.jumlah) * m.rt(mk) })); });
    });
    return out;
  }
  function per_(m, mk) { return m.per[mk]; }

  function marketBanners(m) {
    var html = '';
    if (state.loadError) {
      html += banner('<strong>Gagal memuat dari Google Sheets.</strong> ' + esc(state.loadError) +
        ' <button class="linkbtn" data-act="reload" type="button">Coba lagi</button>', 'err');
    }
    if (S.needLogin()) {
      html += banner('<strong>Masuk dengan Google untuk memuat data terbaru.</strong> Yang tampil sekarang adalah salinan terakhir di browser ini. ' +
        '<button class="linkbtn" data-act="google-login" type="button">Masuk dengan Google</button>');
    }
    if (!S.isSheet()) {
      html += banner('<strong>Mode lokal.</strong> Data hanya tersimpan di browser ini dan harga harian tidak diperbarui otomatis. ' +
        '<a href="#/pengaturan">Masuk dengan Google</a> untuk menyimpan data di Drive Anda dan mengaktifkan harga otomatis.');
    }
    if (m.needFx) {
      html += banner('<strong>Kurs USD ke Rupiah belum tersedia.</strong> Pasar yang dicatat dalam dolar belum ikut dihitung di tampilan Semua. ' +
        'Hubungkan Google Sheets agar kurs terisi otomatis, atau isi kurs cadangan di <a href="#/pengaturan">Pengaturan</a>.', 'err');
    }
    if (m.warnings.length) {
      html += banner('<strong>Ada transaksi jual yang tidak cocok dengan kepemilikan:</strong> ' +
        esc(m.warnings.slice(0, 2).map(function (w) { return w.message + ' (' + fmtDate(w.tanggal) + ')'; }).join('; ')) +
        '. Periksa di <a href="#/transaksi">Transaksi</a>.', 'err');
    }
    var missing = [];
    m.list.forEach(function (mk) {
      m.per[mk].summary.missingPrices.forEach(function (k) { missing.push({ mk: mk, kode: k }); });
    });
    if (S.isSheet() && !S.needLogin() && missing.length) {
      var errs = S.prices.errors || {};
      var notFound = missing.filter(function (x) { return errs[x.mk + ':' + x.kode]; });
      var names = missing.map(function (x) { return x.kode; });
      html += banner('<strong>Harga belum tersedia untuk ' + esc(names.join(', ')) + '.</strong> Aset ini dinilai pada harga rata-rata, jadi profitnya tampil 0. ' +
        (notFound.length ? 'Kode ' + esc(notFound.map(function (x) { return x.kode; }).join(', ')) + ' tidak ditemukan; periksa penulisannya. ' : '') +
        'Anda juga bisa mengisi harga manual di tabel posisi.');
    }
    return html;
  }

  // ---------- halaman: dashboard ----------
  function positionsTable(m) {
    var rows = [];
    m.list.forEach(function (mk) {
      m.per[mk].summary.rows.forEach(function (r) { rows.push({ mk: mk, r: r, ccy: m.per[mk].ccy, rate: m.rt(mk) }); });
    });
    if (!rows.length) return '<div class="panel empty"><p>Semua posisi sudah dijual. Profitnya ada di total hasil dan di rincian bulanan.</p></div>';

    if (m.all) {
      rows.sort(function (a, b) { return b.r.value * b.rate - a.r.value * a.rate; });
      var totV = 0, totU = 0;
      var body = rows.map(function (x) {
        var r = x.r, v = r.value * x.rate, u = r.unrealized * x.rate;
        totV += v; totU += u;
        var skipped = x.rate === 0;
        return '<tr><td class="kode">' + esc(r.kode) + pill(x.mk, true) + '</td>' +
          '<td class="num">' + qtyf(r.qty, x.mk) + '</td>' +
          '<td class="num">' + (skipped ? '<span class="muted">–</span>' : idr(v)) + '</td>' +
          '<td class="num ' + (skipped ? 'flat' : cls(u, 'IDR')) + '">' + (skipped ? '–' : moneySigned(u, 'IDR') + '<span class="sub">' + pct(r.unrealizedPct) + '</span>') + '</td>' +
          '<td class="num">' + (r.dividend && !skipped ? idr(r.dividend * x.rate) : '<span class="muted">–</span>') + '</td></tr>';
      }).join('');
      return '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>Aset</th><th class="num">Jumlah</th><th class="num">Nilai</th><th class="num">Profit / rugi</th><th class="num">Dividen / reward</th></tr></thead><tbody>' + body +
        '</tbody><tfoot><tr><td>Total</td><td></td><td class="num">' + idr(totV) + '</td><td class="num ' + cls(totU, 'IDR') + '">' + moneySigned(totU, 'IDR') + '</td><td></td></tr></tfoot></table></div>';
    }

    var mk = m.sel, ccy = m.per[mk].ccy, unit = MK[mk].unit;
    var tv = 0, tu = 0;
    return '<div class="panel table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Aset</th><th class="num">Jumlah (' + unit + ')</th><th class="num">Harga rata-rata</th><th class="num">Harga sekarang</th>' +
      '<th class="num">Nilai</th><th class="num">Profit / rugi</th><th class="num">' + noun(mk) + '</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var r = x.r;
        tv += r.value; tu += r.unrealized;
        var priceCell;
        if (r.hasPrice) {
          priceCell = pxf(r.price, ccy) + (r.prev ? '<span class="sub ' + cls(r.dayChange, ccy) + '">' + pct(r.dayPct) + ' hari ini</span>' : '') +
            (r.source === 'manual' ? '<span class="sub muted">manual <button class="linkbtn" data-act="price" data-key="' + esc(mk + ':' + r.kode) + '" type="button">ubah</button></span>' : '');
        } else {
          priceCell = '<span class="muted">–</span><span class="sub"><button class="linkbtn" data-act="price" data-key="' + esc(mk + ':' + r.kode) + '" type="button">Isi harga</button></span>';
        }
        return '<tr><td class="kode">' + esc(r.kode) + '</td>' +
          '<td class="num">' + qtyf(r.qty, mk) + '</td>' +
          '<td class="num">' + pxf(r.avg, ccy) + '</td>' +
          '<td class="num">' + priceCell + '</td>' +
          '<td class="num">' + money(r.value, ccy) + '</td>' +
          '<td class="num ' + cls(r.unrealized, ccy) + '">' + moneySigned(r.unrealized, ccy) + '<span class="sub">' + pct(r.unrealizedPct) + '</span></td>' +
          '<td class="num">' + (r.dividend ? money(r.dividend, ccy) : '<span class="muted">–</span>') + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>Total</td><td></td><td></td><td></td><td class="num">' + money(tv, ccy) + '</td>' +
      '<td class="num ' + cls(tu, ccy) + '">' + moneySigned(tu, ccy) + '</td><td></td></tr></tfoot></table></div>';
  }

  function perMarketTable(m) {
    var tot = { value: 0, cost: 0, unrealized: 0, realized: 0, dividend: 0, totalReturn: 0 };
    var body = m.list.map(function (mk) {
      var p = m.per[mk], s = p.summary, r = p.rate;
      var skipped = r === 0;
      if (!skipped) {
        tot.value += s.value * r; tot.cost += s.cost * r; tot.unrealized += s.unrealized * r;
        tot.realized += s.realized * r; tot.dividend += s.dividend * r; tot.totalReturn += s.totalReturn * r;
      }
      function c(v, signed) {
        if (skipped) return '<span class="muted">–</span>';
        return signed ? moneySigned(v * r, 'IDR') : idr(v * r);
      }
      return '<tr><td class="kode"><button class="linkbtn" data-act="market" data-m="' + mk + '" type="button">' + esc(MK[mk].label) + '</button>' +
        (p.ccy === 'USD' ? '<span class="sub muted" style="font-weight:500">dicatat dalam USD</span>' : '') + '</td>' +
        '<td class="num">' + c(s.value) + '</td><td class="num">' + c(s.cost) + '</td>' +
        '<td class="num ' + (skipped ? '' : cls(s.unrealized * r, 'IDR')) + '">' + c(s.unrealized, true) + '</td>' +
        '<td class="num ' + (skipped ? '' : cls(s.realized * r, 'IDR')) + '">' + c(s.realized, true) + '</td>' +
        '<td class="num">' + c(s.dividend) + '</td>' +
        '<td class="num ' + (skipped ? '' : cls(s.totalReturn * r, 'IDR')) + '"><strong>' + c(s.totalReturn, true) + '</strong></td></tr>';
    }).join('');
    return '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>Pasar</th><th class="num">Nilai</th><th class="num">Modal</th><th class="num">Belum terealisasi</th><th class="num">Profit jual</th><th class="num">Dividen / reward</th><th class="num">Total hasil</th></tr></thead><tbody>' + body +
      '</tbody><tfoot><tr><td>Total</td><td class="num">' + idr(tot.value) + '</td><td class="num">' + idr(tot.cost) + '</td><td class="num">' + moneySigned(tot.unrealized, 'IDR') +
      '</td><td class="num">' + moneySigned(tot.realized, 'IDR') + '</td><td class="num">' + idr(tot.dividend) + '</td><td class="num ' + cls(tot.totalReturn, 'IDR') + '">' + moneySigned(tot.totalReturn, 'IDR') + '</td></tr></tfoot></table></div>';
  }

  function viewDashboard(m) {
    var html = marketBanners(m);
    if (!m.hasData) {
      var scope = m.all ? '' : ' di ' + MK[m.sel].label;
      return html + emptyState('Belum ada transaksi' + scope, 'Catat pembelian pertama Anda, atau muat data contoh untuk melihat cara kerjanya.', !S.isSheet());
    }
    var a = m.agg, ccy = m.dispCcy;
    var rowsAll = [];
    m.list.forEach(function (mk) { rowsAll = rowsAll.concat(m.per[mk].summary.rows); });
    var hasPrev = rowsAll.some(function (r) { return r.prev; });
    var divLabel = m.all ? 'Dividen dan reward diterima' : noun(m.sel) + ' diterima';

    var left = '<div class="hero-figure"><div class="lbl">Total hasil investasi' + (m.all ? ' (semua pasar, dalam Rupiah)' : '') + '</div>' +
      '<div class="big ' + cls(a.totalReturn, ccy) + '">' + moneySigned(a.totalReturn, ccy) + '</div>' +
      '<div class="sub ' + cls(a.totalReturn, ccy) + '">' + pct(a.returnPct) + ' <span class="muted">dari total dana yang dibelikan</span></div>' +
      '<dl class="leader">' +
      lead('Nilai portofolio saat ini', money(a.value, ccy)) +
      lead('Modal aset yang dipegang', money(a.cost, ccy)) +
      lead('Belum terealisasi', moneySigned(a.unrealized, ccy) + ' (' + pct(a.unrealizedPct) + ')', { cls: cls(a.unrealized, ccy) }) +
      lead('Profit jual (terealisasi)', moneySigned(a.realized, ccy), { cls: cls(a.realized, ccy) }) +
      lead(divLabel, moneySigned(a.dividend, ccy), { cls: a.dividend > 0 ? 'gain' : 'flat' }) +
      (hasPrev ? lead('Perubahan hari ini', moneySigned(a.dayChange, ccy), { cls: cls(a.dayChange, ccy) }) : '') +
      '</dl></div>';

    var last12 = m.months.slice(-12);
    var right = '<div class="chart-wrap"><div class="chart-head"><h2>Profit per bulan</h2>' +
      '<div class="legend"><span><i style="background:var(--gain)"></i>Profit jual</span><span><i style="background:var(--loss)"></i>Rugi jual</span><span><i style="background:var(--dividend)"></i>' + (m.all ? 'Dividen / reward' : noun(m.sel)) + '</span></div></div>' +
      '<div class="chart-scroll"><div class="chart">' + Charts.monthly(last12, { label: 'Profit per bulan, 12 bulan terakhir', fmt: function (n) { return money(n, ccy); } }) + '</div></div>' +
      '<p class="muted" style="font-size:13px;margin:8px 0 0">Profit jual + dividen yang diterima di bulan itu. <a href="#/bulanan">' + (m.months.length > 12 ? 'Lihat semua bulan' : 'Lihat rincian per bulan') + '</a></p></div>';

    html += '<section class="hero">' + left + right + '</section>';

    if (m.all) {
      html += '<section class="section"><div class="section-head"><h2>Per pasar</h2><span class="note">Klik nama pasar untuk melihat rinciannya</span></div>' + perMarketTable(m) + '</section>';
    }

    html += '<section class="section"><div class="section-head"><h2>Posisi</h2>' +
      '<span class="note">' + (S.prices.at ? 'Harga diperbarui ' + hhmm(S.prices.at) : 'Harga belum diperbarui') + '</span></div>' + positionsTable(m) + '</section>';

    // alokasi + dividen
    var alloc = '';
    var segs = [];
    if (m.all) {
      m.list.forEach(function (mk) {
        var v = m.per[mk].summary.value * m.per[mk].rate;
        if (v > 0) segs.push({ k: MK[mk].label, w: v, c: MK_COLOR[mk] });
      });
      var tw = segs.reduce(function (x, g) { return x + g.w; }, 0);
      segs.forEach(function (g) { g.w = tw > 0 ? g.w / tw * 100 : 0; });
    } else {
      var rows = m.per[m.sel].summary.rows;
      var top = rows.slice(0, 7);
      var restW = rows.slice(7).reduce(function (x, r) { return x + r.weight; }, 0);
      segs = top.map(function (r, i) { return { k: r.kode, w: r.weight, c: PALETTE[i] }; });
      if (restW > 0) segs.push({ k: 'Lainnya', w: restW, c: PALETTE[7] });
    }
    if (segs.length) {
      alloc = '<div><div class="section-head"><h2>Alokasi</h2></div>' +
        '<div class="alloc" role="img" aria-label="Alokasi portofolio">' +
        segs.map(function (g) { return '<span title="' + esc(g.k) + ' ' + g.w.toFixed(1) + '%" style="flex:' + g.w + ';background:' + g.c + '"></span>'; }).join('') + '</div>' +
        '<dl class="leader">' + segs.map(function (g) { return lead(esc(g.k), g.w.toFixed(1).replace('.', ',') + '%', { sw: g.c }); }).join('') + '</dl></div>';
    }
    var ds = C.dividendSummary(dividendsOf(m));
    var dvTitle = m.all ? 'Dividen dan reward per aset' : noun(m.sel) + ' per aset';
    var dv;
    if (ds.byKode.length) {
      dv = '<div><div class="section-head"><h2>' + dvTitle + '</h2><a class="note" href="#/dividen">Semua</a></div>' +
        '<dl class="leader">' + ds.byKode.slice(0, 7).map(function (r) { return lead(esc(r.kode), money(r.total, ccy), { cls: 'gain' }); }).join('') +
        lead('<strong>Total</strong>', '<strong>' + money(ds.total, ccy) + '</strong>') + '</dl></div>';
    } else {
      dv = '<div><div class="section-head"><h2>' + dvTitle + '</h2></div><p class="muted">Belum ada yang tercatat. Gunakan tombol Catat dividen.</p></div>';
    }
    html += '<section class="section cols-2">' + alloc + dv + '</section>';
    return html;
  }

  // ---------- halaman: transaksi ----------
  function viewTransaksi(m) {
    var f = state.f.trx;
    var pool = m.list.reduce(function (acc, mk) { return acc.concat(m.per[mk].trx); }, []);
    if (!pool.length) {
      return marketBanners(m) + emptyState('Belum ada transaksi' + (m.all ? '' : ' di ' + MK[m.sel].label), 'Catat pembelian atau penjualan Anda. Profit dihitung otomatis dengan metode harga rata-rata.', !S.isSheet());
    }
    var rows = pool.filter(function (t) {
      return (!f.kode || t.kode === f.kode) && (!f.jenis || t.jenis === f.jenis) && (!f.tahun || C.day(t.tanggal).slice(0, 4) === f.tahun);
    }).slice().sort(function (a, b) {
      var x = C.day(a.tanggal), y = C.day(b.tanggal);
      return x === y ? 0 : x < y ? 1 : -1;
    });
    var warnIds = {};
    m.warnings.forEach(function (w) { warnIds[w.id] = w.message; });

    var kodes = {};
    pool.forEach(function (t) { kodes[t.kode] = 1; });
    var kodeOpts = [['', 'Semua aset']].concat(Object.keys(kodes).sort().map(function (k) { return [k, k]; }));
    var yearOpts = [['', 'Semua tahun']].concat(yearsOf(pool).map(function (y) { return [y, y]; }));

    var sum = 0, skippedSum = false;
    rows.forEach(function (t) {
      if (t.jenis === 'JUAL' && m.per[t.pasar].ledger.perTrx[t.id] != null) {
        if (m.rt(t.pasar) === 0) skippedSum = true;
        else sum += m.per[t.pasar].ledger.perTrx[t.id] * m.rt(t.pasar);
      }
    });

    var html = marketBanners(m) + '<div class="filters">' +
      selectField('ft-kode', 'Aset', f.kode, kodeOpts) +
      selectField('ft-jenis', 'Jenis', f.jenis, [['', 'Beli dan jual'], ['BELI', 'Beli'], ['JUAL', 'Jual']]) +
      selectField('ft-tahun', 'Tahun', f.tahun, yearOpts) + '</div>';

    if (!rows.length) return html + '<div class="panel empty"><p>Tidak ada transaksi yang cocok dengan filter.</p></div>';

    html += '<div class="panel table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Tanggal</th><th>Aset</th><th>Jenis</th><th class="num">Jumlah</th><th class="num">Harga</th><th class="num">Nilai</th><th class="num">Fee</th><th class="num">Profit / rugi</th><th></th></tr></thead><tbody>' +
      rows.map(function (t) {
        var ccy = ccyOf(t.pasar), mult = MK[t.pasar].mult;
        var gross = C.qtyOf(t) * mult * C.num(t.harga);
        var pl = t.jenis === 'JUAL' ? m.per[t.pasar].ledger.perTrx[t.id] : null;
        return '<tr><td>' + fmtDate(t.tanggal) + (t.catatan ? '<span class="sub muted" style="font-weight:500">' + esc(t.catatan) + '</span>' : '') + '</td>' +
          '<td class="kode">' + esc(t.kode) + (m.all ? pill(t.pasar, true) : '') + '</td>' +
          '<td><span class="pill ' + (t.jenis === 'BELI' ? 'beli' : 'jual') + '">' + (t.jenis === 'BELI' ? 'Beli' : 'Jual') + '</span>' +
          (warnIds[t.id] ? ' <span class="pill warn" title="' + esc(warnIds[t.id]) + '">Melebihi kepemilikan</span>' : '') + '</td>' +
          '<td class="num">' + qtyf(C.qtyOf(t), t.pasar) + '</td>' +
          '<td class="num">' + pxf(C.num(t.harga), ccy) + '</td>' +
          '<td class="num">' + money(gross, ccy) + '</td>' +
          '<td class="num">' + (C.num(t.fee) ? money(t.fee, ccy) : '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + (pl == null ? 'flat' : cls(pl, ccy)) + '">' + (pl == null ? '–' : moneySigned(pl, ccy)) + '</td>' +
          '<td class="acts"><button class="btn ghost sm" data-act="edit-trx" data-id="' + esc(t.id) + '" type="button">Ubah</button>' +
          '<button class="btn danger sm" data-act="del-trx" data-id="' + esc(t.id) + '" type="button">Hapus</button></td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="7">' + rows.length + ' transaksi · total profit jual' + (m.all ? ' (dalam Rupiah)' : '') + '</td>' +
      '<td class="num ' + cls(sum, m.dispCcy) + '">' + (skippedSum ? '–' : moneySigned(sum, m.dispCcy)) + '</td><td></td></tr></tfoot></table></div>';
    return html;
  }

  // ---------- halaman: dividen ----------
  function viewDividen(m) {
    var f = state.f.div, ccy = m.dispCcy;
    var pool = m.list.reduce(function (acc, mk) { return acc.concat(m.per[mk].dv); }, []);
    var nn = m.all ? 'dividen dan reward' : nounLower(m.sel);
    if (!pool.length) {
      return marketBanners(m) + '<div class="panel empty"><h3>Belum ada ' + nn + '</h3><p>Catat ' + nn + ' yang masuk per aset. Nilainya ikut dihitung dalam profit bulanan.</p><div class="row">' +
        '<button class="btn primary" data-act="add-div" type="button">Catat ' + (m.all ? 'dividen' : nounLower(m.sel)) + '</button></div></div>';
    }
    var ds = C.dividendSummary(dividendsOf(m));
    var years = Object.keys(ds.byYear).sort().reverse();
    var summary = '<div><div class="section-head"><h2>Ringkasan</h2></div><dl class="leader">' +
      lead('Total diterima', money(ds.total, ccy), { cls: 'gain' }) +
      years.map(function (y) { return lead('Tahun ' + y, money(ds.byYear[y], ccy)); }).join('') + '</dl></div>';

    var perKode = '<div><div class="section-head"><h2>Per aset</h2></div><div class="panel table-wrap"><table class="tbl"><thead><tr><th>Aset</th><th class="num">Pembayaran</th><th class="num">Total</th><th class="num">Terakhir</th></tr></thead><tbody>' +
      ds.byKode.map(function (r) {
        return '<tr><td class="kode">' + esc(r.kode) + '</td><td class="num">' + r.count + 'x</td><td class="num">' + money(r.total, ccy) + '</td><td class="num">' + fmtDate(r.last) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    var rows = pool.filter(function (x) {
      return (!f.kode || x.kode === f.kode) && (!f.tahun || C.day(x.tanggal).slice(0, 4) === f.tahun);
    }).slice().sort(function (a, b) {
      var x = C.day(a.tanggal), y = C.day(b.tanggal);
      return x === y ? 0 : x < y ? 1 : -1;
    });
    var sum = rows.reduce(function (a, r) { return a + C.num(r.jumlah) * m.rt(r.pasar); }, 0);

    var kodes = {};
    pool.forEach(function (t) { kodes[t.kode] = 1; });
    var kodeOpts = [['', 'Semua aset']].concat(Object.keys(kodes).sort().map(function (k) { return [k, k]; }));
    var yearOpts = [['', 'Semua tahun']].concat(yearsOf(pool).map(function (y) { return [y, y]; }));

    var log = '<section class="section"><div class="section-head"><h2>Riwayat</h2></div><div class="filters">' +
      selectField('fd-kode', 'Aset', f.kode, kodeOpts) + selectField('fd-tahun', 'Tahun', f.tahun, yearOpts) + '</div>';
    if (!rows.length) {
      log += '<div class="panel empty"><p>Tidak ada catatan yang cocok dengan filter.</p></div>';
    } else {
      log += '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Aset</th><th class="num">Jumlah</th><th class="num">Per lembar / koin</th><th class="num">Pajak</th><th class="num">Diterima</th><th></th></tr></thead><tbody>' +
        rows.map(function (x) {
          var xc = ccyOf(x.pasar);
          return '<tr><td>' + fmtDate(x.tanggal) + (x.catatan ? '<span class="sub muted" style="font-weight:500">' + esc(x.catatan) + '</span>' : '') + '</td>' +
            '<td class="kode">' + esc(x.kode) + (m.all ? pill(x.pasar, true) : '') + '</td>' +
            '<td class="num">' + (C.qtyOf(x) > 0 ? qtyf(C.qtyOf(x), x.pasar) : '<span class="muted">–</span>') + '</td>' +
            '<td class="num">' + (x.dps !== '' && x.dps != null ? pxf(x.dps, xc) : '<span class="muted">–</span>') + '</td>' +
            '<td class="num">' + (x.pajak !== '' && x.pajak != null ? nfFor(0, 2).format(x.pajak) + '%' : '<span class="muted">–</span>') + '</td>' +
            '<td class="num gain">' + money(x.jumlah, xc) + '</td>' +
            '<td class="acts"><button class="btn ghost sm" data-act="edit-div" data-id="' + esc(x.id) + '" type="button">Ubah</button>' +
            '<button class="btn danger sm" data-act="del-div" data-id="' + esc(x.id) + '" type="button">Hapus</button></td></tr>';
        }).join('') +
        '</tbody><tfoot><tr><td colspan="5">' + rows.length + ' pembayaran' + (m.all ? ' (total dalam Rupiah)' : '') + '</td><td class="num">' + money(sum, ccy) + '</td><td></td></tr></tfoot></table></div>';
    }
    log += '</section>';

    return marketBanners(m) + '<section class="cols-2">' + summary + perKode + '</section>' + log;
  }

  // ---------- halaman: bulanan ----------
  function viewBulanan(m) {
    var months = m.months, ccy = m.dispCcy;
    if (!months.length) return marketBanners(m) + emptyState('Belum ada data bulanan', 'Profit per bulan muncul setelah Anda mencatat penjualan atau dividen.', !S.isSheet());

    var active = months.filter(function (x) { return x.trades || x.divCount; });
    var best = active.reduce(function (a, x) { return !a || x.total > a.total ? x : a; }, null);
    var worst = active.reduce(function (a, x) { return !a || x.total < a.total ? x : a; }, null);
    var totalReal = months.reduce(function (a, x) { return a + x.realized; }, 0);
    var totalDiv = months.reduce(function (a, x) { return a + x.dividend; }, 0);
    var plus = active.filter(function (x) { return x.total > 0; }).length;
    var minus = active.filter(function (x) { return x.total < 0; }).length;
    var dvName = m.all ? 'Dividen / reward' : noun(m.sel);

    var html = marketBanners(m) + '<section class="hero hero-tight"><div class="hero-figure">' +
      '<div class="lbl">Akumulasi profit jual + ' + dvName.toLowerCase() + (m.all ? ' (dalam Rupiah)' : '') + '</div>' +
      '<div class="big ' + cls(totalReal + totalDiv, ccy) + '">' + moneySigned(totalReal + totalDiv, ccy) + '</div>' +
      '<dl class="leader">' +
      lead('Bulan terbaik', best ? fmtMonth(best.month) + ' ' + moneySigned(best.total, ccy) : '–', { cls: best ? cls(best.total, ccy) : '' }) +
      lead('Bulan terburuk', worst ? fmtMonth(worst.month) + ' ' + moneySigned(worst.total, ccy) : '–', { cls: worst ? cls(worst.total, ccy) : '' }) +
      lead('Bulan untung / rugi', plus + ' / ' + minus) +
      '</dl>' +
      '<p class="muted" style="font-size:13px;margin-top:14px">Profit bulanan memakai profit yang sudah terealisasi saat jual dan ' + dvName.toLowerCase() + ' yang diterima. Naik turun harga aset yang belum dijual tidak masuk di sini; lihat <a href="#/dashboard">Dashboard</a>.</p></div>' +
      '<div class="chart-wrap"><div class="chart-head"><h2>Per bulan</h2>' +
      '<div class="legend"><span><i style="background:var(--gain)"></i>Profit jual</span><span><i style="background:var(--loss)"></i>Rugi jual</span><span><i style="background:var(--dividend)"></i>' + dvName + '</span></div></div>' +
      '<div class="chart-scroll"><div class="chart">' + Charts.monthly(months, { label: 'Profit per bulan, seluruh periode', fmt: function (n) { return money(n, ccy); } }) + '</div></div></div></section>';

    html += '<section class="section"><div class="section-head"><h2>Rincian</h2></div><div class="panel table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Bulan</th><th class="num">Transaksi</th><th class="num">Profit jual</th><th class="num">' + dvName + '</th><th class="num">Total bulan</th><th class="num">Kumulatif</th></tr></thead><tbody>' +
      months.slice().reverse().map(function (x) {
        return '<tr><td class="kode">' + fmtMonth(x.month) + '</td><td class="num">' + (x.trades || '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + cls(x.realized, ccy) + '">' + (sgn(x.realized, ccy) ? moneySigned(x.realized, ccy) : '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + (x.dividend ? 'gain' : '') + '">' + (x.dividend ? moneySigned(x.dividend, ccy) : '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + cls(x.total, ccy) + '"><strong>' + moneySigned(x.total, ccy) + '</strong></td>' +
          '<td class="num ' + cls(x.cumulative, ccy) + '">' + moneySigned(x.cumulative, ccy) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>Total</td><td class="num">' + months.reduce(function (a, x) { return a + x.trades; }, 0) + '</td>' +
      '<td class="num ' + cls(totalReal, ccy) + '">' + moneySigned(totalReal, ccy) + '</td><td class="num">' + moneySigned(totalDiv, ccy) + '</td>' +
      '<td class="num ' + cls(totalReal + totalDiv, ccy) + '">' + moneySigned(totalReal + totalDiv, ccy) + '</td><td></td></tr></tfoot></table></div></section>';
    return html;
  }

  // ---------- halaman: pengaturan ----------
  function viewPengaturan() {
    var st = S.settings, sheet = S.isSheet();
    var local = S.localData();
    var localCount = local.transaksi.length + local.dividen.length;
    var fxLive = S.prices.fx > 0 ? S.prices.fx : 0;

    var html = '<div>';

    var gm = S.mode() === 'google', am = S.mode() === 'apps', g = st.google;
    var origin = location.protocol === 'file:' ? '' : location.origin;
    html += '<section class="settings-block"><div><h2>Masuk dengan Google</h2><p>Login dengan akun Gmail Anda. Siapa pun yang diberi akses ke spreadsheet lewat Bagikan di Drive bisa masuk dengan akunnya sendiri. Tanpa token yang dibagikan.</p></div><div>' +
      '<div class="banner" style="margin-bottom:16px">' + (gm
        ? '<div><strong>Tersambung' + (g.email ? ' sebagai ' + esc(g.email) : '') + '.</strong> ' + (S.needLogin() ? 'Sesi login habis, klik Masuk dengan Google.' : 'Data dibaca dan ditulis ke spreadsheet langsung dari browser ini.') + '</div>'
        : '<div><strong>' + (am ? 'Sedang memakai Apps Script.' : 'Belum tersambung.') + '</strong> Isi Client ID dan tautan spreadsheet, lalu masuk.</div>') + '</div>' +
      (location.protocol === 'file:' ? '<div class="banner err" style="margin-bottom:16px"><div>Login Google tidak berjalan dari file lokal. Buka lewat alamat GitHub Pages Anda.</div></div>' : '') +
      '<form id="form-google" class="form-grid" autocomplete="off">' +
      '<div class="field wide"><label for="g-client">Client ID Google</label><input id="g-client" name="clientId" type="text" placeholder="123456-abc.apps.googleusercontent.com" value="' + esc(S.googleCfg().clientId) + '"><span class="hint">Dari Google Cloud Console (langkah di bawah). Client ID bukan rahasia.</span></div>' +
      '<div class="field wide"><label for="g-sheet">Tautan atau ID spreadsheet</label><input id="g-sheet" name="sheet" type="text" placeholder="https://docs.google.com/spreadsheets/d/…" value="' + esc(S.googleCfg().sheetId) + '"></div>' +
      '<div class="wide" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">' + (gm ? 'Simpan dan masuk ulang' : 'Masuk dengan Google') + '</button>' +
      (gm ? '<button class="btn outline" type="button" data-act="reload">Muat ulang dari Sheet</button><button class="btn danger" type="button" data-act="google-logout">Putuskan</button>' : '') +
      '</div></form>' +
      '<details style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">Cara mendapatkan Client ID (sekali saja)</summary><ol style="margin:10px 0 0 18px;line-height:1.6">' +
      '<li>Buka <strong>console.cloud.google.com</strong>, buat project baru.</li>' +
      '<li><strong>APIs &amp; Services → Library</strong>, aktifkan <strong>Google Sheets API</strong>.</li>' +
      '<li><strong>OAuth consent screen</strong>: tipe External, isi nama aplikasi dan email. Biarkan status Testing, lalu tambahkan semua akun Gmail Anda di <strong>Test users</strong>.</li>' +
      '<li><strong>Credentials → Create credentials → OAuth client ID</strong>, tipe <strong>Web application</strong>.</li>' +
      '<li>Di <strong>Authorized JavaScript origins</strong> isi <code>' + esc(origin || 'https://<username>.github.io') + '</code> (tanpa garis miring di akhir).</li>' +
      '<li>Salin Client ID ke kolom di atas. Google akan menampilkan peringatan “aplikasi belum diverifikasi”; itu normal untuk aplikasi pribadi, pilih Lanjutkan.</li></ol>' +
      '<p class="muted" style="margin-top:8px;font-size:13px">Izin yang diminta adalah akses ke spreadsheet (cakupan luas: semua spreadsheet di akun yang login) dan alamat email. Aplikasi hanya membuka spreadsheet yang Anda tentukan. Token login berlaku sekitar satu jam; setelah itu klik Masuk lagi.</p></details>' +
      (gm && localCount ? '<div class="row"><button class="btn outline" type="button" data-act="upload-local">Unggah ' + local.transaksi.length + ' transaksi dan ' + local.dividen.length + ' dividen dari browser ini ke Sheet</button></div><p class="muted" style="margin-top:8px;font-size:13px">Ini mengganti seluruh isi tab transaksi dan dividen di Sheet.</p>' : '') +
      '</div></section>';

    html += '<section class="settings-block"><div><h2>Apps Script (opsional)</h2><p>Hanya perlu bila Anda ingin mencatat lewat chat dengan Claude. Cara ini memakai token, bukan login.</p></div><div>' +
      '<form id="form-conn" class="form-grid" autocomplete="off">' +
      '<div class="field wide"><label for="s-url">URL Web App</label><input id="s-url" name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(st.url) + '"></div>' +
      '<div class="field wide"><label for="s-token">Token (TOKEN)</label><input id="s-token" name="token" type="password" autocomplete="off" value="' + esc(st.token) + '"><span class="hint">Sama persis dengan TOKEN di Code.gs. Disimpan hanya di browser ini. Jangan isi dengan CHAT_TOKEN.</span></div>' +
      '<div class="wide" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">' + (am ? 'Simpan dan muat ulang' : 'Sambungkan lewat Apps Script') + '</button>' +
      (am ? '<button class="btn outline" type="button" data-act="reload">Muat ulang dari Sheet</button><button class="btn danger" type="button" data-act="disconnect">Putuskan</button>' : '') +
      '</div></form>' +
      (am && localCount ? '<div class="row"><button class="btn outline" type="button" data-act="upload-local">Unggah ' + local.transaksi.length + ' transaksi dan ' + local.dividen.length + ' dividen dari browser ini ke Sheet</button></div>' : '') +
      '</div></section>';

    html += '<section class="settings-block"><div><h2>Catat lewat chat</h2><p>Tulis transaksi langsung ke Claude, misalnya “beli BBCA 10 lot harga 9000” atau “dividen TLKM 360000”.</p></div><div>' +
      '<p style="color:var(--ink)">Lewat Apps Script di atas, Claude mengirimnya ke Google Sheets Anda memakai <code>CHAT_TOKEN</code>, token terpisah yang hanya bisa menambah catatan dan membaca posisi. Tidak bisa mengubah atau menghapus data. Setelah mencatat, klik <strong>Muat ulang dari Sheet</strong> di sini untuk melihat hasilnya.</p>' +
      '<p style="margin-top:10px">Pasang <code>CHAT_TOKEN</code> di Code.gs (langkah ada di README). Token ini tidak pernah disimpan di aplikasi ini.</p></div></section>';

    html += '<section class="settings-block"><div><h2>Biaya broker</h2><p>Dipakai untuk mengisi fee otomatis saat mencatat transaksi. Fee tetap bisa diubah per transaksi.</p></div><div>' +
      '<form id="form-fee" class="form-grid">' +
      ORDER.map(function (mk) {
        return '<div class="field wide" style="margin-bottom:-4px"><span class="lbl">' + esc(MK[mk].label) + '</span></div>' +
          '<div class="field"><label for="fee-' + mk + '-b">Fee beli (%)</label><input id="fee-' + mk + '-b" name="fee_' + mk + '_beli" type="number" step="0.001" min="0" max="5" value="' + esc(st.fee[mk].beli) + '"></div>' +
          '<div class="field"><label for="fee-' + mk + '-j">Fee jual (%)</label><input id="fee-' + mk + '-j" name="fee_' + mk + '_jual" type="number" step="0.001" min="0" max="5" value="' + esc(st.fee[mk].jual) + '">' +
          (mk === 'ID' ? '<span class="hint">Biasanya sudah termasuk pajak penjualan 0,1%.</span>' : '') + '</div>';
      }).join('') +
      '<div class="wide"><button class="btn primary" type="submit">Simpan biaya</button></div></form></div></section>';

    html += '<section class="settings-block"><div><h2>Mata uang dan kurs</h2><p>Saham Indonesia dicatat dalam Rupiah, saham US dalam dolar. Tampilan Semua menggabungkan semuanya dalam Rupiah.</p></div><div>' +
      '<form id="form-ccy" class="form-grid">' +
      '<div class="field"><label for="s-ccy">Crypto dicatat dalam</label><select id="s-ccy" name="cryptoCcy"><option value="IDR"' + (st.cryptoCcy === 'IDR' ? ' selected' : '') + '>Rupiah (Rp)</option><option value="USD"' + (st.cryptoCcy === 'USD' ? ' selected' : '') + '>Dolar (US$)</option></select>' +
      '<span class="hint">Ganti ini sebelum mencatat. Catatan lama tidak dikonversi.</span></div>' +
      '<div class="field"><label for="s-kurs">Kurs cadangan (Rp per US$)</label><input id="s-kurs" name="kurs" type="number" min="0" step="any" value="' + (st.kurs > 0 ? esc(st.kurs) : '') + '"><span class="hint">' +
      (fxLive ? 'Kurs otomatis saat ini ' + idr(fxLive) + ' dan dipakai lebih dulu.' : 'Dipakai bila kurs otomatis belum tersedia.') + '</span></div>' +
      '<div class="wide"><button class="btn primary" type="submit">Simpan</button></div></form></div></section>';

    html += '<section class="settings-block"><div><h2>Data</h2><p>Cadangkan atau pindahkan data. Cadangan JSON bisa diimpor kembali.</p></div><div>' +
      '<div class="row" style="margin-top:0"><button class="btn outline" data-act="export-json" type="button">Ekspor cadangan (JSON)</button>' +
      '<button class="btn outline" data-act="export-trx" type="button">Ekspor transaksi (CSV)</button>' +
      '<button class="btn outline" data-act="export-div" type="button">Ekspor dividen (CSV)</button>' +
      '<label class="btn outline" style="cursor:pointer">Impor cadangan<input type="file" id="import-file" accept="application/json,.json" hidden></label></div>' +
      (!sheet ? '<div class="row"><button class="btn ghost" data-act="load-sample" type="button">Muat data contoh</button><button class="btn ghost" data-act="clear-sample" type="button">Hapus data contoh</button></div>' : '') +
      '</div></section>';

    return html + '</div>';
  }

  var VIEWS = { dashboard: viewDashboard, transaksi: viewTransaksi, dividen: viewDividen, bulanan: viewBulanan, pengaturan: viewPengaturan };

  // ---------- render ----------
  function renderNav() {
    var navHtml = ROUTES.map(function (r) {
      return '<a href="#/' + r.id + '"' + (state.route === r.id ? ' aria-current="page"' : '') + '>' + ICONS[r.icon] + '<span>' + r.label + '</span></a>';
    }).join('');
    $('#nav').innerHTML = navHtml;
    $('#tabbar').innerHTML = navHtml;
  }

  function renderMarkets(route) {
    var el = $('#markets');
    el.hidden = !route.markets;
    if (!route.markets) return;
    var sel = selMarket();
    el.innerHTML = [['ALL', 'Semua']].concat(ORDER.map(function (mk) { return [mk, MK[mk].label]; })).map(function (o) {
      return '<button type="button" data-act="market" data-m="' + o[0] + '" aria-pressed="' + (o[0] === sel) + '">' + esc(o[1]) + '</button>';
    }).join('');
  }

  function renderSync() {
    var el = $('#sync');
    if (S.needLogin()) {
      el.className = 'sync err';
      el.innerHTML = '<span class="dot"></span>Belum masuk<br><button class="linkbtn" data-act="google-login" type="button">Masuk dengan Google</button>';
    } else if (S.isSheet()) {
      var bad = !!state.loadError;
      el.className = 'sync ' + (bad ? 'err' : 'on');
      el.innerHTML = '<span class="dot"></span>' + (bad ? 'Gagal terhubung ke Google Sheets' : 'Tersambung' + (S.mode() === 'google' && S.email() ? ' · ' + esc(S.email()) : ' ke Google Sheets')) +
        '<br><span style="opacity:.8">' + (S.prices.at ? 'Harga: ' + hhmm(S.prices.at) : 'Harga belum diperbarui') + (state.live === 'on' ? ' · crypto live' : '') + '</span>';
    } else {
      el.className = 'sync';
      el.innerHTML = '<span class="dot"></span>Mode lokal<br><span style="opacity:.8">Data hanya di browser ini. <a href="#/pengaturan">Hubungkan Sheet</a>' + (state.live === 'on' ? ' · crypto live' : '') + '</span>';
    }
    var btn = $('#btn-refresh');
    btn.disabled = state.refreshing;
    btn.textContent = state.refreshing ? 'Memperbarui…' : (S.needLogin() ? 'Masuk dengan Google' : 'Perbarui harga');
  }

  function render() {
    var route = ROUTES.filter(function (r) { return r.id === state.route; })[0] || ROUTES[0];
    $('#page-title').textContent = route.label;
    document.title = route.label + ' · Porto';
    renderNav();
    renderMarkets(route);
    var gate = S.needLogin() && route.id !== 'pengaturan' && !S.data.transaksi.length && !S.data.dividen.length;
    $('#view').innerHTML = gate ? loginGate() : VIEWS[route.id](compute());
    liveKeys();
    renderSync();
    var sel = selMarket();
    $('#btn-add-div').textContent = sel === 'CRYPTO' ? 'Catat reward' : 'Catat dividen';
    if (state.focusId) {
      var f = document.getElementById(state.focusId);
      if (f) f.focus();
      state.focusId = '';
    }
  }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, kind === 'err' ? 6000 : 3200);
  }

  function setMarket(mk) {
    S.saveSettings({ market: mk });
    state.f = { trx: { kode: '', jenis: '', tahun: '' }, div: { kode: '', tahun: '' } };
    render();
  }

  // ---------- dialog ----------
  function openDialog(opts) {
    var dlg = $('#dlg');
    dlg.innerHTML = '<div class="dlg-head"><h2>' + esc(opts.title) + '</h2><button class="x" type="button" data-dlg="close" aria-label="Tutup">×</button></div>' +
      '<div class="dlg-body">' + opts.body + '<div class="form-error" id="dlg-error" hidden></div></div>' +
      '<div class="dlg-foot"><button class="btn ghost" type="button" data-dlg="close">Batal</button>' +
      (opts.extra || '') +
      '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + '" type="submit" form="dlg-form" id="dlg-ok">' + esc(opts.ok || 'Simpan') + '</button></div>';
    dlg._onSubmit = opts.onSubmit;
    if (opts.onOpen) opts.onOpen(dlg);
    if (!dlg.open) dlg.showModal();
    var first = dlg.querySelector('input:not([type=radio]):not([type=hidden]), select');
    if (first && !opts.noFocus) first.focus();
  }

  function closeDialog() {
    var dlg = $('#dlg');
    if (dlg.open) dlg.close();
  }

  function dialogError(msg) {
    var el = $('#dlg-error');
    el.textContent = msg;
    el.hidden = !msg;
  }

  function confirmDialog(title, message, okLabel) {
    return new Promise(function (resolve) {
      var done = false;
      openDialog({
        title: title,
        body: '<form id="dlg-form"><p style="margin:0">' + message + '</p></form>',
        ok: okLabel || 'Hapus', danger: true, noFocus: true,
        onSubmit: function () { done = true; resolve(true); return Promise.resolve(); }
      });
      $('#dlg').addEventListener('close', function once() {
        $('#dlg').removeEventListener('close', once);
        if (!done) resolve(false);
      });
    });
  }

  function marketSeg(current) {
    return '<div class="field wide"><span class="lbl">Pasar</span><div class="seg" role="radiogroup" aria-label="Pasar">' +
      ORDER.map(function (mk) {
        return '<label><input type="radio" name="pasar" value="' + mk + '"' + (current === mk ? ' checked' : '') + '><span>' + esc(MK[mk].short) + '</span></label>';
      }).join('') + '</div></div>';
  }

  function ccyInfo(mk) {
    var ccy = ccyOf(mk);
    return { ccy: ccy, sym: ccy === 'USD' ? 'US$' : 'Rp', dec: ccy === 'USD' ? 2 : 0, unit: mk === 'CRYPTO' ? 'koin' : 'lembar' };
  }

  function defaultMarket() { var s = selMarket(); return s === 'ALL' ? 'ID' : s; }

  // ---------- form transaksi ----------
  function trxFormHtml(t) {
    return '<form id="dlg-form" class="form-grid" autocomplete="off">' +
      marketSeg(t.pasar) +
      '<div class="field"><label for="f-tanggal">Tanggal</label><input id="f-tanggal" name="tanggal" type="date" required value="' + esc(t.tanggal) + '"></div>' +
      '<div class="field"><label for="f-kode">Kode</label><input id="f-kode" name="kode" class="up" list="kodes" required maxlength="10" value="' + esc(t.kode) + '"><datalist id="kodes"></datalist></div>' +
      '<div class="field wide"><span class="lbl">Jenis</span><div class="seg" role="radiogroup" aria-label="Jenis transaksi"><label><input type="radio" name="jenis" value="BELI"' + (t.jenis === 'BELI' ? ' checked' : '') + '><span>Beli</span></label><label><input type="radio" name="jenis" value="JUAL"' + (t.jenis === 'JUAL' ? ' checked' : '') + '><span>Jual</span></label></div></div>' +
      '<div class="field"><label for="f-qty" id="f-lbl-qty">Jumlah</label><input id="f-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" required value="' + esc(t.qty) + '"><span class="hint" id="f-hint-qty"></span></div>' +
      '<div class="field"><label for="f-harga" id="f-lbl-harga">Harga</label><input id="f-harga" name="harga" type="number" min="0" step="any" inputmode="decimal" required value="' + esc(t.harga) + '"></div>' +
      '<div class="field"><label for="f-fee" id="f-lbl-fee">Fee</label><input id="f-fee" name="fee" type="number" min="0" step="any" inputmode="decimal" value="' + esc(t.fee) + '"><span class="hint" id="f-fee-hint"></span></div>' +
      '<div class="field"><label for="f-cat">Catatan</label><input id="f-cat" name="catatan" maxlength="120" value="' + esc(t.catatan) + '"></div>' +
      '<div class="wide form-total" id="f-total"></div></form>';
  }

  function wireTrxForm() {
    var form = $('#dlg-form');
    function update() {
      var fd = new FormData(form);
      var mk = fd.get('pasar'), M = MK[mk], ci = ccyInfo(mk);
      var jenis = fd.get('jenis');
      var qty = C.num(fd.get('qty')), harga = C.num(fd.get('harga')), feeRaw = fd.get('fee');
      $('#f-lbl-qty').textContent = M.qtyLabel;
      $('#f-hint-qty').textContent = M.qtyHint;
      var q = $('#f-qty');
      q.step = M.integerQty ? '1' : 'any';
      q.min = M.integerQty ? '1' : '0';
      $('#f-lbl-harga').textContent = 'Harga per ' + ci.unit + ' (' + ci.sym + ')';
      $('#f-lbl-fee').textContent = 'Fee (' + ci.sym + ')';
      $('#f-kode').placeholder = M.kodeHint;
      var dl = $('#kodes');
      var wanted = knownKodes(mk).join('|');
      if (dl.dataset.k !== mk + wanted) {
        dl.dataset.k = mk + wanted;
        dl.innerHTML = knownKodes(mk).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('');
      }
      var fee = S.settings.fee[mk];
      var est = C.estimateFee(jenis, qty, harga, fee.beli, fee.jual, M.mult, ci.dec);
      var used = feeRaw === '' ? est : C.num(feeRaw);
      var gross = (M.integerQty ? Math.round(qty) : qty) * M.mult * harga;
      $('#f-fee-hint').textContent = 'Kosongkan untuk otomatis: ' + money(est, ci.ccy) + ' (' + String(jenis === 'JUAL' ? fee.jual : fee.beli).replace('.', ',') + '%)';
      $('#f-total').innerHTML = '<span>Nilai ' + money(gross, ci.ccy) + ' · Fee ' + money(used, ci.ccy) + '</span><strong>' +
        (jenis === 'JUAL' ? 'Diterima ' + money(gross - used, ci.ccy) : 'Dibayar ' + money(gross + used, ci.ccy)) + '</strong>';
    }
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  }

  function openTrxForm(id) {
    var d = S.data;
    var t = id ? d.transaksi.filter(function (x) { return x.id === id; })[0] : null;
    var model = t ? Object.assign({}, t) : { id: '', pasar: defaultMarket(), tanggal: ymd(new Date()), kode: '', jenis: 'BELI', qty: '', harga: '', fee: '', catatan: '' };
    openDialog({
      title: t ? 'Ubah transaksi' : 'Catat transaksi',
      body: trxFormHtml(model),
      ok: 'Simpan transaksi',
      onOpen: function () { setTimeout(wireTrxForm, 0); },
      onSubmit: function () {
        var fd = new FormData($('#dlg-form'));
        var mk = fd.get('pasar'), M = MK[mk], ci = ccyInfo(mk);
        var row = {
          id: model.id, pasar: mk,
          tanggal: fd.get('tanggal'),
          kode: C.upper(fd.get('kode')),
          jenis: fd.get('jenis'),
          qty: C.num(fd.get('qty')),
          harga: C.num(fd.get('harga')),
          fee: fd.get('fee'),
          catatan: String(fd.get('catatan') || '').trim()
        };
        if (!M.kodeRe.test(row.kode)) return Promise.reject(new Error(M.kodeMsg));
        if (!row.tanggal) return Promise.reject(new Error('Isi tanggal transaksi.'));
        if (!(row.qty > 0)) return Promise.reject(new Error('Jumlah harus lebih dari 0.'));
        if (M.integerQty && Math.round(row.qty) !== row.qty) return Promise.reject(new Error('Jumlah lot harus bilangan bulat, minimal 1.'));
        if (!(row.harga > 0)) return Promise.reject(new Error('Harga harus lebih dari 0.'));
        var fee = S.settings.fee[mk];
        row.fee = row.fee === '' ? C.estimateFee(row.jenis, row.qty, row.harga, fee.beli, fee.jual, M.mult, ci.dec) : C.num(row.fee);
        if (row.fee < 0) return Promise.reject(new Error('Fee tidak boleh negatif.'));

        var others = d.transaksi.filter(function (x) { return x.id !== model.id; });
        var cand = Object.assign({}, row, { id: model.id || '__baru__' });
        var bad = newWarning(d.transaksi, others.concat([cand]));
        if (bad) return Promise.reject(new Error(bad.message + (bad.id === cand.id ? '.' : ' pada ' + fmtDate(bad.tanggal) + '. Perubahan ini membuat penjualan tersebut tidak valid.')));

        var p = model.id ? S.update('transaksi', row) : S.add('transaksi', row);
        return p.then(function () {
          // tampilkan pasar yang baru saja diisi agar hasilnya langsung terlihat
          if (selMarket() !== 'ALL' && selMarket() !== mk) S.saveSettings({ market: mk });
          toast(model.id ? 'Transaksi diperbarui' : 'Transaksi disimpan');
          render();
        });
      }
    });
  }

  // ---------- form dividen ----------
  var DEFAULT_TAX = { ID: 10, US: 0, CRYPTO: 0 };

  function openDivForm(id) {
    var d = S.data;
    var x = id ? d.dividen.filter(function (r) { return r.id === id; })[0] : null;
    var dm = defaultMarket();
    var model = x ? Object.assign({}, x) : { id: '', pasar: dm, tanggal: ymd(new Date()), kode: '', qty: '', dps: '', pajak: DEFAULT_TAX[dm], jumlah: '', catatan: '' };
    var touched = !!x;
    var taxTouched = !!x;

    openDialog({
      title: x ? 'Ubah catatan ' + nounLower(model.pasar) : (dm === 'CRYPTO' ? 'Catat reward' : 'Catat dividen'),
      body: '<form id="dlg-form" class="form-grid" autocomplete="off">' +
        marketSeg(model.pasar) +
        '<div class="field"><label for="d-tanggal">Tanggal diterima</label><input id="d-tanggal" name="tanggal" type="date" required value="' + esc(model.tanggal) + '"></div>' +
        '<div class="field"><label for="d-kode">Kode</label><input id="d-kode" name="kode" class="up" list="kodes2" required maxlength="10" value="' + esc(model.kode) + '"><datalist id="kodes2"></datalist></div>' +
        '<div class="field"><label for="d-qty" id="d-lbl-qty">Jumlah (opsional)</label><input id="d-qty" name="qty" type="number" min="0" step="any" inputmode="decimal" value="' + esc(model.qty) + '"></div>' +
        '<div class="field"><label for="d-dps" id="d-lbl-dps">Per lembar (opsional)</label><input id="d-dps" name="dps" type="number" min="0" step="any" inputmode="decimal" value="' + esc(model.dps) + '"></div>' +
        '<div class="field"><label for="d-pajak">Pajak (%)</label><input id="d-pajak" name="pajak" type="number" min="0" max="100" step="any" inputmode="decimal" value="' + esc(model.pajak) + '"><span class="hint" id="d-pajak-hint"></span></div>' +
        '<div class="field"><label for="d-jumlah" id="d-lbl-jumlah">Total diterima</label><input id="d-jumlah" name="jumlah" type="number" min="0" step="any" inputmode="decimal" required value="' + esc(model.jumlah) + '"><span class="hint">Terisi otomatis dari jumlah × per lembar setelah pajak. Boleh diubah.</span></div>' +
        '<div class="field wide"><label for="d-cat">Catatan</label><input id="d-cat" name="catatan" maxlength="120" value="' + esc(model.catatan) + '"></div></form>',
      ok: 'Simpan',
      onOpen: function () {
        setTimeout(function () {
          var form = $('#dlg-form');
          var jumlah = $('#d-jumlah');
          function mkNow() { return new FormData(form).get('pasar'); }
          function labels() {
            var mk = mkNow(), M = MK[mk], ci = ccyInfo(mk);
            $('#d-lbl-qty').textContent = 'Jumlah ' + M.unit + ' (opsional)';
            $('#d-lbl-dps').textContent = (mk === 'CRYPTO' ? 'Reward per koin' : 'Dividen per lembar') + ' (' + ci.sym + ', opsional)';
            $('#d-lbl-jumlah').textContent = 'Total diterima (' + ci.sym + ')';
            $('#d-kode').placeholder = M.kodeHint;
            $('#d-pajak-hint').textContent = mk === 'ID' ? 'Dividen saham Indonesia umumnya dipotong 10%.' : 'Isi sesuai potongan di broker atau platform Anda.';
            var dl = $('#kodes2');
            dl.innerHTML = knownKodes(mk).map(function (k) { return '<option value="' + esc(k) + '">'; }).join('');
          }
          function auto() {
            if (touched) return;
            var mk = mkNow(), M = MK[mk], ci = ccyInfo(mk);
            var qty = C.num($('#d-qty').value), dps = C.num($('#d-dps').value), tax = C.num($('#d-pajak').value);
            if (qty > 0 && dps > 0) {
              var f = Math.pow(10, ci.dec);
              jumlah.value = Math.round(qty * M.mult * dps * (1 - tax / 100) * f) / f;
            }
          }
          jumlah.addEventListener('input', function () { touched = true; });
          $('#d-pajak').addEventListener('input', function () { taxTouched = true; });
          form.addEventListener('change', function (e) {
            if (e.target.name === 'pasar') {
              if (!taxTouched) $('#d-pajak').value = DEFAULT_TAX[mkNow()];
              labels();
              auto();
            }
          });
          form.addEventListener('input', function (e) { if (e.target !== jumlah) auto(); });
          labels();
        }, 0);
      },
      onSubmit: function () {
        var fd = new FormData($('#dlg-form'));
        var mk = fd.get('pasar'), M = MK[mk];
        var row = {
          id: model.id, pasar: mk,
          tanggal: fd.get('tanggal'),
          kode: C.upper(fd.get('kode')),
          qty: fd.get('qty') === '' ? '' : C.num(fd.get('qty')),
          dps: fd.get('dps') === '' ? '' : C.num(fd.get('dps')),
          pajak: fd.get('pajak') === '' ? '' : C.num(fd.get('pajak')),
          jumlah: C.num(fd.get('jumlah')),
          catatan: String(fd.get('catatan') || '').trim()
        };
        if (!M.kodeRe.test(row.kode)) return Promise.reject(new Error(M.kodeMsg));
        if (!row.tanggal) return Promise.reject(new Error('Isi tanggal diterima.'));
        if (!(row.jumlah > 0)) return Promise.reject(new Error('Total diterima harus lebih dari 0.'));
        var p = model.id ? S.update('dividen', row) : S.add('dividen', row);
        return p.then(function () {
          if (selMarket() !== 'ALL' && selMarket() !== mk) S.saveSettings({ market: mk });
          toast(model.id ? 'Catatan diperbarui' : 'Catatan disimpan');
          render();
        });
      }
    });
  }

  function openPriceForm(key) {
    var parts = key.split(':'), mk = parts[0], kode = parts[1];
    var ci = ccyInfo(mk);
    var cur = S.manual[key] || '';
    openDialog({
      title: 'Harga ' + kode,
      body: '<form id="dlg-form"><div class="field"><label for="p-harga">Harga per ' + ci.unit + ' (' + ci.sym + ')</label><input id="p-harga" type="number" min="0" step="any" inputmode="decimal" value="' + esc(cur) + '" required>' +
        '<span class="hint">Dipakai bila harga otomatis tidak tersedia. Harga otomatis selalu didahulukan.</span></div></form>',
      ok: 'Simpan harga',
      extra: cur ? '<button class="btn danger" type="button" data-dlg="clear-price" data-key="' + esc(key) + '">Hapus harga</button>' : '',
      onSubmit: function () {
        var v = C.num($('#p-harga').value);
        if (!(v > 0)) return Promise.reject(new Error('Harga harus lebih dari 0.'));
        S.setManual(key, v);
        render();
        return Promise.resolve();
      }
    });
  }

  // ---------- harga ----------
  function openKeys() {
    var keys = [];
    ORDER.forEach(function (mk) {
      var trx = S.data.transaksi.filter(function (t) { return t.pasar === mk; });
      C.buildLedger(trx, MK[mk].mult).open.forEach(function (p) { keys.push(mk + ':' + p.kode); });
    });
    return keys;
  }

  /** Google: bila token belum ada, minta login (hanya boleh dari klik pengguna). */
  function ensureLogin() {
    if (!S.needLogin()) return Promise.resolve();
    return S.signIn().then(function () { return S.reload(); }).then(function () { state.loadError = ''; });
  }

  // ---------- crypto real-time (WebSocket Binance) ----------
  var liveTimer = null;
  var live = root_Live().create({
    onTick: function (key, tick) {
      S.setLive(key, tick);
      if (liveTimer) return;
      liveTimer = setTimeout(function () {
        liveTimer = null;
        S.savePrices();
        var dlg = $('#dlg');
        if (state.route === 'dashboard' && !(dlg && dlg.open)) render();
      }, 1000);
    },
    onState: function (st) { state.live = st; renderSync(); }
  });
  function root_Live() { return window.Live; }
  function liveKeys() { live.setKeys(openKeys()); }

  function refreshPrices(manualClick) {
    if (!S.isSheet()) {
      if (manualClick) toast('Harga otomatis butuh koneksi ke Google Sheets. Buka Pengaturan.', 'err');
      return Promise.resolve();
    }
    if (S.needLogin() && !manualClick) return Promise.resolve();
    state.refreshing = true;
    renderSync();
    return ensureLogin().then(function () { return S.fetchPrices(openKeys()); }).then(function () {
      if (manualClick) toast('Harga diperbarui');
    }).catch(function (e) {
      toast('Gagal memperbarui harga: ' + e.message, 'err');
    }).then(function () {
      state.refreshing = false;
      render();
    });
  }

  // ---------- ekspor / impor ----------
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function csv(kind) {
    var cols = S.COLS[kind];
    var lines = [cols.join(',')].concat(S.data[kind].map(function (r) {
      return cols.map(function (c) {
        var v = String(r[c] == null ? '' : r[c]);
        // cegah injeksi rumus saat dibuka di spreadsheet
        if (/^[=+\-@]/.test(v) && isNaN(Number(v))) v = "'" + v;
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }));
    return '﻿' + lines.join('\n');
  }

  function sampleData() {
    var now = new Date();
    function at(back, day) {
      var d = new Date(now.getFullYear(), now.getMonth() - back, day);
      return d > now ? null : ymd(d);
    }
    function trx(mk, back, day, kode, jenis, qty, harga) {
      var t = at(back, day);
      if (!t) return null;
      var ci = ccyInfo(mk), fee = S.settings.fee[mk];
      return { pasar: mk, tanggal: t, kode: kode, jenis: jenis, qty: qty, harga: harga,
        fee: C.estimateFee(jenis, qty, harga, fee.beli, fee.jual, MK[mk].mult, ci.dec), catatan: 'Contoh' };
    }
    function div(mk, back, day, kode, jumlah) {
      var t = at(back, day);
      return t ? { pasar: mk, tanggal: t, kode: kode, qty: '', dps: '', pajak: DEFAULT_TAX[mk], jumlah: jumlah, catatan: 'Contoh' } : null;
    }
    var idrCrypto = ccyOf('CRYPTO') === 'IDR';
    var btcBuy = idrCrypto ? 1450000000 : 88000, btcSell = idrCrypto ? 1620000000 : 98000, ethBuy = idrCrypto ? 48000000 : 2900;
    return {
      transaksi: [
        trx('ID', 8, 10, 'BBCA', 'BELI', 10, 9000), trx('ID', 7, 15, 'TLKM', 'BELI', 20, 3100),
        trx('ID', 6, 8, 'BMRI', 'BELI', 15, 5800), trx('ID', 5, 12, 'TLKM', 'JUAL', 5, 3350),
        trx('ID', 4, 3, 'ASII', 'BELI', 20, 5000), trx('ID', 3, 18, 'BMRI', 'JUAL', 5, 5500),
        trx('ID', 1, 14, 'ASII', 'JUAL', 10, 5350),
        trx('US', 6, 9, 'AAPL', 'BELI', 3, 195), trx('US', 5, 20, 'MSFT', 'BELI', 1.5, 410),
        trx('US', 2, 11, 'AAPL', 'JUAL', 1, 228),
        trx('CRYPTO', 5, 6, 'BTC', 'BELI', 0.02, btcBuy), trx('CRYPTO', 4, 17, 'ETH', 'BELI', 0.3, ethBuy),
        trx('CRYPTO', 1, 22, 'BTC', 'JUAL', 0.005, btcSell)
      ].filter(Boolean),
      dividen: [
        div('ID', 5, 20, 'BBCA', 450000), div('ID', 2, 22, 'TLKM', 360000), div('ID', 1, 25, 'ASII', 270000),
        div('US', 3, 14, 'AAPL', 2.1)
      ].filter(Boolean)
    };
  }

  // ---------- aksi ----------
  function guard(btn, fn) {
    if (btn) btn.disabled = true;
    return Promise.resolve().then(fn).catch(function (e) { toast(e.message || String(e), 'err'); })
      .then(function () { if (btn && document.body.contains(btn)) btn.disabled = false; });
  }

  function reloadFromSheet(btn) {
    return guard(btn, function () {
      return ensureLogin().then(function () { return S.reload(); }).then(function () {
        state.loadError = '';
        toast('Data dimuat dari Google Sheets');
        render();
        return refreshPrices(false);
      }).catch(function (e) {
        state.loadError = e.message;
        render();
        throw e;
      });
    });
  }

  var ACTIONS = {
    'add-trx': function () { openTrxForm(); },
    'add-div': function () { openDivForm(); },
    'edit-trx': function (b) { openTrxForm(b.dataset.id); },
    'edit-div': function (b) { openDivForm(b.dataset.id); },
    'market': function (b) { setMarket(b.dataset.m); },
    'del-trx': function (b) {
      var t = S.data.transaksi.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!t) return;
      var rest = S.data.transaksi.filter(function (x) { return x.id !== t.id; });
      var broken = !!newWarning(S.data.transaksi, rest);
      confirmDialog('Hapus transaksi?', esc(fmtDate(t.tanggal) + ' · ' + (t.jenis === 'BELI' ? 'Beli ' : 'Jual ') + t.kode + ' ' + qtyf(C.qtyOf(t), t.pasar) + ' @ ' + pxf(C.num(t.harga), ccyOf(t.pasar))) +
        '.' + (broken ? ' <strong>Menghapus ini membuat penjualan lain melebihi kepemilikan.</strong>' : '') + ' Tindakan ini tidak bisa dibatalkan.').then(function (ok) {
        if (!ok) return;
        S.remove('transaksi', t.id).then(function () { toast('Transaksi dihapus'); render(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    },
    'del-div': function (b) {
      var x = S.data.dividen.filter(function (r) { return r.id === b.dataset.id; })[0];
      if (!x) return;
      confirmDialog('Hapus catatan ' + nounLower(x.pasar) + '?', esc(fmtDate(x.tanggal) + ' · ' + x.kode + ' ' + money(x.jumlah, ccyOf(x.pasar))) + '. Tindakan ini tidak bisa dibatalkan.').then(function (ok) {
        if (!ok) return;
        S.remove('dividen', x.id).then(function () { toast('Catatan dihapus'); render(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    },
    'price': function (b) { openPriceForm(b.dataset.key); },
    'reload': function (b) { reloadFromSheet(b); },
    'google-login': function (b) { reloadFromSheet(b); },
    'google-logout': function () {
      confirmDialog('Putuskan Google?', 'Aplikasi keluar dari akun Google dan kembali ke mode lokal. Data di spreadsheet tidak dihapus.', 'Putuskan').then(function (ok) {
        if (!ok) return;
        S.disconnect();
        state.loadError = '';
        toast('Terputus dari Google');
        render();
      });
    },
    'disconnect': function () {
      confirmDialog('Putuskan Google Sheets?', 'Aplikasi kembali ke mode lokal dan menampilkan data yang tersimpan di browser ini. Data di spreadsheet tidak dihapus.', 'Putuskan').then(function (ok) {
        if (!ok) return;
        S.disconnect();
        state.loadError = '';
        toast('Terputus dari Google Sheets');
        render();
      });
    },
    'upload-local': function (b) {
      var l = S.localData();
      confirmDialog('Unggah data lokal ke Sheet?', 'Isi semua tab transaksi dan dividen di spreadsheet akan diganti dengan ' + l.transaksi.length + ' transaksi dan ' + l.dividen.length + ' dividen dari browser ini.', 'Unggah').then(function (ok) {
        if (!ok) return;
        guard(b, function () { return S.uploadLocal().then(function () { toast('Data terunggah ke Google Sheets'); render(); }); });
      });
    },
    'export-json': function () {
      download('porto-cadangan-' + ymd(new Date()) + '.json', JSON.stringify({ versi: 2, transaksi: S.data.transaksi, dividen: S.data.dividen }, null, 2), 'application/json');
    },
    'export-trx': function () { download('porto-transaksi-' + ymd(new Date()) + '.csv', csv('transaksi'), 'text/csv'); },
    'export-div': function () { download('porto-dividen-' + ymd(new Date()) + '.csv', csv('dividen'), 'text/csv'); },
    'load-sample': function () {
      if (S.isSheet()) return;
      var run = function () {
        var smp = sampleData();
        S.replaceAll({ transaksi: S.data.transaksi.concat(smp.transaksi), dividen: S.data.dividen.concat(smp.dividen) })
          .then(function () { toast('Data contoh dimuat. Hapus lewat Pengaturan.'); render(); });
      };
      if (S.data.transaksi.length || S.data.dividen.length) {
        confirmDialog('Tambahkan data contoh?', 'Data contoh ditandai catatan "Contoh" dan ditambahkan ke data Anda. Anda bisa menghapusnya kapan saja dari Pengaturan.', 'Tambahkan').then(function (ok) { if (ok) run(); });
      } else run();
    },
    'clear-sample': function () {
      if (S.isSheet()) return;
      S.replaceAll({
        transaksi: S.data.transaksi.filter(function (r) { return r.catatan !== 'Contoh'; }),
        dividen: S.data.dividen.filter(function (r) { return r.catatan !== 'Contoh'; })
      }).then(function () { toast('Data contoh dihapus'); render(); });
    }
  };

  document.addEventListener('click', function (e) {
    var dl = e.target.closest('[data-dlg]');
    if (dl) {
      if (dl.dataset.dlg === 'close') closeDialog();
      if (dl.dataset.dlg === 'clear-price') { S.setManual(dl.dataset.key, 0); closeDialog(); render(); }
      return;
    }
    var b = e.target.closest('[data-act]');
    if (b && ACTIONS[b.dataset.act]) ACTIONS[b.dataset.act](b);
  });

  $('#btn-add-trx').addEventListener('click', function () { openTrxForm(); });
  $('#btn-add-div').addEventListener('click', function () { openDivForm(); });
  $('#btn-refresh').addEventListener('click', function () { refreshPrices(true); });

  // filter
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'import-file') return importFile(t);
    var id = t.dataset && t.dataset.filter;
    if (!id) return;
    var map = { 'ft-kode': ['trx', 'kode'], 'ft-jenis': ['trx', 'jenis'], 'ft-tahun': ['trx', 'tahun'], 'fd-kode': ['div', 'kode'], 'fd-tahun': ['div', 'tahun'] };
    var m = map[id];
    if (!m) return;
    state.f[m[0]][m[1]] = t.value;
    state.focusId = id;
    render();
  });

  function importFile(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      input.value = '';
      var j;
      try { j = JSON.parse(reader.result); } catch (err) { return toast('File bukan JSON yang valid.', 'err'); }
      if (!j || !Array.isArray(j.transaksi) || !Array.isArray(j.dividen)) return toast('Format cadangan tidak dikenali. Gunakan file hasil Ekspor cadangan.', 'err');
      confirmDialog('Ganti semua data?', 'Data saat ini diganti dengan ' + j.transaksi.length + ' transaksi dan ' + j.dividen.length + ' dividen dari file.', 'Ganti data').then(function (ok) {
        if (!ok) return;
        S.replaceAll(j).then(function () { toast('Data diimpor'); render(); }).catch(function (e2) { toast(e2.message, 'err'); });
      });
    };
    reader.readAsText(file);
  }

  // submit dialog & form pengaturan
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form.id === 'dlg-form') {
      e.preventDefault();
      var dlg = $('#dlg');
      if (!dlg._onSubmit) return;
      var ok = $('#dlg-ok');
      ok.disabled = true;
      dialogError('');
      Promise.resolve().then(dlg._onSubmit).then(function () { closeDialog(); }).catch(function (err) {
        dialogError(err.message || String(err));
      }).then(function () { ok.disabled = false; });
      return;
    }
    if (form.id === 'form-google') {
      e.preventDefault();
      var gd = new FormData(form);
      var cid = String(gd.get('clientId') || '').trim();
      var sh = String(gd.get('sheet') || '').trim();
      if (location.protocol === 'file:') return toast('Login Google tidak berjalan dari file lokal. Buka lewat GitHub Pages.', 'err');
      if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(cid)) return toast('Client ID tidak valid. Bentuknya xxxx.apps.googleusercontent.com', 'err');
      if (!sh) return toast('Isi tautan atau ID spreadsheet.', 'err');
      guard(form.querySelector('button[type=submit]'), function () {
        return S.googleConnect(cid, sh).then(function () {
          state.loadError = '';
          toast('Masuk sebagai ' + (S.email() || 'akun Google'));
          render();
          return refreshPrices(false);
        });
      });
      return;
    }
    if (form.id === 'form-conn') {
      e.preventDefault();
      var fd = new FormData(form);
      var url = String(fd.get('url') || '').trim();
      var token = String(fd.get('token') || '').trim();
      if (!url) return toast('Isi URL Web App dari Apps Script.', 'err');
      if (!/^https:\/\/script\.google\.com\//.test(url)) return toast('URL harus diawali https://script.google.com/', 'err');
      if (!token) return toast('Isi token yang sama dengan di Code.gs.', 'err');
      var btn = form.querySelector('button[type=submit]');
      guard(btn, function () {
        return S.connect(url, token).then(function () {
          state.loadError = '';
          toast('Tersambung ke Google Sheets');
          render();
          return refreshPrices(false);
        });
      });
      return;
    }
    if (form.id === 'form-fee') {
      e.preventDefault();
      var f2 = new FormData(form);
      var next = {};
      for (var i = 0; i < ORDER.length; i++) {
        var mk = ORDER[i];
        var b = C.num(f2.get('fee_' + mk + '_beli')), j = C.num(f2.get('fee_' + mk + '_jual'));
        if (b < 0 || j < 0 || b > 5 || j > 5) return toast('Fee harus antara 0 dan 5 persen.', 'err');
        next[mk] = { beli: b, jual: j };
      }
      S.saveSettings({ fee: next });
      toast('Biaya broker disimpan');
      return;
    }
    if (form.id === 'form-ccy') {
      e.preventDefault();
      var f3 = new FormData(form);
      var kurs = f3.get('kurs') === '' ? 0 : C.num(f3.get('kurs'));
      if (kurs < 0) return toast('Kurs tidak boleh negatif.', 'err');
      S.saveSettings({ cryptoCcy: f3.get('cryptoCcy'), kurs: kurs });
      toast('Pengaturan disimpan');
      render();
    }
  });

  // ---------- routing ----------
  function route() {
    var id = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('?')[0];
    state.route = VIEWS[id] ? id : 'dashboard';
    render();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  // ---------- mulai ----------
  route();
  S.init().then(function () {
    state.loadError = '';
    render();
    return refreshPrices(false);
  }).catch(function (e) {
    state.loadError = e.message || String(e);
    render();
  });

  setInterval(function () {
    if (!document.hidden && S.isSheet() && !S.needLogin() && Date.now() - (S.prices.at || 0) > 55 * 1000) refreshPrices(false);
  }, 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S.isSheet() && !S.needLogin() && Date.now() - (S.prices.at || 0) > 55 * 1000) refreshPrices(false);
  });
}());
