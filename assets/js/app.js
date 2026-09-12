/* ============================================================
   app.js — 应用编排：数据仓库 / 路由 / 刷新 / 详情抽屉
   ============================================================ */
(function (w) {
  'use strict';
  var U = w.U, API = w.API, CH = w.CHART;

  /* ================= 数据仓库 ================= */
  var STORE = {
    devices: [],
    alerts: [], alertTotal: 0,
    trips: [], tripTotal: 0,
    mileage: [], dailyMileage: [],
    geofences: [],
    gateways: [], gatewayStats: {},
    models: [], vendors: [],
    resources: [], resourceTotal: 0,
    storage: {},
    tokens: [], cmdHistory: [],
    loadedAt: 0
  };
  w.STORE = STORE;

  var curPage = 'overview';
  var liveTimer = null;
  var mapFocus = null;

  /* ================= 归一化 ================= */
  function thDevices(list) {
    return (list || []).map(function (d) {
      return {
        uid: 'th:' + d.id, src: 'turbohive', id: d.id, imei: d.imei,
        name: d.deviceName || d.imei, model: d.model, deviceType: d.deviceType || '未知',
        protocol: d.protocol || '—', online: d.onlineStatus,
        lat: null, lng: null, speed: null, acc: null, sats: null, course: null,
        motion: null, lastTime: d.importTime || null, importTime: d.importTime,
        mileage: null, todayMileage: null, raw: d
      };
    });
  }
  /** TSP mcTypeUseScope → 中文设备类型 */
  var SCOPE_MAP = {
    automobile: '车辆追踪器', aotomobile: '车辆追踪器',   // 接口存在 "aotomobile" 拼写
    electromobile: '电动车', personal: '人员定位', pet: '宠物',
    plane: '无人机', others: '其他'
  };
  function tspDevices(list) {
    return (list || []).map(function (d) {
      var type = SCOPE_MAP[(d.mcTypeUseScope || '').toLowerCase()] || (d.mcTypeUseScope || '车辆追踪器');
      return {
        uid: 'tsp:' + d.imei, src: 'tsp', id: d.imei, imei: d.imei,
        name: d.deviceName || d.imei, model: d.mcType, deviceType: type,
        protocol: 'JIMI', online: 0,
        lat: null, lng: null, speed: null, acc: null, sats: null, course: null,
        motion: null, lastTime: null, importTime: null,
        group: d.deviceGroup, expiration: d.expiration, raw: d
      };
    });
  }
  function parseTime(s) {
    if (!s) return null;
    var t = new Date(String(s).replace(/-/g, '/')).getTime();
    return isNaN(t) ? null : t;
  }
  function onlineFromHb(hb, status) {
    var t = parseTime(hb);
    if (t && Date.now() - t < 15 * 60000) return 1;
    if (status === '1') return 1;
    if (t) return 2;
    return 0;
  }

  var ALERT_LEVEL = {
    // TurboHive alert.type 归类
    high: ['201', '202', '203', '204', '205', '1041', '51', '52', '53', '54', '55'],
    mid: ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110']
  };
  var HIGH_RE = /碰撞|crash|sos|劫持|拖车|拆除|拆卸|超速|overspeed|疲劳|fatigue|断电|断油|低电|拔卡|低电量|tamper/i;
  var MID_RE = /围栏|fence|进出|enter|exit|停车|怠速|parking|idle|T卡|SD卡|视频|video|信号|signal|故障|fault|离线|offline|震动|vibrat|移动|move/i;
  function levelOfTh(a) {
    var n = String(a['alert.name'] || '') + ' ' + String(a['alert.description'] || '');
    if (HIGH_RE.test(n)) return 'high';
    if (MID_RE.test(n)) return 'mid';
    return 'low';
  }
  function thAlerts(list) {
    return (list || []).map(function (a) {
    return {
      uid: 'th:' + a['alert.id'], src: 'turbohive', id: a['alert.id'],
      imei: a.imei, name: a['alert.name'] || '告警', type: a['alert.type'],
      code: a['alert.code'], desc: a['alert.description'] || '',
      time: a['alert.time'] || null,
      lat: validCoord(a['gnss.lat'], a['gnss.lng']) ? +a['gnss.lat'] : null,
      lng: validCoord(a['gnss.lat'], a['gnss.lng']) ? +a['gnss.lng'] : null,
      level: levelOfTh(a), raw: a
    };
    });
  }
  function tspAlarms(list) {
    return (list || []).map(function (a) {
      var n = a.alarmTypeName || '';
      var lv = HIGH_RE.test(n) ? 'high' : MID_RE.test(n) ? 'mid' : 'low';
      var t = parseTime(a.alertTime);
      return {
        uid: 'tsp:' + (a.imei + '_' + a.alertTime + '_' + a.alertTypeId).replace(/[^\w]/g, ''),
        src: 'tsp', id: a.imei + ':' + a.alertTime, imei: a.imei,
        name: n || ('告警 ' + a.alertTypeId), type: a.alertTypeId, code: a.alertTypeId,
        desc: a.deviceName || '', time: t,
        lat: validCoord(a.lat, a.lng) ? +a.lat : null,
        lng: validCoord(a.lat, a.lng) ? +a.lng : null,
        level: lv, raw: a
      };
    });
  }

  /** 校验 WGS84 坐标有效性 */
  function validCoord(lat, lng) {
    var a = Number(lat), b = Number(lng);
    if (!isFinite(a) || !isFinite(b)) return false;
    if (a < -90 || a > 90 || b < -180 || b > 180) return false;
    if (a === 0 && b === 0) return false;
    return true;
  }

  /* ================= 启动引导 ================= */
  function setBootMsg(t) { var n = U.$('#bootMsg'); if (n) n.textContent = t; }
  function hideBoot() { var n = U.$('#boot'); if (n) n.classList.add('hide'); }

  /**
   * 启动引导
   * @param silent     不显示启动遮罩
   * @param waitAll    true=等待次级数据（告警/行程/资源）加载完成后再 resolve
   */
  function boot(silent, waitAll) {
    if (!silent) { U.$('#boot').classList.remove('hide'); setBootMsg('正在连接 TurboHive…'); }
    STORE.secondaryReady = false;
    var tasks = [];
    var c = w.CFG;

    /* --- TurboHive --- */
    var pTH = (function () {
      if (!c.turbohive.enabled) return Promise.resolve();
      setBootMsg('正在拉取 TurboHive 设备清单…');
      return API.th.devices({ page: 1, size: 100 }).then(function (d) {
        var devs = thDevices(d && d.data);
        STORE.devices = STORE.devices.filter(function (x) { return x.src !== 'turbohive'; }).concat(devs);
        var imeis = devs.map(function (x) { return x.imei; });
        if (!imeis.length) return;
        setBootMsg('正在拉取设备状态与实时位置…');
        return Promise.allSettled([
          API.th.deviceStatus(imeis).then(function (st) {
            var m = {};
            (st || []).forEach(function (s) { m[s.imei] = s; });
            devs.forEach(function (dv) {
              var s = m[dv.imei]; if (!s) return;
              dv.online = s.onlineStatus; dv.motion = s.motionStatus;
              dv.speed = s.speed; dv.lastTime = s.lastGpsTime || s.lastHeartTime || dv.lastTime;
              dv.activated = s.activated;
            });
          }),
          API.th.locations(imeis).then(function (r) {
            var m = {};
            ((r && r.list) || []).forEach(function (p) { m[p.imei] = p; });
            devs.forEach(function (dv) {
              var p = m[dv.imei]; if (!p) return;
              if (validCoord(p['gnss.lat'], p['gnss.lng'])) {
                dv.lat = +p['gnss.lat']; dv.lng = +p['gnss.lng'];
              }
              dv.speed = p['gnss.speed'] !== undefined ? p['gnss.speed'] : dv.speed;
              dv.acc = p['status.acc']; dv.sats = p['gnss.satellites'];
              dv.course = p['gnss.course'];
              dv.lastTime = p['device.time'] || dv.lastTime;
            });
          })
        ]);
      }).catch(function (e) {
        console.warn('[TurboHive]', e.message);
        U.toast('TurboHive 数据加载失败：' + e.message, 'err', 6000);
      });
    })();
    tasks.push(pTH);

    /* --- TrackSolidPro --- */
    var pTSP = (function () {
      if (!c.tsp.enabled) return Promise.resolve();
      setBootMsg('正在拉取 TrackSolidPro 设备清单…');
      return API.tsp.deviceList().then(function (list) {
        var devs = tspDevices(list);
        STORE.devices = STORE.devices.filter(function (x) { return x.src !== 'tsp'; }).concat(devs);
        setBootMsg('正在拉取 TrackSolidPro 实时位置…');
        return API.tsp.locations().then(function (locs) {
          var m = {};
          (locs || []).forEach(function (p) { m[p.imei] = p; });
          devs.forEach(function (dv) {
            var p = m[dv.imei]; if (!p) return;
            dv.online = onlineFromHb(p.hbTime, p.status);
            if (validCoord(p.lat, p.lng)) { dv.lat = +p.lat; dv.lng = +p.lng; }
            dv.speed = p.speed !== undefined ? +p.speed : null;
            dv.acc = p.accStatus !== undefined ? +p.accStatus : null;
            dv.sats = p.gpsNum !== undefined ? +p.gpsNum : null;
            dv.course = p.direction !== undefined ? +p.direction : null;
            dv.lastTime = parseTime(p.gpsTime) || parseTime(p.hbTime);
            dv.hbTime = p.hbTime; dv.gpsTime = p.gpsTime;
            dv.posType = p.posType; dv.mileage = +p.currentMileage || null;
            dv.expired = p.expireFlag === '0';
          });
        });
      }).catch(function (e) {
        console.warn('[TSP]', e.message);
        U.toast('TrackSolidPro 数据加载失败：' + e.message, 'err', 6000);
      });
    })();
    tasks.push(pTSP);

    var primary = Promise.allSettled(tasks).then(function () {
      STORE.loadedAt = Date.now();
      updateSidebar();
      hideBoot();
      if (!silent) U.toast('已加载 ' + STORE.devices.length + ' 台设备', 'ok');
    });

    // 次级数据（告警 / 行程 / 里程 / 资源…）后台加载，TSP 端受 1.1s 限流串行执行
    var secondary = primary.then(function () {
      setBootMsg('正在聚合告警、行程与平台资源…');
      return loadSecondary();
    }).then(function () {
      STORE.secondaryReady = true;
      updateSidebar();
      if (!silent) U.toast('告警 / 行程 / 资源数据已就绪', 'ok');
      // 若用户停留在数据页且未打开抽屉，自动补渲染一次
      var drawerOpen = U.$('#drawer').classList.contains('on');
      var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
      if (!drawerOpen && !typing && curPage !== 'settings') goto(curPage);
    });

    return waitAll ? secondary : primary;
  }

  /* ================= 次级数据 ================= */
  function loadSecondary() {
    var c = w.CFG;
    var now = Date.now();
    var thImeis = STORE.devices.filter(function (d) { return d.src === 'turbohive'; }).map(function (d) { return d.imei; });
    var tspAll = STORE.devices.filter(function (d) { return d.src === 'tsp'; });
    var tspImeis = tspAll.filter(function (d) { return d.online === 1; }).map(function (d) { return d.imei; });
    tspAll.slice(0, 100).forEach(function (d) { if (tspImeis.indexOf(d.imei) < 0 && tspImeis.length < 100) tspImeis.push(d.imei); });
    var begin = U.tsStr(now - 7 * 86400000), end = U.tsStr(now);

    var jobs = [];

    if (c.turbohive.enabled) {
      jobs.push(API.th.alerts({ page: 1, size: 100 }).then(function (d) {
        STORE.alerts = STORE.alerts.filter(function (x) { return x.src !== 'turbohive'; }).concat(thAlerts(d && d.list));
        STORE.alertTotal = (STORE.alertTotal || 0) + ((d && d.total) || 0);
      }).catch(function (e) { console.warn('alerts', e.message); }));

      jobs.push(API.th.trips({ page: 1, size: 100, startTime: now - 30 * 86400000, endTime: now }).then(function (d) {
        var list = (d && d.data) || [];
        STORE.trips = list.map(function (t) {
          return {
            uid: 'th:' + t.id, src: 'turbohive', id: t.id, imei: t.imei, name: t.deviceName,
            startTime: t.startTime, endTime: t.endTime, duration: t.duration,
            startLat: t.startLat, startLng: t.startLng, endLat: t.endLat, endLng: t.endLng,
            distance: t.distance, avgSpeed: t.avgSpeed, pointType: t.pointType, raw: t
          };
        });
        STORE.tripTotal = (d && d.total) || list.length;
      }).catch(function (e) { console.warn('trips', e.message); }));

      jobs.push(API.th.mileageRealtime({ page: 1, size: 100 }).then(function (d) {
        STORE.mileage = (d && d.data) || [];
      }).catch(function (e) { console.warn('mileage', e.message); }));

      jobs.push(API.th.mileageDaily({ page: 1, size: 30 }).then(function (d) {
        STORE.dailyMileage = (d && d.data) || [];
      }).catch(function (e) { console.warn('daily', e.message); }));

      jobs.push(API.th.geofences({ page: 1, size: 100 }).then(function (d) {
        STORE.geofences = ((d && d.data) || []).map(function (g) {
          return { uid: 'th:' + g.id, src: 'turbohive', id: g.id, name: g.name, fenceType: g.fenceType,
            centerLat: g.centerLat, centerLng: g.centerLng, radius: g.radius, vertices: g.vertices,
            color: g.color, enabled: g.enabled, devices: g.devices, createdAt: g.createdAt, updatedAt: g.updatedAt, raw: g };
        });
      }).catch(function (e) { console.warn('geofence', e.message); }));

      jobs.push(API.th.gateways({ page: 1, size: 100 }).then(function (d) {
        STORE.gateways = ((d && d.pageResult && d.pageResult.data) || []);
        STORE.gatewayStats = (d && d.stats) || {};
      }).catch(function (e) { console.warn('gateways', e.message); }));

      jobs.push(API.th.models().then(function (d) { STORE.models = d || []; }).catch(function () { }));
      jobs.push(API.th.vendors().then(function (d) { STORE.vendors = d || []; }).catch(function () { }));
      jobs.push(API.th.storage().then(function (d) { STORE.storage = d || {}; }).catch(function () { }));

      jobs.push(API.th.resources({ page: 1, size: 12 }).then(function (d) {
        STORE.resources = (d && d.data) || [];
        STORE.resourceTotal = (d && d.total) || 0;
      }).catch(function () { }));

      jobs.push(API.th.tokens({ page: 1, size: 12 }).then(function (d) {
        STORE.tokens = (d && d.data) || [];
      }).catch(function () { }));

      // 说明：/v3/command/history/page 的 CORS 预检返回 403，浏览器端无法直连。
      // 改为按需加载（用户切到「指令历史」标签页时再请求），避免启动期报错。
    }

    if (c.tsp.enabled && tspImeis.length) {
      jobs.push(API.tsp.alarms({ imeis: tspImeis.join(','), beginTime: begin, endTime: end, page: 1, size: 100 })
        .then(function (list) {
          STORE.alerts = STORE.alerts.filter(function (x) { return x.src !== 'tsp'; }).concat(tspAlarms(list));
        }).catch(function (e) { console.warn('tsp alarms', e.message); }));

      jobs.push(API.tsp.fences({ page: 1, size: 50 }).then(function (r) {
        var rows = (r && r.rows) || [];
        var f = rows.map(function (g) {
          var isCircle = g.fence_type === 'circle';
          var parts = String(g.coordinates || '').split(',');
          return {
            uid: 'tsp:' + g.fence_id, src: 'tsp', id: g.fence_id, name: g.fence_name,
            fenceType: isCircle ? 'CIRCLE' : 'POLYGON', color: g.fence_color || '#2AC2F3',
            centerLat: isCircle ? +parts[0] : null,
            centerLng: isCircle ? +parts[1] : null,
            radius: g.radius ? +g.radius : null,
            vertices: isCircle ? null : JSON.stringify(String(g.coordinates || '').split(';').map(function (p) {
              var a = p.split(','); return [+a[1], +a[0]];
            })),
            enabled: 1, devices: g.imeis ? String(g.imeis).split(',') : [],
            alertType: g.alert_type, raw: g
          };
        });
        STORE.geofences = STORE.geofences.concat(f);
      }).catch(function (e) { console.warn('tsp fence', e.message); }));
    }

    return Promise.allSettled(jobs);
  }

  /* ================= 侧栏状态 ================= */
  function updateSidebar() {
    var st = API.status();
    U.$$('.src-row').forEach(function (n) {
      var s = n.getAttribute('data-src');
      var enabled = s === 'th' ? w.CFG.turbohive.enabled : w.CFG.tsp.enabled;
      var v = enabled ? st[s === 'th' ? 'turbohive' : 'tsp'] : 'off';
      n.className = 'src-row ' + (v === 'ok' ? 'ok' : v === 'err' ? 'err' : v === 'load' ? 'load' : '');
      n.querySelector('b').textContent = !enabled ? '未启用' : v === 'ok' ? '已连接' : v === 'err' ? '异常' : v === 'load' ? '连接中' : '待连接';
    });
    var nd = U.$('#nb-devices'); if (nd) nd.textContent = STORE.devices.length || '';
    var na = U.$('#nb-alerts');
    if (na) {
      var c24 = STORE.alerts.filter(function (a) { return a.time && Date.now() - a.time < 86400000; }).length;
      na.textContent = c24 || '';
    }
  }

  /* ================= 路由 ================= */
  function goto(page, opts) {
    if (!w.PAGES[page]) page = 'overview';
    curPage = page;
    U.$$('.nav-item').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-page') === page); });
    U.$$('.page').forEach(function (p) { p.classList.toggle('on', p.id === 'page-' + page); });
    U.$('#pageTitle').textContent = w.PAGES[page].title;
    U.$('#pageDesc').textContent = w.PAGES[page].desc;
    U.$('#sidebar').classList.remove('on');
    var sbMaskEl = U.$('#sidebarMask'); if (sbMaskEl) sbMaskEl.classList.remove('on');
    if (opts && opts.lat && opts.lng) mapFocus = opts;
    var el = U.$('#page-' + page);
    try {
      w.PAGES[page].render(el);
    } catch (e) {
      console.error(e);
      el.innerHTML = '<div class="card">' + w.PAGES._ui.empty('页面渲染出错', e.message, 'i-warn') + '</div>';
    }
    if (page === 'map' && mapFocus) setTimeout(function () { focusMap(mapFocus); mapFocus = null; }, 320);
    if (page === 'console' && w.PAGES._consoleRefresh) w.PAGES._consoleRefresh();
    try { location.hash = '#/' + page; } catch (e) { }
  }

  function focusMap(key) {
    var M = w.PAGES._MAP;
    if (curPage !== 'map') { goto('map'); setTimeout(function () { focusMap(key); }, 380); return; }
    if (!M || !M.map) return;
    var d;
    if (typeof key === 'string') d = M.devs.filter(function (x) { return x.uid === key; })[0];
    else d = { lat: key.lat, lng: key.lng, name: key.label || '目标点', imei: '' };
    if (!d || !d.lat) return U.toast('该设备暂无定位数据', 'warn');
    M.map.setView([d.lat, d.lng], 15, { animate: true });
    var mk = M.markers[d.uid];
    if (mk) mk.openPopup();
    else w.L.popup().setLatLng([d.lat, d.lng]).setContent('<b>' + U.esc(d.name) + '</b>').openOn(M.map);
    U.$$('.map-dev').forEach(function (n) { n.classList.toggle('on', n.getAttribute('data-uid') === d.uid); });
  }

  /* ================= 详情抽屉 ================= */
  function openDevice(uid) {
    var d = STORE.devices.filter(function (x) { return x.uid === uid; })[0];
    if (!d) return;
    var r = d.raw || {};
    var common = {
      '平台': d.src === 'turbohive' ? 'TurboHive IoT Hub' : 'TrackSolidPro Open API',
      '设备名称': d.name, 'IMEI': d.imei, '型号': d.model, '设备类型': d.deviceType,
      '通信协议': d.protocol,
      '在线状态': d.online === 1 ? '在线' : d.online === 2 ? '离线' : '未激活',
      '速度': d.speed !== null && d.speed !== undefined ? d.speed + ' km/h' : null,
      'ACC': d.acc === 1 ? 'ON' : d.acc === 0 ? 'OFF' : null,
      '方向': d.course, '卫星数': d.sats,
      '纬度': d.lat, '经度': d.lng,
      '定位时间': U.dt(d.lastTime)
    };
    var extra = {};
    if (d.src === 'turbohive') {
      extra = { '设备ID': r.id, '厂商': r.manufacturer, '网关': r.gatewayName,
        '导入时间': U.dt(r.importTime), '备注': r.remark, '含TAG': r.hasTag ? '是' : '否',
        '状态': r.status === 1 ? '有效' : '无效' };
    } else {
      extra = { '设备组': r.deviceGroup, '过期时间': r.expiration, '激活时间': r.activationTime,
        '定位方式': d.posType, '心跳时间': d.hbTime, 'GPS时间': d.gpsTime,
        '累计里程': d.mileage ? d.mileage.toFixed(2) + ' km' : null,
        '客户': r.customerName };
    }
    var html =
      '<div class="kv" style="margin-bottom:16px">' +
        '<div class="it"><b style="color:' + (d.online === 1 ? CH.colors.ok : CH.colors.err) + '">' +
          (d.online === 1 ? '在线' : d.online === 2 ? '离线' : '未激活') + '</b><small>在线状态</small></div>' +
        '<div class="it"><b>' + (d.speed || 0) + '</b><small>速度 km/h</small></div>' +
        '<div class="it"><b>' + (d.sats !== null && d.sats !== undefined ? d.sats : '—') + '</b><small>卫星数</small></div>' +
        '<div class="it"><b>' + (d.acc === 1 ? 'ON' : 'OFF') + '</b><small>ACC 状态</small></div>' +
      '</div>' +
      U.kvList(common) +
      '<h4 style="margin:18px 0 10px;font-size:12px;color:var(--tx-3);letter-spacing:.6px">平台原始字段</h4>' +
      U.kvList(extra) +
      '<h4 style="margin:18px 0 10px;font-size:12px;color:var(--tx-3);letter-spacing:.6px">原始响应</h4>' +
      '<div class="code" style="max-height:260px">' + U.highlight(r) + '</div>' +
      '<div style="display:flex;gap:9px;margin-top:14px;flex-wrap:wrap">' +
        (d.lat ? '<button class="btn primary" id="dvGoMap">' + U.icon('i-map') + '在地图查看</button>' : '') +
        (d.src === 'turbohive' ? '<button class="btn ghost" id="dvCmd">' + U.icon('i-bolt') + '查看指令历史</button>' : '') +
        (d.src === 'tsp' ? '<button class="btn ghost" id="dvIns">' + U.icon('i-code') + '查询支持指令</button>' : '') +
      '</div>';
    U.Drawer.open(d.name || d.imei, html);

    var gm = U.$('#dvGoMap');
    if (gm) gm.addEventListener('click', function () { U.Drawer.close(); focusMap(d.uid); });
    var dc = U.$('#dvCmd');
    if (dc) dc.addEventListener('click', function () {
      U.$('#drawerBody').innerHTML = '<div class="loading-row"><span class="spin"></span>加载指令历史…</div>';
      API.th.cmdHistory({ page: 1, size: 20, imei: d.imei }).then(function (r2) {
        var list = (r2 && r2.list) || [];
        U.$('#drawerBody').innerHTML = list.length ? '<div class="tw"><table><thead><tr><th>指令</th><th>状态</th><th>下发</th><th>响应</th></tr></thead><tbody>' +
          list.map(function (c) {
            return '<tr><td class="mono strong">' + U.esc(c.content) + '</td><td>' +
              (c.status >= 2 ? '<span class="tag on"><i></i>已响应</span>' : '<span class="tag idle"><i></i>待响应</span>') +
              '</td><td>' + U.dt(c.sentAt) + '</td><td>' + U.dt(c.responseAt) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : w.PAGES._ui.empty('暂无指令记录', '', 'i-code');
      }).catch(function (e) {
        U.$('#drawerBody').innerHTML = w.PAGES._ui.empty('无法加载指令历史',
          'TurboHive 的 /v3/command/history/page 未开放 CORS 预检（OPTIONS 403），浏览器端无法直连，需服务端代理。' +
          '错误：' + e.message, 'i-warn');
      });
    });
    var di = U.$('#dvIns');
    if (di) di.addEventListener('click', function () {
      U.$('#drawerBody').innerHTML = '<div class="loading-row"><span class="spin"></span>查询设备支持指令…</div>';
      API.tsp.instructions(d.imei).then(function (list) {
        U.$('#drawerBody').innerHTML = (list && list.length) ? '<div class="mlist">' + list.map(function (i) {
          return '<div class="mrow"><div class="ic" style="background:' + CH.colors.blue + '22">' +
            '<svg class="ico" style="fill:' + CH.colors.blue + '"><use href="#i-code"/></svg></div>' +
            '<div class="tx"><b>' + U.esc(i.orderName) + '</b><small>' + U.esc(i.orderExplain || i.orderContent || '') + '</small></div>' +
            '<div class="rt">' + (i.isOffLine === '1' ? '<span class="tag idle"><i></i>离线可发</span>' : '<span class="tag none"><i></i>在线</span>') + '</div></div>';
        }).join('') + '</div>' : w.PAGES._ui.empty('该设备无可用指令', '', 'i-code');
      }).catch(function (e) { U.$('#drawerBody').innerHTML = w.PAGES._ui.empty('查询失败', e.message, 'i-warn'); });
    });
  }

  function openAlert(uid) {
    var a = STORE.alerts.filter(function (x) { return x.uid === uid; })[0];
    if (!a) return;
    var lc = a.level === 'high' ? CH.colors.err : a.level === 'mid' ? CH.colors.warn : CH.colors.blue;
    U.Drawer.open('告警详情', 
      '<div class="kv" style="margin-bottom:16px">' +
        '<div class="it"><b style="color:' + lc + '">' + (a.level === 'high' ? '高危' : a.level === 'mid' ? '中危' : '提示') + '</b><small>告警等级</small></div>' +
        '<div class="it"><b style="font-size:12.5px">' + U.esc(a.name) + '</b><small>告警名称</small></div>' +
        '<div class="it"><b style="font-size:12.5px">' + U.ago(a.time) + '</b><small>发生时间</small></div>' +
      '</div>' +
      U.kvList({
        '平台': a.src === 'turbohive' ? 'TurboHive IoT Hub' : 'TrackSolidPro Open API',
        '告警名称': a.name, '告警类型': a.type, '告警代码': a.code,
        'IMEI': a.imei, '描述': a.desc, '发生时间': U.dt(a.time),
        '纬度': a.lat, '经度': a.lng
      }) +
      '<h4 style="margin:18px 0 10px;font-size:12px;color:var(--tx-3);letter-spacing:.6px">原始响应</h4>' +
      '<div class="code" style="max-height:280px">' + U.highlight(a.raw) + '</div>' +
      (a.lat ? '<button class="btn primary mt" id="alGoMap">' + U.icon('i-map') + '在地图查看位置</button>' : ''));
    var b = U.$('#alGoMap');
    if (b) b.addEventListener('click', function () { U.Drawer.close(); goto('map', { lat: a.lat, lng: a.lng, label: a.name }); });
  }

  function openTrip(uid) {
    var t = STORE.trips.filter(function (x) { return x.uid === uid; })[0];
    if (!t) return;
    U.Drawer.open('行程详情', 
      '<div class="kv" style="margin-bottom:16px">' +
        '<div class="it"><b>' + U.dist(t.distance) + '</b><small>行驶距离</small></div>' +
        '<div class="it"><b>' + U.dur(t.duration) + '</b><small>行驶时长</small></div>' +
        '<div class="it"><b>' + (t.avgSpeed ? t.avgSpeed.toFixed(1) : 0) + '</b><small>平均速度 km/h</small></div>' +
      '</div>' +
      U.kvList({ '设备': t.name, 'IMEI': t.imei, '开始时间': U.dt(t.startTime), '结束时间': U.dt(t.endTime),
        '起点': t.startLat + ', ' + t.startLng, '终点': t.endLat + ', ' + t.endLng }) +
      '<div class="mt" style="height:300px;border-radius:12px;overflow:hidden"><div id="tripMini" style="height:100%"></div></div>');
    setTimeout(function () {
      if (!w.L) return;
      var m = w.L.map('tripMini', { zoomControl: false, attributionControl: false });
      var tm = w.CONFIG.TILES[w.CFG.app.mapTile] || w.CONFIG.TILES.carto;
      w.L.tileLayer(tm.url, { subdomains: tm.sub || 'abc' }).addTo(m);
      var a = [t.startLat, t.startLng], b = [t.endLat, t.endLng];
      w.L.polyline([a, b], { color: CH.colors.orange, weight: 3, dashArray: '6 6' }).addTo(m);
      w.L.circleMarker(a, { radius: 6, color: CH.colors.ok, fillColor: CH.colors.ok, fillOpacity: 1 }).bindPopup('起点').addTo(m);
      w.L.circleMarker(b, { radius: 6, color: CH.colors.err, fillColor: CH.colors.err, fillOpacity: 1 }).bindPopup('终点').addTo(m);
      m.fitBounds(w.L.latLngBounds([a, b]).pad(0.3));
      setTimeout(function () { m.invalidateSize(); }, 120);
    }, 80);
  }

  function reloadTrips(days) {
    var now = Date.now();
    return API.th.trips({ page: 1, size: 80, startTime: now - days * 86400000, endTime: now })
      .then(function (d) {
        var list = (d && d.data) || [];
        STORE.trips = list.map(function (t) {
          return { uid: 'th:' + t.id, src: 'turbohive', id: t.id, imei: t.imei, name: t.deviceName,
            startTime: t.startTime, endTime: t.endTime, duration: t.duration,
            startLat: t.startLat, startLng: t.startLng, endLat: t.endLat, endLng: t.endLng,
            distance: t.distance, avgSpeed: t.avgSpeed, raw: t };
        });
        STORE.tripTotal = (d && d.total) || list.length;
        U.toast('行程数据已更新（近 ' + days + ' 天）', 'ok');
      }).catch(function (e) { U.toast('行程加载失败：' + e.message, 'err'); });
  }

  /* ================= 自动刷新 ================= */
  function setLive(on) {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    var pill = U.$('#livePill');
    if (on && w.CFG.app.autoRefresh) {
      liveTimer = setInterval(function () { refresh(true); }, Math.max(15, w.CFG.app.refreshSec) * 1000);
      pill.classList.remove('off'); U.$('#liveText').textContent = '实时 ' + w.CFG.app.refreshSec + 's';
    } else {
      pill.classList.add('off'); U.$('#liveText').textContent = '已暂停';
    }
  }

  function refresh(silent) {
    if (!silent) U.toast('正在刷新数据…', 'info', 1600);
    var btn = U.$('#refreshBtn');
    if (btn) btn.disabled = true;
    return boot(true, true).then(function () {
      if (btn) btn.disabled = false;
      if (!silent) U.toast('数据已刷新', 'ok');
      if (curPage !== 'settings') goto(curPage);
    });
  }

  /* ================= 初始化 ================= */
  function init() {
    // 导航
    U.$$('.nav-item').forEach(function (n) {
      n.addEventListener('click', function () { goto(n.getAttribute('data-page')); });
    });
    U.$('#refreshBtn').addEventListener('click', function () { refresh(false); });
    U.$('#livePill').addEventListener('click', function () {
      w.CFG.app.autoRefresh = !w.CFG.app.autoRefresh; w.CONFIG.save(); setLive(w.CFG.app.autoRefresh);
      U.toast(w.CFG.app.autoRefresh ? '已开启自动刷新' : '已暂停自动刷新', 'info');
    });
    function toggleSidebar(open) {
      var sb = U.$('#sidebar'), mask = U.$('#sidebarMask');
      var next = typeof open === 'boolean' ? open : !sb.classList.contains('on');
      sb.classList.toggle('on', next);
      if (mask) mask.classList.toggle('on', next);
    }
    U.$('#menuBtn').addEventListener('click', function () { toggleSidebar(); });
    var sbMask = U.$('#sidebarMask');
    if (sbMask) sbMask.addEventListener('click', function () { toggleSidebar(false); });
    U.$('#drawerClose').addEventListener('click', function () { U.Drawer.close(); });
    U.$('#drawerMask').addEventListener('click', function () { U.Drawer.close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { U.Drawer.close(); toggleSidebar(false); } });

    // 时间范围切换（影响刷新间隔）
    U.$$('#rangeSeg button').forEach(function (b) {
      b.addEventListener('click', function () {
        U.$$('#rangeSeg button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        U.toast('时间范围：' + b.textContent, 'info', 1800);
      });
    });

    // 状态变化 → 更新侧栏
    API.onStatus(function () { updateSidebar(); });

    // 路由 hash
    var h = (location.hash || '').replace('#/', '');
    var startPage = w.PAGES[h] ? h : 'overview';

    boot(false).then(function () {
      goto(startPage);
      setLive(true);
      if (!w.CFG.turbohive.enabled && !w.CFG.tsp.enabled) {
        U.toast('尚未启用任何数据源，请前往「接入设置」配置', 'warn', 6000);
      }
    });
  }

  w.APP = {
    init: init, boot: boot, goto: goto, refresh: refresh, setLive: setLive,
    openDevice: openDevice, openAlert: openAlert, openTrip: openTrip,
    focusMap: focusMap, reloadTrips: reloadTrips, STORE: STORE
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
