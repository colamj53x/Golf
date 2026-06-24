import { shotQualityScore } from '@/lib/analysisSynthesis';
import { getShotDateKey } from '@/lib/golfCalculations';
import type { Shot } from '@/types/golf';

export interface HoleQualityRecord {
  key: string;
  roundDate: string;
  holeNumber: number;
  holePar: number | null;
  holeScore: number | null;
  scoreToPar: number | null;
  shotCount: number;
  ratedShotCount: number;
  sqi: number | null;
}

export interface HoleQualityDistributionBand {
  key: string;
  label: string;
  minimum: number;
  maximum: number | null;
  holeCount: number;
  holePct: number;
}

export interface HoleQualityParSummary {
  par: number;
  holeCount: number;
  ratedHoleCount: number;
  averageSqi: number | null;
  atTargetPct: number | null;
  averageShotCount: number;
  averageHoleScore: number | null;
  averageToPar: number | null;
}

export interface HoleQualityModel {
  holes: HoleQualityRecord[];
  targetHandicap: number;
  targetScore: number;
  averageHoleSqi: number | null;
  atTargetCount: number;
  atTargetPct: number | null;
  ratedHoleCount: number;
  ratedCoveragePct: number;
  bestHole: HoleQualityRecord | null;
  weakestHole: HoleQualityRecord | null;
  distribution: HoleQualityDistributionBand[];
  byPar: HoleQualityParSummary[];
  holesWithParCount: number;
}

const HANDICAP_TARGET_SCORES: Record<number, number> = {
  0: 90,
  5: 80,
  10: 70,
  15: 60,
  20: 45,
  25: 25,
  30: 25,
};

const DISTRIBUTION_BANDS = [
  { key: 'scratch-plus', label: 'Scratch or better', minimum: 90, maximum: null },
  { key: 'five', label: '5 HCP quality', minimum: 80, maximum: 90 },
  { key: 'ten', label: '10 HCP quality', minimum: 70, maximum: 80 },
  { key: 'fifteen', label: '15 HCP quality', minimum: 60, maximum: 70 },
  { key: 'twenty', label: '20 HCP quality', minimum: 45, maximum: 60 },
  { key: 'twenty-five', label: '25 HCP quality', minimum: 25, maximum: 45 },
  { key: 'below', label: 'Below 25 HCP quality', minimum: Number.NEGATIVE_INFINITY, maximum: 25 },
];

const average = (values: number[]): number | null => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : null;

const validPositiveInteger = (value: number | null | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
);

const isPutting = (shot: Shot): boolean => (
  shot.club.trim().toLowerCase() === 'pu' || shot.type.trim().toLowerCase() === 'putting'
);

export function getHoleQualityTargetScore(handicap: number): number {
  return HANDICAP_TARGET_SCORES[handicap] ?? HANDICAP_TARGET_SCORES[15];
}

export function buildHoleQualityModel(
  shots: Shot[],
  selectedRoundDates: string[],
  targetHandicap: number,
): HoleQualityModel {
  const selectedDates = new Set(selectedRoundDates);
  const grouped = new Map<string, Shot[]>();

  for (const shot of shots) {
    if (isPutting(shot) || shot.holeNumber === null || !selectedDates.has(getShotDateKey(shot.date))) continue;
    const roundDate = getShotDateKey(shot.date);
    const key = `${roundDate}:${shot.holeNumber}`;
    grouped.set(key, [...(grouped.get(key) ?? []), shot]);
  }

  const holes = [...grouped.entries()].map(([key, holeShots]): HoleQualityRecord => {
    const first = holeShots[0];
    const scores = holeShots
      .map((shot) => shotQualityScore(shot.shotQuality))
      .filter((score): score is number => score !== null);
    const holePar = holeShots.map((shot) => validPositiveInteger(shot.holePar)).find((value) => value !== null) ?? null;
    const holeScore = holeShots.map((shot) => validPositiveInteger(shot.holeScore)).find((value) => value !== null) ?? null;
    return {
      key,
      roundDate: getShotDateKey(first.date),
      holeNumber: first.holeNumber as number,
      holePar,
      holeScore,
      scoreToPar: holePar !== null && holeScore !== null ? holeScore - holePar : null,
      shotCount: holeShots.length,
      ratedShotCount: scores.length,
      sqi: average(scores),
    };
  }).sort((a, b) => b.roundDate.localeCompare(a.roundDate) || a.holeNumber - b.holeNumber);

  const ratedHoles = holes.filter((hole): hole is HoleQualityRecord & { sqi: number } => hole.sqi !== null);
  const targetScore = getHoleQualityTargetScore(targetHandicap);
  const atTargetCount = ratedHoles.filter((hole) => hole.sqi >= targetScore).length;
  const rankedHoles = [...ratedHoles].sort((a, b) => b.sqi - a.sqi || b.ratedShotCount - a.ratedShotCount);
  const distribution = DISTRIBUTION_BANDS.map((band) => {
    const holeCount = ratedHoles.filter((hole) => hole.sqi >= band.minimum && (band.maximum === null || hole.sqi < band.maximum)).length;
    return {
      ...band,
      holeCount,
      holePct: ratedHoles.length ? (holeCount / ratedHoles.length) * 100 : 0,
    };
  });
  const availablePars = [...new Set(holes.map((hole) => hole.holePar).filter((par): par is number => par !== null))]
    .sort((a, b) => a - b);
  const byPar = availablePars.map((par): HoleQualityParSummary => {
    const parHoles = holes.filter((hole) => hole.holePar === par);
    const ratedParHoles = parHoles.filter((hole): hole is HoleQualityRecord & { sqi: number } => hole.sqi !== null);
    const scoredParHoles = parHoles.filter((hole): hole is HoleQualityRecord & { holeScore: number; scoreToPar: number } => hole.holeScore !== null && hole.scoreToPar !== null);
    const parAtTarget = ratedParHoles.filter((hole) => hole.sqi >= targetScore).length;
    return {
      par,
      holeCount: parHoles.length,
      ratedHoleCount: ratedParHoles.length,
      averageSqi: average(ratedParHoles.map((hole) => hole.sqi)),
      atTargetPct: ratedParHoles.length ? (parAtTarget / ratedParHoles.length) * 100 : null,
      averageShotCount: average(parHoles.map((hole) => hole.shotCount)) ?? 0,
      averageHoleScore: average(scoredParHoles.map((hole) => hole.holeScore)),
      averageToPar: average(scoredParHoles.map((hole) => hole.scoreToPar)),
    };
  });

  return {
    holes,
    targetHandicap,
    targetScore,
    averageHoleSqi: average(ratedHoles.map((hole) => hole.sqi)),
    atTargetCount,
    atTargetPct: ratedHoles.length ? (atTargetCount / ratedHoles.length) * 100 : null,
    ratedHoleCount: ratedHoles.length,
    ratedCoveragePct: holes.length ? (ratedHoles.length / holes.length) * 100 : 0,
    bestHole: rankedHoles[0] ?? null,
    weakestHole: rankedHoles.at(-1) ?? null,
    distribution,
    byPar,
    holesWithParCount: holes.filter((hole) => hole.holePar !== null).length,
  };
}
