import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CheckCircle2, Eye, Flag, Footprints, Plus, Play, ScanLine, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { PuttingDrill, PuttingSessionRecord, DrillResult, LevelBand, ScoringInput } from '@/types/putting';
import { PuttingSessionRunner } from './PuttingSessionRunner';
import { PuttingHistory } from './PuttingHistory';
import { DrillBuilderDialog } from './DrillBuilderDialog';

interface Props {
  onBack: () => void;
}

type View = 'home' | 'run';

const readSteps = [
  {
    title: 'Read from behind',
    detail: 'See the whole putt. Call the slope and break: uphill, downhill, flat; left, right, straight.',
    icon: Eye,
  },
  {
    title: 'Check the low side',
    detail: 'Walk downhill side, feel the slope, then choose small, medium, or big break.',
    icon: Footprints,
  },
  {
    title: 'Read the finish',
    detail: 'Look at the last 1-2m near the hole and pick the entry point.',
    icon: Flag,
  },
  {
    title: 'Build the line',
    detail: 'Choose soft, normal, or firm. Trace the curve back, then pick the start spot.',
    icon: ScanLine,
  },
];

const techniqueSteps = [
  {
    title: 'Face first',
    detail: 'Aim the putter face at your start spot before anything else.',
    icon: ScanLine,
  },
  {
    title: 'Set around the face',
    detail: 'Ball slightly forward. Eyes over or just inside. Weight balanced, slightly lead side.',
    icon: Footprints,
  },
  {
    title: 'Feel the distance',
    detail: 'Look at the hole. Make 1-2 practice strokes that match the putt length.',
    icon: Eye,
  },
  {
    title: 'Roll it',
    detail: 'Pick one dimple on the back of the ball and brush slightly up through it.',
    icon: CheckCircle2,
  },
  {
    title: 'Finish to my front foot',
    detail: 'Hold a low, stable finish with the face looking down the start line.',
    icon: Flag,
  },
];

export function PuttingIndoor({ onBack }: Props) {
  const { user } = useAuth();
  const [drills, setDrills] = useState<PuttingDrill[]>([]);
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [builderOpen, setBuilderOpen] = useState(false);

  const loadDrills = useCallback(async () => {
    let query = supabase
      .from('putting_drills')
      .select('*')
      .eq('category', 'indoor');

    query = user
      ? query.or(`is_builtin.eq.true,user_id.eq.${user.id}`)
      : query.eq('is_builtin', true);

    const { data, error } = await query.order('sort_order');
    if (error) {
      toast.error('Failed to load drills');
      return;
    }
    setDrills((data ?? []).map(d => ({
      ...d,
      category: d.category as 'indoor' | 'outdoor',
      scoring_inputs: d.scoring_inputs as unknown as ScoringInput[],
      level_bands: d.level_bands as unknown as LevelBand[],
    })));
  }, [user]);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('putting_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', 'indoor')
      .order('session_date', { ascending: false })
      .limit(1000);
    if (error) {
      toast.error('Failed to load sessions');
      return;
    }
    setSessions((data ?? []).map(s => ({
      ...s,
      category: s.category as 'indoor' | 'outdoor',
      drill_results: s.drill_results as unknown as DrillResult[],
    })));
  }, [user]);

  useEffect(() => {
    Promise.all([loadDrills(), loadSessions()]).finally(() => setLoading(false));
  }, [loadDrills, loadSessions]);

  const handleDeleteDrill = async (id: string) => {
    if (!confirm('Delete this custom drill?')) return;
    if (!user) return;
    const { error } = await supabase
      .from('putting_drills')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_builtin', false);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Drill deleted');
    loadDrills();
  };

  if (view === 'run') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setView('home')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Indoor
        </Button>
        <PuttingSessionRunner
          drills={drills}
          category="indoor"
          onComplete={() => {
            loadSessions();
            setView('home');
          }}
          onCancel={() => setView('home')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Putting
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Indoor Carpet Putting</CardTitle>
              <CardDescription>Start Line & Short Putt Control · scored out of 100</CardDescription>
            </div>
            <Button size="lg" onClick={() => setView('run')} disabled={drills.length === 0}>
              <Play className="mr-2 h-4 w-4" /> Start Session
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Read</Badge>
              <CardTitle className="text-lg">Pre-Shot Routine</CardTitle>
            </div>
            <CardDescription>Start it there. Roll it at that speed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {readSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3 rounded-md border bg-muted/20 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                        <h3 className="font-semibold leading-tight">{step.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start spot guide</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <div><span className="font-medium">Short:</span> 10-20cm ahead</div>
                <div><span className="font-medium">Medium:</span> 20-50cm ahead</div>
                <div><span className="font-medium">Long:</span> 50cm-1m ahead</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Technique</Badge>
              <CardTitle className="text-lg">Setup & Stroke</CardTitle>
            </div>
            <CardDescription>Face first. Feel it. Roll it. Finish.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {techniqueSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-3 rounded-md border bg-muted/20 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                        <h3 className="font-semibold leading-tight">{step.title}</h3>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Drills</CardTitle>
              <CardDescription>Built-in + your custom drills</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setBuilderOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Add Drill
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!loading && drills.map(d => (
              <div key={d.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{d.name}</span>
                    {d.is_builtin ? <Badge variant="secondary">Built-in</Badge> : <Badge>Custom</Badge>}
                    <span className="text-xs text-muted-foreground">
                      {d.reps} reps · max {d.scaled && d.scaled_max ? d.scaled_max : d.max_score}
                    </span>
                  </div>
                  {d.purpose && <p className="mt-1 text-xs text-muted-foreground">{d.purpose}</p>}
                </div>
                {!d.is_builtin && (
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteDrill(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <PuttingHistory sessions={sessions} onChanged={loadSessions} />

      <DrillBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        category="indoor"
        onSaved={loadDrills}
      />
    </div>
  );
}
