import { describe, expect, it } from 'vitest';
import { buildClubGappingRows } from '@/lib/gapping';
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

describe('buildClubGappingRows', () => {
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
});
