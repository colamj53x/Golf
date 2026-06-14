import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildClubGappingRows, loadShotCategoryOverrides, SHOT_CATEGORY_OVERRIDES_KEY } from '@/lib/gapping';
import type { ShotProfile } from '@/lib/shotProfiles';
import type { Shot } from '@/types/golf';

const driverProfile: ShotProfile = {
  id: 'dr_full_full',
  clubId: 'dr',
  shotType: 'full',
  power: 'full',
  enabled: true,
  showInPractice: true,
  showOnCourse: true,
  targets: ['fairway'],
  technique: '',
  routine: '',
  targetTotal: null,
  targetCarry: null,
  targetSideLeft: null,
  targetSideRight: null,
  targetVariationPct: null,
  targetQualityCutoff: null,
  targetOverrides: {},
};

const driverShot: Shot = {
  id: 'shot-1',
  club: 'Driver',
  type: 'Driving',
  shotFamily: 'full',
  swingEffort: 'full',
  targetIntent: 'fairway',
  holeNumber: null,
  shotNumber: null,
  target: 245,
  total: 227,
  side: 4,
  shotQuality: '10 Handicap',
  date: new Date(2026, 4, 31),
  startLie: 'Tee',
  endLie: 'Fairway',
  strikeQuality: 'Flush',
  endDistanceFromTarget: 18,
  notes: '',
};

const shortProfile = (power: 'full' | '9pm'): ShotProfile => ({
  ...driverProfile,
  id: `sw_pitch_${power}`,
  clubId: 'sw',
  shotType: 'pitch',
  power,
  targets: ['green'],
});

const fullIronProfile = (power: 'full' | '9pm', enabled = true): ShotProfile => ({
  ...driverProfile,
  id: `6i_full_${power}`,
  clubId: '6i',
  shotType: 'full',
  power,
  enabled,
  showInPractice: enabled,
  showOnCourse: enabled,
  targets: ['green'],
});

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildClubGappingRows', () => {
  it('treats durable-cache null shot category overrides as an empty map', () => {
    stubLocalStorage({ [SHOT_CATEGORY_OVERRIDES_KEY]: 'null' });

    expect(loadShotCategoryOverrides()).toEqual({});
  });

  it('builds a tee gapping row from a normalized driver shot', () => {
    const rows = buildClubGappingRows({
      profiles: { [driverProfile.id]: driverProfile },
      shots: [driverShot],
      shotContext: 'tee',
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {},
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      target: 'fairway',
      displayTotal: 227,
      shotCount: 1,
      intentShotCount: 1,
      qualityCutoff: 10,
    });
    expect(rows[0].profile.id).toBe('dr_full_full');
  });

  it('uses the import-reviewed category before distance inference', () => {
    const pitchHalf = shortProfile('9pm');
    const pitchFull = shortProfile('full');
    const reviewedShot: Shot = {
      ...driverShot,
      id: 'reviewed-pitch',
      club: 'SW',
      type: 'Short',
      shotFamily: 'pitch',
      swingEffort: '9pm',
      targetIntent: 'green',
      target: 75,
      total: 62,
      startLie: 'Fairway',
      endLie: 'Green',
    };
    const rows = buildClubGappingRows({
      profiles: { [pitchHalf.id]: pitchHalf, [pitchFull.id]: pitchFull },
      shots: [reviewedShot],
      shotContext: 'fairway',
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {},
    });

    expect(rows.filter(row => row.shotCount > 0).map(row => row.profile.id)).toEqual(['sw_pitch_9pm']);
  });

  it('uses the saved per-shot override before the import-reviewed category', () => {
    const pitchHalf = shortProfile('9pm');
    const pitchFull = shortProfile('full');
    const reviewedShot: Shot = {
      ...driverShot,
      id: 'overridden-pitch',
      club: 'SW',
      type: 'Short',
      shotFamily: 'pitch',
      swingEffort: '9pm',
      targetIntent: 'green',
      target: 75,
      total: 62,
      startLie: 'Fairway',
      endLie: 'Green',
    };
    const rows = buildClubGappingRows({
      profiles: { [pitchHalf.id]: pitchHalf, [pitchFull.id]: pitchFull },
      shots: [reviewedShot],
      shotContext: 'fairway',
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {
        [reviewedShot.id]: { profileId: pitchFull.id, target: 'green' },
      },
    });

    expect(rows.filter(row => row.shotCount > 0).map(row => row.profile.id)).toEqual(['sw_pitch_full']);
  });

  it('uses distance-to-target classification rules before saved upload effort', () => {
    const full = fullIronProfile('full');
    const half = fullIronProfile('9pm', false);
    const shot: Shot = {
      ...driverShot,
      id: 'six-iron-half-rule',
      club: '6I',
      type: 'Approach',
      shotFamily: 'full',
      swingEffort: 'full',
      targetIntent: 'green',
      target: 110,
      total: 112,
      startLie: 'Fairway',
      endLie: 'Green',
    };
    const rows = buildClubGappingRows({
      profiles: { [full.id]: full, [half.id]: half },
      shots: [shot],
      shotContext: 'fairway',
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {},
      shotClassificationRules: {
        '6i_full': { fullMinTarget: 120 },
      },
    });

    expect(rows.filter(row => row.shotCount > 0).map(row => row.profile.id)).toEqual(['6i_full_9pm']);
  });

  it('keeps per-shot overrides above distance-to-target classification rules', () => {
    const full = fullIronProfile('full');
    const half = fullIronProfile('9pm', false);
    const shot: Shot = {
      ...driverShot,
      id: 'six-iron-manual-override',
      club: '6I',
      type: 'Approach',
      shotFamily: 'full',
      swingEffort: 'full',
      targetIntent: 'green',
      target: 110,
      total: 112,
      startLie: 'Fairway',
      endLie: 'Green',
    };
    const rows = buildClubGappingRows({
      profiles: { [full.id]: full, [half.id]: half },
      shots: [shot],
      shotContext: 'fairway',
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {
        [shot.id]: { profileId: full.id, target: 'green' },
      },
      shotClassificationRules: {
        '6i_full': { fullMinTarget: 120 },
      },
    });

    expect(rows.filter(row => row.shotCount > 0).map(row => row.profile.id)).toEqual(['6i_full_full']);
  });
});
