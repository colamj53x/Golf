import { calculateMetrics, getClubConfigId, getShotDateKey, MetricsResult, processShot } from '@/lib/golfCalculations';
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from '@/lib/distanceFilters';
import { clubSortIndex, CourseShotGappingAssignment, getClubName, getExpandedGappingShotLabel } from '@/lib/gapping';
import { ClubConfig, ProcessedShot, Shot } from '@/types/golf';

export interface RoundReviewRow {
  key: string;
  label: string;
  clubLabel?: string;
  clubSortIndex?: number;
  shotTypeLabel?: string;
  powerLabel?: string;
  targetLabel?: string;
  round: MetricsResult;
  last5: MetricsResult;
  recentThird: MetricsResult;
}

export interface RoundReviewModel {
  round: MetricsResult;
  last5: MetricsResult;
  recentThird: MetricsResult;
  clubAndTypeRows: RoundReviewRow[];
  distanceRollups: RoundReviewRow[];
  distanceRows: RoundReviewRow[];
  lieRows: RoundReviewRow[];
  distanceWarning: string | null;
}

const DISTANCE_ROLLUPS = new Set(['0-150', '0-100']);
const LIE_ORDER = ['tee', 'fairway', 'first cut', 'rough', 'bunker', 'recovery'];

export function isPuttingShot(shot: Shot): boolean {
  return shot.club.trim().toLowerCase() === 'pu' || shot.type.trim().toLowerCase() === 'putting';
}

function titleCase(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : '';
}

export function getRoundReviewShotLabel(shot: Shot): string {
  const family = shot.shotFamily.trim().toLowerCase();
  const effort = shot.swingEffort.trim().toLowerCase();
  if (!family) return shot.type || 'Unspecified';
  if (family === 'full' && effort === 'full') return 'Full';
  const effortLabel = effort === '9pm' ? 'Half' : effort === 'full' ? 'Full' : titleCase(effort);
  const familyLabel = family === 'bump' ? 'Bump' : titleCase(family);
  return effortLabel ? `${familyLabel} ${effortLabel}` : familyLabel;
}

function processShots(shots: Shot[], clubs: ClubConfig[], distanceToTargetTolerance: number): ProcessedShot[] {
  return shots.map(shot => processShot(
    shot,
    clubs.find(club => club.id === getClubConfigId(shot.club)),
    distanceToTargetTolerance
  ));
}

function metrics(shots: ProcessedShot[]): MetricsResult {
  return calculateMetrics(shots, undefined);
}

function makeRows(
  selected: ProcessedShot[],
  last5: ProcessedShot[],
  recentThird: ProcessedShot[],
  groups: Array<{ key: string; label: string; clubLabel?: string; clubSortIndex?: number; shotTypeLabel?: string; powerLabel?: string; targetLabel?: string; filter: (shot: ProcessedShot) => boolean }>
): RoundReviewRow[] {
  return groups
    .map(group => {
      const roundShots = selected.filter(group.filter);
      if (roundShots.length === 0) return null;
      return {
        key: group.key,
        label: group.label,
        clubLabel: group.clubLabel,
        clubSortIndex: group.clubSortIndex,
        shotTypeLabel: group.shotTypeLabel,
        powerLabel: group.powerLabel,
        targetLabel: group.targetLabel,
        round: metrics(roundShots),
        last5: metrics(last5.filter(group.filter)),
        recentThird: metrics(recentThird.filter(group.filter)),
      };
    })
    .filter((row): row is RoundReviewRow => row !== null);
}

