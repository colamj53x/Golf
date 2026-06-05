import type { ShotsBySession } from '@/hooks/usePracticeShotsBySessions';
import { calculateClubRatings, type ClubRatings } from '@/lib/clubRatings';
import { calculateMetrics, getClubConfigId, getLastNRounds, processShot, splitIntoThirds, type MetricsResult } from '@/lib/golfCalculations';
import {
  buildCourseShotGappingAssignments,
  clubSortIndex,
  getClubName,
  getShotLabel,
  loadShotCategoryOverrides,
  powerStrength,
  visibleGappingConfigKey,
  type CourseShotGappingAssignment,
} from '@/lib/gapping';
import { loadShotClassificationRules, type ShotClassificationRules } from '@/lib/shotClassificationRules';
import type { ShotProfileMap } from '@/lib/shotProfiles';
import type { ClubConfig, ProcessedShot, Shot } from '@/types/golf';
import type { ClubPracticeConfig, PracticeSession } from '@/types/practice';

export interface ReportGappingShotData {
  key: string;
  label: string;
  clubLabel: string;
  shotLabel: string;
  powerLabel: string;
  clubId: string;
  shotType: string;
  power: string;
  target: string;
  config: ClubConfig | undefined;
  shots: ProcessedShot[];
  ratings: ClubRatings;
  metrics: MetricsResult;
  periods: {
    mostRecent: MetricsResult;
    middle: MetricsResult;
    oldest: MetricsResult;
  };
  last5Rounds: MetricsResult;
  overall: MetricsResult;
  lastShotDate: Date | null;
}

export type BenchmarkHcp = 30 | 25 | 20 | 15 | 10;
export type BenchmarkFamily = 'driver' | 'longClub' | 'midIron' | 'wedge';
export type BenchmarkStatus = 'ahead' | 'on-track' | 'watch' | 'priority-gap' | 'not-enough-data';

export interface BenchmarkMetricResult {
  key: 'onTargetPct' | 'badMissPct' | 'sideVariationM' | 'distanceVariationM' | 'strikePct';
  label: string;
  value: number;
  benchmark: number;
  status: BenchmarkStatus;
  higherIsBetter: boolean;
}

export interface ShotBenchmarkResult {
  status: BenchmarkStatus;
  statusLabel: string;
  family: BenchmarkFamily;
  hcp: BenchmarkHcp;
  mainGap: string;
  mainStrength: string;
  metrics: BenchmarkMetricResult[];
}

export type SnapshotCardKey = 'best' | 'reliable' | 'watch' | 'used' | 'improved' | 'data';

export interface PerformanceSnapshotCard {
  key: SnapshotCardKey;
  title: string;
  shot: ReportGappingShotData | null;
  benchmark: ShotBenchmarkResult | null;
  value: string;
  detail: string;
}

export interface PerformanceMapPoint {
  key: string;
  label: string;
  clubLabel: string;
  shotLabel: string;
  powerLabel: string;
  onTargetPct: number;
  badMissPct: number;
  shotCount: number;
  sideVariation: number;
  distanceVariation: number;
  strikePct: number;
  benchmark: ShotBenchmarkResult;
  decision: ShotDecisionBucket | null;
}

export type ShotDecisionBucket = 'trust' | 'build' | 'caution' | 'retest';

export interface ShotDecision {
  bucket: ShotDecisionBucket;
  shot: ReportGappingShotData;
  reason: string;
}

export interface ShotDecisionSummary {
  trust: ShotDecision[];
  build: ShotDecision[];
  caution: ShotDecision[];
  retest: ShotDecision[];
}

export const decisionThresholds = {
  minSampleSize: 10,
  minRecentSampleSize: 3,
  trustOnTargetPct: 60,
  cautionOnTargetPct: 40,
  trustBadMissPct: 10,
  cautionBadMissPct: 20,
  cautionSideVariation: 20,
  trustSideVariation: 12,
  cautionStrikePct: 35,
  trustStrikePct: 55,
  staleDays: 120,
};

