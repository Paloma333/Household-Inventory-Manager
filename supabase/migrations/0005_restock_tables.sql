-- 0005_restock_tables.sql
-- 补货清单 + 分享 — Sprint 3
-- 来源：PRD v1.0 §3.7 补货清单
--
-- 表设计：
--   restock_lists  — 一份补货清单（"这周要买什么"）
--   restock_items  — 一条购物项（可以关联库存 SKU，也可以是临时加的）
--
-- 状态机：active → completed（checkout 触发） / archived（手动删）
--
-- 分享：share_token 是 nanoid12 base58；公开访问走 /api/r/share/[token]，
--       那条路由用 service_role 取数据后过滤 status='active' 再返回。
--       RLS 不需要"anon 走 share_token 读"的策略 — 安全更可控。

-- ───────── restock_lists ─────────
create table public.restock_lists (
  list_id        uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(household_id) on delete cascade,
  created_by     uuid not null references public.users(user_id),
  name           text not null default '购物清单',
  status         text not null default 'active',          -- 'active' / 'completed' / 'archived'
  share_token    text unique,                              -- nanoid 12；生成后才填
  share_enabled  boolean not null default false,           -- 用户可以一键撤销分享（轮换 token）
  -- checkout 快照：完成时记录，便于审计/回看
  completed_at   timestamptz,
  completed_by   uuid references public.users(user_id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.restock_lists is
  '补货清单 — 一个家庭可以有多份并行（"这周"、"周末大采购"）。Sprint 3 单人单家庭，最常见是一份。';

create index restock_lists_household_idx
  on public.restock_lists(household_id);

create index restock_lists_share_token_idx
  on public.restock_lists(share_token)
  where share_token is not null;

create index restock_lists_status_idx
  on public.restock_lists(household_id, status, updated_at desc);

-- ───────── restock_items ─────────
create table public.restock_items (
  id              uuid primary key default gen_random_uuid(),
  list_id         uuid not null references public.restock_lists(list_id) on delete cascade,
  -- 关联库存 SKU（二选一：item_id 或 custom_name）
  item_id         uuid references public.items(item_id) on delete set null,
  -- 临时添加：用户自己敲的名字
  custom_name     text,
  -- 拍快照：就算 item 被删 / 改名，清单里还能看
  snapshot_name   text not null,
  snapshot_brand  text,
  snapshot_unit   text,
  needed_qty      numeric(10, 2) not null default 1,
  bought          boolean not null default false,
  checked_at      timestamptz,
  checked_by      uuid references public.users(user_id),
  sort_order      int not null default 0,
  added_by        uuid not null references public.users(user_id),
  created_at      timestamptz not null default now()
);

-- 必须有 name 来源：要么选了库存，要么手输
alter table public.restock_items
  add constraint restock_items_name_source_required
  check (item_id is not null or custom_name is not null);

comment on table public.restock_items is
  '补货清单的条目。snapshot_* 字段冗余存储 item 当时的名字/品牌/单位，避免 item 改名/删除后清单显示错乱。';

create index restock_items_list_idx
  on public.restock_items(list_id, sort_order);

create index restock_items_item_idx
  on public.restock_items(item_id);

-- ───────── updated_at 触发器 ─────────
create trigger restock_lists_touch
  before update on public.restock_lists
  for each row execute function public.touch_updated_at();

-- ───────── RLS ─────────
alter table public.restock_lists enable row level security;
alter table public.restock_items   enable row level security;

-- restock_lists：自家成员读写
create policy "restock_lists: 同家庭可读"
  on public.restock_lists for select
  using (household_id = public.current_household_id());

create policy "restock_lists: 同家庭可写"
  on public.restock_lists for all
  using (household_id = public.current_household_id())
  with check (
    household_id = public.current_household_id()
    and created_by = auth.uid()
  );

-- restock_items：通过 list_id 隔离
create policy "restock_items: 通过清单隔离"
  on public.restock_items for all
  using (
    exists (
      select 1 from public.restock_lists l
      where l.list_id = restock_items.list_id
        and l.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.restock_lists l
      where l.list_id = restock_items.list_id
        and l.household_id = public.current_household_id()
    )
    and added_by = auth.uid()
  );

-- 公开读 share_token：故意不加 RLS policy
-- 公开读走 /api/r/share/[token]，那条路由用 service_role 取数据，
-- 由 service 代码自己校验 status='active' + share_enabled=true。
-- 这样撤销分享只需要 share_enabled=false，service_role 拿到的数据就被前端按 404 处理。
