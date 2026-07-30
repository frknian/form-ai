-- Hedefit ücretsiz/Premium kullanım planı.
-- AI koçu, fotoğraf analizi ve yazarak besin tahmini birbirinden bağımsız
-- sayaçlarla izlenir. Fiyatlar mağaza tarafında yönetilir: ₺89/ay, ₺799/yıl.

alter table public.usage_counters
  drop constraint if exists usage_counters_feature_check;

alter table public.usage_counters
  add constraint usage_counters_feature_check
  check (feature in ('chat', 'photo', 'text_nutrition'));

create or replace function public.increment_usage_counter(p_feature text, p_limit integer)
returns table (allowed boolean, current_count integer)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_feature not in ('chat', 'photo', 'text_nutrition') then
    raise exception 'invalid feature';
  end if;

  insert into public.usage_counters (user_id, feature, usage_date, count)
  values (v_user, p_feature, current_date, 0)
  on conflict (user_id, feature, usage_date) do nothing;

  select uc.count into v_count
  from public.usage_counters uc
  where uc.user_id = v_user
    and uc.feature = p_feature
    and uc.usage_date = current_date
  for update;

  if v_count >= p_limit then
    return query select false, v_count;
  end if;

  update public.usage_counters uc
  set count = uc.count + 1, updated_at = now()
  where uc.user_id = v_user
    and uc.feature = p_feature
    and uc.usage_date = current_date;

  return query select true, v_count + 1;
end;
$$;

grant execute on function public.increment_usage_counter(text, integer) to authenticated;
