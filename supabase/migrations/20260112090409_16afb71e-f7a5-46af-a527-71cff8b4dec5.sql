-- Add new columns to shots table for full CSV support
ALTER TABLE public.shots 
ADD COLUMN IF NOT EXISTS start_lie text,
ADD COLUMN IF NOT EXISTS strike_quality text,
ADD COLUMN IF NOT EXISTS shot_quality text,
ADD COLUMN IF NOT EXISTS end_distance_from_target numeric;

-- Rename start_line to type if it exists (it was being used incorrectly)
-- Actually, start_line is already there, let's add a type column
ALTER TABLE public.shots 
ADD COLUMN IF NOT EXISTS shot_type text;