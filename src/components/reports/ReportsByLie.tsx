import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useGolfData } from '@/context/GolfDataContext';
import { 
  processShot, 
  calculateMetrics, 
  getClubConfigId,
  formatPercent,
  formatDistance,
  MetricsResult
} from '@/lib/golfCalculations';
import { ProcessedShot } from '@/types/golf';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import { Layers, Target, Activity, Percent } from 'lucide-react';

interface LieData {
  lie: string;
  shots: ProcessedShot[];
  metrics: MetricsResult;
  percentage: number;
}

const CHART_COLORS = [
  'hsl(142, 76%, 36%)', // Green for Fairway
  'hsl(48, 96%, 53%)',  // Yellow for Rough
  'hsl(221, 83%, 53%)', // Blue for Tee
  'hsl(262, 83%, 58%)', // Purple for Bunker
  'hsl(0, 84%, 60%)',   // Red for other
  'hsl(25, 95%, 53%)',  // Orange
];

const LIE_ORDER = ['Tee', 'Fairway', 'First Cut', 'Rough', 'Bunker', 'Recovery'];

export function ReportsByLie() {
  const { clubs, shots, availableStartLies, distanceToTargetTolerance } = useGolfData();

  const lieData = useMemo(() => {
    if (shots.length === 0) return [];

    // Process all shots first
    const processedShots = shots.map(shot => {
      const configId = getClubConfigId(shot.club);
      const config = clubs.find(c => c.id === configId);
      return processShot(shot, config, distanceToTargetTolerance);
    });

    const totalShots = processedShots.length;

    // Group by start lie
    const lieGroups = availableStartLies
      .filter(lie => lie && lie.trim() !== '')
      .map(lie => {
        const lieShots = processedShots.filter(s => s.startLie === lie);
        if (lieShots.length === 0) return null;

        // Get most common club for this lie
        const clubCounts = new Map<string, number>();
        lieShots.forEach(s => {
          const count = clubCounts.get(s.club) || 0;
          clubCounts.set(s.club, count + 1);
        });
        const mostUsedClub = [...clubCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const configId = mostUsedClub ? getClubConfigId(mostUsedClub) : undefined;
        const config = configId ? clubs.find(c => c.id === configId) : undefined;

        const data: LieData = {
          lie,
          shots: lieShots,
          metrics: calculateMetrics(lieShots, config),
          percentage: (lieShots.length / totalShots) * 100,
        };

        return data;
      })
      .filter((d): d is LieData => d !== null && d.shots.length >= 3);

    // Sort by predefined order, then by shot count
    return lieGroups.sort((a, b) => {
      const aIdx = LIE_ORDER.indexOf(a.lie);
      const bIdx = LIE_ORDER.indexOf(b.lie);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return b.shots.length - a.shots.length;
    });
  }, [shots, clubs, availableStartLies, distanceToTargetTolerance]);

  // Prepare chart data
  const barChartData = useMemo(() => {
    return lieData.map(lie => ({
      name: lie.lie,
      'On-Target %': lie.metrics.onTargetPct,
      'Bad Miss %': lie.metrics.badMissPct,
      'Strike Centre %': lie.metrics.strikeCentrePct,
      shots: lie.metrics.shotCount,
    }));
  }, [lieData]);

  const pieChartData = useMemo(() => {
    return lieData.map(lie => ({
      name: lie.lie,
      value: lie.shots.length,
      percentage: lie.percentage,
    }));
  }, [lieData]);

  const radarData = useMemo(() => {
    return lieData.slice(0, 6).map(lie => ({
      lie: lie.lie,
      accuracy: lie.metrics.onTargetPct,
      control: Math.max(0, 100 - lie.metrics.badMissPct * 5),
      consistency: Math.max(0, 100 - lie.metrics.sideVariation * 5),
      distance: Math.min(100, (lie.metrics.avgDistanceHit / 200) * 100),
    }));
  }, [lieData]);

  if (shots.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No shot data available.
        </CardContent>
      </Card>
    );
  }

  // Find best and worst performing lies
  const bestLie = [...lieData].sort((a, b) => b.metrics.onTargetPct - a.metrics.onTargetPct)[0];
  const worstLie = [...lieData].sort((a, b) => a.metrics.onTargetPct - b.metrics.onTargetPct)[0];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {lieData.slice(0, 4).map((lie, idx) => (
          <Card key={lie.lie} className="stat-card">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{lie.lie}</p>
                  <p className="text-2xl font-bold">{formatPercent(lie.metrics.onTargetPct)}</p>
                  <p className="text-xs text-muted-foreground">
                    {lie.metrics.shotCount} shots ({lie.percentage.toFixed(0)}%)
                  </p>
                </div>
                <Layers className="h-8 w-8 opacity-50" style={{ color: CHART_COLORS[idx] }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights */}
      {bestLie && worstLie && bestLie.lie !== worstLie.lie && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Best from</p>
                  <p className="font-semibold">{bestLie.lie} ({formatPercent(bestLie.metrics.onTargetPct)} on-target)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Struggles from</p>
                  <p className="font-semibold">{worstLie.lie} ({formatPercent(worstLie.metrics.onTargetPct)} on-target)</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5 text-primary" />
              Shot Distribution
            </CardTitle>
            <CardDescription>Where your shots come from</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name} (${percentage.toFixed(0)}%)`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Performance Comparison
            </CardTitle>
            <CardDescription>Key metrics by starting lie</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis dataKey="name" type="category" width={70} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Legend />
                <Bar dataKey="On-Target %" fill="hsl(var(--primary))" />
                <Bar dataKey="Bad Miss %" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Radar Chart */}
      {radarData.length >= 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Profile by Lie</CardTitle>
            <CardDescription>Multi-dimensional comparison across different lies</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={radarData}>
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis dataKey="lie" className="text-xs" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} className="text-xs" />
                <Radar 
                  name="Accuracy" 
                  dataKey="accuracy" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.3} 
                />
                <Radar 
                  name="Control" 
                  dataKey="control" 
                  stroke="hsl(var(--success))" 
                  fill="hsl(var(--success))" 
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
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lie Performance Details</CardTitle>
          <CardDescription>Complete metrics breakdown by starting lie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Lie</th>
                  <th>Shots</th>
                  <th>% of Total</th>
                  <th>On-Target %</th>
                  <th>Bad Miss %</th>
                  <th>Short %</th>
                  <th>Avg Dist</th>
                  <th>Side Var</th>
                  <th>Strike %</th>
                </tr>
              </thead>
              <tbody>
                {lieData.map(lie => (
                  <tr key={lie.lie}>
                    <td className="font-medium">{lie.lie}</td>
                    <td>{lie.metrics.shotCount}</td>
                    <td>{lie.percentage.toFixed(1)}%</td>
                    <td>{formatPercent(lie.metrics.onTargetPct)}</td>
                    <td>{formatPercent(lie.metrics.badMissPct)}</td>
                    <td>{formatPercent(lie.metrics.shortPct)}</td>
                    <td>{formatDistance(lie.metrics.avgDistanceHit)}</td>
                    <td>{formatDistance(lie.metrics.sideVariation)}</td>
                    <td>{formatPercent(lie.metrics.strikeCentrePct)}</td>
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
