import { describe, expect, it } from 'vitest';
import { normalizeClubCode } from '@/types/golf';

describe('normalizeClubCode', () => {
  it.each([
    ['DR', 'Dr'],
    ['Dr', 'Dr'],
    ['Driver', 'Dr'],
    ['7 Iron', '7I'],
    ['pw', 'PW'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeClubCode(input)).toBe(expected);
  });
});
