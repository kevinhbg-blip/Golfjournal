-- Einmal im Supabase-Dashboard unter "SQL Editor" einfügen und auf "Run" klicken.
-- Legt die Tabelle für die Trainingsdaten an. Jeder Benutzer sieht und ändert nur seine eigene Zeile.

create table if not exists public.golflog (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb  not null,
  t          bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.golflog enable row level security;

drop policy if exists "eigene Daten lesen"   on public.golflog;
drop policy if exists "eigene Daten anlegen" on public.golflog;
drop policy if exists "eigene Daten aendern" on public.golflog;

create policy "eigene Daten lesen"   on public.golflog for select to authenticated using ((select auth.uid()) = user_id);
create policy "eigene Daten anlegen" on public.golflog for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "eigene Daten aendern" on public.golflog for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update on public.golflog to authenticated;
revoke all on public.golflog from anon;
