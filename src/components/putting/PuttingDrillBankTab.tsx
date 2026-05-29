import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { LevelBand, PuttingDrill, ScoringInput } from '@/types/putting';
import { INDOOR_PRACTICE_SETS, mergeLockedIndoorDrills } from '@/lib/putting/drills';
import { DrillBuilderDialog } from './DrillBuilderDialog';

export function PuttingDrillBankTab() {
  const { user } = useAuth();
  const [drills, setDrills] = useState<PuttingDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);

  const loadDrills = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('putting_drills')
      .select('*')
      .eq('category', 'indoor');

    query = user
      ? query.or(`is_builtin.eq.true,user_id.eq.${user.id}`)
      : query.eq('is_builtin', true);

    const { data, error } = await query.order('sort_order');
    if (error) {
      toast.error('Failed to load putting drills');
      setLoading(false);
      return;
    }

    const remoteDrills = (data ?? []).map(d => ({
      ...d,
      category: d.category as 'indoor' | 'outdoor',
      scoring_inputs: d.scoring_inputs as unknown as ScoringInput[],
      level_bands: d.level_bands as unknown as LevelBand[],
      scoring_mode: 'standard' as const,
    }));
    setDrills(mergeLockedIndoorDrills(remoteDrills));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDrills();
  }, [loadDrills]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Putting Drill Bank</CardTitle>
            <CardDescription>Indoor putting sets and scored drill definitions.</CardDescription>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setBuilderOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Drill
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {INDOOR_PRACTICE_SETS.map(set => (
              <Card key={set.id} className="h-full">
                <CardHeader className="pb-3">
                  <Badge variant={set.id === 'full' ? 'secondary' : 'outline'} className="w-fit">
                    {set.id === 'full' ? 'Test' : set.id.replace('set-', 'Set ').toUpperCase()}
                  </Badge>
                  <CardTitle className="text-base">{set.name.replace(/^Set [ABC] - /, '')}</CardTitle>
                  <CardDescription>{set.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-1 text-sm">
                    {set.drillNames.map((drillName, index) => (
                      <li key={drillName} className="flex gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                        <span>{drillName}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="min-w-[180px]">Drill</th>
                  <th className="min-w-[120px]">Type</th>
                  <th className="min-w-[80px]">Reps</th>
                  <th className="min-w-[90px]">Max</th>
                  <th className="min-w-[260px]">Purpose</th>
                  <th className="min-w-[320px]">Setup</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground">Loading putting drills...</td>
                  </tr>
                ) : (
                  drills.map(drill => (
                    <tr key={drill.id}>
                      <td className="font-medium">{drill.name}</td>
                      <td>
                        <Badge variant={drill.is_builtin ? 'secondary' : 'outline'}>
                          {drill.is_builtin ? 'Built-in' : 'Custom'}
                        </Badge>
                      </td>
                      <td>{drill.reps}</td>
                      <td>{drill.max_score}</td>
                      <td className="text-muted-foreground">{drill.purpose ?? '—'}</td>
                      <td className="text-muted-foreground">{drill.setup ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DrillBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        category="indoor"
        onSaved={loadDrills}
      />
    </div>
  );
}
