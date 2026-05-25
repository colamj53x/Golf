import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { PracticeShotData, NewPracticeShot, PracticeShotMetrics } from '@/types/practiceShots';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/lib/errorHandler';

export function usePracticeShots(sessionId: string | null) {
  const { user } = useAuth();
  const [shots, setShots] = useState<PracticeShotData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load shots for a session
  const loadShots = useCallback(async () => {
    if (!sessionId || !user) {
      setShots([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('practice_shots')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('shot_number', { ascending: true });

      if (error) throw error;

      const loadedShots: PracticeShotData[] = (data || []).map(row => ({
        id: row.id,
        sessionId: row.session_id,
        shotNumber: row.shot_number,
        excluded: row.excluded,
        metrics: row.metrics as unknown as PracticeShotMetrics,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));

      setShots(loadedShots);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error loading shots:', getUserFriendlyError(error));
      }
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => {
    loadShots();
  }, [loadShots]);

  // Save multiple shots for a session
  const saveShots = useCallback(async (
    sessionId: string,
    newShots: Omit<NewPracticeShot, 'sessionId'>[]
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const insertData = newShots.map(shot => ({
        session_id: sessionId,
        shot_number: shot.shotNumber,
        excluded: shot.excluded,
        metrics: JSON.parse(JSON.stringify(shot.metrics)),
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('practice_shots')
        .insert(insertData);

      if (error) throw error;

      // Reload to get the saved data
      await loadShots();
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving shots:', getUserFriendlyError(error));
      }
      toast.error('Failed to save individual shots');
      return false;
    }
  }, [user, loadShots]);

  // Toggle excluded status for a shot
  const toggleExcluded = useCallback(async (shotId: string) => {
    if (!user) return;

    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;

    const newExcluded = !shot.excluded;

    // Optimistic update
    setShots(prev => prev.map(s => 
      s.id === shotId ? { ...s, excluded: newExcluded } : s
    ));

    try {
      const { error } = await supabase
        .from('practice_shots')
        .update({ excluded: newExcluded })
        .eq('id', shotId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(newExcluded ? 'Shot excluded from analysis' : 'Shot included in analysis');
    } catch (error) {
      // Revert on error
      setShots(prev => prev.map(s => 
        s.id === shotId ? { ...s, excluded: !newExcluded } : s
      ));
      toast.error('Failed to update shot');
    }
  }, [shots, user]);

  // Get only included shots
  const includedShots = shots.filter(s => !s.excluded);
  const excludedCount = shots.filter(s => s.excluded).length;

  return {
    shots,
    includedShots,
    excludedCount,
    isLoading,
    saveShots,
    toggleExcluded,
    loadShots,
    hasShots: shots.length > 0,
  };
}
