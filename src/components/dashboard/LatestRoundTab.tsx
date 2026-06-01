import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Target, Activity, Award, ChevronDown, ChevronRight, ChevronsUpDown, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPercent, formatDistance, MetricsResult } from '@/lib/golfCalculations';
import { METRIC_CATEGORIES, SHOT_QUALITY_LEVELS } from '@/lib/metricCategories';
import { describeHandicapEquivalent } from '@/lib/analysisSynthesis';
import { useState } from 'react';

interface LatestRoundTabProps {
  lastRound: MetricsResult;
  last5Rounds: MetricsResult;
  mostRecentThird: MetricsResult;
  distanceToTargetEnabled: boolean;
  roundDate: string;
}

type ComparisonStatus = 'better' | 'worse' | 'same';

// Define which metrics are "lower is better"
const LOWER_IS_BETTER_METRICS = new Set([
  'badMissPct',
  'sideVariation',
  'distanceVariation',
  'shortPct',
  'rightPct',
  'leftPct',
  'avgDistanceToTarget',
  'distanceToTargetVariation',
]);

function getComparison(current: number | null, baseline: number | null, metricKey: string): ComparisonStatus {
  if (current === null || baseline === null) return 'same';
  const higherIsBetter = !LOWER_IS_BETTER_METRICS.has(metricKey);
  const threshold = 0.05; // 5% threshold for "same"
  const diff = higherIsBetter ? current - baseline : baseline - current;
  const percentDiff = baseline !== 0 ? Math.abs(diff / baseline) : Math.abs(diff);
  
  if (percentDiff < threshold) return 'same';
  return diff > 0 ? 'better' : 'worse';
}

