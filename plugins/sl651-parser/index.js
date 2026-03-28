/**
 * SL651-2014 水文遥测通信规约 — 融合器协议完整解析器 + 报文生成器
 *
 * 完全支持《水文监测数据通信规约》(SL 651-2014)
 * 适用于融合器设备上报的水文数据（水位、降雨、风速、水流速等）
 *
 * 帧格式 (十六进制):
 *   7E7E [中心站1B] [遥测站5B] [密码2B] [功能码1B] [长度2B]
 *   [起始符02] [业务报文] [结束符] [CRC16-2B]
 *
 * 业务数据:
 *   [流水号2B] [发报时间6B(BCD)] [地址标识2B] [遥测站5B] [分类1B]
 *   [观测时间标识2B] [观测时间5B(BCD)] [要素标识1B] [描述符1B] [值NB(BCD)] ...
 */

// ═══════════════════════════════════════════
//  CRC-16/Modbus (查表法, 与项目 CrcModbusUtil 完全一致)
// ═══════════════════════════════════════════

var CRC16_H = [
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40,0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,
  0x00,0xC1,0x81,0x40,0x01,0xC0,0x80,0x41,0x01,0xC0,0x80,0x41,0x00,0xC1,0x81,0x40
];

var CRC16_L = [
  0x00,0xC0,0xC1,0x01,0xC3,0x03,0x02,0xC2,0xC6,0x06,0x07,0xC7,0x05,0xC5,0xC4,0x04,
  0xCC,0x0C,0x0D,0xCD,0x0F,0xCF,0xCE,0x0E,0x0A,0xCA,0xCB,0x0B,0xC9,0x09,0x08,0xC8,
  0xD8,0x18,0x19,0xD9,0x1B,0xDB,0xDA,0x1A,0x1E,0xDE,0xDF,0x1F,0xDD,0x1D,0x1C,0xDC,
  0x14,0xD4,0xD5,0x15,0xD7,0x17,0x16,0xD6,0xD2,0x12,0x13,0xD3,0x11,0xD1,0xD0,0x10,
  0xF0,0x30,0x31,0xF1,0x33,0xF3,0xF2,0x32,0x36,0xF6,0xF7,0x37,0xF5,0x35,0x34,0xF4,
  0x3C,0xFC,0xFD,0x3D,0xFF,0x3F,0x3E,0xFE,0xFA,0x3A,0x3B,0xFB,0x39,0xF9,0xF8,0x38,
  0x28,0xE8,0xE9,0x29,0xEB,0x2B,0x2A,0xEA,0xEE,0x2E,0x2F,0xEF,0x2D,0xED,0xEC,0x2C,
  0xE4,0x24,0x25,0xE5,0x27,0xE7,0xE6,0x26,0x22,0xE2,0xE3,0x23,0xE1,0x21,0x20,0xE0,
  0xA0,0x60,0x61,0xA1,0x63,0xA3,0xA2,0x62,0x66,0xA6,0xA7,0x67,0xA5,0x65,0x64,0xA4,
  0x6C,0xAC,0xAD,0x6D,0xAF,0x6F,0x6E,0xAE,0xAA,0x6A,0x6B,0xAB,0x69,0xA9,0xA8,0x68,
  0x78,0xB8,0xB9,0x79,0xBB,0x7B,0x7A,0xBA,0xBE,0x7E,0x7F,0xBF,0x7D,0xBD,0xBC,0x7C,
  0xB4,0x74,0x75,0xB5,0x77,0xB7,0xB6,0x76,0x72,0xB2,0xB3,0x73,0xB1,0x71,0x70,0xB0,
  0x50,0x90,0x91,0x51,0x93,0x53,0x52,0x92,0x96,0x56,0x57,0x97,0x55,0x95,0x94,0x54,
  0x9C,0x5C,0x5D,0x9D,0x5F,0x9F,0x9E,0x5E,0x5A,0x9A,0x9B,0x5B,0x99,0x59,0x58,0x98,
  0x88,0x48,0x49,0x89,0x4B,0x8B,0x8A,0x4A,0x4E,0x8E,0x8F,0x4F,0x8D,0x4D,0x4C,0x8C,
  0x44,0x84,0x85,0x45,0x87,0x47,0x46,0x86,0x82,0x42,0x43,0x83,0x41,0x81,0x80,0x40
];

