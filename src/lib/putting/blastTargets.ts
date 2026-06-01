import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { BlastMotionTargets, DEFAULT_BLAST_MOTION_TARGETS, parseBlastMotionTargets } from './blastTargetDefaults';
export { BLAST_MOTION_METRICS, DEFAULT_BLAST_MOTION_TARGETS } from './blastTargetDefaults';

const CONFIG_KEY = '__user_settings__:putting_blast_targets';
const CACHE_KEY = 'golf-putting-blast-targets-v1';
const CHANGE_EVENT = 'golf-putting-blast-targets-changed';

function loadCachedTargets(): BlastMotionTargets {
  try {
    return parseBlastMotionTargets(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'));
  } catch {
    return DEFAULT_BLAST_MOTION_TARGETS;
  }
}

function cacheTargets(targets: BlastMotionTargets) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(targets));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: targets }));
}

async function loadRemoteTargets(userId: string): Promise<BlastMotionTargets | null> {
  const { data, error } = await supabase.from('practice_configs').select('metrics').eq('user_id', userId).eq('config_key', CONFIG_KEY).maybeSingle();
  if (error) throw error;
  return data?.metrics ? parseBlastMotionTargets(data.metrics) : null;
}

async function saveRemoteTargets(userId: string, targets: BlastMotionTargets) {
  const { error } = await supabase.from('practice_configs').upsert({
    config_key: CONFIG_KEY,
    club: '__user_settings__',
    shot_type: 'putting_blast_targets',
    power: 'v1',
    metrics: targets as unknown as Json,
    user_id: userId,
  }, { onConflict: 'user_id,config_key' });
  if (error) throw error;
}

export function useBlastMotionTargets() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<BlastMotionTargets>(loadCachedTargets);
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    const listener = (event: Event) => setTargets((event as CustomEvent<BlastMotionTargets>).detail);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => window.removeEventListener(CHANGE_EVENT, listener);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const remote = await loadRemoteTargets(user.id);
        if (cancelled) return;
        if (remote) {
          cacheTargets(remote);
          setTargets(remote);
        } else {
          await saveRemoteTargets(user.id, loadCachedTargets());
        }
      } catch {
        // Cached defaults remain usable while remote sync is unavailable.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveTargets = useCallback(async (next: BlastMotionTargets) => {
    if (!user) throw new Error('Please sign in again before saving settings.');
    cacheTargets(next);
    setTargets(next);
    await saveRemoteTargets(user.id, next);
  }, [user]);

  return { targets, loading, saveTargets };
}
