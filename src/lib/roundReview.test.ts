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
    expect(review.previous5.shotQualityIndex).toBeNull();
    expect(review.season.shotQualityIndex).toBeCloseTo(72.5);
  });

  it('calculates target success, safe shot rate, and scoring-zone success', () => {
    const review = buildRoundReview([
      shot('fairway-hit', '2026-05-31', 220, '10 Handicap', { club: 'Dr', type: 'Driving', targetIntent: 'fairway', startLie: 'Tee', endLie: 'Fairway' }),
      shot('fairway-miss', '2026-05-31', 220, '10 Handicap', { club: 'Dr', type: 'Driving', targetIntent: 'fairway', startLie: 'Tee', endLie: 'Rough' }),
      shot('green-hit', '2026-05-31', 80, '10 Handicap', { targetIntent: 'green', endLie: 'Green' }),
      shot('green-miss', '2026-05-31', 80, '10 Handicap', { targetIntent: 'green', endLie: 'Penalty' }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.round.targetSuccessPct).toBe(50);
    expect(review.round.scoringZoneSuccessPct).toBe(50);
    expect(review.round.scoringZoneSuccessCount).toBe(1);
    expect(review.round.safeShotRate).toBe(75);
  });

  it('uses last five and previous five round comparison periods', () => {
    const dates = Array.from({ length: 11 }, (_, index) => `2026-05-${String(index + 1).padStart(2, '0')}`);
    const review = buildRoundReview(dates.map((date, index) =>
      shot(`${index}`, date, 35, index < 5 ? '20 Handicap' : index < 10 ? '10 Handicap' : 'Pro')
    ), DEFAULT_CLUB_CONFIGS, 10, '2026-05-11');

    expect(review.last5.shotQualityIndex).toBe(70);
    expect(review.previous5.shotQualityIndex).toBe(45);
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

  it('infers unspecified targets for club and shot type rows', () => {
    const review = buildRoundReview([
      shot('driver', '2026-05-31', 220, '10 Handicap', { club: 'Dr', type: 'Driving' }),
      shot('five-wood', '2026-05-31', 190, '10 Handicap', { club: '5W' }),
      shot('four-hybrid', '2026-05-31', 180, '10 Handicap', { club: '4H' }),
      shot('five-hybrid', '2026-05-31', 170, '10 Handicap', { club: '5H' }),
      shot('punch', '2026-05-31', 115, '10 Handicap', { club: '7I', shotFamily: 'punch', swingEffort: 'full' }),
      shot('iron', '2026-05-31', 125, '10 Handicap', { club: '9I' }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    expect(review.clubAndTypeRows.map(row => [row.clubLabel, row.shotTypeLabel, row.targetLabel])).toEqual([
      ['Dr', 'Full', 'Fairway'],
      ['5W', 'Full', 'Fairway'],
      ['4H', 'Full', 'Fairway'],
      ['5H', 'Full', 'Green'],
      ['7I', 'Punch', 'Fairway'],
      ['9I', 'Full', 'Green'],
    ]);
  });

  it('adds green distance dominant club shot and lie share percentages', () => {
    const review = buildRoundReview([
      shot('nine-one', '2026-05-31', 125, '10 Handicap', { club: '9I' }),
      shot('nine-two', '2026-05-31', 126, '10 Handicap', { club: '9I' }),
      shot('pw', '2026-05-31', 124, '10 Handicap', { club: 'PW', startLie: 'Rough' }),
      shot('driver', '2026-05-31', 220, '10 Handicap', { club: 'Dr', type: 'Driving', startLie: 'Tee' }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31');

    const distanceRow = review.greenDistanceRows.find(row => row.key === '100-150');
    expect(distanceRow?.dominantClubShotLabel).toBe('9I / Full');
    expect(distanceRow?.dominantClubShotPct).toBeCloseTo(66.67, 1);
    expect(review.lieRows.map(row => [row.label, row.shareOfTotalPct])).toEqual([
      ['Tee', 25],
      ['Fairway', 50],
      ['Rough', 25],
    ]);
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

  it('aggregates the last 20 rounds and compares against earlier rounds', () => {
    const review = buildRoundReview([
      shot('prior', '2026-05-10', 35, '20 Handicap'),
      ...Array.from({ length: 21 }, (_, index) =>
        shot(`round-${index}`, `2026-05-${String(11 + index).padStart(2, '0')}`, 35, index === 0 ? '20 Handicap' : 'Pro')
      ),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31', undefined, 'last20');

    expect(review.scope).toBe('last20');
    expect(review.round.shotCount).toBe(20);
    expect(review.last5.shotCount).toBe(2);
  });

  it('aggregates the last 5 and last 10 round review scopes', () => {
    const rounds = Array.from({ length: 12 }, (_, index) =>
      shot(`round-${index}`, `2026-05-${String(20 + index).padStart(2, '0')}`, 35, 'Pro')
    );

    const last5 = buildRoundReview(rounds, DEFAULT_CLUB_CONFIGS, 10, '2026-05-31', undefined, 'last5');
    const last10 = buildRoundReview(rounds, DEFAULT_CLUB_CONFIGS, 10, '2026-05-31', undefined, 'last10');

    expect(last5.scope).toBe('last5');
    expect(last5.label).toBe('Last 5 Rounds');
    expect(last5.round.shotCount).toBe(5);
    expect(last10.scope).toBe('last10');
    expect(last10.label).toBe('Last 10 Rounds');
    expect(last10.round.shotCount).toBe(10);
  });

  it('can aggregate every round without inventing prior comparisons', () => {
    const review = buildRoundReview([
      shot('one', '2026-05-30', 35, '20 Handicap'),
      shot('two', '2026-05-31', 35, 'Pro'),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-05-31', undefined, 'all');

    expect(review.scope).toBe('all');
    expect(review.round.shotCount).toBe(2);
    expect(review.last5.shotCount).toBe(0);
    expect(review.recentThird.shotCount).toBe(0);
  });
});
