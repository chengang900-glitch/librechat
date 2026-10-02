# LibreChat 应用中心权限部署验收

部署日期：2026-10-02（北京时间）。目标：122.224.218.82，SSH 5922；入口 http://demo.uhoo.cn:9433。

## 改动

分类管理和应用管理严格要求 LibreChat `ADMIN` 角色，普通及自定义非 ADMIN 角色不显示管理菜单，管理接口返回 403。收藏继续按认证用户 ID 保存，未修改收藏数据结构或业务记录。

镜像：`enterprise-ai/librechat:v0.8.8-rc4-portal.6-admin-only-20261002`。
镜像 ID：`sha256:fdfcff71bd03e3685e5801f1544a8a09f997324d140765e63d03b1d797542ba8`。
基线：`enterprise-ai/librechat:v0.8.8-rc4-portal.5-weknora-embed-only-11fda11a6`。

以当前镜像构建增量镜像，替换两份路由及 API 主编译包/源码映射。编译包与旧镜像比较，仅有 startup config 参数和管理权限表达式两处逻辑变化；前端与其他依赖继承原镜像。完整 9 层 Compose 保留，仅重建 LibreChat。

旧 `/srv/enterprise-ai/source/LibreChat-portal-rc4` 检出版本落后于线上，未修改。对应线上基线的源码快照 `/srv/enterprise-ai/source/LibreChat-weknora-11fda11a6` 在核对原文件 SHA-256 并备份后同步本次 6 份源码和测试文件；该目录为源码快照，不含 Git 元数据。本地对应基线为 `11fda11a69a4a38d89296f3070aedaaeb0a1e4f4` 加本次权限补丁（部署时尚未提交 Git；源码与本记录一同纳入后续本地提交）。

发布材料：`/srv/enterprise-ai/releases/librechat-admin-only-20261002`，包含构建文件、运行产物 SHA256.json 和相关源码/测试。
备份：`/srv/enterprise-ai/backups/librechat-admin-only-20261002T083237Z`，包含 Compose 文件、旧运行代码和本次修改前源码。

## 已验证

- 本地 45 项相关测试及变更工作区 TypeScript 检查通过；旧路由在管理能力被授予普通角色的模拟条件下放行，修复后拒绝。
- 新镜像构建及运行文件 SHA-256 验证通过。
- 线上现有 ADMIN：管理目录 200，`portal.canManage=true`。
- 线上现有 USER：全部 7 个管理接口 403，`portal.canManage=false`。
- 未认证 Portal / 管理目录接口 401。
- 两个现有账号读取的 7 条可见收藏均与对应 userId 的数据库记录一致，且 `(userId, appId)` 唯一索引存在。线上验收未修改业务数据；跨用户收藏/取消收藏行为由本地真实临时 MongoDB 测试覆盖。
- 外部入口首页和 `/readyz` 均为 200，未认证管理目录为 401。
- 容器 running、重启次数 0，日志出现 `Server readiness checks passing.`；其他服务未重建。

## 验收边界

线上权限检查通过容器内部短时 JWT 和真实用户数据库记录执行；密钥、令牌未打印或落盘。完整浏览器企业 SSO 登录、管理表单提交及模型/MCP 操作未在本次验收。Lighthouse 本地测试脚本未找到英文 Sign up 注册链接，未通过。

## 回退

保留旧镜像。将备份中的 `compose.http-artifacts.yml` 恢复到 `/srv/enterprise-ai/config/compose.http-artifacts.yml`，使用运行容器标签所列全部 9 层 Compose 执行 `up -d --no-deps --no-build --pull never --force-recreate librechat`，然后复核镜像、就绪和认证入口。如需回退源码，从 `source-before-permissions.tar.gz` 恢复原文件并移除本次新增的 `api/server/routes/admin/portal.spec.js`。回退不修改数据库或数据卷。
