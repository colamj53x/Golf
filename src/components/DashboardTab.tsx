import { useEffect, useMemo, useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, TrendingUp, TrendingDown, Minus, Award, Activity, ChevronDown, ChevronRight, ChevronsUpDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  processShot, 
  calculateMetrics, 
  splitIntoThirds, 
  splitByQualityCumulative, 
  getClubConfigId,
  getShotDateKey,
  formatPercent,
  formatDistance
} from '@/lib/golfCalculations';
import { METRIC_CATEGORIES, SHOT_QUALITY_LEVELS } from '@/lib/metricCategories';
import { ProcessedShot } from '@/types/golf';
import { calculateClubRatings } from '@/lib/clubRatings';
import { analyzeClubPerformance } from '@/lib/clubSummaryGenerator';
import { ClubSummaryCard } from '@/components/ClubSummaryCard';
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from '@/lib/distanceFilters';
import { LatestRoundTab } from '@/components/dashboard/LatestRoundTab';
import { createEmptyRoundReflectionDraft, RoundReflectionEditor } from '@/components/RoundReflectionEditor';

interface DashboardTabProps {
  onOpenUpload?: () => void;
}

export function DashboardTab({ onOpenUpload }: DashboardTabProps) {
  const {
    clubs,
    shots,
    isLoading,
    availableClubs,
    availableStartLies,
    distanceToTargetTolerance,
    roundReflections,
    upsertRoundReflection,
  } = useGolfData();
  const [selectedClub, setSelectedClub] = useState<string>('all');
  const [selectedStartLie, setSelectedStartLie] = useState<string>('all');
  const [selectedDistanceFilter, setSelectedDistanceFilter] = useState<string>('all');
  const [dashboardView, setDashboardView] = useState<string>('latest-round');
  const [expandedTrendCategories, setExpandedTrendCategories] = useState<Set<string>>(new Set(['accuracy', 'quality']));
  const [expandedCapabilityCategories, setExpandedCapabilityCategories] = useState<Set<string>>(new Set(['accuracy', 'quality']));
  const [roundReflectionDraft, setRoundReflectionDraft] = useState(createEmptyRoundReflectionDraft());
  const [isSavingRoundReflection, setIsSavingRoundReflection] = useState(false);

  const toggleTrendCategory = (categoryKey: string) => {
    setExpandedTrendCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryKey)) {
        newSet.delete(categoryKey);
      } else {
        newSet.add(categoryKey);
      }
      return newSet;
    });
  };

  const toggleCapabilityCategory = (categoryKey: string) => {
    setExpandedCapabilityCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryKey)) {
        newSet.delete(categoryKey);
      } else {
        newSet.add(categoryKey);
      }
      return newSet;
    });
  };

  const allTrendCategoryKeys = [...METRIC_CATEGORIES.map(c => c.key), 'shotQuality'];
  const allCapabilityCategoryKeys = [...METRIC_CATEGORIES.map(c => c.key), 'shotQuality'];

  const toggleAllTrendCategories = () => {
    const allExpanded = allTrendCategoryKeys.every(key => expandedTrendCategories.has(key));
    if (allExpanded) {
      setExpandedTrendCategories(new Set());
    } else {
      setExpandedTrendCategories(new Set(allTrendCategoryKeys));
    }
  };

  const toggleAllCapabilityCategories = () => {
    const allExpanded = allCapabilityCategoryKeys.every(key => expandedCapabilityCategories.has(key));
    if (allExpanded) {
      setExpandedCapabilityCategories(new Set());
    } else {
      setExpandedCapabilityCategories(new Set(allCapabilityCategoryKeys));
    }
  };

  const processedData = useMemo(() => {
    if (shots.length === 0) return null;

    let roundScopeShots = shots;
    if (selectedStartLie !== 'all') {
      roundScopeShots = roundScopeShots.filter(s => s.startLie === selectedStartLie);
    }
    roundScopeShots = filterShotsByTargetDistance(roundScopeShots, selectedDistanceFilter);

    const latestRoundDateKeys = [...new Set(roundScopeShots.map(s => getShotDateKey(s.date)))]
      .sort((a, b) => b.localeCompare(a));
    const lastRoundDateKeys = new Set(latestRoundDateKeys.slice(0, 1));
    const last5RoundDateKeys = new Set(latestRoundDateKeys.slice(0, 5));

    let filteredShots = roundScopeShots;
    if (selectedClub !== 'all') {
      filteredShots = filteredShots.filter(s => s.club === selectedClub);
    }

    // Sort by date
    const sortedShots = [...filteredShots].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Process shots with club config
    const processed: ProcessedShot[] = sortedShots.map(shot => {
      const configId = getClubConfigId(shot.club);
      const config = clubs.find(c => c.id === configId);
      return processShot(shot, config, distanceToTargetTolerance);
    });

    // Get current club config for display
    const currentConfig = selectedClub !== 'all' 
      ? clubs.find(c => c.id === getClubConfigId(selectedClub))
      : null;

    // Last round
    const lastRoundShots = processed.filter(s => lastRoundDateKeys.has(getShotDateKey(s.date)));
    const lastRound = calculateMetrics(lastRoundShots, currentConfig || undefined);

    // Last 5 rounds
    const last5RoundsShots = processed.filter(s => last5RoundDateKeys.has(getShotDateKey(s.date)));
    const last5Rounds = calculateMetrics(last5RoundsShots, currentConfig || undefined);

    // Trend analysis (thirds)
    const [mostRecent, middle, oldest] = splitIntoThirds(processed);
    const trendMetrics = {
      lastRound,
      last5Rounds,
      mostRecent: calculateMetrics(mostRecent, currentConfig || undefined),
      middle: calculateMetrics(middle, currentConfig || undefined),
      oldest: calculateMetrics(oldest, currentConfig || undefined),
    };

    // Capability analysis - cumulative percentages
    const [top25, top50, top75, top100] = splitByQualityCumulative(processed);
    const capabilityMetrics = {
      top25: calculateMetrics(top25, currentConfig || undefined),
      top50: calculateMetrics(top50, currentConfig || undefined),
      top75: calculateMetrics(top75, currentConfig || undefined),
      top100: calculateMetrics(top100, currentConfig || undefined),
    };

    const overall = calculateMetrics(processed, currentConfig || undefined);

    // Calculate club ratings
    const ratings = calculateClubRatings(processed, currentConfig || undefined);

    // Generate analysis
    const distanceEnabled = currentConfig?.distanceToTargetEnabled ?? false;
    const analysis = analyzeClubPerformance(
      overall,
      { mostRecent: trendMetrics.mostRecent, middle: trendMetrics.middle, oldest: trendMetrics.oldest },
      ratings,
      selectedClub !== 'all' ? selectedClub : 'Your clubs',
      distanceEnabled
    );

    return {
      processed,
      trendMetrics,
      capabilityMetrics,
      overall,
      lastRound,
      last5Rounds,
      latestRoundDateKey: latestRoundDateKeys[0] ?? null,
      distanceToTargetEnabled: distanceEnabled,
      ratings,
      analysis,
      clubName: selectedClub !== 'all' ? selectedClub : 'All Clubs',
    };
  }, [shots, selectedClub, selectedStartLie, selectedDistanceFilter, clubs, distanceToTargetTolerance]);

  useEffect(() => {
    const latestRoundDateKey = processedData?.latestRoundDateKey;
    if (!latestRoundDateKey) {
      setRoundReflectionDraft(createEmptyRoundReflectionDraft());
      return;
    }

    const existing = roundReflections.find((reflection) => reflection.roundDate === latestRoundDateKey);
    setRoundReflectionDraft(existing ? {
      drivingNotes: existing.drivingNotes,
      ironsNotes: existing.ironsNotes,
      shortNotes: existing.shortNotes,
      puttingNotes: existing.puttingNotes,
      mentalNotes: existing.mentalNotes,
      courseManagementNotes: existing.courseManagementNotes,
    } : createEmptyRoundReflectionDraft());
  }, [processedData?.latestRoundDateKey, roundReflections]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!processedData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">No shot data yet</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Upload a CSV to unlock your dashboard, club trends, reports, and practice insights.
            </p>
          </div>
          {onOpenUpload && (
            <Button onClick={onOpenUpload}>
              Go to Upload
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const { trendMetrics, capabilityMetrics, overall, lastRound, last5Rounds, latestRoundDateKey, distanceToTargetEnabled, ratings, analysis, clubName } = processedData;

  const handleSaveRoundReflection = async () => {
    if (!latestRoundDateKey) return;
    setIsSavingRoundReflection(true);
    try {
      await upsertRoundReflection(latestRoundDateKey, roundReflectionDraft);
    } finally {
      setIsSavingRoundReflection(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Club</label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clubs</SelectItem>
                  {availableClubs
                    .filter(club => club && club.trim() !== '')
                    .sort((a, b) => {
                      const configA = clubs.find(c => c.id === getClubConfigId(a));
                      const configB = clubs.find(c => c.id === getClubConfigId(b));
                      const distA = configA?.stockDistance ?? 0;
                      const distB = configB?.stockDistance ?? 0;
                      return distB - distA; // longest to shortest
                    })
                    .map(club => (
                      <SelectItem key={club} value={club}>{club}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start Lie</label>
              <Select value={selectedStartLie} onValueChange={setSelectedStartLie}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select lie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lies</SelectItem>
                  {availableStartLies
                    .filter(lie => lie && lie.trim() !== '')
                    .map(lie => (
                      <SelectItem key={lie} value={lie}>{lie}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Distance to Hole</label>
              <Select value={selectedDistanceFilter} onValueChange={setSelectedDistanceFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select distance" />
                </SelectTrigger>
                <SelectContent>
                  {DISTANCE_FILTER_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground lg:text-right">
            <span className="font-medium text-foreground">{overall.shotCount}</span> shots analyzed
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Sub-Tabs */}
      <Tabs value={dashboardView} onValueChange={setDashboardView}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="latest-round" className="shrink-0 gap-2">
            <Calendar className="h-4 w-4" />
            Latest Round
          </TabsTrigger>
          <TabsTrigger value="overview" className="shrink-0 gap-2">
            <TrendingUp className="h-4 w-4" />
            Overview
          </TabsTrigger>
        </TabsList>

        {/* Latest Round Tab */}
        <TabsContent value="latest-round" className="mt-6">
          <div className="space-y-6">
            <LatestRoundTab 
              lastRound={lastRound}
              last5Rounds={last5Rounds}
              mostRecentThird={trendMetrics.mostRecent}
              distanceToTargetEnabled={distanceToTargetEnabled}
            />
            {latestRoundDateKey && (
              <RoundReflectionEditor
                title={`Round Thoughts · ${latestRoundDateKey}`}
                description="Capture what actually happened in the round so future training and feedback can use both the numbers and your own notes."
                value={roundReflectionDraft}
                onChange={setRoundReflectionDraft}
                onSave={handleSaveRoundReflection}
                isSaving={isSavingRoundReflection}
              />
            )}
          </div>
        </TabsContent>

        {/* Overview Tab - Original Dashboard Content */}
        <TabsContent value="overview" className="mt-6 space-y-6">

      {/* Summary Cards - Last 5 Rounds vs Overall */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">On-Target %</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{formatPercent(last5Rounds.onTargetPct)}</p>
                  {(() => {
                    const diff = (last5Rounds.onTargetPct ?? 0) - (overall.onTargetPct ?? 0);
                    const threshold = 0.02;
                    if (Math.abs(diff) < threshold) return <Minus className="h-4 w-4 text-muted-foreground" />;
                    return diff > 0 
                      ? <TrendingUp className="h-4 w-4 text-primary" />
                      : <TrendingDown className="h-4 w-4 text-destructive" />;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">vs {formatPercent(overall.onTargetPct)} overall</p>
              </div>
              <Target className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bad Miss %</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{formatPercent(last5Rounds.badMissPct)}</p>
                  {(() => {
                    const diff = (last5Rounds.badMissPct ?? 0) - (overall.badMissPct ?? 0);
                    const threshold = 0.02;
                    if (Math.abs(diff) < threshold) return <Minus className="h-4 w-4 text-muted-foreground" />;
                    // Lower is better for bad miss
                    return diff < 0 
                      ? <TrendingDown className="h-4 w-4 text-primary" />
                      : <TrendingUp className="h-4 w-4 text-destructive" />;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">vs {formatPercent(overall.badMissPct)} overall</p>
              </div>
              <Activity className="h-8 w-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Distance</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{formatDistance(last5Rounds.avgDistanceHit)}</p>
                  {(() => {
                    const diff = (last5Rounds.avgDistanceHit ?? 0) - (overall.avgDistanceHit ?? 0);
                    const threshold = 2; // 2m threshold
                    if (Math.abs(diff) < threshold) return <Minus className="h-4 w-4 text-muted-foreground" />;
                    return diff > 0 
                      ? <TrendingUp className="h-4 w-4 text-primary" />
                      : <TrendingDown className="h-4 w-4 text-destructive" />;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">vs {formatDistance(overall.avgDistanceHit)} overall</p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="stat-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Side Variation</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold">{formatDistance(last5Rounds.sideVariation)}</p>
                  {(() => {
                    const diff = (last5Rounds.sideVariation ?? 0) - (overall.sideVariation ?? 0);
                    const threshold = 1; // 1m threshold
                    if (Math.abs(diff) < threshold) return <Minus className="h-4 w-4 text-muted-foreground" />;
                    // Lower is better for variation
                    return diff < 0 
                      ? <TrendingDown className="h-4 w-4 text-primary" />
                      : <TrendingUp className="h-4 w-4 text-destructive" />;
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">vs {formatDistance(overall.sideVariation)} overall</p>
              </div>
              <Award className="h-8 w-8 text-accent opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Club Performance Summary */}
      <ClubSummaryCard
        clubName={clubName}
        analysis={analysis}
        ratings={ratings}
        shotCount={overall.shotCount}
        overall={overall}
        quartiles={capabilityMetrics}
        distanceToTargetEnabled={distanceToTargetEnabled}
      />


      {/* Trend Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Club Trend Analysis
            </CardTitle>
            <CardDescription>
              Performance split into thirds by date (most recent first)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllTrendCategories}
            className="flex items-center gap-1"
          >
            <ChevronsUpDown className="h-4 w-4" />
            {allTrendCategoryKeys.every(key => expandedTrendCategories.has(key)) ? 'Collapse All' : 'Expand All'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Last 5 Rounds</th>
                  <th>Most Recent 1/3</th>
                  <th>Middle 1/3</th>
                  <th>Oldest 1/3</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_CATEGORIES.map(category => {
                  // Skip categories that require distance-to-target if not enabled
                  const hasRelevantMetrics = category.metrics.some(m => 
                    !m.requiresDistanceToTarget || distanceToTargetEnabled
                  );
                  if (!hasRelevantMetrics) return null;

                  const isExpanded = expandedTrendCategories.has(category.key);
                  const metricsToShow = category.metrics.filter(m => 
                    !m.requiresDistanceToTarget || distanceToTargetEnabled
                  );

                  return (
                    <>
                      {/* Category Header Row */}
                      <tr 
                        key={category.key}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleTrendCategory(category.key)}
                      >
                        <td className="font-semibold text-primary" colSpan={1}>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {category.name}
                          </div>
                        </td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                      </tr>
                      {/* Metric Rows (if expanded) */}
                      {isExpanded && metricsToShow.map(metric => (
                        <tr key={metric.key}>
                          <td className="font-medium pl-8">{metric.label}</td>
                          <td>{metric.format(trendMetrics.last5Rounds[metric.key as keyof typeof trendMetrics.last5Rounds] as number | null)}</td>
                          <td>{metric.format(trendMetrics.mostRecent[metric.key as keyof typeof trendMetrics.mostRecent] as number | null)}</td>
                          <td>{metric.format(trendMetrics.middle[metric.key as keyof typeof trendMetrics.middle] as number | null)}</td>
                          <td>{metric.format(trendMetrics.oldest[metric.key as keyof typeof trendMetrics.oldest] as number | null)}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
                {/* Shot Quality Category */}
                <tr 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleTrendCategory('shotQuality')}
                >
                  <td className="font-semibold text-primary" colSpan={1}>
                    <div className="flex items-center gap-2">
                      {expandedTrendCategories.has('shotQuality') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Shot Quality
                    </div>
                  </td>
                  <td className="text-center text-muted-foreground text-xs">{expandedTrendCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedTrendCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedTrendCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedTrendCategories.has('shotQuality') ? '' : '...'}</td>
                </tr>
                {expandedTrendCategories.has('shotQuality') && SHOT_QUALITY_LEVELS.map(level => (
                  <tr key={level}>
                    <td className="font-medium pl-8">{level} %</td>
                    <td>{formatPercent(trendMetrics.last5Rounds.shotQualityPcts[level])}</td>
                    <td>{formatPercent(trendMetrics.mostRecent.shotQualityPcts[level])}</td>
                    <td>{formatPercent(trendMetrics.middle.shotQualityPcts[level])}</td>
                    <td>{formatPercent(trendMetrics.oldest.shotQualityPcts[level])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Capability Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Club Capability Analysis
            </CardTitle>
            <CardDescription>
              Performance split by shot quality score (best shots first)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllCapabilityCategories}
            className="flex items-center gap-1"
          >
            <ChevronsUpDown className="h-4 w-4" />
            {allCapabilityCategoryKeys.every(key => expandedCapabilityCategories.has(key)) ? 'Collapse All' : 'Expand All'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Top 25%</th>
                  <th>Top 50%</th>
                  <th>Top 75%</th>
                  <th>Top 100%</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_CATEGORIES.map(category => {
                  // Skip categories that require distance-to-target if not enabled
                  const hasRelevantMetrics = category.metrics.some(m => 
                    !m.requiresDistanceToTarget || distanceToTargetEnabled
                  );
                  if (!hasRelevantMetrics) return null;

                  const isExpanded = expandedCapabilityCategories.has(category.key);
                  const metricsToShow = category.metrics.filter(m => 
                    !m.requiresDistanceToTarget || distanceToTargetEnabled
                  );

                  return (
                    <>
                      {/* Category Header Row */}
                      <tr 
                        key={category.key}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCapabilityCategory(category.key)}
                      >
                        <td className="font-semibold text-primary" colSpan={1}>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {category.name}
                          </div>
                        </td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                        <td className="text-center text-muted-foreground text-xs">{isExpanded ? '' : '...'}</td>
                      </tr>
                      {/* Metric Rows (if expanded) */}
                      {isExpanded && metricsToShow.map(metric => (
                        <tr key={metric.key}>
                          <td className="font-medium pl-8">{metric.label}</td>
                          <td>{metric.format(capabilityMetrics.top25[metric.key as keyof typeof capabilityMetrics.top25] as number | null)}</td>
                          <td>{metric.format(capabilityMetrics.top50[metric.key as keyof typeof capabilityMetrics.top50] as number | null)}</td>
                          <td>{metric.format(capabilityMetrics.top75[metric.key as keyof typeof capabilityMetrics.top75] as number | null)}</td>
                          <td>{metric.format(capabilityMetrics.top100[metric.key as keyof typeof capabilityMetrics.top100] as number | null)}</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
                {/* Shot Quality Category */}
                <tr 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCapabilityCategory('shotQuality')}
                >
                  <td className="font-semibold text-primary" colSpan={1}>
                    <div className="flex items-center gap-2">
                      {expandedCapabilityCategories.has('shotQuality') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Shot Quality
                    </div>
                  </td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCapabilityCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCapabilityCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCapabilityCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCapabilityCategories.has('shotQuality') ? '' : '...'}</td>
                </tr>
                {expandedCapabilityCategories.has('shotQuality') && SHOT_QUALITY_LEVELS.map(level => (
                  <tr key={level}>
                    <td className="font-medium pl-8">{level} %</td>
                    <td>{formatPercent(capabilityMetrics.top25.shotQualityPcts[level])}</td>
                    <td>{formatPercent(capabilityMetrics.top50.shotQualityPcts[level])}</td>
                    <td>{formatPercent(capabilityMetrics.top75.shotQualityPcts[level])}</td>
                    <td>{formatPercent(capabilityMetrics.top100.shotQualityPcts[level])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