export const benchmarkProfiles: Record<BenchmarkHcp, Record<BenchmarkFamily, {
  onTargetPct: number;
  badMissPct: number;
  sideVariationM: number;
  distanceVariationM: number;
  strikePct: number;
}>> = {
  30: {
    driver: { onTargetPct: 45, badMissPct: 20, sideVariationM: 35, distanceVariationM: 25, strikePct: 45 },
    longClub: { onTargetPct: 38, badMissPct: 22, sideVariationM: 28, distanceVariationM: 22, strikePct: 42 },
    midIron: { onTargetPct: 45, badMissPct: 18, sideVariationM: 22, distanceVariationM: 18, strikePct: 50 },
    wedge: { onTargetPct: 55, badMissPct: 12, sideVariationM: 12, distanceVariationM: 10, strikePct: 55 },
  },
  25: {
    driver: { onTargetPct: 48, badMissPct: 18, sideVariationM: 32, distanceVariationM: 23, strikePct: 48 },
    longClub: { onTargetPct: 42, badMissPct: 20, sideVariationM: 25, distanceVariationM: 20, strikePct: 46 },
    midIron: { onTargetPct: 49, badMissPct: 16, sideVariationM: 20, distanceVariationM: 16, strikePct: 55 },
    wedge: { onTargetPct: 58, badMissPct: 11, sideVariationM: 11, distanceVariationM: 9, strikePct: 58 },
  },
  20: {
    driver: { onTargetPct: 52, badMissPct: 16, sideVariationM: 30, distanceVariationM: 21, strikePct: 52 },
    longClub: { onTargetPct: 46, badMissPct: 18, sideVariationM: 23, distanceVariationM: 18, strikePct: 50 },
    midIron: { onTargetPct: 54, badMissPct: 14, sideVariationM: 17, distanceVariationM: 14, strikePct: 60 },
    wedge: { onTargetPct: 63, badMissPct: 9, sideVariationM: 9, distanceVariationM: 8, strikePct: 63 },
  },
  15: {
    driver: { onTargetPct: 56, badMissPct: 14, sideVariationM: 27, distanceVariationM: 19, strikePct: 56 },
    longClub: { onTargetPct: 50, badMissPct: 16, sideVariationM: 21, distanceVariationM: 16, strikePct: 55 },
    midIron: { onTargetPct: 59, badMissPct: 11, sideVariationM: 14, distanceVariationM: 12, strikePct: 65 },
    wedge: { onTargetPct: 68, badMissPct: 7, sideVariationM: 8, distanceVariationM: 7, strikePct: 68 },
  },
  10: {
    driver: { onTargetPct: 62, badMissPct: 11, sideVariationM: 24, distanceVariationM: 16, strikePct: 62 },
    longClub: { onTargetPct: 56, badMissPct: 13, sideVariationM: 18, distanceVariationM: 14, strikePct: 60 },
    midIron: { onTargetPct: 65, badMissPct: 8, sideVariationM: 11, distanceVariationM: 10, strikePct: 72 },
    wedge: { onTargetPct: 74, badMissPct: 5, sideVariationM: 6, distanceVariationM: 5, strikePct: 75 },
  },
};

export const benchmarkTolerance = {
  aheadPctMargin: 5,
  watchPctMargin: 10,
  aheadDistanceMarginM: 2,
  watchDistanceMarginM: 5,
};

export const benchmarkSampleThresholds = {
  minShots: 10,
  minRecentShots: 3,
};

export const benchmarkStatusLabels: Record<BenchmarkStatus, string> = {
  ahead: 'Ahead',
  'on-track': 'On Track',
  watch: 'Watch',
  'priority-gap': 'Priority Gap',
  'not-enough-data': 'Not Enough Data',
};

export interface ReportGappingAnalysis {
  shots: ReportGappingShotData[];
  clubRollups: ReportGappingShotData[];
  unmatchedShots: ProcessedShot[];
  catalogueOptions: Array<{
    key: string;
    label: string;
    clubLabel: string;
    shotLabel: string;
    powerLabel: string;
  }>;
}

function getPowerLabel(power: string): string {
  if (power === 'full') return 'Full';
  if (power === '9pm' || power === 'half') return 'Half';
  return power;
}

