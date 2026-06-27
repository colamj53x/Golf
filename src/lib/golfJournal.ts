import type { JournalCategoryKey, JournalEntry, JournalEntryDraft } from '@/types/golf';

export const JOURNAL_CATEGORIES: Array<{ key: JournalCategoryKey; label: string }> = [
  { key: 'driving', label: 'Driving' },
  { key: 'irons', label: 'Irons' },
  { key: 'hybrids', label: 'Hybrids' },
  { key: 'approach', label: 'Approach' },
  { key: 'shortGame', label: 'Short game' },
  { key: 'putting', label: 'Putting' },
  { key: 'mental', label: 'Mental' },
  { key: 'courseManagement', label: 'Course management' },
];

export const ROUND_TYPES = ['Competition', 'Social', 'Practice', 'Solo', '9 holes', '18 holes'];

export function createEmptyJournalEntryDraft(date = new Date().toISOString().slice(0, 10)): JournalEntryDraft {
  return {
    roundReviewId: null,
    date,
    courseName: '',
    roundType: 'Social',
    playingPartnerIds: [],
    weatherConditions: '',
    generalContext: '',
    oneLineStory: '',
    overallComments: '',
    overallFeelRating: null,
    feelReason: '',
    bestThingToday: '',
    biggestFrustration: '',
    mainLearning: '',
    focusForNextRound: '',
    evidenceMatch: null,
    evidenceMatchReason: '',
    categories: Object.fromEntries(JOURNAL_CATEGORIES.map(({ key }) => [key, {
      feelRating: null,
      whatHappened: '',
      likelyCause: '',
      tryNextTime: '',
      generalNotes: '',
    }])) as JournalEntryDraft['categories'],
  };
}

export function normalizeJournalEntryDraft(value: Partial<JournalEntryDraft>): JournalEntryDraft {
  const empty = createEmptyJournalEntryDraft();
  return {
    ...empty,
    ...value,
    roundReviewId: typeof value.roundReviewId === 'string' && value.roundReviewId ? value.roundReviewId : null,
    date: typeof value.date === 'string' && value.date ? value.date : empty.date,
    courseName: typeof value.courseName === 'string' ? value.courseName : '',
    roundType: typeof value.roundType === 'string' && value.roundType ? value.roundType : empty.roundType,
    playingPartnerIds: Array.isArray(value.playingPartnerIds) ? value.playingPartnerIds.filter((id): id is string => typeof id === 'string') : [],
    weatherConditions: typeof value.weatherConditions === 'string' ? value.weatherConditions : '',
    generalContext: typeof value.generalContext === 'string' ? value.generalContext : '',
    oneLineStory: typeof value.oneLineStory === 'string' ? value.oneLineStory : '',
    overallComments: typeof value.overallComments === 'string' ? value.overallComments : '',
    overallFeelRating: typeof value.overallFeelRating === 'number' ? value.overallFeelRating : null,
    feelReason: typeof value.feelReason === 'string' ? value.feelReason : '',
    bestThingToday: typeof value.bestThingToday === 'string' ? value.bestThingToday : '',
    biggestFrustration: typeof value.biggestFrustration === 'string' ? value.biggestFrustration : '',
    mainLearning: typeof value.mainLearning === 'string' ? value.mainLearning : '',
    focusForNextRound: typeof value.focusForNextRound === 'string' ? value.focusForNextRound : '',
    evidenceMatch: value.evidenceMatch === 'yes' || value.evidenceMatch === 'partly' || value.evidenceMatch === 'no' ? value.evidenceMatch : null,
    evidenceMatchReason: typeof value.evidenceMatchReason === 'string' ? value.evidenceMatchReason : '',
    categories: Object.fromEntries(JOURNAL_CATEGORIES.map(({ key }) => {
      const category = value.categories?.[key] ?? empty.categories[key];
      return [key, {
        feelRating: typeof category.feelRating === 'number' ? category.feelRating : null,
        whatHappened: typeof category.whatHappened === 'string' ? category.whatHappened : '',
        likelyCause: typeof category.likelyCause === 'string' ? category.likelyCause : '',
        tryNextTime: typeof category.tryNextTime === 'string' ? category.tryNextTime : '',
        generalNotes: typeof category.generalNotes === 'string' ? category.generalNotes : '',
      }];
    })) as JournalEntryDraft['categories'],
  };
}

