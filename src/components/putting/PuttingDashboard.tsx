import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Activity, Clock3, Gauge, Goal, Minus, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DrillResult, PuttingMetric, PuttingSessionRecord } from '@/types/putting';
import { DRILL_METRIC_WEIGHTS, LOCKED_INDOOR_DRILLS, PUTTING_METRIC_LABELS } from '@/lib/putting/drills';
import { cn } from '@/lib/utils';

interface ScoreSample {
  percent: number;
  raw?: number;
  max?: number;
}

interface SummaryStats {
  currentForm: number | null;
  formCount: number;
  latest: number | null;
  best: ScoreSample | null;
  count: number;
  trend: TrendState;
}

interface TrendState {
  label: 'Getting better' | 'Same' | 'Getting worse' | 'Need 10 for trend';
  icon: typeof TrendingUp;
  className: string;
}

const metricIcons: Record<PuttingMetric, typeof Goal> = {
  startLineStrike: Goal,
  paceTouch: Gauge,
  conversionPressure: Activity,
};

const baselineTrend: TrendState = {
  label: 'Need 10 for trend',
  icon: Clock3,
  className: 'text-muted-foreground',
};

function average(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sessionPercent(session: PuttingSessionRecord): number | null {
  return session.max_total > 0 ? Math.round((Number(session.total_score) / Number(session.max_total)) * 100) : null;
}

function metricPercent(results: DrillResult[], metric: PuttingMetric): number | null {
  let score = 0;
  let weightTotal = 0;

  for (const result of results) {
    const weights = DRILL_METRIC_WEIGHTS[result.drill_name] ?? {};
    const weight = weights[metric] ?? 0;
    if (weight <= 0) continue;
    score += result.percent * weight;
    weightTotal += weight;
  }

  return weightTotal > 0 ? Math.round(score / weightTotal) : null;
}

function trendFrom(values: number[]): TrendState {
  if (values.length < 10) return baselineTrend;

  const recent = average(values.slice(0, 5));
  const previous = average(values.slice(5, 10));
  const diff = recent - previous;

  if (diff >= 5) {
    return { label: 'Getting better', icon: TrendingUp, className: 'text-green-600' };
  }
  if (diff <= -5) {
    return { label: 'Getting worse', icon: TrendingDown, className: 'text-red-600' };
  }
  return { label: 'Same', icon: Minus, className: 'text-muted-foreground' };
}

function summaryFrom(samples: ScoreSample[], latest: number | null): SummaryStats {
  const values = samples.map(sample => sample.percent);
  const formValues = values.slice(0, 10);
  const best = samples.length
    ? samples.reduce((bestSoFar, sample) => (sample.percent > bestSoFar.percent ? sample : bestSoFar), samples[0])
    : null;

  return {
    currentForm: formValues.length ? average(formValues) : null,
    formCount: formValues.length,
    latest,
    best,
    count: values.length,
    trend: trendFrom(values),
  };
}

function levelFor(score: number | null): { label: string; className: string; progressClass: string } {
  if (score === null) {
    return {
      label: 'No data',
      className: 'border-border bg-muted/20',
      progressClass: '[&>div]:bg-muted-foreground',
    };
  }
  if (score >= 90) {
    return {
      label: 'Elite',
      className: 'border-emerald-700/30 bg-emerald-50 ring-1 ring-amber-300/40',
      progressClass: '[&>div]:bg-amber-400',
    };
  }
  if (score >= 80) {
    return {
      label: 'Strong',
      className: 'border-green-600/30 bg-green-50',
      progressClass: '[&>div]:bg-green-600',
    };
  }
  if (score >= 60) {
    return {
      label: 'Developing',
      className: 'border-amber-500/30 bg-amber-50',
      progressClass: '[&>div]:bg-amber-500',
    };
  }
  return {
    label: 'Priority',
    className: 'border-red-500/30 bg-red-50',
    progressClass: '[&>div]:bg-red-600',
  };
}

function scoreText(score: number | null): string {
  return score === null ? 'No data' : `${score}%`;
}

function latestText(score: number | null): string {
  return score === null ? 'Not scored' : `${score}%`;
}

function currentFormLabel(stats: SummaryStats, unit: 'session' | 'result'): string {
  if (stats.formCount === 0) return 'No scored data yet';
  const plural = stats.formCount === 1 ? unit : `${unit}s`;
  return stats.formCount >= 10
    ? `Last 10 ${unit}s`
    : `Last ${stats.formCount} scored ${plural}`;
}

function bestText(best: ScoreSample | null): string {
  if (!best) return '—';
  if (typeof best.raw === 'number' && typeof best.max === 'number') {
    return `${best.raw}/${best.max} (${Math.round(best.percent)}%)`;
  }
  return `${Math.round(best.percent)}%`;
}

function TrendBadge({ trend }: { trend: TrendState }) {
  const Icon = trend.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium', trend.className)}>
      <Icon className="h-4 w-4" />
      {trend.label}
    </span>
  );
}

