# ProtoForge Plugins

ProtoForge 插件远程仓库。

## 目录结构

```
registry.json          # 插件注册表（客户端读取此文件获取可用插件列表）
dist/                  # 插件 tar.gz 包（客户端下载安装）
  ├── hj212-parser.tar.gz
  ├── excel-renderer.tar.gz
  ├── font-jetbrains-mono.tar.gz
  ├── timestamp-signer.tar.gz
  ├── mock-data-gen.tar.gz
  ├── curl-exporter.tar.gz
  └── request-stats-panel.tar.gz
.github/workflows/     # CI/CD
  └── sync-r2.yml      # 推送到 main 时自动同步到 Cloudflare R2
```

## CDN 分发

推送到 `main` 分支后，GitHub Actions 会自动将 `registry.json` 和 `dist/` 同步到 Cloudflare R2：

- **GitHub (默认)**：`https://raw.githubusercontent.com/chenqi92/protoforge-plugins/main/`
- **Cloudflare R2 (中国大陆)**：`https://protoforge.tuytuy.com/`

客户端会根据用户 IP 自动选择最优下载源。

## 可用插件

| 插件 | 类型 | 版本 | 说明 |
|------|------|------|------|
| 🔬 HJ212 协议解析 | protocol-parser | 2.0.0 | 完整支持 HJ212-2005/2017 环保数据传输协议 |
| 📊 Excel 表格渲染 | response-renderer | 1.0.0 | 将 Excel 文件流渲染为可视化表格 |
| 🔤 JetBrains Mono 字体 | response-renderer | 1.0.0 | 等宽编程字体，支持连字 |
| 🔐 请求时间戳签名 | request-hook | 1.0.0 | 自动注入 X-Timestamp / X-Signature |
| 🎲 Mock 数据生成器 | data-generator | 1.0.0 | UUID / 随机字符串 / 整数 / 时间戳 / Email / IP |
| 📋 cURL 命令导出 | export-format | 1.0.0 | 将请求配置导出为 cURL 命令行格式 |
| 📈 请求统计面板 | sidebar-panel | 1.0.0 | 侧边栏实时请求统计（总数/成功率/延迟/状态码分布） |

## 插件类型

| 类型 | 说明 |
|------|------|
| `protocol-parser` | 协议解析器，解析原始字节流为结构化数据 |
| `request-hook` | 请求钩子，在请求发送前/后执行自定义逻辑 |
| `response-renderer` | 响应渲染器，自定义渲染特殊 Content-Type |
| `data-generator` | 数据生成器，生成 Mock 测试数据 |
| `export-format` | 导出格式，将请求导出为其他格式（cURL 等） |
| `sidebar-panel` | 侧边面板，在侧边栏中添加自定义面板 |

## 添加新插件

1. 创建插件目录，包含 `manifest.json` 和入口脚本（如 `index.js`）
2. 打包：`tar -czf dist/<plugin-id>.tar.gz -C <plugin-dir> .`
3. 在 `registry.json` 中添加插件条目（含 `downloadUrl`）
4. 推送到 GitHub（CI 自动同步到 R2）

## CI/CD Secrets

在 GitHub 仓库 Settings → Secrets 中配置：

| Secret | 说明 |
|--------|------|
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key |
