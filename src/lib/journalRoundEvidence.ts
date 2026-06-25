import type { RoundReviewMetrics, RoundReviewModel, RoundReviewRow } from '@/lib/roundReview';
import type { HoleQualityModel } from '@/lib/holeQuality';
import type { JournalCategoryKey } from '@/types/golf';

export interface JournalEvidenceMetric {
  label: string;
  value: string;
}

export interface JournalCategoryEvidence {
  metrics: JournalEvidenceMetric[];
  note: string;
}

type EvidenceMetrics = Pick<RoundReviewMetrics,
  | 'shotCount'
  | 'shotQualityIndex'
  | 'targetSuccessPct'
  | 'targetSuccessCount'
  | 'targetAttemptCount'
  | 'safeShotRate'
  | 'scoringZoneSuccessPct'
  | 'scoringZoneSuccessCount'
  | 'scoringZoneAttemptCount'
  | 'leftPct'
  | 'rightPct'
  | 'shortPct'
  | 'badMissPct'
>;

function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function score(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

function result(value: number, attempts: number): string {
  return attempts ? `${value}/${attempts}` : '—';
}

function holeTargetSpread(model: HoleQualityModel | null): string {
  if (!model?.targetSummary.ratedHoleCount) return '—';
  const { underCount, atCount, overCount } = model.targetSummary;
  return `${underCount}/${atCount}/${overCount}`;
}

function dominantMiss(metrics: EvidenceMetrics): string {
  const misses = [
    { label: 'Left', value: metrics.leftPct },
    { label: 'Right', value: metrics.rightPct },
    { label: 'Short', value: metrics.shortPct },
  ].sort((a, b) => b.value - a.value);
  return misses[0].value > 0 ? `${misses[0].label} ${Math.round(misses[0].value)}%` : 'No clear miss';
}

function weighted(rows: RoundReviewRow[], key: 'leftPct' | 'rightPct' | 'shortPct' | 'badMissPct' | 'safeShotRate'): number {
  const shots = rows.reduce((total, row) => total + row.round.shotCount, 0);
  if (!shots) return 0;
  return rows.reduce((total, row) => total + row.round[key] * row.round.shotCount, 0) / shots;
}

function aggregateRows(rows: RoundReviewRow[]): EvidenceMetrics | null {
  const shotCount = rows.reduce((total, row) => total + row.round.shotCount, 0);
  if (!shotCount) return null;

  const qualityRows = rows.filter((row) => row.round.shotQualityIndex !== null);
  const qualityShots = qualityRows.reduce((total, row) => total + row.round.shotCount, 0);
  const targetSuccessCount = rows.reduce((total, row) => total + row.round.targetSuccessCount, 0);
  const targetAttemptCount = rows.reduce((total, row) => total + row.round.targetAttemptCount, 0);
  const scoringZoneSuccessCount = rows.reduce((total, row) => total + row.round.scoringZoneSuccessCount, 0);
  const scoringZoneAttemptCount = rows.reduce((total, row) => total + row.round.scoringZoneAttemptCount, 0);

  return {
    shotCount,
    shotQualityIndex: qualityShots
      ? qualityRows.reduce((total, row) => total + (row.round.shotQualityIndex ?? 0) * row.round.shotCount, 0) / qualityShots
      : null,
    targetSuccessPct: targetAttemptCount ? (targetSuccessCount / targetAttemptCount) * 100 : null,
    targetSuccessCount,
    targetAttemptCount,
    safeShotRate: weighted(rows, 'safeShotRate'),
    scoringZoneSuccessPct: scoringZoneAttemptCount ? (scoringZoneSuccessCount / scoringZoneAttemptCount) * 100 : null,
    scoringZoneSuccessCount,
    scoringZoneAttemptCount,
    leftPct: weighted(rows, 'leftPct'),
    rightPct: weighted(rows, 'rightPct'),
    shortPct: weighted(rows, 'shortPct'),
    badMissPct: weighted(rows, 'badMissPct'),
  };
}

function area(review: RoundReviewModel, key: string): EvidenceMetrics | null {
  return review.areas.find((candidate) => candidate.key === key)?.round ?? null;
}

function clubRows(review: RoundReviewModel, pattern: RegExp): EvidenceMetrics | null {
  return aggregateRows(review.clubAndTypeRows.filter((row) => pattern.test(row.clubLabel ?? '')));
}

function executionEvidence(metrics: EvidenceMetrics, targetLabel = 'Targets'): JournalEvidenceMetric[] {
  return [
    { label: 'Shots', value: String(metrics.shotCount) },
    { label: targetLabel, value: result(metrics.targetSuccessCount, metrics.targetAttemptCount) },
    { label: 'Shot quality', value: score(metrics.shotQualityIndex) },
    { label: 'Main miss', value: dominantMiss(metrics) },
  ];
}

export function buildJournalRoundEvidence(
  review: RoundReviewModel | null,
  puttingShotCount = 0,
  holeQuality: HoleQualityModel | null = null
): Partial<Record<JournalCategoryKey, JournalCategoryEvidence>> {
  if (!review) return {};

  const driving = clubRows(review, /^driver$/i) ?? area(review, 'tee');
  const irons = clubRows(review, /iron/i);
  const hybrids = clubRows(review, /hybrid|wood/i);
  const approach = area(review, 'approach');
  const shortGame = area(review, 'short');
  const recovery = area(review, 'recovery');
  const management = area(review, 'management');
  const evidence: Partial<Record<JournalCategoryKey, JournalCategoryEvidence>> = {};

  if (driving) evidence.driving = {
    metrics: executionEvidence(driving, 'Fairways'),
    note: `${pct(driving.safeShotRate)} of driving shots avoided a costly miss.`,
  };
  if (irons) evidence.irons = {
    metrics: executionEvidence(irons),
    note: `${pct(irons.safeShotRate)} safe-shot rate across iron shots.`,
  };
  if (hybrids) evidence.hybrids = {
    metrics: executionEvidence(hybrids),
    note: `${pct(hybrids.safeShotRate)} safe-shot rate across hybrid and wood shots.`,
  };
  if (approach) evidence.approach = {
    metrics: executionEvidence(approach, 'Greens'),
    note: `Green targets from outside 100m; ${pct(approach.safeShotRate)} avoided a costly miss.`,
  };
  if (shortGame) evidence.shortGame = {
    metrics: [
      { label: 'Shots', value: String(shortGame.shotCount) },
      { label: 'Scoring zone', value: result(shortGame.scoringZoneSuccessCount, shortGame.scoringZoneAttemptCount) },
      { label: 'Shot quality', value: score(shortGame.shotQualityIndex) },
      { label: 'Main miss', value: dominantMiss(shortGame) },
    ],
    note: `Green targets from 100m and in; ${pct(shortGame.safeShotRate)} avoided a costly miss.`,
  };

  evidence.putting = {
    metrics: puttingShotCount ? [{ label: 'Tracked putts', value: String(puttingShotCount) }] : [],
    note: puttingShotCount
      ? 'Putting shots recorded for this round.'
      : 'No putting-shot data is stored for this round, so use your memory and scorecard here.',
  };

  evidence.mental = {
    metrics: [
      { label: 'Safe shots', value: pct(review.round.safeShotRate) },
      { label: 'Costly misses', value: pct(review.round.badMissPct) },
      { label: 'Shot quality', value: score(review.round.shotQualityIndex) },
      { label: 'Recovery shots', value: String(recovery?.shotCount ?? 0) },
    ],
    note: 'The data cannot measure mindset; use these as clues about pressure, reactions, and recovery.',
  };

  if (management) evidence.courseManagement = {
    metrics: [
      { label: 'Hole target spread', value: holeTargetSpread(holeQuality) },
      { label: 'Targets achieved', value: result(management.targetSuccessCount, management.targetAttemptCount) },
      { label: 'Safe shots', value: pct(management.safeShotRate) },
      { label: 'Costly misses', value: pct(management.badMissPct) },
      { label: 'Recovery shots', value: String(recovery?.shotCount ?? 0) },
    ],
    note: 'Hole target spread is under/at/over the selected handicap target. Use this to reflect on target choice, club choice, and where you accepted or created risk.',
  };

  return evidence;
}
