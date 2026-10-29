-- ============================================================
-- System settings
-- ============================================================

CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT availability_open_is_boolean
    CHECK (key <> 'availability_open' OR jsonb_typeof(value) = 'boolean')
);

INSERT INTO public.system_settings (key, value)
VALUES ('availability_open', 'true'::jsonb);

CREATE TRIGGER set_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read settings; only admins can change them.
-- No insert/delete policies: settings rows are managed by migrations.
CREATE POLICY "Signed-in users can view settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- Lets open employee pages lock and unlock live when an admin toggles it.
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_settings;

-- ============================================================
-- Enforce the availability lock in the database
-- ============================================================

-- Missing row counts as open, matching the app's default.
CREATE OR REPLACE FUNCTION public.is_availability_open()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::BOOLEAN
     FROM public.system_settings
     WHERE key = 'availability_open'),
    true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_availability_open() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_availability_open() TO authenticated;

-- shift_availabilities: employees read and write only their own rows, and
-- can only write while submission is open. Admins can always read and write.
-- (The SELECT policy from the earlier migration already limits employees to
-- their own rows and is unchanged.)
DROP POLICY "Add own availability or any as admin" ON public.shift_availabilities;
DROP POLICY "Update own availability or any as admin" ON public.shift_availabilities;
DROP POLICY "Delete own availability or any as admin" ON public.shift_availabilities;

CREATE POLICY "Add own availability while open, or any as admin"
  ON public.shift_availabilities FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR (employee_id = (SELECT auth.uid()) AND (SELECT public.is_availability_open()))
  );

CREATE POLICY "Update own availability while open, or any as admin"
  ON public.shift_availabilities FOR UPDATE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (employee_id = (SELECT auth.uid()) AND (SELECT public.is_availability_open()))
  )
  WITH CHECK (
    (SELECT public.is_admin())
    OR (employee_id = (SELECT auth.uid()) AND (SELECT public.is_availability_open()))
  );

CREATE POLICY "Delete own availability while open, or any as admin"
  ON public.shift_availabilities FOR DELETE
  TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (employee_id = (SELECT auth.uid()) AND (SELECT public.is_availability_open()))
  );
