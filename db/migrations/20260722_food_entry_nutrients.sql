-- Mevcut food_entries kayıtlarını bozmadan ürün arama ayrıntılarını ekler.
alter table public.food_entries add column if not exists fiber_g numeric(7,2) not null default 0 check (fiber_g >= 0);
alter table public.food_entries add column if not exists grams numeric(8,2) check (grams > 0);
alter table public.food_entries add column if not exists micros jsonb not null default '{}'::jsonb;
