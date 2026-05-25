import { useEffect, useSyncExternalStore } from 'react';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS, getPracticeConfigKey } from '@/types/practiceClubs';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type ProfileTarget = 'green' | 'fairway';

export interface ShotProfile {
  id: string;
  clubId: string;
  shotType: string;
  power: string;
  enabled: boolean;
  showInPractice: boolean;
  showOnCourse: boolean;
  targets: ProfileTarget[];
  technique: string;
  routine: string;
  targetTotal: number | null;
  targetCarry: number | null;
  targetSideLeft: number | null;
  targetSideRight: number | null;
  targetVariationPct: number | null;
  targetQualityCutoff: number | null;
}

export type ShotProfileMap = Record<string, ShotProfile>;

const STORAGE_KEY = 'golf_shot_profiles_v1';
const OLD_COMBOS_KEY = 'practice_enabled_combos_v1';
const PUNCH_PROFILE_IDS = ['6i_punch_full', '7i_punch_full'];
const EVENT = 'golf-shot-profiles-changed';

function profileId(clubId: string, shotType: string, power: string): string {
  return getPracticeConfigKey(clubId, shotType, power);
}

function makeProfile(
  clubId: string,
  shotType: string,
  power: string,
  targets: ProfileTarget[],
  enabled = true,
): ShotProfile {
  return {
    id: profileId(clubId, shotType, power),
    clubId,
    shotType,
    power,
    enabled,
    showInPractice: enabled,
    showOnCourse: enabled,
    targets,
    technique: '',
    routine: '',
    targetTotal: null,
    targetCarry: null,
    targetSideLeft: null,
    targetSideRight: null,
    targetVariationPct: null,
    targetQualityCutoff: null,
  };
}

function defaultProfiles(): ShotProfileMap {
  const profiles: ShotProfile[] = [
    makeProfile('dr', 'full', 'full', ['fairway']),
    makeProfile('5w', 'full', 'full', ['fairway', 'green']),
    makeProfile('4h', 'full', 'full', ['fairway', 'green']),
    makeProfile('5h', 'full', 'full', ['fairway', 'green']),
    makeProfile('6i', 'full', 'full', ['green']),
    makeProfile('6i', 'punch', 'full', ['fairway', 'green']),
    makeProfile('7i', 'full', 'full', ['green']),
    makeProfile('7i', 'punch', 'full', ['fairway', 'green']),
    makeProfile('8i', 'full', 'full', ['green']),
    makeProfile('9i', 'full', 'full', ['green']),
    makeProfile('pw', 'full', 'full', ['green']),
    makeProfile('gw', 'full', 'full', ['green']),
    makeProfile('sw', 'full', 'full', ['green']),
    makeProfile('pw', 'pitch', '9pm', ['green']),
    makeProfile('pw', 'pitch', '730pm', ['green']),
    makeProfile('gw', 'pitch', '9pm', ['green']),
    makeProfile('gw', 'pitch', '730pm', ['green']),
    makeProfile('sw', 'pitch', '9pm', ['green']),
    makeProfile('sw', 'pitch', '730pm', ['green']),
    makeProfile('pw', 'chip', '730pm', ['green']),
    makeProfile('gw', 'chip', '730pm', ['green']),
    makeProfile('sw', 'chip', '730pm', ['green']),
  ];

  return Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
}

function allKnownProfiles(): ShotProfileMap {
  const base = defaultProfiles();
  for (const club of PRACTICE_CLUBS) {
    for (const shotType of SHOT_TYPES) {
      for (const power of POWER_OPTIONS) {
        const id = profileId(club.id, shotType.id, power.id);
        if (!base[id]) {
          base[id] = makeProfile(club.id, shotType.id, power.id, ['green'], false);
        }
      }
    }
  }
  return base;
}

function migrateOldCombos(base: ShotProfileMap): ShotProfileMap {
  try {
    const raw = localStorage.getItem(OLD_COMBOS_KEY);
    if (!raw) return base;

    const parsed = JSON.parse(raw) as Record<string, { shotTypes?: string[]; powers?: string[] }>;
    const next = { ...base };
    for (const clubId of Object.keys(parsed)) {
      const shotTypes = parsed[clubId]?.shotTypes ?? [];
      const powers = parsed[clubId]?.powers ?? [];
      for (const shotType of shotTypes) {
        for (const power of powers) {
          const id = profileId(clubId, shotType, power);
          const existing = next[id] ?? makeProfile(clubId, shotType, power, ['green'], true);
          next[id] = {
            ...existing,
            enabled: true,
            showInPractice: true,
          };
        }
      }
    }
    return next;
  } catch {
    return base;
  }
}

function enablePunchProfiles(profiles: ShotProfileMap): ShotProfileMap {
  const next = { ...profiles };
  for (const id of PUNCH_PROFILE_IDS) {
    const profile = next[id];
    if (!profile) continue;
    next[id] = {
      ...profile,
      enabled: true,
      showInPractice: true,
      showOnCourse: true,
      targets: profile.targets.length ? profile.targets : ['fairway', 'green'],
    };
  }
  return next;
}

