/* Porto — antarmuka aplikasi. */
(function () {
  'use strict';

  var C = Calc, S = Store;

  // ---------- util ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
  var MON = Charts.MONTHS;

  function rp(n) { return (n < -0.5 ? '−' : '') + 'Rp ' + nf.format(Math.abs(Math.round(n))); }
  function rpSigned(n) {
    var r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? '−' : '') + 'Rp ' + nf.format(Math.abs(r));
  }
  function pct(n) {
    var r = Math.round(n * 100) / 100;
    return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2).replace('.', ',') + '%';
  }
  function px(n) { return nf2.format(n); }
  function cls(n) { var r = Math.round(n); return r > 0 ? 'gain' : r < 0 ? 'loss' : 'flat'; }
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

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14l-3-3"/><path d="M20 16H6l3 3"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9"/><path d="M9.5 10c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.6-1 1.4-2.5 1.8-2.5.8-2.5 1.8 1 1.6 2.5 1.6 2.5-.6 2.5-1.6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V5"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
  };

  var ROUTES = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'transaksi', label: 'Transaksi', icon: 'swap' },
    { id: 'dividen', label: 'Dividen', icon: 'coin' },
    { id: 'bulanan', label: 'Bulanan', icon: 'chart' },
    { id: 'pengaturan', label: 'Pengaturan', icon: 'gear' }
  ];

  var state = {
    route: 'dashboard',
    loadError: '',
    refreshing: false,
    f: { trx: { kode: '', jenis: '', tahun: '' }, div: { kode: '', tahun: '' } },
    focusId: ''
  };

  var PALETTE = ['#0D4F4A', '#2C9A8E', '#7CC4B6', '#B9810F', '#7A5C2E', '#5B7A99', '#A3B3AD', '#C9D4CF'];

  // ---------- perhitungan ----------
  function compute() {
    var d = S.data;
    var ledger = C.buildLedger(d.transaksi);
    var summary = C.summarize(ledger, d.dividen, S.priceFor);
    var months = C.monthly(d.transaksi, ledger, d.dividen, ymd(new Date()));
    return { d: d, ledger: ledger, summary: summary, months: months };
  }

  function knownKodes(d) {
    var set = {};
    d.transaksi.forEach(function (t) { set[t.kode] = 1; });
    d.dividen.forEach(function (t) { set[t.kode] = 1; });
    return Object.keys(set).sort();
  }

  // ---------- potongan tampilan ----------
  function lead(label, value, extra) {
    return '<div><dt>' + (extra && extra.sw ? '<i class="sw" style="background:' + extra.sw + '"></i>' : '') + label +
      '</dt><span class="fill"></span><dd class="' + ((extra && extra.cls) || '') + '">' + value + '</dd></div>';
  }

  function banner(html, kind) {
    return '<div class="banner ' + (kind || '') + '" role="status"><div>' + html + '</div></div>';
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

  // ---------- halaman: dashboard ----------
  function viewDashboard(m) {
    var d = m.d, s = m.summary, html = '';

    if (state.loadError) {
      html += banner('<strong>Gagal memuat dari Google Sheets.</strong> ' + esc(state.loadError) +
        ' <button class="linkbtn" data-act="reload" type="button">Coba lagi</button>', 'err');
    }
    if (!S.isSheet()) {
      html += banner('<strong>Mode lokal.</strong> Data hanya tersimpan di browser ini dan harga harian tidak diperbarui otomatis. ' +
        '<a href="#/pengaturan">Hubungkan ke Google Sheets</a> untuk menyimpan data di Drive Anda dan mengaktifkan harga otomatis.');
    }
    if (m.ledger.warnings.length) {
      html += banner('<strong>Ada transaksi jual yang tidak cocok dengan kepemilikan:</strong> ' +
        esc(m.ledger.warnings.slice(0, 2).map(function (w) { return w.message + ' (' + fmtDate(w.tanggal) + ')'; }).join('; ')) +
        '. Periksa di <a href="#/transaksi">Transaksi</a>.', 'err');
    }
    if (S.isSheet() && s.missingPrices.length) {
      var errs = (S.prices.errors || {});
      var notFound = s.missingPrices.filter(function (k) { return errs[k]; });
      html += banner('<strong>Harga belum tersedia untuk ' + esc(s.missingPrices.join(', ')) + '.</strong> Saham ini dinilai pada harga rata-rata, jadi profitnya tampil 0. ' +
        (notFound.length ? 'Kode ' + esc(notFound.join(', ')) + ' tidak ditemukan di bursa; periksa penulisannya. ' : '') +
        'Anda juga bisa mengisi harga manual di tabel posisi.');
    }

    if (!d.transaksi.length) {
      return html + emptyState('Belum ada transaksi', 'Catat pembelian pertama Anda, atau muat data contoh untuk melihat cara kerjanya.', !S.isSheet());
    }

    // hero
    var left = '<div class="hero-figure"><div class="lbl">Total hasil investasi</div>' +
      '<div class="big ' + cls(s.totalReturn) + '">' + rpSigned(s.totalReturn) + '</div>' +
      '<div class="sub ' + cls(s.totalReturn) + '">' + pct(s.returnPct) + ' <span class="muted">dari total dana yang dibelikan</span></div>' +
      '<dl class="leader">' +
      lead('Nilai portofolio saat ini', rp(s.value)) +
      lead('Modal saham yang dipegang', rp(s.cost)) +
      lead('Belum terealisasi', rpSigned(s.unrealized) + ' (' + pct(s.unrealizedPct) + ')', { cls: cls(s.unrealized) }) +
      lead('Profit jual (terealisasi)', rpSigned(s.realized), { cls: cls(s.realized) }) +
      lead('Dividen diterima', rpSigned(s.dividend), { cls: s.dividend > 0 ? 'gain' : 'flat' }) +
      (s.rows.some(function (r) { return r.prev; }) ? lead('Perubahan hari ini', rpSigned(s.dayChange), { cls: cls(s.dayChange) }) : '') +
      '</dl></div>';

    var last12 = m.months.slice(-12);
    var right = '<div class="chart-wrap"><div class="chart-head"><h2>Profit per bulan</h2>' +
      '<div class="legend"><span><i style="background:var(--gain)"></i>Profit jual</span><span><i style="background:var(--loss)"></i>Rugi jual</span><span><i style="background:var(--dividend)"></i>Dividen</span></div></div>' +
      '<div class="chart-scroll"><div class="chart">' + Charts.monthly(last12, { label: 'Profit per bulan, 12 bulan terakhir' }) + '</div></div>' +
      '<p class="muted" style="font-size:13px;margin:8px 0 0">Profit jual + dividen yang diterima di bulan itu. ' +
      (m.months.length > 12 ? '<a href="#/bulanan">Lihat semua bulan</a>' : '<a href="#/bulanan">Lihat rincian per bulan</a>') + '</p></div>';

    html += '<section class="hero">' + left + right + '</section>';

    // posisi
    html += '<section class="section"><div class="section-head"><h2>Posisi saham</h2>' +
      '<span class="note">' + (S.prices.at ? 'Harga diperbarui ' + hhmm(S.prices.at) : 'Harga belum diperbarui') + '</span></div>';
    if (!s.rows.length) {
      html += '<div class="panel empty"><p>Semua posisi sudah dijual. Profitnya ada di total hasil dan di rincian bulanan.</p></div>';
    } else {
      html += '<div class="panel table-wrap"><table class="tbl"><thead><tr>' +
        '<th>Saham</th><th class="num">Lot</th><th class="num">Harga rata-rata</th><th class="num">Harga sekarang</th>' +
        '<th class="num">Nilai</th><th class="num">Profit / rugi</th><th class="num">Dividen</th></tr></thead><tbody>' +
        s.rows.map(function (r) {
          var priceCell;
          if (r.hasPrice) {
            priceCell = px(r.price) + (r.prev ? '<span class="sub ' + cls(r.dayChange) + '">' + pct(r.dayPct) + ' hari ini</span>' : '') +
              (r.source === 'manual' ? '<span class="sub muted">manual <button class="linkbtn" data-act="price" data-kode="' + esc(r.kode) + '" type="button">ubah</button></span>' : '');
          } else {
            priceCell = '<span class="muted">–</span><span class="sub"><button class="linkbtn" data-act="price" data-kode="' + esc(r.kode) + '" type="button">Isi harga</button></span>';
          }
          return '<tr><td class="kode">' + esc(r.kode) + '</td>' +
            '<td class="num">' + nf.format(r.lot) + '</td>' +
            '<td class="num">' + px(r.avg) + '</td>' +
            '<td class="num">' + priceCell + '</td>' +
            '<td class="num">' + rp(r.value) + '</td>' +
            '<td class="num ' + cls(r.unrealized) + '">' + rpSigned(r.unrealized) + '<span class="sub">' + pct(r.unrealizedPct) + '</span></td>' +
            '<td class="num">' + (r.dividend ? rp(r.dividend) : '<span class="muted">–</span>') + '</td></tr>';
        }).join('') +
        '</tbody><tfoot><tr><td>Total</td><td></td><td></td><td></td><td class="num">' + rp(s.value) + '</td>' +
        '<td class="num ' + cls(s.unrealized) + '">' + rpSigned(s.unrealized) + '</td><td class="num"></td></tr></tfoot></table></div>';
    }
    html += '</section>';

    // alokasi + dividen
    if (s.rows.length || s.dividends.byKode.length) {
      var alloc = '';
      if (s.rows.length) {
        var top = s.rows.slice(0, 7);
        var restW = s.rows.slice(7).reduce(function (a, r) { return a + r.weight; }, 0);
        var segs = top.map(function (r, i) { return { k: r.kode, w: r.weight, c: PALETTE[i] }; });
        if (restW > 0) segs.push({ k: 'Lainnya', w: restW, c: PALETTE[7] });
        alloc = '<div><div class="section-head"><h2>Alokasi</h2></div>' +
          '<div class="alloc" role="img" aria-label="Alokasi portofolio per saham">' +
          segs.map(function (g) { return '<span title="' + esc(g.k) + ' ' + g.w.toFixed(1) + '%" style="flex:' + g.w + ';background:' + g.c + '"></span>'; }).join('') + '</div>' +
          '<dl class="leader">' + segs.map(function (g) { return lead(esc(g.k), g.w.toFixed(1).replace('.', ',') + '%', { sw: g.c }); }).join('') + '</dl></div>';
      }
      var dv = '';
      if (s.dividends.byKode.length) {
        dv = '<div><div class="section-head"><h2>Dividen per saham</h2><a class="note" href="#/dividen">Semua dividen</a></div>' +
          '<dl class="leader">' + s.dividends.byKode.slice(0, 7).map(function (r) {
            return lead(esc(r.kode), rp(r.total), { cls: 'gain' });
          }).join('') + lead('<strong>Total</strong>', '<strong>' + rp(s.dividend) + '</strong>') + '</dl></div>';
      } else {
        dv = '<div><div class="section-head"><h2>Dividen per saham</h2></div><p class="muted">Belum ada dividen tercatat. Gunakan tombol Catat dividen.</p></div>';
      }
      html += '<section class="section cols-2">' + alloc + dv + '</section>';
    }
    return html;
  }

  // ---------- halaman: transaksi ----------
  function viewTransaksi(m) {
    var d = m.d, f = state.f.trx;
    if (!d.transaksi.length) {
      return emptyState('Belum ada transaksi', 'Catat pembelian atau penjualan saham Anda. Profit dihitung otomatis dengan metode harga rata-rata.', !S.isSheet());
    }
    var rows = d.transaksi.filter(function (t) {
      return (!f.kode || t.kode === f.kode) && (!f.jenis || t.jenis === f.jenis) && (!f.tahun || C.day(t.tanggal).slice(0, 4) === f.tahun);
    }).slice().sort(function (a, b) {
      var x = C.day(a.tanggal), y = C.day(b.tanggal);
      return x === y ? 0 : x < y ? 1 : -1;
    });
    var warnIds = {};
    m.ledger.warnings.forEach(function (w) { warnIds[w.id] = w.message; });

    var kodeOpts = [['', 'Semua saham']].concat(knownKodes({ transaksi: d.transaksi, dividen: [] }).map(function (k) { return [k, k]; }));
    var yearOpts = [['', 'Semua tahun']].concat(yearsOf(d.transaksi).map(function (y) { return [y, y]; }));

    var realizedSum = 0;
    rows.forEach(function (t) { if (t.jenis === 'JUAL' && m.ledger.perTrx[t.id] != null) realizedSum += m.ledger.perTrx[t.id]; });

    var html = '<div class="filters">' +
      selectField('ft-kode', 'Saham', f.kode, kodeOpts) +
      selectField('ft-jenis', 'Jenis', f.jenis, [['', 'Beli dan jual'], ['BELI', 'Beli'], ['JUAL', 'Jual']]) +
      selectField('ft-tahun', 'Tahun', f.tahun, yearOpts) + '</div>';

    if (!rows.length) return html + '<div class="panel empty"><p>Tidak ada transaksi yang cocok dengan filter.</p></div>';

    html += '<div class="panel table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Tanggal</th><th>Saham</th><th>Jenis</th><th class="num">Lot</th><th class="num">Harga</th><th class="num">Nilai</th><th class="num">Fee</th><th class="num">Profit / rugi</th><th></th></tr></thead><tbody>' +
      rows.map(function (t) {
        var gross = C.num(t.lot) * C.LOT * C.num(t.harga);
        var pl = t.jenis === 'JUAL' ? m.ledger.perTrx[t.id] : null;
        return '<tr><td>' + fmtDate(t.tanggal) + (t.catatan ? '<span class="sub muted" style="font-weight:500">' + esc(t.catatan) + '</span>' : '') + '</td>' +
          '<td class="kode">' + esc(t.kode) + '</td>' +
          '<td><span class="pill ' + (t.jenis === 'BELI' ? 'beli' : 'jual') + '">' + (t.jenis === 'BELI' ? 'Beli' : 'Jual') + '</span>' +
          (warnIds[t.id] ? ' <span class="pill warn" title="' + esc(warnIds[t.id]) + '">Melebihi kepemilikan</span>' : '') + '</td>' +
          '<td class="num">' + nf.format(t.lot) + '</td>' +
          '<td class="num">' + px(t.harga) + '</td>' +
          '<td class="num">' + rp(gross) + '</td>' +
          '<td class="num">' + (C.num(t.fee) ? rp(t.fee) : '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + (pl == null ? 'flat' : cls(pl)) + '">' + (pl == null ? '–' : rpSigned(pl)) + '</td>' +
          '<td class="acts"><button class="btn ghost sm" data-act="edit-trx" data-id="' + esc(t.id) + '" type="button">Ubah</button>' +
          '<button class="btn danger sm" data-act="del-trx" data-id="' + esc(t.id) + '" type="button">Hapus</button></td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="7">' + rows.length + ' transaksi · total profit jual</td><td class="num ' + cls(realizedSum) + '">' + rpSigned(realizedSum) + '</td><td></td></tr></tfoot></table></div>';
    return html;
  }

  // ---------- halaman: dividen ----------
  function viewDividen(m) {
    var d = m.d, f = state.f.div, ds = m.summary.dividends;
    if (!d.dividen.length) {
      return '<div class="panel empty"><h3>Belum ada dividen</h3><p>Catat dividen yang masuk ke rekening Anda per saham. Dividen ikut dihitung dalam profit bulanan.</p><div class="row">' +
        '<button class="btn primary" data-act="add-div" type="button">Catat dividen</button></div></div>';
    }
    var years = Object.keys(ds.byYear).sort().reverse();
    var summary = '<div><div class="section-head"><h2>Ringkasan</h2></div><dl class="leader">' +
      lead('Total dividen diterima', rp(ds.total), { cls: 'gain' }) +
      years.map(function (y) { return lead('Tahun ' + y, rp(ds.byYear[y])); }).join('') + '</dl></div>';

    var perKode = '<div><div class="section-head"><h2>Per saham</h2></div><div class="panel table-wrap"><table class="tbl"><thead><tr><th>Saham</th><th class="num">Pembayaran</th><th class="num">Total</th><th class="num">Terakhir</th></tr></thead><tbody>' +
      ds.byKode.map(function (r) {
        return '<tr><td class="kode">' + esc(r.kode) + '</td><td class="num">' + r.count + 'x</td><td class="num">' + rp(r.total) + '</td><td class="num">' + fmtDate(r.last) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    var rows = d.dividen.filter(function (x) {
      return (!f.kode || x.kode === f.kode) && (!f.tahun || C.day(x.tanggal).slice(0, 4) === f.tahun);
    }).slice().sort(function (a, b) {
      var x = C.day(a.tanggal), y = C.day(b.tanggal);
      return x === y ? 0 : x < y ? 1 : -1;
    });
    var sum = rows.reduce(function (a, r) { return a + C.num(r.jumlah); }, 0);

    var kodeOpts = [['', 'Semua saham']].concat(knownKodes({ transaksi: [], dividen: d.dividen }).map(function (k) { return [k, k]; }));
    var yearOpts = [['', 'Semua tahun']].concat(yearsOf(d.dividen).map(function (y) { return [y, y]; }));

    var log = '<section class="section"><div class="section-head"><h2>Riwayat dividen</h2></div><div class="filters">' +
      selectField('fd-kode', 'Saham', f.kode, kodeOpts) + selectField('fd-tahun', 'Tahun', f.tahun, yearOpts) + '</div>';
    if (!rows.length) {
      log += '<div class="panel empty"><p>Tidak ada dividen yang cocok dengan filter.</p></div>';
    } else {
      log += '<div class="panel table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Saham</th><th class="num">Lot</th><th class="num">Per lembar</th><th class="num">Pajak</th><th class="num">Diterima</th><th></th></tr></thead><tbody>' +
        rows.map(function (x) {
          return '<tr><td>' + fmtDate(x.tanggal) + (x.catatan ? '<span class="sub muted" style="font-weight:500">' + esc(x.catatan) + '</span>' : '') + '</td>' +
            '<td class="kode">' + esc(x.kode) + '</td>' +
            '<td class="num">' + (x.lot !== '' && x.lot != null ? nf.format(x.lot) : '<span class="muted">–</span>') + '</td>' +
            '<td class="num">' + (x.dps !== '' && x.dps != null ? px(x.dps) : '<span class="muted">–</span>') + '</td>' +
            '<td class="num">' + (x.pajak !== '' && x.pajak != null ? nf2.format(x.pajak) + '%' : '<span class="muted">–</span>') + '</td>' +
            '<td class="num gain">' + rp(x.jumlah) + '</td>' +
            '<td class="acts"><button class="btn ghost sm" data-act="edit-div" data-id="' + esc(x.id) + '" type="button">Ubah</button>' +
            '<button class="btn danger sm" data-act="del-div" data-id="' + esc(x.id) + '" type="button">Hapus</button></td></tr>';
        }).join('') +
        '</tbody><tfoot><tr><td colspan="5">' + rows.length + ' pembayaran</td><td class="num">' + rp(sum) + '</td><td></td></tr></tfoot></table></div>';
    }
    log += '</section>';

    return '<section class="cols-2">' + summary + perKode + '</section>' + log;
  }

  // ---------- halaman: bulanan ----------
  function viewBulanan(m) {
    var months = m.months;
    if (!months.length) return emptyState('Belum ada data bulanan', 'Profit per bulan muncul setelah Anda mencatat penjualan atau dividen.', !S.isSheet());

    var active = months.filter(function (x) { return x.trades || x.divCount; });
    var best = active.reduce(function (a, x) { return !a || x.total > a.total ? x : a; }, null);
    var worst = active.reduce(function (a, x) { return !a || x.total < a.total ? x : a; }, null);
    var totalReal = months.reduce(function (a, x) { return a + x.realized; }, 0);
    var totalDiv = months.reduce(function (a, x) { return a + x.dividend; }, 0);
    var plus = active.filter(function (x) { return x.total > 0; }).length;
    var minus = active.filter(function (x) { return x.total < 0; }).length;

    var html = '<section class="hero hero-tight"><div class="hero-figure">' +
      '<div class="lbl">Akumulasi profit jual + dividen</div>' +
      '<div class="big ' + cls(totalReal + totalDiv) + '">' + rpSigned(totalReal + totalDiv) + '</div>' +
      '<dl class="leader">' +
      lead('Bulan terbaik', best ? fmtMonth(best.month) + ' ' + rpSigned(best.total) : '–', { cls: best ? cls(best.total) : '' }) +
      lead('Bulan terburuk', worst ? fmtMonth(worst.month) + ' ' + rpSigned(worst.total) : '–', { cls: worst ? cls(worst.total) : '' }) +
      lead('Bulan untung / rugi', plus + ' / ' + minus) +
      '</dl>' +
      '<p class="muted" style="font-size:13px;margin-top:14px">Profit bulanan memakai profit yang sudah terealisasi saat jual dan dividen yang diterima. Naik turun harga saham yang belum dijual tidak masuk di sini; lihat <a href="#/dashboard">Dashboard</a>.</p></div>' +
      '<div class="chart-wrap"><div class="chart-head"><h2>Per bulan</h2>' +
      '<div class="legend"><span><i style="background:var(--gain)"></i>Profit jual</span><span><i style="background:var(--loss)"></i>Rugi jual</span><span><i style="background:var(--dividend)"></i>Dividen</span></div></div>' +
      '<div class="chart-scroll"><div class="chart">' + Charts.monthly(months, { label: 'Profit per bulan, seluruh periode' }) + '</div></div></div></section>';

    html += '<section class="section"><div class="section-head"><h2>Rincian</h2></div><div class="panel table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Bulan</th><th class="num">Transaksi</th><th class="num">Profit jual</th><th class="num">Dividen</th><th class="num">Total bulan</th><th class="num">Kumulatif</th></tr></thead><tbody>' +
      months.slice().reverse().map(function (x) {
        return '<tr><td class="kode">' + fmtMonth(x.month) + '</td><td class="num">' + (x.trades || '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + cls(x.realized) + '">' + (x.realized ? rpSigned(x.realized) : '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + (x.dividend ? 'gain' : '') + '">' + (x.dividend ? rpSigned(x.dividend) : '<span class="muted">–</span>') + '</td>' +
          '<td class="num ' + cls(x.total) + '"><strong>' + (x.total ? rpSigned(x.total) : 'Rp 0') + '</strong></td>' +
          '<td class="num ' + cls(x.cumulative) + '">' + rpSigned(x.cumulative) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td>Total</td><td class="num">' + months.reduce(function (a, x) { return a + x.trades; }, 0) + '</td>' +
      '<td class="num ' + cls(totalReal) + '">' + rpSigned(totalReal) + '</td><td class="num">' + rpSigned(totalDiv) + '</td>' +
      '<td class="num ' + cls(totalReal + totalDiv) + '">' + rpSigned(totalReal + totalDiv) + '</td><td></td></tr></tfoot></table></div></section>';
    return html;
  }

  // ---------- halaman: pengaturan ----------
  function viewPengaturan() {
    var st = S.settings, sheet = S.isSheet();
    var local = S.localData();
    var localCount = local.transaksi.length + local.dividen.length;

    var html = '<div>';

    html += '<section class="settings-block"><div><h2>Google Sheets</h2><p>Simpan semua transaksi dan dividen di spreadsheet Anda sendiri. Tanpa ini, data hanya ada di browser ini.</p></div><div>' +
      '<div class="banner' + (sheet ? '' : '') + '" style="margin-bottom:16px">' + (sheet ? '<div><strong>Tersambung.</strong> Data dibaca dan ditulis ke spreadsheet Anda.</div>' : '<div><strong>Belum tersambung.</strong> Ikuti langkah Apps Script di README, lalu tempel URL dan token di sini.</div>') + '</div>' +
      '<form id="form-conn" class="form-grid" autocomplete="off">' +
      '<div class="field wide"><label for="s-url">URL Web App</label><input id="s-url" name="url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(st.url) + '"></div>' +
      '<div class="field wide"><label for="s-token">Token</label><input id="s-token" name="token" type="password" autocomplete="off" value="' + esc(st.token) + '"><span class="hint">Sama persis dengan TOKEN di Code.gs. Disimpan hanya di browser ini.</span></div>' +
      '<div class="wide" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">' + (sheet ? 'Simpan dan muat ulang' : 'Sambungkan') + '</button>' +
      (sheet ? '<button class="btn outline" type="button" data-act="reload">Muat ulang dari Sheet</button><button class="btn danger" type="button" data-act="disconnect">Putuskan</button>' : '') +
      '</div></form>' +
      (sheet && localCount ? '<div class="row"><button class="btn outline" type="button" data-act="upload-local">Unggah ' + local.transaksi.length + ' transaksi dan ' + local.dividen.length + ' dividen dari browser ini ke Sheet</button></div><p class="muted" style="margin-top:8px;font-size:13px">Ini mengganti seluruh isi tab Transaksi dan Dividen di Sheet.</p>' : '') +
      '</div></section>';

    html += '<section class="settings-block"><div><h2>Biaya broker</h2><p>Dipakai untuk mengisi fee otomatis saat mencatat transaksi. Fee tetap bisa diubah per transaksi.</p></div><div>' +
      '<form id="form-fee" class="form-grid">' +
      '<div class="field"><label for="s-fb">Fee beli (%)</label><input id="s-fb" name="feeBeli" type="number" step="0.001" min="0" value="' + esc(st.feeBeli) + '"></div>' +
      '<div class="field"><label for="s-fj">Fee jual (%)</label><input id="s-fj" name="feeJual" type="number" step="0.001" min="0" value="' + esc(st.feeJual) + '"><span class="hint">Biasanya sudah termasuk pajak penjualan 0,1%.</span></div>' +
      '<div class="wide"><button class="btn primary" type="submit">Simpan biaya</button></div></form></div></section>';

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

  function renderSync() {
    var el = $('#sync');
    if (S.isSheet()) {
      var bad = !!state.loadError;
      el.className = 'sync ' + (bad ? 'err' : 'on');
      el.innerHTML = '<span class="dot"></span>' + (bad ? 'Gagal terhubung ke Google Sheets' : 'Tersambung ke Google Sheets') +
        '<br><span style="opacity:.8">' + (S.prices.at ? 'Harga: ' + hhmm(S.prices.at) : 'Harga belum diperbarui') + '</span>';
    } else {
      el.className = 'sync';
      el.innerHTML = '<span class="dot"></span>Mode lokal<br><span style="opacity:.8">Data hanya di browser ini. <a href="#/pengaturan">Hubungkan Sheet</a></span>';
    }
    var btn = $('#btn-refresh');
    btn.disabled = state.refreshing;
    btn.textContent = state.refreshing ? 'Memperbarui…' : 'Perbarui harga';
  }

  function render() {
    var route = ROUTES.filter(function (r) { return r.id === state.route; })[0] || ROUTES[0];
    $('#page-title').textContent = route.label;
    document.title = route.label + ' · Porto';
    renderNav();
    $('#view').innerHTML = VIEWS[route.id](compute());
    renderSync();
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

  // ---------- form transaksi ----------
  function trxFormHtml(t, kodes) {
    return '<form id="dlg-form" class="form-grid" autocomplete="off">' +
      '<div class="field"><label for="f-tanggal">Tanggal</label><input id="f-tanggal" name="tanggal" type="date" required value="' + esc(t.tanggal) + '"></div>' +
      '<div class="field"><label for="f-kode">Kode saham</label><input id="f-kode" name="kode" class="up" list="kodes" required maxlength="6" placeholder="BBCA" value="' + esc(t.kode) + '"><datalist id="kodes">' + kodes.map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist></div>' +
      '<div class="field wide"><span class="lbl">Jenis</span><div class="seg" role="radiogroup" aria-label="Jenis transaksi"><label><input type="radio" name="jenis" value="BELI"' + (t.jenis === 'BELI' ? ' checked' : '') + '><span>Beli</span></label><label><input type="radio" name="jenis" value="JUAL"' + (t.jenis === 'JUAL' ? ' checked' : '') + '><span>Jual</span></label></div></div>' +
      '<div class="field"><label for="f-lot">Jumlah (lot)</label><input id="f-lot" name="lot" type="number" min="1" step="1" inputmode="numeric" required value="' + esc(t.lot) + '"><span class="hint">1 lot = 100 lembar</span></div>' +
      '<div class="field"><label for="f-harga">Harga per lembar (Rp)</label><input id="f-harga" name="harga" type="number" min="0" step="any" inputmode="decimal" required value="' + esc(t.harga) + '"></div>' +
      '<div class="field"><label for="f-fee">Fee (Rp)</label><input id="f-fee" name="fee" type="number" min="0" step="any" inputmode="decimal" value="' + esc(t.fee) + '"><span class="hint" id="f-fee-hint"></span></div>' +
      '<div class="field"><label for="f-cat">Catatan</label><input id="f-cat" name="catatan" maxlength="120" value="' + esc(t.catatan) + '"></div>' +
      '<div class="wide form-total" id="f-total"></div></form>';
  }

  function wireTrxForm() {
    var form = $('#dlg-form');
    function read() {
      var fd = new FormData(form);
      return { jenis: fd.get('jenis'), lot: C.num(fd.get('lot')), harga: C.num(fd.get('harga')), fee: fd.get('fee') };
    }
    function update() {
      var v = read();
      var est = C.estimateFee(v.jenis, v.lot, v.harga, S.settings.feeBeli, S.settings.feeJual);
      var fee = v.fee === '' ? est : C.num(v.fee);
      var gross = Math.round(v.lot) * C.LOT * v.harga;
      var pctUsed = v.jenis === 'JUAL' ? S.settings.feeJual : S.settings.feeBeli;
      $('#f-fee-hint').textContent = 'Kosongkan untuk otomatis: ' + rp(est) + ' (' + String(pctUsed).replace('.', ',') + '%)';
      $('#f-total').innerHTML = '<span>Nilai ' + rp(gross) + ' · Fee ' + rp(fee) + '</span><strong>' +
        (v.jenis === 'JUAL' ? 'Diterima ' + rp(gross - fee) : 'Dibayar ' + rp(gross + fee)) + '</strong>';
    }
    form.addEventListener('input', update);
    update();
  }

  function openTrxForm(id) {
    var d = S.data;
    var t = id ? d.transaksi.filter(function (x) { return x.id === id; })[0] : null;
    var model = t ? Object.assign({}, t) : { id: '', tanggal: ymd(new Date()), kode: '', jenis: 'BELI', lot: '', harga: '', fee: '', catatan: '' };
    openDialog({
      title: t ? 'Ubah transaksi' : 'Catat transaksi',
      body: trxFormHtml(model, knownKodes(d)),
      ok: 'Simpan transaksi',
      onOpen: function () { setTimeout(wireTrxForm, 0); },
      onSubmit: function () {
        var fd = new FormData($('#dlg-form'));
        var row = {
          id: model.id,
          tanggal: fd.get('tanggal'),
          kode: C.upper(fd.get('kode')),
          jenis: fd.get('jenis'),
          lot: C.num(fd.get('lot')),
          harga: C.num(fd.get('harga')),
          fee: fd.get('fee'),
          catatan: String(fd.get('catatan') || '').trim()
        };
        if (!/^[A-Z0-9]{2,6}$/.test(row.kode)) return Promise.reject(new Error('Kode saham harus 2 sampai 6 huruf atau angka, misalnya BBCA.'));
        if (!row.tanggal) return Promise.reject(new Error('Isi tanggal transaksi.'));
        if (!(row.lot >= 1) || Math.round(row.lot) !== row.lot) return Promise.reject(new Error('Jumlah lot harus bilangan bulat, minimal 1.'));
        if (!(row.harga > 0)) return Promise.reject(new Error('Harga per lembar harus lebih dari 0.'));
        row.fee = row.fee === '' ? C.estimateFee(row.jenis, row.lot, row.harga, S.settings.feeBeli, S.settings.feeJual) : C.num(row.fee);

        // cek kepemilikan sebelum menyimpan
        var others = d.transaksi.filter(function (x) { return x.id !== model.id; });
        var prev = C.buildLedger(others).warnings.map(function (w) { return w.id; });
        var cand = Object.assign({}, row, { id: model.id || '__baru__' });
        var after = C.buildLedger(others.concat([cand])).warnings;
        var bad = after.filter(function (w) { return prev.indexOf(w.id) < 0; })[0];
        if (bad) return Promise.reject(new Error(bad.message + (bad.id === cand.id ? '.' : ' pada ' + fmtDate(bad.tanggal) + '. Perubahan ini membuat penjualan tersebut tidak valid.')));

        var p = model.id ? S.update('transaksi', row) : S.add('transaksi', row);
        return p.then(function () { toast(model.id ? 'Transaksi diperbarui' : 'Transaksi disimpan'); render(); });
      }
    });
  }

  // ---------- form dividen ----------
  function openDivForm(id) {
    var d = S.data;
    var x = id ? d.dividen.filter(function (r) { return r.id === id; })[0] : null;
    var model = x ? Object.assign({}, x) : { id: '', tanggal: ymd(new Date()), kode: '', lot: '', dps: '', pajak: 10, jumlah: '', catatan: '' };
    var kodes = knownKodes(d);
    var touched = !!x;

    openDialog({
      title: x ? 'Ubah dividen' : 'Catat dividen',
      body: '<form id="dlg-form" class="form-grid" autocomplete="off">' +
        '<div class="field"><label for="d-tanggal">Tanggal diterima</label><input id="d-tanggal" name="tanggal" type="date" required value="' + esc(model.tanggal) + '"></div>' +
        '<div class="field"><label for="d-kode">Kode saham</label><input id="d-kode" name="kode" class="up" list="kodes2" required maxlength="6" placeholder="BBCA" value="' + esc(model.kode) + '"><datalist id="kodes2">' + kodes.map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label for="d-lot">Jumlah lot (opsional)</label><input id="d-lot" name="lot" type="number" min="0" step="1" inputmode="numeric" value="' + esc(model.lot) + '"></div>' +
        '<div class="field"><label for="d-dps">Dividen per lembar (opsional)</label><input id="d-dps" name="dps" type="number" min="0" step="any" inputmode="decimal" value="' + esc(model.dps) + '"></div>' +
        '<div class="field"><label for="d-pajak">Pajak (%)</label><input id="d-pajak" name="pajak" type="number" min="0" max="100" step="any" inputmode="decimal" value="' + esc(model.pajak) + '"></div>' +
        '<div class="field"><label for="d-jumlah">Total diterima (Rp)</label><input id="d-jumlah" name="jumlah" type="number" min="0" step="any" inputmode="decimal" required value="' + esc(model.jumlah) + '"><span class="hint" id="d-hint">Terisi otomatis dari lot × dividen per lembar setelah pajak. Boleh diubah.</span></div>' +
        '<div class="field wide"><label for="d-cat">Catatan</label><input id="d-cat" name="catatan" maxlength="120" value="' + esc(model.catatan) + '"></div></form>',
      ok: 'Simpan dividen',
      onOpen: function () {
        setTimeout(function () {
          var form = $('#dlg-form');
          var jumlah = $('#d-jumlah');
          function auto() {
            if (touched) return;
            var lot = C.num($('#d-lot').value), dps = C.num($('#d-dps').value), tax = C.num($('#d-pajak').value);
            if (lot > 0 && dps > 0) jumlah.value = Math.round(lot * C.LOT * dps * (1 - tax / 100));
          }
          jumlah.addEventListener('input', function () { touched = true; });
          form.addEventListener('input', function (e) { if (e.target !== jumlah) auto(); });
        }, 0);
      },
      onSubmit: function () {
        var fd = new FormData($('#dlg-form'));
        var row = {
          id: model.id,
          tanggal: fd.get('tanggal'),
          kode: C.upper(fd.get('kode')),
          lot: fd.get('lot') === '' ? '' : C.num(fd.get('lot')),
          dps: fd.get('dps') === '' ? '' : C.num(fd.get('dps')),
          pajak: fd.get('pajak') === '' ? '' : C.num(fd.get('pajak')),
          jumlah: C.num(fd.get('jumlah')),
          catatan: String(fd.get('catatan') || '').trim()
        };
        if (!/^[A-Z0-9]{2,6}$/.test(row.kode)) return Promise.reject(new Error('Kode saham harus 2 sampai 6 huruf atau angka, misalnya BBCA.'));
        if (!row.tanggal) return Promise.reject(new Error('Isi tanggal dividen diterima.'));
        if (!(row.jumlah > 0)) return Promise.reject(new Error('Total diterima harus lebih dari 0.'));
        var p = model.id ? S.update('dividen', row) : S.add('dividen', row);
        return p.then(function () { toast(model.id ? 'Dividen diperbarui' : 'Dividen disimpan'); render(); });
      }
    });
  }

  function openPriceForm(kode) {
    var cur = S.manual[kode] || '';
    openDialog({
      title: 'Harga ' + kode,
      body: '<form id="dlg-form"><div class="field"><label for="p-harga">Harga per lembar (Rp)</label><input id="p-harga" type="number" min="0" step="any" inputmode="decimal" value="' + esc(cur) + '" required>' +
        '<span class="hint">Dipakai bila harga otomatis tidak tersedia. Harga otomatis selalu didahulukan.</span></div></form>',
      ok: 'Simpan harga',
      extra: cur ? '<button class="btn danger" type="button" data-dlg="clear-price" data-kode="' + esc(kode) + '">Hapus harga</button>' : '',
      onSubmit: function () {
        var v = C.num($('#p-harga').value);
        if (!(v > 0)) return Promise.reject(new Error('Harga harus lebih dari 0.'));
        S.setManual(kode, v);
        render();
        return Promise.resolve();
      }
    });
  }

  // ---------- harga ----------
  function openKodes() {
    return C.buildLedger(S.data.transaksi).open.map(function (p) { return p.kode; });
  }

  function refreshPrices(manualClick) {
    var kodes = openKodes();
    if (!S.isSheet()) {
      if (manualClick) toast('Harga otomatis butuh koneksi ke Google Sheets. Buka Pengaturan.', 'err');
      return Promise.resolve();
    }
    if (!kodes.length) {
      if (manualClick) toast('Belum ada saham yang dipegang.');
      return Promise.resolve();
    }
    state.refreshing = true;
    renderSync();
    return S.fetchPrices(kodes).then(function () {
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
    function trx(back, day, kode, jenis, lot, harga) {
      var t = at(back, day);
      if (!t) return null;
      return { tanggal: t, kode: kode, jenis: jenis, lot: lot, harga: harga,
        fee: C.estimateFee(jenis, lot, harga, S.settings.feeBeli, S.settings.feeJual), catatan: 'Contoh' };
    }
    function div(back, day, kode, jumlah) {
      var t = at(back, day);
      return t ? { tanggal: t, kode: kode, lot: '', dps: '', pajak: 10, jumlah: jumlah, catatan: 'Contoh' } : null;
    }
    return {
      transaksi: [
        trx(8, 10, 'BBCA', 'BELI', 10, 9000), trx(7, 15, 'TLKM', 'BELI', 20, 3100),
        trx(6, 8, 'BMRI', 'BELI', 15, 5800), trx(5, 12, 'TLKM', 'JUAL', 5, 3350),
        trx(4, 3, 'ASII', 'BELI', 20, 5000), trx(3, 18, 'BMRI', 'JUAL', 5, 5500),
        trx(2, 9, 'ANTM', 'BELI', 30, 1650), trx(1, 14, 'ASII', 'JUAL', 10, 5350),
        trx(0, 2, 'BBCA', 'BELI', 5, 9350)
      ].filter(Boolean),
      dividen: [
        div(5, 20, 'BBCA', 450000), div(2, 22, 'TLKM', 360000), div(1, 25, 'ASII', 270000)
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
      return S.reload().then(function () {
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
    'del-trx': function (b) {
      var t = S.data.transaksi.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (!t) return;
      var rest = S.data.transaksi.filter(function (x) { return x.id !== t.id; });
      var broken = C.buildLedger(rest).warnings.length > C.buildLedger(S.data.transaksi).warnings.length;
      confirmDialog('Hapus transaksi?', esc(fmtDate(t.tanggal) + ' · ' + (t.jenis === 'BELI' ? 'Beli ' : 'Jual ') + t.kode + ' ' + t.lot + ' lot @ ' + px(t.harga)) +
        '.' + (broken ? ' <strong>Menghapus ini membuat penjualan lain melebihi kepemilikan.</strong>' : '') + ' Tindakan ini tidak bisa dibatalkan.').then(function (ok) {
        if (!ok) return;
        S.remove('transaksi', t.id).then(function () { toast('Transaksi dihapus'); render(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    },
    'del-div': function (b) {
      var x = S.data.dividen.filter(function (r) { return r.id === b.dataset.id; })[0];
      if (!x) return;
      confirmDialog('Hapus dividen?', esc(fmtDate(x.tanggal) + ' · ' + x.kode + ' ' + rp(x.jumlah)) + '. Tindakan ini tidak bisa dibatalkan.').then(function (ok) {
        if (!ok) return;
        S.remove('dividen', x.id).then(function () { toast('Dividen dihapus'); render(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    },
    'price': function (b) { openPriceForm(b.dataset.kode); },
    'reload': function (b) { reloadFromSheet(b); },
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
      confirmDialog('Unggah data lokal ke Sheet?', 'Isi tab Transaksi dan Dividen di spreadsheet akan diganti dengan ' + l.transaksi.length + ' transaksi dan ' + l.dividen.length + ' dividen dari browser ini.', 'Unggah').then(function (ok) {
        if (!ok) return;
        guard(b, function () { return S.uploadLocal().then(function () { toast('Data terunggah ke Google Sheets'); render(); }); });
      });
    },
    'export-json': function () {
      download('porto-cadangan-' + ymd(new Date()) + '.json', JSON.stringify({ versi: 1, transaksi: S.data.transaksi, dividen: S.data.dividen }, null, 2), 'application/json');
    },
    'export-trx': function () { download('porto-transaksi-' + ymd(new Date()) + '.csv', csv('transaksi'), 'text/csv'); },
    'export-div': function () { download('porto-dividen-' + ymd(new Date()) + '.csv', csv('dividen'), 'text/csv'); },
    'load-sample': function () {
      if (S.isSheet()) return;
      var run = function () {
        var base = { transaksi: S.data.transaksi.slice(), dividen: S.data.dividen.slice() };
        var smp = sampleData();
        S.replaceAll({ transaksi: base.transaksi.concat(smp.transaksi), dividen: base.dividen.concat(smp.dividen) })
          .then(function () { toast('Data contoh dimuat. Hapus lewat Pengaturan.'); render(); });
      };
      if (S.data.transaksi.length || S.data.dividen.length) {
        confirmDialog('Tambahkan data contoh?', 'Data contoh ditandai catatan "Contoh" dan ditambahkan ke data Anda. Anda bisa menghapusnya kapan saja dari Pengaturan.', 'Tambahkan').then(function (ok) { if (ok) run(); });
      } else run();
    },
    'clear-sample': function () {
      if (S.isSheet()) return;
      var keep = {
        transaksi: S.data.transaksi.filter(function (r) { return r.catatan !== 'Contoh'; }),
        dividen: S.data.dividen.filter(function (r) { return r.catatan !== 'Contoh'; })
      };
      S.replaceAll(keep).then(function () { toast('Data contoh dihapus'); render(); });
    }
  };

  document.addEventListener('click', function (e) {
    var dl = e.target.closest('[data-dlg]');
    if (dl) {
      if (dl.dataset.dlg === 'close') closeDialog();
      if (dl.dataset.dlg === 'clear-price') { S.setManual(dl.dataset.kode, 0); closeDialog(); render(); }
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
      var fb = C.num(f2.get('feeBeli')), fj = C.num(f2.get('feeJual'));
      if (fb < 0 || fj < 0 || fb > 5 || fj > 5) return toast('Fee harus antara 0 dan 5 persen.', 'err');
      S.saveSettings({ feeBeli: fb, feeJual: fj });
      toast('Biaya broker disimpan');
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
    if (!document.hidden && S.isSheet() && Date.now() - (S.prices.at || 0) > 5 * 60 * 1000) refreshPrices(false);
  }, 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S.isSheet() && Date.now() - (S.prices.at || 0) > 5 * 60 * 1000) refreshPrices(false);
  });
}());
