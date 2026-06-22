import type { ShotsBySession } from '@/hooks/usePracticeShotsBySessions';
import { getClubConfigId, getShotDateKey } from '@/lib/golfCalculations';
import { pctWithinTarget } from '@/lib/practiceConsistency';
import {
  classifyPowerByTarget,
  getShotClassificationRule,
  isClubFullNormalClassification,
  loadShotClassificationRules,
  type ShotClassificationRules,
} from '@/lib/shotClassificationRules';
import type { ProfileTarget, ShotProfile, ShotProfileMap, ShotProfileTargetValues } from '@/lib/shotProfiles';
import { DEFAULT_CLUB_CONFIGS } from '@/types/golf';
import type { Shot } from '@/types/golf';
import type { ClubPracticeConfig, PracticeSession } from '@/types/practice';
import { parsePracticeConfigKey, POWER_OPTIONS, PRACTICE_CLUBS, SHOT_TYPES } from '@/types/practiceClubs';

export type ShotContext = 'tee' | 'fairway' | 'roughRecovery';
export type ShotSortKey = 'quality' | 'distance' | 'alignment';

export const SHOT_CONTEXT_OPTIONS: Array<{ id: ShotContext; label: string }> = [
  { id: 'tee', label: 'Tee' },
  { id: 'fairway', label: 'Fairway' },
  { id: 'roughRecovery', label: 'Rough / Recovery' },
];

const SHOT_QUALITY_RANK: Record<string, number> = {
  Pro: 0,
  'Elite Am': 1,
  '0 Handicap': 2,
  '5 Handicap': 3,
  '10 Handicap': 4,
  '15 Handicap': 5,
  '20 Handicap': 6,
  '25 Handicap': 7,
};

const SHOT_QUALITY_HANDICAP: Record<string, number> = {
  Pro: -10,
  'Elite Am': -5,
  '0 Handicap': 0,
  '5 Handicap': 5,
  '10 Handicap': 10,
  '15 Handicap': 15,
  '20 Handicap': 20,
  '25 Handicap': 25,
};

const DEFAULT_QUALITY_CUTOFF = 10;
const DEFAULT_RELIABLE_PERCENT = 60;
const QUALITY_HANDICAP_LEVELS = [-10, -5, 0, 5, 10, 15, 20, 25];
const GAP_WEDGE_FULL_PITCH_TARGET = 70;
export const SHOT_CATEGORY_OVERRIDES_KEY = 'golf_gapping_shot_category_overrides_v1';
export const SHOT_CATEGORY_OVERRIDES_EVENT = 'golf-gapping-shot-category-overrides-change';
const CHIP_TARGETS: Record<string, { full: number; half: number }> = {
  pw: { full: 34, half: 18 },
  gw: { full: 19, half: 10 },
};

type ShotCategoryOverride = {
  profileId: string;
  target: ProfileTarget;
};

export type ShotCategoryOverrides = Record<string, ShotCategoryOverride>;

export interface GappingRow {
  profile: ShotProfile;
  target: ProfileTarget;
  sample: Shot[];
  topQuartile: Shot[];
  liveTotal: number | null;
  liveCarry: number | null;
  liveVariationPct: number | null;
  rangeTargetVariationPct: number | null;
  rangeTargetTotal: number | null;
  rangeTargetCarry: number | null;
  rangeTargetSide: number | null;
  displayVariationPct: number | null;
  displayTotal: number | null;
  displayCarry: number | null;
  displayCarryMin: number | null;
  displayCarryMax: number | null;
  totalMin: number | null;
  totalMax: number | null;
  sideLeft: number | null;
  sideRight: number | null;
  displaySideLeft: number | null;
  displaySideRight: number | null;
  sideBias: number | null;
  recentTargetPct: number | null;
  recentSafePct: number | null;
  rangeConfidence: number | null;
  shotCount: number;
  intentShotCount: number;
  rangeShotCount: number;
  qualityCutoff: number;
  reliableHcpLevel: number | null;
  reliableCoveragePct: number | null;
  savedTarget: Partial<ShotProfileTargetValues>;
}

function mean(values: number[]): number | null {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : null;
}

function metricAverage(valueMin: number | null, valueMax: number | null): number | null {
  const min = valueMin !== null && Number.isFinite(valueMin) ? valueMin : null;
  const max = valueMax !== null && Number.isFinite(valueMax) ? valueMax : null;
  if (min !== null && max !== null) return (min + max) / 2;
  return min ?? max;
}

