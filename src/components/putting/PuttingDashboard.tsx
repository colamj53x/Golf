import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, Gauge, Goal, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DrillResult, PuttingMetric, PuttingSessionRecord } from '@/types/putting';
import { DRILL_METRIC_WEIGHTS, PUTTING_METRIC_LABELS } from '@/lib/putting/drills';
import { format } from 'date-fns';

interface MetricSummary {
  metric: PuttingMetric;
  label: string;
  latest: number;
  lastFive: number;
  trend: number;
}

const metricIcons: Record<PuttingMetric, typeof Goal> = {
  startLineStrike: Goal,
  paceTouch: Gauge,
  conversionPressure: Activity,
};

function computeMetrics(results: DrillResult[]): Record<PuttingMetric, number> {
  const totals: Record<PuttingMetric, { score: number; weight: number }> = {
    startLineStrike: { score: 0, weight: 0 },
    paceTouch: { score: 0, weight: 0 },
    conversionPressure: { score: 0, weight: 0 },
  };

  for (const result of results) {
    const weights = DRILL_METRIC_WEIGHTS[result.drill_name] ?? {};
    for (const [metric, weight] of Object.entries(weights)) {
      const key = metric as PuttingMetric;
      totals[key].score += result.percent * (weight ?? 0);
      totals[key].weight += weight ?? 0;
    }
  }

  return {
    startLineStrike: totals.startLineStrike.weight ? Math.round(totals.startLineStrike.score / totals.startLineStrike.weight) : 0,
    paceTouch: totals.paceTouch.weight ? Math.round(totals.paceTouch.score / totals.paceTouch.weight) : 0,
    conversionPressure: totals.conversionPressure.weight ? Math.round(totals.conversionPressure.score / totals.conversionPressure.weight) : 0,
  };
}

function sessionPercent(session: PuttingSessionRecord): number {
  return session.max_total > 0 ? Math.round((Number(session.total_score) / Number(session.max_total)) * 100) : 0;
}

export function PuttingDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    loadSessions();
  }, [loadSessions]);

  const dashboard = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date));
    const latest = sorted[0] ?? null;
    const previous = sorted[1] ?? null;
    const lastFive = sorted.slice(0, 5);
    const latestMetrics = latest ? computeMetrics(latest.drill_results) : null;
    const previousMetrics = previous ? computeMetrics(previous.drill_results) : null;

    const metricSummaries: MetricSummary[] = (Object.keys(PUTTING_METRIC_LABELS) as PuttingMetric[]).map(metric => {
      const lastFiveValues = lastFive
        .map(session => computeMetrics(session.drill_results)[metric])
        .filter(value => value > 0);
      const lastFiveAvg = lastFiveValues.length
        ? Math.round(lastFiveValues.reduce((sum, value) => sum + value, 0) / lastFiveValues.length)
        : 0;

      return {
        metric,
        label: PUTTING_METRIC_LABELS[metric],
        latest: latestMetrics?.[metric] ?? 0,
        lastFive: lastFiveAvg,
        trend: (latestMetrics?.[metric] ?? 0) - (previousMetrics?.[metric] ?? 0),
      };
    });

    const lastFiveScore = lastFive.length
      ? Math.round(lastFive.reduce((sum, session) => sum + sessionPercent(session), 0) / lastFive.length)
      : 0;

    return {
      latest,
      latestScore: latest ? sessionPercent(latest) : 0,
      lastFiveScore,
      metricSummaries,
      sessions: sorted.length,
    };
  }, [sessions]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">Loading putting dashboard...</CardContent>
      </Card>
    );
  }

  if (!dashboard.latest) {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Putting Dashboard</CardTitle>
            <CardDescription>
              Latest: {format(new Date(dashboard.latest.session_date), 'MMM d')} · {dashboard.sessions} scored session{dashboard.sessions === 1 ? '' : 's'}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Last 5 avg {dashboard.lastFiveScore}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
          <div className="rounded-md border bg-primary/5 p-5">
            <p className="text-sm font-medium text-muted-foreground">Latest overall</p>
            <div className="mt-2 text-5xl font-bold">{dashboard.latestScore}%</div>
            <p className="mt-2 text-sm text-muted-foreground">
              {dashboard.latest.total_score} / {dashboard.latest.max_total}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {dashboard.metricSummaries.map(summary => {
              const Icon = metricIcons[summary.metric];
              return (
                <div key={summary.metric} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <Badge variant={summary.trend >= 0 ? 'secondary' : 'outline'}>
                      {summary.trend >= 0 ? '+' : ''}{summary.trend}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold">{summary.label}</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-3xl font-bold">{summary.latest}%</span>
                    <span className="pb-1 text-xs text-muted-foreground">last 5: {summary.lastFive}%</span>
                  </div>
                  <Progress value={summary.latest} className="mt-3 h-2" />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