function getAssignmentLabel(assignment: CourseShotGappingAssignment): {
  label: string;
  clubLabel: string;
  shotLabel: string;
  powerLabel: string;
} {
  const clubLabel = getClubName(assignment.profile);
  const shotLabel = getShotLabel(assignment.profile);
  const powerLabel = getPowerLabel(visibleGappingConfigKey(assignment.configKey).split('_').at(-1) ?? assignment.profile.power);
  const label = assignment.profile.shotType === 'full' && powerLabel === 'Full'
    ? `${clubLabel} - Full`
    : `${clubLabel} - ${shotLabel} - ${powerLabel}`;

  return { label, clubLabel, shotLabel, powerLabel };
}

function buildDataRow({
  key,
  label,
  clubLabel,
  shotLabel,
  powerLabel,
  clubId,
  shotType,
  power,
  target,
  rawShots,
  clubs,
  distanceToTargetTolerance,
}: {
  key: string;
  label: string;
  clubLabel: string;
  shotLabel: string;
  powerLabel: string;
  clubId: string;
  shotType: string;
  power: string;
  target: string;
  rawShots: Shot[];
  clubs: ClubConfig[];
  distanceToTargetTolerance: number;
}): ReportGappingShotData {
  const config = clubs.find((club) => club.id === clubId);
  const sortedShots = [...rawShots].sort((a, b) => a.date.getTime() - b.date.getTime());
  const processed = sortedShots.map((shot) => processShot(shot, config, distanceToTargetTolerance));
  const [mostRecent, middle, oldest] = splitIntoThirds(processed);
  const last5Rounds = getLastNRounds(processed, 5);
  const lastShotDate = sortedShots.at(-1)?.date ?? null;

  return {
    key,
    label,
    clubLabel,
    shotLabel,
    powerLabel,
    clubId,
    shotType,
    power,
    target,
    config,
    shots: processed,
    ratings: calculateClubRatings(processed, config),
    periods: {
      mostRecent: calculateMetrics(mostRecent, config),
      middle: calculateMetrics(middle, config),
      oldest: calculateMetrics(oldest, config),
    },
    last5Rounds: calculateMetrics(last5Rounds, config),
    overall: calculateMetrics(processed, config),
    metrics: calculateMetrics(processed, config),
    lastShotDate,
  };
}

function sortGappingData(a: ReportGappingShotData, b: ReportGappingShotData): number {
  const clubDelta = clubSortIndex(a.clubId) - clubSortIndex(b.clubId);
  if (clubDelta !== 0) return clubDelta;
  const powerDelta = powerStrength(b.power) - powerStrength(a.power);
  if (powerDelta !== 0) return powerDelta;
  return a.shotLabel.localeCompare(b.shotLabel);
}

export function buildScopedReportData(row: ReportGappingShotData, roundCount: number | 'all'): ReportGappingShotData {
  const scopedShots = roundCount === 'all' ? row.shots : getLastNRounds(row.shots, roundCount);
  const [mostRecent, middle, oldest] = splitIntoThirds(scopedShots);
  const last5Rounds = getLastNRounds(scopedShots, 5);
  return {
    ...row,
    shots: scopedShots,
    ratings: calculateClubRatings(scopedShots, row.config),
    metrics: calculateMetrics(scopedShots, row.config),
    overall: calculateMetrics(scopedShots, row.config),
    last5Rounds: calculateMetrics(last5Rounds, row.config),
    periods: {
      mostRecent: calculateMetrics(mostRecent, row.config),
      middle: calculateMetrics(middle, row.config),
      oldest: calculateMetrics(oldest, row.config),
    },
    lastShotDate: scopedShots.at(-1)?.date ?? null,
  };
}

