import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { format, startOfMonth, startOfWeek, parseISO, isValid } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar
} from 'recharts';
import { Calendar, TrendingUp, Activity, Target, BarChart3 } from 'lucide-react';

type TimeGrouping = 'monthly' | 'weekly' | 'round';

const DISTANCE_FILTERS = [
  { value: 'all', label: 'All Distances' },
  { value: '140', label: 'Within 140m' },
  { value: '130', label: 'Within 130m' },
  { value: '120', label: 'Within 120m' },
  { value: '110', label: 'Within 110m' },
  { value: '100', label: 'Within 100m' },
  { value: '90', label: 'Within 90m' },
  { value: '80', label: 'Within 80m' },
  { value: '70', label: 'Within 70m' },
  { value: '60', label: 'Within 60m' },
  { value: '50', label: 'Within 50m' },
];

interface TimePeriodData {
  period: string;
  periodKey: string;
  shots: ProcessedShot[];
  metrics: MetricsResult;
}

interface MovingAveragePoint {
  shotIndex: number;
  date: string;
  onTarget: number;
  badMiss: number;
  strikeCentre: number;
  isOnTarget: number;
  isBadMiss: number;
  isStrikeCentre: number;
}

// Calculate 10-shot moving average for a metric
function calculateMovingAverage(data: number[], windowSize: number = 10): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);
    const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
    result.push(avg);
  }
  return result;
}

// Calculate linear regression trendline
function calculateTrendline(data: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  
  const sumX = data.reduce((sum, p) => sum + p.x, 0);
  const sumY = data.reduce((sum, p) => sum + p.y, 0);
  const sumXY = data.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = data.reduce((sum, p) => sum + p.x * p.x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept };
}

