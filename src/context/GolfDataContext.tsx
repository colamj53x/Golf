import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ClubConfig, Shot, DEFAULT_CLUB_CONFIGS, RoundReflection } from '@/types/golf';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/context/AuthContext';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { parseDate } from '@/lib/golfCalculations';

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
  practiceDistanceTolerancePct: number;
  setPracticeDistanceTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  practiceBallFlightTolerancePct: number;
  setPracticeBallFlightTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  practiceOtherTolerancePct: number;
  setPracticeOtherTolerancePct: React.Dispatch<React.SetStateAction<number>>;
  roundReflections: RoundReflection[];
  roundReflectionsAvailable: boolean;
  upsertRoundReflection: (roundDate: string, updates: RoundReflectionInput) => Promise<void>;
  refreshRoundReflections: () => Promise<void>;
  refreshShots: () => Promise<void>;
}

type RoundReflectionInput = {
  drivingNotes: string;
  ironsNotes: string;
  shortNotes: string;
  puttingNotes: string;
  mentalNotes: string;
  courseManagementNotes: string;
};

const GolfDataContext = createContext<GolfDataContextType | undefined>(undefined);

export function GolfDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
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
    localStorage.setItem('golf-practice-distance-tolerance-pct', practiceDistanceTolerancePct.toString());
  }, [practiceDistanceTolerancePct]);

  useEffect(() => {
    localStorage.setItem('golf-practice-ball-flight-tolerance-pct', practiceBallFlightTolerancePct.toString());
  }, [practiceBallFlightTolerancePct]);

  useEffect(() => {
    localStorage.setItem('golf-practice-other-tolerance-pct', practiceOtherTolerancePct.toString());
  }, [practiceOtherTolerancePct]);

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
        .map((row) => ({
          id: row.id,
          club: row.club,
          type: row.shot_type || '',
          shotFamily: row.shot_family || '',
          swingEffort: row.swing_effort || '',
          targetIntent: row.target_intent || '',
          target: row.target || 0,
          total: row.total || 0,
          side: row.offline || 0,
          shotQuality: row.shot_quality || '',
          date: row.shot_date ? parseDate(row.shot_date).date : new Date(),
          startLie: row.start_lie || '',
          endLie: row.end_lie || '',
          strikeQuality: row.strike_quality || '',
          endDistanceFromTarget: row.end_distance_from_target || 0,
          notes: row.notes || '',
        }));

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

      if (error) {
        if (error.code === 'PGRST205' || error.code === '42P01') {
          setRoundReflectionsAvailable(false);
        }
        if (import.meta.env.DEV) {
          console.error('Failed to load round reflections:', getUserFriendlyError(error));
        }
        return;
      }

      setRoundReflectionsAvailable(true);
      setRoundReflections((data || []).map((row) => ({
        id: row.id,
        roundDate: row.round_date,
        drivingNotes: row.driving_notes || '',
        ironsNotes: row.irons_notes || '',
        shortNotes: row.short_notes || '',
        puttingNotes: row.putting_notes || '',
        mentalNotes: row.mental_notes || '',
        courseManagementNotes: row.course_management_notes || '',
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      })));
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

  const refreshRoundReflections = useCallback(async () => {
    await loadRoundReflections();
  }, [loadRoundReflections]);

  const upsertRoundReflection = useCallback(async (roundDate: string, updates: RoundReflectionInput) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      round_date: roundDate,
      driving_notes: updates.drivingNotes,
      irons_notes: updates.ironsNotes,
      short_notes: updates.shortNotes,
      putting_notes: updates.puttingNotes,
      mental_notes: updates.mentalNotes,
      course_management_notes: updates.courseManagementNotes,
    };

    const { error } = await supabase
      .from('round_reflections')
      .upsert(payload, { onConflict: 'user_id,round_date' });

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        setRoundReflectionsAvailable(false);
      }
      throw error;
    }

    setRoundReflectionsAvailable(true);
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
      isLoading, 
      availableClubs,
      availableStartLies,
      distanceToTargetTolerance,
      setDistanceToTargetTolerance,
      lowTargetExclusionThreshold,
      setLowTargetExclusionThreshold,
      gappingHcpTarget,
      setGappingHcpTarget,
      practiceDistanceTolerancePct,
      setPracticeDistanceTolerancePct,
      practiceBallFlightTolerancePct,
      setPracticeBallFlightTolerancePct,
      practiceOtherTolerancePct,
      setPracticeOtherTolerancePct,
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
