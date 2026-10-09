/* Porto — grafik SVG tanpa pustaka. */
(function (root) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var nf = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

  function rp(n) { return (n < 0 ? '−' : '') + 'Rp ' + nf.format(Math.abs(Math.round(n))); }

  function compact(n) {
    var a = Math.abs(n), s = n < 0 ? '−' : '';
    function f(v) { return (v >= 10 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',').replace(',0', ''); }
    if (a >= 1e9) return s + f(a / 1e9) + ' M';
    if (a >= 1e6) return s + f(a / 1e6) + ' jt';
    if (a >= 1e3) return s + f(a / 1e3) + ' rb';
    return s + Math.round(a);
  }

  function signedCompact(n) { return (n > 0 ? '+' : '') + compact(n); }

  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function monthLabel(ym) {
    return MONTHS[Number(ym.slice(5, 7)) - 1];
  }

  /**
   * Pita profit bulanan: batang di atas garis nol = untung, di bawah = rugi.
   * Dividen ditumpuk di atas profit jual.
   */
  function monthly(months, opts) {
    opts = opts || {};
    if (!months.length) return '';
    var H = opts.height || 280;
    var m = { l: 58, r: 14, t: 26, b: 44 };
    var slot = 56;
    var W = Math.max(560, months.length * slot + m.l + m.r);
    var bw = Math.min(30, slot - 16);

    var maxV = 0, minV = 0;
    months.forEach(function (x) {
      var top = Math.max(x.realized, 0) + x.dividend;
      var bot = Math.min(x.realized, 0);
      if (top > maxV) maxV = top;
      if (bot < minV) minV = bot;
    });
    if (maxV === 0 && minV === 0) maxV = 1;
    var step = niceStep((maxV - minV) / 4 || 1);
    // ruang ekstra agar label nilai di ujung batang tidak menabrak garis atau nama bulan
    var lo = minV < 0 ? Math.floor((minV - step * 0.35) / step) * step : 0;
    var hi = maxV > 0 ? Math.ceil((maxV + step * 0.35) / step) * step : 0;
    if (hi === lo) hi = lo + step;

    var plotH = H - m.t - m.b;
    function y(v) { return m.t + (hi - v) / (hi - lo) * plotH; }

    var out = [];
    out.push('<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Profit per bulan') + '">');

    for (var t = lo; t <= hi + step / 2; t += step) {
      var yy = y(t);
      out.push('<line class="' + (Math.abs(t) < step / 1000 ? 'zero' : 'grid') + '" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + yy + '" y2="' + yy + '"/>');
      out.push('<text x="' + (m.l - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + compact(t) + '</text>');
    }

    var zeroY = y(0);
    months.forEach(function (x, i) {
      var cx = m.l + i * slot + slot / 2;
      var bx = cx - bw / 2;
      var delay = (i * 25) + 'ms';
      var topY = zeroY;
      var botY = zeroY;

      if (x.realized > 0) {
        var h = zeroY - y(x.realized);
        topY = zeroY - h;
        out.push('<rect class="bar up b-gain" style="animation-delay:' + delay + '" x="' + bx + '" y="' + topY + '" width="' + bw + '" height="' + h + '" rx="2"/>');
      } else if (x.realized < 0) {
        var h2 = y(x.realized) - zeroY;
        botY = zeroY + h2;
        out.push('<rect class="bar down b-loss" style="animation-delay:' + delay + '" x="' + bx + '" y="' + zeroY + '" width="' + bw + '" height="' + h2 + '" rx="2"/>');
      }
      if (x.dividend > 0) {
        var dh = y(0) - y(x.dividend);
        var dy = topY - dh;
        out.push('<rect class="bar up b-div" style="animation-delay:' + delay + '" x="' + bx + '" y="' + dy + '" width="' + bw + '" height="' + dh + '" rx="2"/>');
        topY = dy;
      }

      if (Math.abs(x.total) > 0.5) {
        var ly = x.total >= 0 ? topY - 6 : botY + 14;
        out.push('<text class="tot ' + (x.total >= 0 ? 'gain' : 'loss') + '" x="' + cx + '" y="' + ly + '" text-anchor="middle">' + signedCompact(x.total) + '</text>');
      }

      var showYear = i === 0 || x.month.slice(5, 7) === '01';
      out.push('<text x="' + cx + '" y="' + (H - m.b + 17) + '" text-anchor="middle">' + monthLabel(x.month) + '</text>');
      if (showYear) out.push('<text x="' + cx + '" y="' + (H - m.b + 31) + '" text-anchor="middle" style="font-weight:700">' + x.month.slice(0, 4) + '</text>');

      var tip = monthLabel(x.month) + ' ' + x.month.slice(0, 4) +
        '\nProfit jual: ' + rp(x.realized) +
        '\nDividen: ' + rp(x.dividend) +
        '\nTotal: ' + rp(x.total);
      out.push('<rect class="hit" x="' + (cx - slot / 2) + '" y="' + m.t + '" width="' + slot + '" height="' + plotH + '"><title>' + esc(tip) + '</title></rect>');
    });

    out.push('</svg>');
    return out.join('');
  }

  root.Charts = { monthly: monthly, compact: compact, monthLabel: monthLabel, MONTHS: MONTHS };
}(typeof self !== 'undefined' ? self : this));