function crc16Modbus(bytes) {
  var ucCRCHi = 0xFF, ucCRCLo = 0xFF;
  for (var i = 0; i < bytes.length; i++) {
    var idx = (ucCRCLo ^ bytes[i]) & 0xFF;
    ucCRCLo = ucCRCHi ^ CRC16_H[idx];
    ucCRCHi = CRC16_L[idx];
  }
  var crc = ((ucCRCHi & 0xFF) << 8) | (ucCRCLo & 0xFF);
  // 高低位互换
  crc = ((crc & 0xFF00) >> 8) | ((crc & 0x00FF) << 8);
  return [(crc & 0xFF), ((crc >> 8) & 0xFF)];
}

// ═══════════════════════════════════════════
//  工具函数
// ═══════════════════════════════════════════

function hexToBytes(hex) {
  hex = hex.replace(/\s+/g, "");
  var bytes = [];
  for (var i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

function bytesToHex(bytes) {
  var r = "";
  for (var i = 0; i < bytes.length; i++) {
    var h = bytes[i].toString(16).toUpperCase();
    if (h.length < 2) h = "0" + h;
    r += h;
  }
  return r;
}

function bcdToString(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) {
    var hi = ((bytes[i] & 0xFF) >> 4) + 48;
    var lo = (bytes[i] & 0x0F) + 48;
    s += String.fromCharCode(hi) + String.fromCharCode(lo);
  }
  return s;
}

function formatBcdTime10(bcdStr) {
  // YYMMDDHHmm -> 20YY-MM-DD HH:mm
  if (bcdStr.length < 10) return bcdStr;
  return "20" + bcdStr.substring(0,2) + "-" + bcdStr.substring(2,4) + "-" +
         bcdStr.substring(4,6) + " " + bcdStr.substring(6,8) + ":" + bcdStr.substring(8,10);
}

function formatBcdTime12(bcdStr) {
  // YYMMDDHHmmss -> 20YY-MM-DD HH:mm:ss
  if (bcdStr.length < 12) return bcdStr;
  return "20" + bcdStr.substring(0,2) + "-" + bcdStr.substring(2,4) + "-" +
         bcdStr.substring(4,6) + " " + bcdStr.substring(6,8) + ":" +
         bcdStr.substring(8,10) + ":" + bcdStr.substring(10,12);
}

// ═══════════════════════════════════════════
//  功能码编码表
// ═══════════════════════════════════════════

var FUNC_NAMES = {
  "2f": { name: "自报实时数据", short: "实时自报", direction: "上行" },
  "30": { name: "均匀时段遥测数据随机自报", short: "随机自报", direction: "上行" },
  "31": { name: "自报实时水文信息", short: "实时水文", direction: "上行" },
  "32": { name: "均匀时段水文信息自报确认", short: "水文确认", direction: "上行" },
  "33": { name: "遥测站定时报", short: "定时报", direction: "上行" },
  "34": { name: "均匀时段水文数据自报", short: "均匀自报", direction: "上行" },
  "37": { name: "中心站查询实时数据", short: "查询实时", direction: "下行" },
  "38": { name: "中心站查询均匀时段水文数据", short: "查询均匀", direction: "下行" },
  "3a": { name: "遥测站增量自报", short: "增量自报", direction: "上行" },
  "40": { name: "中心站设置遥测站工作参数", short: "设置参数", direction: "下行" },
  "41": { name: "中心站查询/读取遥测站参数", short: "查询参数", direction: "下行" },
  "45": { name: "中心站修改密码", short: "修改密码", direction: "下行" },
  "46": { name: "中心站设置遥测站数据转发地址", short: "设置转发", direction: "下行" },
  "81": { name: "图片数据传输", short: "图片传输", direction: "上行" },
  "e9": { name: "遥测站自报告警信息", short: "告警自报", direction: "上行" },
  "eb": { name: "遥测站心跳包", short: "心跳", direction: "上行" }
};

// ═══════════════════════════════════════════
//  遥测站分类码
// ═══════════════════════════════════════════

var STATION_TYPE = {
  "50": "河道", "51": "水库", "52": "闸坝", "53": "泵站",
  "54": "潮汐", "55": "堰槽", "60": "墒情", "70": "水质",
  "80": "气象", "90": "地下水", "A0": "水土保持"
};

// ═══════════════════════════════════════════
//  水文要素标识符 → 中文名 & 单位
// ═══════════════════════════════════════════

var ELEMENT_NAMES = {
  // ------ 标准水文要素 ------
  "04": { name: "1h内5min时段降水量", unit: "mm", type: "统计" },
  "05": { name: "1h内5min间隔相对水位", unit: "m", type: "统计" },
  "1a": { name: "1小时时段降水量", unit: "mm" },
  "1f": { name: "水位变化量", unit: "m" },
  "20": { name: "当前降雨量", unit: "mm" },
  "21": { name: "当日降雨量", unit: "mm" },
  "22": { name: "日降水量", unit: "mm" },
  "23": { name: "当前蒸发量", unit: "mm" },
  "26": { name: "降雨量累计值", unit: "mm" },
  "38": { name: "电源电压", unit: "V" },
  "39": { name: "瞬时河道水位/潮位", unit: "m" },
  "3b": { name: "库上水位/水库水位", unit: "m" },
  "f0": { name: "观测时间引导符", unit: "", type: "标识" },
  "f4": { name: "1h每5min时段降水量(统计)", unit: "mm", type: "统计" },
  "f5": { name: "1h内5min间隔相对水位(统计)", unit: "m", type: "统计" },

  // ------ 扩展要素（与 HydrologyElementConstants 对应）------
  // 基础
  "zz": { name: "水位", unit: "m" },
  "pp": { name: "降雨量", unit: "mm" },

  "dd": { name: "风向", unit: "°" },
  "tt": { name: "气温", unit: "℃" },
  "gg": { name: "水温", unit: "℃" },
  "uu": { name: "相对湿度", unit: "%" },
  "qq": { name: "流量", unit: "m³/s" },
  "ph": { name: "pH值", unit: "" },
  "do": { name: "溶解氧", unit: "mg/L" },
  "ec": { name: "电导率", unit: "μS/cm" },
  "tb": { name: "浊度", unit: "NTU" },

  // FF系列扩展
  "ff12": { name: "上游流速", unit: "m/s" },
  "ff13": { name: "下游流速", unit: "m/s" },
  "ff14": { name: "电池电压", unit: "V" },
  "ff15": { name: "电池容量", unit: "%" },
  "ff16": { name: "信号强度", unit: "dBm" },
  "ff17": { name: "设备温度", unit: "℃" },
  "ff18": { name: "设备湿度", unit: "%" },
  "ff19": { name: "设备状态", unit: "" },
  "ff1a": { name: "数据质量", unit: "" },

  // FF自定义字符串通道 (联云定制 50-59)
  "ff50": { name: "自定义通道1（字符串）", unit: "", type: "文本" },
  "ff51": { name: "自定义通道2（字符串）", unit: "", type: "文本" },
  "ff52": { name: "自定义通道3（字符串）", unit: "", type: "文本" },
  "ff53": { name: "自定义通道4（字符串）", unit: "", type: "文本" },
  "ff54": { name: "自定义通道5（字符串）", unit: "", type: "文本" },
  "ff55": { name: "自定义通道6（字符串）", unit: "", type: "文本" },
  "ff56": { name: "自定义通道7（字符串）", unit: "", type: "文本" },
  "ff57": { name: "自定义通道8（字符串）", unit: "", type: "文本" },
  "ff58": { name: "自定义通道9（字符串）", unit: "", type: "文本" },
  "ff59": { name: "自定义通道10（字符串）", unit: "", type: "文本" }
};

function getElementInfo(code) {
  var lower = code.toLowerCase();
  return ELEMENT_NAMES[lower] || { name: "未知要素(H" + code.toUpperCase() + ")", unit: "" };
}

// ═══════════════════════════════════════════
//  数据描述符解析 (参考 RequestMessageCodec.getLengthAndSpot)
// ═══════════════════════════════════════════

function parseDescriptor(descByte) {
  // 8位: [长度5bit][保留1bit][小数位2bit]
  var len = (descByte >> 3) & 0x1F;    // 高5位 = 数据长度(字节数)
  var decimal = descByte & 0x03;       // 低2位 = 小数位数
  return { length: len, decimal: decimal };
}

// 联云定制通道号判断 50-59
var CUSTOM_TEXT_CHANNELS = {"50":1,"51":1,"52":1,"53":1,"54":1,"55":1,"56":1,"57":1,"58":1,"59":1};

function isCustomTextChannel(channelNo) {
  return CUSTOM_TEXT_CHANNELS[channelNo] !== undefined;
}

// ═══════════════════════════════════════════
//  解析器入口
// ═══════════════════════════════════════════

function parse(rawData) {
  try {
    var hex = rawData.replace(/\s+/g, "").toUpperCase();

    // 1. 基本校验
    if (hex.length < 4 || hex.substring(0, 4) !== "7E7E") {
      return { success: false, protocolName: "SL651", summary: "",
               fields: [], error: "非 SL651 报文：缺少起始符 7E7E" };
    }
    if (hex.length < 34) {
      return { success: false, protocolName: "SL651", summary: "",
               fields: [], error: "报文长度不足：最少需要17字节（34个十六进制字符）" };
    }

    var bytes = hexToBytes(hex);
    var fields = [];
    var pos = 0;

    // 2. 起始符 (2B)
    fields.push({ key: "head", label: "起始符", value: "7E7E", group: "帧头", uiType: "code" });
    pos = 2;

    // 3. 中心站地址 (1B)
    var centralAddr = bytesToHex([bytes[pos]]);
    fields.push({ key: "centralAddr", label: "中心站地址", value: centralAddr, group: "帧头", isKeyInfo: true });
    pos += 1;

    // 4. 遥测站地址 (5B BCD)
    var stationBytes = bytes.slice(pos, pos + 5);
    var stationAddr = bytesToHex(stationBytes);
    var stationBcd = bcdToString(stationBytes);
    fields.push({ key: "stationAddr", label: "遥测站地址(MN)", value: stationAddr + " (BCD: " + stationBcd + ")", group: "帧头", isKeyInfo: true });
    pos += 5;

    // 5. 密码 (2B)
    var password = bytesToHex(bytes.slice(pos, pos + 2));
    fields.push({ key: "password", label: "密码", value: password, group: "帧头" });
    pos += 2;

    // 6. 功能码 (1B)
    var funcCode = bytesToHex([bytes[pos]]).toLowerCase();
    var funcInfo = FUNC_NAMES[funcCode] || { name: "未知功能码", short: "未知", direction: "?" };
    var funcColor = funcInfo.direction === "上行" ? "emerald" : funcInfo.direction === "下行" ? "blue" : "slate";
    fields.push({
      key: "funcCode", label: "功能码",
      value: "H" + funcCode.toUpperCase() + " (" + funcInfo.name + ") [" + funcInfo.direction + "]",
      group: "帧头",
      isKeyInfo: true,
      uiType: "badge",
      color: funcColor
    });
    pos += 1;

    // 7. 业务报文长度 (2B)
    var dataLen = (bytes[pos] << 8) | bytes[pos + 1];
    fields.push({ key: "dataLen", label: "业务报文长度", value: dataLen + " 字节 (H" + bytesToHex(bytes.slice(pos, pos + 2)) + ")", group: "帧头" });
    pos += 2;

    // 8. 报文起始符 (1B)
    var startTag = bytesToHex([bytes[pos]]);
    var startTagName = startTag === "02" ? "STX(起始)" : startTag;
    fields.push({ key: "startTag", label: "报文起始符", value: startTag + " (" + startTagName + ")", group: "帧头" });
    pos += 1;

    // 9. 业务报文 (dataLen字节)
    var bizEnd = pos + dataLen;
    if (bizEnd > bytes.length - 3) {
      bizEnd = bytes.length - 3; // 为结束符和CRC留空间
    }

    // 对于H81(图片传输), 先检查是否有分包信息
    var isH81 = funcCode === "81";
    var totalPacket = 1, picNum = 1;

    if (bizEnd > pos) {
      // 解析业务数据公共部分

      // 流水号 (2B)
      if (pos + 2 <= bizEnd) {
        var seqNo = bytesToHex(bytes.slice(pos, pos + 2));
        fields.push({ key: "seqNo", label: "流水号", value: seqNo, group: "业务数据" });
        pos += 2;
      }

      // 发报时间 (6B BCD: YYMMDDHHmmss)
      if (pos + 6 <= bizEnd) {
        var sendTimeBytes = bytes.slice(pos, pos + 6);
        var sendTimeBcd = bcdToString(sendTimeBytes);
        var sendTimeFormatted = formatBcdTime12(sendTimeBcd);
        fields.push({
          key: "sendTime", label: "发报时间",
          value: sendTimeFormatted + " (BCD: " + sendTimeBcd + ")",
          group: "业务数据"
        });
        pos += 6;
      }

      // 地址标识符 (2B) — 可选
      if (pos + 2 <= bizEnd) {
        var addrTag = bytesToHex(bytes.slice(pos, pos + 2));
        var addrTagDesc = addrTag === "F1F1" ? "遥测站地址" :
                          addrTag === "F2F2" ? "中心站地址" : addrTag;
        fields.push({
          key: "addrTag", label: "地址标识符",
          value: addrTag + " (" + addrTagDesc + ")",
          group: "业务数据"
        });
        pos += 2;
      }

      // 遥测站地址 (5B) — 可选
      if (pos + 5 <= bizEnd) {
        var bizStationBytes = bytes.slice(pos, pos + 5);
        var bizStation = bytesToHex(bizStationBytes);
        fields.push({ key: "bizStation", label: "遥测站地址(业务)", value: bizStation, group: "业务数据" });
        pos += 5;
      }

      // 遥测站分类 (1B) — 可选
      if (pos + 1 <= bizEnd) {
        var stationType = bytesToHex([bytes[pos]]).toUpperCase();
        var stationTypeName = STATION_TYPE[stationType] || "未知分类";
        fields.push({
          key: "stationType", label: "遥测站分类",
          value: stationType + " (" + stationTypeName + ")",
          group: "业务数据",
          uiType: "badge",
          color: "purple"
        });
        pos += 1;
      }

      // H81 图片分包头
      if (isH81 && pos + 3 <= bizEnd) {
        var packetHex = bytesToHex(bytes.slice(pos, pos + 3));
        totalPacket = parseInt(packetHex.substring(0, 3), 16);
        picNum = parseInt(packetHex.substring(3, 6), 16);
        fields.push({ key: "totalPacket", label: "总包数", value: "" + totalPacket, group: "图片传输" });
        fields.push({ key: "picNum", label: "包序号", value: "" + picNum, group: "图片传输" });
        pos += 3;
        // 剩余为图片数据
        if (pos < bizEnd) {
          var imgDataLen = bizEnd - pos;
          fields.push({ key: "imgData", label: "图片数据", value: imgDataLen + " 字节", group: "图片传输" });
          pos = bizEnd;
        }
      }

      // 解析水文要素（适用于H34, H38, H31, H30, H33, H2F, H3A等）
      if (!isH81 && pos < bizEnd) {
        parseHydrologyElements(bytes, pos, bizEnd, fields);
        pos = bizEnd;
      }
    }

    // 10. 结束符 (1B)
    if (pos < bytes.length) {
      var endTag = bytesToHex([bytes[pos]]);
      var endTagName = "";
      switch (endTag) {
        case "03": endTagName = "ETX(正常结束)"; break;
        case "05": endTagName = "ENQ(询问结束)"; break;
        case "06": endTagName = "ACK(确认结束)"; break;
        case "15": endTagName = "NAK(否认结束)"; break;
        case "04": endTagName = "EOT(传输结束)"; break;
        default: endTagName = endTag;
      }
      var endColor = endTag === "03" ? "emerald" : endTag === "06" ? "blue" : endTag === "15" ? "red" : "slate";
      fields.push({ key: "endTag", label: "结束符", value: endTag + " (" + endTagName + ")", group: "帧尾", uiType: "badge", color: endColor });
      pos += 1;
    }

    // 11. CRC校验 (2B)
    if (pos + 2 <= bytes.length) {
      var crcBytes = bytes.slice(pos, pos + 2);
      var crcHex = bytesToHex(crcBytes);

      // 计算CRC（对起始符到结束符部分）
      var crcData = bytes.slice(0, pos);
      var computed = crc16Modbus(crcData);
      var computedHex = bytesToHex(computed);

      var isOk = crcHex.toUpperCase() === computedHex.toUpperCase();
      var crcDisplay = crcHex;
      if (isOk) {
        crcDisplay += " ✓ 校验通过";
      } else {
        crcDisplay += " ✗ 校验失败 (预期 " + computedHex + ")";
      }
      fields.push({ key: "crc", label: "CRC16 Modbus", value: crcDisplay, group: "帧尾", uiType: "badge", color: isOk ? "emerald" : "red", isKeyInfo: true });
    }

    // 12. 总长度
    fields.push({ key: "totalLen", label: "报文总长度", value: bytes.length + " 字节", group: "帧尾" });

    // 生成摘要
    var summary = "SL651 " + funcInfo.short + " [" + stationAddr + "]";

    // 生成 layout（插件自控布局）
    var layout = buildLayout(fields);

    return {
      success: true,
      protocolName: "SL651",
      summary: summary,
      fields: fields,
      layout: layout
    };

  } catch (e) {
    return {
      success: false,
      protocolName: "SL651",
      summary: "",
      fields: [],
      error: "解析异常: " + e.toString()
    };
  }
}

// ═══════════════════════════════════════════
//  Layout 布局生成（插件自控渲染）
// ═══════════════════════════════════════════

function buildLayout(fields) {
  var sections = [];

  // 按 group 分组收集
  var groupMap = {};
  var groupOrder = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var g = f.group || "__ungrouped";
    if (!groupMap[g]) {
      groupMap[g] = [];
      groupOrder.push(g);
    }
    groupMap[g].push(f);
  }

  // 分组色彩与样式映射
  var styleMap = {
    "帧头": { style: "key-value", color: "blue" },
    "业务数据": { style: "key-value", color: "teal" },
    "水文要素": { style: "grid", color: "cyan" },
    "图片传输": { style: "key-value", color: "purple" },
    "帧尾": { style: "key-value", color: "slate" }
  };

  for (var gi = 0; gi < groupOrder.length; gi++) {
    var group = groupOrder[gi];
    var gFields = groupMap[group];
    var mapping = styleMap[group] || { style: "key-value", color: "slate" };

    var keys = [];
    for (var ki = 0; ki < gFields.length; ki++) {
      keys.push(gFields[ki].key);
    }

    sections.push({
      title: group,
      style: mapping.style,
      color: mapping.color,
      fieldKeys: keys
    });
  }

  return { sections: sections };
}