export function buildReportGappingAnalysis({
  profiles,
  shots,
  clubs,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingHcpTarget,
  distanceToTargetTolerance,
  shotClassificationRules = loadShotClassificationRules(),
}: {
  profiles: ShotProfileMap;
  shots: Shot[];
  clubs: ClubConfig[];
  practiceSessions: PracticeSession[];
  practiceConfigs: ClubPracticeConfig[];
  shotsBySession: ShotsBySession;
  gappingHcpTarget: number;
  distanceToTargetTolerance: number;
  shotClassificationRules?: ShotClassificationRules;
}): ReportGappingAnalysis {
  const { shotToAssignment, options } = buildCourseShotGappingAssignments({
    profiles,
    shots,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    shotCategoryOverrides: loadShotCategoryOverrides(),
    shotClassificationRules,
  });
  const groupedShots = new Map<string, { assignment: CourseShotGappingAssignment; shots: Shot[] }>();
  const unmatchedRawShots: Shot[] = [];

  for (const shot of shots) {
    const assignment = shotToAssignment.get(shot.id);
    if (!assignment) {
      unmatchedRawShots.push(shot);
      continue;
    }
    const key = visibleGappingConfigKey(assignment.configKey);
    const current = groupedShots.get(key) ?? { assignment, shots: [] };
    current.shots.push(shot);
    groupedShots.set(key, current);
  }

  const catalogueOptions = [...options.entries()]
    .map(([key, assignment]) => {
      const visibleKey = visibleGappingConfigKey(key);
      const labels = getAssignmentLabel({ ...assignment, configKey: visibleKey });
      return {
        key: visibleKey,
        ...labels,
      };
    })
    .sort((a, b) => {
      const aAssignment = options.get(a.key) ?? [...options.values()].find((item) => visibleGappingConfigKey(item.configKey) === a.key);
      const bAssignment = options.get(b.key) ?? [...options.values()].find((item) => visibleGappingConfigKey(item.configKey) === b.key);
      if (!aAssignment || !bAssignment) return a.label.localeCompare(b.label);
      const clubDelta = clubSortIndex(aAssignment.profile.clubId) - clubSortIndex(bAssignment.profile.clubId);
      if (clubDelta !== 0) return clubDelta;
      return a.label.localeCompare(b.label);
    });

  const gappingShots = [...options.entries()]
    .map(([key, assignment]) => {
      const visibleKey = visibleGappingConfigKey(key);
      const group = groupedShots.get(visibleKey);
      const labels = getAssignmentLabel({ ...assignment, configKey: visibleKey });
      const visiblePower = visibleKey.split('_').at(-1) ?? assignment.profile.power;
      return buildDataRow({
        key: visibleKey,
        ...labels,
        clubId: assignment.profile.clubId,
        shotType: assignment.profile.shotType,
        power: visiblePower,
        target: assignment.target,
        rawShots: group?.shots ?? [],
        clubs,
        distanceToTargetTolerance,
      });
    })
    .sort(sortGappingData);

  const clubGroups = new Map<string, Shot[]>();
  for (const shot of shots) {
    const clubId = getClubConfigId(shot.club);
    clubGroups.set(clubId, [...(clubGroups.get(clubId) ?? []), shot]);
  }

  const clubRollups = [...clubGroups.entries()]
    .map(([clubId, rawShots]) => {
      const config = clubs.find((club) => club.id === clubId);
      return buildDataRow({
        key: `club:${clubId}`,
        label: config?.clubName ?? clubId,
        clubLabel: config?.clubName ?? clubId,
        shotLabel: 'Club roll-up',
        powerLabel: 'All',
        clubId,
        shotType: 'rollup',
        power: 'all',
        target: 'all',
        rawShots,
        clubs,
        distanceToTargetTolerance,
      });
    })
    .filter((row) => row.shots.length >= 3)
    .sort(sortGappingData);

  const unmatchedShots = unmatchedRawShots.map((shot) => {
    const config = clubs.find((club) => club.id === getClubConfigId(shot.club));
    return processShot(shot, config, distanceToTargetTolerance);
  });

  return { shots: gappingShots, clubRollups, unmatchedShots, catalogueOptions };
}

function formatPct(value: number): string {
  return `${Math.round(value)}%`;
}

function formatDistance(value: number): string {
  return `${Math.round(value)}m`;
}

function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function recentTrend(shot: ReportGappingShotData): number {
  return shot.periods.mostRecent.onTargetPct - shot.periods.middle.onTargetPct;
}

function hasMissingKeyData(shot: ReportGappingShotData): boolean {
  return shot.metrics.shotCount > 0 && (
    shot.metrics.avgDistanceHit <= 0
    || !Number.isFinite(shot.metrics.onTargetPct)
    || !Number.isFinite(shot.metrics.badMissPct)
  );
}

