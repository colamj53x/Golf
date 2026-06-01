import { BlastMetricRange, BlastMotionSetData, BlastTargetMetricKey } from '@/types/putting';
import { BlastMetricTarget, BlastMotionTargets, DEFAULT_BLAST_MOTION_TARGETS } from './blastTargetDefaults';

interface ScoreResult {
  score: number;
  metricsUsed: number;
  summary: string;
}

function repeatabilityScore(range: BlastMetricRange): number | null {
  if (typeof range.min !== 'number' || typeof range.max !== 'number') return null;
  const spread = Math.abs(range.max - range.min);
  const scale = Math.max(Math.abs(range.average || 0), Math.abs(range.min), Math.abs(range.max), 1);
  return Math.max(0, Math.round(100 - (spread / scale) * 400));
}

function targetScore(average: number, target: BlastMetricTarget): number | null {
  const { preferredMin: low, preferredMax: high } = target;
  if (typeof low !== 'number' || typeof high !== 'number') return null;
  const targetAverage = typeof target.targetAverage === 'number' ? target.targetAverage : (low + high) / 2;
  const targetWidth = Math.max(targetAverage - low, high - targetAverage, 0.05);
  if (average >= low && average <= high) return Math.round(100 - (Math.abs(average - targetAverage) / targetWidth) * 15);
  const width = Math.max(high - low, 0.1);
  const distance = average < low ? low - average : average - high;
  return Math.max(0, Math.round(85 - (distance / width) * 50));
}

function metricScore(range: BlastMetricRange, targetConfig: BlastMetricTarget): number | null {
  if (targetConfig.scoringMode === 'off') return null;
  const repeatability = repeatabilityScore(range);
  const target = targetConfig.scoringMode === 'target_and_repeatability' && typeof range.average === 'number' ? targetScore(range.average, targetConfig) : null;
  if (target !== null && repeatability !== null) return Math.round(target * 0.7 + repeatability * 0.3);
  return target ?? repeatability;
}

export function scoreBlastMechanics(blast?: BlastMotionSetData, targets: BlastMotionTargets = DEFAULT_BLAST_MOTION_TARGETS): ScoreResult | null {
  const ranges = blast?.metric_ranges || {};
  const scores = Object.entries(ranges).flatMap(([key, range]) => {
    // New sessions capture lie and loft separately. Older sessions may still
    // contain the combined metric, which should count once rather than three times.
    if (key === 'lie_loft_change' && (ranges.lie_change || ranges.loft_change)) return [];
    const targetKey = key === 'lie_change' || key === 'loft_change'
      ? 'lie_loft_change'
      : key as BlastTargetMetricKey;
    const targetConfig = targets[targetKey];
    if (!targetConfig) return [];
    const score = metricScore(range, targetConfig);
    return score === null ? [] : [score];
  });
  if (!scores.length) return null;
  const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const summary = score >= 85 ? 'Strong mechanics and repeatability.' : score >= 70 ? 'Solid base with a few patterns to tighten.' : score >= 50 ? 'Mixed mechanics: use the ranges to identify the loose areas.' : 'Priority area: focus on stable timing and face control.';
  return { score, metricsUsed: scores.length, summary };
}