// ═══════════════════════════════════════════
//  水文要素解析
// ═══════════════════════════════════════════

function parseHydrologyElements(bytes, start, end, fields) {
  var pos = start;
  var elementIndex = 0;

  while (pos < end) {
    elementIndex++;
    var keyByte = bytes[pos];
    var keyHex = bytesToHex([keyByte]).toLowerCase();
    pos += 1;

    if (pos >= end) break;

    // --- F0: 观测时间引导符 ---
    // 两种情况:
    //   1. F0F0 观测时间标识符(2字节) + 5字节BCD时间 (首次，在公共头之后)
    //   2. F0 单字节 + 1字节描述 + 5字节BCD时间 (循环内观测时间更新，与 ElementCodec.f0Decode 一致)
    if (keyHex === "f0") {
      if (pos < end && bytesToHex([bytes[pos]]).toLowerCase() === "f0") {
        // F0F0 双字节标识符模式
        pos += 1; // 跳过第二个F0
        if (pos + 5 > end) break;
        var obsTimeBytes = bytes.slice(pos, pos + 5);
        var obsTimeBcd = bcdToString(obsTimeBytes);
        fields.push({
          key: "obsTime_" + elementIndex, label: "📅 观测时间(F0F0标识)",
          value: formatBcdTime10(obsTimeBcd),
          group: "水文要素"
        });
        pos += 5;
      } else {
        // F0 单字节模式 (ElementCodec.f0Decode: 1B描述 + 5B BCD时间)
        if (pos + 6 > end) break;
        pos += 1; // 跳过描述字节
        var obsTimeBytes2 = bytes.slice(pos, pos + 5);
        var obsTimeBcd2 = bcdToString(obsTimeBytes2);
        fields.push({
          key: "obsTime_" + elementIndex, label: "📅 观测时间(F0引导)",
          value: formatBcdTime10(obsTimeBcd2),
          group: "水文要素"
        });
        pos += 5;
      }
      continue;
    }

    // --- FF: 扩展/自定义通道 ---
    if (keyHex === "ff") {
      if (pos >= end) break;
      var channelNo = bytesToHex([bytes[pos]]).toLowerCase();
      pos += 1;

      if (isCustomTextChannel(channelNo)) {
        // 联云定制文本通道: FF + channelNo(1B) + 长度(1B) + 文本(NB)
        if (pos >= end) break;
        var textLen = bytes[pos];
        pos += 1;
        if (pos + textLen > end) break;
        var textBytes = bytes.slice(pos, pos + textLen);
        var textStr = "";
        for (var ti = 0; ti < textBytes.length; ti++) {
          textStr += String.fromCharCode(textBytes[ti]);
        }
        var chInfo = getElementInfo("ff" + channelNo);
        fields.push({
          key: "elem_ff" + channelNo + "_" + elementIndex,
          label: "📝 " + chInfo.name,
          value: textStr,
          group: "水文要素"
        });
        pos += textLen;
      } else {
        // FF + 非文本通道: 当作标准水文要素处理
        if (pos >= end) break;
        var ffDescByte = bytes[pos];
        pos += 1;
        var ffDesc = parseDescriptor(ffDescByte);
        if (pos + ffDesc.length > end) break;
        var ffValBytes = bytes.slice(pos, pos + ffDesc.length);
        var ffValBcd = bcdToString(ffValBytes);
        var ffValue = bcdValueToDecimal(ffValBcd, ffDesc.decimal);
        var ffInfo = getElementInfo("ff" + channelNo);
        fields.push({
          key: "elem_ff" + channelNo + "_" + elementIndex,
          label: "📊 " + ffInfo.name,
          value: ffValue + (ffInfo.unit ? " " + ffInfo.unit : ""),
          unit: ffInfo.unit,
          group: "水文要素"
        });
        pos += ffDesc.length;
      }
      continue;
    }


    // --- F4: 统计降水 (5分钟间隔) ---
    if (keyHex === "f4") {
      var result = parseStatisticalElement(bytes, pos, end, keyHex, elementIndex, fields, 1, "0.1");
      pos = result;
      continue;
    }

    // --- F5: 统计水位 (5分钟间隔) ---
    if (keyHex === "f5") {
      var result2 = parseStatisticalElement(bytes, pos, end, keyHex, elementIndex, fields, 2, "0.01");
      pos = result2;
      continue;
    }

    // --- 标准水文要素: key(1B) + descriptor(1B) + value(NB BCD) ---
    if (pos >= end) break;
    var descByte = bytes[pos];
    pos += 1;
    var desc = parseDescriptor(descByte);

    if (desc.length <= 0 || pos + desc.length > end) {
      fields.push({
        key: "parseWarn_" + elementIndex,
        label: "⚠️ 解析警告",
        value: "要素 H" + keyHex.toUpperCase() + " 数据描述异常: 长度=" + desc.length + ", 小数位=" + desc.decimal,
        group: "水文要素"
      });
      break;
    }

    var valBytes = bytes.slice(pos, pos + desc.length);
    var valBcd = bcdToString(valBytes);
    var value = bcdValueToDecimal(valBcd, desc.decimal);
    var elemInfo = getElementInfo(keyHex);

    fields.push({
      key: "elem_" + keyHex + "_" + elementIndex,
      label: "📊 " + elemInfo.name,
      value: value + (elemInfo.unit ? " " + elemInfo.unit : ""),
      unit: elemInfo.unit,
      group: "水文要素"
    });

    pos += desc.length;
  }
}