function classifyShotDecision(shot: ReportGappingShotData, now: Date): ShotDecision {
  const recentCount = shot.last5Rounds.shotCount;
  const staleAge = daysSince(shot.lastShotDate, now);
  const trend = recentTrend(shot);

  if (shot.metrics.shotCount < decisionThresholds.minSampleSize) {
    return {
      bucket: 'retest',
      shot,
      reason: `${shot.metrics.shotCount} reviewed shots; needs ${decisionThresholds.minSampleSize}+ for a reliable read.`,
    };
  }

  if (recentCount < decisionThresholds.minRecentSampleSize) {
    return {
      bucket: 'retest',
      shot,
      reason: `${recentCount} recent shots; re-test in Gapping or practice before trusting it.`,
    };
  }

  if (staleAge !== null && staleAge > decisionThresholds.staleDays) {
    return {
      bucket: 'retest',
      shot,
      reason: `Last seen ${staleAge} days ago; refresh the sample before making decisions.`,
    };
  }

  if (hasMissingKeyData(shot)) {
    return {
      bucket: 'retest',
      shot,
      reason: 'Missing key target or distance data; re-test before using this as a decision shot.',
    };
  }

  if (
    shot.metrics.badMissPct >= decisionThresholds.cautionBadMissPct
    || shot.metrics.sideVariation >= decisionThresholds.cautionSideVariation
    || shot.metrics.onTargetPct < decisionThresholds.cautionOnTargetPct
    || shot.metrics.strikeCentrePct < decisionThresholds.cautionStrikePct
    || trend < -15
  ) {
    const reason = shot.metrics.badMissPct >= decisionThresholds.cautionBadMissPct
      ? `Bad-miss rate is high at ${formatPct(shot.metrics.badMissPct)}.`
      : shot.metrics.sideVariation >= decisionThresholds.cautionSideVariation
        ? `Side variation is wide at ${formatDistance(shot.metrics.sideVariation)}.`
        : shot.metrics.onTargetPct < decisionThresholds.cautionOnTargetPct
          ? `On-target rate is low at ${formatPct(shot.metrics.onTargetPct)}.`
          : shot.metrics.strikeCentrePct < decisionThresholds.cautionStrikePct
            ? `Strike rate is low at ${formatPct(shot.metrics.strikeCentrePct)}.`
            : `Recent on-target trend is down ${Math.round(Math.abs(trend))} points.`;
    return { bucket: 'caution', shot, reason };
  }

  if (
    shot.metrics.onTargetPct >= decisionThresholds.trustOnTargetPct
    && shot.metrics.badMissPct <= decisionThresholds.trustBadMissPct
    && shot.metrics.sideVariation <= decisionThresholds.trustSideVariation
    && shot.metrics.strikeCentrePct >= decisionThresholds.trustStrikePct
    && trend >= -5
  ) {
    return {
      bucket: 'trust',
      shot,
      reason: `Reliable sample, ${formatPct(shot.metrics.onTargetPct)} on-target, ${formatPct(shot.metrics.badMissPct)} bad misses.`,
    };
  }

  return {
    bucket: 'build',
    shot,
    reason: `Usable shot with ${shot.metrics.shotCount} samples; improve ${shot.metrics.onTargetPct < decisionThresholds.trustOnTargetPct ? 'target rate' : shot.metrics.sideVariation > decisionThresholds.trustSideVariation ? 'side variation' : 'consistency'} next.`,
  };
}

export function buildShotDecisionSummary(shots: ReportGappingShotData[], now = new Date()): ShotDecisionSummary {
  const summary: ShotDecisionSummary = {
    trust: [],
    build: [],
    caution: [],
    retest: [],
  };

  for (const shot of shots) {
    const decision = classifyShotDecision(shot, now);
    summary[decision.bucket].push(decision);
  }

  const sortDecisions = (a: ShotDecision, b: ShotDecision) => {
    if (a.bucket === 'trust') return b.shot.ratings.capability - a.shot.ratings.capability;
    if (a.bucket === 'caution') return b.shot.metrics.badMissPct - a.shot.metrics.badMissPct || b.shot.metrics.sideVariation - a.shot.metrics.sideVariation;
    if (a.bucket === 'retest') return a.shot.metrics.shotCount - b.shot.metrics.shotCount;
    return b.shot.ratings.capability - a.shot.ratings.capability;
  };

  summary.trust.sort(sortDecisions);
  summary.build.sort(sortDecisions);
  summary.caution.sort(sortDecisions);
  summary.retest.sort(sortDecisions);

  return summary;
}

