import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Play, Trash2 } from 'lucide-react';
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

export function PuttingIndoor({ onBack }: Props) {
  const { user } = useAuth();
  const [drills, setDrills] = useState<PuttingDrill[]>([]);
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('home');
  const [builderOpen, setBuilderOpen] = useState(false);

  const loadDrills = useCallback(async () => {
    const { data, error } = await supabase
      .from('putting_drills')
      .select('*')
      .eq('category', 'indoor')
      .order('sort_order');
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
  }, []);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('putting_sessions')
      .select('*')
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
    const { error } = await supabase.from('putting_drills').delete().eq('id', id);
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
