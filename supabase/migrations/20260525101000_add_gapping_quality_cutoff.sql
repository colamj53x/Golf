ALTER TABLE public.shot_profiles
  ADD COLUMN IF NOT EXISTS target_quality_cutoff NUMERIC;
