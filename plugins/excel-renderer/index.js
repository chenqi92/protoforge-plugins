/**
 * Excel Renderer Plugin — ProtoForge
 *
 * 在 boa_engine (Rust JS 沙箱) 中运行。
 *
 * 宿主（Rust）已预处理：
 *   - base64 解码 → ZIP 提取 → 注入 __ZIP_FILES 全局变量
 *   - __ZIP_FILES = { "xl/workbook.xml": "...", "xl/sharedStrings.xml": "...", ... }
 *
 * 本插件只做轻量的 XML 文本解析 → 表格数据。
 *
 * 接口约定：render(base64Data) → RenderResult
 */

// ── XML 解析辅助 ──

function extractTagContent(xml, tag) {
  var results = [];
  var openTag = '<' + tag;
  var closeTag = '</' + tag + '>';
  var idx = 0;
  while (idx < xml.length) {
    var start = xml.indexOf(openTag, idx);
    if (start === -1) break;
    var tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) break;
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

function getAllMatchingTags(xml, tagName) {
  var results = [];
  var pattern = '<' + tagName;
  var idx = 0;
  while (idx < xml.length) {
    var start = xml.indexOf(pattern, idx);
    if (start === -1) break;
    var nextChar = xml[start + pattern.length];
    if (nextChar !== ' ' && nextChar !== '>' && nextChar !== '/') {
      idx = start + 1;
      continue;
    }
    var tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) break;
    var fullTag = xml.substring(start, tagEnd + 1);

    // 解析属性
    var attrs = {};
    var attrRegion = fullTag.substring(pattern.length, fullTag.length - (fullTag[fullTag.length - 2] === '/' ? 2 : 1));
    var parts = attrRegion.split('"');
    for (var i = 0; i < parts.length - 1; i += 2) {
      var keyPart = parts[i].trim();
      if (keyPart.length > 0 && keyPart[keyPart.length - 1] === '=') {
        attrs[keyPart.substring(0, keyPart.length - 1).trim()] = parts[i + 1];
      }
    }

    // 获取内容
    var content = '';
    if (fullTag[fullTag.length - 2] !== '/') {
      var closeTag2 = '</' + tagName + '>';
      var closeIdx = xml.indexOf(closeTag2, tagEnd);
      if (closeIdx !== -1) {
        content = xml.substring(tagEnd + 1, closeIdx);
        idx = closeIdx + closeTag2.length;
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

// ── 列号解析 ──

function colRefToIndex(ref) {
  var col = 0;
  for (var i = 0; i < ref.length; i++) {
    var c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) col = col * 26 + (c - 64);
  }
  return col - 1;
}

function cellRefToColRow(ref) {
  var colStr = '', rowStr = '';
  for (var i = 0; i < ref.length; i++) {
    var c = ref.charCodeAt(i);
    if (c >= 65 && c <= 90) colStr += ref[i];
    else rowStr += ref[i];
  }
  return { col: colRefToIndex(colStr), row: parseInt(rowStr) - 1 };
}

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
    // 使用宿主预提取的 ZIP 文件内容（__ZIP_FILES 由 Rust 注入）
    if (typeof __ZIP_FILES === 'undefined' || __ZIP_FILES === null) {
      return { type: 'table', sheets: [], error: '宿主未提供预处理的 ZIP 文件数据' };
    }

    var files = __ZIP_FILES;

    // 读取 workbook.xml 获取 sheet 名称
    var workbookXml = files['xl/workbook.xml'] || '';
    var sheetTags = getAllMatchingTags(workbookXml, 'sheet');
    var sheetNames = [];
    for (var i = 0; i < sheetTags.length; i++) {
      sheetNames.push(sheetTags[i].attrs['name'] || ('Sheet' + (i + 1)));
    }
    if (sheetNames.length === 0) sheetNames.push('Sheet1');

    // 读取 sharedStrings.xml
    var ssXml = files['xl/sharedStrings.xml'] || '';
    var sharedStrings = [];
    var siTags = extractTagContent(ssXml, 'si');
    for (var i = 0; i < siTags.length; i++) {
      var tTags = extractTagContent(siTags[i], 't');
      sharedStrings.push(decodeXmlEntities(tTags.join('')));
    }

    // 解析每个 sheet
    var sheets = [];
    for (var si = 0; si < sheetNames.length; si++) {
      var sheetFile = files['xl/worksheets/sheet' + (si + 1) + '.xml'] || '';
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
            var ssIdx = parseInt(rawVal);
            value = sharedStrings[ssIdx] || '';
          } else if (type === 'inlineStr') {
            var tContent = extractTagContent(cell.content, 't');
            value = decodeXmlEntities(tContent.join(''));
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

      // 第一行作为表头
      var columns = [];
      if (rowData.length > 0) {
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
