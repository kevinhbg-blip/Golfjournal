-- Einmal im Supabase-Dashboard unter "SQL Editor" einfügen und auf "Run" klicken.
-- Kalender-Sync mit dem iPhone: je Benutzer ein geheimer Abo-Schlüssel (token) für den Kalender-Feed der App
-- und optional der Link eines öffentlichen iCloud-Kalenders (src), dessen Termine die App anzeigt.
-- Gelesen wird beides von der Edge Function "golf-kalender" (supabase/functions/golf-kalender/index.ts).

create table if not exists public.golf_cal (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token      text not null unique check (token ~ '^[a-f0-9]{32,64}$'),
  src        text check (src is null or char_length(src) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.golf_cal enable row level security;

drop policy if exists "eigenen Kalender lesen"    on public.golf_cal;
drop policy if exists "eigenen Kalender anlegen"  on public.golf_cal;
drop policy if exists "eigenen Kalender aendern"  on public.golf_cal;
drop policy if exists "eigenen Kalender loeschen" on public.golf_cal;

create policy "eigenen Kalender lesen"    on public.golf_cal for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigenen Kalender anlegen"  on public.golf_cal for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigenen Kalender aendern"  on public.golf_cal for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "eigenen Kalender loeschen" on public.golf_cal for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.golf_cal to authenticated;
revoke all on public.golf_cal from anon;
