export type ShotPickerLie = 'tee' | 'fairway' | 'roughRecovery';
export type ShotPickerSlope = 'flat' | 'uphill' | 'downhill';
export type ShotPickerFeet = 'level' | 'above' | 'below';
export type ShotPickerDirection = 'none' | 'left' | 'right';
export type ShotPickerDirectionAmount = 'small' | 'medium' | 'large';

export interface ShotPickerAdjustmentRule {
  clubDelta: number;
  direction: ShotPickerDirection;
  directionAmount: ShotPickerDirectionAmount;
}

export interface ShotPickerAdjustmentSettings {
  lie: Record<ShotPickerLie, ShotPickerAdjustmentRule>;
  slope: Record<ShotPickerSlope, ShotPickerAdjustmentRule>;
  feet: Record<ShotPickerFeet, ShotPickerAdjustmentRule>;
}

export const SHOT_PICKER_CLUB_DELTA_METRES = 10;

export const DEFAULT_SHOT_PICKER_ADJUSTMENTS: ShotPickerAdjustmentSettings = {
  lie: {
    tee: { clubDelta: 0, direction: 'none', directionAmount: 'small' },
    fairway: { clubDelta: 0, direction: 'none', directionAmount: 'small' },
    roughRecovery: { clubDelta: 1, direction: 'none', directionAmount: 'small' },
  },
  slope: {
    flat: { clubDelta: 0, direction: 'none', directionAmount: 'small' },
    uphill: { clubDelta: 1, direction: 'none', directionAmount: 'small' },
    downhill: { clubDelta: -1, direction: 'none', directionAmount: 'small' },
  },
  feet: {
    level: { clubDelta: 0, direction: 'none', directionAmount: 'small' },
    above: { clubDelta: 0, direction: 'right', directionAmount: 'medium' },
    below: { clubDelta: 0, direction: 'left', directionAmount: 'medium' },
  },
};

const lies: ShotPickerLie[] = ['tee', 'fairway', 'roughRecovery'];
const slopes: ShotPickerSlope[] = ['flat', 'uphill', 'downhill'];
const feet: ShotPickerFeet[] = ['level', 'above', 'below'];
const directions: ShotPickerDirection[] = ['none', 'left', 'right'];
const amounts: ShotPickerDirectionAmount[] = ['small', 'medium', 'large'];

function parseRule(value: unknown, fallback: ShotPickerAdjustmentRule): ShotPickerAdjustmentRule {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const candidate = value as Partial<ShotPickerAdjustmentRule>;
  return {
    clubDelta: typeof candidate.clubDelta === 'number' && Number.isFinite(candidate.clubDelta)
      ? Math.max(-3, Math.min(3, Math.round(candidate.clubDelta)))
      : fallback.clubDelta,
    direction: candidate.direction && directions.includes(candidate.direction) ? candidate.direction : fallback.direction,
    directionAmount: candidate.directionAmount && amounts.includes(candidate.directionAmount) ? candidate.directionAmount : fallback.directionAmount,
  };
}

function parseRuleGroup<K extends string>(
  value: unknown,
  fallback: Record<K, ShotPickerAdjustmentRule>,
  keys: K[],
): Record<K, ShotPickerAdjustmentRule> {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<Record<K, ShotPickerAdjustmentRule>>
    : {};
  return Object.fromEntries(keys.map((key) => [key, parseRule(source[key], fallback[key])])) as Record<K, ShotPickerAdjustmentRule>;
}

export function parseShotPickerAdjustments(value: unknown): ShotPickerAdjustmentSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ShotPickerAdjustmentSettings>
    : {};
  return {
    lie: parseRuleGroup(source.lie, DEFAULT_SHOT_PICKER_ADJUSTMENTS.lie, lies),
    slope: parseRuleGroup(source.slope, DEFAULT_SHOT_PICKER_ADJUSTMENTS.slope, slopes),
    feet: parseRuleGroup(source.feet, DEFAULT_SHOT_PICKER_ADJUSTMENTS.feet, feet),
  };
}

export function getClubAdjustmentLabel(clubDelta: number): string {
  if (clubDelta === 0) return 'No club adjustment';
  return clubDelta > 0 ? `Club +${clubDelta}` : `Club ${clubDelta}`;
}

export function getDirectionAdjustmentLabel(rule: ShotPickerAdjustmentRule): string {
  if (rule.direction === 'none') return 'Normal target';
  const amount = rule.directionAmount === 'small' ? 'slightly' : rule.directionAmount === 'medium' ? 'moderately' : 'well';
  return `Aim ${amount} ${rule.direction}`;
}
