-- School Management System: Supabase schema and role-based administration workflows.
-- Apply this in Supabase SQL Editor before using the connected frontend.

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

-- ---------------------------------------------------------------------------
-- Staff roles, school enrollment, and roll allocation
-- This section is an idempotent migration: it can be run again after changes.
-- ---------------------------------------------------------------------------

alter table public.student_profiles
    add column if not exists admission_year smallint check (admission_year between 1900 and 2100),
    add column if not exists study_year smallint,
    add column if not exists branch_code text,
    add column if not exists roll_number text,
    add column if not exists roll_allocated_at timestamptz,
    add column if not exists created_by uuid references auth.users (id) on delete set null;

create unique index if not exists student_profiles_roll_number_uidx
    on public.student_profiles (upper(btrim(roll_number)))
    where roll_number is not null;
create index if not exists student_profiles_roster_admin_idx
    on public.student_profiles (admission_year desc, branch_code, created_at desc);

create table if not exists public.user_roles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    role_name text not null check (role_name in (
        'super_admin', 'chairman', 'principal', 'vice_principal', 'hod', 'faculty'
    )),
    branch_code text,
    assigned_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint user_roles_branch_scope_check check (
        (role_name in ('hod', 'faculty') and nullif(btrim(branch_code), '') is not null)
        or (role_name not in ('hod', 'faculty') and branch_code is null)
    )
);

create table if not exists public.student_id_counters (
    admission_year smallint not null,
    branch_code text not null,
    last_number integer not null check (last_number > 0),
    primary key (admission_year, branch_code)
);

create table if not exists public.roll_number_counters (
    admission_year smallint not null,
    college_code text not null,
    branch_code text not null,
    last_number integer not null check (last_number > 0),
    primary key (admission_year, college_code, branch_code)
);

create table if not exists public.school_settings (
    id smallint primary key check (id = 1),
    school_name text not null default 'School Management System',
    college_code text,
    roll_number_format text not null default '{YY}{COLLEGE}{BRANCH}{NUMBER}',
    updated_by uuid references auth.users (id) on delete set null,
    updated_at timestamptz not null default now(),
    constraint school_settings_college_code_check check (
        college_code is null or college_code ~ '^[A-Z0-9]{1,8}$'
    )
);
insert into public.school_settings (id)
values (1)
on conflict (id) do nothing;

-- A super admin can prepare a staff invitation from the app. The actual invite
-- email is sent from Supabase Auth, so no secret key is ever put in the browser.
create table if not exists public.staff_invites (
    email text primary key,
    role_name text not null check (role_name in (
        'super_admin', 'chairman', 'principal', 'vice_principal', 'hod', 'faculty'
    )),
    branch_code text,
    invited_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    constraint staff_invites_email_lower_check check (email = lower(btrim(email))),
    constraint staff_invites_branch_scope_check check (
        (role_name in ('hod', 'faculty') and nullif(btrim(branch_code), '') is not null)
        or (role_name not in ('hod', 'faculty') and branch_code is null)
    )
);

alter table public.user_roles enable row level security;
alter table public.student_id_counters enable row level security;
alter table public.roll_number_counters enable row level security;
alter table public.school_settings enable row level security;
alter table public.staff_invites enable row level security;

revoke all on table public.user_roles from anon, authenticated;
revoke all on table public.student_id_counters from anon, authenticated;
revoke all on table public.roll_number_counters from anon, authenticated;
revoke all on table public.school_settings from anon, authenticated;
revoke all on table public.staff_invites from anon, authenticated;
grant select on table public.user_roles to authenticated;

create or replace function public.current_school_role()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
    select roles.role_name
      from public.user_roles as roles
     where roles.user_id = (select auth.uid())
     limit 1
$function$;

create or replace function public.is_school_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
    select exists (
        select 1
          from public.user_roles as roles
         where roles.user_id = (select auth.uid())
           and roles.role_name = 'super_admin'
    )
$function$;

