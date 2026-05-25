import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface ShotsBySession {
  [sessionId: string]: Array<{ metrics: Record<string, unknown>; excluded: boolean }>;
}

/**
 * Fetch every shot for the given session ids in a single query, grouped by session.
 * Excluded shots are filtered out.
 */
export function usePracticeShotsBySessions(sessionIds: string[]) {
  const { user } = useAuth();
  const [shotsBySession, setShotsBySession] = useState<ShotsBySession>({});
  const [isLoading, setIsLoading] = useState(false);
  const key = sessionIds.join(',');

  useEffect(() => {
    let cancelled = false;
    if (!user || sessionIds.length === 0) {
      setShotsBySession({});
      return;
    }
    setIsLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('practice_shots')
        .select('session_id, excluded, metrics')
        .in('session_id', sessionIds)
        .eq('user_id', user.id);

      if (cancelled) return;
      if (error) {
        if (import.meta.env.DEV) console.error('shots fetch error', error);
        setShotsBySession({});
      } else {
        const grouped: ShotsBySession = {};
        for (const row of data ?? []) {
          if (row.excluded) continue;
          (grouped[row.session_id] ??= []).push({
            metrics: (row.metrics ?? {}) as Record<string, unknown>,
            excluded: row.excluded,
          });
        }
        setShotsBySession(grouped);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key]);

  return { shotsBySession, isLoading };
}
