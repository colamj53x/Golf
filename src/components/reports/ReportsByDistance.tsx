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
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from '@/lib/distanceFilters';
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Cell
} from 'recharts';
import { Ruler, Target, Activity, TrendingUp } from 'lucide-react';

interface DistanceBandData {
  label: string;
  value: string;
  shots: ProcessedShot[];
  metrics: MetricsResult;
  isWithin150m: boolean;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--accent))',
  'hsl(142, 76%, 36%)',
  'hsl(221, 83%, 53%)',
  'hsl(262, 83%, 58%)',
];

const ROLLUP_DISTANCE_VALUES = new Set(['0-150', '0-100']);

export function ReportsByDistance() {
  const { clubs, shots, distanceToTargetTolerance } = useGolfData();

  const distanceData = useMemo(() => {
    if (shots.length === 0) return [];

    // Process all shots first
    const processedShots = shots.map(shot => {
      const configId = getClubConfigId(shot.club);
      const config = clubs.find(c => c.id === configId);
      return processShot(shot, config, distanceToTargetTolerance);
    });

    // Group by distance bands - focus on shots within 150m for greens data
    const bands = DISTANCE_FILTER_OPTIONS.filter(opt => opt.value !== 'all');
    
    return bands.map(band => {
      const bandShots = filterShotsByTargetDistance(processedShots, band.value);
      if (bandShots.length === 0) return null;

      // Get the most common club config for this band
      const clubCounts = new Map<string, number>();
      bandShots.forEach(s => {
        const count = clubCounts.get(s.club) || 0;
        clubCounts.set(s.club, count + 1);
      });
      const mostUsedClub = [...clubCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const configId = mostUsedClub ? getClubConfigId(mostUsedClub) : undefined;
      const config = configId ? clubs.find(c => c.id === configId) : undefined;

      // Check if this band is within 150m (for greens hit relevance)
      const isWithin150m = (band.maxDistance !== null && band.maxDistance <= 150) || 
                           (band.minDistance === 0 && band.maxDistance !== null && band.maxDistance <= 150);

      const data: DistanceBandData = {
        label: band.label,
        value: band.value,
        shots: bandShots,
        metrics: calculateMetrics(bandShots, config),
        isWithin150m,
      };

      return data;
    }).filter((d): d is DistanceBandData => d !== null);
  }, [shots, clubs, distanceToTargetTolerance]);

  const rollupData = useMemo(
    () => distanceData.filter(band => ROLLUP_DISTANCE_VALUES.has(band.value)),
    [distanceData]
  );

  const detailedDistanceData = useMemo(
    () => distanceData.filter(band => !ROLLUP_DISTANCE_VALUES.has(band.value)),
    [distanceData]
  );

  // Prepare chart data
  const barChartData = useMemo(() => {
    return detailedDistanceData.map(band => ({
      name: band.label,
      'On-Target %': band.metrics.onTargetPct,
      'Greens Hit %': band.metrics.greensHitRawPct,
      'Bad Miss %': band.metrics.badMissPct,
      'Strike Centre %': band.metrics.strikeCentrePct,
      shots: band.metrics.shotCount,
    }));
  }, [detailedDistanceData]);

  const radarData = useMemo(() => {
    return detailedDistanceData.slice(0, 6).map(band => ({
      distance: band.label.replace('m', ''),
      accuracy: band.metrics.onTargetPct,
      control: Math.max(0, 100 - band.metrics.badMissPct * 5),
      consistency: Math.max(0, 100 - band.metrics.sideVariation * 5),
    }));
  }, [detailedDistanceData]);

  // Greens Hit analysis for shots within 150m
  const greensHitData = useMemo(() => {
    return detailedDistanceData
      .filter(band => band.isWithin150m)
      .map(band => ({
        name: band.label,
        'Greens Hit %': band.metrics.greensHitRawPct,
        shots: band.metrics.shotCount,
      }));
  }, [detailedDistanceData]);

  // Distance proximity analysis (for approach shots)
  const proximityData = useMemo(() => {
    return detailedDistanceData
      .filter(band => band.metrics.avgDistanceToTarget !== null)
      .map(band => ({
        name: band.label,
        'Avg to Target': band.metrics.avgDistanceToTarget,
        'Within 5m %': band.metrics.proximityWithin5mPct,
        'Greens Hit %': band.metrics.greensHitRawPct,
      }));
  }, [detailedDistanceData]);

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
      {/* Roll-up totals */}
      <div className="grid gap-4 sm:grid-cols-2">
        {rollupData.map(band => (
          <Card key={band.value} className="border-primary/50 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-primary">Greens Hit ({band.label})</p>
                  <p className="text-3xl font-bold text-primary">{formatPercent(band.metrics.greensHitRawPct)}</p>
                  <p className="text-xs text-muted-foreground">{band.metrics.shotCount} shots in total</p>
                </div>
                <Target className="h-10 w-10 text-primary opacity-70" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Stats by Distance Band */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {detailedDistanceData.filter(d => d.isWithin150m).map((band, idx) => (
          <Card key={band.value} className="stat-card">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{band.label}</p>
                  <p className="text-2xl font-bold">{formatPercent(band.metrics.greensHitRawPct)}</p>
                  <p className="text-xs text-muted-foreground">Greens Hit • {band.metrics.shotCount} shots</p>
                </div>
                <Ruler className="h-8 w-8 opacity-50" style={{ color: CHART_COLORS[idx] }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Accuracy by Distance
            </CardTitle>
            <CardDescription>Performance breakdown by target distance</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" domain={[0, 100]} className="text-xs" />
                <YAxis dataKey="name" type="category" width={80} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Legend />
                <Bar dataKey="On-Target %" fill="hsl(var(--primary))" />
                <Bar dataKey="Strike Centre %" fill="hsl(var(--warning))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-destructive" />
              Risk by Distance
            </CardTitle>
            <CardDescription>Bad miss rate at different distances</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Bar dataKey="Bad Miss %" fill="hsl(var(--destructive))">
                  {barChartData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`hsl(var(--destructive) / ${0.4 + (index * 0.1)})`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Greens Hit by Distance (Within 150m) */}
      {greensHitData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-success" />
              Greens Hit by Distance (Within 150m)
            </CardTitle>
            <CardDescription>Percentage of shots finishing on the green at different distances</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={greensHitData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Bar dataKey="Greens Hit %" fill="hsl(var(--success))">
                  {greensHitData.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`hsl(142, 76%, ${36 + (index * 5)}%)`} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Proximity Analysis */}
      {proximityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-success" />
              Proximity Analysis
            </CardTitle>
            <CardDescription>How close you finish to the target at different distances</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={proximityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis yAxisId="left" orientation="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }} 
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Avg to Target" fill="hsl(var(--primary))" name="Avg Distance to Target (m)" />
                <Bar yAxisId="right" dataKey="Within 5m %" fill="hsl(var(--success))" />
                <Bar yAxisId="right" dataKey="Greens Hit %" fill="hsl(var(--warning))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Distance Band Details</CardTitle>
          <CardDescription>Complete metrics breakdown by distance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Distance</th>
                  <th>Shots</th>
                  <th>On-Target %</th>
                  <th>Bad Miss %</th>
                  <th>Short %</th>
                  <th>Side Var</th>
                  <th>Strike %</th>
                  <th>Greens Hit %</th>
                </tr>
              </thead>
              <tbody>
                {detailedDistanceData.map(band => (
                  <tr key={band.value}>
                    <td className="font-medium">{band.label}</td>
                    <td>{band.metrics.shotCount}</td>
                    <td>{formatPercent(band.metrics.onTargetPct)}</td>
                    <td>{formatPercent(band.metrics.badMissPct)}</td>
                    <td>{formatPercent(band.metrics.shortPct)}</td>
                    <td>{formatDistance(band.metrics.sideVariation)}</td>
                    <td>{formatPercent(band.metrics.strikeCentrePct)}</td>
                    <td>{band.isWithin150m ? formatPercent(band.metrics.greensHitRawPct) : '-'}</td>
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
