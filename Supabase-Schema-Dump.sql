-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.app_settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);
CREATE TABLE public.diary (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  user_id uuid,
  author_name text,
  title text NOT NULL,
  body_html text NOT NULL,
  av_date jsonb NOT NULL,
  tags text,
  signature text,
  CONSTRAINT diary_pkey PRIMARY KEY (id),
  CONSTRAINT diary_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  type text DEFAULT 'story'::text CHECK (type = ANY (ARRAY['nsc_encounter'::text, 'object_found'::text, 'story'::text, 'travel'::text])),
  title text NOT NULL,
  description text,
  av_date jsonb NOT NULL,
  av_date_end jsonb,
  related_nsc_id uuid,
  related_object_id uuid,
  related_hero_id uuid,
  location text,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_related_nsc_id_fkey FOREIGN KEY (related_nsc_id) REFERENCES public.nscs(id),
  CONSTRAINT events_related_object_id_fkey FOREIGN KEY (related_object_id) REFERENCES public.objects(id),
  CONSTRAINT events_related_hero_id_fkey FOREIGN KEY (related_hero_id) REFERENCES public.heroes(id),
  CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.heroes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  name text NOT NULL,
  species text,
  profession text,
  notes text,
  ap_total integer DEFAULT 0,
  lp_current integer DEFAULT 30,
  lp_max integer DEFAULT 30,
  purse_dukaten integer DEFAULT 0,
  purse_silbertaler integer DEFAULT 0,
  purse_heller integer DEFAULT 0,
  purse_kreuzer integer DEFAULT 0,
  CONSTRAINT heroes_pkey PRIMARY KEY (id),
  CONSTRAINT heroes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.nscs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  name text NOT NULL,
  tags text,
  image_url text,
  biography text,
  first_encounter jsonb,
  last_encounter jsonb,
  whereabouts text,
  is_active boolean DEFAULT true,
  CONSTRAINT nscs_pkey PRIMARY KEY (id),
  CONSTRAINT nscs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.nscs_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  nsc_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['insert'::text, 'update'::text])),
  changed_by uuid,
  changed_by_name text,
  data jsonb NOT NULL,
  CONSTRAINT nscs_history_pkey PRIMARY KEY (id),
  CONSTRAINT nscs_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  CONSTRAINT nscs_history_nsc_id_fkey FOREIGN KEY (nsc_id) REFERENCES public.nscs(id)
);
CREATE TABLE public.objects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  name text NOT NULL,
  tags text,
  image_url text,
  description text,
  first_seen jsonb,
  last_seen jsonb,
  location text,
  is_active boolean DEFAULT true,
  CONSTRAINT objects_pkey PRIMARY KEY (id),
  CONSTRAINT objects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.objects_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  object_id uuid NOT NULL,
  action text NOT NULL CHECK (action = ANY (ARRAY['insert'::text, 'update'::text])),
  changed_by uuid,
  changed_by_name text,
  data jsonb NOT NULL,
  CONSTRAINT objects_history_pkey PRIMARY KEY (id),
  CONSTRAINT objects_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id),
  CONSTRAINT objects_history_object_id_fkey FOREIGN KEY (object_id) REFERENCES public.objects(id)
);
CREATE TABLE public.profiles (
  user_id uuid NOT NULL,
  username text NOT NULL UNIQUE,
  email_stash text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  active_hero_id uuid,
  CONSTRAINT profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT profiles_active_hero_id_fkey FOREIGN KEY (active_hero_id) REFERENCES public.heroes(id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.tags (
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tags_pkey PRIMARY KEY (name)
);
