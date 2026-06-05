import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { 
  formatPercent,
  formatDistance,
} from '@/lib/golfCalculations';
import { getRatingColor } from '@/lib/clubRatings';
import { buildReportGappingAnalysis } from '@/lib/reportGappingShots';
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
  ZAxis
} from 'recharts';
import { GitCompare, Award, Zap } from 'lucide-react';

type AnalysisMode = 'shot' | 'club';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--destructive))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(262, 83%, 58%)',
  'hsl(25, 95%, 53%)',
];

function RatingBadge({ score, label }: { score: number; label: string }) {
  const colorClass = getRatingColor(score);
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function ReportsComparative() {
  const { clubs, shots, distanceToTargetTolerance, gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('shot');
  const [shot1, setShot1] = useState<string>('');
  const [shot2, setShot2] = useState<string>('');

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

  const analysisData = analysisMode === 'shot' ? analysis.shots : analysis.clubRollups;
  const selectOptions = analysisMode === 'shot'
    ? analysis.catalogueOptions.filter((option) => analysis.shots.some((row) => row.key === option.key))
    : analysis.clubRollups.map((club) => ({ key: club.key, label: club.label }));

  // Get data for selected shots for comparison
  const compareData = useMemo(() => {
    if (!shot1 || !shot2) return null;
    
    const data1 = analysisData.find(c => c.key === shot1);
    const data2 = analysisData.find(c => c.key === shot2);
    
    if (!data1 || !data2) return null;
    
    return { item1: data1, item2: data2 };
  }, [analysisData, shot1, shot2]);

  // Prepare radar data for comparison
  const radarData = useMemo(() => {
    if (!compareData) return [];
    
    const { item1: c1, item2: c2 } = compareData;
    
    return [
      { metric: 'On-Target', [c1.label]: c1.metrics.onTargetPct, [c2.label]: c2.metrics.onTargetPct },
      { metric: 'Control', [c1.label]: Math.max(0, 100 - c1.metrics.badMissPct * 5), [c2.label]: Math.max(0, 100 - c2.metrics.badMissPct * 5) },
      { metric: 'Consistency', [c1.label]: Math.max(0, 100 - c1.metrics.sideVariation * 5), [c2.label]: Math.max(0, 100 - c2.metrics.sideVariation * 5) },
      { metric: 'Strike', [c1.label]: c1.metrics.strikeCentrePct, [c2.label]: c2.metrics.strikeCentrePct },
      { metric: 'Capability', [c1.label]: c1.ratings.capability, [c2.label]: c2.ratings.capability },
    ];
  }, [compareData]);

  // Prepare scatter data for all Gapping shots / club roll-ups
  const scatterData = useMemo(() => {
    return analysisData.map(item => ({
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
    }));
  }, [analysisData]);

  // Rankings data
  const rankingsData = useMemo(() => {
    return [...analysisData].sort((a, b) => b.ratings.capability - a.ratings.capability);
  }, [analysisData]);

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
      {/* Shot Selector for Comparison */}
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
              <label className="text-sm font-medium">View:</label>
              <Select value={analysisMode} onValueChange={(value) => { setAnalysisMode(value as AnalysisMode); setShot1(''); setShot2(''); }}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shot">Gapping Shots</SelectItem>
                  <SelectItem value="club">Club Roll-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{analysisMode === 'shot' ? 'Shot 1:' : 'Club 1:'}</label>
              <Select value={shot1} onValueChange={setShot1}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder={analysisMode === 'shot' ? 'Select shot' : 'Select club'} />
                </SelectTrigger>
                <SelectContent>
                  {selectOptions.map(option => (
                    <SelectItem key={option.key} value={option.key} disabled={option.key === shot2}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-muted-foreground font-bold">vs</span>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">{analysisMode === 'shot' ? 'Shot 2:' : 'Club 2:'}</label>
              <Select value={shot2} onValueChange={setShot2}>
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder={analysisMode === 'shot' ? 'Select shot' : 'Select club'} />
                </SelectTrigger>
                <SelectContent>
                  {selectOptions.map(option => (
                    <SelectItem key={option.key} value={option.key} disabled={option.key === shot1}>{option.label}</SelectItem>
                  ))}
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
            {analysis.unmatchedShots.length > 0 && (
              <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
                Some historical shots are not linked to current Gapping shot definitions ({analysis.unmatchedShots.length}).
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Head-to-Head Comparison */}
      {compareData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
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
                  <Radar 
                    name={compareData.item1.label}
                    dataKey={compareData.item1.label}
                    stroke={CHART_COLORS[0]}
                    fill={CHART_COLORS[0]}
                    fillOpacity={0.3}
                  />
                  <Radar 
                    name={compareData.item2.label}
                    dataKey={compareData.item2.label}
                    stroke={CHART_COLORS[1]}
                    fill={CHART_COLORS[1]}
                    fillOpacity={0.3}
                  />
                  <Legend />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))' 
                    }} 
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Side by Side Ratings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ratings Comparison</CardTitle>
              <CardDescription>Performance scores side-by-side</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                {/* Shot 1 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-center" style={{ color: CHART_COLORS[0] }}>
                    {compareData.item1.label}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <RatingBadge score={compareData.item1.ratings.capability} label="Capability" />
                    <RatingBadge score={compareData.item1.ratings.consistency} label="Consistency" />
                    <RatingBadge score={compareData.item1.ratings.currentForm} label="Form" />
                    <div className="text-center">
                      <div className="text-2xl font-bold">{compareData.item1.metrics.shotCount}</div>
                      <div className="text-xs text-muted-foreground">Shots</div>
                    </div>
                  </div>
                </div>

                {/* Shot 2 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-center" style={{ color: CHART_COLORS[1] }}>
                    {compareData.item2.label}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <RatingBadge score={compareData.item2.ratings.capability} label="Capability" />
                    <RatingBadge score={compareData.item2.ratings.consistency} label="Consistency" />
                    <RatingBadge score={compareData.item2.ratings.currentForm} label="Form" />
                    <div className="text-center">
                      <div className="text-2xl font-bold">{compareData.item2.metrics.shotCount}</div>
                      <div className="text-xs text-muted-foreground">Shots</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Comparison Table */}
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
                    ].map(row => {
                      const winner = row.higherBetter 
                        ? (row.v1 > row.v2 ? 1 : row.v2 > row.v1 ? 2 : 0)
                        : (row.v1 < row.v2 ? 1 : row.v2 < row.v1 ? 2 : 0);
                      
                      return (
                        <tr key={row.label}>
                          <td className="font-medium">{row.label}</td>
                          <td className={`text-center ${winner === 1 ? 'font-bold' : ''}`} style={winner === 1 ? { color: CHART_COLORS[0] } : {}}>
                            {row.format(row.v1)}
                          </td>
                          <td className={`text-center ${winner === 2 ? 'font-bold' : ''}`} style={winner === 2 ? { color: CHART_COLORS[1] } : {}}>
                            {row.format(row.v2)}
                          </td>
                          <td className="text-center">
                            {winner === 1 ? compareData.item1.label : winner === 2 ? compareData.item2.label : 'Tie'}
                          </td>
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

      {/* Shot Performance Matrix */}
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
              <XAxis 
                type="number" 
                dataKey="x" 
                name="On-Target %" 
                domain={[0, 100]} 
                className="text-xs"
                label={{ value: 'On-Target %', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Capability" 
                domain={[0, 100]} 
                className="text-xs"
                label={{ value: 'Capability', angle: -90, position: 'insideLeft' }}
              />
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
                      <p className="text-sm text-muted-foreground">Shot count: {data.z}</p>
                      <p className="text-sm text-muted-foreground">On-target: {data.x.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Bad miss: {data.badMiss.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Average distance: {formatDistance(data.avgDistance)}</p>
                      <p className="text-sm text-muted-foreground">Side variation: {formatDistance(data.sideVariation)}</p>
                      <p className="text-sm text-muted-foreground">Strike: {data.strike.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
              <Scatter 
                data={scatterData} 
                fill="hsl(var(--primary))"
              >
                {scatterData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Shot Rankings */}
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
                {rankingsData.map((club, idx) => (
                  <tr key={club.key}>
                    <td className="font-bold text-lg">#{idx + 1}</td>
                    <td>
                      <div className="font-medium">{club.label}</div>
                      {analysisMode === 'shot' && <div className="text-xs text-muted-foreground">{club.clubLabel} · {club.shotLabel} · {club.powerLabel}</div>}
                    </td>
                    <td>{club.metrics.shotCount}</td>
                    <td>
                      <span className={getRatingColor(club.ratings.capability)}>{club.ratings.capability}</span>
                    </td>
                    <td>
                      <span className={getRatingColor(club.ratings.consistency)}>{club.ratings.consistency}</span>
                    </td>
                    <td>
                      <span className={getRatingColor(club.ratings.currentForm)}>{club.ratings.currentForm}</span>
                    </td>
                    <td>{formatPercent(club.metrics.onTargetPct)}</td>
                    <td>{formatPercent(club.metrics.badMissPct)}</td>
                    <td>{formatDistance(club.metrics.sideVariation)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
