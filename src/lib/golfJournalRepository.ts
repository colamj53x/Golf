import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { GeneratedJournalReflection, GeneratedReflectionType, JournalEntry, JournalEntryDraft } from '@/types/golf';
import { normalizeJournalEntryDraft } from '@/lib/golfJournal';

type JournalEntryRow = Database['public']['Tables']['journal_entries']['Row'];
type GeneratedReflectionRow = Database['public']['Tables']['generated_reflections']['Row'];
type PracticeConfigRow = Database['public']['Tables']['practice_configs']['Row'];

const JOURNAL_ENTRY_CONFIG_PREFIX = 'journal_entry:';
const GENERATED_REFLECTION_CONFIG_PREFIX = 'journal_generated:';
const FALLBACK_ID_PREFIX = 'fallback:';

function isMissingJournalTableError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === 'PGRST204' || error?.code === '42P01' || error?.code === '42703';
}

function isFallbackId(id: string): boolean {
  return id.startsWith(FALLBACK_ID_PREFIX);
}

function fallbackRowId(id: string): string {
  return id.slice(FALLBACK_ID_PREFIX.length);
}

function parseEntry(row: JournalEntryRow): JournalEntry {
  const draft = normalizeJournalEntryDraft({
    roundReviewId: row.round_review_id,
    date: row.entry_date,
    courseName: row.course_name ?? '',
    roundType: row.round_type ?? '',
    playingPartnerIds: row.playing_partner_ids ?? [],
    weatherConditions: row.weather_conditions ?? '',
    generalContext: row.general_context ?? '',
    oneLineStory: row.one_line_story ?? '',
    overallComments: row.overall_comments ?? '',
    overallFeelRating: row.overall_feel_rating,
    feelReason: row.feel_reason ?? '',
    bestThingToday: row.best_thing_today ?? '',
    biggestFrustration: row.biggest_frustration ?? '',
    mainLearning: row.main_learning ?? '',
    focusForNextRound: row.focus_for_next_round ?? '',
    evidenceMatch: row.evidence_match,
    evidenceMatchReason: row.evidence_match_reason ?? '',
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

function parseFallbackEntry(row: Pick<PracticeConfigRow, 'id' | 'config_key' | 'metrics' | 'created_at' | 'updated_at'>): JournalEntry {
  const metrics = row.metrics && typeof row.metrics === 'object' && !Array.isArray(row.metrics)
    ? row.metrics as Partial<JournalEntryDraft>
    : {};
  const dateFromKey = row.config_key.split(':')[1];
  const draft = normalizeJournalEntryDraft({
    ...metrics,
    date: typeof metrics.date === 'string' && metrics.date ? metrics.date : dateFromKey,
  });
  return {
    id: `${FALLBACK_ID_PREFIX}${row.id}`,
    ...draft,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseFallbackGeneratedReflection(row: Pick<PracticeConfigRow, 'id' | 'metrics' | 'created_at'>): GeneratedJournalReflection {
  const metrics = row.metrics && typeof row.metrics === 'object' && !Array.isArray(row.metrics)
    ? row.metrics as Partial<GeneratedJournalReflection>
    : {};
  return {
    id: `${FALLBACK_ID_PREFIX}${row.id}`,
    type: metrics.type === 'course' || metrics.type === 'preRound' ? metrics.type : 'last5',
    sourceJournalEntryIds: Array.isArray(metrics.sourceJournalEntryIds)
      ? metrics.sourceJournalEntryIds.filter((id): id is string => typeof id === 'string')
      : [],
    courseName: typeof metrics.courseName === 'string' ? metrics.courseName : null,
    generatedText: typeof metrics.generatedText === 'string' ? metrics.generatedText : '',
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
    one_line_story: draft.oneLineStory,
    overall_comments: draft.overallComments,
    overall_feel_rating: draft.overallFeelRating,
    feel_reason: draft.feelReason,
    best_thing_today: draft.bestThingToday,
    biggest_frustration: draft.biggestFrustration,
    main_learning: draft.mainLearning,
    focus_for_next_round: draft.focusForNextRound,
    evidence_match: draft.evidenceMatch,
    evidence_match_reason: draft.evidenceMatchReason,
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

  if (isMissingJournalTableError(error)) {
    return loadFallbackJournalEntries(userId);
  }
  if (error) throw error;

  const fallbackEntries = await loadFallbackJournalEntries(userId);
  return [...(data ?? []).map(parseEntry), ...fallbackEntries]
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime());
}

export async function upsertJournalEntry(userId: string, draft: JournalEntryDraft, entryId?: string): Promise<JournalEntry> {
  if (entryId && isFallbackId(entryId)) {
    return upsertFallbackJournalEntry(userId, draft, entryId);
  }

  if (entryId) {
    const { data, error } = await supabase
      .from('journal_entries')
      .update(entryPayload(userId, draft))
      .eq('user_id', userId)
      .eq('id', entryId)
      .select('*')
      .single();

    if (isMissingJournalTableError(error) || error?.code === 'PGRST116') {
      return upsertFallbackJournalEntry(userId, draft, entryId);
    }
    if (error) throw error;
    return parseEntry(data);
  }

  const { data, error } = await supabase
    .from('journal_entries')
    .insert(entryPayload(userId, draft))
    .select('*')
    .single();

  if (isMissingJournalTableError(error)) {
    return upsertFallbackJournalEntry(userId, draft);
  }
  if (error) throw error;
  return parseEntry(data);
}

export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (isFallbackId(entryId)) {
    return deleteFallbackJournalEntry(userId, entryId);
  }

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .eq('id', entryId);

  if (isMissingJournalTableError(error)) {
    return deleteFallbackJournalEntry(userId, entryId);
  }
  if (error) throw error;
}

export async function loadGeneratedJournalReflections(userId: string): Promise<GeneratedJournalReflection[]> {
  const { data, error } = await supabase
    .from('generated_reflections')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (isMissingJournalTableError(error)) {
    return loadFallbackGeneratedJournalReflections(userId);
  }
  if (error) throw error;

  const fallbackGenerated = await loadFallbackGeneratedJournalReflections(userId);
  return [...(data ?? []).map(parseGeneratedReflection), ...fallbackGenerated]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

  if (isMissingJournalTableError(error)) {
    return saveFallbackGeneratedJournalReflection(userId, input);
  }
  if (error) throw error;
  return parseGeneratedReflection(data);
}

async function loadFallbackJournalEntries(userId: string): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('practice_configs')
    .select('id, config_key, metrics, created_at, updated_at')
    .eq('user_id', userId)
    .like('config_key', `${JOURNAL_ENTRY_CONFIG_PREFIX}%`)
    .order('config_key', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(parseFallbackEntry);
}

async function upsertFallbackJournalEntry(userId: string, draft: JournalEntryDraft, entryId?: string): Promise<JournalEntry> {
  const payload = {
    club: 'journal',
    shot_type: 'entry',
    power: 'v1',
    metrics: draft as unknown as Json,
    user_id: userId,
  };

  if (entryId && isFallbackId(entryId)) {
    const { data, error } = await supabase
      .from('practice_configs')
      .update(payload)
      .eq('user_id', userId)
      .eq('id', fallbackRowId(entryId))
      .select('id, config_key, metrics, created_at, updated_at')
      .single();

    if (error) throw error;
    return parseFallbackEntry(data);
  }

  const { data, error } = await supabase
    .from('practice_configs')
    .insert({
      ...payload,
      config_key: `${JOURNAL_ENTRY_CONFIG_PREFIX}${draft.date}:${crypto.randomUUID()}`,
    })
    .select('id, config_key, metrics, created_at, updated_at')
    .single();

  if (error) throw error;
  return parseFallbackEntry(data);
}

async function deleteFallbackJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!isFallbackId(entryId)) return;

  const { error } = await supabase
    .from('practice_configs')
    .delete()
    .eq('user_id', userId)
    .eq('id', fallbackRowId(entryId));

  if (error) throw error;
}

async function loadFallbackGeneratedJournalReflections(userId: string): Promise<GeneratedJournalReflection[]> {
  const { data, error } = await supabase
    .from('practice_configs')
    .select('id, metrics, created_at')
    .eq('user_id', userId)
    .like('config_key', `${GENERATED_REFLECTION_CONFIG_PREFIX}%`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(parseFallbackGeneratedReflection);
}

async function saveFallbackGeneratedJournalReflection(
  userId: string,
  input: {
    type: GeneratedReflectionType;
    sourceJournalEntryIds: string[];
    courseName?: string | null;
    generatedText: string;
  },
): Promise<GeneratedJournalReflection> {
  const { data, error } = await supabase
    .from('practice_configs')
    .insert({
      config_key: `${GENERATED_REFLECTION_CONFIG_PREFIX}${input.type}:${new Date().toISOString()}:${crypto.randomUUID()}`,
      club: 'journal',
      shot_type: 'generated-reflection',
      power: 'v1',
      metrics: {
        type: input.type,
        sourceJournalEntryIds: input.sourceJournalEntryIds,
        courseName: input.courseName ?? null,
        generatedText: input.generatedText,
      } as unknown as Json,
      user_id: userId,
    })
    .select('id, metrics, created_at')
    .single();

  if (error) throw error;
  return parseFallbackGeneratedReflection(data);
}
