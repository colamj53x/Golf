-- Putting drills: definitions (built-in + custom)
CREATE TABLE public.putting_drills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  category TEXT NOT NULL CHECK (category IN ('indoor','outdoor')),
  name TEXT NOT NULL,
  purpose TEXT,
  setup TEXT,
  reps INTEGER NOT NULL DEFAULT 20,
  scoring_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_score INTEGER NOT NULL DEFAULT 20,
  scaled BOOLEAN NOT NULL DEFAULT false,
  scaled_max INTEGER,
  level_bands JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendation TEXT,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.putting_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view builtin drills or own drills"
  ON public.putting_drills FOR SELECT
  USING (is_builtin = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert own drills"
  ON public.putting_drills FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_builtin = false);

CREATE POLICY "Users can update own drills"
  ON public.putting_drills FOR UPDATE
  USING (auth.uid() = user_id AND is_builtin = false);

CREATE POLICY "Users can delete own drills"
  ON public.putting_drills FOR DELETE
  USING (auth.uid() = user_id AND is_builtin = false);

CREATE TRIGGER trg_putting_drills_updated
  BEFORE UPDATE ON public.putting_drills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Putting sessions: completed sessions
CREATE TABLE public.putting_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'indoor' CHECK (category IN ('indoor','outdoor')),
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  carpet_speed TEXT,
  target_type TEXT,
  session_length TEXT,
  notes_before TEXT,
  total_score NUMERIC NOT NULL DEFAULT 0,
  max_total NUMERIC NOT NULL DEFAULT 100,
  level TEXT,
  best_drill TEXT,
  weakest_drill TEXT,
  main_miss TEXT,
  recommendation TEXT,
  drill_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.putting_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own putting sessions"
  ON public.putting_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own putting sessions"
  ON public.putting_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own putting sessions"
  ON public.putting_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own putting sessions"
  ON public.putting_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_putting_sessions_updated
  BEFORE UPDATE ON public.putting_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_putting_sessions_user_date
  ON public.putting_sessions(user_id, session_date DESC);