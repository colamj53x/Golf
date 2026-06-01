import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Brain, Clock3, Gauge, Image, ListChecks, Play, Sparkles, Target, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DrillResult, PuttingMetric, PuttingSessionRecord } from '@/types/putting';
import { PUTTING_METRIC_LABELS, PUTTING_PRACTICE_SETS, PuttingPracticeSetId } from '@/lib/putting/drills';
import { loadPuttingSessionDraft } from '@/lib/putting/sessionDraft';
import { PuttingDashboard } from './PuttingDashboard';
import { PuttingDrillBankTab } from './PuttingDrillBankTab';
import { PuttingHistory } from './PuttingHistory';

interface Props {
  section: PuttingSection;
  onStartIndoorSet: (setId: PuttingPracticeSetId) => void;
}

export type PuttingSection = 'overview' | 'sets' | 'warmup' | 'drills' | 'blast' | 'history';

const score = (session: PuttingSessionRecord) => session.max_total ? Math.round((session.total_score / session.max_total) * 100) : 0;
const sessionMeta = (session: PuttingSessionRecord) => session.drill_results.find((result) => result.session_meta)?.session_meta;

function metricPercent(results: DrillResult[], metric: PuttingMetric): number | null {
  const relevant = results.flatMap((result) => result.metric_scores?.filter((entry) => entry.metric === metric).map((entry) => entry.percent) || []);
  return relevant.length ? Math.round(relevant.reduce((sum, value) => sum + value, 0) / relevant.length) : null;
}

