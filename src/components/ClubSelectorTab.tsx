import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { AlertCircle, ArrowDownUp, Crosshair, Flag, ShieldAlert, Target, Wind } from 'lucide-react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { ShotsBySession, usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildClubGappingRows, GappingRow, ShotContext } from '@/lib/gapping';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { getClubConfigId } from '@/lib/golfCalculations';
import { ProfileTarget, ShotProfile, ShotProfileTargetValues, useShotProfiles } from '@/lib/shotProfiles';
import { POWER_OPTIONS, SHOT_TYPES, parsePracticeConfigKey } from '@/types/practiceClubs';
import { ClubConfig, Shot } from '@/types/golf';
import { ClubPracticeConfig, PracticeSession } from '@/types/practice';
import {
  SHOT_PICKER_CLUB_DELTA_METRES,
  getClubAdjustmentLabel,
  getDirectionAdjustmentLabel,
  type ShotPickerAdjustmentRule,
  type ShotPickerFeet,
  type ShotPickerLie,
  type ShotPickerSlope,
} from '@/lib/shotPickerAdjustments';

const GOOD_SHOT_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap'];
const GAP_WEDGE_FULL_PITCH_TARGET = 70;
const CHIP_TARGETS: Record<string, { full: number; half: number }> = {
  pw: { full: 34, half: 18 },
  gw: { full: 19, half: 10 },
};
const WEDGE_SHOT_TYPES = ['chip', 'pitch', 'bump'];
const MATRIX_CLUB_ORDER = ['8i', '9i', 'pw', 'gw', 'sw', 'lw'];
const MATRIX_BUMP_CLUB_IDS = ['8i', '9i'];
const MATRIX_PITCH_CLUB_IDS = ['pw', 'gw', 'sw'];
const MATRIX_CHIP_CLUB_IDS = ['pw', 'gw'];
const MATRIX_POWER_COLUMNS = [
  { id: 'full', label: 'Full' },
  { id: '9pm', label: 'Half' },
] as const;

type LieOption = ShotPickerLie;
type SlopeOption = ShotPickerSlope;
type FeetOption = ShotPickerFeet;
type TargetOption = 'green' | 'fairway';
type TroubleOption = 'left' | 'right' | 'short' | 'long';
type DataConfidence = 'high' | 'medium' | 'low' | 'very-low';
type MatrixPower = typeof MATRIX_POWER_COLUMNS[number]['id'];
type MatrixSortKey = 'club' | 'shot' | 'distance';
type MatrixLieContext = Extract<ShotContext, 'fairway' | 'roughRecovery'>;

interface ClubRecommendation {
  clubId: string;
  clubName: string;
  profileId: string;
  profileName: string;
  shotType: string;
  strength: string;
  shotLabel: string;
  technique: string;
  routine: string;
  confidence: number;
  bestFitScore: number;
  targetFit: number;
  sampleCount: number;
  sampleLabel: string;
  dataConfidence: DataConfidence;
  avgTotal: number;
  avgCarry: number | null;
  avgSide: number;
  shotConfidence: number | null;
  safetyConfidence: number | null;
  withinTolerancePct: number | null;
  nominatedShortPct: number | null;
  nominatedLongPct: number | null;
  isShortOfTarget: boolean;
  leftRisk: number;
  rightRisk: number;
  shortRisk: number;
  longRisk: number;
  goodShotPct: number;
  hitPct: number;
  hitCount: number;
  goodDistancePct: number;
  badges: string[];
  pointer: string;
}

interface WedgeMatrixCell {
  profileId: string;
  carry: number | null;
  total: number | null;
  last20TargetPct: number | null;
  actualShots: number;
  rangeSessions: number;
  source: string;
}

interface WedgeMatrixRow {
  clubId: string;
  clubName: string;
  shotType: string;
  cells: Partial<Record<typeof MATRIX_POWER_COLUMNS[number]['id'], WedgeMatrixCell>>;
}

interface MatrixProfileResult {
  clubId: string;
  clubName: string;
  shotType: string;
  power: MatrixPower;
  cell: WedgeMatrixCell;
}

interface MatrixCombo {
  clubId: string;
  shotType: string;
}

const lieOptions: Array<{ value: LieOption; label: string }> = [
  { value: 'tee', label: 'Tee' },
  { value: 'fairway', label: 'Fairway' },
  { value: 'roughRecovery', label: 'Rough / Recovery' },
];

const slopeOptions: Array<{ value: SlopeOption; label: string }> = [
  { value: 'flat', label: 'Flat' },
  { value: 'uphill', label: 'Uphill' },
  { value: 'downhill', label: 'Downhill' },
];

const feetOptions: Array<{ value: FeetOption; label: string }> = [
  { value: 'level', label: 'Feet level' },
  { value: 'above', label: 'Above' },
  { value: 'below', label: 'Below' },
];

const targetOptions: Array<{ value: TargetOption; label: string }> = [
  { value: 'green', label: 'Green' },
  { value: 'fairway', label: 'Fairway' },
];

const troubleOptions: Array<{ value: TroubleOption; label: string }> = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'short', label: 'Short' },
  { value: 'long', label: 'Long' },
];

const matrixLieOptions: Array<{ value: MatrixLieContext; label: string }> = [
  { value: 'fairway', label: 'Fairway' },
  { value: 'roughRecovery', label: 'Rough' },
];

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function getDataConfidence(sampleCount: number): DataConfidence {
  if (sampleCount >= 20) return 'high';
  if (sampleCount >= 10) return 'medium';
  if (sampleCount >= 5) return 'low';
  return 'very-low';
}

function normalizeLie(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes('tee')) return 'tee';
  if (lower.includes('fairway')) return 'fairway';
  if (lower.includes('uphill')) return 'uphill';
  if (lower.includes('downhill')) return 'downhill';
  if (lower.includes('rough')) return 'roughRecovery';
  if (lower.includes('sand') || lower.includes('bunker')) return 'sand';
  if (lower.includes('recovery') || lower.includes('tree') || lower.includes('punch') || lower.includes('trouble')) return 'roughRecovery';
  return lower;
}

