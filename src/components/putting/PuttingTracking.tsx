import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PuttingDashboard } from './PuttingDashboard';
import { PuttingHistory } from './PuttingHistory';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { DrillResult, PuttingSessionRecord } from '@/types/putting';

export function PuttingTracking() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PuttingSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('putting_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category', 'indoor')
      .order('session_date', { ascending: false })
      .limit(1000);

    if (error) {
      toast.error('Failed to load putting sessions');
      setLoading(false);
      return;
    }

    setSessions((data ?? []).map(session => ({
      ...session,
      category: session.category as 'indoor' | 'outdoor',
      drill_results: session.drill_results as unknown as DrillResult[],
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <div className="space-y-5">
      <PuttingDashboard sessions={sessions} loading={loading} />
      {!loading && sessions.length > 0 && <PuttingHistory sessions={sessions} onChanged={loadSessions} />}
    </div>
  );
}
