# ShiftSync

Shift scheduling for teams: employees submit their availability for morning, evening and night shifts, and admins build the final schedule. The interface is in Hebrew (right-to-left).

Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in, from Supabase Dashboard → Project Settings → API Keys:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`: a secret key, used only on the server to create accounts and look up usernames at sign-in. Never commit it or expose it to the browser.

3. Apply the database migrations in `supabase/migrations/`, in order, with `npx supabase db push` or the Supabase SQL Editor.

4. Start the development server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Accounts

Users sign up and sign in with a username and password; no email is needed. Usernames can use Hebrew, English, numbers and spaces (up to 50 characters) and are matched case-insensitively. Supabase Auth still requires an email per account, so the app generates one (`<uuid>@users.shiftsync.invalid`) that never receives mail, and creates the account already confirmed.

Supabase enforces its own minimum password length (6 characters at least); the app adds no password rules of its own.

Don't create users by inserting into `auth.users` by hand: rows missing Supabase's required fields make Auth fail with HTTP 500 for that user. Sign up through the app, or see migration `20261029000005` for a working pattern.

## Roles and user management

New users sign up as employees. Admins manage users at `/admin/users`: change roles and set a new password for anyone who can't sign in. Passwords are stored only as hashes and can't be viewed.

To make the first admin, run this in the Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE username_key = lower('<username>');
```

Migration `20261029000005` seeds `NoaNah` (admin), `employee1` and `employee2`, all with password `123456`. Change these passwords after the first sign-in.
