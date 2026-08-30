# AGENTS.md — 小屋日志（Him）维护指南

> 只记录长期维护需要知道的事。普通开发常识、业务代码细节请直接读代码。

## 项目用途

「小屋日志」：家庭物品库存管理 Web 应用。核心场景：拍照/传小票/传截图 → AI 识别成商品清单 → 确认入库 → 记录用掉/补货 → 低库存提醒 + 补货清单 + 分享链接。文案风格是治愈系（动森风），改 UI 时保持这个调性。

## 技术栈

- **框架**：Next.js 14 App Router + TypeScript 5 + React 18
- **UI**：Tailwind 3（CSS 变量设计令牌，见 `tailwind.config.ts`）+ `animal-island-ui` + framer-motion + lucide-react
- **状态/数据**：TanStack React Query（服务端数据）、Zustand（本地 UI 状态）
- **后端**：Supabase（Postgres + RLS + Auth，邮箱密码登录）+ Next API Routes（`app/api/**`）
- **AI**：阿里百炼 DashScope `qwen3.6-flash`（`lib/ai/qwen.ts`）。注意：qwen-vl-plus 已于 2026-07 下线，不要改回去
- **部署**：Vercel（Git 集成，push main 自动部署），生产地址 https://him-theta-nine.vercel.app

## 目录结构（只列关键的）

```
app/(app)/        主应用（受登录保护）：add / inventory / restock / drafts / confirm / trash / settings
app/(auth)/       登录注册 + auth/callback（邮件链接换 session）+ forgot/reset-password
app/api/          所有 API route，每个 route 自己处理 401（middleware 跳过 /api/*）
app/r/[shareToken]/  补货清单公开分享页（无需登录）
lib/supabase/     server / client / middleware 三件套 + storage
lib/ai/           qwen 适配器 + mock + 配额闸门（quota）
lib/recognition, lib/restock, lib/inventory/  领域逻辑
supabase/migrations/  数据库 schema 唯一事实来源（0001–0009）
docs/             PRD、UI 规格、视觉任务书
```

## 启动 / 部署

