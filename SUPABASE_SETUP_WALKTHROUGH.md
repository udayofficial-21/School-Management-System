# Beginner walkthrough: prepare student and staff registration

This guide is written for someone who has not used Supabase before. Follow the numbered steps in order. Only enter student information that the school has approved for this system.

## Before you start

Have:
- Access to your Supabase project.
- Access to the school's approved student list.
- The correct college ID and branch codes.
- The first Super Admin's email address.

The website uses a Supabase publishable key. It is intended for browser code. Never put a database password, secret key, or service-role key in the website. Database access is controlled by the Row Level Security rules in supabase/schema.sql. See the official [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

## Step 1: Create the database tables and security rules

1. Open your Supabase project.
2. Choose SQL Editor from the left menu, then select New query.
3. Open D:/School-Management-System/supabase/schema.sql on your computer.
4. Copy all of the file and paste it into the SQL Editor.
5. Click Run once. Wait for a success message.
6. If Supabase shows an error, stop and share the error text before trying again.

The schema creates the student and staff roles, enrollment workflow, database security, and roll-number allocation. It is safe to rerun after future code updates.

## Step 2: Allow the website to return after email confirmation

1. In Supabase, choose Authentication → URL Configuration.
2. Set Site URL to:
   https://udayofficial-21.github.io/School-Management-System/
3. Under Redirect URLs, add:
   https://udayofficial-21.github.io/School-Management-System/index.html
   http://localhost:8000/index.html
4. Save changes and leave email confirmation enabled.

## Step 3: Set up the first Super Admin

The first staff role must be created by the Supabase project owner. The website has no public Admin registration.

1. Open D:/School-Management-System/supabase/bootstrap-admin.sql.
2. Replace REPLACE_WITH_ADMIN_EMAIL with the first Super Admin's actual email address. Keep the single quotes.
3. Copy the edited file into a new Supabase SQL Editor query and click Run.
4. If this email does not already have a confirmed Supabase account, choose Authentication → Users.
5. Click Add user and choose the option to send an invitation. Use the same email address.
6. The Super Admin opens the email, accepts the invitation, and sets up the account. If the account was already confirmed, the role is ready immediately.
7. They can now sign in from the regular website login page. The Admin workspace opens automatically.

If email invitations are not arriving, Supabase's default email sender may be limited. Set up an approved SMTP sender in Authentication → Emails before inviting real users.

## Step 4: Configure the school's roll-number format

1. Sign in with the Super Admin account.
2. On Administration overview, enter the school or college name.
3. Enter the college code provided by the institution, such as A05 only if that is your real code.
4. Keep the suggested format {YY}{COLLEGE}{BRANCH}{NUMBER}, or enter the school's approved template.
5. The tokens mean: {YY} is the last two year digits, {YEAR} is the full year, {COLLEGE} is the college code, {BRANCH} is the branch code, and {NUMBER} is a unique four-digit sequence.
6. Save settings before allocating rolls.

For example, year 2023, college code A05, branch code CSE, and first sequence number 0001 produce 23A05CSE0001. The system uses a unique sequence instead of random numbers to avoid duplicates. The format is editable if your school requires a different pattern.

## Step 5: Add staff roles

1. The Super Admin opens Staff access to assign the first Principal and other leadership roles.
2. The Principal can then assign Vice Principal, Registrar / College Admin, HOD, and Faculty roles.
3. The Super Admin or Principal can optionally delegate staff-role management to a Vice Principal. That Vice Principal can then assign only Registrar, HOD, and Faculty roles.
4. Enter the staff member's email. Enter a branch code for HOD or Faculty; Registrar access is school-wide.
5. A confirmed Supabase account receives its role immediately. For a new account, the portal prepares an invitation; send the account invitation from Supabase Authentication → Users. The role activates after the person confirms their email.

Role guide:
- Super Admin: system settings and all roles.
- Chairman: college-wide summary reports; no student editing.
- Principal: school-wide student operations and designated staff roles.
- Vice Principal: school-wide student operations; staff-role tools only when delegated.
- Registrar / College Admin: admissions, student records, registration IDs, and roll allocation.
- HOD: student and roll management for the assigned branch.
- Faculty: read-only roster for the assigned branch.

## Step 6: Enroll students

1. From the Admin navigation, open Students.
2. Enter the approved student's name and school email, admission year, branch name, and branch code. Other profile details are optional.
3. Click Add to approved roster.
4. The page shows the student's new registration ID. It follows the pattern year + branch code + unique sequence, for example 2023CSE277.
5. Open Roll allocation, select the student, and click Allocate selected rolls. The college code and branch code are included in the roll number.
6. Give the student their registration ID and the exact school email entered in the roster.

Use the blank supabase/student-roster-template.csv when you need to import a school-approved roster from the Supabase Table Editor.

## Step 7: Student registration and sign-in

1. Students use the same sign-in page as staff.
2. A new student chooses Register here.
3. They enter the registration ID provided by the school, the matching school email, and a password of at least eight characters.
4. They open the confirmation email and click its link.
5. They return to the website and sign in with their school email and password.
6. The website opens the student dashboard for students and the Admin workspace for staff, based on the role saved in Supabase.

A matching roster entry and a confirmed email are required. If a student sees a mismatch message, check the registration ID and email in the Supabase student_profiles table for spelling and spaces.

## Step 8: Local preview and live site

For local preview, open PowerShell in D:/School-Management-System and run:

    python -m http.server 8000

Keep the PowerShell window open, then open http://localhost:8000/index.html.

The code changes are pushed to the GitHub repository. The website is:
https://udayofficial-21.github.io/School-Management-System/

If a future code update is not visible right away, GitHub Pages may still be publishing. Refresh the website after deployment completes.
