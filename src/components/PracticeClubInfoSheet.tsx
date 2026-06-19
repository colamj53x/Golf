import React, { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  BarChart3,
  Download,
  Loader2,
  Gauge
} from 'lucide-react';
import { BestShotDefinition, MetricStatus, PracticeSession, PracticeMetricTarget } from '@/types/practice';
import { getConfigDisplayName } from '@/types/practiceClubs';
import type { ShotsBySession } from '@/hooks/usePracticeShotsBySessions';
import { calculateShotConsistency, pctWithinTarget, type ShotConsistencyScores } from '@/lib/practiceConsistency';
import { statusFromWithinTarget } from '@/lib/practiceDashboardDomain';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PracticeClubInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configKey: string;
  metrics: PracticeMetricTarget[];
  sessions: PracticeSession[];
  shotsBySession: ShotsBySession;
  bestShotDefinition: BestShotDefinition;
}

const CATEGORY_LABELS: Record<string, string> = {
  distance: 'Distance',
  ball_flight: 'Ball Flight',
  dispersion: 'Dispersion',
  swing: 'Swing',
  tempo: 'Tempo',
};

function StatusDot({ status, title }: { status: MetricStatus | null; title: string }) {
  const color = status === 'green'
    ? 'bg-green-500'
    : status === 'amber'
      ? 'bg-amber-500'
      : status === 'red'
        ? 'bg-red-500'
        : 'bg-muted-foreground/40';

  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${color}`} title={title} />;
}

function improvementStatus(delta: number | null): MetricStatus | null {
  if (delta === null) return null;
  if (delta >= 5) return 'green';
  if (delta <= -5) return 'red';
  return 'amber';
}

function StatRow({ label, current, unit, latest18Pct, improvementDelta }: {
  label: string;
  current: string | null;
  unit: string;
  latest18Pct: number | null;
  improvementDelta: number | null;
}) {
  const currentStatus = statusFromWithinTarget(latest18Pct);
  const recentStatus = improvementStatus(improvementDelta);

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium min-w-[86px] text-right">
          {current ?? '–'}{current && unit ? ` ${unit}` : ''}
        </span>
        <div className="flex min-w-[72px] items-center justify-end gap-1.5 text-xs">
          <StatusDot
            status={currentStatus}
            title={latest18Pct === null ? 'No shot-level status' : `${latest18Pct}% in range over the latest 18 shots`}
          />
          <span>{latest18Pct === null ? '–' : `${latest18Pct}%`}</span>
        </div>
        <div className="flex min-w-[72px] items-center justify-end gap-1.5 text-xs">
          <StatusDot
            status={recentStatus}
            title={improvementDelta === null ? 'No comparison available' : `Latest 9 vs all history: ${improvementDelta > 0 ? '+' : ''}${improvementDelta} percentage points`}
          />
          <span>
            {improvementDelta === null ? '–' : `${improvementDelta > 0 ? '+' : ''}${improvementDelta}pp`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ConsistencyBadge({ score, label }: { score: number | null; label: string }) {
  const getColor = () => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-amber-500';
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

export function PracticeClubInfoSheet({
  open,
  onOpenChange,
  configKey,
  metrics,
  sessions,
  shotsBySession,
  bestShotDefinition,
}: PracticeClubInfoSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const clubDisplayName = getConfigDisplayName(configKey);
  
  const currentSession = sessions[0] || null;

  const allShots = useMemo(
    () => sessions.flatMap(session => shotsBySession[session.id] ?? []),
    [sessions, shotsBySession],
  );
  const latest18Shots = useMemo(() => allShots.slice(0, 18), [allShots]);
  const latest9Shots = useMemo(() => allShots.slice(0, 9), [allShots]);
  const consistencyScores = useMemo(
    () => calculateShotConsistency(
      latest18Shots,
      metrics,
      bestShotDefinition.conditions,
      configKey,
    ),
    [bestShotDefinition.conditions, configKey, latest18Shots, metrics],
  );

  const metricShotSummary = useMemo(() => {
    const result: Record<string, { latest18Pct: number | null; improvementDelta: number | null }> = {};
    for (const metric of metrics) {
      const latest18Pct = pctWithinTarget(
        metric.id,
        latest18Shots,
        metric.targetMin,
        metric.targetMax,
        configKey,
      );
      const latest9Pct = pctWithinTarget(
        metric.id,
        latest9Shots,
        metric.targetMin,
        metric.targetMax,
        configKey,
      );
      const historyPct = pctWithinTarget(
        metric.id,
        allShots,
        metric.targetMin,
        metric.targetMax,
        configKey,
      );
      result[metric.id] = {
        latest18Pct,
        improvementDelta: latest9Pct === null || historyPct === null
          ? null
          : Math.round(latest9Pct - historyPct),
      };
    }
    return result;
  }, [allShots, configKey, latest18Shots, latest9Shots, metrics]);

  const getSessionConsistency = (session: PracticeSession): ShotConsistencyScores => {
    const sessionShots = shotsBySession[session.id] ?? [];
    if (sessionShots.length > 0) {
      return calculateShotConsistency(
        sessionShots,
        metrics,
        bestShotDefinition.conditions,
        configKey,
      );
    }
    return {
      distance: session.consistency?.distancePct ?? null,
      lateral: session.consistency?.lateralPct ?? null,
      best: session.consistency?.bestPct ?? null,
      overall: session.consistency?.overallScore ?? null,
    };
  };
  
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
              {latest18Shots.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-primary" />
                      Consistency Scores
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Based on the latest {latest18Shots.length} shot{latest18Shots.length !== 1 ? 's' : ''}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <ConsistencyBadge 
                        score={consistencyScores.distance}
                        label="Distance" 
                      />
                      <ConsistencyBadge 
                        score={consistencyScores.lateral}
                        label="Lateral" 
                      />
                      <ConsistencyBadge 
                        score={consistencyScores.best}
                        label="Best Shots" 
                      />
                      <ConsistencyBadge 
                        score={consistencyScores.overall}
                        label="Overall" 
                      />
                    </div>
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
                      <div className="flex justify-between text-xs text-muted-foreground mb-2">
                        <span>Metric</span>
                        <div className="flex gap-3">
                          <span className="min-w-[86px] text-right">Current</span>
                          <span className="min-w-[72px] text-right">Latest 18</span>
                          <span className="min-w-[72px] text-right">Last 9 vs all</span>
                        </div>
                      </div>
                      {categoryMetrics.map(metric => {
                        const summary = metricShotSummary[metric.id];
                        return (
                          <StatRow
                            key={metric.id}
                            label={metric.metricName}
                            current={getMetricValue(currentSession, metric.id)}
                            unit={metric.unit}
                            latest18Pct={summary?.latest18Pct ?? null}
                            improvementDelta={summary?.improvementDelta ?? null}
                          />
                        );
                      })}
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
                    <div className="mb-2 grid grid-cols-[minmax(120px,1fr)_repeat(4,minmax(58px,auto))] gap-3 px-3 text-right text-xs text-muted-foreground">
                      <span className="text-left">Session</span>
                      <span>Distance</span>
                      <span>Lateral</span>
                      <span>Best</span>
                      <span>Overall</span>
                    </div>
                    <div className="space-y-2">
                      {sessions.slice(0, 8).map((session, idx) => {
                        const scores = getSessionConsistency(session);

                        return (
                          <div 
                            key={session.id} 
                            className={`grid grid-cols-[minmax(120px,1fr)_repeat(4,minmax(58px,auto))] items-center gap-3 py-2 px-3 rounded-lg ${
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
                            <span className="text-right text-sm font-medium">{scores.distance === null ? '–' : `${scores.distance}%`}</span>
                            <span className="text-right text-sm font-medium">{scores.lateral === null ? '–' : `${scores.lateral}%`}</span>
                            <span className="text-right text-sm font-medium">{scores.best === null ? '–' : `${scores.best}%`}</span>
                            <span className={`text-right text-sm font-semibold ${
                              scores.overall === null ? 'text-muted-foreground' :
                              scores.overall >= 80 ? 'text-green-500' :
                              scores.overall >= 50 ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              {scores.overall === null ? '–' : `${scores.overall}%`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {sessions.length > 8 && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        Showing last 8 of {sessions.length} sessions
                      </p>
                    )}
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
