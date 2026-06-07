import type { RoundReviewArea, RoundReviewMetrics, RoundReviewRow } from '@/lib/roundReview';

export type BenchmarkStatus = 'above' | 'on-target' | 'watch' | 'priority' | 'unavailable';
export type RoundReviewMetricKey = 'shotQuality' | 'targetSuccess' | 'safeShotRate' | 'scoringZoneSuccess';

export interface HcpBenchmark {
  shotQuality: number;
  targetSuccess: number;
  safeShotRate: number;
  scoringZoneSuccess: number;
  teeShotQuality: number;
  greenTargetQuality: number;
}

export interface RoundThoughts {
  generalComments: string;
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
  playingPartnerIds?: string[];
}

export const HCP_BENCHMARKS: Record<number, HcpBenchmark> = {
  5: { shotQuality: 80, targetSuccess: 75, safeShotRate: 98, scoringZoneSuccess: 78, teeShotQuality: 78, greenTargetQuality: 80 },
  10: { shotQuality: 75, targetSuccess: 68, safeShotRate: 97, scoringZoneSuccess: 70, teeShotQuality: 73, greenTargetQuality: 75 },
  15: { shotQuality: 70, targetSuccess: 60, safeShotRate: 95, scoringZoneSuccess: 60, teeShotQuality: 68, greenTargetQuality: 70 },
  20: { shotQuality: 65, targetSuccess: 52, safeShotRate: 91, scoringZoneSuccess: 50, teeShotQuality: 62, greenTargetQuality: 65 },
  25: { shotQuality: 60, targetSuccess: 45, safeShotRate: 88, scoringZoneSuccess: 42, teeShotQuality: 55, greenTargetQuality: 60 },
  30: { shotQuality: 55, targetSuccess: 40, safeShotRate: 85, scoringZoneSuccess: 35, teeShotQuality: 50, greenTargetQuality: 55 },
};

export function getBenchmarkForHcp(hcp: number): HcpBenchmark {
  return HCP_BENCHMARKS[hcp] ?? HCP_BENCHMARKS[15];
}

export function getMetricStatus(value: number | null, benchmark: number, tolerance: number): BenchmarkStatus {
  if (value === null || !Number.isFinite(value)) return 'unavailable';
  const difference = value - benchmark;
  if (difference > tolerance) return 'above';
  if (difference >= -tolerance) return 'on-target';
  if (difference >= -(tolerance * 2.5)) return 'watch';
  return 'priority';
}

export function metricValue(metrics: RoundReviewMetrics, key: RoundReviewMetricKey): number | null {
  if (key === 'shotQuality') return metrics.shotQualityIndex;
  if (key === 'targetSuccess') return metrics.targetSuccessPct;
  if (key === 'safeShotRate') return metrics.safeShotRate;
  return metrics.scoringZoneSuccessPct;
}

export function metricBenchmark(benchmark: HcpBenchmark, key: RoundReviewMetricKey): number {
  return benchmark[key];
}

export function buildRoundHeadline(
  round: RoundReviewMetrics,
  benchmark: HcpBenchmark,
  areas: RoundReviewArea[]
): string {
  const qualityStatus = getMetricStatus(round.shotQualityIndex, benchmark.shotQuality, 3);
  const safeStatus = getMetricStatus(round.safeShotRate, benchmark.safeShotRate, 5);
  const scoringStatus = getMetricStatus(round.scoringZoneSuccessPct, benchmark.scoringZoneSuccess, 5);
  const tee = areas.find(area => area.key === 'tee');
  const teeStatus = getMetricStatus(tee?.round.shotQualityIndex ?? null, benchmark.teeShotQuality, 3);

  if (qualityStatus === 'priority') return 'Below-target round — execution needs attention';
  if (scoringStatus === 'above') return 'Strong scoring-zone round — short game moved the needle';
  if (teeStatus === 'priority' && qualityStatus !== 'priority') return 'Good scoring control — driver and tee play remain the watch area';
  if (safeStatus === 'above' && ['above', 'on-target'].includes(qualityStatus)) return 'Controlled round — limited damage and solid execution';
  return 'Mixed round — some strengths and clear practice priorities';
}

function rowLabel(row: RoundReviewRow): string {
  return [row.clubLabel, row.shotTypeLabel, row.powerLabel].filter(value => value && value !== '-').join(' ');
}

