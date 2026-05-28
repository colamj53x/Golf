import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Eye, Flag, Footprints, ListChecks, Play, ScanLine, TreePine } from 'lucide-react';
import { toast } from 'sonner';
import { PuttingTracking } from './PuttingTracking';
import { INDOOR_PRACTICE_SETS, IndoorPracticeSetId } from '@/lib/putting/drills';
import { loadPuttingSessionDraft, PuttingSessionDraft } from '@/lib/putting/sessionDraft';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DrillResult, PuttingSessionRecord } from '@/types/putting';

interface Props {
  section: PuttingSection;
  onStartIndoorSet: (setId: IndoorPracticeSetId) => void;
}

export type PuttingSection = 'dashboard' | 'drills';

const readSteps = [
  {
    title: 'Read from behind',
    detail: 'See the whole putt. Call the slope and break.',
    icon: Eye,
  },
  {
    title: 'Check the low side',
    detail: 'Feel the slope and choose small, medium, or big break.',
    icon: Footprints,
  },
  {
    title: 'Read the finish',
    detail: 'Look at the last 1-2m and pick the entry point.',
    icon: Flag,
  },
  {
    title: 'Build the line',
    detail: 'Choose speed, trace the curve back, pick the start spot.',
    icon: ScanLine,
  },
];

const techniqueSteps = [
  {
    title: 'Face first',
    detail: 'Aim the putter face at your start spot.',
    icon: ScanLine,
  },
  {
    title: 'Set around the face',
    detail: 'Ball forward, eyes over or inside, weight slightly lead side.',
    icon: Footprints,
  },
  {
    title: 'Feel the distance',
    detail: 'Look at the hole and make 1-2 matching practice strokes.',
    icon: Eye,
  },
  {
    title: 'Roll it',
    detail: 'Look at a dimple and brush slightly up through the ball.',
    icon: CheckCircle2,
  },
  {
    title: 'Hold the finish',
    detail: 'Finish near the front foot with the face down the line.',
    icon: Flag,
  },
];

