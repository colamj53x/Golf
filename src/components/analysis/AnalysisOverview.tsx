import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CircleDot,
  Gauge,
  Signal,
} from 'lucide-react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { useAnalysisPuttingSessions } from '@/hooks/useAnalysisPuttingSessions';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import {
  buildAnalysisModel,
  type AnalysisConfidence,
  type AnalysisTrend,
} from '@/lib/analysisSynthesis';
import {
  buildClubGappingRows,
  clubSortIndex,
  fmt,
  fmtSideRange,
  fmtSigned,
  getClubName,
  getShotLabel,
  loadShotCategoryOverrides,
  percentDotTone,
  rangeDotTone,
  SHOT_CONTEXT_OPTIONS,
  shotCountTone,
  type GappingRow,
  type ShotContext,
} from '@/lib/gapping';
import { useShotProfiles } from '@/lib/shotProfiles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const confidenceLabel: Record<AnalysisConfidence, string> = {
  high: 'High confidence',
  medium: 'Emerging',
  low: 'Early signal',
  none: 'More data needed',
};

const trendLabel: Record<AnalysisTrend, string> = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Declining',
  volatile: 'Volatile',
  insufficient: 'More data needed',
};

const confidenceClasses: Record<AnalysisConfidence, string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-orange-200 bg-orange-50 text-orange-800',
  none: 'border-slate-200 bg-slate-50 text-slate-600',
};

function ConfidenceBadge({ value }: { value: AnalysisConfidence }) {
  return <Badge variant="outline" className={confidenceClasses[value]}>{confidenceLabel[value]}</Badge>;
}

