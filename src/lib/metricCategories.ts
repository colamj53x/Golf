import { formatPercent, formatDistance } from './golfCalculations';

export interface MetricConfig {
  key: string;
  label: string;
  format: (value: number | null) => string;
  requiresDistanceToTarget?: boolean;
}

export interface MetricCategory {
  name: string;
  key: string;
  metrics: MetricConfig[];
}

export const METRIC_CATEGORIES: MetricCategory[] = [
  {
    name: 'Accuracy',
    key: 'accuracy',
    metrics: [
      { key: 'onTargetPct', label: 'On-Target %', format: formatPercent },
      { key: 'rightPct', label: 'Right % (outside band)', format: formatPercent },
      { key: 'leftPct', label: 'Left % (outside band)', format: formatPercent },
    ],
  },
  {
    name: 'Distance',
    key: 'distance',
    metrics: [
      { key: 'avgDistanceHit', label: 'Avg Distance Hit (m)', format: formatDistance },
      { key: 'longestHit', label: 'Longest Hit (m)', format: formatDistance },
      { key: 'distanceVariation', label: 'Distance Variation (m)', format: formatDistance },
      { key: 'shortPct', label: 'Short %', format: formatPercent },
    ],
  },
  {
    name: 'Dispersion',
    key: 'dispersion',
    metrics: [
      { key: 'sideVariation', label: 'Side Variation (m)', format: formatDistance },
    ],
  },
  {
    name: 'Quality',
    key: 'quality',
    metrics: [
      { key: 'badMissPct', label: 'Bad Miss %', format: formatPercent },
      { key: 'strikeCentrePct', label: 'Strike Centre %', format: formatPercent },
    ],
  },
  {
    name: 'Green Metrics',
    key: 'green',
    metrics: [
      { key: 'greensTargetedPct', label: 'Greens Targeted %', format: formatPercent, requiresDistanceToTarget: true },
      { key: 'greensHitPct', label: 'Greens Hit %', format: formatPercent, requiresDistanceToTarget: true },
      { key: 'avgDistanceToTarget', label: 'Avg Distance to Target (m)', format: formatDistance, requiresDistanceToTarget: true },
      { key: 'distanceToTargetVariation', label: 'Dist-to-Target Variation (m)', format: formatDistance, requiresDistanceToTarget: true },
    ],
  },
  {
    name: 'Proximity',
    key: 'proximity',
    metrics: [
      { key: 'proximityWithin1mPct', label: 'Within 1m %', format: formatPercent, requiresDistanceToTarget: true },
      { key: 'proximityWithin3mPct', label: 'Within 3m %', format: formatPercent, requiresDistanceToTarget: true },
      { key: 'proximityWithin5mPct', label: 'Within 5m %', format: formatPercent, requiresDistanceToTarget: true },
      { key: 'proximityWithin10mPct', label: 'Within 10m %', format: formatPercent, requiresDistanceToTarget: true },
    ],
  },
];

export const SHOT_QUALITY_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap', '15 Handicap', '20 Handicap', '25 Handicap'];
