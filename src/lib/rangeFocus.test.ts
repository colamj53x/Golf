import { describe, expect, it } from 'vitest';
import { buildRangeReferenceRows, getPrimaryRangeFocus } from '@/lib/rangeFocus';
import type { PracticeMetricTarget } from '@/types/practice';

function target(
  id: string,
  metricName: string,
  targetMin: number | null,
  targetMax: number | null,
  targetDisplay: string,
  category: PracticeMetricTarget['category'],
): PracticeMetricTarget {
  return { id, metricName, targetMin, targetMax, targetDisplay, unit: '', higherIsBetter: true, category };
}

const metrics = [
  target('tempo_ratio', 'Tempo Ratio', 2.8, 3.2, '2.8–3.2 : 1', 'tempo'),
  target('attack_angle', 'Attack Angle', 1, 5, '1–5', 'swing'),
  target('launch_direction', 'Launch Direction', -2, 2, '2L–2R', 'ball_flight'),
  target('launch_angle', 'Launch Angle', 12, 16, '12–16', 'ball_flight'),
  target('ball_speed', 'Ball Speed', 150, 180, '150–180', 'ball_flight'),
  target('avg_lateral_miss', 'Avg Lateral Miss', null, 15, '≤15', 'dispersion'),
  target('smash_factor', 'Smash Factor', 1.4, 1.5, '1.4–1.5', 'swing'),
];

describe('range reference card', () => {
  it('shows targets and both-side tips while excluding smash factor', () => {
    const rows = buildRangeReferenceRows(metrics, [], 'dr_full_full');

    expect(rows.map(row => row.metricId)).not.toContain('smash_factor');
    expect(rows.find(row => row.metricId === 'attack_angle')).toMatchObject({
      target: '1–5',
      lowLabel: 'Too negative',
      highLabel: 'Too positive',
    });
    expect(rows.every(row => Boolean(row.lowTip) && Boolean(row.highTip))).toBe(true);
  });

  it('highlights the weakest measured swing input before outcome metrics', () => {
    const shots = Array.from({ length: 10 }, (_, index) => ({
      metrics: {
        tempo: index < 8 ? 3 : 4,
        attackAngle: index < 4 ? 3 : -3,
        launchDirection: index < 7 ? 0 : 6,
        launchAngle: 14,
        ballSpeed: 165,
        carrySide: 30,
      },
    }));
    const rows = buildRangeReferenceRows(metrics, shots, 'dr_full_full');

    expect(getPrimaryRangeFocus(rows)?.metricId).toBe('attack_angle');
  });

  it('moves to an outcome focus when all measured swing inputs are strong', () => {
    const shots = Array.from({ length: 10 }, () => ({
      metrics: {
        tempo: 3,
        attackAngle: 3,
        launchDirection: 0,
        launchAngle: 14,
        ballSpeed: 165,
        carrySide: 30,
      },
    }));
    const rows = buildRangeReferenceRows(metrics, shots, 'dr_full_full');

    expect(getPrimaryRangeFocus(rows)?.metricId).toBe('avg_lateral_miss');
  });
});
