import { useMemo, useState } from 'react';
import { CircleHelp, Gauge, Pencil, RotateCcw, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { getClubConfigId, getShotDateKey } from '@/lib/golfCalculations';
import { ProfileTarget, ShotProfile, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { Shot } from '@/types/golf';
import { PracticeSession } from '@/types/practice';
import { PRACTICE_CLUBS, POWER_OPTIONS, SHOT_TYPES } from '@/types/practiceClubs';

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
  destinationConfidence: number | null;
  safeConfidence: number | null;
  confidenceWindowCount: number;
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

function getClubName(profile: ShotProfile): string {
  return PRACTICE_CLUBS.find((club) => club.id === profile.clubId)?.name ?? profile.clubId;
}

function getShotLabel(profile: ShotProfile, target: ProfileTarget): string {
  const shotName = SHOT_TYPES.find((shot) => shot.id === profile.shotType)?.name ?? profile.shotType;
  const powerName = POWER_OPTIONS.find((power) => power.id === profile.power)?.name ?? profile.power;

  if (profile.clubId === 'dr' && profile.shotType === 'full' && profile.power === 'full') return 'Tee shot';
  if (profile.shotType === 'full' && profile.power === 'full') return target === 'green' ? 'Stock approach' : 'Stock fairway';
  return `${shotName} · ${powerName}`;
}

function fmtSideRange(left: number | null, right: number | null): string {
  if (left === null || right === null) return '-';
  return `${left.toFixed(0)}L-${right.toFixed(0)}R`;
}

function confidenceTone(value: number | null): string {
  if (value === null) return 'border-muted text-muted-foreground';
  if (value >= 70) return 'bg-green-600 text-white';
  if (value >= 50) return 'bg-amber-500 text-white';
  return 'border-red-500 text-red-700';
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
  const cleanedShots = withoutDistanceOutliers(profileShots);
  const top = topQuartile(cleanedShots);
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
  const referenceTotal = profile.targetTotal ?? mean(totals);
  const targetWindowShots = withoutDistanceOutliers(courseShots.filter((shot) =>
    getClubConfigId(shot.club) === profile.clubId &&
    referenceTotal !== null &&
    Math.abs(shot.total - referenceTotal) <= 10
  ));
  const last3WindowShots = targetWindowShots.filter((shot) =>
    uniqueDates.includes(getShotDateKey(shot.date))
  );

  return {
    profile,
    target,
    sample: cleanedShots,
    topQuartile: top,
    liveTotal: mean(totals),
    liveCarry: mean(carryValues),
    totalMin: totals.length ? Math.min(...totals) : null,
    totalMax: totals.length ? Math.max(...totals) : null,
    sideLeft: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    sideRight: sides.length ? Math.max(0, ...sides) : null,
    sideBias: mean(sides),
    handicap: mean(qualityValues),
    destinationConfidence: last3WindowShots.length ? (last3WindowShots.filter((shot) => matchesTarget(shot, target)).length / last3WindowShots.length) * 100 : null,
    safeConfidence: targetWindowShots.length ? (targetWindowShots.filter(isSafeOutcome).length / targetWindowShots.length) * 100 : null,
    confidenceWindowCount: targetWindowShots.length,
    rangeConfidence: mean(rangeScores),
  };
}

export function ClubGappingTab() {
  const { shots } = useGolfData();
  const { practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const [editingRow, setEditingRow] = useState<GappingRow | null>(null);
  const [draft, setDraft] = useState({
    targetTotal: '',
    targetCarry: '',
    targetSideLeft: '',
    targetSideRight: '',
  });

  const rows = useMemo(() => {
    return Object.values(profiles)
      .filter((profile) => profile.enabled && profile.showOnCourse)
      .flatMap((profile) => profile.targets.map((target) => buildRow(profile, target, shots, practiceSessions)))
      .filter((row) => row.sample.length > 0 || row.liveCarry !== null);
  }, [profiles, shots, practiceSessions]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, GappingRow[]>();
    for (const row of rows) {
      const clubName = getClubName(row.profile);
      groups.set(clubName, [...(groups.get(clubName) ?? []), row]);
    }
    return [...groups.entries()];
  }, [rows]);

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

  const openEdit = (row: GappingRow) => {
    setEditingRow(row);
    setDraft({
      targetTotal: row.profile.targetTotal?.toString() ?? '',
      targetCarry: row.profile.targetCarry?.toString() ?? '',
      targetSideLeft: row.profile.targetSideLeft?.toString() ?? '',
      targetSideRight: row.profile.targetSideRight?.toString() ?? '',
    });
  };

  const useLiveInDraft = () => {
    if (!editingRow) return;
    setDraft({
      targetTotal: editingRow.liveTotal?.toFixed(0) ?? '',
      targetCarry: editingRow.liveCarry?.toFixed(0) ?? '',
      targetSideLeft: editingRow.sideLeft?.toFixed(0) ?? '',
      targetSideRight: editingRow.sideRight?.toFixed(0) ?? '',
    });
  };

  const saveEdit = () => {
    if (!editingRow) return;
    updateShotProfile(editingRow.profile.id, {
      targetTotal: parseOptionalNumber(draft.targetTotal),
      targetCarry: parseOptionalNumber(draft.targetCarry),
      targetSideLeft: parseOptionalNumber(draft.targetSideLeft),
      targetSideRight: parseOptionalNumber(draft.targetSideRight),
    });
    setEditingRow(null);
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
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Club</TableHead>
                  <TableHead className="min-w-[150px]">Shot</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Vertical</TableHead>
                  <TableHead className="text-right">Side Range</TableHead>
                  <TableHead className="text-right">Mean Side</TableHead>
                  <TableHead className="text-right">Carry</TableHead>
                  <TableHead className="text-right">Top Q Rating</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Range Conf.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map(([clubName, clubRows]) => (
                  clubRows.map((row, index) => (
                    <TableRow key={`${row.profile.id}-${row.target}`}>
                      <TableCell className="font-semibold">
                        {index === 0 ? (
                          <div className="flex items-center gap-1.5">
                            {clubName}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground">
                                  <CircleHelp className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1 text-xs">
                                  {clubRows.map((clubRow) => (
                                    <div key={`${clubRow.profile.id}-${clubRow.target}`}>
                                      {getShotLabel(clubRow.profile, clubRow.target)}: {clubRow.topQuartile.length} top-Q / {clubRow.sample.length} target hits / {clubRow.confidenceWindowCount} in window
                                    </div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        ) : ''}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{getShotLabel(row.profile, row.target)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{row.target}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{fmt(row.liveTotal)}</TableCell>
                      <TableCell className="text-right">{fmt(row.totalMin)}-{fmt(row.totalMax)}</TableCell>
                      <TableCell className="text-right">{fmtSideRange(row.sideLeft, row.sideRight)}</TableCell>
                      <TableCell className="text-right">{fmtSigned(row.sideBias)}</TableCell>
                      <TableCell className="text-right">{fmt(row.liveCarry)}</TableCell>
                      <TableCell className="text-right">{fmtHandicap(row.handicap)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Badge variant={row.destinationConfidence !== null && row.destinationConfidence >= 70 ? 'default' : 'outline'} className={confidenceTone(row.destinationConfidence)}>
                            T {fmt(row.destinationConfidence, '%')}
                          </Badge>
                          <Badge variant={row.safeConfidence !== null && row.safeConfidence >= 70 ? 'default' : 'outline'} className={confidenceTone(row.safeConfidence)}>
                            S {fmt(row.safeConfidence, '%')}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.rangeConfidence !== null && row.rangeConfidence >= 70 ? 'default' : 'outline'} className={confidenceTone(row.rangeConfidence)}>
                          {fmt(row.rangeConfidence, '%')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Edit targets" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Update from latest data" onClick={() => updateTargets(row)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Clear saved targets" onClick={() => revertTargets(row.profile)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                      No target-hit gapping data yet.
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
              Saved targets are your reference numbers. Live columns still update from shot data.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {editingRow && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm sm:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium">Latest live values</div>
                  <Button type="button" size="sm" variant="outline" onClick={useLiveInDraft}>
                    Use latest
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>Total {fmt(editingRow.liveTotal)}</div>
                  <div>Carry {fmt(editingRow.liveCarry)}</div>
                  <div>Side {fmtSideRange(editingRow.sideLeft, editingRow.sideRight)}</div>
                  <div>Mean {fmtSigned(editingRow.sideBias)}</div>
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
    </div>
  );
}
