import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, Gauge, Pencil, RefreshCw, Signal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { getShotDateKey } from '@/lib/golfCalculations';
import {
  buildClubGappingRows,
  clubSortIndex,
  fmt,
  fmtSideRange,
  fmtSigned,
  getClubName,
  getShotBadgeClass,
  getShotLabel,
  isShortShot,
  loadShotCategoryOverrides,
  parseOptionalNumber,
  percentDotTone,
  powerStrength,
  rangeDotTone,
  SHOT_CATEGORY_OVERRIDES_EVENT,
  SHOT_CATEGORY_OVERRIDES_KEY,
  SHOT_CONTEXT_OPTIONS,
  shotCountTone,
  sortShots,
  visibleProfileId,
  type GappingRow,
  type ShotCategoryOverrides,
  type ShotContext,
  type ShotSortKey,
} from '@/lib/gapping';
import { updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';
import { persistDurableLocalSettingsSoon } from '@/lib/durableLocalSettings';
import { Shot } from '@/types/golf';

export function ClubGappingTab() {
  const { shots, gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [shotContext, setShotContext] = useState<ShotContext>('tee');
  const [editingRow, setEditingRow] = useState<GappingRow | null>(null);
  const [shotsRow, setShotsRow] = useState<GappingRow | null>(null);
  const [shotSort, setShotSort] = useState<ShotSortKey>('quality');
  const [shotCategoryOverrides, setShotCategoryOverrides] = useState<ShotCategoryOverrides>(() => loadShotCategoryOverrides());
  const [draft, setDraft] = useState({
    targetTotal: '',
    targetCarry: '',
    targetVariationPct: '',
    targetQualityCutoff: '',
    targetSideLeft: '',
    targetSideRight: '',
  });

  useEffect(() => {
    localStorage.setItem(SHOT_CATEGORY_OVERRIDES_KEY, JSON.stringify(shotCategoryOverrides));
    persistDurableLocalSettingsSoon();
    window.dispatchEvent(new Event(SHOT_CATEGORY_OVERRIDES_EVENT));
  }, [shotCategoryOverrides]);

  const rows = useMemo(() => {
    return buildClubGappingRows({
      profiles,
      shots,
      shotContext,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      gappingHcpTarget,
      shotCategoryOverrides,
    });
  }, [profiles, shots, shotContext, practiceSessions, practiceConfigs, shotsBySession, gappingHcpTarget, shotCategoryOverrides]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, GappingRow[]>();
    const sortedRows = [...rows].sort((a, b) => {
      const clubDelta = clubSortIndex(a.profile.clubId) - clubSortIndex(b.profile.clubId);
      if (clubDelta !== 0) return clubDelta;

      const aDistance = a.displayTotal ?? Number.NEGATIVE_INFINITY;
      const bDistance = b.displayTotal ?? Number.NEGATIVE_INFINITY;
      if (aDistance !== bDistance) return bDistance - aDistance;

      return getShotLabel(a.profile).localeCompare(getShotLabel(b.profile));
    });

    for (const row of sortedRows) {
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

  const moveShotDown = (shot: Shot) => {
    if (!shotsRow) return;
    const clubRows = rows
      .filter((row) => row.profile.clubId === shotsRow.profile.clubId)
      .sort((a, b) => {
        const aDistance = a.displayTotal ?? Number.NEGATIVE_INFINITY;
        const bDistance = b.displayTotal ?? Number.NEGATIVE_INFINITY;
        if (aDistance !== bDistance) return bDistance - aDistance;
        return getShotLabel(a.profile).localeCompare(getShotLabel(b.profile));
      });
    const currentIndex = clubRows.findIndex((row) => row.profile.id === shotsRow.profile.id && row.target === shotsRow.target);
    const nextRow = currentIndex >= 0 ? clubRows[currentIndex + 1] : null;
    if (!nextRow) return;

    setShotCategoryOverrides((prev) => ({
      ...prev,
      [shot.id]: {
        profileId: visibleProfileId(nextRow.profile.id),
        target: nextRow.target,
      },
    }));
  };

  const resetShotCategory = (shot: Shot) => {
    setShotCategoryOverrides((prev) => {
      const next = { ...prev };
      delete next[shot.id];
      return next;
    });
  };

  const getNextCategoryLabel = () => {
    if (!shotsRow) return null;
    const clubRows = rows
      .filter((row) => row.profile.clubId === shotsRow.profile.clubId)
      .sort((a, b) => {
        const aDistance = a.displayTotal ?? Number.NEGATIVE_INFINITY;
        const bDistance = b.displayTotal ?? Number.NEGATIVE_INFINITY;
        if (aDistance !== bDistance) return bDistance - aDistance;
        return getShotLabel(a.profile).localeCompare(getShotLabel(b.profile));
      });
    const currentIndex = clubRows.findIndex((row) => row.profile.id === shotsRow.profile.id && row.target === shotsRow.target);
    const nextRow = currentIndex >= 0 ? clubRows[currentIndex + 1] : null;
    return nextRow ? `${getShotLabel(nextRow.profile)} ${fmt(nextRow.displayTotal)}` : null;
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
                  <TableHead className="text-center whitespace-nowrap">Shots</TableHead>
                  <TableHead>Shot</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Distance</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Vertical</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Side Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Mean Side</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Last 20 T</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Last 20 Safe</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Range %</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map(([clubName, clubRows]) => (
                  clubRows.map((row, index) => {
                    const strongestShortShotPower = Math.max(
                      ...clubRows
                        .filter((clubRow) => clubRow.profile.shotType === row.profile.shotType && isShortShot(clubRow.profile))
                        .map((clubRow) => powerStrength(clubRow.profile.power)),
                      -1,
                    );
                    const isHardestShortShot = isShortShot(row.profile) && powerStrength(row.profile.power) === strongestShortShotPower;

                    return (
                    <TableRow key={`${row.profile.id}-${row.target}`}>
                      <TableCell className="font-semibold">
                        {index === 0 ? clubName : ''}
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
                      <TableCell>
                        <Badge
                          variant={row.profile.shotType === 'punch' ? 'default' : 'outline'}
                          className={getShotBadgeClass(row.profile, isHardestShortShot)}
                        >
                          {getShotLabel(row.profile)}
                        </Badge>
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
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${percentDotTone(row.recentTargetPct)}`} title={`Last 20 at ${row.qualityCutoff} hcp or better ${fmt(row.recentTargetPct, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${percentDotTone(row.recentSafePct)}`} title={`Last 20 safe outcomes ${fmt(row.recentSafePct, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${rangeDotTone(row.rangeConfidence)}`} title={`Range ${fmt(row.rangeConfidence, '%')}`} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" title="Edit targets" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    );
                  })
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
              These are all imported shots for this lie, shot, and intent. Move a shot down if the automatic category is too firm for the actual shot you played.
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
                  <TableHead className="text-right">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailShots.map((shot) => {
                  const override = shotCategoryOverrides[shot.id];
                  const nextCategoryLabel = getNextCategoryLabel();

                  return (
                    <TableRow key={shot.id}>
                      <TableCell className="whitespace-nowrap">{getShotDateKey(shot.date)}</TableCell>
                      <TableCell>{shot.shotQuality || '-'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(shot.total)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmtSigned(shot.side)}</TableCell>
                      <TableCell>{shot.startLie || '-'}</TableCell>
                      <TableCell>{shot.endLie || '-'}</TableCell>
                      <TableCell>{shot.strikeQuality || '-'}</TableCell>
                      <TableCell className="text-right">
                        {override ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => resetShotCategory(shot)}>
                            Reset
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => moveShotDown(shot)}
                            disabled={!nextCategoryLabel}
                            title={nextCategoryLabel ? `Move to ${nextCategoryLabel}` : 'No softer category'}
                          >
                            <ArrowDown className="mr-1 h-3 w-3" />
                            Down
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {detailShots.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
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
