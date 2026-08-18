-- 0006_drafts_feedback.sql
-- Sprint 4 数据闭环：AI 确认页「暂存草稿」 + 反馈表

-- ============ recognition_tasks 加草稿字段 ============
-- 草稿语义：用户点了「暂存」，把确认页当前编辑状态存进 draft_json
-- （包含每个 recognition_item 的 final_* 字段 + action + duplicate 状态），
-- 恢复时前端直接用它初始化确认页。task.status 新增 'draft' 值（text 列无需改约束）。
alter table public.recognition_tasks
  add column if not exists draft_json jsonb default null,
  add column if not exists saved_at timestamptz default null;

comment on column public.recognition_tasks.draft_json is
  'Sprint 4 草稿：确认页暂存的编辑状态快照（{ decisions: [...] }）。';
comment on column public.recognition_tasks.saved_at is
  '草稿最后保存时间；null 表示从未暂存。';

-- ============ feedback（反馈） ============
create table if not exists public.feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete set null,
  household_id uuid references public.households(household_id) on delete set null,
  content text not null,
  contact text,
  source text not null default 'web',
  status text not null default 'new',               -- new / read / done
  created_at timestamptz not null default now()
);

create index if not exists feedback_household_idx on public.feedback(household_id);

alter table public.feedback enable row level security;

create policy "feedback: 同家庭可读"
  on public.feedback for select
  using (household_id = public.current_household_id());

create policy "feedback: 本人可提交"
  on public.feedback for insert
  with check (user_id = auth.uid());
