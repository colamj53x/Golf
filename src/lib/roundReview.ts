import { calculateMetrics, getClubConfigId, getShotDateKey, MetricsResult, processShot } from '@/lib/golfCalculations';
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from '@/lib/distanceFilters';
import { ClubConfig, ProcessedShot, Shot } from '@/types/golf';

export interface RoundReviewRow {
  key: string;
  label: string;
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
}

const DISTANCE_ROLLUPS = new Set(['0-150', '0-100']);
const LIE_ORDER = ['tee', 'fairway', 'first cut', 'rough', 'bunker', 'recovery'];

export function isPuttingShot(shot: Shot): boolean {
  return shot.club.trim().toLowerCase() === 'pu' || shot.type.trim().toLowerCase() === 'putting';
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
  groups: Array<{ key: string; label: string; filter: (shot: ProcessedShot) => boolean }>
): RoundReviewRow[] {
  return groups
    .map(group => {
      const roundShots = selected.filter(group.filter);
      if (roundShots.length === 0) return null;
      return {
        key: group.key,
        label: group.label,
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
  selectedRoundDate: string
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

  const clubAndTypeGroups = [...new Map(selected.map(shot => {
    const label = `${shot.club || 'Unknown club'} · ${shot.type || 'Unspecified'}`;
    return [label, {
      key: label,
      label,
      filter: (candidate: ProcessedShot) => candidate.club === shot.club && candidate.type === shot.type,
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

  return {
    round: metrics(selected),
    last5: metrics(last5),
    recentThird: metrics(recentThird),
    clubAndTypeRows: makeRows(selected, last5, recentThird, clubAndTypeGroups),
    distanceRollups: makeRows(selected, last5, recentThird, distanceGroups.filter(group => DISTANCE_ROLLUPS.has(group.key))),
    distanceRows: makeRows(selected, last5, recentThird, distanceGroups.filter(group => !DISTANCE_ROLLUPS.has(group.key))),
    lieRows: makeRows(selected, last5, recentThird, lieGroups),
  };
}
