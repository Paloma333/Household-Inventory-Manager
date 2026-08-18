-- 0003_seed_categories.sql
-- PRD v1.0 §8 商品分类 + PRD v1.1 §1.1.2 分类专属色
-- 顶层分类是 system 级（is_system = true），household_id = null
-- 二级分类也是 system 级，方便所有用户初始就有建议

insert into public.categories (name, is_system, sort_order) values
  ('食品饮料', true, 1),
  ('家居清洁', true, 2),
  ('个人护理', true, 3),
  ('健康药品', true, 4),
  ('衣物',     true, 5),
  ('家用电器', true, 6),
  ('其他',     true, 99);

-- ───── 食品饮料 ─────
insert into public.categories (name, parent_id, is_system, sort_order)
select x.name, p.category_id, true, x.ord
from (values
  ('水果',     1),
  ('蔬菜',     2),
  ('肉蛋',     3),
  ('奶制品',   4),
  ('饮料',     5),
  ('零食',     6),
  ('主食',     7),
  ('调味品',   8),
  ('速食',     9)
) as x(name, ord), public.categories p
where p.name = '食品饮料' and p.parent_id is null
on conflict do nothing;

-- ───── 家居清洁 ─────
insert into public.categories (name, parent_id, is_system, sort_order)
select x.name, p.category_id, true, x.ord
from (values
  ('纸品',     1),
  ('洗衣',     2),
  ('清洁用品', 3),
  ('厨房用品', 4),
  ('垃圾处理', 5)
) as x(name, ord), public.categories p
where p.name = '家居清洁' and p.parent_id is null
on conflict do nothing;

-- ───── 个人护理 ─────
insert into public.categories (name, parent_id, is_system, sort_order)
select x.name, p.category_id, true, x.ord
from (values
  ('洗护',     1),
  ('口腔护理', 2),
  ('女性护理', 3),
  ('护肤',     4)
) as x(name, ord), public.categories p
where p.name = '个人护理' and p.parent_id is null
on conflict do nothing;

-- ───── 健康药品 ─────
insert into public.categories (name, parent_id, is_system, sort_order)
select x.name, p.category_id, true, x.ord
from (values
  ('常用药',         1),
  ('保健/护理用品',  2)
) as x(name, ord), public.categories p
where p.name = '健康药品' and p.parent_id is null
on conflict do nothing;

-- ───── 衣物 ─────
insert into public.categories (name, parent_id, is_system, sort_order)
select x.name, p.category_id, true, x.ord
from (values
  ('上衣', 1),
  ('下装', 2),
  ('内衣', 3),
  ('鞋包', 4),
  ('其他', 5)
) as x(name, ord), public.categories p
where p.name = '衣物' and p.parent_id is null
on conflict do nothing;

-- ───── 家用电器 ─────
insert into public.categories (name, parent_id, is_system, sort_order)
select x.name, p.category_id, true, x.ord
from (values
  ('厨房电器',     1),
  ('清洁电器',     2),
  ('数码小电器',   3),
  ('其他',         4)
) as x(name, ord), public.categories p
where p.name = '家用电器' and p.parent_id is null
on conflict do nothing;
