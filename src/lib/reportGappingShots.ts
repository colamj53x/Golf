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
}

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
