import React, { useMemo, useState } from 'react';
import { useGolfData } from '@/context/GolfDataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Minus, BarChart3, Zap, Target, Activity, ChevronDown, ChevronRight, ChevronsUpDown, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  processShot, 
  calculateMetrics, 
  splitIntoThirds, 
  splitByQualityCumulative,
  getClubConfigId,
  formatPercent,
  formatDistance,
  getLastNRounds,
  MetricsResult
} from '@/lib/golfCalculations';
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from '@/lib/distanceFilters';
import { 
  calculateClubRatings, 
  getRatingGrade, 
  getRatingColor, 
  getImprovementDisplay,
  ClubRatings 
} from '@/lib/clubRatings';
import { ProcessedShot, ClubConfig } from '@/types/golf';
import { ClubInfoSheet } from './ClubInfoSheet';

type TrendDirection = 'improving' | 'slightly-worse' | 'significantly-worse' | 'stable';

interface MetricConfig {
  key: string;
  label: string;
  format: (value: number | null) => string;
  higherIsBetter: boolean;
  varianceThreshold: number;
  requiresDistanceToTarget?: boolean;
}

// Group metrics by category
interface MetricCategory {
  name: string;
  key: string;
  metrics: MetricConfig[];
}

const METRIC_CATEGORIES: MetricCategory[] = [
  {
    name: 'Accuracy',
    key: 'accuracy',
    metrics: [
      { key: 'onTargetPct', label: 'On-Target %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5 },
      { key: 'rightPct', label: 'Right % (outside band)', format: formatPercent, higherIsBetter: false, varianceThreshold: 5 },
      { key: 'leftPct', label: 'Left % (outside band)', format: formatPercent, higherIsBetter: false, varianceThreshold: 5 },
    ],
  },
  {
    name: 'Distance',
    key: 'distance',
    metrics: [
      { key: 'avgDistanceHit', label: 'Avg Distance Hit (m)', format: formatDistance, higherIsBetter: true, varianceThreshold: 3 },
      { key: 'longestHit', label: 'Longest Hit (m)', format: formatDistance, higherIsBetter: true, varianceThreshold: 5 },
      { key: 'distanceVariation', label: 'Distance Variation (m)', format: formatDistance, higherIsBetter: false, varianceThreshold: 2 },
      { key: 'shortPct', label: 'Short %', format: formatPercent, higherIsBetter: false, varianceThreshold: 5 },
    ],
  },
  {
    name: 'Dispersion',
    key: 'dispersion',
    metrics: [
      { key: 'sideVariation', label: 'Side Variation (m)', format: formatDistance, higherIsBetter: false, varianceThreshold: 2 },
    ],
  },
  {
    name: 'Quality',
    key: 'quality',
    metrics: [
      { key: 'badMissPct', label: 'Bad Miss %', format: formatPercent, higherIsBetter: false, varianceThreshold: 3 },
      { key: 'strikeCentrePct', label: 'Strike Centre %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5 },
    ],
  },
  {
    name: 'Green Metrics',
    key: 'green',
    metrics: [
      { key: 'greensTargetedPct', label: 'Greens Targeted %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5, requiresDistanceToTarget: true },
      { key: 'greensHitPct', label: 'Greens Hit %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5, requiresDistanceToTarget: true },
      { key: 'avgDistanceToTarget', label: 'Avg Distance to Target (m)', format: formatDistance, higherIsBetter: false, varianceThreshold: 1, requiresDistanceToTarget: true },
      { key: 'distanceToTargetVariation', label: 'Dist-to-Target Variation (m)', format: formatDistance, higherIsBetter: false, varianceThreshold: 1, requiresDistanceToTarget: true },
    ],
  },
  {
    name: 'Proximity',
    key: 'proximity',
    metrics: [
      { key: 'proximityWithin1mPct', label: 'Within 1m %', format: formatPercent, higherIsBetter: true, varianceThreshold: 3, requiresDistanceToTarget: true },
      { key: 'proximityWithin3mPct', label: 'Within 3m %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5, requiresDistanceToTarget: true },
      { key: 'proximityWithin5mPct', label: 'Within 5m %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5, requiresDistanceToTarget: true },
      { key: 'proximityWithin10mPct', label: 'Within 10m %', format: formatPercent, higherIsBetter: true, varianceThreshold: 5, requiresDistanceToTarget: true },
    ],
  },
];

const SHOT_QUALITY_LEVELS = ['Pro', 'Elite Am', '0 Handicap', '5 Handicap', '10 Handicap', '15 Handicap', '20 Handicap', '25 Handicap'];

interface ClubData {
  clubName: string;
  config: ClubConfig | undefined;
  processedShots: ProcessedShot[];
  last5Rounds: MetricsResult;
  overall: MetricsResult;
  periods: {
    mostRecent: MetricsResult;
    middle: MetricsResult;
    oldest: MetricsResult;
  };
  quartiles: {
    top25: MetricsResult;
    top50: MetricsResult;
    top75: MetricsResult;
    top100: MetricsResult;
  };
  ratings: ClubRatings;
}

function calculateTrendDirection(
  periods: { mostRecent: number | null; middle: number | null; oldest: number | null },
  higherIsBetter: boolean,
  varianceThreshold: number
): TrendDirection {
  const { mostRecent, middle, oldest } = periods;
  
  // If any period is null, return stable
  if (mostRecent === null || middle === null || oldest === null) {
    return 'stable';
  }
  
  // Calculate trend: are we consistently improving or worsening across periods?
  const trend1 = mostRecent - middle; // Change from middle to most recent
  const trend2 = middle - oldest; // Change from oldest to middle
  
  // Overall direction: positive means values are increasing
  const overallTrend = (trend1 + trend2) / 2;
  const avgValue = (mostRecent + middle + oldest) / 3;
  
  // Calculate percentage change relative to average
  const percentChange = avgValue !== 0 ? (overallTrend / avgValue) * 100 : 0;
  
  // Determine if improving based on whether higher is better
  const isImproving = higherIsBetter ? overallTrend > 0 : overallTrend < 0;
  const absPercentChange = Math.abs(percentChange);
  
  if (absPercentChange < 1) {
    return 'stable';
  }
  
  if (isImproving) {
    return 'improving';
  }
  
  // Worsening - check severity
  if (absPercentChange > varianceThreshold) {
    return 'significantly-worse';
  }
  
  return 'slightly-worse';
}

function TrendArrow({ direction }: { direction: TrendDirection }) {
  switch (direction) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'slightly-worse':
      return <TrendingDown className="h-4 w-4 text-amber-500" />;
    case 'significantly-worse':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable':
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function MetricCell({ 
  value, 
  direction, 
  format 
}: { 
  value: number | null; 
  direction: TrendDirection; 
  format: (v: number | null) => string;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <span>{format(value)}</span>
      <TrendArrow direction={direction} />
    </div>
  );
}

export function AllClubsTab() {
  const { clubs, shots, isLoading, availableClubs, availableStartLies, distanceToTargetTolerance } = useGolfData();
  const [selectedStartLie, setSelectedStartLie] = useState<string>('all');
  const [selectedDistanceFilter, setSelectedDistanceFilter] = useState<string>('all');
  
  // Track expanded categories - must be at top level before any conditional returns
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['accuracy', 'quality']));
  
  // Track selected club for info sheet - must be at top level before any conditional returns
  const [selectedClubForSheet, setSelectedClubForSheet] = useState<string | null>(null);

  const clubsData = useMemo(() => {
    if (shots.length === 0 || availableClubs.length === 0) return null;

    let filteredShots = shots;
    if (selectedStartLie !== 'all') {
      filteredShots = filteredShots.filter(s => s.startLie === selectedStartLie);
    }
    // Apply distance to hole filter
    filteredShots = filterShotsByTargetDistance(filteredShots, selectedDistanceFilter);

    // Sort by date
    const sortedShots = [...filteredShots].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Process data for each club
    const clubDataMap: ClubData[] = availableClubs
      .filter(club => club && club.trim() !== '')
      .map(clubName => {
        const clubShots = sortedShots.filter(s => s.club === clubName);
        
        if (clubShots.length === 0) {
          return null;
        }

        const configId = getClubConfigId(clubName);
        const config = clubs.find(c => c.id === configId);

        // Process shots with club config
        const processed: ProcessedShot[] = clubShots.map(shot => 
          processShot(shot, config, distanceToTargetTolerance)
        );

        // Last 5 rounds
        const last5RoundsShots = getLastNRounds(processed, 5);
        const last5Rounds = calculateMetrics(last5RoundsShots, config);

        // Overall metrics
        const overall = calculateMetrics(processed, config);

        // Trend analysis (thirds)
        const [mostRecent, middle, oldest] = splitIntoThirds(processed);
        const periods = {
          mostRecent: calculateMetrics(mostRecent, config),
          middle: calculateMetrics(middle, config),
          oldest: calculateMetrics(oldest, config),
        };

        // Capability analysis - cumulative percentages
        const [top25, top50, top75, top100] = splitByQualityCumulative(processed);
        const quartiles = {
          top25: calculateMetrics(top25, config),
          top50: calculateMetrics(top50, config),
          top75: calculateMetrics(top75, config),
          top100: calculateMetrics(top100, config),
        };

        // Calculate ratings
        const ratings = calculateClubRatings(processed, config);

        return {
          clubName,
          config,
          processedShots: processed,
          last5Rounds,
          overall,
          periods,
          quartiles,
          ratings,
        };
      })
      .filter((data): data is ClubData => data !== null && data.last5Rounds.shotCount > 0)
      // Sort by stock distance (highest first - longest clubs first)
      .sort((a, b) => {
        const distA = a.config?.stockDistance ?? 0;
        const distB = b.config?.stockDistance ?? 0;
        return distB - distA;
      });

    return clubDataMap;
  }, [shots, availableClubs, selectedStartLie, selectedDistanceFilter, clubs, distanceToTargetTolerance]);

  const selectedClubData = clubsData?.find(cd => cd.clubName === selectedClubForSheet);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!clubsData || clubsData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No shot data available. Upload your shot data to get started.
        </CardContent>
      </Card>
    );
  }

  // Determine which categories to show based on clubs with distance-to-target enabled
  const hasDistanceToTargetClubs = clubsData.some(cd => cd.config?.distanceToTargetEnabled);
  
  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryKey)) {
        newSet.delete(categoryKey);
      } else {
        newSet.add(categoryKey);
      }
      return newSet;
    });
  };

  const allCategoryKeys = [...METRIC_CATEGORIES.map(c => c.key), 'shotQuality'];

  const toggleAllCategories = () => {
    const allExpanded = allCategoryKeys.every(key => expandedCategories.has(key));
    if (allExpanded) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(allCategoryKeys));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Start Lie:</label>
          <Select value={selectedStartLie} onValueChange={setSelectedStartLie}>
            <SelectTrigger className="w-[180px]">
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
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Distance to Hole:</label>
          <Select value={selectedDistanceFilter} onValueChange={setSelectedDistanceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select distance" />
            </SelectTrigger>
            <SelectContent>
              {DISTANCE_FILTER_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {clubsData.length} clubs with data
        </div>
      </div>

      {/* Club Ratings Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Club Ratings
          </CardTitle>
          <CardDescription>
            Overall performance ratings based on your historical data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card z-10">Rating</th>
                  {clubsData.map(cd => (
                    <th key={cd.clubName} className="text-center min-w-[100px]">
                      {cd.clubName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      Capability
                    </div>
                    <div className="text-xs text-muted-foreground">Top 25% shots</div>
                  </td>
                  {clubsData.map(cd => (
                    <td key={cd.clubName} className="text-center">
                      <div className={`text-lg font-bold ${getRatingColor(cd.ratings.capability)}`}>
                        {cd.ratings.capability}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Consistency
                    </div>
                    <div className="text-xs text-muted-foreground">All shots</div>
                  </td>
                  {clubsData.map(cd => (
                    <td key={cd.clubName} className="text-center">
                      <div className={`text-lg font-bold ${getRatingColor(cd.ratings.consistency)}`}>
                        {cd.ratings.consistency}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Current Form
                    </div>
                    <div className="text-xs text-muted-foreground">Last 5 Rounds</div>
                  </td>
                  {clubsData.map(cd => (
                    <td key={cd.clubName} className="text-center">
                      <div className={`text-lg font-bold ${getRatingColor(cd.ratings.currentForm)}`}>
                        {cd.ratings.currentForm}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="font-medium sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Improvement
                    </div>
                    <div className="text-xs text-muted-foreground">P1 → P2 → P3</div>
                  </td>
                  {clubsData.map(cd => {
                    const improvement = getImprovementDisplay(cd.ratings.improvement);
                    return (
                      <td key={cd.clubName} className="text-center">
                        <div className={`text-lg font-bold ${improvement.color}`}>
                          {improvement.text}
                        </div>
                      </td>
                    );
                  })}
                </tr>
                {/* View Details Button Row */}
                <tr>
                  <td className="font-medium sticky left-0 bg-card z-10">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Details
                    </div>
                    <div className="text-xs text-muted-foreground">Full Report</div>
                  </td>
                  {clubsData.map(cd => (
                    <td key={cd.clubName} className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedClubForSheet(cd.clubName)}
                        className="gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        View
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* All Clubs Summary Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              All Clubs Summary
            </CardTitle>
            <CardDescription>
              Last 5 Rounds performance with trend direction (P1 → P2 → P3)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllCategories}
            className="flex items-center gap-1"
          >
            <ChevronsUpDown className="h-4 w-4" />
            {allCategoryKeys.every(key => expandedCategories.has(key)) ? 'Collapse All' : 'Expand All'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card z-10">Metric</th>
                  {clubsData.map(cd => (
                    <th key={cd.clubName} className="text-center min-w-[100px]">
                      {cd.clubName}
                      <div className="text-xs font-normal text-muted-foreground">
                        ({cd.last5Rounds.shotCount} shots)
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_CATEGORIES.map(category => {
                  // Skip categories that require distance-to-target if no clubs have it
                  const hasRelevantMetrics = category.metrics.some(m => 
                    !m.requiresDistanceToTarget || hasDistanceToTargetClubs
                  );
                  if (!hasRelevantMetrics) return null;

                  const isExpanded = expandedCategories.has(category.key);
                  const metricsToShow = category.metrics.filter(m => 
                    !m.requiresDistanceToTarget || hasDistanceToTargetClubs
                  );

                  return (
                    <>
                      {/* Category Header Row */}
                      <tr 
                        key={category.key}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCategory(category.key)}
                      >
                        <td className="font-semibold sticky left-0 bg-card z-10 text-primary" colSpan={1}>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {category.name}
                          </div>
                        </td>
                        {clubsData.map(cd => (
                          <td key={cd.clubName} className="text-center text-muted-foreground text-xs">
                            {isExpanded ? '' : '...'}
                          </td>
                        ))}
                      </tr>
                      {/* Metric Rows (if expanded) */}
                      {isExpanded && metricsToShow.map(metric => (
                        <tr key={metric.key}>
                          <td className="font-medium sticky left-0 bg-card z-10 pl-8">{metric.label}</td>
                          {clubsData.map(cd => {
                            if (metric.requiresDistanceToTarget && !cd.config?.distanceToTargetEnabled) {
                              return (
                                <td key={cd.clubName} className="text-center text-muted-foreground">
                                  -
                                </td>
                              );
                            }

                            const value = cd.last5Rounds[metric.key as keyof typeof cd.last5Rounds] as number | null;
                            const direction = calculateTrendDirection(
                              {
                                mostRecent: cd.periods.mostRecent[metric.key as keyof typeof cd.periods.mostRecent] as number | null,
                                middle: cd.periods.middle[metric.key as keyof typeof cd.periods.middle] as number | null,
                                oldest: cd.periods.oldest[metric.key as keyof typeof cd.periods.oldest] as number | null,
                              },
                              metric.higherIsBetter,
                              metric.varianceThreshold
                            );

                            return (
                              <td key={cd.clubName} className="text-center">
                                <MetricCell value={value} direction={direction} format={metric.format} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  );
                })}
                {/* Shot Quality Category */}
                <tr 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory('shotQuality')}
                >
                  <td className="font-semibold sticky left-0 bg-card z-10 text-primary" colSpan={1}>
                    <div className="flex items-center gap-2">
                      {expandedCategories.has('shotQuality') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Shot Quality
                    </div>
                  </td>
                  {clubsData.map(cd => (
                    <td key={cd.clubName} className="text-center text-muted-foreground text-xs">
                      {expandedCategories.has('shotQuality') ? '' : '...'}
                    </td>
                  ))}
                </tr>
                {expandedCategories.has('shotQuality') && SHOT_QUALITY_LEVELS.map(level => (
                  <tr key={level}>
                    <td className="font-medium sticky left-0 bg-card z-10 pl-8">{level} %</td>
                    {clubsData.map(cd => {
                      const value = cd.last5Rounds.shotQualityPcts[level] ?? 0;
                      const direction = calculateTrendDirection(
                        {
                          mostRecent: cd.periods.mostRecent.shotQualityPcts[level] ?? 0,
                          middle: cd.periods.middle.shotQualityPcts[level] ?? 0,
                          oldest: cd.periods.oldest.shotQualityPcts[level] ?? 0,
                        },
                        true,
                        5
                      );

                      return (
                        <td key={cd.clubName} className="text-center">
                          <MetricCell value={value} direction={direction} format={formatPercent} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-6 justify-center text-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span>Improving</span>
            </div>
            <div className="flex items-center gap-2">
              <Minus className="h-4 w-4 text-muted-foreground" />
              <span>Stable</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span>Slightly Worse</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span>Significantly Worse</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Club Info Sheet Dialog */}
      {selectedClubData && (
        <ClubInfoSheet
          open={!!selectedClubForSheet}
          onOpenChange={(open) => !open && setSelectedClubForSheet(null)}
          clubName={selectedClubData.clubName}
          config={selectedClubData.config}
          ratings={selectedClubData.ratings}
          overall={selectedClubData.overall}
          last5Rounds={selectedClubData.last5Rounds}
          periods={selectedClubData.periods}
          quartiles={selectedClubData.quartiles}
        />
      )}
    </div>
  );
}