- 本地：`npm run dev`（需 `.env.local`，模板见 `.env.example`）
- 构建：`npm run build`。**坑**：重复构建 dist 缓存问题时用 `NEXT_DIST_DIR=.next-v<N> npx next build`，但 Next 会改写 `tsconfig.json` 的 include，**构建后必须 `git checkout -- tsconfig.json`**
- 部署：push 到 `main` 即自动部署 Vercel，不需要手动 deploy 或 token
- 环境变量：本地在 `.env.local`（已 gitignore）；Vercel 上 4 个：`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `DASHSCOPE_API_KEY`。**坑**：Vercel CLI 管道方式写 env 会把值写坏，用 REST API `POST /v9/projects/{id}/env`（`type: "sensitive"`）
- 数据库变更：改 `supabase/migrations/` 新增 SQL 文件 → `supabase db push` 应用到远程。不要直接改远程库

## 数据库 / API 要点

- **RLS 是安全边界**：所有业务表按 `household_id` 隔离，用户只能碰自己 household 的数据（策略集中在 `0002_rls_policies.sql`，20 条策略）。改表结构时必须同步补 RLS 策略
- 核心表链：`users`（镜像 auth.users）→ `households`（owner）→ `items` → `inventory_events`（每次增减记一条，带 `quantity_change` 正负方向）；另有 `categories`（系统级种子 + 家庭自定义）、`recognition_tasks/items`（AI 识别草稿）、`usage_log`（AI 用量）、`low_stock_rules`、`product_aliases`
- **建 household 是幂等的**：signup、login、auth/callback 三处都会调 `POST /api/bootstrap/household` 兜底补建（public.users 镜像 + household）。历史原因：曾有不带 household 的存量账号
- Service role key（`lib/supabase/server.ts`）只能在 API route 用，前端绝不可见；配额统计等管理查询走它
- API 入参校验统一用 Zod；middleware（`lib/supabase/middleware.ts`）维护 `PUBLIC_PATHS` 白名单，新增公开页面要记得加

## 重要业务逻辑

- **识别流程**：上传图 → 建 `recognition_tasks` + 解析出 `recognition_items`（草稿）→ 用户在 `/confirm/[batchId]` 勾选修正 → 落库成 items + 新增事件。草稿可存 `/drafts`
- **多图识别**：`POST /api/recognition` 支持一次最多 5 张图（form-data 多个 `file`），多张图并行调 AI（`Promise.allSettled`），全部失败才算任务失败。存储路径存在 `recognition_tasks.image_paths`（jsonb 数组，0009 迁移新增），`image_url` 只存第一张做向后兼容。取详情时对每个 path 签名，返回 `image_urls_preview`
- **低库存默认阈值**：确认入库时若 AI 给了 restock_hint，`ensureRestockRule` 按 `floor(入库数量 × 25%)` 设默认阈值（0 = 只在用完时提醒），upsert `onConflict: 'item_id' + ignoreDuplicates`，**不覆盖用户自定义阈值**。阈值永远按物品的计数单位（unit）算：买 1 瓶牛奶 → 阈值 0（不误报「快用完了」）；买 12 包纸巾 → 阈值 3。用户可在物品详情改成 0（用完才提醒）
- **AI mock 模式**：`DASHSCOPE_API_KEY` 未设或 `MOCK_AI=1` 时走 `lib/ai/mock.ts`（不花钱，本地开发默认）。识别解析失败要明示失败让用户重试，**不要静默回落 mock**
- **配额闸门**：调 AI 前先过 `lib/ai/quota.ts`（默认每家每日 30 次成功、每月 50 万 token，可用 `MAX_DAILY_PER_HHOLD` / `MAX_MONTHLY_TOKENS` 覆盖）。被拦截也写一条 `blocked_quota` 的 usage_log
- 物品事件文案按 `quantity_change` 方向区分（正=新增、负=用掉），不要按 event_type 硬编码
- 补货清单有公开分享：`app/r/[shareToken]`，token 在 `lib/restock/share.ts` 生成

## 容易踩的坑（历史踩过的）

1. **Tailwind 令牌长名**：设计令牌有短名（`sage`）和长名（`bg-accent-sage`）两套 class，`tailwind.config.ts` 里两边都注册了。新增令牌时**长短名都要加**，否则样式静默失效（不报错）
2. **删除 Supabase 用户**：admin DELETE 直接删会 500，因为 `inventory_events.user_id` / `recognition_tasks.user_id` 引用 `public.users` 但**没有 on delete cascade**。顺序：先删这两个表里该 user_id 的行（及 households），再删 auth user
3. **邮箱验证已开启（方案 B）**：Supabase Confirm email = ON。signup 返回无 session，前端有「等确认邮件」页；确认/重置邮件经 `/auth/callback` 换 code 自动登录。Supabase 内置发件人（`noreply@mail.app.supabase.com`）发国内邮箱（如 163.com）**常进垃圾箱**，用户反馈收不到邮件先让他翻垃圾箱
4. **Supabase auth URL 配置**：Site URL = 生产域名；Redirect URLs（Management API 字段 `uri_allow_list`）是**逗号分隔字符串不是数组**，PATCH 传数组只会存第一个
5. zsh 脚本里变量名不要用 `UID`（readonly 特殊变量）
6. `supabase gen types`（`npm run db:types`）生成的是本地库类型；远程库变更后记得重新生成，否则 TS 类型对不上

## 测试方式

**没有自动化测试框架**，靠三层：

1. 静态：`npm run typecheck` + `npm run lint` + `npm run build`（改完必跑）
2. 手动冒烟（核心链路）：
   - 注册 → 确认邮件 → 自动进小屋；忘记密码 → 邮件 → 重设 → 登录
   - 拍照/传图识别 → 草稿确认入库 → 库存页展示（含存放位置）→ 用掉/编辑 → 事件记录正确
   - 批量管理模式（勾选删除/改分类）、低库存提醒、补货清单分享链接
3. 服务端排查：curl + service role key（`/auth/v1/admin/*`、`/rest/v1/*`）；清测试账号注意上面第 2 条坑
