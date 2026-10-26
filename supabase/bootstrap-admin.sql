-- Run supabase/schema.sql first.
-- Replace the email below with the first Super Admin's real school email,
-- then run this query once in the Supabase SQL Editor.
-- A confirmed account receives the role immediately. Otherwise, this prepares
-- the role before the invitation is sent from Authentication -> Users.

do $bootstrap$
declare
    admin_email text := lower(btrim('udayofficial21@gmail.com'));
    admin_user_id uuid;
    email_confirmed_at timestamptz;
begin
    if admin_email = 'replace_with_admin_email' or position('@' in admin_email) = 0 then
        raise exception 'Edit bootstrap-admin.sql and replace REPLACE_WITH_ADMIN_EMAIL with the Super Admin email first.';
    end if;

    select users.id, users.email_confirmed_at
      into admin_user_id, email_confirmed_at
      from auth.users as users
     where lower(users.email::text) = admin_email
     limit 1;

    if admin_user_id is not null and email_confirmed_at is not null then
        insert into public.user_roles (user_id, role_name, branch_code, assigned_by, updated_at)
        values (admin_user_id, 'super_admin', null, null, now())
        on conflict (user_id) do update
           set role_name = 'super_admin',
               branch_code = null,
               assigned_by = null,
               updated_at = now();
        delete from public.staff_invites where email = admin_email;
    else
        insert into public.staff_invites (email, role_name, branch_code, invited_by)
        values (admin_email, 'super_admin', null, null)
        on conflict (email) do update
           set role_name = 'super_admin',
               branch_code = null,
               invited_by = null,
               created_at = now();
    end if;
end;
$bootstrap$;
