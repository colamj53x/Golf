import type { JournalEntry } from '@/types/golf';
import type { RoundThoughts } from '@/lib/roundReviewInsights';

const categoryText = (entry: JournalEntry, key: keyof JournalEntry['categories']): string => {
  const category = entry.categories[key];
  return [category.whatHappened, category.likelyCause, category.tryNextTime, category.generalNotes]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
};

export function journalEntryRoundKey(entry: JournalEntry): string {
  return entry.roundReviewId?.trim() || entry.date;
}

export function journalEntriesForRounds(entries: JournalEntry[], roundKeys: string[]): JournalEntry[] {
  const roundOrder = new Map(roundKeys.map((key, index) => [key, index]));
  return entries
    .filter((entry) => roundOrder.has(journalEntryRoundKey(entry)))
    .sort((a, b) => {
      const roundDifference = (roundOrder.get(journalEntryRoundKey(a)) ?? Number.MAX_SAFE_INTEGER)
        - (roundOrder.get(journalEntryRoundKey(b)) ?? Number.MAX_SAFE_INTEGER);
      return roundDifference || b.updatedAt.getTime() - a.updatedAt.getTime();
    });
}

export function journalEntriesToRoundThoughts(entries: JournalEntry[], fallback?: RoundThoughts): RoundThoughts | undefined {
  if (entries.length === 0) return fallback;

  const join = (values: string[]) => values.map((value) => value.trim()).filter(Boolean).join('\n\n');
  const generalComments = join(entries.flatMap((entry) => [
    entry.oneLineStory,
    entry.overallComments,
    entry.generalContext,
    entry.feelReason,
    entry.bestThingToday,
    entry.biggestFrustration,
    entry.mainLearning,
    entry.focusForNextRound,
    entry.evidenceMatchReason,
  ]));

  const merged: RoundThoughts = {
    generalComments,
    drivingNotes: join(entries.map((entry) => categoryText(entry, 'driving'))),
    ironsNotes: join(entries.flatMap((entry) => [categoryText(entry, 'irons'), categoryText(entry, 'hybrids'), categoryText(entry, 'approach')])),
    shortNotes: join(entries.map((entry) => categoryText(entry, 'shortGame'))),
    puttingNotes: join(entries.map((entry) => categoryText(entry, 'putting'))),
    mentalNotes: join(entries.map((entry) => categoryText(entry, 'mental'))),
    courseManagementNotes: join(entries.map((entry) => categoryText(entry, 'courseManagement'))),
    playingPartnerIds: [...new Set(entries.flatMap((entry) => entry.playingPartnerIds))],
  };

  if (!fallback) return merged;
  return {
    generalComments: join([merged.generalComments, fallback.generalComments]),
    drivingNotes: join([merged.drivingNotes, fallback.drivingNotes]),
    ironsNotes: join([merged.ironsNotes, fallback.ironsNotes]),
    shortNotes: join([merged.shortNotes, fallback.shortNotes]),
    puttingNotes: join([merged.puttingNotes, fallback.puttingNotes]),
    mentalNotes: join([merged.mentalNotes, fallback.mentalNotes]),
    courseManagementNotes: join([merged.courseManagementNotes, fallback.courseManagementNotes]),
    playingPartnerIds: [...new Set([...(merged.playingPartnerIds ?? []), ...(fallback.playingPartnerIds ?? [])])],
  };
}