function variationPct(values: number[], center: number | null): number | null {
  if (center === null || !Number.isFinite(center) || center <= 0 || values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (Math.max(Math.abs(center - min), Math.abs(max - center)) / center) * 100;
}

function rangeVariationPct(range: { min: number | null; max: number | null }): number | null {
  const center = metricAverage(range.min, range.max);
  if (center === null || range.min === null || range.max === null) return null;
  return variationPct([range.min, range.max], center);
}

function qualityRank(shot: Shot): number {
  return SHOT_QUALITY_RANK[shot.shotQuality] ?? Number.POSITIVE_INFINITY;
}

function shotHandicap(shot: Shot): number {
  return SHOT_QUALITY_HANDICAP[shot.shotQuality] ?? Number.POSITIVE_INFINITY;
}

function sortByQuality(shots: Shot[]): Shot[] {
  return [...shots].sort((a, b) => {
    const qualityDelta = qualityRank(a) - qualityRank(b);
    if (qualityDelta !== 0) return qualityDelta;
    return b.total - a.total;
  });
}

function selectGappingQualityShots(shots: Shot[], cutoff: number): Shot[] {
  if (shots.length === 0) return [];

  const sorted = sortByQuality(shots);
  const quartileCount = Math.max(1, Math.ceil(sorted.length * 0.25));
  const quartileBoundary = sorted[quartileCount - 1];
  const boundaryRank = qualityRank(quartileBoundary);
  const quartileShots = sorted.filter((shot) => qualityRank(shot) <= boundaryRank);
  const cutoffShots = sorted.filter((shot) => shotHandicap(shot) <= cutoff);

  if (cutoffShots.length === 0) return quartileShots;

  if (cutoffShots.length > quartileCount) {
    return quartileShots.filter((shot) => shotHandicap(shot) <= cutoff);
  }

  return cutoffShots;
}

function selectReliableGappingShots(shots: Shot[], reliablePercent: number, fallbackQualityCutoff: number): {
  shots: Shot[];
  reliableHcpLevel: number | null;
  reliableCoveragePct: number | null;
} {
  if (shots.length === 0) {
    return { shots: [], reliableHcpLevel: null, reliableCoveragePct: null };
  }

  const ratedShots = sortByQuality(shots).filter((shot) => Number.isFinite(shotHandicap(shot)));
  if (ratedShots.length === 0) {
    return {
      shots: selectGappingQualityShots(shots, fallbackQualityCutoff),
      reliableHcpLevel: null,
      reliableCoveragePct: null,
    };
  }

  const targetPercent = Math.max(10, Math.min(100, reliablePercent || DEFAULT_RELIABLE_PERCENT));
  const targetCount = Math.max(1, Math.ceil(ratedShots.length * (targetPercent / 100)));

  for (const level of QUALITY_HANDICAP_LEVELS) {
    const included = ratedShots.filter((shot) => shotHandicap(shot) <= level);
    if (included.length >= targetCount) {
      return {
        shots: included,
        reliableHcpLevel: level,
        reliableCoveragePct: (included.length / ratedShots.length) * 100,
      };
    }
  }

  return {
    shots: ratedShots,
    reliableHcpLevel: QUALITY_HANDICAP_LEVELS.at(-1) ?? 25,
    reliableCoveragePct: 100,
  };
}

export function sortShots(shots: Shot[], sortKey: ShotSortKey): Shot[] {
  return [...shots].sort((a, b) => {
    if (sortKey === 'distance') return b.total - a.total;
    if (sortKey === 'alignment') return Math.abs(a.side) - Math.abs(b.side);
    const qualityDelta = qualityRank(a) - qualityRank(b);
    if (qualityDelta !== 0) return qualityDelta;
    return b.total - a.total;
  });
}

function getProfileTargetTotal(profile: ShotProfile | undefined): number | null {
  if (!profile) return null;
  return profile.targetOverrides.green?.targetTotal
    ?? profile.targetOverrides.fairway?.targetTotal
    ?? profile.targetTotal
    ?? null;
}

function withoutDistanceOutliers(shots: Shot[]): Shot[] {
  if (shots.length < 5) return shots;

  const totals = [...shots].map((shot) => shot.total).sort((a, b) => a - b);
  const q1 = totals[Math.floor((totals.length - 1) * 0.25)];
  const q3 = totals[Math.floor((totals.length - 1) * 0.75)];
  const iqr = q3 - q1;
  if (iqr === 0) return shots;

  const lower = q1 - iqr * 1.5;
  const upper = q3 + iqr * 1.5;
  return shots.filter((shot) => shot.total >= lower && shot.total <= upper);
}

function matchesTarget(shot: Shot, target: ProfileTarget): boolean {
  const endLie = shot.endLie.toLowerCase();
  if (target === 'green') return endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole');
  return endLie.includes('fairway');
}

function isSafeOutcome(shot: Shot): boolean {
  const endLie = shot.endLie.toLowerCase();
  return endLie.includes('fairway') || endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole');
}

function isDriverDrivingShot(shot: Shot): boolean {
  return getClubConfigId(shot.club) === 'dr' && shot.type.trim().toLowerCase().startsWith('driv');
}

function isPunchClub(clubId: string): boolean {
  return clubId === '6i' || clubId === '7i';
}

function matchesShotContext(shot: Shot, context: ShotContext): boolean {
  if (isDriverDrivingShot(shot)) return context === 'tee';

  const lie = shot.startLie.toLowerCase();
  if (context === 'tee') return lie.includes('tee');
  if (context === 'fairway') return lie.includes('fairway');
  return lie.includes('rough') || lie.includes('recovery') || lie.includes('tree') || lie.includes('punch') || lie.includes('trouble');
}

export function fmt(value: number | null, suffix = 'm', digits = 0): string {
  return value === null || !Number.isFinite(value) ? '-' : `${value.toFixed(digits)}${suffix}`;
}

export function fmtSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  if (Math.abs(value) < 0.5) return 'Neutral';
  return `${Math.abs(value).toFixed(0)}m ${value > 0 ? 'R' : 'L'}`;
}

export function fmtReliableHcp(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  if (value === -10) return 'Pro';
  if (value === -5) return 'Elite';
  if (value === 0) return '0 HCP';
  return `${value} HCP`;
}

