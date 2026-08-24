# 小家 (him) — Household Inventory Manager

> 一个让 AI 帮你记住家里有什么的治愈系库存工具

产品形态：纯 Web App（移动端优先，PWA 可"加到主屏幕"，接近原生体验）。
代码组织：Next.js 14 App Router + TypeScript + Tailwind + Supabase + Vercel。

---

## 当前状态（2026-08）

**Sprint 0–4 已完成**，Sprint 5（Vercel 部署与上线抛光）待你在 Vercel 控制台完成最后一步。

```
已完成
├── [x] Sprint 0 基础设施：设计 tokens / 基础组件库 / Supabase 12 张表 + RLS / Auth / 埋点 / PWA
├── [x] Sprint 1 手动闭环：首页仪表盘 / 库存列表(搜索+分类) / 商品详情(+/- 与历史时间轴) / 手动添加表单
├── [x] Sprint 2 AI 闭环：Qwen3.6-Flash 识别(含 mock 兜底) / 三档置信度确认页 / 重复购买三分支 / 配额限制
├── [x] Sprint 3 补货闭环：补货建议三分组 / 购物清单(勾选/自定义/结算回写) / 公开分享链接(token 可作废)
├── [x] Sprint 4 数据闭环：小家名编辑 / 草稿 / 回收站+30天懒清理 / 导出 CSV·JSON / 低库存阈值设置 / 关于与反馈
└── [x] 设计系统展示页 /design、作品集 landing 页 /landing、SEO（sitemap/robots/OG）
进行中
└── [ ] Sprint 5 上线：推送 GitHub → Vercel 部署 / 环境变量同步 / Lighthouse ≥ 90
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
DASHSCOPE_API_KEY=sk-...（可选；不填则 AI 识别走 mock。兼容旧名 QWEN_API_KEY）
GLM_API_KEY=sk-...（可选，备用视觉模型）

# 部署前把 localhost 改成真实域名（影响 OG / Twitter Card / sitemap）
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> AI 识别（拍照/小票/截图识物）默认走 mock 假数据，体验不了真实效果。
> 申请阿里百炼 DashScope 的 API-KEY（模型 `qwen3.6-flash`，qwen-vl-plus 已于 2026-07 下线）后填 `DASHSCOPE_API_KEY` 即切换到真实识别：https://bailian.console.aliyun.com/

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
| `app/landing/page.tsx` | 作品集 landing 页（公开：项目介绍 + 设计意图 + demo 入口） |
| `app/(app)/page.tsx` | 首页仪表盘（问候语 / 库存概览 / 提醒 / 最近动态） |
| `app/(app)/inventory/page.tsx` | 库存列表（搜索 + 分类 Tab + 状态徽标 · 阈值联动） |
| `app/(app)/inventory/[itemId]/page.tsx` | 商品详情（Stepper 调整 / 阈值设置 / 历史时间轴 / 编辑 / 软删） |
| `app/(app)/add/*` | 添加入口（小票 / 截图 / 拍照识物 / 手动） |
| `app/(app)/confirm/[batchId]/page.tsx` | AI 识别确认页（三档置信度 / 字段编辑 / 重复检测 / 暂存草稿） |
| `app/(app)/drafts/page.tsx` | 我的草稿（AI 暂存的批次继续整理） |
| `app/(app)/trash/page.tsx` | 回收站（恢复 / 永久删除 / 30 天懒清理） |
| `app/(app)/restock/*` | 补货建议 / 购物清单 / 分享管理 |
| `app/r/[shareToken]/page.tsx` | 公开只读分享页（无需登录） |
| `app/(app)/settings/page.tsx` | 我的（小家名 / 草稿 / 回收站 / 导出 / 关于与反馈 / 退出） |
| `app/about/page.tsx` | 关于页（公开） |
| `app/api/export/route.ts` | 导出库存 CSV（UTF-8 BOM）/ JSON 快照 |
| `app/api/feedback/route.ts` | 反馈写入 |
| `app/api/household/route.ts` | 小家信息 / 改名 |
| `app/api/items/[id]/rule/route.ts` | 低库存阈值 upsert / 删除 |
| `app/api/*/route.ts` | 19+ 个 API 路由（items / recognition / restock / dashboard / share …） |
| `supabase/migrations/0001–0006` | 12 张表 schema + RLS + 低库存规则 + 草稿/反馈 |
| `lib/ai/*` | Qwen3.6-Flash / GLM-4V 适配器 + mock + schema 校验 + 配额 |
| `lib/restock/*` | 补货建议 / 购物清单 / 分享 token |
| `lib/supabase/*` | client / server / middleware / storage |
| `components/ui/*` | 基础组件（PRD §2） |
| `app/(app)/design/page.tsx` | 设计系统展示页 |

---

## 部署到 Vercel（Sprint 5 最后一步）

1. 在 GitHub 新建仓库（private/public 均可），把当前项目 push 上去：
   ```bash
   git remote add origin https://github.com/<你的账号>/him.git
   git branch -M main
   git push -u origin main
   ```
2. 进入 [Vercel Dashboard](https://vercel.com/dashboard) → Add New Project → Import Git Repository → 选择 `him`。
3. 在 Vercel 的 Environment Variables 里填入 `.env.local` 里的全部值：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DASHSCOPE_API_KEY`（可选）
   - `GLM_API_KEY`（可选）
   - `NEXT_PUBLIC_APP_URL=https://<你的项目>.vercel.app`
4. Deploy。首次部署后：
   - 去 Supabase 把 Vercel 域名加入 Auth → URL Configuration 的 Redirect URLs / Site URL
   - 执行 `supabase db push` 把 `supabase/migrations/0001–0006` 推上云端
5. 跑 Lighthouse：Chrome DevTools → Lighthouse → 四项 ≥ 90 即达标；不达标通常是图片未压缩 / 未启用 CDN，再微调。

---

## 设计原则（PRD §0）

- **生活感而非应用感** —— "走进自己刚收拾过的小厨房"
- **气质锚点**：暖中性（米白/奶白）+ 单一品牌色（鼠尾草绿 `#7A9471`）
- **绝对禁止**：Hero 区塞大眼睛卡通宠物、渐变彩色卡片墙、全圆角大阴影、emoji 代替图标、整屏 toast 庆祝、Lottie 强推、弹性 ease 动效

详细 PRD 在 `docs/PRD_v1.1_UI交互规格.md`；Sprint 计划在 `docs/swift-pulse-newton.md`。
