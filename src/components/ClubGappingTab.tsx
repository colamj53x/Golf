import { useMemo, useState } from 'react';
import { BookOpen, Gauge } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
  getExpandedGappingShotLabel,
  getSidePattern,
  percentDotTone,
  SHOT_CONTEXT_OPTIONS,
  type GappingRow,
  type ShotContext,
} from '@/lib/gapping';
import { useShotProfiles } from '@/lib/shotProfiles';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { cueIdForConfig, shotCueLink } from '@/lib/shotCues';

export function ClubGappingTab() {
  const navigate = useNavigate();
  const {
    shots,
    gappingReliablePercent,
    gappingQualityFallbackHcp,
    gappingGreenThreshold,
    gappingAmberThreshold,
  } = useGolfData();
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
      gappingQualityFallbackHcp,
      shotCategoryOverrides: {},
      shotClassificationRules,
    });
  }, [profiles, shots, shotContext, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, gappingQualityFallbackHcp, shotClassificationRules]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, GappingRow[]>();
    const sortedRows = [...rows].sort((a, b) => {
      const clubDelta = clubSortIndex(a.profile.clubId) - clubSortIndex(b.profile.clubId);
      if (clubDelta !== 0) return clubDelta;

      const aDistance = a.displayTotal ?? Number.NEGATIVE_INFINITY;
      const bDistance = b.displayTotal ?? Number.NEGATIVE_INFINITY;
      if (aDistance !== bDistance) return bDistance - aDistance;

      return getExpandedGappingShotLabel(a.profile).localeCompare(getExpandedGappingShotLabel(b.profile));
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
            Quick on-course reference for reliable distance and typical miss patterns.
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
                  <TableHead className="min-w-[180px]">Club</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Carry</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Roll</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Typical miss</TableHead>
                  <TableHead className="text-right whitespace-nowrap"><span className="block">Quality</span><span className="text-[10px] font-normal text-muted-foreground">Last 20</span></TableHead>
                  <TableHead className="text-right whitespace-nowrap"><span className="block">Safety</span><span className="text-[10px] font-normal text-muted-foreground">Last 20</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map(([clubName, clubRows]) => (
                  clubRows.map((row) => {
                    const roll = row.displayTotal !== null && row.displayCarry !== null
                      ? Math.max(0, row.displayTotal - row.displayCarry)
                      : null;
                    const miss = getSidePattern(row);
                    const shotBadgeClass = row.profile.power === 'full'
                      ? 'border-green-600 bg-green-50 text-green-800 hover:bg-green-50'
                      : 'border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-50';
                    const targetBadgeClass = row.target === 'green'
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-100'
                      : 'border-sky-500 bg-sky-100 text-sky-900 hover:bg-sky-100';

                    return (
                      <TableRow key={`${row.profile.id}-${row.target}`}>
                        <TableCell>
                          <div className="flex min-w-[170px] flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-lg font-bold">{clubName}</span>
                              <Badge variant="outline" className={shotBadgeClass}>{getExpandedGappingShotLabel(row.profile)}</Badge>
                              <Badge variant="outline" className={`capitalize ${targetBadgeClass}`}>{row.target} target</Badge>
                            </div>
                            {cueIdForConfig(row.profile.id) && (
                              <Button type="button" size="sm" variant="ghost" className="h-8 w-fit gap-1.5 px-2" onClick={() => navigate(shotCueLink(row.profile.id))}>
                                <BookOpen className="h-3.5 w-3.5" />Cue
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-lg font-semibold whitespace-nowrap">{fmt(row.displayCarry)}</TableCell>
                        <TableCell className="text-right text-lg font-semibold whitespace-nowrap">{fmt(roll)}</TableCell>
                        <TableCell className="text-right text-xl font-bold whitespace-nowrap">{fmt(row.displayTotal)}</TableCell>
                        <TableCell className={`text-right font-semibold whitespace-nowrap ${miss.className}`} title="Mean side bias from reliable shots">
                          {miss.label}
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="inline-flex items-center justify-end gap-2 whitespace-nowrap"
                            title={`Last 20 quality: ${fmt(row.recentTargetPct, '%')} at ${fmtReliableHcp(row.qualityCutoff)} or better`}
                            aria-label={`Last 20 quality ${fmt(row.recentTargetPct, '%')} at ${fmtReliableHcp(row.qualityCutoff)} or better`}
                          >
                            <span className={`block h-4 w-4 shrink-0 rounded-full border ${percentDotTone(row.recentTargetPct, gappingGreenThreshold, gappingAmberThreshold)}`} />
                            <span className="text-xs font-medium tabular-nums">{fmt(row.recentTargetPct, '%')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div
                            className="inline-flex items-center justify-end gap-2 whitespace-nowrap"
                            title={`Last 20 safe outcomes: ${fmt(row.recentSafePct, '%')}`}
                            aria-label={`Last 20 safe outcomes ${fmt(row.recentSafePct, '%')}`}
                          >
                            <span className={`block h-4 w-4 shrink-0 rounded-full border ${percentDotTone(row.recentSafePct, gappingGreenThreshold, gappingAmberThreshold)}`} />
                            <span className="text-xs font-medium tabular-nums">{fmt(row.recentSafePct, '%')}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
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
