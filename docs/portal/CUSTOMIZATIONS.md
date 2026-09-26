# 企业 AI 中台 LibreChat 定制台账

> 用途：本文件是 LibreChat 升级时迁移企业门户定制的唯一入口。实施新定制后必须同步更新本文件，不得记录密码、Token、Cookie 或 `.env` 内容。

## 1. 基线与边界

- 上游基线：LibreChat `v0.8.7`，提交 `9e74cc0e57b395926122bd4062c1fcedc48ed465`。
- 定制分支：`enterprise-ai/portal-v1`。
- 服务器工作树：`/srv/enterprise-ai/source/LibreChat-portal`。
- 基线回滚镜像：`enterprise-ai/librechat:v0.8.7`，禁止覆盖。
- 定制原则：不改写对话、模型、Agent、MCP、文件和 OIDC 核心；Metabase 和 Seafile 保持独立系统，统一门户只提供导航和应用目录。
- Portal 主开关：`PORTAL_ENABLED`。关闭时必须恢复 LibreChat 原生布局和 API 可见性。

详细原始基线见 `docs/portal/BASELINE.md`；每次镜像 ID、运行提交和验收时间以项目级 `deployment/ACCEPTANCE-*.md` 为准。

## 2. 定制总览

| 编号 | 定制项             | 主要边界                                           |
| ---- | ------------------ | -------------------------------------------------- |
| P01  | Portal 启动配置    | 登录用户获得四个固定入口；未登录响应不泄露内部 URL |
| P02  | 应用中心数据       | MongoDB 分组、应用、个人收藏，含唯一性和删除清理   |
| P03  | 用户与管理 API     | 普通用户只读启用数据；管理员复用 `ACCESS_ADMIN`    |
| P04  | 链接与图标安全     | 目录隐藏 URL，launch 二次校验；上传图片转 WebP     |
| P05  | 审计               | 记录 Portal CRUD 与 `portal.app.launch_requested`  |
| P06  | 固定顶栏           | 四个一级入口，内部路由与外部新页签                 |
| P07  | 应用中心页面       | 两级分组导航、搜索、收藏、应用卡片和分项管理       |
| P08  | 顶栏布局和账户入口 | 菜单真正居中、带图标，原生用户菜单迁到右上角       |
| P09  | 聊天页页脚         | Portal 开启时隐藏全部 Chat Footer；关闭时恢复      |
| P10  | 多语言             | 增加 Portal 英文和简体中文文案                     |
| P11  | 部署隔离           | 独立 worktree、独立镜像和 Compose override         |

## 3. 后端、共享契约与数据

### P01 Portal 启动配置

**行为**

- 解析 `PORTAL_ENABLED`、`PORTAL_BRAND_NAME`、`PORTAL_DATA_CENTER_URL`、`PORTAL_DOCUMENT_CENTER_URL`、`PORTAL_ALLOW_HTTP`。
- 固定入口为 AI 工作台、数据中心、知识中心、应用中心；外部入口只允许 `new_tab`。
- `/api/config` 只向已登录用户下发 Portal 配置和 `canManage`。

**文件**

- `packages/api/src/portal/config.ts`
- `packages/api/src/portal/config.spec.ts`
- `packages/data-provider/src/portal.ts`
- `packages/data-provider/src/config.ts`
- `api/server/routes/config.js`

### P02 应用中心数据

**行为**

- `PortalGroup`：名称唯一、预置图标、排序、启用状态和修改人。旧分类缺少图标字段时使用 `app` 兜底。
- `PortalApp`：分组、名称、简介、URL、图标、排序、启用状态和修改人。
- `PortalFavorite`：以用户+应用为唯一键；重复收藏幂等；删除应用后清理收藏。
- 普通目录仅返回启用分组/应用，不返回应用 URL。

**文件**

- `packages/data-schemas/src/models/portal/group.ts`
- `packages/data-schemas/src/models/portal/app.ts`
- `packages/data-schemas/src/models/portal/favorite.ts`
- `packages/data-schemas/src/schema/portal/`
- `packages/data-schemas/src/types/portal.ts`
- `packages/data-schemas/src/methods/portal.ts`
- `packages/data-schemas/src/methods/portal.spec.ts`
- 各层 `index.ts` 出口文件。

