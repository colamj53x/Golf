import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, FileText, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGolfData } from '@/context/GolfDataContext';
import { supabase } from '@/integrations/supabase/client';
import { getShotDateKey, parseCSV } from '@/lib/golfCalculations';
import { getUserFriendlyError, validateShot } from '@/lib/errorHandler';
import { getUploadShotFingerprint } from '@/lib/uploadReview';
import { encodeRoundShotSequence } from '@/lib/roundShotSequence';
import {
  clearRoundReflectionLocalDraft,
  saveRoundReflectionLocalDraft,
} from '@/lib/roundReflectionDrafts';
import { CLUB_CODE_MAP, normalizeClubCode, Shot } from '@/types/golf';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  createEmptyRoundReflectionDraft,
  hasRoundReflectionContent,
  RoundReflectionDraft,
  RoundReflectionEditor,
} from '@/components/RoundReflectionEditor';

type UploadReviewRow = {
  id: string;
  roundDate: string;
  club: string;
  sourceType: string;
  shotFamily: string;
  swingEffort: string;
  targetIntent: string;
  holeNumber: number | null;
  shotNumber: number | null;
  accepted: boolean;
  target: number;
  total: number;
  side: number;
  startLie: string;
  endLie: string;
  strikeQuality: string;
  shotQuality: string;
  endDistanceFromTarget: number;
  notes: string;
  predictedLabel: string;
};

type PendingUploadDraft = {
  fileName: string;
  rows: UploadReviewRow[];
  skippedCount: number;
  reflectionsByDate: Record<string, RoundReflectionDraft>;
};

type StoredPendingUploadDraft = PendingUploadDraft & {
  userId: string;
  replaceAll: boolean;
  replaceMatchingRounds?: boolean;
};

type UploadShotInsert = {
  club: string;
  shot_type: string;
  shot_family: string;
  swing_effort: string;
  target_intent: string;
  hole_number: number | null;
  shot_number: number | null;
  target: number;
  total: number;
  offline: number;
  start_lie: string;
  end_lie: string;
  strike_quality: string;
  shot_quality: string;
  end_distance_from_target: number;
  notes: string;
  shot_date: string;
  user_id: string;
};

const PENDING_UPLOAD_STORAGE_KEY = 'golf-pending-upload-review-draft';

const CLUB_OPTIONS = [
  { value: 'Dr', label: 'Driver' },
  { value: '5W', label: '5 Wood' },
  { value: '4H', label: '4 Hybrid' },
  { value: '5H', label: '5 Hybrid' },
  { value: '6I', label: '6 Iron' },
  { value: '7I', label: '7 Iron' },
  { value: '8I', label: '8 Iron' },
  { value: '9I', label: '9 Iron' },
  { value: 'PW', label: 'Pitching Wedge' },
  { value: 'GW', label: 'Gap Wedge' },
  { value: 'SW', label: 'Sand Wedge' },
  { value: 'LW', label: 'Lob Wedge' },
] as const;

const TARGET_INTENT_OPTIONS = [
  { value: 'fairway', label: 'Fairway' },
  { value: 'green', label: 'Green' },
] as const;

const START_LIE_OPTIONS = [
  { value: 'Tee', label: 'Tee' },
  { value: 'Fairway', label: 'Fairway' },
  { value: 'Rough', label: 'Rough' },
  { value: 'Recovery', label: 'Recovery' },
  { value: 'Sand', label: 'Sand' },
  { value: 'Green', label: 'Green' },
] as const;

const END_LIE_OPTIONS = [
  { value: 'Fairway', label: 'Fairway' },
  { value: 'Rough', label: 'Rough' },
  { value: 'Recovery', label: 'Recovery' },
  { value: 'Sand', label: 'Sand' },
  { value: 'Green', label: 'Green' },
  { value: 'Fringe', label: 'Fringe' },
  { value: 'Hole', label: 'Hole' },
  { value: 'Penalty', label: 'Penalty' },
  { value: 'Water', label: 'Water' },
  { value: 'OB', label: 'OB' },
] as const;

const SHOT_FAMILY_OPTIONS = [
  { value: 'full', label: 'Full' },
  { value: 'punch', label: 'Punch' },
  { value: 'pitch', label: 'Pitch' },
  { value: 'chip', label: 'Chip' },
  { value: 'bump', label: 'Bump and Run' },
] as const;