// ═══════════════════════════════════════════
//  统计要素解析（F4/F5 等5分钟间隔数据）
// ═══════════════════════════════════════════

function parseStatisticalElement(bytes, pos, end, keyHex, elementIndex, fields, perSize, multiplier) {
  if (pos >= end) return pos;
  var descByte = bytes[pos];
  pos += 1;
  var desc = parseDescriptor(descByte);
  var elemInfo = getElementInfo(keyHex);
  var count = Math.floor(desc.length / perSize);
  var values = [];

  for (var i = 0; i < count && pos + perSize <= end; i++) {
    var vBytes = bytes.slice(pos, pos + perSize);
    var vHex = bytesToHex(vBytes);
    var vInt = parseInt(vHex, 16);
    var vDec = (vInt * parseFloat(multiplier)).toFixed(multiplier === "0.1" ? 1 : 2);
    values.push(vDec);
    pos += perSize;
  }

  fields.push({
    key: "elem_" + keyHex + "_" + elementIndex,
    label: "📊 " + elemInfo.name + " (" + count + "组)",
    value: values.join(", ") + (elemInfo.unit ? " " + elemInfo.unit : ""),
    unit: elemInfo.unit,
    group: "水文要素"
  });

  return pos;
}

// ═══════════════════════════════════════════
//  BCD值转十进制
// ═══════════════════════════════════════════

