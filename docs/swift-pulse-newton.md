# 家庭库存管理 Web App · 全栈开发步骤方案（v2）

> **基础**：以 `PRD_v1.1_UI交互规格.docx` 为唯一事实来源（功能 / 数据模型 / 页面 / 状态机均已对齐）。
> **栈**：Next.js 14（App Router）+ React 18 + TypeScript + Tailwind · Next.js API Routes（Serverless Function）· Supabase（Postgres + Auth + Storage）· Vercel 一键部署 · Qwen-VL-Plus（阿里百炼）/ GLM-4V（智谱）做视觉识别。
> **形态**：纯 Web App（响应式，移动端 / 桌面 / PWA 全适配）。**不再做小程序**——作品集场景下 Web 的可达性、SEO、调试速度、部署便利性全面碾压小程序，且 PRD v1.0 中"Web 为海外/跨平台入口"的部分升级为**主形态**。
> **节奏**：目标 MVP 3-4 周上线，6 个 Sprint（含 1 周缓冲）。
> **变更**：相比 v1 计划（小程序 + CloudBase + Taro），MVP 时间从 6-8 周压缩到 3-4 周，技术债显著减少。

---

## 一、为什么从"小程序优先"改成"纯 Web"

| 维度 | 旧方案（Taro + 小程序 + CloudBase） | 新方案（Next.js + Supabase + Vercel） |
|------|--------------------------------------|----------------------------------------|
| 注册/审核 | 个人主体受限（不能支付/不能调外部 HTTPS API）；企业主体要营业执照，1-2 天 | **零审核**，git push 即上线 |
| 发版 | 每次改动都要提审 1-7 天 | 改完即时生效 |
| 调试 | 微信开发者工具 + 真机 + iOS 权限弹窗 | Chrome DevTools + 移动端模拟器 |
| AI 调用 | 个人主体小程序受限；wx.request 跨域坑多 | 直接 `fetch`，零限制 |
| npm 生态 | 受限（Canvas/WebGL/部分 Node 包） | 全量 npm |
| 作品集展示 | 需扫码；面试官不一定装微信 | URL 即开，跨平台、SEO 友好 |
| 开发速度（solo） | MVP 6-8 周 | **MVP 3-4 周** |
| 总成本 | 免费但慢 | 免费 + 更快 |

**结论**：个人作品集场景下，Web 是唯一正解。后续若真要补小程序，业务逻辑（在 `lib/`）和 API Routes 几乎可直接迁移，不存在返工。

---

## 二、总体原则

1. **先闭环，后美化**：Sprint 1 跑通"手动添加 → 库存 → 消耗 → 再买 → 库存更新"全闭环；之后才让 K3 进视觉升级。
2. **一份代码 = 多端**：Next.js App Router 天然响应式 + 移动端适配；PWA 一次配置，手机可"添加到主屏幕"，体验接近原生 App。
3. **Supabase = 后端全家桶**：Auth（邮箱 + OAuth）/ Postgres / Storage / Realtime / Row Level Security 一站搞定，**不用自己写鉴权/存储中间件**。
4. **Vercel = 部署**：Serverless Function 自动扩缩容、CDN 全球加速、preview deployment 看每次 PR。
5. **多模型分工不变**：
   - **Codex / DeepSeek**：业务逻辑、SQL、Serverless Function 实现
   - **Kimi K3**：视觉 / 动效 / Hero / 装饰
   - **我（UI Designer）**：设计系统、UX review、AI Slop audit
   - **Hallmark skill**：每 Sprint 收尾跑 audit，提前拦掉通用 AI 审美污染

---

