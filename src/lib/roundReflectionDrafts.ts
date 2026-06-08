import type { RoundReflectionDraft } from '@/components/RoundReflectionEditor';

export const ROUND_REFLECTION_DRAFT_STORAGE_KEY = 'golf-dashboard-round-reflection-draft';
export const ROUND_REFLECTION_LOCAL_SAVED_STORAGE_KEY = 'golf-round-reflections-local-saved';
const PENDING_UPLOAD_STORAGE_KEY = 'golf-pending-upload-review-draft';

export type StoredReflectionDraft = {
  userId: string;
  roundDate: string;
  value: RoundReflectionDraft;
  updatedAt?: string;
};

type StoredPendingUploadDraft = {
  userId: string;
  reflectionsByDate?: Record<string, RoundReflectionDraft>;
};

type StoredLocalSavedReflection = {
  value: RoundReflectionDraft;
  savedAt: string;
};

type StoredLocalDraftReflection = {
  value: RoundReflectionDraft;
  savedAt: string;
};

export const getRoundReflectionDraftStorageKey = (userId: string, roundDate: string) =>
  `${ROUND_REFLECTION_DRAFT_STORAGE_KEY}:${userId}:${roundDate}`;

export const getRoundReflectionLocalSavedStorageKey = (userId: string) =>
  `${ROUND_REFLECTION_LOCAL_SAVED_STORAGE_KEY}:${userId}`;

