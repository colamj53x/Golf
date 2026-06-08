import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const JOURNAL_REFLECTION_CONFIG_PREFIX = 'journal_reflection:';

export interface JournalReflection {
  id: string;
  reflectionDate: string;
  title: string;
  body: string;
  linkedRoundDates: string[];
  createdAt: Date;
  updatedAt: Date;
}

type JournalReflectionMetrics = {
  title?: string;
  body?: string;
  linkedRoundDates?: string[];
};

function parseReflectionMetrics(value: Json): JournalReflectionMetrics {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    linkedRoundDates: Array.isArray(record.linkedRoundDates)
      ? record.linkedRoundDates.filter((date): date is string => typeof date === 'string')
      : [],
  };
}

export async function loadJournalReflections(userId: string): Promise<JournalReflection[]> {
  const { data, error } = await supabase
    .from('practice_configs')
    .select('id, config_key, metrics, created_at, updated_at')
    .eq('user_id', userId)
    .like('config_key', `${JOURNAL_REFLECTION_CONFIG_PREFIX}%`)
    .order('config_key', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const metrics = parseReflectionMetrics(row.metrics);
    return {
      id: row.id,
      reflectionDate: row.config_key.slice(JOURNAL_REFLECTION_CONFIG_PREFIX.length),
      title: metrics.title || '',
      body: metrics.body || '',
      linkedRoundDates: metrics.linkedRoundDates || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  });
}

export async function saveJournalReflection(
  userId: string,
  reflectionDate: string,
  value: Pick<JournalReflection, 'title' | 'body' | 'linkedRoundDates'>,
): Promise<void> {
  const { error } = await supabase
    .from('practice_configs')
    .upsert({
      config_key: `${JOURNAL_REFLECTION_CONFIG_PREFIX}${reflectionDate}`,
      club: 'journal',
      shot_type: 'reflection',
      power: 'memo',
      metrics: value as unknown as Json,
      user_id: userId,
    }, { onConflict: 'user_id,config_key' });

  if (error) throw error;
}
