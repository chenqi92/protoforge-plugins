/**
 * Excel Renderer Plugin — ProtoForge
 *
 * 在 boa_engine (Rust JS 沙箱) 中运行。
 * 不依赖 Node.js/Browser API，纯 JS 实现。
 *
 * 接口约定：
 *   render(base64Data: string) → RenderResult
 *
 * RenderResult = {
 *   type: "table",
 *   sheets: [{ name, columns, rows }],
 *   error?: string
 * }
 *
 * XLSX 文件格式本质是 ZIP 容器内含 XML 文件：
 *   xl/workbook.xml   → Sheet 名称列表
 *   xl/sharedStrings.xml → 共享字符串表
 *   xl/worksheets/sheet1.xml → 各 sheet 的单元格数据
 */

// ── Mini Base64 解码 ──
function base64Decode(b64) {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var lookup = {};
  for (var i = 0; i < 64; i++) lookup[chars[i]] = i;

  var raw = b64.replace(/[^A-Za-z0-9+/]/g, '');
  var len = raw.length;
  var outLen = (len * 3) >> 2;
  if (b64[b64.length - 1] === '=') outLen--;
  if (b64[b64.length - 2] === '=') outLen--;

  var bytes = new Array(outLen);
  var p = 0;
  for (var i = 0; i < len; i += 4) {
    var a = lookup[raw[i]] || 0;
    var b = lookup[raw[i + 1]] || 0;
    var c = lookup[raw[i + 2]] || 0;
    var d = lookup[raw[i + 3]] || 0;
    var bits = (a << 18) | (b << 12) | (c << 6) | d;
    if (p < outLen) bytes[p++] = (bits >> 16) & 0xff;
    if (p < outLen) bytes[p++] = (bits >> 8) & 0xff;
    if (p < outLen) bytes[p++] = bits & 0xff;
  }
  return bytes;
}

// ── Mini ZIP 解析 (仅解压 Store + Deflate) ──
function parseZip(bytes) {
  var files = {};
  var i = 0;
  while (i < bytes.length - 4) {
    // 查找 Local file header 签名 PK\x03\x04
    if (bytes[i] !== 0x50 || bytes[i + 1] !== 0x4b || bytes[i + 2] !== 0x03 || bytes[i + 3] !== 0x04) {
      i++;
      continue;
    }
    var compression = bytes[i + 8] | (bytes[i + 9] << 8);
    var compressedSize = bytes[i + 18] | (bytes[i + 19] << 8) | (bytes[i + 20] << 16) | (bytes[i + 21] << 24);
    var uncompressedSize = bytes[i + 22] | (bytes[i + 23] << 8) | (bytes[i + 24] << 16) | (bytes[i + 25] << 24);
    var nameLen = bytes[i + 26] | (bytes[i + 27] << 8);
    var extraLen = bytes[i + 28] | (bytes[i + 29] << 8);
    var nameBytes = bytes.slice(i + 30, i + 30 + nameLen);
    var name = '';
    for (var j = 0; j < nameBytes.length; j++) name += String.fromCharCode(nameBytes[j]);
    var dataStart = i + 30 + nameLen + extraLen;

    if (compression === 0) {
      // Store — 无压缩
      var data = bytes.slice(dataStart, dataStart + compressedSize);
      files[name] = bytesToString(data);
    } else if (compression === 8) {
      // Deflate — 使用内置 inflateRaw
      var compData = bytes.slice(dataStart, dataStart + compressedSize);
      try {
        files[name] = inflateRaw(compData, uncompressedSize);
      } catch (e) {
        // 跳过无法解压的文件
      }
    }
    i = dataStart + compressedSize;
  }
  return files;
}