### P03 用户与管理 API

**路由**

- `GET /api/portal/catalog`
- `PUT|DELETE /api/portal/favorites/:appId`
- `POST /api/portal/apps/:appId/launch`
- `GET /api/admin/portal/catalog`
- `POST|PATCH|DELETE /api/admin/portal/groups[/:groupId]`
- `POST|PATCH|DELETE /api/admin/portal/apps[/:appId]`

**权限**

- 所有路由要求 JWT 认证。
- 管理路由使用 LibreChat `SystemCapabilities.ACCESS_ADMIN`。
- OIDC 通过 `OPENID_ADMIN_ROLE*` 将 Keycloak `platform-admins` 映射为 LibreChat 管理员。

**文件**

- `api/server/routes/portal.js`
- `api/server/routes/admin/portal.js`
- `api/server/routes/index.js`
- `api/server/index.js`
- `packages/api/src/portal/handlers.ts`
- `packages/api/src/portal/admin.ts`
- `packages/data-provider/src/api-endpoints.ts`
- `packages/data-provider/src/data-service.ts`
- `packages/data-provider/src/keys.ts`
- `client/src/data-provider/Portal/`

### P04 链接和图标安全

**行为**

- 默认只允许 HTTPS；测试环境显式 `PORTAL_ALLOW_HTTP=true` 后允许 HTTP。
- 拒绝 `javascript:`、`data:`、`file:`、带用户名/密码的 URL。
- launch 时重新校验 URL，返回 `noopener,noreferrer` 新页签目标。
- 图标限制 1 MiB，只接受 PNG/JPEG/WebP，由 Sharp 解码并转为 UUID WebP。
- 上传图标放在已持久化的 `/app/client/public/images/portal`，严格限制读取路径格式。

**文件**

- `packages/api/src/portal/url.ts`
- `packages/api/src/portal/url.spec.ts`
- `packages/api/src/portal/icons.ts`
- `api/server/middleware/validateImageRequest.js`
- `api/server/routes/admin/portal.js`

### P05 审计

- CRUD 记录操作人、目标和结果。
- 应用点击记录 `portal.app.launch_requested`；该事件只证明发出打开请求，不证明目标系统访问成功。
- 文件：`packages/data-schemas/src/types/admin.ts`、`packages/api/src/portal/handlers.ts`、`packages/api/src/portal/admin.ts`。

## 4. 前端和界面

### P06 固定顶栏

- `client/src/routes/Root.tsx` 在 Portal 启用时挂载 `PortalTopNav`。
- `client/src/portal/components/TopNav.tsx` 处理固定入口、激活状态和外部新页签。
- AI 工作台路由为 `/c/new`，应用中心路由为 `/portal/apps`。
- Metabase 和 Seafile 始终以新页签打开，不使用 iframe。

### P07 应用中心页面

- `client/src/portal/pages/Apps.tsx`：普通目录、搜索、分组和收藏。
- `client/src/portal/pages/Admin.tsx`：按路由分开分类和应用 CRUD；分类选择预置图标，应用保留预置图标/上传。
- `client/src/portal/components/Sidebar.tsx`：两级导航，依次展示应用中心、动态应用分类和管理员专用的应用管理。
- `client/src/portal/components/Card.tsx`：应用卡片和收藏操作。
- `client/src/portal/components/icons.tsx`：共享预置图标映射。
- `client/src/routes/index.tsx`：注册 `/portal/apps`、`/portal/admin/groups` 和 `/portal/admin/apps`。
- Portal 路由不渲染 LibreChat 聊天侧栏。

### P08 顶栏布局和账户入口

**行为**