function readRaw(): ShotProfileMap {
  const known = allKnownProfiles();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return enablePunchProfiles(migrateOldCombos(known));

    const stored = JSON.parse(raw) as Partial<ShotProfileMap>;
    const merged = { ...known };
    for (const id of Object.keys(stored)) {
      const profile = stored[id];
      if (!profile) continue;
      merged[id] = {
        ...(merged[id] ?? profile),
        ...profile,
        targets: profile.targets?.filter((target) => target === 'green' || target === 'fairway') ?? merged[id]?.targets ?? ['green'],
        targetVariationPct: profile.targetVariationPct ?? merged[id]?.targetVariationPct ?? null,
        targetQualityCutoff: profile.targetQualityCutoff ?? merged[id]?.targetQualityCutoff ?? null,
      };
    }
    return enablePunchProfiles(merged);
  } catch {
    return enablePunchProfiles(migrateOldCombos(known));
  }
}

type ShotProfileRow = {
  profile_key: string;
  club_id: string;
  shot_type: string;
  power: string;
  enabled: boolean;
  show_in_practice: boolean;
  show_on_course: boolean;
  targets: string[];
  technique: string | null;
  routine: string | null;
  target_total: number | null;
  target_carry: number | null;
  target_side_left: number | null;
  target_side_right: number | null;
  target_variation_pct: number | null;
  target_quality_cutoff: number | null;
};

function fromRow(row: ShotProfileRow): ShotProfile {
  return {
    id: row.profile_key,
    clubId: row.club_id,
    shotType: row.shot_type,
    power: row.power,
    enabled: row.enabled,
    showInPractice: row.show_in_practice,
    showOnCourse: row.show_on_course,
    targets: row.targets.filter((target): target is ProfileTarget => target === 'green' || target === 'fairway'),
    technique: row.technique ?? '',
    routine: row.routine ?? '',
    targetTotal: row.target_total,
    targetCarry: row.target_carry,
    targetSideLeft: row.target_side_left,
    targetSideRight: row.target_side_right,
    targetVariationPct: row.target_variation_pct,
    targetQualityCutoff: row.target_quality_cutoff,
  };
}

function toRow(profile: ShotProfile, userId: string) {
  return {
    user_id: userId,
    profile_key: profile.id,
    club_id: profile.clubId,
    shot_type: profile.shotType,
    power: profile.power,
    enabled: profile.enabled,
    show_in_practice: profile.showInPractice,
    show_on_course: profile.showOnCourse,
    targets: profile.targets,
    technique: profile.technique || null,
    routine: profile.routine || null,
    target_total: profile.targetTotal,
    target_carry: profile.targetCarry,
    target_side_left: profile.targetSideLeft,
    target_side_right: profile.targetSideRight,
    target_variation_pct: profile.targetVariationPct,
    target_quality_cutoff: profile.targetQualityCutoff,
  };
}

async function persistProfile(profile: ShotProfile) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  await supabase
    .from('shot_profiles')
    .upsert(toRow(profile, userId), { onConflict: 'user_id,profile_key' });
}

let cache: ShotProfileMap | null = null;

function getSnapshot(): ShotProfileMap {
  if (!cache) cache = readRaw();
  return cache;
}

function subscribe(cb: () => void) {
  const handler = () => {
    cache = readRaw();
    cb();
  };
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function getShotProfiles(): ShotProfileMap {
  return getSnapshot();
}

export function setShotProfiles(next: ShotProfileMap) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Local-only settings; ignore storage quota/private mode failures.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function updateShotProfile(id: string, patch: Partial<ShotProfile>) {
  const current = getSnapshot();
  const existing = current[id];
  if (!existing) return;
  const updated = { ...existing, ...patch };
  setShotProfiles({
    ...current,
    [id]: updated,
  });
  void persistProfile(updated);
}

export function useShotProfiles(): ShotProfileMap {
  const { user } = useAuth();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('shot_profiles')
        .select('*')
        .eq('user_id', user.id);

      if (cancelled || error || !data) return;

      const next = { ...allKnownProfiles() };
      for (const row of data) {
        const profile = fromRow(row);
        next[profile.id] = {
          ...(next[profile.id] ?? profile),
          ...profile,
        };
      }
      const migrated = enablePunchProfiles(next);
      setShotProfiles(migrated);
      for (const id of PUNCH_PROFILE_IDS) {
        void persistProfile(migrated[id]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return snapshot;
}

export function getEnabledProfilesForClub(clubId: string, options: { practiceOnly?: boolean; onCourseOnly?: boolean } = {}) {
  return Object.values(getSnapshot()).filter((profile) =>
    profile.clubId === clubId &&
    profile.enabled &&
    (!options.practiceOnly || profile.showInPractice) &&
    (!options.onCourseOnly || profile.showOnCourse)
  );
}

export function getProfileDisplayName(profile: ShotProfile): string {
  const clubName = PRACTICE_CLUBS.find((club) => club.id === profile.clubId)?.name ?? profile.clubId;
  const shotName = SHOT_TYPES.find((shot) => shot.id === profile.shotType)?.name ?? profile.shotType;
  const powerName = POWER_OPTIONS.find((power) => power.id === profile.power)?.name ?? profile.power;
  return `${clubName} / ${shotName} / ${powerName}`;
}