const SWING_EFFORT_OPTIONS = [
  { value: 'full', label: 'Full' },
  { value: '9pm', label: 'Half' },
] as const;

function normalizeClub(club: string): string {
  return normalizeClubCode(club);
}

function getClubId(club: string): string {
  return (CLUB_CODE_MAP[club] ?? CLUB_CODE_MAP[club.toUpperCase()] ?? club).toLowerCase();
}

function availableShotFamiliesForClub(club: string) {
  const clubId = getClubId(club);
  if (clubId === 'dr' || clubId === '5w' || clubId === '4h' || clubId === '5h') {
    return SHOT_FAMILY_OPTIONS.filter((option) => option.value === 'full');
  }
  if (clubId === '6i' || clubId === '7i') {
    return SHOT_FAMILY_OPTIONS.filter((option) => option.value === 'full' || option.value === 'punch');
  }
  if (clubId === '8i' || clubId === '9i') {
    return SHOT_FAMILY_OPTIONS.filter((option) => option.value === 'full' || option.value === 'bump');
  }
  return SHOT_FAMILY_OPTIONS.filter((option) => option.value === 'full' || option.value === 'pitch' || option.value === 'chip');
}

function getShotFamilyLabel(value: string): string {
  return SHOT_FAMILY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getSwingEffortLabel(value: string): string {
  return SWING_EFFORT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function inferShotFamily(shot: Shot): string {
  const text = `${shot.type} ${shot.notes} ${shot.startLie} ${shot.endLie}`.toLowerCase();
  const clubId = getClubId(normalizeClub(shot.club));

  if (text.includes('punch')) return 'punch';
  if (text.includes('chip')) return 'chip';
  if (text.includes('pitch')) return 'pitch';
  if (text.includes('bump')) return 'bump';

  if (clubId === '8i' || clubId === '9i') {
    if (shot.target <= 35) return 'bump';
  }

  if (clubId === '6i' || clubId === '7i') {
    if (text.includes('recovery') || shot.startLie.toLowerCase().includes('rough')) return 'punch';
  }

  if (shot.target <= 20) return 'chip';
  if (shot.target <= 50) return 'pitch';
  return 'full';
}

function inferSwingEffort(shot: Shot, shotFamily: string): string {
  const text = `${shot.type} ${shot.notes}`.toLowerCase();
  if (text.includes('half') || text.includes('partial') || text.includes('9pm')) return '9pm';
  if (shotFamily === 'chip' || shotFamily === 'bump') return '9pm';
  if (shotFamily === 'pitch' && shot.target <= 45) return '9pm';
  return 'full';
}

function inferTargetIntent(shot: Shot, shotFamily: string): string {
  const endLie = shot.endLie.toLowerCase();
  if (endLie.includes('green') || endLie.includes('fringe') || endLie.includes('hole')) return 'green';
  if (shotFamily === 'chip' || shotFamily === 'pitch' || shotFamily === 'bump') return 'green';
  return 'fairway';
}

function getPredictedLabel(shotFamily: string, swingEffort: string): string {
  return `${getShotFamilyLabel(shotFamily)} · ${getSwingEffortLabel(swingEffort)}`;
}

function isMissingReviewedUploadSchemaError(error: unknown): boolean {
  const errorObj = error as { code?: string; message?: string };
  const code = errorObj?.code ?? '';
  const message = (errorObj?.message ?? '').toLowerCase();

  return (
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('could not find the') ||
    message.includes('column') ||
    message.includes('round_reflections')
  );
}

function buildReviewRow(shot: Shot): UploadReviewRow {
  const club = normalizeClub(shot.club);
  const shotFamily = inferShotFamily({ ...shot, club });
  const swingEffort = inferSwingEffort({ ...shot, club }, shotFamily);
  const targetIntent = inferTargetIntent({ ...shot, club }, shotFamily);

  return {
    id: shot.id,
    roundDate: getShotDateKey(shot.date),
    club,
    sourceType: shot.type,
    shotFamily,
    swingEffort,
    targetIntent,
    holeNumber: shot.holeNumber,
    shotNumber: shot.shotNumber,
    accepted: false,
    target: shot.target,
    total: shot.total,
    side: shot.side,
    startLie: shot.startLie,
    endLie: shot.endLie,
    strikeQuality: shot.strikeQuality,
    shotQuality: shot.shotQuality,
    endDistanceFromTarget: shot.endDistanceFromTarget,
    notes: shot.notes,
    predictedLabel: getPredictedLabel(shotFamily, swingEffort),
  };
}

export function UploadTab() {
  const { user } = useAuth();
  const {
    refreshShots,
    refreshRoundReflections,
    roundReflections,
    upsertRoundReflection,
    shots,
    playingPartners,
    setPlayingPartners,
  } = useGolfData();
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingCommentsOnlyRound, setIsSavingCommentsOnlyRound] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [commentsOnlyResult, setCommentsOnlyResult] = useState<{ success: boolean; message: string } | null>(null);
  const [uploadWarnings, setUploadWarnings] = useState<{ row: number; issue: string }[]>([]);
  const [replaceAll, setReplaceAll] = useState(false);
  const [replaceMatchingRounds, setReplaceMatchingRounds] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<PendingUploadDraft | null>(null);
  const [commentsOnlyRoundDate, setCommentsOnlyRoundDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [commentsOnlyDraft, setCommentsOnlyDraft] = useState<RoundReflectionDraft>(createEmptyRoundReflectionDraft());
  const [hasRestoredPendingUpload, setHasRestoredPendingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const existing = roundReflections.find((reflection) => reflection.roundDate === commentsOnlyRoundDate);
    setCommentsOnlyDraft(existing ? {
      generalComments: existing.generalComments,
      drivingNotes: existing.drivingNotes,
      ironsNotes: existing.ironsNotes,
      shortNotes: existing.shortNotes,
      puttingNotes: existing.puttingNotes,
      mentalNotes: existing.mentalNotes,
      courseManagementNotes: existing.courseManagementNotes,
      playingPartnerIds: existing.playingPartnerIds,
    } : createEmptyRoundReflectionDraft());
  }, [commentsOnlyRoundDate, roundReflections]);

  useEffect(() => {
    if (!user || pendingUpload) {
      setHasRestoredPendingUpload(true);
      return;
    }

    const rawDraft = localStorage.getItem(PENDING_UPLOAD_STORAGE_KEY);
    if (!rawDraft) {
      setHasRestoredPendingUpload(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawDraft) as StoredPendingUploadDraft;
      if (parsed.userId !== user.id) {
        setHasRestoredPendingUpload(true);
        return;
      }

      setPendingUpload({
        fileName: parsed.fileName,
        rows: parsed.rows,
        skippedCount: parsed.skippedCount,
        reflectionsByDate: parsed.reflectionsByDate,
      });
      setReplaceAll(parsed.replaceAll);
      setReplaceMatchingRounds(parsed.replaceMatchingRounds ?? false);
      setUploadResult({
        success: false,
        message: 'Your unsaved upload draft was restored. You can keep reviewing and save again.',
      });
    } catch {
      localStorage.removeItem(PENDING_UPLOAD_STORAGE_KEY);
    } finally {
      setHasRestoredPendingUpload(true);
    }
  }, [pendingUpload, user]);

  useEffect(() => {
    if (!hasRestoredPendingUpload) return;

    if (!user || !pendingUpload) {
      localStorage.removeItem(PENDING_UPLOAD_STORAGE_KEY);
      return;
    }

    const payload: StoredPendingUploadDraft = {
      ...pendingUpload,
      userId: user.id,
      replaceAll,
      replaceMatchingRounds,
    };
    localStorage.setItem(PENDING_UPLOAD_STORAGE_KEY, JSON.stringify(payload));
  }, [hasRestoredPendingUpload, pendingUpload, replaceAll, replaceMatchingRounds, user]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      void processFile(file);
    } else {
      setUploadResult({ success: false, message: 'Please drop a CSV file.' });
    }
  };

  const processFile = async (file: File) => {
    if (!user) {
      setUploadResult({ success: false, message: 'Sign in before uploading shot data.' });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);
    setUploadWarnings([]);

    try {
      const text = await file.text();
      const { shots: parsedShots, warnings } = parseCSV(text);
      setUploadWarnings(warnings);

      if (parsedShots.length === 0) {
        setUploadResult({ success: false, message: 'No valid shots found in the CSV file.' });
        return;
      }

      const validationErrors: { row: number; issue: string }[] = [];
      for (let i = 0; i < parsedShots.length; i++) {
        const shot = parsedShots[i];
        const error = validateShot({
          club: shot.club,
          total: shot.total,
          target: shot.target,
          side: shot.side,
          date: shot.date,
          endDistanceFromTarget: shot.endDistanceFromTarget,
        });
        if (error) {
          validationErrors.push({ row: i + 2, issue: error });
        }
      }

      if (validationErrors.length > 0) {
        setUploadWarnings((prev) => [...prev, ...validationErrors]);
        if (validationErrors.length === parsedShots.length) {
          setUploadResult({ success: false, message: 'All shots failed validation. Please check your data.' });
          return;
        }
      }

      const validShots = parsedShots.filter((_, index) => !validationErrors.some((error) => error.row === index + 2));
      const rows = validShots.map((shot) => buildReviewRow(shot));
      const roundDates = [...new Set(rows.map((row) => row.roundDate))];
      const reflectionsByDate = Object.fromEntries(roundDates.map((roundDate) => {
        const existing = roundReflections.find((reflection) => reflection.roundDate === roundDate);
        return [roundDate, existing ? {
          generalComments: existing.generalComments,
          drivingNotes: existing.drivingNotes,
          ironsNotes: existing.ironsNotes,
          shortNotes: existing.shortNotes,
          puttingNotes: existing.puttingNotes,
          mentalNotes: existing.mentalNotes,
          courseManagementNotes: existing.courseManagementNotes,
          playingPartnerIds: existing.playingPartnerIds,
        } : createEmptyRoundReflectionDraft()];
      }));

      setPendingUpload({
        fileName: file.name,
        rows,
        skippedCount: parsedShots.length - validShots.length,
        reflectionsByDate,
      });
      setUploadResult({
        success: true,
        message: `Parsed ${rows.length} shots from ${file.name}. Review the classification before saving.`,
      });
    } catch (error) {
      setUploadResult({
        success: false,
        message: getUserFriendlyError(error),
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const updatePendingRow = (rowId: string, updates: Partial<UploadReviewRow>) => {
    setPendingUpload((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((row) => {
          if (row.id !== rowId) return row;
          const next = { ...row, ...updates };
          return {
            ...next,
            predictedLabel: getPredictedLabel(next.shotFamily, next.swingEffort),
            accepted: updates.accepted ?? false,
          };
        }),
      };
    });
  };

  const acceptedCount = pendingUpload?.rows.filter((row) => row.accepted).length ?? 0;

  const clearPendingUpload = () => {
    setPendingUpload(null);
    localStorage.removeItem(PENDING_UPLOAD_STORAGE_KEY);
  };

  const updateRoundReflection = (roundDate: string, next: RoundReflectionDraft) => {
    if (user) {
      if (hasRoundReflectionContent(next)) {
        saveRoundReflectionLocalDraft(user.id, roundDate, next);
      } else {
        clearRoundReflectionLocalDraft(user.id, roundDate);
      }
    }

    setPendingUpload((current) => {
      if (!current) return current;
      return {
        ...current,
        reflectionsByDate: {
          ...current.reflectionsByDate,
          [roundDate]: next,
        },
      };
    });
  };

  const addPlayingPartner = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = playingPartners.find((partner) => partner.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    setPlayingPartners((current) => [...current, { id, name: trimmed, notes: '', hasMobileNumber: false, playedDates: [] }]);
    return id;
  };

  const saveCommentsOnlyRound = async () => {
    if (!user) {
      setCommentsOnlyResult({ success: false, message: 'Sign in before saving round comments.' });
      return;
    }
    if (!commentsOnlyRoundDate) {
      setCommentsOnlyResult({ success: false, message: 'Choose a round date before saving comments.' });
      return;
    }
    if (!hasRoundReflectionContent(commentsOnlyDraft)) {
      setCommentsOnlyResult({ success: false, message: 'Add a comment, thought, or playing partner before saving this round.' });
      return;
    }

    setIsSavingCommentsOnlyRound(true);
    setCommentsOnlyResult(null);
    setUploadResult(null);
    try {
      saveRoundReflectionLocalDraft(user.id, commentsOnlyRoundDate, commentsOnlyDraft);
      await upsertRoundReflection(commentsOnlyRoundDate, commentsOnlyDraft);
      clearRoundReflectionLocalDraft(user.id, commentsOnlyRoundDate);
      await refreshRoundReflections();
      setCommentsOnlyResult({ success: true, message: `Saved comments-only round for ${commentsOnlyRoundDate}.` });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Comments-only round saved locally but remote sync failed:', error);
      }
      setCommentsOnlyResult({
        success: true,
        message: `Saved comments-only round locally for ${commentsOnlyRoundDate}. Remote sync can retry later.`,
      });
    } finally {
      setIsSavingCommentsOnlyRound(false);
    }
  };

  const commitUpload = async () => {
    if (!user || !pendingUpload) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      if (replaceAll) {
        const { error: deleteError } = await supabase.from('shots').delete().eq('user_id', user.id);
        if (deleteError) throw new Error(getUserFriendlyError(deleteError));
      }

      const reviewedShots: UploadShotInsert[] = pendingUpload.rows.map((row) => ({
        club: row.club,
        shot_type: row.sourceType,
        shot_family: row.shotFamily,
        swing_effort: row.swingEffort,
        target_intent: row.targetIntent,
        hole_number: row.holeNumber,
        shot_number: row.shotNumber,
        target: Math.max(0, Math.min(600, row.target)),
        total: Math.max(0, Math.min(600, row.total)),
        offline: Math.max(-200, Math.min(200, row.side)),
        start_lie: row.startLie,
        end_lie: row.endLie,
        strike_quality: row.strikeQuality,
        shot_quality: row.shotQuality,
        end_distance_from_target: Math.max(0, Math.min(600, row.endDistanceFromTarget)),
        notes: row.notes,
        shot_date: row.roundDate,
        user_id: user.id,
      }));

      const reviewedShotsWithoutSequence = reviewedShots.map(({ hole_number, shot_number, ...reviewedShot }) => ({
        ...reviewedShot,
        notes: encodeRoundShotSequence(reviewedShot.notes, hole_number, shot_number),
      }));
      const legacyShots = reviewedShotsWithoutSequence.map(({ shot_family, swing_effort, target_intent, ...legacyShot }) => legacyShot);
      const relevantDates = [...new Set(reviewedShots.map((shot) => shot.shot_date))];
      let duplicateCount = 0;

      let shotsToInsert = reviewedShots;
      let reviewedShotsWithoutSequenceToInsert = reviewedShotsWithoutSequence;
      let legacyShotsToInsert = legacyShots;

      if (!replaceAll && replaceMatchingRounds) {
        const { error: deleteRoundsError } = await supabase
          .from('shots')
          .delete()
          .eq('user_id', user.id)
          .in('shot_date', relevantDates);
        if (deleteRoundsError) throw new Error(getUserFriendlyError(deleteRoundsError));
      }

      if (!replaceAll && !replaceMatchingRounds) {
        const { data: existingShots, error: existingShotsError } = await supabase
          .from('shots')
          .select('club, shot_type, target, total, offline, start_lie, end_lie, strike_quality, shot_quality, end_distance_from_target, notes, shot_date')
          .eq('user_id', user.id)
          .in('shot_date', relevantDates);

        if (existingShotsError) throw existingShotsError;

        const existingCounts = new Map<string, number>();
        for (const existingShot of existingShots || []) {
          const fingerprint = getUploadShotFingerprint(existingShot);
          existingCounts.set(fingerprint, (existingCounts.get(fingerprint) ?? 0) + 1);
        }

        const filteredReviewedShots: UploadShotInsert[] = [];
        const filteredReviewedShotsWithoutSequence: typeof reviewedShotsWithoutSequence = [];
        const filteredLegacyShots: typeof legacyShots = [];

        reviewedShots.forEach((shot, index) => {
          const fingerprint = getUploadShotFingerprint(shot);
          const remainingCount = existingCounts.get(fingerprint) ?? 0;

          if (remainingCount > 0) {
            existingCounts.set(fingerprint, remainingCount - 1);
            duplicateCount += 1;
            return;
          }

          filteredReviewedShots.push(shot);
          filteredReviewedShotsWithoutSequence.push(reviewedShotsWithoutSequence[index]);
          filteredLegacyShots.push(legacyShots[index]);
        });

        shotsToInsert = filteredReviewedShots;
        reviewedShotsWithoutSequenceToInsert = filteredReviewedShotsWithoutSequence;
        legacyShotsToInsert = filteredLegacyShots;
      }

      const batchSize = 100;
      let insertedCount = 0;
      let usedSequenceShotInsert = true;
      let usedLegacyShotInsert = false;

      for (let index = 0; index < shotsToInsert.length; index += batchSize) {
        const modernBatch = shotsToInsert.slice(index, index + batchSize);
        const reviewedWithoutSequenceBatch = reviewedShotsWithoutSequenceToInsert.slice(index, index + batchSize);
        const legacyBatch = legacyShotsToInsert.slice(index, index + batchSize);

        const preferredBatch = usedLegacyShotInsert
          ? legacyBatch
          : usedSequenceShotInsert
            ? modernBatch
            : reviewedWithoutSequenceBatch;
        const { error } = await supabase.from('shots').insert(preferredBatch);
        if (error) {
          if (usedSequenceShotInsert && isMissingReviewedUploadSchemaError(error)) {
            const { error: reviewedRetryError } = await supabase.from('shots').insert(reviewedWithoutSequenceBatch);
            if (!reviewedRetryError) {
              usedSequenceShotInsert = false;
            } else if (isMissingReviewedUploadSchemaError(reviewedRetryError)) {
              const { error: legacyRetryError } = await supabase.from('shots').insert(legacyBatch);
              if (legacyRetryError) throw legacyRetryError;
              usedLegacyShotInsert = true;
            } else {
              throw reviewedRetryError;
            }
          } else if (!usedLegacyShotInsert && isMissingReviewedUploadSchemaError(error)) {
            const { error: legacyRetryError } = await supabase.from('shots').insert(legacyBatch);
            if (legacyRetryError) throw legacyRetryError;
            usedLegacyShotInsert = true;
          } else {
            throw error;
          }
        }

        insertedCount += modernBatch.length;
      }

      let skippedReflectionSave = false;
      for (const [roundDate, reflection] of Object.entries(pendingUpload.reflectionsByDate)) {
        if (!hasRoundReflectionContent(reflection)) continue;
        saveRoundReflectionLocalDraft(user.id, roundDate, reflection);
        try {
          await upsertRoundReflection(roundDate, reflection);
        } catch (error) {
          skippedReflectionSave = true;
          if (import.meta.env.DEV) {
            console.error('Round reflection save skipped after shot upload:', error);
          }
        }
      }

      const skippedMsg = pendingUpload.skippedCount > 0 ? ` (${pendingUpload.skippedCount} invalid shots skipped)` : '';
      const duplicateMsg = duplicateCount > 0 ? ` ${duplicateCount} duplicate shot${duplicateCount === 1 ? '' : 's'} already existed and were skipped.` : '';
      const legacyMsg = usedLegacyShotInsert
        ? ' Saved the reviewed shots using the existing database fields.'
        : !usedSequenceShotInsert
          ? ' Saved classifications, but shots-to-green will need the sequence database update before it can be calculated.'
          : '';
      const reflectionMsg = skippedReflectionSave
        ? ' Round thoughts could not be saved yet, but the shot upload did complete.'
        : '';
      setUploadResult({
        success: true,
        message: `Successfully ${replaceAll ? 'replaced history with' : replaceMatchingRounds ? 'replaced matching rounds with' : 'added'} ${insertedCount} reviewed shots.${skippedMsg}${duplicateMsg}${legacyMsg}${reflectionMsg}`,
      });
      clearPendingUpload();
      await Promise.all([refreshShots(), refreshRoundReflections()]);
    } catch (error) {
      setUploadResult({
        success: false,
        message: getUserFriendlyError(error),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!user) {
      setUploadResult({ success: false, message: 'Sign in before deleting shot data.' });
      return;
    }

    if (!confirm('Are you sure you want to delete ALL shot data? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setUploadResult(null);

    try {
      const { error } = await supabase.from('shots').delete().eq('user_id', user.id);
      if (error) {
        setUploadResult({ success: false, message: getUserFriendlyError(error) });
      } else {
        setUploadResult({ success: true, message: 'All shot data has been deleted.' });
        await refreshShots();
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: getUserFriendlyError(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLastUpload = async () => {
    if (!user) {
      setUploadResult({ success: false, message: 'Sign in before deleting shot data.' });
      return;
    }

    setIsDeleting(true);
    setUploadResult(null);
    try {
      const { data: latest, error: latestErr } = await supabase
        .from('shots')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (latestErr || !latest || latest.length === 0) {
        setUploadResult({ success: false, message: 'No uploads found to delete.' });
        return;
      }

      const latestTs = latest[0].created_at as string;
      const start = new Date(new Date(latestTs).getTime() - 5000).toISOString();
      const end = new Date(new Date(latestTs).getTime() + 5000).toISOString();

      const { count, error: countErr } = await supabase
        .from('shots')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end);

      if (countErr) {
        setUploadResult({ success: false, message: getUserFriendlyError(countErr) });
        return;
      }

      if (!confirm(`Delete ${count ?? '?'} rows from the last upload (${new Date(latestTs).toLocaleString()})? This cannot be undone.`)) {
        return;
      }

      const { error } = await supabase
        .from('shots')
        .delete()
        .eq('user_id', user.id)
        .gte('created_at', start)
        .lte('created_at', end);

      if (error) {
        setUploadResult({ success: false, message: getUserFriendlyError(error) });
      } else {
        setUploadResult({ success: true, message: `Deleted ${count ?? ''} rows from the last upload.` });
        await refreshShots();
      }
    } catch (error) {
      setUploadResult({ success: false, message: getUserFriendlyError(error) });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Shot Data
          </CardTitle>
          <CardDescription>
            Upload your full ParGolf CSV or the simple shot template. Putting rows are skipped for now.
            Your current data has {shots.length} shots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <Switch id="replace-mode" checked={replaceAll} onCheckedChange={setReplaceAll} />
            <div className="space-y-1">
              <Label htmlFor="replace-mode">Replace existing shot history</Label>
              <p className="text-xs text-muted-foreground">
                Leave this off to append new shots. Turn it on only when you want to wipe and reload your shot data.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
            <Switch id="replace-round-mode" checked={replaceMatchingRounds} onCheckedChange={setReplaceMatchingRounds} disabled={replaceAll} />
            <div className="space-y-1">
              <Label htmlFor="replace-round-mode">Replace matching round dates</Label>
              <p className="text-xs text-muted-foreground">
                Use this to repair or reload one round. Only dates present in the uploaded CSV are replaced.
              </p>
            </div>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className={`mx-auto mb-3 h-10 w-10 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium">
              {isUploading ? 'Preparing upload...' : 'Drag and drop your CSV file here'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
          </div>

          {uploadResult && (
            <Alert variant={uploadResult.success ? 'default' : 'destructive'}>
              {uploadResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{uploadResult.message}</AlertDescription>
            </Alert>
          )}

          {uploadWarnings.length > 0 && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <p className="mb-2 font-medium">{uploadWarnings.length} row(s) had issues:</p>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                  {uploadWarnings.slice(0, 10).map((warning, index) => (
                    <li key={`${warning.row}-${index}`}>Row {warning.row}: {warning.issue}</li>
                  ))}
                  {uploadWarnings.length > 10 && (
                    <li className="text-muted-foreground">...and {uploadWarnings.length - 10} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="border-t pt-4 text-sm text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">Accepted CSV columns</p>
            <p className="mb-2">
              Full ParGolf exports are supported. If offline distance is blank, the app estimates it from tags like
              #pull, #push, #slice, #hook, #fade, and #draw.
            </p>
            <code className="block overflow-x-auto rounded bg-muted p-3 text-xs">
              Date, Club, Type, Start Lie, End Lie, Strike Quality, Shot Quality, Target, End Distance from Target, Distance Hit, Dispersion
            </code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Round Comments Only</CardTitle>
          <CardDescription>
            Save a round when you played but did not track shots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="comments-only-round-date">Round Date</Label>
            <Input
              id="comments-only-round-date"
              type="date"
              value={commentsOnlyRoundDate}
              onChange={(event) => {
                setCommentsOnlyRoundDate(event.target.value);
                setCommentsOnlyResult(null);
              }}
            />
          </div>
          <RoundReflectionEditor
            title={`Round Thoughts · ${commentsOnlyRoundDate || 'Select a date'}`}
            description="Capture who you played with and anything worth remembering from the round."
            value={commentsOnlyDraft}
            onChange={(next) => {
              setCommentsOnlyDraft(next);
              setCommentsOnlyResult(null);
              if (!user || !commentsOnlyRoundDate) return;
              if (hasRoundReflectionContent(next)) {
                saveRoundReflectionLocalDraft(user.id, commentsOnlyRoundDate, next);
              } else {
                clearRoundReflectionLocalDraft(user.id, commentsOnlyRoundDate);
              }
            }}
            playingPartners={playingPartners}
            onAddPlayingPartner={addPlayingPartner}
          />
          {commentsOnlyResult && (
            <Alert variant={commentsOnlyResult.success ? 'default' : 'destructive'}>
              {commentsOnlyResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>{commentsOnlyResult.message}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end">
            <Button onClick={() => void saveCommentsOnlyRound()} disabled={isSavingCommentsOnlyRound}>
              {isSavingCommentsOnlyRound ? 'Saving...' : 'Save Comments Only Round'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendingUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Review Upload Before Save</CardTitle>
            <CardDescription>
              {pendingUpload.rows.length} shots parsed from {pendingUpload.fileName}. Accept the prediction or adjust the
              club, type, effort, and target before these shots are stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Club</th>
                    <th className="px-3 py-2 text-left font-medium">Predicted Shot</th>
                    <th className="px-3 py-2 text-left font-medium">Distance to Target</th>
                    <th className="px-3 py-2 text-left font-medium">Target Intent</th>
                    <th className="px-3 py-2 text-left font-medium">Start Lie</th>
                    <th className="px-3 py-2 text-left font-medium">End Lie</th>
                    <th className="px-3 py-2 text-left font-medium">Shot Family</th>
                    <th className="px-3 py-2 text-left font-medium">Effort</th>
                    <th className="px-3 py-2 text-left font-medium">Accept</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUpload.rows.map((row) => {
                    const availableFamilies = availableShotFamiliesForClub(row.club);
                    return (
                      <tr key={row.id} className={`border-t align-top ${row.accepted ? 'bg-primary/5' : ''}`}>
                        <td className="px-3 py-3">
                          <Select value={row.club} onValueChange={(club) => updatePendingRow(row.id, { club })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CLUB_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="text-xs text-muted-foreground">{row.roundDate}</div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.predictedLabel}</div>
                          <div className="text-xs text-muted-foreground">
                            Total {Math.round(row.total)}m • Side {Math.round(row.side)}m
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{Math.round(row.target)}m</div>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={row.targetIntent} onValueChange={(value) => updatePendingRow(row.id, { targetIntent: value })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_INTENT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={row.startLie} onValueChange={(value) => updatePendingRow(row.id, { startLie: value })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="Start lie" />
                            </SelectTrigger>
                            <SelectContent>
                              {START_LIE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={row.endLie} onValueChange={(value) => updatePendingRow(row.id, { endLie: value })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue placeholder="End lie" />
                            </SelectTrigger>
                            <SelectContent>
                              {END_LIE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={row.shotFamily} onValueChange={(value) => updatePendingRow(row.id, { shotFamily: value })}>
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableFamilies.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Select value={row.swingEffort} onValueChange={(value) => updatePendingRow(row.id, { swingEffort: value })}>
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SWING_EFFORT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            variant={row.accepted ? 'secondary' : 'outline'}
                            onClick={() => updatePendingRow(row.id, { accepted: !row.accepted })}
                          >
                            {row.accepted ? 'Accepted' : 'Accept'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {Object.entries(pendingUpload.reflectionsByDate).map(([roundDate, reflection]) => (
              <RoundReflectionEditor
                key={roundDate}
                title={`Round Thoughts · ${roundDate}`}
                description="Add your round reflection now or leave it blank and fill it in later from the dashboard."
                value={reflection}
                onChange={(next) => updateRoundReflection(roundDate, next)}
                playingPartners={playingPartners}
                onAddPlayingPartner={addPlayingPartner}
              />
            ))}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <div className="text-sm text-muted-foreground sm:mr-auto sm:self-center">
                {acceptedCount} of {pendingUpload.rows.length} shots accepted
              </div>
              <Button variant="outline" onClick={clearPendingUpload} disabled={isUploading}>
                Cancel Review
              </Button>
              <Button onClick={() => void commitUpload()} disabled={isUploading || acceptedCount !== pendingUpload.rows.length}>
                {isUploading ? 'Saving...' : 'Save Reviewed Upload'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Manage Stored Data
          </CardTitle>
          <CardDescription>
            Delete uploaded shot data only when you need to undo an import or start again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleDeleteLastUpload}
            disabled={isDeleting || shots.length === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete Last Upload'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAll}
            disabled={isDeleting || shots.length === 0}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete All Data'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
