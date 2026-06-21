import { describe, expect, it } from 'vitest';
import { DEFAULT_CLUB_CONFIGS, type Shot } from '@/types/golf';
import { buildJournalRoundEvidence } from './journalRoundEvidence';
import { buildRoundReview } from './roundReview';

function shot(id: string, overrides: Partial<Shot>): Shot {
  return {
    id,
    club: 'Dr',
    type: 'Driving',
    shotFamily: 'full',
    swingEffort: 'full',
    targetIntent: 'fairway',
    holeNumber: null,
    shotNumber: null,
    target: 220,
    total: 220,
    side: 0,
    shotQuality: '10 Handicap',
    date: new Date('2026-06-21T10:00:00'),
    startLie: 'Tee',
    endLie: 'Fairway',
    strikeQuality: 'Centre',
    endDistanceFromTarget: 5,
    notes: '',
    ...overrides,
  };
}

describe('buildJournalRoundEvidence', () => {
  it('maps the linked round into relevant category evidence', () => {
    const review = buildRoundReview([
      shot('driver-hit', {}),
      shot('driver-miss', { endLie: 'Rough', side: 35 }),
      shot('iron', {
        club: '7I',
        type: 'Approach',
        targetIntent: 'green',
        target: 145,
        total: 140,
        startLie: 'Fairway',
        endLie: 'Green',
      }),
      shot('wedge', {
        club: 'SW',
        type: 'Short',
        targetIntent: 'green',
        target: 60,
        total: 55,
        startLie: 'Fairway',
        endLie: 'Green',
      }),
    ], DEFAULT_CLUB_CONFIGS, 10, '2026-06-21');

    const evidence = buildJournalRoundEvidence(review, 0);

    expect(evidence.driving?.metrics).toEqual(expect.arrayContaining([
      { label: 'Shots', value: '2' },
      { label: 'Fairways', value: '1/2' },
    ]));
    expect(evidence.irons?.metrics).toContainEqual({ label: 'Shots', value: '1' });
    expect(evidence.approach?.metrics).toContainEqual({ label: 'Greens', value: '1/1' });
    expect(evidence.shortGame?.metrics).toContainEqual({ label: 'Scoring zone', value: '1/1' });
    expect(evidence.putting?.metrics).toHaveLength(0);
    expect(evidence.mental?.note).toContain('cannot measure mindset');
  });

  it('returns no category strips for a standalone journal entry', () => {
    expect(buildJournalRoundEvidence(null)).toEqual({});
  });
});
