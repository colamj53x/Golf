import { format } from 'date-fns';
import { getClubConfigId } from '@/lib/golfCalculations';
import { pctWithinTarget } from '@/lib/practiceConsistency';
import { getConfigDisplayName } from '@/types/practiceClubs';
import type { ClubPracticeConfig, MetricStatus, PracticeMetricValue, PracticeSession } from '@/types/practice';

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'no-data';

export function calculateTrend(
  currentValue: PracticeMetricValue | null,
  previousValues: (PracticeMetricValue | null)[],
  higherIsBetter: boolean
): TrendDirection {
  if (!currentValue || (currentValue.valueMin === null && currentValue.valueMax === null)) {
    return 'no-data';
  }

  const currentAvg = currentValue.valueMax !== null && currentValue.valueMin !== null
    ? (currentValue.valueMax + currentValue.valueMin) / 2
    : currentValue.valueMax ?? currentValue.valueMin ?? 0;

  const validPrevious = previousValues.filter(v => v && (v.valueMin !== null || v.valueMax !== null));
  if (validPrevious.length === 0) return 'no-data';

  const prevAvg = validPrevious.reduce((sum, v) => {
    const avg = v!.valueMax !== null && v!.valueMin !== null
      ? (v!.valueMax + v!.valueMin) / 2
      : v!.valueMax ?? v!.valueMin ?? 0;
    return sum + avg;
  }, 0) / validPrevious.length;

  const diff = currentAvg - prevAvg;
  const threshold = Math.abs(prevAvg) * 0.05; // 5% threshold for "stable"

  if (Math.abs(diff) < threshold) return 'stable';

  if (higherIsBetter) {
    return diff > 0 ? 'improving' : 'declining';
  } else {
    return diff < 0 ? 'improving' : 'declining';
  }
}

export function calculateStatus(
  value: PracticeMetricValue | null,
  targetMin: number | null,
  targetMax: number | null,
  higherIsBetter: boolean,
  tolerancePct = 10,
): MetricStatus {
  // Handle legacy 'value' property from DB alongside valueMin/valueMax
  const rawValue = value as PracticeMetricValue & { value?: number };

  // Extract the actual numeric values, accounting for legacy 'value' field
  const legacyValue = rawValue?.value ?? null;
  const effectiveMin = value?.valueMin ?? legacyValue;
  const effectiveMax = value?.valueMax ?? legacyValue;

  if (!value || (effectiveMin === null && effectiveMax === null)) {
    return 'amber'; // No data
  }

  // For single-value metrics, use the single value; for ranges, use max for higherIsBetter, min for lowerIsBetter
  const actualValue = higherIsBetter
    ? (effectiveMax ?? effectiveMin ?? 0)
    : (effectiveMin ?? effectiveMax ?? 0);

  const hasRange = effectiveMin !== null && effectiveMax !== null && effectiveMin !== effectiveMax;

  if (targetMin === null && targetMax === null) {
    return 'amber'; // No target set
  }

  // Check consistency: if user entered a range, compare spread to target spread
  let consistencyPenalty: MetricStatus | null = null;
  if (hasRange && targetMin !== null && targetMax !== null) {
    const userSpread = Math.abs(effectiveMax! - effectiveMin!);
    const targetSpread = Math.abs(targetMax - targetMin);

    // If user's range is significantly wider than target range, penalize
    if (targetSpread > 0) {
      const spreadRatio = userSpread / targetSpread;
      if (spreadRatio >= 2.0) {
        consistencyPenalty = 'red'; // Range is 2x+ wider than target
      } else if (spreadRatio > 1.0) {
        consistencyPenalty = 'amber'; // Range exceeds target spread
      }
    } else {
      // Target is a single value, any range is inconsistent
      const midpoint = (effectiveMin! + effectiveMax!) / 2;
      const spreadPct = (userSpread / midpoint) * 100;
      if (spreadPct > tolerancePct * 1.5) {
        consistencyPenalty = 'red';
      } else if (spreadPct > tolerancePct) {
        consistencyPenalty = 'amber';
      }
    }
  }

  // Calculate value status based on target alignment
  let valueStatus: MetricStatus = 'green';

  // For higherIsBetter: above max = excellent (green), below min = bad
  if (higherIsBetter) {
    if (targetMax !== null && actualValue > targetMax) {
      valueStatus = 'green'; // Exceeding target is great
    } else if (targetMin !== null && actualValue >= targetMin && (targetMax === null || actualValue <= targetMax)) {
      valueStatus = 'green'; // Within range
    } else if (targetMin !== null && actualValue < targetMin) {
      // Below minimum is bad
      const deviationPct = (targetMin - actualValue) / targetMin;
      if (deviationPct >= (tolerancePct / 100) * 2) valueStatus = 'red';
      else if (deviationPct >= tolerancePct / 100) valueStatus = 'amber';
      else valueStatus = 'green'; // Very close
    } else {
      valueStatus = 'amber';
    }
  } else {
    // For lowerIsBetter: below max = good, above max = bad
    // Check if there's only a max target (like ≤10)
    if (targetMax !== null && actualValue <= targetMax) {
      valueStatus = 'green'; // Within or below max
    } else if (targetMax !== null && actualValue > targetMax) {
      // Above maximum is bad for lowerIsBetter
      const deviationPct = (actualValue - targetMax) / targetMax;
      if (deviationPct >= (tolerancePct / 100) * 2) valueStatus = 'red';
      else if (deviationPct >= tolerancePct / 100) valueStatus = 'amber';
      else valueStatus = 'green'; // Very close (under 20%)
    } else if (targetMin !== null && actualValue < targetMin) {
      // Below minimum for lowerIsBetter could be too low
      valueStatus = 'amber';
    } else {
      valueStatus = 'amber';
    }
  }

  // Return worst of value status and consistency penalty
  if (consistencyPenalty === 'red' || valueStatus === 'red') return 'red';
  if (consistencyPenalty === 'amber' || valueStatus === 'amber') return 'amber';
  return 'green';
}

