import { describe, expect, it } from 'vitest';
import { buildRoundReview } from './roundReview';
import { DEFAULT_CLUB_CONFIGS, Shot } from '@/types/golf';

const shot = (id: string, date: string, target: number, shotQuality: string, overrides: Partial<Shot> = {}): Shot => ({
  id,
  club: 'SW',
  type: 'Short',
  shotFamily: '',
  swingEffort: '',
  targetIntent: '',
  target,
  total: target,
  side: 0,
  shotQuality,
  date: new Date(`${date}T10:00:00`),
  startLie: 'Fairway',
  endLie: 'Green',
  strikeQuality: 'Centre',
  endDistanceFromTarget: 2,
  notes: '',
  ...overrides,
});

describe('buildRoundReview', () => {
  it('uses only rounds before the selected round for historical comparisons', () => {
    const review = buildRoundReview([
      shot('old', '2026-05-30', 35, '20 Handicap'),
      shot('selected', '2026-05-31', 35, 'Pro'),
      shot('future', '2026-06-01', 35, 'Pro'),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.round.shotQualityIndex).toBe(100);
    expect(review.last5.shotQualityIndex).toBe(45);
    expect(review.recentThird.shotQualityIndex).toBe(45);
  });

  it('excludes putting and keeps distance rollups separate from exact bands', () => {
    const review = buildRoundReview([
      shot('short', '2026-05-31', 35, '5 Handicap'),
      shot('putt', '2026-05-31', 4, 'Pro', { club: 'Pu', type: 'Putting', startLie: 'Green' }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.round.shotCount).toBe(1);
    expect(review.distanceRollups.map(row => [row.key, row.round.shotCount])).toEqual([['0-150', 1], ['0-100', 1]]);
    expect(review.distanceRows.map(row => [row.key, row.round.shotCount])).toEqual([['30-39', 1]]);
  });
});