function bcdValueToDecimal(bcdStr, decimalPlaces) {
  // 处理无效BCD
  if (bcdStr.indexOf("?") >= 0 || bcdStr.toLowerCase().indexOf("ff") === 0) {
    return "无效数据";
  }
  try {
    var num = parseInt(bcdStr, 10);
    if (isNaN(num)) return bcdStr;
    if (decimalPlaces === 0) return "" + num;
    var divisor = Math.pow(10, decimalPlaces);
    return (num / divisor).toFixed(decimalPlaces);
  } catch (e) {
    return bcdStr;
  }
}

// ═══════════════════════════════════════════
//  报文生成器
// ═══════════════════════════════════════════

/**
 * 生成 SL651 报文
 * @param {Object} params 参数对象
 * @param {string} params.centralAddr   中心站地址 (2个hex字符, 如 "01")
 * @param {string} params.stationAddr   遥测站地址 (10个hex字符, 如 "1234567890")
 * @param {string} params.password      密码 (4个hex字符, 如 "0000")
 * @param {string} params.funcCode      功能码 (2个hex字符, 如 "34")
 * @param {string} params.seqNo         流水号 (4个hex字符, 如 "0001")
 * @param {string} params.sendTime      发报时间 BCD (12个字符 YYMMDDHHmmss)
 * @param {string} params.stationType   遥测站分类 (2个hex字符, 如 "50"=河道)
 * @param {string} params.observeTime   观测时间 BCD (10个字符 YYMMDDHHmm)
 * @param {Array}  params.elements      水文要素数组 [{ code, value, decimal, length }]
 *   - code:    要素标识符 (如 "39"=水位)
 *   - value:   BCD值字符串 (如 "00012345")
 *   - decimal: 小数位数 (如 3)
 *   - length:  数据字节数 (如 4)
 * @returns {Object} { success, protocolName, message, error }
 */
