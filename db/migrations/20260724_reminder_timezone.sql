-- Konum bazlı saat dilimi: reminder_preferences.timezone artık yalnızca
-- Europe/Istanbul ile sınırlı değil, kullanıcının cihazından algılanan
-- herhangi bir geçerli IANA saat dilimini kabul eder. Geçersiz/boş değer
-- user_streaks ile aynı savunma deseniyle (pg_timezone_names doğrulaması)
-- sessizce UTC'ye düşer; bu bir CHECK kısıtı yerine tetikleyici (trigger)
-- ile yapılır çünkü pg_timezone_names sorgusu IMMUTABLE değildir.

alter table public.reminder_preferences drop constraint if exists reminder_preferences_timezone_check;
alter table public.reminder_preferences alter column timezone set default 'UTC';

create or replace function public.normalize_reminder_timezone()
returns trigger language plpgsql as $$
begin
  if new.timezone is null or trim(new.timezone) = '' or not exists (select 1 from pg_timezone_names where name = new.timezone) then
    new.timezone := 'UTC';
  end if;
  return new;
end $$;

drop trigger if exists reminder_preferences_normalize_timezone on public.reminder_preferences;
create trigger reminder_preferences_normalize_timezone
  before insert or update on public.reminder_preferences
  for each row execute function public.normalize_reminder_timezone();
