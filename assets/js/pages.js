/* ============================================================
   pages.js — 核心页面：总览 / 设备 / 地图 / 告警
   ============================================================ */
(function (w) {
  'use strict';
  var U = w.U, CH = w.CHART, API = w.API;

  /* ================= 公共片段 ================= */
  function kpi(o) {
    return '<div class="card kpi">' +
      '<div class="kpi-top"><div><div class="kpi-label">' + U.esc(o.label) + '</div>' +
      '<div class="kpi-val">' + o.value + (o.unit ? '<small>' + U.esc(o.unit) + '</small>' : '') + '</div></div>' +
      '<div class="kpi-ico" style="background:' + (o.color || CH.colors.orange) + '22;border:1px solid ' + (o.color || CH.colors.orange) + '44">' +
      '<svg class="ico" style="fill:' + (o.color || CH.colors.orange) + '"><use href="#' + (o.icon || 'i-dash') + '"/></svg></div></div>' +
      '<div class="kpi-foot">' + (o.foot || '') + '</div>' +
      (o.spark ? '<div class="kpi-spark">' + CH.sparkline(o.spark, { color: o.color || CH.colors.orange, h: 34 }) + '</div>' : '') +
      '</div>';
  }
  function legend(items) {
    return '<div class="legend">' + items.map(function (i) {
      return '<span><i style="background:' + i.color + '"></i>' + U.esc(i.label) +
        (i.value !== undefined ? ' <b class="mono" style="color:var(--tx)">' + i.value + '</b>' : '') + '</span>';
    }).join('') + '</div>';
  }
  function card(title, body, right, sub) {
    return '<div class="card"><div class="card-h"><h3>' + U.esc(title) + '</h3>' +
      (sub ? '<span class="sub">' + U.esc(sub) + '</span>' : '') +
      (right ? '<div class="right">' + right + '</div>' : '') + '</div>' + body + '</div>';
  }
  function loading(txt) { return '<div class="loading-row"><span class="spin"></span>' + U.esc(txt || '加载中…') + '</div>'; }
  function empty(title, desc, icon) {
    return '<div class="empty"><svg><use href="#' + (icon || 'i-dash') + '"/></svg><b>' + U.esc(title) + '</b><p>' + U.esc(desc || '') + '</p></div>';
  }
  function onlineTag(st) {
    if (st === 1) return '<span class="tag on"><i></i>在线</span>';
    if (st === 2) return '<span class="tag off"><i></i>离线</span>';
    return '<span class="tag none"><i></i>未激活</span>';
  }
  function srcTag(src) {
    return src === 'turbohive'
      ? '<span class="tag orange"><i></i>TurboHive</span>'
      : '<span class="tag blue"><i></i>TrackSolidPro</span>';
  }
  function pager(state, onGo) {
    var total = state.total || 0, size = state.size || 15, page = state.page || 1;
    var pages = Math.max(1, Math.ceil(total / size));
    return '<div class="pager"><span class="info">共 <b class="mono">' + U.num(total) + '</b> 条 · 第 ' + page + '/' + pages + ' 页</span>' +
      '<button data-pg="1" ' + (page <= 1 ? 'disabled' : '') + '>首页</button>' +
      '<button data-pg="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>' +
      '<button data-pg="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>下一页</button>' +
      '<button data-pg="' + pages + '" ' + (page >= pages ? 'disabled' : '') + '>末页</button></div>';
  }
  function bindPager(root, state, reload) {
    U.$$('.pager button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = parseInt(b.getAttribute('data-pg'), 10);
        if (!p || p < 1) return;
        state.page = p; reload();
      });
    });
  }

  /* ============================================================
     1) 总览看板
     ============================================================ */
  function renderOverview(root) {
    var S = w.STORE;
    var d = S.devices, al = S.alerts, gw = S.gateways, ms = S.mileage;
    var online = d.filter(function (x) { return x.online === 1; }).length;
    var offline = d.filter(function (x) { return x.online === 2; }).length;
    var inactive = d.length - online - offline;
    var thCount = d.filter(function (x) { return x.src === 'turbohive'; }).length;
    var tspCount = d.filter(function (x) { return x.src === 'tsp'; }).length;
    var totalMileage = ms.reduce(function (a, x) { return a + (Number(x.totalMileage) || 0); }, 0);
    var todayMileage = ms.reduce(function (a, x) { return a + (Number(x.todayMileage) || 0); }, 0);
    var moving = d.filter(function (x) { return x.motion === 1 || (Number(x.speed) || 0) > 3; }).length;
    var alert24 = al.filter(function (a) { return a.time && (Date.now() - a.time) < 86400000; }).length;
    var alert7d = al.filter(function (a) { return a.time && (Date.now() - a.time) < 604800000; }).length;

    // 设备类型分布（Top6 + 其他）
    var byType = U.groupBy(d, function (x) { return x.deviceType || '未知'; });
    var typeItems = Object.keys(byType).map(function (k) {
      return { label: k, value: byType[k].length };
    }).sort(function (a, b) { return b.value - a.value; });
    if (typeItems.length > 6) {
      var rest = typeItems.slice(6).reduce(function (a, x) { return a + x.value; }, 0);
      typeItems = typeItems.slice(0, 6).concat([{ label: '其他类型', value: rest }]);
    }
    typeItems = typeItems.map(function (x, i) {
      return { label: x.label, value: x.value, color: CH.series[i % CH.series.length] };
    });

    // 协议分布
    var byProto = U.groupBy(d, function (x) { return x.protocol || '未知'; });
    var protoItems = Object.keys(byProto).map(function (k, i) {
      return { label: k, value: byProto[k].length, color: CH.series[(i + 2) % CH.series.length] };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8);

    // 告警类型 TOP
    var byAt = U.groupBy(al, function (x) { return x.name || ('类型 ' + x.type); });
    var alertItems = Object.keys(byAt).map(function (k, i) {
      return { label: k, value: byAt[k].length, color: CH.series[(i + 1) % CH.series.length] };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8);

    // 24h 告警趋势
    var hours = [], hCounts = [], now = new Date();
    for (var i = 23; i >= 0; i--) {
      var t0 = new Date(now.getTime() - i * 3600000); t0.setMinutes(0, 0, 0);
      var t1 = t0.getTime() + 3600000;
      hours.push(U.pad(t0.getHours()) + ':00');
      hCounts.push(al.filter(function (a) { return a.time >= t0.getTime() && a.time < t1; }).length);
    }
    // 7 天告警趋势
    var days = [], dCounts = [];
    for (var j = 6; j >= 0; j--) {
      var s0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - j).getTime();
      var s1 = s0 + 86400000;
      days.push(U.pad(new Date(s0).getMonth() + 1) + '-' + U.pad(new Date(s0).getDate()));
      dCounts.push(al.filter(function (a) { return a.time >= s0 && a.time < s1; }).length);
    }

    // 里程 TOP
    var mileageTop = ms.slice().sort(function (a, b) { return (b.totalMileage || 0) - (a.totalMileage || 0); }).slice(0, 8)
      .map(function (x) { return { label: x.name || x.imei, value: Math.round(x.totalMileage || 0), suffix: ' km' }; });

    var storage = S.storage || { usagePercentage: 0, usedSpace: 0, totalSpace: 0 };

    // 最近告警
    var recent = al.slice().sort(function (a, b) { return (b.time || 0) - (a.time || 0); }).slice(0, 7);

    // 在线率走势（按设备最后上报时间聚合，模拟）
    var onlineSpark = [];
    for (var k = 11; k >= 0; k--) {
      onlineSpark.push(Math.max(1, online - Math.round(Math.random() * Math.min(3, online))));
    }

    root.innerHTML =
      '<div class="grid g-5">' +
        kpi({ label: '接入设备总数', value: U.num(d.length), unit: '台', icon: 'i-device', color: CH.colors.orange,
          foot: '<span class="tag orange" style="padding:1px 7px">TurboHive ' + thCount + '</span><span class="tag blue" style="padding:1px 7px">TSP ' + tspCount + '</span>' }) +
        kpi({ label: '在线设备', value: U.num(online), unit: '台', icon: 'i-bolt', color: CH.colors.ok,
          foot: '<span class="delta up">在线率 ' + (d.length ? (online / d.length * 100).toFixed(1) : 0) + '%</span> 离线 ' + offline + ' · 未激活 ' + inactive,
          spark: onlineSpark }) +
        kpi({ label: '24H 告警', value: U.num(alert24), unit: '条', icon: 'i-alert', color: CH.colors.err,
          foot: '近 7 天累计 <b style="color:var(--tx-2)">' + U.num(alert7d) + '</b> 条' }) +
        kpi({ label: '累计里程', value: CH.nf(totalMileage), unit: 'km', icon: 'i-trip', color: CH.colors.blue,
          foot: '今日新增 <b style="color:var(--tx-2)">' + (todayMileage || 0).toFixed(1) + '</b> km' }) +
        kpi({ label: '行驶中车辆', value: U.num(moving), unit: '台', icon: 'i-map', color: CH.colors.purple,
          foot: '静止 ' + U.num(d.length - moving) + ' 台' }) +
      '</div>' +

      '<div class="grid g-32 mt">' +
        card('告警趋势', '<div class="tabs" style="margin-bottom:6px" id="ovTrendTabs">' +
            '<button class="on" data-t="24h">近 24 小时</button><button data-t="7d">近 7 天</button></div>' +
            '<div id="ovTrend">' + CH.line(hours, [{ name: '告警数', data: hCounts, color: CH.colors.err }], { h: 232 }) + '</div>',
          '<button class="btn sm ghost" id="ovExportAlerts">' + U.icon('i-download') + '导出</button>') +
        card('设备类型分布', '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center">' +
            CH.donut(typeItems, { size: 176, centerValue: d.length, centerLabel: '设备' }) +
            '<div style="flex:1;min-width:150px">' + legend(typeItems.map(function (i) {
              return { label: i.label, color: i.color, value: i.value };
            })) + '</div></div>') +
      '</div>' +

      '<div class="grid g-3 mt">' +
        card('告警类型 TOP', alertItems.length ? CH.hBar(alertItems, { labelW: 110 }) : empty('暂无告警', '当前时间范围内没有告警记录', 'i-alert')) +
        card('设备协议分布', protoItems.length ? CH.hBar(protoItems, { labelW: 96 }) : empty('暂无数据', '', 'i-gateway')) +
        card('存储用量', (function () {
          var usedPct = U.clamp(storage.usagePercentage || 0, 0, 100);
          var items = [
            { label: '已用', value: usedPct, color: usedPct > 85 ? CH.colors.err : usedPct > 65 ? CH.colors.warn : CH.colors.teal },
            { label: '剩余', value: 100 - usedPct, color: '#1E2E48' }
          ];
          return '<div style="display:flex;flex-direction:column;align-items:center;gap:10px">' +
            CH.donut(items, { size: 168, inner: 60, centerValue: usedPct.toFixed(1) + '%', centerLabel: '对象存储占用' }) +
            '<div class="kv" style="width:100%;grid-template-columns:1fr 1fr">' +
            '<div class="it"><b>' + U.bytes(storage.usedSpace) + '</b><small>已用容量</small></div>' +
            '<div class="it"><b>' + U.bytes(storage.totalSpace) + '</b><small>配额上限</small></div></div>' +
            legend([{ label: '已用', color: items[0].color }, { label: '剩余', color: '#1E2E48' }]) + '</div>';
        })()) +
      '</div>' +

      '<div class="grid g-23 mt">' +
        card('里程排行', mileageTop.length ? CH.hBar(mileageTop, { labelW: 122 }) : empty('暂无里程数据', '', 'i-trip')) +
        card('最新告警', recent.length ? '<div class="mlist">' + recent.map(function (a) {
            return '<div class="mrow" data-alert="' + U.esc(a.uid) + '">' +
              '<div class="sev" style="background:' + (a.level === 'high' ? CH.colors.err : a.level === 'mid' ? CH.colors.warn : CH.colors.blue) + '"></div>' +
              '<div class="ic" style="background:' + (a.level === 'high' ? CH.colors.err : a.level === 'mid' ? CH.colors.warn : CH.colors.blue) + '22">' +
              '<svg class="ico" style="fill:' + (a.level === 'high' ? CH.colors.err : a.level === 'mid' ? CH.colors.warn : CH.colors.blue) + '"><use href="#i-alert"/></svg></div>' +
              '<div class="tx"><b>' + U.esc(a.name || '告警') + '</b><small>' + U.esc(a.imei) + ' · ' + U.esc(a.desc || '') + '</small></div>' +
              '<div class="rt">' + U.ago(a.time) + '<br>' + srcTag(a.src) + '</div></div>';
          }).join('') + '</div>' : empty('暂无告警', '', 'i-alert')) +
      '</div>';

    // 交互：趋势切换
    U.$$('#ovTrendTabs button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        U.$$('#ovTrendTabs button', root).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var t = b.getAttribute('data-t');
        U.$('#ovTrend', root).innerHTML = t === '24h'
          ? CH.line(hours, [{ name: '告警数', data: hCounts, color: CH.colors.err }], { h: 232 })
          : CH.bar(days, [{ name: '告警数', data: dCounts, color: CH.colors.orange }], { h: 232 });
      });
    });
    var exp = U.$('#ovExportAlerts', root);
    if (exp) exp.addEventListener('click', function () {
      U.download('alerts-' + Date.now() + '.csv', U.toCSV(al.map(function (a) {
        return { 时间: U.dt(a.time), 平台: a.src, IMEI: a.imei, 名称: a.name, 描述: a.desc, 纬度: a.lat, 经度: a.lng };
      })), 'text/csv');
      U.toast('告警 CSV 已导出', 'ok');
    });
    U.$$('[data-alert]', root).forEach(function (n) {
      n.addEventListener('click', function () { w.APP.openAlert(n.getAttribute('data-alert')); });
    });
  }

  /* ============================================================
     2) 设备管理
     ============================================================ */
  var devState = { page: 1, size: 15, keyword: '', src: 'all', type: '', online: '' };

  function renderDevices(root) {
    var S = w.STORE;
    var types = U.uniq(S.devices.map(function (d) { return d.deviceType; }).filter(Boolean)).sort();

    root.innerHTML =
      '<div class="grid g-4">' +
        kpi({ label: '设备总数', value: U.num(S.devices.length), unit: '台', icon: 'i-device', color: CH.colors.orange }) +
        kpi({ label: '在线', value: U.num(S.devices.filter(function (d) { return d.online === 1; }).length), unit: '台', icon: 'i-bolt', color: CH.colors.ok }) +
        kpi({ label: '离线', value: U.num(S.devices.filter(function (d) { return d.online === 2; }).length), unit: '台', icon: 'i-device', color: CH.colors.err }) +
        kpi({ label: '未激活', value: U.num(S.devices.filter(function (d) { return d.online === 0; }).length), unit: '台', icon: 'i-warn', color: CH.colors.warn }) +
      '</div>' +
      '<div class="card mt">' +
        '<div class="toolbar">' +
          '<div class="search">' + U.icon('i-search') + '<input id="dvSearch" placeholder="搜索 IMEI / 设备名称…" value="' + U.esc(devState.keyword) + '"></div>' +
          '<select class="sel" id="dvSrc"><option value="all">全部平台</option><option value="turbohive">TurboHive</option><option value="tsp">TrackSolidPro</option></select>' +
          '<select class="sel" id="dvType"><option value="">全部类型</option>' + types.map(function (t) { return '<option>' + U.esc(t) + '</option>'; }).join('') + '</select>' +
          '<select class="sel" id="dvOnline"><option value="">全部状态</option><option value="1">在线</option><option value="2">离线</option><option value="0">未激活</option></select>' +
          '<button class="btn sm ghost" id="dvExport" style="margin-left:auto">' + U.icon('i-download') + '导出 CSV</button>' +
        '</div>' +
        '<div id="dvTable">' + loading() + '</div>' +
      '</div>';

    U.$('#dvSrc').value = devState.src;
    U.$('#dvType').value = devState.type;
    U.$('#dvOnline').value = devState.online;

    function paint() {
      var list = S.devices.filter(function (d) {
        if (devState.src !== 'all' && d.src !== devState.src) return false;
        if (devState.type && d.deviceType !== devState.type) return false;
        if (devState.online !== '' && String(d.online) !== devState.online) return false;
        if (devState.keyword) {
          var k = devState.keyword.toLowerCase();
          if (String(d.imei).toLowerCase().indexOf(k) < 0 && String(d.name).toLowerCase().indexOf(k) < 0 &&
              String(d.model).toLowerCase().indexOf(k) < 0) return false;
        }
        return true;
      });
      var total = list.length;
      var pages = Math.max(1, Math.ceil(total / devState.size));
      if (devState.page > pages) devState.page = pages;
      var rows = list.slice((devState.page - 1) * devState.size, devState.page * devState.size);

      var html = rows.length ? '<div class="tw"><table><thead><tr>' +
        '<th>设备</th><th>IMEI</th><th>平台</th><th>型号</th><th>类型</th><th>协议</th><th>状态</th>' +
        '<th>速度</th><th>ACC</th><th>最后上报</th><th>位置</th><th></th></tr></thead><tbody>' +
        rows.map(function (d) {
          return '<tr>' +
            '<td class="strong"><div style="display:flex;align-items:center;gap:8px">' +
              '<div class="avatar" style="background:' + U.hashColor(d.name || d.imei) + '">' + U.esc(String(d.name || d.imei).slice(0, 2).toUpperCase()) + '</div>' +
              '<span>' + U.esc(d.name || '—') + '</span></div></td>' +
            '<td class="mono">' + U.esc(d.imei) + '</td>' +
            '<td>' + srcTag(d.src) + '</td>' +
            '<td>' + U.esc(d.model || '—') + '</td>' +
            '<td><span class="tag purple"><i></i>' + U.esc(d.deviceType || '未知') + '</span></td>' +
            '<td class="mono">' + U.esc(d.protocol || '—') + '</td>' +
            '<td>' + onlineTag(d.online) + '</td>' +
            '<td class="num">' + (d.speed !== null && d.speed !== undefined ? d.speed + ' km/h' : '—') + '</td>' +
            '<td>' + (d.acc === 1 ? '<span class="tag on"><i></i>ON</span>' : d.acc === 0 ? '<span class="tag none"><i></i>OFF</span>' : '—') + '</td>' +
            '<td>' + U.ago(d.lastTime) + '</td>' +
            '<td>' + (d.lat ? '<span class="link" data-loc="' + U.esc(d.uid) + '">' + d.lat.toFixed(4) + ', ' + d.lng.toFixed(4) + '</span>' : '—') + '</td>' +
            '<td><button class="btn sm ghost" data-dev="' + U.esc(d.uid) + '">详情</button></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>' +
        pager({ total: total, size: devState.size, page: devState.page }, null)
        : empty('没有匹配的设备', '请调整筛选条件后重试', 'i-device');

      U.$('#dvTable').innerHTML = html;
      bindPager(U.$('#dvTable'), { total: total, size: devState.size, page: devState.page }, paint);
      U.$$('[data-dev]', root).forEach(function (b) {
        b.addEventListener('click', function () { w.APP.openDevice(b.getAttribute('data-dev')); });
      });
      U.$$('[data-loc]', root).forEach(function (b) {
        b.addEventListener('click', function () { w.APP.focusMap(b.getAttribute('data-loc')); });
      });
    }

    U.$('#dvSearch').addEventListener('input', U.debounce(function (e) {
      devState.keyword = e.target.value.trim(); devState.page = 1; paint();
    }, 220));
    ['dvSrc', 'dvType', 'dvOnline'].forEach(function (id) {
      U.$('#' + id).addEventListener('change', function (e) {
        var key = id === 'dvSrc' ? 'src' : id === 'dvType' ? 'type' : 'online';
        devState[key] = e.target.value; devState.page = 1; paint();
      });
    });
    U.$('#dvExport').addEventListener('click', function () {
      U.download('devices-' + Date.now() + '.csv', U.toCSV(S.devices.map(function (d) {
        return { 平台: d.src, IMEI: d.imei, 名称: d.name, 型号: d.model, 类型: d.deviceType,
          协议: d.protocol, 在线状态: d.online === 1 ? '在线' : d.online === 2 ? '离线' : '未激活',
          速度: d.speed, 纬度: d.lat, 经度: d.lng, 最后上报: U.dt(d.lastTime) };
      })), 'text/csv');
      U.toast('设备清单已导出', 'ok');
    });
    paint();
  }

  /* ============================================================
     3) 实时地图
     ============================================================ */
  var MAP = { map: null, layer: null, tile: null, markers: {}, devs: [], filter: 'all', follow: null, maxMk: 350, showAll: false };

  function renderMap(root) {
    var S = w.STORE;
    // 优先展示在线 / 行驶中 / 近期上报的设备
    var withLoc = S.devices.filter(function (d) { return d.lat && d.lng; }).sort(function (a, b) {
      var ra = (a.online === 1 ? 2 : 0) + ((Number(a.speed) || 0) > 3 ? 1 : 0);
      var rb = (b.online === 1 ? 2 : 0) + ((Number(b.speed) || 0) > 3 ? 1 : 0);
      if (ra !== rb) return rb - ra;
      return (b.lastTime || 0) - (a.lastTime || 0);
    });

    root.innerHTML =
      '<div class="grid g-5">' +
        kpi({ label: '有定位设备', value: U.num(withLoc.length), unit: '台', icon: 'i-map', color: CH.colors.blue }) +
        kpi({ label: '行驶中', value: U.num(withLoc.filter(function (d) { return (Number(d.speed) || 0) > 3; }).length), unit: '台', icon: 'i-bolt', color: CH.colors.ok }) +
        kpi({ label: 'ACC 开启', value: U.num(withLoc.filter(function (d) { return d.acc === 1; }).length), unit: '台', icon: 'i-device', color: CH.colors.orange }) +
        kpi({ label: '定位时间 &lt;10 分钟', value: U.num(withLoc.filter(function (d) { return d.lastTime && Date.now() - d.lastTime < 600000; }).length), unit: '台', icon: 'i-warn', color: CH.colors.teal }) +
        kpi({ label: '在线设备', value: U.num(withLoc.filter(function (d) { return d.online === 1; }).length), unit: '台', icon: 'i-check', color: CH.colors.purple }) +
      '</div>' +
      '<div class="card mt" style="padding:0;overflow:hidden">' +
        '<div class="map-wrap" style="height:calc(100vh - 300px);min-height:460px;border:0;border-radius:0">' +
          '<div id="leafletMap"></div>' +
          '<div class="map-side"><div class="map-side-h">' + U.icon('i-device') + '设备列表<span class="n" id="mapCount"></span></div>' +
            '<div class="map-side-list" id="mapList"></div></div>' +
          '<div class="map-ctrl">' +
            '<button class="icon-btn" id="mapFit" title="全览">' + U.icon('i-map') + '</button>' +
            '<button class="icon-btn" id="mapLive" title="定位到在线设备">' + U.icon('i-bolt') + '</button>' +
            '<button class="icon-btn" id="mapTile" title="切换底图">' + U.icon('i-refresh') + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    if (!w.L) { U.$('#leafletMap').innerHTML = empty('地图组件未加载', '请检查网络后刷新页面（Leaflet CDN 不可达）', 'i-map'); return; }

    if (MAP.map) { MAP.map.remove(); MAP.map = null; }
    var center = w.CFG.app.defaultCenter;
    if (withLoc.length) center = [withLoc[0].lat, withLoc[0].lng];
    MAP.map = w.L.map('leafletMap', { zoomControl: true, attributionControl: true, preferCanvas: true })
      .setView(center, w.CFG.app.defaultZoom);

    function addTile() {
      if (MAP.tile) MAP.map.removeLayer(MAP.tile);
      var t = w.CONFIG.TILES[w.CFG.app.mapTile] || w.CONFIG.TILES.carto;
      MAP.tile = w.L.tileLayer(t.url, { attribution: t.attr, subdomains: t.sub || 'abc', maxZoom: t.max }).addTo(MAP.map);
    }
    addTile();
    MAP.map.on('zoomend moveend', function () { setTimeout(function () { MAP.map.invalidateSize(); }, 60); });

    MAP.layer = w.L.layerGroup().addTo(MAP.map);
    MAP.devs = withLoc;
    drawMarkers();
    paintSideList();

    U.$('#mapFit').addEventListener('click', fitAll);
    U.$('#mapTile').addEventListener('click', function () {
      var keys = Object.keys(w.CONFIG.TILES);
      var i = keys.indexOf(w.CFG.app.mapTile);
      w.CFG.app.mapTile = keys[(i + 1) % keys.length];
      w.CONFIG.save(); addTile();
      U.toast('底图切换为 ' + w.CONFIG.TILES[w.CFG.app.mapTile].name, 'info');
    });
    U.$('#mapLive').addEventListener('click', function () {
      var on = MAP.devs.filter(function (d) { return d.online === 1; });
      if (!on.length) return U.toast('当前没有在线设备', 'warn');
      var b = w.L.latLngBounds(on.map(function (d) { return [d.lat, d.lng]; }));
      MAP.map.fitBounds(b.pad(0.25), { maxZoom: 13 });
    });

    function fitAll() {
      if (!MAP.devs.length) return;
      var b = w.L.latLngBounds(MAP.devs.map(function (d) { return [d.lat, d.lng]; }));
      MAP.map.fitBounds(b.pad(0.2), { maxZoom: 14 });
    }
    setTimeout(fitAll, 260);

    function drawMarkers() {
      MAP.layer.clearLayers();
      MAP.markers = {};
      var shown = MAP.devs.filter(function (d) { return MAP.filter === 'all' || d.src === MAP.filter; });
      var limit = MAP.showAll ? shown.length : Math.min(shown.length, MAP.maxMk);
      shown.slice(0, limit).forEach(function (d) {
        var col = d.online === 1 ? (d.src === 'turbohive' ? CH.colors.orange : CH.colors.blue) : '#5A6B85';
        var moving = (Number(d.speed) || 0) > 3;
        var html = '<div class="mk" style="color:' + col + '">' + (moving ? '<span class="h"></span>' : '') +
          '<span class="p" style="background:' + col + '"></span></div>';
        var mk = w.L.marker([d.lat, d.lng], {
          icon: w.L.divIcon({ html: html, className: '', iconSize: [16, 16], iconAnchor: [8, 8] })
        });
        mk.bindPopup(
          '<div style="min-width:200px"><b>' + U.esc(d.name || d.imei) + '</b><br>' +
          '<span style="color:#6C7F9C">' + U.esc(d.imei) + '</span><br>' +
          '状态：' + (d.online === 1 ? '<span style="color:#28C76F">在线</span>' : '<span style="color:#F0453A">离线</span>') +
          ' · 速度：' + (d.speed || 0) + ' km/h<br>' +
          'ACC：' + (d.acc === 1 ? 'ON' : 'OFF') + ' · 卫星：' + (d.sats || '—') + '<br>' +
          '定位时间：' + U.dt(d.lastTime) + '<br>' +
          '<span style="color:#6C7F9C">平台：' + (d.src === 'turbohive' ? 'TurboHive' : 'TrackSolidPro') + '</span></div>'
        );
        mk.on('click', function () {
          U.$$('.map-dev').forEach(function (n) { n.classList.remove('on'); });
          var n = U.$('.map-dev[data-uid="' + d.uid + '"]'); if (n) { n.classList.add('on'); n.scrollIntoView({ block: 'nearest' }); }
        });
        mk.addTo(MAP.layer);
        MAP.markers[d.uid] = mk;
      });
      var hint = shown.length > limit
        ? '<span style="color:#FFB020;font-size:10px">（已省略 ' + (shown.length - limit) + ' 个标记，'
          + '<a href="javascript:void 0" id="mkAll" style="color:#2AC2F3;text-decoration:underline">显示全部</a>）</span>'
        : '';
      U.$('#mapCount').innerHTML = shown.length + ' 台 ' + hint;
      var btn = U.$('#mkAll');
      if (btn) btn.addEventListener('click', function () {
        MAP.showAll = true;
        U.toast('正在渲染全部 ' + shown.length + ' 个标记，可能略慢…', 'warn');
        drawMarkers();
      });
    }

    function paintSideList() {
      var shown = MAP.devs.filter(function (d) { return MAP.filter === 'all' || d.src === MAP.filter; });
      var cap = Math.min(shown.length, 300);
      U.$('#mapCount').textContent = shown.length + ' 台';
      U.$('#mapList').innerHTML = shown.length ? shown.slice(0, cap).map(function (d) {
        var col = d.online === 1 ? (d.src === 'turbohive' ? CH.colors.orange : CH.colors.blue) : '#5A6B85';
        return '<div class="map-dev" data-uid="' + U.esc(d.uid) + '">' +
          '<i class="dot" style="background:' + col + '"></i>' +
          '<span class="nm">' + U.esc(d.name || d.imei) + '</span>' +
          '<span class="sp">' + (d.speed || 0) + ' km/h</span></div>';
      }).join('') + (shown.length > cap ? '<div style="padding:9px;font-size:10.5px;color:var(--tx-3);text-align:center">仅显示前 ' + cap + ' 台</div>' : '')
        : empty('暂无定位设备', '', 'i-map');
      U.$$('.map-dev').forEach(function (n) {
        n.addEventListener('click', function () { w.APP.focusMap(n.getAttribute('data-uid')); });
      });
    }

    MAP.refreshSide = function () { drawMarkers(); paintSideList(); };
    paintSideList();
  }

  /* ============================================================
     4) 告警中心
     ============================================================ */
  var alState = { page: 1, size: 15, keyword: '', src: 'all', level: '' };

  function renderAlerts(root) {
    var S = w.STORE, al = S.alerts;
    var byName = U.groupBy(al, function (a) { return a.name || '未知'; });
    var top = Object.keys(byName).map(function (k, i) {
      return { label: k, value: byName[k].length, color: CH.series[i % CH.series.length] };
    }).sort(function (a, b) { return b.value - a.value; }).slice(0, 10);

    // 小时热力（7 天 × 24 小时）
    var rowLabels = [], matrix = [];
    var nowD = new Date();
    for (var j = 6; j >= 0; j--) {
      var day0 = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() - j);
      rowLabels.push(U.pad(day0.getMonth() + 1) + '-' + U.pad(day0.getDate()));
      var row = [];
      for (var h = 0; h < 24; h++) {
        var t0 = day0.getTime() + h * 3600000, t1 = t0 + 3600000;
        row.push(al.filter(function (a) { return a.time >= t0 && a.time < t1; }).length);
      }
      matrix.push(row);
    }

    var hi = al.filter(function (a) { return a.level === 'high'; }).length;
    var mid = al.filter(function (a) { return a.level === 'mid'; }).length;

    root.innerHTML =
      '<div class="grid g-5">' +
        kpi({ label: '告警总数', value: U.num(S.alertTotal || al.length), unit: '条', icon: 'i-alert', color: CH.colors.orange }) +
        kpi({ label: '高危告警', value: U.num(hi), unit: '条', icon: 'i-warn', color: CH.colors.err, foot: '碰撞 / 拆除 / 越界等' }) +
        kpi({ label: '中危告警', value: U.num(mid), unit: '条', icon: 'i-bolt', color: CH.colors.warn }) +
        kpi({ label: '涉及设备', value: U.num(U.uniq(al.map(function (a) { return a.imei; })).length), unit: '台', icon: 'i-device', color: CH.colors.blue }) +
        kpi({ label: '告警类型', value: U.num(U.uniq(al.map(function (a) { return a.name; })).length), unit: '种', icon: 'i-code', color: CH.colors.purple }) +
      '</div>' +
      '<div class="grid g-2 mt">' +
        card('告警类型分布 TOP10', top.length ? CH.hBar(top, { labelW: 116 }) : empty('暂无告警', '', 'i-alert')) +
        card('7 天 × 24 小时 告警热力', al.length ? CH.heatmap(matrix, { rowLabels: rowLabels }) : empty('暂无数据', '', 'i-alert'), null, '颜色越深告警越密集') +
      '</div>' +
      '<div class="card mt">' +
        '<div class="toolbar">' +
          '<div class="search">' + U.icon('i-search') + '<input id="alSearch" placeholder="搜索 IMEI / 告警名称…"></div>' +
          '<select class="sel" id="alSrc"><option value="all">全部平台</option><option value="turbohive">TurboHive</option><option value="tsp">TrackSolidPro</option></select>' +
          '<select class="sel" id="alLevel"><option value="">全部等级</option><option value="high">高危</option><option value="mid">中危</option><option value="low">提示</option></select>' +
          '<button class="btn sm ghost" id="alExport" style="margin-left:auto">' + U.icon('i-download') + '导出 CSV</button>' +
        '</div>' +
        '<div id="alTable">' + loading() + '</div>' +
      '</div>';

    function paint() {
      var list = al.filter(function (a) {
        if (alState.src !== 'all' && a.src !== alState.src) return false;
        if (alState.level && a.level !== alState.level) return false;
        if (alState.keyword) {
          var k = alState.keyword.toLowerCase();
          if (String(a.imei).toLowerCase().indexOf(k) < 0 && String(a.name || '').toLowerCase().indexOf(k) < 0) return false;
        }
        return true;
      }).sort(function (a, b) { return (b.time || 0) - (a.time || 0); });

      var total = list.length, pages = Math.max(1, Math.ceil(total / alState.size));
      if (alState.page > pages) alState.page = pages;
      var rows = list.slice((alState.page - 1) * alState.size, alState.page * alState.size);

      U.$('#alTable').innerHTML = rows.length ? '<div class="tw"><table><thead><tr>' +
        '<th>等级</th><th>时间</th><th>告警名称</th><th>IMEI</th><th>平台</th><th>描述</th><th>位置</th><th></th></tr></thead><tbody>' +
        rows.map(function (a) {
          var lc = a.level === 'high' ? CH.colors.err : a.level === 'mid' ? CH.colors.warn : CH.colors.blue;
          return '<tr>' +
            '<td><span class="tag" style="color:' + lc + ';background:' + lc + '22;border-color:' + lc + '55"><i></i>' +
              (a.level === 'high' ? '高危' : a.level === 'mid' ? '中危' : '提示') + '</span></td>' +
            '<td>' + U.dt(a.time) + '</td>' +
            '<td class="strong">' + U.esc(a.name || '—') + '</td>' +
            '<td class="mono">' + U.esc(a.imei) + '</td>' +
            '<td>' + srcTag(a.src) + '</td>' +
            '<td>' + U.esc(a.desc || '—') + '</td>' +
            '<td>' + (a.lat ? '<span class="link" data-aloc="' + U.esc(a.uid) + '">' + a.lat.toFixed(4) + ', ' + a.lng.toFixed(4) + '</span>' : '—') + '</td>' +
            '<td><button class="btn sm ghost" data-ald="' + U.esc(a.uid) + '">详情</button></td></tr>';
        }).join('') + '</tbody></table></div>' + pager({ total: total, size: alState.size, page: alState.page }, null)
        : empty('没有匹配的告警', '请调整筛选条件', 'i-alert');

      bindPager(U.$('#alTable'), { total: total, size: alState.size, page: alState.page }, paint);
      U.$$('[data-ald]', root).forEach(function (b) {
        b.addEventListener('click', function () { w.APP.openAlert(b.getAttribute('data-ald')); });
      });
      U.$$('[data-aloc]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var uid = b.getAttribute('data-aloc');
          var a = S.alerts.filter(function (x) { return x.uid === uid; })[0];
          if (a) w.APP.goto('map', { lat: a.lat, lng: a.lng, label: a.name + ' @ ' + a.imei });
        });
      });
    }

    U.$('#alSearch').addEventListener('input', U.debounce(function (e) { alState.keyword = e.target.value.trim(); alState.page = 1; paint(); }, 220));
    ['alSrc', 'alLevel'].forEach(function (id) {
      U.$('#' + id).addEventListener('change', function (e) {
        alState[id === 'alSrc' ? 'src' : 'level'] = e.target.value; alState.page = 1; paint();
      });
    });
    U.$('#alExport').addEventListener('click', function () {
      U.download('alerts-' + Date.now() + '.csv', U.toCSV(al.map(function (a) {
        return { 时间: U.dt(a.time), 平台: a.src, 等级: a.level, 名称: a.name, IMEI: a.imei, 描述: a.desc, 纬度: a.lat, 经度: a.lng };
      })), 'text/csv');
      U.toast('告警数据已导出', 'ok');
    });
    paint();
  }

  w.PAGES = w.PAGES || {};
  w.PAGES.overview = { title: '总览看板', desc: '双平台车队数据统一视图', render: renderOverview };
  w.PAGES.devices = { title: '设备管理', desc: 'TurboHive 与 TrackSolidPro 设备统一清单', render: renderDevices };
  w.PAGES.map = { title: '实时地图', desc: '设备实时位置与状态分布', render: renderMap };
  w.PAGES.alerts = { title: '告警中心', desc: '跨平台告警聚合与分布分析', render: renderAlerts };
  w.PAGES._MAP = MAP;
  w.PAGES._ui = { kpi: kpi, card: card, loading: loading, empty: empty, onlineTag: onlineTag, srcTag: srcTag,
    pager: pager, bindPager: bindPager, legend: legend };
})(window);
