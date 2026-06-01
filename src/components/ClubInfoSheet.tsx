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
  Download,
  Loader2
} from 'lucide-react';
import { ClubRatings, getRatingColor, getImprovementDisplay } from '@/lib/clubRatings';
import { formatPercent, formatDistance } from '@/lib/golfCalculations';
import { ClubConfig } from '@/types/golf';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MetricData {
  shotCount: number;
  onTargetPct: number;
  rightPct: number;
  leftPct: number;
  shortPct: number;
  badMissPct: number;
  avgDistanceHit: number;
  longestHit: number;
  distanceVariation: number;
  sideVariation: number;
  strikeCentrePct: number;
  greensTargetedPct: number;
  greensHitPct: number;
  avgDistanceToTarget: number | null;
  distanceToTargetVariation: number | null;
  proximityWithin1mPct: number;
  proximityWithin3mPct: number;
  proximityWithin5mPct: number;
  proximityWithin10mPct: number;
  shotQualityPcts: Record<string, number>;
}

interface ClubInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubName: string;
  config: ClubConfig | undefined;
  ratings: ClubRatings;
  overall: MetricData;
  last5Rounds: MetricData;
  periods: {
    mostRecent: MetricData;
    middle: MetricData;
    oldest: MetricData;
  };
  quartiles: {
    top25: MetricData;
    top50: MetricData;
    top75: MetricData;
    top100: MetricData;
  };
}

