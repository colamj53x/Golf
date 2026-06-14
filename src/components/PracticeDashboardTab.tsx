import { useState, useRef, useEffect, useMemo } from 'react';
import { usePracticeData } from '@/context/PracticeDataContext';
import { PracticeMetricValue, MetricStatus, PracticeSession, ClubPracticeConfig } from '@/types/practice';
import { PRACTICE_CLUBS, getConfigDisplayName } from '@/types/practiceClubs';
import { useShotProfiles } from '@/lib/shotProfiles';
import { getEnabledShotFamilyOptions, getEnabledSwingEffortOptions } from '@/lib/shotOptions';
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
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { useGolfData } from '@/context/GolfDataContext';
import { pctWithinTarget } from '@/lib/practiceConsistency';
import {
  calculateStatus,
  calculateTrend,
  computeSmashFactorDisplayFromInputs,
  computeSmashFactorMetricFromMetrics,
  getMetricTolerancePct,
  getMetricValues,
  getSessionMetricValue,
  parseInputValue,
  type TrendDirection,
} from '@/lib/practiceDashboardDomain';
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

function getTrendIcon(trend: TrendDirection) {
  switch (trend) {
    case 'improving': return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'declining': return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable': return <Minus className="h-4 w-4 text-amber-500" />;
    default: return <span className="text-muted-foreground text-xs">–</span>;
  }
}

export function PracticeDashboardTab() {
  const {
    shots,
    practiceDistanceTolerancePct,
    practiceBallFlightTolerancePct,
    practiceOtherTolerancePct,
  } = useGolfData();
  const shotProfiles = useShotProfiles();
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
  const shotTypeOptions = useMemo(
    () => getEnabledShotFamilyOptions(shotProfiles, selectedClub, 'practice'),
    [selectedClub, shotProfiles],
  );
  const powerOptions = useMemo(
    () => getEnabledSwingEffortOptions(shotProfiles, selectedClub, selectedShotType, 'practice'),
    [selectedClub, selectedShotType, shotProfiles],
  );
  
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

  useEffect(() => {
    if (!shotTypeOptions.length || shotTypeOptions.some((option) => option.value === selectedShotType)) return;
    setSelectedShotType(shotTypeOptions[0].value);
  }, [selectedShotType, setSelectedShotType, shotTypeOptions]);

  useEffect(() => {
    if (!powerOptions.length || powerOptions.some((option) => option.value === selectedPower)) return;
    setSelectedPower(powerOptions[0].value);
  }, [powerOptions, selectedPower, setSelectedPower]);
  
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

    const sessionId = await addPracticeSession({
      clubId: currentConfigKey,
      date: new Date(newSessionDate),
      metrics,
      notes: newSessionNotes,
      consistency: calculatedData?.consistency,
    }, parsedShots);
    if (!sessionId) return;

    // Reset form state
    setNewSessionMetrics({});
    setNewSessionNotes('');
    setUploadedFile(null);
    setCalculatedData(null);
    setParsedShots([]);
    setIsAddSessionOpen(false);
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
          <div className="flex flex-wrap items-end gap-3">
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
                  {shotTypeOptions.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
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
                  {powerOptions.map(power => (
                    <SelectItem key={power.value} value={power.value}>{power.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
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
