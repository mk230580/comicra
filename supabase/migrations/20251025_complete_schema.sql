-- Complete Production Database Schema for Comicra
-- Migration: 20251025_complete_schema.sql

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  avatar_url text,
  plan text default 'free' check (plan in ('free','pro','premium')),
  role text default 'creator' check (role in ('viewer','creator','admin')),
  credits integer default 20,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- PROJECTS TABLE (Comics/Manga projects)
-- ============================================================================
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  thumbnail_url text,
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  pages_data jsonb default '[]'::jsonb,
  characters_data jsonb default '[]'::jsonb,
  settings jsonb default '{}'::jsonb,
  worldview text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- PAGES TABLE (Individual comic pages)
-- ============================================================================
create table if not exists public.pages (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references public.projects(id) on delete cascade not null,
  page_number integer not null,
  layout text,
  panels_data jsonb default '[]'::jsonb,
  generated_image_url text,
  scene_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(project_id, page_number)
);

-- ============================================================================
-- CHARACTERS TABLE
-- ============================================================================
create table if not exists public.characters (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  description text,
  reference_image_url text,
  sheet_image_url text,
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- USAGE LOGS TABLE (Track API usage for billing)
-- ============================================================================
create table if not exists public.usage_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  operation_type text not null check (operation_type in (
    'panel_generation',
    'story_suggestion',
    'video_generation',
    'character_generation',
    'colorization',
    'layout_proposal'
  )),
  credits_consumed integer not null default 1,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================================
-- ADMIN ACTIONS TABLE (Audit log)
-- ============================================================================
create table if not exists public.admin_actions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references public.profiles(id) on delete set null,
  action_type text not null check (action_type in (
    'user_update',
    'user_delete',
    'subscription_change',
    'credit_adjustment',
    'content_moderation'
  )),
  target_user_id uuid references public.profiles(id) on delete set null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================================
-- PAYMENT REQUESTS TABLE (For manual payment processing)
-- ============================================================================
create table if not exists public.payment_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  plan_requested text not null check (plan_requested in ('pro', 'premium')),
  amount decimal(10, 2) not null,
  payment_method text not null,
  transaction_id text,
  screenshot_url text,
  phone_number text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pages_updated_at on public.pages;
create trigger trg_pages_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

drop trigger if exists trg_characters_updated_at on public.characters;
create trigger trg_characters_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_requests_updated_at on public.payment_requests;
create trigger trg_payment_requests_updated_at
  before update on public.payment_requests
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.pages enable row level security;
alter table public.characters enable row level security;
alter table public.usage_logs enable row level security;
alter table public.admin_actions enable row level security;
alter table public.payment_requests enable row level security;

-- Helper function to check if user is admin
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer as $$
  select exists(select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin(auth.uid()));

-- Projects policies
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (user_id = auth.uid());

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (user_id = auth.uid());

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Pages policies
drop policy if exists "pages_access_via_project" on public.pages;
create policy "pages_access_via_project" on public.pages
  for all using (
    exists (
      select 1 from public.projects
      where projects.id = pages.project_id
      and (projects.user_id = auth.uid() or public.is_admin(auth.uid()))
    )
  );

-- Characters policies
drop policy if exists "characters_select" on public.characters;
create policy "characters_select" on public.characters
  for select using (user_id = auth.uid() or is_public = true or public.is_admin(auth.uid()));

drop policy if exists "characters_insert_own" on public.characters;
create policy "characters_insert_own" on public.characters
  for insert with check (user_id = auth.uid());

drop policy if exists "characters_update_own" on public.characters;
create policy "characters_update_own" on public.characters
  for update using (user_id = auth.uid());

drop policy if exists "characters_delete_own" on public.characters;
create policy "characters_delete_own" on public.characters
  for delete using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Usage logs policies
drop policy if exists "usage_logs_insert" on public.usage_logs;
create policy "usage_logs_insert" on public.usage_logs
  for insert with check (user_id = auth.uid());

drop policy if exists "usage_logs_select" on public.usage_logs;
create policy "usage_logs_select" on public.usage_logs
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- Admin actions policies (admin only)
drop policy if exists "admin_actions_admin_only" on public.admin_actions;
create policy "admin_actions_admin_only" on public.admin_actions
  for all using (public.is_admin(auth.uid()));

-- Payment requests policies
drop policy if exists "payment_requests_select_own" on public.payment_requests;
create policy "payment_requests_select_own" on public.payment_requests
  for select using (user_id = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "payment_requests_insert_own" on public.payment_requests;
create policy "payment_requests_insert_own" on public.payment_requests
  for insert with check (user_id = auth.uid());

drop policy if exists "payment_requests_update_admin" on public.payment_requests;
create policy "payment_requests_update_admin" on public.payment_requests
  for update using (public.is_admin(auth.uid()));

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_plan on public.profiles(plan);

create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_projects_created_at on public.projects(created_at desc);

create index if not exists idx_pages_project_id on public.pages(project_id);
create index if not exists idx_pages_page_number on public.pages(project_id, page_number);

create index if not exists idx_characters_user_id on public.characters(user_id);
create index if not exists idx_characters_project_id on public.characters(project_id);
create index if not exists idx_characters_is_public on public.characters(is_public);

create index if not exists idx_usage_logs_user_id on public.usage_logs(user_id);
create index if not exists idx_usage_logs_created_at on public.usage_logs(created_at desc);

create index if not exists idx_admin_actions_admin_id on public.admin_actions(admin_id);
create index if not exists idx_admin_actions_target_user_id on public.admin_actions(target_user_id);
create index if not exists idx_admin_actions_created_at on public.admin_actions(created_at desc);

create index if not exists idx_payment_requests_user_id on public.payment_requests(user_id);
create index if not exists idx_payment_requests_status on public.payment_requests(status);
create index if not exists idx_payment_requests_created_at on public.payment_requests(created_at desc);

-- ============================================================================
-- INITIAL DATA / SEED
-- ============================================================================
-- Note: Admin user should be created via Supabase Auth UI or manually
-- The first user with admin role can be set via direct SQL:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
