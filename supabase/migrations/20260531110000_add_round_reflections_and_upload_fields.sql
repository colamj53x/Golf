ALTER TABLE public.shots
  ADD COLUMN IF NOT EXISTS shot_family TEXT,
  ADD COLUMN IF NOT EXISTS swing_effort TEXT,
  ADD COLUMN IF NOT EXISTS target_intent TEXT;

CREATE TABLE IF NOT EXISTS public.round_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_date DATE NOT NULL,
  driving_notes TEXT,
  irons_notes TEXT,
  short_notes TEXT,
  putting_notes TEXT,
  mental_notes TEXT,
  course_management_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT round_reflections_user_round_date_key UNIQUE (user_id, round_date)
);

ALTER TABLE public.round_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own round reflections"
  ON public.round_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own round reflections"
  ON public.round_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own round reflections"
  ON public.round_reflections FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own round reflections"
  ON public.round_reflections FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_round_reflections_updated_at
  BEFORE UPDATE ON public.round_reflections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_round_reflections_user_date
  ON public.round_reflections(user_id, round_date DESC);
