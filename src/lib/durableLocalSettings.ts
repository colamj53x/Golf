import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { USER_SETTINGS_CONFIG_PREFIX } from '@/lib/userSettingsRepository';

const CONFIG_KEY = `${USER_SETTINGS_CONFIG_PREFIX}local_cache`;
const KEYS = [
  'custom_drills_v1',
  'drill_bank_assignments_v1',
  'drill_hidden_v1',
  'drill_overrides_v1',
  'golf_gapping_shot_category_overrides_v1',
  'golf_shot_classification_rules_v1',
] as const;

export async function hydrateDurableLocalSettings(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('practice_configs')
    .select('metrics')
    .eq('user_id', userId)
    .eq('config_key', CONFIG_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data?.metrics || typeof data.metrics !== 'object' || Array.isArray(data.metrics)) {
    await persistDurableLocalSettings(userId);
    return;
  }

  const values = data.metrics as Record<string, Json | undefined>;
  for (const key of KEYS) {
    const value = values[key];
    if (value !== undefined) localStorage.setItem(key, JSON.stringify(value));
  }
  window.dispatchEvent(new Event('golf-durable-local-settings-hydrated'));
}

export async function persistDurableLocalSettings(userId?: string): Promise<void> {
  const resolvedUserId = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!resolvedUserId) return;

  const values = Object.fromEntries(KEYS.map((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [key, null];
    try {
      return [key, JSON.parse(raw) as Json];
    } catch {
      return [key, null];
    }
  }));

  const { error } = await supabase
    .from('practice_configs')
    .upsert({
      config_key: CONFIG_KEY,
      club: '__user_settings__',
      shot_type: 'local_cache',
      power: 'v1',
      metrics: values as Json,
      user_id: resolvedUserId,
    }, { onConflict: 'user_id,config_key' });

  if (error) throw error;
}

export function persistDurableLocalSettingsSoon(): void {
  void persistDurableLocalSettings().catch(() => {
    // Local settings remain available even if remote sync is unavailable.
  });
}
