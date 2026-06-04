import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CircleHelp, Target, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { formatPercent } from '@/lib/golfCalculations';
import { buildCourseShotGappingAssignments } from '@/lib/gapping';
import { buildRoundReview, RoundReviewArea, RoundReviewMetrics, RoundReviewRow, RoundReviewScope } from '@/lib/roundReview';
import {
  BenchmarkStatus,
  buildRoundHeadline,
  buildRoundStory,
  getBenchmarkForHcp,
  getMetricStatus,
  HCP_BENCHMARKS,
  HcpBenchmark,
  RoundReviewMetricKey,
  RoundThoughts,
} from '@/lib/roundReviewInsights';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { useShotProfiles } from '@/lib/shotProfiles';
import { ClubConfig, Shot } from '@/types/golf';

interface RoundReviewTabProps {
  shots: Shot[];
  clubs: ClubConfig[];
  distanceToTargetTolerance: number;
  roundDate: string;
  scope?: RoundReviewScope;
  thoughts?: RoundThoughts;
  onEditThoughts?: () => void;
}

type ClubSortKey = 'club' | 'shot-type' | 'power' | 'target' | 'shots' | 'quality' | 'bad-miss' | 'target-success';
type ProgressMode = 'overall' | 'tee' | 'approach' | 'short';
type MetricDefinition = {
  key: RoundReviewMetricKey;
  label: string;
  help: string;
  benchmark: number;
  value: (metrics: RoundReviewMetrics) => number | null;
  count?: (metrics: RoundReviewMetrics) => string | null;
};

const STATUS_LABELS: Record<BenchmarkStatus, string> = {
  above: 'Above target',
  'on-target': 'On target',
  watch: 'Watch',
  priority: 'Priority',
  unavailable: 'Not enough data',
};

const STATUS_CLASSES: Record<BenchmarkStatus, string> = {
  above: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
  'on-target': 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  watch: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  priority: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
  unavailable: 'border-border bg-muted text-muted-foreground',
};

const METRIC_TOLERANCE: Record<RoundReviewMetricKey, number> = {
  shotQuality: 3,
  targetSuccess: 5,
  safeShotRate: 5,
  scoringZoneSuccess: 5,
};

const formatNumber = (value: number | null) => value === null ? 'Not enough data' : `${Math.round(value)}`;
const formatMetric = (value: number | null, percent = false) => value === null ? 'Not enough data' : percent ? `${Math.round(value)}%` : `${Math.round(value)}`;
const formatShotCount = (count: number) => `${count} ${count === 1 ? 'shot' : 'shots'}`;
const trendValue = (current: number | null, comparison: number | null) => current === null || comparison === null ? null : current - comparison;

function StatusBadge({ status }: { status: BenchmarkStatus }) {
  return <Badge variant="outline" className={STATUS_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>;
}

function Trend({ current, comparison, label }: { current: number | null; comparison: number | null; label: string }) {
  const change = trendValue(current, comparison);
  if (change === null) return <span className="text-xs text-muted-foreground">Not enough rounds yet</span>;
  const Icon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : ArrowUpDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
      <Icon className="h-3.5 w-3.5" />{change > 0 ? '+' : ''}{Math.round(change)} vs {label}
    </span>
  );
}

