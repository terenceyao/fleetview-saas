/* ============================================================
   pages2.js — 行程里程 / 围栏 / 平台资源 / 媒体 / API 控制台 / 设置
   ============================================================ */
(function (w) {
  'use strict';
  var U = w.U, CH = w.CHART, API = w.API;
  var UI = null; // 由 pages.js 注入

  function ready() { if (!UI) UI = w.PAGES._ui; return UI; }

  /* ============================================================
     5) 行程与里程
     ============================================================ */
  var tripState = { page: 1, size: 12, days: 7, imei: '' };

  function renderTrips(root) {
    var U2 = ready(), S = w.STORE;
    var ms = S.mileage;
    var totalM = ms.reduce(function (a, x) { return a + (Number(x.totalMileage) || 0); }, 0);
    var todayM = ms.reduce(function (a, x) { return a + (Number(x.todayMileage) || 0); }, 0);
    var subM = ms.reduce(function (a, x) { return a + (Number(x.subtotal) || 0); }, 0);
    var avg = ms.filter(function (x) { return x.totalMileage; }).length
      ? totalM / ms.filter(function (x) { return x.totalMileage; }).length : 0;

    // 30 天里程趋势（TurboHive daily）
    var daily = S.dailyMileage || [];
    var labels = [], vals = [];
    if (daily.length) {
      for (var i = 1; i <= 30; i++) {
        labels.push(i + '日');
        vals.push(daily.reduce(function (a, dev) {
          var d = (dev.dailyMileage || []).filter(function (x) { return x.day === i; })[0];
          return a + (d && d.mileage ? d.mileage : 0);
        }, 0));
      }
    }

    var trips = S.trips || [];
    var tripDist = trips.reduce(function (a, t) { return a + (Number(t.distance) || 0); }, 0);
    var tripDur = trips.reduce(function (a, t) { return a + (Number(t.duration) || 0); }, 0);

    root.innerHTML =
      '<div class="grid g-5">' +
        U2.kpi({ label: '累计里程', value: CH.nf(totalM), unit: 'km', icon: 'i-trip', color: CH.colors.orange }) +
        U2.kpi({ label: '今日里程', value: (todayM || 0).toFixed(1), unit: 'km', icon: 'i-bolt', color: CH.colors.ok }) +
        U2.kpi({ label: '本周期里程', value: (subM || 0).toFixed(1), unit: 'km', icon: 'i-map', color: CH.colors.blue }) +
        U2.kpi({ label: '单车均里程', value: CH.nf(avg), unit: 'km', icon: 'i-device', color: CH.colors.purple }) +
        U2.kpi({ label: '行程记录', value: U.num(S.tripTotal || trips.length), unit: '段', icon: 'i-code', color: CH.colors.teal,
          foot: '累计 ' + U.dist(tripDist) + ' · ' + U.dur(tripDur) }) +
      '</div>' +
      '<div class="grid g-32 mt">' +
        U2.card('30 天里程趋势', labels.length
          ? CH.line(labels, [{ name: '里程(km)', data: vals, color: CH.colors.orange }], { h: 240, dots: false })
          : U2.empty('暂无里程趋势', '需要设备参与里程统计', 'i-trip'), null, '单位 km') +
        U2.card('里程 TOP 排行', ms.length ? CH.hBar(ms.slice().sort(function (a, b) {
          return (b.totalMileage || 0) - (a.totalMileage || 0);
        }).slice(0, 9).map(function (x) {
          return { label: x.name || x.imei, value: Math.round(x.totalMileage || 0), suffix: ' km' };
        }), { labelW: 118 }) : U2.empty('暂无里程数据', '', 'i-trip')) +
      '</div>' +
      '<div class="card mt">' +
        '<div class="card-h"><h3>行程记录</h3><span class="sub">来自 TurboHive /v3/trip/page</span>' +
          '<div class="right">' +
            '<select class="sel" id="tpDays"><option value="1">今天</option><option value="7" selected>近 7 天</option><option value="30">近 30 天</option></select>' +
            '<button class="btn sm ghost" id="tpExport">' + U.icon('i-download') + '导出</button>' +
          '</div></div>' +
        '<div id="tpTable">' + U2.loading() + '</div>' +
      '</div>';

    function paint() {
      var list = (S.trips || []).slice().sort(function (a, b) { return (b.startTime || 0) - (a.startTime || 0); });
      var total = list.length, pages = Math.max(1, Math.ceil(total / tripState.size));
      if (tripState.page > pages) tripState.page = pages;
      var rows = list.slice((tripState.page - 1) * tripState.size, tripState.page * tripState.size);
      U.$('#tpTable').innerHTML = rows.length ? '<div class="tw"><table><thead><tr>' +
        '<th>设备</th><th>IMEI</th><th>开始时间</th><th>结束时间</th><th>时长</th><th>距离</th><th>均速</th><th>起点</th><th>终点</th><th></th></tr></thead><tbody>' +
        rows.map(function (t) {
          return '<tr>' +
            '<td class="strong">' + U.esc(t.name || '—') + '</td>' +
            '<td class="mono">' + U.esc(t.imei) + '</td>' +
            '<td>' + U.dt(t.startTime) + '</td>' +
            '<td>' + U.dt(t.endTime) + '</td>' +
            '<td>' + U.dur(t.duration) + '</td>' +
            '<td class="num">' + U.dist(t.distance) + '</td>' +
            '<td class="num">' + (t.avgSpeed !== null && t.avgSpeed !== undefined ? t.avgSpeed.toFixed(1) + ' km/h' : '—') + '</td>' +
            '<td>' + (t.startLat ? '<span class="link" data-tloc="' + t.startLat + ',' + t.startLng + '">' + t.startLat.toFixed(4) + ', ' + t.startLng.toFixed(4) + '</span>' : '—') + '</td>' +
            '<td>' + (t.endLat ? '<span class="link" data-tloc="' + t.endLat + ',' + t.endLng + '">' + t.endLat.toFixed(4) + ',' + t.endLng.toFixed(4) + '</span>' : '—') + '</td>' +
            '<td><button class="btn sm ghost" data-trip="' + U.esc(t.uid) + '">轨迹</button></td></tr>';
        }).join('') + '</tbody></table></div>' + U2.pager({ total: total, size: tripState.size, page: tripState.page })
        : U2.empty('暂无行程记录', '所选时间范围内没有行程数据', 'i-trip');

      U2.bindPager(U.$('#tpTable'), { total: total, size: tripState.size, page: tripState.page }, paint);
      U.$$('[data-tloc]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var p = b.getAttribute('data-tloc').split(',');
          w.APP.goto('map', { lat: +p[0], lng: +p[1], label: '行程点位' });
        });
      });
      U.$$('[data-trip]', root).forEach(function (b) {
        b.addEventListener('click', function () { w.APP.openTrip(b.getAttribute('data-trip')); });
      });
    }

    U.$('#tpDays').addEventListener('change', function (e) {
      tripState.days = +e.target.value;
      w.APP.reloadTrips(tripState.days).then(paint);
    });
    U.$('#tpExport').addEventListener('click', function () {
      U.download('trips-' + Date.now() + '.csv', U.toCSV((S.trips || []).map(function (t) {
        return { 设备: t.name, IMEI: t.imei, 开始: U.dt(t.startTime), 结束: U.dt(t.endTime),
          时长ms: t.duration, 距离m: t.distance, 均速: t.avgSpeed, 起点: t.startLat + ',' + t.startLng, 终点: t.endLat + ',' + t.endLng };
      })), 'text/csv');
      U.toast('行程数据已导出', 'ok');
    });
    paint();
  }

  /* ============================================================
     6) 围栏管理
     ============================================================ */
  var fenceMap = null;

  function renderGeofence(root) {
    var U2 = ready(), S = w.STORE;
    var f = S.geofences || [];
    var circle = f.filter(function (x) { return x.fenceType === 'CIRCLE'; }).length;
    var poly = f.filter(function (x) { return x.fenceType !== 'CIRCLE'; }).length;
    var enabled = f.filter(function (x) { return x.enabled === 1; }).length;

    root.innerHTML =
      '<div class="grid g-4">' +
        U2.kpi({ label: '围栏总数', value: U.num(f.length), unit: '个', icon: 'i-fence', color: CH.colors.orange }) +
        U2.kpi({ label: '已启用', value: U.num(enabled), unit: '个', icon: 'i-check', color: CH.colors.ok }) +
        U2.kpi({ label: '圆形围栏', value: U.num(circle), unit: '个', icon: 'i-map', color: CH.colors.blue }) +
        U2.kpi({ label: '多边形围栏', value: U.num(poly), unit: '个', icon: 'i-fence', color: CH.colors.purple }) +
      '</div>' +
      '<div class="grid g-23 mt">' +
        U2.card('围栏列表', f.length ? '<div class="mlist">' + f.slice(0, 14).map(function (x) {
          return '<div class="mrow" data-fence="' + U.esc(x.uid) + '">' +
            '<div class="ic" style="background:' + (x.color || CH.colors.orange) + '22;border:1px solid ' + (x.color || CH.colors.orange) + '55">' +
            '<svg class="ico" style="fill:' + (x.color || CH.colors.orange) + '"><use href="#i-fence"/></svg></div>' +
            '<div class="tx"><b>' + U.esc(x.name) + '</b><small>' + U.esc(x.fenceType) +
            (x.radius ? ' · R=' + x.radius + 'm' : '') + ' · ' + (x.devices ? x.devices.length : 0) + ' 台设备</small></div>' +
            '<div class="rt">' + (x.enabled === 1 ? '<span class="tag on"><i></i>启用</span>' : '<span class="tag none"><i></i>停用</span>') + '</div></div>';
        }).join('') + '</div>' : U2.empty('暂无围栏', '尚未创建地理围栏', 'i-fence')) +
        U2.card('围栏分布', '<div id="fenceMap" style="height:420px;border-radius:12px;overflow:hidden;background:#0B1421"></div>') +
      '</div>';

    // 围栏地图
    setTimeout(function () {
      var el = U.$('#fenceMap');
      if (!el || !w.L) return;
      if (fenceMap) { fenceMap.remove(); fenceMap = null; }
      var center = w.CFG.app.defaultCenter;
      var pts = f.filter(function (x) { return x.centerLat && x.centerLng; });
      if (pts.length) center = [pts[0].centerLat, pts[0].centerLng];
      fenceMap = w.L.map('fenceMap', { zoomControl: true, attributionControl: false }).setView(center, 11);
      var t = w.CONFIG.TILES[w.CFG.app.mapTile] || w.CONFIG.TILES.carto;
      w.L.tileLayer(t.url, { subdomains: t.sub || 'abc', maxZoom: t.max }).addTo(fenceMap);
      var b = [];
      f.forEach(function (x) {
        var col = x.color || '#E88828';
        if (x.fenceType === 'CIRCLE' && x.centerLat && x.centerLng) {
          w.L.circle([x.centerLat, x.centerLng], { radius: x.radius || 300, color: col, weight: 2, fillOpacity: .12 })
            .bindPopup('<b>' + U.esc(x.name) + '</b><br>圆形 · R=' + (x.radius || 0) + 'm').addTo(fenceMap);
          b.push([x.centerLat, x.centerLng]);
        } else if (x.vertices) {
          try {
            var v = typeof x.vertices === 'string' ? JSON.parse(x.vertices) : x.vertices;
            var ll = v.map(function (p) { return [p[1], p[0]]; });
            w.L.polygon(ll, { color: col, weight: 2, fillOpacity: .12 })
              .bindPopup('<b>' + U.esc(x.name) + '</b><br>多边形 · ' + ll.length + ' 顶点').addTo(fenceMap);
            ll.forEach(function (p) { b.push(p); });
          } catch (e) { }
        }
      });
      if (b.length) fenceMap.fitBounds(w.L.latLngBounds(b).pad(0.25), { maxZoom: 13 });
      setTimeout(function () { fenceMap.invalidateSize(); }, 160);
    }, 80);

    U.$$('[data-fence]', root).forEach(function (n) {
      n.addEventListener('click', function () {
        var x = f.filter(function (y) { return y.uid === n.getAttribute('data-fence'); })[0];
        if (!x) return;
        U.Drawer.open('围栏详情 · ' + x.name,
          U.kvList({
            名称: x.name, 类型: x.fenceType, 中心纬度: x.centerLat, 中心经度: x.centerLng,
            半径: x.radius ? x.radius + ' m' : null, 颜色: x.color,
            状态: x.enabled === 1 ? '启用' : '停用',
            绑定设备: (x.devices || []).map(function (d) { return d.imei || d.deviceName || d; }).join(', ') || '无',
            顶点: x.vertices, 来源: x.src === 'turbohive' ? 'TurboHive' : 'TrackSolidPro',
            创建时间: U.dt(x.createdAt), 更新时间: U.dt(x.updatedAt)
          }) +
          (x.centerLat ? '<div class="mt" style="height:260px;border-radius:12px;overflow:hidden"><div id="fenceMini" style="height:100%"></div></div>' : ''));
        if (x.centerLat) setTimeout(function () {
          var m = w.L.map('fenceMini', { zoomControl: false, attributionControl: false }).setView([x.centerLat, x.centerLng], 14);
          var t = w.CONFIG.TILES[w.CFG.app.mapTile] || w.CONFIG.TILES.carto;
          w.L.tileLayer(t.url, { subdomains: t.sub || 'abc' }).addTo(m);
          if (x.fenceType === 'CIRCLE') w.L.circle([x.centerLat, x.centerLng], { radius: x.radius || 300, color: x.color || '#E88828', fillOpacity: .15 }).addTo(m);
          else if (x.vertices) { try { var v = JSON.parse(x.vertices); w.L.polygon(v.map(function (p) { return [p[1], p[0]]; }), { color: x.color || '#E88828', fillOpacity: .15 }).addTo(m); } catch (e) { } }
          w.L.marker([x.centerLat, x.centerLng]).addTo(m);
        }, 60);
      });
    });
  }

  /* ============================================================
     7) 平台资源（网关 / 模型 / 厂商 / API Token / 指令）
     ============================================================ */
  var platTab = 'gateway';

  function renderPlatform(root) {
    var U2 = ready(), S = w.STORE;
    var gw = S.gateways || [], stats = S.gatewayStats || {};
    var models = S.models || [], vendors = S.vendors || [];

    root.innerHTML =
      '<div class="grid g-5">' +
        U2.kpi({ label: '网关总数', value: U.num(stats.total || gw.length), unit: '个', icon: 'i-gateway', color: CH.colors.orange }) +
        U2.kpi({ label: '活跃网关', value: U.num(stats.active || 0), unit: '个', icon: 'i-check', color: CH.colors.ok }) +
        U2.kpi({ label: '接入连接数', value: U.num(stats.connectDevices || 0), unit: '台', icon: 'i-link', color: CH.colors.blue }) +
        U2.kpi({ label: '设备型号', value: U.num(models.length), unit: '款', icon: 'i-device', color: CH.colors.purple }) +
        U2.kpi({ label: '厂商', value: U.num(vendors.length), unit: '家', icon: 'i-gateway', color: CH.colors.teal }) +
      '</div>' +
      '<div class="card mt">' +
        '<div class="tabs" id="plTabs">' +
          '<button data-t="gateway" class="on">网关</button>' +
          '<button data-t="model">设备型号</button>' +
          '<button data-t="vendor">厂商</button>' +
          '<button data-t="token">API Token</button>' +
          '<button data-t="cmd">指令历史</button>' +
        '</div>' +
        '<div id="plBody"></div>' +
      '</div>';

    function paint() {
      var html = '';
      if (platTab === 'gateway') {
        html = gw.length ? '<div class="tw"><table><thead><tr><th>网关</th><th>编码</th><th>协议</th><th>地址</th><th>端口</th><th>状态</th><th>连接设备</th><th>运行时长</th></tr></thead><tbody>' +
          gw.map(function (g) {
            return '<tr><td class="strong">' + U.esc(g.name) + '</td><td class="mono">' + U.esc(g.gatewayCode) + '</td>' +
              '<td><span class="tag blue"><i></i>' + U.esc(g.protocol) + '</span></td>' +
              '<td class="mono">' + U.esc(g.hostname) + '</td><td class="num">' + U.esc(g.port) + '</td>' +
              '<td>' + (g.status === 'active' ? '<span class="tag on"><i></i>活跃</span>' : '<span class="tag none"><i></i>' + U.esc(g.status) + '</span>') + '</td>' +
              '<td class="num">' + U.num(g.connectionCount) + '</td><td>' + U.esc(g.uptime || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : U2.empty('暂无网关', '', 'i-gateway');
      } else if (platTab === 'model') {
        html = models.length ? '<div class="tw"><table><thead><tr><th>型号</th><th>型号名称</th><th>类型</th><th>协议</th><th>通道</th><th>GPS</th><th>TAG</th><th>固件</th><th>状态</th></tr></thead><tbody>' +
          models.map(function (m) {
            return '<tr><td class="strong mono">' + U.esc(m.modelCode) + '</td><td>' + U.esc(m.modelName) + '</td>' +
              '<td><span class="tag purple"><i></i>' + U.esc(m.deviceType) + '</span></td>' +
              '<td class="mono">' + U.esc(m.protocol) + '</td><td class="num">' + (m.channelCount || 0) + '</td>' +
              '<td>' + (m.gpsSupported ? '<span class="tag on"><i></i>支持</span>' : '<span class="tag none"><i></i>否</span>') + '</td>' +
              '<td>' + (m.tagSupported ? '<span class="tag blue"><i></i>支持</span>' : '<span class="tag none"><i></i>否</span>') + '</td>' +
              '<td class="mono">' + U.esc(m.firmwareVersion || '—') + '</td>' +
              '<td>' + (m.status === 1 ? '<span class="tag on"><i></i>启用</span>' : '<span class="tag off"><i></i>停用</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : U2.empty('暂无型号', '', 'i-device');
      } else if (platTab === 'vendor') {
        html = vendors.length ? '<div class="grid g-3">' + vendors.map(function (v) {
          return '<div class="card" style="padding:14px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
            '<div class="avatar" style="width:34px;height:34px;border-radius:10px;background:' + U.hashColor(v.vendorCode) + ';font-size:12px">' + U.esc(String(v.vendorCode).slice(0, 2)) + '</div>' +
            '<div><div style="font-weight:700;font-size:13px">' + U.esc(v.vendorName) + '</div>' +
            '<div class="mono" style="font-size:10.5px;color:var(--tx-3)">' + U.esc(v.vendorCode) + '</div></div></div>' +
            '<dl class="dl" style="grid-template-columns:74px 1fr;font-size:11.5px">' +
            '<dt>官网</dt><dd>' + (v.companyWebsite ? '<a class="link" href="' + U.esc(v.companyWebsite) + '" target="_blank" rel="noopener">' + U.esc(v.companyWebsite) + '</a>' : '—') + '</dd>' +
            '<dt>邮箱</dt><dd>' + U.esc(v.contactEmail || '—') + '</dd>' +
            '<dt>电话</dt><dd>' + U.esc(v.contactPhone || '—') + '</dd>' +
            '<dt>型号数</dt><dd>' + models.filter(function (m) { return m.vendorId === v.id; }).length + ' 款</dd></dl></div>';
        }).join('') + '</div>' : U2.empty('暂无厂商', '', 'i-gateway');
      } else if (platTab === 'token') {
        var tks = S.tokens || [];
        html = tks.length ? '<div class="tw"><table><thead><tr><th>ID</th><th>名称</th><th>Token</th><th>状态</th><th>创建时间</th><th>过期时间</th><th>用量</th><th>有效期</th></tr></thead><tbody>' +
          tks.map(function (t) {
            var st = t.status === 'active' ? 'on' : t.status === 'expiring' ? 'idle' : 'off';
            return '<tr><td class="mono">' + t.id + '</td><td class="strong">' + U.esc(t.name || '—') + '</td>' +
              '<td class="mono">' + U.esc(t.value) + '</td>' +
              '<td><span class="tag ' + st + '"><i></i>' + U.esc(t.status) + '</span></td>' +
              '<td>' + U.dt(t.createdAt, false) + '</td><td>' + U.dt(t.expiresAt, false) + '</td>' +
              '<td style="min-width:110px"><div class="bar"><i style="width:' + (t.usageProgress || 0) + '%;background:' + CH.colors.orange + '"></i></div>' +
              '<small style="color:var(--tx-3);font-size:10px">' + (t.usageProgress || 0) + '%</small></td>' +
              '<td>' + (t.tokenDuration || '—') + ' 天</td></tr>';
          }).join('') + '</tbody></table></div>' : U2.empty('暂无 Token', '', 'i-code');
      } else {
        var ch = S.cmdHistory || [];
        if (!ch.length && !S.cmdHistoryLoaded && !S.cmdHistoryLoading) {
          S.cmdHistoryLoading = true;
          U.$('#plBody').innerHTML = U2.loading('正在加载指令历史…');
          API.th.cmdHistory({ page: 1, size: 30 }).then(function (d) {
            S.cmdHistory = (d && d.list) || [];
            S.cmdHistoryLoaded = true; S.cmdHistoryLoading = false;
            paint();
          }).catch(function (e) {
            S.cmdHistoryLoading = false;
            U.$('#plBody').innerHTML =
              '<div class="empty"><svg><use href="#i-warn"/></svg><b>无法加载指令历史</b>' +
              '<p>TurboHive 的 <code>/v3/command/history/page</code> 接口未开放 CORS 预检（OPTIONS 返回 403），' +
              '浏览器端无法直接调用。该接口需通过服务端代理访问。<br>错误：' + U.esc(e.message) + '</p></div>';
          });
          return;
        }
        html = ch.length ? '<div class="tw"><table><thead><tr><th>指令内容</th><th>IMEI</th><th>格式</th><th>状态</th><th>下发时间</th><th>响应时间</th><th>指令号</th></tr></thead><tbody>' +
          ch.map(function (c) {
            var st = c.status === 2 || c.status === 3 ? '<span class="tag on"><i></i>已响应</span>' : '<span class="tag idle"><i></i>待响应</span>';
            return '<tr><td class="strong mono">' + U.esc(c.content) + '</td><td class="mono">' + U.esc(c.imei) + '</td>' +
              '<td>' + U.esc(c.messageFormat || '—') + '</td><td>' + st + '</td>' +
              '<td>' + U.dt(c.sentAt) + '</td><td>' + U.dt(c.responseAt) + '</td><td class="mono">' + U.esc(c.cmdNo || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : U2.empty('暂无指令记录', '', 'i-code');
      }
      U.$('#plBody').innerHTML = html;
    }

    U.$$('#plTabs button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        U.$$('#plTabs button', root).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); platTab = b.getAttribute('data-t'); paint();
      });
    });
    paint();
  }

  /* ============================================================
     8) 媒体资源
     ============================================================ */
  var mediaState = { page: 1, size: 12 };

  function renderMedia(root) {
    var U2 = ready(), S = w.STORE;
    var st = S.storage || {};
    var list = S.resources || [];
    var img = list.filter(function (x) { return x.mediaType === 0; }).length;
    var vid = list.filter(function (x) { return x.mediaType === 1; }).length;
    var totalSize = list.reduce(function (a, x) { return a + (Number(x.fileSize) || 0); }, 0);

    root.innerHTML =
      '<div class="grid g-4">' +
        U2.kpi({ label: '媒体文件', value: U.num(S.resourceTotal || list.length), unit: '个', icon: 'i-media', color: CH.colors.orange }) +
        U2.kpi({ label: '图片 / 视频', value: img + ' / ' + vid, icon: 'i-download', color: CH.colors.blue }) +
        U2.kpi({ label: '本页体积', value: U.bytes(totalSize), icon: 'i-device', color: CH.colors.purple }) +
        U2.kpi({ label: '存储占用', value: U.pct(st.usagePercentage), icon: 'i-gateway', color: CH.colors.warn,
          foot: U.bytes(st.usedSpace) + ' / ' + U.bytes(st.totalSpace) }) +
      '</div>' +
      '<div class="card mt">' +
        '<div class="card-h"><h3>媒体库</h3><span class="sub">来自 TurboHive /v3/resource/page</span>' +
        '<div class="right"><button class="btn sm ghost" id="mdRefresh">' + U.icon('i-refresh') + '刷新</button></div></div>' +
        '<div id="mdGrid">' + U2.loading() + '</div>' +
      '</div>';

    function paint() {
      var total = S.resourceTotal || list.length;
      var pages = Math.max(1, Math.ceil(total / mediaState.size));
      U.$('#mdGrid').innerHTML = list.length ? '<div class="mgrid">' + list.map(function (m) {
        var isImg = m.mediaType === 0;
        return '<div class="mcard" data-media="' + U.esc(m.id) + '">' +
          '<div class="th" style="' + (isImg ? 'background-image:url(' + U.esc(m.storagePath) + ')' : '') + '">' +
          (isImg ? '' : '<svg class="ico"><use href="#i-media"/></svg>') + '</div>' +
          '<div class="bd"><b>' + U.esc(m.fileName) + '</b>' +
          '<small>' + U.bytes(m.fileSize) + ' · CH' + m.channel + '</small>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px">' +
          '<span class="tag ' + (isImg ? 'blue' : 'orange') + '"><i></i>' + (isImg ? '图片' : '视频') + '</span>' +
          '<small style="color:var(--tx-3);font-size:10px">' + U.ago(m.captureTime) + '</small></div></div></div>';
      }).join('') + '</div>' + U2.pager({ total: total, size: mediaState.size, page: mediaState.page })
        : U2.empty('暂无媒体文件', '设备尚未上传抓拍或录像', 'i-media');
      U2.bindPager(U.$('#mdGrid'), { total: total, size: mediaState.size, page: mediaState.page }, function () {
        API.th.resources({ page: mediaState.page, size: mediaState.size }).then(function (d) {
          S.resources = (d && d.data) || [];
          w.STORE.resourceTotal = (d && d.total) || 0;
          paint();
        }).catch(function (e) { U.toast(e.message, 'err'); });
      });
      U.$$('[data-media]', root).forEach(function (n) {
        n.addEventListener('click', function () {
          var m = list.filter(function (x) { return String(x.id) === n.getAttribute('data-media'); })[0];
          if (!m) return;
          var isImg = m.mediaType === 0;
          U.Drawer.open('媒体详情',
            (isImg ? '<img src="' + U.esc(m.storagePath) + '" style="width:100%;border-radius:12px;margin-bottom:14px" onerror="this.style.display=\'none\'">'
              : '<video src="' + U.esc(m.storagePath) + '" controls style="width:100%;border-radius:12px;margin-bottom:14px;background:#000"></video>') +
            U.kvList({
              文件名: m.fileName, 类型: isImg ? '图片' : '视频', 通道: 'CH' + m.channel,
              大小: U.bytes(m.fileSize), IMEI: m.imei, 事件类型: m.eventType,
              抓拍时间: U.dt(m.captureTime), 存储通道: m.storageChannel, 路径: m.storagePath
            }) +
            '<a class="btn primary mt" href="' + U.esc(m.storagePath) + '" target="_blank" rel="noopener">' + U.icon('i-link') + '在新窗口打开</a>');
        });
      });
    }
    U.$('#mdRefresh').addEventListener('click', function () {
      API.th.resources({ page: mediaState.page, size: mediaState.size }).then(function (d) {
        S.resources = (d && d.data) || []; w.STORE.resourceTotal = (d && d.total) || 0;
        paint(); U.toast('媒体库已刷新', 'ok');
      }).catch(function (e) { U.toast(e.message, 'err'); });
    });
    paint();
  }

  /* ============================================================
     9) API 控制台
     ============================================================ */
  var TH_EPS = [
    { m: 'POST', p: '/v3/auth/login', s: '用户登录', b: { email: 'demo@turbohive.ai', password: '123456' } },
    { m: 'GET', p: '/v3/devices/page', s: '分页查询设备', q: { page: 1, size: 5 } },
    { m: 'POST', p: '/v3/devices/status/bulk', s: '批量查询设备状态', b: { imeis: [], targetType: 1 } },
    { m: 'POST', p: '/v3/track/location', s: '设备实时位置', b: { type: 0 } },
    { m: 'GET', p: '/v3/alerts/page', s: '分页查询告警', q: { page: 1, size: 5 } },
    { m: 'POST', p: '/v3/trip/page', s: '分页查询行程', b: { page: 1, size: 5 } },
    { m: 'GET', p: '/v3/mileage/realtime', s: '实时里程', q: { page: 1, size: 5 } },
    { m: 'GET', p: '/v3/mileage/daily', s: '每日里程', q: { page: 1, size: 3 } },
    { m: 'GET', p: '/v3/geofences/page', s: '分页查询围栏', q: { page: 1, size: 10 } },
    { m: 'GET', p: '/v3/gateways/page', s: '分页查询网关', q: { page: 1, size: 10 } },
    { m: 'GET', p: '/v3/models', s: '查询所有型号' },
    { m: 'GET', p: '/v3/vendors', s: '查询所有厂商' },
    { m: 'GET', p: '/v3/resource/page', s: '媒体资源分页', q: { page: 1, size: 6 } },
    { m: 'GET', p: '/v3/resource/storage/usage', s: '存储用量统计' },
    { m: 'GET', p: '/v3/tokens/page', s: 'API Token 分页', q: { page: 1, size: 5 } },
    { m: 'GET', p: '/v3/gateways/list', s: '网关列表' },
    { m: 'GET', p: '/v3/obd', s: '查询 OBD 数据', q: { imei: '', startTime: 0, endTime: 0 } },
    { m: 'POST', p: '/v3/video/live/start', s: '开启实时视频', b: { imei: '', channel: 1, dataType: 'audio_video', streamType: 'main_stream' } },
    { m: 'POST', p: '/v3/video/live/stop', s: '停止实时视频', b: { imei: '', channel: 1 } },
    { m: 'POST', p: '/v3/video/files/list', s: '视频文件列表', b: { imei: '', startTime: 0, endTime: 0, channel: 1 } },
    { m: 'POST', p: '/v3/video/playback/start', s: '录像回放开始', b: { imei: '', channel: 1, fileNames: [] } },
    { m: 'POST', p: '/v3/video/capture/start', s: '远程抓拍', b: { imei: '', channel: 1, type: 1 } },
    { m: 'GET', p: '/v3/alerts/video/fetch', s: '获取告警视频', q: { imei: '', alertTime: 0, alertCode: '', alertType: '' } },
    { m: 'POST', p: '/v3/geocoding/reverse', s: '逆地理编码', b: { lat: 22.5766, lng: 113.9431 } }
  ];
  var TSP_EPS = [
    { m: 'POST', p: 'jimi.oauth.token.get', s: '获取 access_token' },
    { m: 'POST', p: 'jimi.user.device.list', s: '子账号设备列表', b: { target: 'TS-test01' } },
    { m: 'POST', p: 'jimi.user.device.location.list', s: '按账号获取设备位置', b: { target: 'TS-test01' } },
    { m: 'POST', p: 'jimi.device.location.get', s: '指定设备位置', b: { imeis: '' } },
    { m: 'POST', p: 'jimi.device.alarm.list', s: '设备告警列表', b: { imeis: '', page_no: 1, page_size: 5 } },
    { m: 'POST', p: 'jimi.device.track.list', s: '设备轨迹数据', b: { imei: '', begin_time: '', end_time: '' } },
    { m: 'POST', p: 'jimi.device.track.mileage', s: '设备里程数据', b: { imeis: '', begin_time: '', end_time: '' } },
    { m: 'POST', p: 'jimi.open.platform.report.trips', s: '行程报表', b: { account: 'TS-test01', imeis: '', type: 'list', start_time: '', end_time: '', start_row: 0, page_size: 10 } },
    { m: 'POST', p: 'jimi.open.platform.fence.list', s: '平台围栏列表', b: { account: 'TS-test01', page_no: 1, page_size: 10 } },
    { m: 'POST', p: 'jimi.device.group.list', s: '设备分组列表', b: { account: 'TS-test01' } },
    { m: 'POST', p: 'jimi.open.instruction.list', s: '设备支持指令', b: { imei: '' } },
    { m: 'POST', p: 'jimi.device.obd.list', s: 'OBD 数据', b: { imeis: '', start_time: '', end_time: '' } }
  ];

  function renderConsole(root) {
    var U2 = ready();
    root.innerHTML =
      '<div class="grid g-23">' +
        '<div class="card" style="padding:12px">' +
          '<div class="tabs" style="margin-bottom:8px" id="csTabs">' +
            '<button class="on" data-t="th">TurboHive · ' + TH_EPS.length + '</button>' +
            '<button data-t="tsp">TrackSolidPro · ' + TSP_EPS.length + '</button></div>' +
          '<div id="csList" style="max-height:520px;overflow-y:auto"></div>' +
        '</div>' +
        '<div>' +
          '<div class="card">' +
            '<div class="card-h"><h3 id="csTitle">选择一个接口</h3>' +
            '<div class="right"><button class="btn sm primary" id="csSend">' + U.icon('i-bolt') + '发送请求</button></div></div>' +
            '<div class="grid g-2">' +
              '<div><label class="fl">Method</label><input class="inp mono" id="csMethod" style="width:100%" readonly></div>' +
              '<div><label class="fl">Path</label><input class="inp mono" id="csPath" style="width:100%" readonly></div>' +
            '</div>' +
            '<div class="field"><label class="fl">请求参数 (JSON / Query)</label>' +
              '<textarea id="csParams" class="inp mono" rows="7" style="width:100%;resize:vertical;line-height:1.6"></textarea></div>' +
            '<div class="hint" id="csHint">TurboHive 使用 Bearer JWT；TrackSolidPro 使用 MD5 签名 + access_token（自动计算）。</div>' +
          '</div>' +
          '<div class="card mt">' +
            '<div class="card-h"><h3>响应</h3><span class="sub" id="csMeta"></span>' +
            '<div class="right"><button class="btn sm ghost" id="csCopy">' + U.icon('i-code') + '复制</button></div></div>' +
            '<div class="code" id="csResp">// 等待请求…</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card mt">' +
        '<div class="card-h"><h3>请求日志</h3><span class="sub">TrackSolidPro 最近调用</span>' +
        '<div class="right"><button class="btn sm ghost" id="csClearLog">清空</button></div></div>' +
        '<div id="csLog"></div>' +
      '</div>';

    var src = 'th', cur = null;

    function paintList() {
      var eps = src === 'th' ? TH_EPS : TSP_EPS;
      U.$('#csList').innerHTML = eps.map(function (e, i) {
        return '<div class="ep' + (cur === e ? ' on' : '') + '" data-i="' + i + '">' +
          '<span class="mth ' + (src === 'th' ? e.m : 'POST') + '">' + (src === 'th' ? e.m : 'POST') + '</span>' +
          '<span class="pt">' + U.esc(e.p) + '</span><span class="sm">' + U.esc(e.s) + '</span></div>';
      }).join('');
      U.$$('#csList .ep', root).forEach(function (n) {
        n.addEventListener('click', function () { pick(eps[+n.getAttribute('data-i')]); });
      });
    }

    function pick(e) {
      cur = e;
      paintList();
      U.$('#csTitle').textContent = e.s + ' · ' + e.p;
      U.$('#csMethod').value = src === 'th' ? e.m : 'POST';
      U.$('#csPath').value = e.p;
      var p = e.b ? e.b : (e.q || {});
      U.$('#csParams').value = JSON.stringify(p, null, 2);
      U.$('#csHint').textContent = src === 'th'
        ? 'TurboHive 端点：GET 参数将作为 query string，POST 参数作为 JSON body。Base: ' + w.CFG.turbohive.baseUrl
        : 'TrackSolidPro 端点：所有参数以 form-urlencoded 提交，签名 sign 由前端自动按 MD5(appSecret + 排序串 + appSecret) 计算。Base: ' + w.CFG.tsp.baseUrl;
      U.$('#csResp').innerHTML = '<span class="c">// 等待请求…</span>';
      U.$('#csMeta').textContent = '';
    }

    function send() {
      if (!cur) return U.toast('请先选择一个接口', 'warn');
      var raw = U.$('#csParams').value.trim();
      var params = {};
      if (raw) { try { params = JSON.parse(raw); } catch (e) { return U.toast('参数 JSON 解析失败：' + e.message, 'err'); } }
      U.$('#csResp').innerHTML = '<span class="c">// 请求中…</span>';
      var t0 = Date.now();
      var done = function (data) {
        U.$('#csResp').innerHTML = U.highlight(data);
        U.$('#csMeta').textContent = '耗时 ' + (Date.now() - t0) + ' ms';
      };
      var fail = function (e) {
        U.$('#csResp').innerHTML = U.highlight({ error: e.message, code: e.code || null, raw: e.raw || null });
        U.$('#csMeta').textContent = '失败 · ' + (Date.now() - t0) + ' ms';
        U.toast(e.message, 'err');
      };
      if (src === 'th') {
        if (cur.m === 'GET') API.th.raw('GET', cur.p, { query: params }).then(done).catch(fail);
        else API.th.raw(cur.m, cur.p, { body: params }).then(done).catch(fail);
      } else {
        API.tsp.call(cur.p, params).then(done).catch(fail).then(paintLog);
      }
    }

    function paintLog() {
      var log = API.tsp.log();
      U.$('#csLog').innerHTML = log.length ? '<div class="tw"><table><thead><tr><th>时间</th><th>方法</th><th>参数</th><th>状态</th><th>耗时</th></tr></thead><tbody>' +
        log.slice(0, 15).map(function (l) {
          return '<tr><td>' + U.dt(l.time) + '</td><td class="mono strong">' + U.esc(l.method) + '</td>' +
            '<td class="mono" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">' + U.esc(JSON.stringify(l.params)) + '</td>' +
            '<td>' + (l.ok ? '<span class="tag on"><i></i>code 0</span>' : '<span class="tag off"><i></i>code ' + l.code + '</span>') + '</td>' +
            '<td class="num">' + l.ms + ' ms</td></tr>';
        }).join('') + '</tbody></table></div>' : U2.empty('暂无调用日志', '在左侧选择 TrackSolidPro 接口并发送请求', 'i-code');
    }

    U.$$('#csTabs button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        U.$$('#csTabs button', root).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); src = b.getAttribute('data-t'); cur = null;
        paintList();
        var eps = src === 'th' ? TH_EPS : TSP_EPS;
        pick(eps[0]);
      });
    });
    U.$('#csSend').addEventListener('click', send);
    U.$('#csCopy').addEventListener('click', function () {
      var t = U.$('#csResp').textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { U.toast('响应已复制', 'ok'); });
      else U.toast('当前浏览器不支持剪贴板', 'warn');
    });
    U.$('#csClearLog').addEventListener('click', function () { API.tsp.clearLog(); paintLog(); });
    paintList(); pick(TH_EPS[0]); paintLog();
  }

  /* ============================================================
     10) 接入设置
     ============================================================ */
  function renderSettings(root) {
    var U2 = ready();
    var c = w.CFG;
    root.innerHTML =
      '<div class="grid g-2">' +
        '<div class="card">' +
          '<div class="card-h"><h3>TurboHive IoT Hub</h3>' +
            '<div class="right"><span class="tag ' + (API.status().turbohive === 'ok' ? 'on' : 'none') + '" id="stTH"><i></i>' +
            (API.status().turbohive === 'ok' ? '已连接' : '未连接') + '</span>' +
            '<button class="btn sm ghost" id="thTest">测试连接</button></div></div>' +
          '<div class="field"><label class="fl">服务地址 Base URL</label><input class="inp" id="thBase" style="width:100%" value="' + U.esc(c.turbohive.baseUrl) + '"></div>' +
          '<div class="grid g-2">' +
            '<div class="field"><label class="fl">登录邮箱</label><input class="inp" id="thEmail" style="width:100%" value="' + U.esc(c.turbohive.email) + '"></div>' +
            '<div class="field"><label class="fl">登录密码</label><input class="inp" id="thPwd" type="password" style="width:100%" value="' + U.esc(c.turbohive.password) + '"></div>' +
          '</div>' +
          '<div class="field"><label class="fl">Bearer Token（可直接粘贴，留空则自动登录）</label>' +
            '<textarea class="inp mono" id="thToken" rows="4" style="width:100%;resize:vertical">' + U.esc(c.turbohive.token) + '</textarea></div>' +
          '<div class="hint">认证方式：<b>Bearer JWT</b>。若 Token 失效（code 1101），系统会自动用邮箱密码重新登录换取新 Token。</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-h"><h3>TrackSolidPro Open API</h3>' +
            '<div class="right"><span class="tag ' + (API.status().tsp === 'ok' ? 'on' : 'none') + '" id="stTSP"><i></i>' +
            (API.status().tsp === 'ok' ? '已连接' : '未连接') + '</span>' +
            '<button class="btn sm ghost" id="tspTest">测试连接</button></div></div>' +
          '<div class="field"><label class="fl">服务地址 Request URL</label><input class="inp" id="tspBase" style="width:100%" value="' + U.esc(c.tsp.baseUrl) + '"></div>' +
          '<div class="grid g-2">' +
            '<div class="field"><label class="fl">App Key</label><input class="inp mono" id="tspKey" style="width:100%" value="' + U.esc(c.tsp.appKey) + '"></div>' +
            '<div class="field"><label class="fl">账号 Account</label><input class="inp" id="tspUser" style="width:100%" value="' + U.esc(c.tsp.userId) + '"></div>' +
          '</div>' +
          '<div class="field"><label class="fl">App Secret</label><input class="inp mono" id="tspSecret" type="password" style="width:100%" value="' + U.esc(c.tsp.appSecret) + '"></div>' +
          '<div class="field"><label class="fl">user_pwd_md5</label><input class="inp mono" id="tspPwd" style="width:100%" value="' + U.esc(c.tsp.userPwdMd5) + '"></div>' +
          '<div class="hint">认证方式：<b>MD5 签名</b>。sign = MD5(appSecret + 按 key 升序拼接的参数串 + appSecret)，结果大写。access_token 有效期 2 小时，自动缓存刷新。</div>' +
        '</div>' +
      '</div>' +

      '<div class="grid g-2 mt">' +
        '<div class="card">' +
          '<div class="card-h"><h3>应用偏好</h3></div>' +
          '<div class="field"><label class="fl">界面语言 / Language</label><select class="sel" id="appLang">' +
            '<option value="zh">中文</option><option value="en">English</option><option value="es">Español</option></select></div>' +
          '<div class="field" style="display:flex;align-items:center;gap:12px">' +
            '<div class="switch ' + (c.app.autoRefresh ? 'on' : '') + '" id="swAuto"></div>' +
            '<div><div style="font-size:13px;font-weight:600">自动刷新</div>' +
            '<div class="hint" style="margin:0">按设定间隔轮询设备与告警数据</div></div></div>' +
          '<div class="field"><label class="fl">刷新间隔（秒）</label>' +
            '<input class="inp" id="appSec" type="number" min="15" max="600" style="width:140px" value="' + c.app.refreshSec + '"></div>' +
          '<div class="field"><label class="fl">地图底图</label><select class="sel" id="appTile">' +
            Object.keys(w.CONFIG.TILES).map(function (k) {
              return '<option value="' + k + '"' + (c.app.mapTile === k ? ' selected' : '') + '>' + w.CONFIG.TILES[k].name + '</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><label class="fl">默认每页条数</label>' +
            '<input class="inp" id="appSize" type="number" min="5" max="100" style="width:140px" value="' + c.app.pageSize + '"></div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-h"><h3>连接自检</h3><span class="sub">实时探测两端点可用性</span></div>' +
          '<div id="diagBox">' + U2.empty('点击下方按钮开始检测', '将依次请求 TurboHive 设备分页与 TSP 设备列表', 'i-bolt') + '</div>' +
          '<div style="display:flex;gap:9px;margin-top:12px;flex-wrap:wrap">' +
            '<button class="btn primary" id="btnSave">' + U.icon('i-check') + '保存并重连</button>' +
            '<button class="btn blue" id="btnDiag">' + U.icon('i-bolt') + '运行自检</button>' +
            '<button class="btn ghost" id="btnReset">' + U.icon('i-refresh') + '恢复默认凭据</button>' +
          '</div>' +
          '<div class="hint">⚠️ 本应用为纯前端 Demo，凭据保存在浏览器 localStorage。生产环境请将签名与密钥置于服务端。</div>' +
        '</div>' +
      '</div>';

    function collect() {
      var c2 = w.CFG;
      c2.turbohive.baseUrl = U.$('#thBase').value.trim().replace(/\/+$/, '');
      c2.turbohive.email = U.$('#thEmail').value.trim();
      c2.turbohive.password = U.$('#thPwd').value;
      c2.turbohive.token = U.$('#thToken').value.trim();
      c2.tsp.baseUrl = U.$('#tspBase').value.trim();
      c2.tsp.appKey = U.$('#tspKey').value.trim();
      c2.tsp.appSecret = U.$('#tspSecret').value.trim();
      c2.tsp.userId = U.$('#tspUser').value.trim();
      c2.tsp.userPwdMd5 = U.$('#tspPwd').value.trim();
      c2.app.autoRefresh = U.$('#swAuto').classList.contains('on');
      c2.app.refreshSec = Math.max(15, parseInt(U.$('#appSec').value, 10) || 60);
      c2.app.mapTile = U.$('#appTile').value;
      c2.app.pageSize = Math.max(5, parseInt(U.$('#appSize').value, 10) || 15);
      w.CONFIG.save();
    }

    U.$('#swAuto').addEventListener('click', function () { this.classList.toggle('on'); });
    if (w.I18N) U.$('#appLang').value = w.I18N.lang();

    U.$('#btnSave').addEventListener('click', function () {
      collect();
      U.toast('配置已保存，正在重新连接…', 'ok');
      w.APP.boot(true).then(function () { w.APP.goto('overview'); });
    });

    U.$('#thTest').addEventListener('click', function () {
      collect();
      var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>测试中';
      API.th.probe().then(function () {
        U.toast('TurboHive 连接正常', 'ok');
        U.$('#stTH').className = 'tag on'; U.$('#stTH').innerHTML = '<i></i>已连接';
      }).catch(function (e) {
        U.toast(e.message, 'err');
        U.$('#stTH').className = 'tag off'; U.$('#stTH').innerHTML = '<i></i>连接失败';
      }).then(function () { b.disabled = false; b.innerHTML = '测试连接'; });
    });

    U.$('#tspTest').addEventListener('click', function () {
      collect();
      var b = this; b.disabled = true; b.innerHTML = '<span class="spin"></span>测试中';
      API.tsp.probe().then(function () {
        U.toast('TrackSolidPro 连接正常', 'ok');
        U.$('#stTSP').className = 'tag on'; U.$('#stTSP').innerHTML = '<i></i>已连接';
      }).catch(function (e) {
        U.toast(e.message, 'err');
        U.$('#stTSP').className = 'tag off'; U.$('#stTSP').innerHTML = '<i></i>连接失败';
      }).then(function () { b.disabled = false; b.innerHTML = '测试连接'; });
    });

    U.$('#btnDiag').addEventListener('click', function () {
      var box = U.$('#diagBox');
      box.innerHTML = U2.loading('正在探测…');
      var t0 = Date.now();
      Promise.allSettled([API.th.probe(), API.tsp.probe()]).then(function (res) {
        var rows = [
          { name: 'TurboHive · GET /v3/devices/page', ok: res[0].status === 'fulfilled',
            msg: res[0].status === 'fulfilled' ? ('返回 ' + (res[0].value ? res[0].value.total : 0) + ' 台设备') : res[0].reason.message },
          { name: 'TrackSolidPro · jimi.user.device.list', ok: res[1].status === 'fulfilled',
            msg: res[1].status === 'fulfilled' ? ('返回 ' + (res[1].value ? res[1].value.length : 0) + ' 台设备') : res[1].reason.message }
        ];
        box.innerHTML = '<div class="mlist">' + rows.map(function (r) {
          return '<div class="mrow"><div class="ic" style="background:' + (r.ok ? CH.colors.ok : CH.colors.err) + '22">' +
            '<svg class="ico" style="fill:' + (r.ok ? CH.colors.ok : CH.colors.err) + '"><use href="#' + (r.ok ? 'i-check' : 'i-warn') + '"/></svg></div>' +
            '<div class="tx"><b>' + U.esc(r.name) + '</b><small>' + U.esc(r.msg) + '</small></div>' +
            '<div class="rt">' + (r.ok ? '<span class="tag on"><i></i>正常</span>' : '<span class="tag off"><i></i>异常</span>') + '</div></div>';
        }).join('') + '</div><div class="hint">总耗时 ' + (Date.now() - t0) + ' ms</div>';
      });
    });

    U.$('#btnReset').addEventListener('click', function () {
      w.CONFIG.reset();
      U.toast('已恢复默认凭据，正在重新加载…', 'warn');
      setTimeout(function () { location.reload(); }, 700);
    });
  }

  w.PAGES = w.PAGES || {};
  w.PAGES.trips = { title: '行程与里程', desc: '行程记录、里程统计与趋势分析', render: renderTrips };
  w.PAGES.geofence = { title: '围栏管理', desc: '地理围栏配置与设备绑定', render: renderGeofence };
  w.PAGES.platform = { title: '网关与模型', desc: 'IoT 网关、设备型号、厂商与 API Token', render: renderPlatform };
  w.PAGES.media = { title: '媒体资源', desc: '设备抓拍图片与录像文件', render: renderMedia };
  w.PAGES.console = { title: 'API 控制台', desc: '双平台接口在线调试', render: renderConsole };
  w.PAGES.settings = { title: '接入设置', desc: '平台凭据、应用偏好与连接自检', render: renderSettings };
})(window);
