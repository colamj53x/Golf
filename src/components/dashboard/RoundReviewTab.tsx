import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent } from '@/lib/golfCalculations';
import { describeHandicapEquivalent } from '@/lib/analysisSynthesis';
import { buildRoundReview, RoundReviewRow } from '@/lib/roundReview';
import { ClubConfig, Shot } from '@/types/golf';

interface RoundReviewTabProps {
  shots: Shot[];
  clubs: ClubConfig[];
  distanceToTargetTolerance: number;
  roundDate: string;
}

const formatSqi = (value: number | null) => value === null ? '-' : `${Math.round(value)} / 100`;

function QualityValue({ value }: { value: number | null }) {
  return (
    <div>
      <div className="font-semibold">{formatSqi(value)}</div>
      <div className="text-xs text-primary">{describeHandicapEquivalent(value)}</div>
    </div>
  );
}

function SummaryCard({ label, round, last5, recentThird, format }: {
  label: string;
  round: number | null;
  last5: number | null;
  recentThird: number | null;
  format: (value: number | null) => string;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{format(round)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border bg-muted/40 p-2"><div className="text-muted-foreground">Last 5 prior rounds</div><div className="mt-1 font-semibold">{format(last5)}</div></div>
          <div className="rounded-md border bg-muted/40 p-2"><div className="text-muted-foreground">Prior recent 1/3</div><div className="mt-1 font-semibold">{format(recentThird)}</div></div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonTable({ title, description, rows, simple = false }: {
  title: string;
  description: string;
  rows: RoundReviewRow[];
  simple?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{title === 'By Distance' ? 'Distance' : title === 'By Lie' ? 'Lie' : 'Club · Shot Type'}</th>
                <th>Shots</th>
                <th>Shot Quality</th>
                {!simple && <th>L5 Prior</th>}
                {!simple && <th>Prior Recent 1/3</th>}
                <th>Bad Miss</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  <td className="font-medium">{row.label}</td>
                  <td>{row.round.shotCount}</td>
                  <td><QualityValue value={row.round.shotQualityIndex} /></td>
                  {!simple && <td><QualityValue value={row.last5.shotQualityIndex} /></td>}
                  {!simple && <td><QualityValue value={row.recentThird.shotQualityIndex} /></td>}
                  <td>{formatPercent(row.round.badMissPct)}</td>
                  <td>{formatPercent(row.round.onTargetPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function RoundReviewTab({ shots, clubs, distanceToTargetTolerance, roundDate }: RoundReviewTabProps) {
  const review = useMemo(
    () => buildRoundReview(shots, clubs, distanceToTargetTolerance, roundDate),
    [shots, clubs, distanceToTargetTolerance, roundDate]
  );

  if (review.round.shotCount === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No non-putting shots recorded in this round.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Shot Quality" round={review.round.shotQualityIndex} last5={review.last5.shotQualityIndex} recentThird={review.recentThird.shotQualityIndex} format={formatSqi} />
        <SummaryCard label="Bad Miss" round={review.round.badMissPct} last5={review.last5.badMissPct} recentThird={review.recentThird.badMissPct} format={formatPercent} />
        <SummaryCard label="Accuracy" round={review.round.onTargetPct} last5={review.last5.onTargetPct} recentThird={review.recentThird.onTargetPct} format={formatPercent} />
      </div>

      <ComparisonTable title="By Club And Shot Type" description="Every non-putting shot in this round, compared with the same club and shot type before this round." rows={review.clubAndTypeRows} />

      <Card>
        <CardHeader>
          <CardTitle>Distance Totals</CardTitle>
          <CardDescription>Roll-up counts only. The distance bands below are non-overlapping.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-sm text-muted-foreground">All reviewed shots</div>
            <div className="text-2xl font-bold">{review.round.shotCount}</div>
            <div className="text-xs text-muted-foreground">non-putting shots this round</div>
          </div>
          {review.distanceRollups.map(row => (
            <div key={row.key} className="rounded-md border bg-muted/30 p-3">
              <div className="text-sm text-muted-foreground">{row.label}</div>
              <div className="text-2xl font-bold">{row.round.shotCount}</div>
              <div className="text-xs text-muted-foreground">shots this round</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <ComparisonTable title="By Distance" description="Target distance at the start of each shot. Each shot appears in one band only." rows={review.distanceRows} />
      <ComparisonTable title="By Lie" description="Starting lie for each non-putting shot in this round." rows={review.lieRows} simple />
    </div>
  );
}
