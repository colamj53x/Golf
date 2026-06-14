ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS one_line_story TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS feel_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS evidence_match TEXT CHECK (evidence_match IN ('yes', 'partly', 'no')),
  ADD COLUMN IF NOT EXISTS evidence_match_reason TEXT NOT NULL DEFAULT '';