## 三、技术栈细节（一次性敲定，避免后续返工）

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | Next.js 14（App Router）+ React 18 + TypeScript | SSR/SSG 兼顾，作品集 SEO 友好；React 生态最熟 |
| 样式 | Tailwind CSS + CSS Variables（design tokens） | PRD v1.1 §1 的 token 直接映射成 CSS 变量 + Tailwind theme |
| 状态管理 | Zustand（客户端 UI 状态） + React Query（服务端数据） | 轻量 + 数据缓存/重试/失效刷新 |
| 路由 | Next.js App Router（嵌套布局、loading.tsx、error.tsx） | 与 PRD §3 的页面架构天然对应 |
| 表单 | react-hook-form + zod | AI 确认页大量动态字段，zod schema 前后端共用 |
| 动效 | Framer Motion（动效曲线）+ Tailwind animate（轻动效） | PRD §1.4 的 ease-out-expo / ease-out-quart 直接配 |
| 后端运行时 | Next.js API Routes（Vercel Serverless Function，Node.js 18） | 与前端同仓库、零运维 |
| 数据库 | Supabase Postgres | 关系型，与 PRD v1.0 数据模型一致；带 RLS |
| 鉴权 | Supabase Auth（邮箱密码 + Google OAuth + GitHub OAuth） | 5 分钟接入，后续可加微信 OAuth |
| 对象存储 | Supabase Storage（短期签名 URL） | 用户上传图片、购物清单导出图 |
| AI 视觉 | Qwen-VL-Plus（阿里百炼）→ 备 GLM-4V（智谱） | 中文小票/网购截图识别率高；留 fallback |
| 部署 | Vercel（一键）+ Supabase（云托管） | git push 自动部署，preview URL 看 PR |
| 监控 | Vercel Analytics（基础）+ Sentry（错误聚合，可选） | 作品集项目 MVP 阶段 Vercel 自带足够 |
| 埋点 | Supabase `events` 表（PRD v1.0 已定义）+ 简易 SQL 看板 | 不上 GA / 神策 |
| PWA | next-pwa 或 Serwist（service worker） | "添加到主屏幕"体验接近原生 App |

---

## 四、仓库结构（Next.js monorepo）

```
him/                              # Him = Household Inventory Manager
├── app/                          # Next.js App Router 目录
│   ├── (auth)/                   # 登录/注册路由组（无侧栏）
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx
│   ├── (app)/                    # 主应用路由组（有底栏/侧栏）
│   │   ├── layout.tsx            # 顶栏 + 底栏 + 全局状态
│   │   ├── page.tsx              # 首页（PRD §3.1）
│   │   ├── add/                  # 添加页（PRD §3.2）
│   │   │   ├── page.tsx
│   │   │   ├── manual/page.tsx
│   │   │   ├── receipt/page.tsx  # 拍小票
│   │   │   └── recognize/page.tsx# 拍照识物
│   │   ├── confirm/[batchId]/    # AI 确认页（PRD §3.3）
│   │   │   └── page.tsx
│   │   ├── inventory/            # 库存页（PRD §3.4）
│   │   │   ├── page.tsx
│   │   │   └── [itemId]/page.tsx # 商品详情（PRD §3.5）
│   │   ├── restock/              # 补货清单（PRD §3.7）
│   │   │   ├── page.tsx
│   │   │   └── [listId]/page.tsx
│   │   ├── drafts/               # 草稿（PRD §3.10）
│   │   ├── trash/                # 回收站（PRD §3.11）
│   │   ├── settings/             # 我的 + 设置（PRD §3.8）
│   │   │   ├── page.tsx
│   │   │   ├── export/page.tsx
│   │   │   └── feedback/page.tsx
│   │   └── search/page.tsx       # 搜索结果（PRD §3.9）
│   ├── api/                      # Next.js API Routes（Serverless）
│   │   ├── auth/callback/route.ts
│   │   ├── items/route.ts
│   │   ├── items/[id]/route.ts
│   │   ├── items/[id]/adjust/route.ts
│   │   ├── recognition/route.ts  # AI 识别入口
│   │   ├── recognition/[id]/route.ts
│   │   ├── search/route.ts
│   │   ├── restock/route.ts
│   │   └── analytics/log/route.ts
│   ├── design-system/            # 设计系统展示页（作品集加分项）
│   ├── layout.tsx                # 根布局
│   ├── loading.tsx               # 全局 loading
│   ├── error.tsx                 # 全局 error boundary
│   └── globals.css               # 设计 token CSS 变量
├── components/                   # 共享 UI 组件
│   ├── ui/                       # Button / Card / Input / Stepper 等基础组件
│   ├── feature/                  # ProductCard / InventoryList / RecognitionCard 等业务组件
│   └── layout/                   # TopBar / BottomNav / FAB / Sheet
├── lib/                          # 业务逻辑层（前后端共用、纯 TS 无依赖 React）
│   ├── supabase/                 # Supabase 客户端（client + server）
│   ├── ai/                       # Qwen-VL 适配器、prompt 模板、schema 校验
│   ├── inventory/                # 数量计算、标准化名、事件写入
│   ├── analytics/                # 埋点 helper
│   └── utils/                    # 通用工具
├── packages/                     # （可选）共享包，未来若拆仓库用
│   ├── shared-types/             # TS 类型 + zod schema
│   └── design-tokens/            # PRD §1 token JSON + Tailwind preset
├── supabase/
│   ├── migrations/               # SQL 迁移
│   ├── seed/                     # 分类字典种子数据
│   └── functions/                # （可选）Supabase Edge Function（仅当 API Routes 不够用时）
├── public/
│   ├── icons/                    # 手绘风图标
│   └── illustrations/            # 空状态插画
├── docs/
│   ├── PRD_v1.1_UI交互规格.docx  # 设计事实（已有）
│   └── api-contract.md           # 接口契约（自动从 zod 生成）
├── .env.local                    # Supabase URL/anon key、Qwen API key 等
├── tailwind.config.ts            # 设计 token → Tailwind theme
├── next.config.js
└── package.json
```