function generate(params) {
  try {
    var centralAddr = params.centralAddr || "01";
    var stationAddr = params.stationAddr || "0000000000";
    var password = params.password || "0000";
    var funcCode = params.funcCode || "34";
    var seqNo = params.seqNo || "0001";
    var sendTime = params.sendTime || getNowBcd12();
    var stationType = params.stationType || "50";
    var observeTime = params.observeTime || getNowBcd10();

    // 构造业务数据
    var bizHex = seqNo + sendTime + "F1F1" + stationAddr + stationType;

    // 观测时间
    bizHex += "F0F0" + observeTime;

    // 水文要素
    var elements = params.elements || [];
    for (var i = 0; i < elements.length; i++) {
      var elem = elements[i];
      var descByte = ((elem.length & 0x1F) << 3) | (elem.decimal & 0x03);
      var descHex = descByte.toString(16).toUpperCase();
      if (descHex.length < 2) descHex = "0" + descHex;
      bizHex += elem.code.toUpperCase() + descHex + elem.value.toUpperCase();
    }

    var dataLen = bizHex.length / 2;
    var dataLenHex = dataLen.toString(16).toUpperCase();
    while (dataLenHex.length < 4) dataLenHex = "0" + dataLenHex;

    // 组装完整帧 (不含CRC)
    var frameHex = "7E7E" + centralAddr.toUpperCase() + stationAddr.toUpperCase() +
                   password.toUpperCase() + funcCode.toUpperCase() +
                   dataLenHex + "02" + bizHex.toUpperCase() + "03";

    // 计算CRC
    var frameBytes = hexToBytes(frameHex);
    var crcResult = crc16Modbus(frameBytes);
    var crcHex = bytesToHex(crcResult);

    var fullMessage = frameHex + crcHex;

    // 格式化输出（带空格）
    var formatted = "";
    for (var j = 0; j < fullMessage.length; j += 2) {
      if (j > 0) formatted += " ";
      formatted += fullMessage.substring(j, j + 2);
    }

    return {
      success: true,
      protocolName: "SL651",
      message: fullMessage,
      formatted: formatted,
      error: null
    };
  } catch (e) {
    return {
      success: false,
      protocolName: "SL651",
      message: "",
      error: "生成异常: " + e.toString()
    };
  }
}