function bytesToString(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

// ── Minimal Inflate (raw deflate, no zlib header) ──

// 固定 Huffman 表
var FIXED_LIT_TABLE = null;
var FIXED_DIST_TABLE = null;

function buildFixedTables() {
  if (FIXED_LIT_TABLE) return;
  var lengths = new Array(288);
  var i;
  for (i = 0; i <= 143; i++) lengths[i] = 8;
  for (i = 144; i <= 255; i++) lengths[i] = 9;
  for (i = 256; i <= 279; i++) lengths[i] = 7;
  for (i = 280; i <= 287; i++) lengths[i] = 8;
  FIXED_LIT_TABLE = buildHuffmanTable(lengths);

  var distLengths = new Array(32);
  for (i = 0; i < 32; i++) distLengths[i] = 5;
  FIXED_DIST_TABLE = buildHuffmanTable(distLengths);
}

function buildHuffmanTable(lengths) {
  var maxLen = 0;
  for (var i = 0; i < lengths.length; i++) {
    if (lengths[i] > maxLen) maxLen = lengths[i];
  }
  var table = { maxLen: maxLen, symbols: {} };
  var code = 0;
  for (var len = 1; len <= maxLen; len++) {
    for (var sym = 0; sym < lengths.length; sym++) {
      if (lengths[sym] === len) {
        var key = '';
        for (var b = len - 1; b >= 0; b--) key += ((code >> b) & 1);
        table.symbols[key] = sym;
        code++;
      }
    }
    code <<= 1;
  }
  return table;
}

function readHuffman(reader, table) {
  var code = '';
  for (var i = 0; i < table.maxLen; i++) {
    code += reader.readBit();
    if (table.symbols[code] !== undefined) return table.symbols[code];
  }
  return -1;
}

// Bit reader
function BitReader(bytes) {
  this.data = bytes;
  this.bytePos = 0;
  this.bitPos = 0;
}

BitReader.prototype.readBit = function () {
  if (this.bytePos >= this.data.length) return 0;
  var bit = (this.data[this.bytePos] >> this.bitPos) & 1;
  this.bitPos++;
  if (this.bitPos >= 8) { this.bitPos = 0; this.bytePos++; }
  return '' + bit;
};

BitReader.prototype.readBits = function (n) {
  var val = 0;
  for (var i = 0; i < n; i++) {
    val |= (parseInt(this.readBit()) << i);
  }
  return val;
};

BitReader.prototype.alignByte = function () {
  if (this.bitPos > 0) { this.bitPos = 0; this.bytePos++; }
};

var LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
var LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
var CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function inflateRaw(compData, expectedSize) {
  buildFixedTables();
  var reader = new BitReader(compData);
  var output = [];

  while (true) {
    var bfinal = reader.readBits(1);
    var btype = reader.readBits(2);

    if (btype === 0) {
      // No compression
      reader.alignByte();
      var len = reader.data[reader.bytePos] | (reader.data[reader.bytePos + 1] << 8);
      reader.bytePos += 4; // skip len + nlen
      for (var i = 0; i < len; i++) output.push(reader.data[reader.bytePos++]);
    } else {
      var litTable, distTable;
      if (btype === 1) {
        litTable = FIXED_LIT_TABLE;
        distTable = FIXED_DIST_TABLE;
      } else if (btype === 2) {
        // Dynamic Huffman
        var hlit = reader.readBits(5) + 257;
        var hdist = reader.readBits(5) + 1;
        var hclen = reader.readBits(4) + 4;
        var clLengths = new Array(19);
        for (var i = 0; i < 19; i++) clLengths[i] = 0;
        for (var i = 0; i < hclen; i++) clLengths[CL_ORDER[i]] = reader.readBits(3);
        var clTable = buildHuffmanTable(clLengths);

        var allLengths = [];
        while (allLengths.length < hlit + hdist) {
          var sym = readHuffman(reader, clTable);
          if (sym <= 15) {
            allLengths.push(sym);
          } else if (sym === 16) {
            var rep = reader.readBits(2) + 3;
            var prev = allLengths[allLengths.length - 1] || 0;
            for (var r = 0; r < rep; r++) allLengths.push(prev);
          } else if (sym === 17) {
            var rep = reader.readBits(3) + 3;
            for (var r = 0; r < rep; r++) allLengths.push(0);
          } else if (sym === 18) {
            var rep = reader.readBits(7) + 11;
            for (var r = 0; r < rep; r++) allLengths.push(0);
          }
        }
        litTable = buildHuffmanTable(allLengths.slice(0, hlit));
        distTable = buildHuffmanTable(allLengths.slice(hlit, hlit + hdist));
      } else {
        break; // invalid
      }

      while (true) {
        var sym = readHuffman(reader, litTable);
        if (sym < 0 || sym === 256) break;
        if (sym < 256) {
          output.push(sym);
        } else {
          var li = sym - 257;
          var length = LENGTH_BASE[li] + reader.readBits(LENGTH_EXTRA[li]);
          var di = readHuffman(reader, distTable);
          var distance = DIST_BASE[di] + reader.readBits(DIST_EXTRA[di]);
          var start = output.length - distance;
          for (var k = 0; k < length; k++) output.push(output[start + k]);
        }
      }
    }
    if (bfinal) break;
  }

  var s = '';
  for (var i = 0; i < output.length; i++) s += String.fromCharCode(output[i]);
  return s;
}

// ── XML 解析辅助 ──
function extractTagContent(xml, tag) {
  var results = [];
  var openTag = '<' + tag;
  var closeTag = '</' + tag + '>';
  var idx = 0;
  while (idx < xml.length) {
    var start = xml.indexOf(openTag, idx);
    if (start === -1) break;
    // 查找 > 找到标签结束位置
    var tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) break;
    // 自闭合标签 <tag ... />
    if (xml[tagEnd - 1] === '/') {
      idx = tagEnd + 1;
      continue;
    }
    var end = xml.indexOf(closeTag, tagEnd);
    if (end === -1) break;
    results.push(xml.substring(tagEnd + 1, end));
    idx = end + closeTag.length;
  }
  return results;
}

