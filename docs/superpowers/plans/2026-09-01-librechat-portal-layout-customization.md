# LibreChat Portal Layout Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Portal 启用时将四个带图标的一级菜单真正居中、将原生用户菜单迁到右上角、隐藏聊天页全部页脚，并建立可迁移的 LibreChat 定制清单。

**Architecture:** 保持 Portal 薄定制边界。主布局仍由 `Root` 只负责下发 Portal 开关；`TopNav` 负责三列网格、菜单和顶部用户入口；`UnifiedSidebar` 通过显式 prop 决定是否显示原有左下角入口；`Chat/Footer` 在 Portal 启用时不渲染。所有定制均保留 `PORTAL_ENABLED=false` 的原生回退行为。

**Tech Stack:** LibreChat v0.8.7, React, TypeScript, React Router, Ariakit Menu, Lucide React, Tailwind CSS, Jest, Testing Library, Docker Compose.

## Global Constraints

- 不修改 LibreChat 对话、模型、Agent、MCP、文件或 OIDC 核心逻辑。
- 不新增 npm 依赖，图标仅使用已有 `lucide-react`。
- 不复制 `AccountSettings` 内的用户功能。
- Portal 关闭时恢复原生侧栏头像和聊天页脚。
- 不处理外网 NAT/端口映射。
- 源码和文档不记录密码、Token、Cookie 或 `.env` 内容。

---

### Task 1: 顶栏居中、菜单图标与右上角用户菜单

**Files:**

- Create: `client/src/portal/components/TopNav.spec.tsx`
- Modify: `client/src/portal/components/TopNav.tsx`
- Modify: `client/src/components/Nav/AccountSettings.tsx`

**Interfaces:**

- Consumes: `TPortalStartupConfig`, `AccountSettings` 原有用户功能。
- Produces: `AccountSettingsProps = { collapsed?: boolean; placement?: 'sidebar' | 'topbar' }`；三列居中 `PortalTopNav`。

- [ ] **Step 1: 写顶栏失败测试**

`TopNav.spec.tsx` 用 `MemoryRouter` 渲染顶栏，mock `AccountSettings`，断言：根节点使用三列 Grid；四个标签都存在；四个菜单各有一个 SVG；用户菜单获得 `placement="topbar"`。

```tsx
jest.mock('~/components/Nav/AccountSettings', () => ({
  __esModule: true,
  default: (props: { placement?: string }) => (
    <div data-testid="top-account-settings" data-placement={props.placement} />
  ),
}));

expect(screen.getByRole('banner')).toHaveClass('grid');
expect(screen.getByTestId('portal-primary-nav').querySelectorAll('svg')).toHaveLength(4);
expect(screen.getByTestId('top-account-settings')).toHaveAttribute('data-placement', 'topbar');
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
npm run test:ci -- --runInBand client/src/portal/components/TopNav.spec.tsx
```

Expected: FAIL，因为顶栏仍是 `flex`、无图标且无顶部用户菜单。

- [ ] **Step 3: 实现顶栏和 AccountSettings 布置变体**

`AccountSettings.tsx` 增加显式布置 prop：

```tsx
type AccountSettingsProps = {
  collapsed?: boolean;
  placement?: 'sidebar' | 'topbar';
};

function AccountSettings({ collapsed = false, placement = 'sidebar' }: AccountSettingsProps) {
  const isTopbar = placement === 'topbar';
  // MenuProvider: isTopbar ? 'bottom-end' : collapsed ? 'right-end' : undefined
  // popover transformOrigin: isTopbar ? 'right top' : collapsed ? 'left bottom' : 'bottom'
  // popover translate: isTopbar ? '0 4px' : collapsed ? '4px 0' : '0 -4px'
}
```

`TopNav.tsx` 导入 `Brain, BarChart3, Files, LayoutGrid` 和 `AccountSettings`，并使用：

```tsx
<header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center ...">
  <div className="min-w-0 justify-self-start ...">{config.brandName}</div>
  <nav data-testid="portal-primary-nav" className="flex min-w-0 items-center overflow-x-auto">
    {/* four icon + label items */}
  </nav>
  <div className="justify-self-end">
    <AccountSettings collapsed placement="topbar" />
  </div>
</header>
```

