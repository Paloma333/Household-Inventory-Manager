-- 0007_simplify_categories.sql
-- 分类精简（用户验收反馈）：原 7 顶层 + 29 个二级分类太细太多，
-- 收敛为 8 个顶层大类、不再有二级。
--
-- 大类清单（最终态）：
--   食品饮料 / 生鲜果蔬 / 个护美妆 / 家居清洁 / 健康药品 / 衣物配件 / 数码电器 / 其他
--
-- 步骤（幂等）：
--   ① 新增顶层「生鲜果蔬」
--   ② 重命名：个人护理→个护美妆、衣物→衣物配件、家用电器→数码电器
--   ③ remap：items 指向二级分类的 → 水果/蔬菜归「生鲜果蔬」，其余归其父类
--   ④ 删除全部二级 system 分类（items/recognition_items 的 FK 均为 on delete set null）

-- ① 新增顶层「生鲜果蔬」
insert into public.categories (name, is_system, sort_order)
select '生鲜果蔬', true, 2
where not exists (
  select 1 from public.categories
  where name = '生鲜果蔬' and parent_id is null and is_system
);

-- ② 重命名既有顶层（uuid 不变，引用不受影响）
update public.categories set name = '个护美妆', sort_order = 3
where name = '个人护理' and parent_id is null and is_system;

update public.categories set name = '衣物配件', sort_order = 6
where name = '衣物' and parent_id is null and is_system;

update public.categories set name = '数码电器', sort_order = 7
where name = '家用电器' and parent_id is null and is_system;

update public.categories set sort_order = 1
where name = '食品饮料' and parent_id is null and is_system;

update public.categories set sort_order = 4
where name = '家居清洁' and parent_id is null and is_system;

update public.categories set sort_order = 5
where name = '健康药品' and parent_id is null and is_system;

update public.categories set sort_order = 99
where name = '其他' and parent_id is null and is_system;

-- ③ remap items：水果/蔬菜 → 生鲜果蔬
update public.items i
set category_id = (
  select c.category_id from public.categories c
  where c.name = '生鲜果蔬' and c.parent_id is null
  limit 1
)
where i.category_id in (
  select s.category_id from public.categories s
  where s.parent_id is not null and s.name in ('水果', '蔬菜')
);

-- ③ remap items：其余二级分类 → 各自父类（顶层）
update public.items i
set category_id = p.parent_id
from public.categories p
where i.category_id = p.category_id
  and p.parent_id is not null;

-- ④ 删除全部二级 system 分类
delete from public.categories
where parent_id is not null and is_system;

-- ───────── 补充：recognition_items 落全 AI 预测字段 ─────────
-- 之前只存 name/quantity/unit/package_quantity/confidence，
-- 品牌/过期日/分类 hint/易耗品判断没落库，确认页刷新后全丢。
alter table public.recognition_items
  add column if not exists predicted_brand text,
  add column if not exists predicted_expiry_date date,
  add column if not exists category_hint text,
  add column if not exists restock_hint boolean;
