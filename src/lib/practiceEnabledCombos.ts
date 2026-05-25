import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS } from '@/types/practiceClubs';
import { getEnabledProfilesForClub, getShotProfiles, updateShotProfile, useShotProfiles } from '@/lib/shotProfiles';

export interface ClubCombos {
  shotTypes: string[]; // enabled shot type ids
  powers: string[];    // enabled power ids
}

export type EnabledCombos = Record<string, ClubCombos>; // keyed by practice club id

function defaultCombos(): EnabledCombos {
  const out: EnabledCombos = {};
  for (const c of PRACTICE_CLUBS) {
    out[c.id] = {
      shotTypes: getEnabledShotTypesForClub(c.id).map(s => s.id),
      powers: getEnabledPowersForClub(c.id).map(p => p.id),
    };
  }
  return out;
}

export function getEnabledCombos(): EnabledCombos {
  return defaultCombos();
}

export function updateClubCombos(clubId: string, combos: ClubCombos) {
  const profiles = getShotProfiles();
  for (const profile of Object.values(profiles)) {
    if (profile.clubId !== clubId) continue;
    const enabled = combos.shotTypes.includes(profile.shotType) && combos.powers.includes(profile.power);
    updateShotProfile(profile.id, { enabled, showInPractice: enabled });
  }
}

export function useEnabledCombos(): EnabledCombos {
  useShotProfiles();
  return getEnabledCombos();
}

export function getEnabledShotTypesForClub(clubId: string) {
  const ids = [...new Set(getEnabledProfilesForClub(clubId, { practiceOnly: true }).map(profile => profile.shotType))];
  return SHOT_TYPES.filter(s => ids.includes(s.id));
}

export function getEnabledPowersForClub(clubId: string, shotType?: string) {
  const ids = [...new Set(getEnabledProfilesForClub(clubId, { practiceOnly: true })
    .filter(profile => !shotType || profile.shotType === shotType)
    .map(profile => profile.power))];
  return POWER_OPTIONS.filter(p => ids.includes(p.id));
}
