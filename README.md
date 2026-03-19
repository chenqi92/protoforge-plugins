# ProtoForge Plugins

ProtoForge 插件远程仓库。

## 目录结构

```
registry.json          # 插件注册表（客户端读取此文件获取可用插件列表）
dist/                  # 插件 tar.gz 包（客户端下载安装）
  ├── hj212-parser.tar.gz
  └── sfjk200-parser.tar.gz
plugins/               # 插件源码
  ├── hj212-parser/
  │   ├── manifest.json
  │   └── index.js
  └── sfjk200-parser/
      ├── manifest.json
      └── index.js
```

## 可用插件

| 插件 | 版本 | 说明 |
|------|------|------|
| 🔬 HJ212 协议解析 | 1.0.0 | 国标 HJ 212-2017 环保数据传输协议 |
| 🌊 SFJK200 协议解析 | 1.0.0 | 水文监测数据通信协议 |

## 添加新插件

1. 在 `plugins/` 下创建插件目录，包含 `manifest.json` 和 `index.js`
2. 运行 `tar -czf dist/<plugin-id>.tar.gz -C plugins <plugin-id>`
3. 在 `registry.json` 中添加插件条目
4. 推送到 GitHub