- 顶栏使用 `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`，中间菜单相对页面真正居中。
- 左上角使用 Portal 专用派生资产 `client/public/assets/portal/uhoo-logo.png`，与品牌文字“企业AI中台”并排展示；项目根目录原始附件保持不变。
- 为保持中英文视觉高度协调，Logo 固定为 20px 高，品牌标题使用 18px 字号和紧凑行高；二者垂直居中，间距 8px。
- 派生资产由原始 JPEG 白底图片确定性移除白底并裁边，输出为带透明通道的 PNG；升级时迁移派生资产，不覆盖 LibreChat 上游品牌资源。
- AI 工作台、数据中心、知识中心、应用中心分别使用 `Brain`、`BarChart3`、`BookOpen`、`LayoutGrid`。
- 顶栏右上角复用原生 `AccountSettings`完整菜单；`placement="topbar"` 只调整弹出方向和定位。
- `Root` 将 `showAccountSettings={!portalEnabled}` 传入 `UnifiedSidebar`，防止左下角和右上角同时出现。

**文件**

- `client/src/portal/components/TopNav.tsx`
- `client/src/portal/components/TopNav.spec.tsx`
- `client/public/assets/portal/uhoo-logo.png`
- `packages/api/src/portal/config.ts`
- `packages/api/src/portal/config.spec.ts`
- `client/src/components/Nav/AccountSettings.tsx`
- `client/src/routes/Root.tsx`
- `client/src/components/UnifiedSidebar/UnifiedSidebar.tsx`
- `client/src/components/UnifiedSidebar/Sidebar.tsx`
- `client/src/components/UnifiedSidebar/ExpandedPanel.tsx`
- `client/src/components/UnifiedSidebar/__tests__/ExpandedPanel.spec.tsx`

### P09 聊天页页脚

- `client/src/components/Chat/Footer.tsx` 在 `config.portal.enabled === true` 时返回 `null`。
- 隐藏范围包含 LibreChat 标识、版本/更新信息、隐私政策和服务条款。
- Portal 关闭时保留上游 Chat Footer。登录页的 `Auth/Footer` 不在本定制范围。
- 测试：`client/src/components/Chat/Footer.portal.spec.tsx`。

### P10 多语言

**行为**

- 简体中文补齐当前左侧菜单实际引用的翻译键，避免缺失键回退为英文；升级时运行 `Translation.spec.ts` 检查这组键。
- 数据库和后端继续保留 LibreChat 的默认会话标题哨兵值 `New Chat`；只在 `ConvoLink` 显示层映射为“新对话”，不改写已有会话数据或标题生成判断。
- 升级时对比 `portal_*` 键和左侧菜单翻译键，不覆盖上游新增文案。

**文件**

- `client/src/locales/zh-Hans/translation.json`
- `client/src/locales/Translation.spec.ts`
- `client/src/components/Conversations/ConvoLink.tsx`
- `client/src/components/Conversations/ConvoLink.spec.tsx`

## 5. 部署定制

- 服务器 Compose override：`/srv/enterprise-ai/config/compose.portal.yml`。
- 项目备份：`deployment/compose.portal.yml`。
- 内部 API 验收：`deployment/portal-api-acceptance.mjs`。
- 图标复用现有持久化映射：`/srv/enterprise-ai/data/librechat/images -> /app/client/public/images`。
- 每次构建使用新镜像标签，不覆盖上一个 Portal 镜像，不覆盖基线 `v0.8.7` 镜像。

**2026-09-01 顶栏/页脚定制发布**

- 服务器源码提交：`80544b9`。
- 运行镜像：`enterprise-ai/librechat:v0.8.7-portal.3`。
- 镜像 ID：`sha256:74adf8d9822f930f2b2cb7902742eb5f8f498289680f16cd1dec39e31c0813ba`。
- 上一个 Portal 回滚镜像：`enterprise-ai/librechat:v0.8.7-portal.2`。
- 验收记录：项目级 `deployment/ACCEPTANCE-2026-09-01-PORTAL-LAYOUT.md`。

**2026-09-01 品牌与导航文案发布**

- 品牌、文案与 Logo 源码提交：`0e38968`。
- Logo/标题视觉比例修正提交：`a85799f`。
- 运行镜像：`enterprise-ai/librechat:v0.8.7-portal.5`。
- 镜像 ID：`sha256:f7de9ef1e999631fe4b29c42246daba75527860c7153ac7097b53b39aa553912`。
- 上一个 Portal 回滚镜像：`enterprise-ai/librechat:v0.8.7-portal.4`。
- 验收记录：项目级 `deployment/ACCEPTANCE-2026-09-01-PORTAL-BRAND.md`。