export function getBenchmarkFamily(row: ReportGappingShotData): BenchmarkFamily {
  if (row.clubId === 'dr') return 'driver';
  if (row.shotType === 'pitch' || row.shotType === 'chip' || row.shotType === 'bump') return 'wedge';
  if (['pw', 'gw', 'sw', 'lw'].includes(row.clubId)) return 'wedge';
  if (['5w', '3w', '4h', '5h', '5i', '6i'].includes(row.clubId)) return 'longClub';
  return 'midIron';
}

function compareMetric(value: number, benchmark: number, higherIsBetter: boolean, distanceMetric = false): BenchmarkStatus {
  const aheadMargin = distanceMetric ? benchmarkTolerance.aheadDistanceMarginM : benchmarkTolerance.aheadPctMargin;
  const watchMargin = distanceMetric ? benchmarkTolerance.watchDistanceMarginM : benchmarkTolerance.watchPctMargin;

  if (higherIsBetter) {
    if (value >= benchmark + aheadMargin) return 'ahead';
    if (value >= benchmark - aheadMargin) return 'on-track';
    if (value >= benchmark - watchMargin) return 'watch';
    return 'priority-gap';
  }

  if (value <= benchmark - aheadMargin) return 'ahead';
  if (value <= benchmark + aheadMargin) return 'on-track';
  if (value <= benchmark + watchMargin) return 'watch';
  return 'priority-gap';
}

function statusRank(status: BenchmarkStatus): number {
  if (status === 'priority-gap') return 4;
  if (status === 'watch') return 3;
  if (status === 'on-track') return 2;
  if (status === 'ahead') return 1;
  return 5;
}

export function buildShotBenchmarkResult(row: ReportGappingShotData, hcp: BenchmarkHcp): ShotBenchmarkResult {
  const family = getBenchmarkFamily(row);
  const profile = benchmarkProfiles[hcp][family];
  const recentShots = row.last5Rounds.shotCount;

  if (row.metrics.shotCount < benchmarkSampleThresholds.minShots || recentShots < benchmarkSampleThresholds.minRecentShots) {
    return {
      status: 'not-enough-data',
      statusLabel: benchmarkStatusLabels['not-enough-data'],
      family,
      hcp,
      mainGap: 'More sample needed',
      mainStrength: 'None yet',
      metrics: [],
    };
  }

  const metricResults: BenchmarkMetricResult[] = [
    {
      key: 'onTargetPct',
      label: 'On Target',
      value: row.metrics.onTargetPct,
      benchmark: profile.onTargetPct,
      higherIsBetter: true,
      status: compareMetric(row.metrics.onTargetPct, profile.onTargetPct, true),
    },
    {
      key: 'badMissPct',
      label: 'Bad Miss',
      value: row.metrics.badMissPct,
      benchmark: profile.badMissPct,
      higherIsBetter: false,
      status: compareMetric(row.metrics.badMissPct, profile.badMissPct, false),
    },
    {
      key: 'sideVariationM',
      label: 'Side Variation',
      value: row.metrics.sideVariation,
      benchmark: profile.sideVariationM,
      higherIsBetter: false,
      status: compareMetric(row.metrics.sideVariation, profile.sideVariationM, false, true),
    },
    {
      key: 'distanceVariationM',
      label: 'Distance Variation',
      value: row.metrics.distanceVariation,
      benchmark: profile.distanceVariationM,
      higherIsBetter: false,
      status: compareMetric(row.metrics.distanceVariation, profile.distanceVariationM, false, true),
    },
    {
      key: 'strikePct',
      label: 'Strike',
      value: row.metrics.strikeCentrePct,
      benchmark: profile.strikePct,
      higherIsBetter: true,
      status: compareMetric(row.metrics.strikeCentrePct, profile.strikePct, true),
    },
  ].filter((metric) => Number.isFinite(metric.value));

  if (metricResults.length === 0) {
    return {
      status: 'not-enough-data',
      statusLabel: benchmarkStatusLabels['not-enough-data'],
      family,
      hcp,
      mainGap: 'Missing metrics',
      mainStrength: 'None yet',
      metrics: [],
    };
  }

  const priority = metricResults.filter((metric) => metric.status === 'priority-gap');
  const watch = metricResults.filter((metric) => metric.status === 'watch');
  const ahead = metricResults.filter((metric) => metric.status === 'ahead');
  const status: BenchmarkStatus = priority.length
    ? 'priority-gap'
    : watch.length
      ? 'watch'
      : ahead.length
        ? 'ahead'
        : 'on-track';
  const sortedGaps = [...metricResults].sort((a, b) => statusRank(b.status) - statusRank(a.status));
  const mainGap = priority[0]?.label ?? watch[0]?.label ?? 'None';
  const mainStrength = ahead[0]?.label ?? sortedGaps.find((metric) => metric.status === 'on-track')?.label ?? 'None yet';

  return {
    status,
    statusLabel: benchmarkStatusLabels[status],
    family,
    hcp,
    mainGap,
    mainStrength,
    metrics: metricResults,
  };
}

