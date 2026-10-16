-- Einmal im Supabase-Dashboard unter "SQL Editor" einfügen und auf "Run" klicken.
-- Legt die Tabelle für Feedback an. Jeder angemeldete Benutzer kann Feedback schicken,
-- lesen, als gelesen markieren und löschen kann nur der Administrator (Benutzer Kevspam).

create table if not exists public.golf_feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  username   text,
  msg        text not null check (char_length(msg) between 1 and 2000),
  page       text,
  gelesen    boolean not null default false,
  created_at timestamptz not null default now()
);

-- Administrator: Benutzer "Kevspam" (in der App intern kevspam@golfjournal.app).
create or replace function public.golf_is_admin() returns boolean
  language sql stable
  as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) in ('kevspam@golfjournal.app', 'kevspam@gmx.at') $$;

alter table public.golf_feedback enable row level security;

drop policy if exists "feedback senden"     on public.golf_feedback;
drop policy if exists "feedback lesen"      on public.golf_feedback;
drop policy if exists "feedback markieren"  on public.golf_feedback;
drop policy if exists "feedback loeschen"   on public.golf_feedback;

create policy "feedback senden"    on public.golf_feedback for insert to authenticated with check ((select auth.uid()) = user_id and gelesen = false);
create policy "feedback lesen"     on public.golf_feedback for select to authenticated using ((select public.golf_is_admin()));
create policy "feedback markieren" on public.golf_feedback for update to authenticated using ((select public.golf_is_admin())) with check ((select public.golf_is_admin()));
create policy "feedback loeschen"  on public.golf_feedback for delete to authenticated using ((select public.golf_is_admin()));

grant select, insert, update, delete on public.golf_feedback to authenticated;
revoke all on public.golf_feedback from anon;