**2026-09-01 应用中心两级导航发布**

- 应用中心源码提交：`3480aa3`。
- 运行镜像：`enterprise-ai/librechat:v0.8.7-portal.6`。
- 镜像 ID：`sha256:a7a7fcfc9e31151efb240ec734ef3479004840e2ff472bb9dd2011eb983317a9`。
- 上一个 Portal 回滚镜像：`enterprise-ai/librechat:v0.8.7-portal.5`。
- 验收记录：项目级 `deployment/ACCEPTANCE-2026-09-01-PORTAL-APP-NAVIGATION.md`。

**2026-09-01 应用图标缓存刷新修复**

- 缓存修复源码提交：`a433819`。
- 运行镜像：`enterprise-ai/librechat:v0.8.7-portal.7`。
- 镜像 ID：`sha256:660a9a90f5aeeb986f8825da257b6c4a160e41184fd93ce1eb15f7923c4eddf6`。
- 应用新增、修改或删除成功后，同时失效 `portalAdminCatalog` 和 `portalCatalog`，避免返回应用中心时继续显示旧图标。
- 上一个 Portal 回滚镜像：`enterprise-ai/librechat:v0.8.7-portal.6`。

**2026-09-01 应用卡片入口文案调整**

- 入口文案源码提交：`cd0e8ee`。
- 运行镜像：`enterprise-ai/librechat:v0.8.7-portal.8`。
- 镜像 ID：`sha256:993a0691491879edd92172b63922965f2dd7b007452cf9bb0552fba115cf0f2b`。
- 应用中心卡片底部入口由英文 `Open` 调整为中文 `点击进入`；卡片右上角图标按钮的无障碍标签不受影响。
- 上一个 Portal 回滚镜像：`enterprise-ai/librechat:v0.8.7-portal.7`。

**2026-09-01 左侧菜单简体中文补齐**

- 中文化源码提交：`2a10b05`。
- 运行镜像：`enterprise-ai/librechat:v0.8.7-portal.9`。
- 镜像 ID：`sha256:67a771156d8ba2dd510f899862a0934d7e63a096295853982fa8b8f13b776b3b`。
- 补齐左侧菜单引用的 28 个简体中文键；默认 `New Chat` 仅在显示层映射为“新对话”，不修改数据库和后端哨兵值。
- 上一个 Portal 回滚镜像：`enterprise-ai/librechat:v0.8.7-portal.8`。
- 验收记录：项目级 `deployment/ACCEPTANCE-2026-09-01-SIDEBAR-I18N.md`。

## 6. LibreChat 升级迁移步骤

### 6.1 锁定新基线

1. 在独立 worktree 检出目标 LibreChat 版本，不覆盖当前可回滚工作树。
2. 记录新版本标签、提交、Node 版本、Dockerfile target、Compose 结构和基线镜像 ID。
3. 在无任何 Portal 变更的新基线上先运行官方构建、类型检查和相关测试，区分上游失败与迁移回归。

### 6.2 按边界迁移

1. 先迁移 `packages/data-provider/src/portal.ts` 共享契约，再迁移 data-provider 端点、请求和 query keys。
2. 迁移 `packages/data-schemas` 的 Portal 模型/schema/methods，检查新版 Mongoose 和索引模式。
3. 迁移 `packages/api/src/portal` 和薄 Express 路由，重新核对认证、`ACCESS_ADMIN`、错误响应和审计接口。
4. 迁移图标上传和 `validateImageRequest` 精确路径例外，不放宽其他图片路径。
5. 迁移 `client/src/portal` 应用中心，再逐个应用 P06–P10 的上游集成点。
6. 对 `Root`、`AccountSettings`、`UnifiedSidebar`、`Chat/Footer` 先阅读新版实现，再手工重放小范围改动；不盲目覆盖新版文件。
7. 最后合并多语言键和 Compose override，不复制旧版依赖锁文件。

### 6.3 升级冲突热点

