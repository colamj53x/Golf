-- Create shots table for storing golf shot data
CREATE TABLE public.shots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club TEXT NOT NULL,
  target NUMERIC,
  total NUMERIC,
  carry NUMERIC,
  offline NUMERIC,
  start_line TEXT,
  curve TEXT,
  end_lie TEXT,
  notes TEXT,
  shot_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security (but allow public read/write for simplicity since no auth)
ALTER TABLE public.shots ENABLE ROW LEVEL SECURITY;

-- Create policy allowing all operations (no auth required for this app)
CREATE POLICY "Allow all operations on shots" 
ON public.shots 
FOR ALL 
USING (true)
WITH CHECK (true);