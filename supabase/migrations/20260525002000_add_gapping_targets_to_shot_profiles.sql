ALTER TABLE public.shot_profiles
  ADD COLUMN target_total NUMERIC,
  ADD COLUMN target_carry NUMERIC,
  ADD COLUMN target_side_left NUMERIC,
  ADD COLUMN target_side_right NUMERIC;
