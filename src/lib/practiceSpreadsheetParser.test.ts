import { describe, expect, it } from 'vitest';
import { calculateMetricsFromShots, type PracticeShot } from '@/lib/practiceSpreadsheetParser';

const shot = (total: number, carrySide = 0): PracticeShot => ({
  shotNumber: total,
  tempo: '3:1',
  carry: total - 8,
  total,
  ballSpeed: 0,
  height: 0,
  launchAngle: 0,
  launchDirection: 0,
  carrySide,
  backswingTime: 0,
  downswingTime: 0,
  attackAngle: 0,
  swingSpeed: 0,
  peakHandSpeed: 0,
});

describe('calculateMetricsFromShots', () => {
  it('uses the full distance target band for consistency scoring', () => {
    const result = calculateMetricsFromShots([
      shot(22, 1),
      shot(24, -2),
      shot(25, 0),
    ], 22, 25, 3);

    expect(result.consistency).toMatchObject({
      distanceCount: 3,
      lateralCount: 3,
      bestCount: 3,
      distancePct: 100,
      lateralPct: 100,
      bestPct: 100,
      overallScore: 100,
    });
  });

  it('counts shots above the max distance as outside the distance target', () => {
    const result = calculateMetricsFromShots([
      shot(24, 1),
      shot(26, 1),
    ], 22, 25, 3);

    expect(result.consistency.distanceCount).toBe(1);
    expect(result.consistency.bestCount).toBe(1);
    expect(result.consistency.distancePct).toBe(50);
  });
});
