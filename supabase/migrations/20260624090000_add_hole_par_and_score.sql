ALTER TABLE public.shots
  ADD COLUMN IF NOT EXISTS hole_par INTEGER,
  ADD COLUMN IF NOT EXISTS hole_score INTEGER;

COMMENT ON COLUMN public.shots.hole_par IS 'Par for the hole supplied by the round export.';
COMMENT ON COLUMN public.shots.hole_score IS 'Final strokes for the hole supplied by the round export.';
