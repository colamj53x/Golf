import { useState, useRef, useEffect } from 'react';
import { usePracticeData } from '@/context/PracticeDataContext';
import { PracticeMetricValue, MetricStatus, PracticeSession, ClubPracticeConfig } from '@/types/practice';
import { PRACTICE_CLUBS, getConfigDisplayName } from '@/types/practiceClubs';
import { useEnabledCombos, getEnabledShotTypesForClub, getEnabledPowersForClub } from '@/lib/practiceEnabledCombos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Calendar, Target, TrendingUp, TrendingDown, Minus, Settings, Pencil, ChevronsUpDown, Upload, CheckCircle2, ListFilter, Copy, BarChart3 } from 'lucide-react';

import { format } from 'date-fns';
import { ShotManagementDialog } from '@/components/ShotManagementDialog';
import { PracticeClubInfoSheet } from '@/components/PracticeClubInfoSheet';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { parseSpreadsheet, calculateMetricsFromShots, CalculatedMetrics, PracticeShot } from '@/lib/practiceSpreadsheetParser';
import { usePracticeShots } from '@/hooks/usePracticeShots';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useGolfData } from '@/context/GolfDataContext';
import { getClubConfigId } from '@/lib/golfCalculations';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORY_LABELS: Record<string, string> = {
  distance: 'Distance',
  ball_flight: 'Ball Flight',
  dispersion: 'Dispersion',
  swing: 'Swing',
  tempo: 'Tempo',
};

