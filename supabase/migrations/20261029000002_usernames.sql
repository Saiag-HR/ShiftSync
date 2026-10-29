-- ============================================================
-- Usernames: the login credential for each user
-- ============================================================
-- Supabase Auth still identifies users by email, so the app signs users up
-- with a generated address and looks them up by profiles.username at sign-in.

ALTER TABLE public.profiles ADD COLUMN username TEXT;

-- Builds a valid, unused username from free text (e.g. an email's local
-- part), for users created without one: existing users, or users added
-- from the Supabase dashboard.
CREATE OR REPLACE FUNCTION public.derive_username(source TEXT, user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  candidate TEXT;
BEGIN
  candidate := LEFT(REGEXP_REPLACE(LOWER(COALESCE(source, '')), '[^a-z0-9_.-]', '', 'g'), 23);

  IF LENGTH(candidate) >= 3
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) THEN
    RETURN candidate;
  END IF;

  RETURN candidate || '_' || LEFT(REPLACE(user_id::TEXT, '-', ''), 6);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.derive_username(TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- Backfill existing users, oldest first.
DO $$
DECLARE
  row RECORD;
BEGIN
  FOR row IN
    SELECT p.id, u.email
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.username IS NULL
    ORDER BY p.created_at
  LOOP
    UPDATE public.profiles
    SET username = public.derive_username(SPLIT_PART(row.email, '@', 1), row.id)
    WHERE id = row.id;
  END LOOP;
END;
$$;

-- Lowercase letters, digits, dot, dash and underscore; 3–30 characters.
-- The app lowercases input, so uniqueness is effectively case-insensitive.
ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT profiles_username_key UNIQUE (username),
  ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-z0-9_.-]{3,30}$');

-- ============================================================
-- Sign-up trigger: store the chosen username
-- ============================================================

-- A requested username is inserted as-is, so a taken or invalid one fails
-- the sign-up instead of silently becoming a different name.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested TEXT := NULLIF(LOWER(TRIM(NEW.raw_user_meta_data ->> 'username')), '');
BEGIN
  INSERT INTO public.profiles (id, full_name, username)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data ->> 'full_name'), ''),
      requested,
      SPLIT_PART(NEW.email, '@', 1),
      ''
    ),
    COALESCE(
      requested,
      public.derive_username(SPLIT_PART(NEW.email, '@', 1), NEW.id)
    )
  );
  RETURN NEW;
END;
$$;
