CREATE TABLE public.practice_drill_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  drill_id TEXT NOT NULL,
  drill_kind TEXT NOT NULL CHECK (drill_kind IN ('scorable','baseline')),
  config_key TEXT NOT NULL,
  score NUMERIC NOT NULL,
  max_score NUMERIC NOT NULL,
  balls INTEGER,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.practice_drill_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drill scores"
  ON public.practice_drill_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drill scores"
  ON public.practice_drill_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drill scores"
  ON public.practice_drill_scores FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own drill scores"
  ON public.practice_drill_scores FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_drill_scores_user_config ON public.practice_drill_scores(user_id, config_key, drill_id, score_date DESC);

CREATE TRIGGER update_practice_drill_scores_updated_at
  BEFORE UPDATE ON public.practice_drill_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();