function getStatusColor(status: MetricStatus): string {
  switch (status) {
    case 'green': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'amber': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'red': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getStatusEmoji(status: MetricStatus): string {
  switch (status) {
    case 'green': return '🟢';
    case 'amber': return '🟡';
    case 'red': return '🔴';
    default: return '⚪';
  }
}

type TrendDirection = 'improving' | 'declining' | 'stable' | 'no-data';

function getTrendIcon(trend: TrendDirection) {
  switch (trend) {
    case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable': return <Minus className="h-4 w-4 text-amber-500" />;
    default: return <span className="text-muted-foreground text-xs">–</span>;
  }
}

function calculateTrend(
  currentValue: PracticeMetricValue | null,
  previousValues: (PracticeMetricValue | null)[],
  higherIsBetter: boolean
): TrendDirection {
  if (!currentValue || (currentValue.valueMin === null && currentValue.valueMax === null)) {
    return 'no-data';
  }

  const currentAvg = currentValue.valueMax !== null && currentValue.valueMin !== null
    ? (currentValue.valueMax + currentValue.valueMin) / 2
    : currentValue.valueMax ?? currentValue.valueMin ?? 0;

  const validPrevious = previousValues.filter(v => v && (v.valueMin !== null || v.valueMax !== null));
  if (validPrevious.length === 0) return 'no-data';

  const prevAvg = validPrevious.reduce((sum, v) => {
    const avg = v!.valueMax !== null && v!.valueMin !== null
      ? (v!.valueMax + v!.valueMin) / 2
      : v!.valueMax ?? v!.valueMin ?? 0;
    return sum + avg;
  }, 0) / validPrevious.length;

  const diff = currentAvg - prevAvg;
  const threshold = Math.abs(prevAvg) * 0.05; // 5% threshold for "stable"

  if (Math.abs(diff) < threshold) return 'stable';
  
  if (higherIsBetter) {
    return diff > 0 ? 'improving' : 'declining';
  } else {
    return diff < 0 ? 'improving' : 'declining';
  }
}

function calculateStatus(
  value: PracticeMetricValue | null,
  targetMin: number | null,
  targetMax: number | null,
  higherIsBetter: boolean,
  tolerancePct = 10,
): MetricStatus {
  // Handle legacy 'value' property from DB alongside valueMin/valueMax
  const rawValue = value as PracticeMetricValue & { value?: number };
  
  // Extract the actual numeric values, accounting for legacy 'value' field
  const legacyValue = rawValue?.value ?? null;
  const effectiveMin = value?.valueMin ?? legacyValue;
  const effectiveMax = value?.valueMax ?? legacyValue;
  
  if (!value || (effectiveMin === null && effectiveMax === null)) {
    return 'amber'; // No data
  }

  // For single-value metrics, use the single value; for ranges, use max for higherIsBetter, min for lowerIsBetter
  const actualValue = higherIsBetter 
    ? (effectiveMax ?? effectiveMin ?? 0)
    : (effectiveMin ?? effectiveMax ?? 0);
  
  const hasRange = effectiveMin !== null && effectiveMax !== null && effectiveMin !== effectiveMax;
  
  if (targetMin === null && targetMax === null) {
    return 'amber'; // No target set
  }

  // Check consistency: if user entered a range, compare spread to target spread
  let consistencyPenalty: MetricStatus | null = null;
  if (hasRange && targetMin !== null && targetMax !== null) {
    const userSpread = Math.abs(effectiveMax! - effectiveMin!);
    const targetSpread = Math.abs(targetMax - targetMin);
    
    // If user's range is significantly wider than target range, penalize
    if (targetSpread > 0) {
      const spreadRatio = userSpread / targetSpread;
      if (spreadRatio >= 2.0) {
        consistencyPenalty = 'red'; // Range is 2x+ wider than target
      } else if (spreadRatio > 1.0) {
        consistencyPenalty = 'amber'; // Range exceeds target spread
      }
    } else {
      // Target is a single value, any range is inconsistent
      const midpoint = (effectiveMin! + effectiveMax!) / 2;
      const spreadPct = (userSpread / midpoint) * 100;
      if (spreadPct > tolerancePct * 1.5) {
        consistencyPenalty = 'red';
      } else if (spreadPct > tolerancePct) {
        consistencyPenalty = 'amber';
      }
    }
  }

  // Calculate value status based on target alignment
  let valueStatus: MetricStatus = 'green';
  
  // For higherIsBetter: above max = excellent (green), below min = bad
  if (higherIsBetter) {
    if (targetMax !== null && actualValue > targetMax) {
      valueStatus = 'green'; // Exceeding target is great
    } else if (targetMin !== null && actualValue >= targetMin && (targetMax === null || actualValue <= targetMax)) {
      valueStatus = 'green'; // Within range
    } else if (targetMin !== null && actualValue < targetMin) {
      // Below minimum is bad
      const deviationPct = (targetMin - actualValue) / targetMin;
      if (deviationPct >= (tolerancePct / 100) * 2) valueStatus = 'red';
      else if (deviationPct >= tolerancePct / 100) valueStatus = 'amber';
      else valueStatus = 'green'; // Very close
    } else {
      valueStatus = 'amber';
    }
  } else {
    // For lowerIsBetter: below max = good, above max = bad
    // Check if there's only a max target (like ≤10)
    if (targetMax !== null && actualValue <= targetMax) {
      valueStatus = 'green'; // Within or below max
    } else if (targetMax !== null && actualValue > targetMax) {
      // Above maximum is bad for lowerIsBetter
      const deviationPct = (actualValue - targetMax) / targetMax;
      if (deviationPct >= (tolerancePct / 100) * 2) valueStatus = 'red';
      else if (deviationPct >= tolerancePct / 100) valueStatus = 'amber';
      else valueStatus = 'green'; // Very close (under 20%)
    } else if (targetMin !== null && actualValue < targetMin) {
      // Below minimum for lowerIsBetter could be too low
      valueStatus = 'amber';
    } else {
      valueStatus = 'amber';
    }
  }

  // Return worst of value status and consistency penalty
  if (consistencyPenalty === 'red' || valueStatus === 'red') return 'red';
  if (consistencyPenalty === 'amber' || valueStatus === 'amber') return 'amber';
  return 'green';
}

function getMetricTolerancePct(
  category: string,
  distanceTolerancePct: number,
  ballFlightTolerancePct: number,
  otherTolerancePct: number,
): number {
  if (category === 'distance') return distanceTolerancePct;
  if (category === 'ball_flight') return ballFlightTolerancePct;
  return otherTolerancePct;
}

export function PracticeDashboardTab() {
  const { user } = useAuth();
  const {
    shots,
    practiceDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    practiceOtherTolerancePct,
  } = useGolfData();
  useEnabledCombos(); // re-render when enabled combos change
  const { 
    practiceConfigs, 
    getSessionsForClub, 
    addPracticeSession, 
    updatePracticeSession, 
    updatePracticeConfig,
    selectedClub,
    selectedShotType,
    selectedPower,
    setSelectedClub,
    setSelectedShotType,
    setSelectedPower,
    currentConfigKey,
  } = usePracticeData();
  
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [isEditSessionOpen, setIsEditSessionOpen] = useState(false);
  const [isEditTargetsOpen, setIsEditTargetsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    distance: true,
    ball_flight: true,
    dispersion: true,
    swing: true,
    tempo: true,
  });
  const [newSessionDate, setNewSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSessionMetrics, setNewSessionMetrics] = useState<Record<string, string>>({});
  const [newSessionNotes, setNewSessionNotes] = useState('');
  const [editSessionDate, setEditSessionDate] = useState('');
  const [editSessionMetrics, setEditSessionMetrics] = useState<Record<string, string>>({});
  const [editSessionNotes, setEditSessionNotes] = useState('');
  const [editTargets, setEditTargets] = useState<Record<string, { min: string; max: string }>>({});
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [calculatedData, setCalculatedData] = useState<CalculatedMetrics | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Store parsed shots for saving after session creation
  const [parsedShots, setParsedShots] = useState<PracticeShot[]>([]);
  
  // Shot management dialog state
  const [shotManagementSession, setShotManagementSession] = useState<PracticeSession | null>(null);
  const [isShotManagementOpen, setIsShotManagementOpen] = useState(false);
  
  // Club info sheet state
  const [isClubInfoSheetOpen, setIsClubInfoSheetOpen] = useState(false);
  
  const config = practiceConfigs.find(c => c.clubId === currentConfigKey);
  const allSessions = getSessionsForClub(currentConfigKey);
  
  // Get last 2 sessions and previous sessions for trend calculation
  const lastTwoSessions = allSessions.slice(0, 2);
  const currentSession = lastTwoSessions[0] || null;
  const previousSession = lastTwoSessions[1] || null;
  const olderSessions = allSessions.slice(2, 4); // Previous 2 for trend comparison

  // Load shots for current + previous 2 + all sessions to compute "within 5% of target" comparisons
  const allSessionIds = allSessions.map(s => s.id);
  const { shotsBySession } = usePracticeShotsBySessions(allSessionIds);
  const currentSessionShots = currentSession ? (shotsBySession[currentSession.id] ?? []) : [];
  const prev2SessionIds = allSessions.slice(1, 3).map(s => s.id);

  // Inline notes editor state (Practice Report card at the bottom)
  const [reportNotes, setReportNotes] = useState<string>(currentSession?.notes ?? '');
  const [reportNotesDirty, setReportNotesDirty] = useState(false);
  const reportNotesSessionId = useRef<string | null>(null);
  useEffect(() => {
    const id = currentSession?.id ?? null;
    if (id !== reportNotesSessionId.current) {
      reportNotesSessionId.current = id;
      setReportNotes(currentSession?.notes ?? '');
      setReportNotesDirty(false);
    }
  }, [currentSession?.id, currentSession?.notes]);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No practice configuration found for this club.</p>
      </div>
    );
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const allExpanded = Object.values(expandedCategories).every(v => v);
  
  const toggleAllCategories = () => {
    const newState = !allExpanded;
    setExpandedCategories({
      distance: newState,
      ball_flight: newState,
      dispersion: newState,
      swing: newState,
      tempo: newState,
    });
  };

  const groupedMetrics = config.metrics.reduce((acc, metric) => {
    if (!acc[metric.category]) acc[metric.category] = [];
    acc[metric.category].push(metric);
    return acc;
  }, {} as Record<string, typeof config.metrics>);

  const toleranceForMetric = (category: string) => getMetricTolerancePct(
    category,
    practiceDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    practiceOtherTolerancePct,
  );

  const handleAddSession = async () => {
    if (!user) {
      toast.error('Sign in to save practice sessions');
      return;
    }

    const baseMetrics: PracticeMetricValue[] = config.metrics.map(m => {
      // Smash Factor is computed, not entered
      const valueStr = m.id === 'smash_factor' ? '' : (newSessionMetrics[m.id] || '');
      const parsed = parseInputValue(valueStr);

      return {
        metricId: m.id,
        valueMin: parsed.min,
        valueMax: parsed.max,
        valueDisplay: valueStr,
      };
    });

    const computedSmash = computeSmashFactorMetricFromMetrics(baseMetrics);
    const metrics = baseMetrics.map(m => (m.metricId === 'smash_factor' && computedSmash) ? computedSmash : m);

    // Store metrics and consistency together in the JSONB column
    const metricsPayload = calculatedData?.consistency 
      ? { metrics, consistency: calculatedData.consistency }
      : metrics;

    try {
      // Insert session and get its ID
      const { data: sessionData, error: sessionError } = await supabase
        .from('practice_sessions')
        .insert([{
          club_id: currentConfigKey,
          session_date: newSessionDate,
          metrics: JSON.parse(JSON.stringify(metricsPayload)),
          notes: newSessionNotes,
          user_id: user.id,
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // If we have parsed shots from spreadsheet, save them
      if (parsedShots.length > 0 && sessionData) {
        const shotsToInsert = parsedShots.map(shot => ({
          session_id: sessionData.id,
          shot_number: shot.shotNumber,
          excluded: false,
          metrics: JSON.parse(JSON.stringify({
            tempo: shot.tempo,
            carry: shot.carry,
            total: shot.total,
            ballSpeed: shot.ballSpeed,
            height: shot.height,
            launchAngle: shot.launchAngle,
            launchDirection: shot.launchDirection,
            carrySide: shot.carrySide,
            backswingTime: shot.backswingTime,
            downswingTime: shot.downswingTime,
            attackAngle: shot.attackAngle,
            swingSpeed: shot.swingSpeed,
            peakHandSpeed: shot.peakHandSpeed,
          })),
          user_id: user.id,
        }));

        const { error: shotsError } = await supabase
          .from('practice_shots')
          .insert(shotsToInsert);

        if (shotsError) {
          console.error('Error saving individual shots:', shotsError);
          toast.error('Session saved but individual shots could not be stored');
        }
      }

      toast.success('Practice session added');
    } catch (error) {
      console.error('Error adding session:', error);
      toast.error('Failed to save practice session');
      return;
    }

    // Reset form state
    setNewSessionMetrics({});
    setNewSessionNotes('');
    setUploadedFile(null);
    setCalculatedData(null);
    setParsedShots([]);
    setIsAddSessionOpen(false);
    
    // Trigger reload of sessions
    window.location.reload();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsProcessing(true);

    try {
      const shots = await parseSpreadsheet(file);
      
      // Store parsed shots for later saving
      setParsedShots(shots);
      
      // Get targets from config
      const distanceTarget = config.metrics.find(m => m.id === 'total_distance');
      const lateralTarget = config.metrics.find(m => m.id === 'avg_lateral_miss');
      
      const distanceMin = distanceTarget?.targetMin ?? 145;
      const lateralMax = lateralTarget?.targetMax ?? 10;

      const calculated = calculateMetricsFromShots(shots, distanceMin, lateralMax);
      setCalculatedData(calculated);

      // Pre-fill the form with calculated values
      const metricsMap: Record<string, string> = {};
      Object.values(calculated.metrics).forEach(m => {
        metricsMap[m.metricId] = m.valueDisplay;
      });
      setNewSessionMetrics(metricsMap);
      setNewSessionNotes(calculated.notes);

      toast.success(`Parsed ${shots.length} shots from spreadsheet`);
    } catch (error) {
      console.error('Error parsing spreadsheet:', error);
      toast.error('Failed to parse spreadsheet. Please check the format.');
      setUploadedFile(null);
      setCalculatedData(null);
      setParsedShots([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setCalculatedData(null);
    setParsedShots([]);
    setNewSessionMetrics({});
    setNewSessionNotes('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  const openShotManagement = (session: PracticeSession) => {
    setShotManagementSession(session);
    setIsShotManagementOpen(true);
  };

  const openEditSession = () => {
    if (!currentSession) return;
    setEditSessionDate(format(currentSession.date, 'yyyy-MM-dd'));
    const metricsMap: Record<string, string> = {};
    currentSession.metrics.forEach(m => {
      metricsMap[m.metricId] = m.valueDisplay;
    });
    setEditSessionMetrics(metricsMap);
    setEditSessionNotes(currentSession.notes);
    setIsEditSessionOpen(true);
  };

  const handleEditSession = () => {
    if (!currentSession) return;

    const baseMetrics: PracticeMetricValue[] = config.metrics.map(m => {
      // Smash Factor is computed, not entered
      const valueStr = m.id === 'smash_factor' ? '' : (editSessionMetrics[m.id] || '');
      const parsed = parseInputValue(valueStr);

      return {
        metricId: m.id,
        valueMin: parsed.min,
        valueMax: parsed.max,
        valueDisplay: valueStr,
      };
    });

    const computedSmash = computeSmashFactorMetricFromMetrics(baseMetrics);
    const metrics = baseMetrics.map(m => (m.metricId === 'smash_factor' && computedSmash) ? computedSmash : m);

    updatePracticeSession(currentSession.id, {
      date: new Date(editSessionDate),
      metrics,
      notes: editSessionNotes,
    });

    setIsEditSessionOpen(false);
    toast.success('Session updated');
  };

  const openEditTargets = () => {
    if (!config) return;
    const targets: Record<string, { min: string; max: string }> = {};
    config.metrics.forEach(m => {
      targets[m.id] = {
        min: m.targetMin !== null ? String(m.targetMin) : '',
        max: m.targetMax !== null ? String(m.targetMax) : '',
      };
    });
    setEditTargets(targets);
    setIsEditTargetsOpen(true);
  };

  const handleSaveTargets = async () => {
    if (!config) return;
    
    // Calculate Smash Factor targets from Ball Speed and Swing Speed
    const ballSpeedMin = parseFloat(editTargets['ball_speed']?.min || '0');
    const ballSpeedMax = parseFloat(editTargets['ball_speed']?.max || '0');
    const swingSpeedMin = parseFloat(editTargets['swing_speed']?.min || '0');
    const swingSpeedMax = parseFloat(editTargets['swing_speed']?.max || '0');
    
    let smashFactorMin: number | null = null;
    let smashFactorMax: number | null = null;
    if (ballSpeedMin > 0 && swingSpeedMax > 0) {
      smashFactorMin = parseFloat((ballSpeedMin / swingSpeedMax).toFixed(2));
    }
    if (ballSpeedMax > 0 && swingSpeedMin > 0) {
      smashFactorMax = parseFloat((ballSpeedMax / swingSpeedMin).toFixed(2));
    }
    
    const updatedMetrics = config.metrics.map(m => {
      // For Smash Factor, use calculated values
      if (m.id === 'smash_factor') {
        let targetDisplay = '–';
        if (smashFactorMin !== null && smashFactorMax !== null) {
          targetDisplay = `${smashFactorMin}–${smashFactorMax}`;
        } else if (smashFactorMin !== null) {
          targetDisplay = `≥${smashFactorMin}`;
        } else if (smashFactorMax !== null) {
          targetDisplay = `≤${smashFactorMax}`;
        }
        return {
          ...m,
          targetMin: smashFactorMin,
          targetMax: smashFactorMax,
          targetDisplay,
        };
      }
      
      const target = editTargets[m.id];
      const targetMin = target?.min ? parseFloat(target.min) : null;
      const targetMax = target?.max ? parseFloat(target.max) : null;
      
      let targetDisplay = '–';
      if (targetMin !== null && targetMax !== null) {
        targetDisplay = `${targetMin}–${targetMax}`;
      } else if (targetMin !== null) {
        targetDisplay = `≥${targetMin}`;
      } else if (targetMax !== null) {
        targetDisplay = `≤${targetMax}`;
      }
      
      return {
        ...m,
        targetMin: isNaN(targetMin as number) ? null : targetMin,
        targetMax: isNaN(targetMax as number) ? null : targetMax,
        targetDisplay,
      };
    });

    const success = await updatePracticeConfig(currentConfigKey, updatedMetrics);
    setIsEditTargetsOpen(false);
    if (success) {
      toast.success('Targets saved successfully');
    }
  };

  // Helper to extract numeric value from metric (handles legacy 'value' field)
  const getMetricValues = (metric: PracticeMetricValue | undefined): { min: number | null; max: number | null } => {
    if (!metric) return { min: null, max: null };
    const rawMetric = metric as PracticeMetricValue & { value?: number };
    const legacyValue = rawMetric.value ?? null;
    return {
      min: metric.valueMin ?? legacyValue,
      max: metric.valueMax ?? legacyValue,
    };
  };

  // Parse user input like "123", "120–125", "120-125" into numbers
  const parseInputValue = (valueStr: string): { min: number | null; max: number | null } => {
    const raw = (valueStr || '').trim();
    if (!raw) return { min: null, max: null };

    // Support either en-dash or hyphen
    if (raw.includes('–') || raw.includes('-')) {
      const parts = raw.split(/[–-]/).map(s => parseFloat(s.trim()));
      const min = isNaN(parts[0]) ? null : parts[0];
      const max = isNaN(parts[1]) ? null : parts[1];
      return { min, max };
    }

    const val = parseFloat(raw);
    if (isNaN(val)) return { min: null, max: null };
    return { min: val, max: val };
  };

  const avgFromMinMax = (v: { min: number | null; max: number | null }) => {
    if (v.min === null && v.max === null) return null;
    if (v.min !== null && v.max !== null) return (v.min + v.max) / 2;
    return v.max ?? v.min;
  };

  const computeSmashFactorMetricFromMetrics = (metrics: PracticeMetricValue[]): PracticeMetricValue | null => {
    const ball = metrics.find(m => m.metricId === 'ball_speed');
    const swing = metrics.find(m => m.metricId === 'swing_speed');

    const ballAvg = avgFromMinMax(getMetricValues(ball));
    const swingAvg = avgFromMinMax(getMetricValues(swing));

    if (ballAvg === null || swingAvg === null || swingAvg <= 0) return null;

    const smash = Math.round((ballAvg / swingAvg) * 100) / 100;
    return {
      metricId: 'smash_factor',
      valueMin: smash,
      valueMax: smash,
      valueDisplay: smash.toFixed(2),
    };
  };

  const computeSmashFactorDisplayFromInputs = (metricsMap: Record<string, string>) => {
    const ballAvg = avgFromMinMax(parseInputValue(metricsMap['ball_speed'] || ''));
    const swingAvg = avgFromMinMax(parseInputValue(metricsMap['swing_speed'] || ''));
    if (ballAvg === null || swingAvg === null || swingAvg <= 0) return '–';
    return (Math.round((ballAvg / swingAvg) * 100) / 100).toFixed(2);
  };

  const getSessionMetricValue = (session: PracticeSession | null, metricId: string): PracticeMetricValue | null => {
    if (!session) return null;

    const stored = session.metrics.find(m => m.metricId === metricId) || null;

    if (metricId !== 'smash_factor') return stored;

    // If Smash Factor isn't stored (or is blank), compute it from ball_speed / swing_speed
    if (stored && (stored.valueMin !== null || stored.valueMax !== null || (stored.valueDisplay || '').trim())) {
      return stored;
    }

    return computeSmashFactorMetricFromMetrics(session.metrics);
  };

  // Calculate consistency scores for a single session
  const calculateSessionConsistency = (session: PracticeSession | null) => {
    if (!session) return { distance: null, lateral: null, best: null, overall: null };

    // Use stored consistency data if available (from spreadsheet upload)
    if (session.consistency) {
      return {
        distance: session.consistency.distancePct,
        lateral: session.consistency.lateralPct,
        best: session.consistency.bestPct,
        overall: session.consistency.overallScore,
      };
    }

    const totalDistanceMetric = session.metrics.find(m => m.metricId === 'total_distance');
    const lateralMissMetric = session.metrics.find(m => m.metricId === 'avg_lateral_miss');
    
    const totalDistanceValue = getMetricValues(totalDistanceMetric);
    const lateralMissValue = getMetricValues(lateralMissMetric);
    
    const distanceTarget = config.metrics.find(m => m.id === 'total_distance');
    const lateralTarget = config.metrics.find(m => m.id === 'avg_lateral_miss');

    // Distance Consistency: % of shots in target distance range
    let distanceConsistency: number | null = null;
    if (totalDistanceValue.min !== null && distanceTarget?.targetMin !== null && distanceTarget?.targetMax !== null) {
      const targetMin = distanceTarget.targetMin;
      const targetMax = distanceTarget.targetMax;
      
      const userMin = totalDistanceValue.min;
      const userMax = totalDistanceValue.max ?? totalDistanceValue.min;
      
      if (userMin !== null && userMax !== null) {
        const overlapMin = Math.max(userMin, targetMin);
        const overlapMax = Math.min(userMax, targetMax);
        const userRange = userMax - userMin;
        
        if (userRange === 0) {
          distanceConsistency = (userMin >= targetMin && userMin <= targetMax) ? 100 : 0;
        } else if (overlapMax >= overlapMin) {
          const overlapRange = overlapMax - overlapMin;
          distanceConsistency = Math.min(100, Math.round((overlapRange / userRange) * 100));
        } else {
          distanceConsistency = 0;
        }
      }
    }

    // Lateral Consistency: % within the lateral miss target
    let lateralConsistency: number | null = null;
    if (lateralMissValue.min !== null && lateralTarget?.targetMax !== null) {
      const targetMax = lateralTarget.targetMax;
      
      const userMin = lateralMissValue.min;
      const userMax = lateralMissValue.max ?? lateralMissValue.min;
      
      if (userMin !== null && userMax !== null) {
        if (userMax <= targetMax) {
          lateralConsistency = 100;
        } else if (userMin > targetMax) {
          lateralConsistency = 0;
        } else {
          const userRange = userMax - userMin;
          const inRangeRange = targetMax - userMin;
          lateralConsistency = Math.round((inRangeRange / userRange) * 100);
        }
      }
    }

    // Best Shots: % that have BOTH in range
    let bestConsistency: number | null = null;
    if (distanceConsistency !== null && lateralConsistency !== null) {
      bestConsistency = Math.round((distanceConsistency / 100) * (lateralConsistency / 100) * 100);
    }

    // Overall Consistency Score: weighted average
    let overallScore: number | null = null;
    if (distanceConsistency !== null && lateralConsistency !== null) {
      overallScore = Math.round((distanceConsistency + lateralConsistency) / 2);
    } else if (distanceConsistency !== null) {
      overallScore = distanceConsistency;
    } else if (lateralConsistency !== null) {
      overallScore = lateralConsistency;
    }

    return {
      distance: distanceConsistency,
      lateral: lateralConsistency,
      best: bestConsistency,
      overall: overallScore,
    };
  };

  // Calculate 3-session rolling average consistency scores
  // Only include sessions that have shot-by-shot data (consistency data from spreadsheet)
  const calculateRollingConsistency = () => {
    // Filter to only sessions that have consistency data (from spreadsheet upload)
    const sessionsWithConsistencyData = allSessions.filter(s => s.consistency !== undefined);
    const recentSessions = sessionsWithConsistencyData.slice(0, 3); // Most recent 3 with data
    
    if (recentSessions.length === 0) return { distance: null, lateral: null, best: null, overall: null, sessionCount: 0 };

    const sessionScores = recentSessions.map(s => calculateSessionConsistency(s));
    
    const avgScore = (key: 'distance' | 'lateral' | 'best' | 'overall') => {
      const validScores = sessionScores.map(s => s[key]).filter((v): v is number => v !== null);
      if (validScores.length === 0) return null;
      return Math.round(validScores.reduce((sum, v) => sum + v, 0) / validScores.length);
    };

    return {
      distance: avgScore('distance'),
      lateral: avgScore('lateral'),
      best: avgScore('best'),
      overall: avgScore('overall'),
      sessionCount: recentSessions.length,
    };
  };

  const currentConsistencyScores = calculateSessionConsistency(currentSession);
  const rollingConsistencyScores = calculateRollingConsistency();

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-muted/50';
    if (score >= 80) return 'bg-green-500/10 border-green-500/20';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const clubReport = buildClubPracticeReport(
    config,
    currentSession,
    previousSession,
    allSessions,
    shotsBySession,
    currentConfigKey,
    shots,
    practiceDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    practiceOtherTolerancePct,
  );

  const reportCard = currentSession ? (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Club Report</CardTitle>
        <CardDescription>
          {clubReport.title} • Latest session {format(currentSession.date, 'dd MMM yyyy')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <p className={
            'text-sm font-medium ' + (
              clubReport.tone === 'positive' ? 'text-green-600'
              : clubReport.tone === 'negative' ? 'text-red-600'
              : 'text-foreground'
            )
          }>
            {clubReport.headline}
          </p>
          {clubReport.bullets.length > 0 && (
            <ul className="space-y-1.5">
              {clubReport.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-sm leading-snug">
                  <span className={
                    'shrink-0 font-semibold ' + (
                      b.tone === 'positive' ? 'text-green-600'
                      : b.tone === 'negative' ? 'text-red-600'
                      : 'text-muted-foreground'
                    )
                  }>{b.label}:</span>
                  <span className="text-muted-foreground">{b.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="space-y-6 animate-fade-in">



      {/* Club/Shot/Power Selector */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Select Club</CardTitle>
              <CardDescription className="mt-1">
                {getConfigDisplayName(currentConfigKey)} • {allSessions.length} session{allSessions.length !== 1 ? 's' : ''} recorded
                {currentSession && ` • Last: ${format(currentSession.date, 'dd MMM yyyy')}`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Club</label>
                <Select value={selectedClub} onValueChange={setSelectedClub}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select club" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRACTICE_CLUBS.map(club => (
                      <SelectItem key={club.id} value={club.id}>{club.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Shot Type</label>
                <Select value={selectedShotType} onValueChange={setSelectedShotType}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {getEnabledShotTypesForClub(selectedClub).map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Power</label>
                <Select value={selectedPower} onValueChange={setSelectedPower}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Select power" />
                  </SelectTrigger>
                  <SelectContent>
                    {getEnabledPowersForClub(selectedClub, selectedShotType).map(power => (
                      <SelectItem key={power.id} value={power.id}>{power.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsClubInfoSheetOpen(true)}
              >
                <BarChart3 className="h-4 w-4" />
                View Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={toggleAllCategories}
              >
                <ChevronsUpDown className="h-4 w-4" />
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={openEditTargets}>
                <Settings className="h-4 w-4" />
                Edit Targets
              </Button>
              <Button size="sm" className="gap-2" onClick={() => setIsAddSessionOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Session
              </Button>
              {currentSession && (
                <Button variant="outline" size="sm" className="gap-2" onClick={openEditSession}>
                  <Pencil className="h-4 w-4" />
                  Edit Last
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={isEditTargetsOpen} onOpenChange={setIsEditTargetsOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Metric Targets</DialogTitle>
                <DialogDescription>
                  Set target ranges for {config.clubName} practice metrics
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {Object.entries(groupedMetrics).map(([category, metrics]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABELS[category]}
                    </h4>
                    <div className="space-y-2">
                    {metrics.map(metric => {
                        // Get current session value for this metric
                        const currentMetric = currentSession?.metrics.find(m => m.metricId === metric.id);
                        const hasCurrentValue = currentMetric && (currentMetric.valueMin !== null || currentMetric.valueMax !== null);
                        
                        const handleUseCurrent = () => {
                          if (!currentMetric) return;
                          const minVal = currentMetric.valueMin !== null ? String(currentMetric.valueMin) : '';
                          const maxVal = currentMetric.valueMax !== null ? String(currentMetric.valueMax) : minVal;
                          setEditTargets(prev => ({
                            ...prev,
                            [metric.id]: { min: minVal, max: maxVal }
                          }));
                        };

                        // Auto-calculate Smash Factor from Ball Speed and Swing Speed targets
                        const isSmashFactor = metric.id === 'smash_factor';
                        let calculatedSmashMin = '';
                        let calculatedSmashMax = '';
                        if (isSmashFactor) {
                          const ballSpeedMin = parseFloat(editTargets['ball_speed']?.min || '0');
                          const ballSpeedMax = parseFloat(editTargets['ball_speed']?.max || '0');
                          const swingSpeedMin = parseFloat(editTargets['swing_speed']?.min || '0');
                          const swingSpeedMax = parseFloat(editTargets['swing_speed']?.max || '0');
                          
                          if (ballSpeedMin > 0 && swingSpeedMax > 0) {
                            calculatedSmashMin = (ballSpeedMin / swingSpeedMax).toFixed(2);
                          }
                          if (ballSpeedMax > 0 && swingSpeedMin > 0) {
                            calculatedSmashMax = (ballSpeedMax / swingSpeedMin).toFixed(2);
                          }
                        }
                        
                        return (
                        <div key={metric.id} className="grid grid-cols-[1fr,100px,100px,32px,40px] items-center gap-2">
                          <label className="text-sm">{metric.metricName} {isSmashFactor && <span className="text-xs text-muted-foreground">(auto)</span>}</label>
                          {metric.id === 'bias_direction' ? (
                            <>
                              <Input
                                placeholder="e.g. Draw, Fade, Neutral"
                                value={editTargets[metric.id]?.min || ''}
                                onChange={(e) => setEditTargets(prev => ({
                                  ...prev,
                                  [metric.id]: { min: e.target.value, max: e.target.value }
                                }))}
                                className="h-8 text-sm col-span-2"
                              />
                            </>
                          ) : isSmashFactor ? (
                            <>
                              <Input
                                placeholder="Min"
                                value={calculatedSmashMin || '–'}
                                readOnly
                                className="h-8 text-sm bg-muted"
                                title="Auto-calculated from Ball Speed / Swing Speed"
                              />
                              <Input
                                placeholder="Max"
                                value={calculatedSmashMax || '–'}
                                readOnly
                                className="h-8 text-sm bg-muted"
                                title="Auto-calculated from Ball Speed / Swing Speed"
                              />
                            </>
                          ) : (
                            <>
                              <Input
                                placeholder="Min"
                                value={editTargets[metric.id]?.min || ''}
                                onChange={(e) => setEditTargets(prev => ({
                                  ...prev,
                                  [metric.id]: { ...prev[metric.id], min: e.target.value }
                                }))}
                                className="h-8 text-sm"
                              />
                              <Input
                                placeholder="Max"
                                value={editTargets[metric.id]?.max || ''}
                                onChange={(e) => setEditTargets(prev => ({
                                  ...prev,
                                  [metric.id]: { ...prev[metric.id], max: e.target.value }
                                }))}
                                className="h-8 text-sm"
                              />
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleUseCurrent}
                            disabled={!hasCurrentValue || isSmashFactor}
                            title={isSmashFactor ? "Auto-calculated" : (hasCurrentValue ? "Use current session value as target" : "No current session data")}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <span className="text-xs text-muted-foreground">{metric.unit}</span>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditTargetsOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveTargets}>Save Targets</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddSessionOpen} onOpenChange={setIsAddSessionOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Practice Session</DialogTitle>
                <DialogDescription>
                  Upload a spreadsheet to auto-calculate metrics, or enter values manually
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* File Upload Section */}
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="spreadsheet-upload"
                  />
                  {!uploadedFile ? (
                    <label
                      htmlFor="spreadsheet-upload"
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-medium">Upload Spreadsheet</span>
                      <span className="text-xs text-muted-foreground">
                        Drop an Excel file (.xlsx) or click to browse
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isProcessing ? (
                          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        )}
                        <span className="text-sm font-medium">{uploadedFile.name}</span>
                        {calculatedData && (
                          <Badge variant="secondary">
                            {calculatedData.consistency.totalShots} shots
                          </Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearUpload}>
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                {/* Consistency Scores Preview */}
                {calculatedData && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h4 className="text-sm font-semibold mb-2">Calculated Consistency Scores</h4>
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Distance</p>
                        <p className={`font-bold ${calculatedData.consistency.distancePct >= 80 ? 'text-green-500' : calculatedData.consistency.distancePct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                          {calculatedData.consistency.distancePct}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {calculatedData.consistency.distanceCount}/{calculatedData.consistency.totalShots}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lateral</p>
                        <p className={`font-bold ${calculatedData.consistency.lateralPct >= 80 ? 'text-green-500' : calculatedData.consistency.lateralPct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                          {calculatedData.consistency.lateralPct}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {calculatedData.consistency.lateralCount}/{calculatedData.consistency.totalShots}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Best Shots</p>
                        <p className={`font-bold ${calculatedData.consistency.bestPct >= 80 ? 'text-green-500' : calculatedData.consistency.bestPct >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                          {calculatedData.consistency.bestPct}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {calculatedData.consistency.bestCount}/{calculatedData.consistency.totalShots}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Overall</p>
                        <p className={`font-bold text-lg ${calculatedData.consistency.overallScore >= 80 ? 'text-green-500' : calculatedData.consistency.overallScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                          {calculatedData.consistency.overallScore}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium min-w-[80px]">Date</label>
                  <Input
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-48"
                  />
                </div>
                
                {Object.entries(groupedMetrics).map(([category, metrics]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {CATEGORY_LABELS[category]}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        {metrics.map(metric => (
                          <div key={metric.id} className="flex items-center gap-2">
                            <label className="text-sm min-w-[120px]">{metric.metricName}</label>
                            {metric.id === 'smash_factor' ? (
                              <Input
                                value={computeSmashFactorDisplayFromInputs(newSessionMetrics)}
                                disabled
                                className="h-8 text-sm"
                              />
                            ) : (
                              <Input
                                placeholder={metric.targetDisplay}
                                value={newSessionMetrics[metric.id] || ''}
                                onChange={(e) => setNewSessionMetrics(prev => ({
                                  ...prev,
                                  [metric.id]: e.target.value
                                }))}
                                className="h-8 text-sm"
                              />
                            )}
                            <span className="text-xs text-muted-foreground">{metric.unit}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Session Notes</label>
                  <Textarea
                    placeholder="Any observations, conditions, or focus areas..."
                    value={newSessionNotes}
                    onChange={(e) => setNewSessionNotes(e.target.value)}
                    rows={8}
                    className="min-h-[200px]"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddSessionOpen(false)}>Cancel</Button>
                <Button onClick={handleAddSession}>Save Session</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Edit Last Session */}
          {currentSession && (
            <Dialog open={isEditSessionOpen} onOpenChange={setIsEditSessionOpen}>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Practice Session</DialogTitle>
                  <DialogDescription>
                    Update metrics for session on {format(currentSession.date, 'dd MMM yyyy')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-4">
                    <label className="text-sm font-medium min-w-[80px]">Date</label>
                    <Input
                      type="date"
                      value={editSessionDate}
                      onChange={(e) => setEditSessionDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  
                  {Object.entries(groupedMetrics).map(([category, metrics]) => (
                    <div key={category} className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {CATEGORY_LABELS[category]}
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        {metrics.map(metric => (
                          <div key={metric.id} className="flex items-center gap-2">
                            <label className="text-sm min-w-[120px]">{metric.metricName}</label>
                            {metric.id === 'smash_factor' ? (
                              <Input
                                value={computeSmashFactorDisplayFromInputs(editSessionMetrics)}
                                disabled
                                className="h-8 text-sm"
                              />
                            ) : (
                              <Input
                                placeholder={metric.targetDisplay}
                                value={editSessionMetrics[metric.id] || ''}
                                onChange={(e) => setEditSessionMetrics(prev => ({
                                  ...prev,
                                  [metric.id]: e.target.value
                                }))}
                                className="h-8 text-sm"
                              />
                            )}
                            <span className="text-xs text-muted-foreground">{metric.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Session Notes</label>
                    <Textarea
                      placeholder="Any observations, conditions, or focus areas..."
                      value={editSessionNotes}
                      onChange={(e) => setEditSessionNotes(e.target.value)}
                      rows={8}
                      className="min-h-[200px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditSessionOpen(false)}>Cancel</Button>
                  <Button onClick={handleEditSession}>Update Session</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

      {/* Consistency Score Card */}
      {currentSession && (
        <Card className={`border ${getScoreBg(currentConsistencyScores.overall)}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Consistency Score</CardTitle>
            <CardDescription>
              Current session vs 3-session rolling average
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {/* Distance */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Distance</p>
                <div className="flex items-center justify-center gap-2">
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(currentConsistencyScores.distance)}`}>
                      {currentConsistencyScores.distance !== null ? `${currentConsistencyScores.distance}%` : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Current</p>
                  </div>
                  <div className="text-muted-foreground/50 text-sm">/</div>
                  <div>
                    <p className={`text-lg font-medium ${getScoreColor(rollingConsistencyScores.distance)}`}>
                      {rollingConsistencyScores.distance !== null ? `${rollingConsistencyScores.distance}%` : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">3-Avg</p>
                  </div>
                </div>
              </div>
              {/* Lateral */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Lateral</p>
                <div className="flex items-center justify-center gap-2">
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(currentConsistencyScores.lateral)}`}>
                      {currentConsistencyScores.lateral !== null ? `${currentConsistencyScores.lateral}%` : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Current</p>
                  </div>
                  <div className="text-muted-foreground/50 text-sm">/</div>
                  <div>
                    <p className={`text-lg font-medium ${getScoreColor(rollingConsistencyScores.lateral)}`}>
                      {rollingConsistencyScores.lateral !== null ? `${rollingConsistencyScores.lateral}%` : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">3-Avg</p>
                  </div>
                </div>
              </div>
              {/* Best Shots */}
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Best Shots</p>
                <div className="flex items-center justify-center gap-2">
                  <div>
                    <p className={`text-2xl font-bold ${getScoreColor(currentConsistencyScores.best)}`}>
                      {currentConsistencyScores.best !== null ? `${currentConsistencyScores.best}%` : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Current</p>
                  </div>
                  <div className="text-muted-foreground/50 text-sm">/</div>
                  <div>
                    <p className={`text-lg font-medium ${getScoreColor(rollingConsistencyScores.best)}`}>
                      {rollingConsistencyScores.best !== null ? `${rollingConsistencyScores.best}%` : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">3-Avg</p>
                  </div>
                </div>
              </div>
              {/* Overall */}
              <div className="text-center border-l pl-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Overall</p>
                <div className="flex items-center justify-center gap-2">
                  <div>
                    <p className={`text-3xl font-bold ${getScoreColor(currentConsistencyScores.overall)}`}>
                      {currentConsistencyScores.overall !== null ? currentConsistencyScores.overall : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Current</p>
                  </div>
                  <div className="text-muted-foreground/50 text-sm">/</div>
                  <div>
                    <p className={`text-xl font-medium ${getScoreColor(rollingConsistencyScores.overall)}`}>
                      {rollingConsistencyScores.overall !== null ? rollingConsistencyScores.overall : '–'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">3-Avg</p>
                  </div>
                </div>
              </div>
            </div>
            {rollingConsistencyScores.sessionCount !== undefined && rollingConsistencyScores.sessionCount < 3 && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                Rolling average based on {rollingConsistencyScores.sessionCount} session{rollingConsistencyScores.sessionCount !== 1 ? 's' : ''} (need 3 for full average)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Club report */}
      {reportCard}

      {/* Last Two Sessions Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Performance Comparison – Last 2 Sessions
          </CardTitle>
          <CardDescription>
            {currentSession && previousSession
              ? `Comparing ${format(currentSession.date, 'dd MMM')} vs ${format(previousSession.date, 'dd MMM yyyy')}`
              : currentSession
              ? `Latest session: ${format(currentSession.date, 'dd MMM yyyy')}`
              : 'No sessions recorded yet'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(groupedMetrics).map(([category, metrics]) => (
              <Collapsible
                key={category}
                open={expandedCategories[category]}
                onOpenChange={() => toggleCategory(category)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-md hover:bg-muted/50 transition-colors">
                  {expandedCategories[category] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-semibold text-sm uppercase tracking-wide">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <Badge variant="outline" className="ml-2">
                    {metrics.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="overflow-x-auto mt-2">
                    <table className="data-table w-full">
                      <thead>
                        <tr>
                          <th className="min-w-[140px]">Metric</th>
                          <th className="min-w-[100px]">Current</th>
                          <th className="min-w-[100px]">Previous</th>
                          <th className="min-w-[100px]">Target</th>
                          <th className="min-w-[60px]">Status</th>
                          <th className="min-w-[60px]">Trend</th>
                          <th className="min-w-[90px]" title="Current session shots inside the metric tolerance window">In Target</th>
                          <th className="min-w-[110px]" title="Change in In Target vs the average of the previous 2 sessions">vs Last 2</th>
                          <th className="min-w-[110px]" title="Change in In Target vs the average across all sessions">vs All</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.map(metric => {
                          const currentValue = getSessionMetricValue(currentSession, metric.id);
                          const previousValue = getSessionMetricValue(previousSession, metric.id);
                          const olderValues = olderSessions.map(s => getSessionMetricValue(s, metric.id));
                          const tolerancePct = toleranceForMetric(metric.category);

                          const currentStatus = calculateStatus(currentValue, metric.targetMin, metric.targetMax, metric.higherIsBetter, tolerancePct);
                          const trend = calculateTrend(currentValue, [previousValue, ...olderValues], metric.higherIsBetter);
                          const withinTarget = pctWithinTarget(metric.id, currentSessionShots as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct);

                          // Average within-5% across the previous 2 sessions
                          const prev2Values = prev2SessionIds
                            .map(id => pctWithinTarget(metric.id, (shotsBySession[id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct))
                            .filter((v): v is number => v !== null);
                          const prev2Avg = prev2Values.length ? prev2Values.reduce((a, b) => a + b, 0) / prev2Values.length : null;

                          // Average within-5% across ALL sessions except current
                          const allOtherValues = allSessionIds
                            .filter(id => id !== currentSession?.id)
                            .map(id => pctWithinTarget(metric.id, (shotsBySession[id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct))
                            .filter((v): v is number => v !== null);
                          const allAvg = allOtherValues.length ? allOtherValues.reduce((a, b) => a + b, 0) / allOtherValues.length : null;

                          return (
                            <tr key={metric.id}>
                              <td className="font-medium">{metric.metricName}</td>
                              <td>
                                {currentValue?.valueDisplay || '–'}
                                {metric.unit && currentValue?.valueDisplay && (
                                  <span className="text-muted-foreground ml-1">{metric.unit}</span>
                                )}
                              </td>
                              <td className="text-muted-foreground">
                                {previousValue?.valueDisplay || '–'}
                                {metric.unit && previousValue?.valueDisplay && (
                                  <span className="ml-1">{metric.unit}</span>
                                )}
                              </td>
                              <td className="text-muted-foreground">
                                {metric.targetDisplay}
                                {metric.unit && metric.targetDisplay !== '–' && (
                                  <span className="ml-1">{metric.unit}</span>
                                )}
                              </td>
                              <td className="text-center">
                                <span className="text-lg" title={`${tolerancePct}% tolerance`}>{getStatusEmoji(currentStatus)}</span>
                              </td>
                              <td className="text-center">
                                <div className="flex items-center justify-center" title={`Trend: ${trend}`}>
                                  {getTrendIcon(trend)}
                                </div>
                              </td>
                              <td className="text-center text-sm">
                                {withinTarget === null ? (
                                  <span className="text-muted-foreground">–</span>
                                ) : (
                                  <span className={
                                    withinTarget >= 70 ? 'text-green-600 font-medium'
                                    : withinTarget >= 40 ? 'text-amber-600'
                                    : 'text-red-600'
                                  }>{withinTarget}%</span>
                                )}
                              </td>
                              <td className="text-center text-sm">{renderDelta(withinTarget, prev2Avg)}</td>
                              <td className="text-center text-sm">{renderDelta(withinTarget, allAvg)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Sessions History */}
      {allSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              All Sessions
            </CardTitle>
            <CardDescription>
              {allSessions.length} session{allSessions.length !== 1 ? 's' : ''} recorded
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allSessions.map((session, index) => {
                const prevSession = allSessions[index + 1] || null;
                const olderForTrend = allSessions.slice(index + 1, index + 3);
                
                return (
                  <div key={session.id} className="p-3 rounded-lg bg-muted/30 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{format(session.date, 'EEEE, dd MMM yyyy')}</p>
                        {index === 0 && <Badge variant="outline" className="text-xs">Latest</Badge>}
                        {index === 1 && <Badge variant="outline" className="text-xs">Previous</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Manage Shots button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => openShotManagement(session)}
                        >
                          <ListFilter className="h-3 w-3" />
                          Shots
                        </Button>
                        {/* Status summary badges */}
                        {(() => {
                          const statuses = session.metrics.map(m => {
                            const target = config.metrics.find(t => t.id === m.metricId);
                            if (!target) return null;
                            return calculateStatus(m, target.targetMin, target.targetMax, target.higherIsBetter, toleranceForMetric(target.category));
                          }).filter(Boolean);
                          
                          const greenCount = statuses.filter(s => s === 'green').length;
                          const amberCount = statuses.filter(s => s === 'amber').length;
                          const redCount = statuses.filter(s => s === 'red').length;

                          return (
                            <>
                              {greenCount > 0 && <Badge className={getStatusColor('green')}>{greenCount} 🟢</Badge>}
                              {amberCount > 0 && <Badge className={getStatusColor('amber')}>{amberCount} 🟡</Badge>}
                              {redCount > 0 && <Badge className={getStatusColor('red')}>{redCount} 🔴</Badge>}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    {session.notes && (
                      <p className="text-sm text-muted-foreground mb-2">{session.notes}</p>
                    )}
                    {/* Trend indicators for this session vs previous */}
                    {prevSession && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {config.metrics.slice(0, 6).map(metric => {
                          const currentVal = session.metrics.find(m => m.metricId === metric.id) || null;
                          const prevVals = [
                            prevSession?.metrics.find(m => m.metricId === metric.id) || null,
                            ...olderForTrend.map(s => s.metrics.find(m => m.metricId === metric.id) || null)
                          ];
                          const trend = calculateTrend(currentVal, prevVals, metric.higherIsBetter);
                          
                          if (trend === 'no-data') return null;
                          
                          return (
                            <div key={metric.id} className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                              <span className="text-muted-foreground">{metric.metricName}:</span>
                              {getTrendIcon(trend)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {currentSession && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Latest Session Notes</label>
                    <Button
                      size="sm"
                      variant={reportNotesDirty ? 'default' : 'outline'}
                      disabled={!reportNotesDirty}
                      onClick={async () => {
                        await updatePracticeSession(currentSession.id, { notes: reportNotes });
                        setReportNotesDirty(false);
                      }}
                    >
                      Save notes
                    </Button>
                  </div>
                  <Textarea
                    value={reportNotes}
                    onChange={(e) => { setReportNotes(e.target.value); setReportNotesDirty(true); }}
                    placeholder="What worked, what did not, swing thoughts, conditions..."
                    rows={4}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Shot Management Dialog */}
      <ShotManagementDialog
        open={isShotManagementOpen}
        onOpenChange={setIsShotManagementOpen}
        session={shotManagementSession}
        distanceTargetMin={config.metrics.find(m => m.id === 'total_distance')?.targetMin ?? 145}
        lateralTargetMax={config.metrics.find(m => m.id === 'avg_lateral_miss')?.targetMax ?? 10}
      />
      
      {/* Club Info Sheet */}
      <PracticeClubInfoSheet
        open={isClubInfoSheetOpen}
        onOpenChange={setIsClubInfoSheetOpen}
        configKey={currentConfigKey}
        metrics={config.metrics}
        sessions={allSessions}
      />

      {/* Practice Report at bottom — once notes have been saved for the latest session */}
      
    </div>
  );
}

// Per-shot accessor: maps metric id → raw value from a shot (or null if not applicable)
function getShotMetricValue(metricId: string, shot: { metrics: Record<string, unknown> }): number | null {
  const m = shot.metrics as Record<string, number | string | undefined>;
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
  switch (metricId) {
    case 'carry': return num(m.carry);
    case 'total_distance': return num(m.total);
    case 'ball_speed': return num(m.ballSpeed);
    case 'peak_height': return num(m.height);
    case 'launch_angle': return num(m.launchAngle);
    case 'launch_direction': return num(m.launchDirection);
    case 'avg_lateral_miss': {
      const v = num(m.carrySide);
      return v === null ? null : Math.abs(v);
    }
    case 'attack_angle': return num(m.attackAngle);
    case 'swing_speed': return num(m.swingSpeed);
    case 'peak_hand_speed': return num(m.peakHandSpeed);
    case 'backswing_time': return num(m.backswingTime);
    case 'downswing_time': return num(m.downswingTime);
    case 'smash_factor': {
      const bs = num(m.ballSpeed); const ss = num(m.swingSpeed);
      return bs !== null && ss && ss > 0 ? bs / ss : null;
    }
    case 'tempo_ratio': {
      const t = m.tempo;
      if (typeof t === 'number') return t;
      if (typeof t === 'string') {
        const match = t.match(/^([\d.]+)\s*:\s*1$/);
        if (match) return parseFloat(match[1]);
        const n = parseFloat(t);
        return Number.isNaN(n) ? null : n;
      }
      return null;
    }
    // Aggregate-only metrics (variation, bias, furthest/shortest) have no per-shot equivalent
    default: return null;
  }
}

// % of shots within the configured tolerance around the target band [targetMin, targetMax].
// Special case for variation metrics: % of shots whose carry/total falls within a
// window of width = target band (e.g. 20m, 30m), centred on the session mean.
// Returns null when not computable (no shots, no target, or metric is aggregate-only).
function pctWithinTarget(
  metricId: string,
  shots: Array<{ metrics: Record<string, unknown> }>,
  targetMin: number | null,
  targetMax: number | null,
  tolerancePct = 5,
): number | null {
  if (!shots || shots.length === 0) return null;
  if (targetMin === null && targetMax === null) return null;

  // Variation metrics: window of width=band centred on mean of the underlying distance values
  if (metricId === 'carry_variation' || metricId === 'total_variation') {
    const band = Math.max(Math.abs(targetMin ?? 0), Math.abs(targetMax ?? 0));
    if (!band || band <= 0) return null;
    const underlyingId = metricId === 'carry_variation' ? 'carry' : 'total_distance';
    const vals: number[] = [];
    for (const s of shots) {
      const v = getShotMetricValue(underlyingId, s);
      if (v !== null) vals.push(v);
    }
    if (vals.length === 0) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const half = band / 2;
    const hits = vals.filter(v => Math.abs(v - mean) <= half).length;
    return Math.round((hits / vals.length) * 100);
  }

  const tMin = targetMin ?? targetMax!;
  const tMax = targetMax ?? targetMin!;
  const tol = Math.max(Math.abs(tMin), Math.abs(tMax)) * (tolerancePct / 100);
  const lo = Math.min(tMin, tMax) - tol;
  const hi = Math.max(tMin, tMax) + tol;

  let considered = 0;
  let hits = 0;
  for (const shot of shots) {
    const v = getShotMetricValue(metricId, shot);
    if (v === null) continue;
    considered++;
    if (v >= lo && v <= hi) hits++;
  }
  if (considered === 0) return null;
  return Math.round((hits / considered) * 100);
}

// Render a comparison delta for "In Target" (higher = better). Green up = better, red down = worse.
function renderDelta(current: number | null, baseline: number | null): JSX.Element {
  if (current === null || baseline === null) {
    return <span className="text-muted-foreground">–</span>;
  }
  const diff = Math.round(current - baseline);
  if (diff === 0) {
    return <span className="text-muted-foreground" title={`Baseline ${baseline.toFixed(0)}%`}>= 0pp</span>;
  }
  const better = diff > 0;
  const arrow = better ? '▲' : '▼';
  const cls = better ? 'text-green-600 font-medium' : 'text-red-600 font-medium';
  const sign = better ? '+' : '';
  return (
    <span className={cls} title={`Baseline ${baseline.toFixed(0)}%`}>
      {arrow} {sign}{diff}pp
    </span>
  );
}

// Dynamic commentary helpers
function getCommentary(
  metricId: string, 
  status: MetricStatus, 
  value: PracticeMetricValue,
  targetMin: number | null,
  targetMax: number | null,
  higherIsBetter: boolean,
  trend: TrendDirection
): string {
  // Handle legacy 'value' property from DB alongside valueMin/valueMax
  const rawValue = value as PracticeMetricValue & { value?: number };
  const legacyValue = rawValue?.value ?? null;
  const effectiveMin = value.valueMin ?? legacyValue;
  const effectiveMax = value.valueMax ?? legacyValue;
  
  const actualValue = effectiveMax ?? effectiveMin ?? 0;
  const displayValue = value.valueDisplay || String(actualValue);
  
  // Check for inconsistency: if user entered a range (min ≠ max), compare spread
  let inconsistencyText = '';
  if (effectiveMin !== null && effectiveMax !== null && effectiveMin !== effectiveMax) {
    const userSpread = Math.abs(effectiveMax - effectiveMin);
    
    // Compare against target spread if available
    if (targetMin !== null && targetMax !== null) {
      const targetSpread = Math.abs(targetMax - targetMin);
      if (targetSpread > 0 && userSpread > targetSpread * 1.5) {
        // User spread is 50%+ wider than target spread
        const spreadRatio = Math.round((userSpread / targetSpread) * 100 - 100);
        inconsistencyText = `Range is ${spreadRatio}% wider than target – inconsistent striking.`;
      } else if (userSpread > targetSpread) {
        inconsistencyText = `Slight inconsistency – range wider than target.`;
      }
    } else {
      // No target range to compare, use absolute thresholds
      const midpoint = (effectiveMin! + effectiveMax!) / 2;
      const spreadPct = (userSpread / midpoint) * 100;
      if (spreadPct > 15) {
        inconsistencyText = `${Math.round(spreadPct)}% spread – tighten up consistency.`;
      } else if (spreadPct > 10) {
        inconsistencyText = `Mild inconsistency (${Math.round(spreadPct)}% spread).`;
      }
    }
  }
  
  // Calculate deviation from target — show absolute gap (clearer than %) plus % in parens
  let deviationText = '';
  if (status !== 'green' && targetMin !== null && targetMax !== null) {
    const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
    if (actualValue > targetMax) {
      const gap = actualValue - targetMax;
      const pct = targetMax > 0 ? Math.round((gap / targetMax) * 100) : 0;
      deviationText = `${fmt(gap)} above the ${fmt(targetMax)} target` + (pct > 0 ? ` (${pct}% over)` : '');
    } else if (actualValue < targetMin) {
      const gap = targetMin - actualValue;
      const pct = targetMin > 0 ? Math.round((gap / targetMin) * 100) : 0;
      deviationText = `${fmt(gap)} below the ${fmt(targetMin)} target` + (pct > 0 ? ` (${pct}% under)` : '');
    }
  }

  // Status-aware trend connector: "but" only when trend contrasts status
  const trendText = (() => {
    if (trend === 'stable') return 'and holding steady';
    if (status === 'green') {
      return trend === 'improving' ? 'and still improving' : trend === 'declining' ? 'but trending down' : '';
    }
    // amber / red
    return trend === 'improving' ? 'but improving' : trend === 'declining' ? 'and getting worse' : '';
  })();

  const joinTrend = (s: string) => (trendText ? `${s} ${trendText}.` : `${s}.`);

  // Build dynamic commentary based on status
  if (status === 'green') {
    let base: string;
    if (higherIsBetter && targetMax !== null && actualValue > targetMax) {
      base = `Excellent at ${displayValue} – exceeding target`;
    } else {
      base = `On target at ${displayValue}`;
    }
    const out = joinTrend(base);
    return inconsistencyText ? `${out} ${inconsistencyText}` : out;
  }

  if (status === 'amber') {
    const base = `${displayValue} – ${deviationText || 'just outside target'}`;
    const out = joinTrend(base) + ' Minor adjustment needed.';
    return inconsistencyText ? `${out} ${inconsistencyText}` : out;
  }

  if (status === 'red') {
    const base = `${displayValue} – ${deviationText || 'well off target'}`;
    const out = joinTrend(base) + ' Needs focused attention.';
    return inconsistencyText ? `${out} ${inconsistencyText}` : out;
  }

  return 'No data available.';
}

function getTips(
  metricId: string, 
  status: MetricStatus,
  value: PracticeMetricValue | null,
  targetMin: number | null,
  targetMax: number | null,
  higherIsBetter: boolean
): string {
  if (status === 'green') return 'Maintain current approach.';
  
  const actualValue = value?.valueMax ?? value?.valueMin ?? 0;
  
  // Dynamic tips based on deviation direction and metric type
  const metricTips: Record<string, { low: string; high: string }> = {
    carry: { 
      low: 'Shallow AoA to improve strike and add distance.', 
      high: 'Club up or reduce swing effort.' 
    },
    total_distance: { 
      low: 'Focus on center-face contact for more rollout.', 
      high: 'Control swing speed; avoid overswing.' 
    },
    ball_speed: { 
      low: 'Foot-spray drill for centre-face strikes.', 
      high: 'Good energy transfer – maintain it.' 
    },
    peak_height: { 
      low: 'Add loft at address or steepen AoA slightly.', 
      high: 'Shallow strike – sweep, do not dig.' 
    },
    launch_angle: { 
      low: 'Ball position forward; increase dynamic loft.', 
      high: 'Ball position back; reduce AoA.' 
    },
    launch_direction: { 
      low: 'Check alignment – may be aiming left.', 
      high: 'Alignment gate at 3m to fix push-start.' 
    },
    avg_lateral_miss: { 
      low: 'Good dispersion control.', 
      high: 'Rotate chest earlier to reduce block pattern.' 
    },
    consistency_score: { 
      low: 'Add variation drills for adaptability.', 
      high: 'Towel drill 6cm ahead for consistent low-point.' 
    },
    attack_angle: { 
      low: 'May need steeper angle for this club.', 
      high: '3-ball drill + shallow feel to reduce dig.' 
    },
    swing_speed: { 
      low: 'Build speed gradually; maintain tempo.', 
      high: 'Dial back 5% – control over power.' 
    },
    peak_hand_speed: { 
      low: 'Focus on smooth acceleration through impact.', 
      high: 'Release timing good – maintain rhythm.' 
    },
    backswing_time: { 
      low: 'Slightly quicker takeaway if too slow.', 
      high: 'Slow takeaway by 5% for better timing.' 
    },
    downswing_time: { 
      low: 'May need more acceleration.', 
      high: "'Pause and fall' transition for better sequence." 
    },
    tempo_ratio: { 
      low: 'Backswing may be too quick relative to downswing.', 
      high: "Count '1–2–3 hit' to balance tempo." 
    },
  };

  const tips = metricTips[metricId];
  if (!tips) return 'Review technique and practice deliberately.';
  
  // Determine if we're low or high relative to target
  if (higherIsBetter) {
    // For higherIsBetter, below target means we need 'low' tip
    if (targetMin !== null && actualValue < targetMin) {
      return tips.low;
    }
    return tips.high;
  } else {
    // For lowerIsBetter, above target means we need 'high' tip
    if (targetMax !== null && actualValue > targetMax) {
      return tips.high;
    }
    return tips.low;
  }
}

// Structured report for the latest session of the current club.
// Returns a tight headline + a few sharp bullets. No fluff.
export type PracticeReportBullet = {
  label: string;
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
};
export type PracticeReport = {
  title: string;
  headline: string;
  tone: 'positive' | 'negative' | 'neutral';
  bullets: PracticeReportBullet[];
};

function buildClubPracticeReport(
  config: ClubPracticeConfig | undefined,
  currentSession: PracticeSession | null,
  previousSession: PracticeSession | null,
  allSessions: PracticeSession[],
  shotsBySession: Record<string, Array<{ metrics: Record<string, unknown>; excluded: boolean }>>,
  configKey: string,
  courseShots: Array<{ club: string; date: Date; endLie: string }>,
  distanceTolerancePct: number,
  ballFlightTolerancePct: number,
  otherTolerancePct: number,
): PracticeReport {
  const clubName = (() => {
    try { return getConfigDisplayName(configKey); } catch { return configKey; }
  })();

  if (!config || !currentSession) {
    return {
      title: clubName,
      headline: 'No session logged yet for this club.',
      tone: 'neutral',
      bullets: [{ label: 'Next step', text: 'Upload or add a session to start tracking carry, dispersion and consistency.', tone: 'neutral' }],
    };
  }

  const getVal = (session: PracticeSession | null, id: string): PracticeMetricValue | null => {
    if (!session) return null;
    return session.metrics.find(m => m.metricId === id) ?? null;
  };

  const currentShots = (shotsBySession[currentSession.id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>;
  const prevSessions = allSessions.filter(s => s.id !== currentSession.id);
  const prev2 = prevSessions.slice(0, 2);
  const [baseClub] = configKey.split('_');
  const matchingCourseShots = courseShots.filter(shot => getClubConfigId(shot.club) === baseClub);
  const roundCount = new Set(courseShots.map(shot => format(shot.date, 'yyyy-MM-dd'))).size;
  const coursePerRound = roundCount ? matchingCourseShots.length / roundCount : 0;
  const safeCourseShots = matchingCourseShots.filter(shot => {
    const lie = shot.endLie.toLowerCase();
    return lie.includes('fairway') || lie.includes('green') || lie.includes('fringe') || lie.includes('hole');
  }).length;
  const dependability = matchingCourseShots.length ? Math.round((safeCourseShots / matchingCourseShots.length) * 100) : null;

  type MetricLine = {
    name: string;
    current: number;
    prev2Avg: number | null;
    histBest: number | null;
    histCount: number;
    delta2: number | null;
    status: MetricStatus;
  };

  const lines: MetricLine[] = [];
  for (const metric of config.metrics) {
    const v = getVal(currentSession, metric.id);
    const tolerancePct = getMetricTolerancePct(metric.category, distanceTolerancePct, ballFlightTolerancePct, otherTolerancePct);
    const status = v ? calculateStatus(v, metric.targetMin, metric.targetMax, metric.higherIsBetter, tolerancePct) : 'amber';
    const cur = pctWithinTarget(metric.id, currentShots, metric.targetMin, metric.targetMax, tolerancePct);
    if (cur === null) continue;

    const prev2Vals = prev2
      .map(s => pctWithinTarget(metric.id, (shotsBySession[s.id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct))
      .filter((x): x is number => x !== null);
    const prev2Avg = prev2Vals.length ? prev2Vals.reduce((a, b) => a + b, 0) / prev2Vals.length : null;

    const histVals = prevSessions
      .map(s => pctWithinTarget(metric.id, (shotsBySession[s.id] ?? []) as unknown as Array<{ metrics: Record<string, unknown> }>, metric.targetMin, metric.targetMax, tolerancePct))
      .filter((x): x is number => x !== null);
    const histBest = histVals.length ? Math.max(...histVals) : null;

    lines.push({
      name: metric.metricName,
      current: cur,
      prev2Avg,
      histBest,
      histCount: histVals.length,
      delta2: prev2Avg !== null ? cur - prev2Avg : null,
      status,
    });
  }

  const avgWithin = lines.length
    ? Math.round(lines.reduce((s, l) => s + l.current, 0) / lines.length)
    : null;

  let headline: string;
  let tone: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (avgWithin === null) {
    let green = 0, amber = 0, red = 0;
    for (const metric of config.metrics) {
      const v = getVal(currentSession, metric.id);
      if (!v) continue;
      const tolerancePct = getMetricTolerancePct(metric.category, distanceTolerancePct, ballFlightTolerancePct, otherTolerancePct);
      const status = calculateStatus(v, metric.targetMin, metric.targetMax, metric.higherIsBetter, tolerancePct);
      if (status === 'green') green++;
      else if (status === 'amber') amber++;
      else if (status === 'red') red++;
    }
    const scored = green + amber + red;
    if (scored === 0) {
      headline = 'No values logged for this session yet.';
    } else {
      headline = `${green} green · ${amber} amber · ${red} red across ${scored} metrics (no per-shot data — consistency % unavailable).`;
      tone = red > green ? 'negative' : green > red ? 'positive' : 'neutral';
    }
  } else if (avgWithin >= 70) {
    headline = `Solid session for ${clubName} — across the metrics tracked, ${avgWithin}% of your shots landed inside their target windows, which is a strong base to build on.`;
    tone = 'positive';
  } else if (avgWithin >= 45) {
    headline = `Mixed session for ${clubName} — about ${avgWithin}% of your shots fell inside their target windows, so there were good patches but also clear gaps to tighten up.`;
    tone = 'neutral';
  } else {
    headline = `Poor session for ${clubName} — only ${avgWithin}% of your shots stayed inside their target windows, which means most numbers drifted outside where you want them.`;
    tone = 'negative';
  }

  const improved = lines.filter(l => l.delta2 !== null && l.delta2 >= 5)
    .sort((a, b) => (b.delta2 ?? 0) - (a.delta2 ?? 0)).slice(0, 2);
  const slipped = lines.filter(l => l.delta2 !== null && l.delta2 <= -5)
    .sort((a, b) => (a.delta2 ?? 0) - (b.delta2 ?? 0)).slice(0, 2);
  const focus = lines.filter(l => l.status !== 'green' && l.current < 50)
    .sort((a, b) => a.current - b.current).slice(0, 2);
  const personalBests = lines.filter(l => l.histCount >= 1 && l.histBest !== null && l.current > (l.histBest as number))
    .sort((a, b) => b.current - a.current).slice(0, 2);
  const strongest = lines.filter(l => l.current >= 70)
    .sort((a, b) => b.current - a.current).slice(0, 2);

  const bullets: PracticeReportBullet[] = [];
  const list = (arr: MetricLine[], fn: (l: MetricLine) => string) =>
    arr.map(fn).join(arr.length === 2 ? ' and ' : ', ');

  if (matchingCourseShots.length) {
    bullets.push({
      label: 'Course use',
      text: `${clubName} shows up about ${coursePerRound.toFixed(1)} time${coursePerRound === 1 ? '' : 's'} per round across ${matchingCourseShots.length} on-course shots, so this practice has ${coursePerRound >= 1 ? 'high' : coursePerRound >= 0.4 ? 'medium' : 'lower'} playing relevance.`,
      tone: coursePerRound >= 1 ? 'negative' : 'neutral',
    });
    bullets.push({
      label: 'Dependability',
      text: dependability === null
        ? 'There is not enough on-course outcome data to judge dependability yet.'
        : `${dependability}% of on-course shots finished in a playable result, so use the practice metrics alongside that real-course reliability.`,
      tone: dependability !== null && dependability >= 65 ? 'positive' : dependability !== null && dependability < 45 ? 'negative' : 'neutral',
    });
  }

  if (improved.length) {
    bullets.push({
      label: 'Improved',
      text: `You moved forward on ${list(improved, l => `${l.name} (up ${Math.round(l.delta2 as number)}pp to ${l.current}% in target)`)} compared with your last couple of sessions, so whatever you changed there is working.`,
      tone: 'positive',
    });
  } else if (strongest.length) {
    bullets.push({
      label: 'Strengths',
      text: `Your strongest numbers this session were ${list(strongest, l => `${l.name} at ${l.current}% in target`)}, which is where this club is currently most reliable.`,
      tone: 'positive',
    });
  }

  if (personalBests.length) {
    bullets.push({
      label: 'Personal best',
      text: `You set a new personal best for ${list(personalBests, l => `${l.name} at ${l.current}% in target`)} — the highest you've recorded for this club, so lock in whatever you did today.`,
      tone: 'positive',
    });
  }

  const priority = focus[0] ?? slipped[0] ?? null;
  if (priority) {
    const dropTxt = priority.delta2 !== null && priority.delta2 < 0
      ? `, which is down ${Math.abs(Math.round(priority.delta2))}pp on your recent average`
      : '';
    bullets.push({
      label: 'Focus next',
      text: `Your weakest area was ${priority.name} at just ${priority.current}% of shots inside the target window${dropTxt}, so make that the priority next time out.`,
      tone: 'negative',
    });
    const second = focus[1] ?? slipped[1];
    if (second && second !== priority) {
      const sd = second.delta2 !== null && second.delta2 < 0
        ? `, also down ${Math.abs(Math.round(second.delta2))}pp on recent form`
        : '';
      bullets.push({
        label: 'Also watch',
        text: `Keep an eye on ${second.name} too — only ${second.current}% landed inside target${sd}, so it needs attention before it becomes a real problem.`,
        tone: 'negative',
      });
    }
  } else if (avgWithin !== null && avgWithin >= 70) {
    bullets.push({ label: 'Action', text: 'There is nothing obvious to fix in this session — keep the same routine, tempo and setup and bank another one just like it.', tone: 'positive' });
  }

  if (!previousSession && avgWithin !== null) {
    bullets.push({ label: 'Baseline', text: 'This is the first logged session for this club, so treat the numbers above as your baseline — every future session will be measured against today.', tone: 'neutral' });
  }

  return { title: clubName, headline, tone, bullets };
}