| 文件/区域                                       | 冲突风险 | 核对要点                                                |
| ----------------------------------------------- | -------- | ------------------------------------------------------- |
| `api/server/routes/config.js`                   | 高       | 启动配置返回结构、认证时机、未登录数据最小化            |
| `api/server/routes/index.js`                    | 中       | 新版路由注册顺序和中间件                                |
| `api/server/middleware/validateImageRequest.js` | 高       | 只保留 Portal UUID WebP 精确放行                        |
| `client/src/routes/Root.tsx`                    | 高       | 顶栏挂载、Portal 路由侧栏隔离、普通聊天侧栏开关         |
| `client/src/components/Nav/AccountSettings.tsx` | 高       | 保留新版菜单功能，只重放 `topbar` 布置 prop             |
| `client/src/components/UnifiedSidebar/`         | 高       | 明确 prop 传递，Portal 关闭默认为 true                  |
| `client/src/components/Chat/Footer.tsx`         | 中       | 保留新版 hooks 顺序，Portal 短路不破坏 React Hooks 规则 |
| locale JSON                                     | 中       | 合并 `portal_*` 与左侧菜单键，避免中文缺失时回退英文    |

## 7. 必做回归清单

### 代码与构建

- Portal 配置/URL 单元测试。
- Portal MongoDB methods 测试，使用真实临时 MongoDB。
- data-provider JSON/multipart 测试。
- TopNav、ExpandedPanel 和 Portal Footer 客户端测试。
- `packages/data-provider`、`packages/data-schemas`、`packages/api` 构建。
- API 构建、客户端 TypeScript、定向 ESLint、客户端生产构建。

### 服务器内部验收

- Compose `config --quiet` 通过。
- 新镜像标签和镜像 ID 与交付记录一致。
- LibreChat 容器 running、无异常重启，`/readyz` 返回 200/OK。
- 内部 Caddy `/portal/apps` 可达。
- `portal-api-acceptance.mjs` 全部通过，且验收临时数据/图标清理为零。
- 普通用户无管理权限，管理员具有 `canManage`。
- 人工浏览器 UAT 核对：菜单真正居中、四个图标、右上角用户菜单、左下角无头像、聊天页底部无页脚。

## 8. 回滚

Portal 镜像回滚使用上一个 Portal 标签；完全回到原生 LibreChat 时只使用基线 Compose 重建 `librechat` 服务。回滚不删除 Portal MongoDB 集合或图标数据，避免不可逆数据丢失。执行回滚后必须重新验证原生聊天和 `/readyz`。

## 9. v0.8.8-rc2 迁移记录（未部署）

- 官方基线：v0.8.8-rc2，源码提交 f9f1b2f；隔离分支 enterprise-ai/portal-v0.8.8-rc2。
- 门户合并提交：3bd2d79；multipart 请求兼容修复：407e6e7；新版布局中的顶栏/账户菜单恢复：ce1ef0e。
- 候选镜像：enterprise-ai/librechat:v0.8.8-rc2-portal.migrate.2，镜像 ID sha256:df88c4b51d0265470a63fe958ad3088bf6bae12f720ef21436d49f872e753e29。
- 已验证：Docker 多阶段构建通过；独立临时 MongoDB 运行态 /health 返回 200；门户已启用时 /api/portal/catalog 返回 401（匿名访问被正确拒绝）。
- 未验证：生产 SSO 登录、真实用户权限、真实 Portal 数据、浏览器视觉验收；生产容器尚未替换。
- 冲突处置：Root 与新版 UnifiedSidebar 抽屉实现保留上游行为，仅追加 Portal 顶栏和路由隔离；该 rc2 迁移记录中的 Draw.io 补丁结论已由 rc4 源码级迁移记录修正。
- 迁移工具包：/srv/enterprise-ai/artifacts/librechat-portal-migration-kit/releases/v0.8.8-rc2/；该目录包含基线精确可检验的二进制 patch、变更清单、校验和及迁移决策。

**2026-09-10 v0.8.8-rc2 生产切换结果**

