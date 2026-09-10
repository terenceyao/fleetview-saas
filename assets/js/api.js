/* ============================================================
   api.js — 双平台 API 客户端
   1) TurboHive IoT Hub  : REST + Bearer JWT  (/v3/*)
   2) TrackSolidPro (TSP): POST form + MD5 签名 (method=jimi.*)
   ============================================================ */
(function (w) {
  'use strict';
  var U = w.U;

  /* ================= 通用状态 ================= */
  var STATUS = { turbohive: 'idle', tsp: 'idle' };   // idle|load|ok|err
  var LASTERR = { turbohive: '', tsp: '' };
  var listeners = [];
  function onStatus(fn) { listeners.push(fn); }
  function setStatus(src, st, err) {
    STATUS[src] = st; LASTERR[src] = err || '';
    listeners.forEach(function (f) { try { f(src, st, err); } catch (e) { } });
  }

  /* ================= HTTP 基础 ================= */
  function timeoutFetch(url, opts, ms) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, ms || 30000);
    opts = opts || {};
    opts.signal = ctl.signal;
    return fetch(url, opts).then(function (r) {
      clearTimeout(t);
      return r.text().then(function (txt) {
        var json = null;
        try { json = JSON.parse(txt); } catch (e) { }
        return { ok: r.ok, status: r.status, text: txt, json: json };
      });
    }, function (e) {
      clearTimeout(t);
      throw e;
    });
  }

  /* ============================================================
     一、TurboHive IoT Hub
     ============================================================ */
  var TH = (function () {
    var token = null, tokenExp = 0, loginPromise = null;

    /** TurboHive 分页 size 上限为 100，超出会返回 code 1204 */
    function sz(v, def) {
      var n = parseInt(v, 10);
      if (!n || n < 1) n = def || 15;
      return Math.min(n, 100);
    }

    function cfg() { return w.CFG.turbohive; }
    function base() { return (cfg().baseUrl || '').replace(/\/+$/, ''); }

    /** 用账号密码登录换取 JWT */
    function login() {
      if (loginPromise) return loginPromise;
      var c = cfg();
      loginPromise = timeoutFetch(base() + '/v3/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: c.email, password: c.password })
      }, 25000).then(function (r) {
        loginPromise = null;
        if (!r.json) throw new Error('登录响应解析失败 (HTTP ' + r.status + ')');
        if (r.json.code !== 1000) throw new Error(r.json.message || ('登录失败 code=' + r.json.code));
        var d = r.json.data || {};
        token = d.accessToken;
        tokenExp = Date.now() + ((d.expiresIn || 86400) * 1000) - 120000;
        if (token) { c.token = token; w.CONFIG.save(); }
        return token;
      }, function (e) {
        loginPromise = null;
        throw new Error('无法连接 TurboHive：' + (e.name === 'AbortError' ? '请求超时' : e.message));
      });
      return loginPromise;
    }

    function ensureToken(force) {
      var c = cfg();
      if (c.token && !force && (!token || token !== c.token)) { token = c.token; tokenExp = Date.now() + 3600000; }
      if (token && Date.now() < tokenExp) return Promise.resolve(token);
      if (c.token && !force) { token = c.token; tokenExp = Date.now() + 3600000; return Promise.resolve(token); }
      return login();
    }

    /**
     * 发起 TurboHive 请求
     * @returns Promise<any>  data 字段
     */
    function req(method, path, opt) {
      opt = opt || {};
      var qs = '';
      if (opt.query) {
        var parts = [];
        Object.keys(opt.query).forEach(function (k) {
          var v = opt.query[k];
          if (v === null || v === undefined || v === '') return;
          if (Array.isArray(v)) v.forEach(function (x) { parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)); });
          else parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
        });
        if (parts.length) qs = '?' + parts.join('&');
      }
      var url = base() + path + qs;
      setStatus('turbohive', 'load');
      return ensureToken().then(function (tk) {
        var headers = { 'Accept': 'application/json' };
        if (tk) headers['Authorization'] = 'Bearer ' + tk;
        var opts = { method: method, headers: headers };
        if (opt.body !== undefined) {
          headers['Content-Type'] = 'application/json';
          opts.body = JSON.stringify(opt.body);
        }
        return timeoutFetch(url, opts, opt.timeout || 30000);
      }).then(function (r) {
        if (!r.json) {
          if (r.status === 401 || r.status === 403) throw new Error('TurboHive 鉴权失败 (HTTP ' + r.status + ')');
          throw new Error('TurboHive 返回非 JSON (HTTP ' + r.status + ')');
        }
        // Token 失效 → 用账号密码重登一次
        if (r.json.code === 1101 && !opt._retried) {
          return ensureToken(true).then(function () {
            opt._retried = true; return req(method, path, opt);
          });
        }
        if (r.json.code !== 1000) {
          var err = new Error(r.json.message || ('TurboHive 错误 code=' + r.json.code));
          err.code = r.json.code; err.raw = r.json;
          throw err;
        }
        setStatus('turbohive', 'ok');
        return r.json.data;
      }, function (e) {
        var msg = e.name === 'AbortError' ? '请求超时' : (e.message || '网络错误');
        setStatus('turbohive', 'err', msg);
        throw new Error('TurboHive: ' + msg);
      });
    }

    /* ---- 业务封装 ---- */
    return {
      raw: req,
      status: function () { return STATUS.turbohive; },
      login: login,
      probe: function () { return req('GET', '/v3/devices/page', { query: { page: 1, size: 1 } }); },

      devices: function (p) {
        p = p || {};
        return req('GET', '/v3/devices/page', {
          query: { page: p.page || 1, size: sz(p.size, 15), keyword: p.keyword, deviceType: p.deviceType,
            manufacturer: p.manufacturer, model: p.model, protocol: p.protocol,
            importTimeStart: p.importTimeStart, importTimeEnd: p.importTimeEnd }
        });
      },
      device: function (id) { return req('GET', '/v3/devices/' + id); },
      deviceStatus: function (imeis) { return req('POST', '/v3/devices/status/bulk', { body: { imeis: imeis, targetType: 1 } }); },
      deviceChannel: function (imei) { return req('GET', '/v3/devices/channel/' + encodeURIComponent(imei)); },

      locations: function (imeis) {
        var body = (imeis && imeis.length) ? { type: 1, imeis: imeis } : { type: 0 };
        return req('POST', '/v3/track/location', { body: body });
      },
      trackPage: function (p) { return req('GET', '/v3/track', { query: p }); },
      trackList: function (p) { return req('GET', '/v3/track/list', { query: p }); },

      alerts: function (p) {
        p = p || {};
        return req('GET', '/v3/alerts/page', {
          query: { page: p.page || 1, size: sz(p.size, 15), alertType: p.alertType,
            alertCode: p.alertCode, startTime: p.startTime, endTime: p.endTime, imeis: p.imeis }
        });
      },
      alert: function (id) { return req('GET', '/v3/alerts/' + id); },
      alertVideo: function (id) { return req('GET', '/v3/alerts/video/fetch', { query: { id: id } }); },

      trips: function (p) {
        p = p || {};
        return req('POST', '/v3/trip/page', { body: {
          page: p.page || 1, size: sz(p.size, 15), imeis: p.imeis,
          startTime: p.startTime, endTime: p.endTime } });
      },
      tripList: function (p) { return req('GET', '/v3/trip/list', { query: p }); },
      tripSummary: function (p) { return req('POST', '/v3/trip/summary', { body: p }); },

      mileageRealtime: function (p) { return req('GET', '/v3/mileage/realtime', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 15), keyword: p && p.keyword } }); },
      mileageDaily: function (p) { return req('GET', '/v3/mileage/daily', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 10) } }); },
      mileageDevices: function (p) { return req('GET', '/v3/mileage/devices', { query: p }); },

      geofences: function (p) { return req('GET', '/v3/geofences/page', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 20) } }); },
      geofence: function (id) { return req('GET', '/v3/geofences/' + id); },
      geofenceByDevice: function (imei) { return req('GET', '/v3/geofences/device/' + encodeURIComponent(imei)); },

      gateways: function (p) { return req('GET', '/v3/gateways/page', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 20) } }); },
      gatewayList: function () { return req('GET', '/v3/gateways/list'); },
      models: function () { return req('GET', '/v3/models'); },
      vendors: function () { return req('GET', '/v3/vendors'); },

      resources: function (p) { return req('GET', '/v3/resource/page', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 12), imei: p && p.imei, mediaType: p && p.mediaType } }); },
      storage: function () { return req('GET', '/v3/resource/storage/usage'); },

      obd: function (p) { return req('GET', '/v3/obd', { query: p }); },

      tokens: function (p) { return req('GET', '/v3/tokens/page', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 10) } }); },
      // 注意：/v3/command/history/page 的 CORS 预检返回 403，浏览器无法直接调用，
      // 故仅在用户主动请求时尝试，并在失败时给出明确提示。
      cmdHistory: function (p) { return req('GET', '/v3/command/history/page', { query: { page: (p && p.page) || 1, size: sz(p && p.size, 15), imei: p && p.imei } }); },
      cmdSend: function (body) { return req('POST', '/v3/command/send', { body: body }); },
      reverseGeo: function (lat, lng) { return req('POST', '/v3/geocoding/reverse', { body: { lat: lat, lng: lng } }); }
    };
  })();

  /* ============================================================
     二、TrackSolidPro (TSP) Open API
     ============================================================ */
  var TSP = (function () {
    var token = null, tokenExp = 0;
    var queue = Promise.resolve(), lastCall = 0;
    var MIN_GAP = 1600;                // 限流：TSP 网关对请求频率敏感（1006 / 连接被拒），最小间隔 1.6s
    var LOG = [];                      // 最近请求日志（API 控制台用）

    function cfg() { return w.CFG.tsp; }

    /** TSP 签名：按 key 升序拼接 → 首尾包裹 appSecret → MD5 大写 */
    function sign(params) {
      var secret = cfg().appSecret || '';
      var keys = Object.keys(params).filter(function (k) {
        return k !== 'sign' && params[k] !== null && params[k] !== undefined && params[k] !== '';
      }).sort();
      var s = keys.map(function (k) { return k + params[k]; }).join('');
      return U.md5(secret + s + secret).toUpperCase();
    }

    function common() {
      return {
        app_key: cfg().appKey,
        format: 'json',
        sign_method: 'md5',
        timestamp: U.utcStr(),
        v: '1.0'
      };
    }

    function post(params) {
      var body = Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&');
      // 注意：Content-Type 不能带 charset 参数，否则浏览器会发起 CORS 预检，
      // 而 TSP 的 OPTIONS 响应不含 CORS 头，预检会失败。
      return timeoutFetch(cfg().baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }, 35000);
    }

    /** 串行 + 限流的请求执行器：所有 TSP 请求（含取 token）都排入同一队列 */
    function schedule(fn) {
      var run = queue.then(function () {
        var gap = Date.now() - lastCall;
        var wait = gap < MIN_GAP ? (MIN_GAP - gap) : 0;
        return U.sleep(wait).then(function () { lastCall = Date.now(); return fn(); });
      });
      queue = run.then(function () { }, function () { });   // 单个失败不阻断队列
      return run;
    }

    function isAuthError(msg) {
      return /1004|token|未授权|非法访问.*token/i.test(msg || '');
    }

    var tokenPromise = null;

    /**
     * 取 access_token（缓存，提前 5 分钟过期）
     * ⚠️ 必须独立于业务请求排队：业务请求在 schedule 内调用它会形成队列自等待死锁，
     *    因此 call() 先 await getToken()，再 schedule 业务请求。
     */
    function getToken(force) {
      if (!force && token && Date.now() < tokenExp) return Promise.resolve(token);
      if (tokenPromise) return tokenPromise;
      tokenPromise = schedule(function () {
        if (!force && token && Date.now() < tokenExp) return token;   // 并发去重
        var c = cfg();
        var params = common();
        params.method = 'jimi.oauth.token.get';
        params.user_id = c.userId;
        params.user_pwd_md5 = c.userPwdMd5;
        params.expires_in = '7200';
        params.sign = sign(params);
        return post(params).then(function (r) {
          if (!r.json) throw new Error('TSP 令牌响应解析失败 (HTTP ' + r.status + ')');
          if (r.json.code !== 0) throw new Error(r.json.message || ('TSP 令牌获取失败 code=' + r.json.code));
          var d = r.json.result || {};
          token = d.accessToken;
          tokenExp = Date.now() + ((d.expiresIn || 7200) * 1000) - 300000;
          return token;
        });
      }).then(function (t) { tokenPromise = null; return t; },
             function (e) { tokenPromise = null; throw e; });
      return tokenPromise;
    }

    /**
     * 调用 TSP 业务接口（自动限流 + 1006/1004 退避重试）
     */
    function call(method, priv, attempt) {
      attempt = attempt || 0;
      setStatus('tsp', 'load');
      return getToken().then(function (tk) {          // ① 先取 token（自身排队，避免嵌套死锁）
        return schedule(function () {                 // ② 再排业务请求
          var p = common();
          p.access_token = tk;                        // 快照当前 token
          p.method = method;
          if (priv) Object.keys(priv).forEach(function (k) {
            if (priv[k] !== null && priv[k] !== undefined && priv[k] !== '') p[k] = priv[k];
          });
          p.sign = sign(p);
          var t0 = Date.now();
          return post(p).then(function (r) {
            var entry = {
              time: Date.now(), method: method, params: priv || {}, ms: Date.now() - t0,
              code: r.json ? r.json.code : -1, ok: !!(r.json && r.json.code === 0),
              message: r.json ? r.json.message : ('HTTP ' + r.status), response: r.json
            };
            LOG.unshift(entry); if (LOG.length > 60) LOG.pop();
            if (!r.json) throw new Error('TSP 返回非 JSON (HTTP ' + r.status + ')');
            if (r.json.code !== 0) {
              var e = new Error(r.json.message || ('TSP 错误 code=' + r.json.code));
              e.code = r.json.code; e.raw = r.json;
              throw e;
            }
            setStatus('tsp', 'ok');
            return r.json.result !== undefined ? r.json.result : r.json.data;
          }, function (netErr) {
            var e2 = new Error(netErr.name === 'AbortError' ? 'TSP 请求超时' :
              'TSP 请求被拦截（4xx 响应缺少 CORS 头或网络异常）');
            e2.network = true;
            throw e2;
          });
        });
      }).then(null, function (e) {
        var retryable = (e.code === 1006) || (e.network === true) || isAuthError(e.message);
        if (retryable && attempt < 4) {
          var backoff = (e.code === 1006 ? 1600 : 900) * (attempt + 1);
          if (isAuthError(e.message)) { token = null; tokenExp = 0; }
          return U.sleep(backoff).then(function () { return call(method, priv, attempt + 1); });
        }
        if (STATUS.tsp !== 'ok') setStatus('tsp', 'err', e.message);
        throw e;
      });
    }

    return {
      call: call,
      sign: sign,
      status: function () { return STATUS.tsp; },
      log: function () { return LOG; },
      clearLog: function () { LOG = []; },
      setGap: function (ms) { MIN_GAP = Math.max(300, ms | 0); },
      getGap: function () { return MIN_GAP; },
      probe: function () { return call('jimi.user.device.list', { target: cfg().userId }); },
      refreshToken: function () { token = null; tokenExp = 0; return getToken(true); },

      /* ---- 业务封装 ---- */
      deviceList: function (target) { return call('jimi.user.device.list', { target: target || cfg().userId }); },
      deviceDetail: function (imei) { return call('jimi.track.device.detail', { imei: imei }); },
      deviceGroups: function (account) { return call('jimi.device.group.list', { account: account || cfg().userId }); },
      locations: function (target) { return call('jimi.user.device.location.list', { target: target || cfg().userId }); },
      locationByImei: function (imeis) { return call('jimi.device.location.get', { imeis: imeis }); },
      track: function (imei, begin, end) { return call('jimi.device.track.list', { imei: imei, begin_time: begin, end_time: end }); },
      trackMileage: function (imeis, begin, end) { return call('jimi.device.track.mileage', { imeis: imeis, begin_time: begin, end_time: end }); },
      alarms: function (p) {
        p = p || {};
        return call('jimi.device.alarm.list', {
          imeis: p.imeis, imei: p.imei, alertTypeId: p.alertTypeId,
          begin_time: p.beginTime, end_time: p.endTime,
          page_no: p.page || 1, page_size: p.size || 20
        });
      },
      tripsReport: function (p) {
        p = p || {};
        return call('jimi.open.platform.report.trips', {
          account: p.account || cfg().userId, imeis: p.imeis, type: p.type || 'list',
          start_time: p.startTime, end_time: p.endTime,
          start_row: p.startRow || 0, page_size: p.size || 20
        });
      },
      obd: function (p) { return call('jimi.device.obd.list', { imeis: p.imeis, start_time: p.startTime, end_time: p.endTime }); },
      obdFault: function (p) { return call('jimi.device.obd.fault', { imeis: p.imeis, start_time: p.startTime, end_time: p.endTime }); },
      fences: function (p) { return call('jimi.open.platform.fence.list', { account: (p && p.account) || cfg().userId, page_no: (p && p.page) || 1, page_size: (p && p.size) || 20 }); },
      fenceDuration: function (p) { return call('jimi.open.platform.fence.duration', p); },
      instructions: function (imei) { return call('jimi.open.instruction.list', { imei: imei }); },
      parking: function (p) { return call('jimi.open.platform.report.parking', p); },
      health: function (imeis) { return call('jimi.device.health.data', { imeis: imeis }); },
      mediaEvent: function (p) { return call('jimi.device.media.event.URL', p); },
      livePageUrl: function (imei, type) { return call('jimi.device.live.page.url', { imei: imei, type: type || '1' }); },
      childList: function () { return call('jimi.user.child.list', {}); }
    };
  })();

  w.API = {
    th: TH, tsp: TSP,
    status: function () { return STATUS; },
    errors: function () { return LASTERR; },
    onStatus: onStatus
  };
})(window);