export function PuttingHome({ section, onStartIndoorSet }: Props) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [draft, setDraft] = useState<PuttingSessionDraft | null>(() => loadPuttingSessionDraft());

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      return;
    }

    const { data, error } = await supabase
      .from('putting_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', 'indoor')
      .order('session_date', { ascending: false })
      .limit(1000);

    if (error) {
      toast.error('Failed to load putting stats');
      return;
    }

    setSessions((data ?? []).map(session => ({
      ...session,
      category: session.category as 'indoor' | 'outdoor',
      drill_results: session.drill_results as unknown as DrillResult[],
    })));
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const refreshDraft = () => setDraft(loadPuttingSessionDraft());
    refreshDraft();
    window.addEventListener('focus', refreshDraft);
    return () => window.removeEventListener('focus', refreshDraft);
  }, []);

  const drillStats = useMemo(() => {
    const stats = new Map<string, { count: number; lastDone: string | null }>();
    for (const session of sessions) {
      for (const result of session.drill_results) {
        const existing = stats.get(result.drill_name) ?? { count: 0, lastDone: null };
        existing.count += 1;
        if (!existing.lastDone || session.session_date > existing.lastDone) {
          existing.lastDone = session.session_date;
        }
        stats.set(result.drill_name, existing);
      }
    }
    return stats;
  }, [sessions]);

  const setStats = useMemo(() => {
    return new Map(INDOOR_PRACTICE_SETS.map(set => {
      let count = 0;
      let lastDone: string | null = null;
      for (const session of sessions) {
        const resultNames = new Set(session.drill_results.map(result => result.drill_name));
        if (!set.drillNames.every(drillName => resultNames.has(drillName))) continue;
        count += 1;
        if (!lastDone || session.session_date > lastDone) lastDone = session.session_date;
      }
      return [set.id, { count, lastDone }] as const;
    }));
  }, [sessions]);

  const formatLastDone = (date: string | null) => date ? format(new Date(date), 'd MMM yy') : 'Never';
  const draftSet = draft ? INDOOR_PRACTICE_SETS.find(set => set.id === draft.practiceSetId) : null;
  const draftStepLabel = draft && draftSet
    ? draft.step >= draftSet.drillNames.length
      ? 'Ready to review and save'
      : `Drill ${draft.step + 1} of ${draftSet.drillNames.length}`
    : null;

  return (
    <div>
      {section === 'dashboard' ? (
        <PuttingTracking />
      ) : (
        <div className="space-y-4">
          {draft && draftSet && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Badge variant="secondary">In Progress</Badge>
                  <h3 className="mt-2 text-lg font-bold">{draftSet.name.replace(/^Set [ABC] - /, '')}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{draftStepLabel}</p>
                </div>
                <Button className="h-11 w-full sm:w-auto" onClick={() => onStartIndoorSet(draft.practiceSetId)}>
                  Continue Set
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Read</Badge>
                <h3 className="mt-2 text-lg font-bold sm:text-xl">Pre-Shot Routine</h3>
              </div>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Eye className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {readSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3 rounded-md border bg-muted/20 p-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-md border bg-background p-3 text-sm">
              <p className="font-semibold">Start spot guide</p>
              <p className="mt-1 text-muted-foreground">Short 10-20cm · Medium 20-50cm · Long 50cm-1m</p>
            </div>
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              Start it there. Roll it at that speed.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge variant="outline">Technique</Badge>
                <h3 className="mt-2 text-lg font-bold sm:text-xl">Setup & Stroke</h3>
              </div>
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {techniqueSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className={`flex gap-3 rounded-md border bg-muted/20 p-3 ${
                      index === techniqueSteps.length - 1 ? 'md:col-span-2' : ''
                    }`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-semibold">{index + 1}. {step.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
              Face first. Feel it. Roll it. Finish.
            </p>
          </CardContent>
        </Card>
          </div>

      <div className="space-y-3">
        <div>
          <div>
            <h3 className="text-lg font-semibold">Choose a Putting Set</h3>
            <p className="text-sm text-muted-foreground">Pick the session shape before you start scoring.</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {INDOOR_PRACTICE_SETS.map(set => {
            const stats = setStats.get(set.id);
            return (
            <Card
              key={set.id}
              className="cursor-pointer transition hover:border-primary hover:shadow-md"
              onClick={() => onStartIndoorSet(set.id)}
            >
              <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={set.id === 'full' ? 'secondary' : 'outline'}>
                      {set.id === 'full' ? 'Test' : set.id.replace('set-', 'Set ').toUpperCase()}
                    </Badge>
                    <h4 className="mt-3 text-lg font-bold leading-tight">{set.name.replace(/^Set [ABC] - /, '')}</h4>
                  </div>
                  <div className="rounded-md bg-primary/10 p-2 text-primary">
                    <ListChecks className="h-5 w-5" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{set.description}</p>
                <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/20 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Done</p>
                    <p className="font-semibold">{stats?.count ?? 0} time{(stats?.count ?? 0) === 1 ? '' : 's'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last</p>
                    <p className="font-semibold">{formatLastDone(stats?.lastDone ?? null)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {set.drillNames.map((drillName, index) => {
                    const drill = drillStats.get(drillName);
                    return (
                    <div key={drillName} className="flex items-start gap-2 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <span>{drillName}</span>
                        <div className="text-xs text-muted-foreground">
                          Done {drill?.count ?? 0} · Last {formatLastDone(drill?.lastDone ?? null)}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
                <Button className="mt-auto h-11 w-full" onClick={(event) => {
                  event.stopPropagation();
                  onStartIndoorSet(set.id);
                }}>
                <Play className="mr-2 h-4 w-4" />
                  Start Set
              </Button>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <TreePine className="h-12 w-12 text-primary/60" />
            <div>
              <h3 className="text-xl font-bold">Outdoor Putting</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Next section for green-read, pace, and conversion drills outside.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      )}
    </div>
  );
}