- 实际运行镜像：enterprise-ai/librechat:v0.8.8-rc2-portal.migrate.3；镜像 ID sha256:73d0fcd27c00d6ad7932297129a1aa147d1b215b4e420aeb9731aa9f14876ff3。
- 新增兼容修复提交：d4d4b2c，将 MongoDB 不支持的 legacy Meili 部分索引条件从 $exists:false 改为 $lt:1；已在独立 MongoDB 8.0.20 实测可建索引并匹配缺失字段的历史记录。
- 独立 Compose 覆盖文件 compose.librechat-v0.8.8-rc2.yml 声明单实例 SCHEDULES_SINGLE_PROCESS=true，使新版计划任务写入能力在本部署拓扑下可用。
- 生产启动核验：容器 running，/health 返回 200；OpenID Connect 配置成功；7 个 MCP 服务器和 9 个工具初始化成功；Portal catalog 匿名请求返回 401；门户 logo 静态资源返回 200。
- 仍需人工 UAT：浏览器登录后检查四项顶栏布局、应用中心、管理员权限、真实会话/Agent/MCP 执行以及登出后重新 SSO 登录。
- 观察项（不阻断本次运行）：新版启动早期出现 code-environments 对账早于 MongoDB 初连、两个未配置内置工具的 .spec.js 被扫描，以及原有 RAG API 未配置提示；容器随后完成 MongoDB 连接、SSO/MCP 初始化和 readiness。未对未启用功能回退或修改上游核心，后续启用代码执行环境或 LibreChat 内置 RAG 时应单独回归。

**2026-09-10 顶栏可视高度修复**

- 现象：Portal 顶栏显示后，聊天内容区仍只扣除 Banner 高度，导致底部输入框在部分屏幕高度下被截断。
- 修复：`client/src/routes/Root.tsx` 以 `portalNavigationHeight`（Portal 启用时 56px，关闭时 0）参与内容区高度计算。
- 边界：只调整 Portal 开启时的视口分配；不修改聊天、模型、Agent、MCP、文件或原生非 Portal 布局。
- 升级迁移：将该 Root 高度计算一并纳入 v0.8.8-rc2 迁移包，并以官方导入基线执行 `git apply --check`。

**2026-09-10 应用卡片上传图标认证兼容修复**

- 现象：升级至 v0.8.8-rc2 后，应用中心应用卡片的上传图标全部回退为首字默认图标，新上传图标也无法显示。
- 根因：新版 `/images/*` 受 JWT 保护；原生 `<img>` 请求不会携带 LibreChat 的 Authorization 请求头，因此即使已登录也会返回 401。图标文件及其持久化挂载本身完整。
- 修复：`api/server/index.js` 保留 `/images/portal/*` 的 Portal 专用受保护静态路由；`packages/data-provider/src/data-service.ts` 使用现有认证请求链路以 Blob 获取图标，`client/src/portal/components/Card.tsx` 仅渲染短生命周期 Blob URL，并在卸载或图标变更时释放。不得放开原生 `/images/*` 或 Portal 图标目录匿名访问。
- 升级迁移：专用受保护路由、认证 Blob 获取方法和卡片渲染逻辑必须作为同一项迁移；只迁移服务端路由不能修复浏览器原生图片请求。

## 10. v0.8.8-rc4 升级结果（2026-09-26）

- 官方基线：LibreChat v0.8.8-rc4，官方提交 `361553f`；定制源码提交 `849f7d3`，本地副本位于 `LibreChat-portal-rc4/`。
- 实际运行镜像：`enterprise-ai/librechat:v0.8.8-rc4-portal.2`，镜像 ID `sha256:904a245f876e19755aab80553ebf9a2d9acd63cac8ce11f2c0c2b46ba0e33664`。
- 已迁移：Portal 顶栏与路由、OIDC HTTP 兼容、知识中心与 WeKnora、Draw.io 下载权限、企业图表宽版布局、自定义模型端点的 MCP UI 资源解析。
- Compose 使用原有基础、Portal、图表 MCP、图表布局、rc2 兼容和知识中心层，最后由 `compose.librechat-v0.8.8-rc4.yml` 固定 rc4 镜像并关闭源码重建。
- 服务器验收：容器 running，重启次数 0；`/health`、`/livez`、`/readyz`、`/api/config` 和首页均返回 200；未认证的 Portal/知识中心 API 返回 401；WeKnora、Keycloak、MongoDB、Draw.io MCP、企业图表 MCP 均保持运行；上线后三分钟日志未出现 fatal、`endpoint_models_not_loaded` 或知识中心错误。
- 代码验收：rc4 客户端定向测试 25 项、API MCP 解析测试 71 项通过；客户端生产构建通过；服务器切换前已完成配置、MongoDB、上传文件和 Compose 文件备份。
- 待人工 UAT：使用真实 SSO 账号检查登录、Portal 页面、知识中心读写权限、Draw.io 下载、企业图表展示和真实模型/MCP 调用。