export function buildRoundReview(
  shots: Shot[],
  clubs: ClubConfig[],
  distanceToTargetTolerance: number,
  selectedRoundDate: string,
  gappingAssignments = new Map<string, CourseShotGappingAssignment>()
): RoundReviewModel {
  const courseShots = shots.filter(shot => !isPuttingShot(shot));
  const historicalShots = courseShots.filter(shot => getShotDateKey(shot.date) < selectedRoundDate);
  const priorRoundDates = [...new Set(historicalShots.map(shot => getShotDateKey(shot.date)))]
    .sort((a, b) => b.localeCompare(a));
  const last5Dates = new Set(priorRoundDates.slice(0, 5));

  const selected = processShots(
    courseShots.filter(shot => getShotDateKey(shot.date) === selectedRoundDate),
    clubs,
    distanceToTargetTolerance
  );
  const historical = processShots(historicalShots, clubs, distanceToTargetTolerance)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const last5 = historical.filter(shot => last5Dates.has(getShotDateKey(shot.date)));
  const recentThirdSize = Math.ceil(historical.length / 3);
  const recentThird = recentThirdSize > 0 ? historical.slice(-recentThirdSize) : [];

  const getClubAndTypeGroup = (shot: ProcessedShot) => {
    const assignment = gappingAssignments.get(shot.id);
    const clubLabel = assignment ? getClubName(assignment.profile) : shot.club || 'Unknown club';
    const clubOrder = clubSortIndex(assignment?.profile.clubId ?? getClubConfigId(shot.club));
    const expandedShotLabel = assignment ? getExpandedGappingShotLabel(assignment.profile) : getRoundReviewShotLabel({
      ...shot,
      shotFamily: shot.shotFamily || 'full',
      swingEffort: shot.swingEffort || 'full',
    });
    const powerLabel = expandedShotLabel.endsWith(' Half')
      ? 'Half'
      : expandedShotLabel.endsWith(' Full') || expandedShotLabel === 'Full'
        ? 'Full'
        : '-';
    const shotTypeLabel = expandedShotLabel.replace(/ (Half|Full)$/, '') || 'Unspecified';
    const savedTarget = assignment?.target ?? shot.targetIntent.trim().toLowerCase();
    const targetLabel = savedTarget === 'fairway' ? 'Fairway' : savedTarget === 'green' ? 'Green' : 'Unspecified';
    const key = `${assignment?.configKey ?? `${clubLabel}|${shotTypeLabel}|${powerLabel}`}|${targetLabel}`;
    return {
      key,
      label: `${clubLabel} · ${shotTypeLabel} · ${powerLabel} · ${targetLabel}`,
      clubLabel,
      clubSortIndex: clubOrder,
      shotTypeLabel,
      powerLabel,
      targetLabel,
    };
  };

  const clubAndTypeGroups = [...new Map(selected.map(shot => {
    const group = getClubAndTypeGroup(shot);
    return [group.key, {
      ...group,
      filter: (candidate: ProcessedShot) => getClubAndTypeGroup(candidate).key === group.key,
    }];
  })).values()];

  const distanceGroups = DISTANCE_FILTER_OPTIONS
    .filter(option => option.value !== 'all')
    .map(option => ({
      key: option.value,
      label: option.label,
      filter: (shot: ProcessedShot) => filterShotsByTargetDistance([shot], option.value).length === 1,
    }));

  const lieGroups = [...new Map(selected.map(shot => {
    const label = shot.startLie || 'Unspecified';
    return [label.toLowerCase(), {
      key: label.toLowerCase(),
      label,
      filter: (candidate: ProcessedShot) => (candidate.startLie || 'Unspecified').toLowerCase() === label.toLowerCase(),
    }];
  })).values()].sort((a, b) => {
    const aIndex = LIE_ORDER.indexOf(a.key);
    const bIndex = LIE_ORDER.indexOf(b.key);
    if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const distanceWarning = selected.length > 0
    && selected.every(shot => shot.target >= 0 && shot.target <= 9)
    && selected.some(shot => shot.total > 50)
    ? 'The stored distance-to-target values for this round are incomplete: every reviewed shot is recorded inside 10m. Go to More > Upload, turn on Replace matching round dates, and re-upload the CSV for this round. Review will refresh with the repaired distance-to-target values.'
    : null;

  return {
    round: metrics(selected),
    last5: metrics(last5),
    recentThird: metrics(recentThird),
    clubAndTypeRows: makeRows(selected, last5, recentThird, clubAndTypeGroups),
    distanceRollups: distanceWarning ? [] : makeRows(selected, last5, recentThird, distanceGroups.filter(group => DISTANCE_ROLLUPS.has(group.key))),
    distanceRows: distanceWarning ? [] : makeRows(selected, last5, recentThird, distanceGroups.filter(group => !DISTANCE_ROLLUPS.has(group.key))),
    lieRows: makeRows(selected, last5, recentThird, lieGroups),
    distanceWarning,
  };
}
