# ShiftSync

Shift scheduling for teams: employees submit their availability for morning, evening and night shifts, and admins build the final schedule.

Built with Next.js (App Router), TypeScript, Tailwind CSS and Supabase.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and publishable (anon) key from Supabase Dashboard → Project Settings → API.

3. Apply the database migrations in `supabase/migrations/`, in order, with `npx supabase db push` or the Supabase SQL Editor.

4. In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/confirm` to the Redirect URLs.

5. Start the development server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Roles

New users sign up as employees. To make someone an admin, run this in the Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<user-id>';
```
