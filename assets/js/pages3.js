/* ============================================================
   pages3.js — 实时视频 / OBD 数据分析 / ADAS·DMS 智能筛选
   ============================================================ */
(function (w) {
  'use strict';
  var U = w.U, CH = w.CHART, API = w.API;
  var UI = null;
  function ready() { if (!UI) UI = w.PAGES._ui; return UI; }
  var T = (w.I18N && w.I18N.t) ? w.I18N.t : function (s) { return s; };

  function timeLabels(times) {
    return times.map(function (t) {
      var d = new Date(t);
      return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
    });
  }
  function seriesOf(rows, key, scale) {
    return rows.map(function (r) {
      var v = r[key];
      if (v === null || v === undefined || isNaN(v)) return null;
      if (scale) return +(v * scale).toFixed(2);
      return v;
    });
  }
  function sanitizeCoord(lat, lng) {
    var a = Number(lat), b = Number(lng);
    return isFinite(a) && isFinite(b) && a >= -90 && a <= 90 && b >= -180 && b <= 180 && !(a === 0 && b === 0);
  }

  /* ============================================================
     11) 实时视频
     ============================================================ */
  var vid = { imei: '', channel: 1, dataType: 'audio_video', streamType: 'main_stream', range: 7, files: [], selected: {}, player: null, hls: null, mode: null };

  function dashcams() {
    return (w.STORE.devices || []).filter(function (d) {
      return d.src === 'turbohive' && /dashcam|record/i.test(d.deviceType || '');
    });
  }

  function destroyPlayer() {
    try { if (vid.player) { vid.player.pause(); vid.player.unload && vid.player.unload(); vid.player.detachMediaElement && vid.player.detachMediaElement(); vid.player.destroy && vid.player.destroy(); } } catch (e) { }
    try { if (vid.hls) { vid.hls.destroy(); } } catch (e) { }
    vid.player = null; vid.hls = null;
    var v = document.getElementById('vPlayer');
    if (v) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { } }
  }

  function playStream(urls) {
    destroyPlayer();
    var v = document.getElementById('vPlayer');
    var cover = document.getElementById('vCover');
    if (!v) return;
    if (cover) cover.style.display = 'none';
    var flvOk = w.flvjs && w.flvjs.isSupported() && urls.flv;
    var hlsOk = (w.Hls && w.Hls.isSupported() && urls.hls) || (urls.hls && v.canPlayType('application/vnd.apple.mpegurl'));
    if (flvOk) {
      vid.player = w.flvjs.createPlayer({ type: 'flv', isLive: vid.mode === 'live', url: urls.flv });
      vid.player.attachMediaElement(v);
      vid.player.load();
      vid.player.play().catch(function () { });
    } else if (w.Hls && w.Hls.isSupported() && urls.hls) {
      vid.hls = new w.Hls();
      vid.hls.loadSource(urls.hls);
      vid.hls.attachMedia(v);
      v.play().catch(function () { });
    } else if (urls.hls && v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = urls.hls; v.play().catch(function () { });
    } else {
      // 无法播放：展示原始流地址
      if (cover) {
        cover.style.display = 'flex';
        cover.innerHTML = '<div style="text-align:center;max-width:420px;padding:20px">' +
          '<svg class="ico" style="fill:var(--tx-3);width:34px;height:34px"><use href="#i-media"/></svg>' +
          '<b style="display:block;margin:10px 0 6px">浏览器暂不支持该流格式，可尝试直接打开流地址：</b>' +
          (urls.hls ? '<div class="code" style="text-align:left;margin:6px 0">' + U.esc(urls.hls) + '</div>' : '') +
          (urls.flv ? '<div class="code" style="text-align:left;margin:6px 0">' + U.esc(urls.flv) + '</div>' : '') +
          '</div>';
      }
    }
  }

  function showVideoMsg(box, title, desc, urls) {
    destroyPlayer();
    var cover = document.getElementById('vCover');
    var v = document.getElementById('vPlayer');
    if (v) v.style.display = 'none';
    if (cover) {
      cover.style.display = 'flex';
      cover.innerHTML = '<div style="text-align:center;max-width:460px;padding:20px">' +
        '<svg class="ico" style="fill:#FFB020;width:34px;height:34px"><use href="#' + (urls ? 'i-link' : 'i-warn') + '"/></svg>' +
        '<b style="display:block;margin:10px 0 6px">' + U.esc(title) + '</b>' +
        '<p style="color:var(--tx-3);font-size:12px;line-height:1.7;margin:0 0 8px">' + U.esc(desc || '') + '</p>' +
        (urls ? '<div class="code" style="text-align:left;max-height:150px;overflow:auto">' + U.highlight(urls) + '</div>' : '') +
        '</div>';
    }
  }

  function renderVideo(root) {
    var U2 = ready();
    var cams = dashcams();
    if (!vid.imei && cams.length) vid.imei = cams[0].imei;

    root.innerHTML =
      '<div class="card">' +
        '<div class="toolbar">' +
          '<select class="sel" id="vdDev" style="min-width:210px">' +
            cams.map(function (d) { return '<option value="' + U.esc(d.imei) + '"' + (d.imei === vid.imei ? ' selected' : '') + '>' + U.esc(d.name) + ' · ' + U.esc(d.model) + ' · ' + U.esc(d.imei) + '</option>'; }).join('') +
          '</select>' +
          '<select class="sel" id="vdCh">' + [1, 2, 3, 4].map(function (c) { return '<option value="' + c + '">CH' + c + '</option>'; }).join('') + '</select>' +
          '<select class="sel" id="vdType"><option value="audio_video">音视频</option><option value="video_only">仅视频</option></select>' +
          '<select class="sel" id="vdStream"><option value="main_stream">主码流</option><option value="sub_stream">子码流</option></select>' +
          '<span style="flex:1"></span>' +
          '<button class="btn primary" id="vdLive">' + U.icon('i-bolt') + '开启直播</button>' +
          '<button class="btn ghost" id="vdStop">' + U.icon('i-close') + '停止直播</button>' +
          '<button class="btn blue" id="vdSnap">' + U.icon('i-media') + '抓拍照片</button>' +
          '<button class="btn ghost" id="vdRec">' + U.icon('i-download') + '录制视频</button>' +
        '</div>' +
        '<div class="video-wrap">' +
          '<div class="video-box">' +
            '<video id="vPlayer" controls playsinline style="display:none"></video>' +
            '<div class="video-cover" id="vCover">' +
              '<div style="text-align:center"><svg class="ico" style="fill:var(--tx-3);width:40px;height:40px"><use href="#i-media"/></svg>' +
              '<b style="display:block;margin-top:10px">等待开启直播…</b>' +
              '<p style="color:var(--tx-3);font-size:12px;margin:6px 0 0">选择设备与通道后点击「开启直播」，支持 HLS / FLV 流</p></div>' +
            '</div>' +
            '<span class="live-badge" id="vBadge" style="display:none">LIVE</span>' +
          '</div>' +
          '<div id="vUrls"></div>' +
        '</div>' +
      '</div>' +

      '<div class="card mt">' +
        '<div class="card-h"><h3>录像回放</h3><span class="sub">TurboHive /v3/video/files/list → /v3/video/playback/start</span>' +
          '<div class="right">' +
            '<select class="sel" id="vdRange"><option value="1">最近 24 小时</option><option value="7" selected>最近 7 天</option><option value="30">最近 30 天</option></select>' +
            '<button class="btn sm ghost" id="vdFiles">' + U.icon('i-search') + '查询录像文件</button>' +
            '<button class="btn sm primary" id="vdPlay" disabled>回放所选 (≤8 个)</button>' +
            '<button class="btn sm ghost" id="vdPlayStop" style="display:none">结束回放</button>' +
          '</div></div>' +
        '<div id="vdFileTable"><div class="empty"><svg><use href="#i-media"/></svg><b>暂无录像文件</b><p>选择时间范围后点击「查询录像文件」</p></div></div>' +
      '</div>' +

      '<div class="grid g-2 mt">' +
        '<div class="card"><div class="card-h"><h3>播放链路说明</h3></div><div class="hint" style="line-height:1.9;margin:0">' +
          '① <b>开启直播</b> → POST /v3/video/live/start，返回 rtmp / flv / hls 三种流地址；' +
          '② 浏览器端使用 flv.js（FLV）或 hls.js（HLS）直接播放；' +
          '③ <b>录像回放</b>流程：先查询设备存储文件列表 → 勾选 ≤8 个文件 → 开始回放获得流地址；' +
          '④ <b>抓拍 / 录制</b>通过 /v3/video/capture/start 下发指令，媒体文件异步上传后可在「媒体资源」页查看；' +
          '⑤ 视频功能仅行车记录仪（Dashcam）设备支持，设备需在线。' +
        '</div></div>' +
        '<div class="card"><div class="card-h"><h3>设备视频能力</h3></div>' +
          '<div class="mlist">' +
          cams.slice(0, 6).map(function (d) {
            var on = d.online === 1;
            return '<div class="mrow" data-vdev="' + U.esc(d.imei) + '" style="cursor:pointer">' +
              '<div class="ic" style="background:' + (on ? CH.colors.ok : '#5A6B85') + '22">' +
              '<svg class="ico" style="fill:' + (on ? CH.colors.ok : '#5A6B85') + '"><use href="#i-media"/></svg></div>' +
              '<div class="tx"><b>' + U.esc(d.name) + '</b><small>' + U.esc(d.model) + ' · ' + U.esc(d.imei) + '</small></div>' +
              '<div class="rt">' + (on ? '<span class="tag on"><i></i>在线</span>' : '<span class="tag off"><i></i>离线</span>') + '</div></div>';
          }).join('') + '</div></div>' +
      '</div>';

    if (!cams.length) {
      U.$('#vdDev').innerHTML = '<option>仅行车记录仪设备支持视频功能</option>';
      ['vdCh', 'vdType', 'vdStream', 'vdLive', 'vdStop', 'vdSnap', 'vdRec', 'vdFiles', 'vdPlay'].forEach(function (id) { U.$('#' + id).disabled = true; });
    }

    U.$('#vdDev').addEventListener('change', function (e) { vid.imei = e.target.value; destroyPlayer(); });
    U.$('#vdCh').addEventListener('change', function (e) { vid.channel = +e.target.value; });
    U.$('#vdType').addEventListener('change', function (e) { vid.dataType = e.target.value; });
    U.$('#vdStream').addEventListener('change', function (e) { vid.streamType = e.target.value; });
    U.$('#vdRange').addEventListener('change', function (e) { vid.range = +e.target.value; });

    function badge(show, txt) {
      var b = U.$('#vBadge');
      b.style.display = show ? 'block' : 'none';
      if (show) b.textContent = txt || 'LIVE';
    }
    function paintUrls(urls) {
      U.$('#vUrls').innerHTML = !urls ? '' :
        '<div class="kv" style="grid-template-columns:64px 1fr;margin-top:10px">' +
        ['hls', 'flv', 'rtmp'].map(function (k) {
          return urls[k] ? '<div class="it" style="display:flex;gap:8px;align-items:center"><span class="tag blue" style="justify-self:start"><i></i>' + k.toUpperCase() + '</span>' +
            '<small class="mono" style="word-break:break-all;user-select:all">' + U.esc(urls[k]) + '</small></div>' : '';
        }).join('') + '</div>';
    }

    U.$('#vdLive').addEventListener('click', function () {
      if (!vid.imei) return U.toast('请先选择设备', 'warn');
      var b = this; b.disabled = true;
      badge(true, '···');
      var cover = document.getElementById('vCover');
      var v = document.getElementById('vPlayer');
      if (cover) { cover.style.display = 'flex'; cover.innerHTML = '<div style="text-align:center"><span class="spin" style="width:26px;height:26px;border-width:3px"></span><b style="display:block;margin-top:10px">正在建立直播连接…</b></div>'; }
      vid.mode = 'live';
      API.th.videoLiveStart({ imei: vid.imei, channel: vid.channel, dataType: vid.dataType, streamType: vid.streamType })
        .then(function (d) {
          var urls = (d && (d.streamingUrls || d.urls)) || d || {};
          b.disabled = false; badge(true); paintUrls(urls); playStream(urls);
        })
        .catch(function (e) {
          b.disabled = false; badge(false);
          var hint = e.code === 2004 ? '设备未在线或不支持视频'
            : e.code === 2022 ? '仅行车记录仪设备支持视频功能'
            : e.code === 1001 ? '流媒体服务暂不可用（演示环境服务器返回错误），接口链路已验证：' : e.message;
          showVideoMsg(null, '直播开启失败', hint, e.raw);
        });
    });

    U.$('#vdStop').addEventListener('click', function () {
      destroyPlayer(); badge(false); U.$('#vUrls').innerHTML = '';
      var cover = document.getElementById('vCover'); var v = document.getElementById('vPlayer');
      if (v) v.style.display = 'none';
      if (cover) { cover.style.display = 'flex'; cover.innerHTML = '<div style="text-align:center"><svg class="ico" style="fill:var(--tx-3);width:40px;height:40px"><use href="#i-media"/></svg><b style="display:block;margin-top:10px">等待开启直播…</b></div>'; }
      if (vid.imei) API.th.videoLiveStop({ imei: vid.imei, channel: vid.channel }).catch(function () { });
      vid.mode = null;
    });

    function capture(type) {
      if (!vid.imei) return U.toast('请先选择设备', 'warn');
      API.th.videoCapture({ imei: vid.imei, channel: vid.channel, type: type, count: 1, duration: type === 3 ? 30 : undefined })
        .then(function () { U.toast('抓拍指令已下发（异步），照片稍后可在媒体资源页查看', 'ok', 5000); })
        .catch(function (e) {
          U.toast(e.code === 2004 ? '设备未在线或不支持视频' : e.code === 2011 ? '设备忙碌中，请稍后再试' : e.message, 'err');
        });
    }
    U.$('#vdSnap').addEventListener('click', function () { capture(1); });
    U.$('#vdRec').addEventListener('click', function () { capture(3); });

    U.$('#vdFiles').addEventListener('click', function () {
      var b = this; b.disabled = true;
      U.$('#vdFileTable').innerHTML = UI.loading();
      var now = Date.now();
      API.th.videoFilesList({ imei: vid.imei, channel: vid.channel, startTime: String(now - vid.range * 86400000), endTime: String(now) })
        .then(function (d) {
          b.disabled = false;
          vid.files = (d && d.files) || [];
          vid.selected = {};
          paintFiles();
          if (!vid.files.length) U.$('#vdFileTable').innerHTML = '<div class="empty"><svg><use href="#i-media"/></svg><b>暂无录像文件</b><p>该时间范围内设备没有录像，或设备不在线</p></div>';
        })
        .catch(function (e) {
          b.disabled = false;
          U.$('#vdFileTable').innerHTML = '<div class="empty"><svg><use href="#i-warn"/></svg><b>查询失败</b><p>' + U.esc(e.code === 1001 ? '流媒体服务暂不可用（演示环境服务器返回错误）' : e.message) + '</p></div>';
        });
    });

    function selCount() { return Object.keys(vid.selected).filter(function (k) { return vid.selected[k]; }).length; }
    function paintFiles() {
      var files = vid.files;
      U.$('#vdPlay').disabled = selCount() === 0;
      U.$('#vdFileTable').innerHTML = '<div class="tw"><table><thead><tr><th style="width:34px"></th><th>文件名</th><th>开始</th><th>结束</th><th>大小</th><th>通道</th><th>存储</th></tr></thead><tbody>' +
        files.map(function (f, i) {
          return '<tr>' +
            '<td><input type="checkbox" data-vf="' + i + '"' + (vid.selected[i] ? ' checked' : '') + '></td>' +
            '<td class="mono strong">' + U.esc(f.fileName) + '</td>' +
            '<td>' + U.dt(f.startTime) + '</td><td>' + U.dt(f.endTime) + '</td>' +
            '<td class="num">' + U.bytes(f.fileSize) + '</td><td class="num">CH' + f.channel + '</td>' +
            '<td>' + (f.storageType === 2 ? '灾备' : '主存') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="hint" style="margin-top:8px">已选 {n} / 8 个文件'.replace('{n}', '<b class="mono">' + selCount() + '</b>') + '</div>';
      U.$$('[data-vf]', root).forEach(function (c) {
        c.addEventListener('change', function () {
          var i = +c.getAttribute('data-vf');
          if (c.checked && selCount() >= 8) { c.checked = false; return U.toast('最多选择 8 个文件', 'warn'); }
          vid.selected[i] = c.checked;
          U.$('#vdPlay').disabled = selCount() === 0;
          U.$$('#vdFileTable .hint b')[0].textContent = selCount();
        });
      });
    }

    U.$('#vdPlay').addEventListener('click', function () {
      var names = Object.keys(vid.selected).filter(function (k) { return vid.selected[k]; }).map(function (k) { return vid.files[+k].fileName; });
      if (!names.length) return;
      var b = this; b.disabled = true;
      vid.mode = 'playback';
      badge(true, 'PLAYBACK');
      API.th.videoPlaybackStart({ imei: vid.imei, channel: vid.channel, fileNames: names })
        .then(function (d) {
          b.disabled = false;
          var urls = (d && (d.streamingUrls || d.urls)) || d || {};
          paintUrls(urls); playStream(urls);
          U.$('#vdPlayStop').style.display = '';
        })
        .catch(function (e) {
          b.disabled = false; badge(false);
          showVideoMsg(null, '回放开启失败', e.code === 1001 ? '流媒体服务暂不可用（演示环境服务器返回错误），接口链路已验证：' : e.message, e.raw);
        });
    });

    U.$('#vdPlayStop').addEventListener('click', function () {
      this.style.display = 'none';
      destroyPlayer(); badge(false);
      if (vid.imei) API.th.videoPlaybackControl({ imei: vid.imei, channel: vid.channel, playCtrl: 2, forwardRewind: 0 }).catch(function () { });
      vid.mode = null;
    });

    U.$$('[data-vdev]', root).forEach(function (n) {
      n.addEventListener('click', function () {
        vid.imei = n.getAttribute('data-vdev');
        U.$('#vdDev').value = vid.imei;
      });
    });
  }

  /* ============================================================
     12) OBD 数据分析
     ============================================================ */
  var obd = { imei: '', days: 7, rows: [], loading: false };

  function obdDevices() {
    return (w.STORE.devices || []).filter(function (d) {
      return d.src === 'turbohive' && (d.deviceType === 'OBD' || /obd/i.test(d.deviceType || '') || /VL533|VL863P|VL502|EV49/i.test(d.model || ''));
    });
  }
  function nv(v, invalid) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return null;
    var n = Number(v);
    if (invalid && invalid.test && invalid.test(n)) return null;
    return n;
  }

  function renderObd(root) {
    var U2 = ready();
    var devs = obdDevices();
    if (!obd.imei && devs.length) obd.imei = devs[0].imei;

    root.innerHTML =
      '<div class="card">' +
        '<div class="toolbar">' +
          '<select class="sel" id="obDev" style="min-width:220px">' +
            (devs.length ? devs.map(function (d) { return '<option value="' + U.esc(d.imei) + '"' + (d.imei === obd.imei ? ' selected' : '') + '>' + U.esc(d.name) + ' · ' + U.esc(d.model) + ' · ' + U.esc(d.imei) + '</option>'; }).join('') : '<option>暂无 OBD 设备</option>') +
          '</select>' +
          '<select class="sel" id="obDays"><option value="1">最近 24 小时</option><option value="7" selected>最近 7 天</option><option value="30">最近 30 天</option></select>' +
          '<button class="btn primary" id="obLoad">' + U.icon('i-refresh') + '查询数据</button>' +
          '<span style="flex:1"></span>' +
          '<span class="hint" style="margin:0">数据来源：TurboHive /v3/obd（CAN 总线实时工况）</span>' +
        '</div>' +
      '</div>' +
      '<div id="obBody">' + U2.loading('正在加载 OBD 数据…') + '</div>';

    U.$('#obDev').addEventListener('change', function (e) { obd.imei = e.target.value; load(); });
    U.$('#obDays').addEventListener('change', function (e) { obd.days = +e.target.value; load(); });
    U.$('#obLoad').addEventListener('click', load);

    if (devs.length) load();
    else U.$('#obBody').innerHTML = '<div class="card">' + UI.empty('暂无 OBD 设备', '接入 OBD 设备后即可查看工况数据', 'i-bolt') + '</div>';

    function load(skipAuto) {
      if (!obd.imei) { U.$('#obBody').innerHTML = '<div class="card mt">' + UI.empty('暂无 OBD 设备', '接入 OBD 设备后即可查看工况数据', 'i-bolt') + '</div>'; return; }
      U.$('#obBody').innerHTML = UI.loading('正在加载 OBD 数据…');
      var now = Date.now();
      // pageSize 上限 100（code 1204），用 pagingState 翻页聚合最多 3 页
      var all = [];
      function page(state) {
        var q = { imei: obd.imei, startTime: now - obd.days * 86400000, endTime: now, pageSize: 100 };
        if (state) q.pagingState = state;
        return API.th.obd(q).then(function (d) {
          all = all.concat((d && d.obdData) || []);
          if (d && d.hasNext && d.nextPageState && all.length < 300) return page(d.nextPageState);
          return all;
        });
      }
      page(null).then(function (rows) {
        // 当前设备无数据 → 自动尝试下一台（提升演示体验，仅首次加载时）
        if (!rows.length && !skipAuto) {
          var devs = obdDevices();
          var i = devs.findIndex(function (d) { return d.imei === obd.imei; });
          if (i >= 0 && i < devs.length - 1) {
            obd.imei = devs[i + 1].imei;
            var sel = U.$('#obDev'); if (sel) sel.value = obd.imei;
            return load();
          }
        }
        obd.rows = rows.sort(function (a, b) { return (a.deviceTime || 0) - (b.deviceTime || 0); });
        paint();
      }).catch(function (e) {
        U.$('#obBody').innerHTML = '<div class="card mt">' + UI.empty('OBD 数据加载失败', e.message, 'i-warn') + '</div>';
      });
    }

    function paint() {
      var rows = obd.rows;
      if (!rows.length) {
        U.$('#obBody').innerHTML = '<div class="card mt">' + UI.empty('所选时间范围内没有 OBD 上报，请更换设备或扩大时间范围', '', 'i-bolt') + '</div>';
        return;
      }
      var speeds = rows.map(function (r) { return nv(r.vehicleSpeed) || 0; });
      var rpms = rows.map(function (r) { return nv(r.engineSpeed); }).filter(function (v) { return v !== null; });
      var last = rows[rows.length - 1];
      var avgSpd = speeds.reduce(function (a, b) { return a + b; }, 0) / speeds.length;
      var maxSpd = Math.max.apply(null, speeds);
      var avgRpm = rpms.length ? rpms.reduce(function (a, b) { return a + b; }, 0) / rpms.length : null;
      var avgFuel = rows.map(function (r) { return nv(r.avgFuelConsumption); }).filter(function (v) { return v !== null && v > 0 && v < 100; });
      var avgFuelV = avgFuel.length ? avgFuel.reduce(function (a, b) { return a + b; }, 0) / avgFuel.length : null;
      var volt = nv(last.batteryVoltage, /^-|^0$/);
      var runtimeH = last.engineRuntime !== null && last.engineRuntime !== undefined ? (last.engineRuntime / 3600) : null;
      var odo = nv(last.cumulativeMileage);

      // 驾驶行为
      var harshAcc = 0, harshBrk = 0, overspeed = 0, idleMs = 0, driveMs = 0;
      for (var i = 1; i < rows.length; i++) {
        var a = rows[i - 1], b = rows[i];
        var dt = (b.deviceTime - a.deviceTime) / 1000;
        if (dt <= 0 || dt > 300) continue;
        var v1 = nv(a.vehicleSpeed), v2 = nv(b.vehicleSpeed);
        if (v1 !== null && v2 !== null) {
          var accel = (v2 - v1) / 3.6 / dt;   // m/s²
          if (accel > 2.5) harshAcc++;
          if (accel < -2.8) harshBrk++;
          if (v2 > 120) overspeed++;
          if (v2 <= 2 && (nv(b.engineSpeed) || 0) >= 500) idleMs += dt * 1000;
          else if (v2 > 2) driveMs += dt * 1000;
        }
      }
      var totalMs = idleMs + driveMs;
      var idleRatio = totalMs ? idleMs / totalMs : 0;

      // 健康评分（100 − 驾驶激进度 − 怠速 − 电压 − 油耗）
      var score = 100;
      score -= Math.min(30, (harshAcc + harshBrk) * 3);
      score -= Math.min(25, Math.round(idleRatio * 50));
      if (volt !== null && volt < 12500) score -= 10;
      if (avgFuelV !== null) { if (avgFuelV > 20) score -= 10; else if (avgFuelV > 15) score -= 5; }
      score = Math.max(5, Math.round(score));
      var grade = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 55 ? '一般' : '需改善';
      var gradeColor = score >= 85 ? CH.colors.ok : score >= 70 ? CH.colors.blue : score >= 55 ? CH.colors.warn : CH.colors.err;

      var labels = timeLabels(rows.map(function (r) { return r.deviceTime; }));

      // 油耗成本估算（8.0 元/L）
      var fuelCost = (avgFuelV && odo) ? (avgFuelV * odo / 100 * 8) : null;

      var k = function (o) { return UI.kpi(o); };
      U.$('#obBody').innerHTML =
        '<div class="grid g-5 mt">' +
          k({ label: '最高车速', value: maxSpd.toFixed(0), unit: 'km/h', icon: 'i-bolt', color: CH.colors.orange }) +
          k({ label: '平均车速', value: avgSpd.toFixed(1), unit: 'km/h', icon: 'i-map', color: CH.colors.blue }) +
          k({ label: '平均油耗', value: avgFuelV !== null ? avgFuelV.toFixed(1) : '—', unit: 'L/100km', icon: 'i-trip', color: CH.colors.warn,
            foot: fuelCost !== null ? '燃油成本估算 <b style="color:var(--tx-2)">¥' + CH.nf(Math.round(fuelCost)) + '</b>（8.0 元/L）' : '' }) +
          k({ label: '电瓶电压', value: volt !== null ? (volt / 1000).toFixed(1) : '—', unit: 'V', icon: 'i-bolt', color: (volt && volt < 12500) ? CH.colors.err : CH.colors.ok }) +
          k({ label: '总里程', value: odo !== null ? CH.nf(Math.round(odo)) : '—', unit: 'km', icon: 'i-device', color: CH.colors.purple,
            foot: '发动机运行 ' + (runtimeH !== null ? runtimeH.toFixed(1) + ' h' : '—') }) +
        '</div>' +

        '<div class="grid g-2 mt">' +
          UI.card('车速曲线', CH.line(labels, [{ name: '车速 km/h', data: seriesOf(rows, 'vehicleSpeed'), color: CH.colors.orange }], { h: 220, dots: false })) +
          UI.card('转速曲线', CH.line(labels, [{ name: '转速 r/min', data: seriesOf(rows, 'engineSpeed'), color: CH.colors.blue }], { h: 220, dots: false, color2: CH.colors.blue })) +
        '</div>' +

        '<div class="grid g-2 mt">' +
          UI.card('油耗分析', CH.line(labels, [
            { name: '瞬时油耗 L/h', data: seriesOf(rows, 'instantFuelConsumption'), color: CH.colors.warn },
            { name: '平均油耗 L/100km', data: seriesOf(rows, 'avgFuelConsumption'), color: CH.colors.teal }
          ], { h: 220, dots: false })) +
          UI.card('电压与温度', CH.line(labels, [
            { name: '电压 V', data: seriesOf(rows, 'batteryVoltage', 0.001), color: CH.colors.ok },
            { name: '水温', data: rows.map(function (r) { var v = nv(r.coolantTemp); return v !== null && v > -40 && v < 150 ? v : null; }), color: CH.colors.err },
            { name: '进气温度', data: rows.map(function (r) { var v = nv(r.intakeAirTemp); return v !== null && v > -40 && v < 100 ? v : null; }), color: CH.colors.purple }
          ], { h: 220, dots: false })) +
        '</div>' +

        '<div class="grid g-32 mt">' +
          UI.card('驾驶行为分析', '<div class="grid g-2" style="gap:8px;margin-bottom:10px">' +
              '<div class="kv" style="grid-template-columns:1fr 1fr">' +
              '<div class="it"><b style="color:' + CH.colors.err + '">' + harshAcc + '</b><small>急加速</small></div>' +
              '<div class="it"><b style="color:' + CH.colors.err + '">' + harshBrk + '</b><small>急刹车</small></div>' +
              '<div class="it"><b style="color:' + CH.colors.warn + '">' + overspeed + '</b><small>超速 (&gt;120km/h)</small></div>' +
              '<div class="it"><b>' + (idleRatio * 100).toFixed(1) + '%</b><small>怠速占比</small></div></div></div>' +
            CH.bar(['急加速', '急刹车', '超速'], [{ name: '次数', data: [harshAcc, harshBrk, overspeed], color: CH.colors.orange }], { h: 150 })) +
          UI.card('健康评分与应用建议', '<div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
              CH.donut([
                { label: '得分', value: score, color: gradeColor },
                { label: '', value: 100 - score, color: '#1E2E48' }
              ], { size: 150, inner: 56, centerValue: score, centerLabel: grade + ' · 100 分制' }) +
              '<div style="flex:1;min-width:230px" class="mlist">' + obdInsights({
                score: score, grade: grade, gradeColor: gradeColor, avgFuelV: avgFuelV, volt: volt,
                runtimeH: runtimeH, harshAcc: harshAcc, harshBrk: harshBrk, overspeed: overspeed,
                idleRatio: idleRatio, odo: odo
              }) + '</div></div>') +
        '</div>' +

        '<div class="card mt">' +
          '<div class="card-h"><h3>最新数据</h3><span class="sub">最近 ' + Math.min(8, rows.length) + ' 条 CAN 上报</span></div>' +
          '<div class="tw"><table><thead><tr><th>时间</th><th>车速</th><th>转速</th><th>油量</th><th>电压</th><th>水温</th><th>进气</th><th>节气门</th><th>瞬时油耗</th><th>累计里程</th></tr></thead><tbody>' +
          rows.slice(-8).reverse().map(function (r) {
            var vv = nv(r.batteryVoltage);
            return '<tr><td>' + U.dt(r.deviceTime) + '</td>' +
              '<td class="num">' + U.esc(nv(r.vehicleSpeed) !== null ? nv(r.vehicleSpeed) + ' km/h' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.engineSpeed) !== null ? nv(r.engineSpeed) + ' r/min' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.fuelLevel) !== null ? nv(r.fuelLevel) + '%' : '—') + '</td>' +
              '<td class="num">' + U.esc(vv !== null ? (vv / 1000).toFixed(1) + ' V' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.coolantTemp, function (v) { return v < -40; }) !== null ? nv(r.coolantTemp) + ' °C' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.intakeAirTemp) !== null ? nv(r.intakeAirTemp) + ' °C' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.throttle) !== null ? nv(r.throttle) + '%' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.instantFuelConsumption) !== null ? nv(r.instantFuelConsumption) + ' L/h' : '—') + '</td>' +
              '<td class="num">' + U.esc(nv(r.cumulativeMileage) !== null ? CH.nf(Math.round(nv(r.cumulativeMileage))) + ' km' : '—') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
        '</div>';
    }

    /** 应用建议规则引擎 */
    function obdInsights(m) {
      var tips = [];
      if (m.avgFuelV !== null) {
        if (m.avgFuelV > 18) tips.push({ ic: 'i-trip', c: CH.colors.err, t: '油耗偏高（' + m.avgFuelV.toFixed(1) + ' L/100km）', d: '建议检查胎压、空气滤芯与驾驶习惯，预计可省 10–15% 燃油成本' });
        else if (m.avgFuelV > 13) tips.push({ ic: 'i-trip', c: CH.colors.warn, t: '油耗中等（' + m.avgFuelV.toFixed(1) + ' L/100km）', d: '减少急加速与长时间怠速可进一步降本' });
        else tips.push({ ic: 'i-check', c: CH.colors.ok, t: '油耗健康（' + m.avgFuelV.toFixed(1) + ' L/100km）', d: '车辆燃油经济性处于良好水平' });
      }
      if (m.volt !== null) {
        if (m.volt < 12500) tips.push({ ic: 'i-bolt', c: CH.colors.err, t: '电瓶电压偏低（' + (m.volt / 1000).toFixed(1) + ' V）', d: '存在亏电风险，建议检查充电系统与电瓶寿命' });
        else tips.push({ ic: 'i-bolt', c: CH.colors.ok, t: '电瓶电压正常（' + (m.volt / 1000).toFixed(1) + ' V）', d: '充电系统工作正常' });
      }
      if (m.runtimeH !== null && m.runtimeH > 400) tips.push({ ic: 'i-device', c: CH.colors.warn, t: '发动机累计运行 ' + m.runtimeH.toFixed(0) + ' h', d: '接近保养周期，建议安排机油与滤芯更换' });
      if (m.harshAcc + m.harshBrk > 8) tips.push({ ic: 'i-warn', c: CH.colors.err, t: '激烈驾驶 ' + (m.harshAcc + m.harshBrk) + ' 次', d: '急加速/急刹车频发，建议开展驾驶安全培训并关联 ADAS 事件复核' });
      if (m.idleRatio > 0.3) tips.push({ ic: 'i-map', c: CH.colors.warn, t: '怠速占比 ' + (m.idleRatio * 100).toFixed(0) + '%', d: '长时间怠速增加油耗与积碳，建议优化调度与等待策略' });
      if (m.score >= 85) tips.push({ ic: 'i-check', c: CH.colors.ok, t: T('综合评估：') + T(m.grade) + T('（') + m.score + T(' 分）'), d: '车辆工况整体健康，继续保持当前维护节奏' });
      else if (m.score < 55) tips.push({ ic: 'i-warn', c: CH.colors.err, t: T('综合评估：') + T(m.grade) + T('（') + m.score + T(' 分）'), d: '存在多项风险指标，建议尽快安排整车检查' });
      return tips.map(function (x) {
        return '<div class="mrow"><div class="ic" style="background:' + x.c + '22">' +
          '<svg class="ico" style="fill:' + x.c + '"><use href="#' + x.ic + '"/></svg></div>' +
          '<div class="tx"><b>' + U.esc(x.t) + '</b><small>' + U.esc(x.d) + '</small></div></div>';
      }).join('');
    }
  }

  /* ============================================================
     13) ADAS·DMS 智能筛选
     ============================================================ */
  var adas = { cat: '', minScore: 0, sort: 'score' };

  /** 事件分类 + 风险评分规则引擎 */
  var ADAS_RULES = {
    classify: function (a) {
      var tp = String(a.type || ''), n = String(a.name || '') + ' ' + String(a.desc || '');
      if (/^264-/.test(tp) || /lane|departure|collision|pedestrian|forward|headway|speed.?limit|车道|碰撞|行人|前向|车距|限速/i.test(n)) return 'adas';
      if (/^(265|266)-/.test(tp) || /fatigue|phone|smok|seatbelt|distract|driver|疲劳|电话|抽烟|安全带|分神/i.test(n)) return 'dms';
      if (/^(256|257|259)/.test(tp) || /camera|video|signal|storage|摄像头|视频|信号|存储/i.test(n)) return 'vid';
      return null;
    },
    catName: { adas: 'ADAS 事件', dms: 'DMS 事件', vid: '视频设备故障' },
    base: function (a) {
      var tp = String(a.type || ''), n = String(a.name || '').toLowerCase();
      if (/sos/.test(n) || tp === '3073') return 98;
      if (/pedestrian|行人/.test(n)) return 95;
      if (/forward.?collision|前向碰撞/.test(n)) return 92;
      if (/fatigue|疲劳/.test(n)) return 90;
      if (/phone|电话/.test(n)) return 85;
      if (/seatbelt|安全带/.test(n)) return 82;
      if (/headway|车距/.test(n)) return 80;
      if (/smok|抽烟/.test(n)) return 78;
      if (/distract|分神/.test(n)) return 76;
      if (/lane|车道偏离/.test(n)) return 72;
      if (/speed.?limit|限速/.test(n)) return 62;
      if (/camera|摄像头/.test(n)) return 35;
      if (/signal|信号/.test(n)) return 40;
      if (/storage|存储/.test(n)) return 30;
      if (/^(264)-/.test(tp)) return 75;
      if (/^(265|266)-/.test(tp)) return 80;
      if (/^(256|257|259)/.test(tp)) return 38;
      return 60;
    }
  };

  function adasEvents() {
    var S = w.STORE;
    var freq = {};
    (S.alerts || []).forEach(function (a) {
      var c = ADAS_RULES.classify(a);
      if (c) { var k = a.imei + '|' + a.type; freq[k] = (freq[k] || 0) + 1; }
    });
    return (S.alerts || []).map(function (a) {
      var c = ADAS_RULES.classify(a);
      if (!c) return null;
      var base = ADAS_RULES.base(a);
      var rec = a.time && (Date.now() - a.time < 86400000) ? 8 : (a.time && Date.now() - a.time < 604800000 ? 4 : 0);
      var fb = Math.min(10, ((freq[a.imei + '|' + a.type] || 1) - 1) * 2);
      var score = Math.min(100, Math.round(base + rec + fb));
      return {
        alert: a, cat: c, catName: ADAS_RULES.catName[c],
        base: base, score: score,
        risk: score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low'
      };
    }).filter(Boolean);
  }

  function renderAdas(root) {
    var U2 = ready();
    var all = adasEvents();
    var hi = all.filter(function (e) { return e.risk === 'high'; }).length;
    var avg = all.length ? Math.round(all.reduce(function (a, e) { return a + e.score; }, 0) / all.length) : 0;
    var devs = U.uniq(all.map(function (e) { return e.alert.imei; }));
    var videoLink = all.filter(function (e) { return e.alert.src === 'turbohive'; }).length;

    root.innerHTML =
      '<div class="grid g-5">' +
        UI.kpi({ label: '事件总数', value: U.num(all.length), unit: '起', icon: 'i-alert', color: CH.colors.orange }) +
        UI.kpi({ label: '高风险事件', value: U.num(hi), unit: '起', icon: 'i-warn', color: CH.colors.err }) +
        UI.kpi({ label: '平均风险分', value: avg, unit: '/100', icon: 'i-bolt', color: CH.colors.warn }) +
        UI.kpi({ label: '涉及车辆', value: U.num(devs.length), unit: '台', icon: 'i-device', color: CH.colors.blue }) +
        UI.kpi({ label: '可关联视频', value: U.num(videoLink), unit: '起', icon: 'i-media', color: CH.colors.purple }) +
      '</div>' +

      '<div class="card mt">' +
        '<div class="toolbar">' +
          '<select class="sel" id="adCat"><option value="">全部类别</option><option value="adas">ADAS 事件</option><option value="dms">DMS 事件</option><option value="vid">视频设备故障</option></select>' +
          '<div style="display:flex;align-items:center;gap:8px"><label class="fl" style="margin:0">最低风险分</label>' +
          '<input type="range" id="adMin" min="0" max="100" step="5" value="0" style="width:140px"><b class="mono" id="adMinV" style="min-width:26px">0</b></div>' +
          '<select class="sel" id="adSort"><option value="score">按风险分排序</option><option value="time">按时间排序</option></select>' +
          '<span style="flex:1"></span>' +
          '<span class="tag purple" style="padding:3px 10px"><i></i>AI 筛选</span>' +
        '</div>' +
      '</div>' +

      '<div class="grid g-32 mt">' +
        UI.card('风险分布', all.length ? CH.donut([
          { label: '高风险', value: all.filter(function (e) { return e.risk === 'high'; }).length, color: CH.colors.err },
          { label: '中风险', value: all.filter(function (e) { return e.risk === 'mid'; }).length, color: CH.colors.warn },
          { label: '低风险', value: all.filter(function (e) { return e.risk === 'low'; }).length, color: CH.colors.blue }
        ], { size: 168, inner: 58, centerValue: all.length, centerLabel: '事件' }) +
          '<div class="legend" style="justify-content:center;margin-top:8px"><span><i style="background:' + CH.colors.err + '"></i>高风险 ≥75</span><span><i style="background:' + CH.colors.warn + '"></i>中风险 50–74</span><span><i style="background:' + CH.colors.blue + '"></i>低风险 &lt;50</span></div>'
          : UI.empty('暂无 ADAS/DMS 事件', '当前告警数据中没有 ADAS/DMS 类事件（264-x / 265-x / 266-x），规则引擎已就绪，事件上报后将自动评分', 'i-warn')) +
        UI.card('AI 综合结论', all.length ? adasSummary(all) : UI.empty('等待事件数据', '规则引擎将基于事件类型、新近度与频次自动生成审查建议', 'i-bolt')) +
      '</div>' +

      '<div class="grid g-23 mt">' +
        UI.card('车辆风险排名', all.length ? (function () {
          var byDev = U.groupBy(all, function (e) { return e.alert.imei; });
          var items = Object.keys(byDev).map(function (k) {
            var es = byDev[k];
            var top = es.slice().sort(function (a, b) { return b.score - a.score; })[0];
            var name = (w.STORE.devices.filter(function (d) { return d.imei === k; })[0] || {}).name || k;
            return { label: name || k, value: Math.round(es.reduce(function (a, e) { return a + e.score; }, 0) / es.length), suffix: ' 分 · ' + es.length + ' 起', color: top.risk === 'high' ? CH.colors.err : top.risk === 'mid' ? CH.colors.warn : CH.colors.blue };
          }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8);
          return CH.hBar(items, { labelW: 120 });
        })() : UI.empty('暂无数据', '', 'i-device')) +
        UI.card('规则引擎说明', '<div class="hint" style="margin:0;line-height:1.9">' +
          '<b>评分模型</b>：评分 = 事件类型基准分 + 时间新近度加成（24h 内 +8 / 7 天内 +4）+ 同设备同类频次加成（≤10），用于优先审查排序<br>' +
          '<b>基准分</b>：行人碰撞 95 · 前向碰撞 92 · 疲劳驾驶 90 · 接打电话 85 · 车道偏离 72 · 摄像头故障 35 等<br>' +
          '<b>审查流</b>：高风险事件 → 一键「获取视频」→ 设备经 MQTT 异步上传事件视频 → 媒体资源页审查归档' +
        '</div>') +
      '</div>' +

      '<div class="card mt">' +
        '<div class="card-h"><h3>事件列表</h3><span class="sub">ADAS = 高级驾驶辅助 · DMS = 驾驶员状态监测</span></div>' +
        '<div id="adList">' + UI.loading() + '</div>' +
      '</div>';

    function paintList() {
      var list = all.filter(function (e) {
        if (adas.cat && e.cat !== adas.cat) return false;
        if (e.score < adas.minScore) return false;
        return true;
      }).sort(function (a, b) {
        return adas.sort === 'score' ? b.score - a.score : (b.alert.time || 0) - (a.alert.time || 0);
      }).slice(0, 40);
      U.$('#adList').innerHTML = list.length ? '<div class="mlist">' + list.map(function (e, i) {
        var a = e.alert;
        var rc = e.risk === 'high' ? CH.colors.err : e.risk === 'mid' ? CH.colors.warn : CH.colors.blue;
        return '<div class="mrow" style="align-items:center">' +
          '<div class="sev" style="background:' + rc + '"></div>' +
          '<div class="ic" style="background:' + rc + '18;border:1px solid ' + rc + '44;min-width:44px;text-align:center">' +
          '<b style="color:' + rc + ';font-size:13px">' + e.score + '</b></div>' +
          '<div class="tx" style="flex:1"><b>' + U.esc(a.name || e.catName) +
          ' <span class="tag ' + (e.cat === 'adas' ? 'orange' : e.cat === 'dms' ? 'purple' : 'blue') + '" style="padding:0 7px;font-size:10px;vertical-align:1px"><i></i>' + U.esc(e.catName) + '</span></b>' +
          '<small>' + U.esc(a.imei) + ' · ' + U.esc(a.desc || '') + ' · ' + U.dt(a.time) + '</small>' +
          '<div class="bar" style="margin-top:5px;max-width:320px"><i style="width:' + e.score + '%;background:' + rc + '"></i></div></div>' +
          '<div class="rt" style="display:flex;gap:6px;align-items:center">' +
          '<span class="tag" style="color:' + rc + ';background:' + rc + '18;border-color:' + rc + '55"><i></i>' +
          (e.risk === 'high' ? '高风险' : e.risk === 'mid' ? '中风险' : '低风险') + '</span>' +
          (a.src === 'turbohive' && a.time ? '<button class="btn sm ghost" data-advid="' + i + '">' + U.icon('i-media') + '获取视频</button>' : '') +
          (a.lat ? '<button class="btn sm ghost" data-admap="' + i + '">' + U.icon('i-map') + '</button>' : '') +
          '</div></div>';
      }).join('') + '</div>' : UI.empty('没有匹配的事件', '调整类别或最低风险分后重试', 'i-alert');

      U.$$('[data-advid]', root).forEach(function (b) {
        b.addEventListener('click', function () { fetchVideo(list[+b.getAttribute('data-advid')]); });
      });
      U.$$('[data-admap]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var e = list[+b.getAttribute('data-admap')];
          w.APP.goto('map', { lat: e.alert.lat, lng: e.alert.lng, label: e.alert.name });
        });
      });
    }

    function fetchVideo(e) {
      var a = e.alert;
      U.Drawer.open('告警视频抓取 · ' + (a.name || e.catName),
        '<div class="kv" style="margin-bottom:14px">' +
          '<div class="it"><b style="color:' + (e.risk === 'high' ? CH.colors.err : CH.colors.warn) + '">' + e.score + '</b><small>风险评分</small></div>' +
          '<div class="it"><b style="font-size:12.5px">' + U.esc(a.name) + '</b><small>事件类型</small></div>' +
          '<div class="it"><b style="font-size:12px">' + U.esc(a.imei) + '</b><small>设备</small></div>' +
        '</div>' +
        U.kvList({ '告警时间': U.dt(a.time), '告警类型': a.type, '告警代码': a.code, '描述': a.desc }) +
        '<div id="adFetchBox">' + UI.loading('正在下发 VIDEOUPLOAD 指令…') + '</div>');
      API.th.alertVideoFetch({ imei: a.imei, alertTime: a.time, alertCode: a.code, alertType: a.type })
        .then(function (d) {
          U.$('#adFetchBox').innerHTML =
            '<div class="mlist" style="margin-top:12px"><div class="mrow">' +
            '<div class="ic" style="background:' + CH.colors.ok + '22"><svg class="ico" style="fill:' + CH.colors.ok + '"><use href="#i-check"/></svg></div>' +
            '<div class="tx"><b>指令下发成功（异步）</b><small>' +
            '设备将通过 MQTT 异步上传事件视频，上传完成后可在「媒体资源」页查看。' +
            ((d && d.cmdNoList) ? '指令号：' + U.esc(JSON.stringify(d.cmdNoList)) : '') + '</small></div></div></div>' +
            '<div class="code" style="margin-top:10px;max-height:200px">' + U.highlight(d) + '</div>';
        })
        .catch(function (err) {
          var msg = err.code === 2112 ? '该告警没有关联的事件视频'
            : err.code === 2004 ? '设备离线，无法下发视频抓取指令'
            : err.code === 2003 ? '设备不支持视频抓取功能'
            : err.code === 2207 ? '视频抓取指令下发失败（设备通信异常）' : err.message;
          U.$('#adFetchBox').innerHTML = UI.empty('无法获取视频', msg, 'i-warn');
        });
    }

    U.$('#adCat').addEventListener('change', function (e) { adas.cat = e.target.value; paintList(); });
    U.$('#adSort').addEventListener('change', function (e) { adas.sort = e.target.value; paintList(); });
    U.$('#adMin').addEventListener('input', function (e) {
      adas.minScore = +e.target.value;
      U.$('#adMinV').textContent = e.target.value;
      paintList();
    });

    /** AI 结论（规则生成） */
    function adasSummary(list) {
      var byCat = U.groupBy(list, function (e) { return e.cat; });
      var top = list.slice().sort(function (a, b) { return b.score - a.score; })[0];
      var byName = U.groupBy(list, function (e) { return e.alert.name || '未知'; });
      var topTypeName = Object.keys(byName).sort(function (a, b) { return byName[b].length - byName[a].length; })[0];
      var topTypePct = Math.round(byName[topTypeName].length / list.length * 100);
      var devName = (w.STORE.devices.filter(function (d) { return d.imei === top.alert.imei; })[0] || {}).name || top.alert.imei;
      var hiCnt = list.filter(function (e) { return e.risk === 'high'; }).length;
      var tips = [];
      if (hiCnt) tips.push('建议优先审查 <b>' + hiCnt + '</b> 段高风险视频（评分 ≥75），重点核对碰撞与驾驶员状态类事件');
      if (byCat.vid && byCat.vid.length >= 3) tips.push('视频设备故障 <b>' + byCat.vid.length + '</b> 起，占比偏高，建议排查摄像头接线与 SD 卡状态');
      if (byCat.dms) tips.push('检测到 DMS 驾驶员状态事件 <b>' + byCat.dms.length + '</b> 起，建议对相关驾驶员开展安全培训');
      if (topTypeName) tips.push(T('「') + topTypeName + T('」为最高频事件类型（') + topTypePct + T('%），可针对性优化'));
      return '<div style="font-size:12.5px;line-height:1.8;color:var(--tx-2)">' +
        T('共识别') + ' <b style="color:var(--tx)">' + list.length + '</b> ' + T('起事件：ADAS') + ' ' + (byCat.adas ? byCat.adas.length : 0) + ' ' +
        T('起 · DMS') + ' ' + (byCat.dms ? byCat.dms.length : 0) + ' ' + T('起 · 视频故障') + ' ' + (byCat.vid ? byCat.vid.length : 0) + ' ' +
        T('起。平均风险分') + ' <b style="color:var(--tx)">' + Math.round(list.reduce(function (a, e) { return a + e.score; }, 0) / list.length) + '</b>' +
        T('，最高风险') + ' <b style="color:' + CH.colors.err + '">' + top.score + ' ' + T('分') + '</b>' +
        ' (' + U.esc(top.alert.name || top.catName) + ' @ ' + U.esc(devName) + ', ' + U.ago(top.alert.time) + ').' +
        '</div><div class="mlist" style="margin-top:10px">' + tips.map(function (x) {
          return '<div class="mrow"><div class="ic" style="background:' + CH.colors.orange + '22">' +
            '<svg class="ico" style="fill:' + CH.colors.orange + '"><use href="#i-bolt"/></svg></div>' +
            '<div class="tx" style="font-size:12px">' + x + '</div></div>';
        }).join('') + '</div>';
    }

    paintList();
  }

  /* ================= 注册 ================= */
  w.PAGES = w.PAGES || {};
  w.PAGES.video = { title: '实时视频', desc: '行车记录仪实时预览、录像回放与远程抓拍', render: renderVideo };
  w.PAGES.obd = { title: 'OBD 数据分析', desc: '车辆工况数据可视化与驾驶行为应用', render: renderObd };
  w.PAGES.adas = { title: 'ADAS·DMS 智能筛选', desc: '告警视频风险评分与 AI 优先级审查', render: renderAdas };
})(window);
