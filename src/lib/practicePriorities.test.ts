import { describe, expect, it } from 'vitest';
import { buildCapabilityIndex, buildDistancePriorities, buildPracticePriorities } from '@/lib/practicePriorities';
import type { ShotProfile } from '@/lib/shotProfiles';
import type { Shot } from '@/types/golf';

function profile(id: string, clubId: string, targets: Array<'green' | 'fairway'>): ShotProfile {
  return {
    id,
    clubId,
    shotType: 'full',
    power: 'full',
    enabled: true,
    showInPractice: true,
    showOnCourse: true,
    targets,
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
}

function shot(overrides: Partial<Shot>): Shot {
  return {
    id: crypto.randomUUID(),
    club: 'Driver',
    type: 'Driving',
    shotFamily: 'full',
    swingEffort: 'full',
    targetIntent: 'fairway',
    holeNumber: null,
    shotNumber: null,
    target: 230,
    total: 220,
    side: 10,
    shotQuality: '15 Handicap',
    date: new Date('2026-05-31T10:00:00'),
    startLie: 'Tee',
    endLie: 'Rough',
    strikeQuality: '',
    endDistanceFromTarget: 10,
    notes: '',
    ...overrides,
  };
}

describe('practice priorities', () => {
  it('ranks frequent scoring impact above a rare but poor club', () => {
    const dates = ['2026-05-28', '2026-05-29', '2026-05-30', '2026-05-31'];
    const driverShots = dates.flatMap((date, roundIndex) => Array.from({ length: 8 }, (_, shotIndex) => shot({
      id: `driver-${roundIndex}-${shotIndex}`,
      date: new Date(`${date}T10:00:00`),
      endLie: shotIndex % 4 === 0 ? 'Trees / recovery' : 'Fairway',
      shotQuality: '15 Handicap',
    })));
    const woodShots = dates.slice(0, 2).map((date, index) => shot({
      id: `wood-${index}`,
      club: '5W',
      type: 'Approach',
      date: new Date(`${date}T11:00:00`),
      startLie: 'Fairway',
      endLie: 'Trees / recovery',
      shotQuality: '25 Handicap',
    }));
    const priorities = buildPracticePriorities({
      shots: [...driverShots, ...woodShots],
      profiles: {
        dr_full_full: profile('dr_full_full', 'dr', ['fairway']),
        '5w_full_full': profile('5w_full_full', '5w', ['green', 'fairway']),
      },
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {},
    });

    expect(priorities[0]).toMatchObject({
      configKey: 'dr_full_full',
      reliancePerRound: 8,
    });
    expect(priorities.find((priority) => priority.configKey === '5w_full_full')?.reliancePerRound).toBe(0.5);
  });

  it('ranks distance bands and names the club and shot option to practise', () => {
    const shots = [
      ...Array.from({ length: 6 }, (_, index) => shot({
        id: `pw-${index}`,
        club: 'PW',
        type: 'Approach',
        targetIntent: 'green',
        target: 95,
        total: 70,
        startLie: 'Fairway',
        endLie: 'Trees / recovery',
        shotQuality: '25 Handicap',
      })),
      shot({
        id: 'gw-good',
        club: 'GW',
        type: 'Approach',
        targetIntent: 'green',
        target: 75,
        total: 75,
        startLie: 'Fairway',
        endLie: 'Green',
        shotQuality: '5 Handicap',
      }),
    ];
    const priorities = buildDistancePriorities({
      shots,
      profiles: {
        pw_full_full: profile('pw_full_full', 'pw', ['green']),
        gw_full_full: profile('gw_full_full', 'gw', ['green']),
      },
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {},
    });

    expect(priorities[0]).toMatchObject({
      distanceKey: '90-100',
      distanceLabel: '90–100m',
    });
    expect(priorities[0].topClubShot).toContain('Pitching Wedge');
    expect(priorities[0].recommendation).toContain('90–100m');
  });

  it('builds capability from the top two shots per club and shot option', () => {
    const shots = [
      shot({ id: 'driver-best', shotQuality: 'Pro' }),
      shot({ id: 'driver-second', shotQuality: '0 Handicap' }),
      shot({ id: 'driver-worst', shotQuality: '25 Handicap' }),
      shot({ id: 'wedge-best', club: 'PW', type: 'Approach', targetIntent: 'green', startLie: 'Fairway', shotQuality: '15 Handicap' }),
      shot({ id: 'wedge-second', club: 'PW', type: 'Approach', targetIntent: 'green', startLie: 'Fairway', shotQuality: '20 Handicap' }),
    ];
    const capability = buildCapabilityIndex({
      shots,
      profiles: {
        dr_full_full: profile('dr_full_full', 'dr', ['fairway']),
        pw_full_full: profile('pw_full_full', 'pw', ['green']),
      },
      practiceSessions: [],
      practiceConfigs: [],
      shotsBySession: {},
      gappingHcpTarget: 10,
      shotCategoryOverrides: {},
    });

    expect(capability.score).toBe(74);
    expect(capability.optionCount).toBe(2);
    expect(capability.shotCount).toBe(4);
    expect(capability.weakestOption).toMatchObject({
      clubShot: 'Pitching Wedge · Full',
      score: 53,
    });
  });
});
