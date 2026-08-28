-- 0008_storage_location.sql
-- 为物品增加「我在哪」存放位置字段（非必填）

alter table public.items
  add column if not exists storage_location text;

comment on column public.items.storage_location is
  '物品存放位置，如「厨房左侧橱柜」，用户手动填写，非必填。';
