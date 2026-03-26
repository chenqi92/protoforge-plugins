/**
 * HJ212-2005/2017 环保数据传输协议 — 完整解析器 + 报文生成器
 *
 * 完全支持《污染物在线监控（监测）系统数据传输标准》(HJ 212-2017)
 * 及其前身 HJ/T 212-2005。
 *
 * 报文格式: ##LLLL<数据段>CCCC\r\n
 *   ## = 包头
 *   LLLL = 4位数据段长度
 *   数据段: QN=...;ST=...;CN=...;PW=...;MN=...;Flag=...;CP=&&...&&
 *   CCCC = CRC16 校验码 (4位十六进制)
 *   \r\n = 包尾
 */

// ═══════════════════════════════════════════
//  CRC-16/IBM (poly=0xA001, init=0xFFFF)
// ═══════════════════════════════════════════

function crc16(str) {
  var crc = 0xFFFF;
  for (var i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) & 0xFF;
    for (var j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xA001;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return crc & 0xFFFF;
}

function hex4(n) {
  var s = n.toString(16).toUpperCase();
  while (s.length < 4) s = "0" + s;
  return s;
}

// ═══════════════════════════════════════════
//  ST 系统编码表 (HJ212-2017)
// ═══════════════════════════════════════════

var ST_NAMES = {
  "21": "地表水质量监测", "22": "空气质量监测", "23": "声环境质量监测",
  "24": "地下水质量监测", "25": "土壤质量监测", "26": "海水质量监测",
  "27": "挥发性有机物监测",
  "31": "大气环境污染源", "32": "地表水体环境污染源", "33": "地下水体环境污染源",
  "34": "海洋环境污染源", "35": "土壤环境污染源", "36": "声环境污染源",
  "37": "振动环境污染源", "38": "放射性环境污染源", "39": "工地扬尘污染源",
  "51": "烟气排放过程监控", "52": "污水排放过程监控",
  "91": "系统交互"
};

// ═══════════════════════════════════════════
//  CN 命令编码表 (HJ212-2017)
// ═══════════════════════════════════════════

var CN_NAMES = {
  // 初始化命令
  "1000": "设置超时时间及重发次数", "1001": "提取超时时间及重发次数",
  // 参数命令
  "1011": "提取现场机时间", "1012": "设置现场机时间", "1013": "现场机时间校准请求",
  "1061": "提取实时数据间隔", "1062": "设置实时数据间隔",
  "1063": "提取分钟数据间隔", "1064": "设置分钟数据间隔",
  "1072": "设置现场机密码",
  // 数据命令
  "2011": "取污染物实时数据", "2012": "停止察看污染物实时数据",
  "2021": "取设备运行状态数据", "2022": "停止察看设备运行状态",
  "2031": "取污染物日历史数据", "2041": "取设备运行时间日历史数据",
  "2051": "取污染物分钟数据", "2061": "取污染物小时数据",
  "2081": "取污染物月历史数据", "2091": "补传数据",
  // 交互命令
  "3011": "取污染物或设备标识", "3012": "上传污染物或设备标识",
  "3013": "设置污染物上下限值", "3014": "提取污染物上下限值", "3015": "上传污染物上下限值",
  "3019": "取数采仪信息", "3020": "上传数采仪信息", "3021": "设置数采仪参数",
  // 控制命令
  "9011": "心跳", "9012": "终端请求应答", "9013": "通知应答", "9014": "请求应答"
};

var CN_SHORT = {
  "1000": "超时设置", "1001": "超时设置",
  "1011": "时间操作", "1012": "时间操作", "1013": "时间操作",
  "1061": "实时间隔", "1062": "实时间隔",
  "1063": "分钟间隔", "1064": "分钟间隔",
  "1072": "密码设置",
  "2011": "实时数据", "2012": "停止实时",
  "2021": "运行状态", "2022": "停止运行状态",
  "2031": "日数据", "2041": "运行时间日数据",
  "2051": "分钟数据", "2061": "小时数据",
  "2081": "月数据", "2091": "补传数据",
  "3011": "标识操作", "3012": "标识操作",
  "3013": "上下限操作", "3014": "上下限操作", "3015": "上下限操作",
  "3019": "数采仪操作", "3020": "数采仪操作", "3021": "数采仪操作",
  "9011": "心跳", "9012": "终端应答", "9013": "通知应答", "9014": "请求应答"
};

// ═══════════════════════════════════════════
//  时间格式化助手
// ═══════════════════════════════════════════
function formatHj212Time(str) {
  if (!str) return str;
  if (str.length === 14) {
    return str.substring(0,4) + "-" + str.substring(4,6) + "-" + str.substring(6,8) + " " +
           str.substring(8,10) + ":" + str.substring(10,12) + ":" + str.substring(12,14);
  } else if (str.length === 17) {
    return str.substring(0,4) + "-" + str.substring(4,6) + "-" + str.substring(6,8) + " " +
           str.substring(8,10) + ":" + str.substring(10,12) + ":" + str.substring(12,14) + "." + str.substring(14,17);
  }
  return str;
}

// ═══════════════════════════════════════════
//  污染物因子编码 & 单位 (扩充版)
// ═══════════════════════════════════════════

var POLLUTANT_NAMES = {
  // 水环境 (w01-w22)
  "w01001": "pH", "w01002": "色度", "w01003": "浊度", "w01004": "透明度",
  "w01006": "溶解氧", "w01009": "高锰酸盐指数", "w01010": "水温",
  "w01012": "悬浮物", "w01014": "电导率", "w01016": "总有机的碳(TOC)",
  "w01017": "化学需氧量(CODMn)", "w01018": "化学需氧量(CODCr)",
  "w01019": "生化需氧量", "w01020": "氨氮",
  "w21001": "总氮", "w21003": "氨氮(废水)", "w21011": "总磷", "w21016": "总铬",
  "w21017": "六价铬", "w21019": "总铅", "w21020": "总镉", "w21022": "总汞", "w21023": "总砷",
  "w21038": "石油类", "w21004": "硝酸盐氮", "w21005": "亚硝酸盐氮",
  "w21024": "总硒", "w21025": "总锑", "w21028": "挥发酚", "w21033": "氰化物",
  "w22001": "硫化物", "w99001": "污水流量", "w00000": "水质采样",

  // 气象与常规空气 (a01-a05)
  "a01001": "温度", "a01002": "湿度", "a01006": "气压",
  "a01007": "风速", "a01008": "风向",
  "a01011": "烟气流速", "a01012": "烟气温度", "a01013": "烟气压力", "a01014": "烟气湿度",
  "a01015": "流速比", "a01017": "标干流量", "a05024": "O₃",

  // 颗粒物与固定源 (a19-a21, a34)
  "a19001": "烟尘/颗粒物", "a34002": "PM10", "a34004": "PM2.5", "a34013": "烟气黑度",
  "a21001": "NOx(折算)", "a21002": "NOx", "a21003": "NO", "a21004": "NO₂", 
  "a21005": "CO", "a21026": "SO₂", "a21028": "H₂S", "a21030": "HCl", 
  "a21033": "氟化物", "a21034": "氯气", "a21006": "氨气",
  "a99001": "废气流量",

  // 常见 VOCs (a24)
  "a24088": "非甲烷总烃", "a24087": "总烃", "a24002": "甲烷",
  "a24301": "苯", "a24302": "甲苯", "a24303": "二甲苯", "a24304": "苯乙烯", "a24305": "乙苯",

  // 声环境 (n)
  "n00000": "噪声等效声级(Leq)", "n00006": "环境噪声", "n0000Z": "交通噪声"
};

var SUFFIX_NAMES = {
  "Rtd": "实时值", "Avg": "平均值", "Min": "最小值", "Max": "最大值",
  "Cou": "累计值", "Flag": "标志", "SampleTime": "采样时间",
  "ZsRtd": "折算实时值", "ZsAvg": "折算平均值",
  "ZsMin": "折算最小值", "ZsMax": "折算最大值"
};

function determineUnit(pollCode) {
  var p = pollCode.toLowerCase();
  if (p === "w01001" || p === "n00000" || p === "n00006") return "无量纲"; // 噪声通常自带dB，这里暂简化
  if (p === "w01010" || p === "a01001" || p === "a01012") return "°C";
  if (p === "a01002" || p === "a01014") return "%";
  if (p === "a01006" || p === "a01013") return "Pa";
  if (p === "a01007" || p === "a01011") return "m/s";
  if (p === "a01008") return "°";
  if (p === "w01014") return "μS/cm";
  if (p === "w01003") return "NTU";
  if (p === "w99001" || p === "a99001" || p === "a01017") return "m³/h";
  if (p.indexOf("n") === 0) return "dB(A)";
  if (p.indexOf("a34") === 0 || p.indexOf("a21") === 0 ||
      p.indexOf("a05") === 0 || p.indexOf("a19") === 0 || p.indexOf("a24") === 0) return "mg/m³";
  if (p.indexOf("w") === 0) return "mg/L";
  return null;
}

// ═══════════════════════════════════════════
//  解析器入口
// ═══════════════════════════════════════════

function parse(rawData) {
  try {
    var data = rawData.trim();

    // 1. 包头校验
    if (data.indexOf("##") !== 0) {
      return { success: false, protocolName: "HJ212", summary: "", fields: [],
               error: "非 HJ212 报文：缺少 ## 包头标识" };
    }
    if (data.length < 10) {
      return { success: false, protocolName: "HJ212", summary: "", fields: [],
               error: "报文长度不足：至少需要 ## + 4位长度 + 数据段 + 4位CRC" };
    }

    var fields = [];

    // 2. 数据段长度
    var lenStr = data.substring(2, 6);
    var declaredLen = parseInt(lenStr, 10);
    if (isNaN(declaredLen)) {
      return { success: false, protocolName: "HJ212", summary: "", fields: [],
               error: "数据段长度 '" + lenStr + "' 不是有效数字" };
    }
    fields.push({ key: "_dataLen", label: "数据段长度", value: lenStr, group: "报文结构" });

    // 3. 拆分数据段和 CRC
    var afterLen = data.substring(6);
    var trimmed = afterLen.replace(/[\r\n]+$/, "");

    var dataSegment = "";
    var crcStr = "";
    if (trimmed.length >= 4) {
      dataSegment = trimmed.substring(0, trimmed.length - 4);
      crcStr = trimmed.substring(trimmed.length - 4);
    } else {
      dataSegment = trimmed;
    }

    // 实际长度校验
    if (dataSegment.length !== declaredLen) {
      fields.push({
        key: "_lenWarning", label: "长度校验",
        value: "⚠ 声明长度=" + declaredLen + ", 实际长度=" + dataSegment.length,
        group: "报文结构"
      });
    }

    // 4. CRC 校验
    if (crcStr) {
      var computedCrc = crc16(dataSegment);
      var computedHex = hex4(computedCrc);
      var crcUpper = crcStr.toUpperCase();
      var isOk = crcUpper === computedHex;
      var crcDisplay = isOk
        ? crcUpper + " ✓"
        : crcUpper + " ✗ (预期 " + computedHex + ")";
      fields.push({ 
        key: "_crc", 
        label: "CRC16 校验", 
        value: crcDisplay, 
        group: "报文结构",
        uiType: "badge",
        color: isOk ? "emerald" : "red",
        isKeyInfo: true
      });
    }

    // 5. 解析数据段字段 — 分离 CP 段
    var headStr = dataSegment;
    var cpContent = "";
    var cpStart = dataSegment.indexOf("CP=&&");
    if (cpStart >= 0) {
      headStr = dataSegment.substring(0, cpStart);
      var afterCp = dataSegment.substring(cpStart + 5);
      var cpEnd = afterCp.indexOf("&&");
      cpContent = cpEnd >= 0 ? afterCp.substring(0, cpEnd) : afterCp;
    }

    var cn = "";
    var mn = "";

    var headPairs = headStr.split(";");
    for (var i = 0; i < headPairs.length; i++) {
      var pair = headPairs[i].trim();
      if (!pair) continue;
      var eqIdx = pair.indexOf("=");
      if (eqIdx < 0) continue;
      var key = pair.substring(0, eqIdx).trim();
      var val = pair.substring(eqIdx + 1).trim();

      if (key === "QN") {
        fields.push({ key: "QN", label: "请求编码", value: formatHj212Time(val), group: "报文头", isKeyInfo: true });
      } else if (key === "ST") {
        var stDisplay = ST_NAMES[val] ? val + " (" + ST_NAMES[val] + ")" : val;
        fields.push({ key: "ST", label: "系统编码", value: stDisplay, group: "报文头", isKeyInfo: true });
      } else if (key === "CN") {
        cn = val;
        var cnDisplay = CN_NAMES[val] ? val + " (" + CN_NAMES[val] + ")" : val;
        fields.push({ key: "CN", label: "命令编码", value: cnDisplay, group: "报文头", isKeyInfo: true });
      } else if (key === "PW") {
        fields.push({ key: "PW", label: "密码", value: val, group: "报文头" });
      } else if (key === "MN") {
        mn = val;
        fields.push({ key: "MN", label: "首脑设备唯一标识(MN)", value: val, group: "报文头", isKeyInfo: true });
      } else if (key === "Flag") {
        var flagVal = parseInt(val, 10) || 0;
        var d0 = flagVal & 0x01;
        var d1 = (flagVal >> 1) & 0x01;
        var versionBit = (flagVal >> 2) & 0x0F;
        var version = (versionBit === 1) ? "HJ212-2017" : (versionBit === 0 ? "HJ212-2005" : "V=" + versionBit);
        var flagDesc = val + " (" + version + ", " + (d0 ? "需应答" : "不应答") +
                       ", " + (d1 ? "有拆包片段" : "无拆包") + ")";
        fields.push({ key: "Flag", label: "标志位", value: flagDesc, group: "报文头", uiType: "badge", color: "blue" });
      } else if (key === "PNUM") {
        fields.push({ key: "PNUM", label: "总包数", value: val, group: "报文头" });
      } else if (key === "PNO") {
        fields.push({ key: "PNO", label: "包号", value: val, group: "报文头" });
      } else {
        fields.push({ key: key, label: key, value: val, group: "报文头" });
      }
    }

    // 6. 解析 CP 数据区
    if (cpContent) {
      parseCpContent(cpContent, fields);
    }

    // 7. 生成 summary
    var summary = "HJ212 " + (CN_SHORT[cn] || "数据") + (mn ? " [" + mn + "]" : "");

    return {
      success: true,
      protocolName: "HJ212",
      summary: summary,
      fields: fields
    };
  } catch (e) {
    return {
      success: false,
      protocolName: "HJ212",
      summary: "",
      fields: [],
      error: "解析异常: " + e.toString()
    };
  }
}

// ═══════════════════════════════════════════
//  CP 数据区解析
// ═══════════════════════════════════════════

function parseCpContent(cp, fields) {
  var KNOWN_CP_KEYS = {
    "DataTime": "数据时间", "RestartTime": "重启时间",
    "PolId": "污染物编码", "SystemTime": "系统时间",
    "RtdInterval": "实时数据间隔", "MinInterval": "分钟数据间隔",
    "NewPW": "新密码", "OverTime": "超时时间", "ReCount": "重发次数",
    "WarnTime": "报警时间", "Ctime": "采集时间", "Stime": "采样时间",
    "InfoId": "信息编号"
  };

  var QNRTN_DESC = {
    "1": "准备执行请求", "2": "请求被拒绝", "3": "PW 错误",
    "4": "MN 错误", "5": "ST 错误", "6": "Flag 错误", "100": "通讯超时"
  };

  var EXERTN_DESC = {
    "1": "执行成功", "2": "执行失败，但不知原因", "3": "命令请求条件错误"
  };

  var FLAG_DESC = {
    "N": "正常", "F": "停运", "D": "故障", "C": "校准",
    "S": "手工输入", "M": "维护", "T": "超量程"
  };

  var TIME_KEYS = {"DataTime":1, "RestartTime":1, "SystemTime":1, "WarnTime":1, "Ctime":1, "Stime":1};

  var regex = /([^;,=]+)=([^;,]*)/g;
  var match;
  while ((match = regex.exec(cp)) !== null) {
    var cpKey = match[1].trim();
    var cpVal = match[2].trim();

    // 特殊 CP 键
    if (cpKey === "QnRtn") {
      fields.push({ key: "QnRtn", label: "请求返回", value: QNRTN_DESC[cpVal] || cpVal, group: "数据区" });
      continue;
    }
    if (cpKey === "ExeRtn") {
      fields.push({ key: "ExeRtn", label: "执行结果", value: EXERTN_DESC[cpVal] || cpVal, group: "数据区" });
      continue;
    }
    if (KNOWN_CP_KEYS[cpKey]) {
      var displayVal = cpVal;
      if (TIME_KEYS[cpKey]) {
        displayVal = formatHj212Time(cpVal);
      }
      fields.push({ key: cpKey, label: KNOWN_CP_KEYS[cpKey], value: displayVal, group: "数据区" });
      continue;
    }
    // 通用 CP 键（非污染物因子）
    if (cpKey.indexOf("-") < 0 && !POLLUTANT_NAMES[cpKey]) {
      fields.push({ key: cpKey, label: cpKey, value: cpVal, group: "数据区" });
      continue;
    }

    // 污染物因子：code-Suffix=value
    var dashIdx = cpKey.indexOf("-");
    var pollCode = dashIdx > 0 ? cpKey.substring(0, dashIdx) : cpKey;
    var suffix = dashIdx > 0 ? cpKey.substring(dashIdx + 1) : "";

    var pollLabel = POLLUTANT_NAMES[pollCode] || pollCode;
    var sufLabel = SUFFIX_NAMES[suffix] || suffix;
    var label = sufLabel ? pollLabel + " " + sufLabel : pollLabel;

    var unit = determineUnit(pollCode);

    // Flag 值添加含义说明
    if (suffix === "Flag") {
      var flagMeaning = FLAG_DESC[cpVal] || cpVal;
      var color = "slate";
      if (cpVal === "N") color = "emerald";
      else if (cpVal === "T" || cpVal === "D" || cpVal === "F") color = "red";
      else if (cpVal === "C" || cpVal === "M" || cpVal === "S") color = "amber";

      fields.push({
        key: cpKey,
        label: label,
        value: cpVal + " (" + flagMeaning + ")",
        group: "监测数据",
        uiType: "status-dot",
        color: color
      });
    } else {
      fields.push({
        key: cpKey,
        label: label,
        value: cpVal,
        unit: unit,
        group: "监测数据"
      });
    }
  }
}

// ═══════════════════════════════════════════
//  报文生成器
// ═══════════════════════════════════════════

/**
 * 生成 HJ212 报文
 * @param {Object} params 参数对象
 * @param {string} [params.qn] 请求编码（可选）
 * @param {string} params.st 系统编码
 * @param {string} params.cn 命令编码
 * @param {string} params.pw 密码
 * @param {string} params.mn 设备唯一标识
 * @param {number} params.flag 标志位
 * @param {number} [params.pnum] 总包数（可选）
 * @param {number} [params.pno] 包号（可选）
 * @param {string} params.cp CP 数据内容（不含 && 包裹）
 * @returns {Object} { success, protocolName, message, error }
 */
function generate(params) {
  try {
    var parts = [];
    if (params.qn) parts.push("QN=" + params.qn);
    parts.push("ST=" + params.st);
    parts.push("CN=" + params.cn);
    parts.push("PW=" + params.pw);
    parts.push("MN=" + params.mn);
    parts.push("Flag=" + params.flag);
    if (params.pnum !== undefined && params.pnum !== null) parts.push("PNUM=" + params.pnum);
    if (params.pno !== undefined && params.pno !== null) parts.push("PNO=" + params.pno);
    parts.push("CP=&&" + (params.cp || "") + "&&");

    var dataSegment = parts.join(";");
    var dataLen = dataSegment.length;
    var crc = crc16(dataSegment);
    var lenStr = dataLen.toString();
    while (lenStr.length < 4) lenStr = "0" + lenStr;

    var message = "##" + lenStr + dataSegment + hex4(crc) + "\r\n";

    return {
      success: true,
      protocolName: "HJ212",
      message: message,
      error: null
    };
  } catch (e) {
    return {
      success: false,
      protocolName: "HJ212",
      message: "",
      error: "生成异常: " + e.toString()
    };
  }
}
