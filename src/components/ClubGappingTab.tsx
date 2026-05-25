import { useMemo, useState } from 'react';
import { Gauge, Pencil, RefreshCw } from 'lucide-react';
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
import { ProfileTarget, ShotProfile, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { Shot } from '@/types/golf';
import { ClubPracticeConfig, PracticeSession } from '@/types/practice';
import { PRACTICE_CLUBS } from '@/types/practiceClubs';

type ShotContext = 'tee' | 'fairway' | 'roughRecovery';

const SHOT_CONTEXT_OPTIONS: Array<{ id: ShotContext; label: string }> = [
  { id: 'tee', label: 'Tee' },
  { id: 'fairway', label: 'Fairway' },
  { id: 'roughRecovery', label: 'Rough / Recovery' },
];

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
  targetPct: number | null;
  safePct: number | null;
  rangeConfidence: number | null;
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

function matchesShotContext(shot: Shot, context: ShotContext): boolean {
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

function fmtSideRange(left: number | null, right: number | null): string {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return '-';
  return `${left.toFixed(0)}L - ${right.toFixed(0)}R`;
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

function matchesPracticeProfile(session: PracticeSession, profile: ShotProfile): boolean {
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

function buildRow(
  profile: ShotProfile,
  target: ProfileTarget,
  courseShots: Shot[],
  practiceSessions: PracticeSession[],
  practiceConfigs: ClubPracticeConfig[],
  shotsBySession: ShotsBySession,
): GappingRow {
  const clubShots = courseShots.filter((shot) => getClubConfigId(shot.club) === profile.clubId);
  const cleanedClubShots = withoutDistanceOutliers(clubShots);
  const cleanedTargetHits = withoutDistanceOutliers(cleanedClubShots.filter((shot) => matchesTarget(shot, target)));
  const top = topQuartile(cleanedTargetHits);
  const totals = top.map((shot) => shot.total);
  const sides = top.map((shot) => shot.side);

  const sessions = practiceSessions
    .filter((session) => matchesPracticeProfile(session, profile))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const carryValues = sessions
    .map((session) => getMetricValue(session.metrics, 'carry'))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const practiceConfig = practiceConfigs.find((config) => config.clubId === profile.id)
    ?? practiceConfigs.find((config) => config.clubId === profile.clubId);

  const uniqueDates = [...new Set(courseShots.map((shot) => getShotDateKey(shot.date)))]
    .sort()
    .slice(-3);
  const lastThreeClubShots = clubShots.filter((shot) => uniqueDates.includes(getShotDateKey(shot.date)));

  return {
    profile,
    target,
    sample: cleanedTargetHits,
    topQuartile: top,
    liveTotal: mean(totals),
    liveCarry: mean(carryValues),
    totalMin: totals.length ? Math.min(...totals) : null,
    totalMax: totals.length ? Math.max(...totals) : null,
    sideLeft: sides.length ? Math.abs(Math.min(0, ...sides)) : null,
    sideRight: sides.length ? Math.max(0, ...sides) : null,
    sideBias: mean(sides),
    targetPct: lastThreeClubShots.length ? (lastThreeClubShots.filter((shot) => matchesTarget(shot, target)).length / lastThreeClubShots.length) * 100 : null,
    safePct: lastThreeClubShots.length ? (lastThreeClubShots.filter(isSafeOutcome).length / lastThreeClubShots.length) * 100 : null,
    rangeConfidence: getRangeTargetPct(sessions, practiceConfig, shotsBySession),
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
  const [draft, setDraft] = useState({
    targetTotal: '',
    targetCarry: '',
    targetSideLeft: '',
    targetSideRight: '',
  });

  const rows = useMemo(() => {
    const contextShots = shots.filter((shot) => matchesShotContext(shot, shotContext));
    return Object.values(profiles)
      .filter((profile) => profile.enabled && profile.showOnCourse)
      .filter((profile) => shotContext !== 'tee' || (profile.shotType === 'full' && profile.power === 'full'))
      .flatMap((profile) => profile.targets.map((target) => buildRow(profile, target, contextShots, practiceSessions, practiceConfigs, shotsBySession)))
      .filter((row) => row.sample.length > 0 || row.liveCarry !== null);
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
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Distance</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Vertical</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Side Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Mean Side</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Target %</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Safe %</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Range %</TableHead>
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
                        <Badge variant="outline" className="capitalize">{row.target}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">{fmt(row.liveTotal)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.totalMin)} - {fmt(row.totalMax)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">{fmtSideRange(row.sideLeft, row.sideRight)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtSigned(row.sideBias)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.liveCarry)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.targetPct !== null && row.targetPct >= 70 ? 'default' : 'outline'} className={confidenceTone(row.targetPct)}>
                          {fmt(row.targetPct, '%')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.safePct !== null && row.safePct >= 70 ? 'default' : 'outline'} className={confidenceTone(row.safePct)}>
                          {fmt(row.safePct, '%')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.rangeConfidence !== null && row.rangeConfidence >= 70 ? 'default' : 'outline'} className={confidenceTone(row.rangeConfidence)}>
                          {fmt(row.rangeConfidence, '%')}
                        </Badge>
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
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
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
              Saved targets are your reference numbers. Live columns still update from shot data.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            {editingRow && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm sm:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium">Latest live values</div>
                  <Button type="button" size="sm" variant="outline" onClick={useLiveInDraft}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh latest
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  <div>Total {fmt(editingRow.liveTotal)}</div>
                  <div>Carry {fmt(editingRow.liveCarry)}</div>
                  <div>Side {fmtSideRange(editingRow.sideLeft, editingRow.sideRight)}</div>
                  <div>Mean {fmtSigned(editingRow.sideBias)}</div>
                  <div>Range {fmt(editingRow.rangeConfidence, '%')}</div>
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
