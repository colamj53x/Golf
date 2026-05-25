import { useMemo, useState } from 'react';
import type React from 'react';
import { AlertCircle, Crosshair, Flag, ShieldAlert, Target, Wind } from 'lucide-react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getClubConfigId } from '@/lib/golfCalculations';
import { ShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { POWER_OPTIONS, SHOT_TYPES, parsePracticeConfigKey } from '@/types/practiceClubs';
import { ClubConfig, Shot } from '@/types/golf';

const GOOD_SHOT_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap'];
const WEDGE_IDS = ['pw', 'gw', 'sw', 'lw'];
const CLOCKS = [
  { id: 'full', label: 'Full' },
  { id: '9pm', label: '9 pm' },
  { id: '730pm', label: '7.30 pm' },
] as const;

type LieOption = 'tee' | 'fairway' | 'rough' | 'sand' | 'recovery' | 'awkward';
type TargetOption = 'green' | 'fairway';
type TroubleOption = 'left' | 'right' | 'short' | 'long';
type DataConfidence = 'high' | 'medium' | 'low' | 'very-low';

interface ClubRecommendation {
  clubId: string;
  clubName: string;
  profileName: string;
  technique: string;
  routine: string;
  confidence: number;
  targetFit: number;
  sampleCount: number;
  sampleLabel: string;
  dataConfidence: DataConfidence;
  avgTotal: number;
  avgSide: number;
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

interface WedgeMatrixRow {
  clubId: string;
  clubName: string;
  clock: string;
  actualCarry: number | null;
  actualTotal: number | null;
  actualShots: number;
  rangeCarry: number | null;
  rangeTotal: number | null;
  rangeSessions: number;
  confidence: number;
  source: string;
}

const lieOptions: Array<{ value: LieOption; label: string }> = [
  { value: 'tee', label: 'Tee' },
  { value: 'fairway', label: 'Fairway' },
  { value: 'rough', label: 'Rough' },
  { value: 'sand', label: 'Sand' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'awkward', label: 'Awkward/Stance' },
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
  if (lower.includes('rough')) return 'rough';
  if (lower.includes('sand') || lower.includes('bunker')) return 'sand';
  if (lower.includes('recovery') || lower.includes('tree') || lower.includes('punch')) return 'recovery';
  if (lower.includes('awkward') || lower.includes('slope') || lower.includes('stance')) return 'awkward';
  return lower;
}

function matchesLie(shot: Shot, lie: LieOption): boolean {
  return normalizeLie(shot.startLie || '').includes(lie);
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

function getEligibleProfiles(profiles: ShotProfile[], clubId: string, target: TargetOption): ShotProfile[] {
  return profiles.filter((profile) =>
    profile.clubId === clubId &&
    profile.enabled &&
    profile.showOnCourse &&
    profile.targets.includes(target)
  );
}

function getShortProfileName(profile: ShotProfile): string {
  const shot = SHOT_TYPES.find((item) => item.id === profile.shotType)?.name ?? profile.shotType;
  const power = POWER_OPTIONS.find((item) => item.id === profile.power)?.name ?? profile.power;
  return `${shot} / ${power}`;
}

function inferClock(shot: Shot): string {
  const text = `${shot.type} ${shot.notes}`.toLowerCase();
  if (text.includes('7.30') || text.includes('7:30') || text.includes('730')) return '730pm';
  if (text.includes('9pm') || text.includes('9 pm') || text.includes('9:00') || text.includes('9 o')) return '9pm';
  return 'full';
}

function metricAverage(valueMin: number | null, valueMax: number | null): number | null {
  if (valueMin !== null && valueMax !== null) return (valueMin + valueMax) / 2;
  return valueMin ?? valueMax;
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

function buildPointer(result: ClubRecommendation, target: TargetOption, trouble: TroubleOption[], mustCarry: boolean): string {
  if (mustCarry && result.shortRisk > 30) return 'Take more club or choose a fuller swing; short is the main problem.';
  if (trouble.includes('left') && result.leftRisk > 25) return 'Commit to start line and avoid trying to turn this over.';
  if (trouble.includes('right') && result.rightRisk > 25) return 'Aim with room right; hold the face through impact.';
  if (trouble.includes('long') && result.longRisk > 25) return 'Take speed off only if that is a practiced shot; otherwise club down.';
  if (trouble.includes('short') && result.shortRisk > 25) return 'Favour enough club; the short miss is too expensive here.';
  if (target === 'fairway') return 'Pick a conservative start line and make the stock swing.';
  return 'Stock tempo, clear target, commit to the finish.';
}

function calculateRecommendations(
  shots: Shot[],
  clubs: ClubConfig[],
  targetDistance: number,
  minimumSafeDistance: number | null,
  lie: LieOption,
  target: TargetOption,
  trouble: TroubleOption[],
  mustCarry: boolean,
  profiles: ShotProfile[],
): ClubRecommendation[] {
  if (!targetDistance || targetDistance <= 0) return [];

  return clubs
    .map((club) => {
      const eligibleProfiles = getEligibleProfiles(profiles, club.id, target);
      if (!canTargetDestination(club, target) || eligibleProfiles.length === 0) return null;
      const primaryProfile = eligibleProfiles[0];

      const clubShots = shots.filter((shot) => getClubConfigId(shot.club) === club.id);
      if (clubShots.length === 0 && Math.abs(club.stockDistance - targetDistance) > 35) return null;

      const distanceWindow = 10;
      const intentWindow = 20;
      const minSafe = minimumSafeDistance && minimumSafeDistance > 0 ? minimumSafeDistance : null;
      const isSafeDistance = (shot: Shot) =>
        shot.total >= (minSafe ?? targetDistance - distanceWindow) &&
        shot.total <= targetDistance + distanceWindow;
      const isGoodDistance = (shot: Shot) => GOOD_SHOT_LEVELS.includes(shot.shotQuality) && isSafeDistance(shot);

      const likelyTargetIntentShots = clubShots.filter((shot) =>
        Math.abs(shot.target - targetDistance) <= intentWindow &&
        (target === 'fairway' || club.distanceToTargetEnabled)
      );
      const scenarioShots = likelyTargetIntentShots.filter((shot) =>
        matchesLie(shot, lie)
      );
      const lieShots = clubShots.filter((shot) => matchesLie(shot, lie) && (target === 'fairway' || club.distanceToTargetEnabled));
      const sample = scenarioShots.length >= 3 ? scenarioShots : likelyTargetIntentShots.length >= 3 ? likelyTargetIntentShots : lieShots.length >= 3 ? lieShots : clubShots;
      const sampleLabel = scenarioShots.length >= 3 ? 'scenario' : likelyTargetIntentShots.length >= 3 ? 'distance' : lieShots.length >= 3 ? 'lie' : 'club';

      const avgTotal = sample.length ? mean(sample.map((shot) => shot.total || 0)) : club.stockDistance;
      const avgSide = sample.length ? mean(sample.map((shot) => shot.side || 0)) : 0;
      const sideBand = Math.max(5, club.acceptableSideBand);
      const distanceBand = Math.max(6, club.acceptableDistanceBand);
      const goodShotPct = sample.length
        ? (sample.filter((shot) => GOOD_SHOT_LEVELS.includes(shot.shotQuality)).length / sample.length) * 100
        : 45;

      const leftRisk = sample.length ? (sample.filter((shot) => shot.side < -sideBand).length / sample.length) * 100 : 20;
      const rightRisk = sample.length ? (sample.filter((shot) => shot.side > sideBand).length / sample.length) * 100 : 20;
      const shortRisk = sample.length
        ? (sample.filter((shot) => shot.total < targetDistance - distanceBand).length / sample.length) * 100
        : avgTotal < targetDistance ? 45 : 15;
      const longRisk = sample.length
        ? (sample.filter((shot) => shot.total > targetDistance + distanceBand).length / sample.length) * 100
        : avgTotal > targetDistance + distanceBand ? 35 : 15;

      const hitCount = sample.filter((shot) => isSafeDistance(shot) && matchesTargetDestination(shot, target)).length;
      const hitPct = sample.length ? (hitCount / sample.length) * 100 : 0;
      const goodDistanceCount = sample.filter(isGoodDistance).length;
      const goodDistancePct = sample.length ? (goodDistanceCount / sample.length) * 100 : 0;
      const goodShotDistanceAverage = sample.filter((shot) => GOOD_SHOT_LEVELS.includes(shot.shotQuality));
      const goodAvgTotal = goodShotDistanceAverage.length
        ? mean(goodShotDistanceAverage.map((shot) => shot.total || 0))
        : club.stockDistance;

      const distanceError = Math.abs(avgTotal - targetDistance);
      const goodDistanceError = Math.abs(goodAvgTotal - targetDistance);
      const targetFit = clamp((100 - distanceError * (target === 'green' ? 3 : 2)) * 0.35 + (100 - goodDistanceError * 4) * 0.65);
      const troublePenalty = trouble.reduce((total, side) => {
        if (side === 'left') return total + leftRisk;
        if (side === 'right') return total + rightRisk;
        if (side === 'short') return total + shortRisk;
        return total + longRisk;
      }, 0) / Math.max(1, trouble.length);
      const carryPenalty = mustCarry ? shortRisk * 0.7 : 0;
      const samplePenalty = sample.length >= 10 ? 0 : sample.length >= 5 ? 4 : sample.length >= 3 ? 8 : 14;
      const liePenalty = lie === 'sand' || lie === 'recovery' || lie === 'awkward' ? 6 : 0;
      const missingOutcomePenalty = hitPct === 0 ? 18 : 0;
      const confidence = Math.round(clamp(
        hitPct * 0.34 +
        targetFit * 0.24 +
        goodDistancePct * 0.18 +
        goodShotPct * 0.12 +
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
      if (sampleLabel !== 'scenario') badges.push(`${sampleLabel} data`);

      const result: ClubRecommendation = {
        clubId: club.id,
        clubName: club.clubName,
        profileName: getShortProfileName(primaryProfile),
        technique: primaryProfile.technique,
        routine: primaryProfile.routine,
        confidence,
        targetFit: Math.round(targetFit),
        sampleCount: sample.length,
        sampleLabel,
        dataConfidence: getDataConfidence(sample.length),
        avgTotal,
        avgSide,
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

      result.pointer = buildPointer(result, target, trouble, mustCarry);
      return result;
    })
    .filter((result): result is ClubRecommendation => Boolean(result))
    .filter((result) => result.confidence >= 25)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

export function ClubSelectorTab() {
  const { shots, clubs, isLoading } = useGolfData();
  const { practiceSessions } = usePracticeData();
  const shotProfiles = useShotProfiles();
  const [targetDistance, setTargetDistance] = useState('120');
  const [minimumSafeDistance, setMinimumSafeDistance] = useState('');
  const [lie, setLie] = useState<LieOption>('fairway');
  const [target, setTarget] = useState<TargetOption>('green');
  const [trouble, setTrouble] = useState<TroubleOption[]>([]);
  const [mustCarry, setMustCarry] = useState(false);

  const numericTarget = Number(targetDistance);
  const numericMinimumSafe = minimumSafeDistance ? Number(minimumSafeDistance) : null;
  const recommendations = useMemo(
    () => calculateRecommendations(shots, clubs, numericTarget, numericMinimumSafe, lie, target, trouble, mustCarry, Object.values(shotProfiles)),
    [shots, clubs, numericTarget, numericMinimumSafe, lie, target, trouble, mustCarry, shotProfiles],
  );

  const wedgeMatrix = useMemo<WedgeMatrixRow[]>(() => {
    return WEDGE_IDS.flatMap((clubId) => {
      const club = clubs.find((item) => item.id === clubId);
      if (!club) return [];

      return CLOCKS.map((clock) => {
        const actualShots = shots.filter((shot) => getClubConfigId(shot.club) === clubId && inferClock(shot) === clock.id);
        const practice = practiceSessions.filter((session) => {
          const parsed = parsePracticeConfigKey(session.clubId);
          return parsed.club === clubId && parsed.power === clock.id;
        });

        const practiceCarry = practice
          .map((session) => session.metrics.find((metric) => metric.metricId === 'carry'))
          .filter(Boolean)
          .map((metric) => metricAverage(metric!.valueMin, metric!.valueMax))
          .filter((value): value is number => value !== null);
        const practiceTotal = practice
          .map((session) => session.metrics.find((metric) => metric.metricId === 'total_distance'))
          .filter(Boolean)
          .map((metric) => metricAverage(metric!.valueMin, metric!.valueMax))
          .filter((value): value is number => value !== null);

        const actualTotal = actualShots.length ? mean(actualShots.map((shot) => shot.total || 0)) : null;
        const actualCarry = null;
        const rangeCarry = practiceCarry.length ? mean(practiceCarry) : null;
        const rangeTotal = practiceTotal.length ? mean(practiceTotal) : rangeCarry;
        const confidence = Math.round(clamp(
          (actualShots.length ? 45 : 0) +
          (practice.length ? 35 : 0) +
          Math.min(actualShots.length, 10) * 1.5 +
          Math.min(practice.length, 5) * 1.5,
          0,
          100,
        ));

        return {
          clubId,
          clubName: club.clubName,
          clock: clock.label,
          actualCarry,
          actualTotal,
          actualShots: actualShots.length,
          rangeCarry,
          rangeTotal,
          rangeSessions: practice.length,
          confidence,
          source: actualShots.length && practice.length ? 'actual + range' : actualShots.length ? 'actual' : practice.length ? 'range' : 'setup',
        };
      });
    });
  }, [shots, clubs, practiceSessions]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            On Course Club Options
          </CardTitle>
          <CardDescription>
            Button-driven club advice for the intended target, ranked by confidence and visible risk.
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
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Recommended Options
            </CardTitle>
            <CardDescription>
              Uses exact scenario data where possible, then lie or club history when sample size is thin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recommendations.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p>No useful option found for this distance.</p>
                <p className="mt-1 text-sm">Try a different target distance or add more shot data.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.slice(0, 4).map((result, index) => (
                  <div key={result.clubId} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold">{result.clubName}</span>
                          <Badge variant="outline">{result.profileName}</Badge>
                          {index === 0 && <Badge>Best</Badge>}
                          <Badge variant={result.confidence >= 60 ? 'default' : 'outline'} className={getConfidenceClass(result.confidence)}>
                            {result.confidence}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{result.pointer}</p>
                      </div>
                      {getSampleBadge(result.dataConfidence, result.sampleCount)}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                      <Metric label="Avg total" value={formatDistance(result.avgTotal)} />
                      <Metric label={`${target} hits`} value={`${Math.round(result.hitPct)}% (${result.hitCount})`} />
                      <Metric label="Good distance" value={`${Math.round(result.goodDistancePct)}%`} />
                      <Metric label="Bias" value={`${Math.round(Math.abs(result.avgSide))}m ${result.avgSide > 0 ? 'R' : result.avgSide < 0 ? 'L' : ''}`} />
                    </div>
                    {result.badges.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.badges.map((badge) => (
                          <Badge key={badge} variant="outline" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            {badge}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(result.technique || result.routine) && (
                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                        {result.technique && <Metric label="Technique" value={result.technique} />}
                        {result.routine && <Metric label="Routine" value={result.routine} />}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wind className="h-5 w-5" />
              Generic Technique Pointers
            </CardTitle>
            <CardDescription>Placeholder cues until shot-specific technique rules are added.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Pointer title="Normal approach" text="Choose the club first, then make the stock swing. Avoid inventing a new shot on the course." />
            <Pointer title="Must carry" text="Favour enough club. A committed three-quarter swing beats a forced perfect number." />
            <Pointer title="Trouble left/right" text="Aim for the centre of the safe half and keep the finish balanced." />
            <Pointer title="Wedge" text="Use the clock feel, land it on a spot, and accept the known carry window." />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wedge Matrix</CardTitle>
          <CardDescription>
            First-pass clock matrix using actual shots plus range/practice sessions where the data exists.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Clock</TableHead>
                <TableHead className="text-right">Actual Carry</TableHead>
                <TableHead className="text-right">Actual Total</TableHead>
                <TableHead className="text-right">Range Carry</TableHead>
                <TableHead className="text-right">Range Total</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wedgeMatrix.map((row) => (
                <TableRow key={`${row.clubId}-${row.clock}`}>
                  <TableCell className="font-medium">{row.clubName}</TableCell>
                  <TableCell>{row.clock}</TableCell>
                  <TableCell className="text-right">{formatDistance(row.actualCarry)}</TableCell>
                  <TableCell className="text-right">{formatDistance(row.actualTotal)}</TableCell>
                  <TableCell className="text-right">{formatDistance(row.rangeCarry)}</TableCell>
                  <TableCell className="text-right">{formatDistance(row.rangeTotal)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={row.confidence >= 60 ? 'default' : 'outline'} className={getConfidenceClass(row.confidence)}>
                      {row.confidence}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {row.source}
                      {row.actualShots > 0 && ` · ${row.actualShots} actual`}
                      {row.rangeSessions > 0 && ` · ${row.rangeSessions} range`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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

function Pointer({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="font-medium">{title}</div>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  );
}
