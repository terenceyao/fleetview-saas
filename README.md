# FleetView SaaS — 双平台车联网数据可视化看板

纯前端（零构建、零依赖）的 SaaS 演示界面，同时接入 **TurboHive** 与 **TrackSolidPro (TSP)** 两大车联网开放平台 API，将设备、定位、告警、行程、里程、围栏等数据聚合展示在一个深色可视化看板中。

> 设计体系：M2M Orange `#E88828` + Jimi Blue `#2AC2F3` · 深色背景

## ✨ 功能页面

| 页面 | 内容 |
|---|---|
| 总览看板 | 设备总量/在线率、双平台对比、告警趋势、里程趋势、型号分布、存储用量 |
| 设备管理 | 975 台设备分页表格，支持关键字搜索、平台/状态筛选、详情抽屉 |
| 实时地图 | Leaflet 地图 + 双色设备标记（橙=TurboHive / 蓝=TSP），侧栏联动、弹窗详情 |
| 告警中心 | 双平台告警聚合，级别分布环形图、24h 趋势柱状图、类型筛选 |
| 行程里程 | 行程记录表、每日里程趋势、设备里程排行 |
| 电子围栏 | 围栏列表 + 地图可视化（圆/多边形） |
| 平台资源 | 网关、模型、媒体资源、指令历史 |
| API 控制台 | 可视化调试各端点，查看最近请求日志（耗时/状态码/响应） |
| 设置 | 凭据配置、状态检测、数据刷新 |

## 🚀 本地运行

```bash
# 任意静态服务器均可，例如：
python -m http.server 8899
# 浏览器打开 http://127.0.0.1:8899
```

无需 npm install、无需构建。所有 API 调用在浏览器端直接完成（两个平台的 CORS 均已开放）。

## 🔧 技术要点

- **TurboHive**：REST + `Authorization: Bearer` Token（`/v3/*`）
- **TSP OpenAPI**：`POST https://hk-open.tracksolidpro.com/route/rest`
  - 签名算法：参数按 key 升序拼接 → 首尾包裹 `appSecret` → MD5 大写
  - `access_token` 缓存 2h（提前 5min 刷新），失效自动重取
  - 服务端限流严格（code 1006）：客户端串行队列 + 1.6s 最小间隔 + 指数退避重试
- **零依赖图表**：自研 SVG 折线/柱状/环形/堆叠图，无 ECharts/Chart.js
- **地图**：Leaflet CDN + GeoQ 深色瓦片

## ⚠️ 安全提示

`assets/js/config.js` 中包含演示账号凭据，仅用于 Demo 环境。生产环境请改为后端代理转发，避免在前端暴露 `appSecret` 与 Token。

## 📁 目录结构

```
fleetview-saas/
├── index.html              # 入口 + 布局骨架
├── assets/
│   ├── css/app.css         # 设计系统（深色双品牌主题）
│   └── js/
│       ├── config.js       # 平台凭据与端点配置
│       ├── util.js         # 工具集（含纯 JS MD5 实现）
│       ├── api.js          # TurboHive / TSP 双客户端（限流/重试/日志）
│       ├── charts.js       # 零依赖 SVG 图表库
│       ├── pages.js        # 页面：总览/设备/地图/告警
│       ├── pages2.js       # 页面：行程/围栏/平台/媒体/控制台/设置
│       └── app.js          # 数据聚合、路由、启动引导
└── .gitignore
```
