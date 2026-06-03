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
  shareOfTotalPct?: number | null;
  dominantClubShotLabel?: string | null;
  dominantClubShotPct?: number | null;
  avgShotsToGreen?: number | null;
  round: MetricsResult;
  last5: MetricsResult;
  recentThird: MetricsResult;
}

export interface RoundReviewModel {
  scope: RoundReviewScope;
  label: string;
  round: MetricsResult;
  last5: MetricsResult;
  recentThird: MetricsResult;
  clubAndTypeRows: RoundReviewRow[];
  greenDistanceRollups: RoundReviewRow[];
  greenDistanceRows: RoundReviewRow[];
  lieRows: RoundReviewRow[];
  distanceWarning: string | null;
  hasShotSequence: boolean;
}

const DISTANCE_ROLLUPS = new Set(['0-150', '0-100']);
const LIE_ORDER = ['tee', 'fairway', 'first cut', 'rough', 'bunker', 'recovery'];
export type RoundReviewScope = 'round' | 'last20' | 'all';

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

function isUnspecifiedTarget(value: string | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase();
  return !normalized || normalized === 'unspecified' || normalized === 'unknown' || normalized === '-';
}

function inferUnspecifiedTarget(clubId: string, shotTypeLabel: string): 'fairway' | 'green' {
  if (shotTypeLabel.trim().toLowerCase().includes('punch')) return 'fairway';
  if (clubId === 'dr' || clubId === '5w' || clubId === '4h') return 'fairway';
  return 'green';
}

function makeRows(
  selected: ProcessedShot[],
  last5: ProcessedShot[],
  recentThird: ProcessedShot[],
  groups: Array<{ key: string; label: string; clubLabel?: string; clubSortIndex?: number; shotTypeLabel?: string; powerLabel?: string; targetLabel?: string; filter: (shot: ProcessedShot) => boolean }>,
  avgShotsToGreen?: (shots: ProcessedShot[]) => number | null
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
        avgShotsToGreen: avgShotsToGreen?.(roundShots) ?? null,
        round: metrics(roundShots),
        last5: metrics(last5.filter(group.filter)),
        recentThird: metrics(recentThird.filter(group.filter)),
      };
    })
    .filter((row): row is RoundReviewRow => row !== null);
}

function getMostUsedClubShot(
  shots: ProcessedShot[],
  getClubAndTypeGroup: (shot: ProcessedShot) => Pick<RoundReviewRow, 'clubLabel' | 'shotTypeLabel' | 'powerLabel' | 'clubSortIndex'>
): Pick<RoundReviewRow, 'dominantClubShotLabel' | 'dominantClubShotPct'> {
  if (shots.length === 0) return { dominantClubShotLabel: null, dominantClubShotPct: null };

  const counts = new Map<string, { label: string; count: number; clubSortIndex: number; shotTypeLabel: string }>();
  for (const shot of shots) {
    const group = getClubAndTypeGroup(shot);
    const shotType = group.shotTypeLabel ?? 'Unspecified';
    const power = group.powerLabel && group.powerLabel !== '-' && group.powerLabel !== shotType ? ` ${group.powerLabel}` : '';
    const label = `${group.clubLabel ?? 'Unknown club'} / ${shotType}${power}`;
    const current = counts.get(label) ?? {
      label,
      count: 0,
      clubSortIndex: group.clubSortIndex ?? Number.POSITIVE_INFINITY,
      shotTypeLabel: group.shotTypeLabel ?? '',
    };
    current.count += 1;
    counts.set(label, current);
  }

  const top = [...counts.values()].sort((a, b) =>
    b.count - a.count
    || a.clubSortIndex - b.clubSortIndex
    || a.shotTypeLabel.localeCompare(b.shotTypeLabel)
    || a.label.localeCompare(b.label)
  )[0];

  return {
    dominantClubShotLabel: top.label,
    dominantClubShotPct: (top.count / shots.length) * 100,
  };
}

