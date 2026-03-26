# ProtoForge Plugin Rendering Guide

ProtoForge 插件渲染引擎完整参考文档。适用于 `protocol-parser` 类型插件开发者。

---

## 渲染架构概述

插件 `parse()` 函数返回的 `ParseResult` 支持两层渲染控制：

1. **字段级** (`ParsedField`) -- 控制单个字段的显示样式（badge/色点/代码块等）
2. **布局级** (`LayoutConfig`) -- 控制整体排版结构（登记表/键值表/卡片网格等）

```
parse(rawData) -> {
  fields: ParsedField[],   // 必须: 所有解析出的字段
  layout?: LayoutConfig,   // 可选: 插件自控布局（无则使用默认分组渲染）
}
```

> **回退机制**: 未提供 `layout` 时，前端按 `field.group` 自动分组渲染。插件返回错误不会影响其他插件或导致软件崩溃。

---

## 一、字段级渲染 (ParsedField)

### 完整接口

```typescript
interface ParsedField {
  key: string;          // 唯一标识符，如 "ST", "a01001-Avg"
  label: string;        // 显示名称，如 "系统编码", "PM2.5 平均值"
  value: any;           // 解析后的值
  unit?: string;        // 单位，如 "mg/m³", "℃"
  group?: string;       // 分组名，如 "报文头", "监测数据"
  uiType?: UIType;      // 渲染类型（默认 text）
  color?: Color;        // 色彩主题
  isKeyInfo?: boolean;  // 是否提取到顶部摘要卡片
  tooltip?: string;     // 悬停提示文本
}
```

### uiType 渲染类型

| uiType | 效果 | 适用场景 | 示例 |
|--------|------|---------|------|
| `text` (默认) | 纯文本 | 大多数字段 | `value: "12345"` |
| `badge` | 彩色标签药丸 | 状态码、枚举值、分类 | `ST=31 (大气)` 蓝色标签 |
| `status-dot` | 色点 + 文本 | 通过/失败/告警状态 | `CRC ✓` 绿点, `Flag=D` 红点 |
| `code` | 等宽代码块 | 原始十六进制、二进制 | `7E7E 01 ...` |
| `json` | 可展开 JSON | 嵌套对象 | 复杂配置参数 |
| `bit-map` | 位标志网格 | Flag 字节位域分解 | `D3,D2,D1,D0=1,0,1,0` |

### color 色彩语义

| Color | 语义 | 使用场景 |
|-------|------|---------|
| `emerald` | 成功/正常 | CRC 通过, Flag=N (正常) |
| `amber` | 警告/注意 | 校准中, 维护状态 |
| `red` | 错误/严重 | CRC 失败, 超量程, 故障 |
| `blue` | 信息/主要 | 协议版本, 功能码(下行) |
| `purple` | 特殊 | 分类标识, 自定义 |
| `slate` | 中性/默认 | 未知状态 |

### isKeyInfo 顶部摘要卡片

`isKeyInfo: true` 的字段会提取到解析结果最顶部的仪表卡片区，带有语义色彩顶部色条。

**推荐标记的字段 (2-4 个)**:
- 设备编号 (MN / 遥测站地址)
- 命令类型 (ST+CN / 功能码)
- CRC 校验状态
- 关键时间戳

---

## 二、布局级渲染 (LayoutConfig)

### 完整接口

```typescript
interface LayoutConfig {
  sections: LayoutSection[];
}

interface LayoutSection {
  title: string;                    // 分组标题
  style: 'register' | 'key-value' | 'grid' | 'table';  // 渲染风格
  color?: string;                   // 左边框色 (emerald/blue/indigo/teal/...)
  collapsed?: boolean;              // 是否默认折叠
  fieldKeys?: string[];             // key-value/grid/table: 引用字段 key
  columns?: string[];               // register: 列标题数组
  rows?: RegisterRow[];             // register: 结构化行数据
}

interface RegisterRow {
  label: string;                    // 行标签 (如因子名)
  color?: string;                   // 行色彩提示
  cells: RegisterCell[];            // 单元格
}

interface RegisterCell {
  key: string;                      // 引用 ParsedField.key
  span?: number;                    // 列跨度
}
```

### 四种渲染风格

#### `register` -- 登记表 (最适合监测数据)

紧凑多列表格，同因子所有后缀横向排列。适合有规律的重复数据结构。

```
┌──────┬────────┬────────┬────────┬───────┐
│ 因子 │  平均值 │  最小值 │  最大值 │ 标志  │
├──────┼────────┼────────┼────────┼───────┤
│ SO₂  │ 0.015  │ 0.849  │ 1.273  │  D    │
│ 温度 │ -9.2   │ 21.4   │ 32.1   │  N    │
│ O₃   │ 0.010  │ 0.638  │ 0.957  │  D    │
└──────┴────────┴────────┴────────┴───────┘
```

