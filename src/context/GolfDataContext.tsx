import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ClubConfig, Shot, DEFAULT_CLUB_CONFIGS } from '@/types/golf';
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
  refreshShots: () => Promise<void>;
}

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
  
  const [shots, setShots] = useState<Shot[]>([]);
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

  const loadShots = useCallback(async () => {
    if (!user) {
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

  useEffect(() => {
    loadShots();
  }, [loadShots]);

  const refreshShots = useCallback(async () => {
    await loadShots();
  }, [loadShots]);

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
