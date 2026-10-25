-- School Management System: Supabase starter schema
-- Apply this in Supabase SQL Editor before connecting the frontend.
-- Students may read only their own records. Staff write workflows should be added
-- only after classes, teacher assignments, and staff roles are defined.

create table if not exists public.student_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid unique references auth.users (id) on delete set null,
    student_id text not null,
    school_email text not null,
    full_name text not null,
    college text,
    date_of_birth date,
    phone text,
    branch text,
    study_year smallint check (study_year between 1 and 8),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists student_profiles_student_id_lower_uidx
    on public.student_profiles (lower(btrim(student_id)));
create unique index if not exists student_profiles_school_email_lower_uidx
    on public.student_profiles (lower(btrim(school_email)));

create table if not exists public.attendance_records (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    subject text not null,
    class_date date not null,
    status text not null check (status in ('present', 'absent', 'late', 'excused')),
    created_at timestamptz not null default now(),
    unique (user_id, subject, class_date)
);
create index if not exists attendance_records_user_date_idx
    on public.attendance_records (user_id, class_date desc);

create table if not exists public.assessment_results (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    subject text not null,
    term text not null check (term in ('semester_1', 'semester_2')),
    assessment_type text not null check (assessment_type in ('midterm', 'assignment', 'final_exam')),
    score numeric(7, 2) not null check (score >= 0),
    max_score numeric(7, 2) not null check (max_score > 0 and score <= max_score),
    grade text,
    published boolean not null default false,
    graded_at timestamptz,
    created_at timestamptz not null default now(),
    unique (user_id, subject, term, assessment_type)
);
create index if not exists assessment_results_user_term_idx
    on public.assessment_results (user_id, term, subject);

create table if not exists public.student_timetable (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    day_of_week smallint not null check (day_of_week between 1 and 7),
    start_time time not null,
    end_time time not null,
    subject text not null,
    room text,
    created_at timestamptz not null default now(),
    check (start_time < end_time)
);
create index if not exists student_timetable_user_day_time_idx
    on public.student_timetable (user_id, day_of_week, start_time);

create table if not exists public.school_announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    published boolean not null default false,
    published_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.school_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    event_date timestamptz not null,
    location text,
    published boolean not null default false,
    created_at timestamptz not null default now()
);
create index if not exists school_events_published_date_idx
    on public.school_events (published, event_date);

-- No anonymous browser access. RLS policies further limit signed-in users to
-- their own rows. Students cannot write grades or attendance from the browser.
alter table public.student_profiles enable row level security;
alter table public.attendance_records enable row level security;
alter table public.assessment_results enable row level security;
alter table public.student_timetable enable row level security;
alter table public.school_announcements enable row level security;
alter table public.school_events enable row level security;

revoke all on table public.student_profiles from anon, authenticated;
revoke all on table public.attendance_records from anon, authenticated;
revoke all on table public.assessment_results from anon, authenticated;
revoke all on table public.student_timetable from anon, authenticated;
revoke all on table public.school_announcements from anon, authenticated;
revoke all on table public.school_events from anon, authenticated;

grant select, update (full_name, phone) on table public.student_profiles to authenticated;
grant select on table public.attendance_records to authenticated;
grant select on table public.assessment_results to authenticated;
grant select on table public.student_timetable to authenticated;
grant select on table public.school_announcements to authenticated;
grant select on table public.school_events to authenticated;

drop policy if exists "Students read their own profile" on public.student_profiles;
create policy "Students read their own profile"
    on public.student_profiles for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Students update allowed profile fields" on public.student_profiles;
create policy "Students update allowed profile fields"
    on public.student_profiles for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

drop policy if exists "Students read their own attendance" on public.attendance_records;
create policy "Students read their own attendance"
    on public.attendance_records for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Students read published results" on public.assessment_results;
create policy "Students read published results"
    on public.assessment_results for select to authenticated
    using ((select auth.uid()) = user_id and published = true);

drop policy if exists "Students read their own timetable" on public.student_timetable;
create policy "Students read their own timetable"
    on public.student_timetable for select to authenticated
    using ((select auth.uid()) = user_id);

drop policy if exists "Signed-in users read published announcements" on public.school_announcements;
create policy "Signed-in users read published announcements"
    on public.school_announcements for select to authenticated
    using (published = true);

drop policy if exists "Signed-in users read published events" on public.school_events;
create policy "Signed-in users read published events"
    on public.school_events for select to authenticated
    using (published = true);

-- Student self-registration is restricted to a roster row preloaded by school staff.
-- Validate the Student ID and school email on signup, but do not claim the roster row
-- until Auth confirms the student's email address.
create or replace function public.validate_student_roster_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    requested_student_id text;
begin
    requested_student_id := nullif(btrim(new.raw_user_meta_data ->> 'student_id'), '');
    if requested_student_id is null or new.email is null then
        raise exception 'A school roster entry is required to create this account.';
    end if;

    if not exists (
        select 1
          from public.student_profiles as profile
         where lower(btrim(profile.student_id)) = lower(requested_student_id)
           and lower(btrim(profile.school_email)) = lower(btrim(new.email))
           and profile.user_id is null
    ) then
        raise exception 'The Student ID and school email do not match an unused school roster entry.';
    end if;

    return new;
end;
$function$;

create or replace function public.link_rostered_student_after_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    requested_student_id text;
begin
    if old.email_confirmed_at is not null or new.email_confirmed_at is null then
        return new;
    end if;

    requested_student_id := nullif(btrim(new.raw_user_meta_data ->> 'student_id'), '');
    update public.student_profiles as profile
       set user_id = new.id,
           updated_at = now()
     where lower(btrim(profile.student_id)) = lower(requested_student_id)
       and lower(btrim(profile.school_email)) = lower(btrim(new.email))
       and profile.user_id is null;

    if not found then
        raise exception 'The school roster entry is no longer available. Contact the school administrator.';
    end if;

    return new;
end;
$function$;

revoke all on function public.validate_student_roster_signup() from public;
revoke all on function public.link_rostered_student_after_confirmation() from public;
drop trigger if exists validate_student_roster_after_signup on auth.users;
create trigger validate_student_roster_after_signup
after insert on auth.users
for each row execute function public.validate_student_roster_signup();
drop trigger if exists link_rostered_student_after_confirmation on auth.users;
create trigger link_rostered_student_after_confirmation
after update of email_confirmed_at on auth.users
for each row execute function public.link_rostered_student_after_confirmation();
-- Add roster entries through the Supabase Dashboard before students register.
-- Example only; replace with school-approved records, never commit real student data:
-- insert into public.student_profiles (student_id, school_email, full_name)
-- values ('EXAMPLE-001', 'student@example.edu', 'Example Student');
