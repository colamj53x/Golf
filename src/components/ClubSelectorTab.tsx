import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { AlertCircle, ArrowDownUp, BookOpen, Crosshair, ShieldAlert, Target, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
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
import { cueIdForConfig, shotCueLink } from '@/lib/shotCues';

const GOOD_SHOT_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap'];
const GAP_WEDGE_FULL_PITCH_TARGET = 70;
const CHIP_TARGETS: Record<string, { full: number; half: number }> = {
  pw: { full: 34, half: 18 },
  gw: { full: 19, half: 10 },
};
const WEDGE_SHOT_TYPES = ['pitch', 'chip', 'bump', 'punch'];
const AIR_SHOT_TYPES = ['pitch'];
const GROUND_SHOT_TYPES = ['chip', 'bump', 'punch'];
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
type DataConfidence = 'high' | 'medium' | 'low' | 'very-low';
type MatrixPower = typeof MATRIX_POWER_COLUMNS[number]['id'];
type MatrixSortKey = 'club' | 'shot' | 'distance';
type MatrixLieContext = Extract<ShotContext, 'fairway' | 'roughRecovery'>;
type MatrixShotMode = 'air' | 'ground';

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

function getMatrixShotTypeLabel(shotType: string): string {
  return shotType === 'bump' ? 'Bump / run' : getShotTypeLabel(shotType);
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

function getPercentDotClass(value: number | null, greenThreshold = 65, amberThreshold = 40): string {
  if (value === null) return 'border-muted bg-background';
  if (value >= greenThreshold) return 'border-green-600 bg-green-600';
  if (value >= amberThreshold) return 'border-amber-500 bg-amber-500';
  return 'border-red-600 bg-red-600';
}

function getComfortTileClass(value: number | null, greenThreshold = 65, amberThreshold = 40): string {
  if (value === null) return 'border-slate-200 bg-slate-50 text-slate-950';
  if (value >= greenThreshold) return 'border-emerald-300 bg-emerald-50 text-emerald-950';
  if (value >= amberThreshold) return 'border-amber-300 bg-amber-50 text-amber-950';
  return 'border-red-300 bg-red-50 text-red-950';
}

function getComfortLabel(value: number | null, greenThreshold = 65, amberThreshold = 40): string {
  if (value === null) return 'No read';
  if (value >= greenThreshold) return 'Comfort';
  if (value >= amberThreshold) return 'Workable';
  return 'Avoid';
}

function getSampleBadge(confidence: DataConfidence, count: number) {
  const label = `${count} ${count === 1 ? 'shot' : 'shots'}`;
  if (confidence === 'high') return <Badge className="bg-green-600">{label}</Badge>;
  if (confidence === 'medium') return <Badge className="bg-amber-500 text-white">{label}</Badge>;
  if (confidence === 'low') return <Badge variant="outline" className="border-amber-500 text-amber-700">{label}</Badge>;
  return <Badge variant="outline" className="border-red-500 text-red-700">{label}</Badge>;
}

function calculateRecommendations(
  gappingRows: GappingRow[],
  clubs: ClubConfig[],
  targetDistance: number,
  minimumCarryDistance: number | null,
  tolerancePct: number,
  lie: LieOption,
  clubAdjustmentDelta: number,
  directionNotes: string[],
  target: TargetOption,
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
      const minimumCarry = minimumCarryDistance && minimumCarryDistance > 0 ? minimumCarryDistance : null;
      const meetsCarryRequirement = (shot: Shot) => minimumCarry === null || shot.carry >= minimumCarry;
      const isSafeDistance = (shot: Shot) =>
        shot.total >= adjustedTargetDistance - distanceWindow &&
        shot.total <= adjustedTargetDistance + distanceWindow &&
        meetsCarryRequirement(shot);
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
      const carryPenalty = minimumCarry !== null && (avgCarry === null || avgCarry < minimumCarry) ? 25 : 0;
      const samplePenalty = sample.length >= 10 ? 0 : sample.length >= 5 ? 4 : sample.length >= 3 ? 8 : 14;
      const liePenalty = lie === 'roughRecovery' || clubAdjustmentDelta !== 0 ? 6 : 0;
      const missingOutcomePenalty = hitPct === 0 ? 18 : 0;
      const mappingConfidence = row.recentTargetPct ?? row.rangeConfidence ?? goodShotPct;
      const isShortOfTarget = target === 'green' && avgTotal < adjustedTargetDistance - 5;
      const carryFit = minimumCarryDistance && minimumCarryDistance > 0
        ? avgCarry !== null && avgCarry >= minimumCarryDistance
          ? 100
          : 0
        : 100;
      const directionalFit = clamp(100 - Math.max(leftRisk, rightRisk));
      const carryFailurePenalty = minimumCarry !== null && carryFit === 0 ? 35 : 0;
      const bestFitScore = Math.round(clamp(
        targetFit * 0.35 +
        (row.recentSafePct ?? 50) * 0.20 +
        mappingConfidence * 0.15 +
        (withinTolerancePct ?? 0) * 0.15 +
        directionalFit * 0.10 +
        carryFit * 0.05 -
        carryFailurePenalty
      ));
      const confidence = Math.round(clamp(
        mappingConfidence * 0.34 +
        targetFit * 0.28 +
        goodDistancePct * 0.18 +
        goodShotPct * 0.08 +
        (100 - Math.min(leftRisk + rightRisk, 100)) * 0.06 +
        (100 - Math.min(shortRisk + longRisk, 100)) * 0.06 -
        carryPenalty -
        samplePenalty -
        liePenalty -
        missingOutcomePenalty
      ));

      const badges: string[] = [];
      if (minimumCarry) badges.push(avgCarry !== null && avgCarry >= minimumCarry
        ? `carries ${Math.round(minimumCarry)}m+`
        : `below ${Math.round(minimumCarry)}m carry`);
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
      };

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
  const {
    shots,
    clubs,
    isLoading,
    gappingReliablePercent,
    gappingGreenThreshold,
    gappingAmberThreshold,
    shotPickerDistanceTolerancePct,
    shotPickerAdjustments,
  } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const shotProfiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [targetDistance, setTargetDistance] = useState('120');
  const [minimumCarryDistance, setMinimumCarryDistance] = useState('');
  const [lie, setLie] = useState<LieOption>('fairway');
  const [slope, setSlope] = useState<SlopeOption>('flat');
  const [feet, setFeet] = useState<FeetOption>('level');
  const [target, setTarget] = useState<TargetOption>('green');
  const [matrixSort, setMatrixSort] = useState<MatrixSortKey>('club');
  const [matrixLieContext, setMatrixLieContext] = useState<MatrixLieContext>('fairway');
  const [matrixShotMode, setMatrixShotMode] = useState<MatrixShotMode>('air');
  const numericTarget = Number(targetDistance);
  const numericMinimumCarry = minimumCarryDistance ? Number(minimumCarryDistance) : null;
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
    () => calculateRecommendations(selectorGappingRows, clubs, numericTarget, numericMinimumCarry, numericDistanceTolerancePct, lie, clubAdjustmentDelta, directionNotes, target),
    [selectorGappingRows, clubs, numericTarget, numericMinimumCarry, numericDistanceTolerancePct, lie, clubAdjustmentDelta, directionNotes, target],
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
  const visibleWedgeMatrix = useMemo(() => wedgeMatrix.filter((row) => (
    matrixShotMode === 'air'
      ? AIR_SHOT_TYPES.includes(row.shotType)
      : GROUND_SHOT_TYPES.includes(row.shotType)
  )), [matrixShotMode, wedgeMatrix]);

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
                Carry-first air shots and release-first ground shots from the same mapping used by Club Gapping.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="inline-flex w-full rounded-lg border bg-muted/30 p-1 sm:w-auto" aria-label="Short game shot style">
                {([
                  { id: 'air', label: 'Air shot' },
                  { id: 'ground', label: 'Ground shot' },
                ] as const).map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={matrixShotMode === option.id ? 'default' : 'ghost'}
                    className="min-h-11 flex-1 px-6 sm:flex-none"
                    onClick={() => setMatrixShotMode(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
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
                    { id: 'distance', label: 'Total' },
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
                {visibleWedgeMatrix.map((row) => (
                  <MatrixMobileCard
                    key={`${row.clubId}-${row.shotType}`}
                    row={row}
                    greenThreshold={gappingGreenThreshold}
                    amberThreshold={gappingAmberThreshold}
                  />
                ))}
                {visibleWedgeMatrix.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No {matrixShotMode === 'air' ? 'air-shot' : 'ground-shot'} mapping is available yet.
                  </div>
                )}
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
                    {visibleWedgeMatrix.map((row) => (
                      <TableRow key={`${row.clubId}-${row.shotType}`}>
                        <TableCell className="font-medium">{row.clubName}</TableCell>
                        <TableCell>{getMatrixShotTypeLabel(row.shotType)}</TableCell>
                        {MATRIX_POWER_COLUMNS.map((column) => (
                          <TableCell key={column.id} className="align-top">
                            <MatrixCell
                              cell={row.cells[column.id]}
                              shotType={row.shotType}
                              greenThreshold={gappingGreenThreshold}
                              amberThreshold={gappingAmberThreshold}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {visibleWedgeMatrix.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          No {matrixShotMode === 'air' ? 'air-shot' : 'ground-shot'} mapping is available yet.
                        </TableCell>
                      </TableRow>
                    )}
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
                <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                  <div className="grid content-start gap-4 rounded-lg border bg-muted/20 p-4">
                    <div className="space-y-2">
                      <Label htmlFor="target-distance">Playing distance</Label>
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
                      <Label htmlFor="minimum-carry-distance">Need to carry at least</Label>
                      <Input
                        id="minimum-carry-distance"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="300"
                        value={minimumCarryDistance}
                        onChange={(event) => setMinimumCarryDistance(event.target.value)}
                        placeholder="Optional metres"
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

                <div className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <Metric label="Playing distance" value={formatDistance(Number.isFinite(effectiveTargetDistance) ? effectiveTargetDistance : null)} />
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
                  <div className="space-y-5">
                    <RecommendationOptionCard
                      result={recommendations[0]}
                      primary
                      playingDistance={effectiveTargetDistance}
                      minimumCarry={numericMinimumCarry}
                      tolerancePct={numericDistanceTolerancePct}
                    />
                    {recommendations.length > 1 && (
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Other options</div>
                        {recommendations.slice(1, 4).map((result) => (
                          <RecommendationOptionCard
                            key={result.profileId}
                            result={result}
                            playingDistance={effectiveTargetDistance}
                            minimumCarry={numericMinimumCarry}
                            tolerancePct={numericDistanceTolerancePct}
                          />
                        ))}
                      </div>
                    )}
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

function getRecommendationReason(
  result: ClubRecommendation,
  primary: boolean,
  minimumCarry: number | null,
): string {
  if (minimumCarry && (result.avgCarry === null || result.avgCarry < minimumCarry)) {
    return 'Too short to be a realistic option.';
  }
  if (primary && result.isShortOfTarget) return 'Likely short, but safest playable option.';
  if (primary) return 'Best overall fit for this shot.';
  if (result.longRisk >= 35 && result.targetFit >= 55) return 'Closer to the number, but higher long risk.';
  if (Math.max(result.leftRisk, result.rightRisk) >= 30) return 'Direction pattern makes this a riskier option.';
  if (result.isShortOfTarget || result.targetFit < 50) return 'Too short to be a realistic option.';
  return 'A playable alternative with a lower overall fit.';
}

function RecommendationOptionCard({
  result,
  primary = false,
  playingDistance,
  minimumCarry,
  tolerancePct,
}: {
  result: ClubRecommendation;
  primary?: boolean;
  playingDistance: number;
  minimumCarry: number | null;
  tolerancePct: number;
}) {
  const reason = getRecommendationReason(result, primary, minimumCarry);
  const roll = result.avgCarry === null ? null : Math.max(0, result.avgTotal - result.avgCarry);

  return (
    <div className={`overflow-hidden rounded-xl border bg-card ${primary ? 'border-2 border-primary shadow-md' : ''}`}>
      <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {primary ? 'Primary recommendation' : result.targetFit >= 70 ? 'Strong alternative' : result.isShortOfTarget ? 'Lay-up option' : 'Secondary option'}
      </div>
      <div className={`space-y-4 ${primary ? 'p-5 sm:p-6' : 'p-4'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`font-bold tracking-tight ${primary ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{result.clubName}</h3>
              <Badge variant="outline" className={primary ? 'text-sm' : ''}>{result.shotLabel}</Badge>
              {result.isShortOfTarget && <Badge variant="outline" className="border-amber-500 text-amber-700">Short</Badge>}
            </div>
          </div>
          <div className={`rounded-lg text-center ${primary ? 'bg-primary px-5 py-3 text-primary-foreground shadow-sm' : 'border bg-muted/40 px-4 py-2'}`}>
            <div className={`font-semibold uppercase tracking-wide ${primary ? 'text-xs opacity-85' : 'text-[10px] text-muted-foreground'}`}>Fit Score</div>
            <div className={`font-bold leading-none ${primary ? 'mt-1 text-3xl' : 'mt-1 text-xl'}`}>{result.bestFitScore}<span className="text-sm font-medium opacity-70">/100</span></div>
          </div>
        </div>

        <p className={`font-semibold leading-snug ${primary ? 'text-base text-foreground sm:text-lg' : 'text-sm text-foreground'}`}>{reason}</p>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <Metric label="Carry" value={formatDistance(result.avgCarry)} prominent={primary} />
          <Metric label="Roll" value={formatDistance(roll)} prominent={primary} />
          <Metric label="Total" value={formatDistance(result.avgTotal)} prominent={primary} />
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-4">
          <Metric label="Typical miss" value={fmtSigned(result.avgSide)} />
          <ConfidenceMetric label="Shot confidence" value={result.shotConfidence} />
          <ConfidenceMetric label="Safety confidence" value={result.safetyConfidence} />
          <Metric label={`Within ${tolerancePct}%`} value={fmtPct(result.withinTolerancePct)} />
        </div>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <Metric label={`Short of ${formatDistance(playingDistance)}`} value={fmtPct(result.nominatedShortPct)} />
          <Metric label={`Long of ${formatDistance(playingDistance)}`} value={fmtPct(result.nominatedLongPct)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {result.badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {result.badges.map((badge) => (
                <Badge key={badge} variant="outline" className="gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  {badge}
                </Badge>
              ))}
            </div>
          ) : <span />}
          {cueIdForConfig(result.profileId) && (
            <Button asChild type="button" size="sm" variant={primary ? 'default' : 'outline'} className="min-h-10 gap-1.5">
              <Link to={shotCueLink(result.profileId)}><BookOpen className="h-4 w-4" />View cue</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold ${prominent ? 'text-xl sm:text-2xl' : ''}`}>{value}</div>
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

function MatrixMobileCard({
  row,
  greenThreshold,
  amberThreshold,
}: {
  row: WedgeMatrixRow;
  greenThreshold: number;
  amberThreshold: number;
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{row.clubName}</div>
          <div className="text-sm text-muted-foreground">{getMatrixShotTypeLabel(row.shotType)}</div>
        </div>
        <Badge variant="outline" className="shrink-0">{getMatrixShotTypeLabel(row.shotType)}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MATRIX_POWER_COLUMNS.map((column) => (
          <MatrixMobileCell
            key={column.id}
            label={column.label}
            cell={row.cells[column.id]}
            shotType={row.shotType}
            greenThreshold={greenThreshold}
            amberThreshold={amberThreshold}
          />
        ))}
      </div>
    </div>
  );
}

function MatrixMobileCell({
  label,
  cell,
  shotType,
  greenThreshold,
  amberThreshold,
}: {
  label: string;
  cell?: WedgeMatrixCell;
  shotType: string;
  greenThreshold: number;
  amberThreshold: number;
}) {
  if (!cell) {
    return (
      <div className="rounded-md border bg-muted/20 p-3 text-center text-sm text-muted-foreground">
        <div className="font-medium text-foreground">{label}</div>
        <div className="mt-2">-</div>
      </div>
    );
  }

  const primaryLabel = shotType === 'pitch' ? 'Carry' : 'Total';
  const primaryValue = getMatrixCellPrimaryDistance(cell, shotType);
  const comfortClass = getComfortTileClass(cell.last20TargetPct, greenThreshold, amberThreshold);

  return (
    <div className={`rounded-md border p-3 ${comfortClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
          {getComfortLabel(cell.last20TargetPct, greenThreshold, amberThreshold)}
        </span>
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none">{formatDistance(primaryValue)}</div>
      <div className="mt-1 text-xs opacity-70">{primaryLabel}</div>
      <div className="mt-3 grid gap-1 text-xs">
        <div className="flex justify-between gap-2">
          <span className="opacity-70">Total</span>
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
      {cueIdForConfig(cell.profileId) && <Button asChild size="sm" variant="ghost" className="mt-2 h-7 w-full gap-1 text-xs"><Link to={shotCueLink(cell.profileId)}><BookOpen className="h-3 w-3" />View cue</Link></Button>}
    </div>
  );
}

function MatrixCell({
  cell,
  shotType,
  greenThreshold,
  amberThreshold,
}: {
  cell?: WedgeMatrixCell;
  shotType: string;
  greenThreshold: number;
  amberThreshold: number;
}) {
  if (!cell) {
    return <div className="rounded-md border bg-muted/20 p-2 text-center text-xs text-muted-foreground">-</div>;
  }

  const highlightTotal = shotType === 'bump' || shotType === 'chip' || shotType === 'punch';
  const highlightCarry = shotType === 'pitch';
  const primaryMetricClass = 'rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1 text-emerald-950';

  return (
    <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2 text-xs">
      <div className={`min-w-0 ${highlightTotal ? primaryMetricClass : ''}`}>
        <div className="text-muted-foreground">Total</div>
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
            className={`block h-3.5 w-3.5 shrink-0 rounded-full border ${getPercentDotClass(cell.last20TargetPct, greenThreshold, amberThreshold)}`}
            title={`Last 20 target ${fmtPct(cell.last20TargetPct)}`}
          />
          <span className="font-semibold">{fmtPct(cell.last20TargetPct)}</span>
        </div>
      </div>
      {cueIdForConfig(cell.profileId) && <Button asChild size="sm" variant="ghost" className="col-span-3 h-7 gap-1 text-xs"><Link to={shotCueLink(cell.profileId)}><BookOpen className="h-3 w-3" />View cue</Link></Button>}
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