export function getMetricTolerancePct(
  category: string,
  distanceTolerancePct: number,
  ballFlightTolerancePct: number,
  otherTolerancePct: number,
): number {
  if (category === 'distance') return distanceTolerancePct;
  if (category === 'ball_flight') return ballFlightTolerancePct;
  return otherTolerancePct;
}

// Helper to extract numeric value from metric (handles legacy 'value' field)
export const getMetricValues = (metric: PracticeMetricValue | undefined): { min: number | null; max: number | null } => {
  if (!metric) return { min: null, max: null };
  const rawMetric = metric as PracticeMetricValue & { value?: number };
  const legacyValue = rawMetric.value ?? null;
  return {
    min: metric.valueMin ?? legacyValue,
    max: metric.valueMax ?? legacyValue,
  };
};

// Parse user input like "123", "120–125", "120-125" into numbers
export const parseInputValue = (valueStr: string): { min: number | null; max: number | null } => {
  const raw = (valueStr || '').trim();
  if (!raw) return { min: null, max: null };

  // Support either en-dash or hyphen
  if (raw.includes('–') || raw.includes('-')) {
    const parts = raw.split(/[–-]/).map(s => parseFloat(s.trim()));
    const min = isNaN(parts[0]) ? null : parts[0];
    const max = isNaN(parts[1]) ? null : parts[1];
    return { min, max };
  }

  const val = parseFloat(raw);
  if (isNaN(val)) return { min: null, max: null };
  return { min: val, max: val };
};

const avgFromMinMax = (v: { min: number | null; max: number | null }) => {
  if (v.min === null && v.max === null) return null;
  if (v.min !== null && v.max !== null) return (v.min + v.max) / 2;
  return v.max ?? v.min;
};

export const computeSmashFactorMetricFromMetrics = (metrics: PracticeMetricValue[]): PracticeMetricValue | null => {
  const ball = metrics.find(m => m.metricId === 'ball_speed');
  const swing = metrics.find(m => m.metricId === 'swing_speed');

  const ballAvg = avgFromMinMax(getMetricValues(ball));
  const swingAvg = avgFromMinMax(getMetricValues(swing));

  if (ballAvg === null || swingAvg === null || swingAvg <= 0) return null;

  const smash = Math.round((ballAvg / swingAvg) * 100) / 100;
  return {
    metricId: 'smash_factor',
    valueMin: smash,
    valueMax: smash,
    valueDisplay: smash.toFixed(2),
  };
};

export const computeSmashFactorDisplayFromInputs = (metricsMap: Record<string, string>) => {
  const ballAvg = avgFromMinMax(parseInputValue(metricsMap['ball_speed'] || ''));
  const swingAvg = avgFromMinMax(parseInputValue(metricsMap['swing_speed'] || ''));
  if (ballAvg === null || swingAvg === null || swingAvg <= 0) return '–';
  return (Math.round((ballAvg / swingAvg) * 100) / 100).toFixed(2);
};

export const getSessionMetricValue = (session: PracticeSession | null, metricId: string): PracticeMetricValue | null => {
  if (!session) return null;

  const stored = session.metrics.find(m => m.metricId === metricId) || null;

  if (metricId !== 'smash_factor') return stored;

  // If Smash Factor isn't stored (or is blank), compute it from ball_speed / swing_speed
  if (stored && (stored.valueMin !== null || stored.valueMax !== null || (stored.valueDisplay || '').trim())) {
    return stored;
  }

  return computeSmashFactorMetricFromMetrics(session.metrics);
};
