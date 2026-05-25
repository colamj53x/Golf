-- Create drill results table for tracking practice drills (starting with putting)
CREATE TABLE IF NOT EXISTS public.drill_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  drill_key text NOT NULL,
  drill_name text NOT NULL,
  variation_label text,
  variation_distance_m numeric,
  attempts integer NOT NULL,
  makes integer NOT NULL,
  notes text,
  session_date date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drill_results ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own drill_results" ON public.drill_results;
DROP POLICY IF EXISTS "Users can insert own drill_results" ON public.drill_results;
DROP POLICY IF EXISTS "Users can update own drill_results" ON public.drill_results;
DROP POLICY IF EXISTS "Users can delete own drill_results" ON public.drill_results;

CREATE POLICY "Users can view own drill_results"
ON public.drill_results
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drill_results"
ON public.drill_results
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drill_results"
ON public.drill_results
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own drill_results"
ON public.drill_results
FOR DELETE
USING (auth.uid() = user_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_drill_results_user_date ON public.drill_results (user_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_drill_results_user_drill ON public.drill_results (user_id, drill_key);

-- Updated-at trigger
DROP TRIGGER IF EXISTS update_drill_results_updated_at ON public.drill_results;
CREATE TRIGGER update_drill_results_updated_at
BEFORE UPDATE ON public.drill_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();