-- Pradeep Classes Management System: initial schema
-- Run in Supabase SQL Editor. Enable RLS before adding real student data.
create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'admin', 'teacher', 'student', 'parent');
create type public.record_status as enum ('active', 'inactive', 'on_hold');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  course_name text not null,
  academic_year text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  admission_no text not null unique,
  full_name text not null,
  class_name text not null,
  batch_name text,
  batch_id uuid references public.batches(id) on delete set null,
  phone text,
  parent_name text,
  parent_phone text,
  status public.record_status not null default 'active',
  joined_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  subject text not null,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.teacher_batches (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  primary key (teacher_id, batch_id)
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  session_date date not null default current_date,
  taken_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(batch_id, session_date)
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null check (status in ('present','absent','late','leave')),
  note text,
  marked_at timestamptz not null default now(),
  unique(session_id, student_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.current_user_role()
returns public.app_role language sql stable security definer
set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$ select coalesce(public.current_user_role() in ('owner','admin','teacher'), false) $$;

alter table public.profiles enable row level security;
alter table public.batches enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_batches enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.audit_logs enable row level security;

-- Profiles: users can see themselves; institute owners/admins can view staff directory.
create policy "profiles_self_read" on public.profiles for select using (id = auth.uid() or public.current_user_role() in ('owner','admin'));
create policy "profiles_admin_update" on public.profiles for update using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));

-- Institute staff policies. Teacher-specific batch scoping is tightened in the next migration.
create policy "batches_staff_read" on public.batches for select using (public.is_staff());
create policy "batches_admin_all" on public.batches for all using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));
create policy "students_staff_read" on public.students for select using (public.is_staff());
create policy "students_admin_all" on public.students for all using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));
create policy "teachers_staff_read" on public.teachers for select using (public.is_staff());
create policy "teachers_admin_all" on public.teachers for all using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));
create policy "teacher_batches_staff_read" on public.teacher_batches for select using (public.is_staff());
create policy "teacher_batches_admin_all" on public.teacher_batches for all using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));
create policy "attendance_staff_read" on public.attendance_sessions for select using (public.is_staff());
create policy "attendance_teacher_insert" on public.attendance_sessions for insert with check (public.current_user_role() in ('owner','admin','teacher') and taken_by = auth.uid());
create policy "attendance_admin_update" on public.attendance_sessions for update using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));
create policy "attendance_records_staff_read" on public.attendance_records for select using (public.is_staff());
create policy "attendance_teacher_insert_records" on public.attendance_records for insert with check (public.current_user_role() in ('owner','admin','teacher'));
create policy "attendance_records_admin_update" on public.attendance_records for update using (public.current_user_role() in ('owner','admin')) with check (public.current_user_role() in ('owner','admin'));
create policy "audit_admin_read" on public.audit_logs for select using (public.current_user_role() in ('owner','admin'));
create policy "audit_staff_insert" on public.audit_logs for insert with check (public.is_staff());

-- Do not expose the Supabase service_role key in the browser.