- [ ] **Step 4: 运行顶栏测试并确认通过**

Run: `npm run test:ci -- --runInBand client/src/portal/components/TopNav.spec.tsx`  
Expected: 1 test suite PASS。

- [ ] **Step 5: 提交顶栏变更**

```bash
git add client/src/portal/components/TopNav.tsx \
  client/src/portal/components/TopNav.spec.tsx \
  client/src/components/Nav/AccountSettings.tsx
git commit -m "feat: refine enterprise portal header"
```

### Task 2: 去除重复侧栏头像并隐藏 Portal 聊天页脚

**Files:**

- Modify: `client/src/routes/Root.tsx`
- Modify: `client/src/components/UnifiedSidebar/UnifiedSidebar.tsx`
- Modify: `client/src/components/UnifiedSidebar/Sidebar.tsx`
- Modify: `client/src/components/UnifiedSidebar/ExpandedPanel.tsx`
- Modify: `client/src/components/UnifiedSidebar/__tests__/ExpandedPanel.spec.tsx`
- Modify: `client/src/components/Chat/Footer.tsx`
- Create: `client/src/components/Chat/Footer.portal.spec.tsx`

**Interfaces:**

- Consumes: `portalEnabled: boolean` from `Root` startup config.
- Produces: `UnifiedSidebarProps = { showAccountSettings?: boolean }`，通过 `Sidebar` 传给 `ExpandedPanel`；Portal 开启时 `Chat/Footer` 返回 `null`。

- [ ] **Step 1: 为侧栏用户入口写失败测试**

扩展 `renderPanel` 支持 `showAccountSettings`，新增：

```tsx
it('hides account settings when the top portal header owns the user menu', () => {
  renderPanel({ showAccountSettings: false });
  expect(screen.queryByTestId('account-settings')).not.toBeInTheDocument();
});

it('keeps account settings by default for native LibreChat mode', () => {
  renderPanel();
  expect(screen.getByTestId('account-settings')).toBeInTheDocument();
});
```

- [ ] **Step 2: 为页脚写失败测试**

mock `useGetStartupConfig`，断言 Portal 开启时无 `contentinfo`，Portal 关闭时仍有原生页脚：

```tsx
expect(renderFooter({ portal: { enabled: true } }).queryByRole('contentinfo')).toBeNull();
expect(renderFooter({ portal: { enabled: false } }).getByRole('contentinfo')).toBeInTheDocument();
```

- [ ] **Step 3: 运行两组测试并确认失败**

Run:

```bash
npm run test:ci -- --runInBand \
  client/src/components/UnifiedSidebar/__tests__/ExpandedPanel.spec.tsx \
  client/src/components/Chat/Footer.portal.spec.tsx
```

Expected: 新用例 FAIL，因为无隐藏 prop 且 Footer 未识别 Portal。

- [ ] **Step 4: 实现显式的侧栏显示开关**

`Root.tsx`:

```tsx
{
  !isPortalRoute && <UnifiedSidebar showAccountSettings={!portalEnabled} />;
}
```

`UnifiedSidebar.tsx` 、`Sidebar.tsx` 和 `ExpandedPanel.tsx` 逐层传递 `showAccountSettings = true`，最终使用：

```tsx
{
  showAccountSettings && (
    <div className="mt-auto">
      <Suspense fallback={<Skeleton className="h-9 w-9 rounded-lg" />}>
        <AccountSettings collapsed />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 5: 实现 Portal 页脚短路**

`FooterStartupConfig` 加入 `portal?: Pick<NonNullable<TStartupConfig['portal']>, 'enabled'>`，并在所有 hooks 调用之后增加：

```tsx
if (config?.portal?.enabled === true) {
  return null;
}
```

- [ ] **Step 6: 运行两组测试并确认通过**

Run: Task 2 Step 3 的命令。  
Expected: 两个 test suite PASS，现有 ExpandedPanel 用例不回退。

- [ ] **Step 7: 提交布局变更**

```bash
git add client/src/routes/Root.tsx \
  client/src/components/UnifiedSidebar/UnifiedSidebar.tsx \
  client/src/components/UnifiedSidebar/Sidebar.tsx \
  client/src/components/UnifiedSidebar/ExpandedPanel.tsx \
  client/src/components/UnifiedSidebar/__tests__/ExpandedPanel.spec.tsx \
  client/src/components/Chat/Footer.tsx \
  client/src/components/Chat/Footer.portal.spec.tsx
