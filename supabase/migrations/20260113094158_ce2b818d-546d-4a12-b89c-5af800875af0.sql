-- Create table for storing practice configuration targets per club/shot/power combination
CREATE TABLE public.practice_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE, -- e.g., '4h_full_full'
  club TEXT NOT NULL,
  shot_type TEXT NOT NULL,
  power TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.practice_configs ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations (single user app)
CREATE POLICY "Allow all operations on practice_configs"
ON public.practice_configs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_practice_configs_updated_at
BEFORE UPDATE ON public.practice_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();