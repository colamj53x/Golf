import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarRange,
  ClipboardList,
  CircleDot,
  Gauge,
  Layers3,
} from 'lucide-react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { useAnalysisPuttingSessions } from '@/hooks/useAnalysisPuttingSessions';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import {
  buildAnalysisModel,
  type AnalysisConfidence,
  type AnalysisTrend,
  type SqiSegment,
} from '@/lib/analysisSynthesis';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { buildPracticePriorities } from '@/lib/practicePriorities';
import { useShotClassificationRules } from '@/lib/shotClassificationRules';
import { useShotProfiles } from '@/lib/shotProfiles';

const confidenceLabel: Record<AnalysisConfidence, string> = {
  high: 'High confidence',
  medium: 'Emerging',
  low: 'Early signal',
  none: 'More data needed',
};

const trendLabel: Record<AnalysisTrend, string> = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Declining',
  volatile: 'Volatile',
  insufficient: 'More data needed',
};

const confidenceClasses: Record<AnalysisConfidence, string> = {
  high: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-orange-200 bg-orange-50 text-orange-800',
  none: 'border-slate-200 bg-slate-50 text-slate-600',
};

function ConfidenceBadge({ value }: { value: AnalysisConfidence }) {
  return <Badge variant="outline" className={confidenceClasses[value]}>{confidenceLabel[value]}</Badge>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = 'default',
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  return (
    <Card className={cn('overflow-hidden border-l-4', tone === 'good' && 'border-l-emerald-500', tone === 'warn' && 'border-l-amber-500', tone === 'default' && 'border-l-slate-400')}>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function EmptyCard({ children }: { children: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{children}</div>;
}

function SqiPerspectivePanel({
  title,
  description,
  segments,
}: {
  title: string;
  description: string;
  segments: SqiSegment[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/30 p-4">
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rounds</TableHead>
            <TableHead className="text-right">SQI</TableHead>
            <TableHead className="text-right">Damage / round</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {segments.map((segment) => (
            <TableRow key={segment.id}>
              <TableCell>
                <div className="font-semibold">{segment.label}</div>
                <div className="text-xs text-muted-foreground">{segment.rounds} captured rounds</div>
              </TableCell>
              <TableCell className="text-right">
                <div className="text-lg font-bold">{segment.sqi ?? '-'}</div>
                <div className="whitespace-nowrap text-xs text-muted-foreground">{segment.handicapEquivalent}</div>
              </TableCell>
              <TableCell className="text-right">{segment.rounds ? segment.damagePerRound : '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function AnalysisOverview({
  onOpenLatestRound,
  onOpenPractice,
}: {
  onOpenLatestRound?: () => void;
  onOpenPractice?: () => void;
} = {}) {
  const { shots, clubs, roundReflections, gappingHcpTarget, isLoading: golfLoading } = useGolfData();
  const { practiceConfigs, practiceSessions, isLoading: practiceLoading } = usePracticeData();
  const puttingSessions = useAnalysisPuttingSessions();
  const profiles = useShotProfiles();
  const shotClassificationRules = useShotClassificationRules();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const analysis = useMemo(() => buildAnalysisModel({
    shots,
    clubs,
    roundReflections,
    practiceSessions,
    puttingSessions,
  }), [clubs, practiceSessions, puttingSessions, roundReflections, shots]);
  const priorities = useMemo(() => buildPracticePriorities({
    shots,
    profiles,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
    shotClassificationRules,
  }).slice(0, 3), [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shots, shotsBySession, shotClassificationRules]);

  if (golfLoading || practiceLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white shadow-lg">
        <CardContent className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              <Brain className="h-5 w-5" />
              Game diagnosis
            </div>
            <p className="max-w-4xl text-lg font-medium leading-relaxed text-white">{analysis.diagnosis}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
              <ConfidenceBadge value={analysis.confidence} />
              <span>{analysis.shots} course shots</span>
              <span>·</span>
              <span>{analysis.rounds} rounds</span>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 text-center backdrop-blur-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Shot Quality Index</div>
            <div className="mt-1 text-6xl font-black tracking-tight">{analysis.sqi ?? '-'}</div>
            <div className="text-sm text-emerald-100">{analysis.handicapEquivalent}</div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Gauge} label="SQI" value={analysis.sqi === null ? '-' : `${analysis.sqi} / 100`} detail={`${analysis.handicapEquivalent}; ${analysis.change !== null && analysis.change >= 0 ? '+' : ''}${analysis.change ?? '-'} vs baseline`} tone="good" />
        <MetricCard icon={AlertTriangle} label="Costly miss" value={`${analysis.badMissPct}%`} detail="Misses likely to cost position or a shot" tone="warn" />
        <MetricCard icon={CircleDot} label="Damage" value={`${analysis.damagePerRound}`} detail={`${analysis.scoringDamage} estimated shots across captured rounds`} tone="warn" />
        <MetricCard icon={Activity} label="Current form" value={trendLabel[analysis.trend]} detail="Recent 25% of rounds compared with early 25%" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Top 3 priorities</CardTitle>
            <CardDescription>Focus the next practice block on the score-risk areas with the strongest evidence.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {priorities.length === 0 && <EmptyCard>Capture more course shots to establish ranked priorities.</EmptyCard>}
            {priorities.map((priority, index) => (
              <div key={priority.configKey} className="rounded-lg border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority {index + 1}</div>
                <div className="mt-1 font-bold">{priority.clubName} · {priority.shotLabel}</div>
                <p className="mt-2 text-sm">{priority.recommendation}</p>
                <div className="mt-2 text-xs text-muted-foreground">{priority.evidence}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Next practice recommendation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {priorities[0]?.recommendation ?? 'Capture more course shots to create a focused recommendation.'}
            </p>
            {onOpenPractice && <Button className="w-full gap-2" onClick={onOpenPractice}>Open practice <ArrowRight className="h-4 w-4" /></Button>}
            {onOpenLatestRound && <Button className="w-full gap-2" variant="outline" onClick={onOpenLatestRound}>Latest round <ArrowRight className="h-4 w-4" /></Button>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5 text-emerald-700" /> SQI perspective</CardTitle>
          <CardDescription>
            Put the index in context: how your game has changed over time, and the scoring range between your stronger and weaker rounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <CalendarRange className="h-4 w-4" />
              Form over time
            </div>
            <SqiPerspectivePanel
              title="Round timeline"
              description="Captured rounds in date order. Compare your recent quarter with the rounds that established your starting point."
              segments={[...analysis.chronologicalSqi].reverse()}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <Layers3 className="h-4 w-4" />
              Round quality range
            </div>
            <SqiPerspectivePanel
              title="Performance bands"
              description="Captured rounds ranked by SQI. This shows the difference between your better scoring days and the rounds that need protecting."
              segments={[...analysis.qualitySqi].reverse()}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-orange-700" /> Reflection intelligence</CardTitle>
          <CardDescription>{analysis.reflectionSummary}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {analysis.reflectionThemes.length === 0 && <EmptyCard>Add short reflections after rounds and sessions. Repeated themes will appear here.</EmptyCard>}
          {analysis.reflectionThemes.slice(0, 6).map((theme) => (
            <div key={theme.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{theme.label}</div>
                <ConfidenceBadge value={theme.confidence} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{theme.count} mentions · {theme.linkedData}</div>
              <p className="mt-2 text-sm">{theme.meaning}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