create or replace function public.can_view_student_branch(p_branch_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
    select exists (
        select 1
          from public.user_roles as roles
         where roles.user_id = (select auth.uid())
           and (
               roles.role_name in ('super_admin', 'chairman', 'principal', 'vice_principal')
               or (
                   roles.role_name in ('hod', 'faculty')
                   and upper(btrim(roles.branch_code)) = upper(btrim(p_branch_code))
               )
           )
    )
$function$;

create or replace function public.can_manage_student_branch(p_branch_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
    select exists (
        select 1
          from public.user_roles as roles
         where roles.user_id = (select auth.uid())
           and (
               roles.role_name in ('super_admin', 'chairman', 'principal', 'vice_principal')
               or (
                   roles.role_name = 'hod'
                   and upper(btrim(roles.branch_code)) = upper(btrim(p_branch_code))
               )
           )
    )
$function$;

revoke all on function public.current_school_role() from public, anon;
revoke all on function public.is_school_super_admin() from public, anon;
revoke all on function public.can_view_student_branch(text) from public, anon;
revoke all on function public.can_manage_student_branch(text) from public, anon;
grant execute on function public.current_school_role() to authenticated;
grant execute on function public.is_school_super_admin() to authenticated;
grant execute on function public.can_view_student_branch(text) to authenticated;
grant execute on function public.can_manage_student_branch(text) to authenticated;

drop policy if exists "Students read their own profile" on public.student_profiles;
create policy "Students and assigned staff read allowed profiles"
    on public.student_profiles for select to authenticated
    using (
        (select auth.uid()) = user_id
        or public.can_manage_student_branch(branch_code)
    );

drop policy if exists "Users read their own role" on public.user_roles;
create policy "Users read their own role"
    on public.user_roles for select to authenticated
    using ((select auth.uid()) = user_id or public.is_school_super_admin());

create or replace function public.admin_get_settings()
returns table (school_name text, college_code text, roll_number_format text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if public.current_school_role() is null then
        raise exception 'Staff access is required.';
    end if;

    return query
    select settings.school_name, settings.college_code, settings.roll_number_format
      from public.school_settings as settings
     where settings.id = 1;
end;
$function$;

create or replace function public.admin_save_settings(
    p_school_name text,
    p_college_code text,
    p_roll_number_format text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_college_code text := upper(btrim(coalesce(p_college_code, '')));
    v_format text := upper(btrim(coalesce(p_roll_number_format, '')));
    v_unknown_tokens text;
begin
    if not public.is_school_super_admin() then
        raise exception 'Only the system super admin can change school settings.';
    end if;
    if nullif(btrim(p_school_name), '') is null then
        raise exception 'Enter the school or college name.';
    end if;
    if v_college_code !~ '^[A-Z0-9]{1,8}$' then
        raise exception 'College code must contain 1 to 8 letters or numbers.';
    end if;
    if v_format !~ '^[A-Z0-9{}_-]+$' then
        raise exception 'Use only letters, numbers, braces, hyphens, or underscores in the roll format.';
    end if;
    if position('{COLLEGE}' in v_format) = 0
       or position('{BRANCH}' in v_format) = 0
       or position('{NUMBER}' in v_format) = 0
       or (position('{YEAR}' in v_format) = 0 and position('{YY}' in v_format) = 0) then
        raise exception 'Roll format must include {YEAR} or {YY}, plus {COLLEGE}, {BRANCH}, and {NUMBER}.';
    end if;

    v_unknown_tokens := regexp_replace(v_format, '\{(YEAR|YY|COLLEGE|BRANCH|NUMBER)\}', '', 'g');
    if v_unknown_tokens ~ '[{}]' then
        raise exception 'Roll format contains an unknown placeholder.';
    end if;

    insert into public.school_settings (id, school_name, college_code, roll_number_format, updated_by, updated_at)
    values (1, btrim(p_school_name), v_college_code, v_format, (select auth.uid()), now())
    on conflict (id) do update
       set school_name = excluded.school_name,
           college_code = excluded.college_code,
           roll_number_format = excluded.roll_number_format,
           updated_by = excluded.updated_by,
           updated_at = now();
end;
$function$;

-- Drop this RPC before recreating it so future schema revisions can safely change
-- its returned columns without a PostgreSQL return-type conflict.
drop function if exists public.admin_list_students(boolean, text);

create function public.admin_list_students(
    p_pending_roll_only boolean default false,
    p_search text default null
)
returns table (
    id uuid,
    student_id text,
    roll_number text,
    admission_year smallint,
    study_year smallint,
    full_name text,
    school_email text,
    college text,
    branch text,
    branch_code text,
    date_of_birth date,
    phone text,
    user_id uuid,
    account_linked boolean,
    created_at timestamptz,
    roll_allocated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_role text := public.current_school_role();
    v_search text := nullif(btrim(p_search), '');
begin
    if v_role is null or v_role not in (
        'super_admin', 'chairman', 'principal', 'vice_principal', 'hod', 'faculty'
    ) then
        raise exception 'Staff access is required.';
    end if;

    return query
    select
        profile.id,
        profile.student_id,
        profile.roll_number,
        profile.admission_year,
        profile.study_year,
        profile.full_name,
        case when v_role = 'faculty' then null::text else profile.school_email end,
        profile.college,
        profile.branch,
        profile.branch_code,
        case when v_role = 'faculty' then null::date else profile.date_of_birth end,
        case when v_role = 'faculty' then null::text else profile.phone end,
        case when v_role = 'faculty' then null::uuid else profile.user_id end,
        profile.user_id is not null,
        profile.created_at,
        profile.roll_allocated_at
      from public.student_profiles as profile
     where public.can_view_student_branch(profile.branch_code)
       and (not coalesce(p_pending_roll_only, false) or profile.roll_number is null)
       and (
           v_search is null
           or profile.student_id ilike '%' || v_search || '%'
           or profile.roll_number ilike '%' || v_search || '%'
           or profile.full_name ilike '%' || v_search || '%'
           or (v_role <> 'faculty' and profile.school_email ilike '%' || v_search || '%')
       )
     order by profile.created_at desc
     limit 1000;
end;
$function$;

create or replace function public.admin_dashboard_summary()
returns table (
    total_students bigint,
    linked_accounts bigint,
    pending_rolls bigint,
    pending_registrations bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_role text := public.current_school_role();
begin
    if v_role is null or v_role not in (
        'super_admin', 'chairman', 'principal', 'vice_principal', 'hod', 'faculty'
    ) then
        raise exception 'Staff access is required.';
    end if;

    return query
    select count(*)::bigint,
           count(*) filter (where profile.user_id is not null)::bigint,
           count(*) filter (where profile.roll_number is null)::bigint,
           count(*) filter (where profile.user_id is null)::bigint
      from public.student_profiles as profile
     where public.can_view_student_branch(profile.branch_code);
end;
$function$;

create or replace function public.admin_create_student(
    p_full_name text,
    p_school_email text,
    p_admission_year smallint,
    p_study_year smallint,
    p_branch text,
    p_branch_code text,
    p_college text,
    p_date_of_birth date default null,
    p_phone text default null
)
returns table (id uuid, student_id text)
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_branch_code text := upper(regexp_replace(btrim(coalesce(p_branch_code, '')), '\s+', '', 'g'));
    v_email text := lower(btrim(coalesce(p_school_email, '')));
    v_prefix text;
    v_last_number integer := 0;
    v_next_number integer;
    v_student_id text;
    v_profile_id uuid;
begin
    if nullif(btrim(p_full_name), '') is null
       or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
        raise exception 'Enter the student name and a valid school email.';
    end if;
    if p_admission_year is null or p_admission_year not between 1900 and 2100 then
        raise exception 'Enter a valid admission year.';
    end if;
    if p_study_year is not null and p_study_year not between 1 and 8 then
        raise exception 'Study year must be between 1 and 8.';
    end if;
    if v_branch_code !~ '^[A-Z0-9]{2,10}$' or nullif(btrim(p_branch), '') is null then
        raise exception 'Enter a branch name and a branch code using 2 to 10 letters or numbers.';
    end if;
    if not public.can_manage_student_branch(v_branch_code) then
        raise exception 'You can only enroll students in a branch you manage.';
    end if;

    v_prefix := p_admission_year::text || v_branch_code;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_prefix)::bigint);

    select coalesce(max(
        case
            when substring(profile.student_id from char_length(v_prefix) + 1) ~ '^[0-9]+$'
            then substring(profile.student_id from char_length(v_prefix) + 1)::integer
            else null
        end
    ), 0)
      into v_last_number
      from public.student_profiles as profile
     where upper(profile.student_id) like upper(v_prefix) || '%'
       and profile.student_id is not null;

    insert into public.student_id_counters as counters (admission_year, branch_code, last_number)
    values (p_admission_year, v_branch_code, v_last_number + 1)
    on conflict (admission_year, branch_code) do update
       set last_number = greatest(counters.last_number + 1, excluded.last_number)
    returning last_number into v_next_number;

    v_student_id := v_prefix || lpad(v_next_number::text, greatest(3, char_length(v_next_number::text)), '0');

    insert into public.student_profiles (
        student_id, school_email, full_name, college, date_of_birth, phone,
        branch, branch_code, admission_year, study_year, created_by
    ) values (
        v_student_id, v_email, btrim(p_full_name), nullif(btrim(p_college), ''),
        p_date_of_birth, nullif(btrim(p_phone), ''), btrim(p_branch), v_branch_code,
        p_admission_year, p_study_year, (select auth.uid())
    ) returning student_profiles.id into v_profile_id;

    return query select v_profile_id, v_student_id;
end;
$function$;

create or replace function public.admin_update_student(
    p_student_profile_id uuid,
    p_full_name text,
    p_school_email text,
    p_admission_year smallint,
    p_study_year smallint,
    p_branch text,
    p_branch_code text,
    p_college text,
    p_date_of_birth date,
    p_phone text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile public.student_profiles%rowtype;
    v_branch_code text := upper(regexp_replace(btrim(coalesce(p_branch_code, '')), '\s+', '', 'g'));
    v_email text := lower(btrim(coalesce(p_school_email, '')));
    v_prefix text;
    v_last_number integer := 0;
    v_next_number integer;
    v_student_id text;
    v_identity_changed boolean;
begin
    select * into v_profile
      from public.student_profiles as profile
     where profile.id = p_student_profile_id
     for update;
    if not found then
        raise exception 'Student record not found.';
    end if;
    if not public.can_manage_student_branch(v_profile.branch_code)
       or not public.can_manage_student_branch(v_branch_code) then
        raise exception 'You can only edit students in a branch you manage.';
    end if;
    if nullif(btrim(p_full_name), '') is null
       or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
        raise exception 'Enter the student name and a valid school email.';
    end if;
    if p_admission_year is null or p_admission_year not between 1900 and 2100 then
        raise exception 'Enter a valid admission year.';
    end if;
    if p_study_year is not null and p_study_year not between 1 and 8 then
        raise exception 'Study year must be between 1 and 8.';
    end if;
    if v_branch_code !~ '^[A-Z0-9]{2,10}$' or nullif(btrim(p_branch), '') is null then
        raise exception 'Enter a branch name and a branch code using 2 to 10 letters or numbers.';
    end if;

    v_identity_changed := v_profile.admission_year is distinct from p_admission_year
        or upper(coalesce(v_profile.branch_code, '')) is distinct from v_branch_code;
    if v_profile.user_id is not null and (
        lower(v_profile.school_email) is distinct from v_email or v_identity_changed
    ) then
        raise exception 'A registered student email, admission year, and branch cannot be changed here.';
    end if;
    if v_profile.roll_number is not null and v_identity_changed then
        raise exception 'A student with an allocated roll number cannot change admission year or branch.';
    end if;

    v_student_id := v_profile.student_id;
    if v_profile.user_id is null and v_profile.roll_number is null and v_identity_changed then
        v_prefix := p_admission_year::text || v_branch_code;
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_prefix)::bigint);
        select coalesce(max(
            case
                when substring(profile.student_id from char_length(v_prefix) + 1) ~ '^[0-9]+$'
                then substring(profile.student_id from char_length(v_prefix) + 1)::integer
                else null
            end
        ), 0)
          into v_last_number
          from public.student_profiles as profile
         where profile.id <> p_student_profile_id
           and upper(profile.student_id) like upper(v_prefix) || '%'
           and profile.student_id is not null;
        insert into public.student_id_counters as counters (admission_year, branch_code, last_number)
        values (p_admission_year, v_branch_code, v_last_number + 1)
        on conflict (admission_year, branch_code) do update
           set last_number = greatest(counters.last_number + 1, excluded.last_number)
        returning last_number into v_next_number;
        v_student_id := v_prefix || lpad(v_next_number::text, greatest(3, char_length(v_next_number::text)), '0');
    end if;

    update public.student_profiles as profile
       set student_id = v_student_id,
           school_email = v_email,
           full_name = btrim(p_full_name),
           admission_year = p_admission_year,
           study_year = p_study_year,
           branch = btrim(p_branch),
           branch_code = v_branch_code,
           college = nullif(btrim(p_college), ''),
           date_of_birth = p_date_of_birth,
           phone = nullif(btrim(p_phone), ''),
           updated_at = now()
     where profile.id = p_student_profile_id;

    return v_student_id;
end;
$function$;

create or replace function public.admin_allocate_student_roll(p_student_profile_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_profile public.student_profiles%rowtype;
    v_college_code text;
    v_format text;
    v_prefix text;
    v_number integer;
    v_roll_number text;
    v_attempt integer := 0;
begin
    select * into v_profile
      from public.student_profiles as profile
     where profile.id = p_student_profile_id
     for update;
    if not found then
        raise exception 'Student record not found.';
    end if;
    if not public.can_manage_student_branch(v_profile.branch_code) then
        raise exception 'You cannot allocate a roll number for this branch.';
    end if;
    if v_profile.roll_number is not null then
        return v_profile.roll_number;
    end if;
    if v_profile.admission_year is null or nullif(v_profile.branch_code, '') is null then
        raise exception 'Add the admission year and branch code before allocating a roll number.';
    end if;

    select settings.college_code, settings.roll_number_format
      into v_college_code, v_format
      from public.school_settings as settings
     where settings.id = 1;
    if nullif(v_college_code, '') is null then
        raise exception 'The super admin must set the college code before roll allocation.';
    end if;

    v_prefix := right(v_profile.admission_year::text, 2) || v_college_code || upper(v_profile.branch_code);
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_prefix)::bigint);

    loop
        insert into public.roll_number_counters as counters (
            admission_year, college_code, branch_code, last_number
        ) values (
            v_profile.admission_year, v_college_code, upper(v_profile.branch_code), 1
        )
        on conflict (admission_year, college_code, branch_code) do update
           set last_number = counters.last_number + 1
        returning last_number into v_number;

        v_roll_number := replace(v_format, '{YEAR}', v_profile.admission_year::text);
        v_roll_number := replace(v_roll_number, '{YY}', right(v_profile.admission_year::text, 2));
        v_roll_number := replace(v_roll_number, '{COLLEGE}', v_college_code);
        v_roll_number := replace(v_roll_number, '{BRANCH}', upper(v_profile.branch_code));
        v_roll_number := replace(v_roll_number, '{NUMBER}', lpad(v_number::text, greatest(4, char_length(v_number::text)), '0'));
        v_attempt := v_attempt + 1;

        exit when not exists (
            select 1 from public.student_profiles as existing
             where upper(existing.roll_number) = upper(v_roll_number)
        );
        if v_attempt >= 100 then
            raise exception 'Could not find an unused roll number. Check the roll format.';
        end if;
    end loop;

    update public.student_profiles as profile
       set roll_number = v_roll_number,
           roll_allocated_at = now(),
           updated_at = now()
     where profile.id = p_student_profile_id;

    return v_roll_number;
end;
$function$;

create or replace function public.admin_list_staff()
returns table (
    user_id uuid,
    email text,
    display_name text,
    role_name text,
    branch_code text,
    assigned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if not public.is_school_super_admin() then
        raise exception 'Only the system super admin can manage staff roles.';
    end if;

    return query
    select roles.user_id,
           users.email::text,
           coalesce(nullif(users.raw_user_meta_data ->> 'full_name', ''), split_part(users.email::text, '@', 1)),
           roles.role_name,
           roles.branch_code,
           roles.created_at
      from public.user_roles as roles
      join auth.users as users on users.id = roles.user_id
     order by roles.role_name, users.email;
end;
$function$;

create or replace function public.admin_list_pending_staff_invites()
returns table (email text, role_name text, branch_code text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if not public.is_school_super_admin() then
        raise exception 'Only the system super admin can manage staff roles.';
    end if;

    return query
    select invite.email, invite.role_name, invite.branch_code, invite.created_at
      from public.staff_invites as invite
     order by invite.created_at desc;
end;
$function$;

create or replace function public.admin_manage_staff(
    p_email text,
    p_role_name text,
    p_branch_code text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_role text := lower(btrim(coalesce(p_role_name, '')));
    v_branch text := upper(regexp_replace(btrim(coalesce(p_branch_code, '')), '\s+', '', 'g'));
    v_user_id uuid;
    v_email_confirmed_at timestamptz;
    v_existing_role text;
    v_super_admin_count integer;
begin
    if not public.is_school_super_admin() then
        raise exception 'Only the system super admin can manage staff roles.';
    end if;
    if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or v_role not in (
        'super_admin', 'chairman', 'principal', 'vice_principal', 'hod', 'faculty'
    ) then
        raise exception 'Enter a valid email and staff role.';
    end if;
    if v_role in ('hod', 'faculty') and v_branch !~ '^[A-Z0-9]{2,10}$' then
        raise exception 'HOD and faculty accounts need a branch code.';
    end if;
    if v_role not in ('hod', 'faculty') then
        v_branch := null;
    end if;

    select users.id, users.email_confirmed_at
      into v_user_id, v_email_confirmed_at
      from auth.users as users
     where lower(users.email::text) = v_email
     limit 1;

    if v_user_id is not null then
        select roles.role_name into v_existing_role
          from public.user_roles as roles
         where roles.user_id = v_user_id;
        if v_existing_role = 'super_admin' and v_role <> 'super_admin' then
            select count(*) into v_super_admin_count
              from public.user_roles as roles
             where roles.role_name = 'super_admin';
            if v_super_admin_count <= 1 then
                raise exception 'Assign another Super Admin before changing the last Super Admin role.';
            end if;
        end if;

        if v_email_confirmed_at is null then
            insert into public.staff_invites (email, role_name, branch_code, invited_by)
            values (v_email, v_role, v_branch, (select auth.uid()))
            on conflict (email) do update
               set role_name = excluded.role_name,
                   branch_code = excluded.branch_code,
                   invited_by = excluded.invited_by,
                   created_at = now();
            return 'invite_pending';
        end if;

        insert into public.user_roles (user_id, role_name, branch_code, assigned_by, updated_at)
        values (v_user_id, v_role, v_branch, (select auth.uid()), now())
        on conflict (user_id) do update
           set role_name = excluded.role_name,
               branch_code = excluded.branch_code,
               assigned_by = excluded.assigned_by,
               updated_at = now();
        delete from public.staff_invites where email = v_email;
        return 'assigned';
    end if;

    insert into public.staff_invites (email, role_name, branch_code, invited_by)
    values (v_email, v_role, v_branch, (select auth.uid()))
    on conflict (email) do update
       set role_name = excluded.role_name,
           branch_code = excluded.branch_code,
           invited_by = excluded.invited_by,
           created_at = now();
    return 'invite_pending';
end;
$function$;

create or replace function public.admin_remove_staff_role(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_target_role text;
    v_super_admin_count integer;
begin
    if not public.is_school_super_admin() then
        raise exception 'Only the system super admin can manage staff roles.';
    end if;

    select roles.role_name into v_target_role
      from public.user_roles as roles
     where roles.user_id = p_user_id;
    if not found then
        raise exception 'Staff role not found.';
    end if;
    if v_target_role = 'super_admin' then
        select count(*) into v_super_admin_count
          from public.user_roles as roles
         where roles.role_name = 'super_admin';
        if v_super_admin_count <= 1 then
            raise exception 'The last super admin cannot be removed.';
        end if;
    end if;

    delete from public.user_roles as roles where roles.user_id = p_user_id;
end;
$function$;

create or replace function public.admin_cancel_staff_invite(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if not public.is_school_super_admin() then
        raise exception 'Only the system super admin can manage staff roles.';
    end if;
    delete from public.staff_invites where email = lower(btrim(p_email));
end;
$function$;

create or replace function public.validate_student_roster_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    requested_student_id text;
begin
    if exists (
        select 1 from public.staff_invites as invite
         where invite.email = lower(btrim(new.email::text))
    ) then
        return new;
    end if;

    requested_student_id := nullif(btrim(new.raw_user_meta_data ->> 'student_id'), '');
    if requested_student_id is null or new.email is null then
        raise exception 'A school roster entry is required to create this account.';
    end if;

    if not exists (
        select 1
          from public.student_profiles as profile
         where lower(btrim(profile.student_id)) = lower(requested_student_id)
           and lower(btrim(profile.school_email)) = lower(btrim(new.email::text))
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
    invite public.staff_invites%rowtype;
begin
    if tg_op = 'UPDATE' then
        if old.email_confirmed_at is not null then
            return new;
        end if;
    end if;
    if new.email_confirmed_at is null then
        return new;
    end if;

    select * into invite
      from public.staff_invites as pending
     where pending.email = lower(btrim(new.email::text))
     for update;
    if found then
        insert into public.user_roles (user_id, role_name, branch_code, assigned_by, updated_at)
        values (new.id, invite.role_name, invite.branch_code, invite.invited_by, now())
        on conflict (user_id) do update
           set role_name = excluded.role_name,
               branch_code = excluded.branch_code,
               assigned_by = excluded.assigned_by,
               updated_at = now();
        delete from public.staff_invites where email = invite.email;
        return new;
    end if;

    requested_student_id := nullif(btrim(new.raw_user_meta_data ->> 'student_id'), '');
    update public.student_profiles as profile
       set user_id = new.id,
           updated_at = now()
     where lower(btrim(profile.student_id)) = lower(requested_student_id)
       and lower(btrim(profile.school_email)) = lower(btrim(new.email::text))
       and profile.user_id is null;

    if not found then
        raise exception 'The school roster entry is no longer available. Contact the school administrator.';
    end if;

    return new;
end;
$function$;

revoke all on function public.admin_get_settings() from public, anon;
revoke all on function public.admin_save_settings(text, text, text) from public, anon;
revoke all on function public.admin_list_students(boolean, text) from public, anon;
revoke all on function public.admin_dashboard_summary() from public, anon;
revoke all on function public.admin_create_student(text, text, smallint, smallint, text, text, text, date, text) from public, anon;
revoke all on function public.admin_update_student(uuid, text, text, smallint, smallint, text, text, text, date, text) from public, anon;
revoke all on function public.admin_allocate_student_roll(uuid) from public, anon;
revoke all on function public.admin_list_staff() from public, anon;
revoke all on function public.admin_list_pending_staff_invites() from public, anon;
revoke all on function public.admin_manage_staff(text, text, text) from public, anon;
revoke all on function public.admin_remove_staff_role(uuid) from public, anon;
revoke all on function public.admin_cancel_staff_invite(text) from public, anon;
revoke all on function public.validate_student_roster_signup() from public, anon;
revoke all on function public.link_rostered_student_after_confirmation() from public, anon;

grant execute on function public.admin_get_settings() to authenticated;
grant execute on function public.admin_save_settings(text, text, text) to authenticated;
grant execute on function public.admin_list_students(boolean, text) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_create_student(text, text, smallint, smallint, text, text, text, date, text) to authenticated;
grant execute on function public.admin_update_student(uuid, text, text, smallint, smallint, text, text, text, date, text) to authenticated;
grant execute on function public.admin_allocate_student_roll(uuid) to authenticated;
grant execute on function public.admin_list_staff() to authenticated;
grant execute on function public.admin_list_pending_staff_invites() to authenticated;
grant execute on function public.admin_manage_staff(text, text, text) to authenticated;
grant execute on function public.admin_remove_staff_role(uuid) to authenticated;
grant execute on function public.admin_cancel_staff_invite(text) to authenticated;

drop trigger if exists validate_student_roster_after_signup on auth.users;
create trigger validate_student_roster_after_signup
before insert on auth.users
for each row execute function public.validate_student_roster_signup();

drop trigger if exists link_rostered_student_after_confirmation on auth.users;
drop trigger if exists link_rostered_student_after_insert on auth.users;
drop trigger if exists link_rostered_student_after_email_confirmation on auth.users;
create trigger link_rostered_student_after_insert
after insert on auth.users
for each row execute function public.link_rostered_student_after_confirmation();
create trigger link_rostered_student_after_email_confirmation
after update of email_confirmed_at on auth.users
for each row execute function public.link_rostered_student_after_confirmation();
