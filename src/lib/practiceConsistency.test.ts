import { describe, expect, it } from 'vitest';
import { calculateShotConsistency, pctWithinTarget } from '@/lib/practiceConsistency';
import type { PracticeMetricTarget } from '@/types/practice';

const shots = [
  { metrics: { total: 154 } },
  { metrics: { total: 160 } },
];

describe('pctWithinTarget', () => {
  it('uses exact target windows for precision distance metrics', () => {
    expect(pctWithinTarget('total_distance', shots, 145, 150)).toBe(0);
    expect(pctWithinTarget('total_distance', shots, 145, 150, '6i_full_full')).toBe(0);
  });

  it('uses length mode for woods and hybrids', () => {
    expect(pctWithinTarget('total_distance', shots, 145, 150, '4h_full_full')).toBe(100);
    expect(pctWithinTarget('carry', [{ metrics: { carry: 139 } }, { metrics: { carry: 145 } }], 140, 145, '5w_full_full')).toBe(50);
  });

  it('uses signed left and right launch direction target bands', () => {
    const directionShots = [
      { metrics: { launchDirection: -3 } },
      { metrics: { launchDirection: 0 } },
      { metrics: { launchDirection: 3 } },
      { metrics: { launchDirection: 6 } },
    ];

    expect(pctWithinTarget('launch_direction', directionShots, -4, 4)).toBe(75);
  });

  it('treats max-only targets as exact at-or-below the target', () => {
    const lateralShots = [
      { metrics: { carrySide: -3 } },
      { metrics: { carrySide: 8 } },
      { metrics: { carrySide: 12 } },
    ];

    expect(pctWithinTarget('avg_lateral_miss', lateralShots, null, 10)).toBe(67);
  });
});

describe('calculateShotConsistency', () => {
  it('calculates distance, lateral, best-shot and overall scores from the supplied shot window', () => {
    const targets: PracticeMetricTarget[] = [
      {
        id: 'total_distance',
        metricName: 'Total Distance',
        targetMin: 150,
        targetMax: 170,
        targetDisplay: '150–170',
        unit: 'm',
        higherIsBetter: true,
        category: 'distance',
      },
      {
        id: 'avg_lateral_miss',
        metricName: 'Avg Lateral Miss',
        targetMin: null,
        targetMax: 10,
        targetDisplay: '≤10',
        unit: 'm',
        higherIsBetter: false,
        category: 'dispersion',
      },
    ];
    const window = [
      { metrics: { total: 160, carrySide: 5 } },
      { metrics: { total: 140, carrySide: 8 } },
      { metrics: { total: 155, carrySide: 14 } },
      { metrics: { total: 145, carrySide: 16 } },
    ];

    expect(calculateShotConsistency(
      window,
      targets,
      [
        { metricId: 'total_distance', mode: 'window' },
        { metricId: 'avg_lateral_miss', mode: 'max' },
      ],
      '6i_full_full',
    )).toEqual({
      distance: 50,
      lateral: 50,
      best: 25,
      overall: 50,
    });
  });
});
