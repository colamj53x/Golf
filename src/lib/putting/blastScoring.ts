import { BlastMetricKey, BlastMetricRange, BlastMotionSetData } from '@/types/putting';

interface ScoreResult {
  score: number;
  metricsUsed: number;
  summary: string;
}

const targetRanges: Partial<Record<BlastMetricKey, [number, number]>> = {
  tempo_ratio: [1.8, 2.2],
  backstroke_time: [0.57, 0.63],
  forwardstroke_time: [0.29, 0.31],
  total_stroke_time: [0.86, 0.94],
  face_angle_at_impact: [-0.3, 0.3],
  lie_loft_change: [-0.3, 0.3],
};

function repeatabilityScore(range: BlastMetricRange): number | null {
  if (typeof range.min !== 'number' || typeof range.max !== 'number') return null;
  const spread = Math.abs(range.max - range.min);
  const scale = Math.max(Math.abs(range.average || 0), Math.abs(range.min), Math.abs(range.max), 1);
  return Math.max(0, Math.round(100 - (spread / scale) * 400));
}

function targetScore(average: number, [low, high]: [number, number]): number {
  if (average >= low && average <= high) return 100;
  const width = Math.max(high - low, 0.1);
  const distance = average < low ? low - average : average - high;
  return Math.max(0, Math.round(100 - (distance / width) * 50));
}

function metricScore(key: BlastMetricKey, range: BlastMetricRange): number | null {
  const repeatability = repeatabilityScore(range);
  const target = typeof range.average === 'number' && targetRanges[key] ? targetScore(range.average, targetRanges[key]!) : null;
  if (target !== null && repeatability !== null) return Math.round(target * 0.7 + repeatability * 0.3);
  return target ?? repeatability;
}

export function scoreBlastMechanics(blast?: BlastMotionSetData): ScoreResult | null {
  const scores = Object.entries(blast?.metric_ranges || {}).flatMap(([key, range]) => {
    const score = metricScore(key as BlastMetricKey, range);
    return score === null ? [] : [score];
  });
  if (!scores.length) return null;
  const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const summary = score >= 85 ? 'Strong mechanics and repeatability.' : score >= 70 ? 'Solid base with a few patterns to tighten.' : score >= 50 ? 'Mixed mechanics: use the ranges to identify the loose areas.' : 'Priority area: focus on stable timing and face control.';
  return { score, metricsUsed: scores.length, summary };
}
