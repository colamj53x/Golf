import { describe, expect, it } from 'vitest';
import { buildRoundReview, getRoundReviewShotLabel } from './roundReview';
import { DEFAULT_CLUB_CONFIGS, Shot } from '@/types/golf';

const shot = (id: string, date: string, target: number, shotQuality: string, overrides: Partial<Shot> = {}): Shot => ({
  id,
  club: 'SW',
  type: 'Short',
  shotFamily: '',
  swingEffort: '',
  targetIntent: '',
  holeNumber: null,
  shotNumber: null,
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
      shot('short', '2026-05-31', 35, '5 Handicap', { targetIntent: 'green' }),
      shot('putt', '2026-05-31', 4, 'Pro', { club: 'Pu', type: 'Putting', startLie: 'Green' }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.round.shotCount).toBe(1);
    expect(review.greenDistanceRollups.map(row => [row.key, row.round.shotCount])).toEqual([['0-150', 1], ['0-100', 1]]);
    expect(review.greenDistanceRows.map(row => [row.key, row.round.shotCount])).toEqual([['30-39', 1]]);
  });

  it('uses the reviewed Gapping vocabulary for club and shot type rows', () => {
    const pitch = shot('pitch', '2026-05-31', 35, '5 Handicap', { shotFamily: 'pitch', swingEffort: '9pm', targetIntent: 'green' });
    const bump = shot('bump', '2026-05-31', 18, '10 Handicap', { club: '8I', shotFamily: 'bump', swingEffort: '9pm', targetIntent: 'green' });
    const review = buildRoundReview([pitch, bump], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(getRoundReviewShotLabel(pitch)).toBe('Pitch Half');
    expect(getRoundReviewShotLabel(bump)).toBe('Bump Half');
    expect(review.clubAndTypeRows.map(row => row.label)).toEqual(['SW · Pitch · Half · Green', '8I · Bump · Half · Green']);
    expect(review.clubAndTypeRows.map(row => row.targetLabel)).toEqual(['Green', 'Green']);
  });

  it('suppresses a misleading distance breakdown when every stored target has collapsed below 10m', () => {
    const review = buildRoundReview([
      shot('driver', '2026-05-31', 0, '10 Handicap', { club: 'Dr', type: 'Driving', total: 220 }),
      shot('approach', '2026-05-31', 0, '10 Handicap', { club: '8I', type: 'Approach', total: 125 }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.distanceWarning).toContain('are incomplete');
    expect(review.greenDistanceRollups).toEqual([]);
    expect(review.greenDistanceRows).toEqual([]);
  });

  it('calculates shots to green from the uploaded hole sequence', () => {
    const review = buildRoundReview([
      shot('approach', '2026-05-31', 35, '10 Handicap', { targetIntent: 'green', holeNumber: 1, shotNumber: 2, endLie: 'Rough' }),
      shot('chip', '2026-05-31', 8, '5 Handicap', { targetIntent: 'green', holeNumber: 1, shotNumber: 3, endLie: 'Green' }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.hasShotSequence).toBe(true);
    expect(review.greenDistanceRows.map(row => [row.key, row.avgShotsToGreen])).toEqual([['30-39', 2], ['0-9', 1]]);
  });
});
