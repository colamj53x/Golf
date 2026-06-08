import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { ClubConfig, Shot, DEFAULT_CLUB_CONFIGS, normalizeClubCode, RoundReflection, PlayingPartner } from '@/types/golf';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import { useAuth } from '@/context/AuthContext';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { parseDate } from '@/lib/golfCalculations';
import { decodeRoundShotSequence } from '@/lib/roundShotSequence';
import {
  clearRoundReflectionLocalSaved,
  loadRoundReflectionLocalSaved,
  saveRoundReflectionLocalSaved,
} from '@/lib/roundReflectionDrafts';
import {
  loadGolfUserSettings,
  parseGolfUserSettings,
  saveGolfUserSettings,
  type GolfUserSettings,
} from '@/lib/userSettingsRepository';

type ShotRow = Database['public']['Tables']['shots']['Row'];

interface GolfDataContextType {
  clubs: ClubConfig[];
  setClubs: React.Dispatch<React.SetStateAction<ClubConfig[]>>;
  updateClub: (id: string, updates: Partial<ClubConfig>) => void;
  deleteClub: (id: string) => void;
  shots: Shot[];
  isLoading: boolean;
  availableClubs: string[];
  availableStartLies: string[];
  distanceToTargetTolerance: number;
  setDistanceToTargetTolerance: React.Dispatch<React.SetStateAction<number>>;
  lowTargetExclusionThreshold: number;
  setLowTargetExclusionThreshold: React.Dispatch<React.SetStateAction<number>>;
  gappingHcpTarget: number;
  setGappingHcpTarget: React.Dispatch<React.SetStateAction<number>>;
  shotPickerDistanceTolerancePct: number;
  setShotPickerDistanceTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  practiceDistanceTolerancePct: number;
  setPracticeDistanceTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  practiceBallFlightTolerancePct: number;
  setPracticeBallFlightTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  practiceOtherTolerancePct: number;
  setPracticeOtherTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  todayRecentShotCount: number;
  setTodayRecentShotCount: React.Dispatch<React.SetStateAction<number>>;
  playingPartners: PlayingPartner[];
  setPlayingPartners: React.Dispatch<React.SetStateAction<PlayingPartner[]>>;
  roundReflections: RoundReflection[];
  roundReflectionsAvailable: boolean;
  upsertRoundReflection: (roundDate: string, updates: RoundReflectionInput) => Promise<void>;
  refreshRoundReflections: () => Promise<void>;
  refreshShots: () => Promise<void>;
  updateRoundShotClassifications: (updates: Array<{
    id: string;
    club: string;
    shotFamily: string;
    swingEffort: string;
    targetIntent: string;
    startLie: string;
    endLie: string;
  }>) => Promise<void>;
}

type RoundReflectionInput = {
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
  generalComments: string;
  playingPartnerIds: string[];
};

const ROUND_REFLECTION_CONFIG_PREFIX = 'round_reflection:';

function isMissingRoundReflectionsTableError(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === 'PGRST204' || error?.code === '42P01' || error?.code === '42703';
}

function shouldUseRoundReflectionFallback(error: { code?: string } | null): boolean {
  return isMissingRoundReflectionsTableError(error) || error?.code === '23514';
}

