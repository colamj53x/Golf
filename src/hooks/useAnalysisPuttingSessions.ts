import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { AnalysisPuttingSession } from '@/lib/analysisSynthesis';

export function useAnalysisPuttingSessions(): AnalysisPuttingSession[] {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<AnalysisPuttingSession[]>([]);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }

    let cancelled = false;
    void supabase
      .from('putting_sessions')
      .select('session_date,total_score,max_total,notes_before,main_miss')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (cancelled) return;
        setSessions((data || []).map((session) => ({
          sessionDate: session.session_date,
          totalScore: session.total_score,
          maxTotal: session.max_total,
          notes: session.notes_before || '',
          mainMiss: session.main_miss || '',
        })));
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return sessions;
}
