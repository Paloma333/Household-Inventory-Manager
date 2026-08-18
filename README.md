# 小家 (him) — Household Inventory Manager

> 一个让 AI 帮你记住家里有什么的治愈系库存工具

产品形态：纯 Web App（移动端优先，PWA 可"加到主屏幕"，接近原生体验）。
代码组织：Next.js 14 App Router + TypeScript + Tailwind + Supabase + Vercel。

---

## Sprint 0 状态

**目标**：注册 → 写一条数据 → 读出来。✅ 已完成。

```
Sprint 0 收尾清单
├── [x] Next.js 14 + TypeScript + Tailwind 项目骨架
├── [x] PRD §1 设计 token 落地（CSS 变量 + Tailwind theme）
├── [x] 8 个基础组件（Btn / Card / Input / Stepper / Sheet / EmptyState / Skeleton / Toast）
├── [x] Supabase 10 张表迁移（含 pg_trgm 模糊搜索）
├── [x] RLS 策略（按 household_id 隔离）
├── [x] 分类种子数据（一级 7 类 + 二级 27 类）
├── [x] Supabase Auth + 路由保护（middleware.ts）
├── [x] 注册时自动建户 + user 镜像
├── [x] /hello 验收页（手写一条 → 列表立刻显示）
├── [x] /api/analytics/log 埋点写入端点 + 前端 SDK（sendBeacon）
├── [x] PWA manifest + 占位 service worker
└── [x] PRD §3.1/3.2/3.4/3.5/3.7/3.8 占位路由（不会 404）
```

---

## 你需要做的事（5 步，约 30 分钟）

### 1. 注册 Supabase（5 分钟）

去 https://supabase.com/dashboard 新建一个项目：
- Region：**Singapore**（离中国大陆最近）
- Password：自己定一个强密码
- 创建完不要急着关页面，下一步要用 URL + anon key

### 2. 跑数据库迁移（5 分钟）

两种方式任选：

**方式 A（推荐）**：装 CLI 一次，以后改 SQL 直接命令行推。

```bash
# 安装 supabase CLI（不需要登录就能用本地 SQL 推送）
brew install supabase/tap/supabase

# 关联项目
supabase link --project-ref <你的项目 ref>
# 会问数据库密码（项目创建时设的）

# 推送所有迁移
supabase db push

# 重新生成 TS 类型（可选，等 Sprint 1 再用）
npm run db:types
```

**方式 B**：直接复制 SQL。

打开 Supabase Dashboard → SQL Editor → New query，依次贴入运行：
1. `supabase/migrations/0001_init_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_seed_categories.sql`

### 3. 关掉邮箱验证（开发期）

Supabase 默认邮箱注册要验证链接，第一次会很卡。开发期建议先关：
- Dashboard → Authentication → Providers → Email
- 关掉 **Confirm email**，并把 **Enable sign up** 保持打开

### 4. 填环境变量（2 分钟）

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

打开 `.env.local`，把 Supabase Dashboard → Project Settings → API 里三样东西填进去：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...（anon public）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...（service_role secret，注意保密）
```

### 5. 启动！

```bash
npm install
npm run dev
```

打开 http://localhost:3000 → 注册一个测试账号 → 进小家 → 底部 tab 切到 "我的" 看一眼 → 进 `/hello` 写一条数据。

如果看到列表里立刻出现你刚写的东西，**Sprint 0 就通了**。

---

## 不依赖 Sprint 0，但你如果顺手想做可以一起做

- 在 https://dashscope.aliyun.com/ 注册阿里百炼（提前批 AI key），备用
- 在 https://open.bigmodel.cn/ 注册 GLM-4V（Sprint 2 AI fallback 用）
- 创建私有 GitHub 仓库 `him`，把代码 push 上去
- 用 https://vercel.com 连接 GitHub，一键部署。环境变量也同步填过去

---

## 路径速查

| 文件 | 作用 |
|------|------|
| `app/layout.tsx` | 根 layout + ToastViewport |
| `app/(app)/page.tsx` | 首页 / 我的小家（PRD §3.1） |
| `app/(app)/hello/page.tsx` | Sprint 0 验收页 |
| `app/(app)/add/page.tsx` | 添加页入口占位 |
| `app/(auth)/login` `/signup` `/auth/callback` | 登录注册 |
| `app/api/hello/items/route.ts` | Sprint 0 items CRUD |
| `app/api/bootstrap/household` | 注册后自动建户 |
| `app/api/analytics/log` | 埋点写入端点 |
| `supabase/migrations/0001_init_schema.sql` | 10 张表 schema |
| `supabase/migrations/0002_rls_policies.sql` | household_id 隔离 |
| `supabase/migrations/0003_seed_categories.sql` | 分类种子数据 |
| `lib/supabase/{client,server,middleware}.ts` | 三种 Supabase 客户端 |
| `lib/analytics/index.ts` | 前端埋点 SDK |
| `lib/inventory/types.ts` | 前后端共用类型 |
| `components/ui/*` | 基础组件（PRD §2） |
| `tailwind.config.ts` | 设计 token → Tailwind 主题 |
| `app/globals.css` | CSS 变量 + 纸颗粒肌理 |
| `middleware.ts` | 路由保护（未登录跳 /login） |

---

## Sprint 1 准备

Sprint 0 一通过，下个 Sprint 来：
- 手动添加表单（react-hook-form + zod）
- /add/manual 页面（接现有的 hello 流程）
- 库存列表（PRD §3.4 完整版）+ 分类 Tab
- 商品卡 +/- + 长按连续模式（Stepper 已经写好了）
- /inventory/[itemId] 商品详情 + 历史时间轴

参考：swift-pulse-newton.md §五 Sprint 1 的任务清单。

---

## 设计原则（PRD §0）

- **生活感而非应用感** —— "走进自己刚收拾过的小厨房"
- **气质锚点**：暖中性（米白/奶白）+ 单一品牌色（鼠尾草绿 `#7A9471`）
- **绝对禁止**：Hero 区塞大眼睛卡通宠物、渐变彩色卡片墙、全圆角大阴影、emoji 代替图标、整屏 toast 庆祝、Lottie 强推、弹性 ease 动效

详细 PRD 在 `docs/PRD_v1.1_UI交互规格.md`；功能/数据模型 ERD 在 `docs/家庭库存管理产品_PRD_v1.0.docx`（或者仓库外的那份也行）。
