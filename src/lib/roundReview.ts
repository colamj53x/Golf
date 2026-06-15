import { calculateMetrics, getClubConfigId, getShotDateKey, MetricsResult, processShot } from '@/lib/golfCalculations';
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from '@/lib/distanceFilters';
import { clubSortIndex, CourseShotGappingAssignment, getClubName, getExpandedGappingShotLabel } from '@/lib/gapping';
import { ClubConfig, ProcessedShot, Shot } from '@/types/golf';
import { SHOT_TYPES } from '@/types/practiceClubs';

export interface RoundReviewRow {
  key: string;
  label: string;
  shotIds: string[];
  clubLabel?: string;
  clubSortIndex?: number;
  shotTypeLabel?: string;
  powerLabel?: string;
  targetLabel?: string;
  shareOfTotalPct?: number | null;
  dominantClubShotLabel?: string | null;
  dominantClubShotPct?: number | null;
  avgShotsToGreen?: number | null;
  round: RoundReviewMetrics;
  last5: RoundReviewMetrics;
  previous5: RoundReviewMetrics;
  season: RoundReviewMetrics;
  recentThird: RoundReviewMetrics;
}

export interface RoundReviewMetrics extends MetricsResult {
  targetSuccessPct: number | null;
  targetSuccessCount: number;
  targetAttemptCount: number;
  safeShotRate: number;
  scoringZoneSuccessPct: number | null;
  scoringZoneSuccessCount: number;
  scoringZoneAttemptCount: number;
}

export interface RoundReviewProgressPoint {
  label: string;
  rounds: number;
  shotQuality: number | null;
  targetSuccess: number | null;
  safeShotRate: number;
  scoringZoneSuccess: number | null;
  teeShotQuality: number | null;
  teeTargetSuccess: number | null;
  teeSafeShotRate: number | null;
  approachShotQuality: number | null;
  approachTargetSuccess: number | null;
  approachSafeShotRate: number | null;
  shortGameShotQuality: number | null;
  shortGameScoringZoneSuccess: number | null;
  shortGameSafeShotRate: number | null;
}

export interface RoundReviewArea {
  key: string;
  label: string;
  description: string;
  primaryMetric: 'shotQualityIndex' | 'targetSuccessPct' | 'scoringZoneSuccessPct';
  round: RoundReviewMetrics;
  last5: RoundReviewMetrics;
  previous5: RoundReviewMetrics;
}

export interface RoundReviewModel {
  scope: RoundReviewScope;
  label: string;
  round: RoundReviewMetrics;
  last5: RoundReviewMetrics;
  previous5: RoundReviewMetrics;
  season: RoundReviewMetrics;
  recentThird: RoundReviewMetrics;
  priorRoundCount: number;
  progress: RoundReviewProgressPoint[];
  areas: RoundReviewArea[];
  clubAndTypeRows: RoundReviewRow[];
  greenDistanceRollups: RoundReviewRow[];
  greenDistanceRows: RoundReviewRow[];
  lieRows: RoundReviewRow[];
  distanceWarning: string | null;
  hasShotSequence: boolean;
}

const DISTANCE_ROLLUPS = new Set(['0-150', '0-100']);
const LIE_ORDER = ['tee', 'fairway', 'first cut', 'rough', 'bunker', 'recovery'];
export type RoundReviewScope = 'round' | 'last5' | 'last10' | 'last20' | 'all';

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
  const familyLabel = SHOT_TYPES.find((option) => option.id === family)?.name ?? titleCase(family);
  if (family === 'full' && effort === 'full') return familyLabel;
  const effortLabel = effort === '9pm' ? 'Half' : effort === 'full' ? 'Full' : titleCase(effort);
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

function isGreenResult(shot: ProcessedShot): boolean {
  return /green|fringe|hole/i.test(shot.endLie);
}

function isFairwayResult(shot: ProcessedShot): boolean {
  return /fairway/i.test(shot.endLie);
}