export function benchmarkStatusClass(status: BenchmarkStatus): string {
  if (status === 'ahead') return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300';
  if (status === 'on-track') return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
  if (status === 'watch') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (status === 'priority-gap') return 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300';
  return 'border-border bg-muted text-muted-foreground';
}

export function benchmarkStatusColor(status: BenchmarkStatus): string {
  if (status === 'ahead') return 'hsl(142, 55%, 42%)';
  if (status === 'on-track') return 'hsl(217, 75%, 55%)';
  if (status === 'watch') return 'hsl(38, 90%, 50%)';
  if (status === 'priority-gap') return 'hsl(0, 72%, 55%)';
  return 'hsl(var(--muted-foreground))';
}

function decisionByShot(summary: ShotDecisionSummary): Map<string, ShotDecision> {
  const map = new Map<string, ShotDecision>();
  for (const bucket of [summary.trust, summary.build, summary.caution, summary.retest]) {
    for (const decision of bucket) map.set(decision.shot.key, decision);
  }
  return map;
}

function benchmarkFor(benchmarks: Map<string, ShotBenchmarkResult>, shot: ReportGappingShotData): ShotBenchmarkResult | null {
  return benchmarks.get(shot.key) ?? null;
}

function emptySnapshot(key: SnapshotCardKey, title: string, detail = 'Not enough data yet.'): PerformanceSnapshotCard {
  return { key, title, shot: null, benchmark: null, value: 'Not enough data yet', detail };
}