**使用方式**:
```javascript
{
  title: "监测数据",
  style: "register",
  color: "emerald",
  columns: ["因子", "平均值", "最小值", "最大值", "标志"],
  rows: [
    {
      label: "SO₂",
      cells: [
        { key: "a21026-Avg" }, { key: "a21026-Min" },
        { key: "a21026-Max" }, { key: "a21026-Flag" }
      ]
    }
  ]
}
```

#### `key-value` -- 紧凑键值表 (适合协议头/参数)

左侧字段名，右侧值，交替底色，紧凑行距。

```
QN     2024-03-25 14:30:00
ST     31 (大气污染)          [badge: blue]
CN     2011 (小时数据)        [badge: blue]
MN     DEVICE001
```

**使用方式**:
```javascript
{
  title: "报文头",
  style: "key-value",
  color: "blue",
  fieldKeys: ["QN", "ST", "CN", "MN", "PW", "Flag"]
}
```

#### `grid` -- 卡片网格 (适合水文要素)

每个字段一张小卡片，2 列网格布局，因子名上方小字，数值居中大字。

**使用方式**:
```javascript
{
  title: "水文要素",
  style: "grid",
  color: "cyan",
  fieldKeys: ["elem_39_1", "elem_20_2", "elem_38_3"]
}
```

#### `table` -- 标准表格 (预留)

等同于 `key-value`，保留用于未来更复杂的表格渲染。

---

## 三、色彩边框参考

`LayoutSection.color` 控制每个分组卡片的左侧 3px 色条：

| color | 建议用途 |
|-------|---------|
| `blue` | 报文头、帧头 |
| `indigo` | 报文结构 |
| `sky` | 控制区 |
| `teal` | 数据区、业务数据 |
| `emerald` | 监测数据 |
| `cyan` | 水文要素 |
| `amber` | 校验区 |
| `red` | 错误/告警区 |
| `purple` | 特殊功能 (图片传输等) |
| `slate` | 帧尾、默认 |

---

## 四、完整示例 (HJ212)

```javascript
function parse(rawData) {
  var fields = [];
  // ... 解析逻辑，生成 fields ...

  return {
    success: true,
    protocolName: "HJ212",
    summary: "HJ212 小时数据 [DEVICE001]",
    fields: fields,
    layout: {
      sections: [
        {
          title: "报文结构",
          style: "key-value",
          color: "indigo",
          fieldKeys: ["_dataLen", "_crc"]
        },
        {
          title: "报文头",
          style: "key-value",
          color: "blue",
          fieldKeys: ["QN", "ST", "CN", "MN", "PW", "Flag", "PNUM", "PNO"]
        },
        {
          title: "数据区",
          style: "key-value",
          color: "teal",
          fieldKeys: ["DataTime"]
        },
        {
          title: "监测数据",
          style: "register",
          color: "emerald",
          columns: ["因子", "平均值", "最小值", "最大值", "标志"],
          rows: [
            {
              label: "SO₂",
              cells: [
                { key: "a21026-Avg" }, { key: "a21026-Min" },
                { key: "a21026-Max" }, { key: "a21026-Flag" }
              ]
            },
            {
              label: "PM2.5",
              cells: [
                { key: "a34004-Avg" }, { key: "a34004-Min" },
                { key: "a34004-Max" }, { key: "a34004-Flag" }
              ]
            }
          ]
        }
      ]
    }
  };
}
```

---

## 五、Manifest 配置

```json
{
  "id": "my-protocol-parser",
  "name": "My Protocol Parser",
  "type": "protocol-parser",
  "panelPosition": "right",
  "version": "1.0.0",
  "entrypoint": "index.js",
  "protocolIds": ["my-protocol"]
}
```

| panelPosition | 行为 |
|---------------|------|
| `"left"` | 显示在左侧侧边栏 |
| `"right"` | 显示在右侧侧边栏 (protocol-parser 默认) |
| `"both"` | 两侧都显示 |

---

## 六、错误隔离与兼容性

| 场景 | 行为 |
|------|------|
| 插件未提供 `layout` | 前端按 `field.group` 自动分组，使用 `key-value` 风格渲染 |
| `layout` 格式错误 | 回退到默认分组渲染 |
| 单个 section 渲染崩溃 | `SectionErrorBoundary` 捕获，显示提示，其余 section 正常 |
| 插件 `parse()` 抛异常 | 显示解析失败提示，不影响软件运行 |
| 插件引用了不存在的 fieldKey | 对应单元格显示 `--` |

**安全准则**:
- 插件代码在沙箱中执行，无法访问主进程 API
- `layout` 是纯 JSON 声明，不执行任何代码
- 每个 section 独立隔离，单个 section 错误不扩散
