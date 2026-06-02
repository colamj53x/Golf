import { describe, expect, it } from 'vitest';
import { decodeRoundShotSequence, encodeRoundShotSequence } from './roundShotSequence';

describe('roundShotSequence', () => {
  it('preserves hole and shot order without exposing the internal marker in notes', () => {
    const storedNotes = encodeRoundShotSequence('#pull#low', 10, 2);

    expect(storedNotes).toBe('#pull#low [[golf-sequence:10:2]]');
    expect(decodeRoundShotSequence(storedNotes)).toEqual({
      notes: '#pull#low',
      holeNumber: 10,
      shotNumber: 2,
    });
  });

  it('leaves ordinary notes unchanged when sequence is unavailable', () => {
    expect(decodeRoundShotSequence('ordinary note')).toEqual({
      notes: 'ordinary note',
      holeNumber: null,
      shotNumber: null,
    });
  });
});
