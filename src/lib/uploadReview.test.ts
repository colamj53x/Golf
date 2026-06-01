import { describe, expect, it } from 'vitest';
import { getUploadShotFingerprint } from '@/lib/uploadReview';

const baseShot = {
  club: 'DR',
  shot_type: 'Driving',
  target: 245,
  total: 227,
  offline: 4,
  start_lie: 'Tee',
  end_lie: 'Fairway',
  strike_quality: 'Flush',
  shot_quality: '10 Handicap',
  end_distance_from_target: 18,
  notes: '',
  shot_date: '2026-05-31',
};

describe('getUploadShotFingerprint', () => {
  it('normalizes equivalent club labels when detecting duplicate uploads', () => {
    expect(getUploadShotFingerprint(baseShot)).toBe(
      getUploadShotFingerprint({ ...baseShot, club: 'Driver' }),
    );
  });

  it('treats different target distances as different shots', () => {
    expect(getUploadShotFingerprint(baseShot)).not.toBe(
      getUploadShotFingerprint({ ...baseShot, target: 235 }),
    );
  });
});
