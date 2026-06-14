// Club, Shot Type, and Power options for practice sessions

export const PRACTICE_CLUBS = [
  { id: 'dr', name: 'Driver' },
  { id: '5w', name: '5 Wood' },
  { id: '4h', name: '4 Hybrid' },
  { id: '5h', name: '5 Hybrid' },
  { id: '6i', name: '6 Iron' },
  { id: '7i', name: '7 Iron' },
  { id: '8i', name: '8 Iron' },
  { id: '9i', name: '9 Iron' },
  { id: 'pw', name: 'Pitching Wedge' },
  { id: 'gw', name: 'Gap Wedge' },
  { id: 'sw', name: 'Sand Wedge' },
] as const;

export const SHOT_TYPES = [
  { id: 'full', name: 'Full' },
  { id: 'punch', name: 'Punch' },
  { id: 'pitch', name: 'Pitch' },
  { id: 'chip', name: 'Chip' },
  { id: 'bump', name: 'Bump' },
] as const;

export const POWER_OPTIONS = [
  { id: 'full', name: 'Full' },
  { id: '9pm', name: 'Half' },
] as const;

export type PracticeClubId = typeof PRACTICE_CLUBS[number]['id'];
export type ShotTypeId = typeof SHOT_TYPES[number]['id'];
export type PowerOptionId = typeof POWER_OPTIONS[number]['id'];

// Composite key for club+shot+power combination
export function getPracticeConfigKey(club: string, shotType: string, power: string): string {
  return `${club}_${shotType}_${power}`;
}

export function parsePracticeConfigKey(key: string): { club: string; shotType: string; power: string } {
  const [club, shotType, power] = key.split('_');
  return { club, shotType, power };
}

// Get display name for a config key
export function getConfigDisplayName(key: string): string {
  const { club, shotType, power } = parsePracticeConfigKey(key);
  const clubName = PRACTICE_CLUBS.find(c => c.id === club)?.name || club;
  const shotName = SHOT_TYPES.find(s => s.id === shotType)?.name || shotType;
  const powerName = POWER_OPTIONS.find(p => p.id === power)?.name || power;
  return `${clubName} - ${shotName} - ${powerName}`;
}
