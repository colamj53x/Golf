CREATE TABLE public.shot_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  club_id TEXT NOT NULL,
  shot_type TEXT NOT NULL,
  power TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  show_in_practice BOOLEAN NOT NULL DEFAULT true,
  show_on_course BOOLEAN NOT NULL DEFAULT true,
  targets TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  technique TEXT,
  routine TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT shot_profiles_user_profile_key UNIQUE (user_id, profile_key),
  CONSTRAINT shot_profiles_targets_check CHECK (targets <@ ARRAY['green', 'fairway']::TEXT[])
);

ALTER TABLE public.shot_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own shot_profiles"
ON public.shot_profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shot_profiles"
ON public.shot_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shot_profiles"
ON public.shot_profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shot_profiles"
ON public.shot_profiles FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_shot_profiles_updated_at
BEFORE UPDATE ON public.shot_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_shot_profiles_user_club
ON public.shot_profiles(user_id, club_id, shot_type, power);
