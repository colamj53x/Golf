import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { ClubConfig } from '@/types/golf';

export const USER_SETTINGS_CONFIG_KEY = '__user_settings__:golf_data';
export const USER_SETTINGS_CONFIG_PREFIX = '__user_settings__:';

export interface GolfUserSettings {
  clubs: ClubConfig[];
  distanceToTargetTolerance: number;
  lowTargetExclusionThreshold: number;
  gappingHcpTarget: number;
  shotPickerDistanceTolerancePct: number;
  practiceDistanceTolerancePct: number;
  practiceBallFlightTolerancePct: number;
  practiceOtherTolerancePct: number;
  todayRecentShotCount: number;
}

export async function loadGolfUserSettings(userId: string): Promise<GolfUserSettings | null> {
  const { data, error } = await supabase
    .from('practice_configs')
    .select('metrics')
    .eq('user_id', userId)
    .eq('config_key', USER_SETTINGS_CONFIG_KEY)
    .maybeSingle();

  if (error) throw error;
  if (!data?.metrics || typeof data.metrics !== 'object' || Array.isArray(data.metrics)) return null;
  return data.metrics as unknown as GolfUserSettings;
}

export async function saveGolfUserSettings(userId: string, settings: GolfUserSettings): Promise<void> {
  const { error } = await supabase
    .from('practice_configs')
    .upsert({
      config_key: USER_SETTINGS_CONFIG_KEY,
      club: '__user_settings__',
      shot_type: 'golf_data',
      power: 'v1',
      metrics: settings as unknown as Json,
      user_id: userId,
    }, { onConflict: 'user_id,config_key' });

  if (error) throw error;
}

export function parseGolfUserSettings(
  value: Partial<GolfUserSettings> | null,
  fallback: GolfUserSettings,
): GolfUserSettings {
  if (!value) return fallback;

  const numberOr = (candidate: unknown, defaultValue: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : defaultValue;

  return {
    clubs: Array.isArray(value.clubs) && value.clubs.length > 0 ? value.clubs : fallback.clubs,
    distanceToTargetTolerance: numberOr(value.distanceToTargetTolerance, fallback.distanceToTargetTolerance),
    lowTargetExclusionThreshold: numberOr(value.lowTargetExclusionThreshold, fallback.lowTargetExclusionThreshold),
    gappingHcpTarget: numberOr(value.gappingHcpTarget, fallback.gappingHcpTarget),
    shotPickerDistanceTolerancePct: numberOr(value.shotPickerDistanceTolerancePct, fallback.shotPickerDistanceTolerancePct),
    practiceDistanceTolerancePct: numberOr(value.practiceDistanceTolerancePct, fallback.practiceDistanceTolerancePct),
    practiceBallFlightTolerancePct: numberOr(value.practiceBallFlightTolerancePct, fallback.practiceBallFlightTolerancePct),
    practiceOtherTolerancePct: numberOr(value.practiceOtherTolerancePct, fallback.practiceOtherTolerancePct),
    todayRecentShotCount: numberOr(value.todayRecentShotCount, fallback.todayRecentShotCount),
  };
}
