import { useMemo, useState } from 'react';
import { Gauge, Signal } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { getShotDateKey } from '@/lib/golfCalculations';
import {
  buildClubGappingRows,
  clubSortIndex,
  fmt,
  fmtReliableHcp,
  fmtSigned,
  getClubName,
  getSidePattern,
  getShotBadgeClass,
  getShotLabel,
  isShortShot,
  percentDotTone,
  powerStrength,
  rangeDotTone,
  SHOT_CONTEXT_OPTIONS,
  shotCountTone,
  sortShots,
  type GappingRow,
  type ShotContext,
  type ShotSortKey,
} from '@/lib/gapping';
import { useShotProfiles } from '@/lib/shotProfiles';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';

export function ClubGappingTab() {
  const { shots, gappingReliablePercent } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [shotContext, setShotContext] = useState<ShotContext>('tee');
  const [shotsRow, setShotsRow] = useState<GappingRow | null>(null);
  const [shotSort, setShotSort] = useState<ShotSortKey>('quality');

  const rows = useMemo(() => {
    return buildClubGappingRows({
      profiles,
      shots,
      shotContext,
      practiceSessions,
      practiceConfigs,
      shotsBySession,
      gappingReliablePercent,
      shotCategoryOverrides: {},
      shotClassificationRules,
    });
  }, [profiles, shots, shotContext, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, shotClassificationRules]);

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
            Distances use the best shot-quality level that covers {gappingReliablePercent}% of your rated shots for each club and shot.
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
                  <TableHead className="text-right whitespace-nowrap">Reliable</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Vertical</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Pattern</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Last 20 T</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Last 20 Safe</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Range %</TableHead>
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
                      <TableCell className="text-right whitespace-nowrap" title={`Covers ${fmt(row.reliableCoveragePct, '%')}`}>
                        {fmtReliableHcp(row.reliableHcpLevel)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.totalMin)} - {fmt(row.totalMax)}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${getSidePattern(row).className}`} title={`Left ${fmt(row.displaySideLeft)} · Right ${fmt(row.displaySideRight)} · Mean ${fmtSigned(row.sideBias)}`}>
                        {getSidePattern(row).label}
                      </TableCell>
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

      <Dialog open={Boolean(shotsRow)} onOpenChange={(open) => !open && setShotsRow(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {shotsRow ? `${getClubName(shotsRow.profile)} ${getShotLabel(shotsRow.profile)} to ${shotsRow.target}` : 'Shots'}
            </DialogTitle>
            <DialogDescription>
              These are all imported shots for this lie, shot, and intent.
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
