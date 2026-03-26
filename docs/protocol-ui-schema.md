# ProtoForge Protocol UI Schema -- Plugin Development Guide

This document defines the standard for how protocol parser plugins should structure
their `ParsedField[]` output to leverage ProtoForge's declarative rendering engine.

## ParsedField Interface

```typescript
interface ParsedField {
  key: string;          // Unique field identifier, e.g. "ST", "a01001-Rtd"
  label: string;        // Human-readable label, e.g. "System Type", "PM2.5 Realtime"
  value: any;           // Parsed value (string, number, boolean, object)
  unit?: string;        // Unit suffix, e.g. "mg/L", "dB(A)", "ms"
  group?: string;       // Group name for collapsible sections
  uiType?: UIType;      // Rendering hint (default: 'text')
  color?: Color;        // Color theme for badges/status-dots
  isKeyInfo?: boolean;  // If true, extracted as top summary card
  tooltip?: string;     // Hover tooltip text
}
```

## Field Grouping Best Practices

Use `group` to organize fields into logical collapsible sections.
Recommended group names (ordered by display priority):

| Group Name | Use For | Example Fields |
|------------|---------|----------------|
| `"Protocol Header"` / `"协议头"` | Frame structure, length, markers | Start marker, data length, CRC |
| `"Control"` / `"控制区"` | Command codes, system type | ST, CN, QN, PW, MN |
| `"Data"` / `"数据区"` | General CP fields | DataTime, ExeRtn, QnRtn |
| `"Monitoring Data"` / `"监测数据"` | Sensor readings | Pollutant values, flags |
| `"Checksum"` / `"校验区"` | CRC, parity, validation | CRC16, BCC |

## uiType Reference

| uiType | Effect | Best For |
|--------|--------|----------|
| `text` (default) | Plain text value | Most fields |
| `badge` | Colored pill/tag | Status codes, types, enum values |
| `status-dot` | Colored dot + text | Pass/fail/warning states (CRC, Flag) |
| `code` | Monospace background | Raw hex, binary data |
| `json` | Expandable JSON tree | Nested objects |
| `progress` | Progress bar 0-100 | Signal strength, battery |
| `bit-map` | Bit flags grid | Flag byte decomposition |

## color Reference

| Color | Semantic | Use For |
|-------|----------|---------|
| `emerald` | Success/Normal | CRC pass, Flag=N |
| `amber` | Warning/Caution | Calibration, maintenance |
| `red` | Error/Critical | CRC fail, fault, overrange |
| `blue` | Info/Primary | Protocol version, type |
| `purple` | Special | Custom/rare |
| `slate` | Neutral | Default/unknown |

## isKeyInfo Cards

Fields with `isKeyInfo: true` are extracted to a summary card row at the top
of the parse result, before any groups. Use this sparingly for 2-4 most
important fields that give an at-a-glance overview.

**Good candidates:**
- Protocol name/version
- Command type (e.g. ST+CN for HJ212)
- Device ID (MN)
- CRC status
- Timestamp

## Example: HJ212 Parser Output

```javascript
// Protocol header fields
fields.push({
  key: "ST", label: "System Type",
  value: "31 (Atmospheric Pollution)",
  group: "Control",
  uiType: "badge", color: "blue",
  isKeyInfo: true
});

// CRC validation
fields.push({
  key: "CRC", label: "CRC16",
  value: match ? "PASS" : "FAIL (" + expected + ")",
  group: "Checksum",
  uiType: "status-dot",
  color: match ? "emerald" : "red",
  isKeyInfo: true
});

// Pollutant data
fields.push({
  key: "a34004-Rtd", label: "PM2.5 Realtime",
  value: "0.035",
  unit: "mg/m3",
  group: "Monitoring Data"
});

// Flag with status
fields.push({
  key: "a34004-Flag", label: "PM2.5 Flag",
  value: "N (Normal)",
  group: "Monitoring Data",
  uiType: "status-dot", color: "emerald"
});
```

## Manifest Configuration

Protocol parser plugins should declare their panel position in `manifest.json`:

```json
{
  "type": "protocol-parser",
  "panelPosition": "right",
  ...
}
```

| panelPosition | Behavior |
|---------------|----------|
| `"left"` | Appears in left sidebar |
| `"right"` | Appears in right sidebar (default for protocol-parser) |
| `"both"` | Appears in both sidebars |

If omitted, the system infers:
- `protocol-parser` -> `"right"`
- `sidebar-panel` -> `"left"`
