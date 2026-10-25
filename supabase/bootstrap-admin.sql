-- Run supabase/schema.sql first.
-- Replace the email below with the first Super Admin's real school email,
-- then run this query once in the Supabase SQL Editor.
-- After this query succeeds, send that person an invitation from
-- Supabase Dashboard -> Authentication -> Users.

do $bootstrap$
declare
    admin_email text := lower(btrim('REPLACE_WITH_ADMIN_EMAIL'));
begin
    if admin_email = 'replace_with_admin_email' or position('@' in admin_email) = 0 then
        raise exception 'Edit bootstrap-admin.sql and replace REPLACE_WITH_ADMIN_EMAIL with the Super Admin email first.';
    end if;

    insert into public.staff_invites (email, role_name, branch_code, invited_by)
    values (admin_email, 'super_admin', null, null)
    on conflict (email) do update
       set role_name = 'super_admin',
           branch_code = null,
           invited_by = null,
           created_at = now();
end;
$bootstrap$;
