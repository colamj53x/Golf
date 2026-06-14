import { describe, expect, it } from 'vitest';
import { pctWithinTarget } from '@/lib/practiceConsistency';

const shots = [
  { metrics: { total: 154 } },
  { metrics: { total: 160 } },
];

describe('pctWithinTarget', () => {
  it('uses the requested tolerance around the target band', () => {
    expect(pctWithinTarget('total_distance', shots, 145, 150)).toBe(50);
    expect(pctWithinTarget('total_distance', shots, 145, 150, 10)).toBe(100);
  });

  it('uses signed left and right launch direction target bands', () => {
    const directionShots = [
      { metrics: { launchDirection: -3 } },
      { metrics: { launchDirection: 0 } },
      { metrics: { launchDirection: 3 } },
      { metrics: { launchDirection: 6 } },
    ];

    expect(pctWithinTarget('launch_direction', directionShots, -4, 4, 0)).toBe(75);
  });

  it('treats max-only targets as at-or-below the target', () => {
    const lateralShots = [
      { metrics: { carrySide: -3 } },
      { metrics: { carrySide: 8 } },
      { metrics: { carrySide: 12 } },
    ];

    expect(pctWithinTarget('avg_lateral_miss', lateralShots, null, 10, 0)).toBe(67);
  });
});
