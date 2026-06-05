import { AlertTriangle, CheckCircle2, Hammer, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ShotDecision, ShotDecisionBucket, ShotDecisionSummary as ShotDecisionSummaryData } from '@/lib/reportGappingShots';

const BUCKETS: Array<{
  key: ShotDecisionBucket;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  className: string;
}> = [
  {
    key: 'trust',
    title: 'Trust',
    description: 'Reliable enough to use with confidence.',
    icon: CheckCircle2,
    className: 'border-green-500/30 bg-green-500/5 text-green-800 dark:text-green-200',
  },
  {
    key: 'build',
    title: 'Build',
    description: 'Usable, with clear scoring upside.',
    icon: Hammer,
    className: 'border-blue-500/30 bg-blue-500/5 text-blue-800 dark:text-blue-200',
  },
  {
    key: 'caution',
    title: 'Caution',
    description: 'Risky enough to choose carefully.',
    icon: AlertTriangle,
    className: 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200',
  },
  {
    key: 'retest',
    title: 'Re-test',
    description: 'Needs a fresher or larger sample.',
    icon: RotateCcw,
    className: 'border-muted bg-muted/30 text-muted-foreground',
  },
];

function countDecisions(summary: ShotDecisionSummaryData): number {
  return BUCKETS.reduce((total, bucket) => total + summary[bucket.key].length, 0);
}

function hasReviewedShot(summary: ShotDecisionSummaryData): boolean {
  return BUCKETS.some((bucket) => summary[bucket.key].some((decision) => decision.shot.metrics.shotCount > 0));
}

function DecisionChip({
  decision,
  selected,
  onSelect,
}: {
  decision: ShotDecision;
  selected: boolean;
  onSelect: (shotKey: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={`h-auto w-full justify-start rounded-xl p-3 text-left ${selected ? 'border-primary bg-primary/5' : 'bg-background'}`}
      onClick={() => onSelect(decision.shot.key)}
    >
      <span className="grid gap-1">
        <span className="font-semibold text-foreground">{decision.shot.label}</span>
        <span className="text-xs leading-5 text-muted-foreground">{decision.reason}</span>
      </span>
    </Button>
  );
}

export function ShotDecisionSummary({
  summary,
  unmatchedCount,
  selectedShotKey,
  onSelectShot,
}: {
  summary: ShotDecisionSummaryData;
  unmatchedCount: number;
  selectedShotKey?: string;
  onSelectShot: (shotKey: string) => void;
}) {
  const total = countDecisions(summary);
  const reviewed = hasReviewedShot(summary);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>Shot Decision Summary</CardTitle>
            <CardDescription>
              Shot categories come from your Gapping setup, so this review matches the shots you actually practise.
            </CardDescription>
          </div>
          <Badge variant="outline">{total} Gapping shots</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!reviewed ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground">
            No reviewed shots yet. Add shots through Gapping and capture practice or round data to generate decisions.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-4">
            {BUCKETS.map((bucket) => {
              const Icon = bucket.icon;
              const decisions = summary[bucket.key];
              return (
                <div key={bucket.key} className={`rounded-xl border p-4 ${bucket.className}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Icon className="h-4 w-4" />
                        {bucket.title}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{bucket.description}</p>
                    </div>
                    <Badge variant="outline">{decisions.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {decisions.length === 0 ? (
                      <div className="rounded-lg border border-dashed bg-background/60 p-3 text-xs text-muted-foreground">
                        No shots in this bucket.
                      </div>
                    ) : decisions.map((decision) => (
                      <DecisionChip
                        key={decision.shot.key}
                        decision={decision}
                        selected={selectedShotKey === decision.shot.key}
                        onSelect={onSelectShot}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {unmatchedCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            Some historical shots are unmatched and are excluded from decision buckets ({unmatchedCount}).
          </div>
        )}
      </CardContent>
    </Card>
  );
}
