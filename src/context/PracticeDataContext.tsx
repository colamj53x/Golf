import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
  ClubPracticeConfig, 
  PracticeSession, 
  PracticeMetricTarget,
  PracticeMetricValue,
  ConsistencyData,
  DEFAULT_4H_PRACTICE_METRICS 
} from '@/types/practice';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { PRACTICE_CLUBS, SHOT_TYPES, POWER_OPTIONS, getPracticeConfigKey, parsePracticeConfigKey } from '@/types/practiceClubs';
import { useAuth } from '@/context/AuthContext';
import { getUserFriendlyError } from '@/lib/errorHandler';

// Stored config from database
interface StoredPracticeConfig {
  id: string;
  configKey: string;
  club: string;
  shotType: string;
  power: string;
  metrics: PracticeMetricTarget[];
}

interface PracticeDataContextType {
  practiceConfigs: ClubPracticeConfig[];
  storedConfigs: StoredPracticeConfig[];
  setPracticeConfigs: React.Dispatch<React.SetStateAction<ClubPracticeConfig[]>>;
  updatePracticeConfig: (clubId: string, metrics: PracticeMetricTarget[]) => Promise<boolean>;
  savePracticeConfig: (club: string, shotType: string, power: string, metrics: PracticeMetricTarget[]) => Promise<void>;
  deletePracticeConfig: (configKey: string) => Promise<void>;
  resetToDefaults: () => void;
  practiceSessions: PracticeSession[];
  addPracticeSession: (session: Omit<PracticeSession, 'id'>) => Promise<void>;
  updatePracticeSession: (id: string, updates: Partial<PracticeSession>) => Promise<void>;
  deletePracticeSession: (id: string) => Promise<void>;
  getSessionsForClub: (clubId: string) => PracticeSession[];
  getLatestSessionForClub: (clubId: string) => PracticeSession | null;
  
  isLoading: boolean;
  selectedClub: string;
  selectedShotType: string;
  selectedPower: string;
  setSelectedClub: (club: string) => void;
  setSelectedShotType: (shotType: string) => void;
  setSelectedPower: (power: string) => void;
  currentConfigKey: string;
  hasStoredConfig: (configKey: string) => boolean;
}

const PracticeDataContext = createContext<PracticeDataContextType | undefined>(undefined);

// Generate default configs for all club/shot/power combinations
function generateDefaultConfigs(): ClubPracticeConfig[] {
  const configs: ClubPracticeConfig[] = [];
  
  for (const club of PRACTICE_CLUBS) {
    for (const shotType of SHOT_TYPES) {
      for (const power of POWER_OPTIONS) {
        const configKey = getPracticeConfigKey(club.id, shotType.id, power.id);
        configs.push({
          clubId: configKey,
          clubName: `${club.name} - ${shotType.name} - ${power.name}`,
          metrics: DEFAULT_4H_PRACTICE_METRICS.map(m => ({ ...m })), // Clone metrics
        });
      }
    }
  }
  
  return configs;
}

const DEFAULT_PRACTICE_CONFIGS: ClubPracticeConfig[] = generateDefaultConfigs();

