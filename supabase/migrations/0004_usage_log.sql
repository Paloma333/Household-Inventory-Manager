-- 0004_usage_log.sql
-- AI / 配额用量日志：每调用一次 AI 模型记一行
-- 用来做 30 req/day/household + 500K tokens/month 的硬限

create table public.usage_log (
  log_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id),
  household_id uuid not null references public.households(household_id) on delete cascade,
  kind text not null,                       -- 'recognition' / 'chat' / 'correction'
  tokens_used int not null default 0,       -- 本次调用消耗的 token（input + output）
  status text not null,                     -- 'success' / 'failed' / 'blocked_quota' / 'mock'
  metadata jsonb default '{}'::jsonb,       -- { recognition_id, model, duration_ms, error_code, source_type }
  called_at timestamptz not null default now()
);

comment on table public.usage_log is
  'AI 调用用量日志。每成功/失败一次 AI 调用就写一行，供每日/月配额统计。service_role 写入；普通用户只能读自己的 household。';

-- 配额统计走这两个索引：按家庭按日 / 按家庭按月
create index usage_log_household_called_at_idx
  on public.usage_log(household_id, called_at desc);

create index usage_log_user_called_at_idx
  on public.usage_log(user_id, called_at desc);

create index usage_log_kind_idx
  on public.usage_log(kind);

-- ───────── RLS ─────────
alter table public.usage_log enable row level security;

-- 同家庭可读自家用量（前端"我的用量"页用）
create policy "usage_log: 同家庭可读"
  on public.usage_log for select
  using (household_id = public.current_household_id());

-- 写权限：service_role 直接绕过；anon/auth 不允许
-- 不给 INSERT/UPDATE/DELETE policy，意味着普通用户写不进来，安全
-- 配额触发器想在前端拦截的话也只能读 → 由后端 service_role 代写

-- ───────── 配额判定的视图 ─────────
-- 每日调用次数（一个家庭）
create or replace view public.v_usage_daily as
select
  household_id,
  date_trunc('day', called_at at time zone 'Asia/Shanghai') as day,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'blocked_quota') as blocked_count,
  coalesce(sum(tokens_used) filter (where status = 'success'), 0)::int as tokens_used
from public.usage_log
where kind = 'recognition'
group by household_id, date_trunc('day', called_at at time zone 'Asia/Shanghai');

comment on view public.v_usage_daily is
  '按家庭按日聚合的 AI 调用次数。配额限制：30 次/家/日（可调）。';

-- 每月 token 消耗
create or replace view public.v_usage_monthly as
select
  household_id,
  date_trunc('month', called_at at time zone 'Asia/Shanghai') as month,
  coalesce(sum(tokens_used) filter (where status = 'success'), 0)::int as tokens_used,
  count(*) filter (where status = 'success') as success_count
from public.usage_log
where kind = 'recognition'
group by household_id, date_trunc('month', called_at at time zone 'Asia/Shanghai');

comment on view public.v_usage_monthly is
  '按家庭按月聚合的 token 消耗。配额限制：500K tokens/家/月（可调）。';
