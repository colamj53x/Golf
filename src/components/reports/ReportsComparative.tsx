import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useGolfData } from '@/context/GolfDataContext';
import { 
  processShot, 
  calculateMetrics, 
  getClubConfigId,
  formatPercent,
  formatDistance,
  MetricsResult
} from '@/lib/golfCalculations';
import { calculateClubRatings, ClubRatings, getRatingColor } from '@/lib/clubRatings';
import { ProcessedShot, ClubConfig } from '@/types/golf';
import { 
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis
} from 'recharts';
import { GitCompare, Target, Award, TrendingUp, Zap } from 'lucide-react';

interface ClubCompareData {
  clubName: string;
  config: ClubConfig | undefined;
  shots: ProcessedShot[];
  ratings: ClubRatings;
  metrics: MetricsResult;
}

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
  const { clubs, shots, availableClubs, distanceToTargetTolerance } = useGolfData();
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [club1, setClub1] = useState<string>('');
  const [club2, setClub2] = useState<string>('');

  // Process data for all clubs
  const allClubsData = useMemo(() => {
    if (shots.length === 0) return [];

    return availableClubs.map(clubName => {
      const clubShots = shots.filter(s => s.club === clubName);
      if (clubShots.length < 3) return null;

      const configId = getClubConfigId(clubName);
      const config = clubs.find(c => c.id === configId);

      const processed: ProcessedShot[] = clubShots.map(shot => 
        processShot(shot, config, distanceToTargetTolerance)
      );

      const data: ClubCompareData = {
        clubName,
        config,
        shots: processed,
        ratings: calculateClubRatings(processed, config),
        metrics: calculateMetrics(processed, config),
      };

      return data;
    }).filter((d): d is ClubCompareData => d !== null);
  }, [shots, availableClubs, clubs, distanceToTargetTolerance]);

  // Get data for selected clubs for comparison
  const compareData = useMemo(() => {
    if (!club1 || !club2) return null;
    
    const data1 = allClubsData.find(c => c.clubName === club1);
    const data2 = allClubsData.find(c => c.clubName === club2);
    
    if (!data1 || !data2) return null;
    
    return { club1: data1, club2: data2 };
  }, [allClubsData, club1, club2]);

  // Prepare radar data for comparison
  const radarData = useMemo(() => {
    if (!compareData) return [];
    
    const { club1: c1, club2: c2 } = compareData;
    
    return [
      { metric: 'Accuracy', [c1.clubName]: c1.metrics.onTargetPct, [c2.clubName]: c2.metrics.onTargetPct },
      { metric: 'Control', [c1.clubName]: Math.max(0, 100 - c1.metrics.badMissPct * 5), [c2.clubName]: Math.max(0, 100 - c2.metrics.badMissPct * 5) },
      { metric: 'Consistency', [c1.clubName]: Math.max(0, 100 - c1.metrics.sideVariation * 5), [c2.clubName]: Math.max(0, 100 - c2.metrics.sideVariation * 5) },
      { metric: 'Strike', [c1.clubName]: c1.metrics.strikeCentrePct, [c2.clubName]: c2.metrics.strikeCentrePct },
      { metric: 'Capability', [c1.clubName]: c1.ratings.capability, [c2.clubName]: c2.ratings.capability },
    ];
  }, [compareData]);

  // Prepare scatter data for all clubs
  const scatterData = useMemo(() => {
    return allClubsData.map(club => ({
      x: club.metrics.onTargetPct,
      y: club.ratings.capability,
      z: club.metrics.shotCount,
      name: club.clubName,
      badMiss: club.metrics.badMissPct,
    }));
  }, [allClubsData]);

  // Rankings data
  const rankingsData = useMemo(() => {
    return [...allClubsData].sort((a, b) => b.ratings.capability - a.ratings.capability);
  }, [allClubsData]);

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
      {/* Club Selector for Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Head-to-Head Comparison
          </CardTitle>
          <CardDescription>Select two clubs to compare side-by-side</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Club 1:</label>
              <Select value={club1} onValueChange={setClub1}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  {availableClubs.map(club => (
                    <SelectItem key={club} value={club} disabled={club === club2}>{club}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-muted-foreground font-bold">vs</span>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Club 2:</label>
              <Select value={club2} onValueChange={setClub2}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  {availableClubs.map(club => (
                    <SelectItem key={club} value={club} disabled={club === club1}>{club}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(club1 || club2) && (
              <Button variant="ghost" size="sm" onClick={() => { setClub1(''); setClub2(''); }}>
                Clear
              </Button>
            )}
          </div>
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
                    name={compareData.club1.clubName}
                    dataKey={compareData.club1.clubName}
                    stroke={CHART_COLORS[0]}
                    fill={CHART_COLORS[0]}
                    fillOpacity={0.3}
                  />
                  <Radar 
                    name={compareData.club2.clubName}
                    dataKey={compareData.club2.clubName}
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
                {/* Club 1 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-center" style={{ color: CHART_COLORS[0] }}>
                    {compareData.club1.clubName}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <RatingBadge score={compareData.club1.ratings.capability} label="Capability" />
                    <RatingBadge score={compareData.club1.ratings.consistency} label="Consistency" />
                    <RatingBadge score={compareData.club1.ratings.currentForm} label="Form" />
                    <div className="text-center">
                      <div className="text-2xl font-bold">{compareData.club1.metrics.shotCount}</div>
                      <div className="text-xs text-muted-foreground">Shots</div>
                    </div>
                  </div>
                </div>

                {/* Club 2 */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-center" style={{ color: CHART_COLORS[1] }}>
                    {compareData.club2.clubName}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <RatingBadge score={compareData.club2.ratings.capability} label="Capability" />
                    <RatingBadge score={compareData.club2.ratings.consistency} label="Consistency" />
                    <RatingBadge score={compareData.club2.ratings.currentForm} label="Form" />
                    <div className="text-center">
                      <div className="text-2xl font-bold">{compareData.club2.metrics.shotCount}</div>
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
                      <th className="text-center" style={{ color: CHART_COLORS[0] }}>{compareData.club1.clubName}</th>
                      <th className="text-center" style={{ color: CHART_COLORS[1] }}>{compareData.club2.clubName}</th>
                      <th>Better</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'On-Target %', v1: compareData.club1.metrics.onTargetPct, v2: compareData.club2.metrics.onTargetPct, format: formatPercent, higherBetter: true },
                      { label: 'Bad Miss %', v1: compareData.club1.metrics.badMissPct, v2: compareData.club2.metrics.badMissPct, format: formatPercent, higherBetter: false },
                      { label: 'Strike Centre %', v1: compareData.club1.metrics.strikeCentrePct, v2: compareData.club2.metrics.strikeCentrePct, format: formatPercent, higherBetter: true },
                      { label: 'Side Variation', v1: compareData.club1.metrics.sideVariation, v2: compareData.club2.metrics.sideVariation, format: formatDistance, higherBetter: false },
                      { label: 'Avg Distance', v1: compareData.club1.metrics.avgDistanceHit, v2: compareData.club2.metrics.avgDistanceHit, format: formatDistance, higherBetter: true },
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
                            {winner === 1 ? compareData.club1.clubName : winner === 2 ? compareData.club2.clubName : 'Tie'}
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

      {/* Club Performance Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Club Performance Matrix
          </CardTitle>
          <CardDescription>Accuracy vs Capability for all clubs (bubble size = shot count)</CardDescription>
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
                      <p className="text-sm text-muted-foreground">On-Target: {data.x.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Capability: {data.y}</p>
                      <p className="text-sm text-muted-foreground">Shots: {data.z}</p>
                      <p className="text-sm text-muted-foreground">Bad Miss: {data.badMiss.toFixed(1)}%</p>
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

      {/* Club Rankings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            Club Rankings
          </CardTitle>
          <CardDescription>All clubs ranked by capability score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Club</th>
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
                  <tr key={club.clubName}>
                    <td className="font-bold text-lg">#{idx + 1}</td>
                    <td className="font-medium">{club.clubName}</td>
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
