-- Create profiles table for user display names
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'display_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id columns to existing tables
ALTER TABLE public.shots ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.practice_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.practice_configs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow all operations on shots" ON public.shots;
DROP POLICY IF EXISTS "Allow all operations on practice_sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Allow all operations on practice_configs" ON public.practice_configs;

-- Create proper RLS policies for shots
CREATE POLICY "Users can view own shots"
ON public.shots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shots"
ON public.shots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shots"
ON public.shots FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shots"
ON public.shots FOR DELETE
USING (auth.uid() = user_id);

-- Create proper RLS policies for practice_sessions
CREATE POLICY "Users can view own practice_sessions"
ON public.practice_sessions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice_sessions"
ON public.practice_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice_sessions"
ON public.practice_sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice_sessions"
ON public.practice_sessions FOR DELETE
USING (auth.uid() = user_id);

-- Create proper RLS policies for practice_configs
CREATE POLICY "Users can view own practice_configs"
ON public.practice_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice_configs"
ON public.practice_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice_configs"
ON public.practice_configs FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice_configs"
ON public.practice_configs FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();