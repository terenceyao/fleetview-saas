/* ============================================================
   config.js — 平台接入配置与本地持久化
   ------------------------------------------------------------
   ⚠️ 安全提示：本 Demo 为纯前端应用，凭据保存在浏览器
   localStorage 中，请勿在公开仓库中提交真实生产密钥。
   ============================================================ */
(function (w) {
  'use strict';

  var LS_KEY = 'fleetview.cfg.v1';

  /* ---------- 默认配置（演示凭据） ---------- */
  var DEFAULTS = {
    turbohive: {
      enabled: true,
      baseUrl: 'https://www.turbohive.ai',
      email: 'demo@turbohive.ai',
      password: '123456',
      // 可直接粘贴 Token 免登录；留空则用账号密码登录换取
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyVHlwZSI6ImNsaWVudCIsInVzZXJJZCI6MTAwMjgsImVtYWlsIjoiZGVtb0B0dXJib2hpdmUuYWkiLCJzdWIiOiJkZW1vQHR1cmJvaGl2ZS5haSIsImlhdCI6MTc4OTAwNjI3MCwiZXhwIjoxNzk2NzgyMjcwfQ.biKdipOEtsfj7d87Bn_sVhoDU1BEexjEz47R9k1XKpQ'
    },
    tsp: {
      enabled: true,
      baseUrl: 'https://hk-open.tracksolidpro.com/route/rest',
      appKey: '8FB345B8693CCD003C15E3A5E1128C48',
      appSecret: '9865ea9a08444a2c8b7b5e6b2601ad1d',
      userId: 'TS-test01',
      userPwdMd5: '47ec2dd791e31e2ef2076caf64ed9b3d'
    },
    app: {
      autoRefresh: true,
      refreshSec: 60,
      mapTile: 'arcgisDark',
      defaultCenter: [22.5766, 113.9431],
      defaultZoom: 11,
      pageSize: 15
    }
  };

  /* ---------- 深拷贝 ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 合并（保存的结构覆盖默认值） ---------- */
  function merge(base, over) {
    var out = clone(base);
    if (!over || typeof over !== 'object') return out;
    Object.keys(over).forEach(function (k) {
      var bv = base[k], ov = over[k];
      if (bv && ov && typeof bv === 'object' && !Array.isArray(bv) &&
          typeof ov === 'object' && !Array.isArray(ov)) {
        out[k] = merge(bv, ov);
      } else if (ov !== undefined && ov !== null) {
        out[k] = ov;
      }
    });
    return out;
  }

  var CFG = merge(DEFAULTS, (function () {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); }
    catch (e) { return null; }
  })());

  /* ---------- 保存 ---------- */
  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(CFG)); }
    catch (e) { console.warn('配置保存失败', e); }
  }

  function reset() {
    CFG = clone(DEFAULTS);
    save();
    return CFG;
  }

  /* ---------- 地图底图（均为 Web Mercator / WGS84，避免 GCJ-02 偏移） ---------- */
  var TILES = {
    arcgisDark: {
      name: 'ArcGIS 深色',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      attr: 'Tiles &copy; Esri', sub: '', max: 16
    },
    arcgisSat: {
      name: 'ArcGIS 卫星影像',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attr: 'Tiles &copy; Esri', sub: '', max: 19
    },
    osm: {
      name: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attr: '&copy; OpenStreetMap contributors', sub: '', max: 19
    },
    carto: {
      name: 'Carto 深色',
      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      attr: '&copy; OpenStreetMap &copy; CARTO', sub: 'abcd', max: 20
    }
  };

  w.CFG = CFG;
  w.CONFIG = { DEFAULTS: DEFAULTS, TILES: TILES, save: save, reset: reset,
    reload: function () { CFG = merge(DEFAULTS, JSON.parse(localStorage.getItem(LS_KEY) || 'null')); w.CFG = CFG; return CFG; } };

})(window);
