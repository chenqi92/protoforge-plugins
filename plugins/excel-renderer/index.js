/**
 * Excel Renderer Plugin — Entrypoint
 *
 * 此插件的渲染逻辑内置在 ProtoForge 前端中（ExcelRendererView.tsx），
 * 插件仅通过 manifest.json 声明 contributes.responseRenderers 扩展点，
 * 用于 Content-Type 匹配和 Tab 注入。
 *
 * 此文件作为 entrypoint 占位符存在，满足插件包格式要求。
 * 未来可在其中添加自定义解析逻辑。
 */

// No-op: rendering is handled natively by the frontend.
function render(data) {
  return {
    success: true,
    type: 'excel',
    message: 'Excel rendering is handled by the built-in ExcelRendererView component.'
  };
}
