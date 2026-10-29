-- ============================================================
-- Configurable shift hours
-- ============================================================
-- Stored in system_settings, so the existing policies apply: everyone
-- signed in can read them, only admins can update them, and changes are
-- broadcast over Realtime to open pages.
--
-- Shape: {"morning": {"start": "07:00", "end": "15:00"}, "evening": {...}, "night": {...}}
-- A shift whose end is earlier than its start runs past midnight.

CREATE OR REPLACE FUNCTION public.is_valid_shift_hours(hours JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT jsonb_typeof(hours) = 'object'
    AND (
      SELECT bool_and(
        jsonb_typeof(hours -> shift) = 'object'
        AND (hours -> shift ->> 'start') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND (hours -> shift ->> 'end') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        AND (hours -> shift ->> 'start') <> (hours -> shift ->> 'end')
      )
      FROM unnest(ARRAY['morning', 'evening', 'night']) AS shift
    );
$$;

ALTER TABLE public.system_settings
  ADD CONSTRAINT shift_hours_is_valid
    CHECK (key <> 'shift_hours' OR public.is_valid_shift_hours(value));

INSERT INTO public.system_settings (key, value)
VALUES (
  'shift_hours',
  '{
    "morning": {"start": "07:00", "end": "15:00"},
    "evening": {"start": "15:00", "end": "23:00"},
    "night":   {"start": "23:00", "end": "07:00"}
  }'::jsonb
);
