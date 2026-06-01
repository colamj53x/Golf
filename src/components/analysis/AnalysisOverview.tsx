import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CircleDot,
  Gauge,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { useAnalysisPuttingSessions } from '@/hooks/useAnalysisPuttingSessions';
import {
  buildAnalysisModel,
  type AnalysisConfidence,
  type AnalysisTrend,
  type TransferStatus,
} from '@/lib/analysisSynthesis';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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

const transferLabel: Record<TransferStatus, string> = {
  transferring: 'Transferring',
  'not-yet-transferring': 'Not yet transferring',
  'course-better': 'Course better than practice',
  insufficient: 'Insufficient data',
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

function TrendIcon({ value }: { value: AnalysisTrend }) {
  if (value === 'improving') return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (value === 'declining') return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  return <ArrowRight className="h-4 w-4 text-slate-500" />;
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

export function AnalysisOverview() {
  const { shots, clubs, roundReflections, isLoading: golfLoading } = useGolfData();
  const { practiceSessions, isLoading: practiceLoading } = usePracticeData();
  const puttingSessions = useAnalysisPuttingSessions();
  const analysis = useMemo(() => buildAnalysisModel({
    shots,
    clubs,
    roundReflections,
    practiceSessions,
    puttingSessions,
  }), [clubs, practiceSessions, puttingSessions, roundReflections, shots]);
  const transferHeadline = analysis.transferInsights.find((row) => row.status !== 'insufficient');

  if (golfLoading || practiceLoading) {
    return <div className="space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-64 w-full" /></div>;
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
            <div className="text-sm text-emerald-100">{analysis.currentLevel}</div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard icon={Gauge} label="SQI" value={analysis.sqi === null ? '-' : `${analysis.sqi} / 100`} detail={`${analysis.change !== null && analysis.change >= 0 ? '+' : ''}${analysis.change ?? '-'} vs baseline`} tone="good" />
        <MetricCard icon={AlertTriangle} label="Costly miss" value={`${analysis.badMissPct}%`} detail="Misses likely to cost position or a shot" tone="warn" />
        <MetricCard icon={CircleDot} label="Damage" value={`${analysis.damagePerRound}`} detail={`${analysis.scoringDamage} estimated shots across captured rounds`} tone="warn" />
        <MetricCard icon={Activity} label="Current form" value={trendLabel[analysis.trend]} detail={`${analysis.baselineSqi ?? '-'} all-time SQI baseline`} />
        <MetricCard icon={Target} label="Top leak" value={analysis.priorities[0]?.clubName || '-'} detail={analysis.topLeak} tone="warn" />
        <MetricCard icon={ShieldCheck} label="Practice transfer" value={transferHeadline ? transferLabel[transferHeadline.status] : 'More data needed'} detail={transferHeadline?.clubName || 'Capture matching practice and course samples'} tone={transferHeadline?.status === 'transferring' ? 'good' : 'default'} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-amber-600" /> Top club priorities</CardTitle>
            <CardDescription>Ranked by scoring damage, costly misses, and shot quality. Low samples are shown cautiously.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.priorities.length === 0 && <EmptyCard>Capture at least eight shots with a club to unlock a priority recommendation.</EmptyCard>}
            {analysis.priorities.map((priority) => (
              <div key={priority.clubId} className="rounded-xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-900">{priority.rank}</span>
                    <div>
                      <div className="font-bold">{priority.clubName}</div>
                      <div className="text-xs text-muted-foreground">{priority.evidence}</div>
                    </div>
                  </div>
                  <ConfidenceBadge value={priority.confidence} />
                </div>
                <p className="mt-3 text-sm leading-relaxed">{priority.recommendation}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-emerald-600" /> Most reliable clubs</CardTitle>
            <CardDescription>Clubs currently giving you the strongest playable outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.reliableClubs.length === 0 && <EmptyCard>More club-level samples are needed before a strength is declared.</EmptyCard>}
            {analysis.reliableClubs.map((club) => (
              <div key={club.clubId} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-semibold">{club.clubName}</div>
                  <div className="text-xs text-muted-foreground">SQI {club.sqi ?? '-'} · Costly miss {club.badMissPct}%</div>
                </div>
                <ConfidenceBadge value={club.confidence} />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-700" /> What is changing?</CardTitle>
          <CardDescription>Recent form compared with the longer baseline, so older data does not hide movement.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Area</TableHead><TableHead>Trend</TableHead><TableHead>Evidence</TableHead><TableHead>Coach&apos;s read</TableHead><TableHead>Confidence</TableHead></TableRow></TableHeader>
            <TableBody>
              {analysis.formInsights.map((row) => (
                <TableRow key={row.area}>
                  <TableCell className="font-semibold">{row.area}</TableCell>
                  <TableCell><div className="flex items-center gap-2"><TrendIcon value={row.trend} />{trendLabel[row.trend]}</div></TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{row.evidence}</TableCell>
                  <TableCell className="min-w-[280px]">{row.meaning}</TableCell>
                  <TableCell><ConfidenceBadge value={row.confidence} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-sky-700" /> Practice to course transfer</CardTitle>
          <CardDescription>Only matched structured samples are compared. Where the evidence is weak, the answer stays honest.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Skill / club</TableHead><TableHead>Status</TableHead><TableHead>Evidence</TableHead><TableHead>Action</TableHead><TableHead>Confidence</TableHead></TableRow></TableHeader>
            <TableBody>
              {analysis.transferInsights.map((row) => (
                <TableRow key={row.clubName}>
                  <TableCell className="font-semibold">{row.clubName}</TableCell>
                  <TableCell>{transferLabel[row.status]}</TableCell>
                  <TableCell className="min-w-[220px] text-muted-foreground">{row.evidence}</TableCell>
                  <TableCell className="min-w-[260px]">{row.action}</TableCell>
                  <TableCell><ConfidenceBadge value={row.confidence} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CircleDot className="h-5 w-5 text-rose-700" /> Miss pattern heatmap</CardTitle>
            <CardDescription>This is the shape of the miss, not merely whether it was bad.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Club</TableHead><TableHead>Shots</TableHead><TableHead>SQI</TableHead><TableHead>Side pattern</TableHead><TableHead>Distance pattern</TableHead><TableHead>Common tags</TableHead><TableHead>End lie</TableHead><TableHead>Confidence</TableHead></TableRow></TableHeader>
              <TableBody>
                {analysis.clubInsights.map((club) => (
                  <TableRow key={club.clubId}>
                    <TableCell className="font-semibold">{club.clubName}</TableCell>
                    <TableCell>{club.shots}</TableCell>
                    <TableCell>{club.sqi ?? '-'}</TableCell>
                    <TableCell>{club.direction}</TableCell>
                    <TableCell>{club.distance}</TableCell>
                    <TableCell>{club.tags.join(', ') || '-'}</TableCell>
                    <TableCell>{club.commonEndLie}</TableCell>
                    <TableCell><ConfidenceBadge value={club.confidence} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-orange-700" /> Reflection intelligence</CardTitle>
            <CardDescription>{analysis.reflectionSummary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-700" /> Bad miss and scoring damage</CardTitle>
          <CardDescription>Estimated only from captured end lies, penalties, recovery outcomes, and explicit strike tags.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Club</TableHead><TableHead>Costly miss</TableHead><TableHead>Severity</TableHead><TableHead>Estimated damage</TableHead><TableHead>Damage / shot</TableHead><TableHead>Why it matters</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {analysis.priorities.map((club) => (
                <TableRow key={club.clubId}>
                  <TableCell className="font-semibold">{club.clubName}</TableCell>
                  <TableCell>{club.badMissPct}%</TableCell>
                  <TableCell className="capitalize">{club.severity || 'Low'}</TableCell>
                  <TableCell>{club.damage}</TableCell>
                  <TableCell>{club.damagePerShot}</TableCell>
                  <TableCell className="min-w-[220px]">{club.evidence}</TableCell>
                  <TableCell className="min-w-[240px]">{club.recommendation}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