export function buildRoundStory(
  round: RoundReviewMetrics,
  benchmark: HcpBenchmark,
  clubRows: RoundReviewRow[],
  distanceRows: RoundReviewRow[],
  thoughts?: RoundThoughts
): { worked: string[]; cost: string[]; practise: string[]; reflectionSummary: string; noteMatches: string[] } {
  const worked: string[] = [];
  const cost: string[] = [];
  const practise: string[] = [];
  const noteMatches: string[] = [];
  const qualityRows = clubRows.filter(row => row.round.shotQualityIndex !== null && row.round.shotCount >= 2);
  const strongest = [...qualityRows].sort((a, b) => (b.round.shotQualityIndex ?? 0) - (a.round.shotQualityIndex ?? 0))[0];
  const weakest = [...qualityRows].sort((a, b) => (a.round.shotQualityIndex ?? 0) - (b.round.shotQualityIndex ?? 0))[0];
  const weakDistance = [...distanceRows]
    .filter(row => row.round.shotCount >= 2)
    .sort((a, b) => (a.round.targetSuccessPct ?? 0) - (b.round.targetSuccessPct ?? 0))[0];

  if (getMetricStatus(round.safeShotRate, benchmark.safeShotRate, 5) !== 'priority') worked.push(`${Math.round(round.safeShotRate)}% safe-shot rate limited costly mistakes.`);
  if (strongest) worked.push(`${rowLabel(strongest)} led execution at ${Math.round(strongest.round.shotQualityIndex ?? 0)} quality.`);
  if (round.scoringZoneSuccessPct !== null && round.scoringZoneSuccessPct >= benchmark.scoringZoneSuccess) worked.push(`Scoring-zone work met the ${Math.round(benchmark.scoringZoneSuccess)}% benchmark.`);

  if (weakest && (weakest.round.shotQualityIndex ?? 100) < benchmark.shotQuality) cost.push(`${rowLabel(weakest)} was below the quality benchmark.`);
  if (weakDistance) cost.push(`${weakDistance.label} was the weakest green-target distance band.`);
  if (round.targetSuccessPct !== null && round.targetSuccessPct < benchmark.targetSuccess) cost.push(`Target success finished below the selected HCP benchmark.`);

  if (weakest) practise.push(`Build a focused block around ${rowLabel(weakest)}.`);
  if (weakDistance) practise.push(`Prioritise ${weakDistance.label} green-target shots.`);
  if (round.safeShotRate < benchmark.safeShotRate) practise.push('Use decision and start-line drills to reduce damaging misses.');

  const noteText = thoughts
    ? [
        thoughts.generalComments,
        thoughts.drivingNotes,
        thoughts.ironsNotes,
        thoughts.shortNotes,
        thoughts.puttingNotes,
        thoughts.mentalNotes,
        thoughts.courseManagementNotes,
      ].join(' ').toLowerCase()
    : '';
  if (noteText.includes('driver')) noteMatches.push('You mentioned driver; tee-shot data is included in the main watch areas.');
  if (noteText.includes('hybrid')) noteMatches.push('You mentioned hybrids; their club rows are reflected in the strongest and weakest combinations.');
  if (/(pitch|chip|short)/.test(noteText)) noteMatches.push('You mentioned short-game shots; scoring-zone results support reviewing that area.');
  if (noteText.includes('pace')) {
    practise.push('Keep pace control in the next short-game or putting session.');
    noteMatches.push('You mentioned pace, so it remains visible as a practice cue.');
  }
  if (noteText.includes('confidence')) noteMatches.push('You mentioned confidence; preserve the routine that supported committed swings.');

  return {
    worked: worked.slice(0, 4).length ? worked.slice(0, 4) : ['No clear strength yet; keep building the sample.'],
    cost: cost.slice(0, 4).length ? cost.slice(0, 4) : ['No single category clearly drove the result.'],
    practise: [...new Set(practise)].slice(0, 4).length ? [...new Set(practise)].slice(0, 4) : ['Build more round data before narrowing the next practice block.'],
    reflectionSummary: noteText
      ? `Your notes were considered alongside ${round.shotCount} analysed shots. The data points to ${weakest ? rowLabel(weakest) : 'overall execution'} as the clearest next focus.`
      : `Add Round Thoughts to connect the numbers with confidence, decisions, and the feels that shaped the round.`,
    noteMatches,
  };
}
