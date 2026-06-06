import type { RoundReflectionDraft } from '@/components/RoundReflectionEditor';

export const ROUND_REFLECTION_DRAFT_STORAGE_KEY = 'golf-dashboard-round-reflection-draft';
const PENDING_UPLOAD_STORAGE_KEY = 'golf-pending-upload-review-draft';

export type StoredReflectionDraft = {
  userId: string;
  roundDate: string;
  value: RoundReflectionDraft;
};

type StoredPendingUploadDraft = {
  userId: string;
  reflectionsByDate?: Record<string, RoundReflectionDraft>;
};

export const getRoundReflectionDraftStorageKey = (userId: string, roundDate: string) =>
  `${ROUND_REFLECTION_DRAFT_STORAGE_KEY}:${userId}:${roundDate}`;

export function roundReflectionDraftsEqual(a: RoundReflectionDraft, b: RoundReflectionDraft): boolean {
  return Object.keys(a).every((key) => {
    const field = key as keyof RoundReflectionDraft;
    return a[field].trim() === b[field].trim();
  });
}

export function loadRoundReflectionLocalDraft(userId: string, roundDate: string): RoundReflectionDraft | null {
  if (typeof window === 'undefined') return null;

  const storageKey = getRoundReflectionDraftStorageKey(userId, roundDate);
  const rawDraft = localStorage.getItem(storageKey);
  if (rawDraft) {
    try {
      return JSON.parse(rawDraft) as RoundReflectionDraft;
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
      localStorage.setItem(storageKey, JSON.stringify(legacyDraft.value));
      return legacyDraft.value;
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
      localStorage.setItem(getRoundReflectionDraftStorageKey(userId, roundDate), JSON.stringify(value));
      return value;
    }
  } catch {
    localStorage.removeItem(PENDING_UPLOAD_STORAGE_KEY);
  }

  return null;
}

export function saveRoundReflectionLocalDraft(userId: string, roundDate: string, value: RoundReflectionDraft): void {
  if (typeof window === 'undefined') return;

  const storageKey = getRoundReflectionDraftStorageKey(userId, roundDate);
  localStorage.setItem(storageKey, JSON.stringify(value));
  localStorage.setItem(ROUND_REFLECTION_DRAFT_STORAGE_KEY, JSON.stringify({
    userId,
    roundDate,
    value,
  } satisfies StoredReflectionDraft));
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