function RatingBadge({ score, label }: { score: number; label: string }) {
  const colorClass = getRatingColor(score);
  return (
    <div className="text-center">
      <div className={`text-3xl font-bold ${colorClass}`}>{score}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function TrendIndicator({ current, previous, higherIsBetter = true }: { current: number | null; previous: number | null; higherIsBetter?: boolean }) {
  if (current === null || previous === null) return <Minus className="h-4 w-4 text-muted-foreground" />;
  
  const diff = current - previous;
  const isImproving = higherIsBetter ? diff > 0 : diff < 0;
  const isWorsening = higherIsBetter ? diff < 0 : diff > 0;
  
  if (Math.abs(diff) < 1) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (isImproving) return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (isWorsening) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function StatRow({ 
  label, 
  value, 
  l5rValue, 
  format,
  trend,
  higherIsBetter = true
}: { 
  label: string; 
  value: number | null; 
  l5rValue?: number | null;
  format: (v: number | null) => string;
  trend?: { mostRecent: number | null; oldest: number | null };
  higherIsBetter?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        {l5rValue !== undefined && (
          <span className="text-sm text-primary font-medium">{format(l5rValue)}</span>
        )}
        <span className="text-sm font-semibold min-w-[60px] text-right">{format(value)}</span>
        {trend && (
          <TrendIndicator 
            current={trend.mostRecent} 
            previous={trend.oldest} 
            higherIsBetter={higherIsBetter} 
          />
        )}
      </div>
    </div>
  );
}

export function ClubInfoSheet({
  open,
  onOpenChange,
  clubName,
  config,
  ratings,
  overall,
  last5Rounds,
  periods,
  quartiles
}: ClubInfoSheetProps) {
  const distanceToTargetEnabled = config?.distanceToTargetEnabled ?? false;
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const exportToPDF = async () => {
    if (!contentRef.current) return;
    
    setIsExporting(true);
    
    try {
      const content = contentRef.current;
      
      // Create canvas from content
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
      
      // Calculate how many pages we need
      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const pageHeight = pdfHeight - 20; // Leave margins
      
      if (scaledHeight <= pageHeight) {
        // Single page
        pdf.addImage(imgData, 'PNG', imgX, 10, scaledWidth, scaledHeight);
      } else {
        // Multi-page
        let yPosition = 0;
        const pageImgHeight = (pageHeight / ratio);
        
        while (yPosition < imgHeight) {
          const sourceY = yPosition;
          const sourceHeight = Math.min(pageImgHeight, imgHeight - yPosition);
          
          // Create a cropped canvas for this page section
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
      
      // Save the PDF
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`${clubName.replace(/\s+/g, '-')}-performance-report-${date}.pdf`);
    } catch (error) {
      console.error('Error exporting PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };
  
  const improvement = getImprovementDisplay(ratings.improvement);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <BarChart3 className="h-6 w-6 text-primary" />
                {clubName} Performance Report
              </DialogTitle>
              <DialogDescription>
                Comprehensive analysis based on {overall.shotCount} shots
                {config && ` • Stock: ${config.stockDistance}m`}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              disabled={isExporting}
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
          {/* Ratings Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Performance Ratings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <RatingBadge score={ratings.capability} label="Capability" />
                <RatingBadge score={ratings.consistency} label="Consistency" />
                <RatingBadge score={ratings.currentForm} label="Current Form" />
                <div className="text-center">
                  <div className={`text-2xl font-bold ${improvement.color}`}>
                    {improvement.text}
                  </div>
                  <div className="text-xs text-muted-foreground">Improvement</div>
                </div>
              </div>
              
              {ratings.capability > ratings.consistency + 10 && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Gap Alert: Your top shots ({ratings.capability}) significantly outperform your average ({ratings.consistency}). 
                      Focus on consistency drills.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Metrics */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Accuracy & Dispersion */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Accuracy & Dispersion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span></span>
                  <span className="text-primary">L5R</span>
                  <span>Overall</span>
                  <span>Trend</span>
                </div>
                <StatRow 
                  label="On-Target %" 
                  value={overall.onTargetPct} 
                  l5rValue={last5Rounds.onTargetPct}
                  format={formatPercent}
                  trend={{ mostRecent: periods.mostRecent.onTargetPct, oldest: periods.oldest.onTargetPct }}
                  higherIsBetter={true}
                />
                <StatRow 
                  label="Bad Miss %" 
                  value={overall.badMissPct} 
                  l5rValue={last5Rounds.badMissPct}
                  format={formatPercent}
                  trend={{ mostRecent: periods.mostRecent.badMissPct, oldest: periods.oldest.badMissPct }}
                  higherIsBetter={false}
                />
                <StatRow 
                  label="Right %" 
                  value={overall.rightPct} 
                  l5rValue={last5Rounds.rightPct}
                  format={formatPercent}
                  higherIsBetter={false}
                />
                <StatRow 
                  label="Left %" 
                  value={overall.leftPct} 
                  l5rValue={last5Rounds.leftPct}
                  format={formatPercent}
                  higherIsBetter={false}
                />
                <StatRow 
                  label="Side Variation" 
                  value={overall.sideVariation} 
                  l5rValue={last5Rounds.sideVariation}
                  format={formatDistance}
                  trend={{ mostRecent: periods.mostRecent.sideVariation, oldest: periods.oldest.sideVariation }}
                  higherIsBetter={false}
                />
              </CardContent>
            </Card>

            {/* Distance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distance Control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span></span>
                  <span className="text-primary">L5R</span>
                  <span>Overall</span>
                  <span>Trend</span>
                </div>
                <StatRow 
                  label="Avg Distance" 
                  value={overall.avgDistanceHit} 
                  l5rValue={last5Rounds.avgDistanceHit}
                  format={formatDistance}
                  trend={{ mostRecent: periods.mostRecent.avgDistanceHit, oldest: periods.oldest.avgDistanceHit }}
                />
                <StatRow 
                  label="Longest Hit" 
                  value={overall.longestHit} 
                  l5rValue={last5Rounds.longestHit}
                  format={formatDistance}
                />
                <StatRow 
                  label="Distance Variation" 
                  value={overall.distanceVariation} 
                  l5rValue={last5Rounds.distanceVariation}
                  format={formatDistance}
                  trend={{ mostRecent: periods.mostRecent.distanceVariation, oldest: periods.oldest.distanceVariation }}
                  higherIsBetter={false}
                />
                <StatRow 
                  label="Short %" 
                  value={overall.shortPct} 
                  l5rValue={last5Rounds.shortPct}
                  format={formatPercent}
                  higherIsBetter={false}
                />
                <StatRow 
                  label="Strike Centre %" 
                  value={overall.strikeCentrePct} 
                  l5rValue={last5Rounds.strikeCentrePct}
                  format={formatPercent}
                  trend={{ mostRecent: periods.mostRecent.strikeCentrePct, oldest: periods.oldest.strikeCentrePct }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Green Metrics (if enabled) */}
          {distanceToTargetEnabled && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Green & Proximity Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <StatRow 
                      label="Greens Targeted %" 
                      value={overall.greensTargetedPct} 
                      l5rValue={last5Rounds.greensTargetedPct}
                      format={formatPercent}
                    />
                    <StatRow 
                      label="Greens Hit %" 
                      value={overall.greensHitPct} 
                      l5rValue={last5Rounds.greensHitPct}
                      format={formatPercent}
                      trend={{ mostRecent: periods.mostRecent.greensHitPct, oldest: periods.oldest.greensHitPct }}
                    />
                    <StatRow 
                      label="Avg Distance to Pin" 
                      value={overall.avgDistanceToTarget} 
                      l5rValue={last5Rounds.avgDistanceToTarget}
                      format={formatDistance}
                      higherIsBetter={false}
                    />
                  </div>
                  <div className="space-y-1">
                    <StatRow 
                      label="Within 1m %" 
                      value={overall.proximityWithin1mPct} 
                      l5rValue={last5Rounds.proximityWithin1mPct}
                      format={formatPercent}
                    />
                    <StatRow 
                      label="Within 3m %" 
                      value={overall.proximityWithin3mPct} 
                      l5rValue={last5Rounds.proximityWithin3mPct}
                      format={formatPercent}
                    />
                    <StatRow 
                      label="Within 5m %" 
                      value={overall.proximityWithin5mPct} 
                      l5rValue={last5Rounds.proximityWithin5mPct}
                      format={formatPercent}
                    />
                    <StatRow 
                      label="Within 10m %" 
                      value={overall.proximityWithin10mPct} 
                      l5rValue={last5Rounds.proximityWithin10mPct}
                      format={formatPercent}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trend Comparison */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Period Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Metric</th>
                      <th className="text-center py-2 font-medium text-primary">Recent 1/3</th>
                      <th className="text-center py-2 font-medium">Middle 1/3</th>
                      <th className="text-center py-2 font-medium">Oldest 1/3</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2">On-Target %</td>
                      <td className="text-center font-medium">{formatPercent(periods.mostRecent.onTargetPct)}</td>
                      <td className="text-center">{formatPercent(periods.middle.onTargetPct)}</td>
                      <td className="text-center">{formatPercent(periods.oldest.onTargetPct)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Bad Miss %</td>
                      <td className="text-center font-medium">{formatPercent(periods.mostRecent.badMissPct)}</td>
                      <td className="text-center">{formatPercent(periods.middle.badMissPct)}</td>
                      <td className="text-center">{formatPercent(periods.oldest.badMissPct)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Avg Distance</td>
                      <td className="text-center font-medium">{formatDistance(periods.mostRecent.avgDistanceHit)}</td>
                      <td className="text-center">{formatDistance(periods.middle.avgDistanceHit)}</td>
                      <td className="text-center">{formatDistance(periods.oldest.avgDistanceHit)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Side Variation</td>
                      <td className="text-center font-medium">{formatDistance(periods.mostRecent.sideVariation)}</td>
                      <td className="text-center">{formatDistance(periods.middle.sideVariation)}</td>
                      <td className="text-center">{formatDistance(periods.oldest.sideVariation)}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Strike Centre %</td>
                      <td className="text-center font-medium">{formatPercent(periods.mostRecent.strikeCentrePct)}</td>
                      <td className="text-center">{formatPercent(periods.middle.strikeCentrePct)}</td>
                      <td className="text-center">{formatPercent(periods.oldest.strikeCentrePct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Capability Tiers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Capability Analysis (Quality Tiers)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Metric</th>
                      <th className="text-center py-2 font-medium text-green-500">Top 25%</th>
                      <th className="text-center py-2 font-medium">Top 50%</th>
                      <th className="text-center py-2 font-medium">Top 75%</th>
                      <th className="text-center py-2 font-medium text-muted-foreground">All Shots</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-2">On-Target %</td>
                      <td className="text-center font-medium text-green-500">{formatPercent(quartiles.top25.onTargetPct)}</td>
                      <td className="text-center">{formatPercent(quartiles.top50.onTargetPct)}</td>
                      <td className="text-center">{formatPercent(quartiles.top75.onTargetPct)}</td>
                      <td className="text-center text-muted-foreground">{formatPercent(quartiles.top100.onTargetPct)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Avg Distance</td>
                      <td className="text-center font-medium text-green-500">{formatDistance(quartiles.top25.avgDistanceHit)}</td>
                      <td className="text-center">{formatDistance(quartiles.top50.avgDistanceHit)}</td>
                      <td className="text-center">{formatDistance(quartiles.top75.avgDistanceHit)}</td>
                      <td className="text-center text-muted-foreground">{formatDistance(quartiles.top100.avgDistanceHit)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2">Side Variation</td>
                      <td className="text-center font-medium text-green-500">{formatDistance(quartiles.top25.sideVariation)}</td>
                      <td className="text-center">{formatDistance(quartiles.top50.sideVariation)}</td>
                      <td className="text-center">{formatDistance(quartiles.top75.sideVariation)}</td>
                      <td className="text-center text-muted-foreground">{formatDistance(quartiles.top100.sideVariation)}</td>
                    </tr>
                    <tr>
                      <td className="py-2">Strike Centre %</td>
                      <td className="text-center font-medium text-green-500">{formatPercent(quartiles.top25.strikeCentrePct)}</td>
                      <td className="text-center">{formatPercent(quartiles.top50.strikeCentrePct)}</td>
                      <td className="text-center">{formatPercent(quartiles.top75.strikeCentrePct)}</td>
                      <td className="text-center text-muted-foreground">{formatPercent(quartiles.top100.strikeCentrePct)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
