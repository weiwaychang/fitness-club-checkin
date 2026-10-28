-- 每個場次可填「本次主題」（例如每週瑜伽的當週課程重點）
alter table sessions add column if not exists topic text not null default '';
