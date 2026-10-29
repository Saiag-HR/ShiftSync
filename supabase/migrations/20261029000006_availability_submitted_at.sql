-- ============================================================
-- Submission time for availability (first come, first served)
-- ============================================================
-- submitted_at is when the employee marked themselves available for that
-- shift. It's set by the database, never by the client, and only moves
-- when a shift changes from unavailable to available, so re-saving the
-- form doesn't lose an employee's place in line.

ALTER TABLE public.shift_availabilities
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE;

-- Existing rows have no known submission time; they share one timestamp
-- and are ordered by employee name in the app.
UPDATE public.shift_availabilities
SET submitted_at = NOW()
WHERE submitted_at IS NULL;

ALTER TABLE public.shift_availabilities
  ALTER COLUMN submitted_at SET DEFAULT NOW(),
  ALTER COLUMN submitted_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_availability_submitted_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.submitted_at := NOW();
  ELSIF NEW.is_available IS TRUE AND OLD.is_available IS NOT TRUE THEN
    NEW.submitted_at := NOW();
  ELSE
    NEW.submitted_at := OLD.submitted_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_availability_submitted_at ON public.shift_availabilities;
CREATE TRIGGER set_availability_submitted_at
  BEFORE INSERT OR UPDATE ON public.shift_availabilities
  FOR EACH ROW EXECUTE FUNCTION public.set_availability_submitted_at();

CREATE INDEX IF NOT EXISTS shift_availabilities_queue_idx
  ON public.shift_availabilities (shift_date, shift_type, submitted_at)
  WHERE is_available;