function getAttr(xml, tag, attr) {
  var pattern = '<' + tag;
  var idx = xml.indexOf(pattern);
  if (idx === -1) return '';
  var tagEnd = xml.indexOf('>', idx);
  if (tagEnd === -1) return '';
  var tagStr = xml.substring(idx, tagEnd + 1);
  var attrIdx = tagStr.indexOf(attr + '="');
  if (attrIdx === -1) return '';
  var valStart = attrIdx + attr.length + 2;
  var valEnd = tagStr.indexOf('"', valStart);
  return tagStr.substring(valStart, valEnd);
}

function getAllMatchingTags(xml, tagName) {
  var results = [];
  var pattern = '<' + tagName;
  var idx = 0;
  while (idx < xml.length) {
    var start = xml.indexOf(pattern, idx);
    if (start === -1) break;
    // 确保是完整标签而非子串匹配
    var nextChar = xml[start + pattern.length];
    if (nextChar !== ' ' && nextChar !== '>' && nextChar !== '/') {
      idx = start + 1;
      continue;
    }
    var tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) break;
    var fullTag = xml.substring(start, tagEnd + 1);

    // 获取属性
    var attrs = {};
    var attrRegion = fullTag.substring(pattern.length, fullTag.length - (fullTag[fullTag.length - 2] === '/' ? 2 : 1));
    var attrParts = attrRegion.split('"');
    for (var i = 0; i < attrParts.length - 1; i += 2) {
      var keyPart = attrParts[i].trim();
      if (keyPart[keyPart.length - 1] === '=') {
        var key = keyPart.substring(0, keyPart.length - 1).trim();
        attrs[key] = attrParts[i + 1];
      }
    }

    // 获取内容（非自闭合）
    var content = '';
    if (fullTag[fullTag.length - 2] !== '/') {
      var closeTag = '</' + tagName + '>';
      var closeIdx = xml.indexOf(closeTag, tagEnd);
      if (closeIdx !== -1) {
        content = xml.substring(tagEnd + 1, closeIdx);
        idx = closeIdx + closeTag.length;
      } else {
        idx = tagEnd + 1;
      }
    } else {
      idx = tagEnd + 1;
    }

    results.push({ attrs: attrs, content: content });
  }
  return results;
}

