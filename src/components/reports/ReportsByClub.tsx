import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShotDecisionSummary } from '@/components/reports/ShotDecisionSummary';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { 
  formatPercent,
  formatDistance,
  MetricsResult
} from '@/lib/golfCalculations';
import { getRatingColor, getImprovementDisplay } from '@/lib/clubRatings';
import {
  benchmarkProfiles,
  benchmarkStatusClass,
  benchmarkStatusColor,
  buildPerformanceMapData,
  buildPerformanceSnapshot,
  buildScopedReportData,
  buildShotBenchmarkResult,
  buildReportGappingAnalysis,
  buildShotDecisionSummary,
  buildTrendSummary,
  trendMovementClass,
  type BenchmarkHcp,
  type PerformanceMapPoint,
  type PerformanceSnapshotCard,
  type ShotTrendResult,
  type TrendMetricComparison,
} from '@/lib/reportGappingShots';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { useShotProfiles } from '@/lib/shotProfiles';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Cell,
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  ZAxis,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Target, Activity, Award, Zap } from 'lucide-react';

type AnalysisMode = 'shot' | 'club';
type PeriodFilter = 'all' | '5' | '6' | '10' | '15';

const periodToRoundCount = (period: PeriodFilter): number | 'all' => period === 'all' ? 'all' : Number(period);
const BENCHMARK_OPTIONS = Object.keys(benchmarkProfiles).map(Number).sort((a, b) => b - a) as BenchmarkHcp[];

function RatingBadge({ score, label, size = 'normal' }: { score: number; label: string; size?: 'small' | 'normal' }) {
  const colorClass = getRatingColor(score);
  return (
    <div className="text-center">
      <div className={`font-bold ${colorClass} ${size === 'small' ? 'text-xl' : 'text-2xl'}`}>{score}</div>
      <div className={`text-muted-foreground ${size === 'small' ? 'text-[10px]' : 'text-xs'}`}>{label}</div>
    </div>
  );
}

