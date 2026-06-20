import { CLUB_CODE_MAP } from '@/types/golf';
import { POWER_OPTIONS, PRACTICE_CLUBS, SHOT_TYPES } from '@/types/practiceClubs';
import type { ProfileTarget, ShotProfileMap } from '@/lib/shotProfiles';

export type SelectOption = { value: string; label: string };

export const TARGET_INTENT_OPTIONS: SelectOption[] = [
  { value: 'fairway', label: 'Fairway' },
  { value: 'green', label: 'Green' },
];

export const START_LIE_OPTIONS: SelectOption[] = [
  { value: 'Tee', label: 'Tee' },
  { value: 'Fairway', label: 'Fairway' },
  { value: 'Rough', label: 'Rough' },
  { value: 'Recovery', label: 'Recovery' },
  { value: 'Sand', label: 'Sand' },
  { value: 'Green', label: 'Green' },
];

export const END_LIE_OPTIONS: SelectOption[] = [
  { value: 'Fairway', label: 'Fairway' },
  { value: 'Rough', label: 'Rough' },
  { value: 'Recovery', label: 'Recovery' },
  { value: 'Sand', label: 'Sand' },
  { value: 'Green', label: 'Green' },
  { value: 'Fringe', label: 'Fringe' },
  { value: 'Hole', label: 'Hole' },
  { value: 'Penalty', label: 'Penalty' },
  { value: 'Water', label: 'Water' },
  { value: 'OB', label: 'OB' },
];

export const SHOT_FAMILY_OPTIONS: SelectOption[] = SHOT_TYPES.map((shot) => ({
  value: shot.id,
  label: shot.name,
}));

export const SWING_EFFORT_OPTIONS: SelectOption[] = POWER_OPTIONS.map((power) => ({
  value: power.id,
  label: power.name,
}));

export const CLUB_OPTIONS: SelectOption[] = PRACTICE_CLUBS.map((club) => ({
  value: practiceClubIdToRoundClub(club.id),
  label: club.name,
}));

const SHOT_ORDER = new Map(SHOT_TYPES.map((shot, index) => [shot.id, index]));
const POWER_ORDER = new Map(POWER_OPTIONS.map((power, index) => [power.id, index]));
const TARGET_ORDER = new Map<ProfileTarget, number>([['fairway', 0], ['green', 1]]);

export function practiceClubIdToRoundClub(clubId: string): string {
  if (clubId === 'dr') return 'Dr';
  if (/^\d+[a-z]$/i.test(clubId)) return clubId.toUpperCase();
  return clubId.toUpperCase();
}

export function roundClubToPracticeClubId(club: string): string {
  return (CLUB_CODE_MAP[club] ?? CLUB_CODE_MAP[club.toUpperCase()] ?? club).toLowerCase();
}

export function getShotFamilyLabel(value: string): string {
  return SHOT_FAMILY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getSwingEffortLabel(value: string): string {
  return SWING_EFFORT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function getTargetIntentLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  return TARGET_INTENT_OPTIONS.find((option) => option.value === normalized)?.label ?? value;
}

export function getPredictedShotLabel(shotFamily: string, swingEffort: string): string {
  return `${getShotFamilyLabel(shotFamily)} · ${getSwingEffortLabel(swingEffort)}`;
}

export function ensureOption(options: SelectOption[], value: string, label = value): SelectOption[] {
  if (!value || options.some((option) => option.value === value)) return options;
  return [{ value, label }, ...options];
}

function enabledProfilesForClub(profiles: ShotProfileMap, club: string, mode: 'practice' | 'onCourse') {
  const clubId = roundClubToPracticeClubId(club);
  return Object.values(profiles).filter((profile) =>
    profile.clubId === clubId &&
    profile.enabled &&
    (mode === 'practice' ? profile.showInPractice : profile.showOnCourse)
  );
}

export function getEnabledShotFamilyOptions(
  profiles: ShotProfileMap,
  club: string,
  mode: 'practice' | 'onCourse' = 'onCourse',
): SelectOption[] {
  const ids = new Set(enabledProfilesForClub(profiles, club, mode).map((profile) => profile.shotType));
  return SHOT_FAMILY_OPTIONS
    .filter((option) => ids.has(option.value))
    .sort((a, b) => (SHOT_ORDER.get(a.value) ?? 999) - (SHOT_ORDER.get(b.value) ?? 999));
}

export function getEnabledSwingEffortOptions(
  profiles: ShotProfileMap,
  club: string,
  shotFamily: string,
  mode: 'practice' | 'onCourse' = 'onCourse',
): SelectOption[] {
  const ids = new Set(
    enabledProfilesForClub(profiles, club, mode)
      .filter((profile) => profile.shotType === shotFamily)
      .map((profile) => profile.power),
  );
  return SWING_EFFORT_OPTIONS
    .filter((option) => ids.has(option.value))
    .sort((a, b) => (POWER_ORDER.get(a.value) ?? 999) - (POWER_ORDER.get(b.value) ?? 999));
}

export function getEnabledTargetIntentOptions(
  profiles: ShotProfileMap,
  club: string,
  shotFamily: string,
  swingEffort: string,
  mode: 'practice' | 'onCourse' = 'onCourse',
): SelectOption[] {
  const targets = new Set<ProfileTarget>();
  for (const profile of enabledProfilesForClub(profiles, club, mode)) {
    if (profile.shotType !== shotFamily || profile.power !== swingEffort) continue;
    profile.targets.forEach((target) => targets.add(target));
  }
  return TARGET_INTENT_OPTIONS
    .filter((option): option is SelectOption & { value: ProfileTarget } => option.value === 'fairway' || option.value === 'green')
    .filter((option) => targets.has(option.value))
    .sort((a, b) => (TARGET_ORDER.get(a.value) ?? 999) - (TARGET_ORDER.get(b.value) ?? 999));
}
