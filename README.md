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

Users sign up and sign in with a username and password; no email is needed. Supabase Auth still requires an email per account, so the app generates one (`<username>@users.shiftsync.invalid`) that never receives mail, and creates the account already confirmed.

Supabase enforces its own minimum password length (6 characters at least); the app adds no password rules of its own.

## Roles

New users sign up as employees. To make someone an admin, run this in the Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE username = '<username>';
```