export function ReportsByTime() {
  const { clubs, shots, distanceToTargetTolerance } = useGolfData();
  const [grouping, setGrouping] = useState<TimeGrouping>('monthly');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');

  // Filter shots by distance
  const filteredShots = useMemo(() => {
    if (distanceFilter === 'all') return shots;
    const maxDistance = parseInt(distanceFilter, 10);
    return shots.filter(shot => shot.target <= maxDistance);
  }, [shots, distanceFilter]);

  // Process all shots chronologically for moving average
  const movingAverageData = useMemo(() => {
    if (filteredShots.length === 0) return [];

    // Process and sort all shots by date
    const processedShots = filteredShots.map(shot => {
      const configId = getClubConfigId(shot.club);
      const config = clubs.find(c => c.id === configId);
      return processShot(shot, config, distanceToTargetTolerance);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Create binary arrays for each metric
    const onTargetValues = processedShots.map(s => s.isOnTarget ? 100 : 0);
    const badMissValues = processedShots.map(s => s.isBadMiss ? 100 : 0);
    const strikeCentreValues = processedShots.map(s => 
      s.strikeQuality?.toLowerCase() === 'centre' || s.strikeQuality?.toLowerCase() === 'center' ? 100 : 0
    );

    // Calculate 10-shot moving averages
    const onTargetMA = calculateMovingAverage(onTargetValues, 10);
    const badMissMA = calculateMovingAverage(badMissValues, 10);
    const strikeCentreMA = calculateMovingAverage(strikeCentreValues, 10);

    // Build data points
    return processedShots.map((shot, idx): MovingAveragePoint => ({
      shotIndex: idx + 1,
      date: format(new Date(shot.date), 'MMM d'),
      onTarget: onTargetMA[idx],
      badMiss: badMissMA[idx],
      strikeCentre: strikeCentreMA[idx],
      isOnTarget: onTargetValues[idx],
      isBadMiss: badMissValues[idx],
      isStrikeCentre: strikeCentreValues[idx],
    }));
  }, [filteredShots, clubs, distanceToTargetTolerance]);

  // Sample data for chart rendering (show every Nth point for readability)
  const sampledData = useMemo(() => {
    if (movingAverageData.length <= 100) return movingAverageData;
    const step = Math.ceil(movingAverageData.length / 100);
    return movingAverageData.filter((_, idx) => idx % step === 0 || idx === movingAverageData.length - 1);
  }, [movingAverageData]);

  // Calculate trendlines for each metric
  const trendlines = useMemo(() => {
    if (sampledData.length < 2) return null;
    
    const onTargetTrend = calculateTrendline(sampledData.map(p => ({ x: p.shotIndex, y: p.onTarget })));
    const badMissTrend = calculateTrendline(sampledData.map(p => ({ x: p.shotIndex, y: p.badMiss })));
    const strikeCentreTrend = calculateTrendline(sampledData.map(p => ({ x: p.shotIndex, y: p.strikeCentre })));
    
    // Add trendline values to sampled data
    return sampledData.map(p => ({
      ...p,
      onTargetTrend: Math.max(0, Math.min(100, onTargetTrend.slope * p.shotIndex + onTargetTrend.intercept)),
      badMissTrend: Math.max(0, Math.min(100, badMissTrend.slope * p.shotIndex + badMissTrend.intercept)),
      strikeCentreTrend: Math.max(0, Math.min(100, strikeCentreTrend.slope * p.shotIndex + strikeCentreTrend.intercept)),
    }));
  }, [sampledData]);

  const timeData = useMemo(() => {
    if (filteredShots.length === 0) return [];

    // Process all shots first
    const processedShots = filteredShots.map(shot => {
      const configId = getClubConfigId(shot.club);
      const config = clubs.find(c => c.id === configId);
      return processShot(shot, config, distanceToTargetTolerance);
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by time period
    const groups = new Map<string, ProcessedShot[]>();
    
    processedShots.forEach(shot => {
      const date = new Date(shot.date);
      if (!isValid(date)) return;

      let periodKey: string;

      switch (grouping) {
        case 'weekly': {
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          periodKey = format(weekStart, 'yyyy-MM-dd');
          break;
        }
        case 'round':
          periodKey = format(date, 'yyyy-MM-dd');
          break;
        case 'monthly':
        default: {
          const monthStart = startOfMonth(date);
          periodKey = format(monthStart, 'yyyy-MM');
          break;
        }
      }

      const existing = groups.get(periodKey) || [];
      groups.set(periodKey, [...existing, shot]);
    });

    // Convert to array and calculate metrics
    const result: TimePeriodData[] = [];
    
    groups.forEach((periodShots, periodKey) => {
      if (periodShots.length < 3) return;

      const clubCounts = new Map<string, number>();
      periodShots.forEach(s => {
        const count = clubCounts.get(s.club) || 0;
        clubCounts.set(s.club, count + 1);
      });
      const mostUsedClub = [...clubCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const configId = mostUsedClub ? getClubConfigId(mostUsedClub) : undefined;
      const config = configId ? clubs.find(c => c.id === configId) : undefined;

      let periodLabel: string;
      switch (grouping) {
        case 'weekly':
          periodLabel = format(parseISO(periodKey), 'MMM d');
          break;
        case 'round':
          periodLabel = format(parseISO(periodKey), 'MMM d');
          break;
        case 'monthly':
        default:
          periodLabel = format(parseISO(periodKey + '-01'), 'MMM yyyy');
          break;
      }

      result.push({
        period: periodLabel,
        periodKey,
        shots: periodShots,
        metrics: calculateMetrics(periodShots, config),
      });
    });

    return result.sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  }, [filteredShots, clubs, distanceToTargetTolerance, grouping]);

  // Prepare chart data for period view
  const chartData = useMemo(() => {
    return timeData.map(period => ({
      name: period.period,
      'On-Target %': period.metrics.onTargetPct,
      'Bad Miss %': period.metrics.badMissPct,
      'Strike Centre %': period.metrics.strikeCentrePct,
      'Side Variation': period.metrics.sideVariation,
      'Avg Distance': period.metrics.avgDistanceHit,
      shots: period.metrics.shotCount,
    }));
  }, [timeData]);

  // Calculate period-over-period changes
  const changes = useMemo(() => {
    if (timeData.length < 2) return null;
    
    const recent = timeData[timeData.length - 1];
    const previous = timeData[timeData.length - 2];
    
    return {
      onTarget: recent.metrics.onTargetPct - previous.metrics.onTargetPct,
      badMiss: recent.metrics.badMissPct - previous.metrics.badMissPct,
      strikeCentre: recent.metrics.strikeCentrePct - previous.metrics.strikeCentrePct,
      sideVar: recent.metrics.sideVariation - previous.metrics.sideVariation,
    };
  }, [timeData]);

  // Overall trend (first 20 vs last 20 shots)
  const overallTrend = useMemo(() => {
    if (movingAverageData.length < 40) return null;
    
    const first20 = movingAverageData.slice(0, 20);
    const last20 = movingAverageData.slice(-20);
    
    const avgFirst = first20.reduce((sum, p) => sum + p.onTarget, 0) / 20;
    const avgLast = last20.reduce((sum, p) => sum + p.onTarget, 0) / 20;
    
    return {
      change: avgLast - avgFirst,
      startAvg: avgFirst,
      endAvg: avgLast,
    };
  }, [movingAverageData]);

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
      {/* Distance Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Distance:</label>
          <Select value={distanceFilter} onValueChange={setDistanceFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select distance" />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_FILTERS.map(filter => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredShots.length} shots
          {distanceFilter !== 'all' && ` (of ${shots.length} total)`}
        </span>
      </div>
      {/* Overall Trend Summary */}
      {overallTrend && (
        <Card className={`border-l-4 ${overallTrend.change >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <TrendingUp className={`h-8 w-8 ${overallTrend.change >= 0 ? 'text-green-500' : 'text-red-500'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Overall On-Target Trend (First 20 → Last 20 shots)</p>
                <p className={`text-2xl font-bold ${overallTrend.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {overallTrend.startAvg.toFixed(1)}% → {overallTrend.endAvg.toFixed(1)}% 
                  <span className="text-lg ml-2">({overallTrend.change >= 0 ? '+' : ''}{overallTrend.change.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 10-Shot Moving Average Charts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            On-Target % (10-Shot Moving Average)
          </CardTitle>
          <CardDescription>Tracking accuracy across all {shots.length} shots with trendline</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendlines || sampledData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="shotIndex" 
                className="text-xs" 
                label={{ value: 'Shot #', position: 'insideBottom', offset: -5 }}
              />
              <YAxis domain={[0, 100]} className="text-xs" unit="%" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))' 
                }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name === 'onTargetTrend' ? 'Trendline' : '10-Shot Avg']}
                labelFormatter={(label) => `Shot #${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="onTarget" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
                name="10-Shot Avg"
              />
              <Line 
                type="monotone" 
                dataKey="onTargetTrend" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                strokeDasharray="8 4"
                dot={false}
                name="Trendline"
                opacity={0.7}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-destructive" />
            Bad Miss % (10-Shot Moving Average)
          </CardTitle>
            <CardDescription>Lower is better</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={trendlines || sampledData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="shotIndex" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" unit="%" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name === 'badMissTrend' ? 'Trendline' : '10-Shot Avg']}
                  labelFormatter={(label) => `Shot #${label}`}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="badMiss" 
                  stroke="hsl(var(--destructive))" 
                  fill="hsl(var(--destructive))" 
                  fillOpacity={0.3}
                  name="10-Shot Avg"
                />
                <Line 
                  type="monotone" 
                  dataKey="badMissTrend" 
                  stroke="hsl(var(--destructive))" 
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                  name="Trendline"
                  opacity={0.7}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Strike Centre % (10-Shot Moving Average)
          </CardTitle>
            <CardDescription>Higher is better</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendlines || sampledData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="shotIndex" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" unit="%" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                  formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name === 'strikeCentreTrend' ? 'Trendline' : '10-Shot Avg']}
                  labelFormatter={(label) => `Shot #${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="strikeCentre" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  dot={false}
                  name="10-Shot Avg"
                />
                <Line 
                  type="monotone" 
                  dataKey="strikeCentreTrend" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  strokeDasharray="8 4"
                  dot={false}
                  name="Trendline"
                  opacity={0.7}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Period-based analysis */}
      <div className="border-t pt-6">
        <div className="flex items-center gap-4 mb-6">
          <h3 className="text-lg font-semibold">Period Analysis</h3>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Group by:</label>
            <Select value={grouping} onValueChange={(v) => setGrouping(v as TimeGrouping)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="round">By Round</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-sm text-muted-foreground">
            {timeData.length} {grouping === 'round' ? 'rounds' : 'periods'}
          </span>
        </div>

        {/* Period Changes */}
        {changes && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className={`stat-card ${changes.onTarget >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">On-Target Change</p>
                    <p className={`text-2xl font-bold ${changes.onTarget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {changes.onTarget >= 0 ? '+' : ''}{changes.onTarget.toFixed(1)}%
                    </p>
                  </div>
                  <Target className={`h-8 w-8 ${changes.onTarget >= 0 ? 'text-green-500' : 'text-red-500'} opacity-50`} />
                </div>
              </CardContent>
            </Card>
            
            <Card className={`stat-card ${changes.badMiss <= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Bad Miss Change</p>
                    <p className={`text-2xl font-bold ${changes.badMiss <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {changes.badMiss >= 0 ? '+' : ''}{changes.badMiss.toFixed(1)}%
                    </p>
                  </div>
                  <Activity className={`h-8 w-8 ${changes.badMiss <= 0 ? 'text-green-500' : 'text-red-500'} opacity-50`} />
                </div>
              </CardContent>
            </Card>

            <Card className={`stat-card ${changes.strikeCentre >= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Strike Change</p>
                    <p className={`text-2xl font-bold ${changes.strikeCentre >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {changes.strikeCentre >= 0 ? '+' : ''}{changes.strikeCentre.toFixed(1)}%
                    </p>
                  </div>
                  <TrendingUp className={`h-8 w-8 ${changes.strikeCentre >= 0 ? 'text-green-500' : 'text-red-500'} opacity-50`} />
                </div>
              </CardContent>
            </Card>

            <Card className={`stat-card ${changes.sideVar <= 0 ? 'border-green-500/20' : 'border-red-500/20'}`}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Dispersion Change</p>
                    <p className={`text-2xl font-bold ${changes.sideVar <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {changes.sideVar >= 0 ? '+' : ''}{changes.sideVar.toFixed(1)}m
                    </p>
                  </div>
                  <BarChart3 className={`h-8 w-8 ${changes.sideVar <= 0 ? 'text-green-500' : 'text-red-500'} opacity-50`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Time Period Details</CardTitle>
            <CardDescription>Complete metrics breakdown by {grouping === 'round' ? 'round' : 'period'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{grouping === 'round' ? 'Date' : 'Period'}</th>
                    <th>Shots</th>
                    <th>On-Target %</th>
                    <th>Bad Miss %</th>
                    <th>Short %</th>
                    <th>Avg Dist</th>
                    <th>Side Var</th>
                    <th>Strike %</th>
                  </tr>
                </thead>
                <tbody>
                  {[...timeData].reverse().map(period => (
                    <tr key={period.periodKey}>
                      <td className="font-medium">{period.period}</td>
                      <td>{period.metrics.shotCount}</td>
                      <td>{formatPercent(period.metrics.onTargetPct)}</td>
                      <td>{formatPercent(period.metrics.badMissPct)}</td>
                      <td>{formatPercent(period.metrics.shortPct)}</td>
                      <td>{formatDistance(period.metrics.avgDistanceHit)}</td>
                      <td>{formatDistance(period.metrics.sideVariation)}</td>
                      <td>{formatPercent(period.metrics.strikeCentrePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
