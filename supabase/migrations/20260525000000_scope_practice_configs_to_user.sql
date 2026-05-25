-- Allow each user to save independent targets for the same club/shot/power key.
ALTER TABLE public.practice_configs
  DROP CONSTRAINT IF EXISTS practice_configs_config_key_key;

ALTER TABLE public.practice_configs
  ADD CONSTRAINT practice_configs_user_id_config_key_key UNIQUE (user_id, config_key);
