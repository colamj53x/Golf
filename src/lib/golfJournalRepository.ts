import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { GeneratedJournalReflection, GeneratedReflectionType, JournalEntry, JournalEntryDraft } from '@/types/golf';
import { normalizeJournalEntryDraft } from '@/lib/golfJournal';

type JournalEntryRow = Database['public']['Tables']['journal_entries']['Row'];
type GeneratedReflectionRow = Database['public']['Tables']['generated_reflections']['Row'];

function parseEntry(row: JournalEntryRow): JournalEntry {
  const draft = normalizeJournalEntryDraft({
    roundReviewId: row.round_review_id,
    date: row.entry_date,
    courseName: row.course_name ?? '',
    roundType: row.round_type ?? '',
    playingPartnerIds: row.playing_partner_ids ?? [],
    weatherConditions: row.weather_conditions ?? '',
    generalContext: row.general_context ?? '',
    overallComments: row.overall_comments ?? '',
    overallFeelRating: row.overall_feel_rating,
    bestThingToday: row.best_thing_today ?? '',
    biggestFrustration: row.biggest_frustration ?? '',
    mainLearning: row.main_learning ?? '',
    focusForNextRound: row.focus_for_next_round ?? '',
    categories: row.categories as JournalEntryDraft['categories'],
  });
  return {
    id: row.id,
    ...draft,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseGeneratedReflection(row: GeneratedReflectionRow): GeneratedJournalReflection {
  return {
    id: row.id,
    type: row.reflection_type as GeneratedReflectionType,
    sourceJournalEntryIds: row.source_journal_entry_ids ?? [],
    courseName: row.course_name,
    generatedText: row.generated_text,
    createdAt: new Date(row.created_at),
  };
}

function entryPayload(userId: string, draft: JournalEntryDraft) {
  return {
    user_id: userId,
    round_review_id: draft.roundReviewId,
    entry_date: draft.date,
    course_name: draft.courseName.trim() || null,
    round_type: draft.roundType,
    playing_partner_ids: draft.playingPartnerIds,
    weather_conditions: draft.weatherConditions,
    general_context: draft.generalContext,
    overall_comments: draft.overallComments,
    overall_feel_rating: draft.overallFeelRating,
    best_thing_today: draft.bestThingToday,
    biggest_frustration: draft.biggestFrustration,
    main_learning: draft.mainLearning,
    focus_for_next_round: draft.focusForNextRound,
    categories: draft.categories as unknown as Json,
  };
}

export async function loadJournalEntries(userId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(parseEntry);
}

export async function upsertJournalEntry(userId: string, draft: JournalEntryDraft, entryId?: string): Promise<JournalEntry> {
  if (entryId) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(entryPayload(userId, draft))
      .eq('user_id', userId)
      .eq('id', entryId)
      .select('*')
      .single();

    if (error) throw error;
    return parseEntry(data);
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert(entryPayload(userId, draft))
    .select('*')
    .single();

  if (error) throw error;
  return parseEntry(data);
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', entryId);

  if (error) throw error;
}

export async function loadGeneratedJournalReflections(userId: string): Promise<GeneratedJournalReflection[]> {
  const { data, error } = await supabase
    .from('generated_reflections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(parseGeneratedReflection);
}

export async function saveGeneratedJournalReflection(
  userId: string,
  input: {
    type: GeneratedReflectionType;
    sourceJournalEntryIds: string[];
    courseName?: string | null;
    generatedText: string;
  },
): Promise<GeneratedJournalReflection> {
  const { data, error } = await supabase
    .from('generated_reflections')
    .insert({
      user_id: userId,
      reflection_type: input.type,
      source_journal_entry_ids: input.sourceJournalEntryIds,
      course_name: input.courseName ?? null,
      generated_text: input.generatedText,
    })
    .select('*')
    .single();

  if (error) throw error;
  return parseGeneratedReflection(data);
}
