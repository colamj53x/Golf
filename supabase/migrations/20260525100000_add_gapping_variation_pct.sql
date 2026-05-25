ALTER TABLE public.shot_profiles
  ADD COLUMN IF NOT EXISTS target_variation_pct NUMERIC;
