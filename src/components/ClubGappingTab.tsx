import { useMemo, useState } from 'react';
import { Gauge, Pencil, RefreshCw, Signal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions, ShotsBySession } from '@/hooks/usePracticeShotsBySessions';
import { getClubConfigId, getShotDateKey } from '@/lib/golfCalculations';
import { pctWithinTarget } from '@/lib/practiceConsistency';
import { ProfileTarget, ShotProfile, ShotProfileMap, ShotProfileTargetValues, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { Shot } from '@/types/golf';
import { ClubPracticeConfig, PracticeSession } from '@/types/practice';
import { PRACTICE_CLUBS } from '@/types/practiceClubs';

type ShotContext = 'tee' | 'fairway' | 'roughRecovery';
type ShotSortKey = 'quality' | 'distance' | 'alignment';

const SHOT_CONTEXT_OPTIONS: Array<{ id: ShotContext; label: string }> = [
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

interface GappingRow {
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
  targetPct: number | null;
  safePct: number | null;
  rangeConfidence: number | null;
  shotCount: number;
  intentShotCount: number;
  rangeShotCount: number;
  qualityCutoff: number;
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

function sortShots(shots: Shot[], sortKey: ShotSortKey): Shot[] {
  return [...shots].sort((a, b) => {
    if (sortKey === 'distance') return b.total - a.total;
    if (sortKey === 'alignment') return Math.abs(a.side) - Math.abs(b.side);
    const qualityDelta = qualityRank(a) - qualityRank(b);
    if (qualityDelta !== 0) return qualityDelta;
    return b.total - a.total;
  });
}

function getTargetSettings(profile: ShotProfile, target: ProfileTarget): Partial<ShotProfileTargetValues> {
  const targetOverride = profile.targetOverrides[target] ?? {};
  const useLegacyTargets = profile.targets.length <= 1;
  return {
    targetTotal: targetOverride.targetTotal ?? (useLegacyTargets ? profile.targetTotal : null),
    targetCarry: targetOverride.targetCarry ?? (useLegacyTargets ? profile.targetCarry : null),
    targetVariationPct: targetOverride.targetVariationPct ?? (useLegacyTargets ? profile.targetVariationPct : null),
    targetSideLeft: targetOverride.targetSideLeft ?? (useLegacyTargets ? profile.targetSideLeft : null),
    targetSideRight: targetOverride.targetSideRight ?? (useLegacyTargets ? profile.targetSideRight : null),
    targetQualityCutoff: targetOverride.targetQualityCutoff ?? profile.targetQualityCutoff,
  };
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

function fmt(value: number | null, suffix = 'm', digits = 0): string {
  return value === null || !Number.isFinite(value) ? '-' : `${value.toFixed(digits)}${suffix}`;
}

function fmtSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  if (Math.abs(value) < 0.5) return 'Neutral';
  return `${Math.abs(value).toFixed(0)}m ${value > 0 ? 'R' : 'L'}`;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getClubName(profile: ShotProfile): string {
  return PRACTICE_CLUBS.find((club) => club.id === profile.clubId)?.name ?? profile.clubId;
}

function getShotLabel(profile: ShotProfile): string {
  if (profile.shotType === 'punch') return 'Punch';
  return 'Full';
}

function fmtSideRange(left: number | null, right: number | null): string {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return '-';
  return `${left.toFixed(0)}L - ${right.toFixed(0)}R`;
}

function percentDotTone(value: number | null): string {
  if (value === null) return 'border-muted bg-background';
  if (value >= 65) return 'border-green-600 bg-green-600';
  if (value >= 40) return 'border-amber-500 bg-amber-500';
  return 'border-red-600 bg-red-600';
}

function rangeDotTone(value: number | null): string {
  if (value === null) return 'border-muted bg-background';
  if (value > 50) return 'border-green-600 bg-green-600';
  if (value >= 20) return 'border-amber-500 bg-amber-500';
  return 'border-red-600 bg-red-600';
}

function shotCountTone(count: number): string {
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
  const greenIntent = isGreenIntentShot(shot, window);
  return target === 'green' ? greenIntent : !greenIntent;
}

function matchesPracticeProfile(session: PracticeSession, profile: ShotProfile): boolean {
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
        .map((metric) => pctWithinTarget(metric.id, sessionShots, metric.targetMin, metric.targetMax))
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
): { left: number | null; right: number | null; mean: number | null } {
  const sides = sessions.slice(0, 3)
    .flatMap((session) => shotsBySession[session.id] ?? [])
    .map((shot) => getPracticeMetricNumber(shot.metrics, ['carrySide', 'carry_side', 'side', 'offline']))
    .filter((value): value is number => value !== null);

  if (sides.length === 0) return { left: null, right: null, mean: null };

  return {
    left: Math.abs(Math.min(0, ...sides)),
    right: Math.max(0, ...sides),
    mean: mean(sides),
  };
}

function hasRangePracticeForProfile(profile: ShotProfile, practiceSessions: PracticeSession[]): boolean {
  return practiceSessions.some((session) => matchesPracticeProfile(session, profile));
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
): boolean {
  const punchShot = isPunchShot(shot, fullTargetMax);
  if (profile.shotType === 'punch') return punchShot;
  if (profile.shotType === 'full' && isPunchClub(profile.clubId)) return !punchShot;
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
): GappingRow {
  const fullTargetMax = getFullShotTargetMax(profile.clubId, profiles, practiceConfigs);
  const savedTarget = getTargetSettings(profile, target);
  const qualityCutoff = savedTarget.targetQualityCutoff ?? DEFAULT_QUALITY_CUTOFF;
  const sessions = practiceSessions
    .filter((session) => matchesPracticeProfile(session, profile))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const practiceConfig = practiceConfigs.find((config) => config.clubId === profile.id)
    ?? practiceConfigs.find((config) => config.clubId === profile.clubId);
  const rangeTargetTotal = getMetricTargetValue(practiceConfig, 'total_distance');
  const rangeTargetCarry = getMetricTargetValue(practiceConfig, 'carry');
  const rangeTargetSide = getMetricTargetRange(practiceConfig, 'avg_lateral_miss').max;
  const rangeTargetTotalWindow = getMetricTargetRange(practiceConfig, 'total_distance');
  const rangeTargetVariationPct = rangeVariationPct(rangeTargetTotalWindow);
  const rangeSideStats = getRangeSideStats(sessions, shotsBySession);
  const intentWindow = getIntentDistanceWindow(savedTarget, rangeTargetTotalWindow, rangeTargetTotal, rangeTargetVariationPct);
  const clubShots = courseShots.filter((shot) => getClubConfigId(shot.club) === profile.clubId && matchesProfileShot(shot, profile, fullTargetMax));
  const cleanedClubShots = withoutDistanceOutliers(clubShots);
  const targetReferenceShots = withoutDistanceOutliers(cleanedClubShots.filter((shot) => matchesTargetIntent(shot, target, intentWindow)));
  const referenceShots = selectGappingQualityShots(targetReferenceShots, qualityCutoff);
  const top = referenceShots;
  const totals = top.map((shot) => shot.total);
  const variationTotals = referenceShots.map((shot) => shot.total);
  const sides = top.map((shot) => shot.side);
  const liveTotal = mean(totals);
  const rangeShotCount = getRangeShotCount(sessions, shotsBySession);
  const displayTotal = savedTarget.targetTotal ?? liveTotal ?? rangeTargetTotal;
  const liveVariationPct = variationPct(variationTotals, liveTotal);
  const displayVariationPct = savedTarget.targetVariationPct ?? liveVariationPct ?? rangeTargetVariationPct;
  const variationWindow = displayTotal !== null && displayVariationPct !== null
    ? {
        min: displayTotal * (1 - displayVariationPct / 100),
        max: displayTotal * (1 + displayVariationPct / 100),
      }
    : null;
  const liveCarry = getRangeCarryEstimate(liveTotal, practiceConfig);
  const displayCarryWindow = getRangeCarryWindow(displayTotal, practiceConfig);
  const estimatedVerticalWindow = getEstimatedVerticalWindow(displayTotal, practiceConfig);
  const rangeOnly = referenceShots.length === 0 && rangeShotCount > 0;

  const uniqueDates = [...new Set(courseShots.map((shot) => getShotDateKey(shot.date)))]
    .sort()
    .slice(-3);
  const lastThreeClubShots = clubShots.filter((shot) => uniqueDates.includes(getShotDateKey(shot.date)));
  const lastThreeIntentShots = lastThreeClubShots.filter((shot) => matchesTargetIntent(shot, target, intentWindow));

  return {
    profile,
    target,
    sample: targetReferenceShots,
    topQuartile: top,
    liveTotal,
    liveCarry,
    liveVariationPct,
    rangeTargetVariationPct,
    rangeTargetTotal,
    rangeTargetCarry,
    rangeTargetSide,
    displayVariationPct,
    displayTotal,
    displayCarry: savedTarget.targetCarry ?? getRangeCarryEstimate(displayTotal, practiceConfig) ?? liveCarry ?? rangeTargetCarry,
    displayCarryMin: displayCarryWindow.min,
    displayCarryMax: displayCarryWindow.max,
    totalMin: variationWindow?.min ?? (rangeOnly ? rangeTargetTotalWindow.min : estimatedVerticalWindow.min),
    totalMax: variationWindow?.max ?? (rangeOnly ? rangeTargetTotalWindow.max : estimatedVerticalWindow.max),
    sideLeft: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    sideRight: sides.length ? Math.max(0, ...sides) : null,
    displaySideLeft: savedTarget.targetSideLeft ?? (sides.length ? Math.abs(Math.min(0, ...sides)) : null) ?? rangeSideStats.left,
    displaySideRight: savedTarget.targetSideRight ?? (sides.length ? Math.max(0, ...sides) : null) ?? rangeSideStats.right,
    sideBias: mean(sides) ?? rangeSideStats.mean,
    targetPct: lastThreeIntentShots.length ? (lastThreeIntentShots.filter((shot) => matchesTarget(shot, target)).length / lastThreeIntentShots.length) * 100 : null,
    safePct: lastThreeIntentShots.length ? (lastThreeIntentShots.filter(isSafeOutcome).length / lastThreeIntentShots.length) * 100 : null,
    rangeConfidence: getRangeTargetPct(sessions, practiceConfig, shotsBySession),
    shotCount: targetReferenceShots.length,
    intentShotCount: targetReferenceShots.length,
    rangeShotCount,
    qualityCutoff,
    savedTarget,
  };
}

export function ClubGappingTab() {
  const { shots } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [shotContext, setShotContext] = useState<ShotContext>('tee');
  const [editingRow, setEditingRow] = useState<GappingRow | null>(null);
  const [shotsRow, setShotsRow] = useState<GappingRow | null>(null);
  const [shotSort, setShotSort] = useState<ShotSortKey>('quality');
  const [draft, setDraft] = useState({
    targetTotal: '',
    targetCarry: '',
    targetVariationPct: '',
    targetQualityCutoff: '',
    targetSideLeft: '',
    targetSideRight: '',
  });

  const rows = useMemo(() => {
    const contextShots = shots.filter((shot) => matchesShotContext(shot, shotContext));
    return Object.values(profiles)
      .filter((profile) => profile.enabled && (profile.showOnCourse || (shotContext !== 'tee' && hasRangePracticeForProfile(profile, practiceSessions))))
      .filter((profile) => shotContext === 'tee' || profile.clubId !== 'dr')
      .filter((profile) => profile.power === 'full')
      .filter((profile) => shotContext !== 'tee' || profile.shotType === 'full')
      .flatMap((profile) => profile.targets.map((target) => buildRow(profile, target, contextShots, practiceSessions, practiceConfigs, shotsBySession, profiles)))
      .filter((row) => row.intentShotCount > 0 || (shotContext !== 'tee' && row.rangeShotCount > 0));
  }, [profiles, shots, shotContext, practiceSessions, practiceConfigs, shotsBySession]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, GappingRow[]>();
    for (const row of rows) {
      const clubName = getClubName(row.profile);
      groups.set(clubName, [...(groups.get(clubName) ?? []), row]);
    }
    return [...groups.entries()];
  }, [rows]);

  const openEdit = (row: GappingRow) => {
    setEditingRow(row);
    setDraft({
      targetTotal: row.savedTarget.targetTotal?.toString() ?? '',
      targetCarry: row.savedTarget.targetCarry?.toString() ?? '',
      targetVariationPct: row.savedTarget.targetVariationPct?.toString() ?? '',
      targetQualityCutoff: row.savedTarget.targetQualityCutoff?.toString() ?? '',
      targetSideLeft: row.savedTarget.targetSideLeft?.toString() ?? '',
      targetSideRight: row.savedTarget.targetSideRight?.toString() ?? '',
    });
  };

  const useLiveInDraft = () => {
    if (!editingRow) return;
    setDraft({
      targetTotal: editingRow.liveTotal?.toFixed(0) ?? '',
      targetCarry: editingRow.liveCarry?.toFixed(0) ?? '',
      targetVariationPct: editingRow.liveVariationPct?.toFixed(0) ?? '',
      targetQualityCutoff: editingRow.qualityCutoff.toString(),
      targetSideLeft: editingRow.sideLeft?.toFixed(0) ?? '',
      targetSideRight: editingRow.sideRight?.toFixed(0) ?? '',
    });
  };

  const useRangeInDraft = () => {
    if (!editingRow) return;
    setDraft({
      targetTotal: editingRow.rangeTargetTotal?.toFixed(0) ?? '',
      targetCarry: editingRow.rangeTargetCarry?.toFixed(0) ?? '',
      targetVariationPct: editingRow.rangeTargetVariationPct?.toFixed(0) ?? '',
      targetQualityCutoff: editingRow.qualityCutoff.toString(),
      targetSideLeft: editingRow.rangeTargetSide?.toFixed(0) ?? '',
      targetSideRight: editingRow.rangeTargetSide?.toFixed(0) ?? '',
    });
  };

  const saveEdit = () => {
    if (!editingRow) return;
    const nextTargetOverrides = {
      ...editingRow.profile.targetOverrides,
      [editingRow.target]: {
        targetTotal: parseOptionalNumber(draft.targetTotal),
        targetCarry: parseOptionalNumber(draft.targetCarry),
        targetVariationPct: parseOptionalNumber(draft.targetVariationPct),
        targetQualityCutoff: parseOptionalNumber(draft.targetQualityCutoff),
        targetSideLeft: parseOptionalNumber(draft.targetSideLeft),
        targetSideRight: parseOptionalNumber(draft.targetSideRight),
      },
    };
    updateShotProfile(editingRow.profile.id, {
      targetOverrides: nextTargetOverrides,
    });
    setEditingRow(null);
  };

  const detailShots = useMemo(() => sortShots(shotsRow?.sample ?? [], shotSort), [shotsRow, shotSort]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Club Gapping
          </CardTitle>
          <CardDescription>
            Distances are top-quartile shots that hit the intended target. Carry comes from range practice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            {SHOT_CONTEXT_OPTIONS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={shotContext === option.id ? 'default' : 'outline'}
                onClick={() => setShotContext(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Club</TableHead>
                  <TableHead>Shot</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Distance</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Vertical</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Side Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Mean Side</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Target %</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Safe %</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Range %</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Shots</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map(([clubName, clubRows]) => (
                  clubRows.map((row, index) => (
                    <TableRow key={`${row.profile.id}-${row.target}`}>
                      <TableCell className="font-semibold">
                        {index === 0 ? clubName : ''}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.profile.shotType === 'punch' ? 'default' : 'outline'}>{getShotLabel(row.profile)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{row.target}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{fmt(row.displayTotal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.totalMin)} - {fmt(row.totalMax)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">{fmtSideRange(row.displaySideLeft, row.displaySideRight)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtSigned(row.sideBias)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.displayCarry)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.displayCarryMin)} - {fmt(row.displayCarryMax)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${percentDotTone(row.targetPct)}`} title={`Target ${fmt(row.targetPct, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${percentDotTone(row.safePct)}`} title={`Safe ${fmt(row.safePct, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${rangeDotTone(row.rangeConfidence)}`} title={`Range ${fmt(row.rangeConfidence, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="mx-auto h-8 w-8"
                          title={`${row.shotCount} shots`}
                          onClick={() => setShotsRow(row)}
                          disabled={row.shotCount === 0}
                        >
                          <Signal className={`h-4 w-4 ${shotCountTone(row.shotCount)}`} aria-label={`${row.shotCount} shots`} />
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" title="Edit targets" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={13} className="py-10 text-center text-muted-foreground">
                      No gapping data yet for this shot type.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => !open && setEditingRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Gapping Targets</DialogTitle>
            <DialogDescription>
              Saved targets are shown in the table. Refresh from course data or range targets before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {editingRow && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm sm:col-span-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium">Latest live values</div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={useLiveInDraft}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Course
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={useRangeInDraft}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Range
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  <div>Total {fmt(editingRow.liveTotal)}</div>
                  <div>Carry {fmt(editingRow.liveCarry)}</div>
                  <div>Variation {fmt(editingRow.liveVariationPct, '%')}</div>
                  <div>Side {fmtSideRange(editingRow.sideLeft, editingRow.sideRight)}</div>
                  <div>Mean {fmtSigned(editingRow.sideBias)}</div>
                </div>
                <div className="mt-2 grid gap-2 border-t pt-2 sm:grid-cols-5">
                  <div>Range total {fmt(editingRow.rangeTargetTotal)}</div>
                  <div>Range carry {fmt(editingRow.rangeTargetCarry)}</div>
                  <div>Range variation {fmt(editingRow.rangeTargetVariationPct, '%')}</div>
                  <div>Range side {fmt(editingRow.rangeTargetSide)}</div>
                  <div>Range shots {editingRow.rangeShotCount}</div>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="target-total">Total distance</label>
              <Input id="target-total" type="number" value={draft.targetTotal} onChange={(event) => setDraft(prev => ({ ...prev, targetTotal: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="target-carry">Carry</label>
              <Input id="target-carry" type="number" value={draft.targetCarry} onChange={(event) => setDraft(prev => ({ ...prev, targetCarry: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="target-variation">Vertical variation %</label>
              <Input id="target-variation" type="number" value={draft.targetVariationPct} onChange={(event) => setDraft(prev => ({ ...prev, targetVariationPct: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="quality-cutoff">Quality cutoff hcp</label>
              <Input id="quality-cutoff" type="number" value={draft.targetQualityCutoff} placeholder="10" onChange={(event) => setDraft(prev => ({ ...prev, targetQualityCutoff: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="target-left">Left side</label>
              <Input id="target-left" type="number" value={draft.targetSideLeft} onChange={(event) => setDraft(prev => ({ ...prev, targetSideLeft: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="target-right">Right side</label>
              <Input id="target-right" type="number" value={draft.targetSideRight} onChange={(event) => setDraft(prev => ({ ...prev, targetSideRight: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRow(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(shotsRow)} onOpenChange={(open) => !open && setShotsRow(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {shotsRow ? `${getClubName(shotsRow.profile)} ${getShotLabel(shotsRow.profile)} to ${shotsRow.target}` : 'Shots'}
            </DialogTitle>
            <DialogDescription>
              These are all imported shots for this lie, shot, and intent. Gapping numbers still use the stricter of top quartile by quality and {shotsRow?.qualityCutoff ?? DEFAULT_QUALITY_CUTOFF} Handicap or better.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={shotSort === 'quality' ? 'default' : 'outline'} onClick={() => setShotSort('quality')}>
              Quality
            </Button>
            <Button type="button" size="sm" variant={shotSort === 'distance' ? 'default' : 'outline'} onClick={() => setShotSort('distance')}>
              Distance
            </Button>
            <Button type="button" size="sm" variant={shotSort === 'alignment' ? 'default' : 'outline'} onClick={() => setShotSort('alignment')}>
              Alignment
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Alignment</TableHead>
                  <TableHead>Start lie</TableHead>
                  <TableHead>End lie</TableHead>
                  <TableHead>Strike</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailShots.map((shot) => (
                  <TableRow key={shot.id}>
                    <TableCell className="whitespace-nowrap">{getShotDateKey(shot.date)}</TableCell>
                    <TableCell>{shot.shotQuality || '-'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmt(shot.total)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{fmtSigned(shot.side)}</TableCell>
                    <TableCell>{shot.startLie || '-'}</TableCell>
                    <TableCell>{shot.endLie || '-'}</TableCell>
                    <TableCell>{shot.strikeQuality || '-'}</TableCell>
                  </TableRow>
                ))}
                {detailShots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No matching shots.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