export function getSidePattern(row: Pick<GappingRow, 'displaySideLeft' | 'displaySideRight' | 'sideBias'>): {
  label: string;
  className: string;
} {
  const bias = row.sideBias ?? 0;
  const absBias = Math.abs(bias);

  if (row.displaySideLeft === null && row.displaySideRight === null && row.sideBias === null) {
    return { label: '-', className: 'text-muted-foreground' };
  }
  if (absBias < 3) return { label: 'Neutral', className: 'text-emerald-600 font-medium' };
  if (bias > 0) return { label: 'Right', className: 'text-amber-600 font-medium' };
  if (bias < 0) return { label: 'Left', className: 'text-amber-600 font-medium' };
  return { label: 'Neutral', className: 'text-emerald-600 font-medium' };
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getClubName(profile: ShotProfile): string {
  return PRACTICE_CLUBS.find((club) => club.id === profile.clubId)?.name ?? profile.clubId;
}

export function clubSortIndex(clubId: string): number {
  const index = PRACTICE_CLUBS.findIndex((club) => club.id === clubId);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getPowerLabel(power: string): string {
  if (power === 'full') return '';
  if (power === '730pm') return '7.30';
  if (power === '9pm') return '9';
  if (power === '10pm') return '10';
  return POWER_OPTIONS.find((option) => option.id === power)?.name.replace(/pm$/i, '') ?? power;
}

export function getShotLabel(profile: ShotProfile): string {
  const shotName = SHOT_TYPES.find((shot) => shot.id === profile.shotType)?.name ?? profile.shotType;
  if (isShortShot(profile)) return shotName;
  const power = getPowerLabel(profile.power);
  return power ? `${shotName} ${power}` : shotName;
}

export function powerStrength(power: string): number {
  if (power === 'full') return 4;
  if (power === '10pm') return 3;
  if (power === '9pm') return 2;
  if (power === '730pm') return 1;
  return 0;
}

export function isShortShot(profile: ShotProfile): boolean {
  return profile.shotType === 'bump' || profile.shotType === 'pitch' || profile.shotType === 'chip';
}

function isVisibleShortBucket(profile: ShotProfile): boolean {
  return isShortShot(profile) && (profile.power === 'full' || profile.power === '9pm');
}

export function visibleProfileId(profileId: string): string {
  const parsed = parsePracticeConfigKey(profileId);
  if (!parsed.club || !parsed.shotType || !parsed.power) return profileId;
  if ((parsed.shotType === 'bump' || parsed.shotType === 'pitch' || parsed.shotType === 'chip') && parsed.power !== 'full') {
    return `${parsed.club}_${parsed.shotType}_9pm`;
  }
  return profileId;
}

export function visibleGappingConfigKey(configKey: string): string {
  const parsed = parsePracticeConfigKey(configKey);
  if (!parsed.club || !parsed.shotType || !parsed.power) return configKey;
  return `${parsed.club}_${parsed.shotType}_${parsed.power === 'full' ? 'full' : 'half'}`;
}

export function getExpandedGappingShotLabel(profile: ShotProfile): string {
  const shotLabel = getShotLabel(profile);
  if (profile.shotType === 'full' && profile.power === 'full') return shotLabel;
  if (profile.shotType === 'bump' || profile.shotType === 'pitch' || profile.shotType === 'chip') {
    return `${shotLabel} ${profile.power === 'full' ? 'Full' : 'Half'}`;
  }
  return shotLabel;
}

export function getShotBadgeClass(profile: ShotProfile, isHardestShortShot = false): string {
  if (profile.shotType === 'punch') return '';
  if (!isShortShot(profile)) return '';
  if ((profile.shotType === 'bump' || profile.shotType === 'pitch' || profile.shotType === 'chip') && profile.power === 'full') {
    return 'border-green-600 bg-green-50 text-green-800 hover:bg-green-50';
  }
  if (profile.shotType === 'bump' || profile.shotType === 'pitch' || profile.shotType === 'chip') {
    return 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50';
  }
  if (isHardestShortShot) {
    return 'border-green-600 bg-green-50 text-green-800 hover:bg-green-50';
  }
  return 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50';
}

export function fmtSideRange(left: number | null, right: number | null): string {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return '-';
  return `${left.toFixed(0)}L - ${right.toFixed(0)}R`;
}

export function percentDotTone(value: number | null, greenThreshold = 65, amberThreshold = 40): string {
  if (value === null) return 'border-muted bg-background';
  if (value >= greenThreshold) return 'border-green-600 bg-green-600';
  if (value >= amberThreshold) return 'border-amber-500 bg-amber-500';
  return 'border-red-600 bg-red-600';
}

export const rangeDotTone = percentDotTone;

export function shotCountTone(count: number): string {
  if (count >= 50) return 'text-green-600';
  if (count >= 25) return 'text-amber-500';
  return 'text-red-600';
}

function getMetricTargetValue(config: ClubPracticeConfig | undefined, id: string): number | null {
  const metric = config?.metrics.find((item) => item.id === id);
  if (!metric) return null;
  return metricAverage(metric.targetMin, metric.targetMax);
}

function getMetricTargetRange(config: ClubPracticeConfig | undefined, id: string): { min: number | null; max: number | null } {
  const metric = config?.metrics.find((item) => item.id === id);
  if (!metric) return { min: null, max: null };
  const min = metric.targetMin !== null && Number.isFinite(metric.targetMin) ? metric.targetMin : null;
  const max = metric.targetMax !== null && Number.isFinite(metric.targetMax) ? metric.targetMax : null;
  return { min: min ?? max, max: max ?? min };
}

function getRangeCarryEstimate(total: number | null, config: ClubPracticeConfig | undefined): number | null {
  if (total === null || !Number.isFinite(total)) return null;
  const targetCarry = getMetricTargetValue(config, 'carry');
  const targetTotal = getMetricTargetValue(config, 'total_distance');
  if (targetCarry === null || targetTotal === null || targetTotal <= 0) return null;
  return total * (targetCarry / targetTotal);
}

function getRangeCarryWindow(total: number | null, config: ClubPracticeConfig | undefined): { min: number | null; max: number | null } {
  if (total === null || !Number.isFinite(total)) return { min: null, max: null };
  const targetTotal = getMetricTargetValue(config, 'total_distance');
  const carryTarget = getMetricTargetRange(config, 'carry');
  if (targetTotal === null || targetTotal <= 0 || carryTarget.min === null || carryTarget.max === null) {
    return { min: null, max: null };
  }

  const scale = total / targetTotal;
  return {
    min: carryTarget.min * scale,
    max: carryTarget.max * scale,
  };
}

function getEstimatedVerticalWindow(total: number | null, config: ClubPracticeConfig | undefined): { min: number | null; max: number | null } {
  if (total === null || !Number.isFinite(total)) return { min: null, max: null };
  const carryTarget = getMetricTargetRange(config, 'carry');
  if (carryTarget.min === null || carryTarget.max === null) return { min: total, max: total };

  const carryMid = metricAverage(carryTarget.min, carryTarget.max);
  if (carryMid === null || carryMid <= 0) return { min: total, max: total };

  const windowPct = Math.abs(carryTarget.max - carryTarget.min) / carryMid;
  const halfWindow = (total * windowPct) / 2;
  return {
    min: total - halfWindow,
    max: total + halfWindow,
  };
}

function getIntentDistanceWindow(
  savedTarget: Partial<ShotProfileTargetValues>,
  rangeTargetWindow: { min: number | null; max: number | null },
  rangeTargetTotal: number | null,
  rangeTargetVariationPct: number | null,
): { min: number | null; max: number | null } {
  if (savedTarget.targetTotal !== undefined && savedTarget.targetTotal !== null) {
    const variation = savedTarget.targetVariationPct ?? rangeTargetVariationPct;
    return variation !== null
      ? {
          min: savedTarget.targetTotal * (1 - variation / 100),
          max: savedTarget.targetTotal * (1 + variation / 100),
        }
      : { min: null, max: savedTarget.targetTotal };
  }

  if (rangeTargetWindow.min !== null || rangeTargetWindow.max !== null) {
    return rangeTargetWindow;
  }

  return { min: null, max: rangeTargetTotal };
}

function isGreenIntentShot(shot: Shot, window: { min: number | null; max: number | null }): boolean {
  if (!Number.isFinite(shot.target) || window.max === null) return false;
  return shot.target <= window.max;
}

function matchesTargetIntent(
  shot: Shot,
  target: ProfileTarget,
  window: { min: number | null; max: number | null },
): boolean {
  const savedIntent = shot.targetIntent.trim().toLowerCase();
  if (savedIntent === 'green' || savedIntent === 'fairway') return savedIntent === target;
  const greenIntent = isGreenIntentShot(shot, window);
  return target === 'green' ? greenIntent : !greenIntent;
}

function matchesPracticeProfile(session: PracticeSession, profile: ShotProfile): boolean {
  if (profile.clubId === 'gw' && profile.shotType === 'pitch' && profile.power === 'full') {
    return session.clubId === profile.id || session.clubId === 'gw_full_full' || session.clubId === profile.clubId;
  }
  if (profile.shotType === 'bump' && profile.power === '9pm') {
    const parsed = parsePracticeConfigKey(session.clubId);
    return parsed.club === profile.clubId && parsed.shotType === 'bump' && parsed.power !== 'full';
  }
  if (profile.shotType === 'pitch' && profile.power === '9pm') {
    const parsed = parsePracticeConfigKey(session.clubId);
    return parsed.club === profile.clubId && parsed.shotType === 'pitch' && parsed.power !== 'full';
  }
  if (profile.shotType !== 'full' || profile.power !== 'full') return session.clubId === profile.id;
  return session.clubId === profile.id || session.clubId === profile.clubId;
}

function getRangeTargetPct(
  sessions: PracticeSession[],
  config: ClubPracticeConfig | undefined,
  shotsBySession: ShotsBySession,
): number | null {
  if (!config) return null;

  const sessionScores = sessions.slice(0, 3)
    .map((session) => {
      const sessionShots = shotsBySession[session.id] ?? [];
      const metricScores = config.metrics
        .map((metric) => pctWithinTarget(metric.id, sessionShots, metric.targetMin, metric.targetMax, config.clubId))
        .filter((score): score is number => score !== null);
      return mean(metricScores);
    })
    .filter((score): score is number => score !== null);

  return mean(sessionScores);
}

function getRangeShotCount(sessions: PracticeSession[], shotsBySession: ShotsBySession): number {
  return sessions.slice(0, 3).reduce((sum, session) => sum + (shotsBySession[session.id]?.length ?? 0), 0);
}

function getPracticeMetricNumber(metrics: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function getRangeSideStats(
  sessions: PracticeSession[],
  shotsBySession: ShotsBySession,
): {
  total: number | null;
  totalMin: number | null;
  totalMax: number | null;
  carry: number | null;
  carryMin: number | null;
  carryMax: number | null;
  left: number | null;
  right: number | null;
  mean: number | null;
} {
  const rangeShots = sessions.slice(0, 3)
    .flatMap((session) => shotsBySession[session.id] ?? [])
    .map((shot) => shot.metrics);

  const totals = rangeShots
    .map((metrics) => getPracticeMetricNumber(metrics, ['total', 'totalDistance', 'total_distance']))
    .filter((value): value is number => value !== null);
  const carries = rangeShots
    .map((metrics) => getPracticeMetricNumber(metrics, ['carry']))
    .filter((value): value is number => value !== null);
  const sides = rangeShots
    .map((metrics) => getPracticeMetricNumber(metrics, ['carrySide', 'carry_side', 'side', 'offline']))
    .filter((value): value is number => value !== null);

  return {
    total: mean(totals),
    totalMin: totals.length ? Math.min(...totals) : null,
    totalMax: totals.length ? Math.max(...totals) : null,
    carry: mean(carries),
    carryMin: carries.length ? Math.min(...carries) : null,
    carryMax: carries.length ? Math.max(...carries) : null,
    left: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    right: sides.length ? Math.max(0, ...sides) : null,
    mean: mean(sides),
  };
}

function hasRangePracticeForProfile(profile: ShotProfile, practiceSessions: PracticeSession[]): boolean {
  return practiceSessions.some((session) => matchesPracticeProfile(session, profile));
}

function isCompositePracticeKey(key: string): boolean {
  const parsed = parsePracticeConfigKey(key);
  return Boolean(parsed.club && parsed.shotType && parsed.power);
}

function profileFromPracticeKey(key: string): ShotProfile | null {
  if (!isCompositePracticeKey(key)) return null;
  const parsed = parsePracticeConfigKey(key);
  const clubExists = PRACTICE_CLUBS.some((club) => club.id === parsed.club);
  if (!clubExists) return null;

  return {
    id: key,
    clubId: parsed.club,
    shotType: parsed.shotType,
    power: parsed.power,
    enabled: true,
    showInPractice: true,
    showOnCourse: true,
    targets: ['green'],
    technique: '',
    routine: '',
    targetTotal: null,
    targetCarry: null,
    targetSideLeft: null,
    targetSideRight: null,
    targetVariationPct: null,
    targetQualityCutoff: null,
    targetOverrides: {},
  };
}

function makeGappingProfile(clubId: string, shotType: string, power: string): ShotProfile {
  return {
    id: `${clubId}_${shotType}_${power}`,
    clubId,
    shotType,
    power,
    enabled: true,
    showInPractice: true,
    showOnCourse: true,
    targets: ['green'],
    technique: '',
    routine: '',
    targetTotal: null,
    targetCarry: null,
    targetSideLeft: null,
    targetSideRight: null,
    targetVariationPct: null,
    targetQualityCutoff: null,
    targetOverrides: {},
  };
}

function ensureVisibleShortBucketProfiles(profileMap: ShotProfileMap, clubIds: string[], shotType: 'bump' | 'pitch' | 'chip') {
  for (const clubId of clubIds) {
    for (const power of ['full', '9pm']) {
      const id = `${clubId}_${shotType}_${power}`;
      const existing = profileMap[id] ?? makeGappingProfile(clubId, shotType, power);
      profileMap[id] = {
        ...existing,
        enabled: true,
        showOnCourse: true,
        targets: existing.targets.length ? existing.targets : ['green'],
      };
    }
  }
}

function getFullShotTargetMax(
  clubId: string,
  profiles: ShotProfileMap,
  practiceConfigs: ClubPracticeConfig[],
): number | null {
  const fullProfile = profiles[`${clubId}_full_full`];
  const fullConfig = practiceConfigs.find((config) => config.clubId === `${clubId}_full_full`)
    ?? practiceConfigs.find((config) => config.clubId === clubId);
  const rangeMax = getMetricTargetRange(fullConfig, 'total_distance').max;
  if (rangeMax !== null) return rangeMax;
  return getProfileTargetTotal(fullProfile);
}

function getFullShotTargetTotal(
  clubId: string,
  profiles: ShotProfileMap,
  practiceConfigs: ClubPracticeConfig[],
  courseShots: Shot[],
): number | null {
  const fullProfile = profiles[`${clubId}_full_full`];
  const savedTotal = getProfileTargetTotal(fullProfile);
  if (savedTotal !== null) return savedTotal;

  const clubShots = courseShots.filter((shot) => getClubConfigId(shot.club) === clubId && Number.isFinite(shot.target));
  const highIntentTargets = [...clubShots]
    .map((shot) => shot.target)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);

  if (highIntentTargets.length) {
    const count = Math.max(1, Math.ceil(highIntentTargets.length * 0.25));
    return mean(highIntentTargets.slice(0, count));
  }

  const fullConfig = practiceConfigs.find((config) => config.clubId === `${clubId}_full_full`)
    ?? practiceConfigs.find((config) => config.clubId === clubId);
  return getMetricTargetValue(fullConfig, 'total_distance');
}

function getRangeTargetTotalForProfile(
  profileId: string,
  practiceSessions: PracticeSession[],
  practiceConfigs: ClubPracticeConfig[],
  shotsBySession: ShotsBySession,
): number | null {
  const sessions = practiceSessions
    .filter((session) => session.clubId === profileId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const sessionTotal = getRangeSideStats(sessions, shotsBySession).total;
  if (sessionTotal !== null) return sessionTotal;

  const config = practiceConfigs.find((item) => item.clubId === profileId);
  return getMetricTargetValue(config, 'total_distance');
}

function getRangeSessionTotalForProfile(
  profileId: string,
  practiceSessions: PracticeSession[],
  shotsBySession: ShotsBySession,
): number | null {
  const sessions = practiceSessions
    .filter((session) => session.clubId === profileId)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return getRangeSideStats(sessions, shotsBySession).total;
}

function getBumpFirmAnchor(clubId: string, fullTargetTotal: number): number {
  if (clubId === '8i') return 40;
  return fullTargetTotal * 0.4;
}

function getBumpHalfMax(firmAnchor: number): number {
  return firmAnchor * 0.875;
}

function getBumpTargets(clubId: string, fullTargetTotal: number | null): Array<{ power: string; target: number }> {
  if (fullTargetTotal === null) return [];
  const firmAnchor = getBumpFirmAnchor(clubId, fullTargetTotal);
  return [
    { power: 'full', target: firmAnchor },
    { power: '9pm', target: firmAnchor * 0.5 },
  ];
}

function getClosestBumpPower(
  shot: Shot,
  clubId: string,
  fullTargetTotal: number | null,
): string | null {
  if (fullTargetTotal === null || !Number.isFinite(shot.target)) return null;
  const firmAnchor = getBumpFirmAnchor(clubId, fullTargetTotal);
  const firmMin = firmAnchor * 0.8;
  const firmMax = firmAnchor * 1.2;
  if (shot.target >= firmMin && shot.target <= firmMax) return 'full';
  if (shot.target < getBumpHalfMax(firmAnchor)) return '9pm';
  return null;
}

function getPitchTargets(
  clubId: string,
  practiceSessions: PracticeSession[],
  practiceConfigs: ClubPracticeConfig[],
  shotsBySession: ShotsBySession,
): Array<{ power: string; target: number }> {
  const fallbackFullTarget = clubId === 'gw'
    ? GAP_WEDGE_FULL_PITCH_TARGET
    : DEFAULT_CLUB_CONFIGS.find((club) => club.id === clubId)?.stockDistance ?? null;
  const fullTarget = getRangeSessionTotalForProfile(`${clubId}_pitch_full`, practiceSessions, shotsBySession)
    ?? getRangeSessionTotalForProfile(`${clubId}_full_full`, practiceSessions, shotsBySession)
    ?? getRangeSessionTotalForProfile(clubId, practiceSessions, shotsBySession)
    ?? fallbackFullTarget;
  if (fullTarget === null) return [];

  const halfTarget = mean([
    getRangeSessionTotalForProfile(`${clubId}_pitch_9pm`, practiceSessions, shotsBySession),
    getRangeSessionTotalForProfile(`${clubId}_pitch_730pm`, practiceSessions, shotsBySession),
    getRangeSessionTotalForProfile(`${clubId}_pitch_10pm`, practiceSessions, shotsBySession),
  ].filter((value): value is number => value !== null)) ?? fullTarget * 0.5;

  return [
    { power: 'full', target: fullTarget },
    { power: '9pm', target: halfTarget },
  ];
}

function getClosestPitchPower(
  shot: Shot,
  practiceSessions: PracticeSession[],
  practiceConfigs: ClubPracticeConfig[],
  shotsBySession: ShotsBySession,
): string | null {
  const clubId = getClubConfigId(shot.club);
  if (!Number.isFinite(shot.target)) return null;

  return getPitchTargets(clubId, practiceSessions, practiceConfigs, shotsBySession)
    .sort((a, b) => Math.abs(shot.target - a.target) - Math.abs(shot.target - b.target))[0]?.power ?? null;
}

function getChipTargets(clubId: string): Array<{ power: string; target: number }> {
  const target = CHIP_TARGETS[clubId];
  if (!target) return [];
  return [
    { power: 'full', target: target.full },
    { power: '9pm', target: target.half },
  ];
}

function getClosestChipPower(shot: Shot): string | null {
  const clubId = getClubConfigId(shot.club);
  const targets = getChipTargets(clubId);
  if (!targets.length || !Number.isFinite(shot.target)) return null;
  const fullTarget = CHIP_TARGETS[clubId]?.full;
  if (!fullTarget || shot.target > fullTarget * 1.35) return null;

  return targets
    .sort((a, b) => Math.abs(shot.target - a.target) - Math.abs(shot.target - b.target))[0]?.power ?? null;
}

function isPunchShot(
  shot: Shot,
  fullTargetMax: number | null,
): boolean {
  const clubId = getClubConfigId(shot.club);
  if (!isPunchClub(clubId)) return false;
  if (shot.startLie.toLowerCase().includes('tee')) return false;

  const lie = shot.startLie.toLowerCase();
  const text = `${shot.type} ${shot.shotQuality} ${shot.strikeQuality} ${shot.notes}`.toLowerCase();
  const isRecoveryLie = lie.includes('recovery') || lie.includes('tree') || lie.includes('trouble') || lie.includes('punch');
  const isRoughLie = lie.includes('rough');
  const isLowIntentional = text.includes('low') && (text.includes('intended') || text.includes('as intended'));
  const isOutsideFullWindow = fullTargetMax !== null && shot.target > fullTargetMax + 15;

  return isRecoveryLie || isRoughLie || isLowIntentional || isOutsideFullWindow;
}

function matchesProfileShot(
  shot: Shot,
  profile: ShotProfile,
  fullTargetMax: number | null,
  fullTargetTotal: number | null,
  practiceSessions: PracticeSession[],
  practiceConfigs: ClubPracticeConfig[],
  shotsBySession: ShotsBySession,
  shotCategoryOverrides: ShotCategoryOverrides,
  shotClassificationRules: ShotClassificationRules,
): boolean {
  const override = shotCategoryOverrides[shot.id];
  if (override) return visibleProfileId(override.profileId) === profile.id;

  if (isClubFullNormalClassification(shotClassificationRules, profile.clubId)) {
    return profile.shotType === 'full' && profile.power === 'full';
  }

  const savedFamily = shot.shotFamily.trim().toLowerCase();
  const savedEffort = shot.swingEffort.trim().toLowerCase();
  const ruleShotType = savedFamily || profile.shotType;
  const rulePower = classifyPowerByTarget(
    getShotClassificationRule(shotClassificationRules, profile.clubId, ruleShotType),
    shot.target,
  );
  if (rulePower) {
    return visibleProfileId(`${profile.clubId}_${ruleShotType}_${rulePower}`) === profile.id;
  }

  if (savedFamily) {
    const savedPower = savedEffort === 'full' ? 'full' : '9pm';
    return visibleProfileId(`${profile.clubId}_${savedFamily}_${savedPower}`) === profile.id;
  }

  const punchShot = isPunchShot(shot, fullTargetMax);
  if (profile.shotType === 'punch') return punchShot;
  const chipPower = getClosestChipPower(shot);
  if (profile.shotType === 'chip') {
    if (profile.clubId === 'pw' || profile.clubId === 'gw') return !punchShot && chipPower === profile.power;
    return false;
  }
  if ((profile.clubId === 'pw' || profile.clubId === 'gw') && chipPower !== null) return false;
  const pitchPower = getClosestPitchPower(shot, practiceSessions, practiceConfigs, shotsBySession);
  if (profile.shotType === 'pitch') {
    if (profile.clubId === 'pw' || profile.clubId === 'gw' || profile.clubId === 'sw') return !punchShot && pitchPower === profile.power;
    return false;
  }
  if (profile.clubId === 'gw') {
    return false;
  }
  const bumpPower = getClosestBumpPower(shot, profile.clubId, fullTargetTotal);
  if (profile.shotType === 'bump') return !punchShot && bumpPower === profile.power;
  if (profile.shotType === 'full') return !punchShot && bumpPower === null;
  return profile.shotType === 'full';
}

function buildRow(
  profile: ShotProfile,
  target: ProfileTarget,
  courseShots: Shot[],
  practiceSessions: PracticeSession[],
  practiceConfigs: ClubPracticeConfig[],
  shotsBySession: ShotsBySession,
  profiles: ShotProfileMap,
  reliablePercent: number,
  fallbackQualityCutoff: number,
  shotCategoryOverrides: ShotCategoryOverrides,
  shotClassificationRules: ShotClassificationRules,
): GappingRow {
  const fullTargetMax = getFullShotTargetMax(profile.clubId, profiles, practiceConfigs);
  const fullTargetTotal = getFullShotTargetTotal(profile.clubId, profiles, practiceConfigs, courseShots);
  const savedTarget: Partial<ShotProfileTargetValues> = {};
  const sessions = practiceSessions
    .filter((session) => matchesPracticeProfile(session, profile))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const practiceConfig = practiceConfigs.find((config) => config.clubId === profile.id)
    ?? practiceConfigs.find((config) => config.clubId === profile.clubId);
  const bumpTargetTotal = profile.shotType === 'bump'
    ? getBumpTargets(profile.clubId, fullTargetTotal).find((option) => option.power === profile.power)?.target ?? null
    : null;
  const chipTargetTotal = profile.shotType === 'chip'
    ? getChipTargets(profile.clubId).find((option) => option.power === profile.power)?.target ?? null
    : null;
  const rangeTargetTotal = profile.shotType === 'chip'
    ? chipTargetTotal
    : profile.shotType === 'pitch'
    ? getPitchTargets(profile.clubId, practiceSessions, practiceConfigs, shotsBySession).find((option) => option.power === profile.power)?.target ?? null
    : profile.shotType === 'bump'
      ? bumpTargetTotal
    : getMetricTargetValue(practiceConfig, 'total_distance');
  const rangeTargetCarry = getMetricTargetValue(practiceConfig, 'carry');
  const rangeTargetSide = getMetricTargetRange(practiceConfig, 'avg_lateral_miss').max;
  const rangeTargetTotalWindow = getMetricTargetRange(practiceConfig, 'total_distance');
  const rangeTargetVariationPct = rangeVariationPct(rangeTargetTotalWindow);
  const rangeSideStats = getRangeSideStats(sessions, shotsBySession);
  const rangeTotal = rangeSideStats.total ?? rangeTargetTotal;
  const rangeCarry = rangeSideStats.carry ?? rangeTargetCarry;
  const rangeTotalWindow = {
    min: rangeSideStats.totalMin ?? rangeTargetTotalWindow.min,
    max: rangeSideStats.totalMax ?? rangeTargetTotalWindow.max,
  };
  const rangeLiveVariationPct = rangeSideStats.totalMin !== null && rangeSideStats.totalMax !== null
    ? rangeVariationPct({ min: rangeSideStats.totalMin, max: rangeSideStats.totalMax })
    : rangeTargetVariationPct;
  const intentWindow = getIntentDistanceWindow(savedTarget, rangeTotalWindow, rangeTotal, rangeLiveVariationPct);
  const clubShots = courseShots.filter((shot) => getClubConfigId(shot.club) === profile.clubId && matchesProfileShot(
    shot,
    profile,
    fullTargetMax,
    fullTargetTotal,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    shotCategoryOverrides,
    shotClassificationRules,
  ));
  const cleanedClubShots = withoutDistanceOutliers(clubShots);
  const shouldSplitByIntent = profile.targets.length > 1;
  const targetReferenceShots = shouldSplitByIntent
    ? withoutDistanceOutliers(cleanedClubShots.filter((shot) => {
        const override = shotCategoryOverrides[shot.id];
        return override ? override.target === target : matchesTargetIntent(shot, target, intentWindow);
      }))
    : cleanedClubShots;
  const reliableSelection = selectReliableGappingShots(targetReferenceShots, reliablePercent, fallbackQualityCutoff);
  const referenceShots = reliableSelection.shots;
  const qualityCutoff = reliableSelection.reliableHcpLevel ?? fallbackQualityCutoff;
  const top = referenceShots;
  const totals = top.map((shot) => shot.total);
  const variationTotals = referenceShots.map((shot) => shot.total);
  const sides = top.map((shot) => shot.side);
  const liveTotal = mean(totals);
  const liveTotalMin = totals.length ? Math.min(...totals) : null;
  const liveTotalMax = totals.length ? Math.max(...totals) : null;
  const rangeShotCount = getRangeShotCount(sessions, shotsBySession);
  const displayTotal = liveTotal ?? rangeTotal;
  const liveVariationPct = variationPct(variationTotals, liveTotal);
  const displayVariationPct = liveVariationPct ?? rangeLiveVariationPct;
  const usesLiveTotal = displayTotal !== null && liveTotal !== null && Math.abs(displayTotal - liveTotal) < 0.5;
  const liveCarry = getRangeCarryEstimate(liveTotal, practiceConfig);
  const liveCarryWindow = liveTotalMin !== null && liveTotalMax !== null
    ? {
        min: getRangeCarryEstimate(liveTotalMin, practiceConfig),
        max: getRangeCarryEstimate(liveTotalMax, practiceConfig),
      }
    : null;
  const rangeCarryWindow = rangeSideStats.carryMin !== null && rangeSideStats.carryMax !== null
    ? { min: rangeSideStats.carryMin, max: rangeSideStats.carryMax }
    : getRangeCarryWindow(displayTotal, practiceConfig);
  const estimatedVerticalWindow = getEstimatedVerticalWindow(displayTotal, practiceConfig);
  const rangeOnly = referenceShots.length === 0 && rangeShotCount > 0;

  const recentIntentShots = [...targetReferenceShots]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 20);

  return {
    profile,
    target,
    sample: targetReferenceShots,
    topQuartile: top,
    liveTotal,
    liveCarry,
    liveVariationPct,
    rangeTargetVariationPct: rangeLiveVariationPct,
    rangeTargetTotal: rangeTotal,
    rangeTargetCarry: rangeCarry,
    rangeTargetSide,
    displayVariationPct,
    displayTotal,
    displayCarry: (usesLiveTotal ? liveCarry : null) ?? getRangeCarryEstimate(displayTotal, practiceConfig) ?? rangeCarry,
    displayCarryMin: liveCarryWindow?.min ?? rangeCarryWindow.min,
    displayCarryMax: liveCarryWindow?.max ?? rangeCarryWindow.max,
    totalMin: liveTotalMin ?? (rangeOnly ? rangeTotalWindow.min : estimatedVerticalWindow.min),
    totalMax: liveTotalMax ?? (rangeOnly ? rangeTotalWindow.max : estimatedVerticalWindow.max),
    sideLeft: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    sideRight: sides.length ? Math.max(0, ...sides) : null,
    displaySideLeft: (sides.length ? Math.abs(Math.min(0, ...sides)) : null) ?? rangeSideStats.left,
    displaySideRight: (sides.length ? Math.max(0, ...sides) : null) ?? rangeSideStats.right,
    sideBias: mean(sides) ?? rangeSideStats.mean,
    recentTargetPct: recentIntentShots.length ? (recentIntentShots.filter((shot) => shotHandicap(shot) <= qualityCutoff).length / recentIntentShots.length) * 100 : null,
    recentSafePct: recentIntentShots.length ? (recentIntentShots.filter(isSafeOutcome).length / recentIntentShots.length) * 100 : null,
    rangeConfidence: getRangeTargetPct(sessions, practiceConfig, shotsBySession),
    shotCount: targetReferenceShots.length,
    intentShotCount: targetReferenceShots.length,
    rangeShotCount,
    qualityCutoff,
    reliableHcpLevel: reliableSelection.reliableHcpLevel,
    reliableCoveragePct: reliableSelection.reliableCoveragePct,
    savedTarget,
  };
}

export function loadShotCategoryOverrides(): ShotCategoryOverrides {
  try {
    const raw = localStorage.getItem(SHOT_CATEGORY_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const override = value as Partial<ShotCategoryOverride>;
        return typeof override.profileId === 'string' && (override.target === 'green' || override.target === 'fairway');
      }),
    ) as ShotCategoryOverrides;
  } catch {
    return {};
  }
}

