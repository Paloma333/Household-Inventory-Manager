-- 0001_init_schema.sql
-- 来源：PRD v1.0 §10 数据库设计 + v1.1 增量字段
-- 全部 multi-tenant 表都带 household_id；RLS 在 0002 处理
-- 用 uuid 作主键，便于分布式 / Supabase Realtime 订阅

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm;

-- ───────── users（与 auth.users 镜像，仅做应用层关联） ─────────
-- Supabase Auth 已经管 auth.users；这表存应用层 user 信息
create table public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id text not null unique,                       -- 自有账号标识 / 微信 openid
  platform text not null default 'web',                 -- 'web' / 'ios' / 'android' / 'wechat'
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

comment on table public.users is
  '应用层用户档案；auth.users 由 Supabase Auth 托管。Sprint 0 仅邮箱密码。';

-- ───────── households ─────────
create table public.households (
  household_id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(user_id) on delete cascade,
  name text not null default '我的小家',
  timezone text not null default 'GMT+8',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is
  '家庭/小家 — MVP 单人单家庭。多家庭协作是 V2。';

-- ───────── categories（树形） ─────────
create table public.categories (
  category_id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(category_id) on delete cascade,
  name text not null,                                   -- '食品饮料' / '纸品'...
  -- 顶层分类预设；用户自建分类加 user_id / household_id 控制
  is_system boolean not null default false,
  household_id uuid references public.households(household_id) on delete cascade,
  sort_order int not null default 0
);

create index categories_household_idx on public.categories(household_id);
create unique index categories_name_unique
  on public.categories(coalesce(household_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

comment on table public.categories is
  '分类树。一级分类是 system 级；二级可用户自定义。';

-- ───────── items（当前库存快照） ─────────
create table public.items (
  item_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  canonical_name text not null,                         -- 标准化商品名
  raw_name text,                                        -- 原始识别名（AI 入库时）
  brand text,
  category_id uuid references public.categories(category_id) on delete set null,
  quantity numeric(10, 2) not null default 0,            -- 当前库存（支持小数：0.5 支牙膏）
  unit text,                                            -- 包 / 提 / 盒 / 件 / 瓶 ...
  package_quantity numeric(10, 2),                      -- 包装内数量：1 提 = 6 包
  expiry_date date,                                     -- 保质期（可选）
  deleted_at timestamptz,                               -- 软删（Sprint 4 回收站用）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_household_idx on public.items(household_id);
create index items_category_idx on public.items(category_id);
create index items_name_trgm on public.items using gin (canonical_name gin_trgm_ops);
-- 模糊搜索用 trigram

comment on table public.items is
  '当前库存 SKU 快照。所有数量变化必须通过 inventory_events 写入，items.quantity 是冗余快照。';

-- ───────── inventory_events（库存变化流水） ─────────
create table public.inventory_events (
  event_id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(item_id) on delete cascade,
  user_id uuid not null references public.users(user_id),
  household_id uuid not null references public.households(household_id) on delete cascade,
  event_type text not null,                             -- 'purchase'/'consume'/'adjust'/'merge'/'restock_confirm'
  quantity_change numeric(10, 2) not null,
  previous_quantity numeric(10, 2) not null,
  new_quantity numeric(10, 2) not null,
  source text not null,                                 -- 'manual'/'ai_receipt'/'ai_screenshot'/'ai_camera'/'restock'
  related_event_id uuid references public.inventory_events(event_id), -- 重复购买时把归零 / 加购两条事件绑起来
  metadata jsonb default '{}'::jsonb,                   -- 来源小票 id、duplicate_status 等
  created_at timestamptz not null default now()
);

create index inventory_events_item_idx on public.inventory_events(item_id);
create index inventory_events_household_idx on public.inventory_events(household_id);
create index inventory_events_user_idx on public.inventory_events(user_id);

comment on table public.inventory_events is
  '库存变化流水。任何 +/- / 删除 / 合并都写一条；PRD §11.1';

-- ───────── low_stock_rules ─────────
create table public.low_stock_rules (
  item_id uuid primary key references public.items(item_id) on delete cascade,
  threshold numeric(10, 2) not null,
  enabled boolean not null default true
);

-- ───────── product_aliases（用户自家商品词典） ─────────
create table public.product_aliases (
  alias_id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(household_id) on delete cascade,
  alias text not null,                                  -- "抽纸" / "厨房纸"
  canonical_item_id uuid not null references public.items(item_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index product_aliases_household_idx on public.product_aliases(household_id);

-- ───────── recognition_tasks（AI 识别任务） ─────────
create table public.recognition_tasks (
  recognition_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id),
  household_id uuid not null references public.households(household_id) on delete cascade,
  source_type text not null,                            -- 'receipt' / 'screenshot' / 'camera'
  image_url text,                                       -- Supabase Storage 短期签名 URL
  status text not null default 'pending',               -- pending / processing / succeeded / failed / timeout
  model text,                                           -- 'qwen-vl-plus' / 'glm-4v'
  processing_time_ms int,
  error_message text,
  created_at timestamptz not null default now()
);

create index recognition_tasks_household_idx on public.recognition_tasks(household_id);

-- ───────── recognition_items（AI 预测 vs 最终结果） ─────────
create table public.recognition_items (
  recognition_item_id uuid primary key default gen_random_uuid(),
  recognition_id uuid not null references public.recognition_tasks(recognition_id) on delete cascade,
  raw_name text,
  predicted_name text,
  predicted_quantity numeric(10, 2),
  predicted_unit text,
  predicted_package_quantity numeric(10, 2),
  confidence_json jsonb default '{}'::jsonb,            -- { name: 0.96, quantity: 0.58, category: 0.94 }
  final_name text,
  final_quantity numeric(10, 2),
  final_unit text,
  final_category_id uuid references public.categories(category_id) on delete set null,
  final_package_quantity numeric(10, 2),
  corrected boolean not null default false,
  created_at timestamptz not null default now()
);

create index recognition_items_recognition_idx on public.recognition_items(recognition_id);

-- ───────── events（产品埋点，对齐 PRD v1.0 §12） ─────────
create table public.events (
  event_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(user_id) on delete set null,
  household_id uuid references public.households(household_id) on delete cascade,
  session_id text,
  event_name text not null,                             -- 'app_open'/'item_created'/'recognition_started'...
  properties jsonb default '{}'::jsonb,
  client_ts timestamptz,                                -- 客户端时间
  server_ts timestamptz not null default now()
);

create index events_household_idx on public.events(household_id);
create index events_name_idx on public.events(event_name);
create index events_server_ts_idx on public.events(server_ts desc);

-- ───────── updated_at 触发器 ─────────
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger households_touch
  before update on public.households
  for each row execute function public.touch_updated_at();

create trigger items_touch
  before update on public.items
  for each row execute function public.touch_updated_at();
