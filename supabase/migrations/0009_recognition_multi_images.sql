-- 0009: 多图识别支持
-- recognition_tasks 新增 image_paths（jsonb 数组）存整批图片的 storage path；
-- image_url 保留为首图（兼容旧数据/旧代码），新批次两个字段都写。

alter table public.recognition_tasks
  add column if not exists image_paths jsonb;

comment on column public.recognition_tasks.image_paths is
  '多图批次的全部 storage path 数组；单图批次也写（长度 1）。image_url 仍为首图，向后兼容';
