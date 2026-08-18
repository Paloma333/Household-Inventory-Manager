# 小家 (him) — Household Inventory Manager

> 一个让 AI 帮你记住家里有什么的治愈系库存工具

产品形态：纯 Web App（移动端优先，PWA 可"加到主屏幕"，接近原生体验）。
代码组织：Next.js 14 App Router + TypeScript + Tailwind + Supabase + Vercel。

---

## 当前状态（2026-08）

**Sprint 0–3 已完成**，主线功能全部可用；Sprint 4（数据闭环）与 Sprint 5（上线抛光）进行中。

```
已完成
├── [x] Sprint 0 基础设施：设计 tokens / 基础组件库 / Supabase 12 张表 + RLS / Auth / 埋点 / PWA
├── [x] Sprint 1 手动闭环：首页仪表盘 / 库存列表(搜索+分类) / 商品详情(+/- 与历史时间轴) / 手动添加表单
├── [x] Sprint 2 AI 闭环：Qwen-VL 识别(含 mock 兜底) / 三档置信度确认页 / 重复购买三分支 / 配额限制
├── [x] Sprint 3 补货闭环：补货建议三分组 / 购物清单(勾选/自定义/结算回写) / 公开分享链接(token 可作废)
└── [x] 设计系统展示页 /design
进行中
├── [ ] Sprint 4 数据闭环：小家名编辑 / 草稿 / 回收站 / 导出 CSV·JSON / 低库存阈值 / 关于与反馈
└── [ ] Sprint 5 上线：Vercel 部署 / landing 页 / SEO / Lighthouse ≥ 90
```

验证：`npm run typecheck` 0 错误；19 个 API 路由。

---

## 本地启动

```bash
npm install
npm run dev        # 打开 http://localhost:3000
```

环境变量见 `.env.example`，复制为 `.env.local` 并填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://你的项目ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...（anon public）
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...（service_role secret，注意保密）
QWEN_API_KEY=sk-...（可选，不填则 AI 识别走 mock）
MOCK_AI=1          # 可选，强制 mock
```

### 数据库迁移

```bash
supabase link --project-ref <你的项目 ref>
supabase db push
npm run db:types   # 重新生成 TS 类型
```

---

## 路径速查

| 文件 | 作用 |
|------|------|
| `app/(app)/page.tsx` | 首页仪表盘（问候语 / 库存概览 / 提醒 / 最近动态） |
| `app/(app)/inventory/page.tsx` | 库存列表（搜索 + 分类 Tab + 状态徽标） |
| `app/(app)/inventory/[itemId]/page.tsx` | 商品详情（Stepper 调整 / 历史时间轴 / 编辑 / 软删） |
| `app/(app)/add/*` | 添加入口（小票 / 截图 / 拍照识物 / 手动） |
| `app/(app)/confirm/[batchId]/page.tsx` | AI 识别确认页（三档置信度 / 字段编辑 / 重复检测） |
| `app/(app)/restock/*` | 补货建议 / 购物清单 / 分享管理 |
| `app/r/[shareToken]/page.tsx` | 公开只读分享页（无需登录） |
| `app/(app)/settings/page.tsx` | 我的（小家名 / 数据 / 退出） |
| `app/about/page.tsx` | 关于页（公开） |
| `app/api/*/route.ts` | 19 个 API 路由（items / recognition / restock / dashboard / share …） |
| `supabase/migrations/0001–0005` | 12 张表 schema + RLS + 种子数据 + 用量视图 + 补货表 |
| `lib/ai/*` | Qwen-VL 适配器 + mock + schema 校验 + 配额 |
| `lib/restock/*` | 补货建议 / 购物清单 / 分享 token |
| `lib/supabase/*` | client / server / middleware / storage |
| `components/ui/*` | 基础组件（PRD §2） |
| `app/(app)/design/page.tsx` | 设计系统展示页 |

---

## 设计原则（PRD §0）

- **生活感而非应用感** —— "走进自己刚收拾过的小厨房"
- **气质锚点**：暖中性（米白/奶白）+ 单一品牌色（鼠尾草绿 `#7A9471`）
- **绝对禁止**：Hero 区塞大眼睛卡通宠物、渐变彩色卡片墙、全圆角大阴影、emoji 代替图标、整屏 toast 庆祝、Lottie 强推、弹性 ease 动效

详细 PRD 在 `docs/PRD_v1.1_UI交互规格.md`；Sprint 计划在 `docs/swift-pulse-newton.md`。
