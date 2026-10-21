-- Einmal im Supabase-Dashboard unter "SQL Editor" einfügen und auf "Run" klicken.
-- Trainer-Freigabe: Ein Spieler gibt seine Trainingsdaten für einen Trainer (Benutzername) frei.
-- Der Trainer kann sie nur lesen, das Trainingstagebuch bleibt privat. Der Spieler kann die Freigabe jederzeit entfernen.

create table if not exists public.golf_coach (
  player_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  player_name text,
  coach_email text not null check (coach_email = lower(coach_email) and char_length(coach_email) between 3 and 120),
  created_at  timestamptz not null default now(),
  primary key (player_id, coach_email)
);

alter table public.golf_coach enable row level security;

drop policy if exists "freigabe anlegen"   on public.golf_coach;
drop policy if exists "freigabe sehen"     on public.golf_coach;
drop policy if exists "freigabe entfernen" on public.golf_coach;

create policy "freigabe anlegen"   on public.golf_coach for insert to authenticated with check ((select auth.uid()) = player_id);
create policy "freigabe sehen"     on public.golf_coach for select to authenticated using ((select auth.uid()) = player_id or coach_email = lower(coalesce((select auth.jwt()) ->> 'email', '')));
create policy "freigabe entfernen" on public.golf_coach for delete to authenticated using ((select auth.uid()) = player_id or coach_email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

grant select, insert, delete on public.golf_coach to authenticated;
revoke all on public.golf_coach from anon;

-- Liefert dem Trainer die Daten eines Spielers, der ihn freigegeben hat (ohne Tagebuch). Sonst kommt nichts zurück.
create or replace function public.golf_coach_data(p uuid) returns table (data jsonb, t bigint)
  language sql stable security definer set search_path = public
  as $$
    select g.data - 'j', g.t from public.golflog g
    where g.user_id = p
      and exists (select 1 from public.golf_coach c
                  where c.player_id = p and c.coach_email = lower(coalesce(auth.jwt() ->> 'email', '')))
  $$;

revoke all on function public.golf_coach_data(uuid) from public, anon;
grant execute on function public.golf_coach_data(uuid) to authenticated;
