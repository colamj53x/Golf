import { describe, expect, it } from 'vitest';
import { buildAnalysisModel, calculateShotDamage, describeHandicapEquivalent, reflectionConfidence, shotConfidence, shotQualityScore } from '@/lib/analysisSynthesis';
import { DEFAULT_CLUB_CONFIGS, type RoundReflection, type Shot } from '@/types/golf';

function shot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: crypto.randomUUID(),
    club: 'Dr',
    type: 'round',
    shotFamily: 'full',
    swingEffort: 'full',
    targetIntent: 'fairway',
    holeNumber: null,
    shotNumber: null,
    target: 220,
    total: 220,
    side: 0,
    shotQuality: '15 Handicap',
    date: new Date('2026-05-31T10:00:00'),
    startLie: 'Tee',
    endLie: 'Fairway',
    strikeQuality: '',
    endDistanceFromTarget: 0,
    notes: '',
    ...overrides,
  };
}

function reflection(overrides: Partial<RoundReflection> = {}): RoundReflection {
  return {
    id: crypto.randomUUID(),
    roundDate: '2026-05-31',
    generalComments: '',
    drivingNotes: '',
    ironsNotes: '',
    shortNotes: '',
    puttingNotes: '',
    mentalNotes: '',
    courseManagementNotes: '',
    playingPartnerIds: [],
    createdAt: new Date('2026-05-31'),
    updatedAt: new Date('2026-05-31'),
    ...overrides,
  };
}

describe('analysis synthesis', () => {
  it('maps shot quality labels onto the coaching index', () => {
    expect(shotQualityScore('Pro')).toBe(100);
    expect(shotQualityScore('15 Handicap')).toBe(60);
    expect(shotQualityScore('unknown')).toBeNull();
    expect(describeHandicapEquivalent(65)).toBe('~13 handicap quality');
  });

  it('uses guarded confidence thresholds', () => {
    expect(shotConfidence(7)).toBe('none');
    expect(shotConfidence(8)).toBe('low');
    expect(shotConfidence(15)).toBe('medium');
    expect(shotConfidence(30)).toBe('high');
    expect(reflectionConfidence(1)).toBe('low');
    expect(reflectionConfidence(4)).toBe('high');
  });

  it('treats penalties as more damaging than playable rough', () => {
    expect(calculateShotDamage(shot({ endLie: 'Penalty' }))).toBe(2);
    expect(calculateShotDamage(shot({ endLie: 'Rough' }))).toBe(0.25);
    expect(calculateShotDamage(shot({ endLie: 'Fairway' }))).toBe(0);
  });

  it('surfaces recurring reflection themes', () => {
    const model = buildAnalysisModel({
      shots: [],
      clubs: DEFAULT_CLUB_CONFIGS,
      practiceSessions: [],
      roundReflections: [
        reflection({ mentalNotes: 'Rushed on the back nine' }),
        reflection({ drivingNotes: 'Tempo was rushed again' }),
      ],
    });

    expect(model.reflectionThemes[0]).toMatchObject({
      id: 'rushed',
      count: 2,
      confidence: 'medium',
    });
  });

  it('ranks damaging driver misses as a club priority', () => {
    const driverShots = Array.from({ length: 10 }, (_, index) => shot({
      id: `driver-${index}`,
      side: 28,
      endLie: 'Trees / recovery',
      notes: 'slice',
    }));
    const wedgeShots = Array.from({ length: 10 }, (_, index) => shot({
      id: `wedge-${index}`,
      club: 'PW',
      target: 115,
      total: 115,
      shotQuality: '5 Handicap',
    }));
    const model = buildAnalysisModel({
      shots: [...driverShots, ...wedgeShots],
      clubs: DEFAULT_CLUB_CONFIGS,
      practiceSessions: [],
      roundReflections: [],
    });

    expect(model.priorities[0].clubName).toBe('Driver');
    expect(model.priorities[0].direction).toBe('Right');
    expect(model.reliableClubs[0].clubName).toBe('PW');
  });

  it('summarises SQI by round timeline and round quality', () => {
    const roundQualities = [
      '20 Handicap',
      '15 Handicap',
      '10 Handicap',
      '5 Handicap',
      '0 Handicap',
      '10 Handicap',
      '15 Handicap',
      '5 Handicap',
    ];
    const shots = roundQualities.map((shotQuality, index) => shot({
      id: `round-${index}`,
      shotQuality,
      date: new Date(`2026-05-${String(index + 1).padStart(2, '0')}T10:00:00`),
    }));
    const model = buildAnalysisModel({
      shots,
      clubs: DEFAULT_CLUB_CONFIGS,
      practiceSessions: [],
      roundReflections: [],
    });

    expect(model.chronologicalSqi.map((segment) => segment.sqi)).toEqual([53, 78, 70]);
    expect(model.chronologicalSqi.map((segment) => segment.rounds)).toEqual([2, 4, 2]);
    expect(model.qualitySqi.map((segment) => segment.sqi)).toEqual([53, 70, 85]);
    expect(model.qualitySqi.map((segment) => segment.rounds)).toEqual([2, 4, 2]);
  });

  it('keeps all-time costly miss and damage baselines beside a clean recent sample', () => {
    const recent = shot({
      id: 'recent',
      date: new Date('2026-05-31T10:00:00'),
      endLie: 'Fairway',
    });
    const oldPenalty = shot({
      id: 'old-penalty',
      date: new Date('2026-05-01T10:00:00'),
      endLie: 'Penalty',
    });
    const model = buildAnalysisModel({
      shots: [recent],
      baselineShots: [recent, oldPenalty],
      clubs: DEFAULT_CLUB_CONFIGS,
      practiceSessions: [],
      roundReflections: [],
    });

    expect(model.badMissPct).toBe(0);
    expect(model.baselineBadMissPct).toBe(50);
    expect(model.damagePerRound).toBe(0);
    expect(model.baselineDamagePerRound).toBe(1);
  });
});
