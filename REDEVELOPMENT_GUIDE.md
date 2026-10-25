# School Management System: redevelopment guide

## Current release

This is a static website hosted on GitHub Pages, using Supabase for sign-in and its database.

- Students and staff use the same sign-in page. After sign-in, the assigned role opens the student portal or the staff administration workspace.
- School staff enroll students before registration. A student account is linked only when the student enters the matching registration ID and school email and confirms that email.
- Super Admin manages staff roles and school-wide settings.
- Chairman, Principal, and Vice Principal can manage the school-wide roster and roll allocation.
- HOD can manage students and rolls for the assigned branch.
- Faculty can read the assigned branch roster; email, phone, and date of birth are withheld from the faculty roster view.
- The database checks each role and branch. Hiding a button in the website is not the security boundary.

## Student identifiers

The school-approved registration ID is generated from the admission year, branch code, and a unique number. For example, 2023 + CSE + 277 becomes 2023CSE277.

The separate roll number is allocated from the school format. The default template is {YY}{COLLEGE}{BRANCH}{NUMBER}; with year 2023, college code A05, branch CSE, and sequence 1, it becomes 23A05CSE0001. The number is sequential and unique rather than random, which prevents duplicate roll numbers. The Super Admin can customize the template in the administration overview. Supported tokens are {YY}, {YEAR}, {COLLEGE}, {BRANCH}, and {NUMBER}.

## Supabase setup

1. In the Supabase SQL Editor, run supabase/schema.sql. This creates or updates the tables, role rules, enrollment functions, and allocation functions. It does not delete student data.
2. The project URL and publishable key are in supabase-config.js. Only a publishable key belongs in the website. Never add a secret or service-role key.
3. In Authentication → URL Configuration, allow the deployed site and the local preview address:
   - https://udayofficial-21.github.io/School-Management-System/index.html
   - http://localhost:8000/index.html
4. Keep email confirmation enabled.

## First Super Admin

There is no public Admin sign-up. This prevents students from giving themselves staff permissions.

1. Open supabase/bootstrap-admin.sql and replace REPLACE_WITH_ADMIN_EMAIL with the first Super Admin's email address.
2. Run that edited file in the Supabase SQL Editor. If the email already has a confirmed account, the role is assigned immediately.
3. If it is a new or unconfirmed account, open Supabase Authentication → Users and send an invitation to that same email.
4. The person opens the invitation email and finishes account setup. The database then assigns the Super Admin role.
5. Sign in through the same website login page. The Super Admin workspace opens automatically.

After the first Super Admin signs in, use Staff access to assign Chairman, Principal, Vice Principal, HOD, Faculty, or additional Super Admin roles. For a new staff email, the app prepares the role invitation; send the actual account invitation from Supabase Authentication → Users. The role activates after email confirmation.

## School setup and daily use

1. On Administration overview, enter the school name and the college ID supplied by the institution. Choose the roll-number template and save it.
2. Open Students and add an approved student. Enter the name, school email, admission year, branch name, branch code, and any details the school needs. The app generates the registration ID.
3. Open Roll allocation, select eligible students, and allocate their unique roll numbers.
4. Give each student their registration ID and the school email that was entered in the roster.
5. The student opens Register here, enters that exact ID and email, chooses a password, and confirms the email. They then sign in on the shared login page.

The CSV in supabase/student-roster-demo.csv contains fictional sample rows only. Do not import those sample email addresses as real students. Use supabase/student-roster-template.csv for a real, approved roster.

## Preview and publish

For a local preview, open PowerShell in D:/School-Management-System and run:

    python -m http.server 8000

Keep that window open, then visit http://localhost:8000/index.html. The current project is connected to the GitHub repository and uses the main branch. GitHub Pages publishes at https://udayofficial-21.github.io/School-Management-System/.

## Current limits

This release covers role-based sign-in, student roster management, role assignment, and roll allocation. Staff screens for entering attendance, grades, timetables, announcements, and events are not included yet. Those features need their own scoped database permissions and workflows before school staff can edit those records in the browser.
