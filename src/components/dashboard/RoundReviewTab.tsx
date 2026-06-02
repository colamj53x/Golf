import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useGolfData } from '@/context/GolfDataContext';
import { usePracticeData } from '@/context/PracticeDataContext';
import { usePracticeShotsBySessions } from '@/hooks/usePracticeShotsBySessions';
import { formatPercent } from '@/lib/golfCalculations';
import { describeHandicapEquivalent } from '@/lib/analysisSynthesis';
import { buildCourseShotGappingAssignments } from '@/lib/gapping';
import { buildRoundReview, RoundReviewRow } from '@/lib/roundReview';
import { useShotProfiles } from '@/lib/shotProfiles';
import { ClubConfig, Shot } from '@/types/golf';

interface RoundReviewTabProps {
  shots: Shot[];
  clubs: ClubConfig[];
  distanceToTargetTolerance: number;
  roundDate: string;
}

const formatSqi = (value: number | null) => value === null ? '-' : `${Math.round(value)} / 100`;
type ClubSortKey = 'club' | 'shot-type' | 'power' | 'shots' | 'quality' | 'bad-miss' | 'accuracy';

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

function SortableHeader({ label, sortKey, activeSort, direction, onSort }: {
  label: string;
  sortKey: ClubSortKey;
  activeSort: ClubSortKey;
  direction: 'asc' | 'desc';
  onSort: (key: ClubSortKey) => void;
}) {
  const Icon = activeSort === sortKey ? direction === 'asc' ? ArrowUp : ArrowDown : ArrowUpDown;
  return <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => onSort(sortKey)}>{label}<Icon className="h-3.5 w-3.5" /></button>;
}

function ComparisonTable({ title, description, rows, simple = false, clubSort, clubSortDirection, onClubSort }: {
  title: string;
  description: string;
  rows: RoundReviewRow[];
  simple?: boolean;
  clubSort?: ClubSortKey;
  clubSortDirection?: 'asc' | 'desc';
  onClubSort?: (key: ClubSortKey) => void;
}) {
  const clubTable = title === 'By Club And Shot Type' && clubSort && clubSortDirection && onClubSort;
  const header = (label: string, key: ClubSortKey) => clubTable
    ? <SortableHeader label={label} sortKey={key} activeSort={clubSort} direction={clubSortDirection} onSort={onClubSort} />
    : label;
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
                {clubTable ? <><th>{header('Club', 'club')}</th><th>{header('Shot Type', 'shot-type')}</th><th>{header('Power', 'power')}</th></> : <th>{title === 'By Distance' ? 'Distance' : title === 'By Lie' ? 'Lie' : 'Club · Shot Type'}</th>}
                <th>{header('Shots', 'shots')}</th>
                <th>{header('Shot Quality', 'quality')}</th>
                {!simple && <th>L5 Prior</th>}
                {!simple && <th>Prior Recent 1/3</th>}
                <th>{header('Bad Miss', 'bad-miss')}</th>
                <th>{header('Accuracy', 'accuracy')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.key}>
                  {clubTable ? <><td className="font-medium">{row.clubLabel}</td><td>{row.shotTypeLabel}</td><td>{row.powerLabel}</td></> : <td className="font-medium">{row.label}</td>}
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
  const { gappingHcpTarget } = useGolfData();
  const { practiceConfigs, practiceSessions } = usePracticeData();
  const profiles = useShotProfiles();
  const practiceSessionIds = useMemo(() => practiceSessions.map((session) => session.id), [practiceSessions]);
  const { shotsBySession } = usePracticeShotsBySessions(practiceSessionIds);
  const [clubSort, setClubSort] = useState<ClubSortKey>('club');
  const [clubSortDirection, setClubSortDirection] = useState<'asc' | 'desc'>('asc');
  const gappingAssignments = useMemo(() => buildCourseShotGappingAssignments({
    profiles,
    shots,
    practiceSessions,
    practiceConfigs,
    shotsBySession,
    gappingHcpTarget,
  }).shotToAssignment, [gappingHcpTarget, practiceConfigs, practiceSessions, profiles, shots, shotsBySession]);
  const review = useMemo(
    () => buildRoundReview(shots, clubs, distanceToTargetTolerance, roundDate, gappingAssignments),
    [shots, clubs, distanceToTargetTolerance, roundDate, gappingAssignments]
  );

  if (review.round.shotCount === 0) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">No non-putting shots recorded in this round.</CardContent></Card>;
  }

  const sortedClubAndTypeRows = [...review.clubAndTypeRows].sort((a, b) => {
    const direction = clubSortDirection === 'asc' ? 1 : -1;
    if (clubSort === 'shots') return direction * (a.round.shotCount - b.round.shotCount);
    if (clubSort === 'quality') return direction * ((a.round.shotQualityIndex ?? -1) - (b.round.shotQualityIndex ?? -1));
    if (clubSort === 'bad-miss') return direction * (a.round.badMissPct - b.round.badMissPct);
    if (clubSort === 'accuracy') return direction * (a.round.onTargetPct - b.round.onTargetPct);
    if (clubSort === 'shot-type') return direction * (a.shotTypeLabel ?? '').localeCompare(b.shotTypeLabel ?? '');
    if (clubSort === 'power') return direction * (a.powerLabel ?? '').localeCompare(b.powerLabel ?? '');
    return direction * (a.clubLabel ?? '').localeCompare(b.clubLabel ?? '');
  });
  const handleClubSort = (key: ClubSortKey) => {
    if (key === clubSort) {
      setClubSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
      return;
    }
    setClubSort(key);
    setClubSortDirection(key === 'club' || key === 'shot-type' || key === 'power' ? 'asc' : 'desc');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Shot Quality" round={review.round.shotQualityIndex} last5={review.last5.shotQualityIndex} recentThird={review.recentThird.shotQualityIndex} format={formatSqi} />
        <SummaryCard label="Bad Miss" round={review.round.badMissPct} last5={review.last5.badMissPct} recentThird={review.recentThird.badMissPct} format={formatPercent} />
        <SummaryCard label="Accuracy" round={review.round.onTargetPct} last5={review.last5.onTargetPct} recentThird={review.recentThird.onTargetPct} format={formatPercent} />
      </div>

      <ComparisonTable title="By Club And Shot Type" description="Every non-putting shot in this round, assigned by the same Club, Shot Type, and Power classifier used by Gapping. Click a column heading to sort." rows={sortedClubAndTypeRows} clubSort={clubSort} clubSortDirection={clubSortDirection} onClubSort={handleClubSort} />

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
          {review.distanceWarning && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-800 sm:col-span-3">
              {review.distanceWarning}
            </div>
          )}
        </CardContent>
      </Card>

      {!review.distanceWarning && <ComparisonTable title="By Distance" description="Distance to target at the start of each shot. Each shot appears in one band only." rows={review.distanceRows} />}
      <ComparisonTable title="By Lie" description="Starting lie for each non-putting shot in this round." rows={review.lieRows} simple />
    </div>
  );
}