export function hasJournalEntryContent(entry: JournalEntryDraft): boolean {
  return [
    entry.courseName,
    entry.weatherConditions,
    entry.generalContext,
    entry.oneLineStory,
    entry.overallComments,
    entry.feelReason,
    entry.bestThingToday,
    entry.biggestFrustration,
    entry.mainLearning,
    entry.focusForNextRound,
    entry.evidenceMatchReason,
    ...JOURNAL_CATEGORIES.flatMap(({ key }) => {
      const category = entry.categories[key];
      return [category.whatHappened, category.likelyCause, category.tryNextTime, category.generalNotes];
    }),
  ].some((field) => field.trim().length > 0) || entry.playingPartnerIds.length > 0 || entry.overallFeelRating !== null || entry.evidenceMatch !== null;
}

function lines(values: string[]): string {
  return values.filter((value) => value.trim().length > 0).join('\n');
}

function entryLabel(entry: JournalEntry): string {
  return `${entry.date}${entry.courseName ? ` at ${entry.courseName}` : ''}`;
}

function categoryNotes(entry: JournalEntry, key: JournalCategoryKey): string {
  const category = entry.categories[key];
  return lines([
    category.generalNotes,
    category.whatHappened,
    category.likelyCause,
    category.tryNextTime,
  ]);
}

export function buildLastFiveReflection(entries: JournalEntry[]): string {
  const latest = entries.slice(0, 5);
  if (latest.length === 0) return 'No journal entries are saved yet.';

  const source = latest.map((entry, index) => lines([
    `Round ${index + 1}: ${entryLabel(entry)}`,
    entry.oneLineStory && `Summary: ${entry.oneLineStory}`,
    entry.overallComments && `Overall: ${entry.overallComments}`,
    entry.overallFeelRating && `Feel: ${entry.overallFeelRating}/5${entry.feelReason ? ` - ${entry.feelReason}` : ''}`,
    entry.bestThingToday && `Best thing: ${entry.bestThingToday}`,
    entry.biggestFrustration && `Biggest cost: ${entry.biggestFrustration}`,
    entry.mainLearning && `Learning: ${entry.mainLearning}`,
    entry.focusForNextRound && `Practice priorities: ${entry.focusForNextRound}`,
    entry.evidenceMatch && `Evidence match: ${entry.evidenceMatch}${entry.evidenceMatchReason ? ` - ${entry.evidenceMatchReason}` : ''}`,
  ])).join('\n\n');

  const categoryBlocks = JOURNAL_CATEGORIES.map(({ key, label }) => {
    const notes = latest.map((entry) => categoryNotes(entry, key)).filter(Boolean);
    return `${label}\n${notes.length ? notes.slice(0, 5).join('\n\n') : 'No strong written pattern yet.'}`;
  }).join('\n\n');

  return lines([
    'Last 5 Rounds Reflection',
    '',
    'Overall story',
    `Across these ${latest.length} rounds, the journal story is being built from your written notes rather than scores. The strongest source comments are:\n${source}`,
    '',
    'Main repeated themes',
    repeatedThemes(latest),
    '',
    'Category-by-category reflection',
    categoryBlocks,
    '',
    'What seems to be improving',
    improvementText(latest),
    '',
    'What keeps holding you back',
    holdingBackText(latest),
    '',
    'Mental patterns',
    categoryPattern(latest, 'mental'),
    '',
    'Course management patterns',
    categoryPattern(latest, 'courseManagement'),
    '',
    'Practice priorities',
    practiceImplications(latest),
    '',
    'Next-round mindset',
    nextRoundMindset(latest),
    '',
    'Reflection questions',
    '- What did I keep noticing but not act on?\n- Where did commitment improve the shot even if the result was imperfect?\n- What is the one decision pattern I want to rehearse before the next round?',
    '',
    'Coach-style summary',
    `The useful theme is not whether one part of the game is broken. It is where your better golf appears, what conditions help it show up, and what choices make the round harder than it needs to be. Use the notes above as the working brief for the next round and the next practice block.`,
  ]);
}

