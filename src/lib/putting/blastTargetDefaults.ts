import { BlastMetricKey, BlastTargetMetricKey } from '@/types/putting';

export type BlastScoringMode = 'target_and_repeatability' | 'repeatability_only' | 'off';

export interface BlastMetricTarget {
  preferredMin: number | null;
  targetAverage: number | null;
  preferredMax: number | null;
  scoringMode: BlastScoringMode;
}

export type BlastMotionTargets = Record<BlastTargetMetricKey, BlastMetricTarget>;

export const BLAST_MOTION_CAPTURE_METRICS: Array<{ key: BlastMetricKey; label: string; step: string }> = [
  { key: 'tempo_ratio', label: 'Tempo ratio', step: '0.1' },
  { key: 'backstroke_time', label: 'Backstroke time (sec)', step: '0.01' },
  { key: 'forwardstroke_time', label: 'Forward stroke time (sec)', step: '0.01' },
  { key: 'total_stroke_time', label: 'Total stroke time (sec)', step: '0.01' },
  { key: 'backstroke_length', label: 'Backstroke length', step: '0.1' },
  { key: 'impact_stroke_speed', label: 'Impact stroke speed', step: '0.1' },
  { key: 'face_angle_at_impact', label: 'Face angle at impact', step: '0.1' },
  { key: 'backstroke_rotation', label: 'Backstroke rotation', step: '0.1' },
  { key: 'forwardstroke_rotation', label: 'Forward stroke rotation', step: '0.1' },
  { key: 'lie_change', label: 'Lie change', step: '0.1' },
  { key: 'loft_change', label: 'Loft change', step: '0.1' },
];

export const BLAST_MOTION_TARGET_METRICS: Array<{ key: BlastTargetMetricKey; label: string; step: string }> = [
  ...BLAST_MOTION_CAPTURE_METRICS.filter(
    ({ key }) => key !== 'lie_change' && key !== 'loft_change',
  ) as Array<{ key: BlastTargetMetricKey; label: string; step: string }>,
  { key: 'lie_loft_change', label: 'Lie / loft change', step: '0.1' },
];

export const DEFAULT_BLAST_MOTION_TARGETS: BlastMotionTargets = {
  tempo_ratio: { preferredMin: 1.8, targetAverage: 2, preferredMax: 2.2, scoringMode: 'target_and_repeatability' },
  backstroke_time: { preferredMin: 0.57, targetAverage: 0.6, preferredMax: 0.63, scoringMode: 'target_and_repeatability' },
  forwardstroke_time: { preferredMin: 0.29, targetAverage: 0.3, preferredMax: 0.31, scoringMode: 'target_and_repeatability' },
  total_stroke_time: { preferredMin: 0.86, targetAverage: 0.9, preferredMax: 0.94, scoringMode: 'target_and_repeatability' },
  backstroke_length: { preferredMin: null, targetAverage: null, preferredMax: null, scoringMode: 'repeatability_only' },
  impact_stroke_speed: { preferredMin: null, targetAverage: null, preferredMax: null, scoringMode: 'repeatability_only' },
  face_angle_at_impact: { preferredMin: -0.3, targetAverage: 0, preferredMax: 0.3, scoringMode: 'target_and_repeatability' },
  backstroke_rotation: { preferredMin: null, targetAverage: null, preferredMax: null, scoringMode: 'repeatability_only' },
  forwardstroke_rotation: { preferredMin: null, targetAverage: null, preferredMax: null, scoringMode: 'repeatability_only' },
  lie_loft_change: { preferredMin: null, targetAverage: null, preferredMax: null, scoringMode: 'repeatability_only' },
};

function parseNumber(value: unknown, fallback: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function parseBlastMotionTargets(value: unknown): BlastMotionTargets {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(BLAST_MOTION_TARGET_METRICS.map(({ key }) => {
    const fallback = DEFAULT_BLAST_MOTION_TARGETS[key];
    const item = source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) ? source[key] as Partial<BlastMetricTarget> : {};
    const mode = item.scoringMode;
    return [key, {
      preferredMin: parseNumber(item.preferredMin, fallback.preferredMin),
      targetAverage: parseNumber(item.targetAverage, fallback.targetAverage),
      preferredMax: parseNumber(item.preferredMax, fallback.preferredMax),
      scoringMode: mode === 'target_and_repeatability' || mode === 'repeatability_only' || mode === 'off' ? mode : fallback.scoringMode,
    }];
  })) as BlastMotionTargets;
}
