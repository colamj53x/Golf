import { describe, expect, it } from 'vitest';
import {
  calculateStatus,
  calculateTrend,
  computeSmashFactorMetricFromMetrics,
  formatDirectionTargetValue,
  parseDirectionalNumber,
  parseInputValue,
  statusFromWithinTarget,
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
    expect(parseInputValue('-6 to -3')).toEqual({ min: -6, max: -3 });
  });

  it('parses left and right direction values as signed numbers', () => {
    expect(parseDirectionalNumber('4L')).toBe(-4);
    expect(parseDirectionalNumber('4R')).toBe(4);
    expect(parseInputValue('4L-4R')).toEqual({ min: -4, max: 4 });
    expect(parseInputValue('2L–6L')).toEqual({ min: -6, max: -2 });
    expect(formatDirectionTargetValue(-4)).toBe('4L');
    expect(formatDirectionTargetValue(4)).toBe('4R');
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

  it('treats target ranges as closed windows', () => {
    expect(calculateStatus(metric('launch_direction', -3), -4, 4, false)).toBe('green');
    expect(calculateStatus(metric('launch_direction', -6), -4, 4, false)).toBe('red');
    expect(calculateStatus(metric('carry', 151), 140, 150, true)).toBe('green');
  });

  it('maps shot-level in-target percentages to status dots', () => {
    expect(statusFromWithinTarget(100)).toBe('green');
    expect(statusFromWithinTarget(83)).toBe('amber');
    expect(statusFromWithinTarget(0)).toBe('red');
    expect(statusFromWithinTarget(null)).toBeNull();
  });
});
