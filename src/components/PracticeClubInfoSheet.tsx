import React, { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  Activity, 
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CircleDot,
  Download,
  Loader2,
  Gauge
} from 'lucide-react';
import { PracticeSession, PracticeMetricTarget, PracticeMetricValue, ConsistencyData } from '@/types/practice';
import { getConfigDisplayName } from '@/types/practiceClubs';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PracticeClubInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configKey: string;
  metrics: PracticeMetricTarget[];
  sessions: PracticeSession[];
}

const CATEGORY_LABELS: Record<string, string> = {
  distance: 'Distance',
  ball_flight: 'Ball Flight',
  dispersion: 'Dispersion',
  swing: 'Swing',
  tempo: 'Tempo',
};

function StatRow({ 
  label, 
  target,
  current,
  previous,
  unit,
  higherIsBetter
}: { 
  label: string; 
  target: string;
  current: string | null;
  previous: string | null;
  unit: string;
  higherIsBetter: boolean;
}) {
  const getTrend = () => {
    if (!current || !previous) return null;
    const currVal = parseFloat(current.split('–')[0]);
    const prevVal = parseFloat(previous.split('–')[0]);
    if (isNaN(currVal) || isNaN(prevVal)) return null;
    
    const diff = currVal - prevVal;
    if (Math.abs(diff) < 0.5) return 'stable';
    const isImproving = higherIsBetter ? diff > 0 : diff < 0;
    return isImproving ? 'improving' : 'declining';
  };
  
  const trend = getTrend();
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground min-w-[60px] text-right">{target}</span>
        <span className="text-sm font-medium min-w-[70px] text-right">
          {current ?? '–'}{current && unit ? ` ${unit}` : ''}
        </span>
        <div className="w-5">
          {trend === 'improving' && <TrendingUp className="h-4 w-4 text-green-500" />}
          {trend === 'declining' && <TrendingDown className="h-4 w-4 text-red-500" />}
          {trend === 'stable' && <Minus className="h-4 w-4 text-muted-foreground" />}
          {!trend && <span className="text-muted-foreground">–</span>}
        </div>
      </div>
    </div>
  );
}

