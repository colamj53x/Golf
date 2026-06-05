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