export function PracticeDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Always use code-defined defaults for metric definitions (no localStorage caching)
  // This ensures metric names are locked to the current version
  const [practiceConfigs, setPracticeConfigs] = useState<ClubPracticeConfig[]>(DEFAULT_PRACTICE_CONFIGS);
  const [storedConfigs, setStoredConfigs] = useState<StoredPracticeConfig[]>([]);

  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Club/Shot/Power selection state
  const [selectedClub, setSelectedClub] = useState<string>('4h');
  const [selectedShotType, setSelectedShotType] = useState<string>('full');
  const [selectedPower, setSelectedPower] = useState<string>('full');

  // Current config key based on selections
  const currentConfigKey = getPracticeConfigKey(selectedClub, selectedShotType, selectedPower);

  // Load sessions and stored configs from database when user is available
  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        // Load practice sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('practice_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('session_date', { ascending: false });

        if (sessionsError) throw sessionsError;

        const sessions: PracticeSession[] = (sessionsData || []).map((row) => {
          const metricsData = row.metrics as Record<string, unknown>;
          const consistency = metricsData?.consistency as ConsistencyData | undefined;
          const metrics = Array.isArray(metricsData) 
            ? metricsData as unknown as PracticeMetricValue[]
            : (metricsData?.metrics as unknown as PracticeMetricValue[]) || [];
          
          return {
            id: row.id,
            clubId: row.club_id,
            date: new Date(row.session_date),
            metrics,
            notes: row.notes || '',
            consistency,
          };
        });

        setPracticeSessions(sessions);

        // Load stored configs
        const { data: configsData, error: configsError } = await supabase
          .from('practice_configs')
          .select('*')
          .eq('user_id', user.id);

        if (configsError) throw configsError;

        const configs: StoredPracticeConfig[] = (configsData || []).map((row) => ({
          id: row.id,
          configKey: row.config_key,
          club: row.club,
          shotType: row.shot_type,
          power: row.power,
          metrics: row.metrics as unknown as PracticeMetricTarget[],
        }));

        setStoredConfigs(configs);

        // Merge stored configs into practiceConfigs
        // Important: We merge stored targets INTO the current default metrics structure
        // This ensures new metrics added to defaults are always present
        if (configs.length > 0) {
          setPracticeConfigs(prev => {
            const updated = [...prev];
            configs.forEach(stored => {
              const idx = updated.findIndex(c => c.clubId === stored.configKey);
              if (idx >= 0) {
                // Merge: start with current defaults, overlay stored targets
                const mergedMetrics = updated[idx].metrics.map(defaultMetric => {
                  const storedMetric = stored.metrics.find(m => m.id === defaultMetric.id);
                  if (storedMetric) {
                    // Use stored targets but keep current metric structure
                    return {
                      ...defaultMetric,
                      targetMin: storedMetric.targetMin,
                      targetMax: storedMetric.targetMax,
                      targetDisplay: storedMetric.targetDisplay,
                    };
                  }
                  return defaultMetric; // New metric not in stored config, use default
                });
                updated[idx] = {
                  ...updated[idx],
                  metrics: mergedMetrics,
                };
              }
            });
            return updated;
          });
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error loading data:', getUserFriendlyError(error));
        }
        toast.error('Failed to load practice data. Please try refreshing the page.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  const hasStoredConfig = useCallback((configKey: string) => {
    return storedConfigs.some(c => c.configKey === configKey);
  }, [storedConfigs]);

  const updatePracticeConfig = useCallback(async (clubId: string, metrics: PracticeMetricTarget[]): Promise<boolean> => {
    if (!user) return false;

    // Update local state
    setPracticeConfigs(prev => {
      const existing = prev.find(c => c.clubId === clubId);
      if (existing) {
        return prev.map(c => c.clubId === clubId ? { ...c, metrics } : c);
      }
      return prev;
    });

    // Save to database
    const { club, shotType, power } = parsePracticeConfigKey(clubId);
    try {
      const { data, error } = await supabase
        .from('practice_configs')
        .upsert({
          config_key: clubId,
          club,
          shot_type: shotType,
          power,
          metrics: JSON.parse(JSON.stringify(metrics)),
          user_id: user.id,
        }, { onConflict: 'user_id,config_key' })
        .select();

      if (error) throw error;
      
      // Update storedConfigs to reflect the save
      if (data && data.length > 0) {
        const saved = data[0];
        setStoredConfigs(prev => {
          const existing = prev.find(c => c.configKey === clubId);
          if (existing) {
            return prev.map(c => c.configKey === clubId ? {
              ...c,
              metrics: saved.metrics as unknown as PracticeMetricTarget[],
            } : c);
          }
          return [...prev, {
            id: saved.id,
            configKey: saved.config_key,
            club: saved.club,
            shotType: saved.shot_type,
            power: saved.power,
            metrics: saved.metrics as unknown as PracticeMetricTarget[],
          }];
        });
      }
      
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving config:', getUserFriendlyError(error));
      }
      toast.error('Failed to save configuration. Please try again.');
      return false;
    }
  }, [user]);

  const savePracticeConfig = useCallback(async (club: string, shotType: string, power: string, metrics: PracticeMetricTarget[]) => {
    if (!user) return;

    const configKey = getPracticeConfigKey(club, shotType, power);
    
    try {
      const { data, error } = await supabase
        .from('practice_configs')
        .upsert({
          config_key: configKey,
          club,
          shot_type: shotType,
          power,
          metrics: JSON.parse(JSON.stringify(metrics)),
          user_id: user.id,
        }, { onConflict: 'user_id,config_key' })
        .select()
        .single();

      if (error) throw error;

      const newStoredConfig: StoredPracticeConfig = {
        id: data.id,
        configKey: data.config_key,
        club: data.club,
        shotType: data.shot_type,
        power: data.power,
        metrics: data.metrics as unknown as PracticeMetricTarget[],
      };

      setStoredConfigs(prev => {
        const existing = prev.find(c => c.configKey === configKey);
        if (existing) {
          return prev.map(c => c.configKey === configKey ? newStoredConfig : c);
        }
        return [...prev, newStoredConfig];
      });

      // Update practiceConfigs
      setPracticeConfigs(prev => {
        return prev.map(c => c.clubId === configKey ? { ...c, metrics } : c);
      });

      toast.success('Club/Shot configuration saved');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving config:', getUserFriendlyError(error));
      }
      toast.error('Failed to save configuration. Please try again.');
    }
  }, [user]);

  const deletePracticeConfig = useCallback(async (configKey: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('practice_configs')
        .delete()
        .eq('config_key', configKey)
        .eq('user_id', user.id);

      if (error) throw error;

      setStoredConfigs(prev => prev.filter(c => c.configKey !== configKey));

      // Reset to defaults for this config
      setPracticeConfigs(prev => {
        return prev.map(c => {
          if (c.clubId === configKey) {
            return {
              ...c,
              metrics: DEFAULT_4H_PRACTICE_METRICS.map(m => ({ ...m })),
            };
          }
          return c;
        });
      });

      toast.success('Club/Shot configuration deleted');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting config:', getUserFriendlyError(error));
      }
      toast.error('Failed to delete configuration. Please try again.');
    }
  }, [user]);

  const resetToDefaults = useCallback(() => {
    setPracticeConfigs(DEFAULT_PRACTICE_CONFIGS);
  }, []);

  const addPracticeSession = useCallback(async (session: Omit<PracticeSession, 'id'>) => {
    if (!user) return;

    try {
      // Store metrics and consistency together in the JSONB column
      const metricsPayload = session.consistency 
        ? { metrics: session.metrics, consistency: session.consistency }
        : session.metrics;

      const { data, error } = await supabase
        .from('practice_sessions')
        .insert([{
          club_id: session.clubId,
          session_date: session.date.toISOString().split('T')[0],
          metrics: JSON.parse(JSON.stringify(metricsPayload)),
          notes: session.notes,
          user_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      // Parse back the stored data
      const metricsData = data.metrics as Record<string, unknown>;
      const consistency = metricsData?.consistency as ConsistencyData | undefined;
      const metrics = Array.isArray(metricsData) 
        ? metricsData as unknown as PracticeMetricValue[]
        : (metricsData?.metrics as unknown as PracticeMetricValue[]) || [];

      const newSession: PracticeSession = {
        id: data.id,
        clubId: data.club_id,
        date: new Date(data.session_date),
        metrics,
        notes: data.notes || '',
        consistency,
      };

      setPracticeSessions(prev => [newSession, ...prev]);
      toast.success('Practice session saved');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error adding practice session:', getUserFriendlyError(error));
      }
      toast.error('Failed to save practice session. Please try again.');
    }
  }, [user]);

  const updatePracticeSession = useCallback(async (id: string, updates: Partial<PracticeSession>) => {
    if (!user) return;

    try {
      const updateData: {
        club_id?: string;
        session_date?: string;
        notes?: string;
        metrics?: Database['public']['Tables']['practice_sessions']['Update']['metrics'];
      } = {};
      if (updates.clubId) updateData.club_id = updates.clubId;
      if (updates.date) updateData.session_date = updates.date.toISOString().split('T')[0];
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      // Store metrics and consistency together in the JSONB column
      if (updates.metrics || updates.consistency) {
        // Get current session to merge with updates
        const currentSession = practiceSessions.find(s => s.id === id);
        const metricsPayload = updates.consistency 
          ? { 
              metrics: updates.metrics || currentSession?.metrics || [], 
              consistency: updates.consistency 
            }
          : updates.metrics;
        updateData.metrics = JSON.parse(JSON.stringify(metricsPayload));
      }

      const { error } = await supabase
        .from('practice_sessions')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setPracticeSessions(prev => prev.map(s => 
        s.id === id ? { ...s, ...updates } : s
      ));
      toast.success('Session updated');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating practice session:', getUserFriendlyError(error));
      }
      toast.error('Failed to update session. Please try again.');
    }
  }, [practiceSessions, user]);

  const deletePracticeSession = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('practice_sessions')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      setPracticeSessions(prev => prev.filter(s => s.id !== id));
      toast.success('Session deleted');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting practice session:', getUserFriendlyError(error));
      }
      toast.error('Failed to delete session. Please try again.');
    }
  }, [user]);

  const getSessionsForClub = useCallback((clubId: string) => {
    // Parse the config key to get the base club for legacy data matching
    const { club: baseClub } = parsePracticeConfigKey(clubId);
    
    return practiceSessions
      .filter(s => {
        // Match exact config key OR legacy club-only format (e.g., '4h' matches '4h_full_full')
        return s.clubId === clubId || s.clubId === baseClub;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [practiceSessions]);

  const getLatestSessionForClub = useCallback((clubId: string) => {
    const sessions = getSessionsForClub(clubId);
    return sessions.length > 0 ? sessions[0] : null;
  }, [getSessionsForClub]);


  return (
    <PracticeDataContext.Provider value={{
      practiceConfigs,
      storedConfigs,
      setPracticeConfigs,
      updatePracticeConfig,
      savePracticeConfig,
      deletePracticeConfig,
      resetToDefaults,
      practiceSessions,
      addPracticeSession,
      updatePracticeSession,
      deletePracticeSession,
      getSessionsForClub,
      getLatestSessionForClub,
      
      isLoading,
      selectedClub,
      selectedShotType,
      selectedPower,
      setSelectedClub,
      setSelectedShotType,
      setSelectedPower,
      currentConfigKey,
      hasStoredConfig,
    }}>
      {children}
    </PracticeDataContext.Provider>
  );
}

export function usePracticeData() {
  const context = useContext(PracticeDataContext);
  if (!context) {
    throw new Error('usePracticeData must be used within PracticeDataProvider');
  }
  return context;
}
