CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_review_id TEXT,
  entry_date DATE NOT NULL,
  course_name TEXT,
  round_type TEXT NOT NULL DEFAULT 'Social',
  playing_partner_ids TEXT[] NOT NULL DEFAULT '{}',
  weather_conditions TEXT NOT NULL DEFAULT '',
  general_context TEXT NOT NULL DEFAULT '',
  overall_comments TEXT NOT NULL DEFAULT '',
  overall_feel_rating INTEGER CHECK (overall_feel_rating BETWEEN 1 AND 5),
  best_thing_today TEXT NOT NULL DEFAULT '',
  biggest_frustration TEXT NOT NULL DEFAULT '',
  main_learning TEXT NOT NULL DEFAULT '',
  focus_for_next_round TEXT NOT NULL DEFAULT '',
  categories JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries"
  ON public.journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON public.journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON public.journal_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON public.journal_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_date
  ON public.journal_entries(user_id, entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_course
  ON public.journal_entries(user_id, lower(course_name));

CREATE TABLE IF NOT EXISTS public.generated_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_type TEXT NOT NULL CHECK (reflection_type IN ('last5', 'course', 'preRound')),
  source_journal_entry_ids TEXT[] NOT NULL DEFAULT '{}',
  course_name TEXT,
  generated_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated reflections"
  ON public.generated_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated reflections"
  ON public.generated_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated reflections"
  ON public.generated_reflections FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_generated_reflections_user_created
  ON public.generated_reflections(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_reflections_user_type
  ON public.generated_reflections(user_id, reflection_type, created_at DESC);
