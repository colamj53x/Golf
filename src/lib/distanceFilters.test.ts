import { describe, expect, it } from 'vitest';
import { DISTANCE_FILTER_OPTIONS, filterShotsByTargetDistance } from './distanceFilters';

describe('distance filters', () => {
  const shots = [
    { id: 'putt-range', target: 4 },
    { id: 'chip-range', target: 14 },
    { id: 'pitch-range', target: 84 },
  ];

  it('includes a detailed band for shots inside 10 metres', () => {
    expect(DISTANCE_FILTER_OPTIONS).toContainEqual({
      label: '0-9m',
      value: '0-9',
      minDistance: 0,
      maxDistance: 9,
    });
    expect(filterShotsByTargetDistance(shots, '0-9')).toEqual([shots[0]]);
  });

  it('keeps inside-10-metre shots in the Within 100m summary', () => {
    expect(filterShotsByTargetDistance(shots, '0-100')).toEqual(shots);
  });
});