function SummaryCard({
  title,
  stats,
  icon: Icon,
  detail,
  latestValue,
}: {
  title: string;
  stats: SummaryStats;
  icon: typeof Goal;
  detail: string;
  latestValue?: string;
}) {
  const level = levelFor(stats.currentForm);
  const currentScore = stats.currentForm ?? 0;

  return (
    <div className={cn('rounded-md border p-4', level.className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail || currentFormLabel(stats, 'result')}</p>
        </div>
        <Icon className="h-5 w-5 shrink-0 text-primary" />
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold">{scoreText(stats.currentForm)}</div>
          <Badge variant="outline" className="mt-2">{level.label}</Badge>
        </div>
        <TrendBadge trend={stats.trend} />
      </div>
      <Progress value={currentScore} className={cn('mt-4 h-2', level.progressClass)} />
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <div className="flex justify-between gap-3"><span>Latest</span><span className="font-medium text-foreground">{latestValue ?? latestText(stats.latest)}</span></div>
        <div className="flex justify-between gap-3"><span>Best</span><span className="font-medium text-foreground">{bestText(stats.best)}</span></div>
        <div className="flex justify-between gap-3"><span>Scored</span><span className="font-medium text-foreground">{stats.count}</span></div>
      </div>
    </div>
  );
}

interface PuttingDashboardProps {
  sessions?: PuttingSessionRecord[];
  loading?: boolean;
}

export function PuttingDashboard({ sessions: providedSessions, loading: providedLoading }: PuttingDashboardProps = {}) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const shouldLoadSessions = providedSessions === undefined;

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('putting_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', 'indoor')
      .order('session_date', { ascending: false })
      .limit(1000);

    setSessions((data ?? []).map(s => ({
      ...s,
      category: s.category as 'indoor' | 'outdoor',
      drill_results: s.drill_results as unknown as DrillResult[],
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (shouldLoadSessions) loadSessions();
  }, [loadSessions, shouldLoadSessions]);

  const activeSessions = providedSessions ?? sessions;
  const isLoading = providedLoading ?? loading;

  const dashboard = useMemo(() => {
    const sorted = [...activeSessions].sort((a, b) => b.session_date.localeCompare(a.session_date));
    const latestSession = sorted[0] ?? null;
    const sessionSamples = sorted
      .map(session => {
        const percent = sessionPercent(session);
        return percent === null ? null : { percent, raw: Number(session.total_score), max: Number(session.max_total) };
      })
      .filter((sample): sample is ScoreSample => sample !== null);

    const categoryStats = (Object.keys(PUTTING_METRIC_LABELS) as PuttingMetric[]).map(metric => {
      const samples = sorted
        .map(session => {
          const percent = metricPercent(session.drill_results, metric);
          return percent === null ? null : { percent };
        })
        .filter((sample): sample is ScoreSample => sample !== null);

      const latest = latestSession ? metricPercent(latestSession.drill_results, metric) : null;
      return {
        metric,
        label: PUTTING_METRIC_LABELS[metric],
        stats: summaryFrom(samples, latest),
      };
    });

    const drillNames = new Map<string, number>();
    for (const drill of LOCKED_INDOOR_DRILLS) {
      drillNames.set(drill.name, drill.sort_order);
    }
    for (const session of sorted) {
      for (const result of session.drill_results) {
        if (!drillNames.has(result.drill_name)) drillNames.set(result.drill_name, 999);
      }
    }

    const drillStats = [...drillNames.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([drillName]) => {
        const samples = sorted.flatMap(session =>
          session.drill_results
            .filter(result => result.drill_name === drillName)
            .map(result => ({
              percent: Math.round(result.percent),
              raw: result.final_score,
              max: result.max_score,
            })),
        );
        const latestResult = latestSession?.drill_results.find(result => result.drill_name === drillName) ?? null;
        return {
          drillName,
          stats: summaryFrom(
            samples,
            latestResult ? Math.round(latestResult.percent) : null,
          ),
          latestRaw: latestResult ? `${latestResult.final_score}/${latestResult.max_score}` : 'Not scored',
        };
      });

    return {
      latestSession,
      overall: summaryFrom(sessionSamples, latestSession ? sessionPercent(latestSession) : null),
      categoryStats,
      drillStats,
      scoredSessions: sorted.length,
    };
  }, [activeSessions]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Loading putting dashboard...</CardContent>
      </Card>
    );
  }

  if (!dashboard.latestSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Putting Dashboard</CardTitle>
          <CardDescription>Score the home putting drills to start tracking your trend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {Object.entries(PUTTING_METRIC_LABELS).map(([metric, label]) => {
            const Icon = metricIcons[metric as PuttingMetric];
            return (
              <div key={metric} className="rounded-md border bg-muted/20 p-4">
                <Icon className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold">{label}</p>
                <p className="mt-1 text-sm text-muted-foreground">No scored sessions yet</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  }

  const overallLevel = levelFor(dashboard.overall.currentForm);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Putting Dashboard</CardTitle>
            <CardDescription>
              Latest: {format(new Date(dashboard.latestSession.session_date), 'MMM d')} · {dashboard.scoredSessions} scored session{dashboard.scoredSessions === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Trophy className="h-3.5 w-3.5" />
            Best {bestText(dashboard.overall.best)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={cn('rounded-md border p-5', overallLevel.className)}>
          <div className="grid gap-5 lg:grid-cols-[minmax(220px,300px)_1fr]">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Form</p>
              <div className="mt-2 text-5xl font-bold">{scoreText(dashboard.overall.currentForm)}</div>
              <p className="mt-2 text-sm text-muted-foreground">{currentFormLabel(dashboard.overall, 'session')}</p>
              <Badge variant="outline" className="mt-3">{overallLevel.label}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Latest</p>
                <p className="mt-1 font-semibold">{latestText(dashboard.overall.latest)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Best</p>
                <p className="mt-1 font-semibold">{bestText(dashboard.overall.best)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Total scored sessions</p>
                <p className="mt-1 font-semibold">{dashboard.overall.count}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Trend</p>
                <div className="mt-1"><TrendBadge trend={dashboard.overall.trend} /></div>
              </div>
            </div>
          </div>
          <Progress value={dashboard.overall.currentForm ?? 0} className={cn('mt-5 h-2', overallLevel.progressClass)} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {dashboard.categoryStats.map(summary => (
            <SummaryCard
              key={summary.metric}
              title={summary.label}
              stats={summary.stats}
              icon={metricIcons[summary.metric]}
              detail={currentFormLabel(summary.stats, 'result')}
            />
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">Drill Performance</h3>
            <p className="text-sm text-muted-foreground">Each drill tracks current form, latest result, best score, and trend.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.drillStats.map(({ drillName, stats, latestRaw }) => (
              <SummaryCard
                key={drillName}
                title={drillName}
                stats={stats}
                icon={Goal}
                detail={currentFormLabel(stats, 'result')}
                latestValue={latestRaw}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
