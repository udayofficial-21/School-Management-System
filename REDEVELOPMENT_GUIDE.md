# Supabase connection and redevelopment guide

## What is in this project

The website is a static HTML/CSS/JavaScript app hosted through GitHub Pages. It now uses the Supabase JavaScript client for authentication and student records. The browser uses only the Supabase Project URL and publishable key. A publishable key is expected to be visible in a browser app; database access is controlled by the SQL grants and Row Level Security policies in `supabase/schema.sql`.

Never put a Supabase secret key or legacy `service_role` key in this project, the browser, or GitHub Pages. Supabase documents that secret keys bypass Row Level Security and must stay server-side.

## Connect your Supabase project

1. Create a Supabase project and open **SQL Editor**.
2. Run `supabase/schema.sql`. It creates the profile, attendance, results, timetable, announcements, and events tables; enables Row Level Security; and adds the roster-linking Auth trigger.
3. Before students register, add each approved student to `public.student_profiles` using **Table Editor** or a CSV import. Include `student_id`, `school_email`, `full_name`, and any profile fields the school has approved. Leave `user_id` empty. Self-registration only succeeds when both the Student ID and school email match an unused roster row. The row is linked to the account only after email confirmation.
4. In **Project Settings → API**, copy the Project URL and the publishable key (starts with `sb_publishable_`). Put those two values in `supabase-config.js`. Do not copy a secret key.
5. In **Authentication → URL Configuration**, set the Site URL to your deployed site, and add these redirect URLs:
   - `https://udayofficial-21.github.io/School-Management-System/index.html`
   - `http://localhost:8000/index.html` for local preview
6. Keep email confirmation enabled. The registration page asks students to confirm their school email before sign-in. Supabase requires the redirect URL to be on the project's allow-list.
7. Preview over HTTP, not by opening an HTML file directly. From this folder, run `python -m http.server 8000`, then open `http://localhost:8000/`.
8. Deploy the updated files to GitHub Pages. The published demo will not use these changes until the files are deployed.

The browser client is in `supabase-client.js`; edit sign-in, registration, data reads, and settings in `script.js`. The current setup supports the **student experience**. Roster management and writing attendance, grades, timetable, announcements, and events must be done in the Supabase dashboard for now. A later release should add admin and teacher roles with carefully scoped write policies and screens.

## Record behavior

- Students can read only their own profile, attendance, published results, and timetable.
- Students can read school-wide published announcements and events.
- Students can update only their own name and phone number. The school email, Student ID, attendance, and grades are read-only in the browser.
- Attendance percentage currently counts `present` and `late` as attended and excludes `excused` from the denominator. Confirm this rule with the school before using real attendance data.
- Semester results are shown only after a staff member marks them `published`.

## Recommended next release

1. Add admin and teacher authentication with server-controlled roles.
2. Add roster import, class/subject assignment, attendance entry, and mark publishing screens.
3. Scope teacher write access to assigned classes; keep database policies as the final permission check.
4. Add password recovery, audit history, CSV/PDF reports, mobile/keyboard review, and data backup procedures.
5. Test RLS as an anonymous user, a student, a teacher, and an administrator before loading real student data.

Until those staff workflows and role policies are implemented, this is a Supabase-connected student portal foundation, not a complete school operations system.
