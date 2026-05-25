// Club ratings calculation
import { ProcessedShot, ClubConfig } from '@/types/golf';
import { calculateMetrics, splitByQualityCumulative, splitIntoThirds, getLastNRounds, MetricsResult } from './golfCalculations';

export interface ClubRatings {
  capability: number;      // Based on Top 25% shots (0-100)
  consistency: number;     // Based on all shots (0-100)
  currentForm: number;     // Based on Last 5 Rounds (0-100)
  improvement: number;     // Trajectory score (-100 to +100, 0 = stable)
  improvementDirection: 'improving' | 'stable' | 'declining';
}

interface MetricWeight {
  key: string;
  weight: number;
  higherIsBetter: boolean;
  maxValue: number; // For normalization
  minValue?: number;
  requiresDistanceToTarget?: boolean;
}

// Core metrics and their weights for rating calculation
const RATING_METRICS: MetricWeight[] = [
  { key: 'badMissPct', weight: 25, higherIsBetter: false, maxValue: 30 }, // Avoiding disasters
  { key: 'onTargetPct', weight: 20, higherIsBetter: true, maxValue: 100 }, // Accuracy
  { key: 'strikeCentrePct', weight: 15, higherIsBetter: true, maxValue: 100 }, // Contact quality
  { key: 'distanceVariation', weight: 10, higherIsBetter: false, maxValue: 20 }, // Distance consistency
  { key: 'sideVariation', weight: 10, higherIsBetter: false, maxValue: 15 }, // Dispersion control
  { key: 'shortPct', weight: 10, higherIsBetter: false, maxValue: 30 }, // Distance control
  { key: 'greensHitPct', weight: 10, higherIsBetter: true, maxValue: 100, requiresDistanceToTarget: true }, // Green hitting
];

// Additional proximity weight for approach/scoring clubs
const PROXIMITY_METRICS: MetricWeight[] = [
  { key: 'proximityWithin5mPct', weight: 15, higherIsBetter: true, maxValue: 100, requiresDistanceToTarget: true },
  { key: 'avgDistanceToTarget', weight: 10, higherIsBetter: false, maxValue: 20, minValue: 0, requiresDistanceToTarget: true },
];

function normalizeMetric(value: number | null, metric: MetricWeight): number {
  if (value === null) return 50; // Neutral score if no data
  
  const min = metric.minValue ?? 0;
  const range = metric.maxValue - min;
  
  // Clamp value to range
  const clampedValue = Math.max(min, Math.min(metric.maxValue, value));
  
  // Normalize to 0-100
  let normalized = ((clampedValue - min) / range) * 100;
  
  // If lower is better, invert the score
  if (!metric.higherIsBetter) {
    normalized = 100 - normalized;
  }
  
  return normalized;
}

function calculateCompositeScore(
  metrics: MetricsResult,
  config: ClubConfig | undefined
): number {
  const isApproachClub = config?.distanceToTargetEnabled ?? false;
  
  // Determine which metrics to use
  let metricsToUse = RATING_METRICS.filter(m => !m.requiresDistanceToTarget || isApproachClub);
  
  // Add proximity metrics for approach clubs
  if (isApproachClub) {
    metricsToUse = [...metricsToUse, ...PROXIMITY_METRICS];
  }
  
  // Normalize weights to sum to 100
  const totalWeight = metricsToUse.reduce((sum, m) => sum + m.weight, 0);
  
  let compositeScore = 0;
  
  for (const metric of metricsToUse) {
    const value = metrics[metric.key as keyof typeof metrics] as number | null;
    const normalizedValue = normalizeMetric(value, metric);
    const adjustedWeight = (metric.weight / totalWeight) * 100;
    compositeScore += normalizedValue * (adjustedWeight / 100);
  }
  
  return Math.round(compositeScore);
}

function calculateImprovementScore(
  periods: {
    mostRecent: MetricsResult;
    middle: MetricsResult;
    oldest: MetricsResult;
  },
  config: ClubConfig | undefined
): { score: number; direction: 'improving' | 'stable' | 'declining' } {
  const isApproachClub = config?.distanceToTargetEnabled ?? false;
  
  // Calculate composite scores for each period
  const scoreRecent = calculateCompositeScore(periods.mostRecent, config);
  const scoreMiddle = calculateCompositeScore(periods.middle, config);
  const scoreOldest = calculateCompositeScore(periods.oldest, config);
  
  // Calculate trajectory: are we consistently improving?
  const trend1 = scoreRecent - scoreMiddle; // Recent improvement
  const trend2 = scoreMiddle - scoreOldest; // Earlier improvement
  
  // Weight recent changes more heavily
  const overallTrend = (trend1 * 0.6) + (trend2 * 0.4);
  
  // Scale to -100 to +100
  const improvementScore = Math.max(-100, Math.min(100, overallTrend * 3));
  
  let direction: 'improving' | 'stable' | 'declining' = 'stable';
  if (improvementScore > 5) {
    direction = 'improving';
  } else if (improvementScore < -5) {
    direction = 'declining';
  }
  
  return { score: Math.round(improvementScore), direction };
}

export function calculateClubRatings(
  shots: ProcessedShot[],
  config: ClubConfig | undefined
): ClubRatings {
  if (shots.length === 0) {
    return {
      capability: 0,
      consistency: 0,
      currentForm: 0,
      improvement: 0,
      improvementDirection: 'stable',
    };
  }
  
  // Capability: Top 25% shots
  const [top25] = splitByQualityCumulative(shots);
  const capabilityMetrics = calculateMetrics(top25, config);
  const capability = calculateCompositeScore(capabilityMetrics, config);
  
  // Consistency: All shots
  const consistencyMetrics = calculateMetrics(shots, config);
  const consistency = calculateCompositeScore(consistencyMetrics, config);
  
  // Current Form: Last 5 Rounds
  const last5Shots = getLastNRounds(shots, 5);
  const currentFormMetrics = calculateMetrics(last5Shots, config);
  const currentForm = last5Shots.length > 0 
    ? calculateCompositeScore(currentFormMetrics, config)
    : consistency; // Fall back to consistency if not enough data
  
  // Improvement: P1 → P2 → P3 trajectory
  const [mostRecent, middle, oldest] = splitIntoThirds(shots);
  const { score: improvement, direction: improvementDirection } = calculateImprovementScore(
    {
      mostRecent: calculateMetrics(mostRecent, config),
      middle: calculateMetrics(middle, config),
      oldest: calculateMetrics(oldest, config),
    },
    config
  );
  
  return {
    capability,
    consistency,
    currentForm,
    improvement,
    improvementDirection,
  };
}

export function getRatingGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 50) return 'C-';
  if (score >= 45) return 'D+';
  if (score >= 40) return 'D';
  if (score >= 35) return 'D-';
  return 'F';
}

export function getRatingColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-amber-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getImprovementDisplay(improvement: number): { text: string; color: string } {
  if (improvement > 20) return { text: `↑↑ +${improvement}`, color: 'text-green-500' };
  if (improvement > 5) return { text: `↑ +${improvement}`, color: 'text-green-500' };
  if (improvement >= -5) return { text: `→ ${improvement >= 0 ? '+' : ''}${improvement}`, color: 'text-muted-foreground' };
  if (improvement >= -20) return { text: `↓ ${improvement}`, color: 'text-amber-500' };
  return { text: `↓↓ ${improvement}`, color: 'text-red-500' };
}