## 11. HTTP Artifacts 预览与本地 Sandpack（2026-09-26）

- 需求边界：门户继续使用 HTTP，不修改 Caddy、NAT、OIDC 或公开端口；HTML Artifacts 不能依赖 CodeSandbox 公共预览服务。
- HTML 类型 `text/html` 和 `application/vnd.code-html` 现在使用 `client/src/components/Artifacts/HtmlArtifactPreview.tsx` 的受限 `iframe srcDoc` 预览，沙箱只开启 `allow-scripts`，不授予 `allow-same-origin`、表单、弹窗或顶层导航权限。
- HTML 预览绕过 Sandpack 的 Web Crypto/Service Worker 静态链路，因此适配当前 HTTP 入口；React、SVG、Markdown、Mermaid、Office 和其他 Sandpack 类型保持原有渲染路径。
- Artifact 刷新按钮通过 `previewRevision` 重新挂载 HTML iframe，并继续调用 Sandpack client refresh；编辑器内容优先于原始 Artifact 内容。
- `deployment/compose.sandpack.yml.example` 提供本地 bundler overlay，镜像为 `ghcr.io/librechat-ai/codesandbox-client/bundler:latest`。该服务只加入 LibreChat Compose 网络，不直接暴露公网；需要由现有反向代理提供浏览器可访问 URL，再设置 `SANDPACK_BUNDLER_URL`。
- 反向代理本地 bundler 时需允许浏览器跨域访问，并透传 WebSocket/Worker 所需响应；Worker 脚本响应的 `Content-Type` 必须是 JavaScript MIME（如 `application/javascript`），否则 Sandpack 仍会在浏览器端启动失败。
- `SANDPACK_BUNDLER_URL` 只影响需要 Sandpack bundling 的类型，不是 HTML HTTP 兼容预览的前置条件。`http://sandpack:80` 只能作为容器内部地址，不能直接交给浏览器。
- 回滚：移除 HTML 路由、`HtmlArtifactPreview.tsx`、`previewRevision` 和本 overlay；恢复 `SandboxArtifactTabs` 对所有类型调用 `ArtifactPreview` 即可。生产上线前必须重建 rc4 定制镜像并完成真实 HTTP 浏览器 UAT，当前源码/测试通过不等于线上已切换。

### 11.1 测试服务器实际部署记录

- 服务器实际使用正确的 `/srv/enterprise-ai/source/LibreChat-portal-rc4` rc4 源码目录；旧版 `/source/LibreChat` 未作为发布基线。
- GHCR 拉取持续超时后，改用官方 GitHub Release `bundler-v12/bundler.zip`，在服务器本地用 `nginx:1.27-alpine` 构建 `enterprise-ai/sandpack-bundler:v12-http`。官方 Release 来源：[codesandbox-client Releases](https://github.com/LibreChat-AI/codesandbox-client/releases)。
- Caddy HTTP 入口增加 `/sandpack/*` 的 `handle_path` 路由，反代到 `sandpack:80`，并设置 CORS 与 Worker JavaScript MIME；门户仍使用 `http://demo.uhoo.cn:9433`。
- LibreChat 实际镜像：`enterprise-ai/librechat:v0.8.8-rc4-portal.3-http-artifacts-correct`；`SANDPACK_BUNDLER_URL=http://demo.uhoo.cn:9433/sandpack`。
- 已验证：Sandpack 容器 `healthy`；外部 `http://demo.uhoo.cn:9433/sandpack/index.html` 返回 200；LibreChat `/readyz` 返回 `OK`；MongoDB、网关、Keycloak 和其他现有服务保持运行。
