import { useMemo } from 'react';
import { Gauge, RotateCcw, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { getClubConfigId, getShotDateKey } from '@/lib/golfCalculations';
import { getProfileDisplayName, ProfileTarget, ShotProfile, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { Shot } from '@/types/golf';
import { PracticeSession } from '@/types/practice';

const QUALITY_VALUES: Record<string, number> = {
  Pro: -5,
  'Elite Am': -2,
  '0 Handicap': 0,
  '5 Handicap': 5,
  '10 Handicap': 10,
  '15 Handicap': 15,
  '20 Handicap': 20,
  '25 Handicap': 25,
};

interface GappingRow {
  profile: ShotProfile;
  target: ProfileTarget;
  sample: Shot[];
  topQuartile: Shot[];
  liveTotal: number | null;
  liveCarry: number | null;
  totalMin: number | null;
  totalMax: number | null;
  sideLeft: number | null;
  sideRight: number | null;
  sideBias: number | null;
  handicap: number | null;
  last3TargetPct: number | null;
  rangeConfidence: number | null;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function metricAverage(valueMin: number | null, valueMax: number | null): number | null {
  if (valueMin !== null && valueMax !== null) return (valueMin + valueMax) / 2;
  return valueMin ?? valueMax;
}

function topQuartile(shots: Shot[]): Shot[] {
  if (shots.length === 0) return [];
  const sorted = [...shots].sort((a, b) => b.total - a.total);
  return sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.25)));
}

function matchesTarget(shot: Shot, target: ProfileTarget): boolean {
  const endLie = shot.endLie.toLowerCase();
  if (target === 'green') return endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole');
  return endLie.includes('fairway');
}

function fmt(value: number | null, suffix = 'm', digits = 0): string {
  return value === null ? '-' : `${value.toFixed(digits)}${suffix}`;
}

function fmtSigned(value: number | null): string {
  if (value === null) return '-';
  if (Math.abs(value) < 0.5) return 'Neutral';
  return `${Math.abs(value).toFixed(0)}m ${value > 0 ? 'R' : 'L'}`;
}

