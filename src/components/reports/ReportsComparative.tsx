import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ShotDecisionSummary } from '@/components/reports/ShotDecisionSummary';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { formatDistance, formatPercent } from '@/lib/golfCalculations';
import { getRatingColor } from '@/lib/clubRatings';
import {
  benchmarkProfiles,
  benchmarkStatusClass,
  benchmarkStatusColor,
  buildReportGappingAnalysis,
  buildScopedReportData,
  buildShotBenchmarkResult,
  buildShotDecisionSummary,
  type BenchmarkHcp,
} from '@/lib/reportGappingShots';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { useShotProfiles } from '@/lib/shotProfiles';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { GitCompare, Award, Zap } from 'lucide-react';

type AnalysisMode = 'shot' | 'club';
type PeriodFilter = 'all' | '5' | '6' | '10' | '15';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(262, 83%, 58%)',
  'hsl(25, 95%, 53%)',
];

const BENCHMARK_OPTIONS = Object.keys(benchmarkProfiles).map(Number).sort((a, b) => b - a) as BenchmarkHcp[];
const periodToRoundCount = (period: PeriodFilter): number | 'all' => period === 'all' ? 'all' : Number(period);

function RatingBadge({ score, label }: { score: number; label: string }) {
  const colorClass = getRatingColor(score);
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function metricBenchmarkText(data: {
  benchmark?: ReturnType<typeof buildShotBenchmarkResult>;
}, key: string, prefix = 'vs') {
  const metric = data.benchmark?.metrics.find((item) => item.key === key);
  if (!metric) return '';
  const value = key.includes('Variation') ? formatDistance(metric.benchmark) : formatPercent(metric.benchmark);
  return ` ${prefix} ${metric.higherIsBetter ? '' : '≤'}${value}`;
}

export function ReportsComparative() {
  const { clubs, shots, distanceToTargetTolerance, gappingReliablePercent } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('shot');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [benchmarkHcp, setBenchmarkHcp] = useState<BenchmarkHcp>(30);
  const [shot1, setShot1] = useState<string>('');
  const [shot2, setShot2] = useState<string>('');
  const [focusedShot, setFocusedShot] = useState<string>('');

  const analysis = useMemo(() => buildReportGappingAnalysis({
    profiles,
    shots,
    clubs,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingReliablePercent,
    distanceToTargetTolerance,
    shotClassificationRules,
  }), [profiles, shots, clubs, practiceSessions, practiceConfigs, shotsBySession, gappingReliablePercent, distanceToTargetTolerance, shotClassificationRules]);

  const scopedShots = useMemo(() => analysis.shots.map((row) => buildScopedReportData(row, periodToRoundCount(period))), [analysis.shots, period]);
  const scopedClubRollups = useMemo(() => analysis.clubRollups.map((row) => buildScopedReportData(row, periodToRoundCount(period))), [analysis.clubRollups, period]);
  const decisionSummary = useMemo(() => buildShotDecisionSummary(scopedShots), [scopedShots]);
  const benchmarkByShot = useMemo(() => new Map(scopedShots.map((shot) => [shot.key, buildShotBenchmarkResult(shot, benchmarkHcp)])), [scopedShots, benchmarkHcp]);

  const analysisData = analysisMode === 'shot' ? scopedShots : scopedClubRollups;
  const visibleAnalysisData = focusedShot && analysisMode === 'shot'
    ? analysisData.filter((item) => item.key === focusedShot)
    : analysisData;
  const selectOptions = analysisMode === 'shot'
    ? analysis.catalogueOptions.filter((option) => scopedShots.some((row) => row.key === option.key))
    : scopedClubRollups.map((club) => ({ key: club.key, label: club.label }));

  const compareData = useMemo(() => {
    if (!shot1 || !shot2) return null;
    const data1 = analysisData.find((item) => item.key === shot1);
    const data2 = analysisData.find((item) => item.key === shot2);
    if (!data1 || !data2) return null;
    return { item1: data1, item2: data2 };
  }, [analysisData, shot1, shot2]);

  const radarData = useMemo(() => {
    if (!compareData) return [];
    const { item1, item2 } = compareData;
    return [
      { metric: 'On-Target', [item1.label]: item1.metrics.onTargetPct, [item2.label]: item2.metrics.onTargetPct },
      { metric: 'Control', [item1.label]: Math.max(0, 100 - item1.metrics.badMissPct * 5), [item2.label]: Math.max(0, 100 - item2.metrics.badMissPct * 5) },
      { metric: 'Consistency', [item1.label]: Math.max(0, 100 - item1.metrics.sideVariation * 5), [item2.label]: Math.max(0, 100 - item2.metrics.sideVariation * 5) },
      { metric: 'Strike', [item1.label]: item1.metrics.strikeCentrePct, [item2.label]: item2.metrics.strikeCentrePct },
      { metric: 'Capability', [item1.label]: item1.ratings.capability, [item2.label]: item2.ratings.capability },
    ];
  }, [compareData]);

  const scatterData = useMemo(() => visibleAnalysisData.map((item) => ({
    x: item.metrics.onTargetPct,
    y: item.ratings.capability,
    z: item.metrics.shotCount,
    name: item.label,
    club: item.clubLabel,
    shot: item.shotLabel,
    power: item.powerLabel,
    badMiss: item.metrics.badMissPct,
    avgDistance: item.metrics.avgDistanceHit,
    sideVariation: item.metrics.sideVariation,
    strike: item.metrics.strikeCentrePct,
    benchmark: benchmarkByShot.get(item.key),
  })), [benchmarkByShot, visibleAnalysisData]);

  const rankingsData = useMemo(() => [...visibleAnalysisData].sort((a, b) => b.ratings.capability - a.ratings.capability), [visibleAnalysisData]);

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Head-to-Head Comparison
          </CardTitle>
          <CardDescription>Select two {analysisMode === 'shot' ? 'Gapping shots' : 'club roll-ups'} to compare side-by-side</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Period:</label>
              <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Select period" /></SelectTrigger>
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
              <label className="text-sm font-medium">View:</label>
              <Select value={analysisMode} onValueChange={(value) => { setAnalysisMode(value as AnalysisMode); setShot1(''); setShot2(''); setFocusedShot(''); }}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Select view" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="shot">Gapping Shots</SelectItem>
                  <SelectItem value="club">Club Roll-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{analysisMode === 'shot' ? 'Shot 1:' : 'Club 1:'}</label>
              <Select value={shot1} onValueChange={setShot1}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder={analysisMode === 'shot' ? 'Select shot' : 'Select club'} /></SelectTrigger>
                <SelectContent>
                  {selectOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key} disabled={option.key === shot2}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-muted-foreground font-bold">vs</span>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{analysisMode === 'shot' ? 'Shot 2:' : 'Club 2:'}</label>
              <Select value={shot2} onValueChange={setShot2}>
                <SelectTrigger className="w-[240px]"><SelectValue placeholder={analysisMode === 'shot' ? 'Select shot' : 'Select club'} /></SelectTrigger>
                <SelectContent>
                  {selectOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key} disabled={option.key === shot1}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Benchmark against:</label>
              <Select value={benchmarkHcp.toString()} onValueChange={(value) => setBenchmarkHcp(Number(value) as BenchmarkHcp)}>
                <SelectTrigger className="w-[170px]"><SelectValue placeholder="Benchmark" /></SelectTrigger>
                <SelectContent>
                  {BENCHMARK_OPTIONS.map((hcp) => <SelectItem key={hcp} value={hcp.toString()}>{hcp} HCP</SelectItem>)}
                  <SelectItem value="custom" disabled>Custom · coming soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(shot1 || shot2) && (
              <Button variant="ghost" size="sm" onClick={() => { setShot1(''); setShot2(''); }}>
                Clear
              </Button>
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Shot categories are taken from your Gapping setup, so performance review matches the shots you practise.
            <span className="ml-2">Benchmarking changes how results are interpreted. A shot can be good for 30 HCP but still short of a 20 HCP target.</span>
            {analysis.unmatchedShots.length > 0 && (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                Some historical shots are not linked to current Gapping shot definitions ({analysis.unmatchedShots.length}).
              </span>
            )}
          </p>
          {focusedShot && analysisMode === 'shot' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Focused on {analysisData.find((item) => item.key === focusedShot)?.label ?? 'selected shot'}.</span>
              <Button variant="ghost" size="sm" onClick={() => setFocusedShot('')}>Show all shots</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ShotDecisionSummary
        summary={decisionSummary}
        unmatchedCount={analysis.unmatchedShots.length}
        benchmarkHcp={benchmarkHcp}
        benchmarkByShot={benchmarkByShot}
        selectedShotKey={focusedShot}
        onSelectShot={(shotKey) => {
          setAnalysisMode('shot');
          setFocusedShot(shotKey);
          if (!shot1) setShot1(shotKey);
        }}
      />

      {compareData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Profile</CardTitle>
              <CardDescription>Multi-dimensional comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-muted" />
                  <PolarAngleAxis dataKey="metric" className="text-xs" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} className="text-xs" />
                  <Radar name={compareData.item1.label} dataKey={compareData.item1.label} stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} />
                  <Radar name={compareData.item2.label} dataKey={compareData.item2.label} stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.3} />
                  <Legend />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ratings Comparison</CardTitle>
              <CardDescription>Performance scores side-by-side</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {[compareData.item1, compareData.item2].map((item, index) => (
                  <div key={item.key} className="space-y-4">
                    <h4 className="font-semibold text-center" style={{ color: CHART_COLORS[index] }}>{item.label}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <RatingBadge score={item.ratings.capability} label="Capability" />
                      <RatingBadge score={item.ratings.consistency} label="Consistency" />
                      <RatingBadge score={item.ratings.currentForm} label="Form" />
                      <div className="text-center">
                        <div className="text-2xl font-bold">{item.metrics.shotCount}</div>
                        <div className="text-xs text-muted-foreground">Shots</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th className="text-center" style={{ color: CHART_COLORS[0] }}>{compareData.item1.label}</th>
                      <th className="text-center" style={{ color: CHART_COLORS[1] }}>{compareData.item2.label}</th>
                      <th>Better</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'On-Target %', v1: compareData.item1.metrics.onTargetPct, v2: compareData.item2.metrics.onTargetPct, format: formatPercent, higherBetter: true },
                      { label: 'Bad Miss %', v1: compareData.item1.metrics.badMissPct, v2: compareData.item2.metrics.badMissPct, format: formatPercent, higherBetter: false },
                      { label: 'Strike Centre %', v1: compareData.item1.metrics.strikeCentrePct, v2: compareData.item2.metrics.strikeCentrePct, format: formatPercent, higherBetter: true },
                      { label: 'Side Variation', v1: compareData.item1.metrics.sideVariation, v2: compareData.item2.metrics.sideVariation, format: formatDistance, higherBetter: false },
                      { label: 'Avg Distance', v1: compareData.item1.metrics.avgDistanceHit, v2: compareData.item2.metrics.avgDistanceHit, format: formatDistance, higherBetter: true },
                    ].map((row) => {
                      const winner = row.higherBetter
                        ? (row.v1 > row.v2 ? 1 : row.v2 > row.v1 ? 2 : 0)
                        : (row.v1 < row.v2 ? 1 : row.v2 < row.v1 ? 2 : 0);
                      return (
                        <tr key={row.label}>
                          <td className="font-medium">{row.label}</td>
                          <td className={`text-center ${winner === 1 ? 'font-bold' : ''}`} style={winner === 1 ? { color: CHART_COLORS[0] } : {}}>{row.format(row.v1)}</td>
                          <td className={`text-center ${winner === 2 ? 'font-bold' : ''}`} style={winner === 2 ? { color: CHART_COLORS[1] } : {}}>{row.format(row.v2)}</td>
                          <td className="text-center">{winner === 1 ? compareData.item1.label : winner === 2 ? compareData.item2.label : 'Tie'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            {analysisMode === 'shot' ? 'Gapping Shot Performance Matrix' : 'Club Performance Matrix'}
          </CardTitle>
          <CardDescription>On-target percentage vs capability (bubble size = shot count)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" dataKey="x" name="On-Target %" domain={[0, 100]} className="text-xs" label={{ value: 'On-Target %', position: 'insideBottom', offset: -5 }} />
              <YAxis type="number" dataKey="y" name="Capability" domain={[0, 100]} className="text-xs" label={{ value: 'Capability', angle: -90, position: 'insideLeft' }} />
              <ZAxis type="number" dataKey="z" range={[50, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ payload }) => {
                  if (!payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{data.name}</p>
                      <p className="text-sm text-muted-foreground">Club: {data.club}</p>
                      <p className="text-sm text-muted-foreground">Shot: {data.shot}</p>
                      <p className="text-sm text-muted-foreground">Power: {data.power}</p>
                      {data.benchmark && (
                        <>
                          <p className="text-sm text-muted-foreground">Benchmark: {data.benchmark.hcp} HCP</p>
                          <p className="text-sm text-muted-foreground">Status: {data.benchmark.statusLabel}</p>
                        </>
                      )}
                      <p className="text-sm text-muted-foreground">Shot count: {data.z}</p>
                      <p className="text-sm text-muted-foreground">On-target: {data.x.toFixed(1)}%{metricBenchmarkText(data, 'onTargetPct')}</p>
                      <p className="text-sm text-muted-foreground">Bad miss: {data.badMiss.toFixed(1)}%{metricBenchmarkText(data, 'badMissPct')}</p>
                      <p className="text-sm text-muted-foreground">Average distance: {formatDistance(data.avgDistance)}</p>
                      <p className="text-sm text-muted-foreground">Side variation: {formatDistance(data.sideVariation)}{metricBenchmarkText(data, 'sideVariationM')}</p>
                      <p className="text-sm text-muted-foreground">Strike: {data.strike.toFixed(1)}%</p>
                      {data.benchmark && <p className="text-sm text-muted-foreground">Main gap: {data.benchmark.mainGap}</p>}
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData} fill="hsl(var(--primary))">
                {scatterData.map((item, index) => (
                  <Cell key={`cell-${index}`} fill={item.benchmark ? benchmarkStatusColor(item.benchmark.status) : CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            {analysisMode === 'shot' ? 'Gapping Shot Rankings' : 'Club Rankings'}
          </CardTitle>
          <CardDescription>{analysisMode === 'shot' ? 'Valid Gapping-defined shots ranked by capability score' : 'Club roll-ups ranked by capability score'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>{analysisMode === 'shot' ? 'Gapping Shot' : 'Club'}</th>
                  {analysisMode === 'shot' && <th>Vs Benchmark</th>}
                  {analysisMode === 'shot' && <th>Main Gap</th>}
                  <th>Shots</th>
                  <th>Capability</th>
                  <th>Consistency</th>
                  <th>Form</th>
                  <th>On-Target %</th>
                  <th>Bad Miss %</th>
                  <th>Side Var</th>
                </tr>
              </thead>
              <tbody>
                {rankingsData.map((club, idx) => {
                  const benchmark = analysisMode === 'shot' ? benchmarkByShot.get(club.key) : null;
                  return (
                    <tr key={club.key}>
                      <td className="font-bold text-lg">#{idx + 1}</td>
                      <td>
                        <div className="font-medium">{club.label}</div>
                        {analysisMode === 'shot' && <div className="text-xs text-muted-foreground">{club.clubLabel} · {club.shotLabel} · {club.powerLabel}</div>}
                      </td>
                      {analysisMode === 'shot' && <td>{benchmark && <span className={`rounded-full border px-2 py-0.5 text-xs ${benchmarkStatusClass(benchmark.status)}`}>{benchmark.statusLabel}</span>}</td>}
                      {analysisMode === 'shot' && <td>{benchmark?.mainGap ?? '-'}</td>}
                      <td>{club.metrics.shotCount}</td>
                      <td><span className={getRatingColor(club.ratings.capability)}>{club.ratings.capability}</span></td>
                      <td><span className={getRatingColor(club.ratings.consistency)}>{club.ratings.consistency}</span></td>
                      <td><span className={getRatingColor(club.ratings.currentForm)}>{club.ratings.currentForm}</span></td>
                      <td>{formatPercent(club.metrics.onTargetPct)}</td>
                      <td>{formatPercent(club.metrics.badMissPct)}</td>
                      <td>{formatDistance(club.metrics.sideVariation)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