function ConsistencyBadge({ score, label }: { score: number | null; label: string }) {
  const getColor = () => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };
  
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${getColor()}`}>
        {score !== null ? `${score}%` : '–'}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function InsightItem({ type, children }: { type: 'strength' | 'weakness' | 'neutral'; children: React.ReactNode }) {
  const Icon = type === 'strength' ? CheckCircle2 : type === 'weakness' ? XCircle : CircleDot;
  const colorClass = type === 'strength' ? 'text-green-500' : type === 'weakness' ? 'text-red-500' : 'text-muted-foreground';
  
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
      <span className="text-sm">{children}</span>
    </div>
  );
}

export function PracticeClubInfoSheet({
  open,
  onOpenChange,
  configKey,
  metrics,
  sessions,
}: PracticeClubInfoSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const clubDisplayName = getConfigDisplayName(configKey);
  
  const currentSession = sessions[0] || null;
  const previousSession = sessions[1] || null;
  const allSessionsWithConsistency = sessions.filter(s => s.consistency !== undefined);
  
  // Calculate averages across all sessions
  const averages = useMemo(() => {
    if (sessions.length === 0) return null;
    
    const avgValues: Record<string, { sum: number; count: number }> = {};
    
    sessions.forEach(session => {
      session.metrics.forEach(m => {
        if (!avgValues[m.metricId]) {
          avgValues[m.metricId] = { sum: 0, count: 0 };
        }
        const val = m.valueMax ?? m.valueMin;
        if (val !== null) {
          avgValues[m.metricId].sum += val;
          avgValues[m.metricId].count += 1;
        }
      });
    });
    
    const result: Record<string, number> = {};
    Object.entries(avgValues).forEach(([id, { sum, count }]) => {
      if (count > 0) {
        result[id] = Math.round((sum / count) * 10) / 10;
      }
    });
    
    return result;
  }, [sessions]);
  
  // Calculate consistency averages
  const consistencyAverages = useMemo(() => {
    if (allSessionsWithConsistency.length === 0) return null;
    
    let distanceSum = 0, lateralSum = 0, bestSum = 0, overallSum = 0;
    
    allSessionsWithConsistency.forEach(s => {
      if (s.consistency) {
        distanceSum += s.consistency.distancePct;
        lateralSum += s.consistency.lateralPct;
        bestSum += s.consistency.bestPct;
        overallSum += s.consistency.overallScore;
      }
    });
    
    const count = allSessionsWithConsistency.length;
    return {
      distance: Math.round(distanceSum / count),
      lateral: Math.round(lateralSum / count),
      best: Math.round(bestSum / count),
      overall: Math.round(overallSum / count),
    };
  }, [allSessionsWithConsistency]);
  
  // Generate insights
  const insights = useMemo(() => {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const trends: string[] = [];
    
    if (!currentSession || sessions.length < 2) {
      return { strengths, weaknesses, trends };
    }
    
    // Check consistency scores
    if (currentSession.consistency) {
      if (currentSession.consistency.distancePct >= 80) {
        strengths.push('Excellent distance consistency');
      } else if (currentSession.consistency.distancePct < 60) {
        weaknesses.push('Distance consistency needs work');
      }
      
      if (currentSession.consistency.lateralPct >= 80) {
        strengths.push('Great lateral accuracy');
      } else if (currentSession.consistency.lateralPct < 60) {
        weaknesses.push('Lateral dispersion is too wide');
      }
    }
    
    // Check specific metrics against targets
    metrics.forEach(metric => {
      const currentValue = currentSession.metrics.find(m => m.metricId === metric.id);
      const prevValue = previousSession?.metrics.find(m => m.metricId === metric.id);
      
      if (!currentValue || currentValue.valueMax === null) return;
      
      const val = currentValue.valueMax;
      
      // Check if within target
      if (metric.targetMin !== null && metric.targetMax !== null) {
        if (val >= metric.targetMin && val <= metric.targetMax) {
          if (metric.category === 'distance' && metric.id === 'total_distance') {
            strengths.push(`${metric.metricName} is on target`);
          }
        } else if (metric.higherIsBetter && val < metric.targetMin) {
          weaknesses.push(`${metric.metricName} below target (${val} vs ${metric.targetMin}+)`);
        } else if (!metric.higherIsBetter && val > metric.targetMax) {
          weaknesses.push(`${metric.metricName} above target (${val} vs ≤${metric.targetMax})`);
        }
      }
      
      // Check trends
      if (prevValue && prevValue.valueMax !== null) {
        const diff = val - prevValue.valueMax;
        if (Math.abs(diff) > 2) {
          const improving = metric.higherIsBetter ? diff > 0 : diff < 0;
          if (improving) {
            trends.push(`${metric.metricName} improved by ${Math.abs(diff).toFixed(1)}`);
          } else if (sessions.length >= 3) {
            trends.push(`${metric.metricName} declined by ${Math.abs(diff).toFixed(1)}`);
          }
        }
      }
    });
    
    // Limit insights
    return {
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 4),
      trends: trends.slice(0, 3),
    };
  }, [currentSession, previousSession, metrics, sessions.length]);
  
  const getMetricValue = (session: PracticeSession | null, metricId: string): string | null => {
    if (!session) return null;
    const metric = session.metrics.find(m => m.metricId === metricId);
    if (!metric) return null;
    return metric.valueDisplay || null;
  };
  
  const groupedMetrics = useMemo(() => {
    return metrics.reduce((acc, m) => {
      if (!acc[m.category]) acc[m.category] = [];
      acc[m.category].push(m);
      return acc;
    }, {} as Record<string, PracticeMetricTarget[]>);
  }, [metrics]);
  
  const exportToPDF = async () => {
    if (!contentRef.current) return;
    
    setIsExporting(true);
    
    try {
      const content = contentRef.current;
      
      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const pageHeight = pdfHeight - 20;
      
      if (scaledHeight <= pageHeight) {
        pdf.addImage(imgData, 'PNG', imgX, 10, scaledWidth, scaledHeight);
      } else {
        let yPosition = 0;
        const pageImgHeight = (pageHeight / ratio);
        
        while (yPosition < imgHeight) {
          const sourceY = yPosition;
          const sourceHeight = Math.min(pageImgHeight, imgHeight - yPosition);
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sourceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0, sourceY, imgWidth, sourceHeight,
              0, 0, imgWidth, sourceHeight
            );
          }
          
          const pageImgData = pageCanvas.toDataURL('image/png');
          const displayHeight = (sourceHeight / imgHeight) * scaledHeight;
          
          if (yPosition > 0) {
            pdf.addPage();
          }
          
          pdf.addImage(pageImgData, 'PNG', imgX, 10, scaledWidth, displayHeight);
          yPosition += sourceHeight;
        }
      }
      
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`practice-${configKey.replace(/_/g, '-')}-report-${date}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <BarChart3 className="h-6 w-6 text-primary" />
                {clubDisplayName} Practice Report
              </DialogTitle>
              <DialogDescription>
                Analysis based on {sessions.length} session{sessions.length !== 1 ? 's' : ''}
                {currentSession && ` • Last session: ${format(currentSession.date, 'dd MMM yyyy')}`}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={isExporting || sessions.length === 0}
              className="gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div ref={contentRef} className="space-y-6 pt-4 bg-background">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No practice sessions recorded yet.</p>
                <p className="text-sm text-muted-foreground mt-1">Add a session to see your performance report.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Consistency Scores */}
              {(currentSession?.consistency || consistencyAverages) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-primary" />
                      Consistency Scores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <ConsistencyBadge 
                        score={currentSession?.consistency?.distancePct ?? null} 
                        label="Distance" 
                      />
                      <ConsistencyBadge 
                        score={currentSession?.consistency?.lateralPct ?? null} 
                        label="Lateral" 
                      />
                      <ConsistencyBadge 
                        score={currentSession?.consistency?.bestPct ?? null} 
                        label="Best Shots" 
                      />
                      <ConsistencyBadge 
                        score={currentSession?.consistency?.overallScore ?? null} 
                        label="Overall" 
                      />
                    </div>
                    
                    {consistencyAverages && allSessionsWithConsistency.length >= 2 && (
                      <div className="pt-3 border-t">
                        <div className="text-xs text-muted-foreground mb-2">
                          Average across {allSessionsWithConsistency.length} sessions:
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div className="text-sm font-medium">{consistencyAverages.distance}%</div>
                          <div className="text-sm font-medium">{consistencyAverages.lateral}%</div>
                          <div className="text-sm font-medium">{consistencyAverages.best}%</div>
                          <div className="text-sm font-medium">{consistencyAverages.overall}%</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Key Insights */}
              {(insights.strengths.length > 0 || insights.weaknesses.length > 0 || insights.trends.length > 0) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Key Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Strengths
                        </h4>
                        {insights.strengths.length > 0 ? (
                          insights.strengths.map((s, i) => <InsightItem key={i} type="strength">{s}</InsightItem>)
                        ) : (
                          <p className="text-sm text-muted-foreground">More data needed</p>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          Areas to Improve
                        </h4>
                        {insights.weaknesses.length > 0 ? (
                          insights.weaknesses.map((w, i) => <InsightItem key={i} type="weakness">{w}</InsightItem>)
                        ) : (
                          <p className="text-sm text-muted-foreground">No major issues identified</p>
                        )}
                      </div>
                    </div>
                    
                    {insights.trends.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Recent Trends
                        </h4>
                        {insights.trends.map((t, i) => <InsightItem key={i} type="neutral">{t}</InsightItem>)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Metrics by Category */}
              <div className="grid md:grid-cols-2 gap-4">
                {Object.entries(groupedMetrics).map(([category, categoryMetrics]) => (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{CATEGORY_LABELS[category] || category}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-2 pr-5">
                        <span>Metric</span>
                        <div className="flex gap-3">
                          <span className="min-w-[60px] text-right">Target</span>
                          <span className="min-w-[70px] text-right">Current</span>
                        </div>
                      </div>
                      {categoryMetrics.map(metric => (
                        <StatRow
                          key={metric.id}
                          label={metric.metricName}
                          target={metric.targetDisplay}
                          current={getMetricValue(currentSession, metric.id)}
                          previous={getMetricValue(previousSession, metric.id)}
                          unit={metric.unit}
                          higherIsBetter={metric.higherIsBetter}
                        />
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Session History Summary */}
              {sessions.length >= 2 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Session History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {sessions.slice(0, 5).map((session, idx) => {
                        const totalDist = session.metrics.find(m => m.metricId === 'total_distance');
                        const lateralMiss = session.metrics.find(m => m.metricId === 'avg_lateral_miss');
                        
                        return (
                          <div 
                            key={session.id} 
                            className={`flex items-center justify-between py-2 px-3 rounded-lg ${
                              idx === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium">
                                {format(session.date, 'dd MMM yyyy')}
                              </span>
                              {idx === 0 && (
                                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              {totalDist && (
                                <span className="text-muted-foreground">
                                  Distance: <span className="text-foreground font-medium">{totalDist.valueDisplay}m</span>
                                </span>
                              )}
                              {lateralMiss && (
                                <span className="text-muted-foreground">
                                  Lateral: <span className="text-foreground font-medium">{lateralMiss.valueDisplay}m</span>
                                </span>
                              )}
                              {session.consistency && (
                                <span className={`font-medium ${
                                  session.consistency.overallScore >= 80 ? 'text-green-500' :
                                  session.consistency.overallScore >= 60 ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                  {session.consistency.overallScore}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {sessions.length > 5 && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Showing last 5 of {sessions.length} sessions
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Averages Table */}
              {averages && Object.keys(averages).length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      All-Time Averages ({sessions.length} sessions)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {metrics.slice(0, 8).map(metric => {
                        const avg = averages[metric.id];
                        if (avg === undefined) return null;
                        
                        return (
                          <div key={metric.id} className="text-center p-3 bg-muted/50 rounded-lg">
                            <div className="text-lg font-bold">{avg}{metric.unit}</div>
                            <div className="text-xs text-muted-foreground">{metric.metricName}</div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