function TrendIndicator({ direction }: { direction: 'up' | 'down' | 'stable' }) {
  if (direction === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (direction === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function SnapshotCard({
  card,
  selected,
  onSelect,
}: {
  card: PerformanceSnapshotCard;
  selected: boolean;
  onSelect: (shotKey: string) => void;
}) {
  const clickable = Boolean(card.shot);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => card.shot && onSelect(card.shot.key)}
      className={`rounded-xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted/30 disabled:cursor-default disabled:opacity-70 ${selected ? 'border-primary ring-2 ring-primary/20' : ''}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.title}</div>
      <div className="mt-2 text-lg font-semibold">{card.value}</div>
      {card.benchmark && (
        <div className={`mt-3 inline-flex rounded-full border px-2 py-0.5 text-xs ${benchmarkStatusClass(card.benchmark.status)}`}>
          {card.benchmark.statusLabel} vs {card.benchmark.hcp} HCP
        </div>
      )}
      <p className="mt-3 text-sm leading-5 text-muted-foreground">{card.detail}</p>
    </button>
  );
}

function PerformanceMapTooltip({ payload }: { payload?: Array<{ payload: PerformanceMapPoint }> }) {
  if (!payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="font-semibold">{data.label}</p>
      <p className="text-sm text-muted-foreground">Club: {data.clubLabel}</p>
      <p className="text-sm text-muted-foreground">Shot: {data.shotLabel}</p>
      <p className="text-sm text-muted-foreground">Power: {data.powerLabel}</p>
      <p className="text-sm text-muted-foreground">Benchmark: {data.benchmark.hcp} HCP</p>
      <p className="text-sm text-muted-foreground">Status: {data.benchmark.statusLabel}</p>
      {data.decision && <p className="text-sm text-muted-foreground">Decision: {data.decision}</p>}
      <p className="text-sm text-muted-foreground">Shots: {data.shotCount}</p>
      <p className="text-sm text-muted-foreground">On-target: {formatPercent(data.onTargetPct)}</p>
      <p className="text-sm text-muted-foreground">Bad miss: {formatPercent(data.badMissPct)}</p>
      <p className="text-sm text-muted-foreground">Side variation: {formatDistance(data.sideVariation)}</p>
      <p className="text-sm text-muted-foreground">Distance variation: {formatDistance(data.distanceVariation)}</p>
      <p className="text-sm text-muted-foreground">Strike: {formatPercent(data.strikePct)}</p>
      <p className="text-sm text-muted-foreground">Main gap: {data.benchmark.mainGap}</p>
      {data.trend && (
        <>
          <p className="text-sm text-muted-foreground">Trend: {data.trend.movementLabel}</p>
          <p className="text-sm text-muted-foreground">Main change: {data.trend.mainChange}</p>
        </>
      )}
    </div>
  );
}

function formatTrendMetricValue(metric: TrendMetricComparison, value: number): string {
  return metric.unit === 'pct' ? formatPercent(value) : formatDistance(value);
}

function formatTrendMetricChange(metric: TrendMetricComparison): string {
  if (metric.unit === 'pct') {
    const rounded = Math.round(metric.change);
    return rounded > 0 ? `+${rounded} pts` : `${rounded} pts`;
  }
  const rounded = Math.round(metric.change);
  return rounded > 0 ? `+${rounded}m` : `${rounded}m`;
}

function TrendBadge({ trend }: { trend: ShotTrendResult }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${trendMovementClass(trend.movement)}`}>
      {trend.movementLabel}
    </span>
  );
}

export function ReportsByClub() {
  const { clubs, shots, distanceToTargetTolerance, gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('shot');
  const [selectedShot, setSelectedShot] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [benchmarkHcp, setBenchmarkHcp] = useState<BenchmarkHcp>(30);

  const analysis = useMemo(() => buildReportGappingAnalysis({
    profiles,
    shots,
    clubs,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    distanceToTargetTolerance,
    shotClassificationRules,
  }), [profiles, shots, clubs, practiceSessions, practiceConfigs, shotsBySession, gappingHcpTarget, distanceToTargetTolerance, shotClassificationRules]);
  const scopedShots = useMemo(() => analysis.shots.map((row) => buildScopedReportData(row, periodToRoundCount(period))), [analysis.shots, period]);
  const scopedClubRollups = useMemo(() => analysis.clubRollups.map((row) => buildScopedReportData(row, periodToRoundCount(period))), [analysis.clubRollups, period]);
  const decisionSummary = useMemo(() => buildShotDecisionSummary(scopedShots), [scopedShots]);
  const benchmarkByShot = useMemo(() => new Map(scopedShots.map((shot) => [shot.key, buildShotBenchmarkResult(shot, benchmarkHcp)])), [scopedShots, benchmarkHcp]);
  const trendRoundCount = period === 'all' ? 10 : Number(period);

  const sourceData = analysisMode === 'shot' ? scopedShots : scopedClubRollups;
  const selectedData = useMemo(() => {
    if (selectedShot === 'all') return sourceData;
    return sourceData.filter((item) => item.key === selectedShot);
  }, [selectedShot, sourceData]);

  const selectOptions = analysisMode === 'shot'
    ? analysis.catalogueOptions.filter((option) => scopedShots.some((row) => row.key === option.key))
    : scopedClubRollups.map((club) => ({ key: club.key, label: club.label }));
  const selectedBenchmark = analysisMode === 'shot' && selectedShot !== 'all'
    ? benchmarkByShot.get(selectedShot)
    : null;
  const dashboardShots = analysisMode === 'shot' ? selectedData : scopedShots;
  const trendSourceShots = useMemo(() => {
    if (analysisMode === 'shot') {
      if (selectedShot === 'all') return analysis.shots;
      return analysis.shots.filter((shot) => shot.key === selectedShot);
    }

    if (selectedShot === 'all') return analysis.shots;
    const clubId = selectedShot.replace('club:', '');
    return analysis.shots.filter((shot) => shot.clubId === clubId);
  }, [analysis.shots, analysisMode, selectedShot]);
  const trendResults = useMemo(
    () => buildTrendSummary(trendSourceShots, benchmarkHcp, trendRoundCount),
    [benchmarkHcp, trendRoundCount, trendSourceShots],
  );
  const trendByShot = useMemo(() => new Map(trendResults.map((trend) => [trend.shot.key, trend])), [trendResults]);
  const selectedTrend = analysisMode === 'shot' && selectedShot !== 'all' ? trendByShot.get(selectedShot) ?? null : null;
  const snapshotCards = useMemo(
    () => buildPerformanceSnapshot(dashboardShots, benchmarkByShot, decisionSummary, trendByShot),
    [benchmarkByShot, dashboardShots, decisionSummary, trendByShot],
  );
  const performanceMapData = useMemo(
    () => buildPerformanceMapData(dashboardShots, benchmarkByShot, decisionSummary, trendByShot),
    [benchmarkByShot, dashboardShots, decisionSummary, trendByShot],
  );

  // Prepare chart data for selected club(s)
  const chartData = useMemo(() => {
    if (selectedData.length === 0) return [];

    // For trend chart, show the 3 periods
    return selectedData.map(item => ({
      name: item.label,
      periods: [
        { period: 'Oldest', ...item.periods.oldest },
        { period: 'Middle', ...item.periods.middle },
        { period: 'Recent', ...item.periods.mostRecent },
      ]
    }));
  }, [selectedData]);

  // Aggregate trend data for chart visualization
  const trendChartData = useMemo(() => {
    if (chartData.length === 0) return [];
    
    // If single club, show its trend
    if (chartData.length === 1) {
      return chartData[0].periods;
    }
    
    // If all clubs, show average across clubs
    const periods = ['Oldest', 'Middle', 'Recent'];
    return periods.map((period, idx) => {
      const metrics = chartData.map(c => c.periods[idx]);
      const avg = (key: keyof MetricsResult) => {
        const values = metrics.map(m => m[key] as number).filter(v => v !== null && !isNaN(v));
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      };
      
      return {
        period,
        onTargetPct: avg('onTargetPct'),
        badMissPct: avg('badMissPct'),
        strikeCentrePct: avg('strikeCentrePct'),
        sideVariation: avg('sideVariation'),
      };
    });
  }, [chartData]);

  if (shots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No shot data available.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Advanced Shot Review</h2>
        <p className="text-muted-foreground">Review each Gapping Shot by reliability, benchmark performance, and usage.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Review Controls</CardTitle>
          <CardDescription>Benchmarking changes how results are interpreted. A shot can be good for 30 HCP but still short of a 20 HCP target.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Period:</label>
              <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All rounds</SelectItem>
                  <SelectItem value="5">Last 5 rounds</SelectItem>
                  <SelectItem value="6">Last 6 rounds</SelectItem>
                  <SelectItem value="10">Last 10 rounds</SelectItem>
                  <SelectItem value="15">Last 15 rounds</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Shot:</label>
              <Select value={selectedShot} onValueChange={setSelectedShot}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder={analysisMode === 'shot' ? 'Select shot' : 'Select club'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{analysisMode === 'shot' ? 'All Gapping Shots' : 'All Clubs'}</SelectItem>
                  {selectOptions.map(option => (
                    <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Benchmark against:</label>
              <Select value={benchmarkHcp.toString()} onValueChange={(value) => setBenchmarkHcp(Number(value) as BenchmarkHcp)}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Benchmark" />
                </SelectTrigger>
                <SelectContent>
                  {BENCHMARK_OPTIONS.map((hcp) => <SelectItem key={hcp} value={hcp.toString()}>{hcp} HCP</SelectItem>)}
                  <SelectItem value="custom" disabled>Custom · coming soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">View:</label>
              <Select value={analysisMode} onValueChange={(value) => { setAnalysisMode(value as AnalysisMode); setSelectedShot('all'); }}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shot">Shot Detail</SelectItem>
                  <SelectItem value="club">Club Roll-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedData.length} {analysisMode === 'shot' ? `shot ${selectedData.length === 1 ? 'category' : 'categories'}` : `club${selectedData.length === 1 ? '' : 's'}`} · {selectedData.reduce((acc, c) => acc + c.shots.length, 0)} shots
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Shot categories are taken from your Gapping setup, so performance review matches the shots you practise.
            {analysis.unmatchedShots.length > 0 && (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                Some historical shots are not linked to current Gapping shot definitions ({analysis.unmatchedShots.length}).
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <ShotDecisionSummary
        summary={decisionSummary}
        unmatchedCount={analysis.unmatchedShots.length}
        benchmarkHcp={benchmarkHcp}
        benchmarkByShot={benchmarkByShot}
        selectedShotKey={analysisMode === 'shot' ? selectedShot : undefined}
        onSelectShot={(shotKey) => {
          setAnalysisMode('shot');
          setSelectedShot(shotKey);
        }}
      />

      <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold">Key Performance Snapshot</h3>
          <p className="text-sm text-muted-foreground">The quickest read on what is strongest, most used, and worth watching in the current view.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {snapshotCards.map((card) => (
            <SnapshotCard
              key={card.key}
              card={card}
              selected={Boolean(card.shot && selectedShot === card.shot.key)}
              onSelect={(shotKey) => {
                setAnalysisMode('shot');
                setSelectedShot(shotKey);
              }}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Visual Performance Map</CardTitle>
          <CardDescription>X-axis is on-target percentage. Y-axis is bad-miss percentage, with lower bad-miss shots shown higher.</CardDescription>
        </CardHeader>
        <CardContent>
          {performanceMapData.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              No reviewed shots yet. Add shots through Gapping and capture practice or round data to generate review insights.
            </div>
          ) : (
            <div className="relative">
              <div className="pointer-events-none absolute left-14 top-4 z-10 rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground">Reliable Zone</div>
              <div className="pointer-events-none absolute bottom-8 right-6 z-10 rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground">Watch / Priority Gap Zone</div>
              <ResponsiveContainer width="100%" height={420}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 24, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" dataKey="onTargetPct" name="On-target %" domain={[0, 100]} label={{ value: 'On-target %', position: 'insideBottom', offset: -8 }} />
                  <YAxis type="number" dataKey="badMissPct" name="Bad miss %" reversed domain={[0, 'dataMax + 5']} label={{ value: 'Bad miss %', angle: -90, position: 'insideLeft' }} />
                  <ZAxis type="number" dataKey="shotCount" range={[60, 520]} />
                  <Tooltip content={<PerformanceMapTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={performanceMapData}>
                    {performanceMapData.map((point) => (
                      <Cell key={point.key} fill={benchmarkStatusColor(point.benchmark.status)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Progression &amp; Trends</CardTitle>
              <CardDescription>
                Compares the current period with the previous equivalent period to show whether each Gapping Shot is moving forward, slipping, or staying the same.
              </CardDescription>
            </div>
            <div className="rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              Recent vs Previous · {trendRoundCount} rounds each
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {trendResults.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
              No current-period shot data available for this view.
            </div>
          ) : (
            <>
              {trendResults.every((trend) => trend.previousShots < 1) && (
                <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
                  No previous-period data available yet. Trends will sharpen once more comparable rounds are captured.
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[840px] text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Shot</th>
                      <th className="px-4 py-3 font-medium">Previous</th>
                      <th className="px-4 py-3 font-medium">Current</th>
                      <th className="px-4 py-3 font-medium">Movement</th>
                      <th className="px-4 py-3 font-medium">Main Change</th>
                      <th className="px-4 py-3 font-medium">Shots</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trendResults.map((trend) => (
                      <tr
                        key={trend.shot.key}
                        className={`border-t transition hover:bg-muted/25 ${selectedShot === trend.shot.key ? 'bg-muted/30' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-left font-semibold hover:text-primary"
                            onClick={() => {
                              setAnalysisMode('shot');
                              setSelectedShot(trend.shot.key);
                            }}
                          >
                            {trend.shot.label}
                          </button>
                          <div className="text-xs text-muted-foreground">{trend.shot.clubLabel} · {trend.shot.shotLabel} · {trend.shot.powerLabel}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${benchmarkStatusClass(trend.previousBenchmark.status)}`}>
                            {trend.previousBenchmark.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${benchmarkStatusClass(trend.currentBenchmark.status)}`}>
                            {trend.currentBenchmark.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3"><TrendBadge trend={trend} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{trend.mainChange}</td>
                        <td className="px-4 py-3 text-muted-foreground">{trend.currentShots} vs {trend.previousShots}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedTrend && (
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-semibold">{selectedTrend.shot.label} trend detail</h4>
                      <p className="text-sm text-muted-foreground">Current period compared with the previous {trendRoundCount} rounds.</p>
                    </div>
                    <TrendBadge trend={selectedTrend} />
                  </div>

                  {selectedTrend.metricComparisons.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                      Not enough comparable metrics for this shot yet.
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-lg border bg-background">
                      <table className="w-full min-w-[620px] text-sm">
                        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Metric</th>
                            <th className="px-4 py-3 font-medium">Previous Period</th>
                            <th className="px-4 py-3 font-medium">Current Period</th>
                            <th className="px-4 py-3 font-medium">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTrend.metricComparisons.map((metric) => (
                            <tr key={metric.key} className="border-t">
                              <td className="px-4 py-3 font-medium">{metric.label}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatTrendMetricValue(metric, metric.previous)}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatTrendMetricValue(metric, metric.current)}</td>
                              <td className="px-4 py-3 text-muted-foreground">{formatTrendMetricChange(metric)}</td>
                            </tr>
                          ))}
                          <tr className="border-t">
                            <td className="px-4 py-3 font-medium">Shot count</td>
                            <td className="px-4 py-3 text-muted-foreground">{selectedTrend.previousShots}</td>
                            <td className="px-4 py-3 text-muted-foreground">{selectedTrend.currentShots}</td>
                            <td className="px-4 py-3 text-muted-foreground">{selectedTrend.currentShots - selectedTrend.previousShots >= 0 ? '+' : ''}{selectedTrend.currentShots - selectedTrend.previousShots}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Detailed Evidence</h3>
          <p className="text-sm text-muted-foreground">The numbers behind the dashboard summary.</p>
        </div>

      {selectedBenchmark && (
        <Card>
          <CardHeader>
            <CardTitle>Benchmark View</CardTitle>
            <CardDescription>Benchmark: {benchmarkHcp} HCP · {selectedData[0]?.label}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-sm font-medium ${benchmarkStatusClass(selectedBenchmark.status)}`}>
                {selectedBenchmark.statusLabel}
              </span>
              <span className="text-sm text-muted-foreground">Main gap: {selectedBenchmark.mainGap}</span>
              <span className="text-sm text-muted-foreground">Strong: {selectedBenchmark.mainStrength}</span>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-5">
              {selectedBenchmark.metrics.map((metric) => (
                <div key={metric.key} className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">{metric.label}</div>
                  <div className="mt-1 font-semibold">{metric.key.includes('Variation') ? formatDistance(metric.value) : formatPercent(metric.value)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">vs {metric.higherIsBetter ? '' : '≤'}{metric.key.includes('Variation') ? formatDistance(metric.benchmark) : formatPercent(metric.benchmark)}</div>
                  <div className={`mt-2 rounded-full border px-2 py-0.5 text-xs ${benchmarkStatusClass(metric.status)}`}>{metric.status.replace('-', ' ')}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              On-Target Trend
            </CardTitle>
            <CardDescription>On-Target % across time periods</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="onTargetPct" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.3}
                  name="On-Target %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-destructive" />
              Bad Miss Trend
            </CardTitle>
            <CardDescription>Disaster shot % across time periods</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis domain={[0, 'auto']} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="badMissPct" 
                  stroke="hsl(var(--destructive))" 
                  fill="hsl(var(--destructive))" 
                  fillOpacity={0.3}
                  name="Bad Miss %"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Strike Quality Trend
            </CardTitle>
            <CardDescription>Centre strike % across time periods</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="strikeCentrePct" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--warning))' }}
                  name="Strike Centre %"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-green-500" />
              Dispersion Trend
            </CardTitle>
            <CardDescription>Side variation (lower is better)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="period" className="text-xs" />
                <YAxis domain={[0, 'auto']} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="sideVariation" 
                  stroke="hsl(var(--success))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--success))' }}
                  name="Side Variation (m)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Club Summary Cards */}
      <Card>
        <CardHeader>
          <CardTitle>{analysisMode === 'shot' ? 'Gapping Shot Performance Summary' : 'Club Performance Summary'}</CardTitle>
          <CardDescription>{analysisMode === 'shot' ? 'Ratings and key metrics for each Gapping-defined shot' : 'Club roll-up view for broader patterns'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedData.map(item => {
              const improvement = getImprovementDisplay(item.ratings.improvement);
              const benchmark = analysisMode === 'shot' ? benchmarkByShot.get(item.key) : null;
              const trendDir = item.periods.mostRecent.onTargetPct > item.periods.oldest.onTargetPct ? 'up'
                : item.periods.mostRecent.onTargetPct < item.periods.oldest.onTargetPct ? 'down' : 'stable';
              
              return (
                <Card key={item.key} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{item.label}</h4>
                        {analysisMode === 'shot' && <p className="text-xs text-muted-foreground">{item.clubLabel} · {item.shotLabel} · {item.powerLabel}</p>}
                        {benchmark && <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${benchmarkStatusClass(benchmark.status)}`}>Vs {benchmarkHcp} HCP: {benchmark.statusLabel}</div>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{item.shots.length} shots</span>
                        <TrendIndicator direction={trendDir} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <RatingBadge score={item.ratings.capability} label="Cap" size="small" />
                      <RatingBadge score={item.ratings.consistency} label="Con" size="small" />
                      <RatingBadge score={item.ratings.currentForm} label="Form" size="small" />
                      <div className="text-center">
                        <div className={`text-lg font-bold ${improvement.color}`}>{improvement.text}</div>
                        <div className="text-[10px] text-muted-foreground">Trend</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">On-Target:</span>
                        <span className="font-medium">{formatPercent(item.last5Rounds.onTargetPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bad Miss:</span>
                        <span className="font-medium">{formatPercent(item.last5Rounds.badMissPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Dist:</span>
                        <span className="font-medium">{formatDistance(item.last5Rounds.avgDistanceHit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Side Var:</span>
                        <span className="font-medium">{formatDistance(item.last5Rounds.sideVariation)}</span>
                      </div>
                      {benchmark && (
                        <div className="col-span-2 flex justify-between">
                          <span className="text-muted-foreground">Main Gap:</span>
                          <span className="font-medium">{benchmark.mainGap}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
      </section>
    </div>
  );
}
