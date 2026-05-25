// Per-club enabled shot types & power options for practice dropdowns.
// Stored in localStorage; default = everything enabled.
import { useSyncExternalStore } from 'react';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS } from '@/types/practiceClubs';

const STORAGE_KEY = 'practice_enabled_combos_v1';
const EVENT = 'practice-enabled-combos-changed';

export interface ClubCombos {
  shotTypes: string[]; // enabled shot type ids
  powers: string[];    // enabled power ids
}

// Stored shape adds "known" lists so we can tell intentional un-checks
// apart from IDs that didn't exist yet when the user last saved.
interface StoredClubCombos extends ClubCombos {
  knownShotTypes?: string[];
  knownPowers?: string[];
}

export type EnabledCombos = Record<string, ClubCombos>; // keyed by practice club id
type StoredCombos = Record<string, StoredClubCombos>;

function defaultCombos(): EnabledCombos {
  const out: EnabledCombos = {};
  for (const c of PRACTICE_CLUBS) {
    out[c.id] = {
      shotTypes: SHOT_TYPES.map(s => s.id),
      powers: POWER_OPTIONS.map(p => p.id),
    };
  }
  return out;
}

function readRaw(): EnabledCombos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCombos();
    const parsed = JSON.parse(raw) as Partial<StoredCombos>;
    const base = defaultCombos();
    for (const c of PRACTICE_CLUBS) {
      const stored = parsed?.[c.id];
      if (stored && Array.isArray(stored.shotTypes) && Array.isArray(stored.powers)) {
        const storedShotIds = stored.shotTypes.filter(id => SHOT_TYPES.some(s => s.id === id));
        const storedPowerIds = stored.powers.filter(id => POWER_OPTIONS.some(p => p.id === id));
        // Only auto-enable IDs that weren't in the "known" list at save time
        // (i.e. truly new shot types/powers added to the codebase since).
        const knownShot = Array.isArray(stored.knownShotTypes) ? stored.knownShotTypes : storedShotIds;
        const knownPower = Array.isArray(stored.knownPowers) ? stored.knownPowers : storedPowerIds;
        const newShotIds = SHOT_TYPES.map(s => s.id).filter(id => !knownShot.includes(id));
        const newPowerIds = POWER_OPTIONS.map(p => p.id).filter(id => !knownPower.includes(id));
        base[c.id] = {
          shotTypes: [...storedShotIds, ...newShotIds.filter(id => !storedShotIds.includes(id))],
          powers: [...storedPowerIds, ...newPowerIds.filter(id => !storedPowerIds.includes(id))],
        };
      }
    }
    return base;
  } catch {
    return defaultCombos();
  }
}

let cache: EnabledCombos | null = null;
function getSnapshot(): EnabledCombos {
  if (!cache) cache = readRaw();
  return cache;
}

export function getEnabledCombos(): EnabledCombos {
  return getSnapshot();
}

function toStored(next: EnabledCombos): StoredCombos {
  const allShot = SHOT_TYPES.map(s => s.id);
  const allPower = POWER_OPTIONS.map(p => p.id);
  const out: StoredCombos = {};
  for (const clubId of Object.keys(next)) {
    out[clubId] = {
      ...next[clubId],
      knownShotTypes: allShot,
      knownPowers: allPower,
    };
  }
  return out;
}

export function setEnabledCombos(next: EnabledCombos) {
  cache = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(next))); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function updateClubCombos(clubId: string, combos: ClubCombos) {
  const next = { ...getSnapshot(), [clubId]: combos };
  setEnabledCombos(next);
}

function subscribe(cb: () => void) {
  const handler = () => { cache = readRaw(); cb(); };
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function useEnabledCombos(): EnabledCombos {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getEnabledShotTypesForClub(clubId: string) {
  const combos = getSnapshot()[clubId];
  const ids = combos?.shotTypes ?? SHOT_TYPES.map(s => s.id);
  return SHOT_TYPES.filter(s => ids.includes(s.id));
}

export function getEnabledPowersForClub(clubId: string) {
  const combos = getSnapshot()[clubId];
  const ids = combos?.powers ?? POWER_OPTIONS.map(p => p.id);
  return POWER_OPTIONS.filter(p => ids.includes(p.id));
}