export function buildClubGappingRows({
  profiles,
  shots,
  shotContext,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingReliablePercent = DEFAULT_RELIABLE_PERCENT,
  gappingQualityFallbackHcp = DEFAULT_QUALITY_CUTOFF,
  shotCategoryOverrides,
  shotClassificationRules = loadShotClassificationRules(),
}: {
  profiles: ShotProfileMap;
  shots: Shot[];
  shotContext: ShotContext;
  practiceSessions: PracticeSession[];
  practiceConfigs: ClubPracticeConfig[];
  shotsBySession: ShotsBySession;
  gappingReliablePercent?: number;
  gappingQualityFallbackHcp?: number;
  shotCategoryOverrides: ShotCategoryOverrides;
  shotClassificationRules?: ShotClassificationRules;
}): GappingRow[] {
  const contextShots = shots.filter((shot) => matchesShotContext(shot, shotContext));
  const profilesWithRangeSessions = { ...profiles };
  for (const session of practiceSessions) {
    if (profilesWithRangeSessions[session.clubId]) continue;
    const rangeProfile = profileFromPracticeKey(session.clubId);
    if (rangeProfile) profilesWithRangeSessions[session.clubId] = rangeProfile;
  }
  const bumpClubIds = new Set(['8i', '9i']);
  for (const session of practiceSessions) {
    const parsed = parsePracticeConfigKey(session.clubId);
    if (parsed.club && parsed.shotType === 'bump') bumpClubIds.add(parsed.club);
  }
  ensureVisibleShortBucketProfiles(profilesWithRangeSessions, [...bumpClubIds], 'bump');
  ensureVisibleShortBucketProfiles(profilesWithRangeSessions, ['pw', 'gw', 'sw'], 'pitch');
  ensureVisibleShortBucketProfiles(profilesWithRangeSessions, ['pw', 'gw'], 'chip');

  return Object.values(profilesWithRangeSessions)
    .filter((profile) => {
      const hasRangePractice = shotContext !== 'tee' && hasRangePracticeForProfile(profile, practiceSessions);
      const hasClassificationRule = Boolean(getShotClassificationRule(shotClassificationRules, profile.clubId, profile.shotType))
        && (profile.power === 'full' || profile.power === '9pm');
      if (shotContext === 'tee') return profile.enabled && profile.showOnCourse;
      return (profile.enabled && profile.showOnCourse && (profile.power === 'full' || isVisibleShortBucket(profile))) || hasRangePractice || hasClassificationRule;
    })
    .filter((profile) => shotContext === 'tee' || profile.clubId !== 'dr')
    .filter((profile) => (
      !(['pw', 'gw', 'sw'].includes(profile.clubId) && profile.shotType === 'full')
      || isClubFullNormalClassification(shotClassificationRules, profile.clubId)
    ))
    .filter((profile) => !isShortShot(profile) || isVisibleShortBucket(profile))
    .filter((profile) => shotContext !== 'tee' || (profile.shotType === 'full' && profile.power === 'full'))
    .flatMap((profile) => profile.targets.map((target) => buildRow(
      profile,
      target,
      contextShots,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      profiles,
      gappingReliablePercent,
      gappingQualityFallbackHcp,
      shotCategoryOverrides,
      shotClassificationRules,
    )))
    .filter((row) => row.intentShotCount > 0 || (shotContext !== 'tee' && row.rangeShotCount > 0) || (shotContext !== 'tee' && isVisibleShortBucket(row.profile) && row.displayTotal !== null));
}

