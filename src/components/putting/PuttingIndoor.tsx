import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { PuttingDrill, LevelBand, ScoringInput } from '@/types/putting';
import { PuttingSessionRunner } from './PuttingSessionRunner';
import { IndoorPracticeSetId, mergeLockedIndoorDrills } from '@/lib/putting/drills';

interface Props {
  onBack: () => void;
  initialPracticeSetId?: IndoorPracticeSetId;
}

export function PuttingIndoor({ onBack, initialPracticeSetId = 'set-a' }: Props) {
  const { user } = useAuth();
  const [drills, setDrills] = useState<PuttingDrill[]>([]);
  const [loading, setLoading] = useState(true);

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
    const remoteDrills = (data ?? []).map(d => ({
      ...d,
      category: d.category as 'indoor' | 'outdoor',
      scoring_inputs: d.scoring_inputs as unknown as ScoringInput[],
      level_bands: d.level_bands as unknown as LevelBand[],
      scoring_mode: 'standard' as const,
    }));
    setDrills(mergeLockedIndoorDrills(remoteDrills));
  }, [user]);

  useEffect(() => {
    loadDrills().finally(() => setLoading(false));
  }, [loadDrills]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Drills
      </Button>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading putting drills...</p>
      ) : (
        <PuttingSessionRunner
          drills={drills}
          category="indoor"
          initialPracticeSetId={initialPracticeSetId}
          onComplete={onBack}
          onCancel={onBack}
        />
      )}
    </div>
  );
}