---

## 五、6 个 Sprint 的开发节奏

> 每个 Sprint 结尾都做 3 件事：(1) 自测 PRD §8 对照表 (2) 跑 Hallmark audit (3) 写 1 页 README 更新当前状态。

### Sprint 0 · 基础设施（2-3 天）

**目标**：Hello World 跑通「注册 → 写一条数据 → 读出来」。

任务清单：
- [ ] 注册 Supabase 项目，开通 Postgres + Auth + Storage
- [ ] Vercel 连接 GitHub 仓库，1 个 commit 自动部署
- [ ] `pnpm create next-app@latest him --typescript --tailwind --app` 初始化
- [ ] 设计 tokens 落地：PRD §1.1-1.5 → `tailwind.config.ts` + `globals.css` CSS Variables
- [ ] 基础组件库（PRD §2）：Button / Card / Input / Stepper / Toast / EmptyState / Skeleton / Modal
- [ ] Supabase 数据库迁移：`users` / `households` / `items` / `inventory_events` / `categories`（PRD §10 Table 4）
- [ ] Supabase Auth 接入：邮箱密码登录 + Google OAuth + 路由保护（middleware.ts）
- [ ] RLS 策略：`items` / `inventory_events` 按 `household_id` 隔离
- [ ] 埋点 SDK 雏形：`log(event, props)` → POST `/api/analytics/log` → Supabase `events` 表
- [ ] PWA 基础配置（manifest.json + Serwist）
- [ ] Vercel preview deployment 跑通（每个 PR 自动生成 URL）

**验收**：能邮箱注册登录，往 Supabase 手动 insert 一条 item，再在前端列表展示出来。

---

### Sprint 1 · 手动添加 + 库存闭环（5 天）

**目标**：用户能手动录入、浏览、调整库存，跑通**非 AI** 的"购买 → 入库 → 消耗 → 再购买 → 库存更新"闭环。

任务清单：
- [ ] 页面：首页（3.1 简化版）、添加页（3.2 简化版只留手动）、库存页（3.4 完整）、商品详情（3.5 完整）
- [ ] 手动添加表单（react-hook-form + zod 校验）
- [ ] +/- 调整 + 长按连续步进
- [ ] 库存事件自动写入 `inventory_events`
- [ ] 搜索 + 分类 Tab + 字母索引
- [ ] 商品详情历史时间轴
- [ ] 核心埋点：`app_open` / `add_started` / `item_created` / `item_adjusted` / `inventory_viewed` / `search_used`
- [ ] 错误/空状态按 PRD §3.1-3.5 全部实现
- [ ] 移动端响应式：≤ 640px 用底部导航 + 单列布局；≥ 1024px 用侧栏 + 双列

**验收**：用户能在桌面和手机两套视图下，手动跑一遍"购买 6 包抽纸 → 用掉 2 包 → 详情看历史"，埋点能在 Supabase 后台查到。

---

### Sprint 2 · AI 识别闭环（7 天）

**目标**：拍小票 / 截图 → AI 识别 → 人工确认 → 入库，跑通**AI 闭环**。

任务清单：
- [ ] 阿里百炼 Qwen-VL-Plus 接入：封装 `/api/recognition` route
- [ ] 输出 schema 严格对齐 PRD §9.2（含 `confidence` 三档）
- [ ] 图片上传：Supabase Storage + 短期签名 URL（PRD §15 隐私要求）
- [ ] AI 确认页完整版（PRD §3.3）：三档置信度视觉 / 字段行可编辑 / 主 CTA 校验门 / 暂存
- [ ] 拍照识物（候选物品勾选 + 数量补全）
- [ ] 重复购买弹窗（PRD §3.6）三分支：已用完 / 还剩点 / 永远当成不同
- [ ] 商品标准化：`raw_name` / `canonical_name` / `product_aliases` 写入逻辑
- [ ] 埋点：`recognition_started` / `recognition_completed` / `recognition_item_corrected` / `duplicate_detected` / `duplicate_confirmed` / `item_confirmed`
- [ ] 失败兜底：模糊 / 超时 / 找不到（PRD §11.3）三态文案 + 重试入口
- [ ] 移动端相机调用：`getUserMedia` + `<input capture>` 兼容方案