// ── 列号解析 (A=0, B=1, ..., Z=25, AA=26) ──
function colRefToIndex(ref) {
  var col = 0;
  for (var i = 0; i < ref.length; i++) {
    var c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      col = col * 26 + (c - 64);
    }
  }
  return col - 1;
}

function cellRefToColRow(ref) {
  var colStr = '';
  var rowStr = '';
  for (var i = 0; i < ref.length; i++) {
    var c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) colStr += ref[i];
    else rowStr += ref[i];
  }
  return { col: colRefToIndex(colStr), row: parseInt(rowStr) - 1 };
}

// ── 解码 XML 实体 ──
function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ── 主渲染函数 ──
function render(base64Data) {
  try {
    var bytes = base64Decode(base64Data);
    var zipFiles = parseZip(bytes);

    // 读取 workbook.xml 获取 sheet 名称
    var workbookXml = zipFiles['xl/workbook.xml'] || '';
    var sheetTags = getAllMatchingTags(workbookXml, 'sheet');
    var sheetNames = [];
    for (var i = 0; i < sheetTags.length; i++) {
      sheetNames.push(sheetTags[i].attrs['name'] || ('Sheet' + (i + 1)));
    }
    if (sheetNames.length === 0) sheetNames.push('Sheet1');

    // 读取 sharedStrings.xml
    var ssXml = zipFiles['xl/sharedStrings.xml'] || '';
    var sharedStrings = [];
    var siTags = extractTagContent(ssXml, 'si');
    for (var i = 0; i < siTags.length; i++) {
      // si 内可能有多个 <t> (rich text)
      var tTags = extractTagContent(siTags[i], 't');
      sharedStrings.push(decodeXmlEntities(tTags.join('')));
    }

    // 解析每个 sheet
    var sheets = [];
    for (var si = 0; si < sheetNames.length; si++) {
      var sheetFile = zipFiles['xl/worksheets/sheet' + (si + 1) + '.xml'] || '';
      if (!sheetFile) {
        sheets.push({ name: sheetNames[si], columns: [], rows: [] });
        continue;
      }

      var allRows = getAllMatchingTags(sheetFile, 'row');
      var maxCol = 0;
      var rowData = [];

      for (var ri = 0; ri < allRows.length; ri++) {
        var cells = getAllMatchingTags(allRows[ri].content, 'c');
        var rowCells = {};
        for (var ci = 0; ci < cells.length; ci++) {
          var cell = cells[ci];
          var ref = cell.attrs['r'] || '';
          var type = cell.attrs['t'] || '';
          var vTags = extractTagContent(cell.content, 'v');
          var rawVal = vTags.length > 0 ? vTags[0] : '';

          var value = '';
          if (type === 's' && rawVal !== '') {
            // Shared string reference
            var ssIdx = parseInt(rawVal);
            value = sharedStrings[ssIdx] || '';
          } else if (type === 'inlineStr') {
            var tTags = extractTagContent(cell.content, 't');
            value = decodeXmlEntities(tTags.join(''));
          } else {
            value = decodeXmlEntities(rawVal);
          }

          if (ref) {
            var pos = cellRefToColRow(ref);
            rowCells[pos.col] = value;
            if (pos.col + 1 > maxCol) maxCol = pos.col + 1;
          }
        }
        rowData.push(rowCells);
      }

      // 构建 columns 和 rows
      var columns = [];
      if (rowData.length > 0) {
        // 第一行作为表头
        for (var c = 0; c < maxCol; c++) {
          columns.push(rowData[0][c] || ('Col ' + (c + 1)));
        }
      }

      var rows = [];
      for (var r = 1; r < rowData.length; r++) {
        var row = [];
        for (var c = 0; c < maxCol; c++) {
          row.push(rowData[r][c] !== undefined ? String(rowData[r][c]) : '');
        }
        rows.push(row);
      }

      sheets.push({ name: sheetNames[si], columns: columns, rows: rows });
    }

    return { type: 'table', sheets: sheets };
  } catch (e) {
    return { type: 'table', sheets: [], error: 'Excel 解析错误: ' + (e.message || String(e)) };
  }
}
