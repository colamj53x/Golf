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
import { buildReportGappingAnalysis, buildShotDecisionSummary } from '@/lib/reportGappingShots';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { useShotProfiles } from '@/lib/shotProfiles';
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

type AnalysisMode = 'shot' | 'club';

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
  const { clubs, shots, distanceToTargetTolerance, gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('shot');
  const [selectedShot, setSelectedShot] = useState<string>('all');

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
  const decisionSummary = useMemo(() => buildShotDecisionSummary(analysis.shots), [analysis.shots]);

  const sourceData = analysisMode === 'shot' ? analysis.shots : analysis.clubRollups;
  const selectedData = useMemo(() => {
    if (selectedShot === 'all') return sourceData;
    return sourceData.filter((item) => item.key === selectedShot);
  }, [selectedShot, sourceData]);

  const selectOptions = analysisMode === 'shot'
    ? analysis.catalogueOptions.filter((option) => analysis.shots.some((row) => row.key === option.key))
    : analysis.clubRollups.map((club) => ({ key: club.key, label: club.label }));

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
      {/* Shot Selector */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">View:</label>
          <Select value={analysisMode} onValueChange={(value) => { setAnalysisMode(value as AnalysisMode); setSelectedShot('all'); }}>
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
          <label className="text-sm font-medium">{analysisMode === 'shot' ? 'Shot:' : 'Club:'}</label>
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
        <span className="text-sm text-muted-foreground">
          {selectedData.length} {analysisMode === 'shot' ? `shot ${selectedData.length === 1 ? 'category' : 'categories'}` : `club${selectedData.length === 1 ? '' : 's'}`} • {selectedData.reduce((acc, c) => acc + c.shots.length, 0)} shots
        </span>
      </div>

      <Card className="border-dashed bg-muted/20">
        <CardContent className="py-3 text-sm text-muted-foreground">
          Shot categories are taken from your Gapping setup, so performance review matches the shots you practise.
          {analysis.unmatchedShots.length > 0 && (
            <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
              Some historical shots are not linked to current Gapping shot definitions ({analysis.unmatchedShots.length}).
            </span>
          )}
        </CardContent>
      </Card>

      <ShotDecisionSummary
        summary={decisionSummary}
        unmatchedCount={analysis.unmatchedShots.length}
        selectedShotKey={analysisMode === 'shot' ? selectedShot : undefined}
        onSelectShot={(shotKey) => {
          setAnalysisMode('shot');
          setSelectedShot(shotKey);
        }}
      />

      {/* Trend Charts */}
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
              const trendDir = item.periods.mostRecent.onTargetPct > item.periods.oldest.onTargetPct ? 'up'
                : item.periods.mostRecent.onTargetPct < item.periods.oldest.onTargetPct ? 'down' : 'stable';
              
              return (
                <Card key={item.key} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{item.label}</h4>
                        {analysisMode === 'shot' && <p className="text-xs text-muted-foreground">{item.clubLabel} · {item.shotLabel} · {item.powerLabel}</p>}
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