**验收**：用手机拍一张真实超市小票，能识别出 ≥ 70% 的商品；触发重复购买时弹出 3 分支弹窗。

**风险预案**：
- 若 Qwen-VL 准确率不达标 → 启用 GLM-4V 作为 fallback，API route 内部做路由
- 若 Serverless 冷启动超过 3 秒 → 前端用 PRD §2.6 的"3 句轮换文案"兜底

---

### Sprint 3 · 库存补全 + 补货（5 天）

任务清单：
- [ ] 库存排序/筛选 Sheet（按字母 / 上次使用 / 数量 / 临近过期）
- [ ] 补货清单（PRD §3.7）：已用完 / 快用完 / 快过期 三分组
- [ ] 临时购物清单页 + 一键勾选"全部买到了"
- [ ] 分享购物清单：URL 链接（`/restock/[listId]` 公开可读）+ 文本复制 + 图片导出
- [ ] 草稿页（PRD §3.10） + 回收站页（PRD §3.11）+ 30 天自动清理
- [ ] 首页"刚刚放进 X"反馈卡片（PRD §3.1.6）
- [ ] 设计系统展示页 `/design-system`（作品集加分项：组件库 + token + 动效展示）

**验收**：从"补货清单 → 分享 → 买回来 → 触发重复购买 → 库存合并"全流程可走通。

---

### Sprint 4 · 我的 + 数据 + 设置（4 天）

任务清单：
- [ ] 我的页面（PRD §3.8）完整版：小家名 / 草稿 / 回收站 / 导出 / 删除数据
- [ ] 数据导出：CSV + 图片 zip（短期签名 URL + 流式下载）
- [ ] 删除所有数据：输入"删除" + 二次确认 + 7 天软删 + 真删
- [ ] 通知系统：Web Push（VAPID）+ 邮件（Resend 免费层）
- [ ] 阈值设置（PRD §3.5 低库存阈值）
- [ ] 关于 / 反馈页（写入 Supabase `feedback` 表）

**验收**：能完整走"导出 → 删除 → 重新注册 → 数据恢复"流程。

---

### Sprint 5 · 优化 + 上线（5 天 + 缓冲）

任务清单：
- [ ] 性能：图片懒加载（Next/Image）、骨架屏、`React.memo` 关键列表、字体子集化
- [ ] 跨页面动效叙事曲线（PRD §6）落地（Framer Motion）
- [ ] 可访问性（PRD §7）：TalkBack / VoiceOver / 焦点环 / `aria-*`
- [ ] SEO：sitemap.xml / robots.txt / Open Graph / Twitter Card
- [ ] Vercel Analytics 接入（Web Vitals）
- [ ] Sentry 接入（错误聚合 + 报警；可选）
- [ ] BI 看板：简易 SQL + ECharts 嵌入 `/admin/analytics`（埋点事件查询）
- [ ] 作品集抛光：landing page（项目介绍 + 设计意图 + 数据故事 + 真实 demo 链接）
- [ ] Lighthouse 跑分：Performance / Accessibility / Best Practices / SEO 均 ≥ 90

**验收**：PRD §17 验收标准全部勾完；Lighthouse 全绿；准备上线。

---

## 六、关键时间节点

| Day | 里程碑 | 验证动作 |
|-----|--------|---------|
| 3   | Sprint 0 收尾：Hello World | 注册 + 读写一条数据 |
| 8   | Sprint 1 收尾：手动闭环 | 桌面 + 手机两套视图走通手动闭环 |
| 15  | Sprint 2 收尾：AI 闭环 | 拍真实小票成功入库 ≥ 3 次 |
| 20  | Sprint 3 收尾：补货闭环 | "补货 → 分享 → 买回来 → 合并" 跑通 |
| 24  | Sprint 4 收尾：数据闭环 | 导出 → 删除 → 重注册 → 数据恢复 |
| 29  | Sprint 5 收尾：上线 | Lighthouse 全绿，作品集 landing 完工 |

---

## 七、并行与依赖图

```
Sprint 0  ──→  Sprint 1  ──→  Sprint 2  ──→  Sprint 3  ──→  Sprint 4  ──→  Sprint 5
                            │
                            └─→ (可并行：设计系统展示页 / 作品集 landing)
```