export function normalizeRoundReflectionDraft(value: Partial<RoundReflectionDraft> | null | undefined): RoundReflectionDraft {
  return {
    generalComments: typeof value?.generalComments === 'string' ? value.generalComments : '',
    drivingNotes: typeof value?.drivingNotes === 'string' ? value.drivingNotes : '',
    ironsNotes: typeof value?.ironsNotes === 'string' ? value.ironsNotes : '',
    shortNotes: typeof value?.shortNotes === 'string' ? value.shortNotes : '',
    puttingNotes: typeof value?.puttingNotes === 'string' ? value.puttingNotes : '',
    mentalNotes: typeof value?.mentalNotes === 'string' ? value.mentalNotes : '',
    courseManagementNotes: typeof value?.courseManagementNotes === 'string' ? value.courseManagementNotes : '',
    playingPartnerIds: Array.isArray(value?.playingPartnerIds)
      ? value.playingPartnerIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export function roundReflectionDraftsEqual(a: RoundReflectionDraft, b: RoundReflectionDraft): boolean {
  const normalizedA = normalizeRoundReflectionDraft(a);
  const normalizedB = normalizeRoundReflectionDraft(b);
  return Object.keys(normalizedA).every((key) => {
    const field = key as keyof RoundReflectionDraft;
    const aValue = normalizedA[field];
    const bValue = normalizedB[field];
    if (Array.isArray(aValue) || Array.isArray(bValue)) {
      return JSON.stringify(aValue ?? []) === JSON.stringify(bValue ?? []);
    }
    return String(aValue ?? '').trim() === String(bValue ?? '').trim();
  });
}

function hasRoundReflectionDraftContent(value: RoundReflectionDraft): boolean {
  return [
    value.generalComments,
    value.drivingNotes,
    value.ironsNotes,
    value.shortNotes,
    value.puttingNotes,
    value.mentalNotes,
    value.courseManagementNotes,
  ].some((field) => field.trim().length > 0) || value.playingPartnerIds.length > 0;
}

export function loadRoundReflectionLocalDraft(userId: string, roundDate: string): RoundReflectionDraft | null {
  if (typeof window === 'undefined') return null;

  const storageKey = getRoundReflectionDraftStorageKey(userId, roundDate);
  const rawDraft = localStorage.getItem(storageKey);
  if (rawDraft) {
    try {
      return normalizeRoundReflectionDraft(JSON.parse(rawDraft) as Partial<RoundReflectionDraft>);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  const legacyRawDraft = localStorage.getItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
  if (!legacyRawDraft) {
    return loadUploadReflectionDraft(userId, roundDate);
  }

  try {
    const legacyDraft = JSON.parse(legacyRawDraft) as StoredReflectionDraft;
    if (legacyDraft.userId === userId && legacyDraft.roundDate === roundDate) {
      const normalized = normalizeRoundReflectionDraft(legacyDraft.value);
      localStorage.setItem(storageKey, JSON.stringify(normalized));
      return normalized;
    }
  } catch {
    localStorage.removeItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
  }

  return loadUploadReflectionDraft(userId, roundDate);
}

function loadUploadReflectionDraft(userId: string, roundDate: string): RoundReflectionDraft | null {
  const rawDraft = localStorage.getItem(PENDING_UPLOAD_STORAGE_KEY);
  if (!rawDraft) return null;

  try {
    const uploadDraft = JSON.parse(rawDraft) as StoredPendingUploadDraft;
    const value = uploadDraft.userId === userId ? uploadDraft.reflectionsByDate?.[roundDate] ?? null : null;
    if (value) {
      const normalized = normalizeRoundReflectionDraft(value);
      localStorage.setItem(getRoundReflectionDraftStorageKey(userId, roundDate), JSON.stringify(normalized));
      return normalized;
    }
  } catch {
    localStorage.removeItem(PENDING_UPLOAD_STORAGE_KEY);
  }

  return null;
}

export function saveRoundReflectionLocalDraft(userId: string, roundDate: string, value: RoundReflectionDraft): void {
  if (typeof window === 'undefined') return;

  const storageKey = getRoundReflectionDraftStorageKey(userId, roundDate);
  const normalized = normalizeRoundReflectionDraft(value);
  const updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey, JSON.stringify(normalized));
  localStorage.setItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY, JSON.stringify({
    userId,
    roundDate,
    value: normalized,
    updatedAt,
  } satisfies StoredReflectionDraft));
}

export function loadRoundReflectionLocalDrafts(userId: string): Record<string, StoredLocalDraftReflection> {
  if (typeof window === 'undefined') return {};

  const drafts: Record<string, StoredLocalDraftReflection> = {};
  const prefix = `${ROUND_REFLECTION_DRAFT_STORAGE_KEY}:${userId}:`;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;

    const roundDate = key.slice(prefix.length);
    if (!roundDate) continue;

    try {
      const value = normalizeRoundReflectionDraft(JSON.parse(localStorage.getItem(key) || 'null') as Partial<RoundReflectionDraft>);
      if (hasRoundReflectionDraftContent(value)) {
        drafts[roundDate] = {
          value,
          savedAt: new Date().toISOString(),
        };
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  const legacyRawDraft = localStorage.getItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
  if (legacyRawDraft) {
    try {
      const legacyDraft = JSON.parse(legacyRawDraft) as StoredReflectionDraft;
      if (legacyDraft.userId === userId) {
        const value = normalizeRoundReflectionDraft(legacyDraft.value);
        if (legacyDraft.roundDate && hasRoundReflectionDraftContent(value)) {
          drafts[legacyDraft.roundDate] = {
            value,
            savedAt: typeof legacyDraft.updatedAt === 'string' ? legacyDraft.updatedAt : new Date().toISOString(),
          };
        }
      }
    } catch {
      localStorage.removeItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
    }
  }

  return drafts;
}

export function loadRoundReflectionLocalSaved(userId: string): Record<string, StoredLocalSavedReflection> {
  if (typeof window === 'undefined') return {};

  const raw = localStorage.getItem(getRoundReflectionLocalSavedStorageKey(userId));
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, StoredLocalSavedReflection>;
    return Object.fromEntries(Object.entries(parsed).map(([roundDate, entry]) => [
      roundDate,
      {
        value: normalizeRoundReflectionDraft(entry?.value),
        savedAt: typeof entry?.savedAt === 'string' ? entry.savedAt : new Date().toISOString(),
      },
    ]));
  } catch {
    localStorage.removeItem(getRoundReflectionLocalSavedStorageKey(userId));
    return {};
  }
}

export function saveRoundReflectionLocalSaved(userId: string, roundDate: string, value: RoundReflectionDraft): void {
  if (typeof window === 'undefined') return;

  const saved = loadRoundReflectionLocalSaved(userId);
  saved[roundDate] = {
    value: normalizeRoundReflectionDraft(value),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(getRoundReflectionLocalSavedStorageKey(userId), JSON.stringify(saved));
}

export function clearRoundReflectionLocalSaved(userId: string, roundDate: string): void {
  if (typeof window === 'undefined') return;

  const saved = loadRoundReflectionLocalSaved(userId);
  delete saved[roundDate];
  localStorage.setItem(getRoundReflectionLocalSavedStorageKey(userId), JSON.stringify(saved));
}

export function clearRoundReflectionLocalDraft(userId: string, roundDate: string): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(getRoundReflectionDraftStorageKey(userId, roundDate));

  const legacyRawDraft = localStorage.getItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
  if (!legacyRawDraft) return;

  try {
    const legacyDraft = JSON.parse(legacyRawDraft) as StoredReflectionDraft;
    if (legacyDraft.userId === userId && legacyDraft.roundDate === roundDate) {
      localStorage.removeItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
    }
  } catch {
    localStorage.removeItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY);
  }
}
