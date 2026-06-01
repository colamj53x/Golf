import { BlastMotionSetData, PuttingSessionType } from '@/types/putting';
import { PuttingPracticeSetId } from './drills';

const STORAGE_KEY = 'putting_session_draft_v1';

export interface PuttingSessionDraft {
  category: 'indoor' | 'outdoor';
  sessionType?: PuttingSessionType;
  practiceSetId: PuttingPracticeSetId;
  step: number;
  meta: {
    date: string;
    location: string;
    carpetSpeed: string;
    targetType: string;
    sessionLength: string;
    notes: string;
    selectedCue?: string;
    practiceFocus?: string;
    reflectionWorked?: string;
    reflectionFailed?: string;
    reflectionNext?: string;
    confidenceAfter?: number;
  };
  allCounts: Record<string, Record<string, number>>;
  blastByDrill?: Record<string, BlastMotionSetData>;
  updatedAt: string;
}

export function loadPuttingSessionDraft(): PuttingSessionDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PuttingSessionDraft;
    if (!parsed.practiceSetId || parsed.step < 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePuttingSessionDraft(draft: Omit<PuttingSessionDraft, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...draft,
    updatedAt: new Date().toISOString(),
  }));
}

export function clearPuttingSessionDraft(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