- Sprint 1 必须串在 Sprint 0 后面
- Sprint 2 依赖 Sprint 1 的 items / events 表
- Sprint 3 依赖 Sprint 1 的库存页 + Sprint 2 的 AI 入库
- Sprint 4 可以和 Sprint 3 部分并行（页面解耦）
- 作品集 landing 可从 Sprint 2 后并行做

---

## 八、关键风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Qwen-VL 准确率低 | AI 闭环失败 | 提前用 20 张真实小票做 PoC（Day 8-10）；不达标切 GLM-4V |
| Vercel Serverless 冷启动 | 用户感知慢 | 登录后预热一个无副作用 API；前端 3 句轮换文案 + 骨架屏 |
| PRD v1.1 动效细节实现成本高 | 上线延期 | 动效用 Framer Motion 实现；Lottie 仅在"成功过渡页"用 1 次 |
| 多模型产出风格不一致 | 设计混乱 | 所有 AI 产出物（代码 / 图标 / 文案）必须先过我（UI Designer）的 audit 才能合入 |
| Supabase 免费层限额 | 大流量后成本上升 | MVP 阶段免费层（500MB DB / 1GB Storage）足够；上量后切 Pro |
| Solo 全栈导致某些模块慢 | 心理负担 | K3 / Codex / DeepSeek 多模型协作；任何阻塞超过 1 天升级到我 |

---

## 九、立刻可以启动的事（不依赖 Sprint 0）

1. **注册 Supabase 账号**（邮箱注册，5 分钟）
2. **申请阿里百炼 API Key**（通常当天批；先各申请一个备用）
3. **创建 GitHub 仓库 `him`**（私有也行）
4. **注册 Vercel 账号 + 连接 GitHub**（10 分钟）
5. **本地搭好 Node.js 18 / pnpm**（`brew install pnpm`，10 分钟）
6. **把 PRD_v1.1_UI交互规格.docx 备份到 GitHub 仓库的 `docs/`**（防止本地丢失）

---

## 十、协作约定

- **每个 Sprint 第 1 天上午**：把该 Sprint 的任务清单单独发给我，我做一次 UX review（确认 PRD §3 的页面骨架没漏）
- **每个 Sprint 最后 1 天**：跑 Hallmark audit，截图给我看，我做 AI Slop 评分
- **遇到阻塞超过 4 小时**：直接问我，不要硬磕
- **任何对 PRD §3 页面骨架的修改**：必须先经过我（UI Designer）批准，避免 K3 改视觉时连带改了交互

---

## 十一、文件路径速查

| 文件 | 作用 |
|------|------|
| `.workbuddy-ai/outputs/家庭库存管理产品_PRD_v1.1_UI交互规格.docx` | 唯一事实来源 |
| `.workbuddy-ai/outputs/PRD_v1.1_UI交互规格.md` | 同一份的 markdown 源（便于 grep） |
| `app/(app)/page.tsx` | 首页（PRD §3.1） |
| `app/(app)/add/page.tsx` | 添加页（PRD §3.2） |
| `app/(app)/confirm/[batchId]/page.tsx` | AI 确认页（PRD §3.3） |
| `app/(app)/inventory/page.tsx` | 库存页（PRD §3.4） |
| `app/(app)/inventory/[itemId]/page.tsx` | 商品详情（PRD §3.5） |
| `app/(app)/restock/page.tsx` | 补货清单（PRD §3.7） |
| `app/(app)/settings/page.tsx` | 我的（PRD §3.8） |
| `app/api/*/route.ts` | API Routes |
| `lib/ai/qwen.ts` | Qwen-VL 适配器 |
| `supabase/migrations/*` | SQL 迁移 |
| `tailwind.config.ts` | 设计 token → Tailwind theme |
| `components/ui/*` | 基础组件（PRD §2） |
| `components/feature/*` | 业务组件 |

---

## 十二、保留的小程序升级路径（可选，未来）

如果上线 Web 后真的想补小程序：
- 业务逻辑在 `lib/` 目录，**100% 复用**
- API Routes 语法几乎可直接迁移到云函数
- UI 组件在 Taro / uni-app 里 90% 复用
- **预计额外成本 2 周**

但作为作品集，**Web 已经足够**。建议先做完 Web 再考虑。

---

> **下一步**：回我「**开始 Sprint 0**」，我会把 Sprint 0 拆成约 30 条可验收的 todo，按颗粒度排好，并初始化 Next.js 项目骨架（`pnpm create next-app`、Supabase migrations、Tailwind theme、设计 token 包）。