function HeroMetricCard({ definition, round, last5, previous5, season }: {
  definition: MetricDefinition;
  round: RoundReviewMetrics;
  last5: RoundReviewMetrics;
  previous5: RoundReviewMetrics;
  season: RoundReviewMetrics;
}) {
  const value = definition.value(round);
  const status = getMetricStatus(value, definition.benchmark, METRIC_TOLERANCE[definition.key]);
  return (
    <div className={`rounded-xl border p-4 ${STATUS_CLASSES[status]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {definition.label}
          <Tooltip>
            <TooltipTrigger aria-label={`${definition.label} help`}><CircleHelp className="h-3.5 w-3.5 opacity-70" /></TooltipTrigger>
            <TooltipContent className="max-w-xs">{definition.help}</TooltipContent>
          </Tooltip>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 text-4xl font-bold tracking-tight">{value === null ? '-' : Math.round(value)}{definition.key === 'shotQuality' ? '' : '%'}</div>
      {definition.count?.(round) && <div className="mt-1 text-xs opacity-80">{definition.count(round)}</div>}
      <div className="mt-4 grid gap-1">
        <Trend current={value} comparison={definition.value(last5)} label="Last 5" />
        <Trend current={value} comparison={definition.value(previous5)} label="Previous 5" />
        <span className="text-xs opacity-75">Season avg: {formatMetric(definition.value(season), definition.key !== 'shotQuality')}</span>
      </div>
    </div>
  );
}

function StoryCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map(item => <div key={item} className="flex gap-2 text-sm leading-6"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{item}</div>)}
      </CardContent>
    </Card>
  );
}

function areaValue(area: RoundReviewArea): number | null {
  return area.round[area.primaryMetric];
}

function areaComparison(area: RoundReviewArea, period: 'last5' | 'previous5'): number | null {
  return area[period][area.primaryMetric];
}

function areaBenchmark(area: RoundReviewArea, benchmark: HcpBenchmark): number {
  if (area.key === 'tee') return benchmark.teeShotQuality;
  if (area.key === 'approach') return benchmark.greenTargetQuality;
  if (area.key === 'short') return benchmark.scoringZoneSuccess;
  if (area.primaryMetric === 'targetSuccessPct') return benchmark.targetSuccess;
  return benchmark.shotQuality;
}

function areaRead(area: RoundReviewArea, status: BenchmarkStatus): string {
  if (area.round.shotCount < 3) return 'Small sample — useful context, not a firm trend.';
  if (status === 'above') return 'A genuine strength in this round.';
  if (status === 'on-target') return 'Performed around the selected handicap standard.';
  if (status === 'watch') return 'Close enough to recover with focused work.';
  if (status === 'priority') return 'A clear practice priority from this round.';
  return 'Not enough data to interpret this area.';
}

function AreaBreakdown({ areas, benchmark }: { areas: RoundReviewArea[]; benchmark: HcpBenchmark }) {
  return (
    <Card>
      <CardHeader><CardTitle>Round Performance Breakdown</CardTitle><CardDescription>Golf-domain view of what shaped the round.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {areas.map(area => {
          const target = areaBenchmark(area, benchmark);
          const value = areaValue(area);
          const status = getMetricStatus(value, target, area.primaryMetric === 'shotQualityIndex' ? 3 : 5);
          return (
            <div key={area.key} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.4fr_.7fr_.8fr_1.5fr] md:items-center">
              <div><div className="font-semibold">{area.label}</div><div className="text-xs text-muted-foreground">{area.round.shotCount} shots · {area.description}</div></div>
              <div><div className="text-xl font-bold">{formatMetric(value, area.primaryMetric !== 'shotQualityIndex')}</div><StatusBadge status={status} /></div>
              <div className="grid gap-1"><Trend current={value} comparison={areaComparison(area, 'last5')} label="Last 5" /><Trend current={value} comparison={areaComparison(area, 'previous5')} label="Previous 5" /></div>
              <p className="text-sm text-muted-foreground">{areaRead(area, status)}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SortableHeader({ label, sortKey, activeSort, direction, onSort }: {
  label: string; sortKey: ClubSortKey; activeSort: ClubSortKey; direction: 'asc' | 'desc'; onSort: (key: ClubSortKey) => void;
}) {
  const Icon = activeSort === sortKey ? direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown;
  return <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => onSort(sortKey)}>{label}<Icon className="h-3.5 w-3.5" /></button>;
}

export function RoundReviewTab({ shots, clubs, distanceToTargetTolerance, roundDate, scope = 'round', thoughts, onEditThoughts }: RoundReviewTabProps) {
  const { gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map(session => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [benchmarkHcp, setBenchmarkHcp] = useState(gappingHcpTarget);
  const [clubSort, setClubSort] = useState<ClubSortKey>('club');
  const [clubSortDirection, setClubSortDirection] = useState<'asc' | 'desc'>('asc');
  const [progressMode, setProgressMode] = useState<ProgressMode>('overall');

  useEffect(() => setBenchmarkHcp(gappingHcpTarget), [gappingHcpTarget]);

  const gappingAssignments = useMemo(() => buildCourseShotGappingAssignments({
    profiles, shots, practiceSessions, practiceConfigs, shotsBySession, gappingHcpTarget, shotClassificationRules,
  }).shotToAssignment, [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shots, shotsBySession, shotClassificationRules]);
  const review = useMemo(
    () => buildRoundReview(shots, clubs, distanceToTargetTolerance, roundDate, gappingAssignments, scope),
    [shots, clubs, distanceToTargetTolerance, roundDate, gappingAssignments, scope]
  );
  const benchmark = getBenchmarkForHcp(benchmarkHcp);
  const story = useMemo(() => buildRoundStory(review.round, benchmark, review.clubAndTypeRows, review.greenDistanceRows, thoughts), [benchmark, review, thoughts]);
  const headline = buildRoundHeadline(review.round, benchmark, review.areas);
  const metricDefinitions: MetricDefinition[] = [
    { key: 'shotQuality', label: 'Shot Quality', help: 'How well you executed the shot.', benchmark: benchmark.shotQuality, value: metrics => metrics.shotQualityIndex },
    { key: 'targetSuccess', label: 'Target Success', help: 'Whether the ball finished on the intended fairway or green target type.', benchmark: benchmark.targetSuccess, value: metrics => metrics.targetSuccessPct, count: metrics => metrics.targetAttemptCount ? `${metrics.targetSuccessCount} / ${metrics.targetAttemptCount} intended targets achieved` : null },
    { key: 'safeShotRate', label: 'Safe Shot Rate', help: 'The percentage of shots that avoided a damaging miss.', benchmark: benchmark.safeShotRate, value: metrics => metrics.shotCount ? metrics.safeShotRate : null },
    { key: 'scoringZoneSuccess', label: 'Scoring Zone Success', help: 'How often green-target shots inside 100m reached the green.', benchmark: benchmark.scoringZoneSuccess, value: metrics => metrics.scoringZoneSuccessPct, count: metrics => metrics.scoringZoneAttemptCount ? `${metrics.scoringZoneSuccessCount} / ${metrics.scoringZoneAttemptCount} inside 100m` : null },
  ];

  if (review.round.shotCount === 0) return <Card><CardContent className="py-12 text-center text-muted-foreground">No non-putting shots recorded in this round.</CardContent></Card>;

  const sortedClubRows = [...review.clubAndTypeRows].sort((a, b) => {
    const direction = clubSortDirection === 'asc' ? 1 : -1;
    if (clubSort === 'shots') return direction * (a.round.shotCount - b.round.shotCount);
    if (clubSort === 'quality') return direction * ((a.round.shotQualityIndex ?? -1) - (b.round.shotQualityIndex ?? -1));
    if (clubSort === 'bad-miss') return direction * (a.round.badMissPct - b.round.badMissPct);
    if (clubSort === 'target-success') return direction * ((a.round.targetSuccessPct ?? -1) - (b.round.targetSuccessPct ?? -1));
    if (clubSort === 'shot-type') return direction * (a.shotTypeLabel ?? '').localeCompare(b.shotTypeLabel ?? '');
    if (clubSort === 'power') return direction * (a.powerLabel ?? '').localeCompare(b.powerLabel ?? '');
    if (clubSort === 'target') return direction * (a.targetLabel ?? '').localeCompare(b.targetLabel ?? '');
    return direction * ((a.clubSortIndex ?? Number.POSITIVE_INFINITY) - (b.clubSortIndex ?? Number.POSITIVE_INFINITY) || (a.clubLabel ?? '').localeCompare(b.clubLabel ?? ''));
  });
  const shotTypeOrder = ['Full', 'Punch', 'Pitch', 'Chip', 'Bump'];
  const clubReviewRows = [...review.clubAndTypeRows].sort((a, b) =>
    (a.clubSortIndex ?? Number.POSITIVE_INFINITY) - (b.clubSortIndex ?? Number.POSITIVE_INFINITY)
    || (a.clubLabel ?? '').localeCompare(b.clubLabel ?? '')
    || shotTypeOrder.indexOf(a.shotTypeLabel ?? '') - shotTypeOrder.indexOf(b.shotTypeLabel ?? '')
    || (a.powerLabel ?? '').localeCompare(b.powerLabel ?? '')
    || (a.targetLabel ?? '').localeCompare(b.targetLabel ?? '')
  );
  const displayedClubRows = clubSort === 'club' && clubSortDirection === 'asc' ? clubReviewRows : sortedClubRows;
  const handleClubSort = (key: ClubSortKey) => {
    if (key === clubSort) setClubSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    else { setClubSort(key); setClubSortDirection(['club', 'shot-type', 'power', 'target'].includes(key) ? 'asc' : 'desc'); }
  };
  const qualityRows = review.clubAndTypeRows.filter(row => row.round.shotQualityIndex !== null);
  const bestClub = [...qualityRows].sort((a, b) => (b.round.shotQualityIndex ?? 0) - (a.round.shotQualityIndex ?? 0))[0];
  const weakestClub = [...qualityRows].sort((a, b) => (a.round.shotQualityIndex ?? 0) - (b.round.shotQualityIndex ?? 0))[0];
  const trendRows = qualityRows.filter(row => row.last5.shotQualityIndex !== null);
  const biggestImprovement = [...trendRows].sort((a, b) => ((b.round.shotQualityIndex ?? 0) - (b.last5.shotQualityIndex ?? 0)) - ((a.round.shotQualityIndex ?? 0) - (a.last5.shotQualityIndex ?? 0)))[0];
  const biggestRegression = [...trendRows].sort((a, b) => ((a.round.shotQualityIndex ?? 0) - (a.last5.shotQualityIndex ?? 0)) - ((b.round.shotQualityIndex ?? 0) - (b.last5.shotQualityIndex ?? 0)))[0];
  const bestDistance = [...review.greenDistanceRows].filter(row => row.round.targetSuccessPct !== null).sort((a, b) => (b.round.targetSuccessPct ?? 0) - (a.round.targetSuccessPct ?? 0))[0];
  const weakDistance = [...review.greenDistanceRows].filter(row => row.round.targetSuccessPct !== null).sort((a, b) => (a.round.targetSuccessPct ?? 0) - (b.round.targetSuccessPct ?? 0))[0];
  const benchmarkOptions = [...new Set([gappingHcpTarget, ...Object.keys(HCP_BENCHMARKS).map(Number)])].sort((a, b) => b - a);
  const progressLines = progressMode === 'tee'
    ? [
        { key: 'teeShotQuality', label: 'Tee Shot Quality', color: 'hsl(var(--primary))' },
        { key: 'teeTargetSuccess', label: 'Tee Target Success', color: '#0ea5e9' },
        { key: 'teeSafeShotRate', label: 'Tee Safe Shot Rate', color: '#16a34a' },
      ]
    : progressMode === 'approach'
      ? [
          { key: 'approachShotQuality', label: 'Green Target Quality', color: 'hsl(var(--primary))' },
          { key: 'approachTargetSuccess', label: 'Green Target Success', color: '#0ea5e9' },
          { key: 'approachSafeShotRate', label: 'Safe Shot Rate', color: '#16a34a' },
        ]
      : progressMode === 'short'
        ? [
            { key: 'shortGameShotQuality', label: 'Short Game Quality', color: 'hsl(var(--primary))' },
            { key: 'shortGameScoringZoneSuccess', label: 'Scoring Zone Success', color: '#d97706' },
            { key: 'shortGameSafeShotRate', label: 'Safe Shot Rate', color: '#16a34a' },
          ]
        : [
            { key: 'shotQuality', label: 'Shot Quality', color: 'hsl(var(--primary))' },
            { key: 'targetSuccess', label: 'Target Success', color: '#0ea5e9' },
            { key: 'safeShotRate', label: 'Safe Shot Rate', color: '#16a34a' },
            { key: 'scoringZoneSuccess', label: 'Scoring Zone Success', color: '#d97706' },
          ];
  const progressReference = progressMode === 'tee'
    ? benchmark.teeShotQuality
    : progressMode === 'approach'
      ? benchmark.greenTargetQuality
      : progressMode === 'short'
        ? benchmark.scoringZoneSuccess
        : benchmark.shotQuality;

  return (
    <TooltipProvider>
      <div className="space-y-10">
        <section className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <Badge variant="outline">Round Review</Badge>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{headline}</h2>
              <p className="text-sm text-muted-foreground">{review.round.shotCount} shots analysed · {scope === 'round' ? 'Selected round' : review.label} · Benchmarking against {benchmarkHcp} HCP target</p>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{story.reflectionSummary}</p>
            </div>
            <div className="min-w-[220px] space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benchmark against</label>
              <Select value={benchmarkHcp.toString()} onValueChange={value => setBenchmarkHcp(Number(value))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{benchmarkOptions.map(hcp => <SelectItem key={hcp} value={hcp.toString()}>{hcp === gappingHcpTarget ? `Settings target · ${hcp} HCP` : `Target ${hcp} HCP`}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Status colours are relative to your selected handicap benchmark.</p>
            </div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metricDefinitions.map(definition => <HeroMetricCard key={definition.key} definition={definition} round={review.round} last5={review.last5} previous5={review.previous5} season={review.season} />)}
          </div>
        </section>

        <section className="space-y-4">
          <div><h3 className="text-xl font-semibold">Round Story</h3><p className="text-sm text-muted-foreground">The clearest strengths, costs, and next actions from this round.</p></div>
          <div className="grid gap-4 lg:grid-cols-3"><StoryCard title="What worked" items={story.worked} /><StoryCard title="What cost shots" items={story.cost} /><StoryCard title="What to practise" items={story.practise} /></div>
        </section>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div><CardTitle>Progress Over Time</CardTitle><CardDescription>Each point represents {review.progress.length === 10 ? 'one-tenth' : 'one block'} of your recorded rounds, from earliest to latest. Higher is better.</CardDescription></div>
              <div className="flex flex-wrap gap-2">
                {([['overall', 'Overall'], ['tee', 'Tee / Driving'], ['approach', 'Approach'], ['short', 'Short Game']] as Array<[ProgressMode, string]>).map(([mode, label]) => <Button key={mode} size="sm" variant={progressMode === mode ? 'default' : 'outline'} onClick={() => setProgressMode(mode)}>{label}</Button>)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {review.progress.length < 2 ? <div className="py-12 text-center text-muted-foreground">Not enough rounds yet to show progress over time.</div> : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={review.progress} margin={{ top: 12, right: 20, left: -10, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="label" /><YAxis domain={[0, 100]} unit="%" />
                  <ChartTooltip formatter={(value: number) => `${Math.round(value)}%`} /><Legend />
                  <ReferenceLine y={progressReference} stroke="hsl(var(--primary))" strokeDasharray="6 4" label={`${benchmarkHcp} HCP target`} />
                  {progressLines.map(line => <Line key={line.key} type="monotone" dataKey={line.key} name={line.label} stroke={line.color} strokeWidth={line.key.toLowerCase().includes('quality') ? 2.5 : 2} connectNulls />)}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <AreaBreakdown areas={review.areas} benchmark={benchmark} />

        <section className="space-y-4">
          <div><h3 className="text-xl font-semibold">Distance / Scoring Zone Review</h3><p className="text-sm text-muted-foreground">Where green-target opportunities were converted and where they leaked.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Within 150m', review.greenDistanceRollups.find(row => row.key === '0-150')?.round.shotCount ?? 0, 'green-target shots'],
              ['Within 100m', review.greenDistanceRollups.find(row => row.key === '0-100')?.round.shotCount ?? 0, 'scoring-zone shots'],
              ['Scoring Zone Success', review.round.scoringZoneSuccessPct === null ? '-' : `${Math.round(review.round.scoringZoneSuccessPct)}%`, `${review.round.scoringZoneSuccessCount} / ${review.round.scoringZoneAttemptCount}`],
              ['Best distance band', bestDistance?.label ?? '-', bestDistance ? formatPercent(bestDistance.round.targetSuccessPct) : 'Not enough data'],
              ['Weakest distance band', weakDistance?.label ?? '-', weakDistance ? formatPercent(weakDistance.round.targetSuccessPct) : 'Not enough data'],
            ].map(([label, value, detail]) => <Card key={label}><CardContent className="pt-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{detail}</div></CardContent></Card>)}
          </div>
          {review.distanceWarning ? <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">{review.distanceWarning}</div> : (
            <Card><CardContent className="space-y-3 pt-5">
              <div className="hidden grid-cols-[110px_1fr_100px_100px_150px] gap-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
                <div>Distance</div><div>Target Success</div><div>Shots</div><div>Success</div><div>Most Used Club</div>
              </div>
              {review.greenDistanceRows.map(row => {
                const status = getMetricStatus(row.round.targetSuccessPct, benchmark.targetSuccess, 5);
                return <div key={row.key} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[110px_1fr_100px_100px_150px] md:items-center"><div className="font-semibold">{row.label}</div><div><div className="mb-1 text-xs text-muted-foreground md:hidden">Target Success</div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full ${status === 'above' ? 'bg-green-500' : status === 'on-target' ? 'bg-blue-500' : status === 'watch' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(4, row.round.targetSuccessPct ?? 0)}%` }} /></div></div><div className="text-sm">{formatShotCount(row.round.shotCount)}</div><div className="text-sm">{formatPercent(row.round.targetSuccessPct)}</div><div className="text-xs text-muted-foreground">{row.dominantClubShotLabel ?? 'No dominant club'}{row.round.shotCount < 3 ? ' · small sample' : ''}</div></div>;
              })}
            </CardContent></Card>
          )}
        </section>

        <section className="space-y-4">
          <div><h3 className="text-xl font-semibold">Club and Shot Type Review</h3><p className="text-sm text-muted-foreground">Compact benchmark view first; sortable detail stays available below.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Best combination</div><div className="mt-1 font-semibold">{bestClub?.label ?? 'Not enough data'}</div><div className="text-sm">{formatNumber(bestClub?.round.shotQualityIndex ?? null)} quality</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Weakest combination</div><div className="mt-1 font-semibold">{weakestClub?.label ?? 'Not enough data'}</div><div className="text-sm">{formatNumber(weakestClub?.round.shotQualityIndex ?? null)} quality</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Biggest improvement vs Last 5</div><div className="mt-1 font-semibold">{biggestImprovement?.label ?? 'Not enough data'}</div><div className="text-sm">{biggestImprovement ? `${Math.round((biggestImprovement.round.shotQualityIndex ?? 0) - (biggestImprovement.last5.shotQualityIndex ?? 0)) >= 0 ? '+' : ''}${Math.round((biggestImprovement.round.shotQualityIndex ?? 0) - (biggestImprovement.last5.shotQualityIndex ?? 0))} quality` : 'Build more rounds'}</div></CardContent></Card>
            <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Biggest regression vs Last 5</div><div className="mt-1 font-semibold">{biggestRegression?.label ?? 'Not enough data'}</div><div className="text-sm">{biggestRegression ? `${Math.round((biggestRegression.round.shotQualityIndex ?? 0) - (biggestRegression.last5.shotQualityIndex ?? 0))} quality` : 'Build more rounds'}</div></CardContent></Card>
          </div>
          <Card><CardContent className="pt-5">
            <div className="hidden grid-cols-[1.5fr_.6fr_.7fr_.8fr_.8fr_.8fr_1fr] gap-3 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <SortableHeader label="Club / Shot Type" sortKey="club" activeSort={clubSort} direction={clubSortDirection} onSort={handleClubSort} /><SortableHeader label="Shots" sortKey="shots" activeSort={clubSort} direction={clubSortDirection} onSort={handleClubSort} /><SortableHeader label="Quality" sortKey="quality" activeSort={clubSort} direction={clubSortDirection} onSort={handleClubSort} /><SortableHeader label="Target Success" sortKey="target-success" activeSort={clubSort} direction={clubSortDirection} onSort={handleClubSort} /><div>Safe Shot Rate</div><SortableHeader label="Bad Miss Rate" sortKey="bad-miss" activeSort={clubSort} direction={clubSortDirection} onSort={handleClubSort} /><div>Status</div>
            </div>
            <div className="divide-y">
              {displayedClubRows.map(row => {
                const status = getMetricStatus(row.round.shotQualityIndex, benchmark.shotQuality, 3);
                return <div key={row.key} className="grid gap-3 px-3 py-4 md:grid-cols-[1.5fr_.6fr_.7fr_.8fr_.8fr_.8fr_1fr] md:items-center"><div><div className="font-semibold">{row.clubLabel} · {row.shotTypeLabel}</div><div className="text-xs text-muted-foreground">{row.powerLabel} · {row.targetLabel}{row.round.shotCount < 3 ? ' · small sample' : ''}</div></div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Shots</span>{row.round.shotCount}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Quality</span>{formatNumber(row.round.shotQualityIndex)}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Target</span>{formatPercent(row.round.targetSuccessPct)}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Safe</span>{formatPercent(row.round.safeShotRate)}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Bad Miss</span>{formatPercent(row.round.badMissPct)}</div><div><StatusBadge status={status} /></div></div>;
              })}
            </div>
          </CardContent></Card>
        </section>

        <section className="space-y-4">
          <div><h3 className="text-xl font-semibold">Lie Review</h3><p className="text-sm text-muted-foreground">Separate club problems from lie and situation problems.</p></div>
          <Card><CardContent className="pt-5">
            <div className="hidden grid-cols-[1.2fr_.7fr_.7fr_.8fr_.8fr_1fr_1.5fr] gap-3 border-b px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <div>Lie</div><div>Shots</div><div>% Total</div><div>Quality</div><div>Target Success</div><div>Safe Shot Rate</div><div>Read</div>
            </div>
            <div className="divide-y">{review.lieRows.map(row => {
              const status = getMetricStatus(row.round.shotQualityIndex, benchmark.shotQuality, 3);
              const read = row.round.shotCount < 3 ? 'Small sample — avoid over-reading this lie.' : areaRead({ round: row.round } as RoundReviewArea, status);
              return <div key={row.key} className="grid gap-3 px-3 py-4 md:grid-cols-[1.2fr_.7fr_.7fr_.8fr_.8fr_1fr_1.5fr] md:items-center"><div><div className="font-semibold">{row.label}</div><div className="mt-1 md:hidden"><StatusBadge status={status} /></div></div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Shots</span>{row.round.shotCount}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">% Total</span>{formatPercent(row.shareOfTotalPct ?? null)}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Quality</span>{formatNumber(row.round.shotQualityIndex)}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Target</span>{formatPercent(row.round.targetSuccessPct)}</div><div className="text-sm"><span className="mr-1 text-xs text-muted-foreground md:hidden">Safe</span>{formatPercent(row.round.safeShotRate)}</div><div className="text-xs text-muted-foreground"><div className="mb-1 hidden md:block"><StatusBadge status={status} /></div>{read}</div></div>;
            })}</div>
          </CardContent></Card>
        </section>

        {scope === 'round' && <Card>
          <CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Data matched your notes?</CardTitle><CardDescription>Round Thoughts are used in this interpretation.</CardDescription></div><Button variant="outline" onClick={onEditThoughts}>Edit Round Thoughts</Button></div></CardHeader>
          <CardContent className="space-y-3">{story.noteMatches.length ? story.noteMatches.map(item => <div key={item} className="flex gap-2 text-sm"><Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{item}</div>) : <p className="text-sm text-muted-foreground">Add notes about clubs, confidence, pace, or decisions to connect your reflection with the data.</p>}<div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Practice priorities generated from this round will appear in your existing practice planning workflow.</div></CardContent>
        </Card>}
      </div>
    </TooltipProvider>
  );
}
