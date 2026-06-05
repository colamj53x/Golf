import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateShot, type ShotValidation } from '@/lib/errorHandler';

const validShot: ShotValidation = {
  club: 'DR',
  total: 220,
  target: 240,
  side: 4,
  date: new Date(Date.UTC(2026, 5, 6)),
  endDistanceFromTarget: 18,
};

describe('validateShot', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows a shot from the current local calendar day even when its UTC timestamp is ahead of now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T23:40:00Z'));

    expect(validateShot(validShot)).toBeNull();
  });

  it('still rejects a future local calendar day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T23:40:00Z'));

    expect(validateShot({ ...validShot, date: new Date(Date.UTC(2026, 5, 7)) })).toBe('Future dates are not allowed');
  });
});
