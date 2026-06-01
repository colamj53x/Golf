import { describe, expect, it } from 'vitest';
import {
  calculateStatus,
  calculateTrend,
  computeSmashFactorMetricFromMetrics,
  parseInputValue,
} from '@/lib/practiceDashboardDomain';
import type { PracticeMetricValue } from '@/types/practice';

function metric(metricId: string, valueMin: number, valueMax = valueMin): PracticeMetricValue {
  return {
    metricId,
    valueMin,
    valueMax,
    valueDisplay: valueMin === valueMax ? String(valueMin) : `${valueMin}-${valueMax}`,
  };
}

describe('practice dashboard domain', () => {
  it('parses single values and typed distance ranges', () => {
    expect(parseInputValue('145')).toEqual({ min: 145, max: 145 });
    expect(parseInputValue('140-150')).toEqual({ min: 140, max: 150 });
    expect(parseInputValue('140–150')).toEqual({ min: 140, max: 150 });
  });

  it('computes smash factor from ball speed and swing speed', () => {
    expect(computeSmashFactorMetricFromMetrics([
      metric('ball_speed', 138),
      metric('swing_speed', 92),
    ])).toMatchObject({
      metricId: 'smash_factor',
      valueMin: 1.5,
      valueMax: 1.5,
      valueDisplay: '1.50',
    });
  });

  it('classifies improving and declining trends in the correct direction', () => {
    expect(calculateTrend(metric('carry', 150), [metric('carry', 140)], true)).toBe('improving');
    expect(calculateTrend(metric('avg_lateral_miss', 5), [metric('avg_lateral_miss', 10)], false)).toBe('improving');
  });

  it('marks a materially wide range as inconsistent', () => {
    expect(calculateStatus(metric('carry', 130, 160), 140, 150, true)).toBe('red');
  });
});