export function buildPerformanceSnapshot(
  shots: ReportGappingShotData[],
  benchmarks: Map<string, ShotBenchmarkResult>,
  summary: ShotDecisionSummary,
): PerformanceSnapshotCard[] {
  const decisions = decisionByShot(summary);
  const analysedShots = shots.filter((shot) => shot.metrics.shotCount > 0);
  const enoughDataShots = analysedShots.filter((shot) => benchmarkFor(benchmarks, shot)?.status !== 'not-enough-data');

  const best = [...enoughDataShots]
    .filter((shot) => ['ahead', 'on-track'].includes(benchmarkFor(benchmarks, shot)?.status ?? ''))
    .sort((a, b) => {
      const statusA = benchmarkFor(benchmarks, a)?.status === 'ahead' ? 1 : 0;
      const statusB = benchmarkFor(benchmarks, b)?.status === 'ahead' ? 1 : 0;
      return statusB - statusA || b.ratings.capability - a.ratings.capability || b.metrics.onTargetPct - a.metrics.onTargetPct;
    })[0] ?? null;

  const reliable = [...enoughDataShots]
    .sort((a, b) => (
      a.metrics.badMissPct - b.metrics.badMissPct
      || a.metrics.sideVariation - b.metrics.sideVariation
      || a.metrics.distanceVariation - b.metrics.distanceVariation
      || b.metrics.strikeCentrePct - a.metrics.strikeCentrePct
    ))[0] ?? null;

  const watch = [...enoughDataShots]
    .filter((shot) => ['priority-gap', 'watch'].includes(benchmarkFor(benchmarks, shot)?.status ?? ''))
    .sort((a, b) => {
      const rank = (shot: ReportGappingShotData) => benchmarkFor(benchmarks, shot)?.status === 'priority-gap' ? 2 : 1;
      return rank(b) - rank(a) || b.metrics.shotCount - a.metrics.shotCount;
    })[0] ?? null;

  const used = [...analysedShots].sort((a, b) => b.metrics.shotCount - a.metrics.shotCount)[0] ?? null;

  const improved = [...enoughDataShots]
    .map((shot) => ({
      shot,
      trend: shot.periods.mostRecent.shotCount > 0 && shot.periods.oldest.shotCount > 0
        ? shot.periods.mostRecent.onTargetPct - shot.periods.oldest.onTargetPct
        : null,
    }))
    .filter((item): item is { shot: ReportGappingShotData; trend: number } => item.trend !== null && item.trend > 0)
    .sort((a, b) => b.trend - a.trend)[0] ?? null;

  const needsData = [...analysedShots]
    .filter((shot) => benchmarkFor(benchmarks, shot)?.status === 'not-enough-data' || decisions.get(shot.key)?.bucket === 'retest')
    .sort((a, b) => a.metrics.shotCount - b.metrics.shotCount || b.last5Rounds.shotCount - a.last5Rounds.shotCount)[0] ?? null;

  const cards: PerformanceSnapshotCard[] = [
    best ? {
      key: 'best',
      title: 'Best Shot',
      shot: best,
      benchmark: benchmarkFor(benchmarks, best),
      value: best.label,
      detail: `${Math.round(best.metrics.onTargetPct)}% on target · ${Math.round(best.metrics.badMissPct)}% bad miss`,
    } : emptySnapshot('best', 'Best Shot'),
    reliable ? {
      key: 'reliable',
      title: 'Most Reliable',
      shot: reliable,
      benchmark: benchmarkFor(benchmarks, reliable),
      value: reliable.label,
      detail: `${Math.round(reliable.metrics.badMissPct)}% bad miss · ${Math.round(reliable.metrics.sideVariation)}m side variation`,
    } : emptySnapshot('reliable', 'Most Reliable'),
    watch ? {
      key: 'watch',
      title: 'Biggest Watch',
      shot: watch,
      benchmark: benchmarkFor(benchmarks, watch),
      value: watch.label,
      detail: `Main gap: ${benchmarkFor(benchmarks, watch)?.mainGap ?? 'Benchmark gap'}`,
    } : emptySnapshot('watch', 'Biggest Watch'),
    used ? {
      key: 'used',
      title: 'Most Used',
      shot: used,
      benchmark: benchmarkFor(benchmarks, used),
      value: used.label,
      detail: `${used.metrics.shotCount} reviewed shots`,
    } : emptySnapshot('used', 'Most Used'),
    improved ? {
      key: 'improved',
      title: 'Most Improved',
      shot: improved.shot,
      benchmark: benchmarkFor(benchmarks, improved.shot),
      value: improved.shot.label,
      detail: `On-target trend up ${Math.round(improved.trend)} points`,
    } : emptySnapshot('improved', 'Most Improved', 'Trend data not available yet.'),
    needsData ? {
      key: 'data',
      title: 'Needs More Data',
      shot: needsData,
      benchmark: benchmarkFor(benchmarks, needsData),
      value: needsData.label,
      detail: `${needsData.metrics.shotCount} reviewed shots · ${needsData.last5Rounds.shotCount} recent`,
    } : emptySnapshot('data', 'Needs More Data'),
  ];

  return cards;
}

export function buildPerformanceMapData(
  shots: ReportGappingShotData[],
  benchmarks: Map<string, ShotBenchmarkResult>,
  summary: ShotDecisionSummary,
): PerformanceMapPoint[] {
  const decisions = decisionByShot(summary);
  return shots
    .map((shot) => {
      const benchmark = benchmarkFor(benchmarks, shot);
      if (!benchmark || shot.metrics.shotCount <= 0) return null;
      return {
        key: shot.key,
        label: shot.label,
        clubLabel: shot.clubLabel,
        shotLabel: shot.shotLabel,
        powerLabel: shot.powerLabel,
        onTargetPct: shot.metrics.onTargetPct,
        badMissPct: shot.metrics.badMissPct,
        shotCount: shot.metrics.shotCount,
        sideVariation: shot.metrics.sideVariation,
        distanceVariation: shot.metrics.distanceVariation,
        strikePct: shot.metrics.strikeCentrePct,
        benchmark,
        decision: decisions.get(shot.key)?.bucket ?? null,
      };
    })
    .filter((point): point is PerformanceMapPoint => point !== null);
}
