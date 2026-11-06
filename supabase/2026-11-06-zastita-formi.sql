-- Zaštita formi i Bingo chata (6. 11. 2026.). Pokreni jednom u Supabase → SQL Editor.
-- Isto je dodano na kraj schema.sql.
-- Zaštita javnih formi i Bingo chata: brojač zahtjeva po ključu (IP, e-mail, cijela stranica).
-- Piše i čita ga samo server (servisni ključ), preko funkcije ogranici().
-- ---------------------------------------------------------------------------
create table public.ogranicenja (
  kljuc  text not null,
  at     timestamptz not null default now()
);
create index ogranicenja_kljuc on public.ogranicenja (kljuc, at desc);
create index ogranicenja_at on public.ogranicenja (at);
alter table public.ogranicenja enable row level security;
revoke all on public.ogranicenja from public, anon, authenticated;

-- Vraća true i zabilježi zahtjev ako ih za taj ključ u zadnjih p_sekundi ima manje od p_max, inače false.
create or replace function public.ogranici(p_kljuc text, p_max integer, p_sekundi integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_kljuc));
  select count(*) into n from public.ogranicenja
    where kljuc = p_kljuc and at > now() - make_interval(secs => p_sekundi);
  if n >= p_max then return false; end if;
  insert into public.ogranicenja (kljuc) values (p_kljuc);
  if random() < 0.02 then delete from public.ogranicenja where at < now() - interval '2 days'; end if;
  return true;
end $$;
revoke execute on function public.ogranici(text, integer, integer) from public, anon, authenticated;
grant execute on function public.ogranici(text, integer, integer) to service_role;

-- Prijavljeni korisnici ne trebaju prava za pražnjenje tablica ni okidače (RLS ih ionako ne pokriva)
revoke truncate, references, trigger on public.profiles, public.narudzbe, public.zadaci, public.poruke,
  public.prilozi, public.procitano, public.postavke from authenticated;