export interface CourseShotGappingAssignment {
  configKey: string;
  profile: ShotProfile;
  target: ProfileTarget;
}

export function buildCourseShotGappingAssignments({
  profiles,
  shots,
  practiceSessions,
  practiceConfigs,
  shotsBySession,
  gappingReliablePercent = DEFAULT_RELIABLE_PERCENT,
  gappingQualityFallbackHcp = DEFAULT_QUALITY_CUTOFF,
  shotCategoryOverrides = {},
  shotClassificationRules = loadShotClassificationRules(),
}: {
  profiles: ShotProfileMap;
  shots: Shot[];
  practiceSessions: PracticeSession[];
  practiceConfigs: ClubPracticeConfig[];
  shotsBySession: ShotsBySession;
  gappingReliablePercent?: number;
  gappingQualityFallbackHcp?: number;
  shotCategoryOverrides?: ShotCategoryOverrides;
  shotClassificationRules?: ShotClassificationRules;
}): {
  shotToAssignment: Map<string, CourseShotGappingAssignment>;
  options: Map<string, CourseShotGappingAssignment>;
} {
  const shotToAssignment = new Map<string, CourseShotGappingAssignment>();
  const options = new Map<string, CourseShotGappingAssignment>();
  const contexts: ShotContext[] = ['tee', 'fairway', 'roughRecovery'];

  for (const shotContext of contexts) {
    const rows = buildClubGappingRows({
      profiles,
      shots,
      shotContext,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      gappingReliablePercent,
      gappingQualityFallbackHcp,
      shotCategoryOverrides,
      shotClassificationRules,
    });

    for (const row of rows) {
      const assignment = {
        configKey: visibleGappingConfigKey(row.profile.id),
        profile: row.profile,
        target: row.target,
      };
      if (!options.has(assignment.configKey)) options.set(assignment.configKey, assignment);
      for (const shot of row.sample) {
        if (!shotToAssignment.has(shot.id)) shotToAssignment.set(shot.id, assignment);
      }
    }
  }

  return { shotToAssignment, options };
}
