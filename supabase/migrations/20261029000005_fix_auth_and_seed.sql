-- ============================================================
-- Fix auth accounts, relax usernames, tighten profile reads, seed users
-- ============================================================
-- Safe to run more than once.

-- ------------------------------------------------------------
-- 1. Flexible usernames: any language, spaces and capitals
-- ------------------------------------------------------------
-- The display form is kept as typed. Uniqueness and sign-in use
-- username_key, a lowercased copy, so "NoaNah" and "noanah" are the same
-- user. The only rules left: not blank, no surrounding spaces, ≤ 50 chars.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_valid;

-- Same normalization the app applies (src/lib/username.ts).
CREATE OR REPLACE FUNCTION public.normalize_username(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(
    REGEXP_REPLACE(
      REGEXP_REPLACE(NORMALIZE(COALESCE(raw, ''), NFC), '^\s+|\s+$', '', 'g'),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;

UPDATE public.profiles
SET username = COALESCE(public.normalize_username(username), 'user_' || LEFT(REPLACE(id::TEXT, '-', ''), 6))
WHERE username IS DISTINCT FROM public.normalize_username(username);

-- Resolve names that only differ by case: the oldest keeps the name.
UPDATE public.profiles p
SET username = LEFT(p.username, 43) || '_' || LEFT(REPLACE(p.id::TEXT, '-', ''), 6)
WHERE EXISTS (
  SELECT 1 FROM public.profiles older
  WHERE LOWER(older.username) = LOWER(p.username)
    AND (older.created_at, older.id) < (p.created_at, p.id)
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username_key TEXT GENERATED ALWAYS AS (LOWER(username)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key_unique
  ON public.profiles (username_key);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_valid
    CHECK (username = public.normalize_username(username) AND CHAR_LENGTH(username) <= 50);

-- Builds an unused username for accounts created without one (e.g. from
-- the Supabase dashboard).
CREATE OR REPLACE FUNCTION public.derive_username(source TEXT, user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  candidate TEXT := LEFT(COALESCE(public.normalize_username(source), 'user'), 43);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE username_key = LOWER(candidate)) THEN
    RETURN candidate;
  END IF;
  RETURN candidate || '_' || LEFT(REPLACE(user_id::TEXT, '-', ''), 6);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.derive_username(TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- A requested username is inserted as given, so a taken one fails the
-- sign-up instead of silently becoming a different name.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested TEXT := public.normalize_username(NEW.raw_user_meta_data ->> 'username');
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      requested,
      SPLIT_PART(NEW.email, '@', 1),
      ''
    ),
    COALESCE(requested, public.derive_username(SPLIT_PART(NEW.email, '@', 1), NEW.id))
  );
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 2. Profiles: employees read only their own; admins read all
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "View own profile or all as admin" ON public.profiles;

CREATE POLICY "View own profile or all as admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

-- ------------------------------------------------------------
-- 3. Seed accounts
-- ------------------------------------------------------------
-- Creates each account if its username is free, otherwise updates the
-- existing one (password, name, role). Accounts get a generated email that
-- never receives mail; sign-in is by username.

CREATE OR REPLACE FUNCTION pg_temp.upsert_seed_user(
  p_username TEXT,
  p_full_name TEXT,
  p_role public.user_role,
  p_password TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
  v_email TEXT;
BEGIN
  SELECT id INTO v_id FROM public.profiles WHERE username_key = LOWER(p_username);

  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    v_email := v_id::TEXT || '@users.shiftsync.invalid';

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
      NOW(), '{"provider": "email", "providers": ["email"]}'::JSONB,
      jsonb_build_object('username', p_username, 'full_name', p_full_name),
      NOW(), NOW(),
      '', '', '', ''
    );
    -- handle_new_user has now created the profile.
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_id;
  END IF;

  UPDATE public.profiles
  SET full_name = p_full_name, role = p_role
  WHERE id = v_id;
END;
$$;

SELECT pg_temp.upsert_seed_user('NoaNah', 'נועה נח', 'admin', '123456');
SELECT pg_temp.upsert_seed_user('employee1', 'עובד 1', 'employee', '123456');
SELECT pg_temp.upsert_seed_user('employee2', 'עובד 2', 'employee', '123456');

-- ------------------------------------------------------------
-- 4. Repair hand-made auth accounts
-- ------------------------------------------------------------
-- Supabase Auth fails with "Database error querying schema" (HTTP 500)
-- on accounts whose token columns are NULL or that have no email or
-- identity, which happens when users are inserted with SQL.

-- Give accounts without an email a generated one (sign-in is by username).
UPDATE auth.users
SET email = id::TEXT || '@users.shiftsync.invalid'
WHERE email IS NULL OR email = '';

UPDATE auth.users
SET aud = COALESCE(aud, 'authenticated'),
    role = COALESCE(role, 'authenticated'),
    instance_id = COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider": "email", "providers": ["email"]}'::JSONB),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::JSONB)
WHERE aud IS NULL OR role IS NULL OR instance_id IS NULL
   OR raw_app_meta_data IS NULL OR raw_user_meta_data IS NULL;

-- Token columns must be '' rather than NULL. Only touch columns this
-- Supabase version has.
DO $$
DECLARE
  col TEXT;
BEGIN
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users'
      AND column_name IN (
        'confirmation_token', 'recovery_token', 'email_change_token_new',
        'email_change_token_current', 'email_change', 'phone_change',
        'phone_change_token', 'reauthentication_token'
      )
  LOOP
    EXECUTE format('UPDATE auth.users SET %I = '''' WHERE %I IS NULL', col, col);
  END LOOP;
END;
$$;

-- Every email account needs an identity row to sign in with a password.
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  u.id::TEXT,
  u.id,
  jsonb_build_object('sub', u.id::TEXT, 'email', u.email, 'email_verified', true),
  'email',
  NOW(), NOW(), NOW()
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
);

-- Users without a profile (e.g. created before the sign-up trigger).
INSERT INTO public.profiles (id, full_name, username)
SELECT
  u.id,
  COALESCE(NULLIF(BTRIM(u.raw_user_meta_data ->> 'full_name'), ''), SPLIT_PART(u.email, '@', 1)),
  public.derive_username(
    COALESCE(u.raw_user_meta_data ->> 'username', SPLIT_PART(u.email, '@', 1)),
    u.id
  )
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);
