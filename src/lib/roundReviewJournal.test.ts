import { describe, expect, it } from 'vitest';
import { createEmptyJournalEntryDraft } from '@/lib/golfJournal';
import { journalEntriesForRounds, journalEntriesToRoundThoughts } from '@/lib/roundReviewJournal';
import type { JournalEntry } from '@/types/golf';

function entry(id: string, roundReviewId: string | null, date: string, story: string): JournalEntry {
  return {
    id,
    ...createEmptyJournalEntryDraft(date),
    roundReviewId,
    oneLineStory: story,
    createdAt: new Date(`${date}T08:00:00Z`),
    updatedAt: new Date(`${date}T09:00:00Z`),
  };
}

describe('round review journal aggregation', () => {
  it('selects and orders entries by the active round set', () => {
    const entries = [
      entry('older', '2026-06-21', '2026-06-21', 'Older round'),
      entry('latest', '2026-06-23', '2026-06-23', 'Latest round'),
      entry('outside', '2026-06-20', '2026-06-20', 'Outside round'),
    ];

    expect(journalEntriesForRounds(entries, ['2026-06-23', '2026-06-21']).map((item) => item.id))
      .toEqual(['latest', 'older']);
  });

  it('uses the entry date for older journal records without a linked round id', () => {
    expect(journalEntriesForRounds([entry('legacy', null, '2026-06-23', 'Legacy')], ['2026-06-23']))
      .toHaveLength(1);
  });

  it('converts journal fields and categories into round-story context', () => {
    const journalEntry = entry('round', '2026-06-23', '2026-06-23', 'Driver confidence improved');
    journalEntry.categories.shortGame.whatHappened = 'Pitching was sharp';

    const thoughts = journalEntriesToRoundThoughts([journalEntry]);

    expect(thoughts?.generalComments).toContain('Driver confidence improved');
    expect(thoughts?.shortNotes).toContain('Pitching was sharp');
  });
});
