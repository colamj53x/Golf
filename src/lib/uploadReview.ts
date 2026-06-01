import { normalizeClubCode } from '@/types/golf';

export interface UploadShotFingerprintInput {
  club: string;
  shot_type?: string | null;
  target?: number | null;
  total?: number | null;
  offline?: number | null;
  start_lie?: string | null;
  end_lie?: string | null;
  strike_quality?: string | null;
  shot_quality?: string | null;
  end_distance_from_target?: number | null;
  notes?: string | null;
  shot_date?: string | null;
}

export function getUploadShotFingerprint(shot: UploadShotFingerprintInput): string {
  return [
    shot.shot_date ?? '',
    normalizeClubCode(shot.club),
    shot.shot_type ?? '',
    shot.target ?? '',
    shot.total ?? '',
    shot.offline ?? '',
    shot.start_lie ?? '',
    shot.end_lie ?? '',
    shot.strike_quality ?? '',
    shot.shot_quality ?? '',
    shot.end_distance_from_target ?? '',
    shot.notes ?? '',
  ].join('|');
}