git commit -m "feat: move portal account menu to header"
```

### Task 3: 定制清单、全量验证与测试服务器部署

**Files:**

- Create: `docs/portal/CUSTOMIZATIONS.md`
- Verify: `docs/superpowers/specs/2026-09-01-librechat-portal-layout-customization-design.md`
- Verify: `/srv/enterprise-ai/config/compose.portal.yml`

**Interfaces:**

- Consumes: Tasks 1–2 中的定制点和原有 Portal 实现。
- Produces: 可迁移定制台账、新 Portal 镜像、内部验收证据。

- [ ] **Step 1: 编写完整定制台账**

`CUSTOMIZATIONS.md` 必须包含：基线版本、Portal 配置和 API、MongoDB 数据模型、权限/审计、图标安全、顶栏/应用中心/用户菜单/页脚、多语言、Compose override、升级迁移步骤、回归清单，并列出每项对应文件。

- [ ] **Step 2: 运行定向测试**

```bash
npm run test:ci -- --runInBand \
  client/src/portal/components/TopNav.spec.tsx \
  client/src/components/UnifiedSidebar/__tests__/ExpandedPanel.spec.tsx \
  client/src/components/Chat/Footer.portal.spec.tsx
```

Expected: all suites PASS。

- [ ] **Step 3: 运行类型、Lint 和生产构建**

```bash
npm run typecheck
npx eslint \
  src/portal/components/TopNav.tsx \
  src/portal/components/TopNav.spec.tsx \
  src/components/Nav/AccountSettings.tsx \
  src/components/UnifiedSidebar/UnifiedSidebar.tsx \
  src/components/UnifiedSidebar/Sidebar.tsx \
  src/components/UnifiedSidebar/ExpandedPanel.tsx \
  src/components/UnifiedSidebar/__tests__/ExpandedPanel.spec.tsx \
  src/components/Chat/Footer.tsx \
  src/components/Chat/Footer.portal.spec.tsx \
  src/routes/Root.tsx
npm run build
```

Working directory: `client`  
Expected: all commands exit 0。

- [ ] **Step 4: 同步到服务器并提交定制记录**

只同步本计划修改/新增的文件到 `/srv/enterprise-ai/source/LibreChat-portal`，确认 diff 后提交：

```bash
git add client/src docs/portal/CUSTOMIZATIONS.md docs/superpowers
git commit -m "feat: customize enterprise portal navigation"
```

- [ ] **Step 5: 构建不覆盖旧镜像的新版本**

将 override 镜像标签更新为 `enterprise-ai/librechat:v0.8.7-portal.3`，先执行 `docker compose ... config --quiet`，再构建 `librechat`。保留 `portal.2` 和原始 `v0.8.7` 镜像。

- [ ] **Step 6: 部署并执行内部验收**

```bash
sudo docker compose --project-directory /srv/enterprise-ai/config \
  --env-file /srv/enterprise-ai/config/.env \
  -f /srv/enterprise-ai/config/compose.yml \
  -f /srv/enterprise-ai/config/compose.portal.yml \
  up -d --no-deps librechat
```

验证：

- 容器镜像为 `portal.3`，状态 running，无异常重启。
- 容器内 `/readyz` 返回 200/OK。
- 内部 Caddy `/portal/apps` 返回 200。
- `portal-api-acceptance.mjs` 返回 `portal-api-acceptance: PASS`。
- 无验收临时分组、应用、收藏和图标文件残留。

- [ ] **Step 7: 记录新镜像摘要和未执行的视觉 UAT**

在交付记录中写入新提交、镜像 ID、容器状态、构建/API 验收结果，并明确说明外网映射和未实际执行的真实浏览器视觉 UAT 不得写成已通过。
