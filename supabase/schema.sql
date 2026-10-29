-- TMBingo CRM: baza, pravila pristupa i spremište datoteka.
-- Pokreni jednom u Supabase → SQL Editor (cijelu datoteku odjednom).

-- ---------------------------------------------------------------------------
-- Profili: jedan red za svakog korisnika koji se prijavljuje (klijent ili admin)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text not null,
  ime         text,
  tvrtka      text,
  is_admin    boolean not null default false,
  aktivan_do  date,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, lower(new.email)) on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select aktivan_do >= current_date from public.profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- Narudžbe paketa i uplate (piše ih samo server, admin ih vidi i mijenja)
-- ---------------------------------------------------------------------------
create table public.narudzbe (
  id          bigint generated always as identity primary key,
  poziv       text unique,
  email       text not null,
  ime         text not null,
  tvrtka      text,
  oib         text,
  adresa      text,
  mjesto      text,
  napomena    text,
  user_id     uuid references public.profiles on delete set null,
  novi        boolean not null default true,
  iznos_centi integer not null default 39900 check (iznos_centi > 0),
  status      text not null default 'ceka_uplatu' check (status in ('ceka_uplatu', 'placeno', 'otkazano')),
  placeno_at  timestamptz,
  created_at  timestamptz not null default now()
);

create or replace function public.narudzba_poziv() returns trigger language plpgsql as $$
begin
  new.poziv := to_char(now(), 'YYYY') || '-' || new.id;
  new.email := lower(new.email);
  return new;
end $$;

create trigger narudzba_poziv before insert on public.narudzbe
  for each row execute function public.narudzba_poziv();

-- ---------------------------------------------------------------------------
-- Zadaci, poruke i prilozi
-- ---------------------------------------------------------------------------
create table public.zadaci (
  id             bigint generated always as identity primary key,
  klijent_id     uuid not null default auth.uid() references public.profiles on delete cascade,
  naslov         text not null check (char_length(naslov) between 1 and 200),
  opis           text not null default '' check (char_length(opis) <= 10000),
  status         text not null default 'novo' check (status in ('novo', 'prihvaceno', 'u_izradi', 'zavrseno')),
  minuta         integer not null default 0 check (minuta >= 0),
  created_at     timestamptz not null default now(),
  prihvaceno_at  timestamptz,
  u_izradi_at    timestamptz,
  zavrseno_at    timestamptz,
  updated_at     timestamptz not null default now()
);
create index zadaci_klijent on public.zadaci (klijent_id, created_at desc);

create or replace function public.zadatak_vremena() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'prihvaceno' and new.prihvaceno_at is null then new.prihvaceno_at := now(); end if;
    if new.status = 'u_izradi' then
      new.prihvaceno_at := coalesce(new.prihvaceno_at, now());
      new.u_izradi_at := coalesce(new.u_izradi_at, now());
    end if;
    if new.status = 'zavrseno' then
      new.prihvaceno_at := coalesce(new.prihvaceno_at, now());
      new.zavrseno_at := now();
    else
      new.zavrseno_at := null;
    end if;
  end if;
  return new;
end $$;

create trigger zadatak_vremena before update on public.zadaci
  for each row execute function public.zadatak_vremena();

create table public.poruke (
  id          bigint generated always as identity primary key,
  zadatak_id  bigint not null references public.zadaci on delete cascade,
  autor_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  tekst       text not null default '' check (char_length(tekst) <= 10000),
  created_at  timestamptz not null default now()
);
create index poruke_zadatak on public.poruke (zadatak_id, created_at);

create table public.prilozi (
  id          bigint generated always as identity primary key,
  zadatak_id  bigint not null references public.zadaci on delete cascade,
  poruka_id   bigint references public.poruke on delete cascade,
  autor_id    uuid not null default auth.uid() references public.profiles on delete cascade,
  vrsta       text not null check (vrsta in ('datoteka', 'link')),
  naziv       text not null check (char_length(naziv) between 1 and 300),
  putanja     text,
  velicina    integer check (velicina between 0 and 10485760),
  url         text check (url ~* '^https://'),
  created_at  timestamptz not null default now(),
  check ((vrsta = 'datoteka' and putanja is not null) or (vrsta = 'link' and url is not null))
);
create index prilozi_zadatak on public.prilozi (zadatak_id);

-- ---------------------------------------------------------------------------
-- Pravila pristupa (RLS): klijent vidi samo svoje, admin vidi sve
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.narudzbe enable row level security;
alter table public.zadaci   enable row level security;
alter table public.poruke   enable row level security;
alter table public.prilozi  enable row level security;

revoke all on public.profiles, public.narudzbe, public.zadaci, public.poruke, public.prilozi from anon;

create policy "profil: svoj ili admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profil: uredi svoj" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- klijent smije mijenjati samo ime i tvrtku, ne is_admin ni aktivan_do
revoke update on public.profiles from authenticated;
grant update (ime, tvrtka) on public.profiles to authenticated;

create policy "narudzbe: svoje ili admin" on public.narudzbe for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or email = lower(auth.jwt() ->> 'email'));
create policy "narudzbe: admin mijenja" on public.narudzbe for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "zadaci: svoji ili admin" on public.zadaci for select to authenticated
  using (klijent_id = auth.uid() or public.is_admin());
create policy "zadaci: klijent s aktivnim paketom dodaje" on public.zadaci for insert to authenticated
  with check (klijent_id = auth.uid() and status = 'novo' and minuta = 0 and public.is_active());
create policy "zadaci: admin mijenja" on public.zadaci for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "zadaci: admin briše" on public.zadaci for delete to authenticated
  using (public.is_admin());

create policy "poruke: uz vidljiv zadatak" on public.poruke for select to authenticated
  using (exists (select 1 from public.zadaci z where z.id = zadatak_id));
create policy "poruke: piši u svoj zadatak" on public.poruke for insert to authenticated
  with check (autor_id = auth.uid() and exists (select 1 from public.zadaci z where z.id = zadatak_id));

create policy "prilozi: uz vidljiv zadatak" on public.prilozi for select to authenticated
  using (exists (select 1 from public.zadaci z where z.id = zadatak_id));
create policy "prilozi: dodaj u svoj zadatak" on public.prilozi for insert to authenticated
  with check (
    autor_id = auth.uid()
    and exists (
      select 1 from public.zadaci z where z.id = zadatak_id
        and (vrsta = 'link' or putanja like z.klijent_id::text || '/' || z.id::text || '/%')
    )
  );

-- ---------------------------------------------------------------------------
-- Spremište datoteka: privatno, najviše 10 MB po datoteci
-- Putanja: <klijent_id>/<zadatak_id>/<naziv>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('prilozi', 'prilozi', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

create policy "prilozi: čitaj svoje ili admin" on storage.objects for select to authenticated
  using (bucket_id = 'prilozi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "prilozi: šalji u svoje ili admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'prilozi' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- Nakon prve prijave postavi sebe za admina (upiši svoj e-mail):
--   update public.profiles set is_admin = true where email = 'tmbingo@gmail.com';
-- ---------------------------------------------------------------------------
