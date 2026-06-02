import { describe, expect, it } from 'vitest';
import { calculateMetrics, parseCSV, processShot } from '@/lib/golfCalculations';
import { DEFAULT_CLUB_CONFIGS, type Shot } from '@/types/golf';

describe('parseCSV', () => {
  it('preserves the date and target distance from a reviewed upload row', () => {
    const csv = [
      'Date,Club,Type,Start Lie,End Lie,Strike Quality,Shot Quality,Target,End Distance from Target,Distance Hit,Dispersion',
      '31/05/2026,DR,Driving,Tee,Fairway,Flush,10 Handicap,245,18,227,4',
    ].join('\n');

    const result = parseCSV(csv);

    expect(result.warnings).toEqual([]);
    expect(result.shots).toHaveLength(1);
    expect(result.shots[0]).toMatchObject({
      club: 'DR',
      target: 245,
      total: 227,
      startLie: 'Tee',
      endLie: 'Fairway',
    });
    expect(result.shots[0].date.getFullYear()).toBe(2026);
    expect(result.shots[0].date.getMonth()).toBe(4);
    expect(result.shots[0].date.getDate()).toBe(31);
  });

  it('maps the ParGolf export distance-to-target column', () => {
    const csv = [
      'Golfer,Date,Course,Type,Round Par,Round Score,Hole,Hole Par,Hole Score,Hole Length,Hole Putts,Hole m of Putts Made,Shot,Distance to Target (m),Start Lie,Proximity (m),End Lie,Distance Traveled (m),Strokes Gained to a Pro,Quality,Club,Brand,Model,Rating,Slope,Tee Name,Tee Color,Tee Number,Hole Handicap,Wind Bearing,Wind Strength,Degrees Offline,Committed,Penalties,Shape,Trajectory,Club Type,Coach Tags,Elevation (m),Shot Quality,Category,',
      'Nic Cola, 2026-05-30 21:01:38 +0000, Albert Park Public Golf Course, Social, 35, 41, 10, 3, 4, 159, 2, 1.05, 1, 141.17, Tee, 25.83, Fairway, 116.16, -0.49, Heel, 5H, Ping, G440, 68.5, 110, Men, White, 0, 6, 258, 1.99, , 1, 0, , #pull#low, Hybrid, , , 10 Handicap, Approach,',
    ].join('\n');

    const result = parseCSV(csv);

    expect(result.warnings).toEqual([]);
    expect(result.shots[0]).toMatchObject({
      club: '5H',
      target: 141.17,
      endDistanceFromTarget: 25.83,
      total: 116.16,
    });
  });
});

describe('calculateMetrics', () => {
  it('calculates the shot quality index from rated shots', () => {
    const driver = DEFAULT_CLUB_CONFIGS.find((club) => club.id === 'dr');
    const baseShot: Shot = {
      id: 'driver-1',
      club: 'Dr',
      type: 'round',
      shotFamily: 'full',
      swingEffort: 'full',
      targetIntent: 'fairway',
      target: 220,
      total: 220,
      side: 0,
      shotQuality: '5 Handicap',
      date: new Date('2026-05-31T10:00:00'),
      startLie: 'Tee',
      endLie: 'Fairway',
      strikeQuality: 'Centre',
      endDistanceFromTarget: 0,
      notes: '',
    };
    const shots = [
      processShot(baseShot, driver),
      processShot({ ...baseShot, id: 'driver-2', shotQuality: '15 Handicap' }, driver),
    ];

    expect(calculateMetrics(shots, driver).shotQualityIndex).toBe(70);
  });
});
