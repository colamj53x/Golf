ALTER TABLE public.shot_profiles
ADD COLUMN IF NOT EXISTS target_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
