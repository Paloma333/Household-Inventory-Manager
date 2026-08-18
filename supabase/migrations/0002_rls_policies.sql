-- 0002_rls_policies.sql
-- 全部多租户表按 household_id 隔离；
-- service_role 才能写跨家庭数据；普通用户通过 auth.uid() 取自己的 household_id

-- ============ 工具 helper：取当前用户的主家庭 id ============
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
  from public.households
  where owner_id = auth.uid()
  order by created_at asc
  limit 1
$$;

comment on function public.current_household_id() is
  'MVP 阶段一个用户一个家庭；返回当前 auth.uid() 的主 household_id。';

-- ============ users ============
alter table public.users enable row level security;

create policy "users: 自己读自己"
  on public.users for select
  using (user_id = auth.uid());

create policy "users: 自己更新自己"
  on public.users for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- insert 由 service_role 完成（sign-up 流程在服务端 route 里）

-- ============ households ============
alter table public.households enable row level security;

create policy "households: 业主读写"
  on public.households for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============ categories ============
alter table public.categories enable row level security;

-- 系统预设分类：所有人都能读
create policy "categories: 系统分类公开可读"
  on public.categories for select
  using (is_system = true);

-- 用户自定义：household 内可读
create policy "categories: 同家庭可读自家分类"
  on public.categories for select
  using (household_id = public.current_household_id());

create policy "categories: 同家庭可写自家分类"
  on public.categories for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ============ items ============
alter table public.items enable row level security;

create policy "items: 同家庭可读"
  on public.items for select
  using (household_id = public.current_household_id());

create policy "items: 同家庭可写入"
  on public.items for insert
  with check (household_id = public.current_household_id());

create policy "items: 同家庭可改"
  on public.items for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "items: 同家庭可删"
  on public.items for delete
  using (household_id = public.current_household_id());

-- ============ inventory_events ============
alter table public.inventory_events enable row level security;

create policy "inventory_events: 同家庭可读"
  on public.inventory_events for select
  using (household_id = public.current_household_id());

create policy "inventory_events: 自己可写"
  on public.inventory_events for insert
  with check (
    user_id = auth.uid()
    and household_id = public.current_household_id()
  );

-- update / delete 一般不允许；Sprint 4 回收站再做软删兼容

-- ============ low_stock_rules ============
alter table public.low_stock_rules enable row level security;

create policy "low_stock_rules: 通过 items 隔离"
  on public.low_stock_rules for all
  using (
    exists (
      select 1 from public.items i
      where i.item_id = low_stock_rules.item_id
        and i.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.items i
      where i.item_id = low_stock_rules.item_id
        and i.household_id = public.current_household_id()
    )
  );

-- ============ product_aliases ============
alter table public.product_aliases enable row level security;

create policy "product_aliases: 同家庭可读"
  on public.product_aliases for select
  using (household_id = public.current_household_id());

create policy "product_aliases: 同家庭可写"
  on public.product_aliases for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ============ recognition_tasks / recognition_items ============
alter table public.recognition_tasks enable row level security;
alter table public.recognition_items enable row level security;

create policy "recognition_tasks: 同家庭可读"
  on public.recognition_tasks for select
  using (household_id = public.current_household_id());

create policy "recognition_tasks: 自己可写"
  on public.recognition_tasks for insert
  with check (
    user_id = auth.uid()
    and household_id = public.current_household_id()
  );

create policy "recognition_items: 通过任务隔离"
  on public.recognition_items for all
  using (
    exists (
      select 1 from public.recognition_tasks t
      where t.recognition_id = recognition_items.recognition_id
        and t.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.recognition_tasks t
      where t.recognition_id = recognition_items.recognition_id
        and t.household_id = public.current_household_id()
    )
  );

-- ============ events（埋点） ============
alter table public.events enable row level security;

-- 允许任何人写自己的 event（前端 SDK 会带 user_id / session_id）
create policy "events: 自己写 / 同家庭读"
  on public.events for insert
  with check (user_id = auth.uid());

create policy "events: 同家庭可读（BI 看板用）"
  on public.events for select
  using (household_id = public.current_household_id());

-- 注意：BI 看板如果要查"自家全部 user"的事件，可改用 service_role
