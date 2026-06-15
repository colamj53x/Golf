import { useMemo, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import {
  buildClubGappingRows,
  clubSortIndex,
  fmt,
  fmtReliableHcp,
  getClubName,
  getSidePattern,
  getShotBadgeClass,
  getShotLabel,
  isShortShot,
  percentDotTone,
  powerStrength,
  rangeDotTone,
  SHOT_CONTEXT_OPTIONS,
  type GappingRow,
  type ShotContext,
} from '@/lib/gapping';
import { useShotProfiles } from '@/lib/shotProfiles';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';

export function ClubGappingTab() {
  const { shots, gappingReliablePercent, gappingGreenThreshold, gappingAmberThreshold } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [shotContext, setShotContext] = useState<ShotContext>('tee');

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
                  <TableHead>Shot</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Distance</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Vertical</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Bias</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry Range</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Last 20 T</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Last 20 Safe</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Range %</TableHead>
                  <TableHead className="text-right whitespace-nowrap" title={`${gappingReliablePercent}% of shots are at this handicap level or better`}>
                    {gappingReliablePercent}% Shots Are
                  </TableHead>
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
                      <TableCell className={`text-right whitespace-nowrap ${getSidePattern(row).className}`} title={`Mean side bias from reliable shots`}>
                        {getSidePattern(row).label}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.displayCarry)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{fmt(row.displayCarryMin)} - {fmt(row.displayCarryMax)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${percentDotTone(row.recentTargetPct, gappingGreenThreshold, gappingAmberThreshold)}`} title={`Last 20 at ${row.qualityCutoff} hcp or better ${fmt(row.recentTargetPct, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${percentDotTone(row.recentSafePct, gappingGreenThreshold, gappingAmberThreshold)}`} title={`Last 20 safe outcomes ${fmt(row.recentSafePct, '%')}`} />
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`mx-auto block h-5 w-5 rounded-full border ${rangeDotTone(row.rangeConfidence, gappingGreenThreshold, gappingAmberThreshold)}`} title={`Range ${fmt(row.rangeConfidence, '%')}`} />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap" title={`${gappingReliablePercent}% of shots are ${fmtReliableHcp(row.reliableHcpLevel)} or better. Actual coverage: ${fmt(row.reliableCoveragePct, '%')}`}>
                        {fmtReliableHcp(row.reliableHcpLevel)}
                      </TableCell>
                    </TableRow>
                    );
                  })
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                      No gapping data yet for this shot type.
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