function SetGrid({ sets, onStart }: { sets: typeof PUTTING_PRACTICE_SETS; onStart: (id: string) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sets.map((set) => (
        <Card key={set.id} className="transition hover:border-primary/60 hover:shadow-sm">
          <CardContent className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline" className="capitalize">{set.category}</Badge>
                <h3 className="mt-2 font-bold">{set.name.replace(/^Set [A-D] - /, '')}</h3>
              </div>
              <Clock3 className="h-5 w-5 text-primary" />
            </div>
            <p className="flex-1 text-sm text-muted-foreground">{set.description}</p>
            <div className="text-xs text-muted-foreground">{set.timeMinutes} min · {set.bestFor}</div>
            <Button className="gap-2" onClick={() => onStart(set.id)}><Play className="h-4 w-4" /> Start set</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PuttingHome({ section, onStartIndoorSet }: Props) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('putting_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .limit(1000);
    if (error) {
      toast.error('Failed to load putting sessions');
    } else {
      setSessions((data || []).map((session) => ({
        ...session,
        category: session.category as 'indoor' | 'outdoor',
        drill_results: session.drill_results as unknown as DrillResult[],
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const overview = useMemo(() => {
    const recent = sessions.slice(0, 5);
    const form = recent.length ? Math.round(recent.reduce((sum, session) => sum + score(session), 0) / recent.length) : null;
    const metrics = (Object.keys(PUTTING_METRIC_LABELS) as PuttingMetric[]).map((metric) => {
      const values = recent.map((session) => metricPercent(session.drill_results, metric)).filter((value): value is number => value !== null);
      return { metric, label: PUTTING_METRIC_LABELS[metric], value: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null };
    });
    const weakest = [...metrics].filter((metric) => metric.value !== null).sort((a, b) => (a.value || 0) - (b.value || 0))[0];
    const blastResults = sessions.flatMap((session) => session.drill_results).filter((result) => result.blast?.tempo_ratio);
    const tempo = blastResults.length ? Math.round((blastResults.reduce((sum, result) => sum + (result.blast?.tempo_ratio || 0), 0) / blastResults.length) * 10) / 10 : null;
    const screenshots = sessions.flatMap((session) => session.drill_results).filter((result) => result.blast?.screenshot_data_url);
    const outdoorRecent = sessions.slice(0, 6).some((session) => sessionMeta(session)?.session_type === 'outdoor');
    const nextSet = !outdoorRecent ? PUTTING_PRACTICE_SETS.find((set) => set.id === 'outdoor-speed') : weakest?.metric === 'paceTouch' ? PUTTING_PRACTICE_SETS.find((set) => set.id === 'outdoor-speed') : weakest?.metric === 'conversionPressure' ? PUTTING_PRACTICE_SETS.find((set) => set.id === 'outdoor-conversion') : PUTTING_PRACTICE_SETS.find((set) => set.id === 'set-a');
    return { form, metrics, weakest, tempo, screenshots, nextSet };
  }, [sessions]);

  if (section === 'drills') return <PuttingDrillBankTab />;
  if (section === 'history') return <PuttingHistory sessions={sessions} onChanged={loadSessions} />;
  if (section === 'sets') return <SetGrid sets={PUTTING_PRACTICE_SETS.filter((set) => set.category !== 'warmup')} onStart={onStartIndoorSet} />;
  if (section === 'warmup') return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Pre-Round Warm-Up</CardTitle><CardDescription>No score chasing. Calibrate the green, find your start line, finish with confidence, then go play.</CardDescription></CardHeader>
      </Card>
      <SetGrid sets={PUTTING_PRACTICE_SETS.filter((set) => set.category === 'warmup')} onStart={onStartIndoorSet} />
    </div>
  );
  if (section === 'blast') return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><Sparkles className="h-5 w-5 text-sky-700" /><div className="mt-3 text-xs uppercase text-muted-foreground">Tempo average</div><div className="text-3xl font-bold">{overview.tempo ? `${overview.tempo}:1` : '-'}</div><p className="mt-1 text-xs text-muted-foreground">Track stable rhythm around a natural 2:1 pattern.</p></CardContent></Card>
        <Card><CardContent className="p-4"><Image className="h-5 w-5 text-sky-700" /><div className="mt-3 text-xs uppercase text-muted-foreground">Screenshots saved</div><div className="text-3xl font-bold">{overview.screenshots.length}</div><p className="mt-1 text-xs text-muted-foreground">Blast evidence attached to individual drill sets.</p></CardContent></Card>
        <Card><CardContent className="p-4"><Target className="h-5 w-5 text-sky-700" /><div className="mt-3 text-xs uppercase text-muted-foreground">Recommended lab</div><div className="text-lg font-bold">Blast Motion Stroke Lab</div><Button className="mt-3" size="sm" onClick={() => onStartIndoorSet('set-d')}>Start lab</Button></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Blast Motion Set Evidence</CardTitle><CardDescription>Manual metrics and screenshot uploads are saved by drill set. More correlation insights appear as the sample grows.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {overview.screenshots.length === 0 && <p className="text-sm text-muted-foreground">No screenshots uploaded yet. Start a Blast-compatible set and attach each Blast Motion screenshot as you work through it.</p>}
          {overview.screenshots.map((result, index) => (
            <div key={`${result.drill_id}-${index}`} className="rounded-lg border p-3">
              <img src={result.blast?.screenshot_data_url} alt={`${result.drill_name} Blast Motion`} className="aspect-video w-full rounded-md object-cover" />
              <div className="mt-2 font-semibold">{result.drill_name}</div>
              <div className="text-xs text-muted-foreground">Tempo {result.blast?.tempo_ratio || '-'}:1 · Consistency {result.blast?.tempo_consistency || '-'}%</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const draft = loadPuttingSessionDraft();
  return (
    <div className="space-y-5">
      {draft && (
        <Card className="border-primary/30 bg-primary/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4"><div><Badge variant="secondary">In progress</Badge><div className="mt-2 font-semibold">Your unfinished putting set is autosaved.</div></div><Button onClick={() => onStartIndoorSet(draft.practiceSetId)}>Continue set</Button></CardContent></Card>
      )}
      <Card className="border-0 bg-gradient-to-br from-sky-950 via-emerald-900 to-slate-900 text-white">
        <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-center">
          <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-200"><Brain className="h-4 w-4" /> Putting diagnosis</div><p className="mt-3 max-w-3xl text-lg font-medium">Your putting coach now combines scored sets, drill weaknesses, outdoor mix, cues, reflections, and Blast Motion evidence. {overview.weakest ? `${overview.weakest.label} is the current practice priority.` : 'Complete a scored set to establish your first priority.'}</p></div>
          <div className="rounded-xl border border-white/15 bg-white/10 p-4 text-center"><div className="text-xs uppercase tracking-wide text-sky-200">Putting form</div><div className="text-5xl font-black">{overview.form ?? '-'}</div><div className="text-sm text-sky-100">{overview.form === null ? 'No scored sets yet' : '%'}</div></div>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map(({ metric, label, value }) => <Card key={metric}><CardContent className="p-4"><Gauge className="h-4 w-4 text-primary" /><div className="mt-3 text-xs uppercase text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value ?? '-'}{value !== null ? '%' : ''}</div><Progress value={value || 0} className="mt-3 h-1.5" /></CardContent></Card>)}
        <Card><CardContent className="p-4"><Sparkles className="h-4 w-4 text-primary" /><div className="mt-3 text-xs uppercase text-muted-foreground">Blast tempo</div><div className="text-2xl font-bold">{overview.tempo ? `${overview.tempo}:1` : '-'}</div><div className="mt-3 text-xs text-muted-foreground">{overview.screenshots.length} screenshots saved</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-600" /> Recommended next session</CardTitle><CardDescription>Based only on the scored evidence currently captured.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4"><div><div className="font-bold">{overview.nextSet?.name}</div><p className="mt-1 text-sm text-muted-foreground">{overview.nextSet?.description}</p></div>{overview.nextSet && <Button className="gap-2" onClick={() => onStartIndoorSet(overview.nextSet!.id)}><Play className="h-4 w-4" /> Start session</Button>}</CardContent>
      </Card>
      <PuttingDashboard sessions={sessions} loading={loading} />
    </div>
  );
}
