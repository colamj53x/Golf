-- Harden SECURITY DEFINER trigger function to validate display_name and handle conflicts
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  -- Bound user-provided value to a safe length
  v_display_name := NULLIF(TRIM(SUBSTRING(COALESCE(new.raw_user_meta_data ->> 'display_name', ''), 1, 100)), '');

  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, v_display_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Don't block signup if profile creation fails
  RAISE WARNING 'Failed to create profile for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;