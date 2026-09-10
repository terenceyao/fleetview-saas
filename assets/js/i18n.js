/* ============================================================
   i18n.js — 中/英/西三语运行时翻译引擎
   ------------------------------------------------------------
   原理：基于「精确文本 + 数字模板」字典，通过 MutationObserver
   对动态渲染的 DOM 文本节点与 placeholder/title 属性做即时翻译。
   - zh 为源语言（代码内文案），en / es 由字典映射
   - 原文保存在 WeakMap 中，切换语言时可无损还原
   ============================================================ */
(function (w) {
  'use strict';

  var LS_KEY = 'fleetview.lang';
  var CJK_RE = /[\u4e00-\u9fff]/;

  /* ================= 字典 ================= */
  /* 模板键中 {1} {2}… 对应原文中的第 n 个数字串 */
  var DICT = {

    /* ---------- 导航 / 外壳 ---------- */
    '车联网 SaaS 控制台': { en: 'IoV SaaS Console', es: 'Consola SaaS de IoV' },
    '运营中心': { en: 'Operations', es: 'Operaciones' },
    '平台资源': { en: 'Platform Resources', es: 'Recursos de plataforma' },
    '开发者': { en: 'Developer', es: 'Desarrollador' },
    '视频与智能': { en: 'Video & AI', es: 'Vídeo e IA' },
    '总览看板': { en: 'Overview', es: 'Resumen general' },
    '设备管理': { en: 'Devices', es: 'Dispositivos' },
    '实时地图': { en: 'Live Map', es: 'Mapa en vivo' },
    '告警中心': { en: 'Alerts', es: 'Centro de alertas' },
    '行程与里程': { en: 'Trips & Mileage', es: 'Viajes y kilometraje' },
    '围栏管理': { en: 'Geofences', es: 'Geocercas' },
    '实时视频': { en: 'Live Video', es: 'Vídeo en vivo' },
    'OBD 数据分析': { en: 'OBD Analytics', es: 'Análisis OBD' },
    'ADAS·DMS 智能筛选': { en: 'ADAS·DMS AI Filter', es: 'Filtro IA ADAS·DMS' },
    '网关与模型': { en: 'Gateways & Models', es: 'Gateways y modelos' },
    '媒体资源': { en: 'Media', es: 'Multimedia' },
    'API 控制台': { en: 'API Console', es: 'Consola API' },
    '接入设置': { en: 'Settings', es: 'Configuración' },
    '未连接': { en: 'Disconnected', es: 'Sin conexión' },
    '已连接': { en: 'Connected', es: 'Conectado' },
    '连接中': { en: 'Connecting', es: 'Conectando' },
    '异常': { en: 'Error', es: 'Error' },
    '待连接': { en: 'Standby', es: 'En espera' },
    '未启用': { en: 'Disabled', es: 'Desactivado' },
    '菜单': { en: 'Menu', es: 'Menú' },
    '自动刷新': { en: 'Auto refresh', es: 'Autoactualización' },
    '实时': { en: 'Live', es: 'En vivo' },
    '已暂停': { en: 'Paused', es: 'Pausado' },
    '刷新': { en: 'Refresh', es: 'Actualizar' },
    '详情': { en: 'Details', es: 'Detalles' },
    'FleetView 控制台': { en: 'FleetView Console', es: 'Consola FleetView' },
    '正在初始化…': { en: 'Initializing…', es: 'Inicializando…' },
    '加载中…': { en: 'Loading…', es: 'Cargando…' },
    '页面渲染出错': { en: 'Page render error', es: 'Error al renderizar' },

    /* ---------- 启动消息 ---------- */
    '正在连接 TurboHive…': { en: 'Connecting to TurboHive…', es: 'Conectando a TurboHive…' },
    '正在拉取 TurboHive 设备清单…': { en: 'Fetching TurboHive devices…', es: 'Obteniendo dispositivos TurboHive…' },
    '正在拉取设备状态与实时位置…': { en: 'Fetching status & locations…', es: 'Obteniendo estado y ubicaciones…' },
    '正在拉取 TrackSolidPro 设备清单…': { en: 'Fetching TrackSolidPro devices…', es: 'Obteniendo dispositivos TrackSolidPro…' },
    '正在拉取 TrackSolidPro 实时位置…': { en: 'Fetching TrackSolidPro locations…', es: 'Obteniendo ubicaciones TrackSolidPro…' },
    '正在聚合告警、行程与平台资源…': { en: 'Aggregating alerts, trips & resources…', es: 'Agregando alertas, viajes y recursos…' },
    '已加载 {1} 台设备': { en: '{1} devices loaded', es: '{1} dispositivos cargados' },
    '{1} 台设备': { en: '{1} devices', es: '{1} dispositivos' },
    '告警 / 行程 / 资源数据已就绪': { en: 'Alerts / trips / resources ready', es: 'Alertas / viajes / recursos listos' },

    /* ---------- 通用词 ---------- */
    '在线': { en: 'Online', es: 'En línea' },
    '离线': { en: 'Offline', es: 'Fuera de línea' },
    '未激活': { en: 'Inactive', es: 'Inactivo' },
    '未知': { en: 'Unknown', es: 'Desconocido' },
    '启用': { en: 'Enabled', es: 'Activa' },
    '停用': { en: 'Disabled', es: 'Inactiva' },
    '支持': { en: 'Yes', es: 'Sí' },
    '否': { en: 'No', es: 'No' },
    '是': { en: 'Yes', es: 'Sí' },
    '有效': { en: 'Valid', es: 'Válido' },
    '无': { en: 'None', es: 'Ninguno' },
    '活跃': { en: 'Active', es: 'Activo' },
    '正常': { en: 'OK', es: 'Normal' },
    '刚刚': { en: 'just now', es: 'ahora mismo' },
    '{1} 秒前': { en: '{1}s ago', es: 'hace {1} s' },
    '{1} 分钟前': { en: '{1}m ago', es: 'hace {1} min' },
    '{1} 小时前': { en: '{1}h ago', es: 'hace {1} h' },
    '{1} 天前': { en: '{1}d ago', es: 'hace {1} d' },
    '{1} 告警': { en: 'Alert {1}', es: 'Alerta {1}' },
    '总计': { en: 'Total', es: 'Total' },
    '共': { en: 'Total', es: 'Total' },
    '条 · 第 {1}/{2}': { en: '· Page {1}/{2}', es: '· Pág. {1}/{2}' },
    '页': { en: '', es: '' },
    '首页': { en: 'First', es: 'Primera' },
    '上一页': { en: 'Prev', es: 'Anterior' },
    '下一页': { en: 'Next', es: 'Siguiente' },
    '末页': { en: 'Last', es: 'Última' },
    '导出': { en: 'Export', es: 'Exportar' },
    '导出 CSV': { en: 'Export CSV', es: 'Exportar CSV' },
    '详情': { en: 'Details', es: 'Detalles' },
    '台': { en: '', es: '' },
    '条': { en: '', es: '' },
    '个': { en: '', es: '' },
    '款': { en: '', es: '' },
    '家': { en: '', es: '' },
    '段': { en: '', es: '' },
    '天': { en: '', es: '' },

    /* ---------- 数据词汇（API 归一化值） ---------- */
    '车辆追踪器': { en: 'Vehicle Tracker', es: 'Rastreador de vehículo' },
    '电动车': { en: 'E-bike', es: 'Vehículo eléctrico' },
    '人员定位': { en: 'Personnel', es: 'Personal' },
    '宠物': { en: 'Pet', es: 'Mascota' },
    '无人机': { en: 'Drone', es: 'Dron' },
    '其他': { en: 'Others', es: 'Otros' },
    '其他类型': { en: 'Other types', es: 'Otros tipos' },
    'Tracker': { en: 'Tracker', es: 'Rastreador' },
    'Dashcam': { en: 'Dashcam', es: 'Cám. a bordo' },
    'OBD': { en: 'OBD', es: 'OBD' },
    'Tag': { en: 'Tag', es: 'Tag' },
    /* 常见 TSP 报警名 */
    '超速报警': { en: 'Overspeed Alert', es: 'Alerta de exceso de velocidad' },
    'SOS报警': { en: 'SOS Alert', es: 'Alerta SOS' },
    '拆除报警': { en: 'Tamper Alert', es: 'Alerta de manipulación' },
    '低电报警': { en: 'Low Battery', es: 'Batería baja' },
    '震动报警': { en: 'Vibration Alert', es: 'Alerta de vibración' },
    '移动报警': { en: 'Movement Alert', es: 'Alerta de movimiento' },
    '围栏报警': { en: 'Geofence Alert', es: 'Alerta de geocerca' },
    '离线报警': { en: 'Offline Alert', es: 'Alerta de desconexión' },

    /* ---------- 总览 ---------- */
    '接入设备总数': { en: 'Total Devices', es: 'Total de dispositivos' },
    '在线设备': { en: 'Online Devices', es: 'Dispositivos en línea' },
    '24H 告警': { en: '24H Alerts', es: 'Alertas 24h' },
    '累计里程': { en: 'Total Mileage', es: 'Kilometraje total' },
    '行驶中车辆': { en: 'Moving Vehicles', es: 'Vehículos en movimiento' },
    '在线率 {1}%': { en: 'Online {1}%', es: 'En línea {1}%' },
    '离线 {1}': { en: 'Offline {1}', es: 'Fuera de línea {1}' },
    '· 未激活 {1}': { en: '· Inactive {1}', es: '· Inactivos {1}' },
    '近 {1} 天累计': { en: 'Last {1}d total', es: 'Últimos {1} d' },
    '今日新增': { en: 'Today', es: 'Hoy' },
    '静止 {1} 台': { en: '{1} parked', es: '{1} estacionados' },
    '告警趋势': { en: 'Alert Trend', es: 'Tendencia de alertas' },
    '近 24 小时': { en: 'Last 24 Hours', es: 'Últimas 24 horas' },
    '近 7 天': { en: 'Last 7 Days', es: 'Últimos 7 días' },
    '近 30 天': { en: 'Last 30 Days', es: 'Últimos 30 días' },
    '告警数': { en: 'Alerts', es: 'Alertas' },
    '设备类型分布': { en: 'Device Types', es: 'Tipos de dispositivo' },
    '告警类型 TOP': { en: 'Alert Types TOP', es: 'Tipos de alerta TOP' },
    '暂无告警': { en: 'No alerts', es: 'Sin alertas' },
    '当前时间范围内没有告警记录': { en: 'No alerts in this time range', es: 'Sin alertas en este rango' },
    '设备协议分布': { en: 'Protocol Distribution', es: 'Distribución de protocolos' },
    '暂无数据': { en: 'No data', es: 'Sin datos' },
    '存储用量': { en: 'Storage Usage', es: 'Uso de almacenamiento' },
    '已用': { en: 'Used', es: 'Usado' },
    '剩余': { en: 'Free', es: 'Libre' },
    '对象存储占用': { en: 'Object storage', es: 'Almacenamiento de objetos' },
    '已用容量': { en: 'Used space', es: 'Espacio usado' },
    '配额上限': { en: 'Quota', es: 'Cuota total' },
    '里程排行': { en: 'Mileage Ranking', es: 'Ranking de kilometraje' },
    '暂无里程数据': { en: 'No mileage data', es: 'Sin datos de kilometraje' },
    '最新告警': { en: 'Latest Alerts', es: 'Últimas alertas' },
    '告警': { en: 'Alert', es: 'Alerta' },
    '告警 CSV 已导出': { en: 'Alerts CSV exported', es: 'CSV de alertas exportado' },
    '告警数据已导出': { en: 'Alert data exported', es: 'Datos de alertas exportados' },
    '设备清单已导出': { en: 'Device list exported', es: 'Lista de dispositivos exportada' },
    '行程数据已导出': { en: 'Trip data exported', es: 'Datos de viajes exportados' },
    '里程(km)': { en: 'Mileage (km)', es: 'Km' },

    /* ---------- 设备 ---------- */
    '设备总数': { en: 'Total Devices', es: 'Total de dispositivos' },
    '搜索 IMEI / 设备名称…': { en: 'Search IMEI / name…', es: 'Buscar IMEI / nombre…' },
    '全部平台': { en: 'All Platforms', es: 'Todas las plataformas' },
    '全部类型': { en: 'All Types', es: 'Todos los tipos' },
    '全部状态': { en: 'All Status', es: 'Todos los estados' },
    '设备': { en: 'Device', es: 'Dispositivo' },
    'IMEI': { en: 'IMEI', es: 'IMEI' },
    '平台': { en: 'Platform', es: 'Plataforma' },
    '型号': { en: 'Model', es: 'Modelo' },
    '类型': { en: 'Type', es: 'Tipo' },
    '协议': { en: 'Protocol', es: 'Protocolo' },
    '状态': { en: 'Status', es: 'Estado' },
    '速度': { en: 'Speed', es: 'Velocidad' },
    '最后上报': { en: 'Last Report', es: 'Último reporte' },
    '位置': { en: 'Location', es: 'Ubicación' },
    '没有匹配的设备': { en: 'No matching devices', es: 'Sin dispositivos coincidentes' },
    '请调整筛选条件后重试': { en: 'Adjust filters and retry', es: 'Ajuste los filtros e intente de nuevo' },
    '设备名称': { en: 'Device Name', es: 'Nombre' },
    '设备类型': { en: 'Device Type', es: 'Tipo' },
    '通信协议': { en: 'Protocol', es: 'Protocolo' },
    '在线状态': { en: 'Online Status', es: 'Estado' },
    '方向': { en: 'Course', es: 'Rumbo' },
    '卫星数': { en: 'Satellites', es: 'Satélites' },
    '纬度': { en: 'Latitude', es: 'Latitud' },
    '经度': { en: 'Longitude', es: 'Longitud' },
    '定位时间': { en: 'Fix Time', es: 'Hora de ubicación' },
    '平台原始字段': { en: 'Platform Fields', es: 'Campos de plataforma' },
    '原始响应': { en: 'Raw Response', es: 'Respuesta original' },
    '设备ID': { en: 'Device ID', es: 'ID' },
    '厂商': { en: 'Vendor', es: 'Fabricante' },
    '网关': { en: 'Gateway', es: 'Gateway' },
    '导入时间': { en: 'Imported', es: 'Importado' },
    '备注': { en: 'Remark', es: 'Nota' },
    '含TAG': { en: 'Has TAG', es: 'Con TAG' },
    '设备组': { en: 'Group', es: 'Grupo' },
    '过期时间': { en: 'Expiry', es: 'Vencimiento' },
    '激活时间': { en: 'Activated', es: 'Activación' },
    '定位方式': { en: 'Positioning', es: 'Posicionamiento' },
    '心跳时间': { en: 'Heartbeat', es: 'Latido' },
    'GPS时间': { en: 'GPS Time', es: 'Hora GPS' },
    '累计里程': { en: 'Total Mileage', es: 'Kilometraje total' },
    '客户': { en: 'Customer', es: 'Cliente' },
    '在地图查看': { en: 'View on Map', es: 'Ver en mapa' },
    '查看指令历史': { en: 'Command History', es: 'Historial de comandos' },
    '查询支持指令': { en: 'Supported Commands', es: 'Comandos soportados' },
    '在地图查看位置': { en: 'View on Map', es: 'Ver en mapa' },
    '该设备暂无定位数据': { en: 'No location for this device', es: 'Sin ubicación' },
    '目标点': { en: 'Target', es: 'Objetivo' },

    /* ---------- 地图 ---------- */
    '有定位设备': { en: 'Located Devices', es: 'Con ubicación' },
    '行驶中': { en: 'Moving', es: 'En movimiento' },
    'ACC 开启': { en: 'ACC ON', es: 'ACC ON' },
    '定位时间 <10 分钟': { en: 'Fixed < 10 min', es: 'Ubicado < 10 min' },
    '设备列表': { en: 'Device List', es: 'Lista' },
    '全览': { en: 'Fit all', es: 'Ver todo' },
    '定位到在线设备': { en: 'Locate online devices', es: 'Centrar en línea' },
    '切换底图': { en: 'Switch basemap', es: 'Cambiar mapa base' },
    '状态：': { en: 'Status: ', es: 'Estado: ' },
    '· 速度：': { en: '· Speed: ', es: '· Velocidad: ' },
    'ACC：': { en: 'ACC: ', es: 'ACC: ' },
    '卫星：': { en: 'Sats: ', es: 'Sat.: ' },
    '定位时间：': { en: 'Fix: ', es: 'Ubicación: ' },
    '平台：': { en: 'Platform: ', es: 'Plataforma: ' },
    '（已省略 {1} 个标记，': { en: '({1} markers omitted, ', es: '({1} marcadores omitidos, ' },
    '显示全部': { en: 'show all', es: 'mostrar todos' },
    '仅显示前 {1} 台': { en: 'First {1} only', es: 'Solo primeros {1}' },
    '暂无定位设备': { en: 'No located devices', es: 'Sin dispositivos con ubicación' },
    '底图切换为 {1}': { en: 'Basemap: {1}', es: 'Mapa base: {1}' },
    '当前没有在线设备': { en: 'No online devices', es: 'No hay dispositivos en línea' },
    '正在渲染全部 {1} 个标记，可能略慢…': { en: 'Rendering all {1} markers, may be slow…', es: 'Renderizando {1} marcadores, puede tardar…' },
    'ArcGIS 深色': { en: 'ArcGIS Dark', es: 'ArcGIS Oscuro' },
    'ArcGIS 卫星影像': { en: 'ArcGIS Satellite', es: 'ArcGIS Satélite' },
    'Carto 深色': { en: 'Carto Dark', es: 'Carto Oscuro' },

    /* ---------- 告警 ---------- */
    '告警详情': { en: 'Alert Details', es: 'Detalles de alerta' },
    '告警总数': { en: 'Total Alerts', es: 'Total de alertas' },
    '高危告警': { en: 'Critical Alerts', es: 'Alertas críticas' },
    '中危告警': { en: 'Medium Alerts', es: 'Alertas medias' },
    '涉及设备': { en: 'Devices Involved', es: 'Dispositivos afectados' },
    '告警类型': { en: 'Alert Types', es: 'Tipos de alerta' },
    '碰撞 / 拆除 / 越界等': { en: 'Collision / tamper / geofence etc.', es: 'Colisión / manipulación / geocerca, etc.' },
    '告警类型分布 TOP10': { en: 'Alert Types TOP10', es: 'Tipos de alerta TOP10' },
    '7 天 × 24 小时 告警热力': { en: '7d × 24h Heatmap', es: 'Mapa de calor 7d × 24h' },
    '颜色越深告警越密集': { en: 'Darker = denser alerts', es: 'Más oscuro = más alertas' },
    '搜索 IMEI / 告警名称…': { en: 'Search IMEI / alert…', es: 'Buscar IMEI / alerta…' },
    '全部等级': { en: 'All Levels', es: 'Todos los niveles' },
    '高危': { en: 'Critical', es: 'Crítica' },
    '中危': { en: 'Medium', es: 'Media' },
    '提示': { en: 'Info', es: 'Aviso' },
    '等级': { en: 'Level', es: 'Nivel' },
    '时间': { en: 'Time', es: 'Hora' },
    '告警名称': { en: 'Alert Name', es: 'Nombre de alerta' },
    '描述': { en: 'Description', es: 'Descripción' },
    '告警代码': { en: 'Code', es: 'Código' },
    '发生时间': { en: 'Time', es: 'Hora' },
    '告警等级': { en: 'Level', es: 'Nivel' },
    '没有匹配的告警': { en: 'No matching alerts', es: 'Sin alertas coincidentes' },
    '请调整筛选条件': { en: 'Adjust filters', es: 'Ajuste los filtros' },
    '错误：': { en: 'Error: ', es: 'Error: ' },

    /* ---------- 行程 ---------- */
    '行程详情': { en: 'Trip Details', es: 'Detalles del viaje' },
    '今日里程': { en: 'Today', es: 'Hoy' },
    '本周期里程': { en: 'Period', es: 'Período' },
    '单车均里程': { en: 'Avg / Vehicle', es: 'Prom. por vehículo' },
    '行程记录': { en: 'Trip Records', es: 'Registros de viaje' },
    '30 天里程趋势': { en: '30-Day Mileage Trend', es: 'Tendencia 30 días' },
    '暂无里程趋势': { en: 'No mileage trend', es: 'Sin tendencia' },
    '需要设备参与里程统计': { en: 'Requires devices in mileage stats', es: 'Requiere estadísticas de dispositivos' },
    '单位 km': { en: 'Unit: km', es: 'Unidad: km' },
    '里程 TOP 排行': { en: 'Mileage TOP', es: 'Kilometraje TOP' },
    '今天': { en: 'Today', es: 'Hoy' },
    '开始时间': { en: 'Start Time', es: 'Inicio' },
    '结束时间': { en: 'End Time', es: 'Fin' },
    '时长': { en: 'Duration', es: 'Duración' },
    '距离': { en: 'Distance', es: 'Distancia' },
    '均速': { en: 'Avg Speed', es: 'Vel. media' },
    '起点': { en: 'Start', es: 'Origen' },
    '终点': { en: 'End', es: 'Destino' },
    '轨迹': { en: 'Track', es: 'Ruta' },
    '行驶距离': { en: 'Distance', es: 'Distancia' },
    '行驶时长': { en: 'Duration', es: 'Duración' },
    '平均速度 km/h': { en: 'Avg km/h', es: 'Vel. media km/h' },
    '暂无行程记录': { en: 'No trip records', es: 'Sin registros de viajes' },
    '所选时间范围内没有行程数据': { en: 'No trips in this range', es: 'Sin viajes en este rango' },
    '行程数据已更新（近 {1} 天）': { en: 'Trips updated (last {1} days)', es: 'Viajes actualizados ({1} días)' },
    '行程加载失败：': { en: 'Trip load failed: ', es: 'Error al cargar viajes: ' },
    '{1}日': { en: '{1}', es: '{1}' },

    /* ---------- 围栏 ---------- */
    '围栏总数': { en: 'Total Geofences', es: 'Total de geocercas' },
    '已启用': { en: 'Enabled', es: 'Activadas' },
    '圆形围栏': { en: 'Circle Fences', es: 'Geocercas circulares' },
    '多边形围栏': { en: 'Polygon Fences', es: 'Geocercas poligonales' },
    '围栏列表': { en: 'Fence List', es: 'Lista de geocercas' },
    '暂无围栏': { en: 'No geofences', es: 'Sin geocercas' },
    '尚未创建地理围栏': { en: 'No geofences created yet', es: 'Aún no hay geocercas' },
    '围栏分布': { en: 'Fence Map', es: 'Mapa de geocercas' },
    '圆形 · R=': { en: 'Circle · R=', es: 'Círculo · R=' },
    '多边形 · ': { en: 'Polygon · ', es: 'Polígono · ' },
    ' 顶点': { en: ' vertices', es: ' vértices' },
    '围栏详情': { en: 'Geofence Details', es: 'Detalles de geocerca' },
    '名称': { en: 'Name', es: 'Nombre' },
    '中心纬度': { en: 'Center Lat', es: 'Lat. centro' },
    '中心经度': { en: 'Center Lng', es: 'Lng. centro' },
    '半径': { en: 'Radius', es: 'Radio' },
    '颜色': { en: 'Color', es: 'Color' },
    '绑定设备': { en: 'Bound Devices', es: 'Dispositivos vinculados' },
    '顶点': { en: 'Vertices', es: 'Vértices' },
    '来源': { en: 'Source', es: 'Origen' },
    '创建时间': { en: 'Created', es: 'Creada' },
    '更新时间': { en: 'Updated', es: 'Actualizada' },

    /* ---------- 平台资源 ---------- */
    '网关总数': { en: 'Total Gateways', es: 'Total de gateways' },
    '活跃网关': { en: 'Active Gateways', es: 'Gateways activos' },
    '接入连接数': { en: 'Connections', es: 'Conexiones' },
    '设备型号': { en: 'Device Models', es: 'Modelos' },
    '网关': { en: 'Gateways', es: 'Gateways' },
    '厂商': { en: 'Vendors', es: 'Fabricantes' },
    '指令历史': { en: 'Command History', es: 'Historial de comandos' },
    '编码': { en: 'Code', es: 'Código' },
    '地址': { en: 'Host', es: 'Dirección' },
    '端口': { en: 'Port', es: 'Puerto' },
    '连接设备': { en: 'Devices', es: 'Dispositivos' },
    '运行时长': { en: 'Uptime', es: 'Tiempo activo' },
    '型号名称': { en: 'Model Name', es: 'Nombre' },
    '通道': { en: 'Channels', es: 'Canales' },
    '固件': { en: 'Firmware', es: 'Firmware' },
    '官网': { en: 'Website', es: 'Sitio web' },
    '邮箱': { en: 'Email', es: 'Correo' },
    '电话': { en: 'Phone', es: 'Teléfono' },
    '{1} 款': { en: '{1} models', es: '{1} modelos' },
    '名称': { en: 'Name', es: 'Nombre' },
    '用量': { en: 'Usage', es: 'Uso' },
    '有效期': { en: 'Validity', es: 'Vigencia' },
    '指令内容': { en: 'Command', es: 'Comando' },
    '格式': { en: 'Format', es: 'Formato' },
    '下发时间': { en: 'Sent At', es: 'Enviado' },
    '响应时间': { en: 'Response At', es: 'Respuesta' },
    '指令号': { en: 'Cmd No.', es: 'Nº cmd' },
    '已响应': { en: 'Responded', es: 'Respondido' },
    '待响应': { en: 'Pending', es: 'Pendiente' },
    '暂无网关': { en: 'No gateways', es: 'Sin gateways' },
    '暂无型号': { en: 'No models', es: 'Sin modelos' },
    '暂无厂商': { en: 'No vendors', es: 'Sin fabricantes' },
    '暂无 Token': { en: 'No tokens', es: 'Sin tokens' },
    '暂无指令记录': { en: 'No command records', es: 'Sin comandos' },
    '正在加载指令历史…': { en: 'Loading history…', es: 'Cargando historial…' },
    '无法加载指令历史': { en: 'Cannot load command history', es: 'No se pudo cargar el historial' },
    ' 加载指令历史…': { en: 'Loading history…', es: 'Cargando historial…' },
    '的 /v3/command/history/page 接口未开放 CORS 预检（OPTIONS 返回 403），浏览器端无法直接调用。该接口需通过服务端代理访问。':
      { en: '/v3/command/history/page does not allow CORS preflight (OPTIONS 403) — browsers cannot call it directly. A server-side proxy is required.', es: 'El endpoint /v3/command/history/page no permite preflight CORS (OPTIONS 403); el navegador no puede llamarlo directamente. Se requiere un proxy del lado servidor.' },
    '未开放 CORS 预检（OPTIONS 403），浏览器端无法直连，需服务端代理。':
      { en: 'CORS preflight not allowed (OPTIONS 403) — browsers cannot call it directly; a server-side proxy is required.', es: 'Preflight CORS no permitido (OPTIONS 403); se requiere proxy del lado servidor.' },

    /* ---------- 媒体 ---------- */
    '媒体文件': { en: 'Media Files', es: 'Archivos multimedia' },
    '图片 / 视频': { en: 'Photos / Videos', es: 'Fotos / Vídeos' },
    '本页体积': { en: 'Page Size', es: 'Tamaño de página' },
    '存储占用': { en: 'Storage', es: 'Almacenamiento' },
    '媒体库': { en: 'Media Library', es: 'Biblioteca' },
    '图片': { en: 'Photo', es: 'Foto' },
    '视频': { en: 'Video', es: 'Vídeo' },
    '暂无媒体文件': { en: 'No media files', es: 'Sin archivos' },
    '设备尚未上传抓拍或录像': { en: 'No snapshots or recordings yet', es: 'Aún no hay capturas ni grabaciones' },
    '媒体详情': { en: 'Media Details', es: 'Detalles multimedia' },
    '文件名': { en: 'Filename', es: 'Archivo' },
    '大小': { en: 'Size', es: 'Tamaño' },
    '事件类型': { en: 'Event Type', es: 'Tipo de evento' },
    '抓拍时间': { en: 'Capture Time', es: 'Hora de captura' },
    '存储通道': { en: 'Storage CH', es: 'Canal almac.' },
    '路径': { en: 'Path', es: 'Ruta' },
    '在新窗口打开': { en: 'Open in new tab', es: 'Abrir en pestaña nueva' },
    '媒体库已刷新': { en: 'Library refreshed', es: 'Biblioteca actualizada' },

    /* ---------- API 控制台 ---------- */
    '选择一个接口': { en: 'Select an endpoint', es: 'Seleccione una API' },
    '发送请求': { en: 'Send Request', es: 'Enviar' },
    '请求参数 (JSON / Query)': { en: 'Params (JSON / Query)', es: 'Parámetros (JSON / Query)' },
    '响应': { en: 'Response', es: 'Respuesta' },
    '复制': { en: 'Copy', es: 'Copiar' },
    '// 等待请求…': { en: '// Waiting for request…', es: '// Esperando solicitud…' },
    '// 请求中…': { en: '// Requesting…', es: '// Solicitando…' },
    '请求日志': { en: 'Request Log', es: 'Registro de solicitudes' },
    'TrackSolidPro 最近调用': { en: 'Recent TSP calls', es: 'Llamadas recientes de TSP' },
    '清空': { en: 'Clear', es: 'Limpiar' },
    '方法': { en: 'Method', es: 'Método' },
    '参数': { en: 'Params', es: 'Parámetros' },
    '耗时': { en: 'Time', es: 'Tiempo' },
    '暂无调用日志': { en: 'No call logs', es: 'Sin registros' },
    '在左侧选择 TrackSolidPro 接口并发送请求': { en: 'Pick a TrackSolidPro endpoint and send a request', es: 'Elija un endpoint de TrackSolidPro y envíe una solicitud' },
    '请先选择一个接口': { en: 'Select an endpoint first', es: 'Primero seleccione una API' },
    '响应已复制': { en: 'Response copied', es: 'Respuesta copiada' },
    '当前浏览器不支持剪贴板': { en: 'Clipboard not supported', es: 'Portapapeles no soportado' },
    '参数 JSON 解析失败：': { en: 'Params JSON error: ', es: 'Error JSON: ' },
    '耗时 {1} ms': { en: '{1} ms', es: '{1} ms' },
    '失败 · {1} ms': { en: 'Failed · {1} ms', es: 'Error · {1} ms' },
    '总耗时 {1} ms': { en: 'Total {1} ms', es: 'Total {1} ms' },
    'TurboHive 使用 Bearer JWT；TrackSolidPro 使用 MD5 签名 + access_token（自动计算）。':
      { en: 'TurboHive uses Bearer JWT; TrackSolidPro uses MD5 signature + access_token (computed automatically).', es: 'TurboHive usa JWT Bearer; TrackSolidPro usa firma MD5 + access_token (calculado automáticamente).' },
    'TurboHive 端点：GET 参数将作为 query string，POST 参数作为 JSON body。Base: ':
      { en: 'TurboHive endpoint: GET params → query string, POST params → JSON body. Base: ', es: 'Endpoint TurboHive: GET → query string, POST → cuerpo JSON. Base: ' },
    'TrackSolidPro 端点：所有参数以 form-urlencoded 提交，签名 sign 由前端自动按 MD5(appSecret + 排序串 + appSecret) 计算。Base: ':
      { en: 'TSP endpoint: all params sent as form-urlencoded; sign computed client-side as MD5(appSecret + sorted string + appSecret). Base: ', es: 'Endpoint TSP: parámetros form-urlencoded; sign = MD5(appSecret + cadena ordenada + appSecret). Base: ' },
    /* 接口描述 */
    '用户登录': { en: 'Login', es: 'Iniciar sesión' },
    '分页查询设备': { en: 'Device page', es: 'Paginación de dispositivos' },
    '批量查询设备状态': { en: 'Bulk device status', es: 'Estado por lotes' },
    '设备实时位置': { en: 'Realtime location', es: 'Ubicación en tiempo real' },
    '分页查询告警': { en: 'Alert page', es: 'Paginación de alertas' },
    '分页查询行程': { en: 'Trip page', es: 'Paginación de viajes' },
    '实时里程': { en: 'Realtime mileage', es: 'Kilometraje en vivo' },
    '每日里程': { en: 'Daily mileage', es: 'Kilometraje diario' },
    '分页查询围栏': { en: 'Geofence page', es: 'Paginación de geocercas' },
    '分页查询网关': { en: 'Gateway page', es: 'Paginación de gateways' },
    '查询所有型号': { en: 'All models', es: 'Todos los modelos' },
    '查询所有厂商': { en: 'All vendors', es: 'Todos los fabricantes' },
    '媒体资源分页': { en: 'Media page', es: 'Paginación multimedia' },
    '存储用量统计': { en: 'Storage usage', es: 'Uso de almacenamiento' },
    'API Token 分页': { en: 'Token page', es: 'Paginación de tokens' },
    '网关列表': { en: 'Gateway list', es: 'Lista de gateways' },
    '查询 OBD 数据': { en: 'OBD data', es: 'Datos OBD' },
    '逆地理编码': { en: 'Reverse geocoding', es: 'Geocodificación inversa' },
    '获取 access_token': { en: 'Get access_token', es: 'Obtener access_token' },
    '子账号设备列表': { en: 'Sub-account devices', es: 'Dispositivos de subcuenta' },
    '按账号获取设备位置': { en: 'Locations by account', es: 'Ubicaciones por cuenta' },
    '指定设备位置': { en: 'Location by IMEI', es: 'Ubicación por IMEI' },
    '设备告警列表': { en: 'Alarm list', es: 'Lista de alarmas' },
    '设备轨迹数据': { en: 'Track data', es: 'Datos de trayectoria' },
    '设备里程数据': { en: 'Mileage data', es: 'Datos de kilometraje' },
    '行程报表': { en: 'Trips report', es: 'Reporte de viajes' },
    '平台围栏列表': { en: 'Fence list', es: 'Lista de geocercas' },
    '设备分组列表': { en: 'Device groups', es: 'Grupos de dispositivos' },
    '设备支持指令': { en: 'Supported instructions', es: 'Instrucciones soportadas' },
    'OBD 数据': { en: 'OBD data', es: 'Datos OBD' },
    '获取告警视频': { en: 'Fetch alert video', es: 'Obtener vídeo de alerta' },
    '开启实时视频': { en: 'Start live video', es: 'Iniciar vídeo en vivo' },
    '停止实时视频': { en: 'Stop live video', es: 'Detener vídeo' },
    '录像回放开始': { en: 'Start playback', es: 'Iniciar reproducción' },
    '录像回放控制': { en: 'Playback control', es: 'Control de reproducción' },
    '视频文件列表': { en: 'Video file list', es: 'Lista de archivos' },
    '远程抓拍': { en: 'Remote capture', es: 'Captura remota' },

    /* ---------- 设置 ---------- */
    '测试连接': { en: 'Test', es: 'Probar conexión' },
    '测试中': { en: 'Testing…', es: 'Probando…' },
    '服务地址 Base URL': { en: 'Base URL', es: 'URL base' },
    '登录邮箱': { en: 'Email', es: 'Correo' },
    '登录密码': { en: 'Password', es: 'Contraseña' },
    'Bearer Token（可直接粘贴，留空则自动登录）': { en: 'Bearer Token (paste directly; blank = auto-login)', es: 'Token Bearer (pegue aquí; vacío = inicio automático)' },
    '认证方式：': { en: 'Auth: ', es: 'Autenticación: ' },
    '。若 Token 失效（code 1101），系统会自动用邮箱密码重新登录换取新 Token。':
      { en: ' If the token expires (code 1101), the system automatically re-logs in with email/password.', es: ' Si el token expira (código 1101), el sistema vuelve a iniciar sesión automáticamente.' },
    '服务地址 Request URL': { en: 'Request URL', es: 'URL de solicitud' },
    '账号 Account': { en: 'Account', es: 'Cuenta' },
    '。sign = MD5(appSecret + 按 key 升序拼接的参数串 + appSecret)，结果大写。access_token 有效期 2 小时，自动缓存刷新。':
      { en: ' sign = MD5(appSecret + key-sorted param string + appSecret), uppercase. access_token valid 2h, auto-cached.', es: ' sign = MD5(appSecret + cadena ordenada + appSecret), en mayúsculas. access_token válido 2 h, caché automática.' },
    '应用偏好': { en: 'Preferences', es: 'Preferencias' },
    '按设定间隔轮询设备与告警数据': { en: 'Poll devices & alerts at the set interval', es: 'Sondear dispositivos y alertas' },
    '刷新间隔（秒）': { en: 'Refresh Interval (s)', es: 'Intervalo (s)' },
    '地图底图': { en: 'Basemap', es: 'Mapa base' },
    '界面语言': { en: 'Language', es: 'Idioma' },
    '默认每页条数': { en: 'Page Size', es: 'Filas por página' },
    '连接自检': { en: 'Self-check', es: 'Autodiagnóstico' },
    '实时探测两端点可用性': { en: 'Probe both endpoints live', es: 'Probar ambos endpoints' },
    '点击下方按钮开始检测': { en: 'Click below to start', es: 'Haga clic para iniciar' },
    '将依次请求 TurboHive 设备分页与 TSP 设备列表': { en: 'Will query TurboHive devices & TSP device list', es: 'Consultará dispositivos TurboHive y TSP' },
    '保存并重连': { en: 'Save & Reconnect', es: 'Guardar y reconectar' },
    '运行自检': { en: 'Run Self-check', es: 'Ejecutar autodiagnóstico' },
    '恢复默认凭据': { en: 'Reset Credentials', es: 'Restaurar credenciales' },
    '⚠️ 本应用为纯前端 Demo，凭据保存在浏览器 localStorage。生产环境请将签名与密钥置于服务端。':
      { en: '⚠️ Pure front-end demo; credentials stored in browser localStorage. In production, keep signing & secrets server-side.', es: '⚠️ Demo puramente front-end; credenciales en localStorage. En producción, mantenga las claves en el servidor.' },
    '配置已保存，正在重新连接…': { en: 'Saved, reconnecting…', es: 'Guardado, reconectando…' },
    'TurboHive 连接正常': { en: 'TurboHive connected', es: 'TurboHive conectado' },
    'TrackSolidPro 连接正常': { en: 'TrackSolidPro connected', es: 'TrackSolidPro conectado' },
    '连接失败': { en: 'Failed', es: 'Error de conexión' },
    '已恢复默认凭据，正在重新加载…': { en: 'Credentials reset, reloading…', es: 'Credenciales restauradas, recargando…' },
    '正在探测…': { en: 'Probing…', es: 'Probando…' },
    '返回 {1} 台设备': { en: 'Returned {1} devices', es: 'Devueltos {1} dispositivos' },
    '正在刷新数据…': { en: 'Refreshing…', es: 'Actualizando…' },
    '数据已刷新': { en: 'Data refreshed', es: 'Datos actualizados' },
    '时间范围：': { en: 'Time range: ', es: 'Rango: ' },
    '已开启自动刷新': { en: 'Auto refresh on', es: 'Autoactualización activada' },
    '已暂停自动刷新': { en: 'Auto refresh paused', es: 'Autoactualización pausada' },
    '尚未启用任何数据源，请前往「接入设置」配置': { en: 'No data source enabled — configure in Settings', es: 'Ninguna fuente activada; configure en Ajustes' },
    '实时 {1}s': { en: 'Live {1}s', es: 'En vivo {1}s' },
    '查询设备支持指令…': { en: 'Querying supported commands…', es: 'Consultando comandos…' },
    '查询失败': { en: 'Query failed', es: 'Error de consulta' },
    '该设备无可用指令': { en: 'No available commands', es: 'Sin comandos disponibles' },
    '离线可发': { en: 'Offline OK', es: 'Offline' },
    '加载指令历史…': { en: 'Loading history…', es: 'Cargando historial…' },
    '指令': { en: 'Command', es: 'Comando' },
    '下发': { en: 'Sent', es: 'Enviado' },
    'TurboHive 数据加载失败：': { en: 'TurboHive load failed: ', es: 'Error al cargar TurboHive: ' },
    'TrackSolidPro 数据加载失败：': { en: 'TrackSolidPro load failed: ', es: 'Error al cargar TrackSolidPro: ' },

    /* ---------- 实时视频 ---------- */
    '视频监控': { en: 'Video Monitoring', es: 'Monitorización de vídeo' },
    '实时预览': { en: 'Live Preview', es: 'Vista en vivo' },
    '录像回放': { en: 'Playback', es: 'Reproducción' },
    '远程抓拍': { en: 'Remote Capture', es: 'Captura remota' },
    '选择设备': { en: 'Device', es: 'Dispositivo' },
    '通道': { en: 'Channel', es: 'Canal' },
    '码流': { en: 'Stream', es: 'Flujo' },
    '主码流': { en: 'Main stream', es: 'Flujo principal' },
    '子码流': { en: 'Sub stream', es: 'Flujo secundario' },
    '仅视频': { en: 'Video only', es: 'Solo vídeo' },
    '音视频': { en: 'Audio + Video', es: 'Audio + vídeo' },
    '开启直播': { en: 'Start Live', es: 'Iniciar directo' },
    '停止直播': { en: 'Stop Live', es: 'Detener' },
    '抓拍照片': { en: 'Snapshot', es: 'Capturar foto' },
    '录制视频': { en: 'Record', es: 'Grabar' },
    '流地址': { en: 'Stream URLs', es: 'URLs de flujo' },
    '等待开启直播…': { en: 'Waiting for live stream…', es: 'Esperando transmisión…' },
    '直播中': { en: 'LIVE', es: 'EN VIVO' },
    '查询录像文件': { en: 'Search Recordings', es: 'Buscar grabaciones' },
    '最近 24 小时': { en: 'Last 24h', es: 'Últimas 24h' },
    '最近 7 天': { en: 'Last 7 days', es: 'Últimos 7 días' },
    '最近 30 天': { en: 'Last 30 days', es: 'Últimos 30 días' },
    '文件名': { en: 'Filename', es: 'Archivo' },
    '开始': { en: 'Start', es: 'Inicio' },
    '结束': { en: 'End', es: 'Fin' },
    '大小': { en: 'Size', es: 'Tamaño' },
    '存储': { en: 'Storage', es: 'Almac.' },
    '回放所选 (≤8 个)': { en: 'Play Selected (≤8)', es: 'Reproducir (≤8)' },
    '暂无录像文件': { en: 'No recordings', es: 'Sin grabaciones' },
    '已选 {1} / 8 个文件': { en: '{1} / 8 files selected', es: '{1} / 8 archivos' },
    '回放中': { en: 'PLAYBACK', es: 'REPRODUCCIÓN' },
    '结束回放': { en: 'End Playback', es: 'Terminar' },
    '设备未在线或不支持视频': { en: 'Device offline or video unsupported', es: 'Dispositivo fuera de línea o sin vídeo' },
    '仅行车记录仪设备支持视频功能': { en: 'Only dashcam devices support video', es: 'Solo las cámaras a bordo admiten vídeo' },
    '流媒体服务暂不可用（演示环境服务器返回错误），接口链路已验证：': { en: 'Streaming service unavailable (demo server error). API chain verified: ', es: 'Servicio de streaming no disponible (error del servidor demo). Cadena API verificada: ' },
    '浏览器暂不支持该流格式，可尝试直接打开流地址：': { en: 'Browser cannot play this stream. Try opening the URL directly: ', es: 'El navegador no puede reproducir este flujo. Abra la URL directamente: ' },
    '正在加载播放组件…': { en: 'Loading player…', es: 'Cargando reproductor…' },
    '抓拍指令已下发（异步），照片稍后可在媒体资源页查看': { en: 'Capture command sent (async). Photos will appear in Media shortly', es: 'Captura enviada (async). Las fotos aparecerán en Multimedia' },
    '视频抓取指令已下发，设备将通过 MQTT 异步上传，完成后可在媒体资源页查看': { en: 'Video fetch command sent; device uploads via MQTT async, then appears in Media', es: 'Comando enviado; el dispositivo sube el vídeo por MQTT y aparecerá en Multimedia' },
    '该告警没有关联的事件视频': { en: 'This alert has no associated event video', es: 'Esta alerta no tiene vídeo asociado' },

    /* ---------- OBD ---------- */
    'OBD 数据分析': { en: 'OBD Analytics', es: 'Análisis OBD' },
    '车速曲线': { en: 'Speed Curve', es: 'Curva de velocidad' },
    '转速曲线': { en: 'RPM Curve', es: 'Curva de RPM' },
    '油耗分析': { en: 'Fuel Analysis', es: 'Análisis de combustible' },
    '电压与温度': { en: 'Voltage & Temperature', es: 'Voltaje y temperatura' },
    '节气门开度': { en: 'Throttle', es: 'Acelerador' },
    '驾驶行为分析': { en: 'Driving Behavior', es: 'Comportamiento de conducción' },
    '急加速': { en: 'Harsh Accel', es: 'Aceleración brusca' },
    '急刹车': { en: 'Harsh Brake', es: 'Frenada brusca' },
    '超速': { en: 'Overspeed', es: 'Exceso de velocidad' },
    '怠速时长': { en: 'Idle Time', es: 'Tiempo en ralentí' },
    '怠速占比': { en: 'Idle Ratio', es: 'Ratio de ralentí' },
    '健康评分': { en: 'Health Score', es: 'Puntuación de salud' },
    '应用建议': { en: 'Actionable Insights', es: 'Recomendaciones' },
    '电池健康': { en: 'Battery Health', es: 'Salud de batería' },
    '燃油效率': { en: 'Fuel Efficiency', es: 'Eficiencia de combustible' },
    '保养提示': { en: 'Maintenance', es: 'Mantenimiento' },
    '综合评估': { en: 'Assessment', es: 'Evaluación' },
    '最新数据': { en: 'Latest Records', es: 'Últimos registros' },
    '最高车速': { en: 'Max Speed', es: 'Vel. máxima' },
    '平均车速': { en: 'Avg Speed', es: 'Vel. media' },
    '平均转速': { en: 'Avg RPM', es: 'RPM media' },
    '平均油耗': { en: 'Avg Consumption', es: 'Consumo medio' },
    '电瓶电压': { en: 'Battery Voltage', es: 'Voltaje de batería' },
    '发动机运行': { en: 'Engine Runtime', es: 'Motor en marcha' },
    '总里程': { en: 'Odometer', es: 'Odómetro' },
    '记录': { en: 'Records', es: 'Registros' },
    '该设备暂无 OBD 数据': { en: 'No OBD data for this device', es: 'Sin datos OBD' },
    '所选时间范围内没有 OBD 上报，请更换设备或扩大时间范围': { en: 'No OBD reports in range — try another device or widen the range', es: 'Sin informes OBD en el rango; pruebe otro dispositivo o amplíe el rango' },
    '车速 km/h': { en: 'Speed (km/h)', es: 'Velocidad (km/h)' },
    '转速 r/min': { en: 'RPM (r/min)', es: 'RPM (r/min)' },
    '瞬时油耗 L/h': { en: 'Instant (L/h)', es: 'Instantáneo (L/h)' },
    '电压 V': { en: 'Voltage (V)', es: 'Voltaje (V)' },
    '温度 °C': { en: 'Temp (°C)', es: 'Temp (°C)' },
    '水温': { en: 'Coolant', es: 'Refrigerante' },
    '进气温度': { en: 'Intake Air', es: 'Aire de admisión' },
    '时间范围': { en: 'Time Range', es: 'Rango de tiempo' },
    '燃油成本估算': { en: 'Fuel Cost Est.', es: 'Est. coste combustible' },
    '基于平均油耗与里程估算': { en: 'Based on avg consumption & mileage', es: 'Según consumo medio y kilometraje' },

    /* ---------- ADAS/DMS ---------- */
    'ADAS/DMS 智能筛选': { en: 'ADAS/DMS AI Filter', es: 'Filtro IA ADAS/DMS' },
    '事件总数': { en: 'Total Events', es: 'Total de eventos' },
    '高风险事件': { en: 'High-Risk Events', es: 'Eventos de alto riesgo' },
    '平均风险分': { en: 'Avg Risk Score', es: 'Riesgo medio' },
    '可关联视频': { en: 'Video-linked', es: 'Con vídeo' },
    'AI 筛选': { en: 'AI Filter', es: 'Filtro IA' },
    '风险评分': { en: 'Risk Score', es: 'Puntuación de riesgo' },
    '风险分布': { en: 'Risk Distribution', es: 'Distribución de riesgo' },
    '事件列表': { en: 'Event List', es: 'Lista de eventos' },
    '车辆风险排名': { en: 'Vehicle Risk Ranking', es: 'Ranking de riesgo' },
    'AI 综合结论': { en: 'AI Summary', es: 'Resumen IA' },
    '全部类别': { en: 'All Categories', es: 'Todas las categorías' },
    'ADAS 事件': { en: 'ADAS Events', es: 'Eventos ADAS' },
    'DMS 事件': { en: 'DMS Events', es: 'Eventos DMS' },
    '视频设备故障': { en: 'Video Device Faults', es: 'Fallos de vídeo' },
    '最低风险分': { en: 'Min Risk Score', es: 'Riesgo mínimo' },
    '筛选': { en: 'Filter', es: 'Filtrar' },
    '按风险分排序': { en: 'By risk score', es: 'Por riesgo' },
    '按时间排序': { en: 'By time', es: 'Por fecha' },
    '获取视频': { en: 'Fetch Video', es: 'Obtener vídeo' },
    '高风险': { en: 'HIGH', es: 'ALTO' },
    '中风险': { en: 'MED', es: 'MEDIO' },
    '低风险': { en: 'LOW', es: 'BAJO' },
    '暂无 ADAS/DMS 事件': { en: 'No ADAS/DMS events', es: 'Sin eventos ADAS/DMS' },
    '当前告警数据中没有 ADAS/DMS 类事件（264-x / 265-x / 266-x），规则引擎已就绪，事件上报后将自动评分': { en: 'No ADAS/DMS events (264-x / 265-x / 266-x) in current data. The rule engine is ready and will auto-score new events.', es: 'No hay eventos ADAS/DMS (264-x / 265-x / 266-x). El motor de reglas está listo y puntuará nuevos eventos.' },
    '车道偏离': { en: 'Lane Departure', es: 'Salida de carril' },
    '行人碰撞': { en: 'Pedestrian Collision', es: 'Colisión con peatón' },
    '前向碰撞': { en: 'Forward Collision', es: 'Colisión frontal' },
    '车距过近': { en: 'Headway', es: 'Distancia corta' },
    '限速识别': { en: 'Speed Sign', es: 'Señal de velocidad' },
    '疲劳驾驶': { en: 'Fatigue', es: 'Fatiga' },
    '接打电话': { en: 'Phone Use', es: 'Uso del teléfono' },
    '抽烟': { en: 'Smoking', es: 'Fumar' },
    '未系安全带': { en: 'Seatbelt', es: 'Cinturón' },
    '分神驾驶': { en: 'Distraction', es: 'Distracción' },
    '摄像头故障': { en: 'Camera Failure', es: 'Fallo de cámara' },
    '视频信号丢失': { en: 'Video Signal Lost', es: 'Señal de vídeo perdida' },
    '存储故障': { en: 'Storage Failure', es: 'Fallo de almacenamiento' },
    '规则引擎说明': { en: 'Rule Engine Notes', es: 'Notas del motor' },
    '评分 = 事件类型基准分 + 时间新近度加成（24h 内 +8 / 7 天内 +4）+ 同设备同类频次加成（≤10），用于优先审查排序':
      { en: 'Score = type base weight + recency bonus (+8 ≤24h / +4 ≤7d) + per-device frequency bonus (≤10), used to prioritize video review.', es: 'Puntuación = peso base del tipo + bono de recencia (+8 ≤24h / +4 ≤7d) + bono de frecuencia (≤10), para priorizar la revisión de vídeo.' },

    /* ---------- 新页面描述 / 视频 / OBD / ADAS 补充 ---------- */
    '行车记录仪实时预览、录像回放与远程抓拍': { en: 'Dashcam live preview, playback & remote capture', es: 'Vista en vivo, reproducción y captura remota' },
    '车辆工况数据可视化与驾驶行为应用': { en: 'Vehicle CAN data visualization & driving insights', es: 'Visualización de datos CAN y conducción' },
    '告警视频风险评分与 AI 优先级审查': { en: 'Alert-video risk scoring & AI review priority', es: 'Puntuación de riesgo y revisión priorizada por IA' },
    '数据来源：TurboHive /v3/obd（CAN 总线实时工况）': { en: 'Source: TurboHive /v3/obd (realtime CAN bus)', es: 'Fuente: TurboHive /v3/obd (bus CAN en tiempo real)' },
    '暂无 OBD 设备': { en: 'No OBD devices', es: 'Sin dispositivos OBD' },
    '接入 OBD 设备后即可查看工况数据': { en: 'Connect OBD devices to view CAN data', es: 'Conecte dispositivos OBD para ver datos CAN' },
    'OBD 数据加载失败': { en: 'OBD load failed', es: 'Error al cargar OBD' },
    '正在加载 OBD 数据…': { en: 'Loading OBD data…', es: 'Cargando datos OBD…' },
    '查询数据': { en: 'Load Data', es: 'Cargar datos' },
    '该设备暂无 OBD 数据': { en: 'No OBD data for this device', es: 'Sin datos OBD para este dispositivo' },
    '所选时间范围内没有 OBD 上报，请更换设备或扩大时间范围': { en: 'No OBD reports in this range — try another device or widen the range', es: 'Sin informes OBD en el rango; pruebe otro dispositivo o amplíe el rango' },
    '请先选择设备': { en: 'Select a device first', es: 'Primero seleccione un dispositivo' },
    '正在建立直播连接…': { en: 'Establishing live connection…', es: 'Estableciendo conexión…' },
    '等待开启直播…': { en: 'Waiting for live stream…', es: 'Esperando transmisión…' },
    '选择设备与通道后点击「开启直播」，支持 HLS / FLV 流': { en: 'Pick a device & channel, then click "Start Live" (HLS / FLV)', es: 'Elija dispositivo y canal, luego pulse «Iniciar directo» (HLS / FLV)' },
    '直播开启失败': { en: 'Live start failed', es: 'Error al iniciar directo' },
    '回放开启失败': { en: 'Playback start failed', es: 'Error al iniciar reproducción' },
    '最多选择 8 个文件': { en: 'Up to 8 files', es: 'Máximo 8 archivos' },
    '该时间范围内设备没有录像，或设备不在线': { en: 'No recordings in this range, or device offline', es: 'Sin grabaciones en el rango o dispositivo fuera de línea' },
    '选择时间范围后点击「查询录像文件」': { en: 'Pick a time range and click "Search Recordings"', es: 'Elija un rango y pulse «Buscar grabaciones»' },
    '主存': { en: 'Main', es: 'Principal' },
    '灾备': { en: 'Backup', es: 'Respaldo' },
    '设备忙碌中，请稍后再试': { en: 'Device busy, retry later', es: 'Dispositivo ocupado, reintente' },
    '播放链路说明': { en: 'Playback Pipeline', es: 'Cadena de reproducción' },
    '设备视频能力': { en: 'Device Video Capability', es: 'Capacidad de vídeo' },
    '最近 {1} 条 CAN 上报': { en: 'Last {1} CAN reports', es: 'Últimos {1} informes CAN' },
    '超速 (>120km/h)': { en: 'Overspeed (>120km/h)', es: 'Exceso (>120km/h)' },
    '次数': { en: 'Count', es: 'Veces' },
    '得分': { en: 'Score', es: 'Puntos' },
    '优秀 · {1} 分制': { en: 'Excellent · /{1}', es: 'Excelente · /{1}' },
    '良好 · {1} 分制': { en: 'Good · /{1}', es: 'Buena · /{1}' },
    '一般 · {1} 分制': { en: 'Fair · /{1}', es: 'Regular · /{1}' },
    '需改善 · {1} 分制': { en: 'Needs work · /{1}', es: 'A mejorar · /{1}' },
    '优秀': { en: 'Excellent', es: 'Excelente' },
    '良好': { en: 'Good', es: 'Buena' },
    '一般': { en: 'Fair', es: 'Regular' },
    '需改善': { en: 'Needs work', es: 'A mejorar' },
    'ADAS = 高级驾驶辅助 · DMS = 驾驶员状态监测': { en: 'ADAS = Advanced Driver Assistance · DMS = Driver Monitoring', es: 'ADAS = asistencia al conductor · DMS = monitorización del conductor' },
    '没有匹配的事件': { en: 'No matching events', es: 'Sin eventos coincidentes' },
    '调整类别或最低风险分后重试': { en: 'Adjust category or min score and retry', es: 'Ajuste categoría o puntaje mínimo' },
    '正在下发 VIDEOUPLOAD 指令…': { en: 'Sending VIDEOUPLOAD command…', es: 'Enviando comando VIDEOUPLOAD…' },
    '指令下发成功（异步）': { en: 'Command sent (async)', es: 'Comando enviado (async)' },
    '设备将通过 MQTT 异步上传事件视频，上传完成后可在「媒体资源」页查看。': { en: 'The device uploads the event video via MQTT asynchronously; it will appear in Media when done. ', es: 'El dispositivo sube el vídeo por MQTT de forma asíncrona; aparecerá en Multimedia.' },
    '指令号：': { en: 'Cmd No.: ', es: 'Nº cmd: ' },
    '设备离线，无法下发视频抓取指令': { en: 'Device offline — cannot send video fetch command', es: 'Dispositivo fuera de línea' },
    '设备不支持视频抓取功能': { en: 'Device does not support video fetch', es: 'El dispositivo no admite captura de vídeo' },
    '视频抓取指令下发失败（设备通信异常）': { en: 'Video fetch command failed (device communication error)', es: 'Error al enviar comando (comunicación)' },
    '告警视频抓取': { en: 'Alert Video Fetch', es: 'Captura de vídeo de alerta' },
    '事件': { en: 'Events', es: 'Eventos' },
    '高风险 ≥75': { en: 'High ≥75', es: 'Alto ≥75' },
    '中风险 50–74': { en: 'Medium 50–74', es: 'Medio 50–74' },
    '低风险 <50': { en: 'Low <50', es: 'Bajo <50' },
    '等待事件数据': { en: 'Waiting for events', es: 'Esperando eventos' },
    '规则引擎将基于事件类型、新近度与频次自动生成审查建议': { en: 'The rule engine will auto-generate review advice from type, recency & frequency', es: 'El motor generará recomendaciones según tipo, recencia y frecuencia' },
    '评分模型': { en: 'Model', es: 'Modelo' },
    '：评分 = 事件类型基准分 + 时间新近度加成（24h 内 +8 / 7 天内 +4）+ 同设备同类频次加成（≤10），用于优先审查排序': { en: ': score = type base + recency (+8 ≤24h / +4 ≤7d) + frequency bonus (≤10), for review priority.', es: ': puntuación = base + recencia (+8 ≤24h / +4 ≤7d) + frecuencia (≤10), prioriza la revisión.' },
    '基准分': { en: 'Base weights', es: 'Pesos base' },
    '：行人碰撞 95 · 前向碰撞 92 · 疲劳驾驶 90 · 接打电话 85 · 车道偏离 72 · 摄像头故障 35 等': { en: ': pedestrian 95 · forward collision 92 · fatigue 90 · phone 85 · lane departure 72 · camera fault 35, etc.', es: ': peatón 95 · colisión frontal 92 · fatiga 90 · teléfono 85 · carril 72 · cámara 35, etc.' },
    '审查流': { en: 'Review flow', es: 'Flujo de revisión' },
    '：高风险事件 → 一键「获取视频」→ 设备经 MQTT 异步上传事件视频 → 媒体资源页审查归档': { en: ': high-risk event → "Fetch Video" → device uploads via MQTT → review & archive in Media.', es: ': evento de riesgo → «Obtener vídeo» → subida por MQTT → revisar en Multimedia.' },
    /* 应用建议 / AI 结论（片段） */
    '建议检查胎压、空气滤芯与驾驶习惯，预计可省 {1}–{2}% 燃油成本': { en: 'Check tire pressure, air filter & driving habits; est. {1}–{2}% fuel savings', es: 'Revise presión, filtro y hábitos; ahorro estimado {1}–{2}%' },
    '减少急加速与长时间怠速可进一步降本': { en: 'Less harsh acceleration & idling can cut costs further', es: 'Menos aceleraciones bruscas y ralentí reduce costes' },
    '车辆燃油经济性处于良好水平': { en: 'Fuel economy is in good shape', es: 'La economía de combustible es buena' },
    '存在亏电风险，建议检查充电系统与电瓶寿命': { en: 'Risk of battery drain — check charging system & battery life', es: 'Riesgo de descarga; revise el sistema de carga' },
    '充电系统工作正常': { en: 'Charging system is normal', es: 'Sistema de carga normal' },
    '接近保养周期，建议安排机油与滤芯更换': { en: 'Near maintenance interval — schedule oil & filter change', es: 'Cerca del mantenimiento; programe aceite y filtros' },
    '急加速/急刹车频发，建议开展驾驶安全培训并关联 ADAS 事件复核': { en: 'Frequent harsh accel/braking — schedule safety training & ADAS review', es: 'Frecuentes frenadas/aceleraciones; programe formación' },
    '长时间怠速增加油耗与积碳，建议优化调度与等待策略': { en: 'Long idling raises fuel use & carbon buildup — optimize scheduling', es: 'El ralentí prolongado aumenta el consumo; optimice la programación' },
    '车辆工况整体健康，继续保持当前维护节奏': { en: 'Overall vehicle health is good — keep the current cadence', es: 'La salud general es buena; mantenga el ritmo' },
    '存在多项风险指标，建议尽快安排整车检查': { en: 'Multiple risk indicators — arrange a full inspection soon', es: 'Varios indicadores de riesgo; programe inspección' },
    '油耗偏高（{1} L/{2}km）': { en: 'High fuel ({1} L/{2}km)', es: 'Consumo alto ({1} L/{2}km)' },
    '油耗中等（{1} L/{2}km）': { en: 'Moderate fuel ({1} L/{2}km)', es: 'Consumo medio ({1} L/{2}km)' },
    '油耗健康（{1} L/{2}km）': { en: 'Healthy fuel ({1} L/{2}km)', es: 'Consumo sano ({1} L/{2}km)' },
    '电瓶电压偏低（{1} V）': { en: 'Low battery ({1} V)', es: 'Batería baja ({1} V)' },
    '电瓶电压正常（{1} V）': { en: 'Battery normal ({1} V)', es: 'Batería normal ({1} V)' },
    '发动机累计运行 {1} h': { en: 'Engine runtime {1} h', es: 'Motor {1} h' },
    '激烈驾驶 {1} 次': { en: '{1} harsh-driving events', es: '{1} eventos de conducción brusca' },
    '怠速占比 {1}%': { en: 'Idle {1}%', es: 'Ralentí {1}%' },
    '综合评估：{1}（{2} 分）': { en: 'Assessment: {1} ({2} pts)', es: 'Evaluación: {1} ({2} pts)' },
    '共识别': { en: 'Identified', es: 'Se identificaron' },
    '起事件：ADAS': { en: 'events: ADAS', es: 'eventos: ADAS' },
    '起 · DMS': { en: '· DMS', es: '· DMS' },
    '起 · 视频故障': { en: '· video faults', es: '· fallos de vídeo' },
    '起。平均风险分': { en: '. Avg risk', es: '. Riesgo medio' },
    '，最高风险': { en: ', highest risk', es: ', riesgo máximo' },
    '分（': { en: ' (', es: ' (' },
    '）。': { en: ').', es: ').' },
    '「': { en: '"', es: '«' },
    '」为最高频事件类型（': { en: '" is the most frequent type (', es: '» es el tipo más frecuente (' },
    '%），可针对性优化': { en: '%) — targeted optimization advised', es: '%): optimización recomendada' },
    '建议优先审查': { en: 'Prioritize reviewing', es: 'Priorice revisar' },
    '段高风险视频（评分 ≥75），重点核对碰撞与驾驶员状态类事件': { en: 'high-risk videos (score ≥75), focusing on collision & driver-state events', es: 'vídeos de alto riesgo (≥75), foco en colisiones y estado del conductor' },
    '起，占比偏高，建议排查摄像头接线与 SD 卡状态': { en: 'video faults — check camera wiring & SD card', es: 'fallos de vídeo; revise cableado y tarjeta SD' },
    '起，建议对相关驾驶员开展安全培训': { en: 'DMS driver-state events — schedule driver safety training', es: 'eventos DMS; programe formación al conductor' },
    '燃油成本估算': { en: 'Fuel Cost Est.', es: 'Coste combustible est.' },
    '（8.0 元/L）': { en: ' (@8.0/L)', es: ' (@8.0/L)' },
    '发动机运行': { en: 'Engine runtime', es: 'Motor en marcha' },
    '个标记，': { en: ' markers, ', es: ' marcadores, ' },
    '起': { en: '', es: '' },
    '分': { en: 'pts', es: 'pts' },
    '涉及车辆': { en: 'Vehicles Involved', es: 'Vehículos afectados' },
    '{1} 分 · {2} 起': { en: '{1} pts · {2} events', es: '{1} pts · {2} eventos' },
    '抓拍 / 录制': { en: 'Capture / Record', es: 'Capturar / Grabar' },
    '发动机运行 {1} h': { en: 'Engine {1} h', es: 'Motor {1} h' },
    '健康评分与应用建议': { en: 'Health Score & Insights', es: 'Salud y recomendaciones' },
    '得分: {1} ({2}%)': { en: 'Score: {1} ({2}%)', es: 'Puntos: {1} ({2}%)' },
    '车速': { en: 'Speed', es: 'Velocidad' },
    '转速': { en: 'RPM', es: 'RPM' },
    '油量': { en: 'Fuel', es: 'Combustible' },
    '电压': { en: 'Voltage', es: 'Voltaje' },
    '进气': { en: 'Intake', es: 'Admisión' },
    '节气门': { en: 'Throttle', es: 'Acelerador' },
    '瞬时油耗': { en: 'Inst. Fuel', es: 'Consumo inst.' },
    '累计里程': { en: 'Mileage', es: 'Kilometraje' },
    '碰撞告警': { en: 'Collision alert', es: 'Alerta de colisión' },
    '综合评估：': { en: 'Assessment: ', es: 'Evaluación: ' },
    '（': { en: ' (', es: ' (' },
    ' 分）': { en: ' pts)', es: ' pts)' },
    '标准摄像头故障告警': { en: 'Standard camera fault alert', es: 'Fallo estándar de cámara' },
    '摄像头故障告警': { en: 'Camera fault alert', es: 'Alerta de fallo de cámara' },
    '紧急告警': { en: 'Emergency alert', es: 'Alerta de emergencia' },
    '视频信号丢失告警': { en: 'Video signal lost alert', es: 'Alerta de pérdida de vídeo' },
    '→ POST /v3/video/live/start，返回 rtmp / flv / hls 三种流地址；② 浏览器端使用 flv.js（FLV）或 hls.js（HLS）直接播放；③':
      { en: '→ POST /v3/video/live/start returns rtmp / flv / hls stream URLs; ② browser plays directly via flv.js (FLV) or hls.js (HLS); ③', es: '→ POST /v3/video/live/start devuelve URLs rtmp / flv / hls; ② el navegador reproduce con flv.js (FLV) u hls.js (HLS); ③' },
    '流程：先查询设备存储文件列表 → 勾选 ≤8 个文件 → 开始回放获得流地址；④':
      { en: 'workflow: list device recordings → select ≤8 files → start playback to get stream URL; ④', es: 'flujo: listar grabaciones → seleccionar ≤8 archivos → iniciar reproducción; ④' },
    '通过 /v3/video/capture/start 下发指令，媒体文件异步上传后可在「媒体资源」页查看；⑤ 视频功能仅行车记录仪（Dashcam）设备支持，设备需在线。':
      { en: 'sends the command via /v3/video/capture/start; media uploads async and appears in Media. ⑤ Video is only supported by dashcam devices, which must be online.', es: 'envía el comando vía /v3/video/capture/start; los archivos se suben asíncronamente y aparecen en Multimedia. ⑤ El vídeo solo está disponible en cámaras a bordo en línea.' }
  };

  /* ---------- 正则规则（错误前缀等拼接串） ---------- */
  var RULES = [
    { re: /^TurboHive 数据加载失败：([\s\S]*)$/, t: { en: 'TurboHive load failed: $1', es: 'Error al cargar TurboHive: $1' } },
    { re: /^TrackSolidPro 数据加载失败：([\s\S]*)$/, t: { en: 'TrackSolidPro load failed: $1', es: 'Error al cargar TrackSolidPro: $1' } },
    { re: /^行程加载失败：([\s\S]*)$/, t: { en: 'Trip load failed: $1', es: 'Error al cargar viajes: $1' } },
    { re: /^参数 JSON 解析失败：([\s\S]*)$/, t: { en: 'Params JSON error: $1', es: 'Error de JSON: $1' } },
    { re: /^底图切换为 ([\s\S]*)$/, t: { en: 'Basemap: $1', es: 'Mapa base: $1' } },
    { re: /^(.*), (\d+) 天前\)\.$/, t: { en: '$1, $2d ago).', es: '$1, hace $2 d).' } },
    { re: /^(.*), (\d+) 小时前\)\.$/, t: { en: '$1, $2h ago).', es: '$1, hace $2 h).' } },
    { re: /^(.*), (\d+) 分钟前\)\.$/, t: { en: '$1, $2m ago).', es: '$1, hace $2 min).' } },
    { re: /^综合评估：(.{1,6})（(\d+) 分）$/, t: { en: 'Assessment: $1 ($2 pts)', es: 'Evaluación: $1 ($2 pts)' } }
  ];

  /* ================= 状态 ================= */
  var lang = 'zh';
  try { lang = localStorage.getItem(LS_KEY) || 'zh'; } catch (e) { }
  if ({ en: 1, es: 1 }[lang] !== 1) lang = 'zh';

  /* 反向索引：IDX[lang][中文] → 译文 */
  var IDX = { en: {}, es: {} };
  Object.keys(DICT).forEach(function (k) {
    var v = DICT[k];
    if (!v) return;
    if (v.en !== undefined) IDX.en[k] = v.en;
    if (v.es !== undefined) IDX.es[k] = v.es;
  });

  var ORIG_TEXT = new WeakMap();     // TextNode → 原文
  var ORIG_ATTR = new WeakMap();     // Element → { placeholder: 原文, ... }
  var applying = false;
  var pending = false;

  /* ================= 查询翻译 ================= */
  /** 数字模板化：'第 3/65 页' → '第 {1}/{2} 页' + nums=[3,65] */
  function templatize(s) {
    var nums = [], i = 0;
    var key = s.replace(/\d+(?:\.\d+)?/g, function (m) { nums.push(m); return '{' + (++i) + '}'; });
    return { key: key, nums: nums };
  }
  function lookup(s, l) {
    var d = IDX[l];
    if (!d) return null;
    var hit = d[s];
    if (hit !== undefined) return hit;
    var tp = templatize(s);
    if (tp.key !== s) {
      hit = d[tp.key];
      if (hit !== undefined) {
        tp.nums.forEach(function (n, i) { hit = hit.replace(new RegExp('\\{' + (i + 1) + '\\}', 'g'), n); });
        return hit;
      }
    }
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].re.test(s)) return s.replace(RULES[i].re, RULES[i].t[l]);
    }
    return null;
  }
  function t(s) { return lang === 'zh' ? s : (lookup(String(s), lang) || s); }

  /* ================= DOM 翻译 ================= */
  var SKIP = { SCRIPT: 1, STYLE: 1, CODE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  function inSkip(node) {
    var n = node;
    while (n && n !== document.body) {
      if (SKIP[n.nodeName]) return true;
      if (n.classList && (n.classList.contains('code') || n.classList.contains('mono-raw'))) return true;
      n = n.parentNode;
    }
    return false;
  }

  function translateNode(txt) {
    var orig = txt.nodeValue;
    if (!orig || !CJK_RE.test(orig)) return;
    if (!ORIG_TEXT.has(txt)) ORIG_TEXT.set(txt, orig);
    var trimmed = orig.trim();
    if (!trimmed) return;
    var hit = lookup(trimmed, lang);
    if (hit === null || hit === trimmed) return;
    var lead = orig.slice(0, orig.indexOf(trimmed.charAt(0)));
    txt.nodeValue = lead + hit + orig.slice(lead.length + trimmed.length);
  }

  function translateAttrs(el) {
    ['placeholder', 'title'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (!v || !CJK_RE.test(v)) return;
      var store = ORIG_ATTR.get(el) || {};
      if (!(a in store)) { store[a] = v; ORIG_ATTR.set(el, store); }
      var hit = lookup(v, lang);
      if (hit !== null && hit !== v) el.setAttribute(a, hit);
    });
  }

  function translateRoot(root) {
    if (lang === 'zh' || applying) return;
    applying = true;
    try {
      var walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null, false);
      var n, guard = 0;
      while ((n = walker.nextNode()) && guard++ < 20000) {
        if (inSkip(n)) continue;
        translateNode(n);
      }
      var els = (root || document.body).querySelectorAll('[placeholder],[title]');
      for (var i = 0; i < els.length && i < 3000; i++) translateAttrs(els[i]);
    } finally { applying = false; }
  }

  function restoreRoot() {
    applying = true;
    try {
      // 文本节点原文还原（WeakMap 不可枚举 → 遍历当前 DOM）
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      var n, guard = 0;
      while ((n = walker.nextNode()) && guard++ < 20000) {
        if (ORIG_TEXT.has(n)) { n.nodeValue = ORIG_TEXT.get(n); ORIG_TEXT.delete(n); }
      }
      var els = document.body.querySelectorAll('[placeholder],[title]');
      els.forEach && Array.prototype.forEach.call(els, function (el) {
        var store = ORIG_ATTR.get(el);
        if (!store) return;
        Object.keys(store).forEach(function (a) { el.setAttribute(a, store[a]); });
        ORIG_ATTR.delete(el);
      });
    } finally { applying = false; }
  }

  /* ================= MutationObserver ================= */
  function scheduleTranslate() {
    if (applying || pending) return;
    pending = true;
    (w.requestAnimationFrame || setTimeout)(function () {
      pending = false;
      translateRoot(document.body);
    }, 16);
  }

  var mo = null;
  function startObserver() {
    if (mo || !w.MutationObserver) return;
    mo = new MutationObserver(function (muts) {
      if (lang === 'zh' || applying) return;
      scheduleTranslate();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  /* ================= 切换语言 ================= */
  function setLang(l, silent) {
    if (l === lang) return;
    if (lang !== 'zh') restoreRoot();
    lang = l;
    try { localStorage.setItem(LS_KEY, l); } catch (e) { }
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
    if (lang !== 'zh') translateRoot(document.body);
    // 顶栏语言按钮态
    var seg = document.getElementById('langSeg');
    if (seg) seg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-lang') === l);
    });
    var sel = document.getElementById('appLang');
    if (sel) sel.value = l;
    if (!silent && w.U && w.U.toast) {
      w.U.toast({ zh: '语言：中文', en: 'Language: English', es: 'Idioma: Español' }[l] || l, 'info', 1800);
    }
  }

  /* ================= 初始化 ================= */
  function init() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
    // 顶栏语言切换
    var seg = document.getElementById('langSeg');
    if (seg) {
      seg.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-lang') === lang);
        b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
      });
    }
    // 设置页下拉（动态渲染，用事件委托）
    document.addEventListener('change', function (e) {
      if (e.target && e.target.id === 'appLang') setLang(e.target.value);
    });
    if (lang !== 'zh') translateRoot(document.body);
    startObserver();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  w.I18N = { lang: function () { return lang; }, set: setLang, t: t, translate: translateRoot };
})(window);
