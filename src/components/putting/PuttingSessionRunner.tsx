import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Minus, Plus, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { PuttingDrill, DrillResult } from '@/types/putting';
import { computeDrillResult, summarizeSession, validateDrillCounts } from '@/lib/putting/scoring';
import { INDOOR_PRACTICE_SETS, IndoorPracticeSetId } from '@/lib/putting/drills';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { clearPuttingSessionDraft, loadPuttingSessionDraft, savePuttingSessionDraft } from '@/lib/putting/sessionDraft';

interface SessionMeta {
  date: string;
  location: string;
  carpetSpeed: string;
  targetType: string;
  sessionLength: string;
  notes: string;
}

interface Props {
  drills: PuttingDrill[];
  category: 'indoor' | 'outdoor';
  initialPracticeSetId?: IndoorPracticeSetId;
  onComplete: (sessionId: string) => void;
  onCancel: () => void;
}

export function PuttingSessionRunner({ drills, category, initialPracticeSetId = 'set-a', onComplete, onCancel }: Props) {
  const { user } = useAuth();
  const matchingDraft = useMemo(() => {
    const draft = loadPuttingSessionDraft();
    if (!draft || draft.category !== category || draft.practiceSetId !== initialPracticeSetId) return null;
    return draft;
  }, [category, initialPracticeSetId]);
  // step: -1 = setup screen, 0..n-1 = drill, n = result/save
  const [step, setStep] = useState(matchingDraft?.step ?? -1);
  const [meta, setMeta] = useState<SessionMeta>({
    date: matchingDraft?.meta.date ?? format(new Date(), 'yyyy-MM-dd'),
    location: matchingDraft?.meta.location ?? '',
    carpetSpeed: matchingDraft?.meta.carpetSpeed ?? 'Medium',
    targetType: matchingDraft?.meta.targetType ?? 'Cup',
    sessionLength: matchingDraft?.meta.sessionLength ?? '25 min',
    notes: matchingDraft?.meta.notes ?? '',
  });
  const [allCounts, setAllCounts] = useState<Record<string, Record<string, number>>>(matchingDraft?.allCounts ?? {});
  const [practiceSetId, setPracticeSetId] = useState<IndoorPracticeSetId>(matchingDraft?.practiceSetId ?? initialPracticeSetId);
  const [saving, setSaving] = useState(false);

  const sortedDrills = useMemo(() => [...drills].sort((a, b) => a.sort_order - b.sort_order), [drills]);
  const selectedSet = useMemo(
    () => INDOOR_PRACTICE_SETS.find(set => set.id === practiceSetId) ?? INDOOR_PRACTICE_SETS[0],
    [practiceSetId],
  );
  const activeDrills = useMemo(() => {
    if (category !== 'indoor') return sortedDrills;
    const drillNames = new Set(selectedSet.drillNames);
    const usedNames = new Set<string>();
    return sortedDrills.filter(drill => {
      if (!drillNames.has(drill.name) || usedNames.has(drill.name)) return false;
      usedNames.add(drill.name);
      return true;
    });
  }, [category, selectedSet, sortedDrills]);

  const currentDrill = step >= 0 && step < activeDrills.length ? activeDrills[step] : null;
  const currentCounts = currentDrill ? allCounts[currentDrill.id] ?? {} : {};

  const setCount = (inputId: string, val: number) => {
    if (!currentDrill) return;
    const next = Math.max(0, val);
    const otherTotal = currentDrill.scoring_inputs.reduce(
      (s, i) => s + (i.id === inputId ? 0 : currentCounts[i.id] ?? 0),
      0,
    );
    const remaining = Math.max(0, currentDrill.reps - otherTotal);
    const capped = Math.min(next, remaining);
    setAllCounts({
      ...allCounts,
      [currentDrill.id]: { ...currentCounts, [inputId]: capped },
    });
  };

  const repsUsed = currentDrill
    ? currentDrill.scoring_inputs.reduce((s, i) => s + (currentCounts[i.id] ?? 0), 0)
    : 0;
  const liveScore = currentDrill ? computeDrillResult(currentDrill, currentCounts) : null;

  useEffect(() => {
    if (step < 0) return;
    savePuttingSessionDraft({
      category,
      practiceSetId,
      step,
      meta,
      allCounts,
    });
  }, [allCounts, category, meta, practiceSetId, step]);

  const handleNext = () => {
    if (!currentDrill) return;
    const err = validateDrillCounts(currentDrill, currentCounts);
    if (err) {
      toast.error(err);
      return;
    }
    setStep(step + 1);
  };

  const results: DrillResult[] = useMemo(() => {
    return activeDrills
      .filter(d => allCounts[d.id])
      .map(d => computeDrillResult(d, allCounts[d.id]));
  }, [activeDrills, allCounts]);

  const summary = useMemo(() => summarizeSession(results, activeDrills), [results, activeDrills]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('putting_sessions')
      .insert({
        user_id: user.id,
        category,
        session_date: meta.date,
        location: meta.location.slice(0, 100) || null,
        carpet_speed: meta.carpetSpeed,
        target_type: meta.targetType,
        session_length: meta.sessionLength,
        notes_before: meta.notes.slice(0, 1000) || null,
        total_score: summary.total,
        max_total: summary.maxTotal,
        level: summary.level,
        best_drill: summary.best?.drill_name ?? null,
        weakest_drill: summary.weakest?.drill_name ?? null,
        main_miss: summary.mainMiss,
        recommendation: summary.recommendation,
        drill_results: JSON.parse(JSON.stringify(results)),
      })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error('Failed to save session');
      return;
    }
    toast.success('Session saved');
    clearPuttingSessionDraft();
    onComplete(data.id);
  };

  // SETUP SCREEN
  if (step === -1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Start Putting Session</CardTitle>
          <CardDescription>Indoor Carpet Putting — Start Line & Short Putt Control</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {category === 'indoor' && (
              <div className="grid gap-2 md:col-span-2">
                <Label>Practice set</Label>
                <Select
                  value={practiceSetId}
                  onValueChange={v => {
                    setPracticeSetId(v as typeof practiceSetId);
                    setAllCounts({});
                    setStep(-1);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDOOR_PRACTICE_SETS.map(set => (
                      <SelectItem key={set.id} value={set.id}>{set.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{selectedSet.description}</p>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" value={meta.date} onChange={e => setMeta({ ...meta, date: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input value={meta.location} onChange={e => setMeta({ ...meta, location: e.target.value })} maxLength={100} placeholder="Living room" />
            </div>
            <div className="grid gap-2">
              <Label>Carpet speed feel</Label>
              <Select value={meta.carpetSpeed} onValueChange={v => setMeta({ ...meta, carpetSpeed: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Slow">Slow</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Fast">Fast</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Target type</Label>
              <Select value={meta.targetType} onValueChange={v => setMeta({ ...meta, targetType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mug">Mug</SelectItem>
                  <SelectItem value="Cup">Cup</SelectItem>
                  <SelectItem value="Coaster">Coaster</SelectItem>
                  <SelectItem value="Tape line">Tape line</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Session length</Label>
              <Select value={meta.sessionLength} onValueChange={v => setMeta({ ...meta, sessionLength: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25 min">25 min</SelectItem>
                  <SelectItem value="35 min">35 min</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Notes before session</Label>
            <Textarea value={meta.notes} onChange={e => setMeta({ ...meta, notes: e.target.value })} maxLength={1000} rows={2} />
          </div>
          <div className="flex gap-2 pt-2 sm:justify-between">
            <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => {
              clearPuttingSessionDraft();
              onCancel();
            }}>Cancel</Button>
            <Button className="flex-1 sm:flex-none" onClick={() => setStep(0)} disabled={activeDrills.length === 0}>
              Start <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // RESULT SCREEN
  if (!currentDrill) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Result</CardTitle>
          <CardDescription>{format(new Date(meta.date), 'PPP')} · {meta.carpetSpeed} carpet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-6">
          <div className="rounded-lg border-2 border-primary bg-primary/5 p-5 text-center sm:p-6">
            <div className="text-4xl font-bold sm:text-5xl">{summary.total}<span className="text-xl text-muted-foreground sm:text-2xl"> / {summary.maxTotal}</span></div>
            <Badge variant="secondary" className="mt-2 text-base">{summary.level}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Best drill</div>
              <div className="font-semibold">{summary.best?.drill_name ?? '—'}</div>
              <div className="text-sm text-muted-foreground">{summary.best ? `${Math.round(summary.best.percent)}%` : ''}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Weakest drill</div>
              <div className="font-semibold">{summary.weakest?.drill_name ?? '—'}</div>
              <div className="text-sm text-muted-foreground">{summary.weakest ? `${Math.round(summary.weakest.percent)}%` : ''}</div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-xs uppercase text-muted-foreground">Main miss</div>
            <div className="font-medium">{summary.mainMiss}</div>
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs uppercase text-muted-foreground mb-1">Next session focus</div>
            <p className="text-sm">{summary.recommendation}</p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold">Drill breakdown</h4>
            {results.map(r => (
              <div key={r.drill_id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium text-sm">{r.drill_name}</div>
                  <div className="text-xs text-muted-foreground">{r.level}</div>
                </div>
                <div className="text-right font-mono">{r.final_score} / {r.max_score}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 sm:justify-between">
            <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => setStep(activeDrills.length - 1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button className="flex-1 sm:flex-none" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (<><Check className="mr-1 h-4 w-4" /> Save Session</>)}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // DRILL SCREEN
  const progress = ((step + 1) / (activeDrills.length + 1)) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline">Drill {step + 1} of {activeDrills.length}</Badge>
          <span className="text-sm text-muted-foreground">
            {currentDrill.scoring_mode === 'pressure_ladder' ? 'Level / 5' : `${repsUsed} / ${currentDrill.reps} reps`}
          </span>
        </div>
        <Progress value={progress} className="h-1 mb-2" />
        <CardTitle>{currentDrill.name}</CardTitle>
        {currentDrill.purpose && <CardDescription>{currentDrill.purpose}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {currentDrill.setup && (
          <div className="rounded-md bg-muted p-3 text-sm">
            <strong>Setup:</strong> {currentDrill.setup}
          </div>
        )}
        {currentDrill.recommendation && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <strong>Cue:</strong> {currentDrill.recommendation}
          </div>
        )}

        <div className="space-y-3">
          {currentDrill.scoring_inputs.map(input => {
            const count = currentCounts[input.id] ?? 0;
            const isPressure = currentDrill.scoring_mode === 'pressure_ladder';
            return (
              <div key={input.id} className="rounded-lg border p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium">{input.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {isPressure ? `Level ${input.points}` : `${input.points} pt${input.points === 1 ? '' : 's'} each`}
                    </div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums sm:text-3xl">{count}</div>
                </div>
                <div className="flex gap-2">
                  {isPressure ? (
                    <Button
                      size="lg"
                      variant={count ? 'default' : 'outline'}
                      className="h-12 w-full"
                      onClick={() => {
                        const reset = Object.fromEntries(currentDrill.scoring_inputs.map(option => [option.id, 0]));
                        setAllCounts({
                          ...allCounts,
                          [currentDrill.id]: {
                            ...reset,
                            putts_used: currentCounts.putts_used ?? 20,
                            [input.id]: 1,
                          },
                        });
                      }}
                    >
                      Select
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" size="lg" className="h-12 flex-1" onClick={() => setCount(input.id, count - 1)}>
                        <Minus className="h-5 w-5" />
                      </Button>
                      <Button size="lg" className="h-12 flex-[2]" disabled={repsUsed >= currentDrill.reps} onClick={() => setCount(input.id, count + 1)}>
                        <Plus className="h-5 w-5 mr-1" /> Tap
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {currentDrill.scoring_mode === 'pressure_ladder' && (
          <div className="grid gap-2 rounded-lg border p-4">
            <Label>Putts used</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={currentCounts.putts_used ?? 20}
              onChange={e => setAllCounts({
                ...allCounts,
                [currentDrill.id]: { ...currentCounts, putts_used: Number(e.target.value) },
              })}
            />
            <p className="text-xs text-muted-foreground">Play until you complete the ladder or reach 20 putts.</p>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <span className="text-sm">Live score</span>
          <span className="font-mono text-lg font-bold">
            {liveScore?.final_score ?? 0} / {liveScore?.max_score ?? currentDrill.max_score}
          </span>
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t bg-card/95 px-4 pt-3 backdrop-blur sm:static sm:mx-0 sm:justify-between sm:border-0 sm:bg-transparent sm:px-0 sm:pt-2">
          <Button className="flex-1 sm:flex-none" variant="outline" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={handleNext}>
            {step === activeDrills.length - 1 ? 'See Result' : 'Next Drill'} <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
