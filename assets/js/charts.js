/* ============================================================
   charts.js — 零依赖 SVG 图表库（深色主题）
   所有函数返回 SVG 字符串，可直接 innerHTML 到容器
   ============================================================ */
(function (w) {
  'use strict';
  var U = w.U;
  var C = {
    orange: '#E88828', blue: '#2AC2F3', ok: '#28C76F', warn: '#FFB020',
    err: '#F0453A', purple: '#9B6BFF', teal: '#22D3C5', grid: '#1A2A44'
  };
  var SERIES = ['#E88828', '#2AC2F3', '#28C76F', '#9B6BFF', '#FFB020', '#22D3C5'];

  function nf(v) {
    if (v === null || v === undefined || isNaN(v)) return '0';
    var a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (a >= 1e4) return (v / 1e3).toFixed(0) + 'k';
    if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
    return (Math.round(v * 10) / 10).toString();
  }
  function niceMax(v) {
    if (v <= 0) return 10;
    var e = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / e;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return m * e;
  }
  function uid() { return 'c' + Math.random().toString(36).slice(2, 8); }

  /* ============================================================
     1. 迷你走势 Sparkline（面积）
     ============================================================ */
  function sparkline(data, opt) {
    opt = opt || {};
    var W = opt.w || 300, H = opt.h || 40, pad = 2;
    var vals = (data || []).map(function (v) { return Number(v) || 0; });
    if (!vals.length) vals = [0, 0];
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max === min) max = min + 1;
    var id = uid();
    var n = vals.length;
    var px = function (i) { return pad + (W - pad * 2) * (n === 1 ? 0.5 : i / (n - 1)); };
    var py = function (v) { return H - pad - (H - pad * 2) * ((v - min) / (max - min)); };
    var line = vals.map(function (v, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1); }).join(' ');
    var area = line + ' L' + px(n - 1).toFixed(1) + ' ' + H + ' L' + px(0).toFixed(1) + ' ' + H + ' Z';
    var col = opt.color || C.orange;
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="height:' + H + 'px">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + col + '" stop-opacity=".42"/>' +
      '<stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      (n ? '<circle cx="' + px(n - 1).toFixed(1) + '" cy="' + py(vals[n - 1]).toFixed(1) + '" r="2.6" fill="' + col + '"/>' : '') +
      '</svg>';
  }

  /* ============================================================
     2. 折线 / 面积图（多序列 + 坐标轴 + 网格 + 悬浮）
     ============================================================ */
  function lineChart(labels, series, opt) {
    opt = opt || {};
    var W = 640, H = opt.h || 240;
    var PL = opt.padLeft || 46, PR = 14, PT = 14, PB = 30;
    var iw = W - PL - PR, ih = H - PT - PB;
    var flat = [];
    series.forEach(function (s) { (s.data || []).forEach(function (v) { if (v !== null && !isNaN(v)) flat.push(Number(v)); }); });
    if (!flat.length) flat = [0];
    var maxV = niceMax(Math.max.apply(null, flat) * 1.12);
    var n = labels.length || 1;
    var x = function (i) { return PL + (n === 1 ? iw / 2 : iw * i / (n - 1)); };
    var y = function (v) { return PT + ih - ih * (U.clamp(Number(v) || 0, 0, maxV) / maxV); };
    var id = uid(), out = [];

    // 网格 + Y 轴刻度
    for (var g = 0; g <= 4; g++) {
      var gy = PT + ih * g / 4, gv = maxV * (1 - g / 4);
      out.push('<line class="gl" x1="' + PL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + gy.toFixed(1) + '"' +
        (g === 4 ? '' : ' stroke-dasharray="3 5"') + '/>');
      out.push('<text class="ax" x="' + (PL - 8) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + nf(gv) + '</text>');
    }
    // X 轴标签（最多 8 个）
    var step = Math.max(1, Math.ceil(n / 8));
    labels.forEach(function (lb, i) {
      if (i % step !== 0 && i !== n - 1) return;
      out.push('<text class="ax" x="' + x(i).toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + U.esc(lb) + '</text>');
    });

    // 序列
    series.forEach(function (s, si) {
      var col = s.color || SERIES[si % SERIES.length];
      var pts = (s.data || []).map(function (v, i) { return v === null || v === undefined || isNaN(v) ? null : [x(i), y(v)]; });
      var segs = [], cur = [];
      pts.forEach(function (p) { if (p) cur.push(p); else { if (cur.length) segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      if (opt.area !== false && series.length <= 2) {
        segs.forEach(function (seg, k) {
          if (seg.length < 2) return;
          var gid = id + '_' + si + '_' + k;
          out.push('<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + col + '" stop-opacity=".3"/>' +
            '<stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>');
          out.push('<path d="M' + seg.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') +
            ' L' + seg[seg.length - 1][0].toFixed(1) + ' ' + (PT + ih) + ' L' + seg[0][0].toFixed(1) + ' ' + (PT + ih) + ' Z" fill="url(#' + gid + ')"/>');
        });
      }
      segs.forEach(function (seg) {
        out.push('<path d="M' + seg.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L') +
          '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>');
      });
      if (opt.dots !== false && n <= 32) {
        pts.forEach(function (p, i) {
          if (!p) return;
          var v = s.data[i];
          out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#0D1626" stroke="' + col + '" stroke-width="2"><title>' +
            U.esc(labels[i] || '') + ' · ' + U.esc(s.name || '') + ' : ' + U.esc(String(v)) + '</title></circle>');
        });
      }
    });

    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="height:' + H + 'px;width:100%">' + out.join('') + '</svg>';
  }

  /* ============================================================
     3. 柱状图（单序列 / 堆叠）
     ============================================================ */
  function barChart(labels, series, opt) {
    opt = opt || {};
    var W = 640, H = opt.h || 240;
    var PL = 46, PR = 14, PT = 14, PB = 32;
    var iw = W - PL - PR, ih = H - PT - PB;
    var totals = labels.map(function (_, i) {
      return series.reduce(function (a, s) { return a + (Number(s.data[i]) || 0); }, 0);
    });
    var maxV = niceMax(Math.max.apply(null, totals.concat([1])) * 1.1);
    var n = labels.length || 1;
    var slot = iw / n, bw = Math.min(opt.barW || 34, slot * 0.62);
    var y = function (v) { return PT + ih - ih * (U.clamp(Number(v) || 0, 0, maxV) / maxV); };
    var out = [], id = uid();

    for (var g = 0; g <= 4; g++) {
      var gy = PT + ih * g / 4;
      out.push('<line class="gl" x1="' + PL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + gy.toFixed(1) + '"' + (g === 4 ? '' : ' stroke-dasharray="3 5"') + '/>');
      out.push('<text class="ax" x="' + (PL - 8) + '" y="' + (gy + 3.5).toFixed(1) + '" text-anchor="end">' + nf(maxV * (1 - g / 4)) + '</text>');
    }
    labels.forEach(function (lb, i) {
      var cx = PL + slot * i + slot / 2;
      var acc = 0;
      series.forEach(function (s, si) {
        var v = Number(s.data[i]) || 0; if (!v) return;
        var col = s.color || SERIES[si % SERIES.length];
        var y0 = y(acc), y1 = y(acc + v);
        var hgt = Math.max(1.5, y0 - y1);
        out.push('<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hgt.toFixed(1) +
          '" rx="3" fill="' + col + '" opacity="' + (si === 0 ? 1 : .88) + '"><title>' + U.esc(lb) + ' · ' + U.esc(s.name || '') + ': ' + v + '</title></rect>');
        acc += v;
      });
      var step = Math.max(1, Math.ceil(n / 10));
      if (i % step === 0 || i === n - 1)
        out.push('<text class="ax" x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + U.esc(lb) + '</text>');
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="height:' + H + 'px;width:100%">' + out.join('') + '</svg>';
  }

  /* ============================================================
     4. 水平条形图
     ============================================================ */
  function hBar(items, opt) {
    opt = opt || {};
    var rowH = opt.rowH || 30, W = 640;
    var H = Math.max(40, items.length * rowH + 8);
    var LW = opt.labelW || 128, VW = 62;
    var maxV = niceMax(Math.max.apply(null, items.map(function (i) { return Number(i.value) || 0 }).concat([1])));
    var out = [];
    items.forEach(function (it, i) {
      var y = i * rowH + 6, bh = rowH - 14;
      var w = (W - LW - VW) * ((Number(it.value) || 0) / maxV);
      var col = it.color || SERIES[i % SERIES.length];
      out.push('<text class="lbl" x="0" y="' + (y + bh / 2 + 3.5).toFixed(1) + '">' + U.esc(String(it.label).slice(0, 18)) + '</text>');
      out.push('<rect x="' + LW + '" y="' + y.toFixed(1) + '" width="' + (W - LW - VW) + '" height="' + bh.toFixed(1) + '" rx="4" fill="#16233A"/>');
      out.push('<rect x="' + LW + '" y="' + y.toFixed(1) + '" width="' + Math.max(2, w).toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + col + '"><title>' + U.esc(it.label) + ': ' + it.value + '</title></rect>');
      out.push('<text class="val" x="' + (W - 2) + '" y="' + (y + bh / 2 + 3.5).toFixed(1) + '" text-anchor="end">' + U.esc(nf(it.value)) + (it.suffix || '') + '</text>');
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="height:' + H + 'px;width:100%">' + out.join('') + '</svg>';
  }

  /* ============================================================
     5. 环形图（Donut）
     ============================================================ */
  function donut(items, opt) {
    opt = opt || {};
    var S = opt.size || 190, R = S / 2, r = opt.inner || R * 0.62;
    var total = items.reduce(function (a, i) { return a + (Number(i.value) || 0); }, 0);
    var cx = R, cy = R, out = [];
    if (total <= 0) {
      out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + ((R + r) / 2) + '" fill="none" stroke="#1A2A44" stroke-width="' + (R - r) + '"/>');
    } else {
      var ang = -Math.PI / 2;
      items.forEach(function (it, i) {
        var v = Number(it.value) || 0; if (v <= 0) return;
        var a2 = ang + Math.PI * 2 * (v / total);
        var large = (a2 - ang) > Math.PI ? 1 : 0;
        var p = function (rad, a) { return [(cx + rad * Math.cos(a)).toFixed(2), (cy + rad * Math.sin(a)).toFixed(2)]; };
        var o1 = p(R, ang), o2 = p(R, a2), i2 = p(r, a2), i1 = p(r, ang);
        var col = it.color || SERIES[i % SERIES.length];
        out.push('<path d="M' + o1 + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + o2 + ' L' + i2 + ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + i1 + ' Z" fill="' + col + '" stroke="#0D1626" stroke-width="1.5"><title>' +
          U.esc(it.label) + ': ' + v + ' (' + (v / total * 100).toFixed(1) + '%)</title></path>');
        ang = a2;
      });
    }
    var mid = opt.centerValue !== undefined ? opt.centerValue : nf(total);
    var sub = opt.centerLabel !== undefined ? opt.centerLabel : '总计';
    out.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" fill="#E8EEF8" font-size="' + (S > 170 ? 24 : 19) + '" font-weight="800" font-family="Inter,sans-serif">' + U.esc(mid) + '</text>');
    out.push('<text x="' + cx + '" y="' + (cy + 17) + '" text-anchor="middle" fill="#6C7F9C" font-size="11" font-family="Inter,sans-serif">' + U.esc(sub) + '</text>');
    return '<svg class="chart" viewBox="0 0 ' + S + ' ' + S + '" style="width:' + S + 'px;height:' + S + 'px">' + out.join('') + '</svg>';
  }

  /* ============================================================
     6. 仪表盘 Gauge（半环）
     ============================================================ */
  function gauge(value, opt) {
    opt = opt || {};
    var W = 240, H = 148, R = 96, cx = W / 2, cy = 122;
    var v = U.clamp(Number(value) || 0, 0, 100);
    var col = opt.color || (v >= 85 ? C.err : v >= 65 ? C.warn : C.ok);
    // 半环：θ 从 π(左) 递减到 0(右)，θ = π*(1 - ratio)
    function pt(ratio) {
      var a = Math.PI * (1 - U.clamp(ratio, 0, 1));
      return [(cx + R * Math.cos(a)).toFixed(2), (cy - R * Math.sin(a)).toFixed(2)];
    }
    function arc(r1, r2) {
      var s = pt(r1), e = pt(r2);
      var large = Math.abs(r2 - r1) > 0.5 ? 1 : 0;
      return 'M' + s[0] + ' ' + s[1] + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + e[0] + ' ' + e[1];
    }
    var track = arc(0, 1), val = arc(0, v / 100);
    var out = [
      '<path d="' + track + '" fill="none" stroke="#1A2A44" stroke-width="15" stroke-linecap="round"/>',
      '<path d="' + val + '" fill="none" stroke="' + col + '" stroke-width="15" stroke-linecap="round"/>',
      '<text x="' + cx + '" y="' + (cy - 26) + '" text-anchor="middle" fill="#E8EEF8" font-size="30" font-weight="800" font-family="Inter,sans-serif">' + v.toFixed(1) + '<tspan font-size="14" fill="#6C7F9C">%</tspan></text>',
      '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" fill="#6C7F9C" font-size="11" font-family="Inter,sans-serif">' + U.esc(opt.label || '') + '</text>',
      '<text x="' + (cx - R) + '" y="' + (cy + 16) + '" text-anchor="middle" fill="#6C7F9C" font-size="10" font-family="Inter,sans-serif">0</text>',
      '<text x="' + (cx + R) + '" y="' + (cy + 16) + '" text-anchor="middle" fill="#6C7F9C" font-size="10" font-family="Inter,sans-serif">100</text>'
    ];
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;max-width:' + W + 'px;height:' + H + 'px">' + out.join('') + '</svg>';
  }

  /* ============================================================
     7. 热力图（按小时/星期分布）
     ============================================================ */
  function heatmap(matrix, opt) {
    opt = opt || {};
    var rows = matrix.length, cols = matrix[0] ? matrix[0].length : 0;
    var cw = 26, ch = 22, PL = 44, PT = 18, W = PL + cols * cw + 8, H = PT + rows * ch + 8;
    var max = 1;
    matrix.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
    var out = [];
    for (var c = 0; c < cols; c++) out.push('<text class="ax" x="' + (PL + c * cw + cw / 2) + '" y="11" text-anchor="middle">' + c + '</text>');
    for (var r2 = 0; r2 < rows; r2++) {
      out.push('<text class="ax" x="' + (PL - 7) + '" y="' + (PT + r2 * ch + ch / 2 + 3.5) + '" text-anchor="end">' + U.esc((opt.rowLabels && opt.rowLabels[r2]) || r2) + '</text>');
      for (var c2 = 0; c2 < cols; c2++) {
        var v = matrix[r2][c2] || 0;
        var t = max ? v / max : 0;
        var col = t === 0 ? '#131F33' : 'rgba(' + (232) + ',' + (136 + 40 * (1 - t)) + ',' + (40 + 100 * (1 - t)) + ',' + (0.16 + 0.84 * t) + ')';
        out.push('<rect x="' + (PL + c2 * cw + 1) + '" y="' + (PT + r2 * ch + 1) + '" width="' + (cw - 3) + '" height="' + (ch - 3) + '" rx="3" fill="' + col + '"><title>' +
          U.esc((opt.rowLabels && opt.rowLabels[r2]) || r2) + ' ' + c2 + ':00 — ' + v + '</title></rect>');
      }
    }
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" style="height:' + H + 'px;max-width:100%">' + out.join('') + '</svg>';
  }

  /* ============================================================
     8. 进度条组
     ============================================================ */
  function progress(label, value, max, color) {
    var p = max ? U.clamp(value / max * 100, 0, 100) : 0;
    return '<div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px">' +
      '<span style="color:var(--tx-2);font-weight:600">' + U.esc(label) + '</span>' +
      '<span class="mono" style="color:var(--tx-3)">' + nf(value) + '</span></div>' +
      '<div class="bar"><i style="width:' + p.toFixed(1) + '%;background:' + (color || C.orange) + '"></i></div></div>';
  }

  w.CHART = {
    sparkline: sparkline, line: lineChart, bar: barChart, hBar: hBar,
    donut: donut, gauge: gauge, heatmap: heatmap, progress: progress,
    colors: C, series: SERIES, nf: nf, niceMax: niceMax
  };
})(window);