// ═══════════════════════════════════════════
//  辅助：获取当前时间BCD
// ═══════════════════════════════════════════

function getNowBcd12() {
  var d = new Date();
  var yy = (d.getFullYear() % 100).toString(); if (yy.length < 2) yy = "0" + yy;
  var mm = (d.getMonth() + 1).toString(); if (mm.length < 2) mm = "0" + mm;
  var dd = d.getDate().toString(); if (dd.length < 2) dd = "0" + dd;
  var hh = d.getHours().toString(); if (hh.length < 2) hh = "0" + hh;
  var mi = d.getMinutes().toString(); if (mi.length < 2) mi = "0" + mi;
  var ss = d.getSeconds().toString(); if (ss.length < 2) ss = "0" + ss;
  return yy + mm + dd + hh + mi + ss;
}

function getNowBcd10() {
  var d = new Date();
  var yy = (d.getFullYear() % 100).toString(); if (yy.length < 2) yy = "0" + yy;
  var mm = (d.getMonth() + 1).toString(); if (mm.length < 2) mm = "0" + mm;
  var dd = d.getDate().toString(); if (dd.length < 2) dd = "0" + dd;
  var hh = d.getHours().toString(); if (hh.length < 2) hh = "0" + hh;
  var mi = d.getMinutes().toString(); if (mi.length < 2) mi = "0" + mi;
  return yy + mm + dd + hh + mi;
}