function matchesLie(shot: Shot, lie: LieOption): boolean {
  return normalizeLie(shot.startLie || '') === lie;
}

function getSelectorShotContext(lie: LieOption): ShotContext {
  if (lie === 'tee') return 'tee';
  if (lie === 'roughRecovery') return 'roughRecovery';
  return 'fairway';
}

function uniqueShots(shots: Shot[]): Shot[] {
  const seen = new Set<string>();
  return shots.filter((shot) => {
    if (seen.has(shot.id)) return false;
    seen.add(shot.id);
    return true;
  });
}

function matchesTargetDestination(shot: Shot, target: TargetOption): boolean {
  const endLie = (shot.endLie || '').toLowerCase();
  if (target === 'green') {
    return endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole');
  }
  return endLie.includes('fairway');
}

function canTargetDestination(club: ClubConfig, target: TargetOption): boolean {
  return target === 'fairway' || club.distanceToTargetEnabled;
}

function getShortProfileName(profile: ShotProfile): string {
  const shot = SHOT_TYPES.find((item) => item.id === profile.shotType)?.name ?? profile.shotType;
  const power = POWER_OPTIONS.find((item) => item.id === profile.power)?.name ?? profile.power;
  return `${shot} / ${power}`;
}

function getShotTypeLabel(shotType: string): string {
  return SHOT_TYPES.find((item) => item.id === shotType)?.name ?? shotType;
}

function getPowerLabel(power: string): string {
  return POWER_OPTIONS.find((item) => item.id === power)?.name ?? power;
}

function getSelectorShotLabel(profile: ShotProfile): string {
  if (profile.shotType === 'full' && profile.power === 'full') return 'Full';
  const shot = getShotTypeLabel(profile.shotType);
  const power = profile.power === 'full'
    ? 'Full'
    : profile.power === '9pm'
      ? 'Half'
      : getPowerLabel(profile.power);
  return `${shot} / ${power}`;
}

function metricAverage(valueMin: number | null, valueMax: number | null): number | null {
  if (valueMin !== null && valueMax !== null) return (valueMin + valueMax) / 2;
  return valueMin ?? valueMax;
}

function fmtPct(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '-' : `${Math.round(value)}%`;
}

function fmtSigned(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-';
  if (Math.abs(value) < 0.5) return 'Neutral';
  return `${Math.abs(value).toFixed(0)}m ${value > 0 ? 'R' : 'L'}`;
}

function getProfileTargetSettings(profile: ShotProfile, target: ProfileTarget): Partial<ShotProfileTargetValues> {
  const targetOverride = profile.targetOverrides[target] ?? {};
  const useLegacyTargets = profile.targets.length <= 1;
  return {
    targetTotal: targetOverride.targetTotal ?? (useLegacyTargets ? profile.targetTotal : null),
    targetCarry: targetOverride.targetCarry ?? (useLegacyTargets ? profile.targetCarry : null),
    targetSideLeft: targetOverride.targetSideLeft ?? (useLegacyTargets ? profile.targetSideLeft : null),
    targetSideRight: targetOverride.targetSideRight ?? (useLegacyTargets ? profile.targetSideRight : null),
    targetVariationPct: targetOverride.targetVariationPct ?? (useLegacyTargets ? profile.targetVariationPct : null),
    targetQualityCutoff: targetOverride.targetQualityCutoff ?? profile.targetQualityCutoff,
  };
}

function getPracticeMetricTarget(config: ClubPracticeConfig | undefined, metricId: string): number | null {
  const metric = config?.metrics.find((item) => item.id === metricId);
  return metric ? metricAverage(metric.targetMin, metric.targetMax) : null;
}

function getPracticeMetricRange(config: ClubPracticeConfig | undefined, metricId: string): { min: number | null; max: number | null } {
  const metric = config?.metrics.find((item) => item.id === metricId);
  if (!metric) return { min: null, max: null };
  const min = metric.targetMin !== null && Number.isFinite(metric.targetMin) ? metric.targetMin : null;
  const max = metric.targetMax !== null && Number.isFinite(metric.targetMax) ? metric.targetMax : null;
  return { min: min ?? max, max: max ?? min };
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
  carry: number | null;
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
    total: totals.length ? mean(totals) : null,
    carry: carries.length ? mean(carries) : null,
    mean: sides.length ? mean(sides) : null,
  };
}

function getPracticeConfigForProfile(practiceConfigs: ClubPracticeConfig[], profile: ShotProfile): ClubPracticeConfig | undefined {
  return practiceConfigs.find((config) => config.clubId === profile.id)
    ?? practiceConfigs.find((config) => config.clubId === profile.clubId);
}

function getMappedTotal(profile: ShotProfile, target: ProfileTarget, practiceConfigs: ClubPracticeConfig[]): number | null {
  const settings = getProfileTargetSettings(profile, target);
  if (settings.targetTotal !== null && settings.targetTotal !== undefined) return settings.targetTotal;
  return getPracticeMetricTarget(getPracticeConfigForProfile(practiceConfigs, profile), 'total_distance');
}

function getExplicitMappedTotal(profile: ShotProfile, target: ProfileTarget): number | null {
  const settings = getProfileTargetSettings(profile, target);
  return settings.targetTotal ?? null;
}

function getExplicitMappedCarry(profile: ShotProfile, target: ProfileTarget): number | null {
  const settings = getProfileTargetSettings(profile, target);
  return settings.targetCarry ?? null;
}

function getProfileTargetTotal(profile: ShotProfile | undefined): number | null {
  if (!profile) return null;
  return profile.targetOverrides.green?.targetTotal
    ?? profile.targetOverrides.fairway?.targetTotal
    ?? profile.targetTotal
    ?? null;
}

