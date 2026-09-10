/* ============================================================
   util.js — 通用工具：DOM / 格式化 / MD5 / Toast / 抽屉
   ============================================================ */
(function (w) {
  'use strict';

  /* ================= DOM ================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'style') n.setAttribute('style', attrs[k]);
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    if (html !== undefined) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(id, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '"><use href="#' + id + '"/></svg>';
  }
  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, c = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 260);
    };
  }

  /* ================= 格式化 ================= */
  function num(v, d) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '—';
    return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: d || 0, maximumFractionDigits: d === undefined ? 0 : d });
  }
  function km(m) {
    if (m === null || m === undefined || isNaN(m)) return '—';
    var v = Number(m);
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + ' km';
    return Math.round(v) + ' m';
  }
  function dist(m) {
    if (m === null || m === undefined || isNaN(m)) return '—';
    return (Number(m) / 1000).toFixed(1) + ' km';
  }
  function bytes(b) {
    if (b === null || b === undefined || isNaN(b)) return '—';
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0, v = Number(b);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(i === 0 ? 0 : 1) + ' ' + u[i];
  }
  function dur(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return '—';
    var s = Math.floor(Number(ms) / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + (s % 60) + 's';
    return s + 's';
  }
  function pct(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d === undefined ? 1 : d) + '%'; }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  /** 时间戳(ms 或 s) / 日期串 → 'YYYY-MM-DD HH:mm:ss' */
  function dt(v, withSec) {
    if (v === null || v === undefined || v === '' || v === 0) return '—';
    var d;
    if (typeof v === 'number') d = new Date(v < 1e11 ? v * 1000 : v);
    else d = new Date(String(v).replace(/-/g, '/'));
    if (isNaN(d.getTime())) return String(v);
    var s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    return withSec === false ? s : s + ':' + pad(d.getSeconds());
  }
  function ago(v) {
    if (!v) return '—';
    var t = typeof v === 'number' ? (v < 1e11 ? v * 1000 : v) : new Date(String(v).replace(/-/g, '/')).getTime();
    if (isNaN(t)) return '—';
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 0) return '刚刚';
    if (s < 60) return s + ' 秒前';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 2592000) return Math.floor(s / 86400) + ' 天前';
    return dt(v, false);
  }
  /** UTC 'YYYY-MM-DD HH:mm:ss' */
  function utcStr(d) {
    d = d || new Date();
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + ' ' +
      pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds());
  }
  function localStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function tsStr(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /* ================= 颜色 ================= */
  var PALETTE = ['#E88828', '#2AC2F3', '#28C76F', '#9B6BFF', '#FFB020', '#F0453A', '#22D3C5', '#6FD8FA', '#F5A24B', '#C4A6FF'];
  function colorOf(key) {
    var s = String(key || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  function hashColor(key) { return colorOf(key); }

  /* ================= MD5（TSP 签名用） ================= */
  var MD5 = (function () {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function au(x, y) { var l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
    function cmn(q, a, b, x, s, t) { return au(rl(au(au(a, q), au(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

    function toBlocks(str) {
      // UTF-8 编码
      var utf8 = unescape(encodeURIComponent(str));
      var n = utf8.length, blks = [], i;
      var words = [];
      for (i = 0; i < n; i++) words[i >> 2] = (words[i >> 2] || 0) | (utf8.charCodeAt(i) << ((i % 4) * 8));
      words[n >> 2] = (words[n >> 2] || 0) | (0x80 << ((n % 4) * 8));
      var len = n * 8;
      words[(((n + 8) >> 6) + 1) * 16 - 2] = len & 0xFFFFFFFF;
      words[(((n + 8) >> 6) + 1) * 16 - 1] = Math.floor(len / 4294967296);
      for (i = 0; i < words.length; i += 16) {
        var b = [];
        for (var j = 0; j < 16; j++) b[j] = words[i + j] || 0;
        blks.push(b);
      }
      return blks;
    }

    return function (str) {
      var blks = toBlocks(String(str));
      var a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
      for (var k = 0; k < blks.length; k++) {
        var x = blks[k];
        var oa = a, ob = b, oc = c, od = d;
        a = ff(a, b, c, d, x[0], 7, -680876936); d = ff(d, a, b, c, x[1], 12, -389564586);
        c = ff(c, d, a, b, x[2], 17, 606105819); b = ff(b, c, d, a, x[3], 22, -1044525330);
        a = ff(a, b, c, d, x[4], 7, -176418897); d = ff(d, a, b, c, x[5], 12, 1200080426);
        c = ff(c, d, a, b, x[6], 17, -1473231341); b = ff(b, c, d, a, x[7], 22, -45705983);
        a = ff(a, b, c, d, x[8], 7, 1770035416); d = ff(d, a, b, c, x[9], 12, -1958414417);
        c = ff(c, d, a, b, x[10], 17, -42063); b = ff(b, c, d, a, x[11], 22, -1990404162);
        a = ff(a, b, c, d, x[12], 7, 1804603682); d = ff(d, a, b, c, x[13], 12, -40341101);
        c = ff(c, d, a, b, x[14], 17, -1502002290); b = ff(b, c, d, a, x[15], 22, 1236535329);
        a = gg(a, b, c, d, x[1], 5, -165796510); d = gg(d, a, b, c, x[6], 9, -1069501632);
        c = gg(c, d, a, b, x[11], 14, 643717713); b = gg(b, c, d, a, x[0], 20, -373897302);
        a = gg(a, b, c, d, x[5], 5, -701558691); d = gg(d, a, b, c, x[10], 9, 38016083);
        c = gg(c, d, a, b, x[15], 14, -660478335); b = gg(b, c, d, a, x[4], 20, -405537848);
        a = gg(a, b, c, d, x[9], 5, 568446438); d = gg(d, a, b, c, x[14], 9, -1019803690);
        c = gg(c, d, a, b, x[3], 14, -187363961); b = gg(b, c, d, a, x[8], 20, 1163531501);
        a = gg(a, b, c, d, x[13], 5, -1444681467); d = gg(d, a, b, c, x[2], 9, -51403784);
        c = gg(c, d, a, b, x[7], 14, 1735328473); b = gg(b, c, d, a, x[12], 20, -1926607734);
        a = hh(a, b, c, d, x[5], 4, -378558); d = hh(d, a, b, c, x[8], 11, -2022574463);
        c = hh(c, d, a, b, x[11], 16, 1839030562); b = hh(b, c, d, a, x[14], 23, -35309556);
        a = hh(a, b, c, d, x[1], 4, -1530992060); d = hh(d, a, b, c, x[4], 11, 1272893353);
        c = hh(c, d, a, b, x[7], 16, -155497632); b = hh(b, c, d, a, x[10], 23, -1094730640);
        a = hh(a, b, c, d, x[13], 4, 681279174); d = hh(d, a, b, c, x[0], 11, -358537222);
        c = hh(c, d, a, b, x[3], 16, -722521979); b = hh(b, c, d, a, x[6], 23, 76029189);
        a = hh(a, b, c, d, x[9], 4, -640364487); d = hh(d, a, b, c, x[12], 11, -421815835);
        c = hh(c, d, a, b, x[15], 16, 530742520); b = hh(b, c, d, a, x[2], 23, -995338651);
        a = ii(a, b, c, d, x[0], 6, -198630844); d = ii(d, a, b, c, x[7], 10, 1126891415);
        c = ii(c, d, a, b, x[14], 15, -1416354905); b = ii(b, c, d, a, x[5], 21, -57434055);
        a = ii(a, b, c, d, x[12], 6, 1700485571); d = ii(d, a, b, c, x[3], 10, -1894986606);
        c = ii(c, d, a, b, x[10], 15, -1051523); b = ii(b, c, d, a, x[1], 21, -2054922799);
        a = ii(a, b, c, d, x[8], 6, 1873313359); d = ii(d, a, b, c, x[15], 10, -30611744);
        c = ii(c, d, a, b, x[6], 15, -1560198380); b = ii(b, c, d, a, x[13], 21, 1309151649);
        a = ii(a, b, c, d, x[4], 6, -145523070); d = ii(d, a, b, c, x[11], 10, -1120210379);
        c = ii(c, d, a, b, x[2], 15, 718787259); b = ii(b, c, d, a, x[9], 21, -343485551);
        a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od);
      }
      function hex(n) {
        var s = '', i;
        for (i = 0; i < 4; i++) s += pad(((n >> (i * 8)) & 0xFF).toString(16));
        return s;
      }
      return hex(a) + hex(b) + hex(c) + hex(d);
    };
  })();

  /* ================= Toast ================= */
  var TOAST_ICON = { ok: 'i-check', err: 'i-warn', warn: 'i-warn', info: 'i-bolt' };
  function toast(msg, type, ms) {
    var box = $('#toasts'); if (!box) return;
    type = type || 'info';
    var t = el('div', { class: 'toast ' + type },
      icon(TOAST_ICON[type] || 'i-bolt') + '<div>' + esc(msg) + '</div>');
    box.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .25s,transform .25s';
      t.style.opacity = '0'; t.style.transform = 'translateX(24px)';
      setTimeout(function () { t.remove(); }, 260);
    }, ms || 3600);
  }

  /* ================= 抽屉 ================= */
  var Drawer = {
    open: function (title, html) {
      $('#drawerTitle').textContent = title;
      $('#drawerBody').innerHTML = html;
      $('#drawer').classList.add('on');
      $('#drawerMask').classList.add('on');
    },
    close: function () {
      $('#drawer').classList.remove('on');
      $('#drawerMask').classList.remove('on');
    }
  };

  /* ================= 其他 ================= */
  function kvList(obj, titleMap) {
    var rows = '';
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (v === null || v === undefined || v === '') v = '—';
      else if (typeof v === 'object') v = JSON.stringify(v);
      rows += '<dt>' + esc(titleMap && titleMap[k] ? titleMap[k] : k) + '</dt><dd>' + esc(v) + '</dd>';
    });
    return '<dl class="dl">' + rows + '</dl>';
  }
  function download(name, text, mime) {
    var b = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var u = URL.createObjectURL(b), a = el('a', { href: u, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 1200);
  }
  function toCSV(rows, headers) {
    if (!rows || !rows.length) return '';
    headers = headers || Object.keys(rows[0]);
    var q = function (v) {
      if (v === null || v === undefined) return '';
      var s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    };
    return '\ufeff' + headers.join(',') + '\n' + rows.map(function (r) {
      return headers.map(function (h) { return q(r[h]); }).join(',');
    }).join('\n');
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function groupBy(arr, fn) {
    return arr.reduce(function (m, x) { var k = fn(x); (m[k] = m[k] || []).push(x); return m; }, {});
  }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }
  function highlight(json) {
    return esc(typeof json === 'string' ? json : JSON.stringify(json, null, 2))
      .replace(/&quot;([^&]*?)&quot;(\s*:)/g, '<span class="k">"$1"</span>$2')
      .replace(/:\s*&quot;([^&]*?)&quot;/g, ': <span class="s">"$1"</span>')
      .replace(/:\s*(-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="b">$1</span>');
  }

  w.U = {
    $: $, $$: $$, el: el, esc: esc, icon: icon, debounce: debounce,
    num: num, km: km, dist: dist, bytes: bytes, dur: dur, pct: pct,
    dt: dt, ago: ago, utcStr: utcStr, localStr: localStr, tsStr: tsStr, pad: pad,
    PALETTE: PALETTE, colorOf: colorOf, hashColor: hashColor,
    md5: MD5, toast: toast, Drawer: Drawer, kvList: kvList,
    download: download, toCSV: toCSV, sleep: sleep, clamp: clamp,
    groupBy: groupBy, uniq: uniq, highlight: highlight
  };
})(window);