export function buildCourseHistoryReflection(courseName: string, entries: JournalEntry[]): string {
  if (entries.length === 0) return 'No journal entries are saved for this course yet.';
  return lines([
    `Course History: ${courseName}`,
    '',
    'Course-specific themes',
    repeatedThemes(entries),
    '',
    'Best previous strategy',
    lines(entries.map((entry) => entry.bestThingToday || entry.focusForNextRound)).trim() || 'No clear strategy has been written yet.',
    '',
    'Repeated mistakes',
    lines(entries.map((entry) => entry.biggestFrustration)).trim() || 'No repeated mistakes are obvious from the notes yet.',
    '',
    'Mental notes',
    categoryPattern(entries, 'mental'),
    '',
    'Course management reminders',
    categoryPattern(entries, 'courseManagement'),
  ]);
}

export function buildPreRoundReflection(courseName: string, courseEntries: JournalEntry[], recentEntries: JournalEntry[]): string {
  const source = courseEntries.length > 0 ? courseEntries : recentEntries.slice(0, 5);
  if (source.length === 0) return 'Write a few journal entries first and this will become a short pre-round reminder.';
  return lines([
    `Before Next Round${courseName ? `: ${courseName}` : ''}`,
    '',
    `Last time${courseEntries.length ? ' at this course' : ' from recent notes'}: ${source[0]?.overallComments || source[0]?.generalContext || 'Your notes are still light, so keep the reminder simple.'}`,
    `Main reminder: ${source.find((entry) => entry.focusForNextRound)?.focusForNextRound || 'Choose a clear target and stay with it.'}`,
    `Mental cue: ${categoryPattern(source, 'mental').split('\n')[0] || 'Accept the miss and do not compound it.'}`,
    `Swing/shot cue: ${source.find((entry) => entry.mainLearning)?.mainLearning || 'Commit to the shot you chose.'}`,
    `Course management cue: ${categoryPattern(source, 'courseManagement').split('\n')[0] || 'Take the safer side when the decision is close.'}`,
    'One focus only: Make better decisions off the tee.',
  ]);
}

function repeatedThemes(entries: JournalEntry[]): string {
  const themes = entries.flatMap((entry) => [
    entry.overallComments,
    entry.biggestFrustration,
    entry.mainLearning,
    entry.focusForNextRound,
    entry.evidenceMatchReason,
  ]).filter((value) => value.trim().length > 0);
  return themes.length ? themes.slice(0, 10).map((theme) => `- ${theme}`).join('\n') : 'No repeated written themes are obvious yet.';
}

function improvementText(entries: JournalEntry[]): string {
  const values = entries.map((entry) => entry.bestThingToday).filter(Boolean);
  return values.length ? values.map((value) => `- ${value}`).join('\n') : 'The notes do not yet name a clear improvement. Add one “best thing today” after each round.';
}

function holdingBackText(entries: JournalEntry[]): string {
  const values = entries.map((entry) => entry.biggestFrustration).filter(Boolean);
  return values.length ? values.map((value) => `- ${value}`).join('\n') : 'No recurring blocker is clear yet.';
}

function categoryPattern(entries: JournalEntry[], key: JournalCategoryKey): string {
  const notes = entries.map((entry) => categoryNotes(entry, key)).filter(Boolean);
  return notes.length ? notes.slice(0, 6).map((note) => `- ${note.replace(/\n/g, ' ')}`).join('\n') : 'No clear pattern logged yet.';
}

function practiceImplications(entries: JournalEntry[]): string {
  const focus = entries.map((entry) => entry.focusForNextRound || entry.mainLearning).filter(Boolean);
  return focus.length ? focus.slice(0, 5).map((value) => `- ${value}`).join('\n') : 'Use the next entry to name one priority clearly enough that it can become a practice block.';
}

function nextRoundMindset(entries: JournalEntry[]): string {
  const latest = entries[0];
  return latest?.focusForNextRound || latest?.mainLearning || 'Start conservative, commit to the target, and avoid trying to fix a hole with one perfect shot.';
}