function parseRoundReflectionDraft(value: Json): RoundReflectionInput {
  const draft = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    generalComments: typeof draft.generalComments === 'string' ? draft.generalComments : '',
    drivingNotes: typeof draft.drivingNotes === 'string' ? draft.drivingNotes : '',
    ironsNotes: typeof draft.ironsNotes === 'string' ? draft.ironsNotes : '',
    shortNotes: typeof draft.shortNotes === 'string' ? draft.shortNotes : '',
    puttingNotes: typeof draft.puttingNotes === 'string' ? draft.puttingNotes : '',
    mentalNotes: typeof draft.mentalNotes === 'string' ? draft.mentalNotes : '',
    courseManagementNotes: typeof draft.courseManagementNotes === 'string' ? draft.courseManagementNotes : '',
    playingPartnerIds: Array.isArray(draft.playingPartnerIds)
      ? draft.playingPartnerIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

function mergeLocalSavedRoundReflections(reflections: RoundReflection[], userId: string): RoundReflection[] {
  const localSaved = loadRoundReflectionLocalSaved(userId);
  const mergedReflections = reflections.map((reflection) => {
    const local = localSaved[reflection.roundDate];
    if (!local) return reflection;

    return {
      ...reflection,
      ...local.value,
      updatedAt: new Date(local.savedAt),
    };
  });
  const localOnly = Object.entries(localSaved)
    .filter(([roundDate]) => !reflections.some((reflection) => reflection.roundDate === roundDate))
    .map(([roundDate, entry]) => ({
      id: `local:${roundDate}`,
      roundDate,
      ...entry.value,
      createdAt: new Date(entry.savedAt),
      updatedAt: new Date(entry.savedAt),
    }));

  return [...mergedReflections, ...localOnly].sort((a, b) => b.roundDate.localeCompare(a.roundDate));
}

const GolfDataContext = createContext<GolfDataContextType | undefined>(undefined);

export function GolfDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const settingsHydrated = useRef(false);
  
  const [clubs, setClubs] = useState<ClubConfig[]>(() => {
    const saved = localStorage.getItem('golf-club-configs');
    return saved ? JSON.parse(saved) : DEFAULT_CLUB_CONFIGS;
  });
  
  const [distanceToTargetTolerance, setDistanceToTargetTolerance] = useState<number>(() => {
    const saved = localStorage.getItem('golf-distance-tolerance');
    return saved ? parseFloat(saved) : 10;
  });
  
  const [lowTargetExclusionThreshold, setLowTargetExclusionThreshold] = useState<number>(() => {
    const saved = localStorage.getItem('golf-low-target-threshold');
    return saved ? parseFloat(saved) : 10;
  });

  const [gappingHcpTarget, setGappingHcpTarget] = useState<number>(() => {
    const saved = localStorage.getItem('golf-gapping-hcp-target');
    return saved ? parseFloat(saved) : 10;
  });

  const [shotPickerDistanceTolerancePct, setShotPickerDistanceTolerancePct] = useState<number>(() => {
    const saved = localStorage.getItem('golf-shot-picker-distance-tolerance-pct');
    return saved ? parseFloat(saved) : 5;
  });

  const [practiceDistanceTolerancePct, setPracticeDistanceTolerancePct] = useState<number>(() => {
    const saved = localStorage.getItem('golf-practice-distance-tolerance-pct');
    return saved ? parseFloat(saved) : 10;
  });

  const [practiceBallFlightTolerancePct, setPracticeBallFlightTolerancePct] = useState<number>(() => {
    const saved = localStorage.getItem('golf-practice-ball-flight-tolerance-pct');
    return saved ? parseFloat(saved) : 5;
  });

  const [practiceOtherTolerancePct, setPracticeOtherTolerancePct] = useState<number>(() => {
    const saved = localStorage.getItem('golf-practice-other-tolerance-pct');
    return saved ? parseFloat(saved) : 10;
  });

  const [todayRecentShotCount, setTodayRecentShotCount] = useState<number>(() => {
    const saved = localStorage.getItem('golf-today-recent-shot-count');
    return saved ? parseFloat(saved) : 100;
  });

  const [playingPartners, setPlayingPartners] = useState<PlayingPartner[]>(() => {
    const saved = localStorage.getItem('golf-playing-partners');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as PlayingPartner[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  
  const [shots, setShots] = useState<Shot[]>([]);
  const [roundReflections, setRoundReflections] = useState<RoundReflection[]>([]);
  const [roundReflectionsAvailable, setRoundReflectionsAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('golf-club-configs', JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    localStorage.setItem('golf-distance-tolerance', distanceToTargetTolerance.toString());
  }, [distanceToTargetTolerance]);

  useEffect(() => {
    localStorage.setItem('golf-low-target-threshold', lowTargetExclusionThreshold.toString());
  }, [lowTargetExclusionThreshold]);

  useEffect(() => {
    localStorage.setItem('golf-gapping-hcp-target', gappingHcpTarget.toString());
  }, [gappingHcpTarget]);

  useEffect(() => {
    localStorage.setItem('golf-shot-picker-distance-tolerance-pct', shotPickerDistanceTolerancePct.toString());
  }, [shotPickerDistanceTolerancePct]);

  useEffect(() => {
    localStorage.setItem('golf-practice-distance-tolerance-pct', practiceDistanceTolerancePct.toString());
  }, [practiceDistanceTolerancePct]);

  useEffect(() => {
    localStorage.setItem('golf-practice-ball-flight-tolerance-pct', practiceBallFlightTolerancePct.toString());
  }, [practiceBallFlightTolerancePct]);

  useEffect(() => {
    localStorage.setItem('golf-practice-other-tolerance-pct', practiceOtherTolerancePct.toString());
  }, [practiceOtherTolerancePct]);

  useEffect(() => {
    localStorage.setItem('golf-today-recent-shot-count', todayRecentShotCount.toString());
  }, [todayRecentShotCount]);

  useEffect(() => {
    localStorage.setItem('golf-playing-partners', JSON.stringify(playingPartners));
  }, [playingPartners]);

  const currentSettings: GolfUserSettings = {
    clubs,
    distanceToTargetTolerance,
    lowTargetExclusionThreshold,
    gappingHcpTarget,
    shotPickerDistanceTolerancePct,
    practiceDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    practiceOtherTolerancePct,
    todayRecentShotCount,
    playingPartners,
  };
  const currentSettingsRef = useRef(currentSettings);
  currentSettingsRef.current = currentSettings;

  useEffect(() => {
    if (!user) {
      settingsHydrated.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const remote = await loadGolfUserSettings(user.id);
        if (cancelled) return;
        if (remote) {
          const next = parseGolfUserSettings(remote, currentSettingsRef.current);
          setClubs(next.clubs);
          setDistanceToTargetTolerance(next.distanceToTargetTolerance);
          setLowTargetExclusionThreshold(next.lowTargetExclusionThreshold);
          setGappingHcpTarget(next.gappingHcpTarget);
          setShotPickerDistanceTolerancePct(next.shotPickerDistanceTolerancePct);
          setPracticeDistanceTolerancePct(next.practiceDistanceTolerancePct);
          setPracticeBallFlightTolerancePct(next.practiceBallFlightTolerancePct);
          setPracticeOtherTolerancePct(next.practiceOtherTolerancePct);
          setTodayRecentShotCount(next.todayRecentShotCount);
          setPlayingPartners(next.playingPartners);
        } else {
          await saveGolfUserSettings(user.id, currentSettingsRef.current);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to load user settings:', getUserFriendlyError(error));
        }
      } finally {
        if (!cancelled) settingsHydrated.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !settingsHydrated.current) return;

    const timeout = window.setTimeout(() => {
      void saveGolfUserSettings(user.id, currentSettingsRef.current).catch((error) => {
        if (import.meta.env.DEV) {
          console.error('Failed to save user settings:', getUserFriendlyError(error));
        }
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    clubs,
    distanceToTargetTolerance,
    gappingHcpTarget,
    lowTargetExclusionThreshold,
    practiceBallFlightTolerancePct,
    practiceDistanceTolerancePct,
    practiceOtherTolerancePct,
    shotPickerDistanceTolerancePct,
    todayRecentShotCount,
    playingPartners,
    user,
  ]);

  const loadShots = useCallback(async () => {
    if (!user) {
      setShots([]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);

      // Fetch in pages because the backend enforces a per-request row cap (commonly 1000)
      const pageSize = 1000;
      let from = 0;
      let allRows: ShotRow[] = [];

      // Keep ordering stable across pages
      while (true) {
        const { data, error } = await supabase
          .from('shots')
          .select('*')
          .eq('user_id', user.id)
          .order('shot_date', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) {
          // Log sanitized error info in development
          if (import.meta.env.DEV) {
            console.error('Failed to load shots:', getUserFriendlyError(error));
          }
          return;
        }

        const rows = data || [];
        allRows = allRows.concat(rows);

        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const parsedShots: Shot[] = (allRows || [])
        .filter((row) => !(row.shot_type === '' && /^\d{4}-\d{2}-\d{2}$/.test(row.start_lie || '') && Number(row.target || 0) === 0 && Number(row.end_distance_from_target || 0) === 0))
        .map((row) => {
          const legacySequence = decodeRoundShotSequence(row.notes);
          return {
          id: row.id,
          club: normalizeClubCode(row.club),
          type: row.shot_type || '',
          shotFamily: row.shot_family || '',
          swingEffort: row.swing_effort || '',
          targetIntent: row.target_intent || '',
          holeNumber: row.hole_number ?? legacySequence.holeNumber,
          shotNumber: row.shot_number ?? legacySequence.shotNumber,
          target: row.target || 0,
          total: row.total || 0,
          side: row.offline || 0,
          shotQuality: row.shot_quality || '',
          date: row.shot_date ? parseDate(row.shot_date).date : new Date(),
          startLie: row.start_lie || '',
          endLie: row.end_lie || '',
          strikeQuality: row.strike_quality || '',
          endDistanceFromTarget: row.end_distance_from_target || 0,
          notes: legacySequence.notes,
        };
        });

      setShots(parsedShots);
    } catch (error) {
      // Log sanitized error in development only
      if (import.meta.env.DEV) {
        console.error('Failed to load shots:', getUserFriendlyError(error));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadRoundReflections = useCallback(async () => {
    if (!user) {
      setRoundReflections([]);
      setRoundReflectionsAvailable(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('round_reflections')
        .select('*')
        .eq('user_id', user.id)
        .order('round_date', { ascending: false });

      if (error && !isMissingRoundReflectionsTableError(error)) {
        if (import.meta.env.DEV) {
          console.error('Failed to load round reflections:', getUserFriendlyError(error));
        }
        return;
      }

      if (isMissingRoundReflectionsTableError(error)) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('practice_configs')
          .select('id, config_key, metrics, created_at, updated_at')
          .eq('user_id', user.id)
          .like('config_key', `${ROUND_REFLECTION_CONFIG_PREFIX}%`)
          .order('config_key', { ascending: false });

        if (fallbackError) {
          setRoundReflectionsAvailable(false);
          if (import.meta.env.DEV) {
            console.error('Failed to load fallback round reflections:', getUserFriendlyError(fallbackError));
          }
          return;
        }

        setRoundReflectionsAvailable(true);
        const fallbackReflections = (fallbackData || []).map((row) => ({
          id: row.id,
          roundDate: row.config_key.slice(ROUND_REFLECTION_CONFIG_PREFIX.length),
          ...parseRoundReflectionDraft(row.metrics),
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }));
        setRoundReflections(mergeLocalSavedRoundReflections(fallbackReflections, user.id));
        return;
      }

      setRoundReflectionsAvailable(true);
      const remoteReflections = (data || []).map((row) => ({
        id: row.id,
        roundDate: row.round_date,
        generalComments: row.general_comments || '',
        drivingNotes: row.driving_notes || '',
        ironsNotes: row.irons_notes || '',
        shortNotes: row.short_notes || '',
        puttingNotes: row.putting_notes || '',
        mentalNotes: row.mental_notes || '',
        courseManagementNotes: row.course_management_notes || '',
        playingPartnerIds: row.playing_partner_ids || [],
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      }));
      setRoundReflections(mergeLocalSavedRoundReflections(remoteReflections, user.id));
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to load round reflections:', getUserFriendlyError(error));
      }
    }
  }, [user]);

  useEffect(() => {
    loadShots();
    loadRoundReflections();
  }, [loadShots, loadRoundReflections]);

  const refreshShots = useCallback(async () => {
    await loadShots();
  }, [loadShots]);

  const updateRoundShotClassifications = useCallback(async (updates: Array<{
    id: string;
    club: string;
    shotFamily: string;
    swingEffort: string;
    targetIntent: string;
    startLie: string;
    endLie: string;
  }>) => {
    if (!user) return;
    for (const update of updates) {
      const { error } = await supabase
        .from('shots')
        .update({
          club: update.club,
          shot_family: update.shotFamily,
          swing_effort: update.swingEffort,
          target_intent: update.targetIntent,
          start_lie: update.startLie,
          end_lie: update.endLie,
        })
        .eq('user_id', user.id)
        .eq('id', update.id);
      if (error) throw error;
    }
    await loadShots();
  }, [loadShots, user]);

  const refreshRoundReflections = useCallback(async () => {
    await loadRoundReflections();
  }, [loadRoundReflections]);

  const upsertRoundReflection = useCallback(async (roundDate: string, updates: RoundReflectionInput) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      round_date: roundDate,
      general_comments: updates.generalComments,
      driving_notes: updates.drivingNotes,
      irons_notes: updates.ironsNotes,
      short_notes: updates.shortNotes,
      putting_notes: updates.puttingNotes,
      mental_notes: updates.mentalNotes,
      course_management_notes: updates.courseManagementNotes,
      playing_partner_ids: updates.playingPartnerIds,
    };

    const { error } = await supabase
      .from('round_reflections')
      .upsert(payload, { onConflict: 'user_id,round_date' });

    if (shouldUseRoundReflectionFallback(error)) {
      const { error: fallbackError } = await supabase
        .from('practice_configs')
        .upsert({
          config_key: `${ROUND_REFLECTION_CONFIG_PREFIX}${roundDate}`,
          club: 'note',
          shot_type: 'round',
          power: 'memo',
          metrics: updates as unknown as Json,
          user_id: user.id,
        }, { onConflict: 'user_id,config_key' });

      if (fallbackError) {
        setRoundReflectionsAvailable(false);
        saveRoundReflectionLocalSaved(user.id, roundDate, updates);
        await loadRoundReflections();
        throw fallbackError;
      }

      setRoundReflectionsAvailable(true);
      clearRoundReflectionLocalSaved(user.id, roundDate);
      await loadRoundReflections();
      return;
    }

    if (error) {
      throw error;
    }

    setRoundReflectionsAvailable(true);
    clearRoundReflectionLocalSaved(user.id, roundDate);
    await loadRoundReflections();
  }, [loadRoundReflections, user]);

  const updateClub = (id: string, updates: Partial<ClubConfig>) => {
    setClubs(prev => prev.map(club => 
      club.id === id ? { ...club, ...updates } : club
    ));
  };

  const deleteClub = (id: string) => {
    setClubs(prev => prev.filter(club => club.id !== id));
  };

  const availableClubs = [...new Set(shots.map(s => s.club))].filter(club => club && club.trim() !== '');
  const availableStartLies = [...new Set(shots.map(s => s.startLie))].filter(lie => lie && lie.trim() !== '');

  return (
    <GolfDataContext.Provider value={{ 
      clubs, 
      setClubs, 
      updateClub,
      deleteClub,
      shots, 
      updateRoundShotClassifications,
      isLoading, 
      availableClubs,
      availableStartLies,
      distanceToTargetTolerance,
      setDistanceToTargetTolerance,
      lowTargetExclusionThreshold,
      setLowTargetExclusionThreshold,
      gappingHcpTarget,
      setGappingHcpTarget,
      shotPickerDistanceTolerancePct,
      setShotPickerDistanceTolerancePct,
      practiceDistanceTolerancePct,
      setPracticeDistanceTolerancePct,
      practiceBallFlightTolerancePct,
      setPracticeBallFlightTolerancePct,
      practiceOtherTolerancePct,
      setPracticeOtherTolerancePct,
      todayRecentShotCount,
      setTodayRecentShotCount,
      playingPartners,
      setPlayingPartners,
      roundReflections,
      roundReflectionsAvailable,
      upsertRoundReflection,
      refreshRoundReflections,
      refreshShots
    }}>
      {children}
    </GolfDataContext.Provider>
  );
}

export function useGolfData() {
  const context = useContext(GolfDataContext);
  if (!context) {
    throw new Error('useGolfData must be used within GolfDataProvider');
  }
  return context;
}