function reviewMetrics(
  shots: ProcessedShot[],
  getTarget: (shot: ProcessedShot) => string
): RoundReviewMetrics {
  const base = metrics(shots);
  const targetAttempts = shots.filter(shot => ['fairway', 'green'].includes(getTarget(shot)));
  const targetSuccesses = targetAttempts.filter(shot => {
    const target = getTarget(shot);
    return target === 'green' ? isGreenResult(shot) : isFairwayResult(shot);
  });
  const scoringZoneAttempts = shots.filter(shot => getTarget(shot) === 'green' && shot.target <= 100);
  const scoringZoneSuccesses = scoringZoneAttempts.filter(isGreenResult);
  return {
    ...base,
    targetSuccessPct: targetAttempts.length ? (targetSuccesses.length / targetAttempts.length) * 100 : null,
    targetSuccessCount: targetSuccesses.length,
    targetAttemptCount: targetAttempts.length,
    safeShotRate: 100 - base.badMissPct,
    scoringZoneSuccessPct: scoringZoneAttempts.length ? (scoringZoneSuccesses.length / scoringZoneAttempts.length) * 100 : null,
    scoringZoneSuccessCount: scoringZoneSuccesses.length,
    scoringZoneAttemptCount: scoringZoneAttempts.length,
  };
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
  previous5: ProcessedShot[],
  season: ProcessedShot[],
  groups: Array<{ key: string; label: string; clubLabel?: string; clubSortIndex?: number; shotTypeLabel?: string; powerLabel?: string; targetLabel?: string; filter: (shot: ProcessedShot) => boolean }>,
  getTarget: (shot: ProcessedShot) => string,
  avgShotsToGreen?: (shots: ProcessedShot[]) => number | null
): RoundReviewRow[] {
  return groups
    .map(group => {
      const roundShots = selected.filter(group.filter);
      if (roundShots.length === 0) return null;
      return {
        key: group.key,
        label: group.label,
        shotIds: roundShots.map(shot => shot.id),
        clubLabel: group.clubLabel,
        clubSortIndex: group.clubSortIndex,
        shotTypeLabel: group.shotTypeLabel,
        powerLabel: group.powerLabel,
        targetLabel: group.targetLabel,
        avgShotsToGreen: avgShotsToGreen?.(roundShots) ?? null,
        round: reviewMetrics(roundShots, getTarget),
        last5: reviewMetrics(last5.filter(group.filter), getTarget),
        previous5: reviewMetrics(previous5.filter(group.filter), getTarget),
        season: reviewMetrics(season.filter(group.filter), getTarget),
        recentThird: reviewMetrics(last5.filter(group.filter), getTarget),
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
  const aggregateRoundCount = scope === 'last5' ? 5 : scope === 'last10' ? 10 : scope === 'last20' ? 20 : null;
  const selectedDates = scope === 'all'
    ? new Set(roundDates)
    : aggregateRoundCount
      ? new Set(roundDates.slice(0, aggregateRoundCount))
      : new Set(selectedDate ? [selectedDate] : []);
  const selectedBoundaryDate = aggregateRoundCount
    ? roundDates.slice(0, aggregateRoundCount).at(-1) ?? selectedDate
    : scope === 'all'
      ? null
      : selectedDate;
  const historicalShots = selectedBoundaryDate
    ? courseShots.filter(shot => getShotDateKey(shot.date) < selectedBoundaryDate)
    : [];
  const priorRoundDates = [...new Set(historicalShots.map(shot => getShotDateKey(shot.date)))]
    .sort((a, b) => b.localeCompare(a));
  const last5Dates = new Set(priorRoundDates.slice(0, 5));
  const previous5Dates = new Set(priorRoundDates.slice(5, 10));

  const selected = processShots(
    courseShots.filter(shot => selectedDates.has(getShotDateKey(shot.date))),
    clubs,
    distanceToTargetTolerance
  );
  const historical = processShots(historicalShots, clubs, distanceToTargetTolerance)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const last5 = historical.filter(shot => last5Dates.has(getShotDateKey(shot.date)));
  const previous5 = historical.filter(shot => previous5Dates.has(getShotDateKey(shot.date)));
  const season = [...historical, ...selected];

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
  const getTarget = (shot: ProcessedShot): string => {
    const assignment = gappingAssignments.get(shot.id);
    const group = getClubAndTypeGroup(shot);
    const savedTarget = assignment?.target ?? shot.targetIntent.trim().toLowerCase();
    const clubId = assignment?.profile.clubId ?? getClubConfigId(shot.club);
    return isUnspecifiedTarget(savedTarget)
      ? inferUnspecifiedTarget(clubId, group.shotTypeLabel ?? '')
      : savedTarget;
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
  const greenTargetShots = (candidates: ProcessedShot[]) => candidates.filter(shot => getTarget(shot) === 'green');

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

  const greenDistanceRollups = distanceWarning ? [] : makeRows(greenTargetShots(selected), greenTargetShots(last5), greenTargetShots(previous5), greenTargetShots(season), distanceGroups.filter(group => DISTANCE_ROLLUPS.has(group.key)), getTarget, getAvgShotsToGreen);
  const greenDistanceRows = distanceWarning ? [] : makeRows(greenTargetShots(selected), greenTargetShots(last5), greenTargetShots(previous5), greenTargetShots(season), distanceGroups.filter(group => !DISTANCE_ROLLUPS.has(group.key)), getTarget, getAvgShotsToGreen)
    .map(row => ({
      ...row,
      ...getMostUsedClubShot(greenTargetShots(selected).filter(shot => filterShotsByTargetDistance([shot], row.key).length === 1), getClubAndTypeGroup),
    }));
  const lieRows = makeRows(selected, last5, previous5, season, lieGroups, getTarget)
    .map(row => ({
      ...row,
      shareOfTotalPct: selected.length ? (row.round.shotCount / selected.length) * 100 : null,
    }));

  const areaGroups = [
    { key: 'tee', label: 'Tee / Driving', description: 'Execution and target results from the tee.', primaryMetric: 'shotQualityIndex' as const, filter: (shot: ProcessedShot) => shot.startLie.trim().toLowerCase() === 'tee' },
    { key: 'approach', label: 'Approach / Green Targets', description: 'Green-target shots from outside 100m.', primaryMetric: 'targetSuccessPct' as const, filter: (shot: ProcessedShot) => getTarget(shot) === 'green' && shot.target > 100 },
    { key: 'short', label: 'Short Game / Scoring Zone', description: 'Green-target shots from inside 100m.', primaryMetric: 'scoringZoneSuccessPct' as const, filter: (shot: ProcessedShot) => getTarget(shot) === 'green' && shot.target <= 100 },
    { key: 'recovery', label: 'Recovery / Trouble', description: 'Shots played from rough, bunker, or recovery lies.', primaryMetric: 'shotQualityIndex' as const, filter: (shot: ProcessedShot) => /rough|bunker|recovery/i.test(shot.startLie) },
    { key: 'management', label: 'Course Management', description: 'How often the intended fairway or green target was achieved.', primaryMetric: 'targetSuccessPct' as const, filter: (shot: ProcessedShot) => ['fairway', 'green'].includes(getTarget(shot)) },
  ];
  const areas = areaGroups.map(area => ({
    key: area.key,
    label: area.label,
    description: area.description,
    primaryMetric: area.primaryMetric,
    round: reviewMetrics(selected.filter(area.filter), getTarget),
    last5: reviewMetrics(last5.filter(area.filter), getTarget),
    previous5: reviewMetrics(previous5.filter(area.filter), getTarget),
  }));

  const progressDates = [...new Set(
    courseShots
      .filter(shot => !selectedBoundaryDate || getShotDateKey(shot.date) <= selectedBoundaryDate)
      .map(shot => getShotDateKey(shot.date))
  )].sort((a, b) => a.localeCompare(b));
  const bucketCount = Math.min(10, progressDates.length);
  const progress = Array.from({ length: bucketCount }, (_, index) => {
    const start = Math.floor(index * progressDates.length / bucketCount);
    const end = Math.floor((index + 1) * progressDates.length / bucketCount);
    const dates = new Set(progressDates.slice(start, end));
    const bucketShots = processShots(courseShots.filter(shot => dates.has(getShotDateKey(shot.date))), clubs, distanceToTargetTolerance);
    const bucketMetrics = reviewMetrics(bucketShots, getTarget);
    const teeMetrics = reviewMetrics(bucketShots.filter(areaGroups[0].filter), getTarget);
    const approachMetrics = reviewMetrics(bucketShots.filter(areaGroups[1].filter), getTarget);
    const shortMetrics = reviewMetrics(bucketShots.filter(areaGroups[2].filter), getTarget);
    return {
      label: bucketCount === 10 ? `D${index + 1}` : `Block ${index + 1}`,
      rounds: dates.size,
      shotQuality: bucketMetrics.shotQualityIndex,
      targetSuccess: bucketMetrics.targetSuccessPct,
      safeShotRate: bucketMetrics.safeShotRate,
      scoringZoneSuccess: bucketMetrics.scoringZoneSuccessPct,
      teeShotQuality: teeMetrics.shotQualityIndex,
      teeTargetSuccess: teeMetrics.targetSuccessPct,
      teeSafeShotRate: teeMetrics.shotCount ? teeMetrics.safeShotRate : null,
      approachShotQuality: approachMetrics.shotQualityIndex,
      approachTargetSuccess: approachMetrics.targetSuccessPct,
      approachSafeShotRate: approachMetrics.shotCount ? approachMetrics.safeShotRate : null,
      shortGameShotQuality: shortMetrics.shotQualityIndex,
      shortGameScoringZoneSuccess: shortMetrics.scoringZoneSuccessPct,
      shortGameSafeShotRate: shortMetrics.shotCount ? shortMetrics.safeShotRate : null,
    };
  });

  return {
    scope,
    label: scope === 'all'
      ? 'All Rounds'
      : aggregateRoundCount
        ? `Last ${Math.min(aggregateRoundCount, roundDates.length)} Rounds`
        : selectedDate,
    round: reviewMetrics(selected, getTarget),
    last5: reviewMetrics(last5, getTarget),
    previous5: reviewMetrics(previous5, getTarget),
    season: reviewMetrics(season, getTarget),
    recentThird: reviewMetrics(last5, getTarget),
    priorRoundCount: priorRoundDates.length,
    progress,
    areas,
    clubAndTypeRows: makeRows(selected, last5, previous5, season, clubAndTypeGroups, getTarget),
    greenDistanceRollups,
    greenDistanceRows,
    lieRows,
    distanceWarning,
    hasShotSequence,
  };
}
