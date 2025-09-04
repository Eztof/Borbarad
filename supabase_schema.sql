-- Tabellen
create table if not exists public.heroes (
id uuid primary key default gen_random_uuid(),
created_at timestamp with time zone default now(),
user_id uuid references auth.users(id) on delete set null,
name text not null,
species text,
profession text,
notes text
);


create table if not exists public.nscs (
id uuid primary key default gen_random_uuid(),
created_at timestamp with time zone default now(),
user_id uuid references auth.users(id) on delete set null,
name text not null,
tags text,
image_url text,
biography text,
first_encounter jsonb, -- {year,month,day}
last_encounter jsonb,
whereabouts text
);


create table if not exists public.objects (
id uuid primary key default gen_random_uuid(),
created_at timestamp with time zone default now(),
user_id uuid references auth.users(id) on delete set null,
name text not null,
tags text,
image_url text,
description text,
first_seen jsonb,
last_seen jsonb,
location text
);


create table if not exists public.events (
id uuid primary key default gen_random_uuid(),
created_at timestamp with time zone default now(),
user_id uuid references auth.users(id) on delete set null,
type text check (type in ('nsc_encounter','object_found','story','travel')) default 'story',
title text not null,
description text,
av_date jsonb not null, -- {year,month,day}
av_date_end jsonb,
related_nsc_id uuid references public.nscs(id) on delete set null,
related_object_id uuid references public.objects(id) on delete set null,
related_hero_id uuid references public.heroes(id) on delete set null,
location text
);


-- RLS aktivieren
alter table public.heroes enable row level security;
alter table public.nscs enable row level security;
alter table public.objects enable row level security;
alter table public.events enable row level security;


-- Sehr einfache Policies: alle angemeldeten Benutzer können alles sehen/bearbeiten.
-- (Für eure Gruppe ok; später feinere Rechte hinzufügen.)
create policy heroes_select on public.heroes for select to authenticated using (true);
create policy heroes_insert on public.heroes for insert to authenticated with check (true);
create policy heroes_update on public.heroes for update to authenticated using (true);
create policy heroes_delete on public.heroes for delete to authenticated using (true);


create policy nscs_select on public.nscs for select to authenticated using (true);
create policy nscs_insert on public.nscs for insert to authenticated with check (true);
create policy nscs_update on public.nscs for update to authenticated using (true);
create policy nscs_delete on public.nscs for delete to authenticated using (true);


create policy objects_select on public.objects for select to authenticated using (true);
create policy objects_insert on public.objects for insert to authenticated with check (true);
-- create policy images_delete on storage.objects for delete to authenticated using (bucket_id = 'images');