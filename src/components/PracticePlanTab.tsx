import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Target, Dumbbell, Gauge, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { PRACTICE_CLUBS, getConfigDisplayName, getPracticeConfigKey } from '@/types/practiceClubs';
import { getEnabledShotTypesForClub, getEnabledPowersForClub } from '@/lib/practiceEnabledCombos';
import { getDrillsForConfig, ScorableDrill, BaselineDrill, SESSION_BALL_SPLIT } from '@/lib/practiceDrillsLibrary';

interface DrillScoreRow {
  id: string;
  drill_id: string;
  drill_kind: 'scorable' | 'baseline';
  config_key: string;
  score: number;
  max_score: number;
  balls: number | null;
  score_date: string;
  notes: string | null;
}

export function PracticePlanTab() {
  const { user } = useAuth();
  const {
    selectedClub, setSelectedClub,
    selectedShotType, setSelectedShotType,
    selectedPower, setSelectedPower,
    currentConfigKey,
    getLatestSessionForClub,
  } = usePracticeData();

  const drills = getDrillsForConfig(currentConfigKey);
  const displayName = useMemo(() => {
    try { return getConfigDisplayName(currentConfigKey); } catch { return currentConfigKey; }
  }, [currentConfigKey]);

  // Rank weak areas from the latest session and pick the top 2 technique drills that address them.
  const { weakTags, recommendedTechniques, recommendedScorable } = useMemo(() => {
    const empty = { weakTags: [] as string[], recommendedTechniques: [] as Array<{ drill: typeof drills extends null ? never : NonNullable<typeof drills>['technique'][number]; basedOn: string }>, recommendedScorable: [] as string[] };
    if (!drills) return empty;
    const latest = getLatestSessionForClub(currentConfigKey);
    if (!latest || !Array.isArray(latest.metrics) || latest.metrics.length === 0) return empty;

    // Collect weak metrics (outside target window), sorted by relative deviation.
    const weak: Array<{ tag: string; delta: number }> = [];
    for (const m of latest.metrics as Array<{ id?: string; name?: string; value?: number; targetMin?: number; targetMax?: number }>) {
      if (typeof m.value !== 'number' || typeof m.targetMin !== 'number' || typeof m.targetMax !== 'number') continue;
      const below = m.targetMin - m.value;
      const above = m.value - m.targetMax;
      const delta = Math.max(below, above, 0);
      if (delta <= 0) continue;
      const span = Math.max(Math.abs(m.targetMax - m.targetMin), 1);
      weak.push({ tag: (m.id || m.name || '').toLowerCase(), delta: delta / span });
    }
    weak.sort((a, b) => b.delta - a.delta);
    const weakTags = weak.map(w => w.tag);
    if (weakTags.length === 0) return empty;

    const matches = (fixes: string[] | undefined, tag: string) =>
      (fixes ?? []).some(f => tag.includes(f) || f.includes(tag.split(/[_\s]/)[0]));

    // Pick up to 2 distinct technique drills covering the top weaknesses.
    const recTech: Array<{ drill: NonNullable<typeof drills>['technique'][number]; basedOn: string }> = [];
    const usedIds = new Set<string>();
    for (const tag of weakTags) {
      if (recTech.length >= 2) break;
      const match = drills.technique.find(d => !usedIds.has(d.id) && matches(d.fixes, tag));
      if (match) { recTech.push({ drill: match, basedOn: tag }); usedIds.add(match.id); }
    }
    // If we still have fewer than 2, fall back to the first remaining techniques.
    for (const d of drills.technique) {
      if (recTech.length >= 2) break;
      if (!usedIds.has(d.id)) { recTech.push({ drill: d, basedOn: weakTags[0] }); usedIds.add(d.id); }
    }

    // Scorable drill ids that map to a weak tag.
    const recScorable = drills.scorable
      .filter(d => weakTags.some(t => matches(d.fixes, t)))
      .map(d => d.id);

    return { weakTags, recommendedTechniques: recTech, recommendedScorable: recScorable };
  }, [drills, currentConfigKey, getLatestSessionForClub]);


  // Drill scores for this config
  const [scores, setScores] = useState<DrillScoreRow[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);

  useEffect(() => {
    if (!user) { setScores([]); return; }
    let cancelled = false;
    setLoadingScores(true);
    supabase
      .from('practice_drill_scores')
      .select('*')
      .eq('user_id', user.id)
      .eq('config_key', currentConfigKey)
      .order('score_date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error('Failed to load drill scores');
          setScores([]);
        } else {
          setScores((data ?? []) as DrillScoreRow[]);
        }
        setLoadingScores(false);
      });
    return () => { cancelled = true; };
  }, [user, currentConfigKey]);

  const addScore = async (
    drill_id: string,
    drill_kind: 'scorable' | 'baseline',
    score: number,
    max_score: number,
    balls: number | null,
    score_date: string,
    notes: string | null,
  ) => {
    if (!user) { toast.error('Sign in to save scores'); return; }
    const { data, error } = await supabase
      .from('practice_drill_scores')
      .insert({
        user_id: user.id,
        drill_id,
        drill_kind,
        config_key: currentConfigKey,
        score,
        max_score,
        balls,
        score_date,
        notes,
      })
      .select()
      .single();
    if (error) { toast.error('Failed to save score'); return; }
    setScores(prev => [data as DrillScoreRow, ...prev]);
    toast.success('Score saved');
  };

  const deleteScore = async (id: string) => {
    const { error } = await supabase.from('practice_drill_scores').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    setScores(prev => prev.filter(s => s.id !== id));
  };

  // Aggregate stats per drill
  const statsFor = (drillId: string) => {
    const rows = scores.filter(s => s.drill_id === drillId);
    if (rows.length === 0) return null;
    const pcts = rows.map(r => (r.max_score ? (r.score / r.max_score) * 100 : 0));
    const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
    const best = Math.max(...pcts);
    const last = rows[0]; // already sorted desc by date
    return { count: rows.length, avgPct: Math.round(avg), bestPct: Math.round(best), last };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Practice Plan</CardTitle>
          <CardDescription>
            Choose a club / shot, then pick a track: technique fixes, scorable games, or 5-ball baseline mapping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Club</label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRACTICE_CLUBS.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Shot Type</label>
              <Select value={selectedShotType} onValueChange={setSelectedShotType}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getEnabledShotTypesForClub(selectedClub).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Power</label>
              <Select value={selectedPower} onValueChange={setSelectedPower}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {getEnabledPowersForClub(selectedClub).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {!drills ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No drill plan built yet for <span className="font-medium text-foreground">{displayName}</span>.
            Driver is live first — tell me which club/shot to build next.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Session split banner */}
          <Card className="bg-muted/30">
            <CardContent className="py-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">Session split:</span>
              <Badge variant="outline" className="gap-1"><Dumbbell className="h-3 w-3" /> {SESSION_BALL_SPLIT.technique} technique</Badge>
              <Badge variant="outline" className="gap-1"><Target className="h-3 w-3" /> {SESSION_BALL_SPLIT.scorable} scorable</Badge>
              <Badge variant="outline" className="gap-1"><Gauge className="h-3 w-3" /> {SESSION_BALL_SPLIT.baseline} baseline</Badge>
              <span className="text-muted-foreground ml-auto">
                = {SESSION_BALL_SPLIT.technique + SESSION_BALL_SPLIT.scorable + SESSION_BALL_SPLIT.baseline} balls total
              </span>
            </CardContent>
          </Card>

          {recommendedTechniques.length > 0 && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="py-3 text-sm">
                <div className="font-medium text-amber-700 dark:text-amber-400">
                  Recommended technique focus ({recommendedTechniques.length})
                </div>
                <div className="text-muted-foreground mt-0.5">
                  Based on your last {displayName} session — weakest areas:{' '}
                  <span className="font-medium text-foreground">{weakTags.slice(0, 3).join(', ')}</span>.
                  Spend the technique block on the drills below.
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="technique" className="w-full">
            <TabsList>
              <TabsTrigger value="technique" className="gap-2"><Dumbbell className="h-4 w-4" /> Technique</TabsTrigger>
              <TabsTrigger value="scorable" className="gap-2"><Target className="h-4 w-4" /> Scorable Drills</TabsTrigger>
              <TabsTrigger value="baseline" className="gap-2"><Gauge className="h-4 w-4" /> Baseline Mapping</TabsTrigger>
            </TabsList>

          {/* TECHNIQUE */}
          <TabsContent value="technique" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              {SESSION_BALL_SPLIT.technique} balls — only the 2 techniques tied to your current weak areas are shown. Pick ONE and stick with it for the block. No scoring.
            </p>
            {(recommendedTechniques.length > 0
              ? recommendedTechniques.map(r => r.drill)
              : drills.technique.slice(0, 2)
            ).map(d => {
              const rec = recommendedTechniques.find(r => r.drill.id === d.id);
              return (
                <Card key={d.id} className="border-amber-500/60 ring-1 ring-amber-500/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2">
                        {d.name}
                        <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                          {rec ? `Fixes: ${rec.basedOn}` : 'Recommended'}
                        </Badge>
                      </CardTitle>
                      <Badge variant="outline">{d.reps}</Badge>
                    </div>
                    <CardDescription>{d.focus}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div><span className="font-medium">Setup:</span> <span className="text-muted-foreground">{d.setup}</span></div>
                    <div><span className="font-medium">Cue:</span> <span className="text-muted-foreground">{d.cue}</span></div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>


          {/* SCORABLE */}
          <TabsContent value="scorable" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              Game-style. Score each round — averages and personal bests track below.
              {recommendedScorable.length > 0 && ' Drills marked Recommended target your current weak areas.'}
            </p>
            {[...drills.scorable]
              .sort((a, b) => {
                const ar = recommendedScorable.includes(a.id) ? 0 : 1;
                const br = recommendedScorable.includes(b.id) ? 0 : 1;
                return ar - br;
              })
              .map(d => (
                <ScorableDrillCard
                  key={d.id}
                  drill={d}
                  recommended={recommendedScorable.includes(d.id)}
                  history={scores.filter(s => s.drill_id === d.id)}
                  stats={statsFor(d.id)}
                  onSave={(score, dateStr, notes) =>
                    addScore(d.id, 'scorable', score, d.maxScore, d.balls, dateStr, notes)
                  }
                  onDelete={deleteScore}
                  loading={loadingScores}
                />
              ))}
          </TabsContent>

          {/* BASELINE */}
          <TabsContent value="baseline" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">
              {SESSION_BALL_SPLIT.baseline} balls. 0 or 1 per ball. Quick mapping you can repeat to see if you're moving forward.
            </p>
            {drills.baseline.map(d => (
              <BaselineDrillCard
                key={d.id}
                drill={d}
                history={scores.filter(s => s.drill_id === d.id)}
                stats={statsFor(d.id)}
                onSave={(score, dateStr, notes) =>
                  addScore(d.id, 'baseline', score, SESSION_BALL_SPLIT.baseline, SESSION_BALL_SPLIT.baseline, dateStr, notes)
                }
                onDelete={deleteScore}
                loading={loadingScores}
              />
            ))}
          </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// =====================================================
// Sub-components
// =====================================================

interface CommonCardProps {
  history: DrillScoreRow[];
  stats: { count: number; avgPct: number; bestPct: number; last: DrillScoreRow } | null;
  onSave: (score: number, dateStr: string, notes: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading: boolean;
}

function ScorableDrillCard({
  drill, recommended, history, stats, onSave, onDelete, loading,
}: CommonCardProps & { drill: ScorableDrill; recommended?: boolean }) {
  const [score, setScore] = useState('');
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const save = async () => {
    const s = parseFloat(score);
    if (Number.isNaN(s)) { toast.error('Enter a score'); return; }
    if (s < 0 || s > drill.maxScore) { toast.error(`Score must be 0–${drill.maxScore}`); return; }
    setSaving(true);
    await onSave(s, dateStr, notes.trim() || null);
    setSaving(false);
    setScore('');
    setNotes('');
  };

  return (
    <Card className={recommended ? 'border-amber-500/60 ring-1 ring-amber-500/30' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            {drill.name}
            {recommended && <Badge className="bg-amber-500 text-white hover:bg-amber-500">Recommended</Badge>}
          </CardTitle>
          <div className="flex gap-2 items-center text-xs">
            <Badge variant="outline">{drill.balls} balls</Badge>
            <Badge variant="outline">/{drill.maxScore}</Badge>
            <Badge variant="secondary">Pass: {drill.pass}</Badge>
          </div>
        </div>
        <CardDescription>{drill.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div><span className="font-medium">Scoring:</span> <span className="text-muted-foreground">{drill.scoring}</span></div>

        <StatsRow stats={stats} loading={loading} />

        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Score</label>
            <Input
              type="number" min={0} max={drill.maxScore} step="0.5"
              value={score} onChange={e => setScore(e.target.value)}
              placeholder={`0–${drill.maxScore}`}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Date</label>
            <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="conditions, swing thought…" />
          </div>
          <Button onClick={save} disabled={saving}>Save round</Button>
        </div>

        <HistoryBlock
          history={history}
          show={showHistory}
          onToggle={() => setShowHistory(s => !s)}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  );
}

function BaselineDrillCard({
  drill, history, stats, onSave, onDelete, loading,
}: CommonCardProps & { drill: BaselineDrill }) {
  const BALL_COUNT = SESSION_BALL_SPLIT.baseline;
  const makeEmpty = () => Array.from({ length: BALL_COUNT }, () => false);
  const [balls, setBalls] = useState<boolean[]>(makeEmpty);
  const [dateStr, setDateStr] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const score = balls.filter(Boolean).length;

  const save = async () => {
    setSaving(true);
    await onSave(score, dateStr, notes.trim() || null);
    setSaving(false);
    setBalls(makeEmpty());
    setNotes('');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base">{drill.name}</CardTitle>
          <Badge variant="outline">{BALL_COUNT} balls</Badge>
        </div>
        <CardDescription>{drill.what}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div><span className="font-medium">Setup:</span> <span className="text-muted-foreground">{drill.setup}</span></div>
        <div><span className="font-medium">Scoring:</span> <span className="text-muted-foreground">{drill.scoring}</span></div>

        <StatsRow stats={stats} loading={loading} />

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground mr-1">Mark each ball:</span>
            {balls.map((hit, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setBalls(prev => prev.map((b, idx) => idx === i ? !b : b))}
                className={
                  'h-9 w-9 rounded-full border-2 text-sm font-semibold transition-colors ' +
                  (hit
                    ? 'bg-green-500 border-green-600 text-white'
                    : 'bg-muted/40 border-muted-foreground/30 text-muted-foreground hover:bg-muted')
                }
                aria-label={`Ball ${i + 1} ${hit ? 'hit' : 'miss'}`}
              >
                {i + 1}
              </button>
            ))}
            <span className="ml-2 text-sm font-medium">= {score}/{BALL_COUNT}</span>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Date</label>
              <Input type="date" value={dateStr} onChange={e => setDateStr(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1 flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="wind, lie, club setup…" />
            </div>
            <Button onClick={save} disabled={saving}>Save baseline</Button>
          </div>
        </div>

        <HistoryBlock
          history={history}
          show={showHistory}
          onToggle={() => setShowHistory(s => !s)}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  );
}

function StatsRow({
  stats, loading,
}: { stats: { count: number; avgPct: number; bestPct: number; last: DrillScoreRow } | null; loading: boolean }) {
  if (loading) return <p className="text-xs text-muted-foreground">Loading history…</p>;
  if (!stats) return <p className="text-xs text-muted-foreground">No attempts yet — log your first round to start tracking.</p>;
  const fmtPct = (n: number) => `${n}%`;
  const toneFor = (pct: number) =>
    pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md bg-muted/40 p-2">
      <Stat label="Attempts" value={String(stats.count)} />
      <Stat label="Last" value={`${stats.last.score}/${stats.last.max_score}`} tone={toneFor((stats.last.score / stats.last.max_score) * 100)} />
      <Stat label="Avg" value={fmtPct(stats.avgPct)} tone={toneFor(stats.avgPct)} />
      <Stat label="Best" value={fmtPct(stats.bestPct)} tone={toneFor(stats.bestPct)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={'text-base font-semibold ' + (tone ?? 'text-foreground')}>{value}</div>
    </div>
  );
}

function HistoryBlock({
  history, show, onToggle, onDelete,
}: {
  history: DrillScoreRow[];
  show: boolean;
  onToggle: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  if (history.length === 0) return null;
  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <TrendingUp className="h-3 w-3" />
        {show ? 'Hide' : 'Show'} score history ({history.length})
      </button>
      {show && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-1 pr-2">Date</th>
                <th className="py-1 pr-2">Score</th>
                <th className="py-1 pr-2">%</th>
                <th className="py-1 pr-2">Notes</th>
                <th className="py-1 pr-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {history.map(h => {
                const pct = h.max_score ? Math.round((h.score / h.max_score) * 100) : 0;
                return (
                  <tr key={h.id} className="border-t border-border/50">
                    <td className="py-1 pr-2">{format(new Date(h.score_date), 'dd MMM yyyy')}</td>
                    <td className="py-1 pr-2 font-medium">{h.score}/{h.max_score}</td>
                    <td className="py-1 pr-2">{pct}%</td>
                    <td className="py-1 pr-2 text-muted-foreground">{h.notes ?? '—'}</td>
                    <td className="py-1 pr-2 text-right">
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => onDelete(h.id)}
                        aria-label="Delete score"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