function makeMatrixProfile(clubId: string, shotType: string, power: MatrixPower): ShotProfile {
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

function getMappedCarry(profile: ShotProfile, target: ProfileTarget, practiceConfigs: ClubPracticeConfig[]): number | null {
  const settings = getProfileTargetSettings(profile, target);
  if (settings.targetCarry !== null && settings.targetCarry !== undefined) return settings.targetCarry;
  return getPracticeMetricTarget(getPracticeConfigForProfile(practiceConfigs, profile), 'carry');
}

function getMappedSide(profile: ShotProfile, target: ProfileTarget, practiceConfigs: ClubPracticeConfig[]): number | null {
  const settings = getProfileTargetSettings(profile, target);
  const configuredSide = Math.max(settings.targetSideLeft ?? 0, settings.targetSideRight ?? 0);
  if (configuredSide > 0) return configuredSide;
  return getPracticeMetricRange(getPracticeConfigForProfile(practiceConfigs, profile), 'avg_lateral_miss').max;
}

function isMatrixShotProfile(profile: ShotProfile): boolean {
  return WEDGE_SHOT_TYPES.includes(profile.shotType) && isMatrixPower(profile.power);
}

function isMatrixPower(power: string): power is MatrixPower {
  return MATRIX_POWER_COLUMNS.some((column) => column.id === power);
}

function getClubSortIndex(clubId: string): number {
  const index = MATRIX_CLUB_ORDER.indexOf(clubId);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getShotSortIndex(shotType: string): number {
  const index = WEDGE_SHOT_TYPES.indexOf(shotType);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function getMatrixRowDistance(row: WedgeMatrixRow): number {
  const full = row.cells.full?.total;
  const half = row.cells['9pm']?.total;
  const values = [full, half].filter((value): value is number => value !== null && value !== undefined);
  return values.length ? Math.max(...values) : Number.NEGATIVE_INFINITY;
}

function getMatrixCellPrimaryDistance(cell: WedgeMatrixCell | undefined, shotType: string): number | null {
  if (!cell) return null;
  if (shotType === 'pitch') return cell.carry ?? cell.total;
  return cell.total ?? cell.carry;
}

function compareMatrixRows(a: WedgeMatrixRow, b: WedgeMatrixRow, sortKey: MatrixSortKey): number {
  const byClub = getClubSortIndex(a.clubId) - getClubSortIndex(b.clubId)
    || a.clubName.localeCompare(b.clubName);
  const byShot = getShotSortIndex(a.shotType) - getShotSortIndex(b.shotType)
    || getShotTypeLabel(a.shotType).localeCompare(getShotTypeLabel(b.shotType));
  const byDistance = getMatrixRowDistance(b) - getMatrixRowDistance(a);

  if (sortKey === 'club') return byClub || byShot || byDistance;
  if (sortKey === 'shot') return byShot || byDistance || byClub;
  return byDistance || byClub || byShot;
}

function matchesProfileDistance(shot: Shot, profile: ShotProfile, mappedTotal: number | null): boolean {
  if (mappedTotal === null || !Number.isFinite(mappedTotal)) return true;
  const window = Math.max(8, mappedTotal * 0.18);
  return Math.abs(shot.target - mappedTotal) <= window || Math.abs(shot.total - mappedTotal) <= window;
}

function getProfileSamples(shots: Shot[], profile: ShotProfile, mappedTotal: number | null, lie?: LieOption): Shot[] {
  const clubShots = shots.filter((shot) => getClubConfigId(shot.club) === profile.clubId);
  const lieShots = lie ? clubShots.filter((shot) => matchesLie(shot, lie)) : clubShots;
  const mappedShots = lieShots.filter((shot) => matchesProfileDistance(shot, profile, mappedTotal));
  if (mappedShots.length >= 3) return mappedShots;
  if (lieShots.length >= 3) return lieShots;
  return clubShots.filter((shot) => matchesProfileDistance(shot, profile, mappedTotal));
}

function getMatrixProfileSamples(shots: Shot[], profile: ShotProfile, mappedTotal: number | null): Shot[] {
  if (mappedTotal === null) return [];
  return shots.filter((shot) =>
    getClubConfigId(shot.club) === profile.clubId &&
    matchesProfileDistance(shot, profile, mappedTotal)
  );
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

function getMatrixFullShotTargetTotal(
  clubId: string,
  profiles: Record<string, ShotProfile>,
  practiceConfigs: ClubPracticeConfig[],
  courseShots: Shot[],
  clubs: ClubConfig[],
): number | null {
  const savedTotal = getProfileTargetTotal(profiles[`${clubId}_full_full`]);
  if (savedTotal !== null) return savedTotal;

  const clubShots = courseShots.filter((shot) => getClubConfigId(shot.club) === clubId && Number.isFinite(shot.target));
  const highIntentTargets = clubShots
    .map((shot) => shot.target)
    .filter(Number.isFinite)
    .sort((a, b) => b - a);
  if (highIntentTargets.length) {
    const count = Math.max(1, Math.ceil(highIntentTargets.length * 0.25));
    return mean(highIntentTargets.slice(0, count));
  }

  const fullConfig = practiceConfigs.find((config) => config.clubId === `${clubId}_full_full`)
    ?? practiceConfigs.find((config) => config.clubId === clubId);
  return getPracticeMetricTarget(fullConfig, 'total_distance')
    ?? clubs.find((club) => club.id === clubId)?.stockDistance
    ?? null;
}

function getBumpFirmAnchor(clubId: string, fullTargetTotal: number): number {
  if (clubId === '8i') return 40;
  return fullTargetTotal * 0.4;
}

function getBumpTargets(clubId: string, fullTargetTotal: number | null): Array<{ power: MatrixPower; target: number }> {
  if (fullTargetTotal === null) return [];
  const firmAnchor = getBumpFirmAnchor(clubId, fullTargetTotal);
  return [
    { power: 'full', target: firmAnchor },
    { power: '9pm', target: firmAnchor * 0.5 },
  ];
}

function getPitchTargets(
  clubId: string,
  practiceSessions: PracticeSession[],
  shotsBySession: ShotsBySession,
  clubs: ClubConfig[],
): Array<{ power: MatrixPower; target: number }> {
  const fallbackFullTarget = clubId === 'gw'
    ? GAP_WEDGE_FULL_PITCH_TARGET
    : clubs.find((club) => club.id === clubId)?.stockDistance ?? null;
  const fullTarget = getRangeSessionTotalForProfile(`${clubId}_pitch_full`, practiceSessions, shotsBySession)
    ?? getRangeSessionTotalForProfile(`${clubId}_full_full`, practiceSessions, shotsBySession)
    ?? getRangeSessionTotalForProfile(clubId, practiceSessions, shotsBySession)
    ?? fallbackFullTarget;
  if (fullTarget === null) return [];

  const halfTarget = mean([
    getRangeSessionTotalForProfile(`${clubId}_pitch_9pm`, practiceSessions, shotsBySession),
    getRangeSessionTotalForProfile(`${clubId}_pitch_730pm`, practiceSessions, shotsBySession),
    getRangeSessionTotalForProfile(`${clubId}_pitch_10pm`, practiceSessions, shotsBySession),
  ].filter((value): value is number => value !== null)) || fullTarget * 0.5;

  return [
    { power: 'full', target: fullTarget },
    { power: '9pm', target: halfTarget },
  ];
}

function getChipTargets(clubId: string): Array<{ power: MatrixPower; target: number }> {
  const target = CHIP_TARGETS[clubId];
  if (!target) return [];
  return [
    { power: 'full', target: target.full },
    { power: '9pm', target: target.half },
  ];
}

function getMatrixMappedTotal(
  profile: ShotProfile,
  profiles: Record<string, ShotProfile>,
  practiceConfigs: ClubPracticeConfig[],
  practiceSessions: PracticeSession[],
  shotsBySession: ShotsBySession,
  courseShots: Shot[],
  clubs: ClubConfig[],
): number | null {
  const savedTotal = getExplicitMappedTotal(profile, 'green');
  if (savedTotal !== null) return savedTotal;

  if (profile.shotType === 'chip') {
    return getChipTargets(profile.clubId).find((option) => option.power === profile.power)?.target ?? null;
  }

  if (profile.shotType === 'pitch') {
    return getPitchTargets(profile.clubId, practiceSessions, shotsBySession, clubs)
      .find((option) => option.power === profile.power)?.target ?? null;
  }

  if (profile.shotType === 'bump') {
    const fullTargetTotal = getMatrixFullShotTargetTotal(profile.clubId, profiles, practiceConfigs, courseShots, clubs);
    return getBumpTargets(profile.clubId, fullTargetTotal)
      .find((option) => option.power === profile.power)?.target ?? null;
  }

  return getMappedTotal(profile, 'green', practiceConfigs);
}

function isSafeOutcome(shot: Shot): boolean {
  const endLie = shot.endLie.toLowerCase();
  return endLie.includes('fairway') || endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole');
}

function formatDistance(value: number | null): string {
  return value === null ? '-' : `${Math.round(value)}m`;
}

function getConfidenceClass(score: number): string {
  if (score >= 75) return 'bg-green-600 text-white';
  if (score >= 60) return 'bg-amber-500 text-white';
  if (score >= 45) return 'border-amber-500 text-amber-700';
  return 'border-red-500 text-red-700';
}

function getPercentDotClass(value: number | null): string {
  if (value === null) return 'border-muted bg-background';
  if (value >= 65) return 'border-green-600 bg-green-600';
  if (value >= 40) return 'border-amber-500 bg-amber-500';
  return 'border-red-600 bg-red-600';
}

function getComfortTileClass(value: number | null): string {
  if (value === null) return 'border-slate-200 bg-slate-50 text-slate-950';
  if (value >= 65) return 'border-emerald-300 bg-emerald-50 text-emerald-950';
  if (value >= 40) return 'border-amber-300 bg-amber-50 text-amber-950';
  return 'border-red-300 bg-red-50 text-red-950';
}

function getComfortLabel(value: number | null): string {
  if (value === null) return 'No read';
  if (value >= 65) return 'Comfort';
  if (value >= 40) return 'Workable';
  return 'Avoid';
}

function getSampleBadge(confidence: DataConfidence, count: number) {
  const label = `${count} ${count === 1 ? 'shot' : 'shots'}`;
  if (confidence === 'high') return <Badge className="bg-green-600">{label}</Badge>;
  if (confidence === 'medium') return <Badge className="bg-amber-500 text-white">{label}</Badge>;
  if (confidence === 'low') return <Badge variant="outline" className="border-amber-500 text-amber-700">{label}</Badge>;
  return <Badge variant="outline" className="border-red-500 text-red-700">{label}</Badge>;
}

function toggleTroubleSide(current: TroubleOption[], side: TroubleOption): TroubleOption[] {
  return current.includes(side)
    ? current.filter((item) => item !== side)
    : [...current, side];
}

function buildPointer(
  result: ClubRecommendation,
  target: TargetOption,
  trouble: TroubleOption[],
  mustCarry: boolean,
  clubAdjustmentDelta: number,
  directionNotes: string[],
): string {
  if (clubAdjustmentDelta !== 0 || directionNotes.length > 0) {
    return [
      clubAdjustmentDelta !== 0 ? getClubAdjustmentLabel(clubAdjustmentDelta) : null,
      ...directionNotes,
    ].filter(Boolean).join(' · ');
  }
  if (mustCarry && result.shortRisk > 30) return 'Take more club or choose a fuller swing; short is the main problem.';
  if (trouble.includes('left') && result.leftRisk > 25) return 'Commit to start line and avoid trying to turn this over.';
  if (trouble.includes('right') && result.rightRisk > 25) return 'Aim with room right; hold the face through impact.';
  if (trouble.includes('long') && result.longRisk > 25) return 'Take speed off only if that is a practiced shot; otherwise club down.';
  if (trouble.includes('short') && result.shortRisk > 25) return 'Favour enough club; the short miss is too expensive here.';
  if (target === 'fairway') return 'Pick a conservative start line and make the stock swing.';
  return 'Stock tempo, clear target, commit to the finish.';
}

function calculateRecommendations(
  gappingRows: GappingRow[],
  clubs: ClubConfig[],
  targetDistance: number,
  minimumSafeDistance: number | null,
  tolerancePct: number,
  lie: LieOption,
  clubAdjustmentDelta: number,
  directionNotes: string[],
  target: TargetOption,
  trouble: TroubleOption[],
  mustCarry: boolean,
): ClubRecommendation[] {
  if (!targetDistance || targetDistance <= 0) return [];

  return gappingRows
    .filter((row) => row.target === target)
    .filter((row) => row.displayTotal !== null)
    .map((row) => {
      const primaryProfile = row.profile;
      const club = clubs.find((item) => item.id === primaryProfile.clubId);
      if (!club || !canTargetDestination(club, target)) return null;

      const mappedTotal = row.displayTotal;
      const mappedSide = Math.max(row.displaySideLeft ?? 0, row.displaySideRight ?? 0) || null;
      const fallbackDistance = mappedTotal;
      const adjustedTargetDistance = targetDistance + clubAdjustmentDelta * SHOT_PICKER_CLUB_DELTA_METRES;
      const sideAdjustment = 0;
      if (Math.abs(fallbackDistance - adjustedTargetDistance) > 45) return null;

      const distanceWindow = 10;
      const minSafe = minimumSafeDistance && minimumSafeDistance > 0 ? minimumSafeDistance : null;
      const isSafeDistance = (shot: Shot) =>
        shot.total >= (minSafe ?? adjustedTargetDistance - distanceWindow) &&
        shot.total <= adjustedTargetDistance + distanceWindow;
      const isGoodDistance = (shot: Shot) => GOOD_SHOT_LEVELS.includes(shot.shotQuality) && isSafeDistance(shot);

      const sample = row.topQuartile.length ? row.topQuartile : row.sample;
      const sampleLabel = row.intentShotCount > 0 ? 'mapping' : row.rangeShotCount > 0 ? 'range' : 'club';

      const avgTotal = mappedTotal;
      const avgCarry = row.displayCarry;
      const avgSide = (row.sideBias ?? 0) + sideAdjustment;
      const sideBand = Math.max(5, mappedSide ?? club.acceptableSideBand);
      const distanceBand = Math.max(6, club.acceptableDistanceBand);
      const goodShotPct = sample.length
        ? (sample.filter((shot) => GOOD_SHOT_LEVELS.includes(shot.shotQuality)).length / sample.length) * 100
        : row.recentTargetPct ?? 45;

      const leftRisk = sample.length ? (sample.filter((shot) => (shot.side + sideAdjustment) < -sideBand).length / sample.length) * 100 : lie === 'uphill' ? 35 : 20;
      const rightRisk = sample.length ? (sample.filter((shot) => (shot.side + sideAdjustment) > sideBand).length / sample.length) * 100 : lie === 'downhill' ? 35 : 20;
      const shortRisk = sample.length
        ? (sample.filter((shot) => shot.total < adjustedTargetDistance - distanceBand).length / sample.length) * 100
        : avgTotal < adjustedTargetDistance ? 45 : 15;
      const longRisk = sample.length
        ? (sample.filter((shot) => shot.total > adjustedTargetDistance + distanceBand).length / sample.length) * 100
        : avgTotal > adjustedTargetDistance + distanceBand ? 35 : 15;

      const hitCount = sample.filter((shot) => isSafeDistance(shot) && matchesTargetDestination(shot, target)).length;
      const hitPct = sample.length ? (hitCount / sample.length) * 100 : 0;
      const goodDistanceCount = sample.filter(isGoodDistance).length;
      const goodDistancePct = sample.length ? (goodDistanceCount / sample.length) * 100 : row.recentTargetPct ?? 0;
      const toleranceDistance = adjustedTargetDistance * (tolerancePct / 100);
      const withinToleranceSample = uniqueShots(gappingRows
        .filter((otherRow) => otherRow.profile.id === row.profile.id)
        .flatMap((otherRow) => otherRow.sample));
      const withinToleranceCount = withinToleranceSample.filter((shot) => Math.abs(shot.total - adjustedTargetDistance) <= toleranceDistance).length;
      const withinTolerancePct = withinToleranceSample.length ? (withinToleranceCount / withinToleranceSample.length) * 100 : null;
      const nominatedShortPct = withinToleranceSample.length
        ? (withinToleranceSample.filter((shot) => shot.total < adjustedTargetDistance - toleranceDistance).length / withinToleranceSample.length) * 100
        : null;
      const nominatedLongPct = withinToleranceSample.length
        ? (withinToleranceSample.filter((shot) => shot.total > adjustedTargetDistance + toleranceDistance).length / withinToleranceSample.length) * 100
        : null;

      const distanceError = Math.abs(avgTotal - adjustedTargetDistance);
      const targetFit = clamp(100 - distanceError * (target === 'green' ? 3 : 2));
      const troublePenalty = trouble.reduce((total, side) => {
        if (side === 'left') return total + leftRisk;
        if (side === 'right') return total + rightRisk;
        if (side === 'short') return total + shortRisk;
        return total + longRisk;
      }, 0) / Math.max(1, trouble.length);
      const carryPenalty = mustCarry ? shortRisk * 0.7 : 0;
      const samplePenalty = sample.length >= 10 ? 0 : sample.length >= 5 ? 4 : sample.length >= 3 ? 8 : 14;
      const liePenalty = lie === 'roughRecovery' || clubAdjustmentDelta !== 0 ? 6 : 0;
      const missingOutcomePenalty = hitPct === 0 ? 18 : 0;
      const mappingConfidence = row.recentTargetPct ?? row.rangeConfidence ?? goodShotPct;
      const isShortOfTarget = target === 'green' && avgTotal < adjustedTargetDistance - 5;
      const carryFit = minimumSafeDistance && minimumSafeDistance > 0
        ? avgCarry !== null && avgCarry >= minimumSafeDistance
          ? 100
          : 0
        : 100;
      const troubleFit = clamp(100 - troublePenalty);
      const bestFitScore = Math.round(clamp(
        targetFit * 0.35 +
        (row.recentSafePct ?? 50) * 0.20 +
        mappingConfidence * 0.15 +
        (withinTolerancePct ?? 0) * 0.15 +
        troubleFit * 0.10 +
        carryFit * 0.05
      ));
      const confidence = Math.round(clamp(
        mappingConfidence * 0.34 +
        targetFit * 0.28 +
        goodDistancePct * 0.18 +
        goodShotPct * 0.08 +
        (100 - Math.min(leftRisk + rightRisk, 100)) * 0.06 +
        (100 - Math.min(shortRisk + longRisk, 100)) * 0.06 -
        troublePenalty * 0.35 -
        carryPenalty -
        samplePenalty -
        liePenalty -
        missingOutcomePenalty
      ));

      const badges: string[] = [];
      if (mustCarry && shortRisk > 25) badges.push('short carry risk');
      if (trouble.includes('left') && leftRisk > 20) badges.push('left risk');
      if (trouble.includes('right') && rightRisk > 20) badges.push('right risk');
      if (trouble.includes('long') && longRisk > 20) badges.push('long risk');
      if (trouble.includes('short') && shortRisk > 20) badges.push('short risk');
      if (minSafe) badges.push(`safe ${Math.round(minSafe)}m+`);
      if (hitPct === 0) badges.push(`no ${target} hits at number`);
      if (Math.abs(avgSide) > sideBand) badges.push(avgSide > 0 ? 'right bias' : 'left bias');
      if (clubAdjustmentDelta !== 0) badges.push(getClubAdjustmentLabel(clubAdjustmentDelta).toLowerCase());
      directionNotes.forEach((note) => badges.push(note.toLowerCase()));

      const result: ClubRecommendation = {
        clubId: club.id,
        clubName: club.clubName,
        profileId: primaryProfile.id,
        profileName: getShortProfileName(primaryProfile),
        shotType: getShotTypeLabel(primaryProfile.shotType),
        strength: getPowerLabel(primaryProfile.power),
        shotLabel: getSelectorShotLabel(primaryProfile),
        technique: primaryProfile.technique,
        routine: primaryProfile.routine,
        confidence,
        bestFitScore,
        targetFit: Math.round(targetFit),
        sampleCount: row.intentShotCount || row.rangeShotCount || sample.length,
        sampleLabel,
        dataConfidence: getDataConfidence(sample.length),
        avgTotal: mappedTotal ?? avgTotal,
        avgCarry,
        avgSide,
        shotConfidence: row.recentTargetPct,
        safetyConfidence: row.recentSafePct,
        withinTolerancePct,
        nominatedShortPct,
        nominatedLongPct,
        isShortOfTarget,
        leftRisk,
        rightRisk,
        shortRisk,
        longRisk,
        goodShotPct,
        hitPct,
        hitCount,
        goodDistancePct,
        badges,
        pointer: '',
      };

      result.pointer = buildPointer(result, target, trouble, mustCarry, clubAdjustmentDelta, directionNotes);
      return result;
    })
    .filter((result): result is ClubRecommendation => Boolean(result))
    .sort((a, b) => {
      const adjustedTargetDistance = targetDistance + clubAdjustmentDelta * SHOT_PICKER_CLUB_DELTA_METRES;
      const aDistance = Math.abs(a.avgTotal - adjustedTargetDistance);
      const bDistance = Math.abs(b.avgTotal - adjustedTargetDistance);
      return b.bestFitScore - a.bestFitScore || aDistance - bDistance;
    })
    .slice(0, 10);
}

function getDirectionNotes(rules: ShotPickerAdjustmentRule[]): string[] {
  return rules
    .filter((rule) => rule.direction !== 'none')
    .map((rule) => getDirectionAdjustmentLabel(rule));
}

export function ClubSelectorTab({
  defaultView = 'club-selector',
  singleView = false,
}: {
  defaultView?: 'club-selector' | 'wedge-matrix';
  singleView?: boolean;
} = {}) {
  const { shots, clubs, isLoading, gappingReliablePercent, shotPickerDistanceTolerancePct, shotPickerAdjustments } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const shotProfiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [targetDistance, setTargetDistance] = useState('120');
  const [minimumSafeDistance, setMinimumSafeDistance] = useState('');
  const [lie, setLie] = useState<LieOption>('fairway');
  const [slope, setSlope] = useState<SlopeOption>('flat');
  const [feet, setFeet] = useState<FeetOption>('level');
  const [target, setTarget] = useState<TargetOption>('green');
  const [trouble, setTrouble] = useState<TroubleOption[]>([]);
  const [mustCarry, setMustCarry] = useState(false);
  const [matrixSort, setMatrixSort] = useState<MatrixSortKey>('club');
  const [matrixLieContext, setMatrixLieContext] = useState<MatrixLieContext>('fairway');
  const numericTarget = Number(targetDistance);
  const numericMinimumSafe = minimumSafeDistance ? Number(minimumSafeDistance) : null;
  const numericDistanceTolerancePct = shotPickerDistanceTolerancePct > 0 ? shotPickerDistanceTolerancePct : 5;
  const selectedAdjustmentRules = [
    shotPickerAdjustments.lie[lie],
    shotPickerAdjustments.slope[slope],
    shotPickerAdjustments.feet[feet],
  ];
  const clubAdjustmentDelta = selectedAdjustmentRules.reduce((total, rule) => total + rule.clubDelta, 0);
  const directionNotes = getDirectionNotes(selectedAdjustmentRules);
  const effectiveTargetDistance = numericTarget + clubAdjustmentDelta * SHOT_PICKER_CLUB_DELTA_METRES;
  const selectorGappingRows = useMemo(() => buildClubGappingRows({
    profiles: shotProfiles,
    shots,
    shotContext: getSelectorShotContext(lie),
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingReliablePercent,
    shotCategoryOverrides: {},
    shotClassificationRules,
  }), [shotProfiles, shots, lie, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, shotClassificationRules]);
  const recommendations = useMemo(
    () => calculateRecommendations(selectorGappingRows, clubs, numericTarget, numericMinimumSafe, numericDistanceTolerancePct, lie, clubAdjustmentDelta, directionNotes, target, trouble, mustCarry),
    [selectorGappingRows, clubs, numericTarget, numericMinimumSafe, numericDistanceTolerancePct, lie, clubAdjustmentDelta, directionNotes, target, trouble, mustCarry],
  );

  const wedgeMatrix = useMemo<WedgeMatrixRow[]>(() => {
    const cells = buildClubGappingRows({
      profiles: shotProfiles,
      shots,
      shotContext: matrixLieContext,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      gappingReliablePercent,
      shotCategoryOverrides: {},
      shotClassificationRules,
    })
      .filter((row) => row.target === 'green')
      .filter((row) => isMatrixShotProfile(row.profile))
      .map<MatrixProfileResult>((row) => {
        const profile = row.profile;
        const club = clubs.find((item) => item.id === profile.clubId);
        return {
          clubId: profile.clubId,
          clubName: club?.clubName ?? profile.clubId.toUpperCase(),
          shotType: profile.shotType,
          power: profile.power as MatrixPower,
          cell: {
            profileId: profile.id,
            carry: row.displayCarry,
            total: row.displayTotal,
            last20TargetPct: row.recentTargetPct,
            actualShots: row.intentShotCount,
            rangeSessions: row.rangeShotCount,
            source: row.savedTarget.targetTotal !== undefined || row.savedTarget.targetCarry !== undefined
              ? 'gapping'
              : row.rangeShotCount > 0
                ? 'range'
                : row.intentShotCount > 0
                ? 'live'
                : 'mapping',
          },
        };
      });

    const rows = new Map<string, WedgeMatrixRow>();
    for (const item of cells) {
      const key = `${item.clubId}-${item.shotType}`;
      const row = rows.get(key) ?? {
        clubId: item.clubId,
        clubName: item.clubName,
        shotType: item.shotType,
        cells: {},
      };
      row.cells[item.power] = item.cell;
      rows.set(key, row);
    }

    return [...rows.values()].sort((a, b) => compareMatrixRows(a, b, matrixSort));
  }, [shots, clubs, practiceConfigs, practiceSessions, shotProfiles, shotsBySession, gappingReliablePercent, shotClassificationRules, matrixLieContext, matrixSort]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const matrixView = (
    <Card>
            <CardHeader>
              <CardTitle>Short Game Matrix</CardTitle>
              <CardDescription>
                Chip, pitch, and bump-and-run numbers from the same shot mapping used by Club Gapping.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-md border bg-muted/20 p-3 lg:grid-cols-[1fr_auto] lg:items-end">
                <ButtonGroup label="Lie">
                  {matrixLieOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={matrixLieContext === option.value ? 'default' : 'outline'}
                      onClick={() => setMatrixLieContext(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </ButtonGroup>
                <ButtonGroup label="Sort">
                  {[
                    { id: 'club', label: 'Club' },
                    { id: 'shot', label: 'Shot' },
                    { id: 'distance', label: 'Distance' },
                  ].map((option) => (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={matrixSort === option.id ? 'default' : 'outline'}
                      className="gap-2"
                      onClick={() => setMatrixSort(option.id as MatrixSortKey)}
                    >
                      <ArrowDownUp className="h-4 w-4" />
                      {option.label}
                    </Button>
                  ))}
                </ButtonGroup>
              </div>

              <div className="grid gap-3 md:hidden">
                {wedgeMatrix.map((row) => (
                  <MatrixMobileCard
                    key={`${row.clubId}-${row.shotType}`}
                    row={row}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-md border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[96px]">Club</TableHead>
                      <TableHead className="w-[88px]">Shot</TableHead>
                      {MATRIX_POWER_COLUMNS.map((column) => (
                        <TableHead key={column.id} className="min-w-[150px] text-center">
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {wedgeMatrix.map((row) => (
                      <TableRow key={`${row.clubId}-${row.shotType}`}>
                        <TableCell className="font-medium">{row.clubName}</TableCell>
                        <TableCell>{getShotTypeLabel(row.shotType)}</TableCell>
                        {MATRIX_POWER_COLUMNS.map((column) => (
                          <TableCell key={column.id} className="align-top">
                            <MatrixCell
                              cell={row.cells[column.id]}
                              shotType={row.shotType}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
  );

  const selectorView = (
    <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crosshair className="h-5 w-5" />
                  Shot Picker
                </CardTitle>
                <CardDescription>
                  Uses shot profile mapping, lie-filtered course samples, and the same mapped targets shown in Club Gapping.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="target-distance">Target distance (m)</Label>
                      <Input
                        id="target-distance"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="300"
                        value={targetDistance}
                        onChange={(event) => setTargetDistance(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="safe-distance">Minimum safe (m)</Label>
                      <Input
                        id="safe-distance"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="300"
                        value={minimumSafeDistance}
                        onChange={(event) => setMinimumSafeDistance(event.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <ButtonGroup label="Lie">
                      {lieOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={lie === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setLie(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </ButtonGroup>
                    <ButtonGroup label="Slope">
                      {slopeOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={slope === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSlope(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </ButtonGroup>
                    <ButtonGroup label="Feet">
                      {feetOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={feet === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setFeet(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </ButtonGroup>
                    <ButtonGroup label="Target">
                      {targetOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={target === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTarget(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <ButtonGroup label="Trouble side">
                    <Button
                      type="button"
                      variant={trouble.length === 0 ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTrouble([])}
                    >
                      None
                    </Button>
                    {troubleOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={trouble.includes(option.value) ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTrouble((current) => toggleTroubleSide(current, option.value))}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </ButtonGroup>
                  <div className="space-y-2">
                    <Label>Carry requirement</Label>
                    <Button
                      type="button"
                      variant={mustCarry ? 'default' : 'outline'}
                      size="sm"
                      className="w-full justify-start gap-2 lg:w-auto"
                      onClick={() => setMustCarry((value) => !value)}
                    >
                      <Flag className="h-4 w-4" />
                      Must carry
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <Metric label="Playing number" value={formatDistance(Number.isFinite(effectiveTargetDistance) ? effectiveTargetDistance : null)} />
                  <Metric label="Club adjustment" value={getClubAdjustmentLabel(clubAdjustmentDelta)} />
                  <Metric label="Target adjustment" value={directionNotes.length ? directionNotes.join(' · ') : 'Normal target'} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Recommended Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recommendations.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto mb-3 h-10 w-10 opacity-50" />
                    <p>No useful option found for this distance.</p>
                    <p className="mt-1 text-sm">Try a different target distance or add more mapping data.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendations.slice(0, 4).map((result, index) => (
                      <div key={result.profileId} className="space-y-3">
                        {index === 1 && (
                          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                            Other Options
                          </div>
                        )}
                        <div className="overflow-hidden rounded-md border">
                          <div className={`flex items-center justify-between gap-3 px-4 py-2 text-xs font-semibold uppercase tracking-wide ${index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                            <span>{index === 0 ? 'Best Option' : result.targetFit >= 70 ? 'Also Works' : result.isShortOfTarget ? 'Lay Up' : 'Option'}</span>
                            <span>Fit {result.bestFitScore}/100</span>
                          </div>
                          <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-0">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-semibold">{result.clubName}</span>
                                <Badge variant="outline">{result.shotLabel}</Badge>
                                {result.isShortOfTarget && <Badge variant="outline" className="border-amber-500 text-amber-700">Short</Badge>}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {result.isShortOfTarget
                                  ? `Lay up: this maps to ${formatDistance(result.avgTotal)}, short of ${formatDistance(effectiveTargetDistance)}.`
                                  : result.pointer}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-2 p-4 pb-0 text-sm sm:grid-cols-3">
                            <Metric label="Avg total" value={formatDistance(result.avgTotal)} />
                            <Metric label="Avg carry" value={formatDistance(result.avgCarry)} />
                            <Metric label="Direction bias" value={fmtSigned(result.avgSide)} />
                          </div>
                          <div className="grid gap-2 p-4 pt-2 text-sm sm:grid-cols-3">
                            <ConfidenceMetric label="Shot confidence" value={result.shotConfidence} />
                            <ConfidenceMetric label="Safety confidence" value={result.safetyConfidence} />
                            <Metric label={`Within ${numericDistanceTolerancePct}%`} value={fmtPct(result.withinTolerancePct)} />
                          </div>
                          <div className="grid gap-2 px-4 pb-4 text-sm sm:grid-cols-2">
                            <Metric label={`Short of ${formatDistance(effectiveTargetDistance)}`} value={fmtPct(result.nominatedShortPct)} />
                            <Metric label={`Long of ${formatDistance(effectiveTargetDistance)}`} value={fmtPct(result.nominatedLongPct)} />
                          </div>
                          {result.badges.length > 0 && (
                            <div className="flex flex-wrap gap-2 px-4 pb-4">
                              {result.badges.map((badge) => (
                                <Badge key={badge} variant="outline" className="gap-1">
                                  <ShieldAlert className="h-3 w-3" />
                                  {badge}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
  );

  if (singleView) {
    return (
      <div className="space-y-6">
        {defaultView === 'wedge-matrix' ? matrixView : selectorView}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue={defaultView} className="w-full">
        <TabsList className="mb-6 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="club-selector" className="shrink-0">Shot Picker</TabsTrigger>
          <TabsTrigger value="wedge-matrix" className="shrink-0">Short Game Matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="wedge-matrix">
          {matrixView}
        </TabsContent>

        <TabsContent value="club-selector">
          {selectorView}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ButtonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function ConfidenceMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-center font-medium">
        <span
          className={`block h-5 w-5 shrink-0 rounded-full border ${getPercentDotClass(value)}`}
          title={fmtPct(value)}
        />
      </div>
    </div>
  );
}

function MatrixMobileCard({ row }: { row: WedgeMatrixRow }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{row.clubName}</div>
          <div className="text-sm text-muted-foreground">{getShotTypeLabel(row.shotType)}</div>
        </div>
        <Badge variant="outline" className="shrink-0">{getShotTypeLabel(row.shotType)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MATRIX_POWER_COLUMNS.map((column) => (
          <MatrixMobileCell key={column.id} label={column.label} cell={row.cells[column.id]} shotType={row.shotType} />
        ))}
      </div>
    </div>
  );
}

function MatrixMobileCell({ label, cell, shotType }: { label: string; cell?: WedgeMatrixCell; shotType: string }) {
  if (!cell) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-center text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-2">-</div>
      </div>
    );
  }

  const primaryLabel = shotType === 'pitch' ? 'Carry' : 'Distance';
  const primaryValue = getMatrixCellPrimaryDistance(cell, shotType);
  const comfortClass = getComfortTileClass(cell.last20TargetPct);

  return (
    <div className={`rounded-md border p-3 ${comfortClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {getComfortLabel(cell.last20TargetPct)}
        </span>
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none">{formatDistance(primaryValue)}</div>
      <div className="mt-1 text-xs opacity-70">{primaryLabel}</div>
      <div className="mt-3 grid gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <span className="opacity-70">Distance</span>
          <span className="font-medium">{formatDistance(cell.total)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="opacity-70">Carry</span>
          <span className="font-medium">{formatDistance(cell.carry)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="opacity-70">L20 T</span>
          <span className="font-medium">{fmtPct(cell.last20TargetPct)}</span>
        </div>
      </div>
    </div>
  );
}

function MatrixCell({ cell, shotType }: { cell?: WedgeMatrixCell; shotType: string }) {
  if (!cell) {
    return <div className="rounded-md border bg-muted/20 p-2 text-center text-xs text-muted-foreground">-</div>;
  }

  const highlightTotal = shotType === 'bump' || shotType === 'chip';
  const highlightCarry = shotType === 'pitch';
  const primaryMetricClass = 'rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-emerald-950';

  return (
    <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2 text-xs">
      <div className={`min-w-0 ${highlightTotal ? primaryMetricClass : ''}`}>
        <div className="text-muted-foreground">Distance</div>
        <div className="font-semibold">{formatDistance(cell.total)}</div>
      </div>
      <div className={`min-w-0 ${highlightCarry ? primaryMetricClass : ''}`}>
        <div className="text-muted-foreground">Carry</div>
        <div className="font-semibold">{formatDistance(cell.carry)}</div>
      </div>
      <div className="min-w-0">
        <div className="text-muted-foreground">L20 T</div>
        <div className="flex items-center gap-1.5">
          <span
            className={`block h-3.5 w-3.5 shrink-0 rounded-full border ${getPercentDotClass(cell.last20TargetPct)}`}
            title={`Last 20 target ${fmtPct(cell.last20TargetPct)}`}
          />
          <span className="font-semibold">{fmtPct(cell.last20TargetPct)}</span>
        </div>
      </div>
    </div>
  );
}

function Pointer({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}
