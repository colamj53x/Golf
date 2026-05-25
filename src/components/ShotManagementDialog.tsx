import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PracticeShotData } from '@/types/practiceShots';
import { usePracticeShots } from '@/hooks/usePracticeShots';
import { PracticeSession, PracticeMetricValue, ConsistencyData } from '@/types/practice';
import { calculateMetricsFromShots, PracticeShot } from '@/lib/practiceSpreadsheetParser';
import { usePracticeData } from '@/context/PracticeDataContext';
import { Loader2, RotateCcw } from 'lucide-react';

interface ShotManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: PracticeSession | null;
  distanceTargetMin?: number;
  lateralTargetMax?: number;
}

export function ShotManagementDialog({
  open,
  onOpenChange,
  session,
  distanceTargetMin = 145,
  lateralTargetMax = 10,
}: ShotManagementDialogProps) {
  const { updatePracticeSession } = usePracticeData();
  const {
    shots,
    includedShots,
    excludedCount,
    isLoading,
    toggleExcluded,
    hasShots,
  } = usePracticeShots(session?.id ?? null);

  const [recalculating, setRecalculating] = useState(false);

  // Convert db shots to parser format for recalculation
  const includedPracticeShots: PracticeShot[] = useMemo(() => {
    return includedShots.map(s => ({
      shotNumber: s.shotNumber,
      tempo: s.metrics.tempo || '',
      carry: s.metrics.carry,
      total: s.metrics.total,
      ballSpeed: s.metrics.ballSpeed,
      height: s.metrics.height,
      launchAngle: s.metrics.launchAngle,
      launchDirection: s.metrics.launchDirection,
      carrySide: s.metrics.carrySide,
      backswingTime: s.metrics.backswingTime,
      downswingTime: s.metrics.downswingTime,
      attackAngle: s.metrics.attackAngle,
      swingSpeed: s.metrics.swingSpeed,
      peakHandSpeed: s.metrics.peakHandSpeed,
    }));
  }, [includedShots]);

  // Recalculate session metrics based on included shots
  const handleRecalculate = async () => {
    if (!session || includedPracticeShots.length === 0) return;

    setRecalculating(true);
    try {
      const result = calculateMetricsFromShots(
        includedPracticeShots,
        distanceTargetMin,
        lateralTargetMax
      );

      // Convert to array format for storage
      const metricsArray: PracticeMetricValue[] = Object.values(result.metrics);
      const consistency: ConsistencyData = result.consistency;

      // Preserve existing session notes - don't overwrite with generated notes
      await updatePracticeSession(session.id, {
        metrics: metricsArray,
        consistency,
        notes: session.notes,
      });

      onOpenChange(false);
    } finally {
      setRecalculating(false);
    }
  };

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Shots</span>
            {excludedCount > 0 && (
              <Badge variant="outline" className="ml-2">
                {excludedCount} excluded
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasShots ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No individual shot data available for this session.</p>
            <p className="text-sm mt-2">
              Individual shots are only saved for sessions created from spreadsheet uploads after this feature was added.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <div className="w-8">Inc.</div>
                <div>#</div>
                <div>Total</div>
                <div>Carry</div>
                <div>Lateral</div>
                <div>Attack</div>
              </div>
              
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className={`grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 text-sm py-2 border-b border-border/50 items-center ${
                    shot.excluded ? 'opacity-50 bg-muted/30' : ''
                  }`}
                >
                  <Checkbox
                    checked={!shot.excluded}
                    onCheckedChange={() => toggleExcluded(shot.id)}
                    className="w-4 h-4"
                  />
                  <div className="font-medium">{shot.shotNumber}</div>
                  <div>{shot.metrics.total}m</div>
                  <div>{shot.metrics.carry}m</div>
                  <div className={shot.metrics.carrySide >= 0 ? 'text-blue-600' : 'text-red-600'}>
                    {Math.abs(shot.metrics.carrySide).toFixed(1)}{shot.metrics.carrySide >= 0 ? 'R' : 'L'}
                  </div>
                  <div>{shot.metrics.attackAngle.toFixed(1)}°</div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {includedShots.length} of {shots.length} shots included
              </div>
              <Button
                onClick={handleRecalculate}
                disabled={recalculating || includedShots.length === 0}
                className="gap-2"
              >
                {recalculating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Recalculate Metrics
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
