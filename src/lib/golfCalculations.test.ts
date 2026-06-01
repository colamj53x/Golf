import { describe, expect, it } from 'vitest';
import { parseCSV } from '@/lib/golfCalculations';

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
});
