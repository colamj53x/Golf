import { describe, expect, it } from 'vitest';
import { pctWithinTarget } from '@/lib/practiceConsistency';

const shots = [
  { metrics: { total: 154 } },
  { metrics: { total: 160 } },
];

describe('pctWithinTarget', () => {
  it('uses the requested tolerance around the target band', () => {
    expect(pctWithinTarget('total_distance', shots, 145, 150)).toBe(50);
    expect(pctWithinTarget('total_distance', shots, 145, 150, 10)).toBe(100);
  });
});
