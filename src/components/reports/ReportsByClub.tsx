import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGolfData } from '@/context/GolfDataContext';
import { 
  processShot, 
  calculateMetrics, 
  splitIntoThirds, 
  getClubConfigId,
  formatPercent,
  formatDistance,
  getLastNRounds,
  MetricsResult
} from '@/lib/golfCalculations';
import { calculateClubRatings, ClubRatings, getRatingColor, getImprovementDisplay } from '@/lib/clubRatings';
import { ProcessedShot, ClubConfig } from '@/types/golf';
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
  Area
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Target, Activity, Award, Zap } from 'lucide-react';

interface ClubTrendData {
  clubName: string;
  config: ClubConfig | undefined;
  shots: ProcessedShot[];
  ratings: ClubRatings;
  periods: {
    mostRecent: MetricsResult;
    middle: MetricsResult;
    oldest: MetricsResult;
  };
  last5Rounds: MetricsResult;
  overall: MetricsResult;
}

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

export function ReportsByClub() {
  const { clubs, shots, availableClubs, distanceToTargetTolerance } = useGolfData();
  const [selectedClub, setSelectedClub] = useState<string>('all');

  const clubsData = useMemo(() => {
    if (shots.length === 0) return [];

    const clubsList = selectedClub === 'all' ? availableClubs : [selectedClub];
    
    return clubsList.map(clubName => {
      const clubShots = shots.filter(s => s.club === clubName);
      const sortedShots = [...clubShots].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const configId = getClubConfigId(clubName);
      const config = clubs.find(c => c.id === configId);

      const processed: ProcessedShot[] = sortedShots.map(shot => 
        processShot(shot, config, distanceToTargetTolerance)
      );

      if (processed.length < 3) return null;

      const [mostRecent, middle, oldest] = splitIntoThirds(processed);
      const last5RoundsShots = getLastNRounds(processed, 5);
      
      const data: ClubTrendData = {
        clubName,
        config,
        shots: processed,
        ratings: calculateClubRatings(processed, config),
        periods: {
          mostRecent: calculateMetrics(mostRecent, config),
          middle: calculateMetrics(middle, config),
          oldest: calculateMetrics(oldest, config),
        },
        last5Rounds: calculateMetrics(last5RoundsShots, config),
        overall: calculateMetrics(processed, config),
      };

      return data;
    }).filter((d): d is ClubTrendData => d !== null);
  }, [shots, selectedClub, availableClubs, clubs, distanceToTargetTolerance]);

  // Prepare chart data for selected club(s)
  const chartData = useMemo(() => {
    if (clubsData.length === 0) return [];

    // For trend chart, show the 3 periods
    return clubsData.map(club => ({
      name: club.clubName,
      periods: [
        { period: 'Oldest', ...club.periods.oldest },
        { period: 'Middle', ...club.periods.middle },
        { period: 'Recent', ...club.periods.mostRecent },
      ]
    }));
  }, [clubsData]);

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
      {/* Club Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Club:</label>
          <Select value={selectedClub} onValueChange={setSelectedClub}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select club" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clubs</SelectItem>
              {availableClubs.map(club => (
                <SelectItem key={club} value={club}>{club}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {clubsData.length} club{clubsData.length !== 1 ? 's' : ''} • {clubsData.reduce((acc, c) => acc + c.shots.length, 0)} shots
        </span>
      </div>

      {/* Trend Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Accuracy Trend
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
          <CardTitle>Club Performance Summary</CardTitle>
          <CardDescription>Ratings and key metrics for each club</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubsData.map(club => {
              const improvement = getImprovementDisplay(club.ratings.improvement);
              const trendDir = club.periods.mostRecent.onTargetPct > club.periods.oldest.onTargetPct ? 'up' 
                : club.periods.mostRecent.onTargetPct < club.periods.oldest.onTargetPct ? 'down' : 'stable';
              
              return (
                <Card key={club.clubName} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold">{club.clubName}</h4>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">{club.shots.length} shots</span>
                        <TrendIndicator direction={trendDir} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <RatingBadge score={club.ratings.capability} label="Cap" size="small" />
                      <RatingBadge score={club.ratings.consistency} label="Con" size="small" />
                      <RatingBadge score={club.ratings.currentForm} label="Form" size="small" />
                      <div className="text-center">
                        <div className={`text-lg font-bold ${improvement.color}`}>{improvement.text}</div>
                        <div className="text-[10px] text-muted-foreground">Trend</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">On-Target:</span>
                        <span className="font-medium">{formatPercent(club.last5Rounds.onTargetPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bad Miss:</span>
                        <span className="font-medium">{formatPercent(club.last5Rounds.badMissPct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Dist:</span>
                        <span className="font-medium">{formatDistance(club.last5Rounds.avgDistanceHit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Side Var:</span>
                        <span className="font-medium">{formatDistance(club.last5Rounds.sideVariation)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