export function buildRoundReview(
  shots: Shot[],
  clubs: ClubConfig[],
  distanceToTargetTolerance: number,
  selectedRoundDate: string,
  gappingAssignments = new Map<string, CourseShotGappingAssignment>(),
  scope: RoundReviewScope = 'round'
): RoundReviewModel {
  const courseShots = shots.filter(shot => !isPuttingShot(shot));
  const roundDates = [...new Set(courseShots.map(shot => getShotDateKey(shot.date)))]
    .sort((a, b) => b.localeCompare(a));
  const latestRoundDate = roundDates[0] ?? selectedRoundDate;
  const selectedDate = roundDates.includes(selectedRoundDate) ? selectedRoundDate : latestRoundDate;
  const selectedDates = scope === 'all'
    ? new Set(roundDates)
    : scope === 'last20'
      ? new Set(roundDates.slice(0, 20))
      : new Set(selectedDate ? [selectedDate] : []);
  const selectedBoundaryDate = scope === 'last20'
    ? roundDates.slice(0, 20).at(-1) ?? selectedDate
    : scope === 'all'
      ? null
      : selectedDate;
  const historicalShots = selectedBoundaryDate
    ? courseShots.filter(shot => getShotDateKey(shot.date) < selectedBoundaryDate)
    : [];
  const priorRoundDates = [...new Set(historicalShots.map(shot => getShotDateKey(shot.date)))]
    .sort((a, b) => b.localeCompare(a));
  const last5Dates = new Set(priorRoundDates.slice(0, 5));

  const selected = processShots(
    courseShots.filter(shot => selectedDates.has(getShotDateKey(shot.date))),
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
    const clubId = assignment?.profile.clubId ?? getClubConfigId(shot.club);
    const savedTarget = assignment?.target ?? shot.targetIntent.trim().toLowerCase();
    const target = isUnspecifiedTarget(savedTarget) ? inferUnspecifiedTarget(clubId, shotTypeLabel) : savedTarget;
    const inferredTargetLabel = target === 'fairway' ? 'Fairway' : target === 'green' ? 'Green' : 'Unspecified';
    const key = `${assignment?.configKey ?? `${clubLabel}|${shotTypeLabel}|${powerLabel}`}|${inferredTargetLabel}`;
    return {
      key,
      label: `${clubLabel} · ${shotTypeLabel} · ${powerLabel} · ${inferredTargetLabel}`,
      clubLabel,
      clubSortIndex: clubOrder,
      shotTypeLabel,
      powerLabel,
      targetLabel: inferredTargetLabel,
    };
  };

  const clubAndTypeGroups = [...new Map(selected.map(shot => {
    const group = getClubAndTypeGroup(shot);
    return [group.key, {
      ...group,
      filter: (candidate: ProcessedShot) => getClubAndTypeGroup(candidate).key === group.key,
    }];
  })).values()];

  const selectedByHole = new Map<number, ProcessedShot[]>();
  for (const shot of selected) {
    if (shot.holeNumber === null || shot.shotNumber === null) continue;
    const holeShots = selectedByHole.get(shot.holeNumber) ?? [];
    holeShots.push(shot);
    selectedByHole.set(shot.holeNumber, holeShots);
  }
  for (const holeShots of selectedByHole.values()) {
    holeShots.sort((a, b) => (a.shotNumber ?? 0) - (b.shotNumber ?? 0));
  }
  const hasShotSequence = selected.length > 0 && selected.every(shot => shot.holeNumber !== null && shot.shotNumber !== null);
  const getAvgShotsToGreen = (shotsInBand: ProcessedShot[]): number | null => {
    const values = shotsInBand.flatMap(shot => {
      if (shot.holeNumber === null || shot.shotNumber === null) return [];
      const sequence = (selectedByHole.get(shot.holeNumber) ?? [])
        .filter(candidate => (candidate.shotNumber ?? 0) >= (shot.shotNumber ?? 0));
      const greenIndex = sequence.findIndex(candidate => /green|fringe|hole/i.test(candidate.endLie));
      return greenIndex === -1 ? [] : [greenIndex + 1];
    });
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const greenTargetShots = (candidates: ProcessedShot[]) => candidates.filter(shot => {
    const assignment = gappingAssignments.get(shot.id);
    const group = getClubAndTypeGroup(shot);
    const savedTarget = assignment?.target ?? shot.targetIntent.trim().toLowerCase();
    const clubId = assignment?.profile.clubId ?? getClubConfigId(shot.club);
    const target = isUnspecifiedTarget(savedTarget)
      ? inferUnspecifiedTarget(clubId, group.shotTypeLabel ?? '')
      : savedTarget;
    return target === 'green';
  });

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

  const greenDistanceRollups = distanceWarning ? [] : makeRows(greenTargetShots(selected), greenTargetShots(last5), greenTargetShots(recentThird), distanceGroups.filter(group => DISTANCE_ROLLUPS.has(group.key)), getAvgShotsToGreen);
  const greenDistanceRows = distanceWarning ? [] : makeRows(greenTargetShots(selected), greenTargetShots(last5), greenTargetShots(recentThird), distanceGroups.filter(group => !DISTANCE_ROLLUPS.has(group.key)), getAvgShotsToGreen)
    .map(row => ({
      ...row,
      ...getMostUsedClubShot(greenTargetShots(selected).filter(shot => filterShotsByTargetDistance([shot], row.key).length === 1), getClubAndTypeGroup),
    }));
  const lieRows = makeRows(selected, last5, recentThird, lieGroups)
    .map(row => ({
      ...row,
      shareOfTotalPct: selected.length ? (row.round.shotCount / selected.length) * 100 : null,
    }));

  return {
    scope,
    label: scope === 'all' ? 'All Rounds' : scope === 'last20' ? `Last ${Math.min(20, roundDates.length)} Rounds` : selectedDate,
    round: metrics(selected),
    last5: metrics(last5),
    recentThird: metrics(recentThird),
    clubAndTypeRows: makeRows(selected, last5, recentThird, clubAndTypeGroups),
    greenDistanceRollups,
    greenDistanceRows,
    lieRows,
    distanceWarning,
    hasShotSequence,
  };
}
