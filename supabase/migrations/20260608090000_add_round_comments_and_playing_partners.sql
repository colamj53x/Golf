ALTER TABLE public.round_reflections
  ADD COLUMN IF NOT EXISTS general_comments TEXT,
  ADD COLUMN IF NOT EXISTS playing_partner_ids TEXT[] NOT NULL DEFAULT '{}';
