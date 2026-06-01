import { supabase } from '@/integrations/supabase/client';
import { BlastMotionSetData } from '@/types/putting';

export const BLAST_METRIC_FIELDS = [
  ['tempo_ratio', 'Tempo ratio', '0.1'],
  ['backstroke_time', 'Backstroke sec', '0.01'],
  ['forwardstroke_time', 'Forward sec', '0.01'],
  ['total_stroke_time', 'Total stroke sec', '0.01'],
  ['tempo_consistency', 'Consistency %', '1'],
  ['face_rotation', 'Face rotation', '0.1'],
  ['lie_loft_change', 'Lie / loft change', '0.1'],
  ['stroke_length', 'Stroke length', '0.1'],
] as const;

export async function extractBlastMetrics(screenshotDataUrls: string[]): Promise<BlastMotionSetData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again before reading screenshots.');
  const response = await fetch('/api/extract-putting-metrics', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ screenshots: screenshotDataUrls }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not read the Blast screenshots.');
  return body.metrics as BlastMotionSetData;
}
