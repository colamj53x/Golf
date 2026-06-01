import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Plus, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { LevelBand, PuttingDrill, ScoringInput } from '@/types/putting';
import { mergeLockedIndoorDrills } from '@/lib/putting/drills';
import { DrillBuilderDialog } from './DrillBuilderDialog';

export function PuttingDrillBankTab() {
  const { user } = useAuth();
  const [drills, setDrills] = useState<PuttingDrill[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('all');
  const [skill, setSkill] = useState('all');

  const loadDrills = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('putting_drills').select('*');
    query = user ? query.or(`is_builtin.eq.true,user_id.eq.${user.id}`) : query.eq('is_builtin', true);
    const { data, error } = await query.order('sort_order');
    if (error) {
      toast.error('Failed to load putting drills');
      setLoading(false);
      return;
    }
    const remoteDrills = (data ?? []).map((drill) => ({
      ...drill,
      category: drill.category as 'indoor' | 'outdoor',
      scoring_inputs: drill.scoring_inputs as unknown as ScoringInput[],
      level_bands: drill.level_bands as unknown as LevelBand[],
      scoring_mode: 'standard' as const,
    }));
    setDrills(mergeLockedIndoorDrills(remoteDrills));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadDrills();
  }, [loadDrills]);

  const filtered = useMemo(() => drills.filter((drill) => {
    const text = `${drill.name} ${drill.purpose} ${drill.skill_tags?.join(' ')}`.toLowerCase();
    const locationMatch = location === 'all' || drill.location === location || drill.location === 'both';
    const skillMatch = skill === 'all' || drill.skill_tags?.includes(skill);
    return text.includes(search.toLowerCase()) && locationMatch && skillMatch;
  }), [drills, location, search, skill]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div><CardTitle>Putting Drill Library</CardTitle><CardDescription>Choose the drill that fits the skill, surface, and time you have available.</CardDescription></div>
          <Button size="sm" className="gap-2" onClick={() => setBuilderOpen(true)}><Plus className="h-4 w-4" /> Add drill</Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search drills..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Select value={location} onValueChange={setLocation}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All locations</SelectItem><SelectItem value="indoor">Indoor</SelectItem><SelectItem value="outdoor">Outdoor</SelectItem></SelectContent></Select>
          <Select value={skill} onValueChange={setSkill}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All skills</SelectItem><SelectItem value="start line">Start line</SelectItem><SelectItem value="strike">Strike</SelectItem><SelectItem value="pace">Pace</SelectItem><SelectItem value="conversion">Conversion</SelectItem><SelectItem value="reading">Green reading</SelectItem><SelectItem value="pressure">Pressure</SelectItem><SelectItem value="tempo">Tempo</SelectItem><SelectItem value="routine">Routine</SelectItem></SelectContent></Select>
        </CardContent>
      </Card>

      {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading putting drills...</CardContent></Card> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((drill) => (
            <Card key={drill.id} className="h-full">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-bold">{drill.name}</h3><div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="capitalize">{drill.location}</Badge>{drill.skill_tags?.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div></div>
                  {drill.blast_compatible && <Sparkles className="h-5 w-5 shrink-0 text-sky-600" aria-label="Blast compatible" />}
                </div>
                <p className="text-sm text-muted-foreground">{drill.purpose}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {drill.time_minutes} min · {drill.equipment?.join(', ')}</div>
                <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-xs">
                  <p><strong>Setup:</strong> {drill.setup}</p>
                  <p><strong>Cue:</strong> {drill.recommendation}</p>
                  <p><strong>Progression:</strong> {drill.progression}</p>
                  <p><strong>Regression:</strong> {drill.regression}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DrillBuilderDialog open={builderOpen} onOpenChange={setBuilderOpen} category="indoor" onSaved={loadDrills} />
    </div>
  );
}