function TrendIndicator({ value }: { value: AnalysisTrend }) {
  if (value === 'improving') return <ArrowUpRight className="h-4 w-4 text-emerald-600" aria-label="Improving" />;
  if (value === 'declining') return <ArrowDownRight className="h-4 w-4 text-red-600" aria-label="Declining" />;
  return <ArrowRight className="h-4 w-4 text-slate-500" aria-label={trendLabel[value]} />;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  return (
    <Card className={cn('overflow-hidden border-l-4', tone === 'good' && 'border-l-emerald-500', tone === 'warn' && 'border-l-amber-500', tone === 'default' && 'border-l-slate-400')}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ children }: { children: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</div>;
}

function groupRows(rows: GappingRow[]) {
  const groups = new Map<string, GappingRow[]>();
  const sortedRows = [...rows].sort((a, b) => {
    const clubDelta = clubSortIndex(a.profile.clubId) - clubSortIndex(b.profile.clubId);
    if (clubDelta !== 0) return clubDelta;
    return (b.displayTotal ?? Number.NEGATIVE_INFINITY) - (a.displayTotal ?? Number.NEGATIVE_INFINITY);
  });
  sortedRows.forEach((row) => {
    const clubName = getClubName(row.profile);
    groups.set(clubName, [...(groups.get(clubName) || []), row]);
  });
  return [...groups.entries()];
}

export function AnalysisOverview() {
  const { shots, clubs, roundReflections, gappingHcpTarget, isLoading: golfLoading } = useGolfData();
  const { practiceConfigs, practiceSessions, isLoading: practiceLoading } = usePracticeData();
  const profiles = useShotProfiles();
  const puttingSessions = useAnalysisPuttingSessions();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession, isLoading: practiceShotsLoading } = usePracticeShotsBySessions(practiceSessionIds);
  const [shotContext, setShotContext] = useState<ShotContext>('tee');
  const shotCategoryOverrides = useMemo(() => loadShotCategoryOverrides(), []);
  const analysis = useMemo(() => buildAnalysisModel({
    shots,
    clubs,
    roundReflections,
    practiceSessions,
    puttingSessions,
  }), [clubs, practiceSessions, puttingSessions, roundReflections, shots]);
  const gappingRows = useMemo(() => buildClubGappingRows({
    profiles,
    shots,
    shotContext,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    shotCategoryOverrides,
  }), [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shotCategoryOverrides, shotContext, shots, shotsBySession]);
  const groupedRows = useMemo(() => groupRows(gappingRows), [gappingRows]);
  const clubInsightMap = useMemo(() => new Map(analysis.clubInsights.map((insight) => [insight.clubId, insight])), [analysis.clubInsights]);

  if (golfLoading || practiceLoading || practiceShotsLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white shadow-lg">
        <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <Brain className="h-5 w-5" />
              Game diagnosis
            </div>
            <p className="max-w-4xl text-lg font-medium leading-relaxed text-white">{analysis.diagnosis}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
              <ConfidenceBadge value={analysis.confidence} />
              <span>{analysis.shots} course shots</span>
              <span>·</span>
              <span>{analysis.rounds} rounds</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-center backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Shot Quality Index</div>
            <div className="mt-1 text-6xl font-black tracking-tight">{analysis.sqi ?? '-'}</div>
            <div className="text-sm text-emerald-100">{analysis.currentLevel}</div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Gauge} label="SQI" value={analysis.sqi === null ? '-' : `${analysis.sqi} / 100`} detail={`${analysis.change !== null && analysis.change >= 0 ? '+' : ''}${analysis.change ?? '-'} vs baseline`} tone="good" />
        <MetricCard icon={AlertTriangle} label="Costly miss" value={`${analysis.badMissPct}%`} detail="Misses likely to cost position or a shot" tone="warn" />
        <MetricCard icon={CircleDot} label="Damage" value={`${analysis.damagePerRound}`} detail={`${analysis.scoringDamage} estimated shots across captured rounds`} tone="warn" />
        <MetricCard icon={Activity} label="Current form" value={trendLabel[analysis.trend]} detail={`${analysis.baselineSqi ?? '-'} all-time SQI baseline`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-emerald-700" /> Club analysis</CardTitle>
          <CardDescription>
            Your gapping view with the useful course signals folded in. Change the lie context to see the shots you would actually play from there.
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
                  <TableHead className="min-w-[110px]">Club</TableHead>
                  <TableHead className="text-center">Shots</TableHead>
                  <TableHead>Shot</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Vertical</TableHead>
                  <TableHead className="text-right">Side range</TableHead>
                  <TableHead className="text-right">Mean side</TableHead>
                  <TableHead className="text-right">Carry</TableHead>
                  <TableHead className="text-center">Last 20 T</TableHead>
                  <TableHead className="text-center">Last 20 safe</TableHead>
                  <TableHead className="text-center">Range</TableHead>
                  <TableHead className="text-center">SQI</TableHead>
                  <TableHead className="text-center">Costly miss</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.flatMap(([clubName, clubRows]) => clubRows.map((row, index) => {
                  const insight = clubInsightMap.get(row.profile.clubId);
                  return (
                    <TableRow key={`${row.profile.id}-${row.target}`}>
                      <TableCell className="font-semibold">{index === 0 ? clubName : ''}</TableCell>
                      <TableCell className="text-center">
                        <Signal className={cn('mx-auto h-4 w-4', shotCountTone(row.shotCount))} aria-label={`${row.shotCount} shots`} />
                      </TableCell>
                      <TableCell><Badge variant="outline">{getShotLabel(row.profile)}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{row.target}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-right font-semibold">{fmt(row.displayTotal)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{fmt(row.totalMin)} - {fmt(row.totalMax)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{fmtSideRange(row.displaySideLeft, row.displaySideRight)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{fmtSigned(row.sideBias)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{fmt(row.displayCarry)}</TableCell>
                      <TableCell className="text-center"><span className={cn('mx-auto block h-4 w-4 rounded-full border', percentDotTone(row.recentTargetPct))} title={`Last 20 target ${fmt(row.recentTargetPct, '%')}`} /></TableCell>
                      <TableCell className="text-center"><span className={cn('mx-auto block h-4 w-4 rounded-full border', percentDotTone(row.recentSafePct))} title={`Last 20 safe ${fmt(row.recentSafePct, '%')}`} /></TableCell>
                      <TableCell className="text-center"><span className={cn('mx-auto block h-4 w-4 rounded-full border', rangeDotTone(row.rangeConfidence))} title={`Range ${fmt(row.rangeConfidence, '%')}`} /></TableCell>
                      <TableCell className="text-center font-semibold">{index === 0 ? insight?.sqi ?? '-' : ''}</TableCell>
                      <TableCell className="whitespace-nowrap text-center">{index === 0 ? `${insight?.badMissPct ?? 0}%` : ''}</TableCell>
                      <TableCell className="whitespace-nowrap">{index === 0 ? [insight?.direction, insight?.distance].filter(Boolean).join(' / ') : ''}</TableCell>
                      <TableCell className="text-center">{index === 0 && insight ? <TrendIndicator value={insight.trend} /> : null}</TableCell>
                      <TableCell>{index === 0 && insight ? <ConfidenceBadge value={insight.confidence} /> : null}</TableCell>
                    </TableRow>
                  );
                }))}
                {gappingRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={17} className="py-10 text-center text-muted-foreground">No club data yet for this context.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Distance, carry, and dot indicators use the same rules as Gapping. SQI, costly miss, pattern, and trend are club-level course signals.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-orange-700" /> Reflection intelligence</CardTitle>
          <CardDescription>{analysis.reflectionSummary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {analysis.reflectionThemes.length === 0 && <EmptyCard>Add short reflections after rounds and sessions. Repeated themes will appear here.</EmptyCard>}
          {analysis.reflectionThemes.slice(0, 6).map((theme) => (
            <div key={theme.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{theme.label}</div>
                <ConfidenceBadge value={theme.confidence} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{theme.count} mentions · {theme.linkedData}</div>
              <p className="mt-2 text-sm">{theme.meaning}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
