# LibreChat HTTP Artifacts 预览定制设计

## 目标

在门户继续使用 HTTP 的前提下，停止 HTML Artifacts 对 CodeSandbox 公共服务和 Web Crypto/Service Worker 静态预览链路的依赖；HTML 生成、代码查看、下载和右侧预览均在企业 AI 门户内完成。

## 已确认边界

- LibreChat Artifacts 仍由模型和现有 Agent 能力生成。
- 本地部署 Sandpack bundler，作为 React 等需要 bundler 的 Artifact 的替代服务。
- `text/html` 与 `application/vnd.code-html` 使用本地 HTTP iframe 兼容预览。
- HTML iframe 使用 `sandbox="allow-scripts"`，不授予 `allow-same-origin`、表单、弹窗或顶层导航权限。
- React、SVG、Markdown、Mermaid、Office 等非 HTML 类型继续使用当前渲染路径。
- 门户入口保持 HTTP，不修改 Caddy、NAT、OIDC 或公开端口。

## 架构

```text
LibreChat Agent
  └─ Artifact HTML
       ├─ 代码页：Monaco（现有）
       ├─ HTML 预览：受限 sandbox iframe + srcDoc（新增）
       └─ 下载：现有 Artifact 下载逻辑

React/SVG/Markdown/Office
  └─ Sandpack（本地 bundler URL 或现有默认路径）
```

HTML 预览不经过 Sandpack，因此不调用 `crypto.subtle.digest()`，也不依赖 Static Browser Server 的 Service Worker。`srcDoc` 每次编辑内容或点击刷新时重新挂载，保持预览与代码页一致。

## 本地 bundler

新增 Compose overlay，部署 `ghcr.io/librechat-ai/codesandbox-client/bundler:latest`，加入 LibreChat 所在 Docker 网络。浏览器可访问的反向代理地址通过 `SANDPACK_BUNDLER_URL` 注入；Docker 内部服务名只用于容器间通信，不能直接填写给浏览器。

本地 bundler 只替代需要 Sandpack bundling 的类型，不作为 HTML HTTP 兼容层的前置条件。

## 错误和安全边界

- HTML 预览内容为空时显示空状态，不挂载 iframe。
- iframe 脚本可执行，但不能访问父页面 DOM、Cookie 或同源存储。
- HTML 仍可访问其自身声明的外部资源；网络不可达时由浏览器显示资源错误。
- Sandpack 类型保留现有错误展示。
- 预览刷新按钮通过 `previewRevision` 重新挂载 HTML iframe，同时继续调用 Sandpack client refresh。

## 验收标准

1. `text/html` 和 `application/vnd.code-html` 在 HTTP 页面显示预览，不再出现 `crypto.subtle`/Sandpack `TIME_OUT`。
2. HTML 编辑后预览内容更新，刷新按钮重新执行脚本。
3. HTML iframe 没有 `allow-same-origin`、`allow-forms`、`allow-popups` 和 `allow-top-navigation`。
4. React、SVG、Markdown、Mermaid、Office 现有测试和行为不回退。
5. Compose 配置可解析，bundler 健康检查和 CORS/Worker MIME 配置有明确部署说明。
