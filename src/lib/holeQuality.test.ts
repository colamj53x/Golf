import { describe, expect, it } from 'vitest';
import { buildHoleQualityModel, getHoleQualityTargetScore } from '@/lib/holeQuality';
import type { Shot } from '@/types/golf';

function shot(id: string, holeNumber: number | null, shotQuality: string, overrides: Partial<Shot> = {}): Shot {
  return {
    id,
    club: '7I',
    type: 'Approach',
    shotFamily: 'full',
    swingEffort: 'full',
    targetIntent: 'green',
    holeNumber,
    shotNumber: 1,
    holePar: null,
    holeScore: null,
    target: 140,
    total: 135,
    side: 2,
    shotQuality,
    date: new Date('2026-06-23T10:00:00'),
    startLie: 'Fairway',
    endLie: 'Green',
    strikeQuality: 'Centre',
    endDistanceFromTarget: 5,
    notes: '',
    ...overrides,
  };
}

describe('hole quality', () => {
  it('averages shots within each hole, then weights every hole equally', () => {
    const model = buildHoleQualityModel([
      shot('h1-1', 1, 'Pro'),
      shot('h1-2', 1, 'Pro'),
      shot('h2-1', 2, '25 Handicap'),
      shot('h2-2', 2, '25 Handicap'),
      shot('h2-3', 2, '25 Handicap'),
      shot('h2-4', 2, '25 Handicap'),
    ], ['2026-06-23'], 10);

    expect(model.holes.map((hole) => hole.sqi)).toEqual([100, 25]);
    expect(model.averageHoleSqi).toBe(62.5);
    expect(model.atTargetPct).toBe(50);
    expect(model.targetScore).toBe(70);
  });

  it('summarises greens in regulation by par', () => {
    const model = buildHoleQualityModel([
      shot('par3', 3, '5 Handicap', { holePar: 3, holeScore: 3, shotNumber: 1, endLie: 'Green' }),
      shot('par4-a', 4, '10 Handicap', { holePar: 4, holeScore: 4, shotNumber: 1, endLie: 'Fairway' }),
      shot('par4-b', 4, '10 Handicap', { holePar: 4, holeScore: 4, shotNumber: 2, endLie: 'Green' }),
      shot('par5-a', 5, '10 Handicap', { holePar: 5, holeScore: 6, shotNumber: 3, endLie: 'Fairway' }),
      shot('par5-b', 5, '15 Handicap', { holePar: 5, holeScore: 6, shotNumber: 4, endLie: 'Green' }),
    ], ['2026-06-23'], 10);

    expect(model.byPar).toEqual([
      expect.objectContaining({ par: 3, holeCount: 1, girCount: 1, girAttemptCount: 1, girPct: 100, regulationShot: 1, averageShotsToGreen: 1 }),
      expect.objectContaining({ par: 4, holeCount: 1, girCount: 1, girAttemptCount: 1, girPct: 100, regulationShot: 2, averageShotsToGreen: 2 }),
      expect.objectContaining({ par: 5, holeCount: 1, girCount: 0, girAttemptCount: 1, girPct: 0, regulationShot: 3, averageShotsToGreen: 4 }),
    ]);
    expect(model.holesWithParCount).toBe(3);
  });

  it('counts holes under, at, and over the handicap target', () => {
    const model = buildHoleQualityModel([
      shot('under', 1, '5 Handicap'),
      shot('at', 2, '10 Handicap'),
      shot('over', 3, '15 Handicap'),
    ], ['2026-06-23'], 10);

    expect(model.targetSummary).toEqual({
      underCount: 1,
      atCount: 1,
      overCount: 1,
      ratedHoleCount: 3,
    });
  });

  it('ignores putting, missing hole numbers, and unrated shots in the SQI denominator', () => {
    const model = buildHoleQualityModel([
      shot('rated', 1, '10 Handicap'),
      shot('unrated', 1, ''),
      shot('putt', 1, 'Pro', { club: 'Pu', type: 'Putting' }),
      shot('no-hole', null, 'Pro'),
    ], ['2026-06-23'], 15);

    expect(model.holes).toHaveLength(1);
    expect(model.holes[0]).toMatchObject({ shotCount: 2, ratedShotCount: 1, sqi: 70 });
    expect(getHoleQualityTargetScore(15)).toBe(60);
  });
});
