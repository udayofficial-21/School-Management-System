# Beginner walkthrough: connect the Student Portal to Supabase

This guide explains the setup one step at a time. You do not need to write SQL yourself; the project includes the SQL file to copy and run.

## Before you begin

Have these ready:

- Your Supabase account.
- The approved list of students, including each student's Student ID and school email.
- Access to the GitHub repository `udayofficial-21/School-Management-System` when you are ready to publish.

Do not paste real student records into this chat. Supabase's browser key is called a **publishable key** and starts with `sb_publishable_`. It is designed to appear in a website. Do not use a **secret key** (`sb_secret_...`) or old `service_role` key in the website. The database access rules in the SQL file protect the data when Row Level Security is enabled. [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

### What the main words mean

- **Supabase project:** the online database and sign-in service for your school portal.
- **SQL schema:** setup instructions that create the portal's database tables and data rules.
- **Student roster:** the list of students the school has approved. Students cannot register until their ID and school email are on this list.
- **Publishable key:** the browser-safe connection key that points the website at your Supabase project.
- **Row Level Security (RLS):** database rules that restrict each student to their own records.

## Step 1: Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Choose an organization. If you do not have one, create one when Supabase offers that option.
3. Click **New project**.
4. Enter a project name, for example `school-management-system`.
5. Create a strong database password. Save it somewhere private. You will not put this password in the website.
6. Choose a region close to your school. For a school in India, choose Mumbai if it is offered; otherwise choose the closest available region.
7. Choose a plan and click **Create new project**. Wait until the project status shows that it is ready.

Your database password is different from the publishable key. Do not paste the database password into `supabase-config.js`.

## Step 2: Create the portal's tables and rules

1. Open your new project in the Supabase Dashboard.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. On your computer, open `D:\School-Management-System\supabase\schema.sql` in a text editor.
5. Press **Ctrl+A**, then **Ctrl+C** to copy all of its contents.
6. Return to the Supabase SQL Editor and click in the large query area. Press **Ctrl+V**.
7. Click **Run**.
8. Wait for the green success message. If you see an error, stop and copy the error text; do not keep pressing Run.

The schema creates the profile, attendance, results, timetable, announcements, and events tables, along with their initial RLS rules. Supabase recommends enabling RLS and granting only the access each browser role needs. [Supabase RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Step 3: Add the approved student roster

Students must be added by the school before they can register. Their school email must match the one in the roster.

1. In the Supabase sidebar, click **Table Editor**.
2. Open the table named **student_profiles**.
3. To prepare the roster on your computer, open `D:\School-Management-System\supabase\student-roster-template.csv` in Excel.
4. Add one student per row. Fill in `student_id`, `school_email`, and `full_name`. The other columns can be left blank if you do not have that information.
5. Save as **CSV UTF-8 (Comma delimited)**. Keep the exact column headings in row 1. Use dates as `YYYY-MM-DD`, for example `2007-04-23`; enter `study_year` as a number such as `1`, `2`, `3`, or `4`.
6. In Table Editor, choose **Insert** or **Import Data from CSV** and select your saved CSV. The current dashboard flow may show CSV import under the **Insert** menu. [Supabase CSV import guide](https://supabase.com/docs/guides/database/import-data)
7. Confirm the preview matches your columns, then import the rows.

Do not fill the `user_id`, `id`, `created_at`, or `updated_at` fields. Supabase fills those when needed. For a school in production, use only the personal data the school actually needs.

## Step 4: Put the two browser connection values in the project

1. In your Supabase project, click **Connect** near the top, or open **Project Settings → API Keys**.
2. Copy the **Project URL**. It looks like `https://abcdefghijk.supabase.co`.
3. Copy the **Publishable key**. It starts with `sb_publishable_`.
4. In this project, open `D:\School-Management-System\supabase-config.js`.
5. Replace only the two example values, keeping the quote marks. It should look like this:

```js
export const SUPABASE_URL = 'https://YOUR-REAL-PROJECT-REF.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_YOUR-REAL-PUBLIC-KEY';
```

Use your real values in place of the examples. Do not put your database password, `sb_secret_...`, or `service_role` key in this file. The publishable key is safe for browser code only when you keep the database RLS rules enabled. [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys)

## Step 5: Set the email confirmation return address

1. In Supabase, open **Authentication → URL Configuration**.
2. Set **Site URL** to:

   `https://udayofficial-21.github.io/School-Management-System/`

3. Add these exact entries under **Redirect URLs**:

   `https://udayofficial-21.github.io/School-Management-System/index.html`

   `http://localhost:8000/index.html`

4. Save the settings.
5. Keep email confirmation enabled. A student must click the email link before the roster row is linked to their account. Supabase only redirects to URLs allowed by this list. [Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls)

## Step 6: Open the local preview

Your in-app browser is already at `http://localhost:8000/index.html`. After saving `supabase-config.js`, refresh that page. The yellow setup message should disappear.

If the local page stops loading, leave this project folder open in File Explorer, open PowerShell in the folder, and run:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/index.html` again. Keep the PowerShell window open while you use the local preview.

## Step 7: Try one student account

1. Use a test row that you added to `student_profiles` (or a real student's approved school email if your school has authorized this use).
2. On the portal, click **Register here**.
3. Enter the exact Student ID and school email from the roster, then choose a password of at least 8 characters.
4. Open that email inbox and click the confirmation link.
5. Return to the portal and sign in with the school email and password.
6. The student's profile should load. Attendance, results, and timetable will show empty states until school staff add records.

If registration reports a roster mismatch, compare the Student ID and school email with the `student_profiles` row. Check for spaces or a typo.

## Step 8: Publish the changes to GitHub Pages

Your local folder `D:\School-Management-System` is not currently connected to Git, so its changes will not publish automatically. The public site will keep showing its old version until you upload these files to the GitHub repository.

The easiest visual method is **GitHub Desktop**:

1. Install and open GitHub Desktop, then sign in to GitHub.
2. Choose **File → Clone repository**.
3. Select the URL tab and enter `https://github.com/udayofficial-21/School-Management-System.git`.
4. Choose a separate destination folder, for example `D:\School-Management-System-github`. Click **Clone**.
5. Copy the updated project files from `D:\School-Management-System` into the cloned folder and allow Windows to replace files. Include the new `supabase` folder and the files `supabase-client.js`, `supabase-config.js`, and `REDEVELOPMENT_GUIDE.md`.
6. In GitHub Desktop, open the **Changes** tab. Enter a summary such as `Connect student portal to Supabase`, then click **Commit to main**.
7. Click **Push origin**.
8. On GitHub.com, open the repository and choose **Settings → Pages**. Confirm **Deploy from a branch**, branch **main**, and folder **/(root)**, then save if you changed anything.
9. Wait for the GitHub Pages deployment to finish, then open `https://udayofficial-21.github.io/School-Management-System/` and refresh.

GitHub Pages publishes static files from the selected branch and folder. Changes can take several minutes to appear after pushing. [GitHub Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## What is not ready yet

This is the student-facing Supabase foundation. Admin and teacher pages for entering attendance, marks, timetables, notices, and events are not built yet. Those records can currently be added by authorized school staff in the Supabase Dashboard. Add staff roles and carefully scoped write policies before allowing browser-based staff editing.