function ComparisonIndicator({ status }: { status: ComparisonStatus }) {
  if (status === 'better') return <TrendingUp className="h-4 w-4 text-primary" />;
  if (status === 'worse') return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function MetricComparisonRow({ 
  label, 
  current, 
  baseline1,
  baseline2,
  format, 
  metricKey
}: { 
  label: string;
  current: number | null;
  baseline1: number | null;
  baseline2: number | null;
  format: (v: number | null) => string;
  metricKey: string;
}) {
  const status1 = getComparison(current, baseline1, metricKey);
  const status2 = getComparison(current, baseline2, metricKey);
  
  return (
    <tr>
      <td className="font-medium pl-8">{label}</td>
      <td className="text-center">
        <span className="font-semibold">{format(current)}</span>
      </td>
      <td className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-muted-foreground">{format(baseline1)}</span>
          <ComparisonIndicator status={status1} />
        </div>
      </td>
      <td className="text-center">
        <div className="flex items-center justify-center gap-1">
          <span className="text-muted-foreground">{format(baseline2)}</span>
          <ComparisonIndicator status={status2} />
        </div>
      </td>
    </tr>
  );
}

const formatSqi = (value: number | null) => value === null ? '-' : `${Math.round(value)} / 100`;

export function LatestRoundTab({ lastRound, last5Rounds, mostRecentThird, distanceToTargetEnabled, roundDate }: LatestRoundTabProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['accuracy', 'quality']));

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

  if (lastRound.shotCount === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No shots recorded in this round.
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats vs L5R
  const onTargetStatusL5R = getComparison(lastRound.onTargetPct, last5Rounds.onTargetPct, 'onTargetPct');
  const badMissStatusL5R = getComparison(lastRound.badMissPct, last5Rounds.badMissPct, 'badMissPct');
  const strikeCentreStatusL5R = getComparison(lastRound.strikeCentrePct, last5Rounds.strikeCentrePct, 'strikeCentrePct');
  const sqiStatusL5R = getComparison(lastRound.shotQualityIndex, last5Rounds.shotQualityIndex, 'shotQualityIndex');

  // Calculate summary stats vs Recent 1/3
  const onTargetStatusRecent = getComparison(lastRound.onTargetPct, mostRecentThird.onTargetPct, 'onTargetPct');
  const badMissStatusRecent = getComparison(lastRound.badMissPct, mostRecentThird.badMissPct, 'badMissPct');
  const strikeCentreStatusRecent = getComparison(lastRound.strikeCentrePct, mostRecentThird.strikeCentrePct, 'strikeCentrePct');
  const sqiStatusRecent = getComparison(lastRound.shotQualityIndex, mostRecentThird.shotQualityIndex, 'shotQualityIndex');

  // Helper to get border color based on both statuses
  const getBorderColor = (status1: ComparisonStatus, status2: ComparisonStatus) => {
    if (status1 === 'better' && status2 === 'better') return 'border-l-primary';
    if (status1 === 'worse' && status2 === 'worse') return 'border-l-destructive';
    if (status1 === 'better' || status2 === 'better') return 'border-l-primary/50';
    if (status1 === 'worse' || status2 === 'worse') return 'border-l-destructive/50';
    return 'border-l-muted';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className={`stat-card border-l-4 ${getBorderColor(sqiStatusL5R, sqiStatusRecent)}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Shot Quality Index</p>
                <p className="text-2xl font-bold">{formatSqi(lastRound.shotQualityIndex)}</p>
                <p className="text-xs font-medium text-primary">{describeHandicapEquivalent(lastRound.shotQualityIndex)}</p>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">L5R: {formatSqi(last5Rounds.shotQualityIndex)}</span>
                    <ComparisonIndicator status={sqiStatusL5R} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Recent ⅓: {formatSqi(mostRecentThird.shotQualityIndex)}</span>
                    <ComparisonIndicator status={sqiStatusRecent} />
                  </div>
                </div>
              </div>
              <Gauge className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`stat-card border-l-4 ${getBorderColor(badMissStatusL5R, badMissStatusRecent)}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Bad Miss %</p>
                <p className="text-2xl font-bold">{formatPercent(lastRound.badMissPct)}</p>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">L5R: {formatPercent(last5Rounds.badMissPct)}</span>
                    <ComparisonIndicator status={badMissStatusL5R} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Recent ⅓: {formatPercent(mostRecentThird.badMissPct)}</span>
                    <ComparisonIndicator status={badMissStatusRecent} />
                  </div>
                </div>
              </div>
              <Activity className="h-8 w-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`stat-card border-l-4 ${getBorderColor(onTargetStatusL5R, onTargetStatusRecent)}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">On-Target %</p>
                <p className="text-2xl font-bold">{formatPercent(lastRound.onTargetPct)}</p>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">L5R: {formatPercent(last5Rounds.onTargetPct)}</span>
                    <ComparisonIndicator status={onTargetStatusL5R} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Recent ⅓: {formatPercent(mostRecentThird.onTargetPct)}</span>
                    <ComparisonIndicator status={onTargetStatusRecent} />
                  </div>
                </div>
              </div>
              <Target className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`stat-card border-l-4 ${getBorderColor(strikeCentreStatusL5R, strikeCentreStatusRecent)}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Strike Centre %</p>
                <p className="text-2xl font-bold">{formatPercent(lastRound.strikeCentrePct)}</p>
                <div className="flex gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">L5R: {formatPercent(last5Rounds.strikeCentrePct)}</span>
                    <ComparisonIndicator status={strikeCentreStatusL5R} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Recent ⅓: {formatPercent(mostRecentThird.strikeCentrePct)}</span>
                    <ComparisonIndicator status={strikeCentreStatusRecent} />
                  </div>
                </div>
              </div>
              <Award className="h-8 w-8 text-accent opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Comparison Table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Round Comparison
            </CardTitle>
            <CardDescription>
              {roundDate} vs its trailing 5 rounds and recent 1/3
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
                  <th>Metric</th>
                  <th className="text-center">Selected Round</th>
                  <th className="text-center">Last 5 Rounds</th>
                  <th className="text-center">Recent 1/3</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_CATEGORIES.map(category => {
                  const hasRelevantMetrics = category.metrics.some(m => 
                    !m.requiresDistanceToTarget || distanceToTargetEnabled
                  );
                  if (!hasRelevantMetrics) return null;

                  const isExpanded = expandedCategories.has(category.key);
                  const metricsToShow = category.metrics.filter(m => 
                    !m.requiresDistanceToTarget || distanceToTargetEnabled
                  );

                  return (
                    <>
                      {/* Category Header Row */}
                      <tr 
                        key={category.key}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCategory(category.key)}
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
                      </tr>
                      {/* Metric Rows (if expanded) */}
                      {isExpanded && metricsToShow.map(metric => (
                        <MetricComparisonRow
                          key={metric.key}
                          label={metric.label}
                          current={lastRound[metric.key as keyof MetricsResult] as number | null}
                          baseline1={last5Rounds[metric.key as keyof MetricsResult] as number | null}
                          baseline2={mostRecentThird[metric.key as keyof MetricsResult] as number | null}
                          format={metric.format}
                          metricKey={metric.key}
                        />
                      ))}
                    </>
                  );
                })}
                {/* Shot Quality Category */}
                <tr 
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCategory('shotQuality')}
                >
                  <td className="font-semibold text-primary" colSpan={1}>
                    <div className="flex items-center gap-2">
                      {expandedCategories.has('shotQuality') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      Shot Quality
                    </div>
                  </td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCategories.has('shotQuality') ? '' : '...'}</td>
                  <td className="text-center text-muted-foreground text-xs">{expandedCategories.has('shotQuality') ? '' : '...'}</td>
                </tr>
                {expandedCategories.has('shotQuality') && SHOT_QUALITY_LEVELS.map(level => (
                  <MetricComparisonRow
                    key={level}
                    label={`${level} %`}
                    current={lastRound.shotQualityPcts[level]}
                    baseline1={last5Rounds.shotQualityPcts[level]}
                    baseline2={mostRecentThird.shotQualityPcts[level]}
                    format={formatPercent}
                    metricKey="shotQuality"
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