function fmtHandicap(value: number | null): string {
  if (value === null) return '-';
  if (value <= -4) return 'Pro';
  if (value <= -1) return 'Elite Am';
  return `${Math.round(value)} hcp`;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetricValue(metrics: Array<{ metricId: string; valueMin: number | null; valueMax: number | null }>, id: string): number | null {
  const metric = metrics.find((item) => item.metricId === id);
  if (!metric) return null;
  return metricAverage(metric.valueMin, metric.valueMax);
}

function buildRow(
  profile: ShotProfile,
  target: ProfileTarget,
  courseShots: Shot[],
  practiceSessions: PracticeSession[],
): GappingRow {
  const profileShots = courseShots.filter((shot) =>
    getClubConfigId(shot.club) === profile.clubId &&
    matchesTarget(shot, target)
  );
  const top = topQuartile(profileShots);
  const totals = top.map((shot) => shot.total);
  const sides = top.map((shot) => shot.side);
  const qualityValues = top
    .map((shot) => QUALITY_VALUES[shot.shotQuality])
    .filter((value): value is number => typeof value === 'number');

  const sessions = practiceSessions.filter((session) => session.clubId === profile.id);
  const carryValues = sessions
    .map((session) => getMetricValue(session.metrics, 'carry'))
    .filter((value): value is number => value !== null);
  const rangeScores = sessions
    .map((session) => session.consistency?.overallScore)
    .filter((value): value is number => typeof value === 'number');

  const uniqueDates = [...new Set(courseShots.map((shot) => getShotDateKey(shot.date)))]
    .sort()
    .slice(-3);
  const last3Shots = courseShots.filter((shot) =>
    getClubConfigId(shot.club) === profile.clubId &&
    uniqueDates.includes(getShotDateKey(shot.date))
  );

  return {
    profile,
    target,
    sample: profileShots,
    topQuartile: top,
    liveTotal: mean(totals),
    liveCarry: mean(carryValues),
    totalMin: totals.length ? Math.min(...totals) : null,
    totalMax: totals.length ? Math.max(...totals) : null,
    sideLeft: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    sideRight: sides.length ? Math.max(0, ...sides) : null,
    sideBias: mean(sides),
    handicap: mean(qualityValues),
    last3TargetPct: last3Shots.length ? (last3Shots.filter((shot) => matchesTarget(shot, target)).length / last3Shots.length) * 100 : null,
    rangeConfidence: mean(rangeScores),
  };
}

export function ClubGappingTab() {
  const { shots } = useGolfData();
  const { practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();

  const rows = useMemo(() => {
    return Object.values(profiles)
      .filter((profile) => profile.enabled && profile.showOnCourse)
      .flatMap((profile) => profile.targets.map((target) => buildRow(profile, target, shots, practiceSessions)))
      .filter((row) => row.sample.length > 0 || row.liveCarry !== null);
  }, [profiles, shots, practiceSessions]);

  const updateTargets = (row: GappingRow) => {
    updateShotProfile(row.profile.id, {
      targetTotal: row.liveTotal,
      targetCarry: row.liveCarry,
      targetSideLeft: row.sideLeft,
      targetSideRight: row.sideRight,
    });
  };

  const revertTargets = (profile: ShotProfile) => {
    updateShotProfile(profile.id, {
      targetTotal: null,
      targetCarry: null,
      targetSideLeft: null,
      targetSideRight: null,
    });
  };

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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Shot</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Vertical</TableHead>
                  <TableHead className="text-right">Side</TableHead>
                  <TableHead className="text-right">Carry</TableHead>
                  <TableHead className="text-right">Top Q Rating</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                  <TableHead className="text-right">Range Conf.</TableHead>
                  <TableHead className="text-right">Saved Target</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.profile.id}-${row.target}`}>
                    <TableCell className="font-medium">
                      {getProfileDisplayName(row.profile)}
                      <div className="mt-1 text-xs text-muted-foreground">{row.topQuartile.length} top-Q / {row.sample.length} target hits</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.target}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(row.liveTotal)}</TableCell>
                    <TableCell className="text-right">{fmt(row.totalMin)}-{fmt(row.totalMax)}</TableCell>
                    <TableCell className="text-right">
                      {fmt(row.sideLeft, 'L')} / {fmt(row.sideRight, 'R')}
                      <div className="text-xs text-muted-foreground">{fmtSigned(row.sideBias)}</div>
                    </TableCell>
                    <TableCell className="text-right">{fmt(row.liveCarry)}</TableCell>
                    <TableCell className="text-right">{fmtHandicap(row.handicap)}</TableCell>
                    <TableCell className="text-right">{fmt(row.last3TargetPct, '%')}</TableCell>
                    <TableCell className="text-right">{fmt(row.rangeConfidence, '%')}</TableCell>
                    <TableCell>
                      <div className="grid min-w-[150px] grid-cols-2 gap-1">
                        <Input
                          aria-label="Target total"
                          type="number"
                          value={row.profile.targetTotal ?? ''}
                          onChange={(event) => updateShotProfile(row.profile.id, { targetTotal: parseOptionalNumber(event.target.value) })}
                          placeholder="Total"
                          className="h-8 text-xs"
                        />
                        <Input
                          aria-label="Target carry"
                          type="number"
                          value={row.profile.targetCarry ?? ''}
                          onChange={(event) => updateShotProfile(row.profile.id, { targetCarry: parseOptionalNumber(event.target.value) })}
                          placeholder="Carry"
                          className="h-8 text-xs"
                        />
                        <Input
                          aria-label="Target left dispersion"
                          type="number"
                          value={row.profile.targetSideLeft ?? ''}
                          onChange={(event) => updateShotProfile(row.profile.id, { targetSideLeft: parseOptionalNumber(event.target.value) })}
                          placeholder="Left"
                          className="h-8 text-xs"
                        />
                        <Input
                          aria-label="Target right dispersion"
                          type="number"
                          value={row.profile.targetSideRight ?? ''}
                          onChange={(event) => updateShotProfile(row.profile.id, { targetSideRight: parseOptionalNumber(event.target.value) })}
                          placeholder="Right"
                          className="h-8 text-xs"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateTargets(row)}>
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Update
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revertTargets(row.profile)}>
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Revert
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                      No target-hit gapping data yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
