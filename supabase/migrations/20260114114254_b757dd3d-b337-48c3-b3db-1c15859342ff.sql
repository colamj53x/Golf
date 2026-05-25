-- Create table to store individual practice shots
CREATE TABLE public.practice_shots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
  shot_number INTEGER NOT NULL,
  excluded BOOLEAN NOT NULL DEFAULT false,
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.practice_shots ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own practice shots" 
ON public.practice_shots 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own practice shots" 
ON public.practice_shots 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own practice shots" 
ON public.practice_shots 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own practice shots" 
ON public.practice_shots 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_practice_shots_session_id ON public.practice_shots(session_id);
CREATE INDEX idx_practice_shots_user_id ON public.practice_shots(user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_practice_shots_updated_at
BEFORE UPDATE ON public.practice_shots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